import {existsSync,mkdirSync,readFileSync,openSync,closeSync,writeFileSync,fsyncSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {createPinnedProxyFetch,assertModelGatewayConfigured} from './real-input-model-gateway.mjs'
import {validateChain} from './candidate13-d6-budget.mjs'
import {frozenRequests,newState,assertAuthorization,conservativeUpperMicroUsd,MAX_INPUT_TOKENS,runOne,fileLock,atomicStateWriter,rawWriter,offlineAudit,nextOrdinal,auditUnitMetadata} from './d25-executor.mjs'
import {verifyD25,sha} from './prepare-d25.mjs'

const BRANCH='codex/e2-candidate11-blind-eval',BATCH='D25-C17-C18-DEVELOPMENT-R1'
const LEDGER=resolve('C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')
const ROOT=resolve('.data/d25/execution'),AUTH=join(ROOT,'AUTHORIZATION.json'),STATE=join(ROOT,'STATE.json'),LOCK=join(ROOT,'lock')
const check=(x,code)=>{if(!x)throw Error('D25_LIVE_'+code)}
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim()
const read=path=>JSON.parse(readFileSync(path,'utf8'))
function writeOnce(path,value){const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd)}finally{closeSync(fd)}}
function gitBound(head){check(git(['branch','--show-current'])===BRANCH&&git(['rev-parse','HEAD'])===head&&git(['rev-parse','@{u}'])===head&&git(['ls-remote','origin','refs/heads/'+BRANCH]).split(/\s+/)[0]===head&&!git(['status','--porcelain']),'GIT_DRIFT')}
export function validatePriceScope(auth,now=Date.now()){
  check(auth.purpose==='D25-C17-C18-16-FROZEN'&&auth.authorizationSource==='CURRENT_USER_MESSAGE'&&/^[a-f0-9]{64}$/.test(auth.userMessageSha256)&&auth.batchId===BATCH,'AUTH_SCOPE')
  check(Number.isSafeInteger(auth.ledgerBaselineRows)&&auth.ledgerBaselineRows>0&&/^[a-f0-9]{64}$/.test(auth.ledgerBaselineSha256)&&Number.isSafeInteger(auth.ledgerBaselineBytes)&&auth.ledgerBaselineBytes>0,'LEDGER_AUTH_BINDING')
  check(auth.endpoint==='https://api.deepseek.com/responses'&&auth.temperature===0&&auth.reasoningEffort==='none'&&auth.maxOutputTokens===8192&&auth.retry===0&&auth.repair===0&&auth.verifier===0,'ROUTE_AUTH_BINDING')
  const verified=Date.parse(auth.priceVerifiedAt),until=Date.parse(auth.priceValidUntil)
  check(auth.priceSourceUrl==='https://api-docs.deepseek.com/quick_start/pricing/'&&Number.isFinite(verified)&&Number.isFinite(until)&&verified<=now&&until>now&&until-verified<=12*3600000,'PRICE_STALE')
  check(auth.peakInputUsdPerMillion===0.3&&auth.peakOutputUsdPerMillion===1.2&&auth.maxInputTokens===MAX_INPUT_TOKENS&&16*conservativeUpperMicroUsd(MAX_INPUT_TOKENS,8192)<=auth.hardLimitMicroUsd,'BUDGET_CAP')
}
function authorization(units,binding){
  check(existsSync(AUTH),'AUTHORIZATION_REQUIRED')
  const auth=read(AUTH);assertAuthorization(newState(units,binding),auth,units,binding);validatePriceScope(auth);gitBound(auth.committedHead);return auth
}
function ledgerRead(auth,afterGrant){
  const bytes=readFileSync(LEDGER),chain=validateChain(bytes)
  check(bytes.length>=auth.ledgerBaselineBytes&&chain.rows.length>=auth.ledgerBaselineRows&&sha(bytes.subarray(0,auth.ledgerBaselineBytes))===auth.ledgerBaselineSha256,'LEDGER_PREFIX')
  const later=chain.rows.slice(auth.ledgerBaselineRows)
  if(!afterGrant)check(!later.length&&bytes.length===auth.ledgerBaselineBytes&&sha(bytes)===auth.ledgerBaselineSha256&&!chain.rows.some(r=>r.event.grantId===auth.grantId),'NEW_GRANT_AND_FRESH_LEDGER_REQUIRED')
  else check(later[0]?.event.kind==='d25Grant'&&later[0].event.batchId===BATCH&&later[0].event.grantId===auth.grantId&&later.every(r=>r.event.batchId===BATCH&&r.event.grantId===auth.grantId),'LEDGER_BATCH_DRIFT')
  return {bytes,chain,later}
}
function appendRow(auth,event,afterGrant=true){
  const {bytes,chain}=ledgerRead(auth,afterGrant),row={sequence:chain.rows.length,previous:chain.tail,event}
  row.hash=sha(JSON.stringify(row));const line=JSON.stringify(row)+'\n',receipt=join(ROOT,'receipts',String(row.sequence).padStart(9,'0')+'.json')
  const fd=openSync(receipt,'wx',0o600);try{writeFileSync(fd,line);fsyncSync(fd)}finally{closeSync(fd)}
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',resolve('scripts/d25-ledger-append.ps1'),'-Ledger',LEDGER,'-ExpectedSha',sha(bytes),'-RowPath',receipt,'-ExpectedAfterSha',sha(Buffer.concat([bytes,Buffer.from(line)]))],{encoding:'utf8',stdio:'pipe'})
  const after=readFileSync(LEDGER);validateChain(after);check(after.equals(Buffer.concat([bytes,Buffer.from(line)])),'LEDGER_APPEND_UNCERTAIN')
  return row
}
export function verifyOffline(){const bytes=readFileSync(LEDGER),chain=validateChain(bytes);return {...offlineAudit(),liveAuthorizationFileExists:existsSync(AUTH),ledgerMode:'READ_ONLY_NO_GRANT',ledger:{rows:chain.rows.length,bytes:bytes.length,sha256:sha(bytes),tail:chain.tail}}}
export async function prepareAuthorized(){
  const binding=verifyD25(),units=frozenRequests(),auth=authorization(units,binding)
  check(!existsSync(STATE)&&!existsSync(LOCK),'RUN_ALREADY_STARTED');ledgerRead(auth,false)
  mkdirSync(join(ROOT,'raw'),{recursive:true});mkdirSync(join(ROOT,'receipts'),{recursive:true})
  return fileLock(LOCK,async()=>{appendRow(auth,{kind:'d25Grant',batchId:BATCH,grantId:auth.grantId,head:auth.committedHead,...binding,hardLimitMicroUsd:auth.hardLimitMicroUsd},false);writeOnce(STATE,{...newState(units,binding),authorized:true,grantId:auth.grantId,committedHead:auth.committedHead});return {status:'AUTHORIZED_NOT_SENT',units:16,grantId:auth.grantId}})
}
function auditSettled(auth,state,units,ordinal){
  gitBound(auth.committedHead);const {later}=ledgerRead(auth,true),settled=state.units.filter(u=>u.status==='SETTLED').length
  check(ordinal===settled+1&&later.length===1+2*settled,'LEDGER_STATE_DRIFT')
  check(later[0].event.head===auth.committedHead&&later[0].event.manifestSha256===auth.manifestSha256&&later[0].event.identitiesSha256===auth.identitiesSha256&&later[0].event.hardLimitMicroUsd===auth.hardLimitMicroUsd,'GRANT_LEDGER_DRIFT')
  for(let i=0;i<settled;i++){
    const u=units[i],reserve=later[1+2*i]?.event,settle=later[2+2*i]?.event,row=state.units[i],raw=read(join(ROOT,'raw',String(i+1).padStart(2,'0')+'.json'))
    check(reserve?.kind==='d25Reserve'&&settle?.kind==='d25Settle'&&reserve.ordinal===i+1&&settle.ordinal===i+1&&reserve.requestSha256===u.requestSha256&&reserve.unitIdentitySha256===u.unitIdentitySha256&&settle.responseSha256===row.responseSha256&&settle.costUpperMicroUsd===row.costUpperMicroUsd&&sha(raw.rawHttpText)===row.responseSha256&&raw.requestSha256===u.requestSha256,'LEDGER_UNIT_DRIFT')
    check(raw.ordinal===i+1&&raw.unitIdentitySha256===u.unitIdentitySha256&&raw.responseSha256===row.responseSha256,'RAW_IDENTITY_DRIFT');auditUnitMetadata(raw,row,settle)
  }
  for(const row of later)check(sha(readFileSync(join(ROOT,'receipts',String(row.sequence).padStart(9,'0')+'.json')))===sha(JSON.stringify(row)+'\n'),'RECEIPT_DRIFT')
}
async function sendOnce(bodyText,unit,auth){
  // No credential loading occurs during import, --verify, offline tests or missing authorization.
  validatePriceScope(auth);gitBound(auth.committedHead)
  const {later}=ledgerRead(auth,true),reservation=later.at(-1)?.event
  check(later.length===2*unit.ordinal&&reservation.kind==='d25Reserve'&&reservation.ordinal===unit.ordinal&&reservation.requestSha256===unit.requestSha256,'RESERVATION_BEFORE_SEND')
  const env=resolve('C:/Users/Winner/student-affairs-multimodal-exp/.env');if(existsSync(env))process.loadEnvFile(env)
  assertModelGatewayConfigured();const secret=process.env.DEEPSEEK_API_KEY,fetcher=createPinnedProxyFetch(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000)
  try{const r=await fetcher(auth.endpoint,{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:bodyText,redirect:'manual',signal:controller.signal}),chunks=[];let size=0
    for await(const chunk of r.body){size+=chunk.length;check(size<=524288,'RESPONSE_TOO_LARGE');chunks.push(chunk)}
    const text=Buffer.concat(chunks).toString('utf8');check(!text.includes(secret),'CREDENTIAL_REFLECTION');return {status:r.status,contentType:r.headers.get('content-type'),requestId:r.headers.get('x-request-id'),text}
  }finally{clearTimeout(timer)}
}
export async function dispatchNext(){
  const binding=verifyD25(),units=frozenRequests(),auth=authorization(units,binding);check(existsSync(STATE),'GRANT_NOT_PREPARED')
  const state=read(STATE);assertAuthorization(state,auth,units,binding);check(state.authorized===true&&state.grantId===auth.grantId&&state.committedHead===auth.committedHead,'GRANT_STATE')
  return runOne({state,auth,units,binding,lock:fn=>fileLock(LOCK,fn),persist:atomicStateWriter(STATE),rawStore:rawWriter(join(ROOT,'raw')),preflight:async({ordinal})=>auditSettled(auth,state,units,ordinal),ledger:{reserve:async args=>appendRow(auth,{kind:'d25Reserve',batchId:BATCH,...args}),settle:async args=>appendRow(auth,{kind:'d25Settle',batchId:BATCH,...args})},transport:{sendOnce:(body,unit)=>sendOnce(body,unit,auth)}})
}
export function resumeReadOnly(){check(existsSync(STATE),'STATE_NOT_FOUND');const state=read(STATE);return {state,nextOrdinal:nextOrdinal(state),dispatch:'NOT_PERFORMED',ledgerMode:'READ_ONLY'}}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const mode=process.argv[2];if(mode==='--verify')console.log(JSON.stringify(verifyOffline()));else if(mode==='--resume-read-only')console.log(JSON.stringify(resumeReadOnly()));else if(mode==='--prepare-authorized')console.log(JSON.stringify(await prepareAuthorized()));else if(mode==='--dispatch-next')console.log(JSON.stringify(await dispatchNext()));else throw Error('D25_LIVE_ARGUMENT')}
