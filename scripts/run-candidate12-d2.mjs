import {createHash,randomUUID} from 'node:crypto'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {isDeepStrictEqual} from 'node:util'
import {build} from 'esbuild'
import {createPinnedProxyFetch,createRawRecorder,inspectRequest,assertModelGatewayConfigured} from './real-input-model-gateway.mjs'
import {CANDIDATE11_B2_UNIT_POLICY} from './real-input-budget.mjs'
import {CANDIDATE12_D2_POLICY,openCandidate12D2Budget} from './candidate12-d2-budget.mjs'
import {scoreCandidate11} from './score-candidate11-recognition.mjs'
import {verifyProtectedFiles} from './verify-candidate11-analysis.mjs'

export const DIRECTORY='docs/recognition-optimization/candidate12/d2-provisional-development-20260921a'
const D1='docs/recognition-optimization/candidate12/d1-provisional-paired-preparation'
const LEDGER_PATH=resolve('C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')
const EXISTING_SERVER_ENV=resolve('C:/Users/Winner/student-affairs-multimodal-exp/.env')
const LOCK_ROOT=resolve('C:/Users/Winner/student-affairs-multimodal-exp/.data/candidate12-d2-20260921a')
const D1_MANIFEST_SHA='e2a14c8a920613f8cdd44afa57699f674f266f102df28b2eb926e1b750b1e005'
const LEDGER_PREFIX={rows:693,reserves:338,bytes:572913,sha256:'2051d8e775123579c3fa262f671a757e690983f64bc5945d692faaeb24b5322e',tail:'13b520d270d26335072f99920e47a4443e8bc586365eb20cda61c4122d7ab3bd'}
const BRANCH='codex/e2-candidate11-blind-eval'
const hash=value=>createHash('sha256').update(value).digest('hex')
const check=(value,code)=>{if(!value)throw Error('CANDIDATE12_D2_RUNNER_'+code)}
const read=name=>JSON.parse(readFileSync(join(DIRECTORY,name),'utf8'))
const shaFile=path=>({path:path.replaceAll('\\','/'),sha256:hash(readFileSync(path))})
const json=(path,value)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n',{flag:'wx'})
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim()
const changedPaths=()=>[...git(['diff','--name-only']).split('\n'),...git(['ls-files','--others','--exclude-standard']).split('\n')].filter(Boolean).map(path=>path.replaceAll('\\','/'))
const allowedPath=path=>path.startsWith(DIRECTORY+'/')

async function adapterApi(){
  const output=await build({stdin:{contents:`export {adaptModelWire,WIRE_VERSION} from './src/experiments/realInput01/modelWire.ts';`,resolveDir:process.cwd(),loader:'ts'},
    bundle:true,write:false,platform:'node',format:'esm',metafile:true,logLevel:'silent'})
  const dependencies=Object.keys(output.metafile.inputs).filter(path=>path!=='<stdin>').sort().map(shaFile)
  return {dependencies,api:await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].contents).toString('base64'))}
}

function currentGit(requireClean=true){
  const head=git(['rev-parse','HEAD']),branch=git(['branch','--show-current']),upstream=git(['rev-parse','@{u}'])
  check(branch===BRANCH&&head===upstream,'LOCAL_REMOTE')
  const remote=git(['ls-remote','origin','refs/heads/'+BRANCH]).split(/\s+/u)[0]
  check(remote===head,'REMOTE_HEAD')
  if(requireClean)check(changedPaths().length===0,'WORKTREE_NOT_CLEAN')
  return {head,branch,upstream,remote}
}

function inspectLedgerExact(){
  const bytes=readFileSync(LEDGER_PATH),lines=bytes.toString('utf8').trimEnd().split('\n'),rows=lines.map(JSON.parse)
  check(lines.length===LEDGER_PREFIX.rows&&bytes.length===LEDGER_PREFIX.bytes&&hash(bytes)===LEDGER_PREFIX.sha256,'LEDGER_PREFIX')
  const reserves=rows.filter(row=>['reserve','recoveryReserve','batchReserve','candidate11Reserve'].includes(row.event.kind)).length
  check(reserves===LEDGER_PREFIX.reserves&&rows.at(-1).sequence===692&&rows.at(-1).hash===LEDGER_PREFIX.tail,'LEDGER_BASELINE')
  return {bytes,rows}
}

function verifyD1(){
  const output=execFileSync(process.execPath,['scripts/prepare-candidate12-d1.mjs','--verify'],{encoding:'utf8'})
  const result=JSON.parse(output.trim())
  check(result.requests===24&&result.protectedFiles===84&&result.modelCalls===0&&result.manifestSha256===D1_MANIFEST_SHA,'D1_VERIFY')
  check(hash(readFileSync(join(D1,'PREPARATION_MANIFEST.json')))===D1_MANIFEST_SHA,'D1_MANIFEST')
  return result
}

