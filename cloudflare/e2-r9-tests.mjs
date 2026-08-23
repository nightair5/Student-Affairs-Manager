import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { buildR8FactGraphFromCachedRaw } from './e2-r8-cache-fact-adapter.mjs'
import { normalizeR8FactGraphReferences, R8_NORMALIZER_PERMISSIONS } from './e2-r8-restricted-normalizer.mjs'
import { validateR8FactGraph } from './e2-r8-planner-contracts.mjs'
import { evaluateR9ContractCoverage } from './e2-r9-contract-replay-metrics.mjs'
import { planR9RecognitionResult, R9_PLAN_CONTRACT_VERSION } from './e2-r9-isolated-planner.mjs'

function rawRecognition({ sourceText, requiresAction = true, tasks = [], materials = [], timePoints = [], events = [], ambiguities = [], milestones = [] }) {
  return {
    schemaVersion: '2.0', promptVersion: 'frozen-test-prompt', modelName: 'cache-test', createdAt: '2026-08-24T00:00:00.000Z',
    sourceSummary: {
      title: '匿名通知', sourceType: 'text', notificationType: requiresAction ? 'event_notice' : 'information_only',
      summary: sourceText, requiresAction, actionReason: requiresAction ? '原文包含用户动作' : '仅供知悉',
    },
    projectMatch: { decision: requiresAction ? 'standalone_task' : 'uncertain', matchedProjectId: null, suggestedProjectTitle: null, confidence: 0.8, reasons: [] },
    projectSuggestion: null, milestones, standaloneTasks: tasks, materials, timePoints, events,
    evidence: [{ id: 'ev-all', quotedText: sourceText, field: 'requirement', confidence: 1 }],
    conflicts: [], ambiguities, ignoredContent: [], quality: {},
  }
}

function task(tempId, actionVerb, actionObject, extra = {}) {
  return {
    tempId, title: `${actionVerb}${actionObject}`, actionVerb, actionObject, evidenceIds: ['ev-all'],
    materialTempIds: [], timePointTempIds: [], inferenceLevel: 'explicit', ...extra,
  }
}

function material(tempId, name, relatedTaskTempIds = []) {
  return { tempId, name, required: true, relatedTaskTempIds, evidenceIds: ['ev-all'] }
}

function timePoint(tempId, type, rawText, normalizedValue, precision, relatedTaskTempIds = []) {
  return {
    tempId, type, rawText, normalizedValue, precision, needsConfirmation: ['vague', 'relative'].includes(precision),
    isAllDay: precision === 'date_only', relatedTaskTempIds, relatedMaterialTempIds: [], evidenceIds: ['ev-all'],
  }
}

function event(tempId, title, startTimePointTempId = null) {
  return { tempId, title, description: title, location: null, startTimePointTempId, endTimePointTempId: null, evidenceIds: ['ev-all'], inferenceLevel: 'explicit' }
}

function build(raw, sourceText) {
  return normalizeR8FactGraphReferences(buildR8FactGraphFromCachedRaw({
    raw, sourceText, referenceTime: '2026-08-24T08:00:00+08:00', timezone: 'Asia/Shanghai',
  }))
}

function plan(raw, sourceText) {
  const graph = build(raw, sourceText)
  return { graph, result: planR9RecognitionResult(graph) }
}

function flattenTasks(result) {
  return [
    ...result.standaloneTasks,
    ...result.milestones.flatMap((milestone) => [...milestone.tasks, ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks)]),
  ]
}

test('R9 pure-information Event does not create a fake Task', () => {
  const source = '服务窗口将于11月2日9:00至11:00暂停办理，仅供知悉。'
  const raw = rawRecognition({
    sourceText: source, requiresAction: false,
    timePoints: [timePoint('tp-1', 'event_start', '11月2日9:00', '2026-11-02T09:00:00+08:00', 'exact')],
    events: [event('event-1', '窗口暂停办理', 'tp-1')],
  })
  const { result } = plan(raw, source)
  assert.equal(flattenTasks(result).length, 0)
  assert.equal(result.events.length, 1)
})

test('R9 required attendance keeps one Task and one Event', () => {
  const source = '参训学员11月5日14:00参加安全说明会。'
  const raw = rawRecognition({
    sourceText: source, tasks: [task('task-1', '参加', '安全说明会', { timePointTempIds: ['tp-1'] })],
    timePoints: [timePoint('tp-1', 'event_start', '11月5日14:00', '2026-11-05T14:00:00+08:00', 'exact', ['task-1'])],
    events: [event('event-1', '安全说明会', 'tp-1')],
  })
  const { result } = plan(raw, source)
  assert.equal(flattenTasks(result).length, 1)
  assert.equal(result.events.length, 1)
})

