import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { buildR8FactGraphFromCachedRaw } from './e2-r8-cache-fact-adapter.mjs'
import { planR8RecognitionResult } from './e2-r8-isolated-planner.mjs'
import { R8_ENTITY_AUTHORITY, R8_ENTITY_CONTRACT_VERSIONS } from './e2-r8-planner-contracts.mjs'
import { normalizeR8FactGraphReferences, R8_NORMALIZER_PERMISSIONS } from './e2-r8-restricted-normalizer.mjs'
import { aggregateR8ContractCoverage, evaluateR8ContractCoverage } from './e2-r8-contract-replay-metrics.mjs'

function rawRecognition({ text, requiresAction = true, tasks = [], timePoints = [], events = [], materials = [], ambiguities = [] }) {
  return {
    schemaVersion: '2.0', createdAt: '2026-08-21T00:00:00.000Z',
    sourceSummary: { title: '匿名通知', sourceType: 'text', notificationType: requiresAction ? 'event_notice' : 'information_only', summary: text, requiresAction, actionReason: requiresAction ? '原文明示用户行动' : '仅供知悉' },
    projectMatch: { decision: requiresAction ? 'standalone_task' : 'uncertain', matchedProjectId: null, suggestedProjectTitle: null, confidence: 0.8, reasons: [] },
    projectSuggestion: null, milestones: [], standaloneTasks: tasks, materials, timePoints, events,
    evidence: [{ id: 'ev-1', quotedText: text, field: 'requirement', confidence: 1 }],
    conflicts: [], ambiguities, ignoredContent: [], quality: {},
  }
}

function build(raw, text) {
  return buildR8FactGraphFromCachedRaw({ raw, sourceText: text, referenceTime: '2026-08-21T00:00:00+08:00', timezone: 'Asia/Shanghai' })
}

test('R8 restricted normalizer can only repair references and cannot mutate semantics', () => {
  const text = '9月10日前提交报名表。'
  const raw = rawRecognition({
    text,
    tasks: [{ tempId: 'task-1', actionVerb: '提交', actionObject: '报名表', title: '提交报名表', evidenceIds: ['ev-1'], materialTempIds: [], timePointTempIds: ['time-1'] }],
    timePoints: [{ tempId: 'time-1', type: 'submission_deadline', rawText: '9月10日前', normalizedValue: '2026-09-10', precision: 'date_only', needsConfirmation: false, relatedTaskTempIds: [], relatedMaterialTempIds: [], evidenceIds: ['ev-1'] }],
  })
  const graph = build(raw, text)
  const normalized = normalizeR8FactGraphReferences(graph)
  assert.equal(normalized.obligations[0].actionPredicate, '提交')
  assert.equal(normalized.obligations[0].object, '报名表')
  assert.deepEqual(normalized.timePoints[0].relatedObligationIds, [normalized.obligations[0].id])
  assert.equal(R8_NORMALIZER_PERMISSIONS.mayChangeActionPredicateOrObject, false)
  assert.equal(R8_NORMALIZER_PERMISSIONS.mayAddOrDeleteFacts, false)
  assert.deepEqual(Object.keys(R8_ENTITY_CONTRACT_VERSIONS), ['Fact', 'Task', 'Event', 'Material', 'TimePoint', 'Condition', 'Ambiguity'])
  assert.equal(R8_ENTITY_AUTHORITY.Task, 'planner')
  assert.equal(R8_ENTITY_AUTHORITY.TimePoint, 'extractor')
})

test('R8 preserves event and time facts for pure information without inventing a task', () => {
  const text = '仅供知悉：9月3日1:00至4:00检索系统维护。'
  const raw = rawRecognition({
    text, requiresAction: false,
    timePoints: [{ tempId: 'time-1', type: 'event_start', rawText: '9月3日1:00', normalizedValue: '2026-09-03T01:00:00+08:00', precision: 'exact', needsConfirmation: false, relatedTaskTempIds: [], relatedMaterialTempIds: [], evidenceIds: ['ev-1'] }],
    events: [{ tempId: 'event-1', title: '检索系统维护', startTimePointTempId: 'time-1', endTimePointTempId: null, evidenceIds: ['ev-1'], inferenceLevel: 'explicit' }],
  })
  const result = planR8RecognitionResult(normalizeR8FactGraphReferences(build(raw, text)))
  assert.equal(result.standaloneTasks.length, 0)
  assert.equal(result.events.length, 1)
  assert.equal(result.timePoints.length, 1)
})

