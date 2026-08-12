import assert from 'node:assert/strict'
import test from 'node:test'
import { E2R2RunLedger } from './e2-r2-ledger-worker.mjs'
import {
  E2_R2_PROTOCOL_VERSION,
  normalizeR2BenchmarkResult,
  runE2R2Benchmark,
  validateR2Lineage,
  validateR2Result,
} from './e2-r2-benchmark.mjs'
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
      const label = request.headers.get('x-e2-r2-run-label')
      if (!instances.has(label)) instances.set(label, new E2R2RunLedger({ storage: new MemoryStorage() }))
      return instances.get(label).fetch(request)
    },
  }
}

function request(path, token, body) {
  return new Request(`https://preview.example.test${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { origin: 'https://preview.example.test', authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

const TOKEN = 'r2-test-token-that-is-longer-than-thirty-two-characters'
const HASH = 'a'.repeat(64)

function environment(ledger) {
  return {
    E2_R2_BENCHMARK_ENABLED: 'true',
    E2_R2_PREVIEW_ORIGIN: 'https://preview.example.test',
    E2_R2_BENCHMARK_TOKEN: TOKEN,
    DEEPSEEK_API_KEY: 'server-only-test-key-for-e2-r2',
    E2_R2_LEDGER: ledger,
  }
}

test('role-aware benchmark normalizer injects actual model and accepts zero-entity pure information', () => {
  const result = normalizeR2BenchmarkResult({ sourceSummary: { requiresAction: false }, standaloneTasks: [], milestones: [], materials: [], timePoints: [], events: [], evidence: [] }, 'information_only', 'deepseek-v4-pro')
  assert.equal(result.modelName, 'deepseek-v4-pro')
  assert.equal(result.benchmarkSemanticRole, 'information_only')
  assert.equal(validateR2Result(result, 'information_only'), null)
  assert.equal(validateR2Lineage({ execution: { requestedModel: 'deepseek-v4-pro', returnedModel: 'deepseek-v4-pro', executionModel: 'deepseek-v4-pro' }, result }, 'pro'), null)
})

test('pure information and model lineage violations fail closed', () => {
  const invalidInformation = { sourceSummary: { requiresAction: false }, standaloneTasks: [{ tempId: 'task' }], milestones: [], materials: [], timePoints: [], events: [], evidence: [] }
  assert.equal(validateR2Result(invalidInformation, 'information_only'), 'PURE_INFORMATION_SPURIOUS_ENTITY')
  assert.equal(validateR2Lineage({ execution: { requestedModel: 'deepseek-v4-pro', returnedModel: 'deepseek-v4-pro', executionModel: 'deepseek-v4-pro' }, result: { modelName: 'deepseek-v4-flash' } }, 'pro'), 'MODEL_LINEAGE_MISMATCH')
})

test('main Worker route keeps the R2 endpoint hidden while the Preview flag is off', async () => {
  const worker = createWorker({ fetcher: async () => { throw new Error('upstream must not be called') } })
  const response = await worker.fetch(new Request('https://preview.example.test/api/experiments/e2-9/r2/benchmark/state?runLabel=r2-hidden', { headers: { origin: 'https://preview.example.test' } }), {
    E2_R2_BENCHMARK_ENABLED: 'false',
    E2_R2_PREVIEW_ORIGIN: 'https://preview.example.test',
    ALLOWED_ORIGINS: 'https://preview.example.test',
    ASSETS: { fetch: async () => new Response('asset') },
  })
  assert.equal(response.status, 404)
  assert.equal((await response.json()).error, 'NOT_FOUND')
})

test('ledger prevents rerun, retains failure and blocks stage advancement', async () => {
  const ledger = new E2R2RunLedger({ storage: new MemoryStorage() })
  const headers = { 'content-type': 'application/json' }
  const call = (path, body) => ledger.fetch(new Request(`https://ledger.test${path}`, { method: 'POST', headers, body: JSON.stringify(body) }))
  const registration = await call('/register', {
    runLabel: 'r2-ledger-test', protocolVersion: E2_R2_PROTOCOL_VERSION, bindings: { protocolBundleSha256: HASH },
    observations: [
      { observationId: 'ready-flash', phase: 'readiness', modelAlias: 'flash', inputSha256: HASH, phaseManifestSha256: HASH },
      { observationId: 'smoke-flash', phase: 'smoke', modelAlias: 'flash', inputSha256: HASH, phaseManifestSha256: HASH },
      { observationId: 'screen-flash', phase: 'screening', modelAlias: 'flash', inputSha256: HASH, phaseManifestSha256: HASH },
    ],
  })
  assert.equal(registration.status, 201)
  const reserved = await (await call('/reserve', { observationId: 'ready-flash', phase: 'readiness', modelAlias: 'flash', inputSha256: HASH, phaseManifestSha256: HASH })).json()
  assert.ok(reserved.reservationToken)
  const duplicate = await call('/reserve', { observationId: 'ready-flash', phase: 'readiness', modelAlias: 'flash', inputSha256: HASH, phaseManifestSha256: HASH })
  assert.equal(duplicate.status, 409)
  const finalized = await call('/finalize', { observationId: 'ready-flash', reservationToken: reserved.reservationToken, outcome: 'failure', error: 'UPSTREAM_401' })
  assert.equal(finalized.status, 200)
  const overwrite = await call('/finalize', { observationId: 'ready-flash', reservationToken: reserved.reservationToken, outcome: 'complete' })
  assert.equal(overwrite.status, 409)
  const advance = await call('/advance', { nextStage: 'SMOKE_OPEN' })
  assert.equal(advance.status, 412)
})

