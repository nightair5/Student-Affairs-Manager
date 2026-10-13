// All grants/ledger rows/transport responses in this file are anonymous fake
// records in OS temp directories. It never opens a model route or old package.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdtempSync,writeFileSync,readFileSync,existsSync,mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {createScopedHost} from './scoped-execution-host.mjs'
import {assertPackageBudget} from './autonomous-package-budget.mjs'
import {BATCH,COUNT} from './task-time-development.mjs'
import {assertTaskTimeGit,assertTaskTimePackage} from './task-time-development-host.mjs'
const sha=v=>createHash('sha256').update(v).digest('hex'),json=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n')

function offline(options={}){
 const scope={batch:BATCH,count:COUNT,snapshot:'b'.repeat(40)},engine=createScopedEngine(scope)
 const root=mkdtempSync(join(tmpdir(),'task-time-zero-model-')),ledgerPath=join(root,'FAKE-ledger.jsonl')
 const seed={sequence:0,previous:'0'.repeat(64),event:{kind:'OFFLINE_TEST_ONLY_NOT_REAL_GRANT'}};seed.hash=sha(JSON.stringify(seed));writeFileSync(ledgerPath,JSON.stringify(seed)+'\n')
 const baseline=readFileSync(ledgerPath),binding={manifestSha256:'d'.repeat(64),identitiesSha256:'e'.repeat(64)}
 const units=Array.from({length:COUNT},(_,i)=>{const body={model:'deepseek-flash',temperature:0,reasoning:{effort:'none'},stream:false,max_output_tokens:8192,input:[{role:'user',content:'匿名离线安全夹具 '+i}]};return {ordinal:i+1,unitIdentitySha256:sha('fake-task-time-unit-'+i),requestSha256:sha(JSON.stringify(body)),body}})
 const pricing={sourceUrl:'https://api-docs.deepseek.com/quick_start/pricing/',verifiedAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),peakInputUsdPerMillion:.3,peakOutputUsdPerMillion:1.2,maxInputTokens:1048576,model:'deepseek-flash',endpoint:'https://api.deepseek.com/responses',maxOutputTokens:8192,tokenBoundMethod:'FULL_OFFICIAL_CONTEXT_UPPER_BOUND',reasoningMetering:'INCLUDED_IN_OUTPUT_TOKENS',additionalChargeUpperMicroUsd:0}
 writeFileSync(join(root,'USER_AUTHORIZATION.txt'),'SYNTHETIC OFFLINE CONSENT; NOT USER AUTHORIZATION')
 json(join(root,'PRICE_EVIDENCE.json'),{role:'SYNTHETIC_OFFLINE_PRICE_NOT_OBSERVED',pricing})
 const auth={authorized:true,authorizationSource:'CURRENT_USER_MESSAGE',userMessageSha256:sha(readFileSync(join(root,'USER_AUTHORIZATION.txt'))),batch:BATCH,count:COUNT,model:'deepseek-flash',...binding,hardLimitMicroUsd:2000000,grantId:'OFFLINE_TASK_TIME_FAKE_GRANT',committedHead:'a'.repeat(40),endpoint:pricing.endpoint,retry:0,repair:0,verifier:0,pricing,hostVersion:'scoped-execution-host-2',snapshotCommit:scope.snapshot,ledgerBaselineRows:1,ledgerBaselineBytes:baseline.length,ledgerBaselineSha256:sha(baseline),priceEvidenceSha256:sha(readFileSync(join(root,'PRICE_EVIDENCE.json'))),units:units.map(u=>u.unitIdentitySha256),requestSha256s:units.map(u=>u.requestSha256)}
 if(!options.noAuth)json(join(root,'AUTHORIZATION.json'),auth)
 let sends=0,appends=0
 const host=createScopedHost(scope,{root,ledgerPath,engine,role:'OFFLINE_ANONYMOUS_FAKE_TRANSPORT',packageRead:()=>({units,binding}),gitCheck:()=>{},
  append:async({after})=>{appends++;writeFileSync(ledgerPath,after)},fault:async stage=>{if(stage===options.fault)throw Error('OFFLINE_FAULT')},
  transport:{sendOnce:async()=>{sends++;if(options.sendThrow)throw Error('OFFLINE_UNCERTAIN');if(options.onSend)await options.onSend();return {status:200,text:JSON.stringify(options.noUsage?{id:'synthetic'}:{id:'synthetic',usage:{input_tokens:10,output_tokens:5}})}}}})
 return {host,root,ledgerPath,baseline,units,auth,save:()=>json(join(root,'AUTHORIZATION.json'),auth),counts:()=>({sends,appends})}
}