function unitFrom(packet,manifestUnit){
  const identity=inspectRequest(packet.requestSerialized,CANDIDATE11_B2_UNIT_POLICY)
  const keys=['unitId','ordinal','sourceId','sourceVersionId','arm','position','sourceSha256','referenceSha256','candidateVersion','candidateBundleSha','identitySha','unitIdentitySha','requestSha','inputSha','promptSha','exampleSha','schemaSha','requestBytes']
  check(keys.every(key=>packet[key]===manifestUnit[key]),'PACKET_MANIFEST_IDENTITY')
  check(identity.requestSha===packet.requestSha&&identity.requestBytes===packet.requestBytes&&identity.inputSha===packet.inputSha,'REQUEST_IDENTITY')
  return Object.fromEntries(keys.map(key=>[key,packet[key]]).concat([
    ['scorerSha',hash(readFileSync('scripts/score-candidate11-recognition.mjs'))],['adapterVersion','real-input-model-wire-1'],['candidateSha',identity.candidateSha],
  ]))
}

function verifyDependencies(binding){
  for(const file of binding.dependencies)check(existsSync(file.path)&&hash(readFileSync(file.path))===file.sha256,'DEPENDENCY:'+file.path)
  for(const path of changedPaths())check(allowedPath(path),'WORKTREE_SCOPE:'+path)
  const head=git(['rev-parse','HEAD']),upstream=git(['rev-parse','@{u}']),branch=git(['branch','--show-current'])
  check(head===binding.head&&upstream===head&&branch===BRANCH,'GIT_BINDING')
  const remote=git(['ls-remote','origin','refs/heads/'+BRANCH]).split(/\s+/u)[0]
  check(remote===head,'REMOTE_BINDING')
  check(verifyProtectedFiles().count===84,'PROTECTED_FILES')
  if(readFileSync(LEDGER_PATH).length===LEDGER_PREFIX.bytes)verifyD1()
}

