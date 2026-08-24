import assert from 'node:assert/strict'
import test from 'node:test'
import {
  R10_LEDGER_PLAN_VALIDATOR_VERSION,
  R10_PLANNING_TRACE_SCHEMA_VERSION,
  canonicalR10Sha256,
  validateR10LedgerPlan,
} from './e2-r10-ledger-plan-validator.mjs'

const source = '仅限入选同学，请在9月10日前提交PDF登记表，并于9月12日参加说明会。活动地点另行通知。'

function evidence(id, quote) {
  const start = source.indexOf(quote)
  assert.notEqual(start, -1)
  return { id, quote, start, end: start + quote.length }
}

function traceSemantics(ledger) {
  const sorted = (values) => [...new Set(values)].sort((left, right) => left.localeCompare(right, 'en'))
  const byId = (left, right) => left.factId.localeCompare(right.factId, 'en')
  return {
    obligationActors: ledger.obligations.map((item) => ({ factId: item.id, actor: item.actor })).sort(byId),
    eventActors: ledger.events.map((item) => ({ factId: item.id, actor: item.actor })).sort(byId),
    timeExpressions: ledger.timeExpressions.map((item) => ({
      factId: item.id,
      rawText: item.rawText,
      role: item.role,
      precision: item.precision,
      normalizedValue: item.normalizedValue,
      endNormalizedValue: item.endNormalizedValue,
      timezone: item.timezone,
      needsConfirmation: item.needsConfirmation,
      supersedesTimeExpressionId: item.supersedesTimeExpressionId,
    })).sort(byId),
    conditionApplications: ledger.conditions.map((item) => ({
      factId: item.id, appliesToFactIds: sorted(item.appliesToFactIds),
    })).sort(byId),
    constraintApplications: ledger.constraints.map((item) => ({
      factId: item.id, kind: item.kind, appliesToFactIds: sorted(item.appliesToFactIds),
    })).sort(byId),
    ambiguityTargets: ledger.ambiguities.map((item) => ({
      factId: item.id, targetFactIds: sorted(item.targetFactIds),
    })).sort(byId),
  }
}

