// Evaluation/runner only. Never import references or this module into model decisions.
import { parseSemanticInput, stableJson, type SemanticInput } from '../mainline04/semanticContract'
import { composeSemantics } from '../mainline04/semanticComposer'
import { parseModelEnvelope, type WireContext } from './modelWire'

export const SCORER_VERSION='real-input-seen-fact-diagnostic-2' as const
export interface CountMetric { predicted: number; reference: number; correct: number; falsePositive: number; falseNegative: number;
  precision: number|null; recall: number|null }
export function countMultiset(predicted: string[], reference: string[]): CountMetric {
  const remaining=new Map<string,number>()
  for(const value of reference)remaining.set(value,(remaining.get(value)??0)+1)
  let correct=0
  for(const value of predicted)if((remaining.get(value)??0)>0){correct++;remaining.set(value,remaining.get(value)!-1)}
  return {predicted:predicted.length,reference:reference.length,correct,falsePositive:predicted.length-correct,falseNegative:reference.length-correct,
    precision:predicted.length?correct/predicted.length:null,recall:reference.length?correct/reference.length:null}
}
const taskKey=(task: SemanticInput['tasks'][number])=>stableJson([task.action.surface,task.object.surface])
type Category='task'|'requiresAction'|'time'|'material'|'event'|'condition'|'revision'|'evidence'|'semantic'|'coverage'
const categories: Category[]=['task','requiresAction','time','material','event','condition','revision','evidence','semantic','coverage']
async function facts(input: SemanticInput,context: WireContext) {
  const review=await composeSemantics(input,{...context,authority:'live_model_candidate',profile:'real-input-01',ownershipMode:'mainline05-own-assets-1'})
  const result=Object.fromEntries(categories.map(name=>[name,[] as string[]])) as Record<Category,string[]>
  const labels=new Map<string,string>()
  for(const task of input.tasks)labels.set(task.id,'task:'+taskKey(task))
  for(const material of input.materials)labels.set(material.tempId,'material:'+material.name)
  for(const time of input.timePoints)labels.set(time.tempId,'time:'+stableJson([time.type,time.rawText,time.normalizedValue]))
  for(const event of input.events)labels.set(event.tempId,'event:'+event.title)
  // Matching by a non-unique display label cannot prove ownership equivalence.
  // Do not award a complete-case result by independently permuting fact sets.
  const labelCounts=new Map<string,number>()
  for(const label of labels.values())labelCounts.set(label,(labelCounts.get(label)??0)+1)
  const matchingAmbiguities=[...labelCounts].filter(([,count])=>count>1).map(([label])=>label)
  const refs=(ids:string[])=>ids.map(id=>labels.get(id)??'INVALID_REFERENCE:'+id).sort()
  const scopes=(ids:string[])=>ids.map(id=>context.index.scopes.find(s=>s.id===id)?.text??'INVALID_SCOPE:'+id).sort()
  const add=(category:Category,value:unknown)=>result[category].push(stableJson(value))
  for(const task of input.tasks){const key=labels.get(task.id)!,item=review.items.find(i=>i.tempId===task.id)!
    add('task',key);add('requiresAction',[key,item.requiresAction])
    add('condition',[key,task.condition.value,scopes(task.condition.conditionScopeIds),scopes(task.condition.factScopeIds)])
    add('semantic',[key,task.semantics,task.inferenceLevel,task.actionType,task.effect,
      refs(task.detail.dependencyTempIds),refs(task.detail.parentTempId?[task.detail.parentTempId]:[]),task.detail.hierarchyType,
      task.detail.title,task.detail.description,[...task.detail.completionCriteria].sort()])
    add('coverage',[key,task.coverage,refs(task.detail.materialTempIds),refs(task.detail.timePointTempIds),refs(task.eventTempIds)])
    add('evidence',[key,scopes(task.propositionScopeIds),[scopes([task.action.scopeId]),task.action.surface],
      [scopes([task.object.scopeId]),task.object.surface]])
  }
  if(input.tasks.length===0)add('requiresAction',['no-task-source',review.issues.length?'unknown':'false'])
  for(const m of input.materials){add('material',[m.name,m.required,[...m.formatRequirements].sort(),[...m.namingRequirements].sort(),
    m.quantity,m.submissionChannel,refs(m.relatedTaskTempIds)]);add('evidence',[labels.get(m.tempId),scopes(m.scopeIds)])}
  for(const p of input.timePoints){add('time',[p.type,p.rawText,p.normalizedValue,p.timezone,p.isAllDay,p.precision,p.needsConfirmation,
    refs(p.relatedTaskTempIds),refs(p.relatedMaterialTempIds)]);add('evidence',[labels.get(p.tempId),scopes(p.scopeIds)])}
  for(const e of input.events){add('event',[e.title,e.description,e.location,e.inferenceLevel,refs(e.relatedTaskTempIds),
    refs(e.startTimePointTempId?[e.startTimePointTempId]:[]),refs(e.endTimePointTempId?[e.endTimePointTempId]:[])]);add('evidence',[labels.get(e.tempId),scopes(e.scopeIds)])}
  for(const r of input.revisions)add('revision',[r.type,refs([r.targetDirectiveId]),refs(r.fromDirectiveId?[r.fromDirectiveId]:[]),r.effective,scopes(r.scopeIds)])
  for(const conflict of input.conflicts)add('semantic',['conflict',conflict.type,conflict.message,refs(conflict.entityTempIds),conflict.requiresDecision,scopes(conflict.scopeIds)])
  add('coverage',['information',scopes(input.informationScopeIds)]);add('coverage',['unresolved',scopes(input.unresolvedScopeIds)])
  for(const issue of review.issues)add('semantic',['validation',issue.code,refs(issue.entityIds)])
  return {result,review,matchingAmbiguities}
}

