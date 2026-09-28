import {createHash, randomUUID} from 'node:crypto'
import {existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync, renameSync, rmdirSync, fsyncSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {createPinnedProxyFetch, assertModelGatewayConfigured} from './real-input-model-gateway.mjs'
import {validateUsageAccountingEnvelope, CANDIDATE11_B2_UNIT_POLICY} from './real-input-budget.mjs'
import {validateChain} from './candidate13-d6-budget.mjs'
import {verifyGovernanceProtection} from './verify-governance-protection.mjs'

export const D11='docs/recognition-optimization/candidate15/d11-development-20260928a'
const D10='docs/recognition-optimization/candidate15/d10-development'
const BRANCH='codex/e2-candidate11-blind-eval'
const MANIFEST_SHA='cf7a5186ce6588103502ec586ec33c63937c4716f997c32e3a4706999e2e5146'
const IDENTITIES_SHA='c9fdaa56f9fe072fcb0d47e9a177c5111f265c8ee5aba293cbb578d5a584c721'
const LEDGER=resolve('C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')
const LOCK=resolve('C:/Users/Winner/student-affairs-multimodal-exp/.data/candidate15-d11-20260928a.lock')
const BASELINE={rows:791,sha256:'efb46f116db9c550ba53624c5d710164c6143ba9cc30c57ab2b7515c059f4d6a'}
const MODEL='deepseek-flash', CONTEXT_TOKENS=1048576, OUTPUT_TOKENS=8192, HARD_MICRO_USD=8000000
const INPUT_PRICE=300000, OUTPUT_PRICE=1200000
const ceilDiv=(a,b)=>Number((BigInt(a)+BigInt(b)-1n)/BigInt(b))
export const UNIT_RESERVE_MICRO_USD=ceilDiv(BigInt(CONTEXT_TOKENS)*BigInt(INPUT_PRICE)+BigInt(OUTPUT_TOKENS)*BigInt(OUTPUT_PRICE),1000000)
const SHA=value=>createHash('sha256').update(value).digest('hex')
const check=(test,code)=>{if(!test)throw Error('D11_'+code)}
const read=name=>JSON.parse(readFileSync(join(D11,name),'utf8'))
function writeNewText(path,text){const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,text);fsyncSync(fd)}finally{closeSync(fd)}}
const writeNew=(path,value)=>writeNewText(path,JSON.stringify(value,null,2)+'\n')
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim()
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
function protectedFilesD11(){
  const governance=JSON.parse(readFileSync('docs/governance/GOVERNANCE_BASELINE.json'))
  const historical=JSON.parse(readFileSync('docs/recognition-optimization/candidate11/BRANCH_BASELINE.json')).protectedFiles
  check(historical.length===84,'PROTECTED_COUNT')
  for(const file of historical){const changed=governance.transitions.find(t=>t.path===file.path)
    if(changed)check(SHA(readFileSync(changed.archivePath))===file.sha256&&SHA(readFileSync(file.path))===changed.currentSha256,'PROTECTED_TRANSITION')
    else check(SHA(readFileSync(file.path))===file.sha256,'PROTECTED_DRIFT')}
  const freeze=JSON.parse(readFileSync(governance.d7Freeze.path))
  check(freeze.components.every(file=>SHA(readFileSync(file.path))===file.sha256),'D7_FREEZE_DRIFT')
  return historical.length
}
export function assertD11NextState(units,ordinal,ledgerEvents){
  check(Number.isInteger(ordinal)&&ordinal>=1&&ordinal<=24&&units.length===24,'ORDINAL')
  check(units.slice(0,ordinal-1).every(u=>u.status==='SETTLED')&&units[ordinal-1].status==='NOT_SENT'&&units.slice(ordinal).every(u=>u.status==='NOT_SENT'),'DUPLICATE_OR_UNCERTAIN')
  check(ledgerEvents===1+2*(ordinal-1),'LEDGER_ORDER')
  return true
}
export function assertD11Identity(row,bound){
  check(row.ordinal===bound.ordinal&&row.unitIdentitySha256===bound.unitIdentitySha256&&row.requestSha256===bound.requestSha256&&SHA(JSON.stringify(row.body))===row.requestSha256,'IDENTITY_DRIFT')
  return true
}
export function sealD11Uncertain(state,ordinal,reason,persist=saveState){
  check(['SEND_OR_TRANSPORT','RAW_STORAGE','HTTP_OR_PROTOCOL','USAGE','SETTLEMENT'].includes(reason),'UNCERTAIN_REASON')
  const unit=state.units[ordinal-1]
  check(unit&&['RESERVED','SENDING','RAW_SAVED'].includes(unit.status),'UNCERTAIN_TRANSITION')
  unit.status='UNCERTAIN';unit.haltReason=reason;persist(state)
  return unit
}