function fixture() {
  const ledger = {
    schemaVersion: 'e2.5-fact-ledger-1.0.0',
    referenceTime: '2026-08-24T08:00:00+08:00',
    timezone: 'Asia/Shanghai',
    sourceText: source,
    obligations: [
      {
        id: 'obligation-submit', actor: '入选同学', modality: 'required', actionPredicate: '提交', object: '登记表',
        materialIds: ['material-form'], timeExpressionIds: ['time-submit'], eventIds: [],
        conditionIds: [], constraintIds: ['constraint-pdf'], evidenceIds: ['e-submit'],
      },
      {
        id: 'obligation-attend', actor: '入选同学', modality: 'conditional', actionPredicate: '参加', object: '说明会',
        materialIds: [], timeExpressionIds: ['time-event'], eventIds: ['event-briefing'],
        conditionIds: ['condition-selected'], constraintIds: [], evidenceIds: ['e-attend'],
      },
    ],
    materials: [{
      id: 'material-form', name: '登记表', role: 'deliverable', obligationIds: ['obligation-submit'],
      constraintIds: ['constraint-pdf'], evidenceIds: ['e-submit'],
    }],
    timeExpressions: [
      {
        id: 'time-submit', rawText: '9月10日前', role: 'submission_deadline', precision: 'date_only',
        normalizedValue: '2026-09-10', endNormalizedValue: null, timezone: 'Asia/Shanghai', needsConfirmation: false,
        relatedObligationIds: ['obligation-submit'], relatedEventIds: [], supersedesTimeExpressionId: null,
        evidenceIds: ['e-time-submit'],
      },
      {
        id: 'time-event', rawText: '9月12日', role: 'event_start', precision: 'date_only',
        normalizedValue: '2026-09-12', endNormalizedValue: null, timezone: 'Asia/Shanghai', needsConfirmation: false,
        relatedObligationIds: ['obligation-attend'], relatedEventIds: ['event-briefing'], supersedesTimeExpressionId: null,
        evidenceIds: ['e-time-event'],
      },
    ],
    events: [{
      id: 'event-briefing', title: '说明会', actor: null, location: null,
      startTimeExpressionId: 'time-event', endTimeExpressionId: null,
      conditionIds: ['condition-selected'], evidenceIds: ['e-attend'],
    }],
    conditions: [{
      id: 'condition-selected', kind: 'eligibility', text: '仅限入选同学',
      appliesToFactIds: ['obligation-attend', 'event-briefing'], evidenceIds: ['e-condition'],
    }],
    constraints: [{
      id: 'constraint-pdf', kind: 'format', text: 'PDF',
      appliesToFactIds: ['material-form'], evidenceIds: ['e-pdf'],
    }],
    ambiguities: [{
      id: 'ambiguity-location', code: 'LOCATION_PENDING', targetFactIds: ['event-briefing'],
      message: '活动地点另行通知', evidenceIds: ['e-location'],
    }],
    evidence: [
      evidence('e-condition', '仅限入选同学'),
      evidence('e-submit', '提交PDF登记表'),
      evidence('e-pdf', 'PDF'),
      evidence('e-time-submit', '9月10日前'),
      evidence('e-attend', '参加说明会'),
      evidence('e-time-event', '9月12日'),
      evidence('e-location', '活动地点另行通知'),
    ],
  }
  const result = {
    schemaVersion: '2.0', promptVersion: 'e2-r10-planner-test', modelName: 'same-test-model',
    createdAt: '2026-08-24T08:00:00+08:00',
    sourceSummary: {
      title: '说明会通知', sourceType: 'text', notificationType: 'meeting_notice',
      summary: '提交登记表并参加说明会', requiresAction: true, actionReason: '存在两项明确义务',
    },
    projectMatch: { decision: 'standalone_task', matchedProjectId: null, suggestedProjectTitle: null, confidence: 1, reasons: [] },
    projectSuggestion: null,
    milestones: [],
    standaloneTasks: [
      {
        tempId: 'task-from-obligation-submit', parentTempId: null, hierarchyType: 'task', title: '提交登记表',
        actionVerb: '提交', actionObject: '登记表', description: '提交登记表；适用对象：入选同学', completionCriteria: [],
        estimatedMinutes: null, statusSuggestion: 'todo', prioritySuggestion: 'medium', dependencyTempIds: [],
        materialTempIds: ['material-form'], timePointTempIds: ['time-submit'], evidenceIds: ['e-submit'],
        confidence: 1, inferenceLevel: 'explicit', userConfirmationRequired: true, selected: true,
      },
      {
        tempId: 'task-from-obligation-attend', parentTempId: null, hierarchyType: 'task', title: '参加说明会',
        actionVerb: '参加', actionObject: '说明会', description: '参加说明会；适用对象：入选同学；适用条件：仅限入选同学', completionCriteria: [],
        estimatedMinutes: null, statusSuggestion: 'todo', prioritySuggestion: 'medium', dependencyTempIds: [],
        materialTempIds: [], timePointTempIds: ['time-event'], evidenceIds: ['e-attend', 'e-condition'],
        confidence: 1, inferenceLevel: 'explicit', userConfirmationRequired: true, selected: false,
      },
    ],
    materials: [{
      tempId: 'material-form', name: '登记表', required: true,
      formatRequirements: ['PDF'], namingRequirements: [], quantity: null, submissionChannel: null,
      relatedTaskTempIds: ['task-from-obligation-submit'], evidenceIds: ['e-submit', 'e-pdf'], confidence: 1, selected: true,
    }],
    timePoints: [
      {
        tempId: 'time-submit', type: 'submission_deadline', rawText: '9月10日前', normalizedValue: '2026-09-10',
        timezone: 'Asia/Shanghai', isAllDay: true, precision: 'date_only', needsConfirmation: false,
        relatedTaskTempIds: ['task-from-obligation-submit'], relatedMaterialTempIds: ['material-form'],
        evidenceIds: ['e-time-submit'], confidence: 1, selected: true,
      },
      {
        tempId: 'time-event', type: 'event_start', rawText: '9月12日', normalizedValue: '2026-09-12',
        timezone: 'Asia/Shanghai', isAllDay: true, precision: 'date_only', needsConfirmation: false,
        relatedTaskTempIds: ['task-from-obligation-attend'], relatedMaterialTempIds: [],
        evidenceIds: ['e-time-event'], confidence: 1, selected: true,
      },
    ],
    events: [{
      tempId: 'event-briefing', title: '说明会', description: '说明会；适用条件：仅限入选同学',
      startTimePointTempId: 'time-event', endTimePointTempId: null, location: null,
      evidenceIds: ['e-attend', 'e-condition'], confidence: 1, inferenceLevel: 'explicit', selected: true,
    }],
    evidence: ledger.evidence.map((item) => ({
      id: item.id, sourceId: 'pending-source', textStart: item.start, textEnd: item.end,
      quote: item.quote, quotedText: item.quote,
      field: 'requirement', extractionMethod: 'ai', confidence: 1,
    })),
    conflicts: [],
    ambiguities: [
      { id: 'r10-ambiguity-1', field: 'LOCATION_PENDING', message: '活动地点另行通知', options: [], evidenceIds: ['e-location'] },
    ],
    ignoredContent: [],
    quality: {
      overallConfidence: 1, hierarchyConfidence: 1, dateConfidence: 1, evidenceCoverage: 1,
      duplicateRisk: 0, overFragmentationRisk: 0, missingActionRisk: 0,
      needsHumanReview: true, reviewReasons: [],
    },
  }
  const trace = {
    schemaVersion: R10_PLANNING_TRACE_SCHEMA_VERSION,
    ledgerSchemaVersion: ledger.schemaVersion,
    plannerVersion: 'e2-r10-isolated-planner-test',
    sourceId: 'pending-source',
    semantics: traceSemantics(ledger),
    bindings: [
      ['obligation', 'obligation-submit', 'task', 'task-from-obligation-submit'],
      ['obligation', 'obligation-attend', 'task', 'task-from-obligation-attend'],
      ['material', 'material-form', 'material', 'material-form'],
      ['timeExpression', 'time-submit', 'timePoint', 'time-submit'],
      ['timeExpression', 'time-event', 'timePoint', 'time-event'],
      ['event', 'event-briefing', 'event', 'event-briefing'],
      ['condition', 'condition-selected', 'task', 'task-from-obligation-attend'],
      ['condition', 'condition-selected', 'event', 'event-briefing'],
      ['constraint', 'constraint-pdf', 'material', 'material-form'],
      ['ambiguity', 'ambiguity-location', 'ambiguity', 'r10-ambiguity-1'],
    ].map(([factType, factId, entityType, entityId]) => ({ factType, factId, entityType, entityId })),
  }
  return { ledger, result, trace }
}

