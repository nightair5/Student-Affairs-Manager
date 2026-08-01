import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_RESPONSE_BYTES = 512 * 1024

function isPrivateIp(address) {
  if (address === '::1' || address === '::') return true
  if (address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:')) return true
  if (!isIP(address)) return true
  if (address.includes(':')) return false
  const parts = address.split('.').map(Number)
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
}

export function validateFetchTarget(value, allowedHosts) {
  let url
  try {
    url = new URL(value)
  } catch {
    return { error: 'WEB_URL_INVALID' }
  }
  const hostname = url.hostname.toLowerCase()
  if (url.protocol !== 'https:') return { error: 'WEB_HTTPS_REQUIRED' }
  if (url.username || url.password) return { error: 'WEB_CREDENTIALS_FORBIDDEN' }
  if (!allowedHosts.includes(hostname)) return { error: 'WEB_HOST_NOT_ALLOWED' }
  if (hostname === 'localhost' || (isIP(hostname) && isPrivateIp(hostname))) {
    return { error: 'WEB_PRIVATE_ADDRESS_FORBIDDEN' }
  }
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

export class AllowlistedWebFetcher {
  configured = true

  constructor(allowedHosts, fetcher = fetch, resolver = lookup) {
    this.allowedHosts = allowedHosts
    this.fetcher = fetcher
    this.resolver = resolver
  }

  async fetchText(value) {
    const target = validateFetchTarget(value, this.allowedHosts)
    if (target.error) {
      const error = new Error(target.error)
      error.code = target.error
      throw error
    }
    const addresses = await this.resolver(target.url.hostname, { all: true, verbatim: true })
    if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
      const error = new Error('WEB_PRIVATE_ADDRESS_FORBIDDEN')
      error.code = 'WEB_PRIVATE_ADDRESS_FORBIDDEN'
      throw error
    }
    const response = await this.fetcher(target.url, {
      redirect: 'error',
      headers: { accept: 'text/html,text/plain;q=0.9', 'user-agent': 'Student-Affairs-Monitor/1.0' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      const error = new Error('WEB_FETCH_FAILED')
      error.code = 'WEB_FETCH_FAILED'
      throw error
    }
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      const error = new Error('WEB_CONTENT_TYPE_UNSUPPORTED')
      error.code = 'WEB_CONTENT_TYPE_UNSUPPORTED'
      throw error
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > MAX_RESPONSE_BYTES) {
      const error = new Error('WEB_RESPONSE_TOO_LARGE')
      error.code = 'WEB_RESPONSE_TOO_LARGE'
      throw error
    }
    return {
      finalUrl: target.url.toString(),
      text: htmlToText(buffer.toString('utf8')).slice(0, 80_000),
      fetchedAt: new Date().toISOString(),
    }
  }
}

export function createWebFetcher(config) {
  return config.webFetchConfigured
    ? new AllowlistedWebFetcher(config.webAllowedHosts)
    : new DisabledWebFetcher()
}
