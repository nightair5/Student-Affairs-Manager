import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aggregateArm,
  classifyHttpFailure,
  pairedBootstrap,
  scoreCase,
  summarizeEvaluation,
} from './multimodal-evaluation-lib.mjs'
import { loadClientRecognitionValidator } from './load-client-recognition-validator.mjs'
import { validateRecognitionResult as validateWorkerRecognitionResult } from '../cloudflare/recognition-contract.generated.mjs'

// Kept outside Vitest's *.test.* glob; this file uses node:test directly.

const fixture = {
  id: 'case-1', scenarioFamilyId: 'scenario-1', modality: 'screenshot',
  sourceText: '9月5日18:00前提交报名表', ocrText: '9月5日18:00前提交报名表',
  expected: {
    tasks: [{ verbs: ['提交'], objectTokens: ['报名表'] }],
    materials: [{ tokens: ['报名表'] }],
    timePoints: [{ type: 'submission_deadline', normalizedValue: '2026-09-05T18:00:00+08:00' }],
    events: [], forbiddenTaskTokens: ['转账'], requiresAction: true,
  },
}

const result = {
  sourceSummary: { requiresAction: true }, milestones: [],
  standaloneTasks: [{ title: '提交报名表', actionVerb: '提交', actionObject: '报名表', description: '', evidenceIds: ['evidence-1'] }],
  materials: [{ name: '报名表', evidenceIds: ['evidence-1'] }],
  timePoints: [{ type: 'submission_deadline', normalizedValue: '2026-09-05T18:00:00+08:00', evidenceIds: ['evidence-1'] }],
  events: [], evidence: [{ id: 'evidence-1', quotedText: '9月5日18:00前提交报名表' }],
}

function scoreCompleted(inputFixture, arm, inputResult, operational = {}) {
  return scoreCase(inputFixture, arm, inputResult, { ...operational, status: 'completed' })
}

function fullClientResult() {
  return {
    schemaVersion: '2.0', promptVersion: 'test-prompt', modelName: 'test-model', createdAt: '2026-09-02T00:00:00.000Z',
    sourceSummary: { title: '匿名通知', sourceType: 'text', notificationType: 'material_submission', summary: '提交报名表', requiresAction: true, actionReason: '有明确提交要求' },
    projectMatch: { decision: 'standalone_task', matchedProjectId: null, suggestedProjectTitle: null, confidence: 1, reasons: ['独立事项'] },
    projectSuggestion: null, milestones: [],
    standaloneTasks: [{
      tempId: 'task-1', parentTempId: null, hierarchyType: 'task', title: '提交报名表', actionVerb: '提交', actionObject: '报名表', description: '',
      completionCriteria: ['完成提交'], estimatedMinutes: null, statusSuggestion: 'todo', prioritySuggestion: 'medium', dependencyTempIds: [], materialTempIds: ['material-1'],
      timePointTempIds: ['time-1'], evidenceIds: ['evidence-1'], confidence: 1, inferenceLevel: 'explicit', userConfirmationRequired: true, selected: true,
    }],
    materials: [{ tempId: 'material-1', name: '报名表', required: true, formatRequirements: [], namingRequirements: [], quantity: 1, submissionChannel: null, relatedTaskTempIds: ['task-1'], evidenceIds: ['evidence-1'], confidence: 1, selected: true }],
    timePoints: [{ tempId: 'time-1', type: 'submission_deadline', rawText: '9月5日18:00前', normalizedValue: '2026-09-05T10:00:00.000Z', timezone: 'Asia/Shanghai', isAllDay: false, precision: 'exact', needsConfirmation: false, relatedTaskTempIds: ['task-1'], relatedMaterialTempIds: ['material-1'], evidenceIds: ['evidence-1'], confidence: 1, selected: true }],
    events: [], evidence: [{ id: 'evidence-1', sourceId: 'source-1', quote: '9月5日18:00前提交报名表', field: 'description' }],
    conflicts: [], ambiguities: [], ignoredContent: [],
    quality: { overallConfidence: 1, hierarchyConfidence: 1, dateConfidence: 1, evidenceCoverage: 1, duplicateRisk: 0, overFragmentationRisk: 0, missingActionRisk: 0, needsHumanReview: true, reviewReasons: ['用户确认'] },
  }
}

