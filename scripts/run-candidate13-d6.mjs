import {createHash,randomUUID} from 'node:crypto'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {isDeepStrictEqual} from 'node:util'
import {build} from 'esbuild'
import {createPinnedProxyFetch,createRawRecorder,inspectRequest,assertModelGatewayConfigured} from './real-input-model-gateway.mjs'
import {CANDIDATE11_B2_UNIT_POLICY} from './real-input-budget.mjs'
import {D6_BATCH_POLICY,D6_UNIT_POLICY,openCandidate13D6Budget,reservationMicroUsd} from './candidate13-d6-budget.mjs'
import {scoreCandidate13V4,aggregateCandidate13V4,D5_SCORER_VERSION} from './score-candidate13-contract-v4.mjs'
import {verifyProtectedFiles} from './verify-candidate11-analysis.mjs'

export const DIRECTORY='docs/recognition-optimization/candidate13/d6-development-20260922a'
const D5='docs/recognition-optimization/candidate13/d5-development'
const D5_MANIFEST_SHA='2acd34fce52396a3be17b70fee28e4fe1f3d11bec796e97c672249406c453f53'
const LEDGER_PATH=resolve('C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')
const SERVER_ENV=resolve('C:/Users/Winner/student-affairs-multimodal-exp/.env')
const LOCK_ROOT=resolve('C:/Users/Winner/student-affairs-multimodal-exp/.data/candidate13-d6-20260922a')
const BASELINE={rows:742,bytes:631869,sha256:'df4035229093554b6417b0a37571730f68c10ecb7098234814406b49dfae1e1e',tail:'6812e1b072caeaa4fd3e6e8e55b485c57533bc0a0d9eaaff4dd84bbf48809922'}
const BRANCH='codex/e2-candidate11-blind-eval'
const hash=value=>createHash('sha256').update(value).digest('hex')
const check=(value,code)=>{if(!value)throw Error('CANDIDATE13_D6_RUNNER_'+code)}
const read=name=>JSON.parse(readFileSync(join(DIRECTORY,name),'utf8'))
const stable=value=>JSON.stringify(value,Object.keys(value??{}).sort())
const json=(path,value)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n',{flag:'wx'})
const shaFile=path=>({path:path.replaceAll('\\','/'),sha256:hash(readFileSync(path))})
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim()
const changedPaths=()=>[...git(['diff','--name-only']).split('\n'),...git(['ls-files','--others','--exclude-standard']).split('\n')].filter(Boolean).map(path=>path.replaceAll('\\','/'))

async function adapterApi(){
  const output=await build({stdin:{contents:`export {adaptModelWire,WIRE_VERSION} from './src/experiments/realInput01/modelWire.ts';`,resolveDir:process.cwd(),loader:'ts'},
    bundle:true,write:false,platform:'node',format:'esm',metafile:true,logLevel:'silent'})
  const dependencies=Object.keys(output.metafile.inputs).filter(path=>path!=='<stdin>').sort().map(shaFile)
  return {dependencies,api:await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].contents).toString('base64'))}
}
function currentGit(requireClean=true){
  const head=git(['rev-parse','HEAD']),branch=git(['branch','--show-current']),upstream=git(['rev-parse','@{u}'])
  check(branch===BRANCH&&head===upstream,'LOCAL_UPSTREAM');const remote=git(['ls-remote','origin','refs/heads/'+BRANCH]).split(/\s+/u)[0]
  check(remote===head,'REMOTE_HEAD');if(requireClean)check(changedPaths().length===0,'WORKTREE_NOT_CLEAN');return {head,branch,upstream,remote}
}
function inspectLedgerBaseline(){
  const bytes=readFileSync(LEDGER_PATH),lines=bytes.toString('utf8').trimEnd().split('\n'),rows=lines.map(JSON.parse)
  check(lines.length===BASELINE.rows&&bytes.length===BASELINE.bytes&&hash(bytes)===BASELINE.sha256&&rows.at(-1).hash===BASELINE.tail,'LEDGER_BASELINE')
  return {bytes,rows}
}
function verifyD5(){
  const output=execFileSync(process.execPath,['scripts/prepare-candidate13-d5.mjs','--verify'],{encoding:'utf8'}),result=JSON.parse(output.trim())
  check(result.requests===24&&result.protectedFiles===84&&result.modelCalls===0&&result.manifestSha256===D5_MANIFEST_SHA,'D5_VERIFY')
  check(hash(readFileSync(join(D5,'MANIFEST.json')))===D5_MANIFEST_SHA,'D5_MANIFEST');return result
}
function targetFrom(packet){
  const requestText=JSON.stringify(packet.request),identity=inspectRequest(requestText,CANDIDATE11_B2_UNIT_POLICY)
  check(identity.requestSha===packet.requestSha256&&identity.requestBytes===packet.requestBytes&&identity.inputSha===packet.prepared.identity.inputSha,'REQUEST_IDENTITY')
  const keys=['unitId','ordinal','sourceId','sourceVersionId','arm','position','candidateVersion','promptVersion','sourceSha256','referenceSha256',
    'compiledReferenceSha256','identitySha256','requestSha256','promptSha256','exampleSha256','schemaSha256','adapterSha256','scorerVersion','compilerVersion','requestBytes','unitIdentitySha256']
  return {...Object.fromEntries(keys.map(key=>[key,packet[key]])),candidateSha256:identity.candidateSha,inputSha256:identity.inputSha,reservedMicroUsd:reservationMicroUsd(packet.requestBytes)}
}
function dependencyHash(value){return hash(JSON.stringify(value))}

