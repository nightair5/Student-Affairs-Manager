import { lookup } from 'node:dns/promises'
import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWorker } from '../cloudflare/worker.mjs'
import { createPinnedHttpsFetch, resolvePublicNodeHostname } from './pinned-fetch.mjs'

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])

function numberFromEnv(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback
}

export function loadPublicConfig(env = process.env, cwd = process.cwd()) {
  const apiKey = env.DEEPSEEK_API_KEY ?? ''
  const allowedOrigins = env.ALLOWED_ORIGINS ?? ''
  return {
    host: env.SAM_PUBLIC_HOST?.trim() || '127.0.0.1',
    port: numberFromEnv(env.SAM_PUBLIC_PORT, 8788),
    staticDir: resolve(cwd, env.SAM_STATIC_DIR?.trim() || 'dist'),
    httpsEnabled: env.SAM_HTTPS === 'true',
    allowedHosts: (env.SAM_ALLOWED_HOSTS || 'student-affairs.site,118.178.194.96')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
    workerEnv: {
      DEEPSEEK_API_KEY: apiKey,
      ALLOWED_ORIGINS: allowedOrigins,
      ASSETS: {
        fetch: async () => new Response('Not Found', {
          status: 404,
          headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
        }),
      },
    },
  }
}

function resolveInside(root, pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const relative = decoded.replace(/^[/\\]+/u, '')
  const filePath = resolve(root, relative)
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) return null
  return filePath
}

async function fileExists(filePath) {
  try {
    const info = await stat(filePath)
    return info.isFile()
  } catch {
    return false
  }
}

function sendFile(response, filePath, method) {
  const type = MIME_TYPES.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream'
  const immutable = filePath.includes(`${sep}assets${sep}`)
  response.writeHead(200, {
    'content-type': type,
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
  })
  if (method === 'HEAD') {
    response.end()
    return
  }
  const stream = createReadStream(filePath)
  stream.on('error', () => {
    if (!response.headersSent) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
    }
    response.end()
  })
  stream.pipe(response)
}

async function serveStatic(response, pathname, staticDir, method) {
  const root = resolve(staticDir)
  if (!existsSync(root)) {
    response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
    response.end('Static build is missing. Run npm run build.')
    return
  }
  const filePath = resolveInside(root, pathname)
  if (!filePath) {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
    response.end('Bad Request')
    return
  }
  if (await fileExists(filePath)) {
    sendFile(response, filePath, method)
    return
  }
  const nestedIndex = resolveInside(root, `${pathname.replace(/\/$/u, '')}/index.html`)
  if (nestedIndex && await fileExists(nestedIndex)) {
    sendFile(response, nestedIndex, method)
    return
  }
  if (extname(pathname)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
    response.end('Not Found')
    return
  }
  const indexPath = resolve(root, 'index.html')
  if (await fileExists(indexPath)) {
    sendFile(response, indexPath, method)
    return
  }
  response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
  response.end('Static build is missing. Run npm run build.')
}

function maxApiBodyBytes(pathname) {
  if (pathname === '/api/source/fetch') return 4_096
  if (pathname === '/api/deepseek' || pathname === '/api/deepseek/extract') return 100_000
  return 4_096
}

async function readBody(request, maxBytes) {
  const chunks = []
  let received = 0
  for await (const chunk of request) {
    received += chunk.length
    if (received > maxBytes) throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), { code: 'PAYLOAD_TOO_LARGE' })
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

