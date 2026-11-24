import { authorize, logout, pilotPhase, redeem } from './pilot-store.mjs'

const COOKIE = 'sam_pilot'
const costly = new Set(['/api/deepseek', '/api/deepseek/extract', '/api/deepseek/extract-multimodal'])
const pilotCsp = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"

function renderEntry(phase, reportError = false) {
  const canEnter = phase === 'active' || phase === 'export'
  const heading = phase === 'closed' ? '本轮测试已结束' : '学生事务管家邀请测试'
  const description = {
    pending: '本轮测试尚未开放。请以邀请人告知的开始时间为准。',
    active: '请输入个人邀请码。体验时请优先使用虚构或脱敏通知。',
    export: '测试已结束。参加过本轮测试的同学可用原邀请码登录，在保存数据的原浏览器导出。',
    closed: '本轮的线上访问及导出窗口已关闭。已下载的备份仍可保存在你的设备上。',
    unavailable: '测试入口暂时无法使用，请稍后重试或联系邀请人。',
  }[phase]
  const form = canEnter ? `<form method="post" action="/__pilot/login">
        <label for="code">邀请码</label>
        <input id="code" name="code" autocomplete="off" autocapitalize="none" spellcheck="false" required maxlength="32">
        <button type="submit">${phase === 'export' ? '进入并导出' : '进入测试'}</button>
      </form>` : ''
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${heading}</title>
  <style>
    body { font: 16px/1.6 system-ui, sans-serif; background: #f4f7f4; color: #183b36; margin: 0; padding: 24px; }
    main { max-width: 430px; margin: 6vh auto; background: white; padding: clamp(18px, 5vw, 30px); border: 1px solid #c7d9d2; border-radius: 12px; }
    h1 { font-size: 24px; line-height: 1.35; }
    input, button { box-sizing: border-box; width: 100%; font: inherit; padding: 12px; margin-top: 10px; }
    button { background: #174c43; color: white; border: 0; border-radius: 6px; cursor: pointer; }
    small { display: block; color: #4b625d; margin-top: 16px; }
    .error { color: #872c19; }
    footer { text-align: center; margin-top: 24px; }
    a { color: #174c43; }
  </style>
</head>
<body>
  <main>
    <h1>${heading}</h1>
    <p>${description}</p>
    ${reportError ? '<p class="error" role="alert">当前邀请码无法进入。请核对邀请码和访问时间。</p>' : ''}
    ${form}
    ${canEnter ? '<small>请勿转发邀请码。工作区保存在当前浏览器，请在导出窗口关闭前保存备份。</small>' : ''}
  </main>
  <footer><a href="https://beian.miit.gov.cn/">桂ICP备2026027233号-1</a></footer>
</body>
</html>`
}

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
function entryPage(file, response, error = false) {
  let phase
  try { phase = pilotPhase(file) } catch { phase = 'unavailable' }
  const status = phase === 'unavailable' ? 503 : error ? 401 : 200
  respond(response, status, renderEntry(phase, error), 'text/html; charset=utf-8', { 'content-security-policy': pilotCsp })
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

export function createPilotHandler(file, readBody) {
  const permitLogin = rateGuard()
  return async (request, response, url, clientAddress) => {
    const path = url.pathname
    const token = cookie(request)
    const api = path === '/api' || path.startsWith('/api/')
    // Never accept credentials or sessions over cleartext, including the public IP.
    if (url.protocol !== 'https:') { respond(response, 403, '{"error":"HTTPS_REQUIRED"}'); return true }
    if (path === '/__pilot/login' && request.method === 'GET') { entryPage(file, response); return true }
    if (path === '/__pilot/login' && request.method === 'POST') {
      if (request.headers.origin !== url.origin) { respond(response, 403, '{"error":"LOGIN_NOT_ALLOWED"}'); return true }
      if (!permitLogin(clientAddress)) { respond(response, 429, '尝试次数过多，请稍后再试。', 'text/plain; charset=utf-8'); return true }
      const form = new URLSearchParams((await readBody(request, 4096)).toString('utf8'))
      const session = redeem(file, form.get('code')?.trim() || '')
      if (!session) { entryPage(file, response, true); return true }
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
    if (!result.cloudEnabled && path === '/api/deepseek/status' && request.method === 'GET') {
      respond(response, 200, '{"configured":false,"capabilityStatus":"pilot-paused"}'); return true
    }
    if (api && request.method === 'POST' && costly.has(path)) {
      if (request.headers.origin !== url.origin) { respond(response, 403, '{"error":"ORIGIN_NOT_ALLOWED"}'); return true }
      if (!result.cloudEnabled) {
        respond(response, 503, '{"error":"PILOT_MODEL_PAUSED","message":"本轮云端整理已暂停，仍可使用本机整理。"}'); return true
      }
      const reservation = authorize(file, token, { consume: true })
      if (!reservation.allowed) { respond(response, reservation.phase === 'quota' ? 429 : 403, JSON.stringify({ error: reservation.phase === 'quota' ? 'PILOT_QUOTA_EXHAUSTED' : 'PILOT_ACCESS_ENDED', message: '本轮云端整理额度已用完或测试已结束。' })); return true }
    }
    return { token }
  }
}
