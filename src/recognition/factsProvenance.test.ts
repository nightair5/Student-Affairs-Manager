import { describe, expect, it } from 'vitest'
import {
  PROVENANCE_FACT_SCHEMA_VERSION,
  PROVENANCE_FACT_MODEL_STATUS,
  PROVENANCE_FACT_PROMPT_VERSION,
  composeRecognitionFromProvenanceFacts,
  createParserVerifiedSpan,
  indexProvenanceSource,
  type ProvenanceFactLedger,
  validateProvenanceFactLedger,
} from './factsProvenance'

const referenceTime = new Date('2026-09-03T08:00:00+08:00')

function spanned(source: string, text: string, occurrence = 0) {
  return { value: text, span: createParserVerifiedSpan(source, text, occurrence) }
}

function validLedger(source: string): ProvenanceFactLedger {
  return {
    schemaVersion: PROVENANCE_FACT_SCHEMA_VERSION,
    source: {
      title: '报名与答辩通知',
      sourceType: 'text',
      notificationType: 'material_submission',
      summary: '报名与答辩安排',
      requiresAction: true,
      actionReason: '原文明示提交报名表',
    },
    actions: [{
      action: '提交',
      actionSpan: createParserVerifiedSpan(source, '提交'),
      object: spanned(source, '报名表'),
      description: null,
      inferenceLevel: 'explicit',
    }],
    times: [
      { type: 'submission_deadline', rawText: spanned(source, '9月10日') },
      { type: 'event_start', rawText: spanned(source, '9月12日') },
    ],
    materials: [{
      name: spanned(source, '报名表'),
      required: true,
      requiredSpan: createParserVerifiedSpan(source, '必交'),
      formatRequirements: [spanned(source, 'PDF格式')],
      namingRequirements: [],
      quantity: null,
      submissionChannel: null,
    }],
    events: [{
      title: spanned(source, '答辩'),
      description: null,
      location: spanned(source, '学生活动中心'),
      inferenceLevel: 'explicit',
    }],
    constraints: [],
    relations: [
      {
        type: 'action_time', actionIndex: 0, timeIndex: 0,
        assertionSpan: createParserVerifiedSpan(source, '9月10日前提交报名表'),
      },
      {
        type: 'action_material', actionIndex: 0, materialIndex: 0,
        materialMentionSpan: createParserVerifiedSpan(source, '报名表'),
        assertionSpan: createParserVerifiedSpan(source, '提交报名表'),
      },
      {
        type: 'material_attribute', materialIndex: 0, field: 'required', valueIndex: null,
        materialMentionSpan: createParserVerifiedSpan(source, '报名表', 1),
        assertionSpan: createParserVerifiedSpan(source, '报名表为必交'),
      },
      {
        type: 'material_attribute', materialIndex: 0, field: 'format', valueIndex: 0,
        materialMentionSpan: createParserVerifiedSpan(source, '报名表', 2),
        assertionSpan: createParserVerifiedSpan(source, '报名表要求PDF格式'),
      },
      {
        type: 'event_time', eventIndex: 0, timeIndex: 1, role: 'start',
        eventMentionSpan: createParserVerifiedSpan(source, '答辩'),
        assertionSpan: createParserVerifiedSpan(source, '答辩将于9月12日'),
      },
      {
        type: 'event_location', eventIndex: 0,
        eventMentionSpan: createParserVerifiedSpan(source, '答辩', 1),
        assertionSpan: createParserVerifiedSpan(source, '答辩地点：学生活动中心'),
      },
    ],
  }
}

function actionOnlyLedger(source: string, action = '提交', object = '报名表'): ProvenanceFactLedger {
  return {
    schemaVersion: PROVENANCE_FACT_SCHEMA_VERSION,
    source: {
      title: '事务通知', sourceType: 'text', notificationType: 'teacher_task', summary: '',
      requiresAction: true, actionReason: '原文明示行动',
    },
    actions: [{
      action,
      actionSpan: createParserVerifiedSpan(source, action),
      object: spanned(source, object),
      description: null,
      inferenceLevel: 'explicit',
    }],
    times: [], materials: [], events: [], constraints: [], relations: [],
  }
}

function issueCodes(value: unknown, source: string): string[] {
  return validateProvenanceFactLedger(value, source).issues.map((issue) => issue.code)
}

