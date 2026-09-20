import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {createHash,randomBytes,randomUUID} from 'node:crypto'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {isDeepStrictEqual} from 'node:util'
import {build} from 'esbuild'
import {inspectRequest,createModelGateway,createPinnedProxyFetch,createRawRecorder} from './real-input-model-gateway.mjs'
import {CONTRASTIVE_POLICY,contrastivePolicyFor,RECOVERY_ROUTE,openBudget} from './real-input-budget.mjs'
import {aggregateContrastiveScores} from './score-contrastive-recognition.mjs'

export const DIRECTORY='docs/recognition-optimization/mainline-real-input-01/runs/opensource-methods-20260920a'
const PREPARED=join(DIRECTORY,'prepared'),LEDGER_DIRECTORY=resolve('docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a')
const LEDGER_PATH=join(LEDGER_DIRECTORY,'CALL_LEDGER.jsonl'),MANIFEST_PATH=join(LEDGER_DIRECTORY,'REQUEST_MANIFEST.json')
const hash=value=>createHash('sha256').update(value).digest('hex')
const check=(value,code)=>{if(!value)throw Error('CONTRASTIVE_RUNNER_'+code)}
const read=name=>JSON.parse(readFileSync(join(DIRECTORY,name)))
const shaFile=path=>({path,sha256:hash(readFileSync(path))})

export function contrastiveOrder(seed=20260920){
  let n=seed>>>0,order=Array.from({length:12},(_,index)=>index<6?['A','B']:['B','A'])
  for(let i=order.length-1;i>0;i--){n=(Math.imul(n,1664525)+1013904223)>>>0;const j=n%(i+1);[order[i],order[j]]=[order[j],order[i]]}
  return order
}

async function adapterApi(){
  const output=await build({stdin:{contents:`export {adaptModelWire,WIRE_VERSION} from './src/experiments/realInput01/modelWire.ts';`,resolveDir:process.cwd(),loader:'ts'},
    bundle:true,write:false,platform:'node',format:'esm',metafile:true,logLevel:'silent'})
  const dependencies=Object.keys(output.metafile.inputs).filter(path=>path!=='<stdin>').sort().map(shaFile)
  return {dependencies,api:await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].contents).toString('base64'))}
}

function currentProtection(binding){
  const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),branch=execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim()
  check(branch==='codex/e2-multimodal-recognition-exp'&&head===binding.head,'GIT')
  for(const file of binding.dependencies)check(hash(readFileSync(file.path))===file.sha256,'DEPENDENCY:'+file.path)
  const allowed=new Set(['docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl','docs/recognition-optimization/CURRENT_CONTEXT.md','docs/recognition-optimization/OPTIMIZATION_LOG.md'])
  const changed=[...execFileSync('git',['diff','--name-only'],{encoding:'utf8'}).trim().split('\n'),...execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n')].filter(Boolean).map(path=>path.replaceAll('\\','/'))
  for(const path of changed)check(allowed.has(path)||path.startsWith(DIRECTORY+'/'),'WORKTREE_SCOPE:'+path)
  return {head,branch}
}