test('R9 equivalent attendance obligations map to one Task', () => {
  const source = '参训成员8:00参加培训集合，完成签到。'
  const raw = rawRecognition({
    sourceText: source, tasks: [task('task-1', '参加', '培训集合并签到')],
    events: [event('event-1', '培训集合签到')],
  })
  const { graph, result } = plan(raw, source)
  assert.equal(graph.obligations.length, 2)
  assert.equal(flattenTasks(result).length, 1)
  assert.equal(evaluateR9ContractCoverage(result, graph).counts.factLosses, 0)
})

test('R9 Material name alone does not become a Task', () => {
  const source = '附件为入校指南，请自行查看。'
  const raw = rawRecognition({ sourceText: source, requiresAction: false, materials: [material('mat-1', '入校指南')] })
  const { result } = plan(raw, source)
  assert.equal(flattenTasks(result).length, 0)
  assert.equal(result.materials.length, 1)
})

test('R9 submitting a Material remains an action Task', () => {
  const source = '请提交学籍确认表。'
  const raw = rawRecognition({
    sourceText: source,
    tasks: [task('task-1', '提交', '学籍确认表', { materialTempIds: ['mat-1'] })],
    materials: [material('mat-1', '学籍确认表', ['task-1'])],
  })
  const { result } = plan(raw, source)
  assert.equal(flattenTasks(result)[0].actionVerb, '提交')
})

test('R9 multiple constraints on one action do not split the Task', () => {
  const source = '仅审核通过者需在公布后两日内提交回执。'
  const raw = rawRecognition({ sourceText: source, tasks: [task('task-1', '提交', '回执')] })
  const { result } = plan(raw, source)
  assert.equal(flattenTasks(result).length, 1)
})

test('R9 independent action objects remain separate Tasks', () => {
  const source = '先确认选题；再上传提案。'
  const raw = rawRecognition({ sourceText: source, tasks: [task('task-1', '确认', '选题'), task('task-2', '上传', '提案')] })
  const { result } = plan(raw, source)
  assert.equal(flattenTasks(result).length, 2)
})

test('R9 empty Milestone does not masquerade as a Task', () => {
  const source = '本周为资料阅读阶段，暂无具体行动。'
  const raw = rawRecognition({ sourceText: source, requiresAction: false, milestones: [{ tempId: 'ms-1', title: '阅读阶段', tasks: [], workPackages: [] }] })
  const { result } = plan(raw, source)
  assert.equal(result.milestones.length, 0)
  assert.equal(flattenTasks(result).length, 0)
})

test('R9 TimePoint alone does not masquerade as a Task', () => {
  const source = '结果将于11月10日公布。'
  const raw = rawRecognition({
    sourceText: source, requiresAction: false,
    timePoints: [timePoint('tp-1', 'result_announcement', '11月10日', '2026-11-10', 'date_only')],
  })
  const { result } = plan(raw, source)
  assert.equal(flattenTasks(result).length, 0)
  assert.equal(result.timePoints.length, 1)
})

test('R9 preserves deadline and event-start roles', () => {
  const source = '11月12日17:00前上传表格，11月15日9:00参加宣讲。'
  const raw = rawRecognition({
    sourceText: source,
    tasks: [task('task-1', '上传', '表格', { timePointTempIds: ['tp-1'] }), task('task-2', '参加', '宣讲', { timePointTempIds: ['tp-2'] })],
    timePoints: [
      timePoint('tp-1', 'submission_deadline', '11月12日17:00前', '2026-11-12T17:00:00+08:00', 'exact', ['task-1']),
      timePoint('tp-2', 'event_start', '11月15日9:00', '2026-11-15T09:00:00+08:00', 'exact', ['task-2']),
    ],
    events: [event('event-1', '宣讲', 'tp-2')],
  })
  const { result } = plan(raw, source)
  assert.deepEqual(result.timePoints.map((item) => item.type), ['submission_deadline', 'event_start'])
})