describe('RCO-5-003 parser-verified provenance contract', () => {
  const source = '请于9月10日前提交报名表。报名表为必交。报名表要求PDF格式。答辩将于9月12日举行。答辩地点：学生活动中心。'

  it('uses a new isolated schema and never claims a model run', () => {
    expect(PROVENANCE_FACT_SCHEMA_VERSION).toBe('facts-1.7')
    expect(PROVENANCE_FACT_PROMPT_VERSION).toBe('recognition-facts-first-1.7.0')
    expect(PROVENANCE_FACT_MODEL_STATUS).toBe('NOT_RUN')
  })

  it('builds stable parser segments and exact source offsets', () => {
    const segments = indexProvenanceSource(source)
    const span = createParserVerifiedSpan(source, '9月10日')
    expect(segments).toHaveLength(5)
    expect(source.slice(span.start, span.end)).toBe('9月10日')
    expect(span.segmentId).toBe('segment-1')
  })

  it('accepts explicit minimal relations and composes only linked fields', () => {
    const ledger = validLedger(source)
    expect(validateProvenanceFactLedger(ledger, source)).toEqual({ valid: true, issues: [] })
    const result = composeRecognitionFromProvenanceFacts(ledger, {
      sourceContent: source,
      sourceId: 'source-rco-5-003',
      referenceTime,
      timezone: 'Asia/Shanghai',
      createdAt: '2026-09-03T00:00:00.000Z',
    })
    expect(result.standaloneTasks[0]).toMatchObject({ title: '提交报名表', selected: true, materialTempIds: ['material-1'], timePointTempIds: ['time-1'] })
    expect(result.materials[0]).toMatchObject({ selected: true, formatRequirements: ['PDF格式'] })
    expect(result.timePoints[0]).toMatchObject({ selected: true, relatedTaskTempIds: ['task-1'] })
    expect(result.events[0]).toMatchObject({ selected: true, startTimePointTempId: 'time-2', location: '学生活动中心' })
    expect(result.evidence.every((item) => source.slice(item.textStart, item.textEnd) === item.quote)).toBe(true)
  })

  it('rejects forged offsets even when the quoted text exists elsewhere', () => {
    const ledger = validLedger(source)
    ledger.actions[0].actionSpan.start += 1
    ledger.actions[0].actionSpan.end += 1
    expect(issueCodes(ledger, source)).toContain('SPAN_TEXT_MISMATCH')
  })

  it('rejects a field value that differs from its exact span', () => {
    const ledger = validLedger(source)
    ledger.times[0].rawText.value = '9月11日'
    expect(issueCodes(ledger, source)).toContain('FIELD_VALUE_SPAN_MISMATCH')
  })

  it('rejects relation spans expanded beyond the exact endpoints', () => {
    const ledger = validLedger(source)
    ledger.relations[0].assertionSpan = createParserVerifiedSpan(source, '请于9月10日前提交报名表')
    expect(issueCodes(ledger, source)).toContain('RELATION_SPAN_NOT_MINIMAL')
  })

  it('rejects assigning one action the time of a neighboring action', () => {
    const text = '请于9月5日前提交报名表，并于9月8日前上传成绩单。'
    const ledger: ProvenanceFactLedger = {
      ...actionOnlyLedger(text),
      actions: [
        { action: '提交', actionSpan: createParserVerifiedSpan(text, '提交'), object: spanned(text, '报名表'), description: null, inferenceLevel: 'explicit' },
        { action: '上传', actionSpan: createParserVerifiedSpan(text, '上传'), object: spanned(text, '成绩单'), description: null, inferenceLevel: 'explicit' },
      ],
      times: [
        { type: 'submission_deadline', rawText: spanned(text, '9月5日') },
        { type: 'submission_deadline', rawText: spanned(text, '9月8日') },
      ],
      relations: [{
        type: 'action_time', actionIndex: 1, timeIndex: 0,
        assertionSpan: createParserVerifiedSpan(text, '9月5日前提交报名表，并于9月8日前上传成绩单'),
      }],
    }
    expect(issueCodes(ledger, text)).toEqual(expect.arrayContaining(['RELATION_CONTAINS_FOREIGN_ENTITY', 'RELATION_ASSERTION_UNSUPPORTED']))
  })

  it('rejects borrowing a format from a neighboring material', () => {
    const text = '请提交报名表和成绩单，成绩单要求PDF格式。'
    const ledger: ProvenanceFactLedger = {
      ...actionOnlyLedger(text, '提交', '报名表和成绩单'),
      materials: [{
        name: spanned(text, '报名表'), required: false, requiredSpan: createParserVerifiedSpan(text, '报名表'),
        formatRequirements: [spanned(text, 'PDF格式')], namingRequirements: [], quantity: null, submissionChannel: null,
      }],
      relations: [{
        type: 'material_attribute', materialIndex: 0, field: 'format', valueIndex: 0,
        materialMentionSpan: createParserVerifiedSpan(text, '报名表'),
        assertionSpan: createParserVerifiedSpan(text, '报名表和成绩单，成绩单要求PDF格式'),
      }],
    }
    expect(issueCodes(ledger, text)).toContain('RELATION_ASSERTION_UNSUPPORTED')
  })

  it('rejects material names extracted from inside a longer entity', () => {
    const text = '请提交预报名表。'
    const ledger: ProvenanceFactLedger = {
      ...actionOnlyLedger(text, '提交', '预报名表'),
      materials: [{
        name: spanned(text, '报名表'), required: true, requiredSpan: createParserVerifiedSpan(text, '提交'),
        formatRequirements: [], namingRequirements: [], quantity: null, submissionChannel: null,
      }],
      relations: [{
        type: 'action_material', actionIndex: 0, materialIndex: 0,
        materialMentionSpan: createParserVerifiedSpan(text, '报名表'),
        assertionSpan: createParserVerifiedSpan(text, '提交预报名表'),
      }],
    }
    expect(issueCodes(ledger, text)).toEqual(expect.arrayContaining(['MATERIAL_NAME_BOUNDARY_INVALID', 'RELATION_ASSERTION_UNSUPPORTED']))
  })

  it('rejects a relation mention borrowed from a longer material even when the primary mention is valid', () => {
    const text = '报名表为必交。预报名表要求PDF格式。'
    const ledger: ProvenanceFactLedger = {
      schemaVersion: PROVENANCE_FACT_SCHEMA_VERSION,
      source: { title: '材料通知', sourceType: 'text', notificationType: 'material_submission', summary: '', requiresAction: false, actionReason: '' },
      actions: [], times: [], events: [], constraints: [],
      materials: [{
        name: spanned(text, '报名表'), required: true, requiredSpan: createParserVerifiedSpan(text, '必交'),
        formatRequirements: [spanned(text, 'PDF格式')], namingRequirements: [], quantity: null, submissionChannel: null,
      }],
      relations: [{
        type: 'material_attribute', materialIndex: 0, field: 'format', valueIndex: 0,
        materialMentionSpan: createParserVerifiedSpan(text, '报名表', 1),
        assertionSpan: createParserVerifiedSpan(text, '报名表要求PDF格式'),
      }],
    }
    expect(issueCodes(ledger, text)).toContain('RELATION_MATERIAL_BOUNDARY_INVALID')
  })

  it('rejects a material quantity whose numeric value differs from the source span', () => {
    const text = '报名表共12份。'
    const ledger: ProvenanceFactLedger = {
      schemaVersion: PROVENANCE_FACT_SCHEMA_VERSION,
      source: { title: '材料通知', sourceType: 'text', notificationType: 'information_only', summary: '', requiresAction: false, actionReason: '' },
      actions: [], times: [], events: [], constraints: [], relations: [],
      materials: [{
        name: spanned(text, '报名表'), required: false, requiredSpan: createParserVerifiedSpan(text, '报名表'),
        formatRequirements: [], namingRequirements: [], quantity: { value: 2, span: createParserVerifiedSpan(text, '12份') }, submissionChannel: null,
      }],
    }
    expect(issueCodes(ledger, text)).toContain('MATERIAL_QUANTITY_VALUE_MISMATCH')
  })

  it('rejects event names extracted from inside a longer event name', () => {
    const text = '预答辩将于9月12日举行。'
    const ledger: ProvenanceFactLedger = {
      ...actionOnlyLedger('请提交报名表。'),
      source: { title: '事件通知', sourceType: 'text', notificationType: 'event_notice', summary: '', requiresAction: true, actionReason: '事件安排' },
      actions: [],
      times: [{ type: 'event_start', rawText: spanned(text, '9月12日') }],
      events: [{ title: spanned(text, '答辩'), description: null, location: null, inferenceLevel: 'explicit' }],
      relations: [{
        type: 'event_time', eventIndex: 0, timeIndex: 0, role: 'start', eventMentionSpan: createParserVerifiedSpan(text, '答辩'),
        assertionSpan: createParserVerifiedSpan(text, '答辩将于9月12日'),
      }],
    }
    expect(issueCodes(ledger, text)).toContain('EVENT_TITLE_BOUNDARY_INVALID')
  })

  it('rejects a relation event mention borrowed from a longer event name', () => {
    const text = '答辩地点：第一会议室。预答辩地点：第二会议室。'
    const ledger: ProvenanceFactLedger = {
      schemaVersion: PROVENANCE_FACT_SCHEMA_VERSION,
      source: { title: '事件通知', sourceType: 'text', notificationType: 'information_only', summary: '', requiresAction: false, actionReason: '' },
      actions: [], times: [], materials: [], constraints: [],
      events: [{ title: spanned(text, '答辩'), description: null, location: spanned(text, '第二会议室'), inferenceLevel: 'optional_suggestion' }],
      relations: [{
        type: 'event_location', eventIndex: 0, eventMentionSpan: createParserVerifiedSpan(text, '答辩', 1),
        assertionSpan: createParserVerifiedSpan(text, '答辩地点：第二会议室'),
      }],
    }
    expect(issueCodes(ledger, text)).toContain('RELATION_EVENT_BOUNDARY_INVALID')
  })

  it('rejects nominal phrases that merely contain an ambiguous action word', () => {
    const text = '报名入口已关闭。'
    expect(issueCodes(actionOnlyLedger(text, '报名', '入口'), text)).toContain('ACTION_ASSERTION_UNSUPPORTED')
  })

  it('rejects selecting a shorter action object from a longer noun phrase', () => {
    const text = '提交报名表入口已关闭。'
    expect(issueCodes(actionOnlyLedger(text), text)).toContain('ACTION_ASSERTION_UNSUPPORTED')
  })

  it('accepts a clearly directed ambiguous action', () => {
    const text = '请报名创新创业比赛。'
    expect(validateProvenanceFactLedger(actionOnlyLedger(text, '报名', '创新创业比赛'), text).valid).toBe(true)
  })

  it('keeps every suggestion unselected when a later cancellation has unresolved scope', () => {
    const text = '请提交报名表。该安排已取消。'
    const result = composeRecognitionFromProvenanceFacts(actionOnlyLedger(text), {
      sourceContent: text, sourceId: 'source-cancelled', referenceTime, timezone: 'Asia/Shanghai',
    })
    expect(result.standaloneTasks[0].selected).toBe(false)
    expect(result.ambiguities.some((item) => item.id === 'ambiguity-cancellation')).toBe(true)
  })

  it('keeps an unlinked time visible but unselected and requiring confirmation', () => {
    const text = '请提交报名表。结果将在9月20日公布。'
    const ledger = actionOnlyLedger(text)
    ledger.times = [{ type: 'result_announcement', rawText: spanned(text, '9月20日') }]
    const result = composeRecognitionFromProvenanceFacts(ledger, {
      sourceContent: text, sourceId: 'source-unlinked-time', referenceTime, timezone: 'Asia/Shanghai',
    })
    expect(result.timePoints[0]).toMatchObject({ selected: false, needsConfirmation: true, relatedTaskTempIds: [] })
    expect(result.ambiguities.some((item) => item.id === 'ambiguity-time-1')).toBe(true)
  })

  it('rejects expanding a result date into a submission deadline relation', () => {
    const text = '结果9月20日前公示后提交报名表。'
    const ledger = actionOnlyLedger(text)
    ledger.times = [{ type: 'submission_deadline', rawText: spanned(text, '9月20日') }]
    ledger.relations = [{
      type: 'action_time', actionIndex: 0, timeIndex: 0,
      assertionSpan: createParserVerifiedSpan(text, '9月20日前公示后提交报名表'),
    }]
    expect(issueCodes(ledger, text)).toContain('RELATION_ASSERTION_UNSUPPORTED')
  })

  it('rejects attaching a neighboring material constraint to an action', () => {
    const text = '提交报名表，成绩单要求PDF格式。'
    const ledger = actionOnlyLedger(text)
    ledger.constraints = [{ kind: 'format_requirement', text: spanned(text, '成绩单要求PDF格式') }]
    ledger.relations = [{
      type: 'action_constraint', actionIndex: 0, constraintIndex: 0,
      assertionSpan: createParserVerifiedSpan(text, '提交报名表，成绩单要求PDF格式'),
    }]
    expect(issueCodes(ledger, text)).toContain('RELATION_ASSERTION_UNSUPPORTED')
  })

  it('keeps unlinked material attributes out of the auto-selected output', () => {
    const text = '请提交报名表。成绩单要求PDF格式。'
    const ledger = actionOnlyLedger(text)
    ledger.materials = [{
      name: spanned(text, '成绩单'), required: true, requiredSpan: createParserVerifiedSpan(text, '成绩单'),
      formatRequirements: [spanned(text, 'PDF格式')], namingRequirements: [], quantity: null, submissionChannel: null,
    }]
    const result = composeRecognitionFromProvenanceFacts(ledger, {
      sourceContent: text, sourceId: 'source-unlinked-material', referenceTime, timezone: 'Asia/Shanghai',
    })
    expect(result.materials[0]).toMatchObject({ selected: false, formatRequirements: [], relatedTaskTempIds: [] })
    expect(result.ambiguities.some((item) => item.id === 'ambiguity-material-1')).toBe(true)
  })

  it('does not write a description borrowed from another sentence into a selected task', () => {
    const text = '请提交报名表。奖学金名单将在周五公布。'
    const ledger = actionOnlyLedger(text)
    ledger.actions[0].description = spanned(text, '奖学金名单将在周五公布')
    const result = composeRecognitionFromProvenanceFacts(ledger, {
      sourceContent: text, sourceId: 'source-description', referenceTime, timezone: 'Asia/Shanghai',
    })
    expect(result.standaloneTasks[0]).toMatchObject({ selected: true, description: '' })
    expect(result.ambiguities.some((item) => item.id === 'ambiguity-action-description-1')).toBe(true)
  })

  it('does not let an earlier negative clause cancel a later explicit action', () => {
    const text = '无需打印纸质件，但须提交报名表。'
    const ledger = actionOnlyLedger(text)
    expect(validateProvenanceFactLedger(ledger, text).valid).toBe(true)
    const result = composeRecognitionFromProvenanceFacts(ledger, {
      sourceContent: text, sourceId: 'source-scoped-negation', referenceTime, timezone: 'Asia/Shanghai',
    })
    expect(result.standaloneTasks[0].selected).toBe(true)
  })

  it('rejects an explicitly negated action', () => {
    const text = '无需提交报名表。'
    expect(issueCodes(actionOnlyLedger(text), text)).toContain('ACTION_ASSERTION_UNSUPPORTED')
  })

  it('rejects an action negated by 不再', () => {
    const text = '不再提交报名表。'
    expect(issueCodes(actionOnlyLedger(text), text)).toContain('ACTION_ASSERTION_UNSUPPORTED')
  })

  it('rejects an action negated by 请勿', () => {
    const text = '请勿提交报名表。'
    expect(issueCodes(actionOnlyLedger(text), text)).toContain('ACTION_ASSERTION_UNSUPPORTED')
  })

  it('rejects a third-party completed action as a user task', () => {
    const text = '张老师已提交报名表。'
    expect(issueCodes(actionOnlyLedger(text), text)).toContain('ACTION_ASSERTION_UNSUPPORTED')
  })

  it('rejects an action phrase embedded in a heading-like noun phrase', () => {
    const text = '提交报名表要求说明如下。'
    expect(issueCodes(actionOnlyLedger(text), text)).toContain('ACTION_ASSERTION_UNSUPPORTED')
  })

  it('keeps all suggestions unselected when the arrangement is withdrawn', () => {
    const text = '请提交报名表。该安排已撤销。'
    const result = composeRecognitionFromProvenanceFacts(actionOnlyLedger(text), {
      sourceContent: text, sourceId: 'source-withdrawn', referenceTime, timezone: 'Asia/Shanghai',
    })
    expect(result.standaloneTasks[0].selected).toBe(false)
    expect(result.ambiguities.some((item) => item.id === 'ambiguity-cancellation')).toBe(true)
  })

  it('does not expose ledger-proposed source metadata or project titles', () => {
    const text = '请提交报名表。'
    const ledger = actionOnlyLedger(text)
    ledger.source.title = '伪造项目标题'
    ledger.source.sourceType = '伪造类型'
    ledger.source.summary = '伪造摘要'
    ledger.source.actionReason = '伪造理由'
    const result = composeRecognitionFromProvenanceFacts(ledger, {
      sourceContent: text, sourceId: 'source-metadata', referenceTime, timezone: 'Asia/Shanghai',
      sourceTitle: '用户文件.txt', sourceType: 'text/plain',
    })
    expect(result.sourceSummary).toMatchObject({ title: '用户文件.txt', sourceType: 'text/plain', summary: '' })
    expect(result.sourceSummary.actionReason).not.toContain('伪造')
    expect(result.projectMatch).toMatchObject({ decision: 'uncertain', suggestedProjectTitle: null })
  })

  it('does not promote required material state without a typed required relation', () => {
    const text = '请提交报名表。'
    const ledger = actionOnlyLedger(text)
    ledger.materials = [{
      name: spanned(text, '报名表'), required: true, requiredSpan: createParserVerifiedSpan(text, '报名表'),
      formatRequirements: [], namingRequirements: [], quantity: null, submissionChannel: null,
    }]
    ledger.relations = [{
      type: 'action_material', actionIndex: 0, materialIndex: 0,
      materialMentionSpan: createParserVerifiedSpan(text, '报名表'),
      assertionSpan: createParserVerifiedSpan(text, '提交报名表'),
    }]
    const result = composeRecognitionFromProvenanceFacts(ledger, {
      sourceContent: text, sourceId: 'source-unverified-required', referenceTime, timezone: 'Asia/Shanghai',
    })
    expect(result.standaloneTasks[0].materialTempIds).toEqual([])
    expect(result.materials[0]).toMatchObject({ required: false, selected: false })
  })

  it('rejects a required relation that omits a trailing question marker', () => {
    const text = '请提交报名表。报名表为必交吗？'
    const ledger = actionOnlyLedger(text)
    ledger.materials = [{
      name: spanned(text, '报名表'), required: true, requiredSpan: createParserVerifiedSpan(text, '必交'),
      formatRequirements: [], namingRequirements: [], quantity: null, submissionChannel: null,
    }]
    ledger.relations = [
      { type: 'action_material', actionIndex: 0, materialIndex: 0, materialMentionSpan: createParserVerifiedSpan(text, '报名表'), assertionSpan: createParserVerifiedSpan(text, '提交报名表') },
      { type: 'material_attribute', materialIndex: 0, field: 'required', valueIndex: null, materialMentionSpan: createParserVerifiedSpan(text, '报名表', 1), assertionSpan: createParserVerifiedSpan(text, '报名表为必交') },
    ]
    expect(issueCodes(ledger, text)).toContain('RELATION_CONTEXT_UNCERTAIN')
  })

  it('rejects a location relation that omits a trailing tentative qualifier', () => {
    const text = '答辩地点：第一会议室（暂定）。'
    const ledger: ProvenanceFactLedger = {
      schemaVersion: PROVENANCE_FACT_SCHEMA_VERSION,
      source: { title: '答辩通知', sourceType: 'text', notificationType: 'event_notice', summary: '', requiresAction: true, actionReason: '' },
      actions: [], times: [], materials: [], constraints: [],
      events: [{ title: spanned(text, '答辩'), description: null, location: spanned(text, '第一会议室'), inferenceLevel: 'explicit' }],
      relations: [{ type: 'event_location', eventIndex: 0, eventMentionSpan: createParserVerifiedSpan(text, '答辩'), assertionSpan: createParserVerifiedSpan(text, '答辩地点：第一会议室') }],
    }
    expect(issueCodes(ledger, text)).toContain('RELATION_CONTEXT_UNCERTAIN')
  })

  it('suppresses old deadline and material attributes when a correction is unresolved', () => {
    const text = '请于9月10日前提交报名表。报名表为必交。报名表要求PDF格式。更正：截止时间改为9月12日。'
    const ledger = validLedger('请于9月10日前提交报名表。报名表为必交。报名表要求PDF格式。答辩将于9月12日举行。答辩地点：学生活动中心。')
    ledger.events = []
    ledger.times = [ledger.times[0]]
    ledger.relations = ledger.relations.slice(0, 4)
    const result = composeRecognitionFromProvenanceFacts(ledger, {
      sourceContent: text, sourceId: 'source-corrected', referenceTime, timezone: 'Asia/Shanghai',
    })
    expect(result.standaloneTasks[0]).toMatchObject({ selected: false, materialTempIds: [] })
    expect(result.timePoints[0]).toMatchObject({ selected: false, needsConfirmation: true })
    expect(result.materials[0]).toMatchObject({ selected: false, required: false, formatRequirements: [] })
  })

  it('rejects a time field expanded beyond temporal text', () => {
    const text = '9月20日公布结果后提交报名表。'
    const ledger = actionOnlyLedger(text)
    ledger.times = [{ type: 'submission_deadline', rawText: spanned(text, '9月20日公布结果后') }]
    ledger.relations = [{
      type: 'action_time', actionIndex: 0, timeIndex: 0,
      assertionSpan: createParserVerifiedSpan(text, '9月20日公布结果后提交报名表'),
    }]
    expect(issueCodes(ledger, text)).toContain('TIME_RAW_SPAN_NOT_PURE')
  })

  it('rejects a constraint that contains a different action', () => {
    const text = '请提交报名表，必须上传成绩单。'
    const ledger = actionOnlyLedger(text)
    ledger.constraints = [{ kind: 'format_requirement', text: spanned(text, '必须上传成绩单') }]
    ledger.relations = [{
      type: 'action_constraint', actionIndex: 0, constraintIndex: 0,
      assertionSpan: createParserVerifiedSpan(text, '提交报名表，必须上传成绩单'),
    }]
    expect(issueCodes(ledger, text)).toContain('RELATION_ASSERTION_UNSUPPORTED')
  })

  it('rejects a constraint that contains an independently controlled action alias', () => {
    const text = '请提交报名表，必须开具在读证明。'
    const ledger = actionOnlyLedger(text)
    ledger.constraints = [{ kind: 'other', text: spanned(text, '必须开具在读证明') }]
    ledger.relations = [{ type: 'action_constraint', actionIndex: 0, constraintIndex: 0, assertionSpan: createParserVerifiedSpan(text, '提交报名表，必须开具在读证明') }]
    expect(issueCodes(ledger, text)).toContain('RELATION_ASSERTION_UNSUPPORTED')
  })

  it('rejects compressing a quantity range into one number', () => {
    const text = '报名表共2至3份。'
    const ledger: ProvenanceFactLedger = {
      schemaVersion: PROVENANCE_FACT_SCHEMA_VERSION,
      source: { title: '材料通知', sourceType: 'text', notificationType: 'information_only', summary: '', requiresAction: false, actionReason: '' },
      actions: [], times: [], events: [], constraints: [], relations: [],
      materials: [{
        name: spanned(text, '报名表'), required: false, requiredSpan: createParserVerifiedSpan(text, '报名表'),
        formatRequirements: [], namingRequirements: [], quantity: { value: 2, span: createParserVerifiedSpan(text, '2至3份') }, submissionChannel: null,
      }],
    }
    expect(issueCodes(ledger, text)).toContain('MATERIAL_QUANTITY_VALUE_MISMATCH')
  })

  it('rejects compressing a lower-bounded quantity into one number', () => {
    const text = '报名表数量为不少于2份。'
    const ledger: ProvenanceFactLedger = {
      schemaVersion: PROVENANCE_FACT_SCHEMA_VERSION,
      source: { title: '材料通知', sourceType: 'text', notificationType: 'information_only', summary: '', requiresAction: false, actionReason: '' },
      actions: [], times: [], events: [], constraints: [], relations: [],
      materials: [{
        name: spanned(text, '报名表'), required: false, requiredSpan: createParserVerifiedSpan(text, '报名表'),
        formatRequirements: [], namingRequirements: [], quantity: { value: 2, span: createParserVerifiedSpan(text, '不少于2份') }, submissionChannel: null,
      }],
    }
    expect(issueCodes(ledger, text)).toContain('MATERIAL_QUANTITY_VALUE_MISMATCH')
  })

  it('rejects two start-time roles for one event', () => {
    const text = '答辩9月12日开始，答辩9月13日开始。'
    const ledger: ProvenanceFactLedger = {
      schemaVersion: PROVENANCE_FACT_SCHEMA_VERSION,
      source: { title: '事件通知', sourceType: 'text', notificationType: 'event_notice', summary: '', requiresAction: true, actionReason: '' },
      actions: [], materials: [], constraints: [],
      times: [
        { type: 'event_start', rawText: spanned(text, '9月12日') },
        { type: 'event_start', rawText: spanned(text, '9月13日') },
      ],
      events: [{ title: spanned(text, '答辩'), description: null, location: null, inferenceLevel: 'explicit' }],
      relations: [
        { type: 'event_time', eventIndex: 0, timeIndex: 0, role: 'start', eventMentionSpan: createParserVerifiedSpan(text, '答辩'), assertionSpan: createParserVerifiedSpan(text, '答辩9月12日') },
        { type: 'event_time', eventIndex: 0, timeIndex: 1, role: 'start', eventMentionSpan: createParserVerifiedSpan(text, '答辩', 1), assertionSpan: createParserVerifiedSpan(text, '答辩9月13日') },
      ],
    }
    expect(issueCodes(ledger, text)).toContain('RELATION_ROLE_DUPLICATE')
  })

  it('rejects event time types attached to an action relation', () => {
    const text = '9月12日提交报名表。'
    const ledger = actionOnlyLedger(text)
    ledger.times = [{ type: 'event_start', rawText: spanned(text, '9月12日') }]
    ledger.relations = [{ type: 'action_time', actionIndex: 0, timeIndex: 0, assertionSpan: createParserVerifiedSpan(text, '9月12日提交报名表') }]
    expect(issueCodes(ledger, text)).toContain('RELATION_ASSERTION_UNSUPPORTED')
  })

  it('does not treat a deadline phrase as a planned start', () => {
    const text = '9月10日前提交报名表。'
    const ledger = actionOnlyLedger(text)
    ledger.times = [{ type: 'planned_start', rawText: spanned(text, '9月10日') }]
    ledger.relations = [{ type: 'action_time', actionIndex: 0, timeIndex: 0, assertionSpan: createParserVerifiedSpan(text, '9月10日前提交报名表') }]
    expect(issueCodes(ledger, text)).toContain('RELATION_ASSERTION_UNSUPPORTED')
  })

  it('suppresses an old deadline after a later延期 notice', () => {
    const text = '9月10日前提交报名表。截止时间后来延期到9月12日。'
    const ledger = actionOnlyLedger(text)
    ledger.times = [{ type: 'submission_deadline', rawText: spanned(text, '9月10日') }]
    ledger.relations = [{ type: 'action_time', actionIndex: 0, timeIndex: 0, assertionSpan: createParserVerifiedSpan(text, '9月10日前提交报名表') }]
    const result = composeRecognitionFromProvenanceFacts(ledger, { sourceContent: text, sourceId: 'source-delayed', referenceTime, timezone: 'Asia/Shanghai' })
    expect(result.standaloneTasks[0].selected).toBe(false)
    expect(result.timePoints[0]).toMatchObject({ selected: false, needsConfirmation: true })
  })

  it('suppresses an old material format after 后改成', () => {
    const text = '请提交报名表。报名表为必交。报名表要求PDF格式，后改成Word格式。'
    const ledger = actionOnlyLedger(text)
    ledger.materials = [{
      name: spanned(text, '报名表'), required: true, requiredSpan: createParserVerifiedSpan(text, '必交'),
      formatRequirements: [spanned(text, 'PDF格式')], namingRequirements: [], quantity: null, submissionChannel: null,
    }]
    ledger.relations = [
      { type: 'action_material', actionIndex: 0, materialIndex: 0, materialMentionSpan: createParserVerifiedSpan(text, '报名表'), assertionSpan: createParserVerifiedSpan(text, '提交报名表') },
      { type: 'material_attribute', materialIndex: 0, field: 'required', valueIndex: null, materialMentionSpan: createParserVerifiedSpan(text, '报名表', 1), assertionSpan: createParserVerifiedSpan(text, '报名表为必交') },
      { type: 'material_attribute', materialIndex: 0, field: 'format', valueIndex: 0, materialMentionSpan: createParserVerifiedSpan(text, '报名表', 2), assertionSpan: createParserVerifiedSpan(text, '报名表要求PDF格式') },
    ]
    const result = composeRecognitionFromProvenanceFacts(ledger, { sourceContent: text, sourceId: 'source-format-changed', referenceTime, timezone: 'Asia/Shanghai' })
    expect(result.materials[0]).toMatchObject({ selected: false, required: false, formatRequirements: [] })
  })

  it('suppresses an old event time after 后改成', () => {
    const text = '答辩将于9月12日举行，后改成9月13日。'
    const ledger: ProvenanceFactLedger = {
      schemaVersion: PROVENANCE_FACT_SCHEMA_VERSION,
      source: { title: '答辩通知', sourceType: 'text', notificationType: 'event_notice', summary: '', requiresAction: true, actionReason: '' },
      actions: [], materials: [], constraints: [],
      times: [{ type: 'event_start', rawText: spanned(text, '9月12日') }],
      events: [{ title: spanned(text, '答辩'), description: null, location: null, inferenceLevel: 'explicit' }],
      relations: [{ type: 'event_time', eventIndex: 0, timeIndex: 0, role: 'start', eventMentionSpan: createParserVerifiedSpan(text, '答辩'), assertionSpan: createParserVerifiedSpan(text, '答辩将于9月12日') }],
    }
    const result = composeRecognitionFromProvenanceFacts(ledger, { sourceContent: text, sourceId: 'source-event-changed', referenceTime, timezone: 'Asia/Shanghai' })
    expect(result.events[0].selected).toBe(false)
    expect(result.timePoints[0]).toMatchObject({ selected: false, needsConfirmation: true })
  })

  it('rejects an event end phrase declared as a start role', () => {
    const text = '答辩于9月12日结束。'
    const ledger: ProvenanceFactLedger = {
      schemaVersion: PROVENANCE_FACT_SCHEMA_VERSION,
      source: { title: '答辩通知', sourceType: 'text', notificationType: 'event_notice', summary: '', requiresAction: true, actionReason: '' },
      actions: [], materials: [], constraints: [],
      times: [{ type: 'event_start', rawText: spanned(text, '9月12日') }],
      events: [{ title: spanned(text, '答辩'), description: null, location: null, inferenceLevel: 'explicit' }],
      relations: [{ type: 'event_time', eventIndex: 0, timeIndex: 0, role: 'start', eventMentionSpan: createParserVerifiedSpan(text, '答辩'), assertionSpan: createParserVerifiedSpan(text, '答辩于9月12日') }],
    }
    expect(issueCodes(ledger, text)).toContain('RELATION_CONTEXT_UNCERTAIN')
  })

  it('rejects a non-concrete event location', () => {
    const text = '答辩地点：另行通知。'
    const ledger: ProvenanceFactLedger = {
      schemaVersion: PROVENANCE_FACT_SCHEMA_VERSION,
      source: { title: '答辩通知', sourceType: 'text', notificationType: 'event_notice', summary: '', requiresAction: true, actionReason: '' },
      actions: [], times: [], materials: [], constraints: [],
      events: [{ title: spanned(text, '答辩'), description: null, location: spanned(text, '另行通知'), inferenceLevel: 'explicit' }],
      relations: [{ type: 'event_location', eventIndex: 0, eventMentionSpan: createParserVerifiedSpan(text, '答辩'), assertionSpan: createParserVerifiedSpan(text, '答辩地点：另行通知') }],
    }
    expect(issueCodes(ledger, text)).toContain('EVENT_LOCATION_NOT_CONCRETE')
  })

  it('rejects duplicate event entities bound to the same source mention', () => {
    const text = '答辩将于9月12日举行。'
    const ledger: ProvenanceFactLedger = {
      schemaVersion: PROVENANCE_FACT_SCHEMA_VERSION,
      source: { title: '答辩通知', sourceType: 'text', notificationType: 'event_notice', summary: '', requiresAction: true, actionReason: '' },
      actions: [], materials: [], constraints: [],
      times: [{ type: 'event_start', rawText: spanned(text, '9月12日') }],
      events: [
        { title: spanned(text, '答辩'), description: null, location: null, inferenceLevel: 'explicit' },
        { title: spanned(text, '答辩'), description: null, location: null, inferenceLevel: 'explicit' },
      ],
      relations: [{ type: 'event_time', eventIndex: 0, timeIndex: 0, role: 'start', eventMentionSpan: createParserVerifiedSpan(text, '答辩'), assertionSpan: createParserVerifiedSpan(text, '答辩将于9月12日') }],
    }
    expect(issueCodes(ledger, text)).toContain('ENTITY_SPAN_DUPLICATE')
  })

  it('rejects information-only metadata paired with required action', () => {
    const text = '请提交报名表。'
    const ledger = actionOnlyLedger(text)
    ledger.source.notificationType = 'information_only'
    expect(issueCodes(ledger, text)).toContain('INFORMATION_ONLY_ACTION_CONFLICT')
  })

  it('requires sourceId, reference time and timezone before composition', () => {
    const ledger = actionOnlyLedger('请提交报名表。')
    expect(() => composeRecognitionFromProvenanceFacts(ledger, { sourceContent: '请提交报名表。', sourceId: '', referenceTime, timezone: 'Asia/Shanghai' })).toThrow('FACT_SOURCE_ID_REQUIRED')
    expect(() => composeRecognitionFromProvenanceFacts(ledger, { sourceContent: '请提交报名表。', sourceId: 'source-1', referenceTime: new Date('invalid'), timezone: 'Asia/Shanghai' })).toThrow('FACT_REFERENCE_TIME_REQUIRED')
    expect(() => composeRecognitionFromProvenanceFacts(ledger, { sourceContent: '请提交报名表。', sourceId: 'source-1', referenceTime, timezone: 'Mars/Base' })).toThrow('FACT_TIMEZONE_REQUIRED')
  })

  it('rejects unknown fields', () => {
    const ledger = validLedger(source) as ProvenanceFactLedger & { extra?: boolean }
    ledger.extra = true
    expect(issueCodes(ledger, source)).toContain('UNKNOWN_FIELD')
  })

  it('rejects out-of-range typed relation references', () => {
    const ledger = validLedger(source)
    ledger.relations[0] = { ...ledger.relations[0], actionIndex: 99 } as ProvenanceFactLedger['relations'][number]
    expect(issueCodes(ledger, source)).toContain('RELATION_REFERENCE_INVALID')
  })
})