export async function prepareCandidate13D6(){
  const gitState=currentGit(true),d5Check=verifyD5(),{bytes:ledgerBytes}=inspectLedgerBaseline();check(!existsSync(DIRECTORY)&&!existsSync(LOCK_ROOT),'OUTPUT_OR_LOCK_EXISTS')
  mkdirSync(join(DIRECTORY,'raw'),{recursive:true});mkdirSync(join(DIRECTORY,'results'),{recursive:true})
  const frozen=JSON.parse(readFileSync(join(D5,'PREPARED_REQUEST_IDENTITIES.json'))),targets=frozen.requests.map(targetFrom)
  check(targets.length===24&&targets.every((unit,index)=>unit.ordinal===index+1),'TARGET_ORDER')
  const exactWorstMicroUsd=targets.reduce((sum,unit)=>sum+unit.reservedMicroUsd,0);check(exactWorstMicroUsd<=1000000,'BUDGET_CAP')
  const {dependencies:adapterDependencies,api}=await adapterApi();check(api.WIRE_VERSION==='real-input-model-wire-1','ADAPTER_VERSION')
  const dependencyPaths=['scripts/candidate13-d6-budget.mjs','scripts/run-candidate13-d6.mjs','scripts/real-input-budget.mjs','scripts/real-input-model-gateway.mjs',
    'scripts/score-candidate13-contract-v4.mjs','scripts/compile-candidate13-reference-v4.mjs','scripts/prepare-candidate13-d5.mjs','scripts/verify-candidate11-analysis.mjs',
    join(D5,'MANIFEST.json'),join(D5,'PREPARED_REQUEST_IDENTITIES.json'),join(D5,'REFERENCES.json'),join(D5,'SOURCES.json'),
    'src/experiments/realInput01/candidate03.ts','src/experiments/realInput01/candidate13.ts','src/experiments/realInput01/modelWire.ts',
    'src/experiments/candidate13/measurement.ts','src/experiments/candidate13/observation.ts']
  const dependencies=[...new Map([...dependencyPaths.map(shaFile),...adapterDependencies].map(file=>[file.path,file])).values()].sort((a,b)=>a.path.localeCompare(b.path))
  const binding={version:'candidate13-d6-binding-1',head:gitState.head,branch:BRANCH,d5ManifestSha256:D5_MANIFEST_SHA,evaluationRole:'SYNTHETIC_DEVELOPMENT',
    truthStatus:'PROVISIONAL_MODEL_AUTHORED',claimCeiling:'ENGINEERING_SELECTION_ONLY',model:'deepseek-flash',temperature:0,reasoning:'none',maxOutputTokens:8192,
    timeoutMs:120000,targets,dependencies,adapterVersion:api.WIRE_VERSION,scorerVersion:D5_SCORER_VERSION,createdAt:new Date().toISOString()}
  const checkedAt=new Date(),billing={version:'candidate13-d6-billing-1',verified:true,method:'official-deepseek-document-review',checkedAt:checkedAt.toISOString(),validUntil:new Date(checkedAt.getTime()+12*60*60*1000).toISOString(),
    route:{endpoint:'https://api.deepseek.com/responses',model:'deepseek-flash',mappedModel:'DeepSeek-V4.1-Flash',temperature:0,reasoning:'none',maxOutputTokens:8192},policy:D6_BATCH_POLICY,
    peakPrices:{cacheMissInputUsdPerMillion:0.30,outputUsdPerMillion:1.20},actualFrozenRequestBytes:targets.reduce((sum,unit)=>sum+unit.requestBytes,0),
    actualRequestInputTokenUpperBound:targets.reduce((sum,unit)=>sum+unit.requestBytes,0),outputTokenUpperBound:24*8192,exactWorstMicroUsd,exactWorstUsd:exactWorstMicroUsd/1e6,
    conservativeLegacyEnvelopeUsd:0.7077888,hardLimitUsd:1,
    documents:[{url:'https://api-docs.deepseek.com/quick_start/pricing/',claim:'deepseek-flash maps to DeepSeek-V4.1-Flash; peak cache-miss input USD 0.30/M and output USD 1.20/M'}]}
  const authorization={version:'candidate13-d6-authorization-1',authorized:true,evidenceType:'INTERACTIVE_USER_MESSAGE',
    userAuthorizationSummary:'Exactly 24 frozen D5-R1 requests; deepseek-flash; USD 1.00 hard cap; one new grant with per-unit reserve/settle; no retries, repair, verifier, extra samples, human trials, deployment, or default-candidate change.',
    authorizedCalls:24,hardLimitUsd:1,model:'deepseek-flash',d5ManifestSha256:D5_MANIFEST_SHA,repair:0,verifier:0,retry:0,authorizedAt:new Date().toISOString()}
  const review={version:'candidate13-d6-send-review-1',status:'PASS',authorizationSha256:hash(JSON.stringify(authorization,null,2)+'\n'),grantId:randomUUID(),head:binding.head,
    d5ManifestSha256:D5_MANIFEST_SHA,bindingSha256:hash(JSON.stringify(binding,null,2)+'\n'),billingSha256:hash(JSON.stringify(billing,null,2)+'\n'),
    dependenciesSha256:dependencyHash(dependencies),d5Check,protectedFiles:verifyProtectedFiles().count,checkedAt:new Date().toISOString(),
    constraints:{calls:24,repair:0,verifier:0,retry:0,hardLimitUsd:1,exactWorstUsd:billing.exactWorstUsd}}
  const baseline={version:'candidate13-d6-baseline-1',head:binding.head,branch:BRANCH,ledger:{path:LEDGER_PATH,...BASELINE,nextSequence:742},lockRoot:LOCK_ROOT,modelCalls:0,createdAt:new Date().toISOString()}
  for(const [name,value] of [['AUTHORIZATION.json',authorization],['BASELINE.json',baseline],['BINDING.json',binding],['BILLING.json',billing],['SEND_REVIEW.json',review]])json(join(DIRECTORY,name),value)
  const grant=grantFromFiles();json(join(DIRECTORY,'GRANT.json'),grant)
  const manifest={version:'candidate13-d6-run-manifest-1',status:'READY_FOR_EXACTLY_24_AUTHORIZED_CALLS',head:binding.head,d5ManifestSha256:D5_MANIFEST_SHA,
    grantId:grant.grantId,bindingSha256:grant.bindingSha256,units:targets.map(unit=>({unitId:unit.unitId,ordinal:unit.ordinal,unitIdentitySha256:unit.unitIdentitySha256,requestSha256:unit.requestSha256,reservedMicroUsd:unit.reservedMicroUsd,status:'AUTHORIZED_NOT_SENT'})),
    order:'6 AB / 6 BA, exact D5-R1 ordinal',selectionRule:['complete true over false','lower severe','lower forbidden','lower task FN','lower criticalMajor','lower major','lower task FP','otherwise tie'],
    retry:0,repair:0,verifier:0,operations:{modelCalls:0,reserves:0,settlements:0},createdAt:new Date().toISOString()}
  json(join(DIRECTORY,'RUN_MANIFEST.json'),manifest)
  return {status:manifest.status,head:binding.head,requests:24,grantId:grant.grantId,exactWorstUsd:billing.exactWorstUsd,hardLimitUsd:1}
}
function grantFromFiles(){
  const bindingBytes=readFileSync(join(DIRECTORY,'BINDING.json')),binding=JSON.parse(bindingBytes),baseline=read('BASELINE.json'),billing=read('BILLING.json'),review=read('SEND_REVIEW.json')
  return {version:'candidate13-d6-grant-1',grantId:review.grantId,parentTail:baseline.ledger.tail,parentSequence:baseline.ledger.nextSequence,ledgerPrefixBytes:baseline.ledger.bytes,ledgerPrefixSha:baseline.ledger.sha256,
    d5ManifestSha256:D5_MANIFEST_SHA,bindingSha256:hash(bindingBytes),head:binding.head,dependenciesSha256:review.dependenciesSha256,reviewSha256:hash(JSON.stringify(review)),targets:binding.targets,
    billingEvidence:{checkedAt:billing.checkedAt,validUntil:billing.validUntil,evidenceSha256:hash(JSON.stringify(billing)),documents:billing.documents},route:{endpoint:billing.route.endpoint,model:billing.route.model,temperature:0,reasoning:'none',maxOutputTokens:8192},
    lockRoot:LOCK_ROOT,maxBatchRequests:24,maxBatchBudgetMicroUsd:billing.exactWorstMicroUsd,hardLimitMicroUsd:1000000,policy:D6_BATCH_POLICY,repair:0,verifier:0,retry:0}
}
function packetMap(){const requests=JSON.parse(readFileSync(join(D5,'PREPARED_REQUEST_IDENTITIES.json'))).requests;return new Map(requests.map(packet=>[packet.unitId,packet]))}
function verifyDependencies(binding){
  for(const file of binding.dependencies)check(existsSync(file.path)&&hash(readFileSync(file.path))===file.sha256,'DEPENDENCY:'+file.path)
  for(const path of changedPaths())check(path.startsWith(DIRECTORY+'/'),'WORKTREE_SCOPE:'+path)
  const state=currentGit(false);check(state.head===binding.head,'GIT_BINDING');check(verifyProtectedFiles().count===84,'PROTECTED_FILES')
}
export function verifyCandidate13D6Send(){
  const bindingBytes=readFileSync(join(DIRECTORY,'BINDING.json')),binding=JSON.parse(bindingBytes),baseline=read('BASELINE.json'),billing=read('BILLING.json'),review=read('SEND_REVIEW.json'),grant=read('GRANT.json'),authorization=read('AUTHORIZATION.json'),runManifest=read('RUN_MANIFEST.json')
  verifyDependencies(binding);check(authorization.authorized&&authorization.authorizedCalls===24&&authorization.hardLimitUsd===1&&authorization.model==='deepseek-flash'
    &&hash(readFileSync(join(DIRECTORY,'AUTHORIZATION.json')))===review.authorizationSha256,'AUTHORIZATION')
  check(hash(bindingBytes)===review.bindingSha256&&hash(JSON.stringify(billing,null,2)+'\n')===review.billingSha256&&dependencyHash(binding.dependencies)===review.dependenciesSha256,'REVIEW_BINDING')
  check(isDeepStrictEqual(grant,grantFromFiles()),'GRANT_DRIFT');check(Date.now()>=Date.parse(billing.checkedAt)&&Date.now()<=Date.parse(billing.validUntil)&&billing.verified,'PRICE_VALIDITY')
  const ledger=readFileSync(LEDGER_PATH);check(ledger.length>=baseline.ledger.bytes&&hash(ledger.subarray(0,baseline.ledger.bytes))===baseline.ledger.sha256,'LEDGER_PREFIX')
  const packets=packetMap();for(const unit of binding.targets){const packet=packets.get(unit.unitId),requestText=JSON.stringify(packet.request),identity=inspectRequest(requestText,CANDIDATE11_B2_UNIT_POLICY)
    check(identity.requestSha===unit.requestSha256&&identity.requestBytes===unit.requestBytes&&identity.candidateSha===unit.candidateSha256&&identity.inputSha===unit.inputSha256,'UNIT_IDENTITY')}
  check(runManifest.units.length===24&&runManifest.units.every((row,index)=>row.unitIdentitySha256===binding.targets[index].unitIdentitySha256),'RUN_MANIFEST')
  return {bindingBytes,binding,baseline,billing,review,grant,packets}
}

