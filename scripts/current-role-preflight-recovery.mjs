// Explicitly authorized recovery of this batch's proven pre-reserve halt only.
// Reuses the existing recovery host, once-send core, ledger and pinned transport.
import {existsSync,readFileSync,openSync,closeSync,writeFileSync,fsyncSync,mkdirSync,readdirSync,renameSync,rmdirSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {isDeepStrictEqual} from 'node:util'
import {createRecoveryScopedHost} from './scoped-execution-recovery-host.mjs'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {createSafePhaseJournal} from './scoped-execution-diagnostics.mjs'
import {lockIdentity,quarantineLock} from './candidate19-recovery.mjs'
import {verifyCurrentRole,BATCH,COUNT,sha} from './current-role-diagnostic.mjs'
import {AUTHORITATIVE_LEDGER,inspectTransportResponse,safeCode} from './d26-execution-host.mjs'
import {assertPackageBudget} from './autonomous-package-budget.mjs'
import {createBoundaryJournal,withTransportBoundaryDiagnostics,createBoundaryPinnedProxyFetch} from './scoped-transport-boundary-diagnostics.mjs'

export const EXECUTION_ROOT=resolve('.data/autonomous-three-hour-20261008/execution-v7')
export const RECOVERY_ROOT=resolve(EXECUTION_ROOT,'recovery-preflight-20261009')
export const PACKAGE_ROOT=resolve('.data/autonomous-three-hour-20261009')
const check=(v,c)=>{if(!v)throw Error('CURRENT_ROLE_RECOVERY_'+c)}
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const git=args=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
const packet=()=>verifyCurrentRole({observedReadOnly:true})
const writeOnce=(p,v)=>{const fd=openSync(p,'wx',0o600);try{writeFileSync(fd,JSON.stringify(v,null,2)+'\n');fsyncSync(fd)}finally{closeSync(fd)}}

export function assertPreflightRecoverable(scene){
 check(scene.audit==='CONSISTENT'&&scene.uncertainty===null&&scene.nextOrdinal===1&&scene.lockExists,'SCENE')
 check(scene.halt?.batch===BATCH&&scene.halt.code==='UNIT_SEND_RAW_OR_SETTLEMENT_UNCERTAIN'
  &&scene.halt.units?.length===COUNT&&scene.halt.units.every((u,i)=>u.ordinal===i+1&&u.status==='NOT_SENT'),'HALT_SCOPE')
 check(scene.batchEvidence.rows===1&&scene.batchEvidence.grantCount===1&&scene.batchEvidence.reserveCount===0&&scene.batchEvidence.settleCount===0,'PRE_RESERVE_LEDGER')
 check(scene.localEvidence.rawFiles===0&&scene.localEvidence.receiptFiles===1&&!scene.localEvidence.incompleteStateWrite,'ORPHAN_OR_RAW')
 check(scene.state.units.length===COUNT&&scene.state.units.every((u,i)=>u.ordinal===i+1&&u.status==='NOT_SENT'
  &&Object.keys(u).sort().join(',')==='ordinal,requestSha256,status,unitIdentitySha256'),'PRISTINE_UNITS')
}

export function assertRenewal(s,auth,authBytes,userBytes,priceBytes,pack){
 check(s.version==='current-role-pre-reserve-recovery-1'&&s.batch===BATCH&&s.startOrdinal===1&&s.endOrdinal===COUNT
  &&s.originalAuthorizationSha256===sha(authBytes)&&s.grantId===auth.grantId&&s.originalHead===auth.committedHead
  &&s.hardLimitMicroUsd===1300000&&s.hardLimitMicroUsd===auth.hardLimitMicroUsd,'ORIGINAL_BINDING')
 check(s.manifestSha256===auth.manifestSha256&&s.identitiesSha256===auth.identitiesSha256
  &&s.userMessageSha256===sha(userBytes)&&s.priceEvidenceSha256===sha(priceBytes)&&/^[a-f0-9]{40}$/u.test(s.recoveryHead),'EVIDENCE_BINDING')
 check(pack.authorizationSha256===s.userMessageSha256&&pack.batches.some(b=>b.batch===BATCH&&b.count===COUNT
  &&b.hardLimitMicroUsd===auth.hardLimitMicroUsd&&resolve(PACKAGE_ROOT,b.executionRoot)===EXECUTION_ROOT)
  &&Date.parse(pack.expiresAt)-Date.parse(pack.startedAt)<=3*3600000,'PACKAGE_BINDING')
 const evidence=JSON.parse(priceBytes),old={...auth.pricing},fresh={...evidence.pricing}
 delete old.verifiedAt;delete old.validUntil;delete fresh.verifiedAt;delete fresh.validUntil
 check(evidence.role==='OFFICIAL_PRICE_VERIFIED'&&isDeepStrictEqual(old,fresh),'TARIFF_OR_ROUTE_CHANGED')
 return {...auth,pricing:evidence.pricing}
}

export function assertNoCurrentRoleOwner(rows){
 check(!rows.some(p=>p.pid!==process.pid&&/node(?:\.exe)?$/iu.test(p.name)
  &&(!p.command||/current-role-(?:host|preflight-recovery)|scoped-execution|--dispatch-next/iu.test(p.command))),'LIVE_OR_UNKNOWN_EXECUTOR')
}
function noOwner(){
 const rows=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
  'ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process -Filter "Name=\'node.exe\'" | ForEach-Object { @{pid=$_.ProcessId;name=$_.Name;command=$_.CommandLine} })'],{encoding:'utf8'}))
 assertNoCurrentRoleOwner(rows)
 return rows.map(p=>({pid:p.pid,name:p.name,commandSha256:sha(p.command??'UNKNOWN')}))
}
export function readRemoteWithTlsRetry(readRemote){
 for(let attempt=0;attempt<3;attempt++){
  try{return readRemote()}catch(error){
   const stderr=error?.stderr?.toString()??''
   if(attempt===2||!/schannel|TLS|handshake|connection.*reset/iu.test(stderr))throw error
  }
 }
 throw Error('CURRENT_ROLE_RECOVERY_REMOTE_READ_FAILED')
}
function syncHead(head){
 const status=git(['status','--porcelain','--untracked-files=all']).split(/\r?\n/u).filter(Boolean)
 check(git(['branch','--show-current'])==='codex/e2-candidate11-blind-eval'&&git(['rev-parse','HEAD'])===head
  &&git(['rev-parse','@{u}'])===head&&readRemoteWithTlsRetry(()=>git(['ls-remote','origin','refs/heads/codex/e2-candidate11-blind-eval'])).split(/\s+/u)[0]===head
  &&status.every(l=>l==='?? CODEX_DESKTOP_HANDOVER.md'),'GIT_NOT_SYNCHRONIZED')
}
function supplement(){
 const authBytes=readFileSync(join(EXECUTION_ROOT,'AUTHORIZATION.json')),auth=JSON.parse(authBytes)
 const s=read(join(RECOVERY_ROOT,'SUPPLEMENT.json')),pack=read(join(PACKAGE_ROOT,'PACKAGE.json'))
 const effective=assertRenewal(s,auth,authBytes,readFileSync(join(PACKAGE_ROOT,'USER_AUTHORIZATION.txt')),
  readFileSync(join(RECOVERY_ROOT,'PRICE_EVIDENCE.json')),pack)
 check(Array.isArray(s.runnerComponents)&&s.runnerComponents.length>=6,'RUNNER_FREEZE')
 for(const f of s.runnerComponents)assertRunnerBytes(f,readFileSync(f.path),execFileSync('git',['show',s.recoveryHead+':'+f.path],{maxBuffer:32*1024*1024}))
 return {s,effective,pack}
}
export function assertRunnerBytes(f,runtime,blob){
 // Preserve both exact byte identities; Git's configured CRLF checkout is not code drift.
 const canonical=b=>Buffer.from(b.toString('utf8').replace(/\r\n/gu,'\n'))
 check(sha(runtime)===f.sha256&&sha(blob)===f.gitSha256
  &&canonical(runtime).equals(canonical(blob)),'RUNNER_DRIFT_'+f.path)
}
export async function archiveFailedPreparation(){
 check(!existsSync(join(RECOVERY_ROOT,'RECOVERED.json'))&&!existsSync(join(RECOVERY_ROOT,'BEFORE.json'))
  &&!existsSync(join(RECOVERY_ROOT,'lock-original'))&&!existsSync(join(RECOVERY_ROOT,'HALT-original.json')),'PREPARATION_ALREADY_MUTATED')
 const s=read(join(RECOVERY_ROOT,'SUPPLEMENT.json')),scene=await createCurrentRoleRecoveryInspector().resumeReadOnly()
 assertPreflightRecoverable(scene);emptyPhaseEvidence();noOwner()
 check(scene.ledger.sha256===s.ledgerSha256&&sha(readFileSync(join(EXECUTION_ROOT,'STATE.json')))===s.stateSha256
  &&sha(readFileSync(join(EXECUTION_ROOT,'HALT.json')))===s.haltSha256
  &&isDeepStrictEqual(lockIdentity(join(EXECUTION_ROOT,'lock')),s.lockIdentity),'PREPARATION_SCENE_CHANGED')
 const attempt=join(RECOVERY_ROOT,'preparation-attempt-1');mkdirSync(attempt)
 writeOnce(join(attempt,'PROOF.json'),{reason:'Exact runtime/Git newline check failed before any original barrier mutation',scene,
  supplementSha256:sha(readFileSync(join(RECOVERY_ROOT,'SUPPLEMENT.json'))),observedAt:new Date().toISOString(),ledgerWrites:0,modelRequests:0})
 const guard=join(RECOVERY_ROOT,'recovery-guard'),identity=lockIdentity(guard)
 quarantineLock({lockPath:guard,archivedPath:join(attempt,'recovery-guard'),expected:identity,assertQuiescent:noOwner})
 renameSync(join(RECOVERY_ROOT,'SUPPLEMENT.json'),join(attempt,'SUPPLEMENT.json'))
 return {status:'UNEXECUTED_PREPARATION_ARCHIVED',ledgerWrites:0,modelRequests:0}
}
function emptyPhaseEvidence(){
 for(const name of ['phase-observation-v1','transport-boundary-v1']){
  const p=join(EXECUTION_ROOT,name);check(!existsSync(p)||readdirSync(p).length===0,'ORIGINAL_PHASE_EVIDENCE_PRESENT')
 }
}
export function createCurrentRoleRecoveryInspector(){
 const p=packet()
 return createRecoveryScopedHost({batch:BATCH,count:COUNT,snapshot:p.snapshot},{root:EXECUTION_ROOT,ledgerPath:AUTHORITATIVE_LEDGER,
  engine:createScopedEngine({batch:BATCH,count:COUNT}),packageRead:packet,role:'SCOPED_DEVELOPMENT_HOST_NOT_AUTHORIZATION',gitCheck:()=>{throw Error('INSPECTOR_NO_SEND')},
  append:async()=>{throw Error('INSPECTOR_NO_APPEND')},transport:{sendOnce:async()=>{throw Error('INSPECTOR_NO_TRANSPORT')}}})
}

