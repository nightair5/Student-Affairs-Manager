import {improveDirectFallback,recoverMissingDirectActions} from '../../recognition/directFallback'
import { convertDirectResult, DIRECT_MODE_VERSION, type DirectItem, type DirectTag } from '../../recognition/directResult'
import {DIRECT_ACTION_PROJECTION_VERSION} from '../../recognition/directActionProjection'
import {DIRECT_RETENTION_VERSION,DIRECT_RETENTION_DEFAULT} from '../../recognition/directRetention'
import { buildDomainCommitPlan, applyDomainCommitPlan } from './domainCommit'
import { workspaceSnapshotHash } from './migration'
import type { CanonicalWorkspaceRepository } from './repository'
import type { WorkspaceV8, JsonValue, ExtractionDraft, Source } from './types'
import type { RecognitionResult } from '../../recognition/types'
import { parseBusinessDateTime, isDateOnly } from '../../lib/timeSemantics'
import { buildLocalRecognition } from '../../recognition/pipeline'

export interface DirectBatch {
  version: typeof DIRECT_MODE_VERSION; id: string; draftId: string; sourceId: string; addedAt: string
  status: 'active' | 'undone'; contentHash: string; origin?: 'ai' | 'local'; fallbackReason?: 'network'|'semantic'
  items: Array<DirectItem & { id: string }>
  created: Record<string, string[]>
  beforeDraft: Pick<ExtractionDraft,'status'|'acceptedEntityTempIds'|'rejectedEntityTempIds'|'commitOperationIds'|'result'|'updatedAt'>
  beforeSource: Pick<Source,'status'|'updatedAt'>
}
const record = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as JsonValue
const contentHash = (text: string) => workspaceSnapshotHash(text.replace(/\r\n?/gu,'\n').trim())
export function directBatch(draft: ExtractionDraft): DirectBatch | null {
  const b=draft.legacyData?.directBatch
  if(!record(b)||b.version!==DIRECT_MODE_VERSION)return null
  const batch=b as unknown as DirectBatch,conversion=draft.legacyData?.directConversion
  return batch.origin?batch:record(conversion)&&conversion.inputProvider==='local-rules-from-preserved-source'?{...batch,origin:'local'}:batch
}
export const recentDirectBatches = (w: WorkspaceV8) => w.extractionDrafts.flatMap(d => {const b=directBatch(d);return b?[b]:[]}).sort((a,b)=>b.addedAt.localeCompare(a.addedAt))
export function directDuplicate(w: WorkspaceV8, text: string): string | null {
  const normalized=text.replace(/\r\n?/gu,'\n').trim(),sources=new Map(w.sources.map(s=>[s.id,s])),allBatches=recentDirectBatches(w),formalIds=new Set([...w.tasks,...w.events].map(e=>e.id))
  for(const v of w.sourceVersions){
    if(!v.rawText||v.rawText.replace(/\r\n?/gu,'\n').trim()!==normalized)continue
    const s=sources.get(v.sourceId);if(!s)continue
    const drafts=new Set(w.extractionDrafts.filter(d=>w.recognitionRuns.find(r=>r.id===d.recognitionRunId)?.sourceVersionId===v.id).map(d=>d.id))
    const batches=allBatches.filter(b=>b.sourceId===s.id&&drafts.has(b.draftId))
    if(batches.some(b=>b.status==='active'&&b.items.some(i=>[...w.tasks,...w.events].some(e=>e.id===i.id))))return s.id
    if(w.historyRecords.some(h=>h.sourceVersionId===v.id&&formalIds.has(h.entityId)))return s.id
    if(!batches.length&&v.id===s.currentVersionId&&['confirmed','partially_confirmed'].includes(s.status)&&[...w.tasks,...w.events].some(t=>t.legacyData?.sourceId===s.id))return s.id
  }
  return null
}

/** Conversion, plan, audit and all formal entities are one existing Repository
 * transaction. No view projection can write canonical arrays here. */
