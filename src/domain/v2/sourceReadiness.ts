import type { WorkspaceV8, JsonValue } from './types'
import { workspaceSnapshotHash } from './migration'
import {nativeQualificationReviews} from '../../recognition/nativeQualificationReview'
import type {RecognitionResult} from '../../recognition/types'
import {isRecognitionResult} from '../../recognition/schema'

export const SOURCE_READINESS_VERSION = 'source-readiness-review-1.0.0' as const
export type ReadinessChoice = 'no_extra_condition' | 'meets_stated_condition' | 'does_not_meet_condition'
export interface ReadinessGroup { id:string; taskIds:string[]; titles:string[]; ruleQuotes:string[]; unresolvedEvidence:boolean; resolved:boolean; blockedReason?:string;value?:'true'|'false'|'not_applicable';alternativeTaskIds?:string[];hasConfirmedTask?:boolean }
export interface ReadinessInput { groupId:string; choice:ReadinessChoice; expectedResult:string; operationId:string }
const record=(v:unknown):Record<string,unknown>|undefined=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:undefined
const strings=(v:unknown):string[]=>Array.isArray(v)&&v.every(s=>typeof s==='string')?v:[]
const ruleIds=(condition:Record<string,unknown>|undefined)=>strings(condition?.conditionScopeIds??condition?.nativeRuleEvidenceIds)
const factIds=(condition:Record<string,unknown>|undefined)=>strings(condition?.factScopeIds??condition?.nativeFactEvidenceIds)
const tasksOf=(r:RecognitionResult)=>[...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
function sourceState(w:WorkspaceV8,draftId:string,allowHistoricalSource=false){
 const draft=w.extractionDrafts.find(d=>d.id===draftId),run=w.recognitionRuns.find(r=>r.id===draft?.recognitionRunId),version=w.sourceVersions.find(v=>v.id===run?.sourceVersionId),source=w.sources.find(s=>s.id===version?.sourceId)
 if(!draft?.result||!version||!source||!allowHistoricalSource&&source.currentVersionId!==version.id)throw Error('SOURCE_READINESS_SOURCE_CHANGED')
 const sidecar=record(draft.legacyData?.semanticSidecar)
 // The native result has evidence IDs, not semantic scope IDs. Keep that
 // distinction in the review snapshot; never manufacture a model firstSemantic.
 const reviewBase=record(draft.legacyData?.nativeQualificationReviewBase),first=draft.legacyData?.firstSuggestionDisplayed
 const base=isRecognitionResult(first)?first:reviewBase?.sourceVersionId===version.id&&isRecognitionResult(reviewBase.result)?reviewBase.result:draft.result
 const native=record(sidecar?.firstSemantic)?[]:nativeQualificationReviews(base,version.rawText??'').filter(n=>{
  const original=tasksOf(base).find(t=>t.tempId===n.taskId),current=tasksOf(draft.result!).find(t=>t.tempId===n.taskId)
  return current?.actionObject===original?.actionObject&&n.ruleEvidenceIds.every(id=>current?.evidenceIds.includes(id))
 }).map(n=>{
  if(!n.alternativeTaskId)return n
  const accepted=w.tasks.find(t=>t.legacyData?.recognitionTempId===n.alternativeTaskId&&t.legacyData?.sourceId===source.id)
  return accepted?{...n,blockedReason:accepted.status==='completed'?'同一领取事项已经完成，不再安排补领。':'正常领取已经确认；请先处理该事项的状态，不能同时生成两项领取。'}:n
 })
 const semantic=record(sidecar?.firstSemantic)??(native.length?{role:'PROGRAM_NATIVE_QUALIFICATION_REVIEW',tasks:native.map(n=>({id:n.taskId,condition:{value:n.sourceConditionValue??'unknown',nativeRuleEvidenceIds:n.ruleEvidenceIds,nativeFactEvidenceIds:n.factEvidenceIds,nativeProjection:n},semantics:{modality:n.required?'required':'optional'}}))}:undefined)
 return {draft,version,sidecar,semantic,native}
}
/** A review view, never evidence that an unknown condition is true/absent. */
export function sourceReadinessGroups(w:WorkspaceV8,draftId:string):ReadinessGroup[]{
 const {draft,sidecar,semantic}=sourceState(w,draftId),groups=new Map<string,ReadinessGroup>()
 const scopeMap=new Map((Array.isArray(sidecar?.sourceScopeEvidence)?sidecar.sourceScopeEvidence:[]).map(record).filter((r):r is Record<string,unknown>=>Boolean(r)).map(r=>[r.scopeId,r.evidenceId]))
 for(const row of (Array.isArray(semantic?.tasks)?semantic.tasks:[]).map(record)){
  const condition=record(row?.condition),id=typeof row?.id==='string'?row.id:''
  const task=tasksOf(draft.result!).find(t=>t.tempId===id)
  if(!task||condition?.value!=='unknown'||draft.acceptedEntityTempIds.includes(id)&&!condition.nativeProjection||draft.rejectedEntityTempIds.includes(id))continue
  const native=record(condition.nativeProjection)
  const rules=ruleIds(condition),facts=factIds(condition),key=workspaceSnapshotHash({rules:[...rules].sort(),facts:[...facts].sort(),value:'unknown',...(native?{nativeProjection:{version:native.version,ambiguityId:native.ambiguityId,ambiguityMessage:native.ambiguityMessage,blockedReason:native.blockedReason}}:{})})
  const quotes=rules.flatMap(scope=>{const e=draft.result!.evidence.find(e=>e.id===(condition.nativeProjection?scope:scopeMap.get(scope)));return e?[e.quote]:[]})
  const blockedReason=record(condition.nativeProjection)?.blockedReason
  const alternativeTaskId=typeof native?.alternativeTaskId==='string'?native.alternativeTaskId:undefined
  const existing=groups.get(key)??{id:key,taskIds:[],titles:[],ruleQuotes:[...new Set(quotes)],unresolvedEvidence:quotes.length!==rules.length||!rules.length&&facts.length>0||typeof blockedReason==='string',resolved:false,...(typeof blockedReason==='string'?{blockedReason}:{}),...(alternativeTaskId?{alternativeTaskIds:[alternativeTaskId]}:{})}
  existing.taskIds.push(id);existing.titles.push(task.title);groups.set(key,existing)
 }
 for(const group of groups.values()){group.resolved=group.taskIds.every(id=>sourceReadinessValue(w,draftId,id)!==undefined);group.hasConfirmedTask=group.taskIds.some(id=>draft.acceptedEntityTempIds.includes(id));if(group.resolved)group.value=sourceReadinessValue(w,draftId,group.taskIds[0])}
 return [...groups.values()]
}
/** User input is scoped to this exact source version and unchanged model condition. */
export function sourceReadinessValue(w:WorkspaceV8,draftId:string,taskId:string):'true'|'false'|'not_applicable'|undefined {
 try {
 const {draft,version,semantic}=sourceState(w,draftId)
 const row=(Array.isArray(semantic?.tasks)?semantic.tasks:[]).map(record).find(t=>t?.id===taskId),condition=record(row?.condition)
 const literal=record(condition?.nativeProjection)
 if(literal?.role==='PROGRAM_REVIEW_OF_CITED_CONDITIONAL_OBLIGATION'&&factIds(condition).length&&['true','false'].includes(String(condition?.value)))return condition!.value as 'true'|'false'
 const entries=Array.isArray(draft.legacyData?.sourceReadiness)?draft.legacyData.sourceReadiness:[]
 const entry=[...entries].reverse().map(record).find(e=>e?.version===SOURCE_READINESS_VERSION&&e.sourceVersionId===version.id&&strings(e.taskIds).includes(taskId)&&e.actor==='user'&&e.conditionSnapshot===JSON.stringify(condition)&&typeof e.operationId==='string'&&w.historyRecords.some(h=>h.id===e.operationId&&h.actor==='user'&&h.action==='user_condition_judgement'&&h.entityId===draftId&&h.sourceVersionId===version.id&&h.fieldName==='source-readiness:'+e.groupId&&record(h.after)?.choice===e.choice&&strings(record(h.after)?.taskIds).includes(taskId)))
 if(condition?.value!=='unknown'||!entry)return undefined
 return entry.choice==='no_extra_condition'&&ruleIds(condition).length===0&&factIds(condition).length===0?'not_applicable':entry.choice==='meets_stated_condition'&&ruleIds(condition).length>0?'true':entry.choice==='does_not_meet_condition'&&ruleIds(condition).length>0?'false':undefined
 } catch { return undefined }
}
export function unresolvedSourceReadiness(w:WorkspaceV8,draftId:string,taskId:string,allowHistoricalSource=false):boolean {
 const {semantic}=sourceState(w,draftId,allowHistoricalSource),row=(Array.isArray(semantic?.tasks)?semantic.tasks:[]).map(record).find(t=>t?.id===taskId)
 return record(row?.condition)?.value==='unknown'&&sourceReadinessValue(w,draftId,taskId)===undefined
}
export function sourceReadinessProblem(w:WorkspaceV8|null,draftId:string,taskId:string):string|undefined {
 if(!w)return undefined
 try{
  const {native,version}=sourceState(w,draftId)
  for(const branch of native.filter(n=>n.alternativeTaskId===taskId)){
   const accepted=w.tasks.find(t=>t.legacyData?.recognitionTempId===branch.taskId&&t.legacyData?.sourceId===version.sourceId)
   if(accepted?accepted.status!=='cancelled':sourceReadinessValue(w,draftId,branch.taskId)==='true')return '当前已选择同一物品的补领，不会再加入正常领取；如需改选，请先处理已选择的分支。'
  }
  return sourceReadinessValue(w,draftId,taskId)==='false'?'本项当前不适用，保留原文说明，不加入可执行待办。':unresolvedSourceReadiness(w,draftId,taskId)?'本项适用条件尚未确认。请先在“本通知适用性”中按实际情况判断，或稍后处理；不会据此安排为可执行事项。':undefined
 }
 catch{return '当前来源版本暂不可核对，请重新打开通知后再接受。'}
}
/** Current UI view only. The original run/source quality flags remain intact. */
export function currentReadinessFlags(w:WorkspaceV8,draftId:string,flags:string[]):string[]{
 const draft=w.extractionDrafts.find(d=>d.id===draftId),sidecar=record(draft?.legacyData?.semanticSidecar)
 const gaps=Array.isArray(sidecar?.representationGaps)?sidecar.representationGaps.map(record):[]
 const resolved=new Set(gaps.flatMap(g=>g?.kind==='condition'&&typeof g.reason==='string'&&strings(g.entityIds).length>0&&strings(g.entityIds).every(id=>sourceReadinessValue(w,draftId,id)!==undefined)&&!draft?.result?.conflicts.some(c=>c.requiresDecision&&c.message===g.reason)?[g.reason]:[]))
 let native:{reviewReasons:string[]}
 try{native=nativeResolution(w,draftId)}catch{return flags}
 return flags.filter(flag=>!resolved.has(flag)&&!native.reviewReasons.includes(flag))
}
function nativeResolution(w:WorkspaceV8,draftId:string):{ambiguityIds:string[];reviewReasons:string[]}{
 const {native}=sourceState(w,draftId)
 const allResolved=native.length>0&&native.every(n=>sourceReadinessValue(w,draftId,n.taskId)==='true')
 return {ambiguityIds:[...new Set(native.map(n=>n.ambiguityId))].filter(id=>native.filter(n=>n.ambiguityId===id).every(n=>sourceReadinessValue(w,draftId,n.taskId)==='true')),reviewReasons:allResolved?[...new Set(native.flatMap(n=>n.qualificationReviewReasons))]:[]}
}
/** Draft-only atomic user judgement; formal entities still use DomainCommitPlan. */
export function applySourceReadiness(w:WorkspaceV8,draftId:string,input:ReadinessInput,now=new Date().toISOString()):WorkspaceV8 {
 const {draft,version,sidecar,semantic,native}=sourceState(w,draftId)
 const previous=w.historyRecords.find(h=>h.id===input.operationId)
 if(previous){if(previous.action!=='user_condition_judgement'||previous.entityId!==draftId||previous.sourceVersionId!==version.id||previous.fieldName!=='source-readiness:'+input.groupId||record(previous.after)?.choice!==input.choice)throw Error('SOURCE_READINESS_OPERATION_CHANGED');return w}
 if(workspaceSnapshotHash(draft.result)!==input.expectedResult)throw Error('SOURCE_READINESS_DRAFT_CHANGED')
 const group=sourceReadinessGroups(w,draftId).find(g=>g.id===input.groupId)
 if(!group||group.unresolvedEvidence||group.taskIds.some(id=>draft.rejectedEntityTempIds.includes(id)))throw Error('SOURCE_READINESS_GROUP_UNAVAILABLE')
 if(input.choice==='no_extra_condition'?group.ruleQuotes.length>0:['meets_stated_condition','does_not_meet_condition'].includes(input.choice)?group.ruleQuotes.length===0:true)throw Error('SOURCE_READINESS_CHOICE_MISMATCH')
 const taskIds=new Set(group.taskIds),gaps=Array.isArray(sidecar?.representationGaps)?sidecar.representationGaps:[]
 const resolvedGaps=gaps.map(record).filter(gap=>gap?.kind==='condition'&&strings(gap.entityIds).length>0&&strings(gap.entityIds).every(id=>taskIds.has(id)))
 const result=structuredClone(draft.result!)
 // Optional participation can remove earlier gaps. Match the surviving
 // generated conflict itself, never a shifted array index or unrelated risk.
 const resolvedMessages=new Set<string>()
 result.conflicts=result.conflicts.filter(c=>{
  const resolved=c.id.startsWith('d26-representation-')&&c.type==='other'&&resolvedGaps.some(g=>g?.reason===c.message&&JSON.stringify(strings(g.entityIds).slice().sort())===JSON.stringify(c.entityTempIds.slice().sort()))
  if(resolved)resolvedMessages.add(c.message)
  return !resolved
 })
 const remainingReasons=result.quality.reviewReasons.filter(reason=>!resolvedMessages.has(reason)||result.conflicts.some(c=>c.requiresDecision&&c.message===reason))
 const displayAudit=record(sidecar?.displayAudit)
 result.quality={...result.quality,reviewReasons:remainingReasons,needsHumanReview:result.quality.needsHumanReview&&(remainingReasons.length>0||result.conflicts.some(c=>c.requiresDecision)||Array.isArray(displayAudit?.unresolved)&&displayAudit.unresolved.length>0||resolvedMessages.size===0)}
 for(const task of tasksOf(result).filter(t=>taskIds.has(t.tempId))){
  const row=(Array.isArray(semantic?.tasks)?semantic.tasks:[]).map(record).find(r=>r?.id===task.tempId),semantics=record(row?.semantics),affected=new Set([task.tempId,...task.materialTempIds,...task.timePointTempIds])
  task.selected=input.choice!=='does_not_meet_condition'&&(semantics?.modality==='required'||group.alternativeTaskIds?.length===1)&&!result.conflicts.some(c=>c.requiresDecision&&(!c.entityTempIds.length||c.entityTempIds.some(id=>affected.has(id))))
 }
 // A missed same-object opportunity is an alternative, not two mandatory
 // receipts. Change only unconfirmed selections; confirmed facts are protected.
 const deselect=new Set<string>()
 if(input.choice==='meets_stated_condition')for(const id of group.alternativeTaskIds??[]){const task=tasksOf(result).find(t=>t.tempId===id);if(task){task.selected=false;deselect.add(id)}}
 if(group.alternativeTaskIds?.length)for(const event of result.events.filter(e=>e.relatedTaskTempIds?.some(id=>taskIds.has(id)||deselect.has(id))))event.selected=!!event.relatedTaskTempIds?.some(id=>taskIds.has(id))&&input.choice==='meets_stated_condition'
 // The user's applicability decision activates this existing obligation as a
 // unit, including only its unchanged, deterministically verified source times.
 // Tentative/unknown times and unrelated or previously edited fields stay out.
 const activatedTimes:string[]=[],assembly=record(draft.legacyData?.firstSuggestionAssembly),first=draft.legacyData?.firstSuggestionDisplayed
 if(input.choice==='meets_stated_condition'&&native.some(n=>taskIds.has(n.taskId)&&n.role==='PROGRAM_REVIEW_OF_CITED_CONDITIONAL_OBLIGATION')&&isRecognitionResult(first))for(const point of result.timePoints){
  if(!point.relatedTaskTempIds.some(id=>taskIds.has(id))||point.needsConfirmation||!point.normalizedValue||!['exact','date_only'].includes(point.precision))continue
  const original=first.timePoints.find(p=>p.tempId===point.tempId),audits=Array.isArray(assembly?.times)?assembly.times.map(record):[]
  const verified=audits.some(a=>a?.entityId===point.tempId&&record(a.after)?.normalizedValue===point.normalizedValue&&record(a.interpretation)?.certainty==='stated')
  if(!original||workspaceSnapshotHash(original)!==workspaceSnapshotHash(point)||!verified||!point.evidenceIds.some(id=>result.evidence.some(e=>e.id===id&&version.rawText?.includes(e.quote)&&e.quote.includes(point.rawText))))continue
  point.selected=true;activatedTimes.push(point.tempId)
 }
 const entries=group.taskIds.map(id=>{const row=(Array.isArray(semantic?.tasks)?semantic.tasks:[]).map(record).find(t=>t?.id===id);return {version:SOURCE_READINESS_VERSION,groupId:group.id,taskIds:[id],choice:input.choice,actor:'user',sourceVersionId:version.id,conditionSnapshot:JSON.stringify(record(row?.condition)),operationId:input.operationId,createdAt:now}})
 // Ordinary drafts can already have a compatibility selection checkpoint.
 // Reflect this explicit judgement there too, so its old `false` cannot hide
 // the newly eligible required item. Preserve the original first display and
 // every unrelated user field/selection.
 const resultTasks=new Map(tasksOf(result).map(t=>[t.tempId,t]))
 const selectItems=(items:JsonValue|undefined)=>Array.isArray(items)?items.map(item=>{
  const row=record(item),id=record(row?.suggestion)?.id
  return typeof id==='string'&&(taskIds.has(id)||deselect.has(id))&&!draft.acceptedEntityTempIds.includes(id)&&!draft.rejectedEntityTempIds.includes(id)
   ?{...row,selected:resultTasks.get(id)?.selected===true,updatedAt:now} as JsonValue:item
 }):undefined
 const legacyItems=selectItems(draft.legacyData?.items),legacyRecord=record(draft.legacyData?.v7Record)
 const viewItems=selectItems(legacyRecord?.items as JsonValue|undefined)
 const next:WorkspaceV8={...w,extractionDrafts:w.extractionDrafts.map(d=>d.id===draftId?{...d,result,updatedAt:now,legacyData:{...d.legacyData,...(legacyItems?{items:legacyItems}:{}),...(viewItems?{v7Record:{...legacyRecord,items:viewItems} as JsonValue}:{}),...(native.length&&!isRecognitionResult(d.legacyData?.firstSuggestionDisplayed)&&!d.legacyData?.nativeQualificationReviewBase?{nativeQualificationReviewBase:{role:'POSTHOC_REVIEW_BASE_NOT_MODEL_FIRST',sourceVersionId:version.id,result:JSON.parse(JSON.stringify(draft.result)) as JsonValue}}:{}),sourceReadiness:[...(Array.isArray(d.legacyData?.sourceReadiness)?d.legacyData.sourceReadiness:[]),...entries]}}:d),historyRecords:[...w.historyRecords,{id:input.operationId,entityType:'extraction_draft',entityId:draftId,action:'user_condition_judgement',fieldName:'source-readiness:'+group.id,before:group.value??'unknown',after:{choice:input.choice,taskIds:group.taskIds,...(activatedTimes.length?{activatedVerifiedTimeIds:activatedTimes}:{})} as JsonValue,actor:'user',reason:'用户后续适用判断；不修改原模型回答或首次展示，不声明前置已完成；仅启用未改动且已有原文确定依据的关联时间。',sourceVersionId:version.id,changedAt:now}]}
 const resolved=nativeResolution(next,draftId)
 result.ambiguities=result.ambiguities.filter(a=>!resolved.ambiguityIds.includes(a.id))
 result.quality.reviewReasons=result.quality.reviewReasons.filter(r=>!resolved.reviewReasons.includes(r))
 if(!result.ambiguities.length&&!result.conflicts.some(c=>c.requiresDecision)&&!result.quality.reviewReasons.length&&result.quality.missingActionRisk<.3)result.quality.needsHumanReview=false
 return next
}
