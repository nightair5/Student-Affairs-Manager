import { lookup } from 'node:dns/promises'
import https from 'node:https'
import { isPrivateIp } from './web-fetch-service.mjs'

function privateAddressError() {
  const error = new Error('WEB_PRIVATE_ADDRESS_FORBIDDEN')
  error.code = 'WEB_PRIVATE_ADDRESS_FORBIDDEN'
  return error
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

export function createPinnedHttpsFetch({ lookupImpl = lookup } = {}) {
  return (input, init = {}) => new Promise((resolve, reject) => {
    const target = new URL(typeof input === 'string' ? input : input.url)
    if (target.protocol !== 'https:') {
      reject(Object.assign(new Error('WEB_HTTPS_REQUIRED'), { code: 'WEB_HTTPS_REQUIRED' }))
      return
    }
    const headers = {}
    const source = new Headers(init.headers || {})
    source.forEach((value, key) => {
      headers[key] = value
    })
    const request = https.request({
      hostname: target.hostname,
      servername: target.hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      method: init.method || 'GET',
      headers,
      lookup(hostname, _options, callback) {
        lookupImpl(hostname, { all: true, verbatim: true }).then((addresses) => {
          const safe = addresses.find((entry) => !isPrivateIp(entry.address))
          if (!safe) {
            callback(privateAddressError())
            return
          }
          callback(null, safe.address, safe.family)
        }).catch((error) => callback(error))
      },
    }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => {
        const responseHeaders = new Headers()
        const raw = response.rawHeaders || []
        for (let index = 0; index < raw.length; index += 2) responseHeaders.append(raw[index], raw[index + 1])
        resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers: responseHeaders }))
      })
    })
    const abort = () => request.destroy(Object.assign(new Error('WEB_FETCH_TIMEOUT'), { code: 'WEB_FETCH_TIMEOUT', name: 'TimeoutError' }))
    init.signal?.addEventListener('abort', abort, { once: true })
    request.on('error', reject)
    request.on('close', () => init.signal?.removeEventListener('abort', abort))
    if (init.body) request.write(typeof init.body === 'string' || Buffer.isBuffer(init.body) ? init.body : Buffer.from(init.body))
    request.end()
  })
}
