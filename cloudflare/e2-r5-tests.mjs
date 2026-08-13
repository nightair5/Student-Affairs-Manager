import assert from 'node:assert/strict'
import test from 'node:test'
import { E2R5RunLedger } from './e2-r5-ledger-worker.mjs'
import { E2_R5_PROTOCOL_VERSION, runE2R5Benchmark } from './e2-r5-benchmark.mjs'
import { classifyR5Failure } from './e2-r5-transport-policy.mjs'
import { createWorker } from './worker.mjs'

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
      const label = request.headers.get('x-e2-r5-run-label')
      if (!instances.has(label)) instances.set(label, new E2R5RunLedger({ storage: new MemoryStorage() }))
      return instances.get(label).fetch(request)
    },
  }
}

const TOKEN = 'r5-test-token-that-is-longer-than-thirty-two-characters'
const HASH = 'a'.repeat(64)
const REGISTRATION_BINDINGS = Object.freeze({
  sourceOnlySha256: HASH,
  readinessManifestSha256: HASH,
  smokeManifestSha256: HASH,
  screeningManifestSha256: HASH,
  bundleManifestSha256: HASH,
  protocolBundleSha256: HASH,
  promptAndPipelineSha256: HASH,
  schemaBundleSha256: HASH,
  scorerSemanticsSha256: HASH,
  datasetBundleSha256: HASH,
  activationSha256: HASH,
  deploymentVersion: '00000000-0000-0000-0000-000000000001',
  ledgerDeploymentVersion: '00000000-0000-0000-0000-000000000002',
})

