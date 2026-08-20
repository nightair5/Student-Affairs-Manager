import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { createWorker } from './worker.mjs'
import { E2R6QualificationLedger } from './e2-r6-qualification-ledger.mjs'
import { E2_R6_PROTOCOL_VERSION, runE2R6Harness } from './e2-r6-harness.mjs'
import { buildR6QualificationRegistration, runR6QualificationPreflight } from '../scripts/run-e2-9-r6-preview-preflight.mjs'

const TOKEN = 'test-only-r6-preview-bearer-token-material-000000000000000000'
const ORIGIN = 'https://student-affairs-manager-preview.nightsdell.workers.dev'
const RESULT_SHA256 = '7bb513ee810e2daa996e2dcaa0ecfb70d5ec8eb79bf7024ecb410f0d303b3c2a'
const BUNDLE_SHA256 = 'e3e10c2e9acf6418ca6184ed4260b0d9e6985d2f63d4266ae6be51d07d362413'

class MemoryStorage {
  constructor() { this.values = new Map() }
  async get(key) { return this.values.get(key) }
  async put(key, value) { this.values.set(key, structuredClone(value)) }
}

function ledgerService() {
  const instances = new Map()
  return {
    instances,
    async fetch(url, init) {
      const request = new Request(url, init)
      const runLabel = request.headers.get('x-e2-r6-run-label') ?? ''
      if (!instances.has(runLabel)) instances.set(runLabel, new E2R6QualificationLedger({ storage: new MemoryStorage() }))
      return instances.get(runLabel).fetch(request)
    },
  }
}

function environment(ledger = ledgerService()) {
  return {
    E2_R6_HARNESS_ENABLED: 'true',
    E2_R6_PREVIEW_ORIGIN: ORIGIN,
    E2_R6_BENCHMARK_TOKEN: TOKEN,
    E2_R6_QUALIFICATION_BUNDLE_SHA256: BUNDLE_SHA256,
    E2_R6_QUALIFICATION_RESULT_SHA256: RESULT_SHA256,
    E2_R6_QUALIFICATION_LEDGER: ledger,
  }
}

