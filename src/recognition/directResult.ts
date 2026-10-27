import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import {directEventRevision} from './directLocalFacts'
import type { RecognitionResult, TaskSuggestionV2, TimePointSuggestionV2 } from './types'
import { parseChineseTimeAst, parseBusinessDateTime } from '../lib/timeSemantics'
import {projectDirectActions} from './directActionProjection'
import {convertRetainedDirectResult,cleanDirectTopic} from './directRetention'

export const DIRECT_MODE_VERSION = 'direct-mode-1'
export type DirectTag = '时间待定' | '如符合条件' | '待确认'
export interface DirectItem { tempId: string; kind: 'task' | 'event'; tags: DirectTag[] }
export interface DirectConversion { result: RecognitionResult; items: DirectItem[]; omitted: { id: string; reason: string }[] }
const flatTasks = (r: RecognitionResult) => [...r.standaloneTasks, ...r.milestones.flatMap(m => [...m.tasks, ...m.workPackages.flatMap(w => w.tasks)])]
const compact = (s: string) => s.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu, '')
const cancelled = /取消|作废|废止|不再(?:举办|举行|提交|报名|申请)|禁止|不得(?:提交|报名|申请|参加|领取)/u
const conditional = /(?:若|如果|如已|如需|符合.{0,18}条件|有意|自愿|入选后|录取后|已缴费|放弃修读|仅限|限.{0,10}学生)/u
const deadline = /截止|最迟|不晚于|不得(?:晚于|迟于)|之前|以前|前(?:[，,。；;\s]|将|把|须|需|请|提交|交到|交至|送至|送到|递交|完成|报送|报名|申请|办理|领取|上传|填写|登记|预约|$)|(?:\d{1,2}(?:日|号|点|时|分)|\d{1,2}:\d{2})\s*前(?:通过|在线)|于.{0,32}(?:提交|交至|交到|报送)/u
const alternatives = /任选|备选|可选择|任一|(?:日|号|\d)\s*(?:或|、).{0,18}(?:日|号)/u
const recordTasks = (r: RecognitionResult) => new Map(flatTasks(r).map(t => [t.tempId, t]))

/** A new presentation policy, never a modification to a recorded/model result.
 * Uncertainty becomes an explicit label; it never authorizes invented facts. */
