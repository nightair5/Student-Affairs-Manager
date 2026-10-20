import type { RecognitionResult, TaskSuggestionV2, TimePointSuggestionV2 } from './types'

export const CITED_CONTEXT_SUPPORT_VERSION = 'cited-closed-context-support-1.0.0'
export interface CitedContextDecision {
  entityId: string
  rule: 'EXISTING_DELIVERY_FORM_ELLIPSIS' | 'EXISTING_UNIQUE_ACTIVITY_REGISTRATION' | 'EXISTING_HEADING_ACTIVITY_NAME'
  evidenceIds: string[]
  start: number
  end: number
  context: string
}
const tasksOf = (r: RecognitionResult) => [...r.standaloneTasks, ...r.milestones.flatMap(m => [...m.tasks, ...m.workPackages.flatMap(w => w.tasks)])]
const escape = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
const unsafe = /取消|作废|请勿|不得|禁止|不要|不必|无需|无须|不再|如果|假如|例如|(?:^|[，。；])若/u

/** Validate existing entities in a closed source context. This neither creates
 * entities nor asserts an event/task relation or personal eligibility. */
export function completeCitedContextSupport(r: RecognitionResult, source: string) {
  const decisions: CitedContextDecision[] = [], tasks = tasksOf(r)
  const valid = r.evidence.filter(e => e.quote && source.includes(e.quote) && source.indexOf(e.quote) === source.lastIndexOf(e.quote))
  const own = (ids: string[]) => valid.filter(e => ids.includes(e.id))
  const oneSource = (ids: string[]) => new Set(own(ids).map(e => e.sourceId)).size === 1
  const add = (entityId: string, rule: CitedContextDecision['rule'], ids: string[], start: number, end: number) => {
    decisions.push({ entityId, rule, evidenceIds: [...new Set(ids)], start, end, context: source.slice(start, end) })
  }
  for (const task of tasks) {
    const form = /^(.{1,60}?)(纸质件|电子件|纸质版|电子版)$/u.exec(task.actionObject), mine = own(task.evidenceIds)
    if (!form || !oneSource(task.evidenceIds) || !/^(?:提交|递交|上传|上交)$/u.test(task.actionVerb)) continue
    const parents = mine.filter(e => new RegExp('(?:需要|须|需|请)?(?:提交|递交|上交|上传)' + escape(form[1]) + '[。；]$', 'u').test(e.quote.trim()))
    const instructions = mine.filter(e => new RegExp('^' + escape(form[2]) + '(?:请|应|须|需|于|在)', 'u').test(e.quote.trim()) && e.quote.includes(task.actionVerb))
    if (parents.length !== 1 || instructions.length !== 1) continue
    const a = source.indexOf(parents[0].quote), b = source.indexOf(instructions[0].quote)
    if (b < a + parents[0].quote.length || parents[0].sourceId !== instructions[0].sourceId) continue
    // The parent and its form clauses must be contiguous. Only other forms of
    // that same already-declared object can intervene, never a new paragraph.
    const gap = source.slice(a + parents[0].quote.length, b)
    if (gap.trim() && !/^(?:\s*(?:纸质件|电子件|纸质版|电子版)[^。；\n]{1,240}[，,]\s*)$/u.test(gap)) continue
    const context = source.slice(a, b + instructions[0].quote.length)
    if (unsafe.test(context) || /另一|另交|分别为|不同|改交/u.test(context)) continue
    const forms = [...context.matchAll(/(?:^|[。；，,]\s*)(纸质件|电子件|纸质版|电子版)/gu)]
    if (forms.length > 2) continue
    add(task.tempId, 'EXISTING_DELIVERY_FORM_ELLIPSIS', [parents[0].id, instructions[0].id], a, b + instructions[0].quote.length)
  }
  for (const task of tasks.filter(t => /^(?:报名|注册|预约)$/u.test(t.actionVerb))) {
    const mine = own(task.evidenceIds)
    if (!oneSource(task.evidenceIds) || mine.some(e => e.quote.includes(task.actionObject))) continue
    const actions = mine.filter(e => /^(?:请)?(?:通过|使用)(?:下方|以下|本通知的)?二维码(?:进行)?(?:报名|注册|预约)[，,。]/u.test(e.quote.trim()) && !unsafe.test(e.quote))
    const events = r.events.filter(e => e.title === task.actionObject)
    if (actions.length !== 1 || events.length !== 1 || r.events.length !== 1 || tasks.filter(t => /^(?:报名|注册|预约)$/u.test(t.actionVerb)).length !== 1) continue
    const proofs = own(events[0].evidenceIds).filter(e => e.sourceId === actions[0].sourceId && e.quote.includes(task.actionObject) && !unsafe.test(e.quote))
    if (proofs.length !== 1) continue
    const a = source.indexOf(proofs[0].quote), b = source.indexOf(actions[0].quote)
    const context = source.slice(a, b + actions[0].quote.length)
    if (b < a + proofs[0].quote.length || !/^[\s]*$/u.test(source.slice(a + proofs[0].quote.length, b)) || unsafe.test(context)
      || /另一|另外|另有|另开|第二|分别|两场|两个|其他|其它|报名对象|报名的是/u.test(source)
      || source.indexOf(task.actionObject) !== source.lastIndexOf(task.actionObject)) continue
    task.evidenceIds = [...new Set([...task.evidenceIds, proofs[0].id])]
    add(task.tempId, 'EXISTING_UNIQUE_ACTIVITY_REGISTRATION', [actions[0].id, proofs[0].id], a, b + actions[0].quote.length)
  }
  for (const event of r.events) {
    const mine = own(event.evidenceIds)
    if (!oneSource(event.evidenceIds) || mine.some(e => e.quote.includes(event.title)) || r.events.length !== 1) continue
    const suffix = /(?:工作坊|讲座|研讨会|会议)$/u.exec(event.title)?.[0]
    if (!suffix) continue
    const headings = valid.filter(e => e.sourceId === mine[0].sourceId && e.quote.trim() === event.title + '申请事项'
      && source.slice(0, source.indexOf(e.quote)).trim() === '' && /^[\r\n]/u.test(source.slice(source.indexOf(e.quote) + e.quote.length)))
    const bodies = mine.filter(e => new RegExp('^' + escape(suffix) + '于', 'u').test(e.quote.trim()) && !unsafe.test(e.quote))
    if (headings.length !== 1 || bodies.length !== 1) continue
    const a = source.indexOf(headings[0].quote), b = source.indexOf(bodies[0].quote)
    const context = source.slice(a, b + bodies[0].quote.length)
    if (b <= a || /另一|另外|另有|另开|第二|分别|两场|两个|其他|其它/u.test(context)
      || context.slice(headings[0].quote.length).split(/\r?\n/u).some(line => /(?:申请事项|报名通知|活动通知)[：:]?$/u.test(line.trim()))) continue
    const points = [event.startTimePointTempId, event.endTimePointTempId].map(id => r.timePoints.find(p => p.tempId === id))
    if (points.some(p => !p || !p.evidenceIds.includes(bodies[0].id))) continue
    event.evidenceIds = [...new Set([...event.evidenceIds, headings[0].id])]
    add(event.tempId, 'EXISTING_HEADING_ACTIVITY_NAME', [headings[0].id, bodies[0].id], a, b + bodies[0].quote.length)
  }
  return { version: CITED_CONTEXT_SUPPORT_VERSION, decisions }
}

