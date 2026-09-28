// D12 diagnostic fork: only fixes the zero-match assignment crash.
// Legacy semantic rules remain; this is not a new validated quality contract.
import {canonical,normalize,validateCandidate15Reference} from './candidate15-reference-contract.mjs'

export const CANDIDATE15_SCORER_VERSION='candidate15-scoring-6.0.1-diagnostic'
const variants=field=>[field.canonical,...field.aliases].map(normalize)
const equivalent=(actual,field)=>variants(field).includes(normalize(actual))
const currentness=task=>task.semantics?.status==='cancelled'?'cancelled':task.semantics?.validity==='superseded'?'superseded':task.semantics?.tense==='past'||task.semantics?.status==='completed'?'historical':task.semantics?.validity==='uncertain'?'unknown':'current'
const actionable=task=>task.semantics?.polarity==='negative'||['cancelled','completed'].includes(task.semantics?.status)||task.semantics?.validity==='superseded'||task.condition?.value==='false'?'not_actionable':task.condition?.value==='unknown'?'needs_confirmation':'actionable'
const selection=task=>actionable(task)==='actionable'&&task.inferenceLevel==='explicit'?'selected':'not_selected'
const confirmation=task=>task.detail?.userConfirmationRequired===true?'required':'not_required'
const scalar=(expected,actual)=>({applicable:true,pass:expected===actual,expected,actual})
const expectedList=value=>value==='N/A'?[]:value
const multiset=value=>value.map(normalize).filter(Boolean).sort()
const strictList=(expected,actual)=>{const e=multiset(expectedList(expected)),a=multiset(actual);return {applicable:true,pass:canonical(e)===canonical(a),expected:e,actual:a}}
const timeList=value=>value==='N/A'?[]:value.map(row=>canonical({type:row.type,rawText:normalize(row.rawText),normalizedValue:row.normalizedValue,timezone:row.timezone,isAllDay:row.isAllDay,precision:row.precision,needsConfirmation:row.needsConfirmation})).sort()
const actualTimeList=(ids,result)=>(result.timePoints??[]).filter(row=>ids.has(row.tempId)).map(row=>canonical({type:row.type,rawText:normalize(row.rawText),normalizedValue:row.normalizedValue,timezone:row.timezone,isAllDay:row.isAllDay,precision:row.precision,needsConfirmation:row.needsConfirmation})).sort()
const materialFacts=(ids,result,objectField)=>(result.materials??[]).filter(row=>ids.has(row.tempId)).flatMap(row=>[equivalent(row.name,objectField)?'':row.name,...(row.formatRequirements??[]),...(row.namingRequirements??[]),row.submissionChannel??'']).filter(value=>normalize(value))
function taskCheck(expected,actual,result,dependencyIds=[]){
  const materialIds=new Set(actual.detail?.materialTempIds??[]),timeIds=new Set(actual.detail?.timePointTempIds??[])
  const materialRows=(result.materials??[]).filter(row=>materialIds.has(row.tempId)),timeRows=(result.timePoints??[]).filter(row=>timeIds.has(row.tempId))
  const materialRefsPass=materialRows.length===materialIds.size&&(expected.materials!=='N/A'||materialIds.size===0),timeRefsPass=timeRows.length===timeIds.size
  const fields={action:{applicable:true,pass:equivalent(actual.action?.surface,expected.action)},actionScopeIds:strictList(expected.actionScopeIds,[actual.action?.scopeId].filter(Boolean)),object:{applicable:true,pass:equivalent(actual.object?.surface,expected.object)},objectScopeIds:strictList(expected.objectScopeIds,[actual.object?.scopeId].filter(Boolean)),existence:scalar('present','present'),actor:scalar(expected.actor,actual.semantics?.actor),speechAct:scalar('directive',actual.semantics?.speechAct),modality:scalar(expected.actionability==='actionable'?'required':'informational',actual.semantics?.modality),currentness:scalar(expected.currentness,currentness(actual)),condition:scalar(expected.condition,actual.condition?.value),conditionScopeIds:strictList(expected.conditionScopeIds,actual.condition?.conditionScopeIds??[]),factScopeIds:strictList(expected.factScopeIds,actual.condition?.factScopeIds??[]),actionability:scalar(expected.actionability,actionable(actual)),defaultSelection:scalar(expected.defaultSelection,selection(actual)),confirmation:scalar(expected.confirmation,confirmation(actual)),scopeIds:strictList(expected.scopeIds,actual.propositionScopeIds??[]),materialRefs:scalar(true,materialRefsPass),materials:strictList(expected.materials,materialFacts(materialIds,result,expected.object)),timeRefs:scalar(true,timeRefsPass),times:{applicable:true,pass:canonical(timeList(expected.times))===canonical(actualTimeList(timeIds,result)),expected:timeList(expected.times),actual:actualTimeList(timeIds,result)},completionStandards:strictList(expected.completionStandards,actual.detail?.completionCriteria??[]),dependencies:strictList(expected.dependencies,dependencyIds)}
  return {pass:Object.values(fields).every(row=>row.pass===true),fields}
}
function assignments(expected,actual,index=0,used=new Set(),rows=[],out=[]){
  if(index===expected.length){out.push([...rows]);return out}
  rows.push(null);assignments(expected,actual,index+1,used,rows,out);rows.pop()
  for(let i=0;i<actual.length;i++)if(!used.has(i)&&equivalent(actual[i].action?.surface,expected[index].action)&&equivalent(actual[i].object?.surface,expected[index].object)){used.add(i);rows.push(i);assignments(expected,actual,index+1,used,rows,out);rows.pop();used.delete(i)}
  return out
}
const rank=row=>[row.matches,-row.falsePositives]
const better=(a,b)=>{const x=rank(a),y=rank(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]>y[i];return false}
const emptyFailure=(status,reference)=>({version:CANDIDATE15_SCORER_VERSION,status,complete:false,severity:{severe:1,major:0,forbidden:0},taskMetrics:{tp:0,fp:0,fn:reference?.tasks?.length??0},matches:[]})
const relationKey=(relation,expectedToActual=null)=>canonical({type:relation.type,targetDirectiveId:expectedToActual?expectedToActual.get(relation.targetTaskId):relation.targetDirectiveId,fromDirectiveId:expectedToActual?(relation.fromTaskId===null?null:expectedToActual.get(relation.fromTaskId)):relation.fromDirectiveId,effective:relation.effective})
function scoreNoTaskFacts(reference,result){
  const eventFacts=reference.noTaskFacts.filter(row=>row.kind==='event'),timeFacts=reference.noTaskFacts.filter(row=>row.kind==='time'),locationFacts=reference.noTaskFacts.filter(row=>row.kind==='location')
  const actualEvents=result.events??[],actualTimes=(result.timePoints??[]).filter(row=>(row.relatedTaskTempIds??[]).length===0)
  const coverage=new Set([...(result.informationScopeIds??[]),...actualEvents.flatMap(row=>row.scopeIds??[]),...actualTimes.flatMap(row=>row.scopeIds??[])])
  const containsScopes=(row,fact)=>fact.scopeIds.every(id=>(row.scopeIds??[]).includes(id))
  const values=fact=>[fact.value,...fact.aliases].map(normalize)
  const byId=new Map(reference.noTaskFacts.map(row=>[row.id,row])),matchesFact=(value,fact)=>values(fact).includes(normalize(value))
  const timeMatches=(row,fact)=>Boolean(row&&fact&&matchesFact(row.rawText,fact)&&containsScopes(row,fact)&&canonical({type:row.type,normalizedValue:row.normalizedValue,timezone:row.timezone,precision:row.precision,isAllDay:row.isAllDay,needsConfirmation:row.needsConfirmation})===canonical({type:fact.time.type,normalizedValue:fact.time.normalizedValue,timezone:fact.time.timezone,precision:fact.time.precision,isAllDay:fact.time.isAllDay,needsConfirmation:fact.time.needsConfirmation})&&(row.relatedTaskTempIds??[]).length===0)
  const checks=reference.noTaskFacts.map(fact=>{
    let pass=fact.scopeIds.every(id=>coverage.has(id))
    if(fact.kind==='event')pass=pass&&actualEvents.some(row=>{
      const start=(result.timePoints??[]).find(time=>time.tempId===row.startTimePointTempId)
      const end=(result.timePoints??[]).find(time=>time.tempId===row.endTimePointTempId)
      const expectedTimes=fact.timeFactIds.map(id=>byId.get(id))
      const startFact=expectedTimes.find(time=>time.time.type==='event_start')
      const endFact=expectedTimes.find(time=>time.time.type==='event_end')
      return matchesFact(row.title,fact)&&normalize(row.description??'')===''&&containsScopes(row,fact)
        &&(startFact?timeMatches(start,startFact):!start)
        &&(endFact?timeMatches(end,endFact):!end)
        &&fact.locationFactIds.every(id=>matchesFact(row.location,byId.get(id)))
        &&(fact.locationFactIds.length>0||!normalize(row.location))
        &&(row.relatedTaskTempIds??[]).length===0
    })
    if(fact.kind==='time')pass=pass&&actualTimes.some(row=>timeMatches(row,fact))
    if(fact.kind==='location')pass=pass&&actualEvents.some(row=>matchesFact(row.location,fact)&&containsScopes(row,fact))
    if(fact.kind==='information')pass=pass&&fact.scopeIds.every(id=>(result.informationScopeIds??[]).includes(id))
    return {...fact,pass}
  })
  const nonActionableScopes=reference.tasks.filter(row=>row.actionability!=='actionable').flatMap(row=>row.scopeIds)
  const expectedCoverage=new Set([...reference.noTaskFacts.flatMap(row=>row.scopeIds),...nonActionableScopes]),expectedTopLevel=new Set([...reference.noTaskFacts.flatMap(row=>row.scopeIds),...nonActionableScopes]),actualTopLevel=new Set([...(result.informationScopeIds??[]),...(result.unresolvedScopeIds??[])])
  const actualLocations=actualEvents.filter(row=>normalize(row.location)),locationAssignments=assignments(locationFacts.map(row=>({action:{canonical:row.value,aliases:row.aliases},object:{canonical:'',aliases:[]}})),actualLocations.map(value=>({action:{surface:value.location},object:{surface:''}}))),exactLocations=locationAssignments.some(map=>map.every(v=>v!==null)&&new Set(map).size===actualLocations.length)&&actualLocations.length===locationFacts.length
  const exactCounts=actualEvents.length===eventFacts.length&&actualTimes.length===timeFacts.length,exactCoverage=canonical([...coverage].sort())===canonical([...expectedCoverage].sort()),exactTopLevel=canonical([...actualTopLevel].sort())===canonical([...expectedTopLevel].sort())
  return {pass:checks.every(row=>row.pass)&&exactCounts&&exactLocations&&exactCoverage&&exactTopLevel&&(result.unresolvedScopeIds??[]).length===0,checks,exactCounts,exactLocations,exactCoverage,exactTopLevel,unresolvedCount:(result.unresolvedScopeIds??[]).length}
}
export function scoreCandidate15Diagnostic(referenceInput,result,{schemaValid=true,referenceValid=true}={}){
  let reference;try{reference=validateCandidate15Reference(referenceInput)}catch{return emptyFailure('SCHEMA_OR_REFERENCE_FAILURE',referenceInput)}
  if(reference.completeness!=='complete')return {version:CANDIDATE15_SCORER_VERSION,status:'PARTIAL_REFERENCE',complete:false,severity:{severe:0,major:null,forbidden:null},taskMetrics:{tp:null,fp:null,fn:null},matches:[]}
  if(!schemaValid||!referenceValid||!result)return emptyFailure('SCHEMA_OR_REFERENCE_FAILURE',reference)
  const actual=result.tasks??[],candidates=assignments(reference.tasks,actual),evaluated=candidates.map(map=>({map,matches:map.filter(v=>v!==null).length,falsePositives:actual.length-new Set(map.filter(v=>v!==null)).size})),best=evaluated.reduce((a,b)=>better(b,a)?b:a,evaluated[0])
  const tied=evaluated.filter(row=>rank(row).every((v,i)=>v===rank(best)[i]));if(tied.length>1&&new Set(tied.map(row=>JSON.stringify(row.map))).size>1)return {version:CANDIDATE15_SCORER_VERSION,status:'ADJUDICATION_REQUIRED',complete:false,severity:{severe:0,major:1,forbidden:0},taskMetrics:{tp:0,fp:best.falsePositives,fn:reference.tasks.length-best.matches},matches:[]}
  const expectedToActual=new Map(reference.tasks.map((task,i)=>[task.id,best.map[i]===null?null:actual[best.map[i]].id])),checks=best.map.map((idx,i)=>{const expected=reference.tasks[i],mapped=expectedList(expected.dependencies).map(id=>expectedToActual.get(id)).filter(Boolean);return idx===null?null:taskCheck({...expected,dependencies:mapped},actual[idx],result,actual[idx].detail?.dependencyTempIds??[])})
  const matches=reference.tasks.map((task,i)=>({expectedId:task.id,actualIndex:best.map[i],check:checks[i]})),fn=best.map.filter(v=>v===null).length,fp=best.falsePositives,major=matches.filter(row=>row.actualIndex!==null&&!row.check?.pass).length,tp=matches.filter(row=>row.check?.pass).length
  const expectedRelations=reference.relations.map(row=>relationKey(row,expectedToActual)).sort(),actualRelations=(result.revisions??[]).map(row=>relationKey(row)).sort(),relationsPass=canonical(expectedRelations)===canonical(actualRelations)
  const forbidden=actual.filter((task,index)=>actionable(task)==='actionable'&&!best.map.includes(index)).length
  const noTaskFacts=scoreNoTaskFacts(reference,result),referencedMaterials=new Set(actual.flatMap(task=>task.detail?.materialTempIds??[])),referencedTimes=new Set(actual.flatMap(task=>task.detail?.timePointTempIds??[])),orphanEntities=(result.materials??[]).filter(row=>!referencedMaterials.has(row.tempId)).length+(result.timePoints??[]).filter(row=>!referencedTimes.has(row.tempId)&&!((row.relatedTaskTempIds??[]).length===0&&reference.noTaskFacts.some(f=>f.kind==='time'&&normalize(f.value)===normalize(row.rawText)))).length
  const auxiliaryPass=noTaskFacts.pass&&orphanEntities===0&&(result.conflicts??[]).length===0
  return {version:CANDIDATE15_SCORER_VERSION,status:'SCORED',complete:fn===0&&fp===0&&major===0&&forbidden===0&&relationsPass&&auxiliaryPass,severity:{severe:0,major:major+(relationsPass?0:1)+(auxiliaryPass?0:1),forbidden},taskMetrics:{tp,fp,fn},noTaskFacts,relationsPass,orphanEntities,matches}
}
export function aggregateCandidate15Diagnostic(rows){
  const sum=(items,key)=>items.every(r=>Number.isFinite(r.severity?.[key]))?items.reduce((n,r)=>n+r.severity[key],0):null,task=key=>rows.every(r=>Number.isFinite(r.taskMetrics?.[key]))?rows.reduce((n,r)=>n+r.taskMetrics[key],0):null
  return {version:CANDIDATE15_SCORER_VERSION,sources:rows.length,scored:rows.filter(r=>r.status==='SCORED').length,failed:rows.filter(r=>r.status!=='SCORED').length,completeSources:rows.filter(r=>r.status==='SCORED'&&r.complete).length,severity:{severe:sum(rows,'severe'),major:sum(rows,'major'),forbidden:sum(rows,'forbidden')},taskMetrics:{tp:task('tp'),fp:task('fp'),fn:task('fn')}}
}
