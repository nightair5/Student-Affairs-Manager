import {createHash,randomBytes,randomUUID} from 'node:crypto'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {isDeepStrictEqual} from 'node:util'
import {build} from 'esbuild'
import {inspectRequest,createModelGateway,createPinnedProxyFetch,createRawRecorder,assertModelGatewayConfigured} from './real-input-model-gateway.mjs'
import {CANDIDATE11_B2_POLICY,CANDIDATE11_B2_UNIT_POLICY} from './real-input-budget.mjs'
import {openCandidate11B2Budget} from './candidate11-b2-budget.mjs'
import {scoreCandidate11} from './score-candidate11-recognition.mjs'
import {verifyProtectedFiles} from './verify-candidate11-analysis.mjs'

export const DIRECTORY='docs/recognition-optimization/candidate11/b2-development-20260921a'
const B1='docs/recognition-optimization/candidate11/b1-preparation'
const AUTHORIZATION=resolve('C:/Users/Winner/.codex/attachments/63d10dbd-a474-4f8a-b7bb-9d8d766d4fc7/已粘贴的文本.txt')
const LEDGER_PATH=resolve('C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')
const LEGACY_MANIFEST_PATH=resolve('C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/REQUEST_MANIFEST.json')
const EXISTING_SERVER_ENV=resolve('C:/Users/Winner/student-affairs-multimodal-exp/.env')
const LOCK_ROOT=resolve('C:/Users/Winner/student-affairs-multimodal-exp/.data/candidate11-b2-20260921a')
const B1_MANIFEST_SHA='af1f1d2427eec1795691e1d4a62056a614bac72f0254103667632b341794744e'
const LEDGER_PREFIX={rows:644,reserves:314,bytes:519152,sha256:'dc52d9cd04b809be9d22d5298bd45d0e6f0a01307017d48a91aaa91a45e8e597',tail:'37ffce66d2e92d036481308f84b08a24c70d42c313cdaf7aaa8ad505f3f2822e'}
const BRANCH='codex/e2-candidate11-blind-eval'
const hash=value=>createHash('sha256').update(value).digest('hex')
const check=(value,code)=>{if(!value)throw Error('CANDIDATE11_B2_RUNNER_'+code)}
const read=name=>JSON.parse(readFileSync(join(DIRECTORY,name),'utf8'))
const shaFile=path=>({path:path.replaceAll('\\','/'),sha256:hash(readFileSync(path))})
const json=(path,value)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n',{flag:'wx'})
const git=(args)=>execFileSync('git',args,{encoding:'utf8'}).trim()
const changedPaths=()=>[...git(['diff','--name-only']).split('\n'),...git(['ls-files','--others','--exclude-standard']).split('\n')].filter(Boolean).map(path=>path.replaceAll('\\','/'))
const allowedPath=path=>path.startsWith(DIRECTORY+'/')

async function adapterApi(){
  const output=await build({stdin:{contents:`export {adaptModelWire,WIRE_VERSION} from './src/experiments/realInput01/modelWire.ts';`,resolveDir:process.cwd(),loader:'ts'},
    bundle:true,write:false,platform:'node',format:'esm',metafile:true,logLevel:'silent'})
  const dependencies=Object.keys(output.metafile.inputs).filter(path=>path!=='<stdin>').sort().map(shaFile)
  return {dependencies,api:await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].contents).toString('base64'))}
}

function inspectLedgerExact(){
  const bytes=readFileSync(LEDGER_PATH),lines=bytes.toString('utf8').trimEnd().split('\n'),rows=lines.map(JSON.parse)
  check(lines.length===LEDGER_PREFIX.rows&&bytes.length===LEDGER_PREFIX.bytes&&hash(bytes)===LEDGER_PREFIX.sha256,'LEDGER_PREFIX')
  check(rows.filter(row=>['reserve','recoveryReserve','batchReserve'].includes(row.event.kind)).length===LEDGER_PREFIX.reserves
    &&rows.at(-1).sequence===643&&rows.at(-1).hash===LEDGER_PREFIX.tail,'LEDGER_BASELINE')
  return {bytes,rows}
}

