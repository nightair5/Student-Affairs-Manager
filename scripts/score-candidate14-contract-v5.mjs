import {CANDIDATE14_SCORER_VERSION,canonical,normalize,validateCandidate14Reference} from './candidate14-reference-contract.mjs'

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
  const fields={action:{applicable:true,pass:equivalent(actual.action?.surface,expected.action)},object:{applicable:true,pass:equivalent(actual.object?.surface,expected.object)},existence:scalar('present','present'),actor:scalar(expected.actor,actual.semantics?.actor),speechAct:scalar('directive',actual.semantics?.speechAct),modality:scalar(expected.actionability==='actionable'?'required':'informational',actual.semantics?.modality),currentness:scalar(expected.currentness,currentness(actual)),condition:scalar(expected.condition,actual.condition?.value),actionability:scalar(expected.actionability,actionable(actual)),defaultSelection:scalar(expected.defaultSelection,selection(actual)),confirmation:scalar(expected.confirmation,confirmation(actual)),scopeIds:strictList(expected.scopeIds,actual.propositionScopeIds??[]),materialRefs:scalar(true,materialRefsPass),materials:strictList(expected.materials,materialFacts(materialIds,result,expected.object)),timeRefs:scalar(true,timeRefsPass),times:{applicable:true,pass:canonical(timeList(expected.times))===canonical(actualTimeList(timeIds,result)),expected:timeList(expected.times),actual:actualTimeList(timeIds,result)},completionStandards:strictList(expected.completionStandards,actual.detail?.completionCriteria??[]),dependencies:strictList(expected.dependencies,dependencyIds)}
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
const emptyFailure=(status,reference)=>({version:CANDIDATE14_SCORER_VERSION,status,complete:false,severity:{severe:1,major:0,forbidden:0},taskMetrics:{tp:0,fp:0,fn:reference?.tasks?.length??0},matches:[]})
const relationKey=(relation,expectedToActual=null)=>canonical({type:relation.type,targetDirectiveId:expectedToActual?expectedToActual.get(relation.targetTaskId):relation.targetDirectiveId,fromDirectiveId:expectedToActual?(relation.fromTaskId===null?null:expectedToActual.get(relation.fromTaskId)):relation.fromDirectiveId,effective:relation.effective})
function scoreNoTaskFacts(reference,result){
  const coverage=new Set([...(result.informationScopeIds??[]),...(result.unresolvedScopeIds??[]),...(result.events??[]).flatMap(row=>row.scopeIds??[]),...(result.timePoints??[]).flatMap(row=>row.scopeIds??[])])
  const eventFacts=reference.noTaskFacts.filter(row=>row.kind==='event'),timeFacts=reference.noTaskFacts.filter(row=>row.kind==='time')
  const actualEvents=result.events??[],actualTimes=(result.timePoints??[]).filter(row=>(row.relatedTaskTempIds??[]).length===0)
  const containsScopes=(row,fact)=>fact.scopeIds.every(id=>(row.scopeIds??[]).includes(id))
  const checks=reference.noTaskFacts.map(fact=>{let pass=fact.scopeIds.every(id=>coverage.has(id));if(fact.kind==='event')pass=pass&&actualEvents.some(row=>normalize(row.title)===normalize(fact.value)&&containsScopes(row,fact));if(fact.kind==='time')pass=pass&&actualTimes.some(row=>normalize(row.rawText)===normalize(fact.value)&&containsScopes(row,fact));if(fact.kind==='location')pass=pass&&actualEvents.some(row=>normalize(row.location)===normalize(fact.value)&&containsScopes(row,fact));if(['prohibition','quoted_third_party_directive','pending_announcement','information'].includes(fact.kind))pass=pass&&fact.scopeIds.every(id=>(result.informationScopeIds??[]).includes(id)||(result.unresolvedScopeIds??[]).includes(id));return {...fact,pass}})
  const expectedCoverage=new Set(reference.noTaskFacts.flatMap(row=>row.scopeIds)),expectedTopLevel=new Set(reference.noTaskFacts.filter(row=>!['event','time','location'].includes(row.kind)).flatMap(row=>row.scopeIds)),actualTopLevel=new Set([...(result.informationScopeIds??[]),...(result.unresolvedScopeIds??[])])
  const exactCounts=actualEvents.length===eventFacts.length&&actualTimes.length===timeFacts.length,exactCoverage=canonical([...coverage].sort())===canonical([...expectedCoverage].sort()),exactTopLevel=canonical([...actualTopLevel].sort())===canonical([...expectedTopLevel].sort())
  return {pass:checks.every(row=>row.pass)&&exactCounts&&exactCoverage&&exactTopLevel,checks,exactCounts,exactCoverage,exactTopLevel}
}
export function scoreCandidate14(referenceInput,result,{schemaValid=true,referenceValid=true}={}){
  let reference;try{reference=validateCandidate14Reference(referenceInput)}catch{return emptyFailure('SCHEMA_OR_REFERENCE_FAILURE',referenceInput)}
  if(!schemaValid||!referenceValid||!result)return emptyFailure('SCHEMA_OR_REFERENCE_FAILURE',reference)
  const actual=result.tasks??[],candidates=assignments(reference.tasks,actual),evaluated=candidates.map(map=>({map,matches:map.filter(v=>v!==null).length,falsePositives:actual.length-new Set(map.filter(v=>v!==null)).size})),best=evaluated.reduce((a,b)=>better(b,a)?b:a,{map:[],matches:0,falsePositives:actual.length})
  const tied=evaluated.filter(row=>rank(row).every((v,i)=>v===rank(best)[i]));if(tied.length>1&&new Set(tied.map(row=>JSON.stringify(row.map))).size>1)return {version:CANDIDATE14_SCORER_VERSION,status:'ADJUDICATION_REQUIRED',complete:false,severity:{severe:0,major:1,forbidden:0},taskMetrics:{tp:0,fp:best.falsePositives,fn:reference.tasks.length-best.matches},matches:[]}
  const expectedToActual=new Map(reference.tasks.map((task,i)=>[task.id,best.map[i]===null?null:actual[best.map[i]].id])),checks=best.map.map((idx,i)=>{const expected=reference.tasks[i],mapped=expectedList(expected.dependencies).map(id=>expectedToActual.get(id)).filter(Boolean);return idx===null?null:taskCheck({...expected,dependencies:mapped},actual[idx],result,actual[idx].detail?.dependencyTempIds??[])})
  const matches=reference.tasks.map((task,i)=>({expectedId:task.id,actualIndex:best.map[i],check:checks[i]})),fn=best.map.filter(v=>v===null).length,fp=best.falsePositives,major=matches.filter(row=>row.actualIndex!==null&&!row.check?.pass).length,tp=matches.filter(row=>row.check?.pass).length
  const expectedRelations=reference.relations.map(row=>relationKey(row,expectedToActual)).sort(),actualRelations=(result.revisions??[]).map(row=>relationKey(row)).sort(),relationsPass=canonical(expectedRelations)===canonical(actualRelations)
  const forbidden=actual.filter((task,index)=>actionable(task)==='actionable'&&!best.map.includes(index)).length
  const noTaskFacts=scoreNoTaskFacts(reference,result),referencedMaterials=new Set(actual.flatMap(task=>task.detail?.materialTempIds??[])),referencedTimes=new Set(actual.flatMap(task=>task.detail?.timePointTempIds??[])),orphanEntities=(result.materials??[]).filter(row=>!referencedMaterials.has(row.tempId)).length+(result.timePoints??[]).filter(row=>!referencedTimes.has(row.tempId)&&!reference.noTaskFacts.some(f=>f.kind==='time'&&normalize(f.value)===normalize(row.rawText))).length
  const auxiliaryPass=noTaskFacts.pass&&orphanEntities===0&&(result.conflicts??[]).length===0
  return {version:CANDIDATE14_SCORER_VERSION,status:'SCORED',complete:fn===0&&fp===0&&major===0&&forbidden===0&&relationsPass&&auxiliaryPass,severity:{severe:0,major:major+(relationsPass?0:1)+(auxiliaryPass?0:1),forbidden},taskMetrics:{tp,fp,fn},noTaskFacts,relationsPass,orphanEntities,matches}
}
export function aggregateCandidate14(rows){
  const sum=(items,key)=>items.reduce((n,r)=>n+(r.severity?.[key]??0),0),task=key=>rows.reduce((n,r)=>n+(r.taskMetrics?.[key]??0),0)
  return {version:CANDIDATE14_SCORER_VERSION,sources:rows.length,scored:rows.filter(r=>r.status==='SCORED').length,failed:rows.filter(r=>r.status!=='SCORED').length,completeSources:rows.filter(r=>r.status==='SCORED'&&r.complete).length,severity:{severe:sum(rows,'severe'),major:sum(rows,'major'),forbidden:sum(rows,'forbidden')},taskMetrics:{tp:task('tp'),fp:task('fp'),fn:task('fn')}}
}
