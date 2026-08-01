import { timingSafeEqual } from 'node:crypto'
import { isWorkspacePayload } from './workspace-store.mjs'

function json(response, status, payload, headers = {}) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  })
  response.end(JSON.stringify(payload))
}

function authorized(request, expectedToken) {
  const value = request.headers.authorization ?? ''
  const received = value.startsWith('Bearer ') ? value.slice(7) : ''
  const expectedBuffer = Buffer.from(expectedToken)
  const receivedBuffer = Buffer.from(received)
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer)
}

async function readJsonBody(request, maxBytes) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBytes) {
      const error = new Error('PAYLOAD_TOO_LARGE')
      error.code = 'PAYLOAD_TOO_LARGE'
      throw error
    }
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function corsHeaders(request, config) {
  const origin = request.headers.origin
  if (!origin || origin !== config.allowedOrigin) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, PUT, OPTIONS',
    'access-control-allow-private-network': 'true',
    vary: 'Origin',
  }
}

export function createRequestHandler(config, workspaceStore) {
  return async (request, response) => {
    const headers = corsHeaders(request, config)
    if (request.headers.origin && request.headers.origin !== config.allowedOrigin) {
      return json(response, 403, { error: 'ORIGIN_NOT_ALLOWED' })
    }
    if (request.method === 'OPTIONS') {
      if (request.headers.origin && request.headers.origin !== config.allowedOrigin) {
        return json(response, 403, { error: 'ORIGIN_NOT_ALLOWED' })
      }
      response.writeHead(204, headers)
      return response.end()
    }

    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json(response, 200, {
        service: 'student-affairs-local-service',
        status: 'ok',
        capabilities: {
          sync: config.syncConfigured ? 'configured' : 'not-configured',
          email: 'not-configured',
          webMonitoring: 'local-compare-only',
          wechat: 'not-connected',
        },
      }, headers)
    }

    if (url.pathname !== '/api/sync/workspace') {
      return json(response, 404, { error: 'NOT_FOUND' }, headers)
    }
    if (!config.syncConfigured) {
      return json(response, 503, { error: 'SYNC_NOT_CONFIGURED', message: '服务端尚未配置同步令牌。' }, headers)
    }
    if (!authorized(request, config.syncToken)) {
      return json(response, 401, { error: 'UNAUTHORIZED', message: '同步令牌无效。' }, headers)
    }

    if (request.method === 'GET') {
      const record = await workspaceStore.read()
      return record
        ? json(response, 200, record, headers)
        : json(response, 404, { error: 'REMOTE_WORKSPACE_EMPTY', message: '服务端还没有工作区。' }, headers)
    }

    if (request.method === 'PUT') {
      try {
        const body = await readJsonBody(request, config.maxBodyBytes)
        if (!body || typeof body !== 'object') {
          return json(response, 400, { error: 'INVALID_REQUEST' }, headers)
        }
        const { workspace, baseRevision, resolution = 'fail' } = body
        if (!isWorkspacePayload(workspace)) {
          return json(response, 400, { error: 'INVALID_WORKSPACE', message: '工作区结构无效。' }, headers)
        }
        const current = await workspaceStore.read()
        const conflicted = current && baseRevision !== current.revision
        if (conflicted && resolution !== 'replace-remote') {
          return json(response, 409, {
            error: 'SYNC_CONFLICT',
            message: '远端工作区已变化，需要人工选择。',
            remoteRevision: current.revision,
            remoteUpdatedAt: current.updatedAt,
          }, headers)
        }
        const saved = await workspaceStore.write(workspace)
        return json(response, 200, {
          revision: saved.revision,
          updatedAt: saved.updatedAt,
          conflictResolved: Boolean(conflicted),
        }, headers)
      } catch (error) {
        if (error?.code === 'PAYLOAD_TOO_LARGE') {
          return json(response, 413, { error: 'PAYLOAD_TOO_LARGE' }, headers)
        }
        if (error instanceof SyntaxError) return json(response, 400, { error: 'INVALID_JSON' }, headers)
        return json(response, 500, { error: 'INTERNAL_ERROR' }, headers)
      }
    }

    return json(response, 405, { error: 'METHOD_NOT_ALLOWED' }, headers)
  }
}
