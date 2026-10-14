import {existsSync,mkdirSync,readFileSync,openSync,closeSync,writeFileSync,fsyncSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {createPinnedProxyFetch,assertModelGatewayConfigured} from './real-input-model-gateway.mjs'
import {validateChain} from './candidate13-d6-budget.mjs'
import {frozenRequests,newOfflineState,assertAuthorization,conservativeUpperMicroUsd,MAX_INPUT_TOKENS,runOne,fileLock,atomicStateWriter,rawWriter,offlineAudit,sha} from './candidate16-d14-executor.mjs'

const BRANCH='codex/e2-candidate11-blind-eval'
const LEDGER=resolve('C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')
const ROOT=resolve('.data/candidate16/d14-execution'),AUTH=join(ROOT,'AUTHORIZATION.json'),STATE=join(ROOT,'STATE.json'),LOCK=join(ROOT,'lock')
const BASELINE={rows:840,sha256:'ca5bb4f57d011bcf8f583d48d637076a8c76d380d98b3f5b46b0ea6f6c9f17ea'}
const check=(x,code)=>{if(!x)throw Error('D14_LIVE_'+code)}
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim()
const read=path=>JSON.parse(readFileSync(path,'utf8'))
const writeOnce=(path,value)=>{const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd)}finally{closeSync(fd)}}
function gitBound(head){check(git(['branch','--show-current'])===BRANCH&&git(['rev-parse','HEAD'])===head&&git(['rev-parse','@{u}'])===head&&git(['ls-remote','origin','refs/heads/'+BRANCH]).split(/\s+/)[0]===head,'GIT_DRIFT')}
function ledgerRead(auth,afterGrant){
  const bytes=readFileSync(LEDGER),chain=validateChain(bytes)
  check(chain.rows.length>=BASELINE.rows&&sha(bytes.subarray(0,auth.ledgerBaselineBytes))===BASELINE.sha256,'LEDGER_PREFIX')
  const later=chain.rows.slice(BASELINE.rows)
  if(!afterGrant)check(later.length===0&&sha(bytes)===BASELINE.sha256,'LEDGER_CHANGED_BEFORE_GRANT')
  else check(later[0]?.event.kind==='candidate16D14Grant'&&later[0].event.batchId===auth.batchId&&later[0].event.grantId===auth.grantId&&later.every(row=>row.event.batchId===auth.batchId),'LEDGER_BATCH_DRIFT')
  return {bytes,chain,later}
}
function append(auth,event){
  const {chain}=ledgerRead(auth,true),row={sequence:chain.rows.length,previous:chain.tail,event}
  row.hash=sha(JSON.stringify(row))
  const line=JSON.stringify(row)+'\n',receipt=join(ROOT,'receipts',String(row.sequence).padStart(9,'0')+'.json')
  const fd=openSync(receipt,'wx',0o600)
  try{writeFileSync(fd,line);fsyncSync(fd)}finally{closeSync(fd)}
  const writer=openSync(LEDGER,'a')
  try{writeFileSync(writer,line);fsyncSync(writer)}finally{closeSync(writer)}
  return row
}
function authorization(units){
  check(existsSync(AUTH),'AUTHORIZATION_REQUIRED')
  const auth=read(AUTH),state=newOfflineState(units)
  assertAuthorization(state,auth,units)
  check(auth.purpose==='D14-C03-C16-24-FROZEN'&&auth.authorizationSource==='CURRENT_USER_MESSAGE'&&/^[a-f0-9]{64}$/.test(auth.userMessageSha256)&&auth.batchId==='D13-C03-C16-DEVELOPMENT-R1','AUTH_SCOPE')
  check(auth.ledgerBaselineRows===BASELINE.rows&&auth.ledgerBaselineSha256===BASELINE.sha256&&Number.isSafeInteger(auth.ledgerBaselineBytes)&&auth.ledgerBaselineBytes>0,'LEDGER_AUTH_BINDING')
  check(auth.peakInputUsdPerMillion===0.3&&auth.peakOutputUsdPerMillion===1.2&&auth.maxInputTokens===MAX_INPUT_TOKENS&&auth.maxOutputTokens===8192&&Date.now()<=Date.parse(auth.priceValidUntil)&&Date.parse(auth.priceValidUntil)-Date.parse(auth.priceVerifiedAt)<=12*3600000,'PRICE_STALE')
  check(24*conservativeUpperMicroUsd(MAX_INPUT_TOKENS,8192)<=auth.hardLimitMicroUsd,'BUDGET_CAP')
  gitBound(auth.committedHead)
  return auth
}
export function verifyOffline(){return {...offlineAudit(),liveAuthorizationFileExists:existsSync(AUTH),ledgerMode:'READ_ONLY_NO_GRANT'}}
export async function prepareAuthorized(){
  const units=frozenRequests(),auth=authorization(units)
  check(!existsSync(STATE)&&!existsSync(LOCK),'RUN_ALREADY_STARTED')
  check(!git(['status','--porcelain']),'WORKTREE_DIRTY')
  ledgerRead(auth,false)
  mkdirSync(join(ROOT,'raw'),{recursive:true});mkdirSync(join(ROOT,'receipts'),{recursive:true})
  return fileLock(LOCK,async()=>{
    const {chain}=ledgerRead(auth,false)
    // Grant is the first authority-ledger event. If append or state persistence is
    // uncertain the lock remains and a human must inspect receipts/ledger first.
    const grant={sequence:chain.rows.length,previous:chain.tail,event:{kind:'candidate16D14Grant',batchId:auth.batchId,grantId:auth.grantId,head:auth.committedHead,manifestSha256:auth.manifestSha256,hardLimitMicroUsd:auth.hardLimitMicroUsd}}
    grant.hash=sha(JSON.stringify(grant))
    const line=JSON.stringify(grant)+'\n',receipt=join(ROOT,'receipts',String(grant.sequence).padStart(9,'0')+'.json')
    const fd=openSync(receipt,'wx',0o600);try{writeFileSync(fd,line);fsyncSync(fd)}finally{closeSync(fd)}
    const writer=openSync(LEDGER,'a');try{writeFileSync(writer,line);fsyncSync(writer)}finally{closeSync(writer)}
    const state={...newOfflineState(units),authorized:true,grantId:auth.grantId,committedHead:auth.committedHead}
    writeOnce(STATE,state)
    return {status:'AUTHORIZED_NOT_SENT',units:24,grantId:auth.grantId}
  })
}
async function sendOnce(bodyText){
  // Only called after authorized state, fresh price, frozen identity, ledger and
  // per-unit reserve. Never invoked by --verify or offline tests.
  const env=resolve('C:/Users/Winner/student-affairs-multimodal-exp/.env')
  if(existsSync(env))process.loadEnvFile(env)
  assertModelGatewayConfigured()
  const secret=process.env.DEEPSEEK_API_KEY,fetcher=createPinnedProxyFetch(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000)
  try{
    const response=await fetcher('https://api.deepseek.com/responses',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:bodyText,redirect:'manual',signal:controller.signal})
    const chunks=[];let size=0
    for await(const chunk of response.body){size+=chunk.length;check(size<=524288,'RESPONSE_TOO_LARGE');chunks.push(chunk)}
    const raw=Buffer.concat(chunks).toString('utf8')
    check(!raw.includes(secret),'CREDENTIAL_REFLECTION')
    return {status:response.status,contentType:response.headers.get('content-type'),requestId:response.headers.get('x-request-id'),text:raw}
  }finally{clearTimeout(timer)}
}
export async function dispatchNext(){
  const units=frozenRequests(),auth=authorization(units)
  check(existsSync(STATE),'GRANT_NOT_PREPARED')
  const state=read(STATE)
  assertAuthorization(state,auth,units)
  check(state.authorized===true&&state.grantId===auth.grantId&&state.committedHead===auth.committedHead,'GRANT_STATE')
  return runOne({state,auth,units,lock:fn=>fileLock(LOCK,fn),persist:atomicStateWriter(STATE),rawStore:rawWriter(join(ROOT,'raw')),
    preflight:async({ordinal})=>{
      gitBound(auth.committedHead)
      const {later}=ledgerRead(auth,true),settled=state.units.filter(u=>u.status==='SETTLED').length
      check(ordinal===settled+1&&later.length===1+2*settled,'LEDGER_STATE_DRIFT')
      for(const row of later){const receipt=join(ROOT,'receipts',String(row.sequence).padStart(9,'0')+'.json');check(existsSync(receipt)&&sha(readFileSync(receipt))===sha(JSON.stringify(row)+'\n'),'RECEIPT_DRIFT')}
    },
    ledger:{reserve:async args=>append(auth,{kind:'candidate16D14Reserve',batchId:auth.batchId,...args}),settle:async args=>append(auth,{kind:'candidate16D14Settle',batchId:auth.batchId,...args})},
    transport:{sendOnce},
  })
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv[2]==='--verify')console.log(JSON.stringify(verifyOffline()))
  else if(process.argv[2]==='--prepare-authorized')console.log(JSON.stringify(await prepareAuthorized()))
  else if(process.argv[2]==='--dispatch-next')console.log(JSON.stringify(await dispatchNext()))
  else throw Error('D14_LIVE_ARGUMENT')
}