function rejectCredentialReflection(raw,secret){
  JSON.parse(raw);const pending=[{text:raw,depth:0}],seen=new Set();let inspected=0
  while(pending.length){const {text,depth}=pending.pop();check(!text.includes(secret),'CREDENTIAL_ECHO');if(seen.has(text))continue;seen.add(text);inspected+=text.length;check(depth<=32&&inspected<=4194304,'RESPONSE_INSPECTION_LIMIT')
    for(const token of text.matchAll(/"(?:\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})|[^"\\\u0000-\u001f])*"/g)){const decoded=JSON.parse(token[0]);check(!decoded.includes(secret),'CREDENTIAL_ECHO');if(decoded.includes('"'))pending.push({text:decoded,depth:depth+1})}}
}
async function readResponseBody(response,limit=524288){
  check(response.status===200,'UPSTREAM_HTTP');check(response.headers.get('content-type')?.split(';')[0].trim()==='application/json'&&response.body,'UPSTREAM_PROTOCOL')
  const chunks=[],reader=response.body.getReader();let bytes=0;try{while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;check(bytes<=limit,'UPSTREAM_LIMIT');chunks.push(next.value)}}finally{reader.releaseLock()}
  return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))
}
async function materializeResult(binding,bindingBytes,index,rawRow,reservation){
  const unit=binding.targets[index],packet=packetMap().get(unit.unitId),{api}=await adapterApi()
  check(rawRow.unitId===unit.unitId&&rawRow.requestSha256===unit.requestSha256&&rawRow.candidateSha256===unit.candidateSha256&&rawRow.inputSha256===unit.inputSha256
    &&rawRow.responseSha256===hash(rawRow.rawHttpText)&&reservation.unitId===unit.unitId&&reservation.status==='settled'&&reservation.responseSha256===rawRow.responseSha256,'RECOVERY_BINDING')
  let assembled=null,parseError=null,parseStage=null,returnedModel=null
  try{const envelope=JSON.parse(rawRow.rawHttpText),message=envelope.output?.at(-1);returnedModel=envelope.model;check(message?.type==='message'&&message.role==='assistant'&&message.content?.length===1&&message.content[0].type==='output_text','FINAL_MESSAGE');parseStage='output_json';const wire=JSON.parse(message.content[0].text);parseStage='adapter_schema';assembled=api.adaptModelWire(wire,packet.prepared.context).adapted;parseStage=null}
  catch(error){parseError=typeof error?.message==='string'&&/^[A-Z0-9_:.-]+$/.test(error.message)?error.message:'PARSE_SCHEMA_OR_ADAPTER_REJECTED'}
  const result={version:'candidate13-d6-result-1',unitId:unit.unitId,sourceId:unit.sourceId,arm:unit.arm,ordinal:unit.ordinal,bindingSha256:hash(bindingBytes),requestSha256:unit.requestSha256,responseSha256:rawRow.responseSha256,
    transportStatus:'COMPLETED_HTTP_200',requestModel:binding.model,returnedModel,modelMatch:returnedModel===binding.model,httpStatus:200,waitingMs:rawRow.waitingMs??null,
    parseError,parseStage,assembled,ledgerStatus:'settled',usage:reservation.usage,costUpperMicroUsd:reservation.costUpperMicroUsd,providerBilledUsd:'NOT_OBSERVABLE',automaticRepair:false,retryCount:0,verifierCalls:0}
  json(join(DIRECTORY,'results',unit.unitId+'.json'),result);return result
}
async function reconcileAndMaterialize(){
  const {binding,grant,bindingBytes}=verifyCandidate13D6Send(),budget=await openCandidate13D6Budget({ledgerPath:LEDGER_PATH,lockRoot:LOCK_ROOT,grant});let state=await budget.snapshot(),pending=state.reservations.at(-1)
  if(pending?.status==='pending'){
    const rawPath=join(DIRECTORY,'raw',pending.unitId+'.jsonl');if(!existsSync(rawPath)||readFileSync(rawPath).length===0){await budget.reconcilePending(null);return budget.snapshot()}
    const lines=readFileSync(rawPath,'utf8').trimEnd().split('\n').filter(Boolean).map(JSON.parse);check(lines.length===1&&lines[0].unitId===pending.unitId&&lines[0].requestSha256===pending.requestSha256&&lines[0].responseSha256===hash(lines[0].rawHttpText),'PENDING_RAW_IDENTITY')
    await budget.reconcilePending(lines[0].rawHttpText);state=await budget.snapshot()
  }
  for(const [index,reservation] of state.reservations.entries())if(reservation.status==='settled'){
    const path=join(DIRECTORY,'results',reservation.unitId+'.json');if(existsSync(path))continue
    const lines=readFileSync(join(DIRECTORY,'raw',reservation.unitId+'.jsonl'),'utf8').trimEnd().split('\n').filter(Boolean).map(JSON.parse);check(lines.length===1,'RECOVERY_RAW_COUNT');await materializeResult(binding,bindingBytes,index,lines[0],reservation)
  }
  return state
}
export async function dispatchCandidate13D6(unitId){
  check(/^D5R1-S(?:0[1-9]|1[0-2])-[AB]$/.test(unitId),'UNIT_ID')
  const {binding,grant,bindingBytes,packets}=verifyCandidate13D6Send(),budget=await openCandidate13D6Budget({ledgerPath:LEDGER_PATH,lockRoot:LOCK_ROOT,grant}),before=await budget.snapshot(),index=before.reservations.length
  check(index<24&&binding.targets[index]?.unitId===unitId&&!before.stopped&&before.reservations.every(value=>value.status==='settled'),'NEXT_UNIT')
  const rawPath=join(DIRECTORY,'raw',unitId+'.jsonl'),resultPath=join(DIRECTORY,'results',unitId+'.json');check(!existsSync(rawPath)&&!existsSync(resultPath),'ALREADY_ATTEMPTED')
  const envPath=existsSync(resolve('.env'))?resolve('.env'):SERVER_ENV;if(existsSync(envPath))process.loadEnvFile(envPath)
  try{assertModelGatewayConfigured()}catch{check(false,'SERVER_CONFIGURATION_UNAVAILABLE')}
  const fetchImpl=createPinnedProxyFetch(),requestText=JSON.stringify(packets.get(unitId).request)
  let secret=process.env.DEEPSEEK_API_KEY,recorder,lease,observed,settleAttempted=false,controller,timer,started=Date.now()
  try{
    recorder=await createRawRecorder(rawPath);lease=await budget.reserve(unitId,requestText,new Date().toISOString())
    controller=new AbortController();timer=setTimeout(()=>controller.abort(),binding.timeoutMs)
    const response=await fetchImpl('https://api.deepseek.com/responses',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:requestText,redirect:'manual',signal:controller.signal})
    const raw=await readResponseBody(response);clearTimeout(timer);JSON.parse(raw);rejectCredentialReflection(raw,secret)
    observed={version:'candidate13-d6-raw-result-1',unitId,requestSha256:binding.targets[index].requestSha256,candidateSha256:binding.targets[index].candidateSha256,inputSha256:binding.targets[index].inputSha256,
      receivedAt:new Date().toISOString(),httpStatus:200,waitingMs:Date.now()-started,rawHttpText:raw,responseSha256:hash(raw)}
    await recorder.write(observed);settleAttempted=true;const settled=await lease.complete(raw,200),result=await materializeResult(binding,bindingBytes,index,observed,{...settled,unitId,status:'settled'})
    return {unitId,httpStatus:result.httpStatus,parseError:result.parseError,ledgerStatus:result.ledgerStatus,waitingMs:result.waitingMs,costUpperMicroUsd:result.costUpperMicroUsd}
  }catch(error){controller?.abort();clearTimeout(timer);if(lease&&!settleAttempted)try{await lease.uncertain()}catch{}throw error}
  finally{if(recorder)await recorder.close();secret=undefined}
}
export async function dispatchAll(){
  const outputs=[];while(true){const recovered=await reconcileAndMaterialize();if(recovered.stopped)break
    const {binding,grant}=verifyCandidate13D6Send(),state=await openCandidate13D6Budget({ledgerPath:LEDGER_PATH,lockRoot:LOCK_ROOT,grant}).then(budget=>budget.snapshot()),index=state.reservations.length
    if(index>=24||state.stopped)break;const result=await dispatchCandidate13D6(binding.targets[index].unitId);outputs.push(result);console.error(JSON.stringify(result));if(result.ledgerStatus!=='settled')break}
  const {grant}=verifyCandidate13D6Send(),state=await openCandidate13D6Budget({ledgerPath:LEDGER_PATH,lockRoot:LOCK_ROOT,grant}).then(budget=>budget.snapshot())
  return {attempted:outputs.length,settled:state.reservations.filter(item=>item.status==='settled').length,complete:state.reservations.length===24&&state.reservations.every(item=>item.status==='settled'),stopped:state.stopped,last:outputs.at(-1)??null}
}