function prohibitedFixture() {
  const values = fixture()
  values.ledger.obligations.push({
    id: 'obligation-prohibited', actor: null, modality: 'prohibited', actionPredicate: '转发', object: '名单',
    materialIds: [], timeExpressionIds: [], eventIds: [], conditionIds: [], constraintIds: [], evidenceIds: ['e-attend'],
  })
  values.result.conflicts.push({
    id: 'r10-prohibition-1', type: 'other', message: '禁止：转发名单', entityTempIds: [],
    evidenceIds: ['e-attend'], requiresDecision: false,
  })
  values.trace.bindings.push({
    factType: 'obligation', factId: 'obligation-prohibited', entityType: 'conflict', entityId: 'r10-prohibition-1',
  })
  values.trace.semantics = traceSemantics(values.ledger)
  return values
}

async function validate(values, overrides = {}) {
  return validateR10LedgerPlan({
    ...values,
    ledgerSha256: await canonicalR10Sha256(values.ledger),
    resultSha256: await canonicalR10Sha256(values.result),
    ...overrides,
  })
}

function codes(report) {
  return new Set(report.issues.map((issue) => issue.code))
}

test('R10 validator accepts a fully bound E2.5 FactLedger projection', async () => {
  const report = await validate(fixture())
  assert.equal(report.validatorVersion, R10_LEDGER_PLAN_VALIDATOR_VERSION)
  assert.equal(report.status, 'NO_ISSUE', JSON.stringify(report.issues))
  assert.equal(report.noIssue, true)
  assert.equal(report.safeToProceed, true)
  assert.equal(report.integrityPassed, true)
  assert.equal(report.repairable, false)
  assert.deepEqual(report.issues, [])
  assert.equal(Object.prototype.hasOwnProperty.call(report.countsByCode, 'NO_ISSUE'), false)
})

test('R10 evidence validation cannot be masked by quotedText and binds exact source location', async () => {
  const quoteDrift = fixture()
  quoteDrift.result.evidence[0].quote = '被替换的引用'
  let report = await validate(quoteDrift)
  assert.equal(report.issues.some((issue) => issue.factType === 'evidence' && issue.field === 'sourceBinding'), true)

  const quotedTextDrift = fixture()
  quotedTextDrift.result.evidence[0].quotedText = '被替换的引用'
  report = await validate(quotedTextDrift)
  assert.equal(report.issues.some((issue) => issue.factType === 'evidence' && issue.field === 'sourceBinding'), true)

  const locationDrift = fixture()
  locationDrift.result.evidence[0].sourceId = 'different-source'
  locationDrift.result.evidence[0].textStart += 1
  report = await validate(locationDrift)
  assert.equal(report.issues.some((issue) => issue.factType === 'evidence' && issue.field === 'sourceBinding'), true)
})