export async function commitDirectDraft(repo: Pick<CanonicalWorkspaceRepository,'transaction'>, draftId: string, now=new Date().toISOString()): Promise<{batch:DirectBatch|null;duplicate:boolean}> {
  let receipt:{batch:DirectBatch|null;duplicate:boolean}={batch:null,duplicate:false}
  await repo.transaction(w=>{
    const d=w.extractionDrafts.find(x=>x.id===draftId),run=d&&w.recognitionRuns.find(x=>x.id===d.recognitionRunId)
    const v=run&&w.sourceVersions.find(x=>x.id===run.sourceVersionId),s=v&&w.sources.find(x=>x.id===v.sourceId)
    if(!d||!v?.rawText||!s||s.currentVersionId!==v.id||run?.status==='running')throw Error('DIRECT_SOURCE_NOT_AVAILABLE')
    const recovery=d.legacyData?.storedDraftRecovery
    if(record(recovery)&&recovery.mode==='isolated_historical_result')throw Error('DIRECT_HISTORICAL_ANSWER_ISOLATED')
    const duplicateSource=directDuplicate(w,v.rawText)
    if(duplicateSource&&(duplicateSource!==s.id||directBatch(d)?.status==='active'||d.status==='confirmed')){receipt={batch:recentDirectBatches(w).find(b=>b.sourceId===duplicateSource&&b.status==='active')??null,duplicate:true};return w}
    const original=run?.legacyData?.originalRecognitionResult
    const localFallback=!d.result||run?.provider==='local-rules'
    const rawInput=d.result??buildLocalRecognition({sourceType:'text',sourceTitle:s.title,content:v.rawText,referenceTime:new Date(run?.startedAt??d.createdAt),timezone:w.settings.defaultTimezone,projects:[],tasks:[]})
    const input=localFallback?improveDirectFallback(rawInput,v.rawText):rawInput
    const actionRecovery=(import.meta as ImportMeta&{env?:{VITE_DIRECT_ACTION_RECOVERY?:string}}).env?.VITE_DIRECT_ACTION_RECOVERY==='1'
    const retention=DIRECT_RETENTION_DEFAULT||(import.meta as ImportMeta&{env?:{VITE_DIRECT_RETENTION?:string}}).env?.VITE_DIRECT_RETENTION==='1'
    const initial=convertDirectResult(input,v.rawText,record(original)?original as unknown as RecognitionResult:undefined,{actionRecovery,retention})
    const converted=localFallback?initial:recoverMissingDirectActions(initial,buildLocalRecognition({sourceType:'text',sourceTitle:s.title,content:v.rawText,referenceTime:new Date(rawInput.createdAt),timezone:w.settings.defaultTimezone,projects:[],tasks:[]}),v.rawText)
    const semanticFallback=converted!==initial
    const result=converted.result
    const newTasks=new Set(result.standaloneTasks.filter(t=>!w.tasks.some(x=>x.id===`task:${d.id}:${t.tempId}`)).map(t=>t.tempId))
    const newEvents=new Set(result.events.filter(e=>!w.events.some(x=>x.id===`event:${d.id}:${e.tempId}`)).map(e=>e.tempId))
    // Partial legacy drafts can share material/time identities with saved tasks.
    // Copies for new owners avoid changing a previously saved canonical record.
    const materialCopies=new Map<string,string>()
    for(const m of [...result.materials])if(m.relatedTaskTempIds.some(id=>newTasks.has(id))&&w.materials.some(x=>x.id===`material:${d.id}:${m.tempId}`)){
      const id=`direct-copy-${m.tempId}`;materialCopies.set(m.tempId,id)
      result.materials.push({...m,tempId:id,relatedTaskTempIds:m.relatedTaskTempIds.filter(id=>newTasks.has(id))})
    }
    const eventTimeIds=new Set(result.events.filter(e=>newEvents.has(e.tempId)).flatMap(e=>[e.startTimePointTempId,e.endTimePointTempId]))
    const timeCopies=new Map<string,string>()
    for(const p of [...result.timePoints])if((p.relatedTaskTempIds.some(id=>newTasks.has(id))||eventTimeIds.has(p.tempId))&&w.timePoints.some(x=>x.id===`time:${d.id}:${p.tempId}`)){
      const id=`direct-copy-${p.tempId}`;timeCopies.set(p.tempId,id)
      result.timePoints.push({...p,tempId:id,relatedTaskTempIds:p.relatedTaskTempIds.filter(id=>newTasks.has(id)),relatedMaterialTempIds:p.relatedMaterialTempIds.map(id=>materialCopies.get(id)??id)})
    }
    result.standaloneTasks=result.standaloneTasks.map(t=>newTasks.has(t.tempId)?{...t,materialTempIds:t.materialTempIds.map(id=>materialCopies.get(id)??id),timePointTempIds:t.timePointTempIds.map(id=>timeCopies.get(id)??id)}:t)
    result.events=result.events.map(e=>newEvents.has(e.tempId)?{...e,startTimePointTempId:e.startTimePointTempId?timeCopies.get(e.startTimePointTempId)??e.startTimePointTempId:null,endTimePointTempId:e.endTimePointTempId?timeCopies.get(e.endTimePointTempId)??e.endTimePointTempId:null}:e)
    const prepared={...w,extractionDrafts:w.extractionDrafts.map(x=>x.id===d.id?{...x,result}:x)}
    const plan=buildDomainCommitPlan(prepared,d.id,{
      taskTempIds:[...newTasks],eventTempIds:[...newEvents],
      materialTempIds:result.materials.filter(m=>!w.materials.some(x=>x.id===`material:${d.id}:${m.tempId}`)&&m.relatedTaskTempIds.some(id=>newTasks.has(id))).map(m=>m.tempId),
      timePointTempIds:result.timePoints.filter(p=>!w.timePoints.some(x=>x.id===`time:${d.id}:${p.tempId}`)&&(p.relatedTaskTempIds.some(id=>newTasks.has(id))||result.events.some(e=>newEvents.has(e.tempId)&&(e.startTimePointTempId===p.tempId||e.endTimePointTempId===p.tempId)))).map(p=>p.tempId),
    },now)
    plan.operationId += ':direct:'+workspaceSnapshotHash(now)
    plan.create.evidenceRefs=plan.create.evidenceRefs.filter(e=>!w.evidenceRefs.some(x=>x.id===e.id))
    const tags=new Map(converted.items.map(i=>[i.tempId,i.tags]))
    plan.create.tasks=plan.create.tasks.map(t=>({...t,needsReview:Boolean(tags.get(String(t.legacyData?.recognitionTempId))?.length),legacyData:{...t.legacyData,directTags:tags.get(String(t.legacyData?.recognitionTempId))??[],directMode:DIRECT_MODE_VERSION}}))
    plan.create.events=plan.create.events.map(e=>({...e,needsReview:Boolean(tags.get(String(e.legacyData?.recognitionTempId))?.length),legacyData:{...e.legacyData,directTags:tags.get(String(e.legacyData?.recognitionTempId))??[],directMode:DIRECT_MODE_VERSION,sourceId:s.id}}))
    const created=Object.fromEntries(Object.entries(plan.create).map(([key,value])=>[key,value.map(e=>e.id)]))
    const batch:DirectBatch={version:DIRECT_MODE_VERSION,id:plan.operationId,draftId:d.id,sourceId:s.id,status:'active',addedAt:now,contentHash:contentHash(v.rawText),created,origin:localFallback||semanticFallback?'local':'ai',...(localFallback||semanticFallback?{fallbackReason:semanticFallback?'semantic' as const:'network' as const}:{}),
      items:converted.items.filter(i=>i.kind==='task'?newTasks.has(i.tempId):newEvents.has(i.tempId)).map(i=>({...i,id:`${i.kind}:${d.id}:${i.tempId}`})),
      beforeDraft:{status:d.status,acceptedEntityTempIds:d.acceptedEntityTempIds,rejectedEntityTempIds:d.rejectedEntityTempIds,commitOperationIds:d.commitOperationIds,result:d.result,updatedAt:d.updatedAt},beforeSource:{status:s.status,updatedAt:s.updatedAt}}
    const next=applyDomainCommitPlan(prepared,plan,now)
    next.sources=next.sources.map(x=>x.id===s.id?{...x,legacyData:{...x.legacyData,directUndoneAt:null}}:x)
    if(s.title==='手动粘贴消息'&&!d.acceptedEntityTempIds.length)next.sources=next.sources.map(x=>x.id===s.id?{...x,title:result.standaloneTasks[0]?.title??result.events[0]?.title??x.title}:x)
    next.extractionDrafts=next.extractionDrafts.map(x=>x.id===d.id?{...x,legacyData:{...x.legacyData,directBatch:json(batch),directConversion:json({version:DIRECT_MODE_VERSION,...(retention?{retentionVersion:DIRECT_RETENTION_VERSION}:{}),inputProvider:d.result?'stored-answer':'local-rules-from-preserved-source',omitted:converted.omitted,...(actionRecovery?{actionProjectionVersion:DIRECT_ACTION_PROJECTION_VERSION,sourceDerivedTaskIds:result.standaloneTasks.filter(t=>t.tempId.startsWith('direct-action-')).map(t=>t.tempId)}:{})})}}:x)
    receipt={batch,duplicate:false};return next
  })
  return receipt
}

