import {scoreSemanticV8} from './recognition-semantic-v8.mjs'
import {scopeSupport} from './recognition-semantic-v7.mjs'
import {normalize} from './candidate15-reference-contract.mjs'
export const D25_SCORER='recognition-semantic-development-9.0.0'
export const D25_SELECTOR='d25-layered-development-1'
/** Calibrated new Development contract. V7/V8 and original scores remain immutable. */
export function scoreD25(reference,result,options={}){
  const base=scoreSemanticV8(reference,result,options),risks=[...base.risks]
  if(result)for(const task of result.tasks){
    if(['true','false'].includes(task.condition.value)&&!task.condition.factScopeIds.length)risks.push({kind:'UNSUPPORTED_CONDITION_TRUTH',taskId:task.id})
    for(const id of task.detail.dependencyTempIds)if(!result.tasks.some(t=>t.id===id))risks.push({kind:'DEPENDENCY_ENDPOINT_MISSING',taskId:task.id})
    for(const [field,state] of Object.entries(task.coverage))if(['unresolved','not_extracted'].includes(state))risks.push({kind:'UNRESOLVED_COVERAGE',taskId:task.id,field})
  }
  if(result&&base.status!=='REFERENCE_MAPPING_UNRESOLVED')for(const material of result.materials){
    const policies=reference.representations.flatMap(v=>v.tasks.flatMap(t=>t.materialDetails)).filter(m=>normalize(m.name)===normalize(material.name)).map(m=>m.evidencePolicy)
    if(policies.length&&!policies.some(p=>{const support=scopeSupport(p,material.scopeIds);return !support.missing.length&&!support.contradictory.length}))risks.push({kind:'MATERIAL_EVIDENCE_MISSING',material:material.name})
  }
  const completeStatus=risks.length?false:base.disputes.length||base.status==='NOT_SCOREABLE'||base.status==='REFERENCE_MAPPING_UNRESOLVED'?'UNKNOWN':reference.completeness==='complete'?true:'UNKNOWN'
  const obligationIds=new Map(reference.representations.flatMap(v=>v.tasks.map(t=>[t.id,normalize(t.action.canonical)+'|'+normalize(t.object.canonical)])))
  for(const match of base.legacy.matches??[])if(match.actualId&&obligationIds.has(match.expectedId))obligationIds.set(match.actualId,obligationIds.get(match.expectedId))
  const riskUnits=risks.flatMap(r=>{
    const actualIdentity=t=>normalize(t.action.surface)+'|'+normalize(t.object.surface)
    if(r.kind==='TASK_PRESENCE'){
      const matched=new Set((base.legacy.matches??[]).map(m=>m.actualId).filter(Boolean))
      return [...(base.legacy.matches??[]).filter(m=>!m.actualId).map(m=>'FN:'+obligationIds.get(m.expectedId)),...result.tasks.filter(t=>!matched.has(t.id)).map(t=>'FP:'+actualIdentity(t))]
    }
    if(r.kind==='FORBIDDEN_ACTION')return (base.legacy.forbiddenTaskIds??[]).map(id=>'FORBIDDEN:'+actualIdentity(result.tasks.find(t=>t.id===id)))
    if(r.kind==='INDEPENDENT_INFORMATION_EVENT_OR_TIME_MISSING')return [...(r.checks??[]).map(c=>'AUX_FACT:'+c.id),...(r.extraEntities?['AUX_EXTRA:'+JSON.stringify([result.events.map(e=>[e.title,e.location,e.scopeIds]),result.timePoints.filter(p=>!p.relatedTaskTempIds.length).map(p=>[p.type,p.rawText,p.normalizedValue]),result.materials.filter(m=>!m.relatedTaskTempIds.length).map(m=>m.name)])]:[])]
    const identity=r.taskId?obligationIds.get(r.taskId):null
    if(r.taskId&&!identity)return ['UNMAPPED_RISK_IDENTITY']
    const key=JSON.stringify([r.kind,r.field??null,r.role??null,identity,normalize(r.material??'')])
    return [key]
  })
  return {...base,version:D25_SCORER,risks,riskUnits,completeStatus,riskIdentityStatus:riskUnits.includes('UNMAPPED_RISK_IDENTITY')?'UNKNOWN':'MAPPED',rawProseAdjudication:'NOT_ADJUDICATED',humanTruth:'PROVISIONAL'}
}
export function selectD25(pairs,plannedDenominator=8){
  const denominator=plannedDenominator,unknown=pairs.filter(p=>![true,false].includes(p.A?.completeStatus)||![true,false].includes(p.B?.completeStatus)||p.A?.riskIdentityStatus==='UNKNOWN'||p.B?.riskIdentityStatus==='UNKNOWN').length+Math.max(0,plannedDenominator-pairs.length)
  const improved=pairs.filter(p=>p.A?.completeStatus===false&&p.B?.completeStatus===true).length,regressed=pairs.filter(p=>p.A?.completeStatus===true&&p.B?.completeStatus===false).length
  const riskRegressions=pairs.filter(p=>{const counts=s=>(s?.riskUnits??(s?.risks??[]).map(r=>JSON.stringify([r.kind,r.field??null,r.role??null]))).reduce((m,key)=>{m.set(key,(m.get(key)??0)+1);return m},new Map());const a=counts(p.A),b=counts(p.B);return [...b].some(([key,n])=>n>(a.get(key)??0))})
  const errors=pairs.reduce((sum,p)=>sum+(p.A?.risks?.length??0)-(p.B?.risks?.length??0),0)
  return {version:D25_SELECTOR,denominator,observedPairs:pairs.length,improved,regressed,netWhole:improved-regressed,unknown,riskRegressions:riskRegressions.map(p=>p.sourceId),status:unknown||pairs.length!==plannedDenominator||new Set(pairs.map(p=>p.sourceId)).size!==pairs.length?'EVIDENCE_INCOMPLETE':riskRegressions.length||improved&&regressed?'MIXED_PROGRESS':improved>regressed?'DEVELOPMENT_IMPROVEMENT_OBSERVED':errors>0?'TARGETED_PROGRESS':'NO_IMPROVEMENT',scope:'PROVISIONAL_SEEN_DEVELOPMENT_NOT_HOLDOUT'}
}
