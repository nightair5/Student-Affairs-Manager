import assert from 'node:assert/strict'
import test from 'node:test'
import { runE2R7Benchmark } from './e2-r7-benchmark.mjs'
import worker from './e2-r7-preview-worker.mjs'
import {
  E2_V4_PRO_BENCHMARK_PIPELINE_VERSION,
  E2_V4_PRO_BENCHMARK_PLANNER_VERSION,
  E2_V4_PRO_BENCHMARK_PROMPT_VERSION,
  benchmarkPlannerSystemPrompt,
  normalizeBenchmarkRecognitionResult,
  validateBenchmarkPlannerContract,
} from './e2-v4-pro-benchmark-planner.mjs'

const ORIGIN = 'https://student-affairs-manager-r7-preview.example'
const TOKEN = 'r'.repeat(40)

function environment(overrides = {}) {
  return {
    DEEPSEEK_API_KEY: 'server-only-test-key-with-length',
    E2_V4_PRO_BENCHMARK_ENABLED: 'true',
    E2_V4_PRO_BENCHMARK_TOKEN: TOKEN,
    ...overrides,
  }
}

function request(body, hostname = ORIGIN) {
  return new Request(`${hostname}/api/experiments/e2-9/v4-pro-benchmark/generate`, {
    method: 'POST',
    headers: { origin: hostname, authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function recognitionOutput() {
  return {
    schemaVersion: '2.0', createdAt: '2026-08-21T00:00:00.000Z',
    sourceSummary: { title: '通知', sourceType: 'text', notificationType: 'material_submission', summary: '回复是否参加', requiresAction: true, actionReason: '原文要求回复' },
    projectMatch: { decision: 'standalone_task', matchedProjectId: null, suggestedProjectTitle: null, confidence: 0.9, reasons: [] },
    projectSuggestion: null, milestones: [],
    standaloneTasks: [{ tempId: 'task-1', title: '回复是否参加', actionVerb: '回复', actionObject: '是否参加', materialTempIds: [], timePointTempIds: [], evidenceIds: ['ev-1'], inferenceLevel: 'explicit' }],
    materials: [{ tempId: 'material-1', name: '回执', relatedTaskTempIds: ['task-1'], evidenceIds: ['ev-1'] }],
    timePoints: [{ tempId: 'time-1', type: 'task_deadline', rawText: '明日前', normalizedValue: null, precision: 'relative', relatedTaskTempIds: ['task-1'], relatedMaterialTempIds: [], evidenceIds: ['ev-1'] }],
    events: [], conflicts: [], ambiguities: [], ignoredContent: [],
    evidence: [{ id: 'ev-1', quotedText: '请回复是否参加并填写回执', field: 'requirement', confidence: 0.9 }], quality: {},
  }
}

test('R7 prompt replaces the contradictory event-only rule without changing Production', () => {
  const prompt = benchmarkPlannerSystemPrompt()
  assert.match(prompt, /Event 记录日程事实，Task 记录用户必须完成的行动/u)
  assert.doesNotMatch(prompt, /参加会议\/答辩\/培训只建立 Event/u)
})

test('R7 normalizer preserves evidence-bound predicate and closes existing relations', () => {
  const result = normalizeBenchmarkRecognitionResult(recognitionOutput(), '请回复是否参加并填写回执，明日前', '2026-08-21T00:00:00.000Z')
  assert.equal(result.standaloneTasks[0].actionVerb, '回复')
  assert.equal(result.standaloneTasks[0].title, '回复是否参加')
  assert.deepEqual(result.standaloneTasks[0].materialTempIds, ['material-1'])
  assert.deepEqual(result.standaloneTasks[0].timePointTempIds, ['time-1'])
  assert.deepEqual(result.timePoints[0].relatedMaterialTempIds, ['material-1'])
  assert.deepEqual(validateBenchmarkPlannerContract(result, '请回复是否参加并填写回执，明日前'), [])
})

test('R7 planner validator reports an action-required Event without a Task', () => {
  const raw = recognitionOutput()
  raw.standaloneTasks = []
  raw.materials = []
  raw.timePoints = []
  raw.events = [{ tempId: 'event-1', title: '培训', evidenceIds: ['ev-1'], inferenceLevel: 'explicit' }]
  raw.evidence[0].quotedText = '请参加培训'
  const result = normalizeBenchmarkRecognitionResult(raw, '请参加培训', '2026-08-21T00:00:00.000Z')
  assert.deepEqual(validateBenchmarkPlannerContract(result, '请参加培训'), ['MISSING_REQUIRED_EVENT_TASK'])
})

test('R7 dedicated endpoint injects actual prompt and authoritative lineage', async () => {
  let upstreamBody
  const fetcher = async (_url, options) => {
    upstreamBody = JSON.parse(options.body)
    return Response.json({
      model: upstreamBody.model, system_fingerprint: `fp-${upstreamBody.model}`,
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(recognitionOutput()) } }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    })
  }
  const body = { modelAlias: 'pro', semanticRole: 'action_required', sourceType: 'text', sourceTitle: '通知', content: '请回复是否参加并填写回执，明日前', referenceTime: '2026-08-21T00:00:00.000Z', timezone: 'Asia/Shanghai' }
  const response = await runE2R7Benchmark(request(body), environment(), fetcher)
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.benchmarkVersion, 'e2-v4-pro-benchmark-2.2.0')
  assert.equal(payload.execution.promptVersion, E2_V4_PRO_BENCHMARK_PROMPT_VERSION)
  assert.equal(payload.execution.pipelineVersion, E2_V4_PRO_BENCHMARK_PIPELINE_VERSION)
  assert.equal(payload.execution.plannerVersion, E2_V4_PRO_BENCHMARK_PLANNER_VERSION)
  assert.deepEqual([payload.execution.requestedModel, payload.execution.returnedModel, payload.execution.executionModel, payload.result.modelName], Array(4).fill('deepseek-v4-pro'))
  assert.deepEqual(payload.validation.benchmarkPlannerIssues, [])
  assert.equal(upstreamBody.messages[0].content, benchmarkPlannerSystemPrompt())
})

test('R7 dedicated endpoint remains Preview-only and disabled by default', async () => {
  const body = { modelAlias: 'flash', semanticRole: 'action_required', sourceType: 'text', sourceTitle: '通知', content: '请提交材料', referenceTime: '2026-08-21T00:00:00.000Z', timezone: 'Asia/Shanghai' }
  assert.equal((await runE2R7Benchmark(request(body, 'https://student-affairs.site'), environment(), async () => { throw new Error('not called') })).status, 404)
  assert.equal((await runE2R7Benchmark(request(body), environment({ E2_V4_PRO_BENCHMARK_ENABLED: 'false' }), async () => { throw new Error('not called') })).status, 404)
})

test('R7 readiness response is bound to benchmark 2.2.0 without changing the probe', async () => {
  let upstreamBody
  const fetcher = async (_url, options) => {
    upstreamBody = JSON.parse(options.body)
    return Response.json({
      model: upstreamBody.model, system_fingerprint: 'fp-ready',
      choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
    })
  }
  const ready = new Request(`${ORIGIN}/api/experiments/e2-9/v4-pro-benchmark/readiness?modelAlias=flash`, {
    headers: { origin: ORIGIN, authorization: `Bearer ${TOKEN}` },
  })
  const response = await runE2R7Benchmark(ready, environment(), fetcher)
  const payload = await response.json()
  assert.equal(payload.benchmarkVersion, 'e2-v4-pro-benchmark-2.2.0')
  assert.equal(payload.returnedModel, 'deepseek-v4-flash')
  assert.equal(upstreamBody.messages[1].content, 'Return {"ok":true}.')
})

test('R7 zero-model contract binds three-stage activation to the exact Worker version', async () => {
  const deploymentVersion = '12345678-1234-1234-1234-123456789abc'
  const contractRequest = new Request(`${ORIGIN}/api/experiments/e2-9/v4-pro-benchmark/contract`, {
    headers: { origin: ORIGIN, authorization: `Bearer ${TOKEN}` },
  })
  const response = await worker.fetch(contractRequest, environment({ CF_VERSION_METADATA: { id: deploymentVersion } }))
  const payload = await response.json()
  assert.equal(payload.protocolVersion, 'e2-9-v4-pro-protocol-3.6.1')
  assert.equal(payload.deploymentVersion, deploymentVersion)
  assert.equal(payload.modelCalls, 0)
  assert.equal((await worker.fetch(contractRequest, environment({ E2_V4_PRO_BENCHMARK_ENABLED: 'false', CF_VERSION_METADATA: { id: deploymentVersion } }))).status, 404)
})