const createdKeys=['projects','milestones','workPackages','tasks','events','materials','timePoints','evidenceRefs','historyRecords'] as const
export async function undoDirectBatch(repo:Pick<CanonicalWorkspaceRepository,'transaction'>,batchId:string,now=new Date().toISOString()):Promise<void>{
  await repo.transaction(w=>{
    const d=w.extractionDrafts.find(d=>directBatch(d)?.id===batchId),batch=d&&directBatch(d)
    if(!d||!batch)throw Error('DIRECT_BATCH_NOT_FOUND')
    if(batch.status==='undone')return w
    const run=w.recognitionRuns.find(r=>r.id===d.recognitionRunId),source=w.sources.find(s=>s.id===batch.sourceId)
    if(!run||source?.currentVersionId!==run.sourceVersionId)throw Error('DIRECT_UNDO_SOURCE_CHANGED')
    let next={...w}
    for(const key of createdKeys){const ids=new Set(batch.created[key]??[]);next={...next,[key]:next[key].filter(e=>!ids.has(e.id))}}
    const removedIds=new Set(Object.values(batch.created).flat())
    next.historyRecords=next.historyRecords.filter(h=>!removedIds.has(h.entityId))
    next.reminderRecords=next.reminderRecords.filter(r=>!removedIds.has(r.taskId))
    const undone={...batch,status:'undone' as const}
    return {...next,savedAt:now,sources:next.sources.map(s=>s.id===batch.sourceId?{...s,status:'archived',legacyData:{...s.legacyData,directUndoneAt:now,directUndoHistory:json([...(Array.isArray(s.legacyData?.directUndoHistory)?s.legacyData.directUndoHistory:[]),{batchId:batch.id,at:now,created:batch.created}])},updatedAt:now}:s),
      extractionDrafts:next.extractionDrafts.map(x=>x.id===d.id?{...x,...batch.beforeDraft,legacyData:{...x.legacyData,directBatch:json(undone)},updatedAt:now}:x)}
  })
}

