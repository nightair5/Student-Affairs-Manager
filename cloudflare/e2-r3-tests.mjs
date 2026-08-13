import assert from 'node:assert/strict'
import test from 'node:test'
import { E2R3RunLedger } from './e2-r3-ledger-worker.mjs'
import { E2_R3_PROTOCOL_VERSION, runE2R3Benchmark } from './e2-r3-benchmark.mjs'
import { classifyR3Failure } from './e2-r3-transport-policy.mjs'
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
      const label = request.headers.get('x-e2-r3-run-label')
      if (!instances.has(label)) instances.set(label, new E2R3RunLedger({ storage: new MemoryStorage() }))
      return instances.get(label).fetch(request)
    },
  }
}

const TOKEN = 'r3-test-token-that-is-longer-than-thirty-two-characters'
const HASH = 'a'.repeat(64)

function request(path, body, token = TOKEN) {
  return new Request(`https://preview.example.test${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { origin: 'https://preview.example.test', authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

function environment(ledger) {
  return {
    E2_R3_BENCHMARK_ENABLED: 'true',
    E2_R3_PREVIEW_ORIGIN: 'https://preview.example.test',
    E2_V4_PRO_BENCHMARK_TOKEN: TOKEN,
    DEEPSEEK_API_KEY: 'server-only-test-key-for-e2-r3',
    E2_R3_LEDGER: ledger,
    CF_VERSION_METADATA: { id: 'test-preview-deployment' },
  }
}

async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function informationResult(modelName = 'deepseek-v4-flash') {
  return {
    schemaVersion: '2.0', promptVersion: 'recognition-2.4.1', modelName,
    sourceSummary: { title: '通知', sourceType: 'text', notificationType: 'information_only', summary: '仅供知悉', requiresAction: false, actionReason: '' },
    projectMatch: { decision: 'uncertain' }, projectSuggestion: null, milestones: [], standaloneTasks: [], materials: [], timePoints: [], events: [], evidence: [], conflicts: [], ambiguities: [], ignoredContent: [], quality: {},
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
    observationId: `${runLabel}-ready-${modelAlias}-${probeIndex}`, phase: 'readiness', modelAlias,
    inputSha256: HASH, phaseManifestSha256: HASH, maxAttempts: 1,
  })))
  const smoke = Array.from({ length: 10 }, (_, index) => index === 0 ? target : ({
    observationId: `${runLabel}-smoke-${index}`, phase: 'smoke', modelAlias: index % 2 ? 'pro' : 'flash',
    inputSha256: HASH, phaseManifestSha256: HASH, maxAttempts: 2,
  }))
  const screening = Array.from({ length: 16 }, (_, index) => ({
    observationId: `${runLabel}-screen-${index}`, phase: 'screening', modelAlias: index % 2 ? 'pro' : 'flash',
    inputSha256: HASH, phaseManifestSha256: HASH, maxAttempts: 2,
  }))
  return { runLabel, protocolVersion: E2_R3_PROTOCOL_VERSION, runManifestSha256: HASH, bindings: { protocolBundleSha256: HASH }, observations: [...readiness, ...smoke, ...screening] }
}

async function primeSmoke({ runLabel, modelAlias = 'flash', semanticRole = 'information_only' }) {
  const ledger = ledgerService()
  const env = environment(ledger)
  const content = '本周五图书馆闭馆维护，请同学们知悉。'
  const input = { sourceType: 'text', sourceTitle: '闭馆通知', content, referenceTime: '2026-08-13T09:00:00+08:00', timezone: 'Asia/Shanghai' }
  const target = { observationId: `${runLabel}-target`, phase: 'smoke', modelAlias, inputSha256: await digest(JSON.stringify(Object.fromEntries(Object.entries(input).sort()))), phaseManifestSha256: HASH, maxAttempts: 2 }
  const registration = buildRegistration(runLabel, target)
  const registered = await runE2R3Benchmark(request('/api/experiments/e2-9/r3/benchmark/register', registration), env)
  assert.equal(registered.status, 201)
  const instance = ledger.instances.get(runLabel)
  const state = instance.state.storage.values.get('run')
  state.stage = 'SMOKE_OPEN'
  await instance.state.storage.put('run', state)
  const body = {
    runLabel, observationId: target.observationId, phase: 'smoke', modelAlias, semanticRole,
    ...input, sourceSha256: await digest(content), inputSha256: target.inputSha256,
    phaseManifestSha256: HASH, protocolVersion: E2_R3_PROTOCOL_VERSION,
  }
  return { ledger, env, body, target }
}

test('truncation classification requires machine evidence and exact model identity', async () => {
  const rawResponse = '{"id":"x","model":"deepseek-v4-flash","choices":[{"message":{"content":"unfinished'
  const evidence = await classifyR3Failure('UPSTREAM_JSON_INVALID', {
    rawResponse,
    attempts: [{ attempt: 1, status: 200, transportStatus: 'response_received' }],
    upstreamHeaders: { 'content-type': 'application/json' },
  }, 'deepseek-v4-flash')
  assert.equal(evidence.classification, 'UPSTREAM_JSON_TRUNCATED')
  assert.equal(evidence.retryEligible, true)
  const wrongModel = await classifyR3Failure('UPSTREAM_JSON_INVALID', {
    rawResponse,
    attempts: [{ attempt: 1, status: 200, transportStatus: 'response_received' }],
    upstreamHeaders: { 'content-type': 'application/json' },
  }, 'deepseek-v4-pro')
  assert.equal(wrongModel.classification, 'MODEL_JSON_INVALID')
  assert.equal(wrongModel.retryEligible, false)
  assert.equal(JSON.stringify(evidence).includes('unfinished'), false)
  const malformed = await classifyR3Failure('UPSTREAM_JSON_INVALID', {
    rawResponse: '{"model":"deepseek-v4-flash","choices":,',
    attempts: [{ attempt: 1, status: 200, transportStatus: 'response_received' }],
    upstreamHeaders: { 'content-type': 'application/json' },
  }, 'deepseek-v4-flash')
  assert.equal(malformed.classification, 'MODEL_JSON_INVALID')
  assert.equal(malformed.retryEligible, false)
})

test('T01 first truncated and second valid becomes complete_after_protocol_retry', async () => {
  const { ledger, env, body } = await primeSmoke({ runLabel: 'r3-t01' })
  let calls = 0
  const fetcher = async (_url, init) => {
    calls += 1
    const model = JSON.parse(init.body).model
    return calls === 1 ? truncatedProviderResponse(model) : successfulProviderResponse(model)
  }
  const response = await runE2R3Benchmark(request('/api/experiments/e2-9/r3/benchmark/generate', body), env, fetcher)
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.protocolStatus, 'complete_after_protocol_retry')
  assert.equal(payload.observationId, body.observationId)
  assert.deepEqual(payload.protocolAttempts.map((item) => item.status), ['upstream_json_truncated', 'complete'])
  assert.equal(calls, 2)
  const record = ledger.instances.get(body.runLabel).state.storage.values.get('run').observations[body.observationId]
  assert.deepEqual(record.attempts.map((item) => item.status), ['upstream_json_truncated', 'complete'])
})

test('T02 two truncated attempts become transport_integrity_failure', async () => {
  const { ledger, env, body } = await primeSmoke({ runLabel: 'r3-t02' })
  let calls = 0
  const response = await runE2R3Benchmark(request('/api/experiments/e2-9/r3/benchmark/generate', body), env, async (_url, init) => {
    calls += 1
    return truncatedProviderResponse(JSON.parse(init.body).model)
  })
  assert.equal(response.status, 502)
  const payload = await response.json()
  assert.equal(payload.error, 'UPSTREAM_JSON_TRUNCATED')
  assert.equal(payload.protocolStatus, 'transport_integrity_failure')
  assert.equal(payload.protocolAttempts.length, 2)
  assert.equal(calls, 2)
  const record = ledger.instances.get(body.runLabel).state.storage.values.get('run').observations[body.observationId]
  assert.equal(record.status, 'transport_integrity_failure')
})

test('T03 complete provider response with invalid model JSON is not retried', async () => {
  const { env, body } = await primeSmoke({ runLabel: 'r3-t03' })
  let calls = 0
  const response = await runE2R3Benchmark(request('/api/experiments/e2-9/r3/benchmark/generate', body), env, async (_url, init) => {
    calls += 1
    const model = JSON.parse(init.body).model
    return Response.json({ model, system_fingerprint: 'fingerprint', usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }, choices: [{ finish_reason: 'stop', message: { content: 'not-json' } }] })
  })
  assert.equal(response.status, 502)
  const payload = await response.json()
  assert.equal(payload.error, 'MODEL_JSON_INVALID')
  assert.equal(payload.protocolAttempts.length, 1)
  assert.equal(calls, 1)
})

test('T04 upstream 401 is not retried', async () => {
  const { env, body } = await primeSmoke({ runLabel: 'r3-t04' })
  let calls = 0
  const response = await runE2R3Benchmark(request('/api/experiments/e2-9/r3/benchmark/generate', body), env, async () => {
    calls += 1
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  })
  assert.equal(response.status, 401)
  const payload = await response.json()
  assert.equal(payload.protocolAttempts.length, 1)
  assert.equal(calls, 1)
})

test('T05 valid semantic output rejected by role gate is not retried', async () => {
  const { env, body } = await primeSmoke({ runLabel: 'r3-t05', semanticRole: 'action_required' })
  let calls = 0
  const response = await runE2R3Benchmark(request('/api/experiments/e2-9/r3/benchmark/generate', body), env, async (_url, init) => {
    calls += 1
    return successfulProviderResponse(JSON.parse(init.body).model)
  })
  assert.equal(response.status, 502)
  const payload = await response.json()
  assert.equal(payload.error, 'BASIC_CONTENT_EMPTY')
  assert.equal(payload.protocolAttempts.length, 1)
  assert.equal(calls, 1)
})

test('T06 and T07 ledger permits at most two attempts and retains the first failure', async () => {
  const ledger = new E2R3RunLedger({ storage: new MemoryStorage() })
  const call = (path, body) => ledger.fetch(new Request(`https://ledger.test${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))
  const target = { observationId: 'r3-ledger-target', phase: 'smoke', modelAlias: 'flash', inputSha256: HASH, phaseManifestSha256: HASH, maxAttempts: 2 }
  assert.equal((await call('/register', buildRegistration('r3-ledger', target))).status, 201)
  const stored = ledger.state.storage.values.get('run')
  stored.stage = 'SMOKE_OPEN'
  await ledger.state.storage.put('run', stored)
  const reserved = await (await call('/reserve', target)).json()
  const base = { observationId: target.observationId, reservationToken: reserved.reservationToken }
  assert.equal((await call('/attempt', { ...base, attemptNumber: 1, status: 'upstream_json_truncated', responseSha256: '1'.repeat(64) })).status, 200)
  assert.equal((await call('/attempt', { ...base, attemptNumber: 2, status: 'upstream_json_truncated', responseSha256: '2'.repeat(64) })).status, 200)
  assert.equal((await call('/attempt', { ...base, attemptNumber: 3, status: 'complete' })).status, 409)
  const finalized = await (await call('/finalize', base)).json()
  assert.equal(finalized.status, 'transport_integrity_failure')
  assert.equal(finalized.attempts[0].responseSha256, '1'.repeat(64))
})