function gitState(clean){
  const head=git(['rev-parse','HEAD']),branch=git(['branch','--show-current']),upstream=git(['rev-parse','@{u}'])
  const remote=git(['ls-remote','origin','refs/heads/'+BRANCH]).split(/\s+/)[0]
  check(branch===BRANCH&&head===upstream&&head===remote,'GIT_SYNC')
  if(clean)check(git(['status','--porcelain']).length===0,'WORKTREE_DIRTY')
  return {head,branch,upstream,remote}
}
function ancestor(base,head){try{execFileSync('git',['merge-base','--is-ancestor',base,head],{stdio:'ignore'});return true}catch{return false}}
function frozen(){
  check(SHA(readFileSync(join(D10,'MANIFEST.json')))===MANIFEST_SHA,'MANIFEST_DRIFT')
  check(SHA(readFileSync(join(D10,'PREPARED_REQUEST_IDENTITIES.json')))===IDENTITIES_SHA,'IDENTITIES_DRIFT')
  const packageCheck=JSON.parse(execFileSync(process.execPath,['scripts/prepare-candidate15-d10.mjs','--verify'],{encoding:'utf8'}))
  check(packageCheck.sources===12&&packageCheck.requests===24&&packageCheck.dispatchAuthorized===false,'D10_VERIFY')
  const list=JSON.parse(readFileSync(join(D10,'PREPARED_REQUEST_IDENTITIES.json'))).requests
  check(list.length===24&&list.every((row,i)=>row.ordinal===i+1&&row.model===MODEL&&row.dispatchAuthorized===false&&row.status==='NOT_RUN'&&digest(row.unitIdentitySha256)&&digest(row.requestSha256)&&SHA(JSON.stringify(row.body))===row.requestSha256),'REQUESTS')
  check(list.filter(row=>row.arm==='A').length===12&&list.filter(row=>row.arm==='B').length===12&&list.filter(row=>row.order==='AB').length===12&&list.filter(row=>row.order==='BA').length===12,'BALANCE')
  check(list.every(row=>row.body.model===MODEL&&row.body.temperature===0&&row.body.reasoning?.effort==='none'&&row.body.stream===false&&row.body.max_output_tokens===OUTPUT_TOKENS&&!JSON.stringify(row.body).includes('Expected')),'PARAMETERS')
  return list
}
export function auditFrozenD11(){
  const list=frozen(),bytes=readFileSync(LEDGER),chain=validateChain(bytes)
  check(chain.rows.length===BASELINE.rows&&SHA(bytes)===BASELINE.sha256,'LEDGER_BASELINE')
  verifyGovernanceProtection()
  const protectedFiles=protectedFilesD11();check(protectedFiles===84,'PROTECTED_FILES')
  return {status:'PASS',requests:list.length,arms:{A:list.filter(r=>r.arm==='A').length,B:list.filter(r=>r.arm==='B').length},batchWorstMicroUsd:24*UNIT_RESERVE_MICRO_USD,hardLimitMicroUsd:HARD_MICRO_USD,ledgerRows:chain.rows.length,protectedFiles}
}
function ledgerState(binding,allowD11){
  const bytes=readFileSync(LEDGER),{rows,tail}=validateChain(bytes)
  check(rows.length>=BASELINE.rows&&SHA(bytes.subarray(0,binding.ledgerPrefixBytes))===BASELINE.sha256,'LEDGER_PREFIX')
  if(!allowD11)check(rows.length===BASELINE.rows&&SHA(bytes)===BASELINE.sha256,'LEDGER_BASELINE')
  const later=rows.slice(BASELINE.rows),grantRows=later.filter(row=>row.event.kind==='candidate15D11Grant')
  check(later.every(row=>row.event.batchId===binding.batchId)&&grantRows.length<=1,'FOREIGN_LEDGER_APPEND')
  if(allowD11)check(grantRows.length===1&&grantRows[0].event.grantId===binding.grantId,'GRANT_MISSING')
  return {bytes,rows,tail,later,sha256:SHA(bytes)}
}
function append(state,event){
  const row={sequence:state.rows.length,previous:state.tail,event}
  row.hash=SHA(JSON.stringify(row))
  const text=JSON.stringify(row)+'\n'
  const receipt=join(D11,'receipts',String(row.sequence).padStart(9,'0')+'.json')
  writeNewText(receipt,text)
  const handle=openSync(LEDGER,'a')
  try{writeFileSync(handle,text);fsyncSync(handle)}finally{closeSync(handle)}
  return row
}
function withLock(fn){
  mkdirSync(LOCK)
  let clean=false
  try{const result=fn(()=>{clean=true});return result}
  finally{if(clean)rmdirSync(LOCK)}
}
function statePath(){return join(D11,'STATE.json')}
function saveState(value){const temp=statePath()+'.new';writeNewText(temp,JSON.stringify(value,null,2)+'\n');renameSync(temp,statePath())}
function verifyBound(){
  const binding=read('BINDING.json'),grant=read('GRANT.json'),authorization=read('AUTHORIZATION.json'),billing=read('BILLING.json'),manifest=read('RUN_MANIFEST.json'),state=read('STATE.json'),list=frozen(),gitInfo=gitState(false)
  check(protectedFilesD11()===84,'PROTECTED_FILES')
  check(ancestor(binding.head,gitInfo.head)&&binding.manifestSha256===MANIFEST_SHA&&binding.identitiesSha256===IDENTITIES_SHA&&binding.branch===BRANCH,'BINDING')
  check(binding.units.length===24&&binding.units.every((row,i)=>assertD11Identity(list[i],row)),'UNIT_DRIFT')
  check(authorization.authorized===true&&authorization.count===24&&authorization.model===MODEL&&authorization.hardLimitMicroUsd===HARD_MICRO_USD&&authorization.grantId===grant.grantId&&grant.batchId===binding.batchId&&grant.grantId===binding.grantId,'AUTHORIZATION')
  check(manifest.batchId===binding.batchId&&manifest.grantId===binding.grantId&&manifest.head===binding.head&&manifest.manifestSha256===MANIFEST_SHA&&manifest.identitiesSha256===IDENTITIES_SHA&&manifest.retry===0&&manifest.repair===0&&manifest.verifier===0&&manifest.units===24,'RUN_MANIFEST')
  check(billing.unitWorstMicroUsd===UNIT_RESERVE_MICRO_USD&&billing.batchWorstMicroUsd===24*UNIT_RESERVE_MICRO_USD&&billing.batchWorstMicroUsd<=HARD_MICRO_USD&&Date.now()<=Date.parse(billing.validUntil),'BUDGET')
  check(state.batchId===binding.batchId&&state.units.length===24&&state.units.every((u,i)=>u.ordinal===i+1&&['NOT_SENT','RESERVED','SENDING','RAW_SAVED','SETTLED','UNCERTAIN'].includes(u.status)),'STATE')
  return {binding,grant,authorization,billing,state,list}
}
export function verifyD11Preparation(){
  const data=verifyBound(),ledger=ledgerState(data.binding,true)
  check(ledger.later[0]?.event.kind==='candidate15D11Grant','GRANT_ORDER')
  let at=1
  for(const unit of data.state.units){
    if(unit.status==='NOT_SENT')continue
    const reserve=ledger.later[at++]?.event
    check(reserve?.kind==='candidate15D11Reserve'&&reserve.ordinal===unit.ordinal&&reserve.requestSha256===data.binding.units[unit.ordinal-1].requestSha256,'RESERVE_CHAIN')
    if(unit.status==='SETTLED'){
      const settle=ledger.later[at++]?.event
      check(settle?.kind==='candidate15D11Settle'&&settle.ordinal===unit.ordinal&&settle.responseSha256===unit.responseSha256,'SETTLE_CHAIN')
    } else check(unit.status==='RESERVED'||unit.status==='SENDING'||unit.status==='RAW_SAVED'||unit.status==='UNCERTAIN','PENDING')
  }
  check(at===ledger.later.length,'LEDGER_EVENTS')
  for(const row of ledger.later){const receipt=join(D11,'receipts',String(row.sequence).padStart(9,'0')+'.json');check(existsSync(receipt)&&SHA(readFileSync(receipt))===SHA(JSON.stringify(row)+'\n'),'RECEIPT_DRIFT')}
  for(const unit of data.state.units.filter(u=>u.status==='SETTLED')){const raw=readFileSync(join(D11,'raw',String(unit.ordinal).padStart(2,'0')+'.json'),'utf8'),record=JSON.parse(raw);check(record.responseSha256===SHA(record.rawHttpText)&&record.responseSha256===unit.responseSha256&&record.requestSha256===data.list[unit.ordinal-1].requestSha256,'RAW_DRIFT')}
  const pending=data.state.units.find(u=>!['NOT_SENT','SETTLED'].includes(u.status))
  return {status:pending?'SAFETY_STOP':'PASS',head:data.binding.head,settled:data.state.units.filter(u=>u.status==='SETTLED').length,pending:pending?.ordinal??null,ledgerRows:ledger.rows.length,ledgerSha256:ledger.sha256}
}
export function prepareD11(){
  const gitInfo=gitState(true),preflight=auditFrozenD11(),list=frozen(),bytes=readFileSync(LEDGER)
  check(preflight.status==='PASS','PREFLIGHT')
  check(!existsSync(D11)&&!existsSync(LOCK),'EXISTING_RUN')
  const {rows}=validateChain(bytes)
  check(rows.length===BASELINE.rows&&SHA(bytes)===BASELINE.sha256,'LEDGER_BASELINE')
  check(24*UNIT_RESERVE_MICRO_USD<=HARD_MICRO_USD,'BUDGET_CAP')
  mkdirSync(join(D11,'raw'),{recursive:true});mkdirSync(join(D11,'receipts'),{recursive:true})
  const batchId=randomUUID(),grantId=randomUUID(),now=new Date(),binding={version:'candidate15-d11-binding-1',batchId,grantId,head:gitInfo.head,branch:BRANCH,manifestSha256:MANIFEST_SHA,identitiesSha256:IDENTITIES_SHA,ledgerPrefixBytes:bytes.length,units:list.map(r=>({ordinal:r.ordinal,sourceId:r.sourceId,arm:r.arm,unitIdentitySha256:r.unitIdentitySha256,requestSha256:r.requestSha256})),createdAt:now.toISOString()}
  const billing={version:'candidate15-d11-billing-1',verifiedAt:now.toISOString(),validUntil:new Date(now.getTime()+12*3600000).toISOString(),model:MODEL,contextTokens:CONTEXT_TOKENS,outputTokens:OUTPUT_TOKENS,peakInputMicroUsdPerMillion:INPUT_PRICE,peakOutputMicroUsdPerMillion:OUTPUT_PRICE,unitWorstMicroUsd:UNIT_RESERVE_MICRO_USD,batchWorstMicroUsd:24*UNIT_RESERVE_MICRO_USD,hardLimitMicroUsd:HARD_MICRO_USD,providerActualUsd:'NOT_OBSERVABLE',sources:['https://api-docs.deepseek.com/quick_start/pricing/','https://api-docs.deepseek.com/api/list-models/','https://api-docs.deepseek.com/api/create-response/']}
  const authorization={version:'candidate15-d11-authorization-1',authorized:true,evidence:'user D11 message',count:24,model:MODEL,hardLimitMicroUsd:HARD_MICRO_USD,grantId,batchId,retries:0,repair:0,verifier:0}
  const grant={version:'candidate15-d11-grant-1',batchId,grantId,head:gitInfo.head,manifestSha256:MANIFEST_SHA,identitiesSha256:IDENTITIES_SHA,unitWorstMicroUsd:UNIT_RESERVE_MICRO_USD,batchWorstMicroUsd:24*UNIT_RESERVE_MICRO_USD,hardLimitMicroUsd:HARD_MICRO_USD}
  const runManifest={version:'candidate15-d11-run-manifest-1',batchId,grantId,head:gitInfo.head,dataRole:'FULLY_SEEN_SYNTHETIC_DEVELOPMENT',truthStatus:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',sources:12,units:24,arms:{A:12,B:12},balancedOrder:{AB:6,BA:6},model:MODEL,fixedParameters:{temperature:0,reasoning:{effort:'none'},stream:false,max_output_tokens:OUTPUT_TOKENS,timezone:'Asia/Shanghai'},dispatchAuthorization:'D11_USER_MESSAGE_ONLY',retry:0,repair:0,verifier:0,requestOrder:'D10_ORDINAL',stopOnUncertainty:true,manifestSha256:MANIFEST_SHA,identitiesSha256:IDENTITIES_SHA,hardLimitMicroUsd:HARD_MICRO_USD}
  for(const [name,value] of [['BINDING.json',binding],['BILLING.json',billing],['AUTHORIZATION.json',authorization],['GRANT.json',grant],['RUN_MANIFEST.json',runManifest]])writeNew(join(D11,name),value)
  writeNew(statePath(),{version:'candidate15-d11-state-1',batchId,units:list.map(r=>({ordinal:r.ordinal,status:'NOT_SENT'}))})
  withLock(release=>{append(ledgerState(binding,false),{kind:'candidate15D11Grant',batchId,grantId,head:gitInfo.head,manifestSha256:MANIFEST_SHA});release()})
  return verifyD11Preparation()
}

// The credential is read only inside this server-side transport closure; it is never returned or logged.
async function sendOnce(bodyText){
  const fetcher=createPinnedProxyFetch(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000)
  try{const response=await fetcher('https://api.deepseek.com/responses',{method:'POST',headers:{Authorization:'Bearer '+process.env.DEEPSEEK_API_KEY,'Content-Type':'application/json'},body:bodyText,redirect:'manual',signal:controller.signal})
    const chunks=[];let size=0
    for await(const chunk of response.body){size+=chunk.length;check(size<=524288,'RESPONSE_TOO_LARGE');chunks.push(chunk)}
    const text=Buffer.concat(chunks).toString('utf8'),secret=process.env.DEEPSEEK_API_KEY
    check(!text.includes(secret),'CREDENTIAL_REFLECTION')
    // The provider may escape individual characters inside JSON strings.
    if(response.headers.get('content-type')?.startsWith('application/json')){
      let decoded
      try{decoded=JSON.parse(text)}catch{decoded=null}
      const scan=(value,depth=0)=>{check(depth<32,'RESPONSE_DEPTH');if(typeof value==='string'){check(!value.includes(secret),'CREDENTIAL_REFLECTION');if(value.includes('"')){try{scan(JSON.parse(value),depth+1)}catch(error){if(typeof error?.message==='string'&&error.message.startsWith('D11_'))throw error}}}else if(value&&typeof value==='object')for(const child of Object.values(value))scan(child,depth+1)}
      scan(decoded)
      for(const token of text.matchAll(/"(?:\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})|[^"\\\u0000-\u001f])*"/g))try{scan(JSON.parse(token[0]))}catch(error){if(typeof error?.message==='string'&&error.message.startsWith('D11_'))throw error}
    }
    return {status:response.status,contentType:response.headers.get('content-type'),text}
  }finally{clearTimeout(timer)}
}
export async function dispatchNext(){
  const data=verifyBound(),ordinal=data.state.units.find(u=>u.status!=='SETTLED')?.ordinal
  check(git(['rev-parse','HEAD'])===data.binding.head,'DISPATCH_HEAD_DRIFT')
  check(ordinal&&data.state.units[ordinal-1].status==='NOT_SENT','PENDING_OR_COMPLETE')
  const row=data.list[ordinal-1],bodyText=JSON.stringify(row.body)
  check(SHA(bodyText)===row.requestSha256,'REQUEST_DRIFT')
  mkdirSync(LOCK)
  let safeToRelease=false
  try{
    const before=verifyBound(),ledger=ledgerState(before.binding,true)
    assertD11NextState(before.state.units,ordinal,ledger.later.length)
    const env=resolve('C:/Users/Winner/student-affairs-multimodal-exp/.env')
    if(existsSync(env))process.loadEnvFile(env)
    try{assertModelGatewayConfigured()}catch{safeToRelease=true;throw Error('D11_SERVER_CONFIGURATION_UNAVAILABLE')}
    const reserved=before.state.units.reduce((n,u)=>n+(u.status==='SETTLED'?u.costUpperMicroUsd??UNIT_RESERVE_MICRO_USD:u.status==='NOT_SENT'?0:UNIT_RESERVE_MICRO_USD),0)
    check(reserved+UNIT_RESERVE_MICRO_USD<=HARD_MICRO_USD,'BUDGET_EXCEEDED')
    append(ledger,{kind:'candidate15D11Reserve',batchId:before.binding.batchId,grantId:before.binding.grantId,ordinal,requestSha256:row.requestSha256,unitIdentitySha256:row.unitIdentitySha256,reservedMicroUsd:UNIT_RESERVE_MICRO_USD})
    before.state.units[ordinal-1]={ordinal,status:'RESERVED'};saveState(before.state)
    before.state.units[ordinal-1].status='SENDING';saveState(before.state)
    let exchange
    try{exchange=await sendOnce(bodyText)}catch{sealD11Uncertain(before.state,ordinal,'SEND_OR_TRANSPORT');throw Error('D11_SEND_OR_TRANSPORT_UNCERTAIN')}
    const raw={version:'candidate15-d11-raw-1',ordinal,sourceId:row.sourceId,arm:row.arm,requestSha256:row.requestSha256,unitIdentitySha256:row.unitIdentitySha256,httpStatus:exchange.status,contentType:exchange.contentType,rawHttpText:exchange.text,responseSha256:SHA(exchange.text),receivedAt:new Date().toISOString()}
    try{writeNew(join(D11,'raw',String(ordinal).padStart(2,'0')+'.json'),raw)}catch{sealD11Uncertain(before.state,ordinal,'RAW_STORAGE');throw Error('D11_RAW_STORAGE_UNCERTAIN')}
    before.state.units[ordinal-1]={ordinal,status:'RAW_SAVED',responseSha256:raw.responseSha256};saveState(before.state)
    if(exchange.status!==200||!exchange.contentType?.startsWith('application/json')){sealD11Uncertain(before.state,ordinal,'HTTP_OR_PROTOCOL');throw Error('D11_HTTP_OR_PROTOCOL_UNCERTAIN')}
    let usage
    try{usage=validateUsageAccountingEnvelope(exchange.text,200,CANDIDATE11_B2_UNIT_POLICY)}catch{sealD11Uncertain(before.state,ordinal,'USAGE');throw Error('D11_USAGE_UNCERTAIN')}
    const costUpperMicroUsd=ceilDiv(BigInt(usage.usage.input_tokens)*BigInt(INPUT_PRICE)+BigInt(usage.usage.output_tokens)*BigInt(OUTPUT_PRICE),1000000)
    check(costUpperMicroUsd<=UNIT_RESERVE_MICRO_USD,'USAGE_OVER_RESERVE')
    try{append(ledgerState(before.binding,true),{kind:'candidate15D11Settle',batchId:before.binding.batchId,grantId:before.binding.grantId,ordinal,requestSha256:row.requestSha256,responseSha256:raw.responseSha256,responseId:usage.responseId,usage:usage.usage,costUpperMicroUsd,responseStatus:usage.responseStatus})}
    catch{sealD11Uncertain(before.state,ordinal,'SETTLEMENT');throw Error('D11_SETTLEMENT_UNCERTAIN')}
    before.state.units[ordinal-1]={ordinal,status:'SETTLED',responseSha256:raw.responseSha256,responseId:usage.responseId,usage:usage.usage,costUpperMicroUsd,responseStatus:usage.responseStatus};saveState(before.state)
    safeToRelease=true
    return {ordinal,status:'SETTLED',responseStatus:usage.responseStatus,costUpperMicroUsd}
  }finally{if(safeToRelease)rmdirSync(LOCK)}
}
export async function dispatchAll(){const results=[];while(results.length<24){const state=verifyD11Preparation();if(state.settled===24)break;const result=await dispatchNext();results.push(result);console.error(JSON.stringify(result))}return verifyD11Preparation()}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const cmd=process.argv[2]
  if(cmd==='--prepare')console.log(JSON.stringify(prepareD11()))
  else if(cmd==='--audit-frozen')console.log(JSON.stringify(auditFrozenD11()))
  else if(cmd==='--verify')console.log(JSON.stringify(verifyD11Preparation()))
  else if(cmd==='--dispatch-next')console.log(JSON.stringify(await dispatchNext()))
  else if(cmd==='--dispatch-all')console.log(JSON.stringify(await dispatchAll()))
  else throw Error('D11_ARGUMENT')
}