function request(suffix, { method = 'GET', body, token = TOKEN, origin = ORIGIN } = {}) {
  return new Request(`${ORIGIN}/api/experiments/e2-9/r6/harness/${suffix}`, {
    method,
    headers: { origin, authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

test('R6 normal Preview route is hidden while the feature flag is false', async () => {
  let providerCalls = 0
  const worker = createWorker({ fetcher: async () => { providerCalls += 1; throw new Error('provider must not be called') } })
  const response = await worker.fetch(request('state?runLabel=r6-hidden'), {
    E2_R6_HARNESS_ENABLED: 'false',
    E2_R6_PREVIEW_ORIGIN: ORIGIN,
    ALLOWED_ORIGINS: ORIGIN,
    ASSETS: { fetch: async () => new Response('asset') },
  })
  assert.equal(response.status, 404)
  assert.equal((await response.json()).error, 'NOT_FOUND')
  assert.equal(providerCalls, 0)
})

test('R6 qualification firewall rejects origin and bearer failures before ledger access', async () => {
  const ledger = ledgerService()
  const env = environment(ledger)
  assert.equal((await runE2R6Harness(request('state?runLabel=r6-origin', { origin: 'https://wrong.example' }), env)).status, 403)
  assert.equal((await runE2R6Harness(request('state?runLabel=r6-token', { token: 'wrong-token-that-is-long-enough-to-be-rejected' }), env)).status, 401)
  assert.equal(ledger.instances.size, 0)
})

test('R6 runner to Worker to append-only ledger completes with zero model calls', async () => {
  const ledger = ledgerService()
  const env = environment(ledger)
  let workerCalls = 0
  let providerCalls = 0
  const result = await runR6QualificationPreflight({
    runLabel: 'r6-zero-model-e2e',
    token: TOKEN,
    fetcher: async (url, init) => {
      workerCalls += 1
      return runE2R6Harness(new Request(url, init), env, async () => { providerCalls += 1; throw new Error('provider must not be called') })
    },
  })
  assert.equal(result.status, 'R6_QUALIFICATION_RECORDED_MODEL_PHASES_LOCKED')
  assert.equal(workerCalls, 1)
  assert.equal(providerCalls, 0)
  const state = await runE2R6Harness(request('state?runLabel=r6-zero-model-e2e'), env)
  assert.equal(state.status, 200)
  assert.equal((await state.json()).qualificationResultSha256, RESULT_SHA256)
})

test('R6 ledger refuses identical rerun and divergent overwrite', async () => {
  const env = environment()
  const registration = await buildR6QualificationRegistration({ runLabel: 'r6-immutable' })
  const first = await runE2R6Harness(request('qualification', { method: 'POST', body: registration }), env)
  assert.equal(first.status, 201)
  const duplicate = await runE2R6Harness(request('qualification', { method: 'POST', body: registration }), env)
  assert.equal(duplicate.status, 409)
  assert.equal((await duplicate.json()).error, 'QUALIFICATION_ALREADY_RECORDED')
  const divergent = structuredClone(registration)
  divergent.qualificationResultSha256 = '0'.repeat(64)
  const rejected = await runE2R6Harness(request('qualification', { method: 'POST', body: divergent }), env)
  assert.equal(rejected.status, 412)
  assert.equal((await rejected.json()).error, 'QUALIFICATION_BINDING_INVALID')
})

test('R6 ledger independently rejects a forged qualification hash', async () => {
  const ledger = new E2R6QualificationLedger({ storage: new MemoryStorage() })
  const registration = await buildR6QualificationRegistration({ runLabel: 'r6-ledger-forged' })
  registration.qualificationResultSha256 = '0'.repeat(64)
  const response = await ledger.fetch(new Request('https://ledger.test/record', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(registration),
  }))
  assert.equal(response.status, 412)
  assert.equal((await response.json()).error, 'QUALIFICATION_RECORD_BINDING_INVALID')
})

test('R6 Worker rejects qualification drift before writing the ledger', async () => {
  const ledger = ledgerService()
  const env = environment(ledger)
  const registration = await buildR6QualificationRegistration({ runLabel: 'r6-drift' })
  registration.qualificationBundleSha256 = '0'.repeat(64)
  const response = await runE2R6Harness(request('qualification', { method: 'POST', body: registration }), env)
  assert.equal(response.status, 412)
  assert.equal(ledger.instances.size, 0)
})

test('R6 Readiness, Generate, Selection and Blind stay locked without invoking provider', async () => {
  const env = environment()
  let providerCalls = 0
  for (const suffix of ['readiness', 'generate', 'selection', 'blind']) {
    const response = await runE2R6Harness(request(suffix, { method: 'POST', body: {} }), env, async () => { providerCalls += 1 })
    assert.equal(response.status, 412)
    assert.equal((await response.json()).error, 'MODEL_PHASE_NOT_AUTHORIZED')
  }
  assert.equal(providerCalls, 0)
})

test('R6 runner dry-run performs no network and refuses model phases', async () => {
  let networkCalls = 0
  const result = await runR6QualificationPreflight({
    runLabel: 'r6-dry-run', dryRun: true, fetcher: async () => { networkCalls += 1; throw new Error('network must not be called') },
  })
  assert.equal(result.status, 'R6_QUALIFICATION_DRY_RUN_PASS')
  assert.equal(result.networkCalls, 0)
  assert.equal(networkCalls, 0)
})

test('R6 CLI rejects a model phase before token or network access', () => {
  const script = path.join(process.cwd(), 'scripts', 'run-e2-9-r6-preview-preflight.mjs')
  const child = spawnSync(process.execPath, [script, '--phase=readiness', '--run-label=r6-forbidden-cli'], {
    cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, E2_R6_BENCHMARK_TOKEN: '' },
  })
  assert.notEqual(child.status, 0)
  assert.match(child.stderr, /R6_MODEL_PHASE_NOT_AUTHORIZED/u)
  assert.doesNotMatch(child.stderr, /E2_R6_BENCHMARK_TOKEN_REQUIRED/u)
})

test('R6 configs keep Production absent, normal Preview disabled and activation isolated', async () => {
  const normal = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'))
  const activation = JSON.parse(await readFile(new URL('../wrangler.e2-r6-preview.jsonc', import.meta.url), 'utf8'))
  assert.equal(normal.vars?.E2_R6_HARNESS_ENABLED, undefined)
  assert.equal(normal.env.preview.vars.E2_R6_HARNESS_ENABLED, 'false')
  assert.equal(activation.name, 'student-affairs-manager-preview')
  assert.equal(activation.vars.E2_R6_HARNESS_ENABLED, 'true')
  assert.equal(activation.vars.E2_R6_QUALIFICATION_BUNDLE_SHA256, BUNDLE_SHA256)
  assert.equal(activation.vars.E2_R6_QUALIFICATION_RESULT_SHA256, RESULT_SHA256)
  assert.deepEqual(activation.services, [{ binding: 'E2_R6_QUALIFICATION_LEDGER', service: 'student-affairs-e2-r6-qualification-ledger-preview' }])
  assert.equal(E2_R6_PROTOCOL_VERSION, 'e2-9-v4-pro-protocol-3.4.0')
})
