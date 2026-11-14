import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { authorize, closePilot, initialize, issueInvite, redeem, revokeInvite, withPilotState } from './pilot-store.mjs'
import { createPublicServer, loadPublicConfig } from './public-server.mjs'

function temp() { const dir = mkdtempSync(path.join(os.tmpdir(), 'sa-pilot-')); return { dir, file: path.join(dir, 'state.json') } }
function options(now = Date.now()) { return { startsAt: new Date(now - 10000).toISOString(), endsAt: new Date(now + 60000).toISOString(), exportEndsAt: new Date(now + 120000).toISOString(), dailyUserLimit: 2, dailyGlobalLimit: 3 } }

test('codes and sessions are hashed, persistent, individually revocable and quotas are shared', () => {
  const { dir, file } = temp()
  try {
    initialize(file, options())
    const code1 = issueInvite(file, 'P01'), code2 = issueInvite(file, 'P02')
    const a = redeem(file, code1), b = redeem(file, code2)
    const disk = readFileSync(file, 'utf8')
    for (const secret of [code1, code2, a, b]) assert.equal(disk.includes(secret), false)
    assert.equal(authorize(file, a, { consume: true }).allowed, true)
    assert.equal(authorize(file, a, { consume: true }).allowed, true)
    assert.equal(authorize(file, a, { consume: true }).phase, 'quota')
    assert.equal(authorize(file, b, { consume: true }).allowed, true)
    assert.equal(authorize(file, b, { consume: true }).phase, 'quota')
    revokeInvite(file, 'P01')
    assert.equal(authorize(file, a).allowed, false)
    assert.equal(redeem(file, code1), null)
    assert.equal(authorize(file, b).allowed, true)
    closePilot(file)
    assert.equal(authorize(file, b).allowed, false)
    assert.equal(redeem(file, code2), null)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('date boundaries allow export recovery without cloud quota and close after grace', () => {
  const { dir, file } = temp(), now = Date.now()
  try {
    initialize(file, options(now))
    const code = issueInvite(file, 'P01')
    const a = redeem(file, code, new Date(now))
    assert.equal(authorize(file, a, { now: new Date(now + 60000) }).phase, 'export')
    assert.equal(authorize(file, a, { now: new Date(now + 60000), consume: true }).allowed, false)
    const b = redeem(file, code, new Date(now + 60000))
    assert.equal(authorize(file, a, { now: new Date(now + 60000) }).allowed, false)
    assert.equal(authorize(file, b, { now: new Date(now + 120000) }).allowed, false)
    assert.equal(redeem(file, code, new Date(now + 120000)), null)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('daily limits reset at China midnight and state survives repeated store instances', () => {
  const { dir, file } = temp()
  try {
    initialize(file, { startsAt: '2026-11-14T00:00:00+08:00', endsAt: '2026-11-17T00:00:00+08:00', exportEndsAt: '2026-11-18T00:00:00+08:00', dailyUserLimit: 1, dailyGlobalLimit: 1 })
    const code = issueInvite(file, 'P01')
    const token = redeem(file, code, new Date('2026-11-15T23:59:59+08:00'))
    assert.equal(authorize(file, token, { now: new Date('2026-11-15T23:59:59+08:00'), consume: true }).allowed, true)
    assert.equal(authorize(file, token, { now: new Date('2026-11-15T23:59:59+08:00'), consume: true }).phase, 'quota')
    assert.equal(authorize(file, token, { now: new Date('2026-11-16T00:00:00+08:00'), consume: true }).allowed, true)
    assert.equal(authorize(file, token, { now: new Date('2026-11-16T00:00:00+08:00'), consume: true }).phase, 'quota')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

function call(port, pathname, { method = 'GET', cookie = '', body = '', secure = true, origin = 'https://student-affairs.site' } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method, headers: { host: 'student-affairs.site',
      'x-forwarded-proto': secure ? 'https' : 'http', origin, cookie, 'content-type': 'application/x-www-form-urlencoded' } }, (res) => {
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString() }))
    })
    req.on('error', reject); req.end(body)
  })
}

test('HTTP adapter gates page, assets, every API and enforces quotas before the upstream', async () => {
  const { dir, file } = temp()
  initialize(file, options())
  const code = issueInvite(file, 'P01')
  let upstream = 0
  const worker = { fetch: async () => { upstream++; return Response.json({ ok: true }) } }
  const config = loadPublicConfig({ SAM_PILOT_ENABLED: 'true', SAM_PILOT_STATE_FILE: file, SAM_STATIC_DIR: dir })
  writeFileSync(path.join(dir, 'index.html'), 'test page')
  const server = createPublicServer(config, worker)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  try {
    assert.equal((await call(port, '/')).status, 303)
    assert.equal((await call(port, '/assets/index.js')).status, 303)
    assert.equal((await call(port, '/api/deepseek/status')).status, 401)
    assert.equal((await call(port, '/api/source/fetch', { method: 'POST' })).status, 401)
    assert.equal((await call(port, '/__pilot/login', { method: 'POST', body: `code=${code}`, secure: false })).status, 403)
    assert.equal((await call(port, '/__pilot/login', { method: 'POST', body: `code=${code}`, origin: 'https://evil.example' })).status, 403)
    const login = await call(port, '/__pilot/login', { method: 'POST', body: `code=${code}` })
    assert.equal(login.status, 303)
    assert.match(login.headers['set-cookie'][0], /HttpOnly; Secure; SameSite=Strict/u)
    const cookie = login.headers['set-cookie'][0].split(';')[0]
    assert.equal((await call(port, '/', { cookie })).status, 200)
    assert.equal((await call(port, '/api/deepseek/extract', { method: 'POST', cookie, body: '{}' })).status, 200)
    assert.equal((await call(port, '/api/deepseek', { method: 'POST', cookie, body: '{}' })).status, 200)
    assert.equal((await call(port, '/api/deepseek/extract-multimodal', { method: 'POST', cookie, body: '{}' })).status, 429)
    assert.equal(upstream, 2)
    withPilotState(file, (state) => { state.startsAt = new Date(Date.now() - 120000).toISOString(); state.endsAt = new Date(Date.now() - 60000).toISOString(); state.exportEndsAt = new Date(Date.now() + 60000).toISOString(); return {} })
    assert.equal((await call(port, '/', { cookie })).status, 200)
    assert.equal((await call(port, '/api/source/fetch', { method: 'POST', cookie })).status, 403)
    assert.equal((await call(port, '/api/deepseek/extract', { method: 'POST', cookie })).status, 403)
    assert.equal(upstream, 2)
    revokeInvite(file, 'P01')
    assert.equal((await call(port, '/api/deepseek/status', { cookie })).status, 401)
    assert.equal((await call(port, '/', { cookie })).status, 303)
    assert.equal((await call(port, '/__pilot/login', { method: 'POST', body: `code=${code}` })).status, 401)
  } finally { await new Promise((resolve) => server.close(resolve)); rmSync(dir, { recursive: true, force: true }) }
})

test('missing or corrupt state fails closed', () => {
  const { dir, file } = temp()
  try {
    assert.throws(() => redeem(file, 'a'.repeat(32)), /PILOT_NOT_CONFIGURED/u)
    writeFileSync(file, '{broken')
    assert.throws(() => redeem(file, 'a'.repeat(32)))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('pilot protection defaults on and requires explicit opt out', () => {
  assert.equal(loadPublicConfig({}).pilotEnabled, true)
  assert.equal(loadPublicConfig({ SAM_PILOT_ENABLED: 'false' }).pilotEnabled, false)
})