test('R8 keeps a model-discovered required event Task instead of deleting it for verb mismatch', () => {
  const text = '各团队9月16日傍晚走台。'
  const raw = rawRecognition({
    text,
    tasks: [{ tempId: 'task-1', actionVerb: '参加', actionObject: '走台', title: '参加走台', evidenceIds: ['ev-1'], materialTempIds: [], timePointTempIds: ['time-1'] }],
    timePoints: [{ tempId: 'time-1', type: 'event_start', rawText: '9月16日傍晚', normalizedValue: '2026-09-16T18:00:00+08:00', precision: 'vague', needsConfirmation: false, relatedTaskTempIds: ['task-1'], relatedMaterialTempIds: [], evidenceIds: ['ev-1'] }],
    events: [{ tempId: 'event-1', title: '走台', startTimePointTempId: 'time-1', endTimePointTempId: null, evidenceIds: ['ev-1'], inferenceLevel: 'explicit' }],
  })
  const result = planR8RecognitionResult(normalizeR8FactGraphReferences(build(raw, text)))
  assert.equal(result.standaloneTasks[0].actionVerb, '参加')
  assert.equal(result.timePoints[0].normalizedValue, null)
  assert.equal(result.timePoints[0].needsConfirmation, true)
})

test('R8 adds a missing literal source action without case-specific text rules', () => {
  const text = '负责人先汇总经费表。'
  const raw = rawRecognition({ text, tasks: [] })
  const graph = build(raw, text)
  assert.equal(graph.obligations.length, 1)
  assert.equal(graph.obligations[0].actionPredicate, '汇总')
  assert.equal(graph.obligations[0].object, '经费表')
  assert.equal(graph.obligations[0].provenance, 'literal_source_action')
})

test('R8 freezes eligibility as Condition and exposes missing applicability as Ambiguity', () => {
  const text = '仅已录用志愿者执行。'
  const raw = rawRecognition({ text, tasks: [] })
  const graph = build(raw, text)
  assert.equal(graph.conditions.length, 1)
  assert.equal(graph.conditions[0].kind, 'eligibility')
  assert.equal(graph.ambiguities.some((item) => item.code === 'CONDITION_APPLICABILITY_UNKNOWN'), true)
})

test('R8 repair remains isolated from the Production Worker and recognition normalizer', async () => {
  const [worker, recognition] = await Promise.all([
    readFile(new URL('./worker.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./recognition.mjs', import.meta.url), 'utf8'),
  ])
  assert.doesNotMatch(worker, /e2-r8/u)
  assert.doesNotMatch(recognition, /e2-r8/u)
})

test('R8 replay metrics separate fact preservation from frozen Expected scoring', () => {
  const text = '仅供知悉：9月3日1:00检索系统维护。'
  const raw = rawRecognition({
    text, requiresAction: false,
    timePoints: [{ tempId: 'time-1', type: 'event_start', rawText: '9月3日1:00', normalizedValue: '2026-09-03T01:00:00+08:00', precision: 'exact', needsConfirmation: false, relatedTaskTempIds: [], relatedMaterialTempIds: [], evidenceIds: ['ev-1'] }],
    events: [{ tempId: 'event-1', title: '检索系统维护', startTimePointTempId: 'time-1', endTimePointTempId: null, evidenceIds: ['ev-1'], inferenceLevel: 'explicit' }],
  })
  const graph = normalizeR8FactGraphReferences(build(raw, text))
  const oldResult = { ...raw, timePoints: [], events: [] }
  const newResult = planR8RecognitionResult(graph)
  const oldCoverage = evaluateR8ContractCoverage(oldResult, graph)
  const newCoverage = evaluateR8ContractCoverage(newResult, graph)
  assert.equal(oldCoverage.counts.factLosses, 2)
  assert.equal(newCoverage.counts.factLosses, 0)
  assert.equal(newCoverage.counts.plannedTasks, 0)
  assert.equal(newCoverage.counts.unsupportedTasks, 0)
  assert.equal(aggregateR8ContractCoverage([newCoverage]).rates.factCoverage, 1)
})

test('R8 replay metrics reject unsupported tasks and vague false precision', () => {
  const text = '9月16日傍晚走台。'
  const raw = rawRecognition({
    text,
    tasks: [{ tempId: 'task-1', actionVerb: '参加', actionObject: '走台', title: '参加走台', evidenceIds: ['ev-1'], materialTempIds: [], timePointTempIds: ['time-1'] }],
    timePoints: [{ tempId: 'time-1', type: 'event_start', rawText: '9月16日傍晚', normalizedValue: null, precision: 'vague', needsConfirmation: true, relatedTaskTempIds: ['task-1'], relatedMaterialTempIds: [], evidenceIds: ['ev-1'] }],
    events: [{ tempId: 'event-1', title: '走台', startTimePointTempId: 'time-1', endTimePointTempId: null, evidenceIds: ['ev-1'], inferenceLevel: 'explicit' }],
  })
  const graph = normalizeR8FactGraphReferences(build(raw, text))
  const result = planR8RecognitionResult(graph)
  result.standaloneTasks.push({ tempId: 'invented', actionVerb: '缴费', actionObject: '报名费', title: '缴费报名费' })
  result.timePoints[0].normalizedValue = '2026-09-16T18:00:00+08:00'
  result.timePoints[0].needsConfirmation = false
  const coverage = evaluateR8ContractCoverage(result, graph)
  assert.equal(coverage.counts.unsupportedTasks, 1)
  assert.equal(coverage.counts.falsePrecisionTimes, 1)
})