test('Worker integration preserves information role and blocks duplicate before a second upstream call', async () => {
  const ledger = ledgerService()
  const env = environment(ledger)
  const readinessInput = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('{"kind":"readiness","modelAlias":"flash","protocolVersion":"e2-9-v4-pro-protocol-3.0.0"}'))
  const readinessSha = [...new Uint8Array(readinessInput)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const registration = {
    runLabel: 'r2-worker-test', protocolVersion: E2_R2_PROTOCOL_VERSION, bindings: { protocolBundleSha256: HASH },
    observations: [
      { observationId: 'ready-flash', phase: 'readiness', modelAlias: 'flash', inputSha256: readinessSha, phaseManifestSha256: HASH },
      { observationId: 'info-flash', phase: 'smoke', modelAlias: 'flash', inputSha256: HASH, phaseManifestSha256: HASH },
      { observationId: 'screen-flash', phase: 'screening', modelAlias: 'flash', inputSha256: HASH, phaseManifestSha256: HASH },
    ],
  }
  assert.equal((await runE2R2Benchmark(request('/api/experiments/e2-9/r2/benchmark/register', TOKEN, registration), env)).status, 201)
  let upstreamCalls = 0
  const fetcher = async (_url, init) => {
    upstreamCalls += 1
    const requestedModel = JSON.parse(init.body).model
    return Response.json({
      model: requestedModel,
      system_fingerprint: 'test-fingerprint',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ schemaVersion: '2.0', modelName: 'deepseek-v4-flash', sourceSummary: { title: '通知', sourceType: 'text', notificationType: 'information_only', summary: '仅供知悉', requiresAction: false, actionReason: '' }, projectMatch: { decision: 'uncertain' }, projectSuggestion: null, milestones: [], standaloneTasks: [], materials: [], timePoints: [], events: [], evidence: [], conflicts: [], ambiguities: [], ignoredContent: [], quality: {} }) } }],
    }, { headers: { 'request-id': `req-${upstreamCalls}` } })
  }
  const readiness = await runE2R2Benchmark(request('/api/experiments/e2-9/r2/benchmark/readiness', TOKEN, { runLabel: 'r2-worker-test', observationId: 'ready-flash', modelAlias: 'flash', inputSha256: readinessSha, phaseManifestSha256: HASH, protocolVersion: E2_R2_PROTOCOL_VERSION }), env, fetcher)
  assert.equal(readiness.status, 200)
  const advance = await runE2R2Benchmark(request('/api/experiments/e2-9/r2/benchmark/advance', TOKEN, { runLabel: 'r2-worker-test', nextStage: 'SMOKE_OPEN' }), env, fetcher)
  assert.equal(advance.status, 200)
  const content = '本周五图书馆闭馆维护，请同学们知悉。'
  const sourceHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content)))].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const canonicalInput = '{"content":"本周五图书馆闭馆维护，请同学们知悉。","referenceTime":"2026-08-13T09:00:00+08:00","sourceTitle":"闭馆通知","sourceType":"text","timezone":"Asia/Shanghai"}'
  const inputHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalInput)))].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const state = ledger.instances.get('r2-worker-test').state.storage.values.get('run')
  state.expectedObservations['info-flash'].inputSha256 = inputHash
  await ledger.instances.get('r2-worker-test').state.storage.put('run', state)
  const body = { runLabel: 'r2-worker-test', observationId: 'info-flash', phase: 'smoke', modelAlias: 'flash', semanticRole: 'information_only', sourceType: 'text', sourceTitle: '闭馆通知', content, referenceTime: '2026-08-13T09:00:00+08:00', timezone: 'Asia/Shanghai', sourceSha256: sourceHash, inputSha256: inputHash, phaseManifestSha256: HASH, protocolVersion: E2_R2_PROTOCOL_VERSION }
  const first = await runE2R2Benchmark(request('/api/experiments/e2-9/r2/benchmark/generate', TOKEN, body), env, fetcher)
  assert.equal(first.status, 200)
  const payload = await first.json()
  assert.equal(payload.semanticRole, 'information_only')
  assert.equal(payload.result.modelName, 'deepseek-v4-flash')
  assert.equal(payload.execution.executionModel, 'deepseek-v4-flash')
  const callsAfterFirst = upstreamCalls
  const duplicate = await runE2R2Benchmark(request('/api/experiments/e2-9/r2/benchmark/generate', TOKEN, body), env, fetcher)
  assert.equal(duplicate.status, 409)
  assert.equal(upstreamCalls, callsAfterFirst)
})