export async function recoverCurrentRolePreflightOnce(){
 check(!existsSync(join(RECOVERY_ROOT,'RECOVERED.json'))&&!existsSync(join(RECOVERY_ROOT,'lock-original'))
  &&!existsSync(join(RECOVERY_ROOT,'HALT-original.json')),'ALREADY_RECOVERED')
 const guard=join(RECOVERY_ROOT,'recovery-guard');mkdirSync(guard);let complete=false
 try{
  const {s,effective,pack}=supplement(),p=packet(),engine=createScopedEngine({batch:BATCH,count:COUNT})
  engine.assertAuthorization(engine.newState(p.units,p.binding),effective,p.units,p.binding)
  // Check fresh aggregate limits while the original HALT is intentionally still present.
  check(sha(readFileSync(join(PACKAGE_ROOT,'USER_AUTHORIZATION.txt')))===pack.authorizationSha256
   &&Date.parse(pack.startedAt)<=Date.now()&&Date.now()<Date.parse(pack.expiresAt)
   &&pack.batches.reduce((v,b)=>v+b.count,0)<=16&&pack.batches.reduce((v,b)=>v+b.hardLimitMicroUsd,0)<=6000000,'PRE_RELEASE_PACKAGE')
  syncHead(s.recoveryHead);const owners=noOwner(),scene=await createCurrentRoleRecoveryInspector().resumeReadOnly()
  assertPreflightRecoverable(scene);emptyPhaseEvidence()
  check(scene.ledger.sha256===s.ledgerSha256&&sha(readFileSync(join(EXECUTION_ROOT,'STATE.json')))===s.stateSha256
   &&sha(readFileSync(join(EXECUTION_ROOT,'HALT.json')))===s.haltSha256
   &&isDeepStrictEqual(lockIdentity(join(EXECUTION_ROOT,'lock')),s.lockIdentity),'SCENE_CHANGED')
  writeOnce(join(RECOVERY_ROOT,'BEFORE.json'),{scene,owners,lock:s.lockIdentity,observedAt:new Date().toISOString()})
  // Retain both original barriers under an exclusive recovery guard. No deletion/reset.
  quarantineLock({lockPath:join(EXECUTION_ROOT,'lock'),archivedPath:join(RECOVERY_ROOT,'lock-original'),expected:s.lockIdentity,assertQuiescent:noOwner})
  check(sha(readFileSync(join(EXECUTION_ROOT,'HALT.json')))===s.haltSha256,'HALT_CHANGED_BEFORE_RENAME')
  renameSync(join(EXECUTION_ROOT,'HALT.json'),join(RECOVERY_ROOT,'HALT-original.json'))
  check(sha(readFileSync(join(RECOVERY_ROOT,'HALT-original.json')))===s.haltSha256,'HALT_ARCHIVE')
  assertPackageBudget(pack,PACKAGE_ROOT)
  const after=await createCurrentRoleRecoveryInspector().resumeReadOnly()
  check(after.audit==='CONSISTENT'&&!after.lockExists&&!after.halt&&after.ledger.sha256===s.ledgerSha256,'AFTER_NOT_CONSISTENT')
  writeOnce(join(RECOVERY_ROOT,'RECOVERED.json'),{version:s.version,supplementSha256:sha(readFileSync(join(RECOVERY_ROOT,'SUPPLEMENT.json'))),
   originalAuthorizationSha256:s.originalAuthorizationSha256,originalStateSha256:s.stateSha256,originalHaltSha256:s.haltSha256,
   originalLock:s.lockIdentity,grantId:s.grantId,recoveryHead:s.recoveryHead,recoveredAt:new Date().toISOString(),ledgerWrites:0,modelRequests:0})
  complete=true;return {status:'RECOVERED_PROVEN_PRE_RESERVE',nextOrdinal:1,grantId:s.grantId,ledgerWrites:0,modelRequests:0}
 }finally{if(complete)rmdirSync(guard)}
}

