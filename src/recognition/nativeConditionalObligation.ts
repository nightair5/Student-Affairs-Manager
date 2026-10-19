import type {RecognitionResult,TaskSuggestionV2} from './types'

export const NATIVE_CONDITIONAL_OBLIGATION_VERSION='native-cited-conditional-obligation-1.0.0'
const compact=(v:string)=>v.replace(/\s/gu,'')
const tasksOf=(r:RecognitionResult)=>[...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
export interface CitedConditionalObligation {
 taskId:string;ruleEvidenceIds:string[];ruleQuotes:string[];factEvidenceIds:string[];factQuotes:string[]
 kind:'alternative_window'|'conditional_obligation';required:boolean;blockedReason:string|null;alternativeTaskId?:string
 sourceConditionValue?:'true'|'false'|'unknown'
}
/** Resolve a declared same-object alternative, not a missing action. A missed
 * opportunity is the opposite of a completed prerequisite. Two different
 * deliveries, an approval step or an ambiguous antecedent never qualify. */
export function citedAlternativeObligations(result:RecognitionResult,source:string):CitedConditionalObligation[]{
 const tasks=tasksOf(result),rows:CitedConditionalObligation[]=[]
 const valid=(t:TaskSuggestionV2)=>result.evidence.filter(e=>t.evidenceIds.includes(e.id)&&e.quote&&source.includes(e.quote)&&source.indexOf(e.quote)===source.lastIndexOf(e.quote))
 const pair=(t:TaskSuggestionV2)=>result.events.filter(e=>e.relatedTaskTempIds?.length===1&&e.relatedTaskTempIds[0]===t.tempId&&[e.startTimePointTempId,e.endTimePointTempId].every((id,i)=>{const p=result.timePoints.find(p=>p.tempId===id);return p&&p.type===(i?'event_end':'event_start')&&p.relatedTaskTempIds.length===1&&p.relatedTaskTempIds[0]===t.tempId&&t.timePointTempIds.includes(p.tempId)})).length===1
 for(const task of tasks){
  if(task.actionVerb!=='领取'||!task.actionObject||!pair(task))continue
  const rules=valid(task).filter(e=>/^(?:如果|若)错过(?:以上|上述|原定|首次|第一)(?:的)?(?:领书|领取|办理)?时间[。，,；;]?(?:可|可以)/u.test(compact(e.quote))
    &&/领取[。.]?$/u.test(compact(e.quote))&&!/不再|不得|禁止|审核|登记|另一批|第二批|另外|另一个|例如|假如/u.test(compact(e.quote)))
  if(rules.length!==1)continue
  const bases=tasks.filter(t=>t.tempId!==task.tempId&&t.actionVerb===task.actionVerb&&t.actionObject===task.actionObject&&pair(t)
    &&valid(t).some(e=>compact(e.quote).includes(task.actionVerb+task.actionObject)&&e.sourceId===rules[0].sourceId)
    &&!valid(t).some(e=>/错过|不再|不得|取消/u.test(e.quote)))
  if(bases.length!==1||task.dependencyTempIds.some(id=>id!==bases[0].tempId))continue
  const base=bases[0],facts=valid(task).filter(e=>/(?:本人|我)(?:已经|已)领取(?:完成|成功)?/u.test(compact(e.quote))&&compact(e.quote).includes(task.actionObject))
  rows.push({taskId:task.tempId,kind:'alternative_window',alternativeTaskId:base.tempId,ruleEvidenceIds:rules.map(e=>e.id),ruleQuotes:rules.map(e=>e.quote),factEvidenceIds:facts.map(e=>e.id),factQuotes:facts.map(e=>e.quote),required:false,sourceConditionValue:facts.length?'false':'unknown',blockedReason:facts.length?'原文已说明同一物品已领取，补领条件不成立；不会再次安排领取。':null})
 }
 return rows
}

/** A conditional delivery already structured by the model remains an
 * obligation for the qualifying group. This view supplies no personal status
 * and never creates a task from a summary. */
export function citedConditionalObligations(result:RecognitionResult,source:string):CitedConditionalObligation[]{
 const rows=citedAlternativeObligations(result,source)
 for(const task of tasksOf(result)){
  if(rows.some(r=>r.taskId===task.tempId))continue
  const own=result.evidence.filter(e=>task.evidenceIds.includes(e.id)&&e.quote&&source.includes(e.quote)&&source.indexOf(e.quote)===source.lastIndexOf(e.quote))
  const rules=own.filter(e=>/(?:学生|同学|申请人)(?:如|若)(?:已缴费|已交费)但(?:决定)?放弃(?:修读|选修|参加)(?:资格)?[，,]/u.test(compact(e.quote))&&/申请退费/u.test(compact(e.quote)))
  if(rules.length!==1||!/退费|退款/u.test(task.actionObject)||!own.some(e=>e.sourceId===rules[0].sourceId&&compact(e.quote).includes(compact(task.actionObject))&&/填写并发送|提交|发送|递交/u.test(compact(e.quote))))continue
  const negative=own.filter(e=>/(?:本人|我)(?:尚未缴费|未缴费|没有缴费|未放弃|不放弃|决定继续)/u.test(compact(e.quote))&&!/如果|例如|假如/u.test(e.quote))
  const positive=own.filter(e=>/(?:本人|我)(?:已经|已)缴费(?:并|且)?(?:决定)?放弃(?:选修|修读|参加)(?:资格)?[。；]?$/u.test(compact(e.quote))&&!/如果|例如|假如/u.test(e.quote))
  const facts=[...negative,...positive],sourceConditionValue=negative.length&&positive.length?'unknown':negative.length?'false':positive.length?'true':'unknown'
  rows.push({taskId:task.tempId,kind:'conditional_obligation',required:true,sourceConditionValue,ruleEvidenceIds:rules.map(e=>e.id),ruleQuotes:rules.map(e=>e.quote),factEvidenceIds:facts.map(e=>e.id),factQuotes:facts.map(e=>e.quote),blockedReason:negative.length?'原文已说明本人未满足该条件，不能用一次勾选覆盖；请保留说明，或依据新事实纠正来源。':null})
 }
 return rows
}

export function projectAlternativeObligations(result:RecognitionResult,source:string){
 const decisions=citedAlternativeObligations(result,source).map(row=>{
  const task=tasksOf(result).find(t=>t.tempId===row.taskId)!,before=[...task.dependencyTempIds]
  task.dependencyTempIds=task.dependencyTempIds.filter(id=>id!==row.alternativeTaskId);task.selected=false
  const event=result.events.find(e=>e.relatedTaskTempIds?.length===1&&e.relatedTaskTempIds[0]===task.tempId)
  if(event)event.selected=false
  return {...row,beforeDependencies:before,afterDependencies:[...task.dependencyTempIds],rule:'MISSED_SAME_OBJECT_WINDOW_IS_ALTERNATIVE_NOT_COMPLETED_PREDECESSOR' as const}
 })
 return {version:NATIVE_CONDITIONAL_OBLIGATION_VERSION,decisions}
}

export function supportedReceiptName(id:string,result:RecognitionResult,source:string,alternatives:ReturnType<typeof projectAlternativeObligations>):boolean{
 const task=tasksOf(result).find(t=>t.tempId===id),event=result.events.find(e=>e.tempId===id)
 if(task)return alternatives.decisions.some(d=>d.taskId===id)
 if(!event||event.relatedTaskTempIds?.length!==1)return false
 const ownerId=event.relatedTaskTempIds[0],owner=tasksOf(result).find(t=>t.tempId===ownerId);if(!owner||owner.actionVerb!=='领取')return false
 const alternative=alternatives.decisions.find(d=>d.taskId===owner.tempId)
 if(alternative)return event.title===owner.actionObject+'补领'
 if(event.title!==owner.actionObject+owner.actionVerb)return false
 return result.evidence.some(e=>owner.evidenceIds.includes(e.id)&&event.evidenceIds.includes(e.id)&&source.includes(e.quote)&&compact(e.quote).includes(owner.actionVerb+owner.actionObject))
}
