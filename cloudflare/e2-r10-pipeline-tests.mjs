import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  R10_FACT_LEDGER_SCHEMA_VERSION,
  validateR10FactLedger,
  validateR10PlannerInput,
} from './e2-r10-factledger-contract.mjs'
import {
  R10_BRIDGE_PERMISSIONS,
  buildR10PlannerInput,
  r10LedgerSemanticSnapshot,
} from './e2-r10-ledger-planner-bridge.mjs'
import {
  R10_ISOLATED_PLANNER_VERSION,
  R10_PLANNING_TRACE_SCHEMA_VERSION,
  R10_CONSTRAINT_PROJECTION_POLICY,
  planR10FactLedger,
} from './e2-r10-isolated-planner.mjs'
import {
  canonicalR10Sha256,
  validateR10LedgerPlan,
} from './e2-r10-ledger-plan-validator.mjs'

function evidence(sourceText, id, quote) {
  const start = sourceText.indexOf(quote)
  assert.notEqual(start, -1, `Missing fixture quote: ${quote}`)
  return { id, quote, start, end: start + quote.length }
}

function richLedger() {
  const sourceText = '请于9月10日至9月12日提交报名表，文件命名为学号，提交数量为1份，通过系统提交。原截止时间9月8日已取消。结果时间另行通知。说明会于9月15日举行。仅通过初审者执行。可自愿阅读指南。不得转发名单。'
  const evidenceEntries = [
    evidence(sourceText, 'ev-submit', '请于9月10日至9月12日提交报名表'),
    evidence(sourceText, 'ev-format', '文件命名为学号'),
    evidence(sourceText, 'ev-quantity', '提交数量为1份'),
    evidence(sourceText, 'ev-channel', '通过系统提交'),
    evidence(sourceText, 'ev-old', '原截止时间9月8日已取消'),
    evidence(sourceText, 'ev-other', '结果时间另行通知'),
    evidence(sourceText, 'ev-event', '说明会于9月15日举行'),
    evidence(sourceText, 'ev-condition', '仅通过初审者执行'),
    evidence(sourceText, 'ev-optional', '可自愿阅读指南'),
    evidence(sourceText, 'ev-prohibited', '不得转发名单'),
  ]
  return {
    schemaVersion: R10_FACT_LEDGER_SCHEMA_VERSION,
    referenceTime: '2026-08-24T08:00:00+08:00',
    timezone: 'Asia/Shanghai',
    sourceText,
    obligations: [
      {
        id: 'ob-submit-1', actor: null, modality: 'conditional', actionPredicate: '提交', object: '报名表',
        materialIds: ['mat-form', 'mat-form'], timeExpressionIds: ['time-range'], eventIds: [],
        conditionIds: ['condition-pass'], constraintIds: ['constraint-name'], evidenceIds: ['ev-submit'],
      },
      {
        id: 'ob-submit-2', actor: null, modality: 'conditional', actionPredicate: '提交', object: '报名表',
        materialIds: ['mat-form'], timeExpressionIds: ['time-range'], eventIds: [],
        conditionIds: ['condition-pass'], constraintIds: ['constraint-name'], evidenceIds: ['ev-submit'],
      },
      {
        id: 'ob-optional', actor: null, modality: 'optional', actionPredicate: '阅读', object: '指南',
        materialIds: [], timeExpressionIds: [], eventIds: [], conditionIds: [], constraintIds: [], evidenceIds: ['ev-optional'],
      },
      {
        id: 'ob-prohibited', actor: null, modality: 'prohibited', actionPredicate: '转发', object: '名单',
        materialIds: [], timeExpressionIds: [], eventIds: [], conditionIds: [], constraintIds: [], evidenceIds: ['ev-prohibited'],
      },
    ],
    materials: [{
      id: 'mat-form', name: '报名表', role: 'deliverable', obligationIds: ['ob-submit-1', 'ob-submit-2'],
      constraintIds: ['constraint-name'], evidenceIds: ['ev-submit'],
    }],
    timeExpressions: [
      {
        id: 'time-range', rawText: '9月10日至9月12日', role: 'submission_deadline', precision: 'range',
        normalizedValue: '2026-09-10', endNormalizedValue: '2026-09-12', timezone: 'Asia/Shanghai', needsConfirmation: false,
        relatedObligationIds: ['ob-submit-1', 'ob-submit-2'], relatedEventIds: [], supersedesTimeExpressionId: 'time-old', evidenceIds: ['ev-submit'],
      },
      {
        id: 'time-old', rawText: '9月8日', role: 'superseded_deadline', precision: 'date_only',
        normalizedValue: '2026-09-08', endNormalizedValue: null, timezone: 'Asia/Shanghai', needsConfirmation: false,
        relatedObligationIds: [], relatedEventIds: [], supersedesTimeExpressionId: null, evidenceIds: ['ev-old'],
      },
      {
        id: 'time-other', rawText: '另行通知', role: 'other', precision: 'unknown',
        normalizedValue: null, endNormalizedValue: null, timezone: null, needsConfirmation: true,
        relatedObligationIds: [], relatedEventIds: [], supersedesTimeExpressionId: null, evidenceIds: ['ev-other'],
      },
      {
        id: 'time-event', rawText: '9月15日', role: 'event_start', precision: 'date_only',
        normalizedValue: '2026-09-15', endNormalizedValue: null, timezone: 'Asia/Shanghai', needsConfirmation: false,
        relatedObligationIds: [], relatedEventIds: ['event-briefing'], supersedesTimeExpressionId: null, evidenceIds: ['ev-event'],
      },
    ],
    events: [{
      id: 'event-briefing', title: '说明会', actor: null, location: null,
      startTimeExpressionId: 'time-event', endTimeExpressionId: null, conditionIds: [], evidenceIds: ['ev-event'],
    }],
    conditions: [{
      id: 'condition-pass', kind: 'eligibility', text: '仅通过初审者执行',
      appliesToFactIds: ['ob-submit-1', 'ob-submit-2'], evidenceIds: ['ev-condition'],
    }],
    constraints: [
      {
        id: 'constraint-name', kind: 'naming', text: '文件命名为学号',
        appliesToFactIds: ['mat-form'], evidenceIds: ['ev-format'],
      },
      {
        id: 'constraint-quantity', kind: 'quantity', text: '提交数量为1份',
        appliesToFactIds: ['mat-form'], evidenceIds: ['ev-quantity'],
      },
      {
        id: 'constraint-channel', kind: 'channel', text: '通过系统提交',
        appliesToFactIds: ['mat-form'], evidenceIds: ['ev-channel'],
      },
    ],
    ambiguities: [{
      id: 'ambiguity-applicability', code: 'APPLICABILITY_UNKNOWN', targetFactIds: ['condition-pass'],
      message: '是否通过初审尚不确定', evidenceIds: ['ev-condition'],
    }],
    evidence: evidenceEntries,
  }
}