function currentGit(requireClean=true){
  const head=git(['rev-parse','HEAD']),branch=git(['branch','--show-current']),upstream=git(['rev-parse','@{u}'])
  check(branch===BRANCH&&head===upstream,'LOCAL_REMOTE')
  const remote=git(['ls-remote','origin','refs/heads/'+BRANCH]).split(/\s+/u)[0]
  check(remote===head,'REMOTE_HEAD')
  if(requireClean)check(changedPaths().length===0,'WORKTREE_NOT_CLEAN')
  return {head,branch,upstream,remote}
}

function verifyB1(){
  const output=execFileSync(process.execPath,['scripts/prepare-candidate11-b1.mjs','--verify'],{encoding:'utf8'})
  const result=JSON.parse(output.trim());check(result.requests===24&&result.protection?.count===84&&result.modelCalls===0,'B1_VERIFY')
  check(hash(readFileSync(join(B1,'MANIFEST.json')))===B1_MANIFEST_SHA,'B1_MANIFEST')
  return result
}

function unitFrom(packet,manifestUnit){
  const identity=inspectRequest(packet.requestSerialized,CANDIDATE11_B2_UNIT_POLICY)
  check(['unitId','ordinal','sourceId','sourceVersionId','variant','position','sourceSha','referenceSha','identitySha','requestSha','inputSha','promptSha','exampleSha','schemaSha','requestBytes']
    .every(key=>packet[key]===manifestUnit[key]),'PACKET_MANIFEST_IDENTITY')
  check(identity.requestSha===packet.requestSha&&identity.requestBytes===packet.requestBytes&&identity.inputSha===packet.inputSha,'REQUEST_IDENTITY')
  return Object.fromEntries(['unitId','ordinal','sourceId','sourceVersionId','variant','position','sourceSha','referenceSha','identitySha','requestSha','inputSha','promptSha','exampleSha','schemaSha'].map(key=>[key,packet[key]])
    .concat([['scorerSha',hash(readFileSync('scripts/score-candidate11-recognition.mjs'))],['adapterVersion','real-input-model-wire-1'],['candidateSha',identity.candidateSha],['requestBytes',identity.requestBytes]]))
}

function verifyDependencies(binding){
  for(const file of binding.dependencies)check(existsSync(file.path)&&hash(readFileSync(file.path))===file.sha256,'DEPENDENCY:'+file.path)
  for(const path of changedPaths())check(allowedPath(path),'WORKTREE_SCOPE:'+path)
  const head=git(['rev-parse','HEAD']),upstream=git(['rev-parse','@{u}']),branch=git(['branch','--show-current'])
  check(head===binding.head&&upstream===head&&branch===BRANCH,'GIT_BINDING')
  const remote=git(['ls-remote','origin','refs/heads/'+BRANCH]).split(/\s+/u)[0];check(remote===head,'REMOTE_BINDING')
  const protection=verifyProtectedFiles();check(protection.count===84,'PROTECTED_FILES')
  if(readFileSync(LEDGER_PATH).length===LEDGER_PREFIX.bytes)verifyB1()
}