test('R10 applies modality-specific Task projection without turning information or prohibitions into Tasks', async () => {
  const values = fixture()
  values.ledger.obligations.push(
    {
      id: 'obligation-optional', actor: null, modality: 'optional', actionPredicate: '阅读', object: '指南',
      materialIds: [], timeExpressionIds: [], eventIds: [], conditionIds: [], constraintIds: [], evidenceIds: ['e-condition'],
    },
    {
      id: 'obligation-information', actor: null, modality: 'informational', actionPredicate: '知悉', object: '地点待定',
      materialIds: [], timeExpressionIds: [], eventIds: [], conditionIds: [], constraintIds: [], evidenceIds: ['e-location'],
    },
    {
      id: 'obligation-prohibited', actor: null, modality: 'prohibited', actionPredicate: '转发', object: '名单',
      materialIds: [], timeExpressionIds: [], eventIds: [], conditionIds: [], constraintIds: [], evidenceIds: ['e-attend'],
    },
  )
  values.result.ignoredContent.push({ text: '知悉地点待定', reason: 'background' })
  values.result.standaloneTasks.push({
    ...structuredClone(values.result.standaloneTasks[0]), tempId: 'task-from-obligation-optional', title: '阅读指南',
    actionVerb: '阅读', actionObject: '指南', description: '阅读指南', completionCriteria: [],
    materialTempIds: [], timePointTempIds: [], evidenceIds: ['e-condition'],
    selected: false,
  })
  values.result.conflicts.push({
    id: 'r10-prohibition-1', type: 'other', message: '禁止：转发名单', entityTempIds: [],
    evidenceIds: ['e-attend'], requiresDecision: false,
  })
  values.trace.bindings.push(
    { factType: 'obligation', factId: 'obligation-optional', entityType: 'task', entityId: 'task-from-obligation-optional' },
    { factType: 'obligation', factId: 'obligation-information', entityType: 'ignoredContent', entityId: 'ignoredContent:0' },
    { factType: 'obligation', factId: 'obligation-prohibited', entityType: 'conflict', entityId: 'r10-prohibition-1' },
  )
  values.trace.semantics = traceSemantics(values.ledger)
  const report = await validate(values)
  assert.equal(report.status, 'NO_ISSUE', JSON.stringify(report.issues))
  assert.equal(report.issues.some((issue) => issue.code === 'UNSUPPORTED_TASK'), false)
})

test('R10 rejects an informational obligation whose action is dropped from ignored content', async () => {
  const values = fixture()
  values.ledger.obligations.push({
    id: 'obligation-information', actor: null, modality: 'informational', actionPredicate: '知悉', object: '地点待定',
    materialIds: [], timeExpressionIds: [], eventIds: [], conditionIds: [], constraintIds: [], evidenceIds: ['e-location'],
  })
  values.result.ignoredContent.push({ text: '地点待定', reason: 'background' })
  values.trace.bindings.push({
    factType: 'obligation', factId: 'obligation-information', entityType: 'ignoredContent', entityId: 'ignoredContent:0',
  })
  const report = await validate(values)
  assert.equal(codes(report).has('FACT_MUTATION'), true)
  assert.equal(report.issues.some((issue) => issue.factId === 'obligation-information' && issue.field === 'projection'), true)
})

test('R10 rejects an optional Task that is selected by default', async () => {
  const values = fixture()
  values.ledger.obligations.push({
    id: 'obligation-optional', actor: null, modality: 'optional', actionPredicate: '阅读', object: '指南',
    materialIds: [], timeExpressionIds: [], eventIds: [], conditionIds: [], constraintIds: [], evidenceIds: ['e-condition'],
  })
  values.result.standaloneTasks.push({
    ...structuredClone(values.result.standaloneTasks[0]), tempId: 'task-from-obligation-optional', title: '阅读指南',
    actionVerb: '阅读', actionObject: '指南', description: '阅读指南', completionCriteria: [],
    materialTempIds: [], timePointTempIds: [], evidenceIds: ['e-condition'], selected: true,
  })
  values.trace.bindings.push({ factType: 'obligation', factId: 'obligation-optional', entityType: 'task', entityId: 'task-from-obligation-optional' })
  const report = await validate(values)
  assert.equal(codes(report).has('FACT_MUTATION'), true)
})

test('R10 rejects required obligations hidden in quality metadata', async () => {
  const values = fixture()
  const binding = values.trace.bindings.find((item) => item.factId === 'obligation-submit')
  binding.entityType = 'quality'
  binding.entityId = 'quality'
  const report = await validate(values)
  assert.equal(codes(report).has('INTEGRITY_FAILURE'), true)
  assert.equal(codes(report).has('MISSING_TASK'), true)
})

