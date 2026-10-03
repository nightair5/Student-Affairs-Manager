import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import * as engine from './d26-executor.mjs'
import { BATCH, SNAPSHOT, FROZEN, createOfflineHost, assertHostAuthorization, safeCode, inspectTransportResponse } from './d26-execution-host.mjs'
import { validateChain } from './candidate13-d6-budget.mjs'

const sha = value => createHash('sha256').update(value).digest('hex')
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const jsonWrite = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
const units = Array.from({ length: 16 }, (_, index) => {
  const body = { model: 'deepseek-flash', temperature: 0, reasoning: { effort: 'none' }, max_output_tokens: 8192, stream: false,
    input: [{ role: 'user', content: '本机匿名假请求，不发送网络 ' + index }] }
  return { batch: BATCH, ordinal: index + 1, body, unitIdentitySha256: sha('offline-d26-unit-' + index), requestSha256: sha(JSON.stringify(body)) }
})
function setup(options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'd26-host-offline-')), ledgerPath = join(root, 'CALL_LEDGER.jsonl')
  const seed = { sequence: 0, previous: '0'.repeat(64), event: { kind: 'OFFLINE_ANONYMOUS_TEST_GENESIS' } }
  seed.hash = sha(JSON.stringify(seed)); writeFileSync(ledgerPath, JSON.stringify(seed) + '\n')
  const original = readFileSync(ledgerPath), now = Date.now(), observations = { send: 0, git: 0, reserve: 0, settle: 0, grant: 0 }
  const localUnits = structuredClone(units), binding = { ...FROZEN }
  const pricing = { sourceUrl: 'https://api-docs.deepseek.com/quick_start/pricing/', verifiedAt: new Date(now - 1000).toISOString(), validUntil: new Date(now + 3600000).toISOString(),
    peakInputUsdPerMillion: 0.3, peakOutputUsdPerMillion: 1.2, maxInputTokens: 1048576, model: 'deepseek-flash', endpoint: 'https://api.deepseek.com/responses',
    maxOutputTokens: 8192, tokenBoundMethod: 'FULL_OFFICIAL_CONTEXT_UPPER_BOUND', reasoningMetering: 'INCLUDED_IN_OUTPUT_TOKENS', additionalChargeUpperMicroUsd: 0 }
  writeFileSync(join(root, 'USER_AUTHORIZATION.txt'), 'OFFLINE TEST ONLY. No real model, grant, participant or price observation.\n')
  jsonWrite(join(root, 'PRICE_EVIDENCE.json'), { role: 'SYNTHETIC_OFFLINE_PRICE_NOT_OBSERVED', pricing })
  const auth = { authorized: true, authorizationSource: 'CURRENT_USER_MESSAGE', userMessageSha256: sha(readFileSync(join(root, 'USER_AUTHORIZATION.txt'))),
    batch: BATCH, count: 16, model: 'deepseek-flash', ...binding, hardLimitMicroUsd: 5300000, grantId: 'OFFLINE_FAKE_GRANT_NOT_REAL', committedHead: 'c'.repeat(40),
    endpoint: 'https://api.deepseek.com/responses', retry: 0, repair: 0, verifier: 0, pricing, hostVersion: 'd26-execution-host-1', snapshotCommit: SNAPSHOT,
    ledgerBaselineRows: 1, ledgerBaselineBytes: original.length, ledgerBaselineSha256: sha(original),
    priceEvidenceSha256: sha(readFileSync(join(root, 'PRICE_EVIDENCE.json'))), units: localUnits.map(unit => unit.unitIdentitySha256), requestSha256s: localUnits.map(unit => unit.requestSha256) }
  if (!options.noAuth) jsonWrite(join(root, 'AUTHORIZATION.json'), auth)
  const append = async ({ before, after, event }) => {
    assert.deepEqual(readFileSync(ledgerPath), before)
    if (options.osAppend) {
      const receipt = join(root, 'receipts', String(validateChain(before).rows.length).padStart(9, '0') + '.json')
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', resolve('scripts/d25-ledger-append.ps1'),
        '-Ledger', ledgerPath, '-ExpectedSha', sha(before), '-RowPath', receipt, '-ExpectedAfterSha', sha(after)], { stdio: 'pipe' })
    } else writeFileSync(ledgerPath, after)
    const key = { d26Grant: 'grant', d26Reserve: 'reserve', d26Settle: 'settle' }[event.kind]
    observations[key]++
  }
  let faultEnabled = true
  const host = createOfflineHost({ root, ledgerPath, engine, packageRead: () => {
    if (options.packageDrift) throw Error('D26_HOST_SNAPSHOT_COMPONENT_DRIFT')
    return { units: localUnits, binding }
  }, gitCheck: () => { observations.git++; if (options.gitDrift) throw Error('D26_HOST_GIT_NOT_CLEAN_COMMITTED_AND_SYNCHRONIZED') }, append,
  fault: async stage => { if (faultEnabled && stage === options.fault) throw Error('D26_HOST_OFFLINE_FAULT') },
  transport: { sendOnce: async () => {
    observations.send++
    if (options.sendThrow) throw Error('anonymous transport uncertainty')
    return options.response ?? { status: 200, text: JSON.stringify({ id: 'anonymous-response', usage: { input_tokens: 100, output_tokens: 25 } }) }
  } } })
  return { host, root, ledgerPath, observations, auth, localUnits, binding, original, clearFault: () => { faultEnabled = false },
    saveAuth: () => jsonWrite(join(root, 'AUTHORIZATION.json'), auth) }
}