/** Prepare in memory, then compare and atomically replace through the same
 * Repository transaction. A failed recognition never enters this function. */
export async function replaceDirectFallback(repo:CanonicalWorkspaceRepository,batchId:string,draftId:string,now=new Date().toISOString()){
 const before=await repo.load()
 if(!before)throw Error('DIRECT_SOURCE_NOT_AVAILABLE')
 const batch=recentDirectBatches(before).find(b=>b.id===batchId&&b.status==='active')
 if(!batch||batch.origin!=='local')throw Error('DIRECT_FALLBACK_NOT_ACTIVE')
 const oldRun=before.recognitionRuns.find(r=>r.id===before.extractionDrafts.find(d=>d.id===batch.draftId)?.recognitionRunId),newRun=before.recognitionRuns.find(r=>r.id===before.extractionDrafts.find(d=>d.id===draftId)?.recognitionRunId)
 if(!oldRun||oldRun.sourceVersionId!==newRun?.sourceVersionId||newRun.provider!=='deepseek'||newRun.status!=='succeeded')throw Error('DIRECT_REPLACEMENT_NOT_SUCCESSFUL_AI')
 if(batch.items.some(i=>{const e=[...before.tasks,...before.events].find(e=>e.id===i.id);return !e||e.updatedAt>batch.addedAt||'status'in e&&e.status==='completed'}))throw Error('已修改过这些事项，请保留当前内容，避免覆盖你的修改。')
 let prepared=structuredClone(before)
 const memory:Pick<CanonicalWorkspaceRepository,'transaction'>={transaction:async mutate=>{prepared=mutate(prepared);return structuredClone(prepared)}}
 await undoDirectBatch(memory,batchId,now)
 const receipt=await commitDirectDraft(memory,draftId,now)
 if(!receipt.batch||receipt.duplicate)throw Error('DIRECT_REPLACEMENT_NOT_CREATED')
 if(receipt.batch.origin==='local')throw Error('AI 结果尚未更完整，原来的事项保留。')
 const oldIds=new Set(batch.items.map(i=>i.id)),newIds=new Set(receipt.batch.items.map(i=>i.id)),oldActions=before.tasks.filter(t=>oldIds.has(t.id)&&!/^查看[：:]/u.test(t.title)),newActions=prepared.tasks.filter(t=>newIds.has(t.id)&&!/^查看[：:]/u.test(t.title))
 if(oldActions.length&&!newActions.length||before.timePoints.some(p=>p.normalizedValue&&p.relatedTaskIds.some(id=>oldIds.has(id))&&!prepared.timePoints.some(next=>next.normalizedValue===p.normalizedValue&&next.type===p.type&&next.relatedTaskIds.some(id=>newIds.has(id)))))throw Error('AI 结果缺少已有的行动或时间，原来的事项保留。')
 await repo.transaction(current=>{if(workspaceSnapshotHash(current)!==workspaceSnapshotHash(before))throw Error('DIRECT_REPLACEMENT_WORKSPACE_CHANGED');return prepared})
 return receipt
}