const FORWARDED_HEADER_BLOCKLIST = new Set([
  'cf-connecting-ip',
  'connection',
  'content-length',
  'expect',
  'host',
  'keep-alive',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

function headerValue(nodeRequest, name) {
  const value = nodeRequest.headers[name]
  if (Array.isArray(value)) return value[0]?.trim() ?? ''
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeIp(value) {
  const text = value.trim().toLowerCase()
  return text.startsWith('::ffff:') ? text.slice(7) : text
}

function isLoopback(address) {
  return address === '127.0.0.1' || address === '::1'
}

function trustedClientAddress(nodeRequest) {
  const peer = normalizeIp(nodeRequest.socket?.remoteAddress || '')
  if (isLoopback(peer)) {
    const realIp = headerValue(nodeRequest, 'x-real-ip').slice(0, 80)
    if (realIp) return realIp
  }
  return peer || 'unknown'
}

function hostnameFromHostHeader(value) {
  const host = value.split(',')[0].trim().toLowerCase()
  if (host.startsWith('[')) {
    const end = host.indexOf(']')
    return end === -1 ? host : host.slice(1, end)
  }
  return host.replace(/:\d+$/u, '')
}

function isAllowedHost(hostHeader, config) {
  const name = hostnameFromHostHeader(hostHeader)
  return name === 'localhost' || name === '127.0.0.1' || name === '::1' || config.allowedHosts.includes(name)
}

function originFormPath(raw) {
  const value = raw || '/'
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  if (/^[a-z][a-z0-9+.-]*:/iu.test(value)) return null
  return value
}

function externalRequestUrl(nodeRequest, config) {
  const path = originFormPath(nodeRequest.url)
  if (!path) return null
  const hostHeader = nodeRequest.headers.host || `${config.host}:${config.port}`
  const peer = normalizeIp(nodeRequest.socket?.remoteAddress || '')
  const forwardedProto = isLoopback(peer)
    ? headerValue(nodeRequest, 'x-forwarded-proto').split(',')[0].trim().toLowerCase()
    : ''
  const protocol = forwardedProto === 'https' || forwardedProto === 'http'
    ? forwardedProto
    : config.httpsEnabled ? 'https' : 'http'
  return new URL(path, `${protocol}://${hostHeader}`)
}

async function toWebRequest(nodeRequest, url) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(nodeRequest.headers)) {
    if (value == null || FORWARDED_HEADER_BLOCKLIST.has(key)) continue
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item))
    else headers.set(key, value)
  }
  headers.set('cf-connecting-ip', trustedClientAddress(nodeRequest))
  const method = nodeRequest.method || 'GET'
  const init = { method, headers }
  if (method !== 'GET' && method !== 'HEAD') init.body = await readBody(nodeRequest, maxApiBodyBytes(url.pathname))
  return new Request(url, init)
}

function publicHeaders(response, httpsEnabled) {
  const headers = {}
  response.headers.forEach((value, key) => {
    if (key === 'content-length' || key === 'transfer-encoding' || key === 'connection') return
    if (key === 'strict-transport-security' && !httpsEnabled) return
    headers[key] = value
  })
  return headers
}

function createPinnedWorker() {
  return createWorker({
    fetcher: createPinnedHttpsFetch(),
    resolveHostname: (hostname, signal) => resolvePublicNodeHostname(hostname, lookup, signal),
  })
}

export function createPublicServer(config, worker = createPinnedWorker()) {
  return createServer(async (nodeRequest, nodeResponse) => {
    try {
      if (!isAllowedHost(nodeRequest.headers.host || '', config)) {
        nodeResponse.writeHead(421, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
        nodeResponse.end('Misdirected Request')
        return
      }
      const url = externalRequestUrl(nodeRequest, config)
      if (!url) {
        nodeResponse.writeHead(400, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
        nodeResponse.end('Bad Request')
        return
      }
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        const response = await worker.fetch(await toWebRequest(nodeRequest, url), config.workerEnv)
        const body = Buffer.from(await response.arrayBuffer())
        nodeResponse.writeHead(response.status, publicHeaders(response, config.httpsEnabled))
        nodeResponse.end(body)
        return
      }
      if (nodeRequest.method !== 'GET' && nodeRequest.method !== 'HEAD') {
        nodeResponse.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', allow: 'GET, HEAD' })
        nodeResponse.end('Method Not Allowed')
        return
      }
      await serveStatic(nodeResponse, url.pathname, config.staticDir, nodeRequest.method || 'GET')
    } catch (error) {
      if (error?.code === 'PAYLOAD_TOO_LARGE') {
        if (!nodeResponse.headersSent) {
          nodeResponse.writeHead(413, {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            connection: 'close',
          })
        }
        nodeResponse.end(JSON.stringify({ error: 'PAYLOAD_TOO_LARGE' }))
        nodeRequest.removeAllListeners('data')
        nodeRequest.resume()
        return
      }
      console.error(JSON.stringify({
        error: 'PUBLIC_SERVER_ERROR',
        name: error instanceof Error ? error.name : 'Error',
      }))
      if (!nodeResponse.headersSent) {
        nodeResponse.writeHead(500, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
      }
      nodeResponse.end('Internal Server Error')
    }
  })
}

function loadOptionalEnvFile(filePath) {
  if (!existsSync(filePath)) return
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator <= 0) continue
    const key = trimmed.slice(0, separator).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key) || process.env[key] !== undefined) continue
    let value = trimmed.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (entryPath === fileURLToPath(import.meta.url)) {
  loadOptionalEnvFile(resolve(process.cwd(), '.env'))
  const config = loadPublicConfig()
  const server = createPublicServer(config)
  server.listen(config.port, config.host, () => {
    console.log(`Student Affairs public server: http://${config.host}:${config.port} (static ${config.staticDir})`)
  })
}
