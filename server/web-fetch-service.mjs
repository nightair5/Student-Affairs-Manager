import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_RESPONSE_BYTES = 512 * 1024
const MAX_REDIRECTS = 3

function webError(code) {
  const error = new Error(code)
  error.code = code
  return error
}

function isPrivateIp(address) {
  const normalized = address.toLowerCase()
  if (normalized.startsWith('::ffff:')) return isPrivateIp(normalized.slice(7))
  if (normalized === '::1' || normalized === '::') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true
  if (normalized.startsWith('2001:db8:')) return true
  if (!isIP(address)) return true
  if (address.includes(':')) return false
  const parts = address.split('.').map(Number)
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 0 && (parts[2] === 0 || parts[2] === 2)) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19 || parts[1] === 51)) ||
    (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) ||
    parts[0] >= 224
}

function isPrivateHostname(hostname) {
  const blockedSuffixes = ['.localhost', '.local', '.internal', '.lan', '.home', '.arpa', '.onion']
  return hostname === 'localhost'
    || !hostname.includes('.')
    || blockedSuffixes.some((suffix) => hostname.endsWith(suffix))
    || Boolean(isIP(hostname))
}

export function validateFetchTarget(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    return { error: 'WEB_URL_INVALID' }
  }
  const hostname = url.hostname.toLowerCase()
  if (url.protocol !== 'https:') return { error: 'WEB_HTTPS_REQUIRED' }
  if (url.username || url.password) return { error: 'WEB_CREDENTIALS_FORBIDDEN' }
  if (url.port && url.port !== '443') return { error: 'WEB_PORT_FORBIDDEN' }
  if (isPrivateHostname(hostname)) {
    return { error: 'WEB_PRIVATE_ADDRESS_FORBIDDEN' }
  }
  url.hash = ''
  return { url }
}

function htmlToText(value) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

export class DisabledWebFetcher {
  configured = false
  async fetchText() {
    const error = new Error('WEB_FETCH_NOT_CONFIGURED')
    error.code = 'WEB_FETCH_NOT_CONFIGURED'
    throw error
  }
}

async function readBoundedBody(response) {
  const declaredSize = Number(response.headers.get('content-length') ?? 0)
  if (Number.isFinite(declaredSize) && declaredSize > MAX_RESPONSE_BYTES) throw webError('WEB_RESPONSE_TOO_LARGE')
  if (!response.body) return Buffer.alloc(0)
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel('response-too-large').catch(() => undefined)
      throw webError('WEB_RESPONSE_TOO_LARGE')
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks, total)
}

export class PublicWebFetcher {
  configured = true

  constructor(fetcher = fetch, resolver = lookup) {
    this.fetcher = fetcher
    this.resolver = resolver
  }

  async fetchText(value) {
    const target = validateFetchTarget(value)
    if (target.error) throw webError(target.error)
    const signal = AbortSignal.timeout(10_000)
    let currentUrl = target.url
    let response
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      let addresses
      try {
        addresses = await this.resolver(currentUrl.hostname, { all: true, verbatim: true })
      } catch {
        throw webError('WEB_DNS_FAILED')
      }
      if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
        throw webError('WEB_PRIVATE_ADDRESS_FORBIDDEN')
      }
      try {
        response = await this.fetcher(currentUrl, {
          redirect: 'manual',
          headers: { accept: 'text/html,text/plain;q=0.9', 'user-agent': 'Student-Affairs-Monitor/1.0' },
          signal,
        })
      } catch (error) {
        if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
          throw webError('WEB_FETCH_TIMEOUT')
        }
        throw webError('WEB_FETCH_FAILED')
      }
      if (response.status < 300 || response.status >= 400) break
      if (redirectCount === MAX_REDIRECTS) throw webError('WEB_REDIRECT_LIMIT')
      const location = response.headers.get('location')
      if (!location) throw webError('WEB_REDIRECT_INVALID')
      const redirected = validateFetchTarget(new URL(location, currentUrl).toString())
      if (redirected.error) throw webError(redirected.error)
      currentUrl = redirected.url
    }
    if (!response) throw webError('WEB_FETCH_FAILED')
    if (!response.ok) {
      throw webError('WEB_FETCH_FAILED')
    }
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw webError('WEB_CONTENT_TYPE_UNSUPPORTED')
    }
    const buffer = await readBoundedBody(response)
    return {
      finalUrl: currentUrl.toString(),
      text: htmlToText(buffer.toString('utf8')).slice(0, 80_000),
      fetchedAt: new Date().toISOString(),
    }
  }
}

export function createWebFetcher(config) {
  return config.webFetchConfigured
    ? new PublicWebFetcher()
    : new DisabledWebFetcher()
}