function informationOnlyLedger() {
  const sourceText = '服务窗口将于9月15日暂停办理，仅供知悉。'
  return {
    schemaVersion: R10_FACT_LEDGER_SCHEMA_VERSION,
    referenceTime: '2026-08-24T08:00:00+08:00', timezone: 'Asia/Shanghai', sourceText,
    obligations: [{
      id: 'ob-info', actor: null, modality: 'informational', actionPredicate: '知悉', object: '服务窗口暂停办理',
      materialIds: [], timeExpressionIds: [], eventIds: ['event-info'], conditionIds: [], constraintIds: [], evidenceIds: ['ev-info'],
    }], materials: [],
    timeExpressions: [{
      id: 'time-info', rawText: '9月15日', role: 'event_start', precision: 'date_only',
      normalizedValue: '2026-09-15', endNormalizedValue: null, timezone: 'Asia/Shanghai', needsConfirmation: false,
      relatedObligationIds: [], relatedEventIds: ['event-info'], supersedesTimeExpressionId: null, evidenceIds: ['ev-info'],
    }],
    events: [{
      id: 'event-info', title: '服务窗口暂停办理', actor: null, location: null,
      startTimeExpressionId: 'time-info', endTimeExpressionId: null, conditionIds: [], evidenceIds: ['ev-info'],
    }],
    conditions: [], constraints: [], ambiguities: [],
    evidence: [evidence(sourceText, 'ev-info', '服务窗口将于9月15日暂停办理')],
  }
}

const RESULT_KEYS = [
  'schemaVersion', 'promptVersion', 'modelName', 'createdAt', 'sourceSummary', 'projectMatch', 'projectSuggestion',
  'milestones', 'standaloneTasks', 'materials', 'timePoints', 'events', 'evidence', 'conflicts', 'ambiguities',
  'ignoredContent', 'quality',
]

const MODEL_EXECUTION = Object.freeze({
  requestedModel: 'same-screening-model',
  returnedModel: 'same-screening-model',
  executionModel: 'same-screening-model',
  resultModelName: 'same-screening-model',
})

