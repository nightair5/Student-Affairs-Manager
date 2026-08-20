import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { createWorker } from './worker.mjs'
import { E2R6QualificationLedger } from './e2-r6-qualification-ledger.mjs'
import qualificationWorker from './e2-r6-qualification-worker.mjs'
import { E2_R6_PREVIEW_HARNESS_VERSION, E2_R6_PROTOCOL_VERSION, runE2R6Harness } from './e2-r6-harness.mjs'
import {
  R6_PREVIEW_ORIGIN, awaitR6StableActivation, buildR6QualificationRegistration,
  r6VersionedPreviewEndpoint, runR6QualificationPreflight,
} from '../scripts/run-e2-9-r6-preview-preflight.mjs'
import { buildR6DeploymentProjection } from '../scripts/e2-9-r6-deployment-contract.mjs'

const TOKEN = 'test-only-r6-preview-bearer-token-material-000000000000000000'
const ORIGIN = 'https://student-affairs-manager-preview.nightsdell.workers.dev'
const RESULT_SHA256 = '9cb941991570a924b75532a796502e91d849cba3586bb2fe59a7c37a4b776d16'
const BUNDLE_SHA256 = 'e204369f0bea06463d86988aa7be6ce44f2b663567c0d4483241eb1f096c6565'
const WORKER_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_WORKER_VERSION_ID = '22222222-2222-4222-8222-222222222222'
const TOKEN_SHA256 = createHash('sha256').update(TOKEN, 'utf8').digest('hex')
const VERSIONED_ORIGIN = new URL(r6VersionedPreviewEndpoint(WORKER_VERSION_ID)).origin

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

function environment(ledger = ledgerService(), { versionedOnly = false } = {}) {
  return {
    E2_R6_HARNESS_ENABLED: 'true',
    E2_R6_PREVIEW_ORIGIN: versionedOnly ? R6_PREVIEW_ORIGIN : ORIGIN,
    ...(versionedOnly ? { E2_R6_VERSIONED_PREVIEW_ONLY: 'true' } : {}),
    E2_R6_BENCHMARK_TOKEN_SHA256: TOKEN_SHA256,
    E2_R6_QUALIFICATION_BUNDLE_SHA256: BUNDLE_SHA256,
    E2_R6_QUALIFICATION_RESULT_SHA256: RESULT_SHA256,
    E2_R6_QUALIFICATION_LEDGER: ledger,
    CF_VERSION_METADATA: { id: WORKER_VERSION_ID },
  }
}

function request(suffix, { method = 'GET', body, token = TOKEN, origin = ORIGIN, baseOrigin = ORIGIN } = {}) {
  return new Request(`${baseOrigin}/api/experiments/e2-9/r6/harness/${suffix}`, {
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

test('R6 qualification firewall requires a hash commitment and never stores the bearer', async () => {
  const ledger = ledgerService()
  const env = environment(ledger)
  delete env.E2_R6_BENCHMARK_TOKEN_SHA256
  env.E2_R6_BENCHMARK_TOKEN = TOKEN
  const response = await runE2R6Harness(request('activation'), env)
  assert.equal(response.status, 401)
  assert.equal((await response.json()).error, 'UNAUTHORIZED')
  assert.equal(ledger.instances.size, 0)
})

test('R6 runner to Worker to append-only ledger completes with zero model calls', async () => {
  const ledger = ledgerService()
  const env = environment(ledger, { versionedOnly: true })
  let workerCalls = 0
  let providerCalls = 0
  const result = await runR6QualificationPreflight({
    runLabel: 'r6-zero-model-e2e',
    token: TOKEN,
    expectedWorkerVersionId: WORKER_VERSION_ID,
    sleeper: async () => {},
    probeDelayMs: 0,
    fetcher: async (url, init) => {
      workerCalls += 1
      return runE2R6Harness(new Request(url, init), env, async () => { providerCalls += 1; throw new Error('provider must not be called') })
    },
  })
  assert.equal(result.status, 'R6_QUALIFICATION_RECORDED_MODEL_PHASES_LOCKED')
  assert.equal(workerCalls, 4)
  assert.equal(providerCalls, 0)
  assert.equal(result.activation.workerVersionId, WORKER_VERSION_ID)
  assert.equal(result.activation.consecutiveStableResponses, 3)
  assert.equal(result.networkCalls, 4)
  const state = await runE2R6Harness(request('state?runLabel=r6-zero-model-e2e', {
    origin: VERSIONED_ORIGIN, baseOrigin: VERSIONED_ORIGIN,
  }), env)
  assert.equal(state.status, 200)
  assert.equal((await state.json()).qualificationResultSha256, RESULT_SHA256)
})

test('R6 ledger refuses identical rerun and divergent overwrite', async () => {
  const env = environment()
  const registration = await buildR6QualificationRegistration({
    runLabel: 'r6-immutable', expectedWorkerVersionId: WORKER_VERSION_ID,
  })
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
  const registration = await buildR6QualificationRegistration({
    runLabel: 'r6-ledger-forged', expectedWorkerVersionId: WORKER_VERSION_ID,
  })
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
  const registration = await buildR6QualificationRegistration({
    runLabel: 'r6-drift', expectedWorkerVersionId: WORKER_VERSION_ID,
  })
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
    const payload = await response.json()
    assert.equal(payload.error, 'MODEL_PHASE_NOT_AUTHORIZED')
    assert.equal(payload.workerVersionId, WORKER_VERSION_ID)
    assert.equal(payload.modelCalls, 0)
  }
  assert.equal(providerCalls, 0)
})

test('R6 activation proof exposes only frozen hashes and server version with zero model calls', async () => {
  const response = await runE2R6Harness(request('activation'), environment())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    status: 'QUALIFICATION_ENDPOINT_ACTIVE_MODEL_PHASES_LOCKED',
    protocolVersion: E2_R6_PROTOCOL_VERSION,
    harnessVersion: E2_R6_PREVIEW_HARNESS_VERSION,
    workerVersionId: WORKER_VERSION_ID,
    qualificationBundleSha256: BUNDLE_SHA256,
    qualificationResultSha256: RESULT_SHA256,
    modelCalls: 0,
  })
})

