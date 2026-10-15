import type {JsonValue,TimePoint,SourceVersion} from './types'
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