function planLedger(ledger, options = {}) {
  return planR10FactLedger(buildR10PlannerInput(ledger), {
    sourceMetadata: {
      sourceId: 'anonymous-source-1',
      title: '匿名通知',
      sourceType: 'text',
      notificationType: 'uncertain',
      summary: '',
      ...options.sourceMetadata,
    },
    modelExecution: options.modelExecution ?? MODEL_EXECUTION,
    createdAt: options.createdAt ?? ledger.referenceTime,
  })
}

test('R10 contract accepts all frozen E2.5 enum extensions', () => {
  assert.deepEqual(validateR10FactLedger(richLedger()), [])
})

test('R10 contract rejects model-smuggled fields and unsafe unknown time precision', () => {
  const withExtra = richLedger()
  withExtra.obligations[0].plannerHint = 'create two tasks'
  assert.equal(validateR10FactLedger(withExtra).some((item) => item.code === 'FACT_SHAPE'), true)

  const unsafe = richLedger()
  unsafe.timeExpressions.find((item) => item.id === 'time-other').normalizedValue = '2026-09-20'
  assert.equal(validateR10FactLedger(unsafe).some((item) => item.code === 'UNSAFE_TIME_NORMALIZATION'), true)
})

test('R10 contract rejects empty or source-out-of-bounds evidence even when slice clamping would match', () => {
  const empty = richLedger()
  empty.evidence[0] = {
    ...empty.evidence[0], quote: '', start: empty.sourceText.length, end: empty.sourceText.length + 1,
  }
  assert.equal(validateR10FactLedger(empty).some((item) => item.code === 'INVALID_EVIDENCE_SPAN'), true)

  const outOfBounds = richLedger()
  const start = outOfBounds.evidence[0].start
  outOfBounds.evidence[0] = {
    ...outOfBounds.evidence[0], quote: outOfBounds.sourceText.slice(start), end: outOfBounds.sourceText.length + 50,
  }
  assert.equal(validateR10FactLedger(outOfBounds).some((item) => item.code === 'INVALID_EVIDENCE_SPAN'), true)

  const plannerInput = buildR10PlannerInput(richLedger())
  plannerInput.sourceLength = plannerInput.evidence[0].end - 1
  assert.equal(validateR10PlannerInput(plannerInput).some((item) => item.code === 'INVALID_EVIDENCE_SPAN'), true)
})

test('R10 bridge strips source text, deduplicates references, and preserves fact semantics', () => {
  const ledger = richLedger()
  const snapshot = structuredClone(ledger)
  const before = r10LedgerSemanticSnapshot(ledger)
  const plannerInput = buildR10PlannerInput(ledger)
  assert.equal('sourceText' in plannerInput, false)
  assert.equal(plannerInput.obligations[0].materialIds.length, 1)
  assert.equal(r10LedgerSemanticSnapshot(plannerInput), before)
  assert.deepEqual(ledger, snapshot)
  assert.deepEqual(validateR10PlannerInput(plannerInput), [])
})

test('R10 bridge has no fact inference or semantic mutation permission', () => {
  assert.deepEqual(R10_BRIDGE_PERMISSIONS, {
    mayReadSourceTextForInference: false,
    mayAddOrDeleteFacts: false,
    mayChangeFactMeaning: false,
    mayChangeTimeRoleOrValue: false,
    mayCloseMissingRelations: false,
    mayDropDanglingReferences: false,
    mayDeduplicateReferences: true,
    stripsSourceText: true,
  })
})

test('R10 Planner emits strict RecognitionResult arrays plus a separate complete trace', () => {
  const ledger = richLedger()
  const { result, planningTrace } = planLedger(ledger, {
    sourceMetadata: { title: '报名通知', sourceType: 'text', notificationType: 'registration_notice', summary: '匿名摘要' },
  })
  assert.deepEqual(Object.keys(result).sort(), RESULT_KEYS.sort())
  assert.equal(result.schemaVersion, '2.0')
  assert.equal(result.modelName, 'same-screening-model')
  assert.equal(result.projectMatch.decision, 'uncertain')
  assert.equal(result.projectSuggestion, null)
  assert.deepEqual(result.milestones, [])
  assert.equal(planningTrace.schemaVersion, R10_PLANNING_TRACE_SCHEMA_VERSION)
  assert.equal(planningTrace.plannerVersion, R10_ISOLATED_PLANNER_VERSION)

  const expectedFactIds = new Set([
    ...ledger.obligations, ...ledger.materials, ...ledger.timeExpressions, ...ledger.events,
    ...ledger.conditions, ...ledger.constraints, ...ledger.ambiguities,
  ].map((item) => item.id))
  assert.deepEqual(new Set(planningTrace.bindings.map((item) => item.factId)), expectedFactIds)
})