test('R6 activation must stabilize on one version before qualification registration', async () => {
  const env = environment(undefined, { versionedOnly: true })
  const versions = [OTHER_WORKER_VERSION_ID, WORKER_VERSION_ID, WORKER_VERSION_ID, WORKER_VERSION_ID]
  let calls = 0
  const result = await runR6QualificationPreflight({
    runLabel: 'r6-version-stability', token: TOKEN, expectedWorkerVersionId: WORKER_VERSION_ID,
    sleeper: async () => {}, probeDelayMs: 0,
    fetcher: async (url, init) => {
      calls += 1
      assert.equal(new Headers(init.headers).get('Cloudflare-Workers-Version-Overrides'), null)
      if (url.endsWith('/activation')) {
        const versionId = versions.shift()
        return Response.json({
          status: 'QUALIFICATION_ENDPOINT_ACTIVE_MODEL_PHASES_LOCKED',
          protocolVersion: E2_R6_PROTOCOL_VERSION,
          harnessVersion: E2_R6_PREVIEW_HARNESS_VERSION,
          workerVersionId: versionId,
          qualificationBundleSha256: BUNDLE_SHA256,
          qualificationResultSha256: RESULT_SHA256,
          modelCalls: 0,
        })
      }
      return runE2R6Harness(new Request(url, init), env)
    },
  })
  assert.equal(calls, 5)
  assert.equal(result.activation.probes, 4)
  assert.equal(result.activation.workerVersionId, WORKER_VERSION_ID)
  assert.equal(result.payload.expectedWorkerVersionId, WORKER_VERSION_ID)
})

test('R6 dedicated qualification Worker exposes no unrelated route or provider path', async () => {
  const env = environment(undefined, { versionedOnly: true })
  const unrelated = await qualificationWorker.fetch(new Request(`${VERSIONED_ORIGIN}/api/deepseek`, {
    method: 'POST', headers: { origin: VERSIONED_ORIGIN, authorization: `Bearer ${TOKEN}` },
  }), env)
  assert.equal(unrelated.status, 404)
  assert.equal((await unrelated.json()).error, 'NOT_FOUND')
  const activation = await qualificationWorker.fetch(request('activation', {
    origin: VERSIONED_ORIGIN, baseOrigin: VERSIONED_ORIGIN,
  }), env)
  assert.equal(activation.status, 200)
  assert.equal((await activation.json()).workerVersionId, WORKER_VERSION_ID)
})

test('R6 Worker rejects a qualification request that drifts to another active version', async () => {
  const ledger = ledgerService()
  const env = environment(ledger)
  const registration = await buildR6QualificationRegistration({
    runLabel: 'r6-version-drift', expectedWorkerVersionId: OTHER_WORKER_VERSION_ID,
  })
  const response = await runE2R6Harness(request('qualification', { method: 'POST', body: registration }), env)
  assert.equal(response.status, 412)
  assert.equal((await response.json()).error, 'QUALIFICATION_BINDING_INVALID')
  assert.equal(ledger.instances.size, 0)
})

test('R6 missing Worker version metadata fails closed before ledger or provider access', async () => {
  const ledger = ledgerService()
  const env = environment(ledger)
  delete env.CF_VERSION_METADATA
  let providerCalls = 0
  const response = await runE2R6Harness(request('activation'), env, async () => { providerCalls += 1 })
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'VERSION_METADATA_NOT_CONFIGURED', modelCalls: 0 })
  assert.equal(ledger.instances.size, 0)
  assert.equal(providerCalls, 0)
})