export async function prepareCandidate11B2(){
  const gitState=currentGit(true),b1Check=verifyB1(),{bytes:ledgerBytes}=inspectLedgerExact()
  check(!existsSync(DIRECTORY),'OUTPUT_EXISTS')
  mkdirSync(join(DIRECTORY,'raw'),{recursive:true});mkdirSync(join(DIRECTORY,'results'),{recursive:true})
  const manifest=JSON.parse(readFileSync(join(B1,'MANIFEST.json'))),packets=JSON.parse(readFileSync(join(B1,'PREPARED_REQUESTS.json'))).requests
  check(manifest.requestCount===24&&packets.length===24&&manifest.units.length===24,'B1_COUNT')
  const units=packets.map((packet,index)=>{check(packet.unitId===manifest.units[index].unitId&&packet.ordinal===index+1,'B1_ORDER');return unitFrom(packet,manifest.units[index])})
  const requests=Object.fromEntries(packets.map(packet=>[packet.unitId,packet.requestSerialized]))
  const {dependencies:adapterDependencies,api}=await adapterApi();check(api.WIRE_VERSION==='real-input-model-wire-1','ADAPTER_VERSION')
  const dependencyPaths=['scripts/real-input-budget.mjs','scripts/real-input-model-gateway.mjs','scripts/candidate11-b2-budget.mjs','scripts/run-candidate11-b2.mjs','scripts/score-candidate11-recognition.mjs','scripts/prepare-candidate11-b1.mjs','scripts/verify-candidate11-analysis.mjs',
    join(B1,'MANIFEST.json'),join(B1,'PREPARED_REQUESTS.json'),join(B1,'REFERENCES.json'),join(B1,'REFERENCE_SCHEMA.json'),join(B1,'SCORING_REFERENCE_RULES.md'),
    'src/experiments/realInput01/candidate11.ts','src/experiments/realInput01/modelWire.ts','src/experiments/mainline04/semanticContract.ts']
  const dependencies=[...new Map([...dependencyPaths.map(shaFile),...adapterDependencies].map(file=>[file.path,file])).values()].sort((a,b)=>a.path.localeCompare(b.path))
  const binding={version:'candidate11-b2-binding-1',head:gitState.head,branch:BRANCH,evaluationType:'seen-development-ablation',model:'deepseek-flash',temperature:0,reasoning:'none',maxOutputTokens:8192,timeoutMs:120000,
    b1ManifestSha:B1_MANIFEST_SHA,units,requests,dependencies,adapterVersion:api.WIRE_VERSION,scorerVersion:'candidate11-scoring-2.0.0',
    scorerSha:hash(readFileSync('scripts/score-candidate11-recognition.mjs')),referenceSha:hash(readFileSync(join(B1,'REFERENCES.json'))),createdAt:new Date().toISOString()}
  const checkedAt=new Date(),billing={version:'candidate11-b2-billing-1',verified:true,method:'official-deepseek-document-index-review',checkedAt:checkedAt.toISOString(),validUntil:new Date(checkedAt.getTime()+12*60*60*1000).toISOString(),
    route:{endpoint:'https://api.deepseek.com/responses',model:'deepseek-flash',mappedModel:'DeepSeek V4.1 Flash',temperature:0,reasoning:'none',maxOutputTokens:8192},policy:CANDIDATE11_B2_POLICY,
    peakPrices:{uncachedInputCnyPerMillion:2,outputCnyPerMillion:8},perRequestWorstCny:2.162688,batchWorstCny:51.904512,
    documents:[{url:'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/?article_id=article_1779470751466_8',claim:'deepseek-flash maps to V4.1 Flash; peak uncached input CNY 2/M and output CNY 8/M'},
      {url:'https://api-docs.deepseek.com/zh-cn/news/news260910/',claim:'official V4.1 Flash release and model mapping'}]}
  const review={version:'candidate11-b2-send-review-1',status:'PASS',authorizationSha:hash(readFileSync(AUTHORIZATION)),grantId:randomUUID(),head:binding.head,b1ManifestSha:B1_MANIFEST_SHA,
    bindingSha:hash(JSON.stringify(binding,null,2)+'\n'),billingSha:hash(JSON.stringify(billing)),sourcesSha:hash(JSON.stringify(dependencies)),b1Check,checkedAt:new Date().toISOString(),
    constraints:{calls:24,repair:0,verifier:0,retry:0,maxBudgetCny:51.904512}}
  const baseline={version:'candidate11-b2-baseline-1',head:binding.head,branch:BRANCH,ledger:{path:LEDGER_PATH,rows:644,reserves:314,bytes:ledgerBytes.length,sha256:hash(ledgerBytes),tail:LEDGER_PREFIX.tail,nextSequence:644},
    b1ManifestSha:B1_MANIFEST_SHA,lockRoot:LOCK_ROOT,modelCalls:0,createdAt:new Date().toISOString()}
  for(const [name,value] of [['BASELINE.json',baseline],['BINDING.json',binding],['BILLING.json',billing],['SEND_REVIEW.json',review]])json(join(DIRECTORY,name),value)
  const grant=grantFromFiles();json(join(DIRECTORY,'GRANT.json'),grant)
  return {status:'READY',head:binding.head,requests:24,budgetCny:51.904512,bindingSha:review.bindingSha,grantId:review.grantId}
}