test('T08 retry cannot create a second observation and duplicate reserve is rejected', async () => {
  const { ledger, env, body } = await primeSmoke({ runLabel: 'r3-t08' })
  let calls = 0
  const fetcher = async (_url, init) => {
    calls += 1
    const model = JSON.parse(init.body).model
    return calls === 1 ? truncatedProviderResponse(model) : successfulProviderResponse(model)
  }
  assert.equal((await runE2R3Benchmark(request('/api/experiments/e2-9/r3/benchmark/generate', body), env, fetcher)).status, 200)
  const callsAfterFirst = calls
  assert.equal((await runE2R3Benchmark(request('/api/experiments/e2-9/r3/benchmark/generate', body), env, fetcher)).status, 409)
  assert.equal(calls, callsAfterFirst)
  const observations = ledger.instances.get(body.runLabel).state.storage.values.get('run').observations
  assert.deepEqual(Object.keys(observations), [body.observationId])
})

test('generation firewall rejects evaluation keys before provider invocation', async () => {
  const { env, body } = await primeSmoke({ runLabel: 'r3-firewall' })
  let calls = 0
  const response = await runE2R3Benchmark(request('/api/experiments/e2-9/r3/benchmark/generate', { ...body, expected: { tasks: [] } }), env, async () => { calls += 1; throw new Error('must not call') })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error, 'GENERATION_FIREWALL_REJECTED')
  assert.equal(calls, 0)
})