export async function prepareCandidate12D2(){
  const gitState=currentGit(true),d1Check=verifyD1(),{bytes:ledgerBytes}=inspectLedgerExact()
  check(!existsSync(DIRECTORY)&&!existsSync(LOCK_ROOT),'OUTPUT_OR_LOCK_EXISTS')
  mkdirSync(join(DIRECTORY,'raw'),{recursive:true});mkdirSync(join(DIRECTORY,'results'),{recursive:true})
  const manifest=JSON.parse(readFileSync(join(D1,'PREPARATION_MANIFEST.json'))),packets=JSON.parse(readFileSync(join(D1,'PREPARED_REQUEST_IDENTITIES.json'))).requests
  check(manifest.requestCount===24&&packets.length===24&&manifest.units.length===24,'D1_COUNT')
  const units=packets.map((packet,index)=>{check(packet.unitId===manifest.units[index].unitId&&packet.ordinal===index+1,'D1_ORDER');return unitFrom(packet,manifest.units[index])})
  const requests=Object.fromEntries(packets.map(packet=>[packet.unitId,packet.requestSerialized]))
  const {dependencies:adapterDependencies,api}=await adapterApi();check(api.WIRE_VERSION==='real-input-model-wire-1','ADAPTER_VERSION')
  const dependencyPaths=['scripts/real-input-budget.mjs','scripts/real-input-model-gateway.mjs','scripts/candidate12-d2-budget.mjs','scripts/run-candidate12-d2.mjs','scripts/score-candidate11-recognition.mjs','scripts/prepare-candidate12-d1.mjs','scripts/verify-candidate11-analysis.mjs',
    join(D1,'PREPARATION_MANIFEST.json'),join(D1,'PREPARED_REQUEST_IDENTITIES.json'),join(D1,'PROVISIONAL_REFERENCES.json'),join(D1,'PROVISIONAL_SOURCES.json'),
    'src/experiments/realInput01/candidate03.ts','src/experiments/realInput01/candidate12.ts','src/experiments/realInput01/modelWire.ts','src/experiments/mainline04/semanticContract.ts']
  const dependencies=[...new Map([...dependencyPaths.map(shaFile),...adapterDependencies].map(file=>[file.path,file])).values()].sort((a,b)=>a.path.localeCompare(b.path))
  const binding={version:'candidate12-d2-binding-1',head:gitState.head,branch:BRANCH,evaluationType:'seen-synthetic-provisional-development',truthStatus:'PROVISIONAL_MODEL_AUTHORED',claimCeiling:'ENGINEERING_SCREENING_ONLY',
    model:'deepseek-flash',temperature:0,reasoning:'none',maxOutputTokens:8192,timeoutMs:120000,d1ManifestSha:D1_MANIFEST_SHA,units,requests,dependencies,
    adapterVersion:api.WIRE_VERSION,scorerVersion:'candidate11-scoring-2.0.0',scorerSha:hash(readFileSync('scripts/score-candidate11-recognition.mjs')),
    referenceSha:hash(readFileSync(join(D1,'PROVISIONAL_REFERENCES.json'))),createdAt:new Date().toISOString()}
  const checkedAt=new Date(),billing={version:'candidate12-d2-billing-1',verified:true,method:'official-deepseek-document-review',checkedAt:checkedAt.toISOString(),validUntil:new Date(checkedAt.getTime()+12*60*60*1000).toISOString(),
    route:{endpoint:'https://api.deepseek.com/responses',model:'deepseek-flash',mappedModel:'DeepSeek V4.1 Flash',temperature:0,reasoning:'none',maxOutputTokens:8192},policy:CANDIDATE12_D2_POLICY,
    peakPrices:{uncachedInputCnyPerMillion:2,outputCnyPerMillion:8},perRequestWorstCny:2.162688,batchWorstCny:51.904512,
    documents:[{url:'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',claim:'deepseek-flash maps to V4.1 Flash; peak uncached input CNY 2/M and output CNY 8/M'},
      {url:'https://api-docs.deepseek.com/zh-cn/news/news260910/',claim:'official V4.1 Flash release and model mapping'}]}
  const authorization={version:'candidate12-d2-authorization-1',authorized:true,evidenceType:'INTERACTIVE_USER_MESSAGE',userMessage:'执行下一步',
    interpretation:'Direct reply to the immediately preceding concrete D2 proposal: 24 frozen requests, CNY 51.904512 worst-case cap, one authoritative ledger writer, zero retry, zero repair and zero verifier.',
    authorizedCalls:24,maxBudgetCny:51.904512,authorizedAt:new Date().toISOString(),repair:0,verifier:0,retry:0}
  const review={version:'candidate12-d2-send-review-1',status:'PASS',authorizationSha:hash(JSON.stringify(authorization,null,2)+'\n'),grantId:randomUUID(),head:binding.head,d1ManifestSha:D1_MANIFEST_SHA,
    bindingSha:hash(JSON.stringify(binding,null,2)+'\n'),billingSha:hash(JSON.stringify(billing)),sourcesSha:hash(JSON.stringify(dependencies)),d1Check,checkedAt:new Date().toISOString(),
    constraints:{calls:24,repair:0,verifier:0,retry:0,maxBudgetCny:51.904512}}
  const baseline={version:'candidate12-d2-baseline-1',head:binding.head,branch:BRANCH,ledger:{path:LEDGER_PATH,rows:693,reserves:338,bytes:ledgerBytes.length,sha256:hash(ledgerBytes),tail:LEDGER_PREFIX.tail,nextSequence:693},
    d1ManifestSha:D1_MANIFEST_SHA,lockRoot:LOCK_ROOT,modelCalls:0,createdAt:new Date().toISOString()}
  for(const [name,value] of [['AUTHORIZATION.json',authorization],['BASELINE.json',baseline],['BINDING.json',binding],['BILLING.json',billing],['SEND_REVIEW.json',review]])json(join(DIRECTORY,name),value)
  const grant=grantFromFiles();json(join(DIRECTORY,'GRANT.json'),grant)
  return {status:'READY',head:binding.head,requests:24,budgetCny:51.904512,bindingSha:review.bindingSha,grantId:review.grantId}
}

function grantFromFiles(){
  const bindingBytes=readFileSync(join(DIRECTORY,'BINDING.json')),binding=JSON.parse(bindingBytes),baseline=read('BASELINE.json'),billing=read('BILLING.json'),review=read('SEND_REVIEW.json')
  return {version:'candidate12-d2-grant-1',grantId:review.grantId,parentTail:baseline.ledger.tail,parentSequence:baseline.ledger.nextSequence,ledgerPrefixBytes:baseline.ledger.bytes,ledgerPrefixSha:baseline.ledger.sha256,
    d1ManifestSha:D1_MANIFEST_SHA,bindingSha:hash(bindingBytes),head:binding.head,sourcesSha:review.sourcesSha,reviewSha:hash(JSON.stringify(review)),targets:binding.units,
    billingEvidence:{checkedAt:billing.checkedAt,validUntil:billing.validUntil,evidenceSha:hash(JSON.stringify(billing)),documents:billing.documents},route:{endpoint:billing.route.endpoint,model:billing.route.model,temperature:0,reasoning:'none',maxOutputTokens:8192},
    lockRoot:LOCK_ROOT,maxBatchRequests:24,maxTotalRequests:362,maxBatchBudgetMicroCny:51904512,policy:CANDIDATE12_D2_POLICY,repair:0,verifier:0,retry:0}
}

