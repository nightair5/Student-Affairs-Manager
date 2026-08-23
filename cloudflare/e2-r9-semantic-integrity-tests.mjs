import assert from 'node:assert/strict'
import test from 'node:test'
import { buildR8FactGraphFromCachedRaw } from './e2-r8-cache-fact-adapter.mjs'
import { normalizeR8FactGraphReferences } from './e2-r8-restricted-normalizer.mjs'
import { planR9RecognitionResult } from './e2-r9-isolated-planner.mjs'
import { compareR9FactGraphSnapshots, evaluateR9SemanticIntegrity } from './e2-r9-semantic-integrity.mjs'

const source = '请在11月20日17:00前提交登记表，并于11月22日9:00参加说明会。'

function fixture() {
  const raw = {
    schemaVersion: '2.0', promptVersion: 'generic-test', modelName: 'cache-test', createdAt: '2026-08-24T00:00:00.000Z',
    sourceSummary: {
      title: '通用通知', sourceType: 'text', notificationType: 'event_notice', summary: source,
      requiresAction: true, actionReason: '原文包含两个动作',
    },
    projectMatch: { decision: 'standalone_task', matchedProjectId: null, suggestedProjectTitle: null, confidence: 0.9, reasons: [] },
    projectSuggestion: null, milestones: [],
    standaloneTasks: [
      {
        tempId: 'task-submit', parentTempId: null, hierarchyType: 'task', title: '提交登记表', actionVerb: '提交', actionObject: '登记表',
        description: '提交登记表', completionCriteria: [], estimatedMinutes: null, statusSuggestion: 'todo', prioritySuggestion: 'medium',
        dependencyTempIds: [], materialTempIds: ['material-form'], timePointTempIds: ['time-deadline'], evidenceIds: ['e-all'],
        confidence: 1, inferenceLevel: 'explicit', userConfirmationRequired: true, selected: true,
      },
      {
        tempId: 'task-attend', parentTempId: null, hierarchyType: 'task', title: '参加说明会', actionVerb: '参加', actionObject: '说明会',
        description: '参加说明会', completionCriteria: [], estimatedMinutes: null, statusSuggestion: 'todo', prioritySuggestion: 'medium',
        dependencyTempIds: [], materialTempIds: [], timePointTempIds: ['time-event'], evidenceIds: ['e-all'],
        confidence: 1, inferenceLevel: 'explicit', userConfirmationRequired: true, selected: true,
      },
    ],
    materials: [{
      tempId: 'material-form', name: '登记表', required: true, formatRequirements: [], namingRequirements: [], quantity: null,
      submissionChannel: null, relatedTaskTempIds: ['task-submit'], evidenceIds: ['e-all'], confidence: 1, selected: true,
    }],
    timePoints: [
      {
        tempId: 'time-deadline', type: 'submission_deadline', rawText: '11月20日17:00前', normalizedValue: '2026-11-20T17:00:00+08:00',
        timezone: 'Asia/Shanghai', isAllDay: false, precision: 'exact', needsConfirmation: false,
        relatedTaskTempIds: ['task-submit'], relatedMaterialTempIds: ['material-form'], evidenceIds: ['e-all'], confidence: 1, selected: true,
      },
      {
        tempId: 'time-event', type: 'event_start', rawText: '11月22日9:00', normalizedValue: '2026-11-22T09:00:00+08:00',
        timezone: 'Asia/Shanghai', isAllDay: false, precision: 'exact', needsConfirmation: false,
        relatedTaskTempIds: ['task-attend'], relatedMaterialTempIds: [], evidenceIds: ['e-all'], confidence: 1, selected: true,
      },
    ],
    events: [{
      tempId: 'event-briefing', title: '说明会', description: '说明会', startTimePointTempId: 'time-event', endTimePointTempId: null,
      location: null, evidenceIds: ['e-all'], confidence: 1, inferenceLevel: 'explicit', selected: true,
    }],
    evidence: [{ id: 'e-all', quotedText: source, quote: source, field: 'requirement', confidence: 1 }],
    conflicts: [], ambiguities: [], ignoredContent: [], quality: {},
  }
  const graph = normalizeR8FactGraphReferences(buildR8FactGraphFromCachedRaw({
    raw, sourceText: source, referenceTime: '2026-08-24T08:00:00+08:00', timezone: 'Asia/Shanghai',
  }))
  return { graph, result: planR9RecognitionResult(graph) }
}

test('R9 semantic integrity accepts an unchanged generic projection', () => {
  const { graph, result } = fixture()
  assert.deepEqual(evaluateR9SemanticIntegrity(result, graph).issues, [])
})

test('R9 semantic integrity catches a same-ID Material mutation', () => {
  const { graph, result } = fixture()
  result.materials[0].name = '另一份材料'
  assert.equal(evaluateR9SemanticIntegrity(result, graph).issues.some((item) => item.kind === 'material' && item.field === 'name'), true)
})

test('R9 semantic integrity catches a same-ID time-role mutation', () => {
  const { graph, result } = fixture()
  result.timePoints[0].type = 'event_start'
  assert.equal(evaluateR9SemanticIntegrity(result, graph).issues.some((item) => item.kind === 'timePoint' && item.field === 'role'), true)
})

test('R9 semantic integrity catches a same-ID Event mutation', () => {
  const { graph, result } = fixture()
  result.events[0].title = '另一个活动'
  assert.equal(evaluateR9SemanticIntegrity(result, graph).issues.some((item) => item.kind === 'event' && item.field === 'title'), true)
})

test('R9 semantic integrity catches a Task object mutation even when the ID survives', () => {
  const { graph, result } = fixture()
  result.standaloneTasks[0].actionObject = '其他对象'
  result.standaloneTasks[0].title = '提交其他对象'
  assert.equal(evaluateR9SemanticIntegrity(result, graph).issues.some((item) => item.kind === 'obligation'), true)
})

test('R9 graph snapshot detects Normalizer or Planner semantic mutation', () => {
  const { graph } = fixture()
  const after = structuredClone(graph)
  after.timePoints[0].role = 'event_start'
  assert.equal(compareR9FactGraphSnapshots(graph, after)[0].code, 'FACT_GRAPH_MUTATED')
})
