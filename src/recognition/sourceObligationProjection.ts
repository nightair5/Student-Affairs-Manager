import type { RecognitionResult, TaskSuggestionV2, TimePointSuggestionV2, EventSuggestion } from './types'
import { citedAlternativeObligations, citedConditionalObligations } from './nativeConditionalObligation'
import { existingHandlingWindows, type HandlingWindow } from './handlingWindowSupport'

export const SOURCE_OBLIGATION_VIEW_VERSION = 'source-obligation-view-1.0.0' as const
export interface ReceiptGoal {
  taskId: string
  completedInSource: boolean
  originalTasks: TaskSuggestionV2[]
  originalPoints: TimePointSuggestionV2[]
  opportunities: Array<{ id: 'normal' | 'missed'; originalTaskId: string; window: HandlingWindow; conditionQuotes: string[] }>
  evidenceIds: string[]
}
export interface PreparationRequirement {
  originalTask: TaskSuggestionV2
  originalEvent: EventSuggestion
  eventId: string
  evidenceIds: string[]
  quotes: string[]
  applicability: 'true' | 'false' | 'unknown'
}
export interface SourceObligationViews {
  version: typeof SOURCE_OBLIGATION_VIEW_VERSION
  receiptGoals: ReceiptGoal[]
  preparations: PreparationRequirement[]
}
const tasksOf = (r: RecognitionResult) => [...r.standaloneTasks, ...r.milestones.flatMap(m => [...m.tasks, ...m.workPackages.flatMap(w => w.tasks)])]
const distinct = <T,>(rows: T[]) => [...new Set(rows)]
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const taskFacts = (t: TaskSuggestionV2) => ({ actionVerb: t.actionVerb, actionObject: t.actionObject, materialTempIds: t.materialTempIds, timePointTempIds: t.timePointTempIds, evidenceIds: t.evidenceIds, dependencyTempIds: t.dependencyTempIds })

/** A receipt goal is a proven same-delivery projection, never a merge of
 * confirmed records. Keep both original declarations and every source point. */