function grantFromFiles(){
  const bindingBytes=readFileSync(join(DIRECTORY,'BINDING.json')),binding=JSON.parse(bindingBytes),baseline=read('BASELINE.json'),billing=read('BILLING.json'),review=read('SEND_REVIEW.json')
  return {version:'candidate11-b2-grant-1',grantId:review.grantId,parentTail:baseline.ledger.tail,parentSequence:baseline.ledger.nextSequence,ledgerPrefixBytes:baseline.ledger.bytes,ledgerPrefixSha:baseline.ledger.sha256,
    legacyManifestSha:hash(readFileSync(LEGACY_MANIFEST_PATH)),b1ManifestSha:B1_MANIFEST_SHA,bindingSha:hash(bindingBytes),head:binding.head,sourcesSha:review.sourcesSha,reviewSha:hash(JSON.stringify(review)),targets:binding.units,
    billingEvidence:{checkedAt:billing.checkedAt,validUntil:billing.validUntil,evidenceSha:hash(JSON.stringify(billing)),documents:billing.documents},route:{endpoint:billing.route.endpoint,model:billing.route.model,temperature:0,reasoning:'none',maxOutputTokens:8192},
    lockRoot:LOCK_ROOT,maxBatchRequests:24,maxTotalRequests:338,maxBatchBudgetMicroCny:51904512,policy:CANDIDATE11_B2_POLICY,repair:0,verifier:0,retry:0}
}

function verifySend(){
  const bindingBytes=readFileSync(join(DIRECTORY,'BINDING.json')),binding=JSON.parse(bindingBytes),baseline=read('BASELINE.json'),billing=read('BILLING.json'),review=read('SEND_REVIEW.json'),grant=read('GRANT.json')
  verifyDependencies(binding)
  check(hash(bindingBytes)===review.bindingSha&&hash(JSON.stringify(billing))===review.billingSha&&hash(JSON.stringify(binding.dependencies))===review.sourcesSha,'REVIEW_BINDING')
  check(isDeepStrictEqual(grant,grantFromFiles()),'GRANT_DRIFT')
  check(Date.now()>=Date.parse(billing.checkedAt)&&Date.now()<=Date.parse(billing.validUntil)&&billing.verified,'PRICE_VALIDITY')
  const ledger=readFileSync(LEDGER_PATH);check(ledger.length>=baseline.ledger.bytes&&hash(ledger.subarray(0,baseline.ledger.bytes))===baseline.ledger.sha256,'LEDGER_PREFIX')
  for(const unit of binding.units){const identity=inspectRequest(binding.requests[unit.unitId],CANDIDATE11_B2_UNIT_POLICY);check(['requestSha','requestBytes','candidateSha','inputSha'].every(key=>identity[key]===unit[key]),'UNIT_IDENTITY')}
  return {bindingBytes,binding,baseline,billing,review,grant}
}