export const supportedFormTask = (t: TaskSuggestionV2, a: ReturnType<typeof completeCitedContextSupport>) =>
  a.decisions.some(d => d.entityId === t.tempId && d.rule === 'EXISTING_DELIVERY_FORM_ELLIPSIS')

/** Both endpoints and their reciprocal task owner must already exist. Select
 * the two literal clocks of one cited interval; do not create an end or trust
 * the model's normalized value. */
export function citedTaskClockEndpoint(point: TimePointSuggestionV2, r: RecognitionResult, source: string) {
  if (!['event_start', 'event_end'].includes(point.type) || r.events.some(e => [e.startTimePointTempId, e.endTimePointTempId].includes(point.tempId))) return null
  const owners = tasksOf(r).filter(t => point.relatedTaskTempIds.includes(t.tempId) && t.timePointTempIds.includes(point.tempId))
  if (owners.length !== 1 || point.relatedTaskTempIds.length !== 1) return null
  const owner = owners[0], points = r.timePoints.filter(p => p.relatedTaskTempIds.length === 1 && p.relatedTaskTempIds[0] === owner.tempId && owner.timePointTempIds.includes(p.tempId))
  const starts = points.filter(p => p.type === 'event_start'), ends = points.filter(p => p.type === 'event_end')
  if (starts.length !== 1 || ends.length !== 1) return null
  const proofs = r.evidence.filter(e => owner.evidenceIds.includes(e.id) && starts[0].evidenceIds.includes(e.id) && ends[0].evidenceIds.includes(e.id)
    && e.quote && source.includes(e.quote) && source.indexOf(e.quote) === source.lastIndexOf(e.quote) && !unsafe.test(e.quote) && e.quote.includes(owner.actionVerb))
  if (proofs.length !== 1) return null
  const matches = [...proofs[0].quote.matchAll(/(\d{4}年\d{1,2}月\d{1,2}日)\s*(\d{1,2}:[0-5]\d)\s*[-—–至到]\s*(\d{1,2}:[0-5]\d)/gu)]
  if (matches.length !== 1) return null
  const [literal, date, start, end] = matches[0], rawStart = date + start, rawEnd = date + end
  if (starts[0].rawText !== rawStart || ends[0].rawText !== rawEnd) return null
  const minutes = (v: string) => { const [h, m] = v.split(':').map(Number); return h < 24 ? h * 60 + m : null }
  const x = minutes(start), y = minutes(end)
  if (x === null || y === null || y <= x || /截止|截至|最迟/u.test(proofs[0].quote)) return null
  return { dateLiteral: date, endpoint: point.type === 'event_start' ? rawStart : rawEnd, context: proofs[0].quote,
    evidenceIds: [proofs[0].id], rule: 'EXISTING_TASK_OWNED_CLOCK_RANGE', literal }
}