export function projectSourceObligationViews(r: RecognitionResult, source: string, referenceTime: string, timezone: string): SourceObligationViews {
  const audit: SourceObligationViews = { version: SOURCE_OBLIGATION_VIEW_VERSION, receiptGoals: [], preparations: [] }
  if (!r.promptVersion.startsWith('recognition-product-contract-')) return audit
  const windows = existingHandlingWindows(r, source, referenceTime, timezone).rows
  for (const condition of citedAlternativeObligations(r, source)) {
    const fallback = r.standaloneTasks.find(t => t.tempId === condition.taskId), base = r.standaloneTasks.find(t => t.tempId === condition.alternativeTaskId)
    if (!fallback || !base || fallback.parentTempId || base.parentTempId || base.dependencyTempIds.length || fallback.dependencyTempIds.length
      || r.events.some(e => e.relatedTaskTempIds?.some(id => [base.tempId, fallback.tempId].includes(id)))
      || tasksOf(r).some(t => t !== base && t !== fallback && (t.parentTempId === fallback.tempId || t.dependencyTempIds.includes(fallback.tempId)))
      || r.conflicts.some(c => c.requiresDecision && c.entityTempIds.some(id => [base.tempId, fallback.tempId].includes(id)))) continue
    const a = windows.filter(w => w.taskId === base.tempId), b = windows.filter(w => w.taskId === fallback.tempId)
    if (a.length !== 1 || b.length !== 1 || a[0].end >= b[0].start || new Set([...a[0].pointIds, ...b[0].pointIds]).size !== 4) continue
    const evidenceIds = distinct([...base.evidenceIds, ...fallback.evidenceIds])
    const evidence = evidenceIds.map(id => r.evidence.find(e => e.id === id))
    if (evidence.some(e => !e || !source.includes(e.quote)) || new Set(evidence.map(e => e!.sourceId)).size !== 1) continue
    const goal: ReceiptGoal = { taskId: base.tempId, completedInSource:condition.sourceConditionValue==='false', originalTasks: structuredClone([base, fallback]),
      originalPoints: structuredClone(r.timePoints.filter(p => [...a[0].pointIds, ...b[0].pointIds].includes(p.tempId))),
      opportunities: [{ id: 'normal', originalTaskId: base.tempId, window: a[0], conditionQuotes: [] }, { id: 'missed', originalTaskId: fallback.tempId, window: b[0], conditionQuotes: condition.ruleQuotes }], evidenceIds }
    base.evidenceIds = evidenceIds; base.timePointTempIds = distinct([...base.timePointTempIds, ...fallback.timePointTempIds])
    base.materialTempIds = distinct([...base.materialTempIds, ...fallback.materialTempIds])
    // Conjoining branch-specific "collected in this window" criteria would
    // require the same delivery twice. Originals remain in audit/source prose.
    base.completionCriteria = [`已按实际适用的一种办理机会领取${base.actionObject}；正常与补领无需重复完成。`]
    if(goal.completedInSource)base.selected=false
    base.description = distinct(evidence.map(e => e!.quote)).join('\n')
    for (const point of r.timePoints) if (point.relatedTaskTempIds.includes(fallback.tempId)) point.relatedTaskTempIds = distinct(point.relatedTaskTempIds.map(id => id === fallback.tempId ? base.tempId : id))
    for (const material of r.materials) if (material.relatedTaskTempIds.includes(fallback.tempId)) material.relatedTaskTempIds = distinct(material.relatedTaskTempIds.map(id => id === fallback.tempId ? base.tempId : id))
    r.standaloneTasks = r.standaloneTasks.filter(t => t !== fallback)
    audit.receiptGoals.push(goal)
  }
  // R3: an already-declared post-admission preparation without an independent
  // delivery/time is an activity requirement. Its actual condition stays in
  // the activity text; no registration prerequisite or invented material.
  for (const condition of citedConditionalObligations(r, source)) {
    const task = r.standaloneTasks.find(t => t.tempId === condition.taskId)
    if (!task || task.actionVerb !== '准备' || task.parentTempId || task.timePointTempIds.length || task.materialTempIds.length || task.dependencyTempIds.length || r.events.length !== 1) continue
    if (tasksOf(r).some(t => t !== task && (t.parentTempId === task.tempId || t.dependencyTempIds.includes(task.tempId)))
      || r.timePoints.some(p => p.relatedTaskTempIds.includes(task.tempId)) || r.materials.some(m => m.relatedTaskTempIds.includes(task.tempId))
      || r.conflicts.some(c => c.requiresDecision && c.entityTempIds.includes(task.tempId))) continue
    const evidence = r.evidence.filter(e => task.evidenceIds.includes(e.id))
    const event = r.events[0], own = r.evidence.filter(e => event.evidenceIds.includes(e.id))
    if (!evidence.length || !own.length || [...evidence, ...own].some(e => !e.quote || !source.includes(e.quote) || source.indexOf(e.quote) !== source.lastIndexOf(e.quote))
      || new Set([...evidence, ...own].map(e => e.sourceId)).size !== 1
      || !condition.ruleQuotes.every(q => q.includes(task.actionObject) && /入选|录取|正式学员/u.test(q))
      || evidence.some(e => /截止|最迟|之前|前往|办公室|另一|另行|提交|递交|领取|盖章|签字|不得|禁止|请勿|取消/u.test(e.quote))
      || source.split(/\r?\n/u).some(line => /另一(?:个|场)|第二(?:个|场)|另有/u.test(line))) continue
    const index = source.indexOf(condition.ruleQuotes[0]), eventStart = Math.min(...own.map(e => source.indexOf(e.quote)))
    if (Math.abs(index - eventStart) > 1200) continue
    const sameSentence=own.some(e=>condition.ruleQuotes.every(q=>e.quote.includes(q)))
    const adjacent=own.some(e=>{const start=source.indexOf(e.quote),end=start+e.quote.length;return index>=end&&/^\s*$/u.test(source.slice(end,index))})
    const heading=own.some(e=>e.quote.trim()===event.title+'申请事项'&&source.slice(0,source.indexOf(e.quote)).trim()==='')
    const foreignHeading=source.split(/\r?\n/u).some((line,i)=>{
      const text=line.trim(),label=/^([^：:。]{2,50})[：:]/u.exec(text)?.[1]
      return Boolean(label&&/比赛|培训|讲座|工作坊|课程|活动|事项|通知/u.test(label)&&!label.includes(event.title))
        || i>0&&/^[^。；]{2,60}(?:事项|通知|工作坊|讲座|比赛|课程)[：:]?$/u.test(text)&&!text.includes(event.title)
    })
    if(foreignHeading||!sameSentence&&!adjacent&&!heading)continue
    audit.preparations.push({ originalTask: structuredClone(task), originalEvent:structuredClone(event), eventId: event.tempId, evidenceIds: [...task.evidenceIds], quotes: evidence.map(e => e.quote), applicability: condition.sourceConditionValue ?? 'unknown' })
    event.evidenceIds = distinct([...event.evidenceIds, ...task.evidenceIds])
    event.description = distinct([...own.map(e => e.quote), ...evidence.map(e => e.quote)]).join('\n')
    event.relatedTaskTempIds=event.relatedTaskTempIds?.filter(id=>id!==task.tempId)
    if (condition.sourceConditionValue !== 'true') event.selected = false
    r.standaloneTasks = r.standaloneTasks.filter(t => t !== task)
  }
  if (audit.receiptGoals.length) r.sourceSummary.summary = `${tasksOf(r).length}项任务；领取事项包含正常办理与错过后的替代机会，按实际情况选择一种。`
  else if (audit.preparations.length) r.sourceSummary.summary = `${tasksOf(r).length}项任务，${r.events.length}项活动；入选后的准备要求随活动保留。`
  return audit
}

