import { authorize, logout, redeem } from './pilot-store.mjs'

const COOKIE = 'sam_pilot'
const costly = new Set(['/api/deepseek', '/api/deepseek/extract', '/api/deepseek/extract-multimodal'])
const loginPage = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>学生事务管家 · 邀请测试</title><style>body{font:16px/1.6 system-ui,sans-serif;background:#f4f7f4;color:#183b36;margin:0;padding:24px}main{max-width:430px;margin:8vh auto;background:white;padding:30px;border:1px solid #c7d9d2;border-radius:12px}input,button{box-sizing:border-box;width:100%;font:inherit;padding:12px;margin-top:10px}button{background:#174c43;color:white;border:0;border-radius:6px;cursor:pointer}small{display:block;color:#4b625d;margin-top:16px}</style></head><body><main><h1>邀请测试</h1><p>请输入收到的个人邀请码。请勿将邀请码转发给其他人。</p><form method="post" action="/__pilot/login"><label for="code">邀请码</label><input id="code" name="code" autocomplete="off" required maxlength="32"><button type="submit">进入测试</button></form><small>邀请码失效、测试尚未开始或已经结束时，请联系邀请你的人。工作区数据保存在当前浏览器，请在测试结束前导出。</small></main></body></html>`

function respond(res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY', ...extra })
  res.end(body)
}
function cookie(request) {
  const pairs = (request.headers.cookie || '').split(';').map((part) => part.trim().split('='))
  const values = pairs.filter(([name]) => name === COOKIE).map(([, value]) => value)
  return values.length === 1 ? values[0] : ''
}
function readSmallBody(request) {
  return new Promise((resolve, reject) => {
    let text = ''
    request.on('data', (chunk) => { text += chunk; if (text.length > 4096) { reject(new Error('BODY_TOO_LARGE')); request.destroy() } })
    request.on('end', () => resolve(text))
    request.on('error', reject)
  })
}
function rateGuard() {
  const entries = new Map()
  return (key) => {
    const now = Date.now()
    for (const [entry, item] of entries) if (item.until <= now) entries.delete(entry)
    if (!entries.has(key) && entries.size >= 10000) return false
    const item = entries.get(key) ?? { until: now + 900000, count: 0 }
    item.count++
    entries.set(key, item)
    return item.count <= 20
  }
}

export function createPilotHandler(file) {
  const permitLogin = rateGuard()
  return async (request, response, url, clientAddress) => {
    const path = url.pathname
    const token = cookie(request)
    const api = path === '/api' || path.startsWith('/api/')
    // Never accept credentials or sessions over cleartext, including the public IP.
    if (url.protocol !== 'https:') { respond(response, 403, '{"error":"HTTPS_REQUIRED"}'); return true }
    if (path === '/__pilot/login' && request.method === 'GET') {
      respond(response, 200, loginPage, 'text/html; charset=utf-8', { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" }); return true
    }
    if (path === '/__pilot/login' && request.method === 'POST') {
      if (request.headers.origin !== url.origin || !permitLogin(clientAddress)) { respond(response, 403, '{"error":"LOGIN_NOT_ALLOWED"}'); return true }
      const form = new URLSearchParams(await readSmallBody(request))
      const session = redeem(file, form.get('code') || '')
      if (!session) { respond(response, 401, '邀请码无效、已过期或测试尚未开放。', 'text/plain; charset=utf-8'); return true }
      respond(response, 303, '', 'text/plain; charset=utf-8', { location: '/', 'set-cookie': `${COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Strict` }); return true
    }
    if (path === '/__pilot/logout' && request.method === 'POST') {
      if (request.headers.origin !== url.origin) { respond(response, 403, '{"error":"ORIGIN_NOT_ALLOWED"}'); return true }
      logout(file, token)
      respond(response, 200, '{}', undefined, { 'set-cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` }); return true
    }
    const result = authorize(file, token)
    if (path === '/__pilot/status') {
      respond(response, result.allowed ? 200 : 401, JSON.stringify(result)); return true
    }
    if (!result.allowed) {
      if (api) respond(response, 401, '{"error":"PILOT_ACCESS_REQUIRED"}')
      else respond(response, 303, '', 'text/plain; charset=utf-8', { location: '/__pilot/login' })
      return true
    }
    if (api && result.phase === 'export') { respond(response, 403, '{"error":"PILOT_EXPORT_ONLY","message":"测试已结束，云端功能已关闭；请导出本机数据。"}'); return true }
    if (api && request.method === 'POST' && costly.has(path)) {
      if (request.headers.origin !== url.origin) { respond(response, 403, '{"error":"ORIGIN_NOT_ALLOWED"}'); return true }
      const reservation = authorize(file, token, { consume: true })
      if (!reservation.allowed) { respond(response, reservation.phase === 'quota' ? 429 : 403, JSON.stringify({ error: reservation.phase === 'quota' ? 'PILOT_QUOTA_EXHAUSTED' : 'PILOT_ACCESS_ENDED', message: '本轮云端整理额度已用完或测试已结束。' })); return true }
    }
    return false
  }
}