test('scores auditable entity matches without self-normalization', () => {
  const scored = scoreCompleted(fixture, 'T', result, { latencyMs: 100 })
  assert.equal(scored.task.f1, 1)
  assert.equal(scored.completeCase, true)
  assert.equal(scored.correctionOperations, 0)
  const aggregate = aggregateArm('T', [scored])
  assert.equal(aggregate.runStatus, 'VALID_RUN')
  assert.equal(aggregate.task.f1, 1)
  assert.equal(aggregate.completeCaseAccuracy, 1)
  assert.equal(aggregate.evidenceCoverage, 1)
  assert.equal(aggregate.observedUserModificationTimeSeconds, null)
})

test('loads and executes the exact client validator without a duplicate schema', async () => {
  const loaded = await loadClientRecognitionValidator()
  assert.match(loaded.sourceSha256, /^[a-f0-9]{64}$/u)
  assert.equal(loaded.validateRecognitionResult(fullClientResult()).valid, true)
  assert.equal(loaded.validateRecognitionResult({ schemaVersion: '2.0' }).failureCategory, 'schema')
})

test('browser, Worker generated contract, and evaluator agree on strict outcomes', async () => {
  const evaluator = await loadClientRecognitionValidator()
  const candidates = []
  const valid = fullClientResult()
  candidates.push(valid)
  const missing = structuredClone(valid)
  delete missing.sourceSummary.requiresAction
  candidates.push(missing)
  const duplicate = structuredClone(valid)
  duplicate.materials[0].tempId = duplicate.timePoints[0].tempId
  candidates.push(duplicate)
  const dangling = structuredClone(valid)
  dangling.standaloneTasks[0].timePointTempIds = ['missing-time']
  candidates.push(dangling)
  const impossible = structuredClone(valid)
  impossible.timePoints[0].normalizedValue = '2026-02-30T18:00'
  candidates.push(impossible)

  for (const candidate of candidates) {
    assert.deepEqual(
      validateWorkerRecognitionResult(candidate),
      evaluator.validateRecognitionResult(candidate),
    )
  }
})

test('penalizes missing and forbidden tasks as correction burden', () => {
  const bad = structuredClone(result)
  bad.standaloneTasks = [{ title: '向陌生账户转账', actionVerb: '提交', actionObject: '转账', description: '' }]
  const scored = scoreCompleted(fixture, 'I', bad)
  assert.equal(scored.task.misses, 1)
  assert.equal(scored.forbiddenHits.length, 1)
  assert.equal(scored.majorCorrection, true)
  assert.ok(scored.correctionOperations >= 2)
})

test('does not match forbidden tokens that exist only in task description', () => {
  const descriptionOnly = structuredClone(result)
  descriptionOnly.standaloneTasks[0].description = '请勿向陌生账户转账'
  const scored = scoreCompleted(fixture, 'T', descriptionOnly)
  assert.deepEqual(scored.forbiddenHits, [])
})

test('does not score suggestions that client safety marked unselected', () => {
  const unselected = structuredClone(result)
  unselected.standaloneTasks[0].selected = false
  const scored = scoreCompleted(fixture, 'T', unselected)
  assert.equal(scored.task.predicted, 0)
  assert.equal(scored.task.recall, 0)
})

test('excludes unselected materials, time points and events from quality scoring', () => {
  const expandedFixture = structuredClone(fixture)
  expandedFixture.expected.events = [{ titleTokens: ['宣讲会'] }]
  const unselected = structuredClone(result)
  unselected.materials[0].selected = false
  unselected.timePoints[0].selected = false
  unselected.events = [{ title: '宣讲会', description: '', selected: false, evidenceIds: ['evidence-1'] }]
  const scored = scoreCompleted(expandedFixture, 'T', unselected)
  assert.equal(scored.material.predicted, 0)
  assert.equal(scored.timePoint.predicted, 0)
  assert.equal(scored.event.predicted, 0)
})

