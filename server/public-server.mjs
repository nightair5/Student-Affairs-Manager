import { createReadStream, existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWorker } from '../cloudflare/worker.mjs'

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

async function readBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return Buffer.concat(chunks)
}

const FORWARDED_HEADER_BLOCKLIST = new Set([
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

async function toWebRequest(nodeRequest, url) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(nodeRequest.headers)) {
    if (value == null || FORWARDED_HEADER_BLOCKLIST.has(key)) continue
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item))
    else headers.set(key, value)
  }
  if (!headers.has('cf-connecting-ip')) {
    const realIp = headers.get('x-real-ip') || headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    if (realIp) headers.set('cf-connecting-ip', realIp)
  }
  const method = nodeRequest.method || 'GET'
  const init = { method, headers }
  if (method !== 'GET' && method !== 'HEAD') init.body = await readBody(nodeRequest)
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

export function createPublicServer(config, worker = createWorker()) {
  return createServer(async (nodeRequest, nodeResponse) => {
    try {
      const hostHeader = nodeRequest.headers.host || `${config.host}:${config.port}`
      const url = new URL(nodeRequest.url || '/', `http://${hostHeader}`)
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

const entryPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (entryPath === fileURLToPath(import.meta.url)) {
  const config = loadPublicConfig()
  const server = createPublicServer(config)
  server.listen(config.port, config.host, () => {
    console.log(`Student Affairs public server: http://${config.host}:${config.port} (static ${config.staticDir})`)
  })
}
