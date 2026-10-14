import { plainJson } from '../experiments/mainline04/semanticContract'
import { MAX_REQUEST_BYTES, type WireContext } from '../experiments/realInput01/modelWire'
import { addDateOnlyDays } from '../lib/timeSemantics'
import { interpretTimeD26 } from '../lib/timeSemanticsD26'
import { hasLiteralScopeSpan } from './authorityLiteralSupport'
import { buildFactRoleRequest, FACT_ROLE_SCHEMA, FACT_ROLE_VERSION, type FactRoleFacts } from './factRoleContract'
import { decodeCurrentFactRoleRecording } from './currentFactRoleProduct'
import type { RecognitionResult } from './types'

export const TASK_TIME_AUTHORITY_VERSION = 'task-time-authority-source-contract-1.0.0'
export const TASK_TIME_AUTHORITY_CANDIDATE = 'task-time-authority-generation-1.0.0'
export const TASK_TIME_AUTHORITY_PROMPT = 'recognition-task-time-authority-1.0.0'
export const TASK_TIME_AUTHORITY_PROJECTION = 'task-time-authority-projection-1.0.1'

export interface TaskTimeLiteral { rawText: string; scopeIds: string[]; confidence: number }
export interface TaskDeadlineDeclaration extends TaskTimeLiteral {
  type: 'registration_deadline' | 'submission_deadline' | 'task_deadline'
}
export interface TaskWindowSession {
  rawText: string
  scopeIds: string[]
  startText: string
  endText: string
}
export interface TaskWindowDeclaration extends TaskTimeLiteral {
  dateText: string
  dateScopeIds: string[]
  sessions: TaskWindowSession[]
}
export interface TaskOwnedTimeFacts {
  deadlines: TaskDeadlineDeclaration[]
  actionTimes: TaskTimeLiteral[]
  windows: TaskWindowDeclaration[]
}
export type TaskTimeAuthorityFacts = Omit<FactRoleFacts, 'schemaVersion' | 'tasks'> & {
  schemaVersion: typeof TASK_TIME_AUTHORITY_VERSION
  tasks: Array<FactRoleFacts['tasks'][number] & { timeFacts: TaskOwnedTimeFacts }>
}
export interface TaskWindowInterval {
  intervalId: string
  startPointId: string
  endPointId: string
  start: string
  end: string
  precision: 'exact' | 'date_only'
  date: string
  sessionIndex: number | null
}
export interface TaskWindowAudit {
  windowId: string
  ownerTaskId: string
  declaration: TaskWindowDeclaration
  state: 'RESOLVED_DISCRETE' | 'RESOLVED_DATE_RANGE' | 'UNRESOLVED'
  reason: string | null
  pointIds: string[]
  intervals: TaskWindowInterval[]
}
export interface TaskTimeAuthorityAudit {
  version: typeof TASK_TIME_AUTHORITY_PROJECTION
  operation: 'DECLARED_TASK_TIMES_TO_OWNERS_AND_BOUNDED_WINDOW_ENDPOINTS'
  inferredFacts: 0
  original: TaskTimeAuthorityFacts
  windows: TaskWindowAudit[]
  actionTimes: Array<{ id: string; owners: Array<{ kind: 'task'; entityId: string }> }>
}