test('paired bootstrap reports paired deltas rather than dividing by model maxima', () => {
  const baseline = scoreCase(fixture, 'T', null, { status: 'request_failure' })
  const candidate = scoreCompleted(fixture, 'IT', result)
  const comparison = pairedBootstrap({ T: [baseline], IT: [candidate] }, 'IT', 'T', (item) => item.task.f1, 'seed', 100)
  assert.equal(comparison.pairedCount, 0)
  const weaker = scoreCompleted(fixture, 'T', { ...result, standaloneTasks: [] })
  const paired = pairedBootstrap({ T: [weaker], IT: [candidate] }, 'IT', 'T', (item) => item.task.f1, 'seed', 100)
  assert.equal(paired.pairedCount, 1)
  assert.equal(paired.clusterCount, 1)
  assert.equal(paired.delta, 1)
})

test('reports unavailable quality metrics as null when every request failed', () => {
  const failed = scoreCase(fixture, 'T', null, { status: 'request_failure', failureReason: 'network' })
  const aggregate = aggregateArm('T', [failed])
  assert.equal(aggregate.requestFailureRate, 1)
  assert.equal(aggregate.task.f1, null)
  assert.equal(aggregate.completeCaseAccuracy, null)
  assert.equal(aggregate.majorCorrectionRate, null)
  assert.equal(aggregate.qualityMetricsEligible, false)
  assert.equal(aggregate.runStatus, 'INVALID_RUN')
})

test('keeps an untested arm NOT_RUN instead of inventing request failures', () => {
  const aggregate = aggregateArm('IT', [], { tested: false, plannedCount: 0 })
  assert.equal(aggregate.runStatus, 'NOT_RUN')
  assert.equal(aggregate.requestFailureRate, null)
  assert.equal(aggregate.task.f1, null)
})

test('rejects observations attached to an arm declared untested', () => {
  const completed = scoreCompleted(fixture, 'IT', result)
  assert.throws(
    () => aggregateArm('IT', [completed], { tested: false, plannedCount: 0 }),
    /UNTESTED_ARM_HAS_OBSERVATIONS:IT/u,
  )
})

test('does not award vacuous task F1 when both expected and predicted tasks are empty', () => {
  const noActionFixture = structuredClone(fixture)
  noActionFixture.expected.tasks = []
  noActionFixture.expected.materials = []
  noActionFixture.expected.timePoints = []
  noActionFixture.expected.requiresAction = false
  const noActionResult = {
    sourceSummary: { requiresAction: false }, milestones: [], standaloneTasks: [],
    materials: [], timePoints: [], events: [], evidence: [],
  }
  const scored = scoreCompleted(noActionFixture, 'T', noActionResult)
  assert.equal(scored.task.f1, null)
  assert.equal(scored.completeCase, true)
  assert.equal(scored.evidence.validity, null)
})

test('penalizes predicted entities that have no evidence', () => {
  const withoutEvidence = { ...result, evidence: [] }
  const scored = scoreCompleted(fixture, 'IT', withoutEvidence)
  assert.equal(scored.evidence.count, 0)
  assert.equal(scored.evidence.validity, 0)
  assert.equal(aggregateArm('IT', [scored]).evidenceValidity, 0)
  assert.equal(aggregateArm('IT', [scored]).evidenceCoverage, 0)
})

test('reports evidence validity separately from entity coverage', () => {
  const partlyCovered = structuredClone(result)
  partlyCovered.materials[0].evidenceIds = []
  partlyCovered.timePoints[0].evidenceIds = []
  const scored = scoreCompleted(fixture, 'T', partlyCovered)
  assert.equal(scored.evidence.validity, 1)
  assert.equal(scored.evidence.coverage, 1 / 3)
})

test('image-only evidence is checked against offline ground truth rather than OCR text', () => {
  const noisyFixture = { ...fixture, ocrText: 'OCR 丢失截止时间' }
  const scored = scoreCompleted(noisyFixture, 'I', result)
  assert.equal(scored.evidence.validity, 1)
})

test('paired bootstrap resamples independent scenario families as clusters', () => {
  const make = (caseId, scenarioFamilyId, arm, f1) => ({
    caseId, scenarioFamilyId, arm, status: 'completed', task: { f1 }, correctionOperations: 0,
  })
  const groups = {
    T: [make('a-shot', 'a', 'T', 0), make('a-photo', 'a', 'T', 0), make('b-shot', 'b', 'T', 1)],
    IT: [make('a-shot', 'a', 'IT', 1), make('a-photo', 'a', 'IT', 1), make('b-shot', 'b', 'IT', 1)],
  }
  const comparison = pairedBootstrap(groups, 'IT', 'T', (item) => item.task.f1, 'cluster-seed', 500)
  assert.equal(comparison.pairedCount, 3)
  assert.equal(comparison.clusterCount, 2)
  assert.equal(comparison.delta, 2 / 3)
})

