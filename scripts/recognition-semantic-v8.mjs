import {canonical,normalize} from './candidate15-reference-contract.mjs'
import {scoreSemanticV7,scopeSupport} from './recognition-semantic-v7.mjs'

export const SCORER_V8='recognition-semantic-diagnostic-8.0.0'
const equal=(a,b)=>canonical(a)===canonical(b)
const signature=point=>({type:point.type,value:point.normalizedValue,precision:point.precision,needsConfirmation:point.needsConfirmation})
const field=(score,name)=>score.fieldErrors?.filter(row=>row.field===name)??[]

/** V8 is a new, conservative diagnostic. Ambiguous representation never becomes a free pass. */
export function scoreSemanticV8(reference,result,options={}){
  const legacy=scoreSemanticV7(reference,result,options)
  if(legacy.status!=='SCORED')return {version:SCORER_V8,status:'NOT_SCOREABLE',completeStatus:'UNKNOWN',legacy,risks:[],disputes:[legacy.status]}
  const scoreSignature=score=>canonical({matches:score.matches,fieldErrors:score.fieldErrors,relationsPass:score.relationsPass,auxiliary:score.auxiliary,complete:score.complete})
  const alternatives=reference.representations.filter(variant=>{
    const scored=scoreSemanticV7({...reference,representations:[variant]},result,options)
    return scored.status==='SCORED'&&scoreSignature(scored)===scoreSignature(legacy)
  })
  if(alternatives.length!==1)return {version:SCORER_V8,status:'REFERENCE_MAPPING_UNRESOLVED',completeStatus:'UNKNOWN',legacy,risks:[],disputes:[{kind:'REPRESENTATION_MAPPING_UNRESOLVED',alternatives:alternatives.length}]}
  const best=alternatives[0]
  const matched=new Map(legacy.matches.filter(row=>row.actualId).map(row=>[row.expectedId,row.actualId]))
  const risks=[],disputes=[]
  for(const error of legacy.fieldErrors){
    const task=best.tasks.find(row=>row.id===error.expectedId),actual=result.tasks.find(row=>row.id===error.actualId)
    if(error.field.endsWith('Scopes')){
      const role=error.field==='propositionScopes'?'proposition':error.field==='conditionScopes'?'condition':'fact'
      const support=scopeSupport(task.evidencePolicy[role],role==='proposition'?actual.propositionScopeIds:role==='condition'?actual.condition.conditionScopeIds:actual.condition.factScopeIds)
      // An omitted required evidence group or a contradiction is a real link failure.
      if(support.missing.length||support.contradictory.length)risks.push({kind:'EVIDENCE_MISSING_OR_CONTRADICTORY',taskId:task.id,role})
      else if(!support.unrelated.every(id=>task.scopeIds.includes(id)))disputes.push({kind:'SUPPORTING_SCOPE_NOT_ADJUDICATED',taskId:task.id,role,scopeIds:support.unrelated})
      continue
    }
    if(error.field==='times'&&task&&actual){
      const actualPoints=result.timePoints.filter(point=>actual.detail.timePointTempIds.includes(point.tempId))
      const expectedPoints=task.times==='N/A'?[]:task.times
      const sameValues=actualPoints.length===expectedPoints.length&&actualPoints.every(point=>expectedPoints.some(expected=>equal({...signature(point),type:undefined},{...signature(expected),type:undefined})))
      if(sameValues)disputes.push({kind:'TIME_TYPE_OR_RAW_BOUNDARY_NOT_ADJUDICATED',taskId:task.id})
      else risks.push({kind:'TIME_VALUE_OR_COVERAGE_WRONG',taskId:task.id})
      continue
    }
    if(error.field==='materialDetails'&&task&&actual){
      const actualMaterials=result.materials.filter(row=>actual.detail.materialTempIds.includes(row.tempId))
      const expectedMaterials=task.materialDetails
      const sameValues=actualMaterials.length===expectedMaterials.length&&expectedMaterials.every(e=>actualMaterials.some(a=>normalize(a.name)===normalize(e.name)&&a.required===e.required&&a.quantity===e.quantity&&equal(a.formatRequirements,e.formatRequirements)&&equal(a.namingRequirements,e.namingRequirements)&&normalize(a.submissionChannel)===normalize(e.submissionChannel)))
      const sameTaskEvidence=actualMaterials.every(material=>material.scopeIds.every(id=>task.scopeIds.includes(id))&&material.relatedTaskTempIds.includes(actual.id))
      if(sameValues&&sameTaskEvidence)continue
      if(sameValues)disputes.push({kind:'MATERIAL_EVIDENCE_OR_VIEW_NOT_ADJUDICATED',taskId:task.id})
      else risks.push({kind:'MATERIAL_FACT_WRONG',taskId:task.id})
      continue
    }
    risks.push({kind:'TASK_FIELD_WRONG',taskId:error.expectedId,field:error.field})
  }
  if(legacy.taskPresence.fn||legacy.taskPresence.fp)risks.push({kind:'TASK_PRESENCE',fn:legacy.taskPresence.fn,fp:legacy.taskPresence.fp})
  const relationFacts=best.relations.map(r=>({type:r.type,target:matched.get(r.targetTaskId),from:r.fromTaskId===null?null:matched.get(r.fromTaskId),effective:r.effective}))
  const actualRelations=result.revisions.map(r=>({type:r.type,target:r.targetDirectiveId,from:r.fromDirectiveId,effective:r.effective}))
  const relationFactsPass=relationFacts.length===actualRelations.length&&relationFacts.every(expected=>actualRelations.some(actual=>equal(actual,expected)))
  if(!relationFactsPass)risks.push({kind:'REVISION_FACT_OR_ENDPOINT_WRONG'})
  else if(!legacy.relationsPass)disputes.push({kind:'REVISION_EVIDENCE_NOT_ADJUDICATED'})
  for(const task of result.tasks)for(const pointId of task.detail.timePointTempIds){const point=result.timePoints.find(row=>row.tempId===pointId);if(!point||!point.relatedTaskTempIds.includes(task.id))risks.push({kind:'TIME_GRAPH_CONFLICT',taskId:task.id,pointId})}
  for(const point of result.timePoints)for(const taskId of point.relatedTaskTempIds){const task=result.tasks.find(row=>row.id===taskId);if(!task||!task.detail.timePointTempIds.includes(point.tempId))risks.push({kind:'TIME_GRAPH_CONFLICT',taskId,pointId:point.tempId})}
  if(!legacy.auxiliary.pass){
    const missingUserFacts=legacy.auxiliary.checks.filter(row=>!row.pass&&row.id!=='SYNTHETIC_SOURCE_MARKER')
    if(missingUserFacts.length||legacy.auxiliary.extraEntities)risks.push({kind:'INDEPENDENT_INFORMATION_EVENT_OR_TIME_MISSING',checks:missingUserFacts,extraEntities:legacy.auxiliary.extraEntities})
    else disputes.push({kind:'INFORMATION_COVERAGE_OR_METADATA_SCOPE_NOT_ADJUDICATED'})
  }
  if(legacy.severity.forbidden)risks.push({kind:'FORBIDDEN_ACTION',count:legacy.severity.forbidden})
  const completeStatus=risks.length?false:disputes.length?'UNKNOWN':legacy.complete
  const matchedObligations=best.tasks.filter(task=>matched.has(task.id)&&task.actionability==='actionable').map(task=>normalize(task.action.canonical)+'|'+normalize(task.object.canonical)).sort()
  return {version:SCORER_V8,status:risks.length?'FACT_RISK':disputes.length?'REFERENCE_DISPUTE':'SCORED',completeStatus,relationFactsPass,risks,disputes,taskPresence:legacy.taskPresence,matchedObligations,legacy}
}
