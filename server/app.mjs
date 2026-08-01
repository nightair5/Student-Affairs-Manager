import { timingSafeEqual } from 'node:crypto'
import { isWorkspacePayload } from './workspace-store.mjs'
import { validateEmailJobInput } from './email-service.mjs'
import { validateDeepSeekRequest } from './deepseek-service.mjs'

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
    'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
    'access-control-allow-private-network': 'true',
    vary: 'Origin',
  }
}

export function createRequestHandler(config, workspaceStore, emailQueue, emailProvider, webFetcher, deepSeekProvider) {
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
          email: config.emailConfigured ? 'configured' : 'not-configured',
          webMonitoring: webFetcher?.configured ? 'configured' : 'local-compare-only',
          wechat: 'not-connected',
          deepseek: deepSeekProvider?.configured ? 'configured' : 'not-configured',
        },
      }, headers)
    }

    if (request.method === 'GET' && url.pathname === '/api/deepseek/status') {
      return json(response, 200, { configured: deepSeekProvider?.configured === true }, headers)
    }

    if (url.pathname === '/api/deepseek') {
      if (request.method !== 'POST') return json(response, 405, { error: 'METHOD_NOT_ALLOWED' }, headers)
      if (!deepSeekProvider?.configured) {
        return json(response, 503, { error: 'DEEPSEEK_NOT_CONFIGURED', message: 'DeepSeek 尚未配置服务端密钥。' }, headers)
      }
      try {
        const body = await readJsonBody(request, Math.min(config.maxBodyBytes, 100_000))
        const validationError = validateDeepSeekRequest(body)
        if (validationError) return json(response, 400, { error: validationError, message: '问题或引用范围无效。' }, headers)
        return json(response, 200, await deepSeekProvider.ask(body), headers)
      } catch (error) {
        if (error?.code === 'PAYLOAD_TOO_LARGE') return json(response, 413, { error: 'PAYLOAD_TOO_LARGE' }, headers)
        if (error instanceof SyntaxError) return json(response, 400, { error: 'INVALID_JSON' }, headers)
        const safeCodes = new Set(['DEEPSEEK_RATE_LIMITED', 'DEEPSEEK_UPSTREAM_ERROR', 'DEEPSEEK_RESPONSE_INVALID'])
        const code = safeCodes.has(error?.code) ? error.code : 'INTERNAL_ERROR'
        return json(response, code === 'DEEPSEEK_RATE_LIMITED' ? 429 : 502, { error: code, message: error?.message ?? 'DeepSeek 服务暂时无法响应。' }, headers)
      }
    }

    if (url.pathname.startsWith('/api/email/')) {
      if (!config.syncConfigured) {
        return json(response, 503, { error: 'SERVICE_AUTH_NOT_CONFIGURED', message: '服务端尚未配置访问令牌。' }, headers)
      }
      if (!authorized(request, config.syncToken)) {
        return json(response, 401, { error: 'UNAUTHORIZED', message: '服务令牌无效。' }, headers)
      }
      if (!emailQueue || !emailProvider) return json(response, 503, { error: 'EMAIL_SERVICE_UNAVAILABLE' }, headers)

      if (request.method === 'GET' && url.pathname === '/api/email/status') {
        return json(response, 200, {
          provider: emailProvider.name,
          configured: emailProvider.configured,
          state: emailProvider.configured ? 'configured' : 'not-configured',
        }, headers)
      }
      if (request.method === 'GET' && url.pathname === '/api/email/jobs') {
        return json(response, 200, { jobs: await emailQueue.readJobs() }, headers)
      }
      if (request.method === 'POST' && url.pathname === '/api/email/jobs') {
        try {
          const body = await readJsonBody(request, config.maxBodyBytes)
          const validationError = validateEmailJobInput(body)
          if (validationError) return json(response, 400, { error: validationError }, headers)
          const job = await emailQueue.enqueue(body, emailProvider)
          return json(response, 202, { job }, headers)
        } catch (error) {
          if (error instanceof SyntaxError) return json(response, 400, { error: 'INVALID_JSON' }, headers)
          return json(response, 500, { error: 'INTERNAL_ERROR' }, headers)
        }
      }
      const retryMatch = url.pathname.match(/^\/api\/email\/jobs\/([^/]+)\/retry$/)
      if (request.method === 'POST' && retryMatch) {
        const job = await emailQueue.retry(decodeURIComponent(retryMatch[1]), emailProvider)
        return job
          ? json(response, 200, { job }, headers)
          : json(response, 404, { error: 'EMAIL_JOB_NOT_FOUND' }, headers)
      }
      if (request.method === 'POST' && url.pathname === '/api/email/process') {
        const jobs = await emailQueue.processDue(emailProvider)
        return json(response, 200, { jobs }, headers)
      }
      return json(response, 404, { error: 'NOT_FOUND' }, headers)
    }

    if (url.pathname === '/api/web/fetch') {
      if (!config.syncConfigured) {
        return json(response, 503, { error: 'SERVICE_AUTH_NOT_CONFIGURED', message: '服务端尚未配置访问令牌。' }, headers)
      }
      if (!authorized(request, config.syncToken)) {
        return json(response, 401, { error: 'UNAUTHORIZED', message: '服务令牌无效。' }, headers)
      }
      if (request.method !== 'POST') return json(response, 405, { error: 'METHOD_NOT_ALLOWED' }, headers)
      if (!webFetcher?.configured) {
        return json(response, 503, { error: 'WEB_FETCH_NOT_CONFIGURED', message: '网页读取未在服务端启用。' }, headers)
      }
      try {
        const body = await readJsonBody(request, config.maxBodyBytes)
        if (!body || typeof body.url !== 'string') return json(response, 400, { error: 'WEB_URL_INVALID' }, headers)
        const result = await webFetcher.fetchText(body.url)
        return json(response, 200, result, headers)
      } catch (error) {
        if (error instanceof SyntaxError) return json(response, 400, { error: 'INVALID_JSON' }, headers)
        const safeCodes = new Set([
          'WEB_URL_INVALID', 'WEB_HTTPS_REQUIRED', 'WEB_CREDENTIALS_FORBIDDEN', 'WEB_HOST_NOT_ALLOWED',
          'WEB_PRIVATE_ADDRESS_FORBIDDEN', 'WEB_FETCH_FAILED', 'WEB_CONTENT_TYPE_UNSUPPORTED', 'WEB_RESPONSE_TOO_LARGE',
        ])
        return json(response, safeCodes.has(error?.code) ? 400 : 500, {
          error: safeCodes.has(error?.code) ? error.code : 'INTERNAL_ERROR',
        }, headers)
      }
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