/** Recompute the narrow source proof from original declarations, then check
 * the live folded facts. Audit metadata alone is never planning authority. */
export function verifiedReceiptGoals(r: RecognitionResult, source: string, value: unknown): ReceiptGoal[] {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== SOURCE_OBLIGATION_VIEW_VERSION || !('receiptGoals' in value) || !Array.isArray(value.receiptGoals)) return []
  return value.receiptGoals.flatMap((entry: unknown) => {
    try {
      if (!entry || typeof entry !== 'object') return []
      const g = entry as ReceiptGoal
      if (!Array.isArray(g.originalTasks) || g.originalTasks.length !== 2 || !Array.isArray(g.originalPoints) || g.originalPoints.length !== 4 || !Array.isArray(g.opportunities) || g.opportunities.length !== 2) return []
      const task = tasksOf(r).find(t => t.tempId === g.taskId)
      if (!task || tasksOf(r).some(t => t.tempId === g.originalTasks[1].tempId)) return []
      const original = structuredClone(r)
      original.standaloneTasks = structuredClone(g.originalTasks); original.milestones = []; original.events = []; original.timePoints = structuredClone(g.originalPoints)
      const recomputed = projectSourceObligationViews(original, source, g.opportunities[0].window.referenceTime, g.opportunities[0].window.timezone)
      if (recomputed.receiptGoals.length !== 1 || !same(recomputed.receiptGoals[0], g) || !same(taskFacts(original.standaloneTasks[0]), taskFacts(task))) return []
      for (const point of g.originalPoints) {
        const expected = { ...point, relatedTaskTempIds: distinct(point.relatedTaskTempIds.map(id => id === g.originalTasks[1].tempId ? g.taskId : id)) }
        const actual = r.timePoints.find(p => p.tempId === point.tempId)
        if (!actual || !same({ ...actual, selected: undefined }, { ...expected, selected: undefined })) return []
      }
      return [g]
    } catch { return [] }
  })
}

/** A coverage hint may recognise a projected requirement only while its
 * source proof and the live activity still match. An audit flag cannot hide
 * a missing requirement after editing or a relationship change. */
export function verifiedPreparationRequirements(r: RecognitionResult, source: string, value: unknown): PreparationRequirement[] {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== SOURCE_OBLIGATION_VIEW_VERSION || !('preparations' in value) || !Array.isArray(value.preparations)) return []
  return value.preparations.flatMap((entry: unknown) => {
    try {
      const p = entry as PreparationRequirement
      if (!p?.originalTask || !p.originalEvent || tasksOf(r).some(t => t.tempId === p.originalTask.tempId)) return []
      const event = r.events.find(e => e.tempId === p.eventId)
      if (!event) return []
      const original = structuredClone(r)
      original.standaloneTasks.push(structuredClone(p.originalTask))
      original.events = original.events.map(e => e.tempId === p.eventId ? structuredClone(p.originalEvent) : e)
      const expected = projectSourceObligationViews(original, source, r.createdAt, 'Asia/Shanghai').preparations
      if (!expected.some(row => same(row, p))) return []
      const projected = original.events.find(e => e.tempId === p.eventId)
      if (!projected || !same({...projected, selected: undefined}, {...event, selected: undefined})) return []
      return [p]
    } catch { return [] }
  })
}