test('missing authorization rejects prepare and dispatch before creating lock, grant or transport', async () => {
  const x = setup({ noAuth: true })
  await assert.rejects(x.host.prepareAuthorized(), /AUTHORIZATION_REQUIRED/u)
  await assert.rejects(x.host.dispatchNext(), /AUTHORIZATION_REQUIRED/u)
  assert.deepEqual(readFileSync(x.ledgerPath), x.original)
  assert.equal(x.observations.send, 0); assert.equal(x.observations.grant, 0)
  assert.equal(existsSync(join(x.root, 'lock')), false)
  const status = await x.host.verify()
  assert.equal(status.modelRequests, 0); assert.equal(status.authorizationFileExists, false)
})

test('CLI refuses missing authorization before loading snapshot or credential paths', () => {
  const output = (() => { try {
    execFileSync(process.execPath, ['scripts/d26-execution-host.mjs', '--dispatch-next', '--snapshot', 'not-a-directory'], { encoding: 'utf8', stdio: 'pipe' })
    assert.fail('must refuse')
  } catch (error) { assert.equal(error.status, 2); return error.stderr.toString() } })()
  assert.match(output, /AUTHORIZATION_REQUIRED_NO_GRANT_NO_SEND/u)
  assert.equal(existsSync(resolve('.data/d26/execution/STATE.json')), false)
})

test('scope, baseline, stale price, uncertain fees, token proof, low cap and old batch stop before grant', async () => {
  const changes = [auth => { auth.authorized = false }, auth => { auth.batch = 'D25-C17-C18-DEVELOPMENT-R1' },
    auth => { auth.count = 24 }, auth => { auth.units[0] = 'drift' }, auth => { auth.requestSha256s[0] = 'drift' },
    auth => { auth.snapshotCommit = 'd'.repeat(40) }, auth => { auth.ledgerBaselineSha256 = 'd'.repeat(64) },
    auth => { auth.pricing.validUntil = new Date(0).toISOString() }, auth => { auth.pricing.additionalChargeUpperMicroUsd = 1 },
    auth => { auth.pricing.tokenBoundMethod = 'UTF8_BYTES' }, auth => { auth.hardLimitMicroUsd = 5190000 },
    auth => { auth.retry = 1 }, auth => { auth.repair = 1 }, auth => { auth.verifier = 1 }]
  for (const change of changes) {
    const x = setup(); change(x.auth); x.saveAuth()
    await assert.rejects(x.host.prepareAuthorized())
    assert.deepEqual(readFileSync(x.ledgerPath), x.original)
    assert.equal(x.observations.send, 0)
  }
})

test('uncommitted host or snapshot drift prevents grant; user authorization evidence cannot drift', async () => {
  for (const options of [{ gitDrift: true }, { packageDrift: true }, {}]) {
    const x = setup(options)
    if (!Object.keys(options).length) writeFileSync(join(x.root, 'USER_AUTHORIZATION.txt'), 'changed')
    await assert.rejects(x.host.prepareAuthorized())
    assert.deepEqual(readFileSync(x.ledgerPath), x.original)
  }
})