test('R10 validator finds a missing Event-linked Task without re-reading source text', async () => {
  const values = fixture()
  values.result.standaloneTasks = values.result.standaloneTasks.filter((task) => task.tempId !== 'task-from-obligation-attend')
  values.trace.bindings = values.trace.bindings.filter((binding) => !(binding.factType === 'obligation' && binding.factId === 'obligation-attend'))
  const report = await validate(values)
  assert.equal(codes(report).has('MISSING_TASK'), true)
  assert.equal(codes(report).has('EVENT_TASK_CONFUSION'), true)
})

test('R10 validator distinguishes missing TimePoint from wrong time role', async () => {
  const missing = fixture()
  missing.result.timePoints = missing.result.timePoints.filter((item) => item.tempId !== 'time-submit')
  missing.trace.bindings = missing.trace.bindings.filter((binding) => binding.factId !== 'time-submit')
  assert.equal(codes(await validate(missing)).has('MISSING_TIMEPOINT'), true)

  const wrong = fixture()
  wrong.result.timePoints[0].type = 'task_deadline'
  const wrongReport = await validate(wrong)
  assert.equal(codes(wrongReport).has('WRONG_TIME_ROLE'), true)
  assert.equal(wrongReport.issues.every((issue) => issue.repairable === false), true)
})

test('R10 validator finds a missing ambiguity', async () => {
  const values = fixture()
  values.result.ambiguities = values.result.ambiguities.filter((item) => item.id !== 'r10-ambiguity-1')
  values.trace.bindings = values.trace.bindings.filter((binding) => binding.factType !== 'ambiguity')
  assert.equal(codes(await validate(values)).has('MISSING_AMBIGUITY'), true)
})

test('R10 reverse validation rejects a trace-bound Task whose fact fields changed', async () => {
  const values = fixture()
  values.result.standaloneTasks[0].actionObject = '另一份材料'
  const report = await validate(values)
  assert.equal(codes(report).has('FACT_MUTATION'), true)
  assert.equal(report.issues.some((issue) => issue.factId === 'obligation-submit' && issue.field === 'object'), true)
})

test('R10 rejects unsupported Task title, description, completion criteria, and dependencies', async () => {
  const mutations = [
    ['title', (task) => { task.title = '提交登记表并联系老师' }],
    ['description', (task) => { task.description += '；并联系老师' }],
    ['completionCriteria', (task) => { task.completionCriteria = ['等待老师确认'] }],
    ['dependencyTempIds', (task) => { task.dependencyTempIds = ['invented-task'] }],
  ]
  for (const [field, mutate] of mutations) {
    const values = fixture()
    mutate(values.result.standaloneTasks[0])
    const report = await validate(values)
    assert.equal(report.issues.some((issue) => issue.factId === 'obligation-submit' && issue.field === field), true, field)
  }
})

test('R10 rejects deterministic field drift across every planned entity class', async () => {
  const cases = [
    ['task', 'statusSuggestion', () => fixture(), (values) => { values.result.standaloneTasks[0].statusSuggestion = 'done' }],
    ['material', 'quantity', () => fixture(), (values) => { values.result.materials[0].quantity = '1份' }],
    ['timePoint', 'confidence', () => fixture(), (values) => { values.result.timePoints[0].confidence = 0.5 }],
    ['event', 'selected', () => fixture(), (values) => { values.result.events[0].selected = false }],
    ['ambiguity', 'options', () => fixture(), (values) => { values.result.ambiguities[0].options = ['猜测地点'] }],
    ['conflict', 'requiresDecision', () => prohibitedFixture(), (values) => { values.result.conflicts[0].requiresDecision = true }],
  ]
  for (const [entityType, field, makeValues, mutate] of cases) {
    const values = makeValues()
    mutate(values)
    const report = await validate(values)
    assert.equal(report.issues.some((issue) => issue.entityType === entityType && issue.field === field), true, `${entityType}.${field}`)
  }
})

test('R10 rejects loss of the obligation actor', async () => {
  const values = fixture()
  values.result.standaloneTasks[0].description = '提交登记表'
  const report = await validate(values)
  assert.equal(report.issues.some((issue) => issue.factId === 'obligation-submit' && issue.field === 'actor'), true)
})