/** Only entities created by a direct batch are removable through this entry. */
export async function deleteDirectItem(repo:CanonicalWorkspaceRepository,id:string):Promise<void>{
  await repo.transaction(w=>{
    const d=w.extractionDrafts.find(d=>directBatch(d)?.status==='active'&&directBatch(d)?.items.some(i=>i.id===id)),batch=d&&directBatch(d)
    if(!batch)throw Error('DIRECT_ITEM_NOT_OWNED')
    const task=w.tasks.find(t=>t.id===id),event=w.events.find(e=>e.id===id)
    if(!task&&!event)return w
    const ownedIds=new Set(batch.items.map(i=>i.id)),detached=w.tasks.filter(t=>ownedIds.has(t.id)&&t.id!==id&&t.dependencyIds.includes(id))
    const tasks=w.tasks.filter(t=>t.id!==id).map(t=>detached.some(x=>x.id===t.id)?{...t,dependencyIds:t.dependencyIds.filter(v=>v!==id),needsReview:true,legacyData:{...t.legacyData,directTags:json([...new Set([...(Array.isArray(t.legacyData?.directTags)?t.legacyData.directTags:[]),'待确认'])])}}:t),events=w.events.filter(e=>e.id!==id)
    // Existing dependencies are never silently rewired. The Repository validator
    // rejects external references atomically instead of deleting older facts.
    const materials=w.materials.filter(m=>!(batch.created.materials??[]).includes(m.id)||m.relatedTaskIds.some(t=>t!==id)).map(m=>(batch.created.materials??[]).includes(m.id)?{...m,relatedTaskIds:m.relatedTaskIds.filter(t=>t!==id)}:m)
    const materialIds=new Set(materials.map(m=>m.id))
    const timePoints=w.timePoints.filter(p=>!((batch.created.timePoints??[]).includes(p.id)&&(p.taskId===id||p.eventId===id)&&!p.relatedTaskIds.some(t=>t!==id)&&!(p.eventId&&p.eventId!==id)&&!p.relatedMaterialIds.some(m=>materialIds.has(m))&&!(p.materialId&&materialIds.has(p.materialId))))
      .map(p=>(batch.created.timePoints??[]).includes(p.id)?{...p,taskId:p.taskId===id?null:p.taskId,eventId:p.eventId===id?null:p.eventId,materialId:p.materialId&&!materialIds.has(p.materialId)?null:p.materialId,relatedTaskIds:p.relatedTaskIds.filter(t=>t!==id),relatedMaterialIds:p.relatedMaterialIds.filter(v=>materialIds.has(v))}:p)
    const remaining=new Set([...tasks,...events,...materials,...timePoints].map(e=>e.id)),removed=new Set([id,...w.materials.filter(m=>!remaining.has(m.id)).map(m=>m.id),...w.timePoints.filter(p=>!remaining.has(p.id)).map(p=>p.id)])
    const removedHistory=w.historyRecords.filter(h=>removed.has(h.entityId))
    const updatedBatch={...batch,items:batch.items.map(i=>detached.some(t=>t.id===i.id)?{...i,tags:[...new Set<DirectTag>([...i.tags,'待确认'])]}:i)}
    return {...w,tasks,events,materials,timePoints,historyRecords:w.historyRecords.filter(h=>!removed.has(h.entityId)),reminderRecords:w.reminderRecords.filter(r=>!removed.has(r.taskId)),extractionDrafts:w.extractionDrafts.map(x=>x.id===batch.draftId?{...x,legacyData:{...x.legacyData,directBatch:json(updatedBatch),directDeletedItems:json([...(Array.isArray(x.legacyData?.directDeletedItems)?x.legacyData.directDeletedItems:[]),{entity:task??event,history:removedHistory,detached}])}}:x)}
  })
}