/** Exact seen-reference comparison; renamed IDs/order are not semantic errors.
 * Alternative wording or genuinely ambiguous matching requires separate review,
 * not silent reference changes. All candidates count even when unselected. */
export async function scoreSeenResponse(raw: string,context: WireContext,referenceInput: unknown,referenceContext: WireContext) {
  const reference=parseSemanticInput(referenceInput), expected=await facts(reference,referenceContext)
  const first=parseModelEnvelope(raw,context), observed=await facts(first.adaptedResponse,context)
  const metrics=Object.fromEntries(categories.map(category=>[category,countMultiset(observed.result[category],expected.result[category])])) as Record<Category,CountMetric>
  const forbidden=observed.review.items.filter(item=>item.requiresAction==='true'&&reference.tasks.some(task=>
    taskKey(task)===taskKey(first.adaptedResponse.tasks.find(t=>t.id===item.tempId)!)&&expected.review.items.find(i=>i.tempId===task.id)?.requiresAction==='false')).length
  const matchingAmbiguities=[...new Set([...expected.matchingAmbiguities,...observed.matchingAmbiguities])]
  const all=[...Object.values(metrics)],completeCase=matchingAmbiguities.length===0&&all.every(m=>m.falsePositive===0&&m.falseNegative===0)
  // Raw counts remain auditable but ambiguous matching must not advertise 100%.
  if(matchingAmbiguities.length)for(const metric of all){metric.precision=null;metric.recall=null}
  return {scorerVersion:SCORER_VERSION,label:'已见人工工程参考的精确诊断，不是未见或商业准确率',metrics,matchingAmbiguities,
    metricStatus:matchingAmbiguities.length?'MATCHING_REQUIRES_REVIEW':'EXACT_REFERENCE_DIAGNOSTIC',
    schemaParsed:true,issues:observed.review.issues,completeCase,majorCorrectionRequired:!completeCase,
    forbidden,automaticSelection:'NOT_ENABLED',humanActiveEditTime:'NOT_RUN',candidateTaskCount:first.adaptedResponse.tasks.length,
    referenceTaskCount:reference.tasks.length}
}