export function verifyCandidate12D2Send(){
  const bindingBytes=readFileSync(join(DIRECTORY,'BINDING.json')),binding=JSON.parse(bindingBytes),baseline=read('BASELINE.json'),billing=read('BILLING.json'),review=read('SEND_REVIEW.json'),grant=read('GRANT.json'),authorization=read('AUTHORIZATION.json')
  verifyDependencies(binding)
  check(authorization.authorized===true&&authorization.authorizedCalls===24&&authorization.maxBudgetCny===51.904512
    &&hash(readFileSync(join(DIRECTORY,'AUTHORIZATION.json')))===review.authorizationSha,'AUTHORIZATION')
  check(hash(bindingBytes)===review.bindingSha&&hash(JSON.stringify(billing))===review.billingSha&&hash(JSON.stringify(binding.dependencies))===review.sourcesSha,'REVIEW_BINDING')
  check(isDeepStrictEqual(grant,grantFromFiles()),'GRANT_DRIFT')
  check(Date.now()>=Date.parse(billing.checkedAt)&&Date.now()<=Date.parse(billing.validUntil)&&billing.verified,'PRICE_VALIDITY')
  const ledger=readFileSync(LEDGER_PATH);check(ledger.length>=baseline.ledger.bytes&&hash(ledger.subarray(0,baseline.ledger.bytes))===baseline.ledger.sha256,'LEDGER_PREFIX')
  for(const unit of binding.units){const identity=inspectRequest(binding.requests[unit.unitId],CANDIDATE11_B2_UNIT_POLICY);check(['requestSha','requestBytes','candidateSha','inputSha'].every(key=>identity[key]===unit[key]),'UNIT_IDENTITY')}
  return {bindingBytes,binding,baseline,billing,review,grant}
}

function rejectCredentialReflection(raw,secret){
  JSON.parse(raw)
  const pending=[{text:raw,depth:0}],seen=new Set();let inspected=0
  while(pending.length){const {text,depth}=pending.pop();check(!text.includes(secret),'CREDENTIAL_ECHO');if(seen.has(text))continue;seen.add(text);inspected+=text.length;check(depth<=32&&inspected<=4194304,'RESPONSE_INSPECTION_LIMIT')
    const tokens=/"(?:\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})|[^"\\\u0000-\u001f])*"/g
    for(const token of text.matchAll(tokens)){const decoded=JSON.parse(token[0]);check(!decoded.includes(secret),'CREDENTIAL_ECHO');if(decoded.includes('"'))pending.push({text:decoded,depth:depth+1})}}
}

async function readResponseBody(response,limit=524288){
  check(response.status===200,'UPSTREAM_HTTP')
  check(response.headers.get('content-type')?.split(';')[0].trim()==='application/json'&&response.body,'UPSTREAM_PROTOCOL')
  const chunks=[],reader=response.body.getReader();let bytes=0
  try{while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;check(bytes<=limit,'UPSTREAM_LIMIT');chunks.push(next.value)}}finally{reader.releaseLock()}
  return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))
}

async function materializeResult(binding,bindingBytes,index,rawRow,reservation){
  const unit=binding.units[index],packet=JSON.parse(readFileSync(join(D1,'PREPARED_REQUEST_IDENTITIES.json'))).requests[index],{api}=await adapterApi()
  check(rawRow.unitId===unit.unitId&&rawRow.requestSha===unit.requestSha&&rawRow.candidateSha===unit.candidateSha&&rawRow.inputSha===unit.inputSha
    &&rawRow.responseSha===hash(rawRow.rawHttpText)&&reservation.unitId===unit.unitId&&reservation.status==='settled'&&reservation.responseSha===rawRow.responseSha,'RECOVERY_BINDING')
  let assembled=null,parseError=null,returnedModel=null
  try{const envelope=JSON.parse(rawRow.rawHttpText),message=envelope.output?.at(-1);returnedModel=envelope.model;check(message?.type==='message'&&message.role==='assistant'&&message.content?.length===1&&message.content[0].type==='output_text','FINAL_MESSAGE');assembled=api.adaptModelWire(JSON.parse(message.content[0].text),packet.prepared.context).adapted}
  catch(error){parseError=typeof error?.message==='string'&&/^[A-Z0-9_]+$/.test(error.message)?error.message:'SCHEMA_OR_ADAPTER_REJECTED'}
  const result={version:'candidate12-d2-result-1',unitId:unit.unitId,sourceId:packet.sourceId,arm:packet.arm,ordinal:packet.ordinal,bindingSha:hash(bindingBytes),requestSha:unit.requestSha,responseSha:rawRow.responseSha,
    requestModel:binding.model,returnedModel,modelMatch:returnedModel===binding.model,httpStatus:200,diagnostic:null,waitingMs:rawRow.waitingMs??null,parseError,assembled,
    ledgerStatus:'settled',usage:reservation.usage,costUpperMicroCny:reservation.costUpperMicroCny,providerBilledCny:'NOT_OBSERVABLE',automaticRepair:false,retryCount:0}
  json(join(DIRECTORY,'results',unit.unitId+'.json'),result)
  return result
}