function referencesValid(result,context){
  if(!result)return false;const scopes=new Set(context.index.scopes.map(scope=>scope.id)),tasks=new Set(result.tasks.map(task=>task.id)),materials=new Set(result.materials.map(item=>item.tempId)),times=new Set(result.timePoints.map(item=>item.tempId)),all=[]
  for(const task of result.tasks){all.push(task.propositionScopeIds??[],task.condition?.conditionScopeIds??[],task.condition?.factScopeIds??[]);if((task.detail?.dependencyTempIds??[]).some(id=>!tasks.has(id))||(task.detail?.materialTempIds??[]).some(id=>!materials.has(id))||(task.detail?.timePointTempIds??[]).some(id=>!times.has(id)))return false}
  for(const item of [...result.materials,...result.timePoints]){all.push(item.scopeIds??[]);if((item.relatedTaskTempIds??[]).some(id=>!tasks.has(id)))return false}
  for(const revision of result.revisions??[]){all.push(revision.scopeIds??[]);if(!tasks.has(revision.targetDirectiveId)||(revision.fromDirectiveId!==null&&!tasks.has(revision.fromDirectiveId)))return false}
  return all.flat().every(id=>scopes.has(id))
}
const outcomeRank=e=>[Number(e.complete===true),-e.score.severity.severe,-e.score.severity.forbidden,-e.score.taskMetrics.fn,-e.score.severity.criticalMajor,-e.score.severity.major,-e.score.taskMetrics.fp]
function compareOutcome(a,b){const left=outcomeRank(a),right=outcomeRank(b);for(let i=0;i<left.length;i++)if(left[i]!==right[i])return left[i]>right[i]?'A':'B';return 'TIE'}
function evaluate(referenceEntry,result,packet){
  const schemaValid=Boolean(result.assembled&&!result.parseError),referenceValid=schemaValid&&referencesValid(result.assembled,packet.prepared.context)
  const score=scoreCandidate13V4(referenceEntry.compiledReference,result.assembled,{schemaValid:schemaValid&&referenceValid,teachingFingerprints:[]})
  const determinate=['SCORED','PARSE_OR_SCHEMA_FAILURE'].includes(score.status)
  return {transportStatus:result.transportStatus,parseValid:result.parseError===null,schemaValid,referenceValid,semanticStatus:score.status,determinate,complete:score.complete,score}
}
export async function analyzeCandidate13D6(){
  const {binding,bindingBytes,grant,packets}=verifyCandidate13D6Send(),budget=await openCandidate13D6Budget({ledgerPath:LEDGER_PATH,lockRoot:LOCK_ROOT,grant}),state=await budget.snapshot()
  check(state.reservations.length===24&&state.reservations.every(item=>item.status==='settled')&&!state.stopped,'INCOMPLETE_RUN')
  const references=JSON.parse(readFileSync(join(D5,'REFERENCES.json'))).references,cases=[]
  for(const [index,unit] of binding.targets.entries()){
    const result=JSON.parse(readFileSync(join(DIRECTORY,'results',unit.unitId+'.json'),'utf8'))
    const raw=readFileSync(join(DIRECTORY,'raw',unit.unitId+'.jsonl'),'utf8').trimEnd().split('\n').map(JSON.parse)
    check(raw.length===1&&raw[0].responseSha256===hash(raw[0].rawHttpText)&&result.responseSha256===raw[0].responseSha256&&result.ledgerStatus==='settled','RESULT_INTEGRITY')
    const reference=references.find(item=>item.sourceId===unit.sourceId),evaluation=evaluate(reference,result,packets.get(unit.unitId))
    cases.push({unitId:unit.unitId,ordinal:unit.ordinal,sourceId:unit.sourceId,arm:unit.arm,candidateVersion:unit.candidateVersion,requestBytes:unit.requestBytes,responseSha256:result.responseSha256,usage:result.usage,costUpperMicroUsd:result.costUpperMicroUsd,waitingMs:result.waitingMs,evaluation})
  }
  const armCases={A:cases.filter(row=>row.arm==='A'),B:cases.filter(row=>row.arm==='B')},arms={A:aggregateCandidate13V4(armCases.A.map(row=>row.evaluation.score)),B:aggregateCandidate13V4(armCases.B.map(row=>row.evaluation.score))}
  const pairs=[...new Set(cases.map(row=>row.sourceId))].map(sourceId=>{const A=cases.find(row=>row.sourceId===sourceId&&row.arm==='A'),B=cases.find(row=>row.sourceId===sourceId&&row.arm==='B'),winner=compareOutcome(A.evaluation,B.evaluation);return {sourceId,winner,AComplete:A.evaluation.complete,BComplete:B.evaluation.complete,ASeverity:A.evaluation.score.severity,BSeverity:B.evaluation.score.severity,ATask:A.evaluation.score.taskMetrics,BTask:B.evaluation.score.taskMetrics}})
  const gates={allDeterminate:cases.length===24&&cases.every(row=>row.evaluation.determinate),bothArmsSchemaAndReferenceValid:arms.A.schemaAndReferenceValid===12&&arms.B.schemaAndReferenceValid===12,
    candidate13Safety:arms.B.severity.severe===0&&arms.B.severity.forbidden===0&&arms.B.severity.teachingLeak===0,
    noTaskFnOrCriticalMajorRegression:arms.B.taskMetrics.fn<=arms.A.taskMetrics.fn&&arms.B.severity.criticalMajor<=arms.A.severity.criticalMajor,
    completeSourceGainAtLeast2:arms.B.completeSources>=arms.A.completeSources+2}
  const passed=Object.values(gates).every(Boolean),decision=passed?'CANDIDATE13_DEVELOPMENT_PASS_READY_FOR_INDEPENDENT_VALIDATION':'REJECT_CANDIDATE13_DEVELOPMENT'
  const transportFailures=cases.filter(row=>row.evaluation.transportStatus!=='COMPLETED_HTTP_200').length,parseFailures=cases.filter(row=>!row.evaluation.parseValid).length,schemaFailures=cases.filter(row=>!row.evaluation.schemaValid).length,referenceFailures=cases.filter(row=>!row.evaluation.referenceValid).length,semanticFailures=cases.filter(row=>row.evaluation.semanticStatus!=='SCORED').length
  const ledgerBytes=readFileSync(LEDGER_PATH),actualCost=cases.reduce((sum,row)=>sum+row.costUpperMicroUsd,0),output={version:'candidate13-d6-analysis-1',status:'D6_RESULTS_READY',evaluationRole:'SYNTHETIC_DEVELOPMENT',truthStatus:'PROVISIONAL_MODEL_AUTHORED',eligibleForIndependentHoldout:false,claimCeiling:'ENGINEERING_SELECTION_ONLY',
    bindingSha256:hash(bindingBytes),requests:24,sources:12,arms,pairs,pairSummary:{candidate03Wins:pairs.filter(row=>row.winner==='A').length,candidate13Wins:pairs.filter(row=>row.winner==='B').length,ties:pairs.filter(row=>row.winner==='TIE').length},
    failureLayers:{transportFailures,parseFailures,schemaFailures,referenceFailures,semanticFailures},gates,decision,
    metrics:{syntheticDevelopmentFirstWholeSuggestionAccuracy:{candidate03:{numerator:arms.A.completeSources,denominator:12,value:arms.A.completeSources/12},candidate13:{numerator:arms.B.completeSources,denominator:12,value:arms.B.completeSources/12}},
      correctDispositionRate:'NOT_OBSERVABLE',lowModificationCorrectDispositionRate:'NOT_OBSERVABLE',activeEditTime:'NOT_OBSERVABLE'},cases,
    operational:{actualCalls:24,retries:0,repairs:0,verifiers:0,providerBilledUsd:'NOT_OBSERVABLE',localAuditableCostUpperMicroUsd:actualCost,localAuditableCostUpperUsd:actualCost/1e6,authorizedFrozenWorstUsd:read('BILLING.json').exactWorstUsd,hardLimitUsd:1,
      usage:{inputTokens:cases.reduce((sum,row)=>sum+row.usage.input_tokens,0),cachedInputTokens:cases.reduce((sum,row)=>sum+(row.usage.input_tokens_details?.cached_tokens??0),0),outputTokens:cases.reduce((sum,row)=>sum+row.usage.output_tokens,0)}},
    ledger:{before:read('BASELINE.json').ledger,after:{path:LEDGER_PATH,rows:state.ledger.rows,bytes:state.ledger.bytes,sha256:hash(ledgerBytes),tail:state.ledger.tail,nextSequence:state.ledger.nextSequence}},
    boundaries:['Synthetic Development only','provisional model-authored reference','not independent human Holdout','not human accept-and-save conversion evidence','no default-candidate change or deployment'],generatedAt:new Date().toISOString()}
  json(join(DIRECTORY,'ANALYSIS.json'),output)
  const pct=value=>(value*100).toFixed(2)+'%',lines=['# Candidate03 vs Candidate13 D6 Development结果','',`冻结结论：\`${decision}\`。`,'','本批为模型辅助参照的合成Development工程筛选，不是独立人工Holdout或真人转化率。','',
    '| 臂 | 候选 | 完整正确 | 首次整份正确率 | Schema+引用 | TP / FP / FN | Critical Major / Major / Severe / Forbidden |','|---|---|---:|---:|---:|---:|---:|',
    ...[['A','Candidate03'],['B','Candidate13']].map(([key,name])=>{const a=arms[key];return `| ${key} | ${name} | ${a.completeSources}/12 | ${pct(a.completeSources/12)} | ${a.schemaAndReferenceValid}/12 | ${a.taskMetrics.tp} / ${a.taskMetrics.fp} / ${a.taskMetrics.fn} | ${a.severity.criticalMajor} / ${a.severity.major} / ${a.severity.severe} / ${a.severity.forbidden} |`}),
    '',`配对：Candidate03胜 ${output.pairSummary.candidate03Wins}，Candidate13胜 ${output.pairSummary.candidate13Wins}，平 ${output.pairSummary.ties}。`,
    '',...Object.entries(gates).map(([name,pass])=>`- ${name}: \`${pass?'PASS':'FAIL'}\``),
    '',`实际usage：输入 ${output.operational.usage.inputTokens}，缓存输入 ${output.operational.usage.cachedInputTokens}，输出 ${output.operational.usage.outputTokens} token。`,
    `本地按峰值价计算的实际usage费用上界：US$ ${output.operational.localAuditableCostUpperUsd.toFixed(6)}；provider实际扣费：NOT_OBSERVABLE。`,
    '',`账本：${output.ledger.after.rows}行，SHA-256 \`${output.ledger.after.sha256}\`。`,'','正确处置率、低修改正确处置率、主动修改时间均为`NOT_OBSERVABLE`。','']
  writeFileSync(join(DIRECTORY,'REPORT.md'),lines.join('\n'),{flag:'wx'});return output
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=process.argv.slice(2)
  if(args.length===1&&args[0]==='--prepare')console.log(JSON.stringify(await prepareCandidate13D6()))
  else if(args.length===1&&args[0]==='--verify-send')console.log(JSON.stringify({status:'PASS',head:verifyCandidate13D6Send().binding.head,requests:24}))
  else if(args.length===1&&args[0]==='--dispatch-all')console.log(JSON.stringify(await dispatchAll()))
  else if(args.length===1&&args[0]==='--analyze')console.log(JSON.stringify(await analyzeCandidate13D6()))
  else if(args.length===1&&args[0].startsWith('--dispatch='))console.log(JSON.stringify(await dispatchCandidate13D6(args[0].slice(11))))
  else throw Error('CANDIDATE13_D6_RUNNER_ARGUMENT')}
