import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_RESPONSE_BYTES = 512 * 1024
const MAX_REDIRECTS = 3

function webError(code) {
  const error = new Error(code)
  error.code = code
  return error
}

function ipv6Hextets(address) {
  const [leftRaw, rightRaw = ''] = address.toLowerCase().split('%')[0].split('::')
  if (address.toLowerCase().split('::').length > 2) return null
  const left = leftRaw ? leftRaw.split(':') : []
  const right = address.includes('::') && rightRaw ? rightRaw.split(':') : []
  if ([...left, ...right].some((part) => part.includes('.'))) return null
  const missing = 8 - left.length - right.length
  if (missing < 0) return null
  return [...left, ...Array(missing).fill('0'), ...right].map((part) => Number.parseInt(part || '0', 16))
}

function isGloballyReachableIetfAssignment(parts) {
  const second = parts[1]
  const rest = parts.slice(2)
  if (second === 0x0001 && rest.slice(0, 5).every((part) => part === 0) && rest[5] >= 1 && rest[5] <= 3) return true
  if (second === 0x0003) return true
  if (second === 0x0004 && parts[2] === 0x0112) return true
  if (second >= 0x0020 && second <= 0x002f) return true
  if (second >= 0x0030 && second <= 0x003f) return true
  return false
}

function wellKnownNat64Address(parts) {
  const prefix = [0x0064, 0xff9b, 0, 0, 0, 0]
  if (!prefix.every((part, index) => parts[index] === part)) return null
  return `${parts[6] >> 8}.${parts[6] & 0xff}.${parts[7] >> 8}.${parts[7] & 0xff}`
}

function isNonGlobalIpv6(address) {
  const parts = ipv6Hextets(address)
  if (!parts || parts.length !== 8 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 0xffff)) return true
  const nat64 = wellKnownNat64Address(parts)
  if (nat64) return isPrivateIp(nat64)
  const [first, second] = parts
  if (first < 0x2000 || first > 0x3fff) return true
  // 3fff::/20 and 2001:db8::/32 are documentation. 2002::/16 is 6to4 and is not marked globally reachable.
  if (first === 0x3fff && second <= 0x0fff) return true
  if (first === 0x2001 && second === 0x0db8) return true
  if (first === 0x2002) return true
  // 2001::/23 is not globally reachable except the IANA exceptions nested inside it.
  if (first === 0x2001 && second <= 0x01ff) return !isGloballyReachableIetfAssignment(parts)
  return false
}

function ipv4Matches(parts, base, prefix) {
  const shift = 32 - prefix
  const ip = (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0)
  const network = (((base[0] << 24) | (base[1] << 16) | (base[2] << 8) | base[3]) >>> 0)
  return (ip >>> shift) === (network >>> shift)
}

function isNonGlobalIpv4(parts) {
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true
  // These two anycast addresses are the globally reachable exceptions inside 192.0.0.0/24.
  if (parts[0] === 192 && parts[1] === 0 && parts[2] === 0 && (parts[3] === 9 || parts[3] === 10)) return false
  const blocked = [
    [[0, 0, 0, 0], 8],
    [[10, 0, 0, 0], 8],
    [[100, 64, 0, 0], 10],
    [[127, 0, 0, 0], 8],
    [[169, 254, 0, 0], 16],
    [[172, 16, 0, 0], 12],
    [[192, 0, 0, 0], 24],
    [[192, 0, 2, 0], 24],
    [[192, 88, 99, 0], 24],
    [[192, 168, 0, 0], 16],
    [[198, 18, 0, 0], 15],
    [[198, 51, 100, 0], 24],
    [[203, 0, 113, 0], 24],
    [[224, 0, 0, 0], 3],
  ]
  return blocked.some(([base, prefix]) => ipv4Matches(parts, base, prefix))
}

export function isPrivateIp(address) {
  const normalized = address.toLowerCase()
  if (normalized.startsWith('::ffff:')) return isPrivateIp(normalized.slice(7))
  if (!isIP(address)) return true
  if (address.includes(':')) return isNonGlobalIpv6(address)
  return isNonGlobalIpv4(address.split('.').map(Number))
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