export function createCurrentRoleRecoveredHost(){
 const p=packet(),scope={batch:BATCH,count:COUNT,snapshot:p.snapshot}
 const gate=()=>{
  const {s,effective,pack}=supplement(),r=read(join(RECOVERY_ROOT,'RECOVERED.json'))
  check(r.supplementSha256===sha(readFileSync(join(RECOVERY_ROOT,'SUPPLEMENT.json')))
   &&r.originalAuthorizationSha256===s.originalAuthorizationSha256&&r.grantId===s.grantId
   &&!existsSync(join(RECOVERY_ROOT,'recovery-guard'))
   &&sha(readFileSync(join(RECOVERY_ROOT,'HALT-original.json')))===s.haltSha256,'RECOVERY_JOURNAL')
  assertPackageBudget(pack,PACKAGE_ROOT);return effective
 }
 const options={root:EXECUTION_ROOT,ledgerPath:AUTHORITATIVE_LEDGER,
  engine:createScopedEngine(scope,{diagnostics:createSafePhaseJournal(join(RECOVERY_ROOT,'phase-observation-v1'))}),
  packageRead:packet,role:'SCOPED_DEVELOPMENT_HOST_NOT_AUTHORIZATION',renewal:gate,gitCheck:()=>syncHead(supplement().s.recoveryHead),
  append:async({ledgerPath,receipt,before,after})=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',resolve('scripts/d25-ledger-append.ps1'),
   '-Ledger',ledgerPath,'-ExpectedSha',sha(before),'-RowPath',receipt,'-ExpectedAfterSha',sha(after)],{stdio:'pipe'}),
  transport:{sendOnce:async(body,unit,auth,observation)=>{
   check(unit.ordinal>=1&&unit.ordinal<=COUNT,'IDENTITY_SCOPE')
   const {assertModelGatewayConfigured}=await import('./real-input-model-gateway.mjs')
   const env=resolve('C:/Users/Winner/student-affairs-multimodal-exp/.env');if(existsSync(env))process.loadEnvFile(env)
   assertModelGatewayConfigured();const secret=process.env.DEEPSEEK_API_KEY,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000)
   try{
    const response=await createBoundaryPinnedProxyFetch(observation)(auth.endpoint,{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body,redirect:'manual',signal:controller.signal})
    const chunks=[];let size=0;await observation.mark('HTTP_HEADERS_RECEIVED')
    for await(const c of response.body){size+=c.length;check(size<=524288,'RESPONSE_TOO_LARGE');chunks.push(c)}
    await observation.mark('RESPONSE_BODY_RECEIVED')
    return {status:response.status,...inspectTransportResponse({bytes:Buffer.concat(chunks),contentType:response.headers.get('content-type'),requestId:response.headers.get('x-request-id')},secret)}
   }finally{clearTimeout(timer)}
  }}}
 return createRecoveryScopedHost(scope,withTransportBoundaryDiagnostics(options,createBoundaryJournal(join(RECOVERY_ROOT,'transport-boundary-v1'))))
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{
 const [mode,...extra]=process.argv.slice(2);check(!extra.length,'EXTRA_ARGUMENTS')
 const result=mode==='--inspect'?await createCurrentRoleRecoveryInspector().resumeReadOnly()
  :mode==='--recover-once'?await recoverCurrentRolePreflightOnce()
  :mode==='--dispatch-next'?await createCurrentRoleRecoveredHost().dispatchNext():null
 check(result,'MODE');console.log(JSON.stringify(result,null,2))
}catch(error){console.error(JSON.stringify({status:'STOPPED',code:/^CURRENT_ROLE_RECOVERY_/u.test(error?.message)?error.message:safeCode(error),retry:false}));process.exitCode=2}}
