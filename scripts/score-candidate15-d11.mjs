import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'
import {scoreCandidate15,aggregateCandidate15} from './score-candidate15-contract.mjs'
import {D11,verifyD11Preparation} from './run-candidate15-d11.mjs'

const D9='docs/recognition-optimization/candidate15/d9-development'
const D8='docs/recognition-optimization/candidate15/d8-development'
const check=(condition,code)=>{if(!condition)throw Error('D11_SCORE_'+code)}
const read=name=>JSON.parse(readFileSync(join(D11,name),'utf8'))
const KEY_FIELDS=['action','object','actor','currentness','condition','actionability','defaultSelection','materials','times','completionStandards','dependencies']

async function adapter(){
  const output=await build({stdin:{contents:"export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';export {adaptCandidate14CommonWire} from './src/experiments/candidate14/commonAdapter.ts';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
  return import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].contents).toString('base64'))
}
export function referencesValid(result,index){
  if(!result)return false
  const scopes=new Set(index.scopes.map(s=>s.id)),tasks=new Set(result.tasks.map(t=>t.id)),materials=new Set(result.materials.map(m=>m.tempId)),times=new Set(result.timePoints.map(t=>t.tempId)),events=new Set(result.events.map(e=>e.tempId))
  const all=[]
  for(const task of result.tasks){all.push(...task.propositionScopeIds,...task.condition.conditionScopeIds,...task.condition.factScopeIds);if(task.action.scopeId)all.push(task.action.scopeId);if(task.object.scopeId)all.push(task.object.scopeId)
    if((task.detail.dependencyTempIds??[]).some(id=>!tasks.has(id))||(task.detail.materialTempIds??[]).some(id=>!materials.has(id))||(task.detail.timePointTempIds??[]).some(id=>!times.has(id)))return false}
  for(const material of result.materials){all.push(...material.scopeIds);if(material.relatedTaskTempIds.some(id=>!tasks.has(id)))return false}
  for(const time of result.timePoints){all.push(...time.scopeIds);if(time.relatedTaskTempIds.some(id=>!tasks.has(id)))return false}
  for(const event of result.events){all.push(...event.scopeIds);if(event.startTimePointTempId&&!times.has(event.startTimePointTempId))return false;if(event.endTimePointTempId&&!times.has(event.endTimePointTempId))return false}
  for(const revision of result.revisions){all.push(...revision.scopeIds);if(!tasks.has(revision.targetDirectiveId)||(revision.fromDirectiveId&&!tasks.has(revision.fromDirectiveId)))return false}
  all.push(...result.informationScopeIds,...result.unresolvedScopeIds)
  return all.every(id=>scopes.has(id))&&events.size===result.events.length
}
function keyMajor(score){
  if(score.status!=='SCORED')return null
  return score.matches.filter(m=>m.actualIndex!==null&&KEY_FIELDS.some(key=>m.check?.fields?.[key]?.pass===false)).length
    +Number(!score.relationsPass)+Number(!score.noTaskFacts.pass)
}
function winner(a,b){
  if(a.score.status==='SCORER_EXCEPTION'||b.score.status==='SCORER_EXCEPTION')return 'NOT_SCOREABLE'
  const rank=row=>[Number(row.score.complete),-row.score.severity.severe,-row.score.severity.forbidden,-row.score.taskMetrics.fn,-(row.keyMajor??Infinity),-row.score.severity.major,-row.score.taskMetrics.fp]
  const x=rank(a),y=rank(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]>y[i]?'Candidate03':'Candidate15'
  return 'TIE'
}
export async function scoreD11(){
  const verified=verifyD11Preparation();check(verified.status==='PASS'&&verified.settled===24,'INCOMPLETE')
  const binding=read('BINDING.json'),state=read('STATE.json'),sources=JSON.parse(readFileSync(join(D8,'SOURCES.json'))).sources,references=JSON.parse(readFileSync(join(D9,'REFERENCES.json'))).references,x=await adapter(),cases=[]
  for(const unit of binding.units){
    const row=state.units[unit.ordinal-1],raw=JSON.parse(readFileSync(join(D11,'raw',String(unit.ordinal).padStart(2,'0')+'.json'))),source=sources.find(s=>s.sourceId===unit.sourceId),reference=references.find(r=>r.sourceId===unit.sourceId)
    check(row.status==='SETTLED'&&source&&reference&&raw.responseSha256===row.responseSha256,'SOURCE_OR_RAW')
    const context={index:await x.indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText),referenceTime:source.referenceTime,timezone:source.timezone}
    let response,wire=null,adapted=null,parseValid=false,schemaValid=false,referenceValid=false,parseFailure=null
    try{response=JSON.parse(raw.rawHttpText);const output=response.output?.at(-1)?.content?.[0]?.text;check(typeof output==='string','OUTPUT_TEXT');wire=JSON.parse(output);parseValid=true;adapted=x.adaptCandidate14CommonWire(wire,context).adapted;schemaValid=true;referenceValid=referencesValid(adapted,context.index)}catch(error){parseFailure=String(error?.message??'PARSE_FAILURE').slice(0,120)}
    let score
    try{score=scoreCandidate15(reference.reference,adapted,{schemaValid,referenceValid})}
    catch(error){score={version:'candidate15-scoring-6.0.0',status:'SCORER_EXCEPTION',complete:false,severity:{severe:null,major:null,forbidden:null},taskMetrics:{tp:null,fp:null,fn:null},matches:[],failureClass:error instanceof TypeError?'TYPE_ERROR':'OTHER_ERROR'}}
    const caseRow={ordinal:unit.ordinal,sourceId:unit.sourceId,arm:unit.arm,requestSha256:unit.requestSha256,responseSha256:row.responseSha256,transportStatus:'HTTP_200',modelStatus:row.responseStatus,parseValid,schemaValid,referenceValid,parseFailure,score,keyMajor:keyMajor(score),usage:row.usage,costUpperMicroUsd:row.costUpperMicroUsd,firstOutput:wire}
    cases.push(caseRow)
  }
  const arms={Candidate03:cases.filter(c=>c.arm==='A'),Candidate15:cases.filter(c=>c.arm==='B')},aggregate=Object.fromEntries(Object.entries(arms).map(([name,rows])=>[name,{...aggregateCandidate15(rows.map(r=>r.score)),schemaAndReferenceValid:rows.filter(r=>r.schemaValid&&r.referenceValid).length,keyMajor:rows.every(r=>r.keyMajor!==null)?rows.reduce((n,r)=>n+r.keyMajor,0):null}]))
  const pairs=sources.map(source=>{const a=cases.find(c=>c.sourceId===source.sourceId&&c.arm==='A'),b=cases.find(c=>c.sourceId===source.sourceId&&c.arm==='B');return {sourceId:source.sourceId,winner:winner(a,b),candidate03Complete:a.score.complete,candidate15Complete:b.score.complete,candidate03Errors:a.score.matches?.filter(m=>m.check&&!m.check.pass).map(m=>({task:m.expectedId,fields:Object.entries(m.check.fields).filter(([,v])=>!v.pass).map(([name])=>name)})),candidate15Errors:b.score.matches?.filter(m=>m.check&&!m.check.pass).map(m=>({task:m.expectedId,fields:Object.entries(m.check.fields).filter(([,v])=>!v.pass).map(([name])=>name)}))}})
  // Neither frozen prompt contains a worked teaching example; this is a structural zero.
  const teachingLeak=0,gates={determinate24:cases.length===24&&cases.every(c=>c.score.status==='SCORED'||c.score.status==='SCHEMA_OR_REFERENCE_FAILURE'),bothArmsSchemaAndReference12:aggregate.Candidate03.schemaAndReferenceValid===12&&aggregate.Candidate15.schemaAndReferenceValid===12,candidate15SevereForbiddenLeakZero:aggregate.Candidate15.severity.severe===0&&aggregate.Candidate15.severity.forbidden===0&&teachingLeak===0,noFnOrKeyMajorRegression:Number.isFinite(aggregate.Candidate15.taskMetrics.fn)&&Number.isFinite(aggregate.Candidate03.taskMetrics.fn)&&Number.isFinite(aggregate.Candidate15.keyMajor)&&Number.isFinite(aggregate.Candidate03.keyMajor)&&aggregate.Candidate15.taskMetrics.fn<=aggregate.Candidate03.taskMetrics.fn&&aggregate.Candidate15.keyMajor<=aggregate.Candidate03.keyMajor,completeNetGain2:aggregate.Candidate15.completeSources>=aggregate.Candidate03.completeSources+2}
  const decision=Object.values(gates).every(Boolean)?'CANDIDATE15_DEVELOPMENT_PASS_READY_FOR_INDEPENDENT_VALIDATION':'REJECT_CANDIDATE15_DEVELOPMENT'
  const usage={inputTokens:cases.reduce((n,c)=>n+c.usage.input_tokens,0),cachedInputTokens:cases.reduce((n,c)=>n+c.usage.input_tokens_details.cached_tokens,0),outputTokens:cases.reduce((n,c)=>n+c.usage.output_tokens,0)}
  const scoreableArms=Object.fromEntries(Object.entries(arms).map(([name,rows])=>[name,rows.every(r=>r.score.status==='SCORED')]))
  const report={version:'candidate15-d11-scoring-1',role:'FULLY_SEEN_SYNTHETIC_DEVELOPMENT_PROVISIONAL',independentHumanTruth:false,decision,gates,aggregate,pairs,cases,scoreableArms,postRunHandling:'CATCH_ONLY_FROZEN_V6_SCORER_UNCHANGED_NO_PROMOTION',teachingLeak,teachingLeakBasis:'No worked teaching examples in either frozen prompt',metrics:{syntheticDevelopmentFirstWholeSuggestionAccuracy:{Candidate03:scoreableArms.Candidate03?{numerator:aggregate.Candidate03.completeSources,denominator:12}:'NOT_SCOREABLE_FROZEN_V6_EXCEPTION',Candidate15:scoreableArms.Candidate15?{numerator:aggregate.Candidate15.completeSources,denominator:12}:'NOT_SCOREABLE_FROZEN_V6_EXCEPTION'},humanFirstWholeSuggestionAccuracy:'NOT_OBSERVABLE',humanCorrectDispositionRate:'NOT_OBSERVABLE',humanLowModificationCorrectDispositionRate:'NOT_OBSERVABLE',humanActiveEditTime:'NOT_OBSERVABLE'},usage,providerBilledUsd:'NOT_OBSERVABLE',localPeakUsageUpperMicroUsd:cases.reduce((n,c)=>n+c.costUpperMicroUsd,0),budgetWorstMicroUsd:24*324404,ledger:{rows:verified.ledgerRows,sha256:verified.ledgerSha256}}
  const path=join(D11,'SCORING_RESULTS.json');check(!existsSync(path),'SCORING_ALREADY_WRITTEN');writeFileSync(path,JSON.stringify(report,null,2)+'\n',{flag:'wx'})
  return {decision,gates,aggregate,pairs:report.pairs.map(p=>({sourceId:p.sourceId,winner:p.winner})),usage,ledger:report.ledger}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){if(process.argv[2]==='--score')console.log(JSON.stringify(await scoreD11()));else throw Error('D11_SCORE_ARGUMENT')}