export async function prepareContrastive(){
  const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),branch=execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim()
  check(branch==='codex/e2-multimodal-recognition-exp'&&/^[a-f0-9]{40}$/.test(head),'PREPARE_GIT')
  const ledger=readFileSync(LEDGER_PATH),ledgerRows=ledger.toString().trimEnd().split('\n').map(JSON.parse)
  check(ledgerRows.length===595&&ledgerRows.at(-1).sequence===594&&ledgerRows.at(-1).event.unitId==='L12-B'&&ledgerRows.at(-1).event.kind==='batchSettle','LEDGER_BASELINE')
  const preparedManifest=JSON.parse(readFileSync(join(PREPARED,'MANIFEST.json'))),requestBytes=readFileSync(join(PREPARED,'REQUESTS.json')),referenceBytes=readFileSync(join(PREPARED,'REFERENCES.json'))
  check(preparedManifest.modelCalls===0&&preparedManifest.dispatchEnabled===false&&preparedManifest.plannedRequests===24
    &&hash(requestBytes)===preparedManifest.requestFileSha256&&hash(referenceBytes)===preparedManifest.referenceFileSha256,'PREPARED_FREEZE')
  const frozenRequests=JSON.parse(requestBytes),references=JSON.parse(referenceBytes),order=contrastiveOrder(),requests={},units=[],items=[]
  const scorerSha=hash(readFileSync('scripts/score-contrastive-recognition.mjs'))
  for(const [index,reference] of references.entries()){
    const id='K'+String(index+1).padStart(2,'0'),sourceRequests=frozenRequests.filter(item=>item.id===reference.id)
    check(sourceRequests.length===2&&sourceRequests.every(item=>item.context.index.source===reference.source),'SOURCE_PAIR')
    for(const arm of order[index]){
      const sourceArm=arm==='A'?'baseline':'contrastive',prepared=sourceRequests.find(item=>item.arm===sourceArm),unitId=id+'-'+arm,serialized=JSON.stringify(prepared.body),identity=inspectRequest(serialized,contrastivePolicyFor(unitId))
      check(identity.requestSha===prepared.requestSha256&&identity.requestBytes===prepared.bytes,'REQUEST_FREEZE')
      requests[unitId]=serialized;units.push({unitId,candidateSha:identity.candidateSha,requestSha:identity.requestSha,inputSha:identity.inputSha,scorerSha,requestBytes:identity.requestBytes})
    }
    const pair=order[index].map(arm=>JSON.parse(requests[id+'-'+arm])),a=pair.find(body=>body.input[0].content[0].text.includes('real-input-source-semantics-3')),b=pair.find(body=>body.input[0].content[0].text.includes('real-input-source-semantics-10'))
    if(a&&b){const normalized=structuredClone(a);normalized.input[0]=structuredClone(b.input[0]);check(isDeepStrictEqual(normalized,b),'ONLY_SYSTEM_PROMPT')}else check(false,'CANDIDATE_VERSION')
    items.push({id,sourceId:reference.id,context:sourceRequests[0].context,reference,order:order[index]})
  }
  check(units.filter((_,index)=>index%2===0&&units[index].unitId.endsWith('-A')).length===6,'ORDER_BALANCE')
  const {dependencies:adapterDependencies,api}=await adapterApi();check(api.WIRE_VERSION==='real-input-model-wire-1','WIRE')
  const dependencyPaths=['scripts/real-input-budget.mjs','scripts/real-input-model-gateway.mjs','scripts/run-contrastive-recognition.mjs','scripts/score-contrastive-recognition.mjs',
    'src/experiments/realInput01/candidate10.ts','src/experiments/realInput01/contrastiveEvidenceExamples.ts','src/experiments/realInput01/contrastiveDevelopmentCases.ts',
    join(PREPARED,'MANIFEST.json'),join(PREPARED,'REQUESTS.json'),join(PREPARED,'REFERENCES.json')]
  const dependencies=[...new Map([...dependencyPaths.map(shaFile),...adapterDependencies].map(value=>[value.path,value])).values()].sort((a,b)=>a.path.localeCompare(b.path))
  const binding={version:'real-input-contrastive-binding-1',head,branch,model:'deepseek-flash',reasoning:'none',temperature:0,maxOutputTokens:8192,timeoutMs:120000,
    candidateVersions:{A:'real-input-source-semantics-3',B:'real-input-source-semantics-10'},exampleVersion:'contrastive-evidence-examples-1',wireVersion:api.WIRE_VERSION,
    scorerSha,preparedManifestSha:hash(readFileSync(join(PREPARED,'MANIFEST.json'))),referenceSha:hash(referenceBytes),requests,units,items,order,dependencies,
    label:'12份新编匿名相近结构Development配对；单作者参照；仅固定教学正反例不同；不是盲测或真实用户转化',createdAt:new Date().toISOString()}
  const checkedAt=new Date(),billing={version:'real-input-contrastive-billing-1',verified:true,method:'official-public-document-review',checkedAt:checkedAt.toISOString(),validUntil:new Date(checkedAt.getTime()+12*60*60*1000).toISOString(),
    policy:CONTRASTIVE_POLICY,documents:[
      {url:'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',claim:'deepseek-flash is V4.1 Flash; peak uncached input CNY 2/M and output CNY 8/M; off-peak half'},
      {url:'https://api-docs.deepseek.com/api/create-response/',claim:'Responses API accepts deepseek-flash and returns usage'}]}
  const review={version:'real-input-contrastive-send-check-1',status:'PASS',scope:'CONTRASTIVE_SEND_LOCAL_DETERMINISTIC',independent:false,grantId:randomUUID(),head,
    bindingSha:hash(JSON.stringify(binding,null,2)+'\n'),billingSha:hash(JSON.stringify(billing)),sourcesSha:hash(JSON.stringify(dependencies)),
    checks:['24 calls explicitly authorized by current user','12 anonymous synthetic sources; no real materials','candidate03 versus candidate10; same model/schema/input/parameters','references excluded from request bodies','no retries','cumulative cap 314 and CNY 20 hard limit'],checkedAt:new Date().toISOString()}
  const baseline={version:'real-input-contrastive-baseline-1',head,branch,ledger:{path:LEDGER_PATH,rows:595,bytes:ledger.length,sha256:hash(ledger),tail:ledgerRows.at(-1).hash},preparedManifestSha:binding.preparedManifestSha,modelCalls:0,createdAt:new Date().toISOString()}
  for(const [name,value] of [['BASELINE_MODEL.json',baseline],['BINDING_FINAL.json',binding],['BILLING_MODEL.json',billing],['SEND_REVIEW_MODEL.json',review]])writeFileSync(join(DIRECTORY,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'})
  return {head,bindingSha:review.bindingSha,requests:24,sources:12,modelCalls:0}
}

function verifySend(){
  const bytes=readFileSync(join(DIRECTORY,'BINDING_FINAL.json')),binding=JSON.parse(bytes),baseline=read('BASELINE_MODEL.json'),billing=read('BILLING_MODEL.json'),review=read('SEND_REVIEW_MODEL.json'),protection=currentProtection(binding)
  const ledger=readFileSync(baseline.ledger.path),rows=ledger.toString().trimEnd().split('\n').map(JSON.parse)
  check(rows.length>=595&&ledger.length>=baseline.ledger.bytes&&hash(ledger.subarray(0,baseline.ledger.bytes))===baseline.ledger.sha256&&rows[594].hash===baseline.ledger.tail,'LEDGER_PREFIX')
  check(review.status==='PASS'&&review.head===binding.head&&review.bindingSha===hash(bytes)&&review.billingSha===hash(JSON.stringify(billing))&&review.sourcesSha===hash(JSON.stringify(binding.dependencies)),'REVIEW')
  check(binding.units.length===24&&binding.items.length===12&&isDeepStrictEqual(binding.order,contrastiveOrder())&&binding.scorerSha===hash(readFileSync('scripts/score-contrastive-recognition.mjs')),'BINDING')
  for(const unit of binding.units){const identity=inspectRequest(binding.requests[unit.unitId],contrastivePolicyFor(unit.unitId));check(['candidateSha','requestSha','inputSha','requestBytes'].every(key=>identity[key]===unit[key])&&unit.scorerSha===binding.scorerSha,'UNIT')}
  check(billing.verified&&isDeepStrictEqual(billing.policy,CONTRASTIVE_POLICY)&&Date.now()>=Date.parse(billing.checkedAt)&&Date.now()<=Date.parse(billing.validUntil),'BILLING')
  check(billing.documents.length===2&&billing.documents.every(item=>item.url.startsWith('https://api-docs.deepseek.com/')),'BILLING_SOURCE')
  const grant={version:'real-input-contrastive-grant-1',grantId:review.grantId,parentTail:rows[594].hash,parentSequence:595,ledgerPrefixBytes:baseline.ledger.bytes,ledgerPrefixSha:baseline.ledger.sha256,
    manifestSha:hash(readFileSync(MANIFEST_PATH)),bindingSha:hash(bytes),head:binding.head,sourcesSha:review.sourcesSha,reviewSha:hash(JSON.stringify(review)),targets:binding.units,
    billingEvidence:{checkedAt:billing.checkedAt,validUntil:billing.validUntil,evidenceSha:hash(JSON.stringify(billing))},route:RECOVERY_ROUTE,priorNonce:rows[1].event.nonce,a02ResponseSha:rows[4].event.responseSha,maxTotalRequests:314,policy:CONTRASTIVE_POLICY}
  const existing=rows.find(row=>row.event.kind==='contrastiveGrant')?.event.grant;if(existing)check(isDeepStrictEqual(existing,grant),'GRANT_DRIFT')
  return {bytes,binding,baseline,billing,review,protection,grant}
}

function historicalRequests(){
  const state=JSON.parse(readFileSync(join(LEDGER_DIRECTORY,'STATE.json'))),paths=[
    ['candidate02-20260908a','BINDING.json'],['candidate03-20260908a','BINDING.json'],['candidate04-20260909a','BINDING.json'],['candidate05-20260912a','BINDING.json'],
    ['candidate06-20260912a','BINDING.json'],['candidate07-20260913a','BINDING_FINAL.json'],['candidate08-20260913a','BINDING_FINAL.json'],['candidate09-20260913a','BINDING_FINAL.json'],
    ['model-compare-20260914a','BINDING_FINAL.json'],['reasoning-compare-20260914a','BINDING_FINAL.json'],['reasoning-max-compare-20260914a','BINDING_FINAL.json'],['reasoning-low16-compare-20260914a','BINDING_FINAL.json']]
  const root='docs/recognition-optimization/mainline-real-input-01/runs';return Object.assign({},state.requests,...paths.map(([directory,file])=>JSON.parse(readFileSync(join(root,directory,file))).requests))
}

export async function dispatchContrastive(unitId){
  check(/^K(?:0[1-9]|1[0-2])-[AB]$/.test(unitId),'UNIT_ID')
  const verified=verifySend(),{binding,grant,bytes}=verified,budget=await openBudget(LEDGER_DIRECTORY,grant.manifestSha,{batchGrant:grant}),before=await budget.snapshot(),index=before.reservations.length-290
  check(index<24&&binding.units[index]?.unitId===unitId&&!before.contrastive?.stopped&&before.reservations.slice(1).every(value=>['settled','settled-incomplete'].includes(value.status)),'NEXT_UNIT')
  const rawPath=join(DIRECTORY,unitId+'_RAW.jsonl'),resultPath=join(DIRECTORY,unitId+'_RESULT.json');check(!existsSync(rawPath)&&!existsSync(resultPath),'ALREADY_ATTEMPTED')
  try{process.loadEnvFile(resolve('.env'))}catch{check(false,'SERVER_CONFIGURATION_UNAVAILABLE')}
  const requests={...historicalRequests(),...binding.requests},origin='http://127.0.0.1:6631',capability=randomBytes(32).toString('hex'),{api}=await adapterApi();let observed,recorder
  try{
    const gateway=await createModelGateway({origin,capability,budget,requests,policy:CONTRASTIVE_POLICY,timeoutMs:binding.timeoutMs,fetchImpl:createPinnedProxyFetch(),
      recordRaw:async row=>{check(row.unitId===unitId&&row.requestSha===binding.units[index].requestSha&&recorder,'RAW_ID');await recorder.write(row);observed=row}})
    recorder=await createRawRecorder(rawPath);const start=Date.now(),response=await gateway.handle({method:'POST',path:'/api/real-input/recognize',headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','content-type':'application/json','x-real-input-capability':capability},bodyText:JSON.stringify({unitId,requestSha:binding.units[index].requestSha})})
    const item=binding.items.find(value=>value.id===unitId.slice(0,3)),arm=unitId.at(-1);let assembled=null,parseError=null,returnedModel=null
    if(observed)try{const envelope=JSON.parse(observed.rawHttpText),message=envelope.output?.at(-1);returnedModel=envelope.model;check(message?.type==='message'&&message.role==='assistant'&&message.content?.length===1&&message.content[0].type==='output_text','FINAL_MESSAGE');assembled=api.adaptModelWire(JSON.parse(message.content[0].text),item.context).adapted}catch(error){parseError=typeof error?.message==='string'&&/^[A-Z0-9_]+$/.test(error.message)?error.message:'SCHEMA_OR_ADAPTER_REJECTED'}
    const after=await budget.snapshot(),reservation=after.reservations.find(value=>value.unitId===unitId),result={version:'real-input-contrastive-result-1',unitId,sourceId:item.sourceId,arm,armName:arm==='A'?'candidate03-baseline':'candidate10-contrastive',
      bindingSha:hash(bytes),requestSha:binding.units[index].requestSha,responseSha:observed?.responseSha??null,requestModel:binding.model,returnedModel,modelMatch:returnedModel===binding.model,
      candidateVersion:binding.candidateVersions[arm],exampleVersion:arm==='B'?binding.exampleVersion:null,scorerSha:binding.scorerSha,referenceSha:binding.referenceSha,
      assembled,http:response.status,diagnostic:response.diagnostic??null,waitingMs:Date.now()-start,parseError,totalAttempts:after.reservations.length,usage:reservation?.usage??null,
      costUpperMicroCny:reservation?.costUpperMicroCny??0,totalCostUpperMicroCny:after.reservations.reduce((n,value)=>n+value.costUpperMicroCny,0),providerBilledCny:'NOT_OBSERVABLE',
      automaticSelection:'NOT_ENABLED',qualityClaim:binding.label}
    writeFileSync(resultPath,JSON.stringify(result,null,2)+'\n',{flag:'wx'});return {unitId,http:result.http,parseError,waitingMs:result.waitingMs,costUpperMicroCny:result.costUpperMicroCny,totalAttempts:result.totalAttempts}
  }finally{if(recorder)await recorder.close()}
}

export async function dispatchAll(){
  const outputs=[]
  while(true){const {binding,grant}=verifySend(),budget=await openBudget(LEDGER_DIRECTORY,grant.manifestSha,{batchGrant:grant}),state=await budget.snapshot(),index=state.reservations.length-290
    if(index>=24)break
    const unitId=binding.units[index].unitId,result=await dispatchContrastive(unitId);outputs.push(result);console.error(JSON.stringify(result));if(result.http!==200||result.parseError)break
  }
  return {attempted:outputs.length,last:outputs.at(-1)??null,complete:(await openBudget(LEDGER_DIRECTORY,verifySend().grant.manifestSha,{batchGrant:verifySend().grant}).then(b=>b.snapshot())).reservations.length===314}
}

export function analyzeContrastive(){
  const {binding,bytes}=verifySend(),rows=[]
  for(const item of binding.items)for(const arm of ['A','B']){const unitId=item.id+'-'+arm,result=read(unitId+'_RESULT.json'),raw=readFileSync(join(DIRECTORY,unitId+'_RAW.jsonl'),'utf8').trimEnd().split('\n').map(JSON.parse)
    check(raw.length===1&&raw[0].responseSha===hash(raw[0].rawHttpText)&&result.responseSha===raw[0].responseSha&&result.assembled&&!result.parseError,'ANALYSIS_INPUT')
    rows.push({id:item.sourceId,unitId,arm,armName:result.armName,assembled:result.assembled,waitingMs:result.waitingMs,usage:result.usage,costUpperMicroCny:result.costUpperMicroCny,responseSha:result.responseSha})}
  const scored=aggregateContrastiveScores(rows),pairWins={A:0,B:0,tie:0}
  for(const item of binding.items){const a=scored.cases.find(row=>row.unitId===item.id+'-A').score,b=scored.cases.find(row=>row.unitId===item.id+'-B').score;if(a.passed>b.passed)pairWins.A++;else if(b.passed>a.passed)pairWins.B++;else pairWins.tie++}
  const operational=Object.fromEntries(['A','B'].map(arm=>{const selected=rows.filter(row=>row.arm===arm);return[arm,{medianWaitingMs:selected.map(row=>row.waitingMs).sort((a,b)=>a-b)[Math.floor(selected.length/2)],
    inputTokens:selected.reduce((n,row)=>n+row.usage.input_tokens,0),outputTokens:selected.reduce((n,row)=>n+row.usage.output_tokens,0),costUpperMicroCny:selected.reduce((n,row)=>n+row.costUpperMicroCny,0)}]}))
  const output={version:'real-input-contrastive-analysis-1',evaluationType:'single-author-synthetic-development',blind:false,independentGroundTruth:false,bindingSha:hash(bytes),sources:12,requests:24,
    arms:{A:'candidate03-baseline',B:'candidate10-contrastive'},metrics:scored.arms,pairWins,operational,cases:scored.cases,generatedAt:new Date().toISOString(),
    claimBoundary:'Development diagnostic only; does not measure real user accept-and-save conversion and cannot authorize Preview or Production.'}
  writeFileSync(join(DIRECTORY,'MODEL_COMPARISON.json'),JSON.stringify(output,null,2)+'\n',{flag:'wx'});return output
}

if(import.meta.url===pathToFileURL(process.argv[1]).href){const args=process.argv.slice(2)
  if(args.length===1&&args[0]==='--prepare')console.log(JSON.stringify(await prepareContrastive()))
  else if(args.length===1&&args[0]==='--dispatch-all')console.log(JSON.stringify(await dispatchAll()))
  else if(args.length===1&&/^--dispatch=K(?:0[1-9]|1[0-2])-[AB]$/.test(args[0]))console.log(JSON.stringify(await dispatchContrastive(args[0].split('=')[1])))
  else if(args.length===1&&args[0]==='--analyze')console.log(JSON.stringify(analyzeContrastive()))
  else throw Error('CONTRASTIVE_RUNNER_ARGUMENT')}
