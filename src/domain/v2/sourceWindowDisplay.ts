import type {JsonValue,TimePoint,SourceVersion} from './types'
import {isDateOnly,parseBusinessDateTime} from '../../lib/timeSemantics'
const object=(v:unknown):Record<string,unknown>|null=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null
const validPoint=(point:TimePoint)=>!point.needsConfirmation&&Boolean(point.normalizedValue)&&(
 point.precision==='date_only'&&point.isAllDay&&isDateOnly(point.normalizedValue!)||
 point.precision==='exact'&&!point.isAllDay&&Boolean(point.normalizedValue?.includes('T'))&&Boolean(parseBusinessDateTime(point.normalizedValue!,point.timezone??'Asia/Shanghai'))
)

/** Display only the already-stored declaration and original source quotation.
 * It does not create a deadline, plan, owner, or a new canonical fact. */
export function sourceWindowDisplayLabel(taskId:string,declaration:JsonValue|undefined,points:Pick<TimePoint,'id'|'taskId'|'relatedTaskIds'>[],versions:Pick<SourceVersion,'id'|'rawText'>[]):string|undefined {
 const d=object(declaration)
 if(d?.version!=='source-window-declarations-1.0.0'||d.ownerTaskId!==taskId||!Array.isArray(d.windows))return undefined
 const source=versions.find(v=>v.id===d.sourceVersionId)?.rawText
 if(!source)return undefined
 const quotes=d.windows.flatMap(value=>{
  const row=object(value),ids=row?.pointIds
  const expected=row?.state==='RESOLVED_DISCRETE'?2:row?.state==='RESOLVED_SOURCE_DATE'||row?.state==='RESOLVED_SOURCE_END'?1:0
  if(!expected||typeof row?.rawText!=='string'||!row.rawText||!source.includes(row.rawText)||!Array.isArray(ids)||ids.length!==expected||ids.some(id=>typeof id!=='string'||!points.some(p=>p.id===id&&p.taskId===taskId&&p.relatedTaskIds.includes(taskId))))return []
  return [row.rawText]
 })
 return [...new Set(quotes)].join('；')||undefined
}

/** An unresolved schedule is still useful as source wording. It is not a
 * confirmed appointment or a source deadline and cannot drive date ordering. */
export function sourceWindowUnresolvedLabel(taskId:string,declaration:JsonValue|undefined,points:Pick<TimePoint,'id'|'taskId'|'relatedTaskIds'>[],versions:Pick<SourceVersion,'id'|'rawText'>[]):string|undefined {
 const d=object(declaration)
 if(d?.version!=='source-window-declarations-1.0.0'||d.ownerTaskId!==taskId||!Array.isArray(d.windows))return undefined
 const source=versions.find(v=>v.id===d.sourceVersionId)?.rawText
 if(!source)return undefined
 const quotes=d.windows.flatMap(value=>{
  const row=object(value),ids=row?.pointIds
  if(row?.state!=='SOURCE_LITERAL_UNRESOLVED'||typeof row.rawText!=='string'||!row.rawText||!source.includes(row.rawText)||!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string'||!points.some(p=>p.id===id&&p.taskId===taskId&&p.relatedTaskIds.includes(taskId))))return []
  return [row.rawText]
 })
 return quotes.length?`原文：${[...new Set(quotes)].join('；')}（时间未安排）`:undefined
}

/** Only actual resolved endpoint values supply urgency. The label alone cannot
 * manufacture a cutoff or suppress a pending canonical time. */
export function sourceWindowLastEnd(taskId:string,declaration:JsonValue|undefined,points:TimePoint[],versions:SourceVersion[]):string|undefined {
 const d=object(declaration)
 if(!d||!Array.isArray(d.windows))return undefined
 const ends=d.windows.flatMap(value=>{
  const row=object(value)
  if(!row||!sourceWindowDisplayLabel(taskId,{...d,windows:[value]} as JsonValue,points,versions)||!Array.isArray(row.pointIds))return []
  const ids=row.pointIds,owned=points.filter(p=>ids.includes(p.id))
  if(owned.some(p=>!validPoint(p)))return []
  return owned.flatMap(p=>{
   if(p.type!=='event_end'||!p.normalizedValue)return []
   if(isDateOnly(p.normalizedValue))return [p.normalizedValue]
   const date=parseBusinessDateTime(p.normalizedValue,p.timezone??'Asia/Shanghai')
   return date?[date.toISOString()]:[]
  })
 })
 return ends.sort().at(-1)
}

/** Only a single fully resolved window can provide an unambiguous opening.
 * Never bridge gaps between separate windows or infer an opening from its end. */
export function sourceWindowFirstStart(taskId:string,declaration:JsonValue|undefined,points:TimePoint[],versions:SourceVersion[]):string|undefined {
 const d=object(declaration)
 if(!d||!Array.isArray(d.windows)||d.windows.length!==1)return undefined
 const row=object(d.windows[0])
 if(row?.state!=='RESOLVED_DISCRETE'||!Array.isArray(row.pointIds)||!sourceWindowDisplayLabel(taskId,declaration,points,versions))return undefined
 const ids=row.pointIds
 const owned=points.filter(point=>ids.includes(point.id))
 if(owned.length!==2||owned.some(point=>!validPoint(point)))return undefined
 const start=owned.find(point=>point.type==='event_start'),end=owned.find(point=>point.type==='event_end')
 if(start?.normalizedValue&&end?.normalizedValue&&(isDateOnly(start.normalizedValue)||isDateOnly(end.normalizedValue)))return start.normalizedValue.slice(0,10)<=end.normalizedValue.slice(0,10)?start.normalizedValue:undefined
 const startDate=start?.normalizedValue&&parseBusinessDateTime(start.normalizedValue,start.timezone??'Asia/Shanghai')
 const endDate=end?.normalizedValue&&parseBusinessDateTime(end.normalizedValue,end.timezone??'Asia/Shanghai')
 return startDate&&endDate&&startDate.getTime()<=endDate.getTime()?startDate.toISOString():undefined
}

/** If a combined choice owns one option's window, identify that option rather
 * than suggesting the same window applies to every alternative. */
export function sourceWindowChoiceBranch(taskId:string,declaration:JsonValue|undefined,points:TimePoint[],versions:SourceVersion[]):number|undefined {
 const d=object(declaration)
 if(!d||!Array.isArray(d.windows)||d.windows.length!==1||!sourceWindowDisplayLabel(taskId,declaration,points,versions))return undefined
 const row=object(d.windows[0]);if(!row||!Array.isArray(row.pointIds))return undefined
 const ids=row.pointIds
 const branches=points.filter(point=>ids.includes(point.id)).map(point=>String(point.legacyData?.recognitionTempId??'').match(/^(?:direct-copy-)?sem-choice-window-(?:start|end)-\d+-branch-([12])$/u)?.[1])
 return branches.length===2&&branches[0]&&branches.every(branch=>branch===branches[0])?Number(branches[0]):undefined
}