type GenerationSchema = typeof FACT_ROLE_SCHEMA
const text: GenerationSchema = { type: 'string', minLength: 1, maxLength: 4000 }
const scopeIds: GenerationSchema = { type: 'array', minItems: 1, maxItems: 200, uniqueItems: true, items: text }
const confidence: GenerationSchema = { type: 'number', minimum: 0, maximum: 1 }
const object = (properties: Record<string, GenerationSchema>): GenerationSchema => ({
  type: 'object', additionalProperties: false, required: Object.keys(properties), properties,
})
const literals = { rawText: text, scopeIds, confidence }
export const TASK_TIME_AUTHORITY_SCHEMA = structuredClone(FACT_ROLE_SCHEMA)
TASK_TIME_AUTHORITY_SCHEMA.properties!.schemaVersion = { type: 'string', const: TASK_TIME_AUTHORITY_VERSION }
const taskSchema = TASK_TIME_AUTHORITY_SCHEMA.properties!.tasks.items!
taskSchema.required!.push('timeFacts')
taskSchema.properties!.timeFacts = Object.assign(object({
  deadlines: { type: 'array', maxItems: 4, items: object({ ...literals,
    type: { type: 'string', enum: ['registration_deadline', 'submission_deadline', 'task_deadline'] } }) },
  actionTimes: { type: 'array', maxItems: 4, items: object(literals) },
  windows: { type: 'array', maxItems: 4, items: object({ ...literals, dateText: text, dateScopeIds: scopeIds,
    sessions: { type: 'array', maxItems: 4, items: object({ rawText: text, scopeIds, startText: text, endText: text }) } }) },
}), { description: '本task原文时间唯一声明。deadline按提交/报名/其他真实截止角色声明；actionTimes是指定办理时刻；windows独立保留逐字日期和每段起止。程序派生owner和端点，不复制到根timePoints。未公布/模糊保留逐字原文，不猜日期或时刻。' })
const rootPoint = TASK_TIME_AUTHORITY_SCHEMA.properties!.timePoints.items!
rootPoint.properties!.owners.items!.properties!.kind.enum = ['material', 'event_start', 'event_end']
rootPoint.properties!.type.enum = rootPoint.properties!.type.enum!.filter(type => !['task_action_time', 'planned_start'].includes(String(type)))
Object.assign(TASK_TIME_AUTHORITY_SCHEMA.properties!.timePoints, {
  description: '仅保留独立事件或材料的时间。任务时间只放所属task.timeFacts，不在此重复owner或点ID。',
})