test('R10 validator finds unsupported and over-fragmented Tasks', async () => {
  const values = fixture()
  values.result.standaloneTasks.push({
    ...structuredClone(values.result.standaloneTasks[0]), tempId: 'task-submit-extra', title: '再次提交登记表',
  })
  values.trace.bindings.push({ factType: 'obligation', factId: 'obligation-submit', entityType: 'task', entityId: 'task-submit-extra' })
  values.result.standaloneTasks.push({
    ...structuredClone(values.result.standaloneTasks[0]), tempId: 'task-hallucinated', title: '联系负责人',
    actionVerb: '联系', actionObject: '负责人', materialTempIds: [], timePointTempIds: [],
  })
  const report = await validate(values)
  assert.equal(codes(report).has('UNSUPPORTED_TASK'), true)
  assert.equal(report.issues.some((issue) => issue.entityId === 'task-submit-extra' && issue.field === 'overFragmentation'), true)
  assert.equal(report.issues.some((issue) => issue.entityId === 'task-hallucinated' && issue.field === 'traceBinding'), true)
})

test('R10 validator identifies Event projected directly as Task', async () => {
  const values = fixture()
  values.trace.bindings.push({ factType: 'event', factId: 'event-briefing', entityType: 'task', entityId: 'task-from-obligation-attend' })
  const report = await validate(values)
  assert.equal(codes(report).has('EVENT_TASK_CONFUSION'), true)
})

test('R10 hash and trace failures are blocking integrity issues', async () => {
  const values = fixture()
  values.trace.bindings.push({ factType: 'material', factId: 'missing-fact', entityType: 'material', entityId: 'material-form' })
  const report = await validate(values, { resultSha256: '0'.repeat(64) })
  assert.equal(codes(report).has('INTEGRITY_FAILURE'), true)
  assert.equal(report.integrityPassed, false)
  assert.equal(report.safeToProceed, false)
  assert.equal(report.status, 'ISSUES_FOUND')
})

test('R10 allows a pure-information Event with no Task', async () => {
  const values = fixture()
  values.ledger.obligations = []
  values.ledger.materials = []
  values.ledger.timeExpressions = []
  values.ledger.conditions = []
  values.ledger.constraints = []
  values.ledger.ambiguities = []
  values.ledger.events[0] = {
    ...values.ledger.events[0], startTimeExpressionId: null, conditionIds: [], evidenceIds: ['e-attend'],
  }
  values.result.sourceSummary.requiresAction = false
  values.result.sourceSummary.notificationType = 'information_only'
  values.result.standaloneTasks = []
  values.result.materials = []
  values.result.timePoints = []
  values.result.ambiguities = []
  values.result.events[0].startTimePointTempId = null
  values.result.events[0].description = '说明会'
  values.result.events[0].evidenceIds = ['e-attend']
  values.trace.bindings = [{ factType: 'event', factId: 'event-briefing', entityType: 'event', entityId: 'event-briefing' }]
  values.trace.semantics = traceSemantics(values.ledger)
  const report = await validate(values)
  assert.equal(report.status, 'NO_ISSUE', JSON.stringify(report.issues))
})

test('R10 allows an evidence-backed superseded deadline to remain non-active', async () => {
  const values = fixture()
  values.ledger.obligations = []
  values.ledger.materials = []
  values.ledger.events = []
  values.ledger.conditions = []
  values.ledger.constraints = []
  values.ledger.ambiguities = []
  values.ledger.timeExpressions = [{
    id: 'time-old', rawText: '9月10日前', role: 'superseded_deadline', precision: 'date_only',
    normalizedValue: '2026-09-10', endNormalizedValue: null, timezone: 'Asia/Shanghai', needsConfirmation: false,
    relatedObligationIds: [], relatedEventIds: [], supersedesTimeExpressionId: null, evidenceIds: ['e-time-submit'],
  }]
  values.result.sourceSummary.requiresAction = false
  values.result.standaloneTasks = []
  values.result.materials = []
  values.result.timePoints = []
  values.result.events = []
  values.result.ambiguities = [{
    id: 'r10-ambiguity-1', field: 'superseded_deadline', message: '9月10日前', options: [], evidenceIds: ['e-time-submit'],
  }]
  values.trace.bindings = [{ factType: 'timeExpression', factId: 'time-old', entityType: 'ambiguity', entityId: 'r10-ambiguity-1' }]
  values.trace.semantics = traceSemantics(values.ledger)
  const report = await validate(values)
  assert.equal(report.status, 'NO_ISSUE', JSON.stringify(report.issues))
})

