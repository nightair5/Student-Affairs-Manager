import {CANDIDATE14_SCORER_VERSION,normalize,validateCandidate14Reference} from './candidate14-reference-contract.mjs'

const token=value=>normalize(value)
const variants=field=>[field.canonical,...field.aliases].map(token)
const equivalent=(actual,field)=>variants(field).some(v=>token(actual)===v)
const currentness=task=>task.semantics?.status==='cancelled'?'cancelled':task.semantics?.validity==='superseded'?'superseded':task.semantics?.tense==='past'||task.semantics?.status==='completed'?'historical':task.semantics?.validity==='uncertain'?'unknown':'current'
const actionable=task=>task.semantics?.polarity==='negative'||['cancelled','completed'].includes(task.semantics?.status)||task.semantics?.validity==='superseded'||task.condition?.value==='false'?'not_actionable':task.condition?.value==='unknown'?'needs_confirmation':'actionable'
const selection=task=>actionable(task)==='actionable'&&task.inferenceLevel==='explicit'?'selected':'not_selected'
const confirmation=task=>task.detail?.userConfirmationRequired===true?'required':'not_required'
const scalar=(expected,actual)=>({applicable:expected!=='N/A',pass:expected==='N/A'?null:expected===actual,expected,actual})
const list=(expected,actual)=>expected==='N/A'?{applicable:false,pass:null,expected,actual}:({applicable:true,pass:expected.every(item=>actual.some(value=>token(value).includes(token(item)))),expected,actual})
function taskCheck(expected,actual,result,dependencyIds=[]){
  const materialIds=new Set(actual.detail?.materialTempIds??[]),timeIds=new Set(actual.detail?.timePointTempIds??[])
  const materials=(result.materials??[]).filter(row=>materialIds.has(row.tempId)).flatMap(row=>[row.name,...(row.formatRequirements??[]),...(row.namingRequirements??[]),row.submissionChannel??''])
  const times=(result.timePoints??[]).filter(row=>timeIds.has(row.tempId)).flatMap(row=>[row.rawText,`${row.type}:${row.rawText}`,row.normalizedValue??''])
  const fields={action:{applicable:true,pass:equivalent(actual.action?.surface,expected.action)},object:{applicable:true,pass:equivalent(actual.object?.surface,expected.object)},existence:scalar('present','present'),actor:scalar(expected.actor,actual.semantics?.actor),currentness:scalar(expected.currentness,currentness(actual)),condition:scalar(expected.condition,actual.condition?.value),actionability:scalar(expected.actionability,actionable(actual)),defaultSelection:scalar(expected.defaultSelection,selection(actual)),confirmation:scalar(expected.confirmation,confirmation(actual)),materials:list(expected.materials,materials),times:list(expected.times,times),completionStandards:list(expected.completionStandards,actual.detail?.completionCriteria??[]),dependencies:list(expected.dependencies,dependencyIds)}
  return {pass:Object.values(fields).every(row=>row.pass!==false),fields}
}
function assignments(expected,actual,index=0,used=new Set(),rows=[],out=[]){
  if(index===expected.length){out.push([...rows]);return out}
  rows.push(null);assignments(expected,actual,index+1,used,rows,out);rows.pop()
  for(let i=0;i<actual.length;i++)if(!used.has(i)&&equivalent(actual[i].action?.surface,expected[index].action)&&equivalent(actual[i].object?.surface,expected[index].object)){used.add(i);rows.push(i);assignments(expected,actual,index+1,used,rows,out);rows.pop();used.delete(i)}
  return out
}
const rank=row=>[row.matches,row.passing,-row.falsePositives]
const better=(a,b)=>{const x=rank(a),y=rank(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]>y[i];return false}
export function scoreCandidate14(referenceInput,result,{schemaValid=true,referenceValid=true}={}){
  const reference=validateCandidate14Reference(referenceInput)
  if(!schemaValid||!referenceValid||!result)return {version:CANDIDATE14_SCORER_VERSION,status:'SCHEMA_OR_REFERENCE_FAILURE',complete:false,severity:{severe:1,major:0,forbidden:0},taskMetrics:{tp:0,fp:0,fn:reference.tasks.length},matches:[]}
  const actual=result.tasks??[], candidates=assignments(reference.tasks,actual), evaluated=candidates.map(map=>{
    const checks=map.map((idx,i)=>idx===null?null:taskCheck(reference.tasks[i],actual[idx],result))
    const used=new Set(map.filter(v=>v!==null));return {map,checks,matches:used.size,passing:checks.filter(v=>v?.pass).length,falsePositives:actual.length-used.size}
  }),best=evaluated.reduce((a,b)=>better(b,a)?b:a,{map:[],checks:[],matches:0,passing:0,falsePositives:actual.length})
  const tied=evaluated.filter(row=>rank(row).every((v,i)=>v===rank(best)[i]));if(tied.length>1&&new Set(tied.map(row=>JSON.stringify(row.map))).size>1)return {version:CANDIDATE14_SCORER_VERSION,status:'ADJUDICATION_REQUIRED',complete:false,severity:{severe:0,major:0,forbidden:0},taskMetrics:{tp:0,fp:0,fn:0},matches:[]}
  const expectedToActual=new Map(reference.tasks.map((task,i)=>[task.id,best.map[i]===null?null:actual[best.map[i]].id]))
  best.checks=best.map.map((idx,i)=>{const expected=reference.tasks[i],mappedDependencies=Array.isArray(expected.dependencies)?expected.dependencies.map(id=>expectedToActual.get(id)).filter(Boolean):expected.dependencies;return idx===null?null:taskCheck({...expected,dependencies:mappedDependencies},actual[idx],result,actual[idx].detail?.dependencyTempIds??[])})
  const matches=reference.tasks.map((task,i)=>({expectedId:task.id,actualIndex:best.map[i],check:best.checks[i]})),fn=best.map.filter(v=>v===null).length,fp=best.falsePositives,major=matches.filter(row=>row.actualIndex!==null&&!row.check?.pass).length
  const relationsPass=reference.relations.every(expected=>(result.revisions??[]).some(actualRelation=>actualRelation.type===expected.type&&actualRelation.targetDirectiveId===expectedToActual.get(expected.targetTaskId)&&actualRelation.fromDirectiveId===(expected.fromTaskId===null?null:expectedToActual.get(expected.fromTaskId))&&actualRelation.effective===expected.effective))
  const forbidden=actual.filter(task=>actionable(task)==='actionable'&&!best.map.includes(actual.indexOf(task))).length
  const noTaskPass=reference.tasks.length?true:actual.length===0&&reference.noTaskFacts.length>0
  return {version:CANDIDATE14_SCORER_VERSION,status:'SCORED',complete:fn===0&&fp===0&&major===0&&forbidden===0&&noTaskPass&&relationsPass,severity:{severe:0,major:major+(relationsPass?0:1),forbidden},taskMetrics:{tp:best.passing,fp,fn},noTaskPass,relationsPass,matches}
}
export function aggregateCandidate14(rows){
  const applicable=rows.filter(r=>r.status==='SCORED'),sum=key=>applicable.reduce((n,r)=>n+r.severity[key],0)
  return {version:CANDIDATE14_SCORER_VERSION,sources:rows.length,scored:applicable.length,completeSources:applicable.filter(r=>r.complete).length,severity:{severe:sum('severe'),major:sum('major'),forbidden:sum('forbidden')},taskMetrics:{tp:applicable.reduce((n,r)=>n+r.taskMetrics.tp,0),fp:applicable.reduce((n,r)=>n+r.taskMetrics.fp,0),fn:applicable.reduce((n,r)=>n+r.taskMetrics.fn,0)}}
}