test('evaluation role and rubric fields never enter the provider payload', async () => {
  const { env, body } = await primeSmoke({ runLabel: 'r3-provider-firewall' })
  let providerBody
  const response = await runE2R3Benchmark(request('/api/experiments/e2-9/r3/benchmark/generate', body), env, async (_url, init) => {
    providerBody = JSON.parse(init.body)
    return successfulProviderResponse(providerBody.model)
  })
  assert.equal(response.status, 200)
  const serialized = JSON.stringify(providerBody)
  for (const forbidden of ['semanticRole', 'expected', 'answer', 'gold', 'target', 'score', 'label']) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} reached provider payload`)
  }
})

test('server-authoritative lineage overrides model-authored modelName', async () => {
  const { env, body } = await primeSmoke({ runLabel: 'r3-lineage', modelAlias: 'pro' })
  const response = await runE2R3Benchmark(request('/api/experiments/e2-9/r3/benchmark/generate', body), env, async (_url, init) => successfulProviderResponse(JSON.parse(init.body).model, informationResult('deepseek-v4-flash')))
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.execution.requestedModel, 'deepseek-v4-pro')
  assert.equal(payload.execution.returnedModel, 'deepseek-v4-pro')
  assert.equal(payload.execution.executionModel, 'deepseek-v4-pro')
  assert.equal(payload.result.modelName, 'deepseek-v4-pro')
})

test('main Worker keeps R3 endpoint hidden when Preview flag is false', async () => {
  const worker = createWorker({ fetcher: async () => { throw new Error('upstream must not be called') } })
  const response = await worker.fetch(new Request('https://preview.example.test/api/experiments/e2-9/r3/benchmark/state?runLabel=r3-hidden', { headers: { origin: 'https://preview.example.test' } }), {
    E2_R3_BENCHMARK_ENABLED: 'false', E2_R3_PREVIEW_ORIGIN: 'https://preview.example.test',
    ALLOWED_ORIGINS: 'https://preview.example.test', ASSETS: { fetch: async () => new Response('asset') },
  })
  assert.equal(response.status, 404)
  assert.equal((await response.json()).error, 'NOT_FOUND')
})
