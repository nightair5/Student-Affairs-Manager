// One authorized recovery of the empty, pre-reserve C19 lock. No new grant.
import {createHash} from 'node:crypto'
import {existsSync,readFileSync,writeFileSync,openSync,closeSync,fsyncSync,mkdirSync,readdirSync,statSync,renameSync,rmdirSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {isDeepStrictEqual} from 'node:util'
import {readCandidate19Package,createCandidate19Host} from './candidate19-execution-host.mjs'
import {createRecoveryScopedHost} from './scoped-execution-recovery-host.mjs'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {AUTHORITATIVE_LEDGER,inspectTransportResponse,safeCode} from './d26-execution-host.mjs'
import {BATCH} from './prepare-candidate19.mjs'
const sha=v=>createHash('sha256').update(v).digest('hex')
const check=(v,c)=>{if(!v)throw Error('D26_HOST_RECOVERY_'+c)}
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const root=resolve('.data/candidate19/execution'),folder=join(root,'recovery-1')
const git=args=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
export const lockIdentity=p=>{const s=statSync(p,{bigint:true});check(s.isDirectory()&&readdirSync(p).length===0,'LOCK_NOT_EMPTY_DIRECTORY');return {dev:String(s.dev),ino:String(s.ino),birthtimeNs:String(s.birthtimeNs),mtimeNs:String(s.mtimeNs)}}
export function quarantineLock({lockPath,archivedPath,expected,assertQuiescent}){
 check(!existsSync(archivedPath),'QUARANTINE_ALREADY_EXISTS')
 assertQuiescent();check(isDeepStrictEqual(lockIdentity(lockPath),expected),'LOCK_REPLACED')
 renameSync(lockPath,archivedPath)
 check(isDeepStrictEqual(lockIdentity(archivedPath),expected),'QUARANTINE_IDENTITY_CHANGED')
}
export function assertRecoverable(scene){
 check(scene.audit==='CONSISTENT'&&scene.uncertainty===null&&scene.lockExists&&scene.halt===null&&scene.nextOrdinal===3,'SCENE_NOT_PRE_RESERVE_3')
 check(scene.batchEvidence.grantCount===1&&scene.batchEvidence.reserveCount===2&&scene.batchEvidence.settleCount===2&&scene.batchEvidence.rows===5,'LEDGER_NOT_1_2_2')
 check(scene.localEvidence.rawFiles===2&&scene.localEvidence.receiptFiles===5&&!scene.localEvidence.incompleteStateWrite,'LOCAL_ORPHAN_OR_EXTRA')
 check(scene.state.units.length===12&&scene.state.units.slice(0,2).every(u=>u.status==='SETTLED'&&u.usage!=='NOT_OBSERVABLE')&&scene.state.units.slice(2).every(u=>u.status==='NOT_SENT'&&Object.keys(u).sort().join(',')==='ordinal,requestSha256,status,unitIdentitySha256'),'NOT_SENT_NOT_PRISTINE')
}
export function assertSupplement(s,auth,authBytes,userBytes,priceBytes){
 check(s.version==='c19-pre-reserve-lock-recovery-1'&&s.batch===BATCH&&s.startOrdinal===3&&s.endOrdinal===12&&s.originalAuthorizationSha256===sha(authBytes)&&s.grantId===auth.grantId&&s.originalHead===auth.committedHead&&s.hardLimitMicroUsd===3900000&&s.hardLimitMicroUsd===auth.hardLimitMicroUsd,'SUPPLEMENT_BINDING')
 check(s.manifestSha256===auth.manifestSha256&&s.identitiesSha256===auth.identitiesSha256&&/^[a-f0-9]{40}$/.test(s.recoveryHead)&&s.userMessageSha256===sha(userBytes)&&s.priceEvidenceSha256===sha(priceBytes),'SUPPLEMENT_IDENTITY_OR_EVIDENCE')
 const evidence=JSON.parse(priceBytes),old={...auth.pricing},fresh={...evidence.pricing};delete old.verifiedAt;delete old.validUntil;delete fresh.verifiedAt;delete fresh.validUntil
 check(evidence.role==='OFFICIAL_PRICE_VERIFIED'&&isDeepStrictEqual(old,fresh),'TARIFF_CHANGED_STOP_RECONCILE_OLD_SETTLES')
 return {...auth,pricing:evidence.pricing}
}
function supplement(){const bytes=readFileSync(join(root,'AUTHORIZATION.json')),auth=JSON.parse(bytes),s=read(join(folder,'SUPPLEMENT.json'));const effective=assertSupplement(s,auth,bytes,readFileSync(join(folder,'USER_RECOVERY_AUTHORIZATION.txt')),readFileSync(join(folder,'PRICE_EVIDENCE.json')));return {s,effective}}
function syncHead(head){check(git(['branch','--show-current'])==='codex/e2-candidate11-blind-eval'&&git(['rev-parse','HEAD'])===head&&git(['rev-parse','@{u}'])===head&&git(['ls-remote','origin','refs/heads/codex/e2-candidate11-blind-eval']).split(/\s+/)[0]===head&&!git(['status','--porcelain']),'GIT_NOT_SYNCHRONIZED')}
export function assertNoOwner(processes){check(!processes.some(p=>p.pid!==process.pid&&/node(?:\.exe)?$/i.test(p.name)&&(/candidate19-execution-host|candidate19-recovery|scoped-execution|dispatch-next/i.test(p.command)||!p.command)),'LIVE_OR_UNKNOWN_EXECUTOR_PROCESS')}
function noOwner(){const rows=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ForEach-Object { @{pid=$_.ProcessId;name=$_.Name;command=$_.CommandLine;created=$_.CreationDate.ToString('o')} })"],{encoding:'utf8'}));assertNoOwner(rows);return rows.map(p=>({pid:p.pid,name:p.name,created:p.created,commandSha256:sha(p.command)}))}
const writeOnce=(p,v)=>{const fd=openSync(p,'wx',0o600);try{writeFileSync(fd,JSON.stringify(v,null,2)+'\n');fsyncSync(fd)}finally{closeSync(fd)}}
export function assertRecoveryJournal(dir,s){
 const r=read(join(dir,'RECOVERED.json'));check(r.supplementSha256===sha(readFileSync(join(dir,'SUPPLEMENT.json')))&&r.originalAuthorizationSha256===s.originalAuthorizationSha256&&r.grantId===s.grantId&&!existsSync(join(dir,'recovery-guard')),'RECOVERY_JOURNAL_DRIFT')
}
export async function recoverOnce(){
 check(!existsSync(join(folder,'RECOVERED.json'))&&!existsSync(join(folder,'lock-original')),'ALREADY_RECOVERED_NO_SECOND_RELEASE')
 const guard=join(folder,'recovery-guard');mkdirSync(guard)
 let done=false
 try{
  const {s,effective}=supplement(),pack=readCandidate19Package(),engine=createScopedEngine({batch:BATCH,count:12})
  engine.assertAuthorization(engine.newState(pack.units,pack.binding),effective,pack.units,pack.binding);syncHead(s.recoveryHead)
  const owners=noOwner(),scene=await createCandidate19Host().resumeReadOnly();assertRecoverable(scene)
  check(scene.ledger.sha256===s.ledgerSha256&&sha(readFileSync(join(root,'STATE.json')))===s.stateSha256&&isDeepStrictEqual(lockIdentity(join(root,'lock')),s.lockIdentity),'SCENE_CHANGED')
  writeOnce(join(folder,'BEFORE.json'),{scene,owners,lock:s.lockIdentity,observedAt:new Date().toISOString()})
  // Old mkdir lock excludes all standard dispatchers while we compare. Quarantine
  // by atomic rename, retain its filesystem identity; never delete the original.
  quarantineLock({lockPath:join(root,'lock'),archivedPath:join(folder,'lock-original'),expected:s.lockIdentity,assertQuiescent:noOwner})
  const after=await createCandidate19Host().resumeReadOnly();check(after.audit==='CONSISTENT'&&!after.lockExists&&!after.halt&&after.ledger.sha256===s.ledgerSha256,'AFTER_NOT_CONSISTENT')
  writeOnce(join(folder,'RECOVERED.json'),{version:s.version,supplementSha256:sha(readFileSync(join(folder,'SUPPLEMENT.json'))),originalLock:s.lockIdentity,originalAuthorizationSha256:s.originalAuthorizationSha256,startOrdinal:3,endOrdinal:12,grantId:s.grantId,recoveryHead:s.recoveryHead,recoveredAt:new Date().toISOString(),ledgerWrites:0,modelRequests:0})
  done=true;return {status:'RECOVERED_PRE_RESERVE_ONLY',nextOrdinal:3,grantId:s.grantId,ledgerWrites:0,modelRequests:0}
 }finally{if(done)rmdirSync(guard)}
}
export function createRecoveredHost(){
 const pack=readCandidate19Package(),scope={batch:BATCH,count:12,snapshot:pack.snapshot},engine=createScopedEngine(scope)
 const gate=()=>{const {s,effective}=supplement();assertRecoveryJournal(folder,s);return effective}
 const host=createRecoveryScopedHost(scope,{root,ledgerPath:AUTHORITATIVE_LEDGER,engine,packageRead:readCandidate19Package,role:'SCOPED_DEVELOPMENT_HOST_NOT_AUTHORIZATION',renewal:()=>gate(),gitCheck:()=>syncHead(supplement().s.recoveryHead),
 append:async({ledgerPath,receipt,before,after})=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',resolve('scripts/d25-ledger-append.ps1'),'-Ledger',ledgerPath,'-ExpectedSha',sha(before),'-RowPath',receipt,'-ExpectedAfterSha',sha(after)],{stdio:'pipe'}),
 transport:{sendOnce:async(body,unit,auth)=>{check(unit.ordinal>=3&&unit.ordinal<=12,'OUTSIDE_REMAINING_IDENTITIES');const {createPinnedProxyFetch,assertModelGatewayConfigured}=await import('./real-input-model-gateway.mjs');const env=resolve('C:/Users/Winner/student-affairs-multimodal-exp/.env');if(existsSync(env))process.loadEnvFile(env);assertModelGatewayConfigured();const secret=process.env.DEEPSEEK_API_KEY,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000)
 try{const response=await createPinnedProxyFetch()(auth.endpoint,{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body,redirect:'manual',signal:controller.signal});const chunks=[];let length=0;for await(const chunk of response.body){length+=chunk.length;check(length<=524288,'RESPONSE_TOO_LARGE');chunks.push(chunk)}return {status:response.status,...inspectTransportResponse({bytes:Buffer.concat(chunks),contentType:response.headers.get('content-type'),requestId:response.headers.get('x-request-id')},secret)}}finally{clearTimeout(timer)}}}})
 return {dispatchNext:()=>host.dispatchNext(),resumeReadOnly:()=>host.resumeReadOnly()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const [mode,...extra]=process.argv.slice(2);check(!extra.length,'EXTRA_ARGUMENTS');if(mode==='--recover-once')console.log(JSON.stringify(await recoverOnce()));else if(mode==='--dispatch-next')console.log(JSON.stringify(await createRecoveredHost().dispatchNext()));else if(mode==='--inspect')console.log(JSON.stringify(await createCandidate19Host().resumeReadOnly(),null,2));else throw Error('D26_HOST_RECOVERY_MODE')}catch(e){console.error(JSON.stringify({status:'STOPPED',code:safeCode(e),retry:false}));process.exitCode=2}}
