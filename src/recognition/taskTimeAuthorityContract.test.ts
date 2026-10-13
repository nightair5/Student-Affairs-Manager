import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createTaskRequirementsFixture } from '../experiments/candidate19Recorded/taskRequirementsFixtures'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { buildFactRoleRequest, type FactRoleFacts } from './factRoleContract'
import { validateRecognitionResult } from './schema'
import { assembleCurrentFirstSuggestion } from './materialChannelGrounding'
import {
  buildTaskTimeAuthorityRequest, decodeTaskTimeAuthorityRecording, groundTaskTimeWindows, projectTaskTimeAuthority,
  TASK_TIME_AUTHORITY_VERSION, TASK_TIME_AUTHORITY_SCHEMA, taskTimeAuthorityFromSidecar,
  type TaskTimeAuthorityFacts,
} from './taskTimeAuthorityContract'

async function fixture(options: { date?: string; sessions?: string[]; object?: string; unknown?: boolean } = {}) {
  const base = await createTaskRequirementsFixture(), object = options.object ?? '设备申请材料'
  const dateText = options.date ?? '2027年2月20至21日'
  const sessions = options.sessions ?? ['上午9:00-11:30', '下午2:30-5:30']
  const windowText = options.unknown ? `办理日期尚未公布（${sessions.join('，')}）`
    : `办理窗口：${dateText}${sessions.length ? '（' + sessions.join('，') + '）' : ''}`
  const sourceText = `请在2027年2月25日前提交${object}。${windowText}。`
  const context = { ...base.context, referenceTime: '2027-02-01T09:00:00+08:00',
    index: await indexImmutableScopesV11('task-time-fixture', 'task-time-fixture-v1', sourceText) }
  const ids = (text: string) => {
    const start = sourceText.indexOf(text), end = start + text.length
    if (start < 0) throw Error('FIXTURE_LITERAL')
    return context.index.scopes.filter(s => s.start < end && s.end > start).map(s => s.id)
  }
  const old = base.facts.tasks[0], { coverage, ...rest } = old
  void coverage
  const task: TaskTimeAuthorityFacts['tasks'][number] = { ...rest, id: 'T1',
    propositionScopeIds: context.index.scopes.map(s => s.id), absences: [],
    action: { surface: '提交', scopeId: ids(`请在2027年2月25日前提交${object}`)[0] },
    object: { surface: object, scopeId: ids(`请在2027年2月25日前提交${object}`)[0] },
    participation: { mode: 'required', scopeIds: ids(`请在2027年2月25日前提交${object}`) },
    executionChannel: null, detail: { ...rest.detail, title: '提交' + object, description: '', completionCriteria: [], dependencyTempIds: [] },
    timeFacts: { deadlines: [{ type: 'submission_deadline', rawText: '2027年2月25日', scopeIds: ids('2027年2月25日'), confidence: 1 }], actionTimes: [],
      windows: [{ rawText: windowText, scopeIds: ids(windowText), dateText: options.unknown ? '办理日期尚未公布' : dateText,
        dateScopeIds: ids(options.unknown ? '办理日期尚未公布' : dateText), confidence: 1,
        sessions: sessions.map(rawText => { const [startText, endText] = rawText.split(/[-至]/u); return { rawText, scopeIds: ids(rawText), startText, endText } }) }] } }
  const facts: TaskTimeAuthorityFacts = { ...base.facts, schemaVersion: TASK_TIME_AUTHORITY_VERSION,
    tasks: [task], timePoints: [], materials: [], events: [], requirements: [], revisions: [], conflicts: [], prerequisiteStates: [],
    scopeAccounting: context.index.scopes.map(s => ({ scopeId: s.id, kind: 'action', primaryEntityIds: ['T1'] })) }
  const raw = () => JSON.stringify({ model: 'deepseek-flash', status: 'completed', output: [{ type: 'message', role: 'assistant',
    content: [{ type: 'output_text', text: JSON.stringify(facts) }] }], usage: { input_tokens: 0, output_tokens: 0 } })
  return { sourceText, context, facts, raw, ids }
}

