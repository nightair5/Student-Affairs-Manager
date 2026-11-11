import { lookup } from 'node:dns/promises'
import https from 'node:https'
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

export async function resolvePublicNodeHostname(hostname, lookupImpl = lookup) {
  let addresses
  try {
    addresses = await lookupImpl(hostname, { all: true, verbatim: true })
  } catch {
    throw Object.assign(new Error('WEB_DNS_FAILED'), { code: 'WEB_DNS_FAILED' })
  }
  if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw privateAddressError()
  }
}

export function callPinnedLookup(hostname, options, callback, lookupImpl = lookup) {
  lookupImpl(hostname, { all: true, verbatim: true }).then((addresses) => {
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
    const headers = {}
    const source = new Headers(init.headers || {})
    source.forEach((value, key) => {
      headers[key] = value
    })
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
      const failResponse = (error) => {
        response.destroy()
        request.destroy()
        fail(error)
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
        succeed(new Response(Buffer.concat(chunks), { status: response.statusCode, headers: responseHeaders }))
      })
    })
    const abort = () => request.destroy(Object.assign(codedError('WEB_FETCH_TIMEOUT'), { name: 'TimeoutError' }))
    init.signal?.addEventListener('abort', abort, { once: true })
    request.on('error', (error) => fail(error?.code ? error : codedError('WEB_FETCH_FAILED')))
    request.on('close', () => init.signal?.removeEventListener('abort', abort))
    if (init.body) request.write(typeof init.body === 'string' || Buffer.isBuffer(init.body) ? init.body : Buffer.from(init.body))
    request.end()
  })
}