test('R10 Planner collapses only exact duplicate obligation structures', () => {
  const { result, planningTrace } = planLedger(richLedger())
  assert.equal(result.standaloneTasks.length, 2)
  const submission = result.standaloneTasks.find((item) => item.actionVerb === '提交')
  assert.equal(submission.selected, false)
  const submissionBindings = planningTrace.bindings.filter((item) => item.entityType === 'task' && item.entityId === submission.tempId)
  assert.deepEqual(submissionBindings.filter((item) => item.factType === 'obligation').map((item) => item.factId).sort(), ['ob-submit-1', 'ob-submit-2'])
  assert.equal(new Set(submissionBindings.map((item) => item.entityId)).size, 1)
})

test('R10 Planner preserves actors and permits no free-form Task field injection', () => {
  const ledger = richLedger()
  ledger.obligations[0].actor = '通过初审者'
  ledger.obligations[1].actor = '通过初审者'
  ledger.obligations.find((item) => item.id === 'ob-prohibited').actor = '所有同学'
  ledger.events[0].actor = '说明会组织方'
  const { result, planningTrace } = planLedger(ledger)
  const task = result.standaloneTasks.find((item) => item.actionVerb === '提交')
  const event = result.events[0]
  assert.equal(task.title, '提交报名表')
  assert.equal(task.description, '提交报名表；适用对象：通过初审者；适用条件：仅通过初审者执行')
  assert.deepEqual(task.completionCriteria, [])
  assert.deepEqual(task.dependencyTempIds, [])
  assert.equal(event.description, '说明会；适用对象：说明会组织方')
  assert.equal(result.conflicts[0].message, '禁止所有同学：转发名单')
  assert.deepEqual(planningTrace.semantics.obligationActors.find((item) => item.factId === 'ob-submit-1'), {
    factId: 'ob-submit-1', actor: '通过初审者',
  })
  assert.deepEqual(planningTrace.semantics.eventActors, [{ factId: 'event-briefing', actor: '说明会组织方' }])

  const informationLedger = informationOnlyLedger()
  informationLedger.obligations[0].actor = '全体同学'
  const information = planLedger(informationLedger).result
  assert.deepEqual(information.ignoredContent, [{
    text: '适用对象：全体同学；知悉服务窗口暂停办理', reason: 'background',
  }])
})

test('R10 optional action is unselected while prohibited, Material, Event, and TimePoint do not masquerade as Tasks', () => {
  const { result } = planLedger(richLedger())
  assert.deepEqual(result.standaloneTasks.map((item) => item.actionVerb), ['提交', '阅读'])
  assert.equal(result.standaloneTasks.find((item) => item.actionVerb === '阅读').selected, false)
  assert.equal(result.materials.length, 1)
  assert.equal(result.events.length, 1)
  assert.equal(result.timePoints.length, 2)
  assert.equal(result.conflicts.some((item) => item.message === '禁止：转发名单'), true)
  assert.equal(result.sourceSummary.requiresAction, true)
})

test('R10 pure-information notification keeps Event and TimePoint with zero Tasks', () => {
  const { result } = planLedger(informationOnlyLedger(), {
    sourceMetadata: { title: '窗口通知', notificationType: 'information_only' },
  })
  assert.equal(result.standaloneTasks.length, 0)
  assert.equal(result.events.length, 1)
  assert.equal(result.timePoints.length, 1)
  assert.equal(result.sourceSummary.requiresAction, false)
  assert.deepEqual(result.ignoredContent, [{ text: '知悉服务窗口暂停办理', reason: 'background' }])
})

