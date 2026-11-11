import { lookup } from 'node:dns/promises'
import https from 'node:https'
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib'
import { isPrivateIp } from './web-fetch-service.mjs'

const MAX_WEB_RESPONSE_BYTES = 512 * 1024

function codedError(code) {
  const error = new Error(code)
  error.code = code
  return error
}

function privateAddressError() {
  return codedError('WEB_PRIVATE_ADDRESS_FORBIDDEN')
}

function deadlineError() {
  return Object.assign(codedError('WEB_FETCH_TIMEOUT'), { name: 'TimeoutError' })
}

export function lookupWithDeadline(lookupImpl, hostname, options, signal, timeoutMs = 10_000) {
  if (signal?.aborted) return Promise.reject(deadlineError())
  let timer
  let onAbort
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(deadlineError()), timeoutMs)
  })
  const racers = [
    Promise.resolve().then(() => lookupImpl(hostname, options)),
    timeout,
  ]
  if (signal) {
    racers.push(new Promise((_, reject) => {
      onAbort = () => reject(deadlineError())
      signal.addEventListener('abort', onAbort, { once: true })
    }))
  }
  return Promise.race(racers).finally(() => {
    clearTimeout(timer)
    if (signal && onAbort) signal.removeEventListener('abort', onAbort)
  })
}

export async function resolvePublicNodeHostname(hostname, optionsOrLookup = lookup, lookupImpl = lookup, timeoutMs = 10_000) {
  const resolver = typeof optionsOrLookup === 'function' ? optionsOrLookup : lookupImpl
  const signal = typeof optionsOrLookup === 'object' ? optionsOrLookup?.signal : undefined
  let addresses
  try {
    addresses = await lookupWithDeadline(resolver, hostname, { all: true, verbatim: true }, signal, timeoutMs)
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError' || error?.code === 'WEB_FETCH_TIMEOUT') throw error
    throw Object.assign(new Error('WEB_DNS_FAILED'), { code: 'WEB_DNS_FAILED' })
  }
  if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw privateAddressError()
  }
}

export function callPinnedLookup(hostname, options, callback, lookupImpl = lookup, timeoutMs = 10_000) {
  lookupWithDeadline(lookupImpl, hostname, { all: true, verbatim: true }, undefined, timeoutMs).then((addresses) => {
    const safe = addresses
      .filter((entry) => entry && !isPrivateIp(entry.address))
      .map((entry) => ({ address: entry.address, family: entry.family }))
    if (!safe.length) {
      callback(privateAddressError())
      return
    }
    if (options?.all) {
      callback(null, safe)
      return
    }
    callback(null, safe[0].address, safe[0].family)
  }).catch((error) => callback(error))
}

function decodeBody(body, encoding, maxBytes) {
  const value = encoding.trim().toLowerCase()
  if (!value || value === 'identity') return body
  const options = { maxOutputLength: maxBytes }
  try {
    if (value === 'gzip' || value === 'x-gzip') return gunzipSync(body, options)
    if (value === 'deflate') return inflateSync(body, options)
    if (value === 'br') return brotliDecompressSync(body, options)
  } catch (error) {
    if (error?.code === 'ERR_BUFFER_TOO_LARGE') throw codedError('WEB_RESPONSE_TOO_LARGE')
    throw codedError('WEB_FETCH_FAILED')
  }
  throw codedError('WEB_FETCH_FAILED')
}

export function createPinnedHttpsFetch({
  lookupImpl = lookup,
  requestImpl = https.request,
  maxBytes = MAX_WEB_RESPONSE_BYTES,
} = {}) {
  return (input, init = {}) => new Promise((resolve, reject) => {
    let settled = false
    const fail = (error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    const succeed = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const target = new URL(input instanceof URL ? input.href : typeof input === 'string' ? input : input.url)
    if (target.protocol !== 'https:') {
      fail(codedError('WEB_HTTPS_REQUIRED'))
      return
    }
    if (init.signal?.aborted) {
      fail(Object.assign(codedError('WEB_FETCH_TIMEOUT'), { name: 'TimeoutError' }))
      return
    }
    const headers = {}
    const source = new Headers(init.headers || {})
    source.forEach((value, key) => {
      headers[key] = value
    })
    if (!source.has('accept-encoding')) headers['accept-encoding'] = 'identity'
    const request = requestImpl({
      hostname: target.hostname,
      servername: target.hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      method: init.method || 'GET',
      headers,
      lookup(hostname, options, callback) {
        callPinnedLookup(hostname, options, callback, lookupImpl)
      },
    }, (response) => {
      const chunks = []
      let received = 0
      let failing = false
      const failResponse = (error) => {
        if (failing) return
        failing = true
        fail(error)
        response.destroy()
        request.destroy()
      }
      response.on('data', (chunk) => {
        received += chunk.length
        if (received > maxBytes) {
          failResponse(codedError('WEB_RESPONSE_TOO_LARGE'))
          return
        }
        chunks.push(chunk)
      })
      response.on('error', () => failResponse(codedError('WEB_FETCH_FAILED')))
      response.on('aborted', () => failResponse(codedError('WEB_FETCH_FAILED')))
      response.on('end', () => {
        const responseHeaders = new Headers()
        const raw = response.rawHeaders || []
        for (let index = 0; index < raw.length; index += 2) responseHeaders.append(raw[index], raw[index + 1])
        let body
        try {
          body = decodeBody(Buffer.concat(chunks), responseHeaders.get('content-encoding') || '', maxBytes)
        } catch (error) {
          fail(error?.code ? error : codedError('WEB_FETCH_FAILED'))
          return
        }
        responseHeaders.delete('content-encoding')
        responseHeaders.delete('content-length')
        const nullBody = response.statusCode === 204 || response.statusCode === 205 || response.statusCode === 304
        try {
          succeed(new Response(nullBody ? null : body, { status: response.statusCode, headers: responseHeaders }))
        } catch (error) {
          fail(error?.code ? error : codedError('WEB_FETCH_FAILED'))
        }
      })
    })
    const abort = () => request.destroy(Object.assign(codedError('WEB_FETCH_TIMEOUT'), { name: 'TimeoutError' }))
    init.signal?.addEventListener('abort', abort, { once: true })
    request.on('upgrade', (_response, socket) => {
      socket?.destroy()
      request.destroy()
      fail(codedError('WEB_FETCH_FAILED'))
    })
    request.on('error', (error) => fail(error?.code ? error : codedError('WEB_FETCH_FAILED')))
    request.on('close', () => init.signal?.removeEventListener('abort', abort))
    if (init.body) request.write(typeof init.body === 'string' || Buffer.isBuffer(init.body) ? init.body : Buffer.from(init.body))
    request.end()
  })
}