export interface DirectEdit { title:string; date:string; location?:string; end?:string }
export async function editDirectItem(repo:CanonicalWorkspaceRepository,id:string,edit:DirectEdit,now=new Date().toISOString()):Promise<void>{
  if(!edit.title.trim()||edit.title.length>300)throw Error('请填写事项名称')
  if(edit.date&&!isDateOnly(edit.date)&&!parseBusinessDateTime(edit.date))throw Error('日期格式不正确，请填写日期或日期和时间')
  if(edit.end&&!isDateOnly(edit.end)&&!parseBusinessDateTime(edit.end))throw Error('结束日期格式不正确')
  await repo.transaction(w=>{
    const batch=recentDirectBatches(w).find(b=>b.status==='active'&&b.items.some(i=>i.id===id))
    if(!batch)throw Error('DIRECT_ITEM_NOT_OWNED')
    const task=w.tasks.find(t=>t.id===id),event=w.events.find(e=>e.id===id),before=task??event
    if(!before)throw Error('DIRECT_ITEM_NOT_FOUND')
    const oldEnd=event&&w.timePoints.find(p=>p.id===event.endTimePointId),endValue=edit.end===undefined?oldEnd?.normalizedValue:edit.end
    if(event&&edit.date&&endValue){const start=edit.date,end=endValue;const inverted=isDateOnly(start)||isDateOnly(end)?end.slice(0,10)<start.slice(0,10):parseBusinessDateTime(end)!.getTime()<parseBusinessDateTime(start)!.getTime();if(inverted)throw Error('结束时间不能早于开始时间')}
    const owned=(p:WorkspaceV8['timePoints'][number])=>p.taskId===id||p.relatedTaskIds.includes(id)
    const point=task?w.timePoints.find(p=>owned(p)&&/_deadline$/u.test(p.type))??w.timePoints.find(p=>owned(p)&&p.type==='planned_start'):w.timePoints.find(p=>p.id===event?.startTimePointId)
    const shared=point&&((task&&point.relatedTaskIds.some(t=>t!==id))||(task&&point.eventId)||(event&&point.relatedTaskIds.length)||point.relatedMaterialIds.length||point.materialId)
    const newPointId=point&&!shared?point.id:`time:${id}:direct-manual`
    const timePoints=w.timePoints.filter(p=>p.id!==newPointId).map(p=>shared&&p.id===point?.id?{...p,taskId:p.taskId===id?null:p.taskId,eventId:p.eventId===id?null:p.eventId,relatedTaskIds:p.relatedTaskIds.filter(t=>t!==id)}:p)
    if(edit.date)timePoints.push({id:newPointId,projectId:null,milestoneId:null,taskId:task?id:null,eventId:event?id:null,materialId:null,relatedTaskIds:task?[id]:[],relatedMaterialIds:[],type:point?.type??(task?'planned_start':'event_start'),rawText:point?.rawText??'',normalizedValue:edit.date,timezone:isDateOnly(edit.date)?null:w.settings.defaultTimezone,isAllDay:isDateOnly(edit.date),precision:isDateOnly(edit.date)?'date_only':'exact',needsConfirmation:false,createdAt:point?.createdAt??now,updatedAt:now,legacyData:{...point?.legacyData,directManual:true}})
    else if(point&&!shared)timePoints.push({...point,rawText:'',normalizedValue:null,timezone:null,isAllDay:false,precision:'vague',needsConfirmation:true,updatedAt:now,legacyData:{...point.legacyData,directManual:true}})
    const cleanTags=(value:unknown):DirectTag[]=>{const tags:DirectTag[]=Array.isArray(value)?value.filter((t):t is DirectTag=>typeof t==='string'&&t!=='时间待定'):[];return edit.date?tags:[...tags,'时间待定']}
    const next={...w,timePoints,tasks:w.tasks.map(t=>t.id===id?{...t,title:edit.title.trim(),nextAction:edit.title.trim(),updatedAt:now,version:t.version+1,needsReview:cleanTags(t.legacyData?.directTags).length>0,legacyData:{...t.legacyData,directTags:cleanTags(t.legacyData?.directTags)}}:t),events:w.events.map(e=>e.id===id?{...e,title:edit.title.trim(),location:edit.location?.trim()||null,startTimePointId:edit.date?newPointId:null,updatedAt:now,needsReview:cleanTags(e.legacyData?.directTags).length>0,legacyData:{...e.legacyData,directTags:cleanTags(e.legacyData?.directTags)}}:e),
      historyRecords:[...w.historyRecords,{id:`history:direct-edit:${workspaceSnapshotHash({id,now,edit})}`,entityType:task?'task' as const:'event' as const,entityId:id,action:'updated',fieldName:'direct-edit',before:json({entity:before,time:point??null,...(event?{end:oldEnd??null}:{})}),after:json(edit),actor:'user' as const,reason:'用户修改已添加事项',sourceVersionId:null,changedAt:now}]}
    let manualEndId:string|undefined
    if(event&&edit.end!==undefined){
      const sharedEnd=oldEnd&&(oldEnd.relatedTaskIds.length>0||oldEnd.relatedMaterialIds.length>0||oldEnd.materialId)
      manualEndId=oldEnd&&!sharedEnd?oldEnd.id:`time:${id}:direct-manual-end`
      next.timePoints=next.timePoints.filter(p=>p.id!==manualEndId).map(p=>sharedEnd&&p.id===oldEnd?.id?{...p,eventId:null}:p)
      if(edit.end)next.timePoints.push({id:manualEndId,projectId:null,milestoneId:null,taskId:null,eventId:id,materialId:null,relatedTaskIds:[],relatedMaterialIds:[],type:'event_end',rawText:oldEnd?.rawText??'',normalizedValue:edit.end,timezone:isDateOnly(edit.end)?null:w.settings.defaultTimezone,isAllDay:isDateOnly(edit.end),precision:isDateOnly(edit.end)?'date_only':'exact',needsConfirmation:false,createdAt:oldEnd?.createdAt??now,updatedAt:now,legacyData:{...oldEnd?.legacyData,directManual:true}})
      else if(oldEnd&&!sharedEnd)next.timePoints.push({...oldEnd,rawText:'',normalizedValue:null,timezone:null,isAllDay:false,precision:'vague',needsConfirmation:true,updatedAt:now,legacyData:{...oldEnd.legacyData,directManual:true}})
      next.events=next.events.map(e=>e.id===id?{...e,endTimePointId:edit.end||oldEnd&&!sharedEnd?manualEndId!:null}:e)
    }
    // Include a newly created manual time and edit audit in the undo boundary.
    const withBatch={...batch,items:batch.items.map(i=>i.id===id?{...i,tags:cleanTags(i.tags)}:i),created:{...batch.created,timePoints:[...new Set([...(batch.created.timePoints??[]),newPointId,...(manualEndId?[manualEndId]:[])])],historyRecords:[...(batch.created.historyRecords??[]),next.historyRecords.at(-1)!.id]}}
    next.extractionDrafts=next.extractionDrafts.map(d=>d.id===batch.draftId?{...d,legacyData:{...d.legacyData,directBatch:json(withBatch)}}:d)
    return next
  })
}