async function reconcileAndMaterialize(){
  const {binding,grant,bindingBytes}=verifyCandidate12D2Send(),budget=await openCandidate12D2Budget({ledgerPath:LEDGER_PATH,lockRoot:LOCK_ROOT,grant})
  let state=await budget.snapshot(),pending=state.reservations.at(-1)
  if(pending?.status==='pending'){
    const rawPath=join(DIRECTORY,'raw',pending.unitId+'.jsonl')
    if(!existsSync(rawPath)){await budget.reconcilePending(null);return budget.snapshot()}
    const lines=readFileSync(rawPath,'utf8').trimEnd().split('\n').filter(Boolean).map(JSON.parse)
    check(lines.length===1&&lines[0].unitId===pending.unitId&&lines[0].requestSha===pending.requestSha&&lines[0].responseSha===hash(lines[0].rawHttpText),'PENDING_RAW_IDENTITY')
    await budget.reconcilePending(lines[0].rawHttpText);state=await budget.snapshot()
  }
  for(const [index,reservation] of state.reservations.entries())if(reservation.status==='settled'){
    const resultPath=join(DIRECTORY,'results',reservation.unitId+'.json')
    if(existsSync(resultPath))continue
    const lines=readFileSync(join(DIRECTORY,'raw',reservation.unitId+'.jsonl'),'utf8').trimEnd().split('\n').filter(Boolean).map(JSON.parse)
    check(lines.length===1,'RECOVERY_RAW_COUNT');await materializeResult(binding,bindingBytes,index,lines[0],reservation)
  }
  return state
}

export async function dispatchCandidate12D2(unitId){
  check(/^C12-D1-PD(?:0[1-9]|1[0-2])-[AB]$/.test(unitId),'UNIT_ID')
  const {binding,grant,bindingBytes}=verifyCandidate12D2Send(),budget=await openCandidate12D2Budget({ledgerPath:LEDGER_PATH,lockRoot:LOCK_ROOT,grant}),before=await budget.snapshot(),index=before.reservations.length
  check(index<24&&binding.units[index]?.unitId===unitId&&!before.stopped&&before.reservations.every(value=>value.status==='settled'),'NEXT_UNIT')
  const rawPath=join(DIRECTORY,'raw',unitId+'.jsonl'),resultPath=join(DIRECTORY,'results',unitId+'.json');check(!existsSync(rawPath)&&!existsSync(resultPath),'ALREADY_ATTEMPTED')
  const envPath=existsSync(resolve('.env'))?resolve('.env'):EXISTING_SERVER_ENV
  if(existsSync(envPath))process.loadEnvFile(envPath)
  try{assertModelGatewayConfigured()}catch{check(false,'SERVER_CONFIGURATION_UNAVAILABLE')}
  const fetchImpl=createPinnedProxyFetch()
  let secret=process.env.DEEPSEEK_API_KEY,recorder,lease,observed,settleAttempted=false,controller,timer,started=Date.now()
  try{
    recorder=await createRawRecorder(rawPath)
    lease=await budget.reserve(unitId,binding.requests[unitId],CANDIDATE11_B2_UNIT_POLICY,new Date().toISOString())
    controller=new AbortController();timer=setTimeout(()=>controller.abort(),binding.timeoutMs)
    const response=await fetchImpl('https://api.deepseek.com/responses',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:binding.requests[unitId],redirect:'manual',signal:controller.signal})
    const raw=await readResponseBody(response);clearTimeout(timer);JSON.parse(raw);rejectCredentialReflection(raw,secret)
    observed={version:'candidate12-d2-raw-result-1',unitId,requestSha:binding.units[index].requestSha,candidateSha:binding.units[index].candidateSha,inputSha:binding.units[index].inputSha,
      receivedAt:new Date().toISOString(),httpStatus:200,waitingMs:Date.now()-started,rawHttpText:raw,responseSha:hash(raw)}
    await recorder.write(observed);settleAttempted=true;const settled=await lease.complete(raw,200)
    const result=await materializeResult(binding,bindingBytes,index,observed,{...settled,unitId,status:'settled'})
    return {unitId,httpStatus:result.httpStatus,parseError:result.parseError,ledgerStatus:result.ledgerStatus,waitingMs:result.waitingMs,costUpperMicroCny:result.costUpperMicroCny}
  }catch(error){
    controller?.abort();clearTimeout(timer)
    if(lease&&!settleAttempted)try{await lease.uncertain()}catch{}
    throw error
  }finally{if(recorder)await recorder.close();secret=undefined}
}

export async function dispatchAll(){
  const outputs=[]
  while(true){const recovered=await reconcileAndMaterialize();if(recovered.stopped)break
    const {binding,grant}=verifyCandidate12D2Send(),budget=await openCandidate12D2Budget({ledgerPath:LEDGER_PATH,lockRoot:LOCK_ROOT,grant}),state=await budget.snapshot(),index=state.reservations.length
    if(index>=24||state.stopped)break
    const result=await dispatchCandidate12D2(binding.units[index].unitId);outputs.push(result);console.error(JSON.stringify(result))
    if(result.ledgerStatus!=='settled')break
  }
  const {grant}=verifyCandidate12D2Send(),state=await openCandidate12D2Budget({ledgerPath:LEDGER_PATH,lockRoot:LOCK_ROOT,grant}).then(budget=>budget.snapshot())
  return {attempted:outputs.length,settled:state.reservations.filter(item=>item.status==='settled').length,complete:state.reservations.length===24&&state.reservations.every(item=>item.status==='settled'),stopped:state.stopped,last:outputs.at(-1)??null}
}

