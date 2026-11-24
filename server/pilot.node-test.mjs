import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { authorize, closePilot, initialize, issueInvite, pauseModel, redeem, revokeInvite, summary, withPilotState } from './pilot-store.mjs'
import { createPublicServer, loadPublicConfig } from './public-server.mjs'

function temp() { const dir = mkdtempSync(path.join(os.tmpdir(), 'sa-pilot-')); return { dir, file: path.join(dir, 'state.json') } }
function options(now = Date.now()) { return { startsAt: new Date(now - 10000).toISOString(), endsAt: new Date(now + 60000).toISOString(), exportEndsAt: new Date(now + 120000).toISOString(), dailyUserLimit: 2, dailyGlobalLimit: 3, modelBudgetMicroCny: 20_000_000 } }

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
    const unusedCode = issueInvite(file, 'P02')
    const a = redeem(file, code, new Date(now))
    assert.equal(authorize(file, a, { now: new Date(now + 60000) }).phase, 'export')
    assert.equal(authorize(file, a, { now: new Date(now + 60000), consume: true }).allowed, false)
    const b = redeem(file, code, new Date(now + 60000))
    assert.equal(redeem(file, unusedCode, new Date(now + 60000)), null)
    assert.equal(authorize(file, a, { now: new Date(now + 60000) }).allowed, false)
    assert.equal(authorize(file, b, { now: new Date(now + 120000) }).allowed, false)
    assert.equal(redeem(file, code, new Date(now + 120000)), null)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('daily limits reset at China midnight and state survives repeated store instances', () => {
  const { dir, file } = temp()
  try {
    initialize(file, { startsAt: '2026-11-14T00:00:00+08:00', endsAt: '2026-11-17T00:00:00+08:00', exportEndsAt: '2026-11-18T00:00:00+08:00', dailyUserLimit: 1, dailyGlobalLimit: 1 })
    const code = issueInvite(file, 'P01', new Date('2026-11-15T23:59:59+08:00'))
    const token = redeem(file, code, new Date('2026-11-15T23:59:59+08:00'))
    assert.equal(authorize(file, token, { now: new Date('2026-11-15T23:59:59+08:00'), consume: true }).allowed, true)
    assert.equal(authorize(file, token, { now: new Date('2026-11-15T23:59:59+08:00'), consume: true }).phase, 'quota')
    assert.equal(authorize(file, token, { now: new Date('2026-11-16T00:00:00+08:00'), consume: true }).allowed, true)
    assert.equal(authorize(file, token, { now: new Date('2026-11-16T00:00:00+08:00'), consume: true }).phase, 'quota')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

function call(port, pathname, { method = 'GET', cookie = '', body = '', type = 'application/x-www-form-urlencoded', secure = true, origin = 'https://student-affairs.site' } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method, headers: { host: 'student-affairs.site',
      'x-forwarded-proto': secure ? 'https' : 'http', origin, cookie, 'content-type': type } }, (res) => {
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
    const home = await call(port, '/', { cookie })
    assert.equal(home.status, 200)
    assert.equal(home.headers['cache-control'], 'private, no-store')
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

const chatInput = JSON.stringify({ question: '仅用于离线测试的提问', context: [{ kind: '任务', title: '校验样例', excerpt: '示例事项' }] })

async function withMockModel(limit, fetcher, check) {
  const { dir, file } = temp()
  initialize(file, { ...options(), modelBudgetMicroCny: limit })
  const code = issueInvite(file, 'P01')
  const config = loadPublicConfig({ SAM_PILOT_STATE_FILE: file, SAM_STATIC_DIR: dir, DEEPSEEK_API_KEY: 'server-only-test-key-with-length' })
  const server = createPublicServer(config, undefined, { fetcher })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const port = server.address().port
    const login = await call(port, '/__pilot/login', { method: 'POST', body: `code=${code}` })
    const cookie = login.headers['set-cookie'][0].split(';')[0]
    const chat = () => call(port, '/api/deepseek', { method: 'POST', cookie, body: chatInput, type: 'application/json' })
    const status = () => call(port, '/api/deepseek/status', { cookie })
    const extract = (content) => call(port, '/api/deepseek/extract', { method: 'POST', cookie, type: 'application/json',
      body: JSON.stringify({ sourceType: 'text', content, referenceTime: '2026-11-11T08:00:00Z', timezone: 'Asia/Shanghai' }) })
    await check(file, chat, status, extract)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    rmSync(dir, { recursive: true, force: true })
  }
}

test('zero or paused budget blocks real dispatch while leaving app access available', async () => {
  const forbidden = async () => assert.fail('The upstream fetcher must not be called')
  await withMockModel(0, forbidden, async (_file, chat, status) => {
    assert.equal(JSON.parse((await status()).text).configured, false)
    assert.equal((await chat()).status, 503)
  })
  await withMockModel(20_000_000, forbidden, async (file, chat, status) => {
    pauseModel(file)
    assert.equal(JSON.parse((await status()).text).capabilityStatus, 'pilot-paused')
    assert.equal((await chat()).status, 503)
  })
})

test('reserves funds before dispatch and holds unobservable model usage across calls', async () => {
  let count = 0
  await withMockModel(3_000_000, async () => {
    count++
    return Response.json({ error: 'fixture without provider usage' }, { status: 502 })
  }, async (file, chat) => {
    assert.equal((await chat()).status, 502)
    assert.equal((await chat()).status, 503)
    assert.equal(count, 1)
    assert.equal(summary(file).modelBudget.reservedMicroCny, 2_113_152)
  })
})

test('observed usage settles conservatively, freeing the unused reservation', async () => {
  let count = 0
  await withMockModel(3_000_000, async () => {
    count++
    return Response.json({ choices: [{ message: { content: '离线测试答案' } }], usage: { prompt_tokens: 1000, completion_tokens: 500 } })
  }, async (file, chat) => {
    assert.equal((await chat()).status, 200)
    assert.equal((await chat()).status, 200)
    assert.equal(count, 2)
    assert.deepEqual(summary(file).modelBudget, { limitMicroCny: 3_000_000, settledUpperMicroCny: 12_000, reservedMicroCny: 0, paused: false })
  })
})

test('the usual text recognition path is metered without changing its response', async () => {
  const source = '请于11月15日17:00前备份实验数据。'
  const semantic = { topic: '实验数据备份', kind: 'action', items: [{ key: 'backup', kind: 'task', title: '备份实验数据', action: '备份', object: '实验数据', evidence: [source], times: [{ role: 'deadline', raw: '11月15日17:00前' }] }], materials: [], sharedRequirements: [] }
  await withMockModel(3_000_000, async (_url, init) => {
    assert.equal(JSON.parse(init.body).max_tokens, 16_384)
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(semantic) } }], usage: { prompt_tokens: 800, completion_tokens: 200 } })
  }, async (file, _chat, _status, extract) => {
    const response = await extract(source)
    assert.equal(response.status, 200)
    assert.match(response.text, /备份实验数据/u)
    assert.equal(summary(file).modelBudget.settledUpperMicroCny, 3_200)
    assert.equal(summary(file).modelBudget.reservedMicroCny, 0)
  })
})