const check = (value: unknown, code: string) => { if (!value) throw Error('TASK_TIME_AUTHORITY_' + code) }
function matches(value: unknown, schema: GenerationSchema): boolean {
  if ('const' in schema) return value === schema.const
  if (schema.anyOf) return schema.anyOf.some(s => matches(value, s))
  if (schema.enum && !schema.enum.includes(value)) return false
  if (schema.type === 'null') return value === null
  if (schema.type === 'string') return typeof value === 'string' && value.length >= (schema.minLength ?? 0) && value.length <= (schema.maxLength ?? 4000)
  if (schema.type === 'number') return typeof value === 'number' && Number.isFinite(value) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity)
  if (schema.type === 'boolean') return typeof value === 'boolean'
  if (schema.type === 'array') return Array.isArray(value) && value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? 200)
    && (!schema.uniqueItems || new Set(value.map(v => JSON.stringify(v))).size === value.length) && value.every(v => matches(v, schema.items!))
  if (schema.type === 'object') return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === schema.required!.length && schema.required!.every(k => Object.hasOwn(value, k) && matches((value as Record<string, unknown>)[k], schema.properties![k]))
  return false
}
const unique = (ids: string[]) => [...new Set(ids)]
function literal(rawText: string, ids: string[], context: WireContext) {
  check(hasLiteralScopeSpan(rawText, ids, context), 'LITERAL_EVIDENCE')
}
function calendarDates(rawText: string, context: WireContext): { dates: string[]; reason: string | null } {
  // Deliberately bounded calendar syntax. An unfamiliar or uncertain date is
  // retained, never expanded using the replay day or a guessed endpoint.
  const match = rawText.trim().match(/^(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日?(?:\s*[—–－\-~～至到]\s*(?:(\d{4})年)?(?:(\d{1,2})月)?(\d{1,2})日)?$/u)
  if (!match) return { dates: [], reason: 'DATE_NOT_EXPLICIT_BOUNDED_CALENDAR' }
  const date = (year: string, month: string, day: string) => {
    const p = interpretTimeD26(`${year ? year + '年' : ''}${month}月${day}日`, { type: 'event_start', referenceTime: context.referenceTime, timezone: context.timezone }).point
    return p.precision === 'date_only' && !p.needsConfirmation ? p.normalizedValue : null
  }
  const start = date(match[1] ?? '', match[2], match[3])
  const end = start && (match[6] ? date(match[4] ?? start.slice(0, 4), match[5] ?? match[2], match[6]) : start)
  if (!start || !end || end < start) return { dates: [], reason: 'INVALID_OR_REVERSED_DATE_RANGE' }
  const dates = [start]
  while (dates.at(-1)! < end) {
    check(dates.length < 31, 'WINDOW_DATE_LIMIT_31')
    dates.push(addDateOnlyDays(dates.at(-1)!, 1))
  }
  return { dates, reason: null }
}
const periodPattern = /凌晨|清晨|早晨|早上|上午|中午|下午|傍晚|晚上|夜间|夜里|晚/u
const clockNumber = '[零〇一二两三四五六七八九十百\\d]{1,4}'
const literalClock = `(?:(?:凌晨|清晨|早晨|早上|上午|中午|下午|傍晚|晚上|夜间|夜里|晚)\\s*)?${clockNumber}\\s*(?::\\s*${clockNumber}|(?:点|时)(?:${clockNumber}\\s*分?|半)?)`
const literalClockRanges = () => new RegExp(`${literalClock}\\s*[-—–－~～至到]\\s*${literalClock}`, 'gu')
function explicitClockInput(raw: string) {
  const match = raw.match(/^(下午|傍晚|晚上|夜间|夜里|晚)\s*(\d{1,2})(?=\s*[:：点时])/u)
  if (!match) return raw
  const hour = Number(match[2]), compatible = match[1] === '下午' ? hour >= 13 && hour <= 17
    : match[1] === '傍晚' ? hour >= 17 && hour <= 19 : hour >= 18 && hour <= 23
  // An explicit 24-hour value may redundantly carry a matching Chinese period.
  // Opposing wording (such as 上午14:00) stays unresolved.
  return compatible ? raw.slice(match[1].length).trimStart() : raw
}
function sessionInterval(session: TaskWindowSession, date: string, context: WireContext) {
  // The declared endpoint surfaces must form this one literal range. Clocks
  // elsewhere in the same notice or sentence cannot supply either endpoint.
  const span = session.rawText.trim(), a = span.indexOf(session.startText), b = span.lastIndexOf(session.endText)
  if (a < 0 || b <= a || b + session.endText.length !== span.length
    || !/^\s*[-—–－~～至到]\s*$/u.test(span.slice(a + session.startText.length, b))) return null
  const prefix = span.slice(0, a), prefixMatch = prefix.match(/^(?:(?:每天|每日)\s*)?(凌晨|清晨|早晨|早上|上午|中午|下午|傍晚|晚上|夜间|夜里|晚)?\s*$/u)
  if (!prefixMatch) return null
  const declaredStartPeriod = session.startText.match(periodPattern)?.[0]
  if (prefixMatch[1] && declaredStartPeriod) return null
  // A frequency or period prefix belongs only to this same literal range.
  // Other objects, conditions, negation or a second clock cannot lend context.
  const startRaw = prefixMatch[1] && !declaredStartPeriod ? prefixMatch[1] + session.startText : session.startText
  const start = interpretTimeD26(explicitClockInput(startRaw), { type: 'event_start', inheritedDate: date,
    referenceTime: context.referenceTime, timezone: context.timezone, sourceContext: session.rawText }).point
  // A shared day-period in the same literal range is ordinary range syntax.
  // The inherited period is public normalization, never a new raw quotation.
  const period = startRaw.match(periodPattern)?.[0]
  const explicitEndPeriod = periodPattern.test(session.endText)
  const endRaw = period && !explicitEndPeriod ? period + session.endText : session.endText
  let end = interpretTimeD26(explicitClockInput(endRaw), { type: 'event_end', inheritedDate: date,
    referenceTime: context.referenceTime, timezone: context.timezone, sourceContext: session.rawText }).point
  if (start.precision !== 'exact' || end.precision !== 'exact' || start.needsConfirmation || end.needsConfirmation || !start.normalizedValue || !end.normalizedValue) return null
  const explicitMidnight = /晚上|夜间|夜里|晚/u.test(startRaw) && /凌晨|清晨|早晨|早上|上午/u.test(session.endText)
  if (end.normalizedValue <= start.normalizedValue && explicitMidnight) {
    end = interpretTimeD26(session.endText, { type: 'event_end', inheritedDate: addDateOnlyDays(date, 1), referenceTime: context.referenceTime, timezone: context.timezone }).point
  }
  return end.normalizedValue && end.normalizedValue > start.normalizedValue ? { start: start.normalizedValue, end: end.normalizedValue } : null
}
function windowAudit(taskId: string, taskIndex: number, index: number, w: TaskWindowDeclaration, context: WireContext): TaskWindowAudit {
  literal(w.rawText, w.scopeIds, context); literal(w.dateText, w.dateScopeIds, context)
  check(w.dateScopeIds.every(id => w.scopeIds.includes(id)) && w.rawText.includes(w.dateText), 'WINDOW_DATE_EVIDENCE')
  for (const session of w.sessions) {
    literal(session.rawText, session.scopeIds, context)
    check(session.scopeIds.every(id => w.scopeIds.includes(id)) && w.rawText.includes(session.rawText), 'WINDOW_SESSION_EVIDENCE')
    check(session.rawText.includes(session.startText) && session.rawText.includes(session.endText), 'WINDOW_ENDPOINT_EVIDENCE')
  }
  const id = `TTW-${taskIndex + 1}-${index}`, calendar = calendarDates(w.dateText, context)
  const negativeOrConditional = /暂定|预计|可能|若|如果|(?:不要|不得|禁止|无需|不必|不能|请勿).{0,18}(?:办理|提交|领取|开放|受理)/u.test(w.rawText)
  const intervals: TaskWindowInterval[] = []
  let reason = negativeOrConditional ? 'WINDOW_CONDITIONAL_OR_NEGATED' : calendar.reason
  const citedText = w.scopeIds.map(id => context.index.scopes.find(s => s.id === id)?.text ?? '').join('')
  const actualClockRanges = [...w.rawText.matchAll(literalClockRanges())]
  if (!reason && !w.sessions.length && (new RegExp(literalClock, 'u').test(citedText) || periodPattern.test(citedText))) {
    reason = 'WINDOW_SESSIONS_OMITTED'
  }
  if (!reason && w.sessions.length && actualClockRanges.length !== w.sessions.length) reason = 'WINDOW_SESSION_COVERAGE_INCOMPLETE'
  if (!reason && !w.sessions.length) {
    // No source clocks were declared: preserve the stated calendar bounds.
    intervals.push({ intervalId: id + '-dates', startPointId: id + '-dates-start', endPointId: id + '-dates-end',
      start: calendar.dates[0], end: calendar.dates.at(-1)!, precision: 'date_only', date: calendar.dates[0], sessionIndex: null })
  } else if (!reason) {
    for (const date of calendar.dates) for (const [sessionIndex, session] of w.sessions.entries()) {
      const value = sessionInterval(session, date, context)
      if (!value) { reason = 'SESSION_NOT_EXPLICIT_ORDERED_CLOCK_RANGE'; break }
      const intervalId = `${id}-${date}-${sessionIndex}`
      intervals.push({ intervalId, startPointId: intervalId + '-start', endPointId: intervalId + '-end',
        ...value, precision: 'exact', date, sessionIndex })
    }
  }
  if (reason) intervals.splice(0)
  const pointIds = intervals.length ? intervals.flatMap(v => [v.startPointId, v.endPointId]) : [id + '-unknown-start', id + '-unknown-end']
  return { windowId: id, ownerTaskId: taskId, declaration: structuredClone(w), state: reason ? 'UNRESOLVED'
    : w.sessions.length ? 'RESOLVED_DISCRETE' : 'RESOLVED_DATE_RANGE', reason, pointIds, intervals }
}

/** Only a declared task's time facts acquire that containing task as owner.
 * No source scan manufactures a deadline, a clock, a task or an association. */
export function projectTaskTimeAuthority(input: unknown, context: WireContext) {
  const original = plainJson(input) as TaskTimeAuthorityFacts
  check(matches(original, TASK_TIME_AUTHORITY_SCHEMA), 'SHAPE')
  const windows: TaskWindowAudit[] = [], actionTimes: TaskTimeAuthorityAudit['actionTimes'] = []
  const projected: FactRoleFacts = { ...original, schemaVersion: FACT_ROLE_VERSION, tasks: [], timePoints: structuredClone(original.timePoints) }
  check(original.timePoints.every(p => p.owners.every(o => o.kind !== 'task')), 'ROOT_TASK_TIME_DUPLICATE')
  const ids = new Set(projected.timePoints.map(p => p.tempId))
  const push = (point: FactRoleFacts['timePoints'][number]) => {
    check(!ids.has(point.tempId) && /^[A-Za-z][A-Za-z0-9_-]{0,79}$/u.test(point.tempId), 'POINT_ID_COLLISION_OR_LIMIT')
    ids.add(point.tempId); projected.timePoints.push(point)
  }
  for (const [taskIndex, task] of original.tasks.entries()) {
    const { timeFacts, ...base } = task
    const declaredScopes: string[] = []
    const ownerSupport = (ids: string[]) => check(ids.every(id => original.scopeAccounting.some(row => row.scopeId === id
      && row.kind === 'action' && row.primaryEntityIds.includes(task.id))), 'TIME_SCOPE_OWNER')
    for (const [i, deadline] of timeFacts.deadlines.entries()) {
      literal(deadline.rawText, deadline.scopeIds, context)
      ownerSupport(deadline.scopeIds)
      push({ ...deadline, tempId: `TTD-${taskIndex + 1}-${i}`, owners: [{ kind: 'task', entityId: task.id }] })
      declaredScopes.push(...deadline.scopeIds)
    }
    for (const [i, appointment] of timeFacts.actionTimes.entries()) {
      literal(appointment.rawText, appointment.scopeIds, context)
      ownerSupport(appointment.scopeIds)
      const id = `TTA-${taskIndex + 1}-${i}`
      push({ ...appointment, tempId: id, type: 'task_action_time', owners: [{ kind: 'task', entityId: task.id }] })
      actionTimes.push({ id, owners: [{ kind: 'task', entityId: task.id }] }); declaredScopes.push(...appointment.scopeIds)
    }
    for (const [i, declaration] of timeFacts.windows.entries()) {
      ownerSupport(declaration.scopeIds)
      const audit = windowAudit(task.id, taskIndex, i, declaration, context)
      windows.push(audit); declaredScopes.push(...declaration.scopeIds)
      for (const [pointIndex, id] of audit.pointIds.entries()) push({ tempId: id, type: pointIndex % 2 ? 'window_end' : 'window_start',
        rawText: declaration.rawText, scopeIds: declaration.scopeIds, confidence: declaration.confidence, owners: [{ kind: 'task', entityId: task.id }] })
    }
    projected.tasks.push({ ...base, propositionScopeIds: unique([...base.propositionScopeIds, ...declaredScopes]) })
  }
  check(projected.timePoints.length <= 200, 'POINT_LIMIT_200')
  const audit: TaskTimeAuthorityAudit = { version: TASK_TIME_AUTHORITY_PROJECTION,
    operation: 'DECLARED_TASK_TIMES_TO_OWNERS_AND_BOUNDED_WINDOW_ENDPOINTS', inferredFacts: 0, original, windows, actionTimes }
  return { projected, audit }
}

export function taskTimeAuthorityFromSidecar(sidecar: unknown): TaskTimeAuthorityAudit | null {
  if (!sidecar || typeof sidecar !== 'object' || !('taskTimeAuthorityAudit' in sidecar)) return null
  const audit = sidecar.taskTimeAuthorityAudit
  if (!audit || typeof audit !== 'object' || !('version' in audit) || audit.version !== TASK_TIME_AUTHORITY_PROJECTION
    || !('original' in audit) || !('windows' in audit) || !Array.isArray(audit.windows) || audit.windows.length > 128
    || !audit.windows.every(w => !!w && typeof w === 'object' && 'windowId' in w && typeof w.windowId === 'string'
      && 'ownerTaskId' in w && typeof w.ownerTaskId === 'string' && 'declaration' in w && !!w.declaration
      && 'pointIds' in w && Array.isArray(w.pointIds) && w.pointIds.every((id: unknown) => typeof id === 'string')
      && 'intervals' in w && Array.isArray(w.intervals) && 'state' in w
      && ['RESOLVED_DISCRETE', 'RESOLVED_DATE_RANGE', 'UNRESOLVED'].includes(String(w.state)))) return null
  return audit as TaskTimeAuthorityAudit
}

/** Run after the ordinary first assembler, which intentionally reinterprets
 * raw point text. Recompute from original declarations rather than trusting
 * normalized values supplied in a sidecar. */
export function groundTaskTimeWindows(input: RecognitionResult, sidecar: unknown, context: WireContext) {
  const stored = taskTimeAuthorityFromSidecar(sidecar)
  if (!stored) return { result: input, audit: null }
  const verified = projectTaskTimeAuthority(stored.original, context), result = structuredClone(input)
  const tasks = [...result.standaloneTasks, ...result.milestones.flatMap(m => [...m.tasks, ...m.workPackages.flatMap(w => w.tasks)])]
  for (const w of verified.audit.windows) {
    const task = tasks.find(t => t.tempId === w.ownerTaskId)
    check(task && w.pointIds.every(id => task.timePointTempIds.includes(id)), 'WINDOW_RECIPROCAL_OWNER')
    for (const [i, id] of w.pointIds.entries()) {
      const point = result.timePoints.find(p => p.tempId === id)
      check(point && point.type === (i % 2 ? 'event_end' : 'event_start') && point.rawText === w.declaration.rawText
        && point.relatedTaskTempIds.length === 1 && point.relatedTaskTempIds[0] === w.ownerTaskId && !point.relatedMaterialTempIds.length
        && !result.events.some(e => [e.startTimePointTempId, e.endTimePointTempId].includes(id)), 'WINDOW_OWNER_OR_VALUE_CHANGED')
      const interval = w.intervals.find(v => [v.startPointId, v.endPointId].includes(id))
      Object.assign(point!, interval ? { normalizedValue: id === interval.startPointId ? interval.start : interval.end,
        timezone: context.timezone, precision: interval.precision, isAllDay: interval.precision === 'date_only', needsConfirmation: false }
        : { normalizedValue: null, timezone: context.timezone, precision: 'vague', isAllDay: false, needsConfirmation: true })
    }
  }
  // The legacy nested compiler may already have rejected a clock-bearing date
  // range as a single date endpoint. Remove only that exact program conflict
  // for a now-proven endpoint, never an original model conflict or other risk.
  const originalConflictIds = new Set(stored.original.conflicts.map(c => c.id))
  const resolvedIds = new Set(verified.audit.windows.filter(w => w.state !== 'UNRESOLVED').flatMap(w => w.pointIds))
  const removed = result.conflicts.filter(c => !originalConflictIds.has(c.id)
    && [...resolvedIds].some(id => c.id === 'source-window:' + id && c.type === 'other' && c.requiresDecision
      && ['办理窗口的日期或对象依据不一致，请核对；未推测日期或截止。', '原文日期已保留；它与事项的关联尚待核对，不能当成已确认截止或个人安排。'].includes(c.message)
      && c.entityTempIds.includes(id)))
  result.conflicts = result.conflicts.filter(c => !removed.includes(c))
  result.quality.reviewReasons = result.quality.reviewReasons.filter(r => !removed.some(c => c.message === r)
    || result.conflicts.some(c => c.message === r))
  return { result, audit: verified.audit }
}

export function decodeTaskTimeAuthorityRecording(raw: string, context: WireContext, role: 'EngineeringFixture' | 'SingleAuthority' = 'EngineeringFixture') {
  check(new TextEncoder().encode(raw).byteLength <= 524288, 'RESPONSE_SIZE')
  const envelope = JSON.parse(raw)
  const texts = Array.isArray(envelope.output) ? envelope.output.filter((m: { type?: string }) => m.type === 'message')
    .flatMap((m: { content?: Array<{ type?: string; text?: string }> }) => m.content?.filter(c => c.type === 'output_text') ?? []) : []
  check(texts.length === 1 && typeof texts[0].text === 'string', 'RESPONSE_TEXT')
  const projection = projectTaskTimeAuthority(JSON.parse(texts[0].text!), context)
  texts[0].text = JSON.stringify(projection.projected)
  const decoded = decodeCurrentFactRoleRecording(JSON.stringify(envelope), context, role)
  const windowIds = new Set(projection.audit.windows.flatMap(w => w.pointIds))
  // The old ungrouped range grounder cannot represent multiple daily sessions.
  // Keep its declarations intact for other facts; this version has its own
  // typed authority and final deterministic window grounding.
  decoded.sidecar.singleAuthorityAudit.sourceWindows = decoded.sidecar.singleAuthorityAudit.sourceWindows.filter(w => !windowIds.has(w.id))
  const sidecar = { ...decoded.sidecar, originalResponse: raw, taskTimeAuthorityAudit: projection.audit }
  const grounded = groundTaskTimeWindows(decoded.result, sidecar, context)
  return { ...decoded, result: { ...grounded.result, promptVersion: TASK_TIME_AUTHORITY_PROMPT,
    modelName: role === 'EngineeringFixture' ? '任务时间工程夹具（非模型输出）' : 'TaskTimeAuthority 固定录制（非实时调用）' }, sidecar }
}

export async function buildTaskTimeAuthorityRequest(context: WireContext) {
  const base = await buildFactRoleRequest(context), body = structuredClone(base.body)
  body.input[0].content[0].text = body.input[0].content[0].text.replace(
    'task.eventLinks、timePoints.owners、materials.relatedTaskTempIds各自只声明一份权威关系，程序生成反向索引。',
    'task.eventLinks、task.timeFacts、materials.relatedTaskTempIds各自只声明一份权威关系，程序生成反向索引。')
    + '\n本版task.timeFacts是任务时间唯一权威；根timePoints仅为独立活动或材料，禁止重复任务owner。deadlines逐条保留真实截止角色：上传/交材料的提交截止是submission_deadline，参加活动的报名截止才是registration_deadline；“申请”二字不决定角色。原文指定办理时刻放actionTimes，不是个人planned_start。办理窗口放windows，一份rawText包含日期与完整各段窗口；dateText/dateScopeIds和每段rawText/startText/endText均逐字引用原文。每天上午和下午是两段，不拆为一个跨午休/跨夜长区间。模型不展开日期、不生成反向索引或标准日期，由公共程序在最多31日、4段边界内展开明确声明。未公布/模糊日期或时段仍保留原文窗口，未知不补具体日期。原文任务、材料、条件、依赖和事件仍沿既有契约完整保留。'
  body.text.format.schema = TASK_TIME_AUTHORITY_SCHEMA
  const serialized = JSON.stringify(body)
  check(new TextEncoder().encode(serialized).byteLength <= MAX_REQUEST_BYTES, 'REQUEST_SIZE')
  return { ...base, body, serialized, candidateVersion: TASK_TIME_AUTHORITY_CANDIDATE, promptVersion: TASK_TIME_AUTHORITY_PROMPT,
    componentVersion: TASK_TIME_AUTHORITY_VERSION }
}