test('new six-unit scope rejects no consent, old batch/grant identity, extra calls and insufficient hard cap before any append',async()=>{
 assert.equal(COUNT,6)
 for(const mode of ['missing','old-batch','old-identities','retry','low-cap']){
  const x=offline({noAuth:mode==='missing'})
  if(mode==='old-batch')x.auth.batch='V5-OBLIGATION-AUTHORITY-DEVELOPMENT-R1'
  if(mode==='old-identities')x.auth.units[0]='f'.repeat(64)
  if(mode==='retry')x.auth.retry=1
  if(mode==='low-cap')x.auth.hardLimitMicroUsd=1000000
  if(mode!=='missing')x.save()
  await assert.rejects(x.host.prepareAuthorized())
  assert.deepEqual(x.counts(),{sends:0,appends:0});assert.deepEqual(readFileSync(x.ledgerPath),x.baseline)
  assert.equal(existsSync(join(x.root,'STATE.json')),false)
 }
})
test('six fixed ordinals settle once; complete dispatch and repeated prepare cannot create a second send or grant',async()=>{
 const x=offline();await x.host.prepareAuthorized()
 for(let ordinal=1;ordinal<=COUNT;ordinal++)assert.equal((await x.host.dispatchNext()).ordinal,ordinal)
 assert.equal((await x.host.dispatchNext()).status,'COMPLETE');await assert.rejects(x.host.prepareAuthorized())
 assert.deepEqual(x.counts(),{sends:COUNT,appends:1+2*COUNT})
 assert.equal((await x.host.resumeReadOnly()).audit,'CONSISTENT')
})
test('transport uncertainty and missing usage block every following send and keep lock/HALT',async()=>{
 for(const options of [{sendThrow:true},{noUsage:true},{fault:'after_send'},{fault:'after_scopedSettle'}]){
  const x=offline(options);await x.host.prepareAuthorized();await assert.rejects(x.host.dispatchNext())
  const sends=x.counts().sends;await assert.rejects(x.host.dispatchNext());assert.equal(x.counts().sends,sends)
  assert.equal(existsSync(join(x.root,'lock')),true);assert.equal(existsSync(join(x.root,'HALT.json')),true)
  assert.equal((await x.host.resumeReadOnly()).status,'HALTED_READ_ONLY')
 }
})
test('simultaneous dispatch is serialized by the existing process-visible lock, never a double send',async()=>{
 let release,entered;const arrived=new Promise(resolve=>{entered=resolve}),blocked=new Promise(resolve=>{release=resolve})
 const x=offline({onSend:async()=>{entered();await blocked}});await x.host.prepareAuthorized()
 const first=x.host.dispatchNext();await arrived;await assert.rejects(x.host.dispatchNext());release();await first
 assert.equal(x.counts().sends,1)
})
test('aggregate count/amount preserve a single sixteen/$6 limit and expiry is not reset by another batch',()=>{
 const root=mkdtempSync(join(tmpdir(),'task-time-package-zero-model-')),now=Date.now(),message='SYNTHETIC PACKAGE; NOT REAL AUTHORIZATION'
 writeFileSync(join(root,'USER_AUTHORIZATION.txt'),message)
 const p={version:'autonomous-work-package-1',startedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+3600000).toISOString(),maxRequests:16,hardLimitMicroUsd:6000000,maxIterations:3,authorizationSha256:sha(message),batches:[{batch:'PRIOR-PACKAGE-BATCH',count:10,hardLimitMicroUsd:3300000,executionRoot:'prior'},{batch:BATCH,count:COUNT,hardLimitMicroUsd:2000000,executionRoot:'current'}]}
 assert.equal(assertPackageBudget(p,root,now).unusedRequestLimit,0)
 assert.throws(()=>assertPackageBudget({...p,batches:[...p.batches,{batch:'EXTRA',count:1,hardLimitMicroUsd:100000,executionRoot:'extra'}]},root,now),/AGGREGATE_CAP/u)
 assert.throws(()=>assertPackageBudget({...p,batches:p.batches.map(b=>({...b,hardLimitMicroUsd:3100000}))},root,now),/AGGREGATE_CAP/u)
 assert.throws(()=>assertPackageBudget(p,root,now+3*3600000),/TIME_LIMIT/u)
})
test('untracked user assets require the exact two paths and exact byte hashes; broad ignore lists are rejected',()=>{
 assert.throws(()=>assertTaskTimeGit('a'.repeat(40),[]),/ASSET_DRIFT/u)
 assert.throws(()=>assertTaskTimeGit('a'.repeat(40),[{path:'CODEX_DESKTOP_HANDOVER.md',sha256:'0'.repeat(64)},{path:'CODEX_NEXT_PHASE_PLAN.md',sha256:'0'.repeat(64)}]),/ASSET_DRIFT/u)
 assert.throws(()=>assertTaskTimeGit('a'.repeat(40),[{path:'CODEX_DESKTOP_HANDOVER.md',sha256:'0'.repeat(64)},{path:'CODEX_NEXT_PHASE_PLAN.md',sha256:'0'.repeat(64)},{path:'anything',sha256:'0'.repeat(64)}]),/ASSET_DRIFT/u)
})
test('this three-hour package cannot inherit the old four-hour allowance and another batch in flight blocks fresh spending',()=>{
 const root=mkdtempSync(join(tmpdir(),'task-time-package-boundary-')),now=Date.now(),message='SYNTHETIC PACKAGE; NOT REAL AUTHORIZATION'
 writeFileSync(join(root,'USER_AUTHORIZATION.txt'),message)
 const p={version:'autonomous-work-package-1',startedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+3600000).toISOString(),maxRequests:16,hardLimitMicroUsd:6000000,maxIterations:3,authorizationSha256:sha(message),batches:[{batch:'PRIOR-PACKAGE-BATCH',count:1,hardLimitMicroUsd:100000,executionRoot:'prior'},{batch:BATCH,count:COUNT,hardLimitMicroUsd:2000000,executionRoot:'current'}]}
 assertTaskTimePackage(p,root,now)
 assert.throws(()=>assertTaskTimePackage({...p,expiresAt:new Date(now+3.5*3600000).toISOString()},root,now),/THREE_HOUR_LIMIT/u)
 mkdirSync(join(root,'prior'))
 for(const status of ['RESERVED','SENDING','RAW_SAVED','UNCERTAIN','UNKNOWN']){
  json(join(root,'prior','STATE.json'),{batch:'PRIOR-PACKAGE-BATCH',units:[{status}]})
  assert.throws(()=>assertTaskTimePackage(p,root,now),/OTHER_BATCH_NOT_DETERMINATE|STATE_OR_BILLING_UNKNOWN/u)
 }
 json(join(root,'prior','STATE.json'),{batch:'PRIOR-PACKAGE-BATCH',units:[{status:'SETTLED'}]})
 mkdirSync(join(root,'current'))
 json(join(root,'current','STATE.json'),{batch:BATCH,units:Array.from({length:COUNT},(_,i)=>({status:i===0?'SENDING':'NOT_SENT'}))})
 // The current batch's durable pre-send marker is checked by scopedHost;
 // the aggregate guard must not deadlock that single authorized send.
 assertTaskTimePackage(p,root,now)
})
