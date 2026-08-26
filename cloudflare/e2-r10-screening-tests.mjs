import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  E2_R10_SCREENING_BASE_ORIGIN,
  E2_R10_SCREENING_OBSERVATION_PLAN,
  E2_R10_SCREENING_PROTOCOL_VERSION,
  E2_R10_SCREENING_RUN_LABEL,
  canonicalJson,
  exactVersionedPreviewOrigin,
  sha256Text,
} from './e2-r10-screening-contract.mjs'
import screeningLedgerWorker, { E2R10ScreeningLedger } from './e2-r10-screening-ledger.mjs'
import { runE2R10ScreeningWorker } from './e2-r10-screening-worker.mjs'

const TOKEN = 'screening-test-token-that-never-leaves-process-memory'
const LEDGER_TOKEN = 'ledger-test-token-that-never-leaves-process-memory'
const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const BASE_ORIGIN = E2_R10_SCREENING_BASE_ORIGIN
const VERSIONED_ORIGIN = 'https://11111111-sa-e2-r10-screening-preview.nightsdell.workers.dev'
const PROTOCOL_HASH = 'a'.repeat(64)
const MANIFEST_HASH = 'b'.repeat(64)

function inMemoryStorage() {
  const values = new Map()
  return {
    async get(key) { return structuredClone(values.get(key)) },
    async put(key, value) { values.set(key, structuredClone(value)) },
  }
}

async function harnessEnvironment() {
  const ledgerEnvironment = {
    E2_R10_SCREENING_LEDGER_CALLER_TOKEN_SHA256: await sha256Text(LEDGER_TOKEN),
  }
  const ledger = new E2R10ScreeningLedger({ storage: inMemoryStorage() })
  ledgerEnvironment.E2_R10_SCREENING_LEDGER = {
    idFromName: (name) => name,
    get: () => ({ fetch: (request) => ledger.fetch(request) }),
  }
  return {
    E2_R10_SCREENING_ENABLED: 'true',
    E2_R10_SCREENING_PREVIEW_ORIGIN: BASE_ORIGIN,
    E2_R10_SCREENING_TOKEN_SHA256: await sha256Text(TOKEN),
    E2_R10_SCREENING_LEDGER_CALLER_TOKEN: LEDGER_TOKEN,
    E2_R10_SCREENING_PROTOCOL_BUNDLE_SHA256: PROTOCOL_HASH,
    E2_R10_SCREENING_CASE_MANIFEST_SHA256: MANIFEST_HASH,
    E2_R10_SCREENING_READINESS_REVIEW_SHA256: 'c'.repeat(64),
    DEEPSEEK_API_KEY: 'server-only-test-key-for-e2-r10',
    CF_VERSION_METADATA: { id: VERSION_ID },
    E2_R10_SCREENING_LEDGER: { fetch: (request) => screeningLedgerWorker.fetch(request, ledgerEnvironment) },
  }
}