test('recorded official price bytes cannot be paired with a cheaper authorization price or unrelated evidence role', async () => {
  for (const mutation of ['input', 'output', 'verifiedAt', 'role']) {
    const x = setup()
    if (mutation === 'input') x.auth.pricing.peakInputUsdPerMillion = 0
    if (mutation === 'output') x.auth.pricing.peakOutputUsdPerMillion = 0
    if (mutation === 'verifiedAt') x.auth.pricing.verifiedAt = new Date(Date.now() - 500).toISOString()
    if (mutation === 'role') {
      const path = join(x.root, 'PRICE_EVIDENCE.json'), evidence = read(path); evidence.role = 'NOT_VERIFIED'; jsonWrite(path, evidence)
      x.auth.priceEvidenceSha256 = sha(readFileSync(path))
    }
    x.saveAuth(); await assert.rejects(x.host.prepareAuthorized(), /PRICE_EVIDENCE_BINDING/u)
    assert.deepEqual(readFileSync(x.ledgerPath), x.original); assert.equal(x.observations.grant, 0)
  }
})

test('16 fixed ordinals settle once each, original raw/usage/receipt chains agree and completion never resends', async () => {
  const x = setup()
  const prepared = await x.host.prepareAuthorized(); assert.equal(prepared.status, 'AUTHORIZED_NOT_SENT')
  for (let ordinal = 1; ordinal <= 16; ordinal++) {
    const result = await x.host.dispatchNext(); assert.equal(result.ordinal, ordinal); assert.equal(result.status, 'SETTLED')
    assert.deepEqual(result.usage, { input_tokens: 100, output_tokens: 25 })
    const readback = await x.host.resumeReadOnly(); assert.equal(readback.audit, 'CONSISTENT')
    assert.equal(readback.nextOrdinal, ordinal === 16 ? null : ordinal + 1)
  }
  assert.deepEqual(x.observations, { send: 16, git: x.observations.git, grant: 1, reserve: 16, settle: 16 })
  assert.equal((await x.host.dispatchNext()).status, 'COMPLETE')
  assert.equal(x.observations.send, 16)
  assert.equal(validateChain(readFileSync(x.ledgerPath)).rows.length, 34)
  assert.equal(readdirSync(join(x.root, 'raw')).length, 16)
  await assert.rejects(x.host.prepareAuthorized(), /RUN_ALREADY_STARTED/u)
  assert.equal(x.observations.grant, 1)
})

for (const stage of ['before_d26Grant', 'after_d26Grant', 'after_grant_before_state']) {
  test('uncertain grant or initial state stays sealed: ' + stage, async () => {
    const x = setup({ fault: stage })
    await assert.rejects(x.host.prepareAuthorized())
    assert.ok(existsSync(join(x.root, 'HALT.json'))); assert.ok(existsSync(join(x.root, 'lock')))
    x.clearFault(); await assert.rejects(x.host.prepareAuthorized())
    assert.equal(x.observations.send, 0); assert.ok(x.observations.grant <= 1)
    const report = await x.host.resumeReadOnly()
    assert.equal(report.audit, 'UNRESOLVED')
    if (x.observations.grant) { assert.equal(report.uncertainty, 'D26_HOST_LEDGER_BATCH_WITHOUT_STATE'); assert.equal(report.batchEvidence.grantCount, 1) }
    else { assert.equal(report.uncertainty, 'D26_HOST_LOCAL_RECORDS_WITHOUT_STATE'); assert.equal(report.localEvidence.receiptFiles, 1) }
  })
}

for (const stage of ['before_d26Reserve', 'after_d26Reserve', 'persist_RESERVED', 'persist_SENDING', 'before_send', 'after_send',
  'before_raw', 'after_raw', 'persist_RAW_SAVED', 'before_d26Settle', 'after_d26Settle', 'persist_NOT_SENT']) {
  test('uncertainty seals and never advances: ' + stage, async () => {
    const x = setup({ fault: stage }); await x.host.prepareAuthorized()
    await assert.rejects(x.host.dispatchNext())
    assert.ok(existsSync(join(x.root, 'HALT.json'))); assert.ok(existsSync(join(x.root, 'lock')))
    const before = readFileSync(x.ledgerPath), sends = x.observations.send
    x.clearFault(); await assert.rejects(x.host.dispatchNext())
    assert.deepEqual(readFileSync(x.ledgerPath), before); assert.equal(x.observations.send, sends); assert.ok(sends <= 1)
    assert.equal((await x.host.resumeReadOnly()).status, 'HALTED_READ_ONLY')
  })
}

test('transport exception is uncertain even without raw; fresh process cannot infer unsent', async () => {
  const x = setup({ sendThrow: true }); await x.host.prepareAuthorized()
  await assert.rejects(x.host.dispatchNext())
  assert.equal(readdirSync(join(x.root, 'raw')).length, 0)
  assert.equal(read(join(x.root, 'STATE.json')).units[0].status, 'UNCERTAIN')
  await assert.rejects(x.host.dispatchNext()); assert.equal(x.observations.send, 1)
})

