import {scoreD25,selectD25} from './d25-scoring.mjs'
import {normalize} from './candidate15-reference-contract.mjs'
export const D26_SCORER='recognition-semantic-display-10.0.0'
export const D26_SELECTOR='d26-layered-development-1'
const aliases=(value,field)=>[field.value??field.canonical,...field.aliases].some(candidate=>normalize(candidate)===normalize(value))
const support=(text,quotes)=>!normalize(text)||text.split(/\n+/u).filter(row=>normalize(row)).every(row=>quotes.some(quote=>normalize(quote).includes(normalize(row))))

/** Structured comparison and displayed prose are separate; no mutation of old scorer or old results. */
export function scoreD26(reference,result,options={}){
  const structural=result?structuredClone(result):result
  // Description is not event existence. Its source support is adjudicated separately below.
  if(structural)for(const event of structural.events)event.description=''
  const base=scoreD25(reference,structural,options),risks=base.risks.filter(row=>row.kind!=='INDEPENDENT_INFORMATION_EVENT_OR_TIME_MISSING'),disputes=[...base.disputes]
  const inheritedRiskCount=risks.length,eventChecks=[],proseChecks=[]
  if(!result||!base.legacy?.auxiliary)return {...base,version:D26_SCORER,structuredCompleteStatus:base.completeStatus,firstDisplayCompleteStatus:base.completeStatus,eventChecks,proseChecks}
  const candidates=reference.representations.filter(rep=>rep.tasks.length===base.legacy.matches?.length)
  const representation=candidates.length===1?candidates[0]:reference.representations.find(rep=>rep.tasks.every(task=>base.legacy.matches?.some(match=>match.expectedId===task.id)))
  if(!representation)return {...base,version:D26_SCORER,completeStatus:'UNKNOWN',structuredCompleteStatus:base.completeStatus,firstDisplayCompleteStatus:'UNKNOWN',disputes:[...disputes,{kind:'DISPLAY_REFERENCE_MAPPING_UNRESOLVED'}],eventChecks,proseChecks}
  const ref=representation,used=new Set(),quote=ids=>ids.flatMap(id=>ref.scopeTextById[id]??[])
  for(const fact of ref.noTaskFacts.filter(row=>row.kind==='event')){
    const event=result.events.find(row=>!used.has(row.tempId)&&aliases(row.title,fact))??result.events.find(row=>!used.has(row.tempId)&&row.scopeIds.some(id=>fact.scopeIds.includes(id)))
    if(!event){eventChecks.push({id:fact.id,presence:false});risks.push({kind:'EVENT_MISSING',factId:fact.id});continue}
    used.add(event.tempId)
    const valueCorrect=aliases(event.title,fact),evidenceSupported=fact.scopeIds.every(id=>event.scopeIds.includes(id))&&event.scopeIds.every(id=>fact.scopeIds.includes(id))
    const contradiction=(reference.d26DisplayPolicy?.eventContradictions??[]).some(text=>normalize(event.description).includes(normalize(text)))
    const proseSupported=support(event.description,quote(fact.scopeIds)),description=contradiction?'CONTRADICTORY':proseSupported?'SUPPORTED':'UNRESOLVED'
    eventChecks.push({id:fact.id,actualId:event.tempId,presence:true,valueCorrect,evidenceSupported,description})
    if(!valueCorrect)risks.push({kind:'EVENT_VALUE_WRONG',factId:fact.id})
    if(!evidenceSupported)risks.push({kind:'EVENT_EVIDENCE_MISSING',factId:fact.id})
    if(contradiction)risks.push({kind:'EVENT_DESCRIPTION_CONTRADICTORY',factId:fact.id})
    else if(!proseSupported)disputes.push({kind:'EVENT_DESCRIPTION_UNRESOLVED',factId:fact.id})
  }
  for(const check of base.legacy.auxiliary.checks.filter(row=>!row.pass&&row.id!=='SYNTHETIC_SOURCE_MARKER')){
    const fact=ref.noTaskFacts.find(row=>row.id===check.id)
    if(fact?.kind==='event'&&eventChecks.some(row=>row.id===fact.id&&(!row.presence||!row.valueCorrect||!row.evidenceSupported)))continue
    risks.push({kind:fact?.kind==='time'?'INDEPENDENT_TIME_WRONG':fact?.kind==='event'?'EVENT_TIME_OR_LOCATION_WRONG':'INDEPENDENT_INFORMATION_MISSING',factId:check.id})
  }
  if(base.legacy.auxiliary.extraEntities||result.events.length>used.size)risks.push({kind:'UNSUPPORTED_INDEPENDENT_ENTITY'})
  for(const match of base.legacy.matches??[]){
    const task=result.tasks.find(row=>row.id===match.actualId),expected=ref.tasks.find(row=>row.id===match.expectedId)
    if(!task||!expected)continue
    const titles=[expected.action.canonical,...expected.action.aliases].flatMap(action=>[expected.object.canonical,...expected.object.aliases].map(object=>normalize(action+object)))
    const titleSupported=titles.includes(normalize(task.detail.title)),descriptionSupported=support(task.detail.description,quote(expected.scopeIds))
    proseChecks.push({expectedId:expected.id,actualId:task.id,titleSupported,description:descriptionSupported?'SUPPORTED':'UNRESOLVED'})
    if(!titleSupported)risks.push({kind:'DISPLAY_TASK_TITLE_WRONG',taskId:expected.id})
    if(!descriptionSupported)disputes.push({kind:'DISPLAY_TASK_DESCRIPTION_UNRESOLVED',taskId:expected.id})
  }
  const completeStatus=risks.length?false:disputes.length?'UNKNOWN':base.completeStatus
  const obligation=id=>{const task=ref.tasks.find(row=>row.id===id);return task?normalize(task.action.canonical)+'|'+normalize(task.object.canonical):id}
  const riskUnits=[...base.riskUnits.filter(unit=>!unit.startsWith('AUX_')),...risks.slice(inheritedRiskCount).map(r=>JSON.stringify([r.kind,r.factId??null,r.taskId?obligation(r.taskId):null,r.field??null,r.role??null]))]
  return {...base,version:D26_SCORER,status:risks.length?'FACT_RISK':disputes.length?'REFERENCE_DISPUTE':'SCORED',risks,disputes,riskUnits,completeStatus,structuredCompleteStatus:base.completeStatus,firstDisplayCompleteStatus:completeStatus,eventChecks,proseChecks,rawProseAdjudication:'SOURCE_SUPPORTED_OR_EXPLICITLY_UNRESOLVED',humanTruth:'PROVISIONAL'}
}
export function selectD26(pairs,denominator=8){return {...selectD25(pairs,denominator),version:D26_SELECTOR}}
