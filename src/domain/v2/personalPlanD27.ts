import type { CanonicalWorkspaceRepository } from './repository'
import type { HistoryRecord, JsonValue, Task, TimePoint, WorkspaceV8 } from './types'
import { addDateOnlyDays, instantToWallClock, isDateOnly, parseBusinessDateTime, wallClockToInstant } from '../../lib/timeSemantics'
import {citedTaskDateRange} from '../../../cloudflare/cited-event-sequence.mjs'
import {interpretTimeD26} from '../../lib/timeSemanticsD26'
import {projectCitedClockRanges} from '../../../cloudflare/cited-clock-range.mjs'
import {sourceReadinessValue,unresolvedSourceReadiness} from './sourceReadiness'
import {canonicalHandlingWindow,canonicalHandlingEvent} from './handlingWindow'

export const PLAN_VERSION = 'personal-plan-d27-1' as const
export const SOURCE_WINDOW_PLAN_VERSION = 'source-window-plan-1.4.0' as const
export const PLAN_RECEIPT = 'personalPlanD27Receipt'
export const PLAN_UNDO = 'personalPlanD27Undo'
export type DurationOrigin = 'user' | 'recorded_estimate' | 'product_estimate'
export interface PlanMetadata {
  version: typeof PLAN_VERSION
  minutes: number
  durationOrigin: DurationOrigin
  locked: boolean
  operationId: string
  conditionalOn: string[]
}
export interface PlanOptions {
  now: string
  startDate: string
  days: number
  startTime: string
  endTime: string
  estimateMinutes: number | null
  overrides: Record<string, { start?: string; minutes?: number; locked?: boolean; later?: boolean }>
}
export interface PlanSegment {
  taskId: string
  title: string
  start: string
  end: string
  minutes: number
  durationOrigin: DurationOrigin
  locked: boolean
  conditionalOn: string[]
  reason: string
  originalDeadline: string | null
  retained: boolean
}
export interface UnscheduledTask { taskId: string; title: string; code: string; reason: string }
export interface PlanProposal {
  version: typeof PLAN_VERSION
  id: string
  workspaceId: string
  baseline: string
  options: PlanOptions
  segments: PlanSegment[]
  unscheduled: UnscheduledTask[]
  warnings: string[]
}
export interface PlanReceipt {
  version: typeof PLAN_VERSION
  commitId: string
  kind: 'apply' | 'undo'
  verified: boolean
  payload: string
  pointIds: string[]
  expectedPoints: string
  previousPoints: TimePoint[]
  afterBaseline: string
  committedAt: string
}
const record = (value: unknown): Record<string, unknown> | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
const validMinutes = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 5 && v <= 480
const clockMinutes = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? Number(v.slice(0, 2)) * 60 + Number(v.slice(3)) : NaN
const sorted = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id))
const ownPoint = (p: TimePoint) => p.legacyData?.personalPlanD27 !== undefined
export function planMetadata(p: TimePoint): PlanMetadata | null {
  if (!ownPoint(p)) return null
  const m = record(p.legacyData?.personalPlanD27)
  if (!m || m.version !== PLAN_VERSION || !validMinutes(m.minutes) || !['user', 'recorded_estimate', 'product_estimate'].includes(String(m.durationOrigin)) || typeof m.locked !== 'boolean' || typeof m.operationId !== 'string' || !Array.isArray(m.conditionalOn) || m.conditionalOn.some(v => typeof v !== 'string') || p.type !== 'planned_start' || p.precision !== 'exact' || p.needsConfirmation || !p.taskId || p.relatedTaskIds.length !== 1 || p.relatedTaskIds[0] !== p.taskId || !p.normalizedValue || !parseBusinessDateTime(p.normalizedValue, p.timezone ?? 'Asia/Shanghai')) throw Error('PERSONAL_PLAN_METADATA_INVALID')
  return m as unknown as PlanMetadata
}
export function validatePersonalPlanMetadata(w: WorkspaceV8): void {
  const ids = new Set<string>()
  for (const p of w.timePoints.filter(ownPoint)) {
    const meta = planMetadata(p)!
    if (ids.has(p.taskId!) || meta.conditionalOn.some(id => !w.tasks.some(t => t.id === id))) throw Error('PERSONAL_PLAN_METADATA_INVALID')
    ids.add(p.taskId!)
  }
  for (const key of [PLAN_RECEIPT, PLAN_UNDO]) {
    const raw = w.preferences.legacyData?.[key]
    if (raw === undefined) continue
    const r = record(raw)
    if (!r || r.version !== PLAN_VERSION || !['apply', 'undo'].includes(String(r.kind)) || typeof r.verified !== 'boolean' || typeof r.commitId !== 'string' || typeof r.payload !== 'string' || r.payload.length > 1_500_000 || typeof r.expectedPoints !== 'string' || typeof r.afterBaseline !== 'string' || typeof r.committedAt !== 'string' || !Array.isArray(r.previousPoints) || r.previousPoints.length > 200 || !Array.isArray(r.pointIds) || r.pointIds.length > 200 || r.pointIds.some(id => typeof id !== 'string')) throw Error('PERSONAL_PLAN_RECEIPT_INVALID')
    for (const old of r.previousPoints) { const point = old as TimePoint; if (!planMetadata(point) || point.id !== 'personal-plan:' + point.taskId || !w.tasks.some(t => t.id === point.taskId)) throw Error('PERSONAL_PLAN_RECEIPT_INVALID') }
  }
}
function taskGaps(w: WorkspaceV8, t: Task): string[] {
  const temp = t.legacyData?.recognitionTempId
  const draft = w.extractionDrafts.find(d => d.acceptedEntityTempIds.includes(String(temp)) && w.recognitionRuns.find(r => r.id === d.recognitionRunId)?.sourceVersionId === w.sourceVersions.find(v => v.sourceId === t.legacyData?.sourceId && v.id === w.recognitionRuns.find(r => r.id === d.recognitionRunId)?.sourceVersionId)?.id)
  const sidecar = record(draft?.legacyData?.semanticSidecar)
  const semantic = record(sidecar?.firstSemantic)
  const row = Array.isArray(semantic?.tasks) ? semantic.tasks.map(record).find(row => row?.id === temp) : undefined
  const condition = record(row?.condition), semantics = record(row?.semantics)
  const codes: string[] = []
  if (condition?.value === 'unknown' && (!draft || sourceReadinessValue(w,draft.id,String(temp))===undefined)) codes.push('QUALIFICATION_UNKNOWN')
  // Already-confirmed native drafts may predate the eligibility review guard.
  // Do not schedule them as unconditional work merely because they were saved.
  if(draft&&!condition){try{if(unresolvedSourceReadiness(w,draft.id,String(temp),true))codes.push('QUALIFICATION_UNKNOWN')}catch{codes.push('RELATION_NEEDS_REVIEW')}}
  if(draft&&sourceReadinessValue(w,draft.id,String(temp))==='false')codes.push('NOT_APPLICABLE')
  if (condition?.value === 'false') codes.push('NOT_APPLICABLE')
  if (semantics && (semantics.status !== 'pending' || semantics.validity !== 'active' || semantics.polarity !== 'affirmative')) codes.push('NOT_CURRENT_ACTION')
  if (Array.isArray(sidecar?.representationGaps) && sidecar.representationGaps.map(record).some(g => Array.isArray(g?.entityIds) && g.entityIds.includes(temp) && ['revision', 'lifecycle', 'unresolved_scope'].includes(String(g.kind)))) codes.push('RELATION_NEEDS_REVIEW')
  return codes
}
/** Exact, scoped read-set comparison: no hash collision or caller-supplied revision is trusted. */
export function planBaseline(w: WorkspaceV8): string {
  const entityIds = new Set([...w.tasks, ...w.events, ...w.timePoints].map(e => e.id))
  const relevantVersions = new Set(w.historyRecords.filter(h => entityIds.has(h.entityId) && h.sourceVersionId).map(h => h.sourceVersionId!))
  const sourceIds = new Set(w.tasks.map(t => t.legacyData?.sourceId).filter(v => typeof v === 'string'))
  for (const id of relevantVersions) { const v = w.sourceVersions.find(v => v.id === id); if (v) sourceIds.add(v.sourceId) }
  return JSON.stringify({ workspaceId: w.workspace.id, timezone: w.settings.defaultTimezone, sourceWindowProgram: SOURCE_WINDOW_PLAN_VERSION,
    tasks: sorted(w.tasks).map(t => ({ id: t.id, title: t.title, status: t.status, estimatedMinutes: t.estimatedMinutes, manualPriority: t.manualPriority, snoozedUntil: t.snoozedUntil, dependencyIds: [...t.dependencyIds].sort(), sourceId: t.legacyData?.sourceId ?? null, actionVerb:t.legacyData?.actionVerb??null, sourceWindowDeclarations:t.legacyData?.sourceWindowDeclarations??null, existingHandlingWindow:t.legacyData?.existingHandlingWindow??null, verifiedHandlingWindow:canonicalHandlingWindow(w,t),gaps: taskGaps(w, t) })),
    times: sorted(w.timePoints).map(p => ({ id: p.id, type: p.type, taskId: p.taskId, eventId: p.eventId, relatedTaskIds: [...p.relatedTaskIds].sort(), relatedMaterialIds:[...p.relatedMaterialIds].sort(), materialId:p.materialId, rawText:p.rawText, normalizedValue: p.normalizedValue, timezone: p.timezone, precision: p.precision, needsConfirmation: p.needsConfirmation, sourceTimeRole:p.legacyData?.sourceTimeRole??null, evidenceIds:p.legacyData?.evidenceIds??null, metadata: p.legacyData?.personalPlanD27 ?? null })),
    sourceWindowEvidence:sorted(w.evidenceRefs.filter(ref=>w.timePoints.some(p=>Array.isArray(p.legacyData?.evidenceIds)&&p.legacyData.evidenceIds.includes(ref.legacyData?.recognitionEvidenceId??null)))).map(ref=>({id:ref.id,sourceVersionId:ref.sourceVersionId,quotedText:ref.quotedText,textStart:ref.textStart,textEnd:ref.textEnd,recognitionEvidenceId:ref.legacyData?.recognitionEvidenceId??null})),
    events: sorted(w.events).map(e => ({ id: e.id, startTimePointId: e.startTimePointId, endTimePointId: e.endTimePointId,verifiedHandlingWindow:canonicalHandlingEvent(w,e) })),
    sourceVersions: sorted(w.sources.filter(s => sourceIds.has(s.id))).map(s => ({ id: s.id, current: s.currentVersionId, version: w.sourceVersions.find(v => v.id === s.currentVersionId) })),
    nativeWindowDrafts:sorted(w.extractionDrafts.filter(d=>w.recognitionRuns.some(r=>r.id===d.recognitionRunId&&w.sourceVersions.some(v=>v.id===r.sourceVersionId&&sourceIds.has(v.sourceId))))).map(d=>({id:d.id,acceptedEntityTempIds:[...d.acceptedEntityTempIds].sort(),result:d.result?{tasks:[...d.result.standaloneTasks,...d.result.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(wp=>wp.tasks)])].map(t=>({tempId:t.tempId,timePointTempIds:t.timePointTempIds,evidenceIds:t.evidenceIds})),timePoints:d.result.timePoints.map(p=>({tempId:p.tempId,type:p.type,rawText:p.rawText,relatedTaskTempIds:p.relatedTaskTempIds,evidenceIds:p.evidenceIds})),evidence:d.result.evidence.map(e=>({id:e.id,quote:e.quote}))}:null})),
    courses: w.preferences.legacyData?.courseBlocks ?? [],
  })
}
const reasons: Record<string, string> = {
  FIXED_EVENT_ENDED:'关联的固定活动已结束；保留原时间，不改排到今天。',FIXED_EVENT_ALREADY_ON_CALENDAR:'按原文固定活动时间行动；已在日历显示，不另排个人开工时间。',FIXED_EVENT_NEEDS_REVIEW:'关联活动的时间尚未完整确定；保留原文，不改排到其他时刻。',
  SOURCE_ACTION_TIME_NEEDS_REVIEW:'原文指定办理时间尚未确定，保留原文，不改排到其他时刻。',SOURCE_ACTION_TIME_OUTSIDE_PLAN:'原文指定办理时刻不在可用范围内或存在冲突；保留指定时间。',
  SOURCE_WINDOW_NEEDS_REVIEW:'原文办理窗口的起止或开放日期尚未完整确定，先保留待定；不会猜晚上、休息日也开放。', SOURCE_WINDOW_OUTSIDE_PLAN:'本次安排范围不在原文开放窗口内；保留待办，不改原文时间。',
  COMPLETED: '已经完成，不重复安排。', CANCELLED: '已取消，不安排执行。', NOT_APPLICABLE: '资格不适用，不安排执行。', QUALIFICATION_UNKNOWN: '资格尚未确认，先保留待定。', NOT_CURRENT_ACTION: '不是当前有效行动。', RELATION_NEEDS_REVIEW: '修订或关联仍待核对。',
  DURATION_UNKNOWN: '耗时未知，且本次未采用估计。', DEPENDENCY_MISSING: '找不到前置事项，不能猜它已完成。', DEPENDENCY_CYCLE: '前置事项形成循环，无法确定执行顺序。', DEPENDENCY_UNSCHEDULED: '前置事项尚未排入，不能排在它之前。', OVERDUE: '原文截止已过，需明确改期决定。', CAPACITY: '可用时间不足，无法在窗口或截止前连续完成。', USER_LATER: '你选择以后再安排。', LEGACY_PLAN_UNBOUNDED: '已有个人计划缺少可靠时长，保留原计划，暂不移动。', INVALID_MANUAL_SLOT: '调整后与可用时间、固定占用、截止或前置安排冲突。', DEADLINE_CONFLICT: '存在相互矛盾或未核实的具体截止，先核对。', LOCK_CONFLICT: '锁定时间与当前固定活动、期限或前置发生冲突，保留锁定并提示。',
}
export function defaultPlanOptions(now = new Date(), timezone = 'Asia/Shanghai'): PlanOptions {
  const wall = instantToWallClock(now, timezone)
  return { now: now.toISOString(), startDate: wall.toISOString().slice(0, 10), days: 7, startTime: '09:00', endTime: '18:00', estimateMinutes: 30, overrides: {} }
}
export function validatePlanOptions(o: PlanOptions): void {
  if (!isDateOnly(o.startDate) || !Number.isInteger(o.days) || o.days < 1 || o.days > 14 || !Number.isFinite(Date.parse(o.now)) || !Number.isFinite(clockMinutes(o.startTime)) || clockMinutes(o.endTime) <= clockMinutes(o.startTime) || o.estimateMinutes !== null && !validMinutes(o.estimateMinutes) || Object.keys(o.overrides).length > 200) throw Error('PERSONAL_PLAN_OPTIONS_INVALID')
  for (const v of Object.values(o.overrides)) if (v.minutes !== undefined && !validMinutes(v.minutes) || v.locked !== undefined && typeof v.locked !== 'boolean' || v.later !== undefined && typeof v.later !== 'boolean') throw Error('PERSONAL_PLAN_OPTIONS_INVALID')
}
type Interval = { start: number; end: number }
const overlap = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end
const pointMs = (p: TimePoint | undefined, timezone: string) => p?.precision === 'exact' && !p.needsConfirmation && p.normalizedValue ? parseBusinessDateTime(p.normalizedValue, p.timezone ?? timezone)?.getTime() : undefined
// Calendar windows constrain personal slots by whole stated dates. These bounds
// never replace the source value/precision with a fabricated source clock time.
const sourceWindowMs = (p: TimePoint, timezone: string, end: boolean) => {
  if (p.needsConfirmation || !p.normalizedValue) return undefined
  if (p.precision === 'date_only' && isDateOnly(p.normalizedValue)) {
    const date = end ? addDateOnlyDays(p.normalizedValue, 1) : p.normalizedValue
    return parseBusinessDateTime(date + 'T00:00', p.timezone ?? timezone)?.getTime()
  }
  return pointMs(p, timezone)
}
interface SourceBounds { start:number;end:number;intervals:Interval[];invalid:boolean;present:boolean }
function sourceWindowEvidence(w:WorkspaceV8,point:TimePoint,sourceVersionId:string,rawText:string,sourceText:string):boolean {
  const ids=point.legacyData?.evidenceIds
  if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string'))return false
  const refs=ids.map(id=>w.evidenceRefs.find(ref=>ref.sourceVersionId===sourceVersionId&&ref.legacyData?.recognitionEvidenceId===id))
  if(refs.some(ref=>!ref||!ref.quotedText||!sourceText.includes(ref.quotedText)))return false
  if(refs.some(ref=>ref!.quotedText!.includes(rawText)))return true
  // A window can span comma-separated immutable scopes. Verify their literal
  // source ranges cover this declaration, rather than requiring one scope to
  // duplicate the whole window or accepting clocks from a different sentence.
  const ranges=refs.flatMap(ref=>{
    const quote=ref!.quotedText!,start=ref!.textStart??sourceText.indexOf(quote)
    const end=ref!.textEnd??start+quote.length
    // Canonical scoped quotes currently omit offsets. An unambiguous literal
    // occurrence can be located mechanically; repeated quotation stays local
    // unknown rather than borrowing a different object's matching sentence.
    return start>=0&&sourceText.slice(start,end)===quote&&(ref!.textStart!==null||sourceText.indexOf(quote,start+1)<0)?[{start,end}]:[]
  }).sort((a,b)=>a.start-b.start||a.end-b.end)
  for(let start=sourceText.indexOf(rawText);start>=0;start=sourceText.indexOf(rawText,start+1)){
    let cursor=start
    for(const range of ranges){if(range.start>cursor)break;if(range.end>cursor)cursor=range.end}
    if(cursor>=start+rawText.length)return true
  }
  return false
}
function sourceWindowBounds(w:WorkspaceV8,t:Task,zone:string):SourceBounds {
  const points=w.timePoints.filter(p=>p.relatedTaskIds.includes(t.id)&&['window_start','window_end'].includes(String(p.legacyData?.sourceTimeRole)))
  const metadata=record(t.legacyData?.sourceWindowDeclarations)
  const invalid:SourceBounds={start:-Infinity,end:Infinity,intervals:[],invalid:true,present:true}
  if(t.legacyData?.existingHandlingWindow!==undefined){
    const proof=canonicalHandlingWindow(w,t)
    if(!proof||proof.row.kind==='OPEN_DAYS_UNSTATED')return invalid
    const row=proof.row,intervals:Interval[]=[]
    const first=row.start.slice(0,10),last=row.end.slice(0,10)
    if(row.kind==='DATE_ONLY_PERIOD'){
      const a=parseBusinessDateTime(first+'T00:00',row.timezone)?.getTime(),b=parseBusinessDateTime(addDateOnlyDays(last,1)+'T00:00',row.timezone)?.getTime()
      if(a===undefined||b===undefined||b<=a)return invalid
      return {start:a,end:b,intervals:[{start:a,end:b}],invalid:false,present:true}
    }
    for(let i=0;i<62;i++){
      const date=addDateOnlyDays(first,i);if(date>last)break
      const a=parseBusinessDateTime(date+'T'+row.dayStart,row.timezone)?.getTime(),b=parseBusinessDateTime(date+'T'+row.dayEnd,row.timezone)?.getTime()
      if(a===undefined||b===undefined||b<=a)return invalid
      intervals.push({start:a,end:b})
    }
    if(!intervals.length||addDateOnlyDays(first,intervals.length-1)!==last)return invalid
    return {start:intervals[0].start,end:intervals.at(-1)!.end,intervals,invalid:false,present:true}
  }
  if(t.legacyData?.sourceWindowDeclarations!==undefined){
    const version=typeof metadata?.sourceVersionId==='string'?w.sourceVersions.find(v=>v.id===metadata.sourceVersionId):undefined
    const draft=typeof metadata?.draftId==='string'?w.extractionDrafts.find(d=>d.id===metadata.draftId):undefined
    // Both known projections use the same declaration structure. A version
    // label alone never establishes valid bounds: all pairs and citations are
    // independently checked below; future versions require explicit review.
    if(!metadata||metadata.version!=='source-window-declarations-1.0.0'||!['task-time-authority-projection-1.0.0','task-time-authority-projection-1.0.1','ordinary-cited-window-projection-1.0.0','ordinary-cited-window-projection-1.0.1'].includes(String(metadata.auditVersion))
      ||metadata.ownerTaskId!==t.id||metadata.ownerTempId!==t.legacyData?.recognitionTempId||metadata.sourceId!==t.legacyData?.sourceId
      ||!draft||!draft.acceptedEntityTempIds.includes(String(metadata.ownerTempId))||w.recognitionRuns.find(run=>run.id===draft.recognitionRunId)?.sourceVersionId!==metadata.sourceVersionId
      ||!version||typeof version.rawText!=='string'||version.sourceId!==metadata.sourceId||!Array.isArray(metadata.windows)||!metadata.windows.length||metadata.windows.length>4)return invalid
    const pointIds=new Set<string>(),windowIds=new Set<string>(),intervalIds=new Set<string>(),intervals:Interval[]=[]
    for(const raw of metadata.windows){
      const window=record(raw)
      if(!window||!['RESOLVED_DISCRETE','RESOLVED_DATE_RANGE'].includes(String(window.state))||typeof window.windowId!=='string'||windowIds.has(window.windowId)
        ||typeof window.rawText!=='string'||!window.rawText.length||!version.rawText.includes(window.rawText)
        ||!Array.isArray(window.scopeIds)||!window.scopeIds.length||window.scopeIds.some(id=>typeof id!=='string')
        ||!Array.isArray(window.pointIds)||!window.pointIds.length||window.pointIds.some(id=>typeof id!=='string')
        ||!Array.isArray(window.intervals)||!window.intervals.length||window.intervals.length>100)return invalid
      windowIds.add(window.windowId)
      const declared=new Set(window.pointIds)
      if(declared.size!==window.pointIds.length)return invalid
      const covered=new Set<string>()
      for(const rawPair of window.intervals){
        const pair=record(rawPair),start=typeof pair?.startPointId==='string'?w.timePoints.find(p=>p.id===pair.startPointId):undefined,end=typeof pair?.endPointId==='string'?w.timePoints.find(p=>p.id===pair.endPointId):undefined
        if(!pair||typeof pair.intervalId!=='string'||intervalIds.has(pair.intervalId)||!start||!end||start.id===end.id||pointIds.has(start.id)||pointIds.has(end.id)
          ||!declared.has(start.id)||!declared.has(end.id)||!['exact','date_only'].includes(String(pair.precision))
          ||typeof pair.date!=='string'||!isDateOnly(pair.date)||typeof pair.start!=='string'||!pair.start.startsWith(pair.date)
          ||window.state==='RESOLVED_DISCRETE'&&(pair.precision!=='exact'||!Number.isInteger(pair.sessionIndex)||Number(pair.sessionIndex)<0||Number(pair.sessionIndex)>3)
          ||window.state==='RESOLVED_DATE_RANGE'&&(pair.precision!=='date_only'||pair.sessionIndex!==null||window.intervals.length!==1)
          ||pair.start!==start.normalizedValue||pair.end!==end.normalizedValue||start.precision!==pair.precision||end.precision!==pair.precision
          ||start.timezone!==end.timezone||start.type!=='event_start'||end.type!=='event_end'
          ||start.legacyData?.sourceTimeRole!=='window_start'||end.legacyData?.sourceTimeRole!=='window_end')return invalid
        for(const point of [start,end]){
          if(point.taskId!==t.id||point.eventId!==null||point.materialId!==null||point.relatedTaskIds.length!==1||point.relatedTaskIds[0]!==t.id||point.relatedMaterialIds.length
            ||point.rawText!==window.rawText||!sourceWindowEvidence(w,point,version.id,window.rawText,version.rawText))return invalid
        }
        const a=sourceWindowMs(start,zone,false),b=sourceWindowMs(end,zone,true)
        if(a===undefined||b===undefined||b<=a)return invalid
        intervals.push({start:a,end:b});intervalIds.add(pair.intervalId);pointIds.add(start.id);pointIds.add(end.id);covered.add(start.id);covered.add(end.id)
      }
      if(covered.size!==declared.size)return invalid
    }
    if(pointIds.size!==points.length||points.some(point=>!pointIds.has(point.id)))return invalid
    return {start:Math.min(...intervals.map(i=>i.start)),end:Math.max(...intervals.map(i=>i.end)),intervals:intervals.sort((a,b)=>a.start-b.start||a.end-b.end),invalid:false,present:true}
  }
  if(!points.length){
    // Native ordinary results may already declare both ends of one shared
    // task window without the semantic sidecar. Validate the stored graph and
    // citations; absence of the sidecar must not schedule outside that window.
    const native=w.timePoints.filter(p=>p.relatedTaskIds.includes(t.id)&&p.eventId===null&&['event_start','event_end'].includes(p.type)
      &&(/月\d{1,2}日?\s*[-—–至到]/u.test(p.rawText)||/\d{1,2}:[0-5]\d\s*[-—–至到]/u.test(p.rawText)))
    if(!native.length)return {start:-Infinity,end:Infinity,intervals:[{start:-Infinity,end:Infinity}],invalid:false,present:false}
    const starts=native.filter(p=>p.type==='event_start'),ends=native.filter(p=>p.type==='event_end')
    const source=w.sources.find(s=>s.id===t.legacyData?.sourceId),version=w.sourceVersions.find(v=>v.id===source?.currentVersionId)
    const draft=w.extractionDrafts.find(d=>d.acceptedEntityTempIds.includes(String(t.legacyData?.recognitionTempId))&&w.recognitionRuns.find(r=>r.id===d.recognitionRunId)?.sourceVersionId===version?.id)
    const raw=draft?.result,rawTasks=raw?[...raw.standaloneTasks,...raw.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(wp=>wp.tasks)])]:[]
    if(starts.length!==1||ends.length!==1||!raw||!version?.rawText)return invalid
    const start=starts[0],end=ends[0],a=sourceWindowMs(start,zone,false),b=sourceWindowMs(end,zone,true)
    if(start.precision==='exact'&&end.precision==='exact'){
      if(a===undefined||b===undefined||b<=a||start.rawText!==end.rawText||start.timezone!==end.timezone
        ||JSON.stringify([...start.relatedTaskIds].sort())!==JSON.stringify([...end.relatedTaskIds].sort()))return invalid
      const projection=projectCitedClockRanges(raw,version.rawText,raw.createdAt,zone)
      for(const point of [start,end]){
        const decision=projection.audit.decisions.find(d=>d.pointId===point.legacyData?.recognitionTempId)
        if(!decision||decision.blocked||!decision.ownerIds.includes(String(t.legacyData?.recognitionTempId))
          ||decision.after.normalizedValue!==point.normalizedValue||!sourceWindowEvidence(w,point,version.id,point.rawText,version.rawText))return invalid
        // Related materials may repeat the same task-owned window; they may
        // not supply a window from a different action or a foreign source.
        if(point.relatedMaterialIds.some(id=>!w.materials.some(m=>m.id===id&&m.relatedTaskIds.includes(t.id))))return invalid
      }
      return {start:a,end:b,intervals:[{start:a,end:b}],invalid:false,present:true}
    }
    if(a===undefined||b===undefined||b<=a||start.rawText!==end.rawText||start.precision!=='date_only'||end.precision!=='date_only'||start.materialId||end.materialId||start.relatedMaterialIds.length||end.relatedMaterialIds.length||start.timezone!==end.timezone||JSON.stringify([...start.relatedTaskIds].sort())!==JSON.stringify([...end.relatedTaskIds].sort()))return invalid
    for(const point of [start,end]){
      const original=raw.timePoints.find(p=>p.tempId===point.legacyData?.recognitionTempId),proof=original&&citedTaskDateRange(original,rawTasks,raw.timePoints,raw.evidence,version.rawText)
      const expected=proof&&interpretTimeD26(proof.endpoint,{type:point.type,referenceTime:start.normalizedValue+'T12:00:00+08:00',timezone:point.timezone??zone}).point
      if(!proof||!expected?.normalizedValue||expected.needsConfirmation||expected.normalizedValue!==point.normalizedValue||!sourceWindowEvidence(w,point,version.id,point.rawText,version.rawText))return invalid
    }
    return {start:a,end:b,intervals:[{start:a,end:b}],invalid:false,present:true}
  }
  // Legacy single bounds stay supported. Multiple unpaired points remain a
  // local unknown rather than acquiring a guessed pairing from array order.
  const starts=points.filter(p=>p.legacyData?.sourceTimeRole==='window_start').map(p=>sourceWindowMs(p,zone,false)),ends=points.filter(p=>p.legacyData?.sourceTimeRole==='window_end').map(p=>sourceWindowMs(p,zone,true))
  if(starts.length!==1||ends.length!==1||starts[0]===undefined||ends[0]===undefined||ends[0]<=starts[0])return invalid
  return {start:starts[0],end:ends[0],intervals:[{start:starts[0],end:ends[0]}],invalid:false,present:true}
}
export function buildPersonalPlan(w: WorkspaceV8, options: PlanOptions, id: string = crypto.randomUUID()): PlanProposal {
  validatePersonalPlanMetadata(w); validatePlanOptions(options)
  if (w.tasks.length > 200) throw Error('PERSONAL_PLAN_TASK_LIMIT_200')
  const o = structuredClone(options), zone = w.settings.defaultTimezone, now = Date.parse(o.now)
  const proposal: PlanProposal = { version: PLAN_VERSION, id, workspaceId: w.workspace.id, baseline: planBaseline(w), options: o, segments: [], unscheduled: [], warnings: [] }
  if (proposal.baseline.length > 1_000_000) throw Error('PERSONAL_PLAN_READSET_LIMIT')
  const reject = (t: Task, code: string) => proposal.unscheduled.push({ taskId: t.id, title: t.title, code, reason: reasons[code] ?? code })
  const windows: Interval[] = [], fixed: Interval[] = [], occupied: Interval[] = []
  for (let d = 0; d < o.days; d++) {
    const date = addDateOnlyDays(o.startDate, d)
    const start = parseBusinessDateTime(date + 'T' + o.startTime, zone)?.getTime(), end = parseBusinessDateTime(date + 'T' + o.endTime, zone)?.getTime()
    if (start === undefined || end === undefined) throw Error('PERSONAL_PLAN_WINDOW_TIME_INVALID')
    windows.push({ start: Math.max(start, now), end })
    const rawCourses = w.preferences.legacyData?.courseBlocks
    const weekday = new Date(date + 'T12:00:00Z').getUTCDay() || 7
    if (Array.isArray(rawCourses)) for (const raw of rawCourses) {
      const course = record(raw)
      if (course?.weekday !== weekday) continue
      const a = typeof course.startTime === 'string' ? parseBusinessDateTime(date + 'T' + course.startTime, zone)?.getTime() : undefined
      const b = typeof course.endTime === 'string' ? parseBusinessDateTime(date + 'T' + course.endTime, zone)?.getTime() : undefined
      if (a === undefined || b === undefined || b <= a) throw Error('PERSONAL_PLAN_COURSE_INVALID')
      fixed.push({ start: a, end: b })
    }
  }
  for (const event of w.events) {
    // Handling/learning opportunities are constraints, not fixed attendance.
    // Require the full saved source/canonical proof before making this distinction.
    if(canonicalHandlingEvent(w,event))continue
    const a = pointMs(w.timePoints.find(p => p.id === event.startTimePointId), zone), b = pointMs(w.timePoints.find(p => p.id === event.endTimePointId), zone)
    if (a !== undefined && b !== undefined && b > a) fixed.push({ start: a, end: b })
    else proposal.warnings.push(`“${event.title}”没有确定完整时段，保留原文；本次不能保证避开它。`)
  }
  const deadline = (t: Task) => {
    const points = w.timePoints.filter(p => ['task_deadline', 'submission_deadline', 'registration_deadline'].includes(p.type) && p.relatedTaskIds.includes(t.id))
    const exact = points.filter(p => p.precision === 'exact' && p.normalizedValue)
    const dates = points.filter(p => p.precision === 'date_only' && p.normalizedValue)
    const values = [...exact, ...dates].map(p => p.precision === 'date_only' ? parseBusinessDateTime(addDateOnlyDays(p.normalizedValue!, 1) + 'T00:00', p.timezone ?? zone)!.getTime() : parseBusinessDateTime(p.normalizedValue!, p.timezone ?? zone)!.getTime())
    return { value: values.length ? Math.min(...values) : Infinity, text: points.map(p => p.rawText).join('；') || null, conflict: ['task_deadline', 'submission_deadline', 'registration_deadline'].some(type => new Set(points.filter(p => p.type === type && p.normalizedValue).map(p => p.normalizedValue)).size > 1) || exact.some(p => p.needsConfirmation) }
  }
  const sourceWindow=(t:Task)=>sourceWindowBounds(w,t,zone)
  const contained=(slot:Interval,bounds:SourceBounds)=>bounds.intervals.some(interval=>slot.start>=interval.start&&slot.end<=interval.end)
  const canUse = (slot: Interval, earliest: number, latest: number, bounds:SourceBounds) => Number.isFinite(slot.start) && slot.start >= earliest && slot.end <= latest && contained(slot,bounds) && windows.some(win => slot.start >= win.start && slot.end <= win.end) && ![...fixed, ...occupied].some(b => overlap(slot, b))
  const appointment=(t:Task)=>w.timePoints.filter(p=>p.relatedTaskIds.includes(t.id)&&p.legacyData?.sourceTimeRole==='task_action_time')
  // Only an explicitly retained attendance verb and existing canonical endpoint
  // ownership identify a fixed-time action. A preparation/registration task
  // related to the same event remains independently schedulable.
  const fixedAttendance=(t:Task)=>/^(?:参加|参会|出席)$/u.test(String(t.legacyData?.actionVerb??''))?w.events.filter(e=>[e.startTimePointId,e.endTimePointId].some(id=>w.timePoints.some(p=>p.id===id&&['event_start','event_end'].includes(p.type)&&(p.taskId===t.id||p.relatedTaskIds.includes(t.id))))):[]
  const tasks = sorted(w.tasks).sort((a, b) => Number(Boolean(appointment(b).length))-Number(Boolean(appointment(a).length)) || (deadline(a).value - deadline(b).value) || (b.manualPriority ?? 0) - (a.manualPriority ?? 0) || a.id.localeCompare(b.id))
  const handled = new Set<string>(), visiting = new Set<string>()
  const cycleIds = new Set<string>(), cycleDone = new Set<string>()
  const visitCycle = (t: Task, path: string[]) => {
    if (path.includes(t.id)) { path.slice(path.indexOf(t.id)).forEach(id => cycleIds.add(id)); return }
    if (cycleDone.has(t.id)) return
    if (path.length > 200) return
    for (const dep of t.dependencyIds) { const found = w.tasks.find(t => t.id === dep); if (found && found.status !== 'completed') visitCycle(found, [...path, t.id]) }
    cycleDone.add(t.id)
  }
  tasks.forEach(t => visitCycle(t, []))
  const existing = w.timePoints.filter(p => p.type === 'planned_start')
  const staleSource = (t: Task) => {
    const source = w.sources.find(s => s.id === t.legacyData?.sourceId)
    const authoredVersion = w.historyRecords.find(h => h.entityId === t.id && h.sourceVersionId)?.sourceVersionId
    return Boolean(source && authoredVersion && source.currentVersionId !== authoredVersion)
  }
  if (existing.some(p => !ownPoint(p))) proposal.warnings.push('已有个人计划缺少本版可靠时长，原样保留；本次无法保证避开这些不完整时段。')
  // Reserve locked plans before allocating any new task, even if lock order is later.
  for (const point of existing.filter(p => planMetadata(p)?.locked)) {
    const t = tasks.find(t => t.id === point.taskId), meta = planMetadata(point)!
    if (!t || ['completed', 'cancelled'].includes(t.status)) continue
    const start = pointMs(point, zone)!, end = start + meta.minutes * 60_000
    const effective = o.overrides[t.id]
    if (effective?.locked === false) continue // Explicitly unlocking is a user decision in the proposed plan.
    const s: PlanSegment = { taskId: t.id, title: t.title, start: new Date(start).toISOString(), end: new Date(end).toISOString(), minutes: meta.minutes, durationOrigin: meta.durationOrigin, locked: true, conditionalOn: t.dependencyIds.filter(id => w.tasks.find(t => t.id === id)?.status !== 'completed'), reason: '保留你锁定的安排。', originalDeadline: deadline(t).text, retained: true }
    proposal.segments.push(s); occupied.push({ start, end }); handled.add(t.id)
    const sourceBounds=sourceWindow(t)
    const sourceAppointments=appointment(t)
    const sourceAppointmentConflict=sourceAppointments.length>0&&(sourceAppointments.length!==1||sourceAppointments[0].needsConfirmation||sourceAppointments[0].precision!=='exact'||pointMs(sourceAppointments[0],zone)!==start)
    if (fixedAttendance(t).length || [...fixed, ...occupied.slice(0, -1)].some(b => overlap(b, { start, end })) || !windows.some(win => start >= win.start && end <= win.end) || end > deadline(t).value || sourceBounds.invalid || sourceAppointmentConflict || !contained({start,end},sourceBounds) || deadline(t).conflict || staleSource(t) || t.snoozedUntil && start < parseBusinessDateTime(t.snoozedUntil, zone)!.getTime() || taskGaps(w, t).length || cycleIds.has(t.id)) reject(t, 'LOCK_CONFLICT')
  }
  const schedule = (t: Task): void => {
    if (handled.has(t.id)) return
    handled.add(t.id)
    if (t.status === 'completed' || t.status === 'cancelled') { reject(t, t.status === 'completed' ? 'COMPLETED' : 'CANCELLED'); return }
    const gaps = taskGaps(w, t)
    if (gaps.length) { reject(t, gaps[0]); return }
    if (staleSource(t)) { reject(t, 'RELATION_NEEDS_REVIEW'); return }
    if (cycleIds.has(t.id) || visiting.has(t.id)) { reject(t, 'DEPENDENCY_CYCLE'); return }
    const override = o.overrides[t.id]
    if (override?.later) { reject(t, 'USER_LATER'); return }
    const attendance=fixedAttendance(t)
    if(attendance.length){
      const bounds=attendance.map(e=>({start:pointMs(w.timePoints.find(p=>p.id===e.startTimePointId),zone),end:pointMs(w.timePoints.find(p=>p.id===e.endTimePointId),zone)}))
      if(bounds.some(b=>b.start===undefined||b.end===undefined||b.end<=b.start))reject(t,'FIXED_EVENT_NEEDS_REVIEW')
      else reject(t,bounds.every(b=>b.end!<=now)?'FIXED_EVENT_ENDED':'FIXED_EVENT_ALREADY_ON_CALENDAR')
      return
    }
    const due = deadline(t)
    const sourceBounds=sourceWindow(t)
    const sourceAppointments=appointment(t)
    if(sourceAppointments.length&&(sourceAppointments.length!==1||pointMs(sourceAppointments[0],zone)===undefined)){reject(t,'SOURCE_ACTION_TIME_NEEDS_REVIEW');return}
    if(sourceBounds.invalid){reject(t,'SOURCE_WINDOW_NEEDS_REVIEW');return}
    if(sourceBounds.present&&!windows.some(win=>sourceBounds.intervals.some(interval=>win.end>interval.start&&win.start<interval.end))){reject(t,'SOURCE_WINDOW_OUTSIDE_PLAN');return}
    due.value=Math.min(due.value,sourceBounds.end)
    if (due.conflict) { reject(t, 'DEADLINE_CONFLICT'); return }
    if (due.value <= now) { reject(t, 'OVERDUE'); return }
    if (existing.some(p => !ownPoint(p) && p.relatedTaskIds.includes(t.id))) { reject(t, 'LEGACY_PLAN_UNBOUNDED'); return }
    const old = existing.find(p => ownPoint(p) && p.taskId === t.id), oldMeta = old && planMetadata(old)
    const minutes = override?.minutes ?? oldMeta?.minutes ?? t.estimatedMinutes ?? o.estimateMinutes
    if (minutes === null || !validMinutes(minutes)) { reject(t, 'DURATION_UNKNOWN'); return }
    const origin: DurationOrigin = override?.minutes !== undefined ? 'user' : oldMeta?.durationOrigin ?? (t.estimatedMinutes !== null ? 'recorded_estimate' : 'product_estimate')
    let earliest = Math.max(now,sourceBounds.start)
    if (t.snoozedUntil) { const until = parseBusinessDateTime(t.snoozedUntil, zone); if (!until) throw Error('PERSONAL_PLAN_SNOOZE_INVALID'); earliest = Math.max(earliest, until.getTime()) }
    visiting.add(t.id)
    for (const id of t.dependencyIds) {
      const prerequisite = tasks.find(t => t.id === id)
      if (!prerequisite) { visiting.delete(t.id); reject(t, 'DEPENDENCY_MISSING'); return }
      if (prerequisite.status === 'completed') continue
      schedule(prerequisite)
      const segment = proposal.segments.find(s => s.taskId === id)
      if (!segment || proposal.unscheduled.some(u => u.taskId === id)) { visiting.delete(t.id); reject(t, 'DEPENDENCY_UNSCHEDULED'); return }
      earliest = Math.max(earliest, Date.parse(segment.end))
    }
    visiting.delete(t.id)
    const duration = minutes * 60_000
    let slot: Interval | undefined
    if(sourceAppointments.length){
      const start=pointMs(sourceAppointments[0],zone)!,candidate={start,end:start+duration}
      if(override?.start&&parseBusinessDateTime(override.start,zone)?.getTime()!==start||!canUse(candidate,earliest,due.value,sourceBounds)){reject(t,'SOURCE_ACTION_TIME_OUTSIDE_PLAN');return}
      slot=candidate
    } else if (override?.start) {
      const start = parseBusinessDateTime(override.start, zone)?.getTime() ?? NaN
      const candidate = { start, end: start + duration }
      if (canUse(candidate, earliest, due.value,sourceBounds)) slot = candidate
      else { reject(t, 'INVALID_MANUAL_SLOT'); return }
    } else {
      const available=windows.flatMap(window=>sourceBounds.intervals.map(interval=>({start:Math.max(window.start,interval.start),end:Math.min(window.end,interval.end)}))).filter(window=>window.end>window.start).sort((a,b)=>a.start-b.start||a.end-b.end)
      for (const window of available) {
        let cursor = Math.ceil(Math.max(window.start, earliest) / 300_000) * 300_000
        while (cursor + duration <= Math.min(window.end, due.value)) {
          const candidate = { start: cursor, end: cursor + duration }, clashes = [...fixed, ...occupied].filter(b => overlap(b, candidate))
          if (!clashes.length) { slot = candidate; break }
          cursor = Math.ceil(Math.max(...clashes.map(b => b.end)) / 300_000) * 300_000
        }
        if (slot) break
      }
    }
    if (!slot) { reject(t, 'CAPACITY'); return }
    proposal.segments.push({ taskId: t.id, title: t.title, start: new Date(slot.start).toISOString(), end: new Date(slot.end).toISOString(), minutes, durationOrigin: origin, locked: override?.locked ?? false, conditionalOn: t.dependencyIds.filter(id => tasks.find(t => t.id === id)?.status !== 'completed'), reason: sourceAppointments.length?'保留原文指定办理时刻；时长仅为明确标注的安排估计。':t.dependencyIds.length ? '排在前置事项之后；须实际完成前置才可开始。' : due.text ? '按原文截止先后分配共同可用时间。' : '没有原文截止，按稳定顺序放入可用时间。', originalDeadline: due.text, retained: false }); occupied.push(slot)
  }
  tasks.forEach(schedule)
  // Locked successor may predate its newly scheduled prerequisite. Preserve it, expose conflict.
  for (const s of proposal.segments.filter(s => s.retained)) for (const id of s.conditionalOn) {
    const dep = proposal.segments.find(p => p.taskId === id)
    if (!dep || Date.parse(dep.end) > Date.parse(s.start) || proposal.unscheduled.some(u => u.taskId === id)) { const t = tasks.find(t => t.id === s.taskId)!; if (!proposal.unscheduled.some(u => u.taskId === t.id)) reject(t, 'LOCK_CONFLICT') }
  }
  proposal.segments.sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || a.taskId.localeCompare(b.taskId))
  const estimatedMinutes = [...new Set(proposal.segments.filter(s => s.durationOrigin === 'product_estimate').map(s => s.minutes))].sort((a, b) => a - b)
  if (estimatedMinutes.length) proposal.warnings.push(`部分事项使用产品暂估：${estimatedMinutes.join('、')}分钟；这不是原文要求。已接受的个人耗时保留，可逐项修改；默认估计仅用于尚无个人耗时的事项。`)
  proposal.warnings.push('仅避开已记录且确定的活动、课程和锁定安排；尚未录入的行程不能被自动避开。')
  return proposal
}
export function storedPersonalPlans(w: WorkspaceV8): PlanSegment[] {
  validatePersonalPlanMetadata(w)
  return w.timePoints.filter(ownPoint).map(p => { const m = planMetadata(p)!, t = w.tasks.find(t => t.id === p.taskId)!, start = pointMs(p, w.settings.defaultTimezone)!; return { taskId: t.id, title: t.title, start: new Date(start).toISOString(), end: new Date(start + m.minutes * 60_000).toISOString(), ...m, reason: '已保存的个人安排；原文截止未改变。', originalDeadline: w.timePoints.filter(p => p.relatedTaskIds.includes(t.id) && p.type.endsWith('deadline')).map(p => p.rawText).join('；') || null, retained: true } }).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
}
function history(commitId: string, entityId: string, before: TimePoint[], after: TimePoint[], now: string): HistoryRecord {
  return { id: commitId + ':history', entityType: 'task', entityId, action: 'personal_plan', fieldName: 'personal_plan', before: JSON.parse(JSON.stringify(before)) as JsonValue, after: JSON.parse(JSON.stringify(after)) as JsonValue, actor: 'user', reason: '个人安排修改；原文截止保持', sourceVersionId: null, changedAt: now }
}
const pointSnapshot = (w: WorkspaceV8, ids: string[]) => JSON.stringify(sorted(w.timePoints.filter(p => ids.includes(p.id))))
export function pendingPersonalPlan(w: WorkspaceV8): PlanReceipt | null { validatePersonalPlanMetadata(w); return w.preferences.legacyData?.[PLAN_RECEIPT] as unknown as PlanReceipt ?? null }
export async function applyPersonalPlan(repository: CanonicalWorkspaceRepository, proposal: PlanProposal, clock: () => Date = () => new Date()): Promise<PlanReceipt> {
  let receipt: PlanReceipt | undefined
  await repository.transaction(current => {
    validatePersonalPlanMetadata(current)
    const pending = pendingPersonalPlan(current)
    const previous = current.preferences.legacyData?.[PLAN_UNDO] as unknown as PlanReceipt | undefined
    const payload = JSON.stringify(proposal)
    if (pending?.commitId === proposal.id || previous?.commitId === proposal.id) { const same = pending?.commitId === proposal.id ? pending : previous!; if (same.payload !== payload) throw Error('PERSONAL_PLAN_IDEMPOTENCY_CONFLICT'); receipt = same; return current }
    if (pending) throw Error('PERSONAL_PLAN_READBACK_PENDING')
    if (current.workspace.id !== proposal.workspaceId || planBaseline(current) !== proposal.baseline) throw Error('PERSONAL_PLAN_INPUTS_CHANGED')
    // Recompute inside the transaction: edited slots cannot bypass constraints or invent facts.
    if (JSON.stringify(buildPersonalPlan(current, proposal.options, proposal.id)) !== payload) throw Error('PERSONAL_PLAN_PROPOSAL_INVALID')
    const chosen = proposal.segments.filter(s => !s.retained && !proposal.unscheduled.some(u => u.taskId === s.taskId))
    // An old preview is not permission to backdate new slots. Idempotent recovery is checked above.
    const transactionNow = clock()
    if (chosen.some(s => Date.parse(s.start) < transactionNow.getTime())) throw Error('PERSONAL_PLAN_ELAPSED_SLOT')
    const retainedIds = new Set(proposal.segments.filter(s => s.retained).map(s => s.taskId))
    const replaced = current.timePoints.filter(p => ownPoint(p) && !retainedIds.has(p.taskId!))
    if (!chosen.length && !replaced.length) throw Error('PERSONAL_PLAN_NOTHING_TO_APPLY')
    const ids = [...new Set([...chosen.map(s => s.taskId), ...replaced.map(p => p.taskId!)])], previousPoints = replaced, now = transactionNow.toISOString()
    const points: TimePoint[] = chosen.map(s => ({ id: 'personal-plan:' + s.taskId, projectId: current.tasks.find(t => t.id === s.taskId)!.projectId, milestoneId: null, taskId: s.taskId, materialId: null, eventId: null, relatedTaskIds: [s.taskId], relatedMaterialIds: [], type: 'planned_start', rawText: '个人计划起点（不替代原文截止）', normalizedValue: s.start, timezone: current.settings.defaultTimezone, isAllDay: false, precision: 'exact', needsConfirmation: false, createdAt: previousPoints.find(p => p.taskId === s.taskId)?.createdAt ?? now, updatedAt: now, legacyData: { personalPlanD27: { version: PLAN_VERSION, minutes: s.minutes, durationOrigin: s.durationOrigin, locked: s.locked, operationId: proposal.id, conditionalOn: s.conditionalOn } } }))
    const next: WorkspaceV8 = { ...current, timePoints: [...current.timePoints.filter(p => !ownPoint(p) || !ids.includes(p.taskId!)), ...points], historyRecords: [...current.historyRecords, history(proposal.id, ids[0], previousPoints, points, now)], savedAt: now }
    receipt = { version: PLAN_VERSION, commitId: proposal.id, kind: 'apply', verified: false, payload, pointIds: [...new Set([...points.map(p => p.id), ...previousPoints.map(p => p.id)])], expectedPoints: JSON.stringify(sorted(points)), previousPoints, afterBaseline: planBaseline(next), committedAt: now }
    next.preferences = { ...next.preferences, legacyData: { ...next.preferences.legacyData, [PLAN_RECEIPT]: JSON.parse(JSON.stringify(receipt)) } }
    return next
  })
  return receipt!
}
export async function verifyPersonalPlan(reader: Pick<CanonicalWorkspaceRepository, 'load'>, receipt: PlanReceipt): Promise<WorkspaceV8> {
  const w = await reader.load()
  if (!w || !w.historyRecords.some(h => h.id === receipt.commitId + ':history') || pointSnapshot(w, receipt.pointIds) !== receipt.expectedPoints) throw Error('PERSONAL_PLAN_READBACK_MISMATCH')
  return w
}
export async function acknowledgePersonalPlan(repository: CanonicalWorkspaceRepository, receipt: PlanReceipt): Promise<void> {
  await repository.transaction(w => {
    if (pointSnapshot(w, receipt.pointIds) !== receipt.expectedPoints) throw Error('PERSONAL_PLAN_READBACK_MISMATCH')
    const current = pendingPersonalPlan(w)
    if (!current && (w.preferences.legacyData?.[PLAN_UNDO] as unknown as PlanReceipt)?.commitId === receipt.commitId) return w
    if (current?.commitId !== receipt.commitId) throw Error('PERSONAL_PLAN_RECEIPT_CHANGED')
    const data = { ...w.preferences.legacyData }; delete data[PLAN_RECEIPT]
    if (receipt.kind === 'apply') data[PLAN_UNDO] = JSON.parse(JSON.stringify({ ...receipt, verified: true }))
    else delete data[PLAN_UNDO]
    return { ...w, preferences: { ...w.preferences, legacyData: data } }
  })
}
export async function undoPersonalPlan(repository: CanonicalWorkspaceRepository, commitId: string): Promise<PlanReceipt> {
  let receipt: PlanReceipt | undefined
  await repository.transaction(w => {
    const pending = pendingPersonalPlan(w)
    if (pending?.commitId === commitId + ':undo') { receipt = pending; return w }
    if (pending) throw Error('PERSONAL_PLAN_READBACK_PENDING')
    const last = w.preferences.legacyData?.[PLAN_UNDO] as unknown as PlanReceipt | undefined
    if (!last || last.commitId !== commitId || planBaseline(w) !== last.afterBaseline || pointSnapshot(w, last.pointIds) !== last.expectedPoints) throw Error('PERSONAL_PLAN_UNDO_INPUTS_CHANGED')
    const now = new Date().toISOString(), id = commitId + ':undo'
    const affectedTaskId = w.timePoints.find(p => last.pointIds.includes(p.id))?.taskId ?? last.previousPoints[0]?.taskId
    if (!affectedTaskId) throw Error('PERSONAL_PLAN_UNDO_RECEIPT_INVALID')
    const next = { ...w, timePoints: [...w.timePoints.filter(p => !last.pointIds.includes(p.id)), ...last.previousPoints], historyRecords: [...w.historyRecords, history(id, affectedTaskId, w.timePoints.filter(p => last.pointIds.includes(p.id)), last.previousPoints, now)], savedAt: now }
    receipt = { ...last, commitId: id, kind: 'undo', verified: false, payload: JSON.stringify({ undo: commitId }), expectedPoints: pointSnapshot(next, last.pointIds), previousPoints: [], afterBaseline: planBaseline(next), committedAt: now }
    return { ...next, preferences: { ...next.preferences, legacyData: { ...next.preferences.legacyData, [PLAN_RECEIPT]: JSON.parse(JSON.stringify(receipt)) } } }
  })
  return receipt!
}
/** Native date/time inputs display wall clock values; the canonical plan keeps an actual instant. */
export function planLocalValue(instant: string, zone: string): string { return instantToWallClock(new Date(instant), zone).toISOString().slice(0, 16) }
export function planWallInstant(local: string, zone: string): string | null { const wall = new Date(local + ':00Z'); if (!Number.isFinite(wall.getTime())) return null; try { return wallClockToInstant(wall, zone).toISOString() } catch { return null } }