test('R10 safely degrades range and unknown time without forging a 2.0 role', () => {
  const { result, planningTrace } = planLedger(richLedger())
  const range = result.timePoints.find((item) => item.tempId === 'time-range')
  assert.equal(range.type, 'submission_deadline')
  assert.equal(range.precision, 'vague')
  assert.equal(range.normalizedValue, null)
  assert.equal(range.needsConfirmation, true)
  assert.equal(result.timePoints.some((item) => ['superseded_deadline', 'other'].includes(item.type)), false)
  assert.equal(result.ambiguities.some((item) => item.field === 'superseded_deadline'), true)
  assert.equal(result.ambiguities.some((item) => item.field === 'other'), true)
  assert.equal(planningTrace.bindings.some((item) => item.factId === 'time-old' && item.entityType === 'ambiguity'), true)
  assert.equal(planningTrace.bindings.some((item) => item.factId === 'time-other' && item.entityType === 'ambiguity'), true)
  assert.deepEqual(planningTrace.semantics.timeExpressions.find((item) => item.factId === 'time-range'), {
    factId: 'time-range',
    rawText: '9月10日至9月12日',
    role: 'submission_deadline',
    precision: 'range',
    normalizedValue: '2026-09-10',
    endNormalizedValue: '2026-09-12',
    timezone: 'Asia/Shanghai',
    needsConfirmation: false,
    supersedesTimeExpressionId: 'time-old',
  })
  assert.deepEqual(planningTrace.semantics.conditionApplications, [{
    factId: 'condition-pass', appliesToFactIds: ['ob-submit-1', 'ob-submit-2'],
  }])
  assert.deepEqual(planningTrace.semantics.ambiguityTargets, [{
    factId: 'ambiguity-applicability', targetFactIds: ['condition-pass'],
  }])
})

test('R10 safely structures unique material quantity and channel constraints', () => {
  const { result, planningTrace } = planLedger(richLedger())
  assert.deepEqual(result.materials[0].namingRequirements, ['文件命名为学号'])
  assert.equal(result.materials[0].required, false)
  assert.equal(result.materials[0].selected, false)
  assert.equal(result.materials[0].quantity, 1)
  assert.equal(result.materials[0].submissionChannel, '通过系统提交')
  assert.deepEqual(result.ignoredContent.filter((item) => ['提交数量为1份', '通过系统提交'].includes(item.text)), [])
  assert.deepEqual(R10_CONSTRAINT_PROJECTION_POLICY, {
    materialStructuredKinds: ['format', 'naming', 'quantity', 'channel'],
    conditionallyStructuredKinds: ['quantity', 'channel'],
    traceOnlyKinds: ['location', 'dependency', 'other'],
    unsafeRepresentation: 'ignoredContent',
    quantityParser: 'single-explicit-number-plus-unit-1-to-100',
    channelMapping: 'single-constraint-single-material-exact-text',
  })
  assert.deepEqual(planningTrace.semantics.constraintApplications, [
    { factId: 'constraint-channel', kind: 'channel', appliesToFactIds: ['mat-form'] },
    { factId: 'constraint-name', kind: 'naming', appliesToFactIds: ['mat-form'] },
    { factId: 'constraint-quantity', kind: 'quantity', appliesToFactIds: ['mat-form'] },
  ])
  assert.equal(planningTrace.bindings.some((item) => item.factId === 'constraint-name' && item.entityType === 'material'), true)
  assert.equal(planningTrace.bindings.some((item) => item.factId === 'constraint-quantity' && item.entityType === 'material'), true)
  assert.equal(planningTrace.bindings.some((item) => item.factId === 'constraint-channel' && item.entityType === 'material'), true)
})

