import type { WorkspaceV8, JsonValue } from './types'
import { workspaceSnapshotHash } from './migration'

export const SOURCE_READINESS_VERSION = 'source-readiness-review-1.0.0' as const
export type ReadinessChoice = 'no_extra_condition' | 'meets_stated_condition'
export interface ReadinessGroup { id:string; taskIds:string[]; titles:string[]; ruleQuotes:string[]; unresolvedEvidence:boolean; resolved:boolean }
export interface ReadinessInput { groupId:string; choice:ReadinessChoice; expectedResult:string; operationId:string }
const record=(v:unknown):Record<string,unknown>|undefined=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:undefined
const strings=(v:unknown):string[]=>Array.isArray(v)&&v.every(s=>typeof s==='string')?v:[]
function sourceState(w:WorkspaceV8,draftId:string){
 const draft=w.extractionDrafts.find(d=>d.id===draftId),run=w.recognitionRuns.find(r=>r.id===draft?.recognitionRunId),version=w.sourceVersions.find(v=>v.id===run?.sourceVersionId),source=w.sources.find(s=>s.id===version?.sourceId)
 if(!draft?.result||!version||source?.currentVersionId!==version.id)throw Error('SOURCE_READINESS_SOURCE_CHANGED')
 const sidecar=record(draft.legacyData?.semanticSidecar),semantic=record(sidecar?.firstSemantic)
 return {draft,version,sidecar,semantic}
}
/** A review view, never evidence that an unknown condition is true/absent. */
export function sourceReadinessGroups(w:WorkspaceV8,draftId:string):ReadinessGroup[]{
 const {draft,sidecar,semantic}=sourceState(w,draftId),groups=new Map<string,ReadinessGroup>()
 const scopeMap=new Map((Array.isArray(sidecar?.sourceScopeEvidence)?sidecar.sourceScopeEvidence:[]).map(record).filter((r):r is Record<string,unknown>=>Boolean(r)).map(r=>[r.scopeId,r.evidenceId]))
 for(const row of (Array.isArray(semantic?.tasks)?semantic.tasks:[]).map(record)){
  const condition=record(row?.condition),id=typeof row?.id==='string'?row.id:''
  const task=draft.result!.standaloneTasks.find(t=>t.tempId===id)
  if(!task||condition?.value!=='unknown'||draft.acceptedEntityTempIds.includes(id)||draft.rejectedEntityTempIds.includes(id))continue
  const rules=strings(condition.conditionScopeIds),facts=strings(condition.factScopeIds),key=workspaceSnapshotHash({rules:[...rules].sort(),facts:[...facts].sort(),value:'unknown'})
  const quotes=rules.flatMap(scope=>{const e=draft.result!.evidence.find(e=>e.id===scopeMap.get(scope));return e?[e.quote]:[]})
  const existing=groups.get(key)??{id:key,taskIds:[],titles:[],ruleQuotes:[...new Set(quotes)],unresolvedEvidence:quotes.length!==rules.length||!rules.length&&facts.length>0,resolved:false}
  existing.taskIds.push(id);existing.titles.push(task.title);groups.set(key,existing)
 }
 for(const group of groups.values())group.resolved=group.taskIds.every(id=>sourceReadinessValue(w,draftId,id)!==undefined)
 return [...groups.values()]
}
/** User input is scoped to this exact source version and unchanged model condition. */
export function sourceReadinessValue(w:WorkspaceV8,draftId:string,taskId:string):'true'|'not_applicable'|undefined {
 try {
 const {draft,version,semantic}=sourceState(w,draftId)
 const row=(Array.isArray(semantic?.tasks)?semantic.tasks:[]).map(record).find(t=>t?.id===taskId),condition=record(row?.condition)
 const entries=Array.isArray(draft.legacyData?.sourceReadiness)?draft.legacyData.sourceReadiness:[]
 const entry=[...entries].reverse().map(record).find(e=>e?.version===SOURCE_READINESS_VERSION&&e.sourceVersionId===version.id&&strings(e.taskIds).includes(taskId)&&e.actor==='user'&&e.conditionSnapshot===JSON.stringify(condition)&&typeof e.operationId==='string'&&w.historyRecords.some(h=>h.id===e.operationId&&h.actor==='user'&&h.action==='user_condition_judgement'&&h.entityId===draftId&&h.sourceVersionId===version.id&&h.fieldName==='source-readiness:'+e.groupId&&record(h.after)?.choice===e.choice&&strings(record(h.after)?.taskIds).includes(taskId)))
 if(condition?.value!=='unknown'||!entry)return undefined
 return entry.choice==='no_extra_condition'&&strings(condition.conditionScopeIds).length===0&&strings(condition.factScopeIds).length===0?'not_applicable':entry.choice==='meets_stated_condition'&&strings(condition.conditionScopeIds).length>0?'true':undefined
 } catch { return undefined }
}
export function unresolvedSourceReadiness(w:WorkspaceV8,draftId:string,taskId:string):boolean {
 const {semantic}=sourceState(w,draftId),row=(Array.isArray(semantic?.tasks)?semantic.tasks:[]).map(record).find(t=>t?.id===taskId)
 return record(row?.condition)?.value==='unknown'&&sourceReadinessValue(w,draftId,taskId)===undefined
}
/** Current UI view only. The original run/source quality flags remain intact. */
export function currentReadinessFlags(w:WorkspaceV8,draftId:string,flags:string[]):string[]{
 const draft=w.extractionDrafts.find(d=>d.id===draftId),sidecar=record(draft?.legacyData?.semanticSidecar)
 const gaps=Array.isArray(sidecar?.representationGaps)?sidecar.representationGaps.map(record):[]
 const resolved=new Set(gaps.flatMap(g=>g?.kind==='condition'&&typeof g.reason==='string'&&strings(g.entityIds).length>0&&strings(g.entityIds).every(id=>sourceReadinessValue(w,draftId,id)!==undefined)&&!draft?.result?.conflicts.some(c=>c.requiresDecision&&c.message===g.reason)?[g.reason]:[]))
 return flags.filter(flag=>!resolved.has(flag))
}
/** Draft-only atomic user judgement; formal entities still use DomainCommitPlan. */
export function applySourceReadiness(w:WorkspaceV8,draftId:string,input:ReadinessInput,now=new Date().toISOString()):WorkspaceV8 {
 const {draft,version,sidecar,semantic}=sourceState(w,draftId)
 const previous=w.historyRecords.find(h=>h.id===input.operationId)
 if(previous){if(previous.action!=='user_condition_judgement'||previous.entityId!==draftId||previous.sourceVersionId!==version.id||previous.fieldName!=='source-readiness:'+input.groupId||record(previous.after)?.choice!==input.choice)throw Error('SOURCE_READINESS_OPERATION_CHANGED');return w}
 if(workspaceSnapshotHash(draft.result)!==input.expectedResult)throw Error('SOURCE_READINESS_DRAFT_CHANGED')
 const group=sourceReadinessGroups(w,draftId).find(g=>g.id===input.groupId)
 if(!group||group.resolved||group.unresolvedEvidence)throw Error('SOURCE_READINESS_GROUP_UNAVAILABLE')
 if(input.choice==='no_extra_condition'?group.ruleQuotes.length>0:input.choice==='meets_stated_condition'?group.ruleQuotes.length===0:true)throw Error('SOURCE_READINESS_CHOICE_MISMATCH')
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
 for(const task of result.standaloneTasks.filter(t=>taskIds.has(t.tempId))){
  const row=(Array.isArray(semantic?.tasks)?semantic.tasks:[]).map(record).find(r=>r?.id===task.tempId),semantics=record(row?.semantics),affected=new Set([task.tempId,...task.materialTempIds,...task.timePointTempIds])
  task.selected=semantics?.modality==='required'&&!result.conflicts.some(c=>c.requiresDecision&&(!c.entityTempIds.length||c.entityTempIds.some(id=>affected.has(id))))
 }
 const entries=group.taskIds.map(id=>{const row=(Array.isArray(semantic?.tasks)?semantic.tasks:[]).map(record).find(t=>t?.id===id);return {version:SOURCE_READINESS_VERSION,groupId:group.id,taskIds:[id],choice:input.choice,actor:'user',sourceVersionId:version.id,conditionSnapshot:JSON.stringify(record(row?.condition)),operationId:input.operationId,createdAt:now}})
 return {...w,extractionDrafts:w.extractionDrafts.map(d=>d.id===draftId?{...d,result,updatedAt:now,legacyData:{...d.legacyData,sourceReadiness:[...(Array.isArray(d.legacyData?.sourceReadiness)?d.legacyData.sourceReadiness:[]),...entries]}}:d),historyRecords:[...w.historyRecords,{id:input.operationId,entityType:'extraction_draft',entityId:draftId,action:'user_condition_judgement',fieldName:'source-readiness:'+group.id,before:'unknown',after:{choice:input.choice,taskIds:group.taskIds} as JsonValue,actor:'user',reason:'用户后续适用判断；不修改原模型回答或首次展示，不声明前置已完成。',sourceVersionId:version.id,changedAt:now}]}
}