describe('task-owned time authority: existing schema, ordinary data and explicit discrete windows', () => {
  it('two dates × two daily sessions retain the midday and overnight gaps', async () => {
    const f = await fixture(), raw = f.raw(), d = decodeTaskTimeAuthorityRecording(raw, f.context)
    expect(validateRecognitionResult(d.result).valid).toBe(true)
    expect(d.result.standaloneTasks).toHaveLength(1)
    expect(d.result.timePoints.find(p => p.type === 'submission_deadline')).toMatchObject({ normalizedValue: '2027-02-25', precision: 'date_only' })
    const w = d.sidecar.taskTimeAuthorityAudit.windows[0]
    expect(w.state).toBe('RESOLVED_DISCRETE')
    expect(w.intervals.map(v => [v.start, v.end])).toEqual([
      ['2027-02-20T09:00', '2027-02-20T11:30'], ['2027-02-20T14:30', '2027-02-20T17:30'],
      ['2027-02-21T09:00', '2027-02-21T11:30'], ['2027-02-21T14:30', '2027-02-21T17:30'],
    ])
    expect(d.sidecar.originalResponse).toBe(raw)
    expect(d.sidecar.taskTimeAuthorityAudit.original).toEqual(f.facts)
    expect(d.sidecar.singleAuthorityAudit.sourceWindows).toHaveLength(0)
    expect(w.pointIds.every(id => d.result.standaloneTasks[0].timePointTempIds.includes(id))).toBe(true)
    expect(d.result.timePoints.filter(p => w.pointIds.includes(p.tempId)).every(p => p.rawText === w.declaration.rawText && !p.needsConfirmation)).toBe(true)
    const first = assembleCurrentFirstSuggestion(d.result, { sourceText: f.sourceText, referenceTime: f.context.referenceTime, timezone: f.context.timezone })
    const grounded = groundTaskTimeWindows(first.result, d.sidecar, f.context)
    expect(grounded.result.timePoints.filter(p => w.pointIds.includes(p.tempId)).map(p => p.normalizedValue)).toEqual(w.intervals.flatMap(v => [v.start, v.end]))
    expect(grounded.result.conflicts.filter(c => c.id.startsWith('source-window:'))).toHaveLength(0)
  })
  it.each([
    ['2027年3月3日', ['09:00至10:30'], [['2027-03-03T09:00', '2027-03-03T10:30']]],
    ['2027年3月3—4日', ['下午三点至五点半'], [['2027-03-03T15:00', '2027-03-03T17:30'], ['2027-03-04T15:00', '2027-03-04T17:30']]],
    ['2027年3月31至4月1日', ['14:00-16:00'], [['2027-03-31T14:00', '2027-03-31T16:00'], ['2027-04-01T14:00', '2027-04-01T16:00']]],
    ['2027年3月3日', ['下午14:00-17:00'], [['2027-03-03T14:00', '2027-03-03T17:00']]],
  ] as const)('different literal date or clock syntax remains lossless: %s', async (date, sessions, expected) => {
    const f = await fixture({ date, sessions: [...sessions] }), d = decodeTaskTimeAuthorityRecording(f.raw(), f.context)
    expect(d.sidecar.taskTimeAuthorityAudit.windows[0].intervals.map(v => [v.start, v.end])).toEqual(expected)
  })
  it('calendar-only bounds stay date-only without fabricated source clocks', async () => {
    const f = await fixture({ sessions: [] }), d = decodeTaskTimeAuthorityRecording(f.raw(), f.context)
    const w = d.sidecar.taskTimeAuthorityAudit.windows[0]
    expect(w.state).toBe('RESOLVED_DATE_RANGE')
    expect(w.intervals[0]).toMatchObject({ start: '2027-02-20', end: '2027-02-21', precision: 'date_only' })
    expect(d.result.timePoints.filter(p => w.pointIds.includes(p.tempId)).every(p => p.precision === 'date_only' && p.isAllDay)).toBe(true)
  })
  it.each(['omit-all', 'omit-afternoon', 'hide-clock-in-raw'] as const)('does not widen known daily hours into all-day availability: %s', async kind => {
    const f = await fixture(), w = f.facts.tasks[0].timeFacts.windows[0]
    if (kind === 'omit-all') w.sessions = []
    if (kind === 'omit-afternoon') w.sessions.pop()
    if (kind === 'hide-clock-in-raw') { w.rawText = w.dateText; w.scopeIds = w.dateScopeIds; w.sessions = [] }
    const d = decodeTaskTimeAuthorityRecording(f.raw(), f.context), audit = d.sidecar.taskTimeAuthorityAudit.windows[0]
    expect(audit.state).toBe('UNRESOLVED'); expect(audit.intervals).toEqual([])
    expect(d.result.timePoints.filter(p => audit.pointIds.includes(p.tempId)).every(p => p.normalizedValue === null && p.needsConfirmation)).toBe(true)
  })
  it.each([
    { unknown: true }, { sessions: ['下午-晚上'] }, { date: '2027年2月30日' }, { date: '2027年3月4日至3日' },
    { sessions: ['14:00-05:30'] }, { sessions: ['下午2:75-5:30'] },
    { sessions: ['上午14:00-17:00'] },
  ])('unknown or invalid literals preserve null and produce no planner interval: %j', async options => {
    const f = await fixture(options), d = decodeTaskTimeAuthorityRecording(f.raw(), f.context), w = d.sidecar.taskTimeAuthorityAudit.windows[0]
    expect(w.state).toBe('UNRESOLVED'); expect(w.intervals).toEqual([])
    expect(d.result.timePoints.filter(p => w.pointIds.includes(p.tempId)).every(p => p.normalizedValue === null && p.needsConfirmation)).toBe(true)
    expect(d.sidecar.originalResponse).toBe(f.raw())
  })
  it('deadline role is model-declared: a wrong registration role is not silently fixed', async () => {
    const f = await fixture(); f.facts.tasks[0].timeFacts.deadlines[0].type = 'registration_deadline'
    const d = decodeTaskTimeAuthorityRecording(f.raw(), f.context)
    expect(d.result.timePoints[0].type).toBe('registration_deadline')
    expect(d.result.timePoints[0].normalizedValue).toBe('2027-02-25')
  })
  it('no declared task time remains absent; the source is not scanned to fill omissions', async () => {
    const f = await fixture(); f.facts.tasks[0].timeFacts = { deadlines: [], actionTimes: [], windows: [] }
    const d = decodeTaskTimeAuthorityRecording(f.raw(), f.context)
    expect(d.result.timePoints).toHaveLength(0)
    expect(d.sidecar.taskTimeAuthorityAudit.windows).toHaveLength(0)
  })
  it.each(['fake-scope', 'borrow-clock', 'wrong-scope-owner', 'root-task-duplicate', 'wrong-point-owner', 'forged-sidecar'] as const)(
    'keeps semantic graph or source support risks blocked: %s', async kind => {
      const f = await fixture(), w = f.facts.tasks[0].timeFacts.windows[0]
      if (kind === 'fake-scope') w.dateScopeIds = ['fake-other-source']
      if (kind === 'borrow-clock') { w.sessions[0].rawText = '2027年2月25日'; w.sessions[0].scopeIds = f.ids('2027年2月25日') }
      if (kind === 'wrong-scope-owner') f.facts.scopeAccounting.find(row => row.scopeId === w.scopeIds[0])!.primaryEntityIds = ['OTHER']
      if (kind === 'root-task-duplicate') f.facts.timePoints.push({ tempId: 'bad', type: 'task_deadline', rawText: '2027年2月25日', scopeIds: f.ids('2027年2月25日'), confidence: 1, owners: [{ kind: 'task', entityId: 'T1' }] })
      if (kind === 'wrong-point-owner' || kind === 'forged-sidecar') {
        const d = decodeTaskTimeAuthorityRecording(f.raw(), f.context)
        if (kind === 'wrong-point-owner') d.result.timePoints.find(p => p.tempId === d.sidecar.taskTimeAuthorityAudit.windows[0].pointIds[0])!.relatedTaskTempIds = ['OTHER']
        else d.sidecar.taskTimeAuthorityAudit.original.tasks[0].timeFacts.windows[0].dateText = '2027年3月1日'
        expect(() => groundTaskTimeWindows(d.result, d.sidecar, f.context)).toThrow('TASK_TIME_AUTHORITY_')
      } else expect(() => decodeTaskTimeAuthorityRecording(f.raw(), f.context)).toThrow()
    })
  it('bounds window expansion and never treats request bytes as token counts', async () => {
    const tooManyDays = await fixture({ date: '2027年1月1至2月2日' })
    expect(() => projectTaskTimeAuthority(tooManyDays.facts, tooManyDays.context)).toThrow('WINDOW_DATE_LIMIT_31')
    const tooManySessions = await fixture({ sessions: ['08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00', '13:00-14:00'] })
    expect(() => projectTaskTimeAuthority(tooManySessions.facts, tooManySessions.context)).toThrow('SHAPE')
  })
  it('one-ended appointments remain a separate source role; no synthetic deadline or plan', async () => {
    const f = await fixture(), deadline = f.facts.tasks[0].timeFacts.deadlines[0]
    f.facts.tasks[0].timeFacts = { deadlines: [], windows: [], actionTimes: [{ ...deadline }] }
    // Exact schema refuses the deadline type copied into an appointment object.
    expect(() => decodeTaskTimeAuthorityRecording(f.raw(), f.context)).toThrow('SHAPE')
    f.facts.tasks[0].timeFacts.actionTimes = [{ rawText: deadline.rawText, scopeIds: deadline.scopeIds, confidence: 1 }]
    const d = decodeTaskTimeAuthorityRecording(f.raw(), f.context)
    expect(d.result.timePoints[0].type).toBe('event_start')
    expect(d.sidecar.taskTimeAuthorityAudit.actionTimes).toHaveLength(1)
  })
  it('baseline request is byte-identical and new input is frozen-versionable without expected answers', async () => {
    const f = await fixture(), before = await buildFactRoleRequest(f.context), next = await buildTaskTimeAuthorityRequest(f.context), after = await buildFactRoleRequest(f.context)
    expect(before.serialized).toBe(after.serialized)
    expect(next.dispatchAuthorized).toBe(false)
    expect(next.body.text.format.schema).toEqual(TASK_TIME_AUTHORITY_SCHEMA)
    expect(next.body.text.format.schema.properties!.tasks.items!.properties!.timeFacts).toBeDefined()
    expect(next.serialized).not.toContain('Expected')
    expect(next.body.input[0].content[0].text).toContain('申请”二字不决定角色')
    expect(taskTimeAuthorityFromSidecar({ taskTimeAuthorityAudit: { version: 'other', windows: [] } })).toBeNull()
  })
  it('the RN01 source can express all four paper intervals in authored engineering wire; old raw stays read-only', async () => {
    const root = 'docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic/current-mechanism-followup/qualification-association-followup/real-notice-fact-role/'
    const sources = JSON.parse(readFileSync(root + 'SOURCES.json', 'utf8')).sources as Array<{ sourceId: string; sourceVersionId: string; sourceText: string; referenceTime: string; timezone: string }>
    const s = sources[0], rawBefore = readFileSync(root + 'observed/raw-01.json', 'utf8')
    const originalEnvelope = JSON.parse((JSON.parse(rawBefore) as { rawHttpText: string }).rawHttpText)
    const original = JSON.parse(originalEnvelope.output[0].content[0].text) as FactRoleFacts
    const context = { index: await indexImmutableScopesV11(s.sourceId, s.sourceVersionId, s.sourceText), referenceTime: s.referenceTime, timezone: s.timezone }
    const ids = (text: string) => { const start = s.sourceText.indexOf(text); return context.index.scopes.filter(scope => scope.start < start + text.length && scope.end > start).map(scope => scope.id) }
    const completeWindow = '纸质版材料提交时间为6月15-16日（上午9:00-11:30,下午2:30-5:30）'
    const oldTimeIds = new Set(original.timePoints.map(p => p.tempId))
    const authored: TaskTimeAuthorityFacts = { ...original, schemaVersion: TASK_TIME_AUTHORITY_VERSION, timePoints: [],
      scopeAccounting: original.scopeAccounting.map(row => ({ ...row, primaryEntityIds: row.primaryEntityIds.filter(id => !oldTimeIds.has(id)) })),
      tasks: original.tasks.map((t, i) => ({ ...t, timeFacts: { deadlines: i ? [] : [{ type: 'submission_deadline',
        rawText: original.timePoints[0].rawText, scopeIds: original.timePoints[0].scopeIds, confidence: 1 }], actionTimes: [],
      windows: i ? [{ rawText: completeWindow, scopeIds: ids(completeWindow), dateText: '6月15-16日', dateScopeIds: ids('6月15-16日'), confidence: 1,
        sessions: ['上午9:00-11:30', '下午2:30-5:30'].map(rawText => { const [startText, endText] = rawText.split('-'); return { rawText, scopeIds: ids(rawText), startText, endText } }) }] : [] } })) }
    // This is a source-authored engineering representation, not a generated
    // answer, rerun or revision of the frozen observed model result.
    const envelope = structuredClone(originalEnvelope); envelope.output[0].content[0].text = JSON.stringify(authored)
    const d = decodeTaskTimeAuthorityRecording(JSON.stringify(envelope), context, 'EngineeringFixture')
    expect(d.result.standaloneTasks).toHaveLength(2); expect(d.result.timePoints).toHaveLength(9)
    expect(d.result.timePoints[0]).toMatchObject({ type: 'submission_deadline', normalizedValue: '2026-06-10', precision: 'date_only' })
    expect(d.sidecar.taskTimeAuthorityAudit.windows[0].intervals.map(v => [v.start, v.end])).toEqual([
      ['2026-06-15T09:00', '2026-06-15T11:30'], ['2026-06-15T14:30', '2026-06-15T17:30'],
      ['2026-06-16T09:00', '2026-06-16T11:30'], ['2026-06-16T14:30', '2026-06-16T17:30'],
    ])
    expect(original.timePoints[0].type).toBe('registration_deadline')
    expect(original.timePoints).toHaveLength(3)
    expect(readFileSync(root + 'observed/raw-01.json', 'utf8')).toBe(rawBefore)
    expect(d.result.modelName).toContain('非模型输出')
  })
})