const CATEGORY={timeRaw:'time',times:'time',materials:'material',condition:'condition',dependencies:'dependency',revision:'revision',completionCriteria:'completion',semantics:'semantics',actionable:'condition'}
const categoryFor=path=>Object.entries(CATEGORY).find(([fragment])=>path.includes(fragment))?.[1]??'other'
function referencesValid(result,context){
  if(!result)return false
  const scopes=new Set(context.index.scopes.map(scope=>scope.id)),tasks=new Set((result.tasks??[]).map(task=>task.id)),materials=new Set((result.materials??[]).map(item=>item.tempId)),times=new Set((result.timePoints??[]).map(item=>item.tempId)),scopeArrays=[]
  for(const task of result.tasks??[]){scopeArrays.push(task.propositionScopeIds??[],task.condition?.conditionScopeIds??[],task.condition?.factScopeIds??[]);if((task.detail?.dependencyTempIds??[]).some(id=>!tasks.has(id))||(task.detail?.materialTempIds??[]).some(id=>!materials.has(id))||(task.detail?.timePointTempIds??[]).some(id=>!times.has(id)))return false}
  for(const item of [...(result.materials??[]),...(result.timePoints??[])]){scopeArrays.push(item.scopeIds??[]);if((item.relatedTaskTempIds??[]).some(id=>!tasks.has(id)))return false}
  for(const revision of result.revisions??[]){scopeArrays.push(revision.scopeIds??[]);if(!tasks.has(revision.targetDirectiveId)||(revision.fromDirectiveId!==null&&!tasks.has(revision.fromDirectiveId)))return false}
  return scopeArrays.flat().every(id=>scopes.has(id))
}

function adjudicateRevisions(reference,score,result){
  if(!reference.revisions.length)return {status:'NOT_APPLICABLE'}
  if(!result||score.status!=='SCORED')return {status:'FAIL',reason:'schema_or_score_failure'}
  const map=Object.fromEntries(score.alignment.map(row=>[row.goldId,row.predictedId]));if(Object.values(map).some(value=>!value))return {status:'FAIL',reason:'missing_task_endpoint'}
  const expected=reference.revisions,actual=result.revisions??[]
  const matched=expected.every(item=>actual.some(value=>value.type===item.type&&value.effective===(item.effective?'true':'false')
    &&value.targetDirectiveId===map[item.targetObligationId]&&value.fromDirectiveId===(item.fromObligationId===null?null:map[item.fromObligationId])))
  return {status:matched&&actual.length===expected.length?'PASS':'FAIL',reason:matched&&actual.length===expected.length?'endpoint_pairs_verified':'direction_pair_or_count_mismatch',mapping:map}
}

function teachingLeak(result,context){
  if(!result)return []
  const current=new Set(context.index.scopes.map(scope=>scope.id)),serialized=JSON.stringify(result),findings=[]
  for(const id of serialized.match(/scope-[0-9]{4}-[a-f0-9]{64}/gu)??[])if(!current.has(id))findings.push(id)
  return [...new Set(findings)]
}

function scoreUnit(referenceEntry,result,context){
  const reference=referenceEntry.reference,schemaValid=Boolean(result.assembled&&!result.parseError),score=scoreCandidate11(reference.scorerReference,result.assembled,{schemaValid}),referenceValid=schemaValid&&referencesValid(result.assembled,context)
  const fieldFailures=(score.alignment??[]).flatMap(row=>row.fields.filter(field=>!field.pass).map(field=>({goldId:row.goldId,path:field.path,category:categoryFor(field.path)})))
  const revisionAdjudication=adjudicateRevisions(reference,score,result.assembled),leaks=teachingLeak(result.assembled,context),task=score.taskMetrics?.alignment??{tp:0,fp:score.taskMetrics?.predicted??0,fn:score.expectedTasks??0,precision:null,recall:0}
  const checkFailures=(score.checks??[]).filter(item=>!item.pass).length,forbidden=(task.fp??0)+leaks.length+(referenceValid?0:1),severe=(schemaValid&&referenceValid&&score.status==='SCORED'?0:1)+(revisionAdjudication.status==='FAIL'?1:0)
  const criticalMajor=fieldFailures.length+checkFailures+(revisionAdjudication.status==='FAIL'?1:0),major=criticalMajor+(task.fn??0)+(task.fp??0),complete=score.complete===true&&referenceValid&&revisionAdjudication.status!=='FAIL'&&leaks.length===0
  return {determinate:true,schemaValid,referenceValid,score:{...score,complete},task:{...task,f1:task.precision===null||task.recall===null||task.precision+task.recall===0?0:2*task.precision*task.recall/(task.precision+task.recall)},fieldFailures,
    fieldCategories:Object.fromEntries(['time','material','condition','completion','dependency','revision','semantics','other'].map(category=>[category,fieldFailures.filter(item=>item.category===category).length])),
    complete,criticalMajor,major,severe,forbidden,teachingLeak:leaks,revisionAdjudication,ambiguity:score.issues?.includes('ADJUDICATION_REQUIRED')?score.issues:[]}
}

