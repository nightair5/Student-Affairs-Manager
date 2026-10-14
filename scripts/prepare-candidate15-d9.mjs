import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'
import {D9_ADJUDICATIONS} from './candidate15-d9-adjudications.mjs'
import {CANDIDATE15_REFERENCE_VERSION,validateCandidate15Reference,canonical} from './candidate15-reference-contract.mjs'
import {scoreCandidate15} from './score-candidate15-contract.mjs'

const root='docs/recognition-optimization/candidate15/d9-development'
const sourcePath='docs/recognition-optimization/candidate15/d8-development/SOURCES.json'
const components=['src/experiments/realInput01/candidate03.ts','src/experiments/realInput01/candidate15.ts','src/experiments/realInput01/modelWire.ts','src/experiments/mainline04/semanticContract.ts','src/experiments/candidate14/commonAdapter.ts','src/experiments/candidate14/timePolicy.ts','scripts/candidate15-reference-contract.mjs','scripts/score-candidate15-contract.mjs','scripts/candidate15-d9-adjudications.mjs','scripts/prepare-candidate15-d9.mjs','scripts/verify-candidate15-d9.mjs','scripts/serve-candidate15-d8.mjs','scripts/serve-candidate15-d9.mjs','src/experiments/candidate15/d8Replay.ts','src/experiments/candidate15/d8Runtime.tsx','src/experiments/candidate15/measurement.ts','src/experiments/candidate15/uiMeasurement.ts','src/experiments/mainline04/semanticComposer.ts','src/experiments/mainline05/semanticState.ts','src/experiments/mainline05/SemanticFacts.tsx','src/lib/sourceWorkflow.ts']
const hash=value=>createHash('sha256').update(value).digest('hex')
const json=value=>JSON.stringify(value,null,2)+'\n'
const normalizedFile=path=>Buffer.from(readFileSync(path,'utf8').replace(/\r\n/g,'\n'))
const file=path=>({path,sha256:hash(normalizedFile(path)),bytes:normalizedFile(path).length,hashMode:'UTF8_LF_CANONICAL'})
const assert=(value,code)=>{if(!value)throw Error('D9_PREP_'+code)}
const unique=values=>[...new Set(values)]
const field=value=>({canonical:value,aliases:[]})