function request(path, body, token = TOKEN) {
  return new Request(`https://preview.example.test${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { origin: 'https://preview.example.test', authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

function environment(ledger) {
  return {
    E2_R5_BENCHMARK_ENABLED: 'true',
    E2_R5_PREVIEW_ORIGIN: 'https://preview.example.test',
    E2_R5_BENCHMARK_TOKEN: TOKEN,
    DEEPSEEK_API_KEY: 'server-only-test-key-for-e2-r5',
    E2_R5_LEDGER: ledger,
    CF_VERSION_METADATA: { id: 'test-preview-deployment' },
  }
}

async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function informationResult(modelName = 'deepseek-v4-flash') {
  return {
    schemaVersion: '2.0',
    promptVersion: 'recognition-2.4.1',
    modelName,
    sourceSummary: { title: 'Library notice', sourceType: 'text', notificationType: 'information_only', summary: 'The library will be closed for maintenance.', requiresAction: false, actionReason: '' },
    projectMatch: { decision: 'uncertain' },
    projectSuggestion: null,
    milestones: [],
    standaloneTasks: [],
    materials: [],
    timePoints: [],
    events: [],
    evidence: [],
    conflicts: [],
    ambiguities: [],
    ignoredContent: [],
    quality: {},
  }
}

function successfulProviderResponse(requestedModel, result = informationResult()) {
  return Response.json({
    model: requestedModel,
    system_fingerprint: `fingerprint-${requestedModel}`,
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }],
  }, { headers: { 'content-type': 'application/json', 'x-request-id': `request-${requestedModel}` } })
}

function truncatedProviderResponse(model = 'deepseek-v4-flash') {
  return new Response(`{"id":"response","model":"${model}","choices":[{"message":{"content":"unfinished`, {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-request-id': 'truncated-request' },
  })
}

function buildRegistration(runLabel, target) {
  const readiness = ['flash', 'pro'].flatMap((modelAlias) => [1, 2, 3].map((probeIndex) => ({
    observationId: `${runLabel}-ready-${modelAlias}-${probeIndex}`,
    phase: 'readiness',
    caseId: null,
    probeIndex,
    modelAlias,
    semanticRole: null,
    sourceSha256: null,
    inputSha256: HASH,
    phaseManifestSha256: HASH,
    maxAttempts: 1,
  })))
  const counterpartAlias = target.modelAlias === 'flash' ? 'pro' : 'flash'
  const smoke = [target, {
    ...target,
    observationId: `${runLabel}-target-${counterpartAlias}`,
    modelAlias: counterpartAlias,
  }, ...Array.from({ length: 4 }, (_, caseIndex) => ['flash', 'pro'].map((modelAlias) => ({
    observationId: `${runLabel}-smoke-${caseIndex}-${modelAlias}`,
    phase: 'smoke',
    caseId: `${runLabel}-smoke-case-${caseIndex}`,
    modelAlias,
    semanticRole: 'action_required',
    sourceSha256: HASH,
    inputSha256: HASH,
    phaseManifestSha256: HASH,
    maxAttempts: 2,
  }))).flat()]
  const screening = Array.from({ length: 8 }, (_, caseIndex) => ['flash', 'pro'].map((modelAlias) => ({
    observationId: `${runLabel}-screen-${caseIndex}-${modelAlias}`,
    phase: 'screening',
    caseId: `${runLabel}-screen-case-${caseIndex}`,
    modelAlias,
    semanticRole: 'action_required',
    sourceSha256: HASH,
    inputSha256: HASH,
    phaseManifestSha256: HASH,
    maxAttempts: 2,
  }))).flat()
  return { runLabel, protocolVersion: E2_R5_PROTOCOL_VERSION, runManifestSha256: HASH, bindings: { ...REGISTRATION_BINDINGS }, observations: [...readiness, ...smoke, ...screening] }
}

async function primeSmoke({ runLabel, modelAlias = 'flash', semanticRole = 'information_only' }) {
  const ledger = ledgerService()
  const env = environment(ledger)
  const content = 'The library will be closed for maintenance this Friday. No student action is required.'
  const input = { sourceType: 'text', sourceTitle: 'Library notice', content, referenceTime: '2026-08-13T09:00:00+08:00', timezone: 'Asia/Shanghai' }
  const canonicalInput = JSON.stringify(Object.fromEntries(Object.entries(input).sort()))
  const sourceSha256 = await digest(content)
  const target = { observationId: `${runLabel}-target`, phase: 'smoke', caseId: `${runLabel}-target-case`, modelAlias, semanticRole, sourceSha256, inputSha256: await digest(canonicalInput), phaseManifestSha256: HASH, maxAttempts: 2 }
  const registration = buildRegistration(runLabel, target)
  const registered = await runE2R5Benchmark(request('/api/experiments/e2-9/r5/benchmark/register', registration), env)
  assert.equal(registered.status, 201, JSON.stringify(await registered.clone().json()))
  const instance = ledger.instances.get(runLabel)
  const state = instance.state.storage.values.get('run')
  state.stage = 'SMOKE_OPEN'
  await instance.state.storage.put('run', state)
  const body = {
    runLabel,
    observationId: target.observationId,
    phase: 'smoke',
    caseId: target.caseId,
    modelAlias,
    semanticRole,
    ...input,
    sourceSha256,
    inputSha256: target.inputSha256,
    phaseManifestSha256: HASH,
    protocolVersion: E2_R5_PROTOCOL_VERSION,
  }
  return { ledger, env, body }
}

test('truncation retry requires machine evidence and exact model identity', async () => {
  const rawResponse = '{"id":"x","model":"deepseek-v4-flash","choices":[{"message":{"content":"unfinished'
  const evidence = await classifyR5Failure('UPSTREAM_JSON_INVALID', { rawResponse, attempts: [{ attempt: 1, status: 200, transportStatus: 'response_received' }], upstreamHeaders: { 'content-type': 'application/json' } }, 'deepseek-v4-flash')
  assert.equal(evidence.classification, 'UPSTREAM_JSON_TRUNCATED')
  assert.equal(evidence.retryEligible, true)
  const wrongModel = await classifyR5Failure('UPSTREAM_JSON_INVALID', { rawResponse, attempts: [{ attempt: 1, status: 200, transportStatus: 'response_received' }], upstreamHeaders: { 'content-type': 'application/json' } }, 'deepseek-v4-pro')
  assert.equal(wrongModel.classification, 'MODEL_JSON_INVALID')
  assert.equal(wrongModel.retryEligible, false)
})

test('first truncated response and second valid response retain both attempts', async () => {
  const { ledger, env, body } = await primeSmoke({ runLabel: 'r5-retry' })
  let calls = 0
  const response = await runE2R5Benchmark(request('/api/experiments/e2-9/r5/benchmark/generate', body), env, async (_url, init) => {
    calls += 1
    const model = JSON.parse(init.body).model
    return calls === 1 ? truncatedProviderResponse(model) : successfulProviderResponse(model)
  })
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.protocolStatus, 'complete_after_protocol_retry')
  assert.deepEqual(payload.protocolAttempts.map((item) => item.status), ['upstream_json_truncated', 'complete'])
  const record = ledger.instances.get(body.runLabel).state.storage.values.get('run').observations[body.observationId]
  assert.deepEqual(record.attempts.map((item) => item.status), ['upstream_json_truncated', 'complete'])
})

test('model JSON invalid is terminal and is not retried', async () => {
  const { env, body } = await primeSmoke({ runLabel: 'r5-model-json-invalid' })
  let calls = 0
  const response = await runE2R5Benchmark(request('/api/experiments/e2-9/r5/benchmark/generate', body), env, async (_url, init) => {
    calls += 1
    const model = JSON.parse(init.body).model
    return successfulProviderResponse(model, 'not-json')
  })
  assert.equal(response.status, 502)
  assert.equal((await response.json()).error, 'MODEL_JSON_INVALID')
  assert.equal(calls, 1)
})

test('upstream authorization failure is terminal and is not retried', async () => {
  const { env, body } = await primeSmoke({ runLabel: 'r5-upstream-401' })
  let calls = 0
  const response = await runE2R5Benchmark(request('/api/experiments/e2-9/r5/benchmark/generate', body), env, async () => {
    calls += 1
    return Response.json({ error: { message: 'unauthorized' } }, { status: 401 })
  })
  assert.equal(response.status, 401)
  assert.equal((await response.json()).error, 'UPSTREAM_401')
  assert.equal(calls, 1)
})

test('model fallback is an integrity failure and is not retried', async () => {
  const { env, body } = await primeSmoke({ runLabel: 'r5-model-fallback', modelAlias: 'pro' })
  let calls = 0
  const response = await runE2R5Benchmark(request('/api/experiments/e2-9/r5/benchmark/generate', body), env, async () => {
    calls += 1
    return successfulProviderResponse('deepseek-v4-flash')
  })
  assert.equal(response.status, 502)
  const payload = await response.json()
  assert.equal(payload.error, 'MODEL_FALLBACK_DETECTED')
  assert.equal(payload.protocolStatus, 'integrity_failure')
  assert.equal(calls, 1)
})

test('missing returned model is unverifiable identity and is not retried', async () => {
  const { env, body } = await primeSmoke({ runLabel: 'r5-model-unverifiable', modelAlias: 'pro' })
  let calls = 0
  const response = await runE2R5Benchmark(request('/api/experiments/e2-9/r5/benchmark/generate', body), env, async () => {
    calls += 1
    return Response.json({
      system_fingerprint: 'fingerprint-without-model',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(informationResult()) } }],
    }, { headers: { 'content-type': 'application/json' } })
  })
  assert.equal(response.status, 502)
  const payload = await response.json()
  assert.equal(payload.error, 'MODEL_IDENTITY_UNVERIFIABLE')
  assert.equal(payload.protocolStatus, 'integrity_failure')
  assert.equal(calls, 1)
})