export function convertDirectResult(input: RecognitionResult, sourceText: string, original?: RecognitionResult, options:{actionRecovery?:boolean;retention?:boolean}={}): DirectConversion {
  if(options.retention)return convertRetainedDirectResult(input,sourceText,original)
  if(options.actionRecovery){
    const baseline=convertDirectResult(input,sourceText,original)
    const prepared=structuredClone(baseline.result)
    for(const t of flatTasks(prepared))if(baseline.items.find(i=>i.tempId===t.tempId)?.tags.includes('待确认'))t.selected=false
    const projected=projectDirectActions(prepared,sourceText)
    if(JSON.stringify(projected)===JSON.stringify(prepared))return baseline
    const next=convertDirectResult(projected,sourceText)
    return {...next,omitted:[...baseline.omitted,...next.omitted]}
  }
  const result = structuredClone(input), omitted: DirectConversion['omitted'] = [], items: DirectItem[] = []
  const originalTasks = original ? recordTasks(original) : new Map<string, TaskSuggestionV2>()
  const located = new Map(result.evidence.flatMap(e => {
    const quote = e.quotedText || e.quote
    if (!quote) return []
    const offset=e.textStart
    const at = typeof offset==='number'&&sourceText.slice(offset,offset+quote.length)===quote ? offset : sourceText.indexOf(quote)===sourceText.lastIndexOf(quote)?sourceText.indexOf(quote):-1
    return at >= 0 ? [[e.id, {quote,at}] as const] : []
  }))
  const quotes = (ids: string[]) => ids.flatMap(id => located.has(id) ? [located.get(id)!.quote] : [])
  const context = (ids: string[]) => ids.flatMap(id=>{const found=located.get(id);if(!found)return [];const before=sourceText.slice(0,found.at),after=sourceText.slice(found.at+found.quote.length),left=Math.max(before.lastIndexOf('。'),before.lastIndexOf('\n'),before.lastIndexOf('！'),before.lastIndexOf('？'))+1,right=after.search(/[。！？\n]/u);return [sourceText.slice(left,found.at+found.quote.length+(right<0?after.length:right))]}).join('\n')
  const clauseFor = (text: string, object: string) => text.split(/[，,；;。！？\n]/u).filter(s => compact(s).includes(compact(object))).join('；')
  const isCancelled = (text: string, object: string) => {
    const revised=/(?:改为|调整为|更正为|延期至|现为)([^。；;\n]*)/u.exec(text)
    const clauses=clauseFor(text,object).split('；'),affirmative=clauses.some(c=>!cancelled.test(c)&&/请|可以|可|允许|须|应当|务必/u.test(c))
    const prohibited=clauses.some(c=>cancelled.test(c)&&!(affirmative&&/不符合|不具备|未经|未(?:获|经|通过|完成|报名|缴费|取得)/u.test(c)))
    return prohibited && !(revised&&compact(revised[1]).includes(compact(object))) && !directEventRevision(text,object)
  }
  const tagsById = new Map<string, DirectTag[]>()
  const conflicts=new Set(result.conflicts.filter(c=>c.requiresDecision).flatMap(c=>c.entityTempIds))
  const deadlineConflicts=new Set(result.conflicts.filter(c=>c.requiresDecision&&c.type==='deadline').flatMap(c=>c.entityTempIds))
  const tasks = flatTasks(result).flatMap(task => {
    let t = task
    const old = originalTasks.get(task.tempId)
    if ((!t.actionVerb || !t.actionObject || /待核对|待确认事项/u.test(t.title)) && old) t = structuredClone(old)
    const text = context(t.evidenceIds), object = compact(t.actionObject)
    if (/^(?:公布|发布|公示)/u.test(t.actionVerb+t.actionObject) || /^(?:公布|发布|公示)/u.test(t.actionObject)) {
      if (/无需办理|仅供参考|无需操作/u.test(text)) {omitted.push({id:t.tempId,reason:'INFORMATION_NOT_STUDENT_ACTION'});return []}
    }
    if (!text || !object || !compact(text).includes(object) || !t.actionVerb.trim() || /待核对|待确认事项/u.test(t.title)) {
      omitted.push({ id: t.tempId, reason: 'OBJECT_OR_ACTION_NOT_GROUNDED' }); return []
    }
    if (isCancelled(text, t.actionObject)) { omitted.push({id:t.tempId,reason:'CANCELLED_OR_PROHIBITED'}); return [] }
    const citedConditions=[...t.description.matchAll(/(?:适用条件待确认|资格待确认|适用条件)[:：]([^\n]+)/gu)]
      .some(m=>compact(m[1]).length>1&&compact(text).includes(compact(m[1])))
    const conditions = conditional.test(clauseFor(text, t.actionObject))||citedConditions
    const tags: DirectTag[] = conditions ? ['如符合条件', '待确认'] : t.selected === false||conflicts.has(t.tempId) ? ['待确认'] : []
    tagsById.set(t.tempId, tags)
    const title=conditions ? `如符合条件 ${t.title.replace(/^如符合条件\s*/u,'')}` : t.title
    return [{...t, title:title.length>80?title.slice(0,79)+'…':title,
      parentTempId: null, hierarchyType: 'task' as const, selected: true,
      materialTempIds: [...t.materialTempIds], timePointTempIds: [...t.timePointTempIds]}]
  })
  const taskIds = new Set(tasks.map(t => t.tempId))
  tasks.forEach(t => { const retained=t.dependencyTempIds.filter(id=>taskIds.has(id));if(retained.length!==t.dependencyTempIds.length){tagsById.get(t.tempId)!.push('待确认');omitted.push({id:t.tempId,reason:'UNRESOLVED_RELATION_NOT_EXECUTABLE'})}t.dependencyTempIds=retained })
  const events = result.events.flatMap(e => {
    const text = context(e.evidenceIds), name = compact(e.title)
    const cores=e.title.replace(/(?:参加|关于|召开|举行|出席)/gu,'').split(/和|与|及|暨/u).map(compact).filter(Boolean)
    if (!text || !name || !cores.length || !cores.every(word=>compact(text).includes(word)) || cores.some(core=>isCancelled(text,core))) { omitted.push({id:e.tempId,reason:'EVENT_UNGROUNDED_OR_CANCELLED'}); return [] }
    const tags: DirectTag[] = conditional.test(text) ? ['如符合条件','待确认'] : e.selected === false||conflicts.has(e.tempId) ? ['待确认'] : []
    tagsById.set(e.tempId, tags)
    const location = e.location && e.location.split(' · ').every(part=>compact(text).includes(compact(part))) ? e.location : null
    return [{...e, location, selected:true, relatedTaskTempIds:e.relatedTaskTempIds?.filter(id => taskIds.has(id))}]
  })
  const eventIds = new Set(events.flatMap(e => [e.startTimePointTempId,e.endTimePointTempId]).filter(Boolean))
  const times: TimePointSuggestionV2[] = result.timePoints.filter(p => p.relatedTaskTempIds.some(id => taskIds.has(id)) || eventIds.has(p.tempId)).map(p => {
    const point = {...p, relatedTaskTempIds:p.relatedTaskTempIds.filter(id => taskIds.has(id)),selected:true}
    const unknown = ():TimePointSuggestionV2 => ({...point,normalizedValue:null,precision:'vague',isAllDay:false,needsConfirmation:true})
    const text = context(p.evidenceIds), raw = p.rawText
    // A previously isolated/ambiguous value stays unknown. The policy changes
    // whether the item is saved, not whether a missing time becomes known.
    const unsupported = !quotes(p.evidenceIds).length || !raw || !compact(text).includes(compact(raw))
    const applicationCutoff=/申请|申报|报名/u.test(text)&&/逾期[^。；]{0,20}(?:不再受理|不予受理|不受理)/u.test(text)&&/至|到|—/u.test(raw)
    const risky = alternatives.test(text) || (/_deadline$/u.test(p.type) && (!deadline.test(text)&&!applicationCutoff || /办理时段|开放时间|领取时段/u.test(text) && !/截止|最迟/u.test(text)))
    if (unsupported || risky || deadlineConflicts.has(p.tempId)||p.relatedTaskTempIds.some(id=>deadlineConflicts.has(id))||!p.normalizedValue || p.needsConfirmation && p.precision !== 'date_only') return unknown()
    if(p.normalizedValue){
      let parsed=parseDirectSourceTime(raw,{type:p.type,referenceTime:result.createdAt,timezone:p.timezone})
      const correction=/(?:改为|调整为|更正为|延期至|现为)([^。；;\n]*)/u.exec(text)
      if(correction)parsed=parseDirectSourceTime(correction[1],{type:p.type,referenceTime:result.createdAt,timezone:p.timezone})
      else if(parsed.dateKind==='none')parsed=parseDirectSourceTime(text,{type:p.type,referenceTime:result.createdAt,timezone:p.timezone})
      const expected=p.type==='event_end'&&parsed.rangeEndNormalizedValue?parsed.rangeEndNormalizedValue:parsed.normalizedValue
      const same=expected&&(/T/u.test(expected)?parseBusinessDateTime(expected,p.timezone)?.getTime()===parseBusinessDateTime(p.normalizedValue,p.timezone)?.getTime():expected===p.normalizedValue)
      if(!same||parsed.needsConfirmation||parsed.dateKind==='none')return unknown()
    }
    return point
  })
  for (const e of events) {
    const start = times.find(p => p.tempId === e.startTimePointTempId && p.type === 'event_start')
    const end = times.find(p => p.tempId === e.endTimePointTempId && p.type === 'event_end')
    e.startTimePointTempId = start?.tempId ?? null; e.endTimePointTempId = end?.tempId ?? null
    if (!start?.normalizedValue) tagsById.get(e.tempId)!.push('时间待定')
    items.push({tempId:e.tempId,kind:'event',tags:[...new Set(tagsById.get(e.tempId)!)]})
  }
  result.materials = result.materials.filter(m => m.relatedTaskTempIds.some(id => taskIds.has(id)) && quotes(m.evidenceIds).length && compact(context(m.evidenceIds)).includes(compact(m.name)))
    .map(m => ({...m,selected:true,relatedTaskTempIds:m.relatedTaskTempIds.filter(id => taskIds.has(id))}))
  const materialIds = new Set(result.materials.map(m => m.tempId))
  for (const p of times) p.relatedMaterialTempIds = p.relatedMaterialTempIds.filter(id => materialIds.has(id))
  // A named event is already an actionable result. Represent participation and
  // the calendar entry as a related pair, not an unrelated “read this notice”.
  if (!tasks.length && events.length) for (const event of events) {
    // A host announcing an event is not a direction for this user to attend.
    if(!/请[^。；\n]{0,50}(?:参加|出席)|(?:^|[，,])参加/u.test(context(event.evidenceIds)))continue
    const name=event.title.replace(/^(?:参加|出席)/u,''),id=`direct-attend:${event.tempId}`
    const tags=[...tagsById.get(event.tempId)!]
    if(!/请[^。；\n]{0,50}(?:参加|出席)|(?:^|[，,])参加/u.test(context(event.evidenceIds))&&!tags.includes('待确认'))tags.push('待确认')
    const task:TaskSuggestionV2={tempId:id,parentTempId:null,hierarchyType:'task',title:`${tags.includes('如符合条件')?'如符合条件 ':''}参加${name}`,actionVerb:'参加',actionObject:name,description:event.description,completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:[...event.evidenceIds],confidence:event.confidence,inferenceLevel:'strong_inference',userConfirmationRequired:tags.length>0,selected:true}
    event.relatedTaskTempIds=[id]
    for(const point of times)if(point.tempId===event.startTimePointTempId||point.tempId===event.endTimePointTempId)point.relatedTaskTempIds.push(id)
    tagsById.set(id,tags);tasks.push({...task,parentTempId:null,hierarchyType:'task',selected:true});taskIds.add(id)
  }
  tasks.forEach(t => {
    t.materialTempIds = result.materials.filter(m => m.relatedTaskTempIds.includes(t.tempId)).map(m => m.tempId)
    t.timePointTempIds = times.filter(p => p.relatedTaskTempIds.includes(t.tempId)).map(p => p.tempId)
    if (!times.some(p => p.relatedTaskTempIds.includes(t.tempId) && p.normalizedValue)) tagsById.get(t.tempId)!.push('时间待定')
    items.push({tempId:t.tempId,kind:'task',tags:[...new Set(tagsById.get(t.tempId)!)]})
  })
  if (!tasks.length) {
    // Owner-authored read action, not a claim that the notice demanded it.
    // Even a cancellation has an update to read; its cancelled action is absent.
    const proposed=result.sourceSummary.title.trim(),core=compact(proposed.replace(/关于|通知|公告|安排/gu,''))
    const fullTitle = core.length>=2&&compact(sourceText).includes(core)?proposed:sourceText.replace(/\s+/gu,'').split(/[。！？]/u).find(s=>s.trim())?.trim()||'通知'
    const cancelledTopic=/(?:举行|举办|召开)的?([^，。；]{2,45}?)(?:取消|作废)/u.exec(sourceText)?.[1]
    const title=cancelledTopic?cleanDirectTopic(cancelledTopic+'取消通知'):cleanDirectTopic(fullTitle)
    const id = 'direct-read-notice', evidenceId = 'direct-source-notice'
    const sourceId=result.evidence[0]?.sourceId || 'source',noticeQuote=sourceText.slice(0,500)
    result.evidence.push({id:evidenceId,sourceId,textStart:0,textEnd:noticeQuote.length,quote:noticeQuote,field:'description',extractionMethod:'parser',confidence:1})
    tasks.push({tempId:id,parentTempId:null,hierarchyType:'task',title:`查看：${title}`,actionVerb:'查看',actionObject:title,description:'按直达规则保留的阅读待办\n完整通知主题：'+fullTitle,completionCriteria:['查看通知内容'],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'low',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:[evidenceId],confidence:1,inferenceLevel:'optional_suggestion',userConfirmationRequired:false,selected:true})
    const date = parseChineseTimeAst(sourceText,{type:'planned_start',referenceTime:result.createdAt,timezone:result.timePoints[0]?.timezone || 'Asia/Shanghai'})
    const tags:DirectTag[] = []
    // A reading date is a planned date, never an invented deadline.
    const datedSpan=[...sourceText.matchAll(/(?:\d{4}[年/.-])?\d{1,2}(?:月|[/.-])\d{1,2}(?:日|号)?(?:[\s]*(?:上午|下午|晚上|中午)?[\s]*\d{1,2}(?::\d{2}|点(?:\d{1,2}分|半)?))?/gu)].find(m=>{
      const short=parseChineseTimeAst(m[0],{type:'planned_start',referenceTime:result.createdAt,timezone:date.timezone})
      return short.normalizedValue===date.normalizedValue&&!short.needsConfirmation
    })
    const dateIsForReading=!/取消|作废|废止|原定|改期|改为|调整为|发布日期|发布于|发布时间/u.test(sourceText)
    if (dateIsForReading && datedSpan && date.normalizedValue && !date.needsConfirmation && !alternatives.test(sourceText) && !date.rangeEndNormalizedValue) {
      const dateEvidence='direct-reading-date-evidence'
      result.evidence.push({id:dateEvidence,sourceId,textStart:datedSpan.index,textEnd:datedSpan.index!+datedSpan[0].length,quote:datedSpan[0],field:'deadline',extractionMethod:'parser',confidence:1})
      const point:TimePointSuggestionV2 = {tempId:'direct-reading-date',type:'planned_start',rawText:datedSpan[0],normalizedValue:date.normalizedValue,timezone:date.timezone,isAllDay:date.isAllDay,precision:date.precision,needsConfirmation:false,relatedTaskTempIds:[id],relatedMaterialTempIds:[],evidenceIds:[dateEvidence],confidence:1,selected:true}
      times.push(point);tasks[0].timePointTempIds.push(point.tempId)
    }
    items.push({tempId:id,kind:'task',tags})
  }
  result.milestones=[];result.standaloneTasks=tasks;result.events=events;result.timePoints=times
  const retainedIds=new Set([...tasks,...events,...times,...result.materials].map(e=>e.tempId))
  result.conflicts=result.conflicts.map(c=>({...c,entityTempIds:c.entityTempIds.filter(id=>retainedIds.has(id))}))
  result.projectMatch={decision:'standalone_task',matchedProjectId:null,suggestedProjectTitle:null,confidence:1,reasons:['负责人直达模式：独立添加，详情可追溯']}
  return {result,items,omitted}
}
