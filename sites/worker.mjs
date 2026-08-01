import { createDeepSeekProvider, validateDeepSeekRequest } from './deepseek-service.js'

function json(payload, status = 200) {
  return Response.json(payload, { status, headers: { 'cache-control': 'no-store' } })
}

function sameOrigin(request) {
  const origin = request.headers.get('origin')
  return !origin || origin === new URL(request.url).origin
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/deepseek')) return env.ASSETS.fetch(request)
    if (!sameOrigin(request)) return json({ error: 'ORIGIN_NOT_ALLOWED' }, 403)

    const provider = createDeepSeekProvider({
      deepSeekApiKey: env.DEEPSEEK_API_KEY?.trim() ?? '',
      deepSeekApiUrl: env.DEEPSEEK_API_URL?.trim() || 'https://api.deepseek.com/chat/completions',
      deepSeekModel: env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat',
      deepSeekConfigured: Boolean(env.DEEPSEEK_API_KEY?.trim()),
    })

    if (request.method === 'GET' && url.pathname === '/api/deepseek/status') {
      return json({ configured: provider.configured })
    }
    if (request.method !== 'POST' || url.pathname !== '/api/deepseek') {
      return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
    }
    if (!provider.configured) {
      return json({ error: 'DEEPSEEK_NOT_CONFIGURED', message: 'DeepSeek 尚未配置服务端密钥。' }, 503)
    }
    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (contentLength > 100_000) return json({ error: 'PAYLOAD_TOO_LARGE' }, 413)

    try {
      const body = await request.json()
      const validationError = validateDeepSeekRequest(body)
      if (validationError) return json({ error: validationError, message: '问题或引用范围无效。' }, 400)
      return json(await provider.ask(body))
    } catch (error) {
      if (error instanceof SyntaxError) return json({ error: 'INVALID_JSON' }, 400)
      const safeCodes = new Set(['DEEPSEEK_RATE_LIMITED', 'DEEPSEEK_UPSTREAM_ERROR', 'DEEPSEEK_RESPONSE_INVALID'])
      const code = safeCodes.has(error?.code) ? error.code : 'INTERNAL_ERROR'
      return json({ error: code, message: error?.message ?? 'DeepSeek 服务暂时无法响应。' }, code === 'DEEPSEEK_RATE_LIMITED' ? 429 : 502)
    }
  },
}