test('R10 permits safe range degradation but forbids false task-deadline precision', async () => {
  const safe = fixture()
  safe.ledger.timeExpressions[0] = {
    ...safe.ledger.timeExpressions[0], precision: 'range', normalizedValue: '2026-09-10T09:00:00+08:00',
    endNormalizedValue: '2026-09-10T11:00:00+08:00', needsConfirmation: true,
  }
  safe.result.timePoints[0] = {
    ...safe.result.timePoints[0], precision: 'vague', normalizedValue: null, isAllDay: false,
    needsConfirmation: true, selected: false,
  }
  safe.trace.semantics = traceSemantics(safe.ledger)
  assert.equal((await validate(safe)).issues.some((issue) => issue.factId === 'time-submit' && issue.code === 'FACT_MUTATION'), false)

  const unsafe = fixture()
  unsafe.ledger.timeExpressions[0] = {
    ...unsafe.ledger.timeExpressions[0], role: 'other', precision: 'unknown', normalizedValue: null, needsConfirmation: true,
  }
  unsafe.result.timePoints[0] = {
    ...unsafe.result.timePoints[0], type: 'task_deadline', precision: 'vague', normalizedValue: null, needsConfirmation: true,
  }
  unsafe.trace.semantics = traceSemantics(unsafe.ledger)
  assert.equal(codes(await validate(unsafe)).has('WRONG_TIME_ROLE'), true)
})

test('R10 rejects raw time, timezone, range endpoint, and supersession drift', async () => {
  const rawTextDrift = fixture()
  rawTextDrift.result.timePoints[0].rawText = '9月11日前'
  let report = await validate(rawTextDrift)
  assert.equal(report.issues.some((issue) => issue.factId === 'time-submit' && issue.field === 'timeValue'), true)

  const timezoneDrift = fixture()
  timezoneDrift.result.timePoints[0].timezone = 'UTC'
  report = await validate(timezoneDrift)
  assert.equal(report.issues.some((issue) => issue.factId === 'time-submit' && issue.field === 'timeValue'), true)

  const rangeEndpointDrift = fixture()
  rangeEndpointDrift.ledger.timeExpressions[0] = {
    ...rangeEndpointDrift.ledger.timeExpressions[0],
    precision: 'range',
    normalizedValue: '2026-09-10T09:00:00+08:00',
    endNormalizedValue: '2026-09-10T11:00:00+08:00',
    needsConfirmation: true,
  }
  rangeEndpointDrift.result.timePoints[0] = {
    ...rangeEndpointDrift.result.timePoints[0], precision: 'vague', normalizedValue: null, isAllDay: false,
    needsConfirmation: true, selected: false,
  }
  rangeEndpointDrift.trace.semantics = traceSemantics(rangeEndpointDrift.ledger)
  rangeEndpointDrift.trace.semantics.timeExpressions.find((item) => item.factId === 'time-submit').endNormalizedValue = '2026-09-10T12:00:00+08:00'
  report = await validate(rangeEndpointDrift)
  assert.equal(report.issues.some((issue) => issue.field === 'trace.semantics'), true)

  const supersessionDrift = fixture()
  supersessionDrift.trace.semantics.timeExpressions.find((item) => item.factId === 'time-submit').supersedesTimeExpressionId = 'time-event'
  report = await validate(supersessionDrift)
  assert.equal(report.issues.some((issue) => issue.field === 'trace.semantics'), true)
})

test('R10 applies the Planner envelope timezone when a time fact timezone is null', async () => {
  const values = fixture()
  values.ledger.timeExpressions[0].timezone = null
  values.trace.semantics = traceSemantics(values.ledger)
  values.result.timePoints[0].timezone = 'Asia/Shanghai'
  let report = await validate(values)
  assert.equal(report.status, 'NO_ISSUE', JSON.stringify(report.issues))

  values.result.timePoints[0].timezone = null
  report = await validate(values)
  assert.equal(report.issues.some((issue) => issue.factId === 'time-submit' && issue.field === 'timezone'), true)
})

test('R10 validates canonical Condition and Ambiguity target relations', async () => {
  const conditionTraceDrift = fixture()
  conditionTraceDrift.trace.semantics.conditionApplications[0].appliesToFactIds = ['obligation-attend']
  let report = await validate(conditionTraceDrift)
  assert.equal(report.issues.some((issue) => issue.field === 'trace.semantics'), true)

  const conditionProjectionDrift = fixture()
  conditionProjectionDrift.trace.bindings = conditionProjectionDrift.trace.bindings.filter((item) => !(
    item.factType === 'condition' && item.entityType === 'event'
  ))
  report = await validate(conditionProjectionDrift)
  assert.equal(report.issues.some((issue) => issue.factId === 'condition-selected' && issue.field === 'appliesToFactIds'), true)

  const ambiguityTargetDrift = fixture()
  ambiguityTargetDrift.trace.semantics.ambiguityTargets[0].targetFactIds = ['obligation-submit']
  report = await validate(ambiguityTargetDrift)
  assert.equal(report.issues.some((issue) => issue.field === 'trace.semantics'), true)
})

