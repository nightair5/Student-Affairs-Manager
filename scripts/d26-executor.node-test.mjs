import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, rmdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sha, D26_BATCH } from './prepare-d26.mjs'
import { newState, runOne, nextOrdinal, validatePriceScope, conservativeUpperMicroUsd, auditUnitMetadata, fileLock } from './d26-executor.mjs'

const binding = { manifestSha256: 'a'.repeat(64), identitiesSha256: 'b'.repeat(64) }
const units = Array.from({ length: 16 }, (_, index) => {
  const body = { model: 'deepseek-flash', temperature: 0, reasoning: { effort: 'none' }, max_output_tokens: 8192, stream: false, input: [{ role: 'user', content: '匿名离线伪传输单元' + index }] }
  return { batch: D26_BATCH, ordinal: index + 1, body, requestSha256: sha(JSON.stringify(body)), unitIdentitySha256: sha('D26_OFFLINE_SYNTHETIC_' + index) }
})
function setup(fault = '') {
  const localUnits = structuredClone(units), state = newState(localUnits, binding), now = Date.now()
  const pricing = { sourceUrl: 'https://api-docs.deepseek.com/quick_start/pricing/', verifiedAt: new Date(now - 1000).toISOString(), validUntil: new Date(now + 3600000).toISOString(), peakInputUsdPerMillion: 0.3, peakOutputUsdPerMillion: 1.2, maxInputTokens: 1_048_576, role: 'SYNTHETIC_OFFLINE_PRICE_NOT_CURRENT_OBSERVATION' }
  const auth = { authorized: true, authorizationSource: 'CURRENT_USER_MESSAGE', userMessageSha256: 'd'.repeat(64), batch: D26_BATCH,
    count: 16, model: 'deepseek-flash', ...binding, hardLimitMicroUsd: 6_000_000, grantId: 'OFFLINE_FAKE_NOT_A_REAL_GRANT', committedHead: 'c'.repeat(40),
    endpoint: 'https://api.deepseek.com/responses', retry: 0, repair: 0, verifier: 0, pricing,
    units: localUnits.map(unit => unit.unitIdentitySha256), requestSha256s: localUnits.map(unit => unit.requestSha256) }
  const seen = { reserve: 0, send: 0, raw: 0, settle: 0, persist: 0 }, fail = key => { if (fault === key) throw Error('OFFLINE_' + key) }
  return { state, auth, units: localUnits, binding, seen, lock: async callback => callback(), preflight: async () => fail('preflight'),
    persist: async () => { seen.persist++; fail('persist' + seen.persist) },
    ledger: { reserve: async () => { seen.reserve++; fail('reserve') }, settle: async () => { seen.settle++; fail('settle') } },
    rawStore: { writeOnce: async () => { seen.raw++; fail('raw') } },
    transport: { sendOnce: async () => { seen.send++; fail('send'); return { status: 200, text: JSON.stringify({ usage: { input_tokens: 100, output_tokens: 100 } }) } } } }
}
test('D26 no authorization or old D25 scope stops before any fake side effect', async () => {
  for (const changes of [{ authorized: false }, { batch: 'D25-C17-C18-DEVELOPMENT-R1' }, { count: 24 }, { manifestSha256: 'e'.repeat(64) }]) {
    const harness = setup(); Object.assign(harness.auth, changes)
    await assert.rejects(runOne(harness))
    assert.deepEqual(harness.seen, { reserve: 0, send: 0, raw: 0, settle: 0, persist: 0 })
  }
})
test('D26 identity, model, request, price, budget and extra calls drift block before reserve', async () => {
  for (const fault of ['identity', 'body', 'model', 'price', 'budget', 'retry', 'repair', 'verifier', 'preflight', 'lock']) {
    const harness = setup(fault)
    if (fault === 'identity') harness.auth.units[0] = 'wrong'
    if (fault === 'body') harness.units[0].body.input[0].content = 'changed'
    if (fault === 'model') harness.units[0].body.model = 'another-model'
    if (fault === 'price') harness.auth.pricing.validUntil = new Date(0).toISOString()
    if (fault === 'budget') harness.auth.hardLimitMicroUsd = 1
    if (['retry', 'repair', 'verifier'].includes(fault)) harness.auth[fault] = 1
    if (fault === 'lock') harness.lock = undefined
    await assert.rejects(runOne(harness))
    assert.equal(harness.seen.reserve, 0); assert.equal(harness.seen.send, 0)
  }
})
for (const fault of ['reserve', 'persist1', 'persist2', 'send', 'raw', 'persist3', 'settle', 'persist4']) {
  test('D26 uncertain ' + fault + ' halts the batch without retry', async () => {
    const harness = setup(fault)
    await assert.rejects(runOne(harness))
    assert.equal(harness.state.units[0].status, 'UNCERTAIN')
    assert.throws(() => nextOrdinal(harness.state), /UNCERTAIN/u)
    await assert.rejects(runOne(harness))
    assert.ok(harness.seen.send <= 1)
  })
}
test('D26 definite HTTP/parse failure preserves first answer and settles a conservative budget upper', async () => {
  const harness = setup()
  harness.transport.sendOnce = async () => { harness.seen.send++; return { status: 500, text: 'anonymous provider failure' } }
  await runOne(harness)
  const row = harness.state.units[0]
  assert.equal(row.status, 'SETTLED'); assert.equal(row.usage, 'NOT_OBSERVABLE'); assert.equal(harness.seen.send, 1)
  assert.equal(row.costUpperMicroUsd, conservativeUpperMicroUsd(harness.auth.pricing.maxInputTokens, 8192, harness.auth.pricing))
  assert.equal(nextOrdinal(harness.state), 2)
})
test('D26 raw, state and settlement must agree on HTTP, observed usage and budget upper', () => {
  const { auth } = setup(), usage = { input_tokens: 100, output_tokens: 25 }, raw = { httpStatus: 200, rawHttpText: JSON.stringify({ usage }) }
  const row = { httpStatus: 200, usage, costUpperMicroUsd: conservativeUpperMicroUsd(100, 25, auth.pricing) }
  auditUnitMetadata(raw, row, row, auth.pricing)
  assert.throws(() => auditUnitMetadata(raw, { ...row, usage: 'NOT_OBSERVABLE' }, row, auth.pricing))
  assert.throws(() => auditUnitMetadata(raw, row, { ...row, costUpperMicroUsd: 1 }, auth.pricing))
})
test('D26 pricing cannot silently reuse an expired old snapshot or a nonofficial source', () => {
  const { auth } = setup()
  validatePriceScope(auth.pricing)
  for (const patch of [{ sourceUrl: 'https://untrusted.example/prices' }, { peakOutputUsdPerMillion: -1 }, { maxInputTokens: 0 }, { maxInputTokens: 1000 }, { validUntil: new Date(0).toISOString() }]) assert.throws(() => validatePriceScope({ ...auth.pricing, ...patch }))
})
test('D26 OS lock rejects concurrent entry and retains lock on uncertainty', async () => {
  const root = mkdtempSync(join(tmpdir(), 'd26-anonymous-lock-')), lock = join(root, 'lock')
  let release
  const first = fileLock(lock, () => new Promise(resolve => { release = resolve }))
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.throws(() => fileLock(lock, async () => {}), /EEXIST/u)
  release(); await first
  assert.equal(existsSync(lock), false)
  await assert.rejects(fileLock(lock, async () => { throw Error('OFFLINE_UNCERTAINTY') }))
  assert.equal(existsSync(lock), true)
  rmdirSync(lock); rmdirSync(root)
})
