import { authorize, confirmPilotNotice, logout, pilotPhase, redeem, summary } from './pilot-store.mjs'
import { PILOT_NOTICE_PATH, PILOT_NOTICE_VERSION, renderPilotNotice, renderPilotPage } from './pilot-notice.mjs'

const COOKIE = 'sam_pilot'
const cookieAttributes = 'Path=/; HttpOnly; Secure; SameSite=Lax'
const sessionPages = new Set(['/', '/__pilot/login', '/__pilot/status', PILOT_NOTICE_PATH])
const costly = new Set(['/api/deepseek', '/api/deepseek/extract', '/api/deepseek/extract-multimodal'])
const pilotCsp = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"

function renderEntry(phase, reportError = false) {
  const canEnter = phase === 'active' || phase === 'export'
  const heading = phase === 'closed' ? '本轮测试已结束' : '学生事务管家邀请测试'
  const description = {
    pending: '本轮测试尚未开放。请以邀请人告知的开始时间为准。',
    active: '请输入个人邀请码。登录后，当前浏览器会记住登录状态。',
    export: '测试已结束。请在保存数据的原浏览器用原邀请码登录，进入备份下载页。',
    closed: '本轮的线上访问及导出窗口已关闭。已下载的备份仍可保存在你的设备上。',
    unavailable: '测试入口暂时无法使用，请稍后重试或联系邀请人。',
  }[phase]
  const form = canEnter ? `<form method="post" action="/__pilot/login">
        <label for="code">邀请码</label>
        <input id="code" name="code" autocomplete="off" autocapitalize="none" spellcheck="false" required maxlength="32">
        <button type="submit">${phase === 'export' ? '进入并导出' : '进入测试'}</button>
      </form>` : ''
  return renderPilotPage(heading, `<p>${description}</p>
    ${reportError ? '<p class="error" role="alert">当前邀请码无法进入。请核对邀请码和访问时间。</p>' : ''}
    ${form}
    ${canEnter ? '<small>请勿转发邀请码。工作区保存在当前浏览器，请在导出窗口关闭前保存备份。</small>' : ''}
    <small><a href="${PILOT_NOTICE_PATH}">用户须知和免责声明</a></small>`)
}

function respond(res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin', 'x-frame-options': 'DENY', ...extra })
  res.end(body)
}
function redirect(response, location, extra = {}) {
  respond(response, 303, '', 'text/plain; charset=utf-8', { location, ...extra })
}
function html(response, status, body) {
  respond(response, status, body, 'text/html; charset=utf-8', { 'content-security-policy': pilotCsp })
}
function cookie(request) {
  const pairs = (request.headers.cookie || '').split(';').map((part) => part.trim().split('='))
  const values = pairs.filter(([name]) => name === COOKIE).map(([, value]) => value)
  return values.length === 1 ? values[0] : ''
}
function sessionCookie(token, exportEndsAt) {
  return `${COOKIE}=${token}; ${cookieAttributes}; Expires=${new Date(exportEndsAt).toUTCString()}`
}
function entryPage(file, response, error = false) {
  let phase
  try { phase = pilotPhase(file) } catch { phase = 'unavailable' }
  const status = phase === 'unavailable' ? 503 : error ? 401 : 200
  html(response, status, renderEntry(phase, error))
}
function noticePage(file, response, now, options) {
  let schedule
  try { schedule = summary(file, now) } catch { /* The notice remains readable while the batch state is unavailable. */ }
  html(response, options.error ? 400 : 200, renderPilotNotice(schedule, options))
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
    if (path === '/__pilot/login' && request.method === 'POST') {
      if (request.headers.origin !== url.origin) { respond(response, 403, '{"error":"LOGIN_NOT_ALLOWED"}'); return true }
      if (!permitLogin(clientAddress)) { respond(response, 429, '尝试次数过多，请稍后再试。', 'text/plain; charset=utf-8'); return true }
      const form = new URLSearchParams((await readBody(request, 4096)).toString('utf8'))
      const session = redeem(file, form.get('code')?.trim() || '')
      if (!session) { entryPage(file, response, true); return true }
      redirect(response, '/', { 'set-cookie': sessionCookie(session.token, session.exportEndsAt) }); return true
    }
    if (path === '/__pilot/logout' && request.method === 'POST') {
      if (request.headers.origin !== url.origin) { respond(response, 403, '{"error":"ORIGIN_NOT_ALLOWED"}'); return true }
      logout(file, token)
      respond(response, 200, '{}', undefined, { 'set-cookie': `${COOKIE}=; ${cookieAttributes}; Max-Age=0` }); return true
    }
    const now = new Date()
    const result = authorize(file, token, { now })
    // Upgrade existing browser sessions without reissuing them or extending the pilot deadline.
    if (result.exportEndsAt && request.method === 'GET' && sessionPages.has(path)) {
      response.setHeader('set-cookie', sessionCookie(token, result.exportEndsAt))
    }
    if (path === '/__pilot/login' && request.method === 'GET') {
      if (result.allowed) redirect(response, '/')
      else if (result.phase === 'notice') redirect(response, PILOT_NOTICE_PATH)
      else entryPage(file, response)
      return true
    }
    if (path === PILOT_NOTICE_PATH) {
      if (request.method === 'GET') {
        noticePage(file, response, now, { confirmation: result.phase === 'notice', canReturn: result.allowed })
      } else if (request.method === 'POST') {
        if (request.headers.origin !== url.origin) respond(response, 403, '{"error":"ORIGIN_NOT_ALLOWED"}')
        else if (result.allowed) redirect(response, '/')
        else if (result.phase !== 'notice') redirect(response, '/__pilot/login')
        else {
          const form = new URLSearchParams((await readBody(request, 4096)).toString('utf8'))
          const version = form.get('notice_version')
          if (version !== PILOT_NOTICE_VERSION) noticePage(file, response, now, { confirmation: true, error: true })
          else {
            confirmPilotNotice(file, token, version)
            redirect(response, '/')
          }
        }
      } else respond(response, 405, '{"error":"METHOD_NOT_ALLOWED"}', undefined, { allow: 'GET, POST' })
      return true
    }
    if (path === '/__pilot/status') {
      respond(response, result.allowed ? 200 : 401, JSON.stringify({ ...result, checkedAtMs: now.getTime() })); return true
    }
    if (!result.allowed) {
      if (api) {
        if (result.phase === 'notice') respond(response, 403, '{"error":"PILOT_NOTICE_REQUIRED","message":"请先阅读并确认用户须知。"}')
        else respond(response, 401, '{"error":"PILOT_ACCESS_REQUIRED"}')
      } else redirect(response, result.phase === 'notice' ? PILOT_NOTICE_PATH : '/__pilot/login')
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