test('R10 validates Constraint kind, relation, projection kind, and target', async () => {
  const traceDrift = fixture()
  traceDrift.trace.semantics.constraintApplications[0].kind = 'channel'
  let report = await validate(traceDrift)
  assert.equal(report.issues.some((issue) => issue.field === 'trace.semantics'), true)

  const formatWrongKind = fixture()
  formatWrongKind.result.ignoredContent.push({ text: 'PDF', reason: 'other' })
  const binding = formatWrongKind.trace.bindings.find((item) => item.factId === 'constraint-pdf')
  binding.entityType = 'ignoredContent'
  binding.entityId = 'ignoredContent:0'
  report = await validate(formatWrongKind)
  assert.equal(report.issues.some((issue) => issue.factId === 'constraint-pdf' && issue.field === 'appliesToFactIds'), true)

  const channelWrongKind = fixture()
  channelWrongKind.ledger.constraints.push({
    id: 'constraint-channel', kind: 'channel', text: '通过系统提交',
    appliesToFactIds: ['material-form'], evidenceIds: ['e-submit'],
  })
  channelWrongKind.result.materials[0].submissionChannel = '通过系统提交'
  channelWrongKind.trace.semantics = traceSemantics(channelWrongKind.ledger)
  channelWrongKind.trace.bindings.push({
    factType: 'constraint', factId: 'constraint-channel', entityType: 'material', entityId: 'material-form',
  })
  report = await validate(channelWrongKind)
  assert.equal(report.status, 'NO_ISSUE', JSON.stringify(report.issues))
  const channelBinding = channelWrongKind.trace.bindings.find((item) => item.factId === 'constraint-channel')
  channelWrongKind.result.ignoredContent.push({ text: '通过系统提交', reason: 'other' })
  channelBinding.entityType = 'ignoredContent'
  channelBinding.entityId = 'ignoredContent:0'
  report = await validate(channelWrongKind)
  assert.equal(report.issues.some((issue) => issue.factId === 'constraint-channel' && issue.field === 'appliesToFactIds'), true)

  const quantityDrift = fixture()
  quantityDrift.ledger.constraints.push({
    id: 'constraint-quantity', kind: 'quantity', text: '提交2份',
    appliesToFactIds: ['material-form'], evidenceIds: ['e-submit'],
  })
  quantityDrift.result.materials[0].quantity = 2
  quantityDrift.trace.semantics = traceSemantics(quantityDrift.ledger)
  quantityDrift.trace.bindings.push({
    factType: 'constraint', factId: 'constraint-quantity', entityType: 'material', entityId: 'material-form',
  })
  report = await validate(quantityDrift)
  assert.equal(report.status, 'NO_ISSUE', JSON.stringify(report.issues))
  quantityDrift.result.materials[0].quantity = 3
  report = await validate(quantityDrift)
  assert.equal(report.issues.some((issue) => issue.factId === 'material-form' && issue.field === 'quantity'), true)

  const ambiguousQuantity = fixture()
  ambiguousQuantity.ledger.constraints.push({
    id: 'constraint-quantity', kind: 'quantity', text: '提交1份或2份',
    appliesToFactIds: ['material-form'], evidenceIds: ['e-submit'],
  })
  ambiguousQuantity.result.ignoredContent.push({ text: '提交1份或2份', reason: 'other' })
  ambiguousQuantity.trace.semantics = traceSemantics(ambiguousQuantity.ledger)
  ambiguousQuantity.trace.bindings.push({
    factType: 'constraint', factId: 'constraint-quantity', entityType: 'ignoredContent', entityId: 'ignoredContent:0',
  })
  report = await validate(ambiguousQuantity)
  assert.equal(report.status, 'NO_ISSUE', JSON.stringify(report.issues))
  ambiguousQuantity.result.materials[0].quantity = 1
  const quantityBinding = ambiguousQuantity.trace.bindings.find((item) => item.factId === 'constraint-quantity')
  quantityBinding.entityType = 'material'
  quantityBinding.entityId = 'material-form'
  report = await validate(ambiguousQuantity)
  assert.equal(report.issues.some((issue) => issue.factId === 'constraint-quantity' && issue.field === 'projectionKind'), true)
})

test('R10 does not allow conditional or optional materials to become required or selected', async () => {
  for (const modality of ['conditional', 'optional']) {
    const values = fixture()
    values.ledger.obligations[0].modality = modality
    values.result.standaloneTasks[0].selected = false
    const report = await validate(values)
    assert.equal(report.issues.some((issue) => issue.factId === 'material-form' && issue.field === 'required'), true, modality)
  }
})