test('failed observation cannot be overwritten by rerun', async () => {
  const { env, body } = await primeSmoke({ runLabel: 'r5-no-rerun' })
  let calls = 0
  const fetcher = async (_url, init) => {
    calls += 1
    return truncatedProviderResponse(JSON.parse(init.body).model)
  }
  const first = await runE2R5Benchmark(request('/api/experiments/e2-9/r5/benchmark/generate', body), env, fetcher)
  assert.equal(first.status, 502)
  assert.equal((await first.json()).protocolStatus, 'transport_integrity_failure')
  const callsAfterFailure = calls
  const second = await runE2R5Benchmark(request('/api/experiments/e2-9/r5/benchmark/generate', body), env, fetcher)
  assert.equal(second.status, 409)
  assert.equal(calls, callsAfterFailure)
  assert.equal(callsAfterFailure, 2)
})

test('ledger rejects tampered pair plans, semantic roles, source hashes, and final lineage', async () => {
  const target = {
    observationId: 'r5-ledger-bind-target', phase: 'smoke', caseId: 'bound-case', modelAlias: 'flash',
    semanticRole: 'information_only', sourceSha256: HASH, inputSha256: HASH, phaseManifestSha256: HASH, maxAttempts: 2,
  }
  const invalidLedger = new E2R5RunLedger({ storage: new MemoryStorage() })
  const invalidRegistration = buildRegistration('r5-invalid-plan', target)
  invalidRegistration.observations.find((item) => item.phase === 'screening').sourceSha256 = 'bad'
  const invalidResponse = await invalidLedger.fetch(new Request('https://ledger.test/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(invalidRegistration) }))
  assert.equal(invalidResponse.status, 400)
  const forbiddenTopLevel = { ...buildRegistration('r5-forbidden-top', target), expected: { tasks: [] } }
  assert.equal((await invalidLedger.fetch(new Request('https://ledger.test/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(forbiddenTopLevel) }))).status, 400)
  const forbiddenObservation = buildRegistration('r5-forbidden-observation', target)
  forbiddenObservation.observations[0].expected = { answer: true }
  assert.equal((await invalidLedger.fetch(new Request('https://ledger.test/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(forbiddenObservation) }))).status, 400)

  const ledger = new E2R5RunLedger({ storage: new MemoryStorage() })
  const call = (path, body) => ledger.fetch(new Request(`https://ledger.test${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))
  assert.equal((await call('/register', buildRegistration('r5-ledger-bind', target))).status, 201)
  const stored = ledger.state.storage.values.get('run')
  stored.stage = 'SMOKE_OPEN'
  await ledger.state.storage.put('run', stored)
  const baseReservation = { observationId: target.observationId, phase: 'smoke', caseId: target.caseId, modelAlias: 'flash', semanticRole: target.semanticRole, sourceSha256: HASH, inputSha256: HASH, phaseManifestSha256: HASH }
  assert.equal((await call('/reserve', { ...baseReservation, semanticRole: 'action_required' })).status, 412)
  assert.equal((await call('/reserve', { ...baseReservation, sourceSha256: 'b'.repeat(64) })).status, 412)
  const reserved = await (await call('/reserve', baseReservation)).json()
  assert.equal((await call('/attempt', { observationId: target.observationId, reservationToken: reserved.reservationToken, attemptNumber: 1, status: 'complete' })).status, 200)
  const wrongLineage = { observationId: target.observationId, reservationToken: reserved.reservationToken, sourceSha256: HASH, requestedModel: 'deepseek-v4-flash', returnedModel: 'deepseek-v4-flash', executionModel: 'deepseek-v4-flash', resultModelName: 'deepseek-v4-pro' }
  assert.equal((await call('/finalize', wrongLineage)).status, 412)
  assert.equal((await call('/finalize', { ...wrongLineage, resultModelName: 'deepseek-v4-flash' })).status, 200)
})

test('full 32-observation Ledger state machine reaches path-mask preview only after every phase completes', async () => {
  const target = {
    observationId: 'r5-full-target', phase: 'smoke', caseId: 'r5-full-target-case', modelAlias: 'flash',
    semanticRole: 'information_only', sourceSha256: HASH, inputSha256: HASH, phaseManifestSha256: HASH, maxAttempts: 2,
  }
  const registration = buildRegistration('r5-full-ledger', target)
  const ledger = new E2R5RunLedger({ storage: new MemoryStorage() })
  const call = (path, body, method = 'POST') => ledger.fetch(new Request(`https://ledger.test${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  }))
  assert.equal((await call('/register', registration)).status, 201)
  const nextStage = { readiness: 'SMOKE_OPEN', smoke: 'SCREENING_OPEN', screening: 'PATH_MASK_PREVIEW_OPEN' }
  for (const phase of ['readiness', 'smoke', 'screening']) {
    for (const item of registration.observations.filter((observation) => observation.phase === phase)) {
      const reservation = await (await call('/reserve', {
        observationId: item.observationId, phase: item.phase, caseId: item.caseId, probeIndex: item.probeIndex,
        modelAlias: item.modelAlias, semanticRole: item.semanticRole, sourceSha256: item.sourceSha256,
        inputSha256: item.inputSha256, phaseManifestSha256: item.phaseManifestSha256,
      })).json()
      const model = item.modelAlias === 'flash' ? 'deepseek-v4-flash' : 'deepseek-v4-pro'
      assert.equal((await call('/attempt', { observationId: item.observationId, reservationToken: reservation.reservationToken, attemptNumber: 1, status: 'complete', requestedModel: model, returnedModel: model })).status, 200)
      assert.equal((await call('/finalize', { observationId: item.observationId, reservationToken: reservation.reservationToken, sourceSha256: item.sourceSha256, requestedModel: model, returnedModel: model, executionModel: model, resultModelName: model })).status, 200)
    }
    assert.equal((await call('/advance', { nextStage: nextStage[phase] })).status, 200)
  }
  const state = await (await call('/state', undefined, 'GET')).json()
  assert.equal(state.stage, 'PATH_MASK_PREVIEW_OPEN')
  assert.equal(state.runStatus, 'COMPLETE')
  assert.equal(Object.keys(state.observations).length, 32)
  assert.deepEqual(state.stageHistory.map((item) => item.stage), ['READINESS_OPEN', 'SMOKE_OPEN', 'SCREENING_OPEN', 'PATH_MASK_PREVIEW_OPEN'])
})

test('pure information is legal while action-required empty output fails without retry', async () => {
  const legal = await primeSmoke({ runLabel: 'r5-info', semanticRole: 'information_only' })
  const legalResponse = await runE2R5Benchmark(request('/api/experiments/e2-9/r5/benchmark/generate', legal.body), legal.env, async (_url, init) => successfulProviderResponse(JSON.parse(init.body).model))
  assert.equal(legalResponse.status, 200)
  const invalid = await primeSmoke({ runLabel: 'r5-action', semanticRole: 'action_required' })
  let calls = 0
  const invalidResponse = await runE2R5Benchmark(request('/api/experiments/e2-9/r5/benchmark/generate', invalid.body), invalid.env, async (_url, init) => {
    calls += 1
    return successfulProviderResponse(JSON.parse(init.body).model)
  })
  assert.equal(invalidResponse.status, 502)
  assert.equal((await invalidResponse.json()).error, 'BASIC_CONTENT_EMPTY')
  assert.equal(calls, 1)
})

test('server-authoritative lineage overrides model-authored modelName', async () => {
  const { env, body } = await primeSmoke({ runLabel: 'r5-lineage', modelAlias: 'pro' })
  const response = await runE2R5Benchmark(request('/api/experiments/e2-9/r5/benchmark/generate', body), env, async (_url, init) => successfulProviderResponse(JSON.parse(init.body).model, informationResult('deepseek-v4-flash')))
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.deepEqual([payload.execution.requestedModel, payload.execution.returnedModel, payload.execution.executionModel, payload.result.modelName], Array(4).fill('deepseek-v4-pro'))
})

test('generation firewall blocks expected answers before provider invocation', async () => {
  const { env, body } = await primeSmoke({ runLabel: 'r5-firewall' })
  let calls = 0
  const response = await runE2R5Benchmark(request('/api/experiments/e2-9/r5/benchmark/generate', { ...body, expected: { tasks: [] } }), env, async () => { calls += 1; throw new Error('must not call') })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error, 'GENERATION_FIREWALL_REJECTED')
  assert.equal(calls, 0)
})

test('generation firewall rejects client model lineage and excludes evaluation metadata from provider payload', async () => {
  const blocked = await primeSmoke({ runLabel: 'r5-client-model-name' })
  let blockedCalls = 0
  const blockedResponse = await runE2R5Benchmark(request('/api/experiments/e2-9/r5/benchmark/generate', { ...blocked.body, modelName: 'deepseek-v4-pro' }), blocked.env, async () => { blockedCalls += 1; throw new Error('must not call') })
  assert.equal(blockedResponse.status, 400)
  assert.equal((await blockedResponse.json()).error, 'GENERATION_FIREWALL_REJECTED')
  assert.equal(blockedCalls, 0)

  const allowed = await primeSmoke({ runLabel: 'r5-provider-firewall' })
  let providerBody
  const allowedResponse = await runE2R5Benchmark(request('/api/experiments/e2-9/r5/benchmark/generate', allowed.body), allowed.env, async (_url, init) => {
    providerBody = JSON.parse(init.body)
    return successfulProviderResponse(providerBody.model)
  })
  assert.equal(allowedResponse.status, 200)
  const serialized = JSON.stringify(providerBody)
  for (const forbidden of ['semanticRole', 'caseId', 'expected', 'gold', 'label', 'score']) assert.equal(serialized.includes(forbidden), false)
})

test('R5 rejects an incorrect bearer before provider invocation', async () => {
  const { env, body } = await primeSmoke({ runLabel: 'r5-wrong-bearer' })
  let calls = 0
  const response = await runE2R5Benchmark(request('/api/experiments/e2-9/r5/benchmark/generate', body, 'wrong-token-that-is-longer-than-thirty-two-characters'), env, async () => { calls += 1; throw new Error('must not call') })
  assert.equal(response.status, 401)
  assert.equal((await response.json()).error, 'UNAUTHORIZED')
  assert.equal(calls, 0)
})

test('R5 rejects a legacy shared bearer when the fresh R5 secret is absent', async () => {
  const ledger = ledgerService()
  const env = environment(ledger)
  delete env.E2_R5_BENCHMARK_TOKEN
  env.E2_V4_PRO_BENCHMARK_TOKEN = TOKEN
  const response = await runE2R5Benchmark(request('/api/experiments/e2-9/r5/benchmark/state?runLabel=legacy-secret'), env)
  assert.equal(response.status, 401)
  assert.equal((await response.json()).error, 'UNAUTHORIZED')
})

test('main Worker keeps R5 endpoint hidden when Preview flag is false', async () => {
  const worker = createWorker({ fetcher: async () => { throw new Error('upstream must not be called') } })
  const response = await worker.fetch(new Request('https://preview.example.test/api/experiments/e2-9/r5/benchmark/state?runLabel=r5-hidden', { headers: { origin: 'https://preview.example.test' } }), {
    E2_R5_BENCHMARK_ENABLED: 'false',
    E2_R5_PREVIEW_ORIGIN: 'https://preview.example.test',
    ALLOWED_ORIGINS: 'https://preview.example.test',
    ASSETS: { fetch: async () => new Response('asset') },
  })
  assert.equal(response.status, 404)
  assert.equal((await response.json()).error, 'NOT_FOUND')
})