test('missing usage preserves raw and conservative settlement, then halts rather than charging the next unit', async () => {
  const x = setup({ response: { status: 500, text: 'anonymous provider error, billing not observable' } })
  await x.host.prepareAuthorized(); await assert.rejects(x.host.dispatchNext(), /USAGE_OR_BILLING_UNKNOWN/u)
  const row = read(join(x.root, 'STATE.json')).units[0]
  assert.equal(row.status, 'SETTLED'); assert.equal(row.usage, 'NOT_OBSERVABLE'); assert.equal(row.costUpperMicroUsd, 324404)
  assert.equal(read(join(x.root, 'raw/01.json')).rawHttpText, 'anonymous provider error, billing not observable')
  assert.equal(x.observations.settle, 1)
  await assert.rejects(x.host.dispatchNext()); assert.equal(x.observations.send, 1)
  assert.equal((await x.host.resumeReadOnly()).audit, 'UNRESOLVED')
})

test('known HTTP failure with valid usage keeps denominator and is not retried', async () => {
  const x = setup({ response: { status: 400, text: JSON.stringify({ error: 'anonymous rejection', usage: { input_tokens: 100, output_tokens: 0 } }) } })
  await x.host.prepareAuthorized(); const result = await x.host.dispatchNext()
  assert.equal(result.status, 'SETTLED'); assert.equal(result.httpStatus, 400)
  assert.equal((await x.host.resumeReadOnly()).nextOrdinal, 2); assert.equal(x.observations.send, 1)
})

test('raw, metadata, receipt, state and authorization tampering stop the following request', async () => {
  for (const mutation of ['raw', 'state', 'receipt', 'extraRaw', 'auth']) {
    const x = setup(); await x.host.prepareAuthorized(); await x.host.dispatchNext()
    if (mutation === 'raw') { const path = join(x.root, 'raw/01.json'), raw = read(path); raw.httpStatus = 201; jsonWrite(path, raw) }
    if (mutation === 'state') { const path = join(x.root, 'STATE.json'), state = read(path); state.units[1].status = 'SETTLED'; jsonWrite(path, state) }
    if (mutation === 'receipt') writeFileSync(join(x.root, 'receipts/000000001.json'), 'drift')
    if (mutation === 'extraRaw') jsonWrite(join(x.root, 'raw/02.json'), { fake: true })
    if (mutation === 'auth') { x.auth.hardLimitMicroUsd += 1; x.saveAuth() }
    const before = readFileSync(x.ledgerPath)
    await assert.rejects(x.host.dispatchNext()); assert.equal(x.observations.send, 1); assert.deepEqual(readFileSync(x.ledgerPath), before)
  }
})

test('interleaved ledger row and reused grant/batch cannot silently create another grant', async () => {
  const x = setup(); await x.host.prepareAuthorized(); await x.host.dispatchNext()
  const chain = validateChain(readFileSync(x.ledgerPath)), row = { sequence: chain.rows.length, previous: chain.tail, event: { kind: 'OTHER_BATCH', batchId: 'anonymous-other' } }
  row.hash = sha(JSON.stringify(row)); writeFileSync(x.ledgerPath, JSON.stringify(row) + '\n', { flag: 'a' })
  await assert.rejects(x.host.dispatchNext(), /LEDGER_BATCH_DRIFT/u)
  assert.equal(x.observations.send, 1)
  const z = setup(); const existing = validateChain(z.original), duplicate = { sequence: 1, previous: existing.tail, event: { kind: 'd26Grant', batchId: BATCH, grantId: 'different-grant' } }
  duplicate.hash = sha(JSON.stringify(duplicate)); writeFileSync(z.ledgerPath, JSON.stringify(duplicate) + '\n', { flag: 'a' })
  const bytes = readFileSync(z.ledgerPath); z.auth.ledgerBaselineRows = 2; z.auth.ledgerBaselineBytes = bytes.length; z.auth.ledgerBaselineSha256 = sha(bytes); z.saveAuth()
  await assert.rejects(z.host.prepareAuthorized(), /ALREADY_USED/u)
  assert.equal(z.observations.grant, 0)
})