export async function dispatchCandidate11B2(unitId){
  check(/^C11-B1-D0[1-6]-V(?:00|10|01|11)$/.test(unitId),'UNIT_ID')
  const verified=verifySend(),{binding,grant,bindingBytes}=verified,budget=await openCandidate11B2Budget({ledgerPath:LEDGER_PATH,lockRoot:LOCK_ROOT,grant}),before=await budget.snapshot(),index=before.reservations.length
  check(index<24&&binding.units[index]?.unitId===unitId&&!before.stopped&&before.reservations.every(value=>value.status==='settled'),'NEXT_UNIT')
  const rawPath=join(DIRECTORY,'raw',unitId+'.jsonl'),resultPath=join(DIRECTORY,'results',unitId+'.json');check(!existsSync(rawPath)&&!existsSync(resultPath),'ALREADY_ATTEMPTED')
  const envPath=existsSync(resolve('.env'))?resolve('.env'):EXISTING_SERVER_ENV
  if(existsSync(envPath))process.loadEnvFile(envPath)
  try{assertModelGatewayConfigured()}catch{check(false,'SERVER_CONFIGURATION_UNAVAILABLE')}
  const origin='http://127.0.0.1:6631',capability=randomBytes(32).toString('hex'),{api}=await adapterApi();let observed,recorder
  try{
    const gateway=await createModelGateway({origin,capability,budget,requests:binding.requests,policy:CANDIDATE11_B2_POLICY,timeoutMs:binding.timeoutMs,fetchImpl:createPinnedProxyFetch(),
      recordRaw:async row=>{check(row.unitId===unitId&&row.requestSha===binding.units[index].requestSha&&recorder,'RAW_IDENTITY');await recorder.write(row);observed=row}})
    recorder=await createRawRecorder(rawPath);const started=Date.now(),response=await gateway.handle({method:'POST',path:'/api/real-input/recognize',headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','content-type':'application/json','x-real-input-capability':capability},bodyText:JSON.stringify({unitId,requestSha:binding.units[index].requestSha})})
    const packet=JSON.parse(readFileSync(join(B1,'PREPARED_REQUESTS.json'))).requests[index];let assembled=null,parseError=null,returnedModel=null
    if(observed)try{const envelope=JSON.parse(observed.rawHttpText),message=envelope.output?.at(-1);returnedModel=envelope.model;check(message?.type==='message'&&message.role==='assistant'&&message.content?.length===1&&message.content[0].type==='output_text','FINAL_MESSAGE');assembled=api.adaptModelWire(JSON.parse(message.content[0].text),packet.context).adapted}catch(error){parseError=typeof error?.message==='string'&&/^[A-Z0-9_]+$/.test(error.message)?error.message:'SCHEMA_OR_ADAPTER_REJECTED'}
    const after=await budget.snapshot(),reservation=after.reservations.find(value=>value.unitId===unitId)
    const result={version:'candidate11-b2-result-1',unitId,sourceId:packet.sourceId,variant:packet.variant,ordinal:packet.ordinal,bindingSha:hash(bindingBytes),requestSha:binding.units[index].requestSha,responseSha:observed?.responseSha??null,
      requestModel:binding.model,returnedModel,modelMatch:returnedModel===binding.model,httpStatus:response.status,diagnostic:response.diagnostic??null,waitingMs:Date.now()-started,parseError,assembled,
      ledgerStatus:reservation?.status??null,usage:reservation?.usage??null,costUpperMicroCny:reservation?.costUpperMicroCny??0,providerBilledCny:'NOT_OBSERVABLE',automaticRepair:false,retryCount:0}
    json(resultPath,result);return {unitId,httpStatus:result.httpStatus,parseError,ledgerStatus:result.ledgerStatus,waitingMs:result.waitingMs,costUpperMicroCny:result.costUpperMicroCny}
  }finally{if(recorder)await recorder.close()}
}

export async function dispatchAll(){
  const outputs=[]
  while(true){const {binding,grant}=verifySend(),budget=await openCandidate11B2Budget({ledgerPath:LEDGER_PATH,lockRoot:LOCK_ROOT,grant}),state=await budget.snapshot(),index=state.reservations.length
    if(index>=24)break
    const result=await dispatchCandidate11B2(binding.units[index].unitId);outputs.push(result);console.error(JSON.stringify(result))
    if(result.httpStatus!==200||result.ledgerStatus!=='settled')break
  }
  const {grant}=verifySend(),state=await openCandidate11B2Budget({ledgerPath:LEDGER_PATH,lockRoot:LOCK_ROOT,grant}).then(budget=>budget.snapshot())
  return {attempted:outputs.length,settled:state.reservations.filter(item=>item.status==='settled').length,complete:state.reservations.length===24&&state.reservations.every(item=>item.status==='settled'),stopped:state.stopped,last:outputs.at(-1)??null}
}

const CATEGORY={timeRaw:'time','times':'time','materials':'material','condition':'condition','dependencies':'dependency','revision':'revision','completionCriteria':'completion','semantics':'semantics','actionable':'condition'}
const categoryFor=path=>Object.entries(CATEGORY).find(([fragment])=>path.includes(fragment))?.[1]??'other'
function referencesValid(result,context){
  if(!result)return false
  const scopes=new Set(context.index.scopes.map(scope=>scope.id)),tasks=new Set((result.tasks??[]).map(task=>task.id)),materials=new Set((result.materials??[]).map(item=>item.tempId)),times=new Set((result.timePoints??[]).map(item=>item.tempId))
  const scopeArrays=[]
  for(const task of result.tasks??[]){scopeArrays.push(task.propositionScopeIds??[],task.condition?.conditionScopeIds??[],task.condition?.factScopeIds??[]);if((task.detail?.dependencyTempIds??[]).some(id=>!tasks.has(id))||(task.detail?.materialTempIds??[]).some(id=>!materials.has(id))||(task.detail?.timePointTempIds??[]).some(id=>!times.has(id)))return false}
  for(const item of [...(result.materials??[]),...(result.timePoints??[])]){scopeArrays.push(item.scopeIds??[]);if((item.relatedTaskTempIds??[]).some(id=>!tasks.has(id)))return false}
  for(const revision of result.revisions??[]){scopeArrays.push(revision.scopeIds??[]);if(!tasks.has(revision.targetDirectiveId)||(revision.fromDirectiveId!==null&&!tasks.has(revision.fromDirectiveId)))return false}
  return scopeArrays.flat().every(id=>scopes.has(id))
}

function adjudicateD06(score,result){
  if(!result||score.status!=='SCORED')return {status:'FAIL',reason:'schema_or_score_failure'}
  const map=Object.fromEntries(score.alignment.map(row=>[row.goldId,row.predictedId]));if(Object.values(map).some(value=>!value))return {status:'FAIL',reason:'missing_task_endpoint'}
  const expected=[['D06-T01','D06-OLD01'],['D06-T02','D06-OLD02']]
  const revisions=result.revisions??[],matched=expected.every(([from,target])=>revisions.some(item=>item.type==='supersedes'&&item.effective==='true'&&item.fromDirectiveId===map[from]&&item.targetDirectiveId===map[target]))
  return {status:matched&&revisions.length===2?'PASS':'FAIL',reason:matched&&revisions.length===2?'new_to_old_pairs_verified':'direction_or_pair_mismatch',mapping:map}
}

function teachingLeak(result,context){
  if(!result)return []
  const serialized=JSON.stringify(result),source=context.index.sourceContent,findings=[]
  for(const value of ['展务台','昨日'])if(serialized.includes(value)&&!source.includes(value))findings.push(value)
  const current=new Set(context.index.scopes.map(scope=>scope.id)),system=JSON.stringify(result)
  for(const id of system.match(/scope-[0-9]{4}-[a-f0-9]{64}/gu)??[])if(!current.has(id))findings.push(id)
  return [...new Set(findings)]
}

function scoreUnit(reference,result,context){
  const schemaValid=Boolean(result.assembled&&!result.parseError),score=scoreCandidate11(reference.scorerReference,result.assembled,{schemaValid}),referenceValid=schemaValid&&referencesValid(result.assembled,context)
  const fieldFailures=(score.alignment??[]).flatMap(row=>row.fields.filter(field=>!field.pass).map(field=>({goldId:row.goldId,path:field.path,category:categoryFor(field.path)})))
  const revisionAdjudication=reference.sourceId.endsWith('D06')?adjudicateD06(score,result.assembled):{status:'NOT_APPLICABLE'}
  const leaks=teachingLeak(result.assembled,context),task=score.taskMetrics?.alignment??{tp:0,fp:score.taskMetrics?.predicted??0,fn:score.expectedTasks??0,precision:null,recall:0}
  const forbidden=(task.fp??0)+leaks.length+(referenceValid?0:1),severe=(schemaValid&&referenceValid&&score.status==='SCORED'?0:1)+(revisionAdjudication.status==='FAIL'?1:0)
  const major=fieldFailures.length+(task.fn??0)+(task.fp??0)+(score.checks??[]).filter(item=>!item.pass).length+(revisionAdjudication.status==='FAIL'?1:0)
  const complete=score.complete===true&&referenceValid&&revisionAdjudication.status!=='FAIL'&&leaks.length===0
  return {schemaValid,referenceValid,score:{...score,complete},task:{...task,f1:task.precision===null||task.recall===null||task.precision+task.recall===0?0:2*task.precision*task.recall/(task.precision+task.recall)},fieldFailures,
    fieldCategories:Object.fromEntries(['time','material','condition','completion','dependency','revision','semantics','other'].map(category=>[category,fieldFailures.filter(item=>item.category===category).length])),
    complete,major,severe,forbidden,teachingLeak:leaks,revisionAdjudication,ambiguity:score.issues?.includes('ADJUDICATION_REQUIRED')?score.issues:[]}
}

function sumMetrics(cases){
  const tp=cases.reduce((n,row)=>n+row.evaluation.task.tp,0),fp=cases.reduce((n,row)=>n+row.evaluation.task.fp,0),fn=cases.reduce((n,row)=>n+row.evaluation.task.fn,0),precision=tp+fp?tp/(tp+fp):null,recall=tp+fn?tp/(tp+fn):null
  return {sources:cases.length,schemaAndReferenceValid:cases.filter(row=>row.evaluation.schemaValid&&row.evaluation.referenceValid).length,completeSources:cases.filter(row=>row.evaluation.complete).length,
    major:cases.reduce((n,row)=>n+row.evaluation.major,0),severe:cases.reduce((n,row)=>n+row.evaluation.severe,0),forbidden:cases.reduce((n,row)=>n+row.evaluation.forbidden,0),teachingLeak:cases.reduce((n,row)=>n+row.evaluation.teachingLeak.length,0),
    task:{tp,fp,fn,precision,recall,f1:precision===null||recall===null||precision+recall===0?0:2*precision*recall/(precision+recall)},promptBytes:cases.reduce((n,row)=>n+row.requestBytes,0),
    fieldCategories:Object.fromEntries(['time','material','condition','completion','dependency','revision','semantics','other'].map(category=>[category,cases.reduce((n,row)=>n+row.evaluation.fieldCategories[category],0)]))}
}

export async function analyzeCandidate11B2(){
  const {binding,bindingBytes,grant}=verifySend(),budget=await openCandidate11B2Budget({ledgerPath:LEDGER_PATH,lockRoot:LOCK_ROOT,grant}),state=await budget.snapshot()
  check(state.reservations.length===24&&state.reservations.every(item=>item.status==='settled')&&!state.stopped,'INCOMPLETE_RUN')
  const references=JSON.parse(readFileSync(join(B1,'REFERENCES.json'))).references,packets=JSON.parse(readFileSync(join(B1,'PREPARED_REQUESTS.json'))).requests,cases=[]
  for(const unit of binding.units){const result=JSON.parse(readFileSync(join(DIRECTORY,'results',unit.unitId+'.json'))),rawLines=readFileSync(join(DIRECTORY,'raw',unit.unitId+'.jsonl'),'utf8').trimEnd().split('\n').map(JSON.parse)
    check(rawLines.length===1&&rawLines[0].responseSha===hash(rawLines[0].rawHttpText)&&result.responseSha===rawLines[0].responseSha&&result.ledgerStatus==='settled','RESULT_INTEGRITY')
    const reference=references.find(item=>item.sourceId===unit.sourceId),packet=packets.find(item=>item.unitId===unit.unitId),evaluation=scoreUnit(reference,result,packet.context)
    cases.push({unitId:unit.unitId,ordinal:unit.ordinal,sourceId:unit.sourceId,variant:unit.variant,requestBytes:unit.requestBytes,responseSha:result.responseSha,usage:result.usage,costUpperMicroCny:result.costUpperMicroCny,waitingMs:result.waitingMs,evaluation})}
  const variants=['V00','V10','V01','V11'],arms=Object.fromEntries(variants.map(variant=>[variant,sumMetrics(cases.filter(row=>row.variant===variant))]))
  const validRun=cases.length===24&&cases.every(row=>row.evaluation.ambiguity.length===0),baseline=arms.V00
  let decision='NO_ADDITIVE_COMPONENT_SELECTED',selected=null
  if(!validRun)decision='INVALID_RUN'
  else if(baseline.severe>0||baseline.forbidden>0||baseline.task.fn>0||cases.filter(row=>row.variant==='V00').some(row=>row.sourceId.endsWith('D01')&&row.evaluation.fieldCategories.completion>0))decision='REJECT_CANDIDATE11'
  else{
    const eligible=variants.slice(1).filter(variant=>{const arm=arms[variant];return arm.schemaAndReferenceValid===6&&arm.severe===0&&arm.forbidden===0&&arm.teachingLeak===0&&arm.task.fn<=baseline.task.fn
      &&['time','material','condition','revision','completion'].every(category=>arm.fieldCategories[category]<=baseline.fieldCategories[category])&&arm.completeSources>=baseline.completeSources+1&&arm.major<=baseline.major&&arm.task.recall>=baseline.task.recall})
    eligible.sort((a,b)=>arms[b].completeSources-arms[a].completeSources||arms[a].major-arms[b].major||arms[b].task.f1-arms[a].task.f1||arms[a].promptBytes-arms[b].promptBytes||variants.indexOf(a)-variants.indexOf(b))
    if(eligible.length){selected=eligible[0];decision='SELECT_'+selected}
  }
  const pairs=[];for(const sourceId of [...new Set(cases.map(row=>row.sourceId))])pairs.push({sourceId,...Object.fromEntries(variants.map(variant=>[variant,cases.find(row=>row.sourceId===sourceId&&row.variant===variant).evaluation.complete]))})
  const factorial={M:{withoutExamples:arms.V10.completeSources-arms.V00.completeSources,withExamples:arms.V11.completeSources-arms.V01.completeSources},E:{withoutMethod:arms.V01.completeSources-arms.V00.completeSources,withMethod:arms.V11.completeSources-arms.V10.completeSources},interaction:arms.V11.completeSources-arms.V10.completeSources-arms.V01.completeSources+arms.V00.completeSources,metric:'complete source count; descriptive only'}
  const ledgerBytes=readFileSync(LEDGER_PATH),output={version:'candidate11-b2-analysis-1',status:'B2_DEVELOPMENT_RESULTS_READY_FOR_REVIEW',evaluationType:'seen-development-ablation',validRun,bindingSha:hash(bindingBytes),requests:24,sources:6,variants,arms,pairs,factorial,decision,selected,cases,
    operational:{actualCalls:24,providerBilledCny:'NOT_OBSERVABLE',localAuditableCostUpperMicroCny:cases.reduce((n,row)=>n+row.costUpperMicroCny,0),authorizedWorstMicroCny:51904512,usage:{inputTokens:cases.reduce((n,row)=>n+row.usage.input_tokens,0),outputTokens:cases.reduce((n,row)=>n+row.usage.output_tokens,0)}},
    ledger:{before:read('BASELINE.json').ledger,after:{path:LEDGER_PATH,rows:state.ledger.rows,bytes:state.ledger.bytes,sha256:hash(ledgerBytes),tail:state.ledger.tail,nextSequence:state.ledger.nextSequence}},
    boundaries:['Development only','single engineering author/model-assisted reference','no significance or generalization claim','not a real accept-and-save conversion rate','no Holdout, human trial, deployment or production authorization'],generatedAt:new Date().toISOString()}
  json(join(DIRECTORY,'ANALYSIS.json'),output)
  const lines=['# Candidate11 B2 Development 消融评测','',`状态：\`${output.status}\`。`,'' ,'本批严格执行 24 个冻结请求；结果仅用于已见 Development 工程筛选，不是独立 Holdout、真人试用或识别转化率。','',`候选决定：\`${decision}\`${selected?`（${selected}）`:''}。`,'', '| 变体 | 完整来源 | TP / FP / FN | P / R / F1 | Major | Severe | Forbidden | 教学例越界 |','|---|---:|---:|---:|---:|---:|---:|---:|',
    ...variants.map(v=>{const a=arms[v],pct=x=>x===null?'NA':(x*100).toFixed(2)+'%';return `| ${v} | ${a.completeSources}/6 | ${a.task.tp} / ${a.task.fp} / ${a.task.fn} | ${pct(a.task.precision)} / ${pct(a.task.recall)} / ${pct(a.task.f1)} | ${a.major} | ${a.severe} | ${a.forbidden} | ${a.teachingLeak} |`}),
    '',`描述性效应：M（无 E / 有 E）=${factorial.M.withoutExamples} / ${factorial.M.withExamples}；E（无 M / 有 M）=${factorial.E.withoutMethod} / ${factorial.E.withMethod}；M×E=${factorial.interaction}。`,
    '',`实际调用：24；本地可审计费用上界：CNY ${(output.operational.localAuditableCostUpperMicroCny/1e6).toFixed(6)}；provider 实际扣费：NOT_OBSERVABLE。`,
    '',`账本：${output.ledger.after.rows} 行，SHA-256 \`${output.ledger.after.sha256}\`，tail \`${output.ledger.after.tail}\`。`,'','历史 RCO-5-007 保留：`FREEZE_HASH_MISMATCH:package-lock.json`。','']
  writeFileSync(join(DIRECTORY,'REPORT.md'),lines.join('\n'),{flag:'wx'})
  return output
}

if(import.meta.url===pathToFileURL(process.argv[1]).href){const args=process.argv.slice(2)
  if(args.length===1&&args[0]==='--prepare')console.log(JSON.stringify(await prepareCandidate11B2()))
  else if(args.length===1&&args[0]==='--dispatch-all')console.log(JSON.stringify(await dispatchAll()))
  else if(args.length===1&&args[0]==='--analyze')console.log(JSON.stringify(await analyzeCandidate11B2()))
  else if(args.length===1&&args[0].startsWith('--dispatch='))console.log(JSON.stringify(await dispatchCandidate11B2(args[0].slice(11))))
  else throw Error('CANDIDATE11_B2_RUNNER_ARGUMENT')}