test('R9 restricted Normalizer preserves local Condition targets', () => {
  const sourceText = '仅获准者提交表格。另请阅读通知。'
  const firstQuote = '仅获准者提交表格'
  const secondQuote = '另请阅读通知'
  const graph = {
    schemaVersion: 'e2-r8-fact-contract-1.0.0', sourceText, referenceTime: '2026-08-24T08:00:00+08:00', timezone: 'Asia/Shanghai',
    sourceSummary: { title: '匿名通知', sourceType: 'text', notificationType: 'uncertain', summary: '', requiresAction: true, actionReason: '' },
    projectMatch: {}, projectSuggestion: null, hierarchyHints: [], ignoredContent: [],
    obligations: [
      { id: 'o-1', actor: null, modality: 'conditional', actionPredicate: '提交', object: '表格', materialIds: [], timePointIds: [], eventIds: [], conditionIds: ['c-1'], evidenceIds: ['e-1'], sourceTaskId: 't-1', placement: { kind: 'standalone' }, confidence: 1, provenance: 'cached_model_task' },
      { id: 'o-2', actor: null, modality: 'required', actionPredicate: '阅读', object: '通知', materialIds: [], timePointIds: [], eventIds: [], conditionIds: [], evidenceIds: ['e-2'], sourceTaskId: 't-2', placement: { kind: 'standalone' }, confidence: 1, provenance: 'cached_model_task' },
    ],
    materials: [], timePoints: [], events: [],
    conditions: [{ id: 'c-1', kind: 'eligibility', text: '仅获准者', appliesToFactIds: ['o-1'], evidenceIds: ['e-1'] }],
    ambiguities: [{ id: 'a-1', code: 'ELIGIBILITY', message: '需确认是否获准', options: [], targetFactIds: ['c-1'], evidenceIds: ['e-1'] }],
    evidence: [
      { id: 'e-1', quote: firstQuote, start: sourceText.indexOf(firstQuote), end: sourceText.indexOf(firstQuote) + firstQuote.length, field: 'requirement', confidence: 1 },
      { id: 'e-2', quote: secondQuote, start: sourceText.indexOf(secondQuote), end: sourceText.indexOf(secondQuote) + secondQuote.length, field: 'requirement', confidence: 1 },
    ],
  }
  assert.deepEqual(validateR8FactGraph(graph), [])
  const normalized = normalizeR8FactGraphReferences(graph)
  assert.deepEqual(normalized.conditions[0].appliesToFactIds, ['o-1'])
})

test('R9 does not guess away an Ambiguity', () => {
  const source = '若获选则回复，公布时间待定。'
  const raw = rawRecognition({
    sourceText: source, tasks: [task('task-1', '回复', '是否参加')],
    ambiguities: [{ id: 'amb-1', field: 'trigger', message: '公布时间未知，无法计算回复截止。', options: [], evidenceIds: ['ev-all'] }],
  })
  const { result } = plan(raw, source)
  assert.equal(result.ambiguities.some((item) => item.message.includes('无法计算')), true)
})

test('R9 Normalizer cannot add or delete Facts', () => {
  assert.equal(R8_NORMALIZER_PERMISSIONS.mayAddOrDeleteFacts, false)
})

test('R9 Normalizer cannot mutate action or time semantics', () => {
  assert.equal(R8_NORMALIZER_PERMISSIONS.mayChangeActionPredicateOrObject, false)
  assert.equal(R8_NORMALIZER_PERMISSIONS.mayChangeTimeRoleOrValue, false)
})

test('R9 every planned Task retains obligation Evidence', () => {
  const source = '请核对课程名单。'
  const raw = rawRecognition({ sourceText: source, tasks: [task('task-1', '核对', '课程名单')] })
  const { result } = plan(raw, source)
  assert.equal(flattenTasks(result).every((item) => item.evidenceIds.length > 0), true)
})

test('R9 generic planner keeps Fact Loss at zero', () => {
  const source = '请在11月20日前报送登记表。'
  const raw = rawRecognition({
    sourceText: source,
    tasks: [task('task-1', '报送', '登记表', { materialTempIds: ['mat-1'], timePointTempIds: ['tp-1'] })],
    materials: [material('mat-1', '登记表', ['task-1'])],
    timePoints: [timePoint('tp-1', 'submission_deadline', '11月20日前', '2026-11-20', 'date_only', ['task-1'])],
  })
  const { graph, result } = plan(raw, source)
  assert.equal(evaluateR9ContractCoverage(result, graph).counts.factLosses, 0)
})

test('R9 generic planner creates no unsupported Task', () => {
  const source = '参训人员需参加课程说明会。'
  const raw = rawRecognition({ sourceText: source, tasks: [task('task-1', '参加', '课程说明会')], events: [event('event-1', '课程说明会')] })
  const { graph, result } = plan(raw, source)
  assert.equal(evaluateR9ContractCoverage(result, graph).counts.unsupportedTasks, 0)
})

test('R9 generic conjunction normalization removes Over-splitting', () => {
  const source = '会员7:40参加准备集合，完成签到。'
  const raw = rawRecognition({ sourceText: source, tasks: [task('task-1', '参加', '准备集合并签到')], events: [event('event-1', '准备集合签到')] })
  const { graph, result } = plan(raw, source)
  assert.equal(graph.obligations.length, 2)
  assert.equal(flattenTasks(result).length, 1)
})

test('R9 repair remains isolated from Production runtime', async () => {
  const [worker, recognition] = await Promise.all([
    readFile(new URL('./worker.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./recognition.mjs', import.meta.url), 'utf8'),
  ])
  assert.doesNotMatch(worker, /e2-r9/u)
  assert.doesNotMatch(recognition, /e2-r9/u)
  assert.equal(R9_PLAN_CONTRACT_VERSION, 'e2-r9-plan-contract-1.0.0')
})