test('a partial request failure invalidates arm-level quality metrics', () => {
  const completed = scoreCompleted(fixture, 'T', result)
  const failed = scoreCase({ ...fixture, id: 'case-2' }, 'T', null, { status: 'request_failure' })
  const aggregate = aggregateArm('T', [completed, failed])
  assert.equal(aggregate.requestFailureRate, 0.5)
  assert.equal(aggregate.qualityMetricsEligible, false)
  assert.equal(aggregate.task.f1, null)
})

test('client-invalid truthy results never become completed quality observations', () => {
  const invalid = scoreCase(fixture, 'T', result, {
    status: 'invalid_result', failureCategory: 'reference', failureReason: 'TASK_TIME_POINT_MISSING',
  })
  assert.equal(invalid.status, 'invalid_result')
  assert.equal(invalid.failureCategory, 'reference')
  const aggregate = aggregateArm('T', [invalid])
  assert.equal(aggregate.completedCount, 0)
  assert.equal(aggregate.runStatus, 'INVALID_RUN')
  assert.equal(aggregate.requestFailureRate, 0)
  assert.equal(aggregate.logicalFailureRate, 1)
  assert.equal(aggregate.task.f1, null)
})

test('scoreCase is fail-closed unless the caller explicitly marks a result completed', () => {
  const unvalidated = scoreCase(fixture, 'T', result)
  assert.equal(unvalidated.status, 'invalid_result')
  assert.equal(unvalidated.task.f1, 0)
  assert.equal(aggregateArm('T', [unvalidated]).runStatus, 'INVALID_RUN')
})

test('invalid or untested arms cannot produce paired quality claims', () => {
  const completed = scoreCompleted(fixture, 'I', result)
  const failed = scoreCase(fixture, 'IT', result, { status: 'invalid_result', failureCategory: 'schema' })
  const summary = summarizeEvaluation({ datasetId: 'd', datasetSha256: 'a'.repeat(64), sampleCount: 1 }, [completed, failed], { testedArms: ['I', 'IT'] })
  assert.equal(summary.metricsByArm.T.runStatus, 'NOT_RUN')
  assert.equal(summary.metricsByArm.IT.runStatus, 'INVALID_RUN')
  assert.equal(summary.pairedComparisons.IT_vs_I_taskF1.status, 'INVALID_RUN')
  assert.equal(summary.pairedComparisons.IT_vs_T_taskF1.status, 'NOT_RUN')
})

test('a scoreable comparison is not mislabeled as a promotion PASS', () => {
  const text = scoreCompleted(fixture, 'T', result)
  const combined = scoreCompleted(fixture, 'IT', result)
  const summary = summarizeEvaluation(
    { datasetId: 'd', datasetSha256: 'b'.repeat(64), sampleCount: 1 },
    [text, combined],
    { testedArms: ['T', 'IT'] },
  )
  assert.equal(summary.metricsByArm.T.runStatus, 'VALID_RUN')
  assert.equal(summary.pairedComparisons.IT_vs_T_taskF1.status, 'SCOREABLE')
})

test('classifies HTTP failures without collapsing auth, billing, rate limit, model and request errors', () => {
  assert.equal(classifyHttpFailure(401, 'UPSTREAM_AUTH_FAILED'), 'authentication')
  assert.equal(classifyHttpFailure(402, 'UPSTREAM_BILLING_BLOCKED'), 'billing')
  assert.equal(classifyHttpFailure(429, 'RATE_LIMITED'), 'rate_limit')
  assert.equal(classifyHttpFailure(503, 'UPSTREAM_MODEL_UNAVAILABLE'), 'model')
  assert.equal(classifyHttpFailure(400, 'INVALID_REQUEST'), 'request')
  assert.equal(classifyHttpFailure(502, 'UPSTREAM_FAILURE'), 'transport')
  assert.equal(classifyHttpFailure(401, null), 'authentication')
  assert.equal(classifyHttpFailure(402, null), 'billing')
  assert.equal(classifyHttpFailure(429, null), 'rate_limit')
})