test('R10 quantity and channel parsing rejects ambiguous, out-of-range, or non-unique projections', async () => {
  const ambiguousQuantity = richLedger()
  ambiguousQuantity.sourceText = ambiguousQuantity.sourceText.replace('提交数量为1份', '提交1份或2份')
  ambiguousQuantity.constraints.find((item) => item.id === 'constraint-quantity').text = '提交1份或2份'
  ambiguousQuantity.evidence = ambiguousQuantity.evidence.map((item) => evidence(
    ambiguousQuantity.sourceText,
    item.id,
    item.id === 'ev-quantity' ? '提交1份或2份' : item.quote,
  ))
  const ambiguous = planLedger(ambiguousQuantity)
  assert.equal(ambiguous.result.materials[0].quantity, null)
  assert.equal(ambiguous.result.ignoredContent.some((item) => item.text === '提交1份或2份'), true)

  const outOfRangeQuantity = richLedger()
  outOfRangeQuantity.sourceText = outOfRangeQuantity.sourceText.replace('提交数量为1份', '提交101份')
  outOfRangeQuantity.constraints.find((item) => item.id === 'constraint-quantity').text = '提交101份'
  outOfRangeQuantity.evidence = outOfRangeQuantity.evidence.map((item) => evidence(
    outOfRangeQuantity.sourceText,
    item.id,
    item.id === 'ev-quantity' ? '提交101份' : item.quote,
  ))
  assert.equal(planLedger(outOfRangeQuantity).result.materials[0].quantity, null)

  const chineseQuantity = richLedger()
  chineseQuantity.sourceText = chineseQuantity.sourceText.replace('提交数量为1份', '提交十二份')
  chineseQuantity.constraints.find((item) => item.id === 'constraint-quantity').text = '提交十二份'
  chineseQuantity.evidence = chineseQuantity.evidence.map((item) => evidence(
    chineseQuantity.sourceText,
    item.id,
    item.id === 'ev-quantity' ? '提交十二份' : item.quote,
  ))
  assert.equal(planLedger(chineseQuantity).result.materials[0].quantity, 12)

  const duplicateChannel = richLedger()
  duplicateChannel.sourceText += '另通过邮箱提交。'
  duplicateChannel.evidence.push(evidence(duplicateChannel.sourceText, 'ev-channel-alt', '通过邮箱提交'))
  duplicateChannel.constraints.push({
    id: 'constraint-channel-alt', kind: 'channel', text: '通过邮箱提交',
    appliesToFactIds: ['mat-form'], evidenceIds: ['ev-channel-alt'],
  })
  const duplicate = planLedger(duplicateChannel)
  assert.equal(duplicate.result.materials[0].submissionChannel, null)
  assert.deepEqual(
    duplicate.result.ignoredContent.filter((item) => item.text.includes('提交') && item.reason === 'other').map((item) => item.text),
    ['通过系统提交', '通过邮箱提交'],
  )
  const report = await validateR10LedgerPlan({
    ledger: duplicateChannel,
    result: duplicate.result,
    trace: duplicate.planningTrace,
    ledgerSha256: await canonicalR10Sha256(duplicateChannel),
    resultSha256: await canonicalR10Sha256(duplicate.result),
  })
  assert.equal(report.status, 'NO_ISSUE', JSON.stringify(report.issues))
})

test('R10 standard entities retain literal evidence references without private extension fields', () => {
  const { result } = planLedger(richLedger())
  const entities = [
    ...result.standaloneTasks, ...result.materials, ...result.timePoints, ...result.events, ...result.ambiguities, ...result.conflicts,
  ]
  assert.equal(entities.every((item) => Array.isArray(item.evidenceIds) && item.evidenceIds.length > 0), true)
  assert.equal(result.timePoints.every((item) => !('ledgerTimeRole' in item) && !('endNormalizedValue' in item)), true)
  assert.equal(result.standaloneTasks.every((item) => !('ledgerFactIds' in item)), true)
})

test('R10 Planner output passes the independent ledger-plan Validator', async () => {
  const ledger = richLedger()
  const { result, planningTrace } = planLedger(ledger)
  const report = await validateR10LedgerPlan({
    ledger,
    result,
    trace: planningTrace,
    ledgerSha256: await canonicalR10Sha256(ledger),
    resultSha256: await canonicalR10Sha256(result),
  })
  assert.equal(report.status, 'NO_ISSUE', JSON.stringify(report.issues))
  assert.equal(report.safeToProceed, true)
})

test('R10 Planner requires server-injected model identity and actual source evidence location', () => {
  assert.throws(() => planR10FactLedger(buildR10PlannerInput(richLedger()), {
    sourceMetadata: { sourceId: 'anonymous-source-1' },
    modelExecution: { ...MODEL_EXECUTION, resultModelName: 'wrong-model' },
  }), /R10_MODEL_IDENTITY_MISMATCH/u)
  assert.throws(() => planR10FactLedger(buildR10PlannerInput(richLedger()), {
    sourceMetadata: {}, modelExecution: MODEL_EXECUTION,
  }), /R10_SOURCE_METADATA_INVALID/u)
  const { result, planningTrace } = planLedger(richLedger())
  assert.equal(result.evidence.every((item) => item.sourceId === 'anonymous-source-1' && Number.isInteger(item.textStart) && Number.isInteger(item.textEnd)), true)
  assert.equal(planningTrace.bindings.some((item) => item.factType === 'condition' && item.entityType === 'task'), true)
  assert.equal(result.ambiguities.some((item) => item.field === 'condition:eligibility'), false)
})

test('R10 modules remain isolated from Production runtime', async () => {
  const [worker, recognition] = await Promise.all([
    readFile(new URL('./worker.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./recognition.mjs', import.meta.url), 'utf8'),
  ])
  assert.doesNotMatch(worker, /e2-r10/u)
  assert.doesNotMatch(recognition, /e2-r10/u)
})