async function runtime(){
  const x=await build({stdin:{contents:"export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';export {adaptCandidate14CommonWire} from './src/experiments/candidate14/commonAdapter.ts';export {buildCandidate03Request} from './src/experiments/realInput01/candidate03.ts';export {buildCandidate15Request} from './src/experiments/realInput01/candidate15.ts';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
  return import('data:text/javascript;base64,'+Buffer.from(x.outputFiles[0].contents).toString('base64'))
}

function annotate(source,spec,index){
  const id=n=>{assert(Number.isInteger(n)&&index.scopes[n-1],'SCOPE_'+source.sourceId+'_'+n);return index.scopes[n-1].id}
  const ids=values=>values.map(id),scopeTextById=Object.fromEntries(index.scopes.map(row=>[row.id,row.text]))
  const timeFact=row=>({...row,timezone:source.timezone})
  const tasks=spec.tasks.map(t=>{
    const currentness=t.currentness??'current',condition=t.condition??'not_applicable'
    const actionability=currentness!=='current'||condition==='false'?'not_actionable':condition==='unknown'?'needs_confirmation':'actionable'
    const material=t.material,expectedMaterial=material?[...(material.formats??[]),...(material.naming??[]),...(material.channel?[material.channel]:[])]:[]
    return {id:t.id,action:field(t.action),object:field(t.object),actor:'addressee',currentness,condition,conditionScopeIds:ids(t.conditionScope??[]),factScopeIds:ids(t.factScope??[]),actionability,defaultSelection:actionability==='actionable'?'selected':'not_selected',confirmation:'required',materials:expectedMaterial.length?expectedMaterial:'N/A',times:t.times?.map(timeFact)??'N/A',completionStandards:t.completion?.length?t.completion:'N/A',dependencies:t.dependencies?.length?t.dependencies:'N/A',actionScopeIds:[id(t.actionScope??t.at)],objectScopeIds:[id(t.objectScope??t.at)],scopeIds:ids(t.scope)}
  })
  const relations=(spec.relations??[]).map(row=>({type:row.type,fromTaskId:row.fromTaskId,targetTaskId:row.targetTaskId,effective:row.effective}))
  const noTaskFacts=[{id:'SYNTHETIC_SOURCE_MARKER',kind:'information',value:'[D5匿名合成Development]',aliases:[],sourceText:'[D5匿名合成Development]',scopeIds:[id(1)]},...(spec.facts??[]).map(fact=>({id:fact.id,kind:fact.kind,value:fact.value,aliases:fact.aliases??[],sourceText:fact.sourceText,scopeIds:ids(fact.scope),...(fact.time?{time:timeFact(fact.time)}:{}),...(fact.kind==='event'?{timeFactIds:fact.timeFactIds,locationFactIds:fact.locationFactIds}:{})}))]
  const reference={version:CANDIDATE15_REFERENCE_VERSION,sourceId:source.sourceId,completeness:'complete',referenceTime:source.referenceTime,timezone:source.timezone,scopeTextById,allowedAliases:[],tasks,relations,noTaskFacts}
  validateCandidate15Reference(reference)
  return {reference,id,ids}
}

function legalWire(source,spec,reference,id,ids){
  const tasks=spec.tasks.map((t,i)=>{
    const ref=reference.tasks[i],nonCurrent=ref.currentness!=='current'
    return {id:t.id,propositionScopeIds:ref.scopeIds,semantics:{actor:'addressee',speechAct:'directive',polarity:'affirmative',tense:ref.currentness==='historical'?'past':'future',status:ref.currentness==='cancelled'?'cancelled':ref.currentness==='historical'?'completed':'pending',validity:ref.currentness==='superseded'?'superseded':'active',modality:ref.actionability==='actionable'?'required':'informational'},inferenceLevel:'explicit',actionType:'other',action:{surface:t.action,scopeId:ref.actionScopeIds[0]},object:{surface:t.object,scopeId:ref.objectScopeIds[0]},effect:'local_change',detail:{parentTempId:null,hierarchyType:'task',title:t.action+t.object,description:'',completionCriteria:t.completion??[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:t.dependencies??[],materialTempIds:t.material?[t.material.id??'M'+t.id]:[],timePointTempIds:(t.times??[]).map((_,j)=>'P'+t.id+'_'+j),confidence:1,userConfirmationRequired:true},condition:{value:ref.condition,conditionScopeIds:ref.conditionScopeIds,factScopeIds:ref.factScopeIds},coverage:{time:t.times?.length?'present':'not_stated',material:t.material?'present':'not_stated',event:'not_stated'},eventTempIds:[]}
  })
  const materials=[];for(const t of spec.tasks)if(t.material&&!materials.some(m=>m.tempId===(t.material.id??'M'+t.id))){const m=t.material;materials.push({tempId:m.id??'M'+t.id,name:m.name,required:true,formatRequirements:m.formats??[],namingRequirements:m.naming??[],quantity:null,submissionChannel:m.channel??null,relatedTaskTempIds:m.related??[t.id],scopeIds:ids(m.scope),confidence:1})}
  const timePoints=[];for(const t of spec.tasks)for(const [j,point] of (t.times??[]).entries()){
    const scope=indexOfTime(source,point.rawText,id)
    timePoints.push({tempId:'P'+t.id+'_'+j,type:point.type,rawText:point.rawText,relatedTaskTempIds:[t.id],relatedMaterialTempIds:[],scopeIds:[scope],confidence:1})
  }
  const events=[];for(const fact of spec.facts??[]){
    if(fact.kind==='time')timePoints.push({tempId:fact.id,type:fact.time.type,rawText:fact.time.rawText,relatedTaskTempIds:[],relatedMaterialTempIds:[],scopeIds:ids(fact.scope),confidence:1})
    if(fact.kind==='event')events.push({tempId:fact.id,title:fact.value,description:'',startTimePointTempId:fact.timeFactIds.find(f=>spec.facts.find(x=>x.id===f)?.time?.type==='event_start')??null,endTimePointTempId:fact.timeFactIds.find(f=>spec.facts.find(x=>x.id===f)?.time?.type==='event_end')??null,location:null,scopeIds:ids(fact.scope),confidence:1,inferenceLevel:'explicit',relatedTaskTempIds:[]})
  }
  const revisions=(spec.relations??[]).map(row=>({type:row.type,targetDirectiveId:row.targetTaskId,scopeIds:ids(row.scope),fromDirectiveId:row.fromTaskId,effective:row.effective}))
  const informationScopeIds=unique([...reference.tasks.filter(t=>t.actionability!=='actionable').flatMap(t=>t.scopeIds),...reference.noTaskFacts.flatMap(f=>f.scopeIds)])
  return {schemaVersion:'real-input-model-wire-1',tasks,materials,timePoints,events,revisions,conflicts:[],informationScopeIds,unresolvedScopeIds:[]}
}
function indexOfTime(source,raw,id){const n=source.__scopes.findIndex(s=>s.text.includes(raw));assert(n>=0,'TIME_SCOPE_'+source.sourceId+'_'+raw);return id(n+1)}
function mutate(wire,number){const bad=structuredClone(wire)
  if(number===9){bad.events[0].startTimePointTempId=null;return bad}
  if(number===10||number===11){bad.revisions[0].targetDirectiveId=bad.revisions.at(-1).targetDirectiveId;return bad}
  if(number===4||number===5){bad.tasks[0].condition.value=number===4?'true':'false';return bad}
  if(number===6||number===8){bad.tasks.at(-1).detail.dependencyTempIds=[];return bad}
  if(number===7){bad.timePoints.pop();bad.tasks[0].detail.timePointTempIds.pop();return bad}
  if(number===12){bad.tasks.push({...structuredClone(bad.tasks[0]),id:'extra',action:{...bad.tasks[0].action,surface:'联系'}});return bad}
  if(bad.tasks[0].detail.completionCriteria.length)bad.tasks[0].detail.completionCriteria=['另有完成标准']
  else if(bad.tasks[0].detail.timePointTempIds.length)bad.timePoints[0].type='event_start'
  else bad.tasks[0].condition.value='false'
  return bad
}

export async function prepareD9(){
  const x=await runtime(),sources=JSON.parse(readFileSync(sourcePath,'utf8')).sources
  assert(sources.length===12&&D9_ADJUDICATIONS.length===12,'ROSTER')
  const rows=[],oracles=[],roundtrips=[]
  for(const [i,source] of sources.entries()){
    const spec=D9_ADJUDICATIONS[i];assert(spec.number===i+1&&hash(source.sourceText)===source.sourceSha256,'SOURCE_IDENTITY_'+i)
    const index=await x.indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText)
    const context={index,referenceTime:source.referenceTime,timezone:source.timezone},scopeSource={...source,__scopes:index.scopes}
    const {reference,id,ids}=annotate(source,spec,index),wire=legalWire(scopeSource,spec,reference,id,ids)
    const adapted=x.adaptCandidate14CommonWire(wire,context).adapted,positive=scoreCandidate15(reference,adapted)
    const changed=mutate(wire,spec.number),negative=scoreCandidate15(reference,x.adaptCandidate14CommonWire(changed,context).adapted)
    const reordered=structuredClone(wire);reordered.tasks.reverse();reordered.materials.reverse();reordered.timePoints.reverse();reordered.events.reverse();reordered.revisions.reverse()
    const orderScore=scoreCandidate15(reference,x.adaptCandidate14CommonWire(reordered,context).adapted)
    roundtrips.push({sourceId:source.sourceId,positiveStatus:positive.status,positiveComplete:positive.complete,reorderedComplete:orderScore.complete,negativeStatus:negative.status,negativeComplete:negative.complete,negativeMajor:negative.severity.major,positiveNoTask:positive.noTaskFacts?.pass??false})
    assert(positive.status==='SCORED'&&positive.complete,'POSITIVE_'+source.sourceId+'_'+JSON.stringify(positive).slice(0,2000))
    assert(orderScore.complete,'ORDER_INVARIANCE_'+source.sourceId)
    assert(negative.complete===false,'NEGATIVE_'+source.sourceId)
    rows.push({sourceId:source.sourceId,sourceSha256:source.sourceSha256,seenDegree:'FULLY_SEEN_D5_SYNTHETIC_DEVELOPMENT',truthStatus:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',rationale:spec.rationale,taskBoundaryRule:'每个动作+对象最小义务单独核对；属性挂回对应义务；顺序不影响评分；不同对象或不同动作不得为凑分合并',referenceSha256:hash(canonical(reference)),reference})
    oracles.push({sourceId:source.sourceId,wireSha256:hash(canonical(wire)),wire})
  }
  const references={version:'candidate15-d9-provisional-v6-references-1.0.0',status:'COMPLETE_PROVISIONAL_DEVELOPMENT',truthStatus:'SINGLE_AUTHOR_MODEL_ASSISTED_NOT_INDEPENDENT_HUMAN',source:sourcePath,references:rows}
  const oracleFile={version:'candidate15-d9-legal-wire-oracles-1.0.0',purpose:'REACHABILITY_ONLY_NOT_MODEL_RESULTS',oracles}
  const roundtripFile={version:'candidate15-d9-roundtrip-1.0.0',path:'ACTUAL_SCHEMA_COMMON_ADAPTER_V6_SCORER',results:roundtrips}
  const outputs=[['REFERENCES.json',references],['LEGAL_WIRE_ORACLES.json',oracleFile],['ROUNDTRIP_RESULTS.json',roundtripFile]]
  mkdirSync(root,{recursive:true})
  for(const [name,value] of outputs)save(name,value)
  const orders=['AB','BA','BA','AB','BA','AB','AB','BA','AB','BA','BA','AB'],requests=[]
  for(const [i,source] of sources.entries()){
    const index=await x.indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText),context={index,referenceTime:source.referenceTime,timezone:source.timezone}
    const bodies={A:(await x.buildCandidate03Request(context)).body,B:(await x.buildCandidate15Request(context)).body}
    for(const [slot,arm] of [...orders[i]].entries()){
      const body={...bodies[arm],model:'deepseek-flash'},requestSha256=hash(JSON.stringify(body)),identity={ordinal:requests.length+1,sourceId:source.sourceId,sourceSha256:source.sourceSha256,arm,order:orders[i],slot,model:'deepseek-flash',referenceTime:source.referenceTime,timezone:source.timezone,requestSha256}
      assert(!JSON.stringify(body).includes('referenceSha256')&&!JSON.stringify(body).includes('Expected'),'EXPECTED_LEAK')
      requests.push({...identity,unitIdentitySha256:hash(canonical(identity)),body,dispatchAuthorized:false,status:'NOT_RUN'})
    }
  }
  assert(requests.length===24&&requests.filter(r=>r.arm==='A').length===12&&requests.filter(r=>r.arm==='B').length===12,'REQUEST_COUNT')
  save('PREPARED_REQUEST_IDENTITIES.json',{version:'candidate15-d9-requests-1.0.0',dispatchAuthorized:false,runStatus:'NOT_RUN',requests})
  const manifest={version:'candidate15-d9-development-freeze-1.0.0',status:'REFERENCE_ROUNDTRIP_PASS_REQUESTS_PREPARED_UNAUTHORIZED',dataRole:'FULLY_SEEN_SYNTHETIC_DEVELOPMENT',independentHumanTruth:false,holdoutEligible:false,sourceCount:12,referenceCount:12,plannedUnits:24,actualRequestIdentities:requests.map(({body,...rest})=>rest),dispatchAuthorized:false,runStatus:'NOT_RUN',modelCalls:0,grantCreated:false,ledgerWritten:false,model:'deepseek-flash',fixedParameters:{temperature:0,reasoning:{effort:'none'},stream:false,max_output_tokens:8192,referenceTime:'FROM_SOURCE_ROSTER',timezone:'Asia/Shanghai',schema:'CURRENT_MODEL_JSON_SCHEMA'},balancedOrder:{AB:6,BA:6},failurePolicy:'ONCE_NO_RETRY_NO_REPAIR_NO_VERIFIER_FAILURES_IN_DENOMINATOR',promotionGate:{determinateUnits:24,schemaAndReferenceValidPerArm:12,newSevere:0,newForbidden:0,teachingLeak:0,taskFNIncreaseMax:0,keyMajorIncreaseMax:0,completeCorrectNetGainMin:2},files:[file(sourcePath),...['REFERENCES.json','LEGAL_WIRE_ORACLES.json','ROUNDTRIP_RESULTS.json','PREPARED_REQUEST_IDENTITIES.json'].map(name=>file(root+'/'+name)),...components.map(file)]}
  save('MANIFEST.json',manifest)
  return {status:manifest.status,references:12,roundtrips:12,identities:24,dispatchAuthorized:false}
}
function save(name,value){const path=root+'/'+name,text=json(value);if(process.argv.includes('--verify'))assert(existsSync(path)&&readFileSync(path,'utf8').replace(/\r\n/g,'\n')===text,'DRIFT_'+name);else writeFileSync(path,text)}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)console.log(JSON.stringify(await prepareD9()))