function sumMetrics(cases){
  const tp=cases.reduce((n,row)=>n+row.evaluation.task.tp,0),fp=cases.reduce((n,row)=>n+row.evaluation.task.fp,0),fn=cases.reduce((n,row)=>n+row.evaluation.task.fn,0),precision=tp+fp?tp/(tp+fp):null,recall=tp+fn?tp/(tp+fn):null
  return {sources:cases.length,determinate:cases.filter(row=>row.evaluation.determinate).length,schemaAndReferenceValid:cases.filter(row=>row.evaluation.schemaValid&&row.evaluation.referenceValid).length,completeSources:cases.filter(row=>row.evaluation.complete).length,
    criticalMajor:cases.reduce((n,row)=>n+row.evaluation.criticalMajor,0),major:cases.reduce((n,row)=>n+row.evaluation.major,0),severe:cases.reduce((n,row)=>n+row.evaluation.severe,0),forbidden:cases.reduce((n,row)=>n+row.evaluation.forbidden,0),teachingLeak:cases.reduce((n,row)=>n+row.evaluation.teachingLeak.length,0),
    task:{tp,fp,fn,precision,recall,f1:precision===null||recall===null||precision+recall===0?0:2*precision*recall/(precision+recall)},promptBytes:cases.reduce((n,row)=>n+row.requestBytes,0),
    fieldCategories:Object.fromEntries(['time','material','condition','completion','dependency','revision','semantics','other'].map(category=>[category,cases.reduce((n,row)=>n+row.evaluation.fieldCategories[category],0)]))}
}