test('R6 activation stability rejects mixed or unavailable versions without registration', async () => {
  let calls = 0
  await assert.rejects(() => awaitR6StableActivation({
    token: TOKEN, expectedWorkerVersionId: WORKER_VERSION_ID,
    maxProbes: 4, requiredStableResponses: 3, probeDelayMs: 0, sleeper: async () => {},
    fetcher: async () => {
      calls += 1
      const workerVersionId = calls % 2 === 0 ? WORKER_VERSION_ID : OTHER_WORKER_VERSION_ID
      return Response.json({
        status: 'QUALIFICATION_ENDPOINT_ACTIVE_MODEL_PHASES_LOCKED', protocolVersion: E2_R6_PROTOCOL_VERSION,
        harnessVersion: E2_R6_PREVIEW_HARNESS_VERSION, workerVersionId,
        qualificationBundleSha256: BUNDLE_SHA256, qualificationResultSha256: RESULT_SHA256, modelCalls: 0,
      })
    },
  }), /R6_ACTIVATION_NOT_STABLE_AFTER_4_PROBES/u)
  assert.equal(calls, 4)
})

test('R6 activation stability rejects response-shape or harness-version drift', async () => {
  await assert.rejects(() => awaitR6StableActivation({
    token: TOKEN, expectedWorkerVersionId: WORKER_VERSION_ID,
    maxProbes: 3, requiredStableResponses: 3, probeDelayMs: 0, sleeper: async () => {},
    fetcher: async () => Response.json({
      status: 'QUALIFICATION_ENDPOINT_ACTIVE_MODEL_PHASES_LOCKED', protocolVersion: E2_R6_PROTOCOL_VERSION,
      harnessVersion: 'e2-9-r6-preview-harness-1.0.0', workerVersionId: WORKER_VERSION_ID,
      qualificationBundleSha256: BUNDLE_SHA256, qualificationResultSha256: RESULT_SHA256,
      modelCalls: 0, unexpected: 'drift',
    }),
  }), /R6_ACTIVATION_NOT_STABLE_AFTER_3_PROBES/u)
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
  assert.equal(activation.name, 'student-affairs-e2-r6-qualification-preview')
  assert.equal(activation.main, './cloudflare/e2-r6-qualification-worker.mjs')
  assert.equal(activation.preview_urls, true)
  assert.equal(activation.assets, undefined)
  assert.equal(activation.vars.E2_R6_HARNESS_ENABLED, 'true')
  assert.equal(activation.vars.E2_R6_VERSIONED_PREVIEW_ONLY, 'true')
  assert.equal(activation.vars.E2_R6_PREVIEW_ORIGIN, R6_PREVIEW_ORIGIN)
  assert.equal(activation.vars.E2_R6_QUALIFICATION_BUNDLE_SHA256, BUNDLE_SHA256)
  assert.equal(activation.vars.E2_R6_QUALIFICATION_RESULT_SHA256, RESULT_SHA256)
  assert.deepEqual(activation.services, [{ binding: 'E2_R6_QUALIFICATION_LEDGER', service: 'student-affairs-e2-r6-qualification-ledger-preview' }])
  assert.equal(E2_R6_PROTOCOL_VERSION, 'e2-9-v4-pro-protocol-3.5.0')
  assert.equal(activation.vars.E2_R6_BENCHMARK_TOKEN_SHA256, undefined)
  assert.equal(E2_R6_PREVIEW_HARNESS_VERSION, 'e2-9-r6-preview-harness-1.4.0')
})

test('R6 deployment projection binds both Preview configs and rejects feature-flag drift', async () => {
  const current = await buildR6DeploymentProjection({ root: process.cwd() })
  assert.match(current.sha256, /^[a-f0-9]{64}$/u)
  assert.equal(current.projection.production.experimentalFlagsAbsent, true)
  const root = await mkdtemp(path.join(os.tmpdir(), 'e2-r6-deployment-drift-'))
  await mkdir(path.join(root, 'docs', 'e2-v4-pro-benchmark-r6'), { recursive: true })
  const contractRaw = await readFile(new URL('../docs/e2-v4-pro-benchmark-r6/preview-deployment-contract.json', import.meta.url), 'utf8')
  const qualificationRaw = await readFile(new URL('../wrangler.e2-r6-preview.jsonc', import.meta.url), 'utf8')
  const main = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'))
  main.env.preview.vars.E2_V4_PRO_BENCHMARK_ENABLED = 'true'
  await writeFile(path.join(root, 'docs', 'e2-v4-pro-benchmark-r6', 'preview-deployment-contract.json'), contractRaw, 'utf8')
  await writeFile(path.join(root, 'wrangler.e2-r6-preview.jsonc'), qualificationRaw, 'utf8')
  await writeFile(path.join(root, 'wrangler.jsonc'), JSON.stringify(main), 'utf8')
  await assert.rejects(() => buildR6DeploymentProjection({ root }), /R6_DEPLOYMENT_CONTRACT_INVALID/u)
})