function request(suffix, { method = 'GET', body, origin = VERSIONED_ORIGIN } = {}) {
  return new Request(`${VERSIONED_ORIGIN}/api/experiments/e2-9/r10/screening/${suffix}`, {
    method,
    headers: {
      origin,
      authorization: `Bearer ${TOKEN}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

const SOURCE_INPUTS = JSON.parse(readFileSync(new URL('../docs/e2-v4-pro-benchmark-r10/screening-protocol-1.1.0/source-input-manifest.json', import.meta.url), 'utf8'))
const SOURCE_BY_ID = new Map(SOURCE_INPUTS.cases.map((item) => [item.caseId, item]))

function registration() {
  const observations = E2_R10_SCREENING_OBSERVATION_PLAN.map((item) => ({ ...item }))
  return {
    protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
    protocolBundleSha256: PROTOCOL_HASH,
    runLabel: E2_R10_SCREENING_RUN_LABEL,
    caseManifestSha256: MANIFEST_HASH,
    observations,
  }
}

function minimalRecognitionOutput() {
  return {
    schemaVersion: '2.0',
    createdAt: '2026-08-24T00:00:00.000Z',
    sourceSummary: { title: '通知', sourceType: 'link', notificationType: 'material_submission', summary: '填写实验伦理确认单', requiresAction: true, actionReason: '原文要求填写' },
    projectMatch: { decision: 'standalone_task', matchedProjectId: null, suggestedProjectTitle: null, confidence: 0.9, reasons: [] },
    projectSuggestion: null,
    milestones: [],
    standaloneTasks: [{ tempId: 'task-1', title: '填写实验伦理确认单', actionVerb: '填写', actionObject: '实验伦理确认单', evidenceIds: ['ev-1'], inferenceLevel: 'explicit' }],
    materials: [], timePoints: [], events: [], conflicts: [], ambiguities: [], ignoredContent: [],
    evidence: [{ id: 'ev-1', quotedText: '填写实验伦理确认单', field: 'description', confidence: 0.9 }],
    quality: {},
  }
}

function factLedgerOutput() {
  return {
    schemaVersion: 'e2.5-fact-ledger-1.0.0',
    obligations: [{
      id: 'ob-1', actor: null, modality: 'required', actionPredicate: '填写', object: '实验伦理确认单',
      materialIds: [], timeExpressionIds: [], eventIds: [], conditionIds: [], constraintIds: [], evidenceIds: ['ev-1'],
    }],
    materials: [], timeExpressions: [], events: [], conditions: [], constraints: [], ambiguities: [],
    evidence: [{ id: 'ev-1', quote: '填写实验伦理确认单', start: 5, end: 14 }],
  }
}

function upstream(content, { status = 200 } = {}) {
  if (status !== 200) return new Response(JSON.stringify({ error: 'failure' }), { status })
  return Response.json({
    model: 'deepseek-v4-flash',
    system_fingerprint: 'screening-test-fingerprint',
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  }, { headers: { 'request-id': 'test-request-id' } })
}

async function observationBody(arm, index = 0) {
  const plan = E2_R10_SCREENING_OBSERVATION_PLAN.filter((item) => item.caseId === E2_R10_SCREENING_OBSERVATION_PLAN[index * 2].caseId)
    .find((item) => item.arm === arm)
  const fixture = SOURCE_BY_ID.get(plan.caseId)
  const input = { sourceType: fixture.sourceType, sourceTitle: fixture.sourceTitle, content: fixture.content, referenceTime: fixture.referenceTime, timezone: fixture.timezone }
  return {
    protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
    protocolBundleSha256: PROTOCOL_HASH,
    runLabel: E2_R10_SCREENING_RUN_LABEL,
    observationId: plan.observationId,
    observationIndex: plan.observationIndex,
    caseId: plan.caseId,
    arm: plan.arm,
    ...input,
    sourceSha256: await sha256Text(fixture.content),
    inputSha256: await sha256Text(canonicalJson(input)),
    caseManifestSha256: MANIFEST_HASH,
  }
}

test('R10 Screening contract is versioned Preview-only and makes zero model calls', async () => {
  const env = await harnessEnvironment()
  let calls = 0
  const response = await runE2R10ScreeningWorker(request('contract'), env, async () => { calls += 1 })
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.previewOnly, true)
  assert.equal(payload.modelCalls, 0)
  assert.equal(payload.observationCount, 16)
  assert.equal(payload.arms.A.modelCalls, 1)
  assert.equal(payload.arms.B.modelCalls, 1)
  assert.equal(calls, 0)
})

test('R10 Screening rejects stable origin, wrong origin, missing auth and later phases without a model call', async () => {
  const env = await harnessEnvironment()
  let calls = 0
  const fetcher = async () => { calls += 1 }
  assert.equal((await runE2R10ScreeningWorker(new Request(`${BASE_ORIGIN}/api/experiments/e2-9/r10/screening/contract`, { headers: { origin: BASE_ORIGIN, authorization: `Bearer ${TOKEN}` } }), env, fetcher)).status, 404)
  assert.equal((await runE2R10ScreeningWorker(request('contract', { origin: 'https://wrong.example' }), env, fetcher)).status, 403)
  assert.equal((await runE2R10ScreeningWorker(new Request(`${VERSIONED_ORIGIN}/api/experiments/e2-9/r10/screening/contract`, { headers: { origin: VERSIONED_ORIGIN } }), env, fetcher)).status, 401)
  assert.equal((await runE2R10ScreeningWorker(request('selection'), env, fetcher)).status, 412)
  assert.equal((await runE2R10ScreeningWorker(request('blind'), env, fetcher)).status, 412)
  assert.equal((await runE2R10ScreeningWorker(request('production'), env, fetcher)).status, 412)
  const missingReview = { ...env }
  delete missingReview.E2_R10_SCREENING_READINESS_REVIEW_SHA256
  assert.equal((await runE2R10ScreeningWorker(request('contract'), missingReview, fetcher)).status, 503)
  assert.equal(calls, 0)
})

test('R10 registration is create-once and idempotent only for byte-identical plans', async () => {
  const env = await harnessEnvironment()
  const body = registration()
  const created = await runE2R10ScreeningWorker(request('register', { method: 'POST', body }), env)
  assert.equal(created.status, 201)
  const replay = await runE2R10ScreeningWorker(request('register', { method: 'POST', body }), env)
  assert.equal(replay.status, 200)
  assert.equal(replay.headers.get('x-idempotent-replay'), 'true')
  const changed = structuredClone(body)
  changed.observations[0].caseId = 'different-case'
  const conflict = await runE2R10ScreeningWorker(request('register', { method: 'POST', body: changed }), env)
  assert.equal(conflict.status, 412)
})

test('R10 generation firewall rejects Expected-like fields before reservation or model access', async () => {
  const env = await harnessEnvironment()
  const body = { ...(await observationBody('A')), expected: { tasks: [] } }
  let calls = 0
  const response = await runE2R10ScreeningWorker(request('generate', { method: 'POST', body }), env, async () => { calls += 1 })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error, 'GENERATION_FIREWALL_REJECTED')
  assert.equal(calls, 0)
})

test('R10 generation cannot consume semantic-role or dataset labels', async () => {
  const env = await harnessEnvironment()
  const clean = await observationBody('A')
  let calls = 0
  for (const extra of [{ semanticRole: 'information_only' }, { sourceSet: 'development' }]) {
    const response = await runE2R10ScreeningWorker(request('generate', { method: 'POST', body: { ...clean, ...extra } }), env, async () => { calls += 1 })
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error, 'GENERATION_FIREWALL_REJECTED')
  }
  assert.equal(calls, 0)
})

test('R10 endpoint binding rejects lookalike hosts before any Bearer request can be made', () => {
  assert.equal(exactVersionedPreviewOrigin(VERSIONED_ORIGIN, VERSION_ID), VERSIONED_ORIGIN)
  assert.throws(() => exactVersionedPreviewOrigin('https://11111111-evil.example', VERSION_ID), /EXACT_VERSIONED_PREVIEW_REQUIRED/u)
  assert.throws(() => exactVersionedPreviewOrigin('http://11111111-sa-e2-r10-screening-preview.nightsdell.workers.dev', VERSION_ID), /EXACT_VERSIONED_PREVIEW_REQUIRED/u)
})

test('R10 server enforces the frozen pair hashes and strict observation order', async () => {
  const env = await harnessEnvironment()
  const changed = registration()
  changed.observations[1].inputSha256 = 'd'.repeat(64)
  assert.equal((await runE2R10ScreeningWorker(request('register', { method: 'POST', body: changed }), env)).status, 412)

  const fresh = await harnessEnvironment()
  assert.equal((await runE2R10ScreeningWorker(request('register', { method: 'POST', body: registration() }), fresh)).status, 201)
  let calls = 0
  const second = await observationBody('B')
  const response = await runE2R10ScreeningWorker(request('generate', { method: 'POST', body: second }), fresh, async () => { calls += 1 })
  assert.equal(response.status, 412)
  assert.equal((await response.json()).error, 'OBSERVATION_SEQUENCE_VIOLATION')
  assert.equal(calls, 0)
})

test('R10 executes paired A and B with the same one-call model parameters and injects four-way model identity', async () => {
  const env = await harnessEnvironment()
  const bodyA = await observationBody('A')
  const bodyB = await observationBody('B')
  const registered = registration()
  assert.equal((await runE2R10ScreeningWorker(request('register', { method: 'POST', body: registered }), env)).status, 201)
  const requests = []
  const fetcher = async (_url, options) => {
    const upstreamBody = JSON.parse(options.body)
    requests.push(upstreamBody)
    return upstream(upstreamBody.messages[0].content.includes('事实提取器') ? factLedgerOutput() : minimalRecognitionOutput())
  }
  const responseA = await runE2R10ScreeningWorker(request('generate', { method: 'POST', body: bodyA }), env, fetcher)
  const responseB = await runE2R10ScreeningWorker(request('generate', { method: 'POST', body: bodyB }), env, fetcher)
  assert.equal(responseA.status, 200, await responseA.clone().text())
  assert.equal(responseB.status, 200, await responseB.clone().text())
  const payloadA = await responseA.json()
  const payloadB = await responseB.json()
  assert.equal(requests.length, 2)
  assert.deepEqual(requests.map(({ model, temperature, max_tokens, thinking, response_format }) => ({ model, temperature, max_tokens, thinking, response_format })), [
    { model: 'deepseek-v4-flash', temperature: 0, max_tokens: 6000, thinking: { type: 'disabled' }, response_format: { type: 'json_object' } },
    { model: 'deepseek-v4-flash', temperature: 0, max_tokens: 6000, thinking: { type: 'disabled' }, response_format: { type: 'json_object' } },
  ])
  for (const payload of [payloadA, payloadB]) {
    assert.deepEqual([
      payload.execution.requestedModel,
      payload.execution.returnedModel,
      payload.execution.executionModel,
      payload.result.modelName,
    ], Array(4).fill('deepseek-v4-flash'))
    assert.equal(payload.modelCalls, 1)
    assert.equal(payload.execution.attempts.length, 1)
  }
  assert.equal(payloadA.ledger, null)
  assert.equal(payloadB.ledger.schemaVersion, 'e2.5-fact-ledger-1.0.0')
  assert.equal(payloadB.result.standaloneTasks[0].title, '填写实验伦理确认单')
  assert.equal(payloadB.validation.status, 'NO_ISSUE')
  const duplicate = await runE2R10ScreeningWorker(request('generate', { method: 'POST', body: bodyB }), env, fetcher)
  assert.equal(duplicate.status, 409)
  assert.equal(requests.length, 2)
})

test('R10 failed observation is terminal and cannot be overwritten by a later successful retry', async () => {
  const env = await harnessEnvironment()
  const bodyA = await observationBody('A')
  const registered = registration()
  assert.equal((await runE2R10ScreeningWorker(request('register', { method: 'POST', body: registered }), env)).status, 201)
  let calls = 0
  const failed = await runE2R10ScreeningWorker(request('generate', { method: 'POST', body: bodyA }), env, async () => {
    calls += 1
    return upstream(null, { status: 502 })
  })
  assert.equal(failed.status, 502)
  const retry = await runE2R10ScreeningWorker(request('generate', { method: 'POST', body: bodyA }), env, async () => {
    calls += 1
    return upstream(minimalRecognitionOutput())
  })
  assert.equal(retry.status, 409)
  assert.equal(calls, 1)
  const state = await (await runE2R10ScreeningWorker(request('state'), env)).json()
  assert.equal(state.runStatus, 'FAILED')
  assert.equal(state.observations[bodyA.observationId].status, 'model_failure')
  const bodyB = await observationBody('B')
  const blocked = await runE2R10ScreeningWorker(request('generate', { method: 'POST', body: bodyB }), env, async () => {
    calls += 1
    return upstream(factLedgerOutput())
  })
  assert.equal(blocked.status, 412)
  assert.equal((await blocked.json()).error, 'RUN_TERMINAL_FAILURE')
  assert.equal(calls, 1)
})