export async function analyzeCandidate12D2(){
  const {binding,bindingBytes,grant}=verifyCandidate12D2Send(),budget=await openCandidate12D2Budget({ledgerPath:LEDGER_PATH,lockRoot:LOCK_ROOT,grant}),state=await budget.snapshot()
  check(state.reservations.length===24&&state.reservations.every(item=>item.status==='settled')&&!state.stopped,'INCOMPLETE_RUN')
  const references=JSON.parse(readFileSync(join(D1,'PROVISIONAL_REFERENCES.json'))).references,packets=JSON.parse(readFileSync(join(D1,'PREPARED_REQUEST_IDENTITIES.json'))).requests,cases=[]
  for(const unit of binding.units){const result=JSON.parse(readFileSync(join(DIRECTORY,'results',unit.unitId+'.json'))),rawLines=readFileSync(join(DIRECTORY,'raw',unit.unitId+'.jsonl'),'utf8').trimEnd().split('\n').map(JSON.parse)
    check(rawLines.length===1&&rawLines[0].responseSha===hash(rawLines[0].rawHttpText)&&result.responseSha===rawLines[0].responseSha&&result.ledgerStatus==='settled','RESULT_INTEGRITY')
    const reference=references.find(item=>item.sourceId===unit.sourceId),packet=packets.find(item=>item.unitId===unit.unitId),evaluation=scoreUnit(reference,result,packet.prepared.context)
    cases.push({unitId:unit.unitId,ordinal:unit.ordinal,sourceId:unit.sourceId,arm:unit.arm,candidateVersion:unit.candidateVersion,requestBytes:unit.requestBytes,responseSha:result.responseSha,usage:result.usage,costUpperMicroCny:result.costUpperMicroCny,waitingMs:result.waitingMs,evaluation})}
  const arms={A:sumMetrics(cases.filter(row=>row.arm==='A')),B:sumMetrics(cases.filter(row=>row.arm==='B'))},gates={
    allDeterminate:cases.length===24&&cases.every(row=>row.evaluation.determinate&&row.evaluation.ambiguity.length===0),
    bothArmsSchemaAndReferenceValid:arms.A.schemaAndReferenceValid===12&&arms.B.schemaAndReferenceValid===12,
    candidate12Safety:arms.B.severe===0&&arms.B.forbidden===0&&arms.B.teachingLeak===0,
    noRegression:arms.B.task.fn<=arms.A.task.fn&&arms.B.criticalMajor<=arms.A.criticalMajor,
    completeSourceGain:arms.B.completeSources>=arms.A.completeSources+2,
  }
  const passed=Object.values(gates).every(Boolean),decision=passed?'ELIGIBLE_FOR_INDEPENDENT_HUMAN_HOLDOUT':'REJECT_CANDIDATE12_ENGINEERING_SCREEN'
  const pairs=[...new Set(cases.map(row=>row.sourceId))].map(sourceId=>{const a=cases.find(row=>row.sourceId===sourceId&&row.arm==='A'),b=cases.find(row=>row.sourceId===sourceId&&row.arm==='B');return {sourceId,AComplete:a.evaluation.complete,BComplete:b.evaluation.complete,completeDelta:Number(b.evaluation.complete)-Number(a.evaluation.complete),taskFnDelta:b.evaluation.task.fn-a.evaluation.task.fn,criticalMajorDelta:b.evaluation.criticalMajor-a.evaluation.criticalMajor}})
  const ledgerBytes=readFileSync(LEDGER_PATH),output={version:'candidate12-d2-analysis-1',status:'D2_PROVISIONAL_DEVELOPMENT_RESULTS_READY_FOR_REVIEW',evaluationRole:'SEEN_SYNTHETIC_DEVELOPMENT',truthStatus:'PROVISIONAL_MODEL_AUTHORED',eligibleForIndependentHoldout:false,claimCeiling:'ENGINEERING_SCREENING_ONLY',
    bindingSha:hash(bindingBytes),requests:24,sources:12,arms,pairs,gates,decision,cases,operational:{actualCalls:24,providerBilledCny:'NOT_OBSERVABLE',localAuditableCostUpperMicroCny:cases.reduce((n,row)=>n+row.costUpperMicroCny,0),authorizedWorstMicroCny:51904512,
      usage:{inputTokens:cases.reduce((n,row)=>n+row.usage.input_tokens,0),outputTokens:cases.reduce((n,row)=>n+row.usage.output_tokens,0)}},
    ledger:{before:read('BASELINE.json').ledger,after:{path:LEDGER_PATH,rows:state.ledger.rows,bytes:state.ledger.bytes,sha256:hash(ledgerBytes),tail:state.ledger.tail,nextSequence:state.ledger.nextSequence}},
    boundaries:['Seen synthetic Development only','provisional model-authored reference','not an independent human Holdout','not a real accept-and-save conversion rate','no deployment, production promotion or default-candidate change'],generatedAt:new Date().toISOString()}
  json(join(DIRECTORY,'ANALYSIS.json'),output)
  const pct=value=>value===null?'NA':(value*100).toFixed(2)+'%',lines=['# Candidate12 D2 临时 Development 配对评测','',`状态：\`${output.status}\`。`,'' ,'本批严格执行 24 个冻结请求。参照由模型辅助制作，且数据为已见合成 Development；结果只允许作为工程筛选，不是独立人工 Holdout、真人试用或真实识别转化率。','',`预注册结论：\`${decision}\`。`,'',
    '| 臂 | 候选 | 完整来源 | Schema+引用有效 | TP / FP / FN | P / R / F1 | Critical Major | Severe | Forbidden |','|---|---|---:|---:|---:|---:|---:|---:|---:|',
    ...[['A','Candidate03'],['B','Candidate12']].map(([key,name])=>{const a=arms[key];return `| ${key} | ${name} | ${a.completeSources}/12 | ${a.schemaAndReferenceValid}/12 | ${a.task.tp} / ${a.task.fp} / ${a.task.fn} | ${pct(a.task.precision)} / ${pct(a.task.recall)} / ${pct(a.task.f1)} | ${a.criticalMajor} | ${a.severe} | ${a.forbidden} |`}),
    '',...Object.entries(gates).map(([name,pass])=>`- ${name}: \`${pass?'PASS':'FAIL'}\``),
    '',`实际调用：24；本地可审计费用上界：CNY ${(output.operational.localAuditableCostUpperMicroCny/1e6).toFixed(6)}；provider 实际扣费：NOT_OBSERVABLE。`,
    '',`账本：${output.ledger.after.rows} 行，SHA-256 \`${output.ledger.after.sha256}\`，tail \`${output.ledger.after.tail}\`。`,'','历史 RCO-5-007 保留：`FREEZE_HASH_MISMATCH:package-lock.json`。','']
  writeFileSync(join(DIRECTORY,'REPORT.md'),lines.join('\n'),{flag:'wx'})
  return output
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const args=process.argv.slice(2)
  if(args.length===1&&args[0]==='--prepare')console.log(JSON.stringify(await prepareCandidate12D2()))
  else if(args.length===1&&args[0]==='--dispatch-all')console.log(JSON.stringify(await dispatchAll()))
  else if(args.length===1&&args[0]==='--analyze')console.log(JSON.stringify(await analyzeCandidate12D2()))
  else if(args.length===1&&args[0].startsWith('--dispatch='))console.log(JSON.stringify(await dispatchCandidate12D2(args[0].slice(11))))
  else throw Error('CANDIDATE12_D2_RUNNER_ARGUMENT')}
