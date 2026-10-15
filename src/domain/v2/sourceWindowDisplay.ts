import type {JsonValue,TimePoint,SourceVersion} from './types'
import {parseBusinessDateTime} from '../../lib/timeSemantics'
const object=(v:unknown):Record<string,unknown>|null=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null

/** Display only the already-stored declaration and original source quotation.
 * It does not create a deadline, plan, owner, or a new canonical fact. */
export function sourceWindowDisplayLabel(taskId:string,declaration:JsonValue|undefined,points:Pick<TimePoint,'id'|'taskId'|'relatedTaskIds'>[],versions:Pick<SourceVersion,'id'|'rawText'>[]):string|undefined {
 const d=object(declaration)
 if(d?.version!=='source-window-declarations-1.0.0'||d.ownerTaskId!==taskId||!Array.isArray(d.windows))return undefined
 const source=versions.find(v=>v.id===d.sourceVersionId)?.rawText
 if(!source)return undefined
 const quotes=d.windows.flatMap(value=>{
  const row=object(value),ids=row?.pointIds
  if(row?.state!=='RESOLVED_DISCRETE'||typeof row.rawText!=='string'||!row.rawText||!source.includes(row.rawText)||!Array.isArray(ids)||ids.length<2||ids.some(id=>typeof id!=='string'||!points.some(p=>p.id===id&&p.taskId===taskId&&p.relatedTaskIds.includes(taskId))))return []
  return [row.rawText]
 })
 return [...new Set(quotes)].join('；')||undefined
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
  if(owned.some(p=>p.needsConfirmation||p.isAllDay||!p.normalizedValue?.includes('T')||p.precision!=='exact'))return []
  return owned.flatMap(p=>{
   if(p.type!=='event_end'||!p.normalizedValue)return []
   const date=parseBusinessDateTime(p.normalizedValue,p.timezone??'Asia/Shanghai')
   return date?[date.toISOString()]:[]
  })
 })
 return ends.sort().at(-1)
}