test('read-only resume preserves bytes, does not need current price or git sync, reports stale price separately', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.now() })
  const x = setup(); await x.host.prepareAuthorized(); await x.host.dispatchNext()
  const before = readFileSync(x.ledgerPath), stateBefore = readFileSync(join(x.root, 'STATE.json')), gitBefore = x.observations.git
  context.mock.timers.tick(7200000)
  const report = await x.host.resumeReadOnly()
  assert.equal(report.audit, 'CONSISTENT'); assert.equal(report.ledgerWrites, 0); assert.equal(x.observations.git, gitBefore)
  assert.equal(report.priceStatus, 'EXPIRED_OR_INVALID_NO_DISPATCH')
  assert.deepEqual(readFileSync(x.ledgerPath), before); assert.deepEqual(readFileSync(join(x.root, 'STATE.json')), stateBefore)
  await assert.rejects(x.host.dispatchNext(), /PRICE_STALE/u)
})

test('real OS compare-and-append adapter operates on anonymous temporary ledger only', {
  skip: process.platform !== 'win32' ? 'NOT_AVAILABLE: Windows PowerShell OS writer-lock adapter; portable safety tests still run' : false,
}, async () => {
  const x = setup({ osAppend: true }); await x.host.prepareAuthorized(); await x.host.dispatchNext()
  assert.equal(validateChain(readFileSync(x.ledgerPath)).rows.length, 4)
  assert.equal((await x.host.resumeReadOnly()).audit, 'CONSISTENT')
})

test('separate processes cannot acquire the same batch lock; stale lock remains blocked', async () => {
  const root = mkdtempSync(join(tmpdir(), 'd26-host-process-lock-')), lock = join(root, 'lock')
  const concurrent = `import {fileLock} from ${JSON.stringify(new URL('./candidate17-d17-executor.mjs', import.meta.url).href)}; await fileLock(${JSON.stringify(lock)}, async()=>{process.stdout.write('ENTERED'); await new Promise(resolve=>setTimeout(resolve,750))})`
  const raced = await Promise.allSettled([promisify(execFile)(process.execPath, ['--input-type=module', '-e', concurrent]), promisify(execFile)(process.execPath, ['--input-type=module', '-e', concurrent])])
  assert.equal(raced.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(raced.filter(result => result.status === 'rejected').length, 1)
  assert.equal(existsSync(lock), false)
  mkdirSync(lock)
  const script = `import {fileLock} from ${JSON.stringify(new URL('./candidate17-d17-executor.mjs', import.meta.url).href)}; await fileLock(${JSON.stringify(lock)}, async()=>{process.stdout.write('ENTERED')})`
  const results = await Promise.allSettled([promisify(execFile)(process.execPath, ['--input-type=module', '-e', script]), promisify(execFile)(process.execPath, ['--input-type=module', '-e', script])])
  assert.ok(results.every(result => result.status === 'rejected'))
  assert.ok(existsSync(lock))
})

test('offline factory cannot point at real ledger or outside a temporary isolated root; errors do not echo secrets', () => {
  const x = setup()
  assert.throws(() => createOfflineHost({ root: resolve('.'), ledgerPath: x.ledgerPath }), /OFFLINE_TEMP_PATH/u)
  assert.equal(safeCode(Error('Authorization: Bearer TEST_ONLY_ANONYMOUS_NOT_REAL')), 'D26_HOST_OPERATION_FAILED_NO_SENSITIVE_DIAGNOSTICS')
  assert.doesNotThrow(() => assertHostAuthorization(x.auth, engine, x.localUnits, x.binding))
})

test('response safety rejects nested secret reflection, metadata reflection and malformed UTF8 before raw persistence', () => {
  const secret = 'OFFLINE_SYNTHETIC_CREDENTIAL_NOT_REAL', encoded = [...secret].map(char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')).join('')
  const nested = JSON.stringify({ output: JSON.stringify({ text: '{"token":"' + encoded + '"}' }) })
  for (const envelope of [{ bytes: Buffer.from(nested) }, { bytes: Buffer.from('{}'), requestId: secret },
    { bytes: Buffer.from('{}'), contentType: 'application/json;' + secret }, { bytes: Buffer.from([0xff, 0xfe]) }]) {
    assert.throws(() => inspectTransportResponse(envelope, secret))
  }
  const exact = '{"usage":{"input_tokens":1,"output_tokens":1},"output":[]}'
  assert.deepEqual(inspectTransportResponse({ bytes: Buffer.from(exact), contentType: 'application/json', requestId: 'anonymous-id' }, secret),
    { text: exact, contentType: 'application/json', requestId: 'anonymous-id' })
  const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(exact)])
  assert.deepEqual(Buffer.from(inspectTransportResponse({ bytes: bom }, secret).text), bom)
})
