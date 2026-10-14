import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,writeFileSync,existsSync,mkdirSync,renameSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createScopedHost} from './scoped-execution-host.mjs'
import {createRecoveryScopedHost} from './scoped-execution-recovery-host.mjs'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {BATCH,COUNT,sha} from './current-role-diagnostic.mjs'
import {assertPreflightRecoverable,assertRenewal,assertNoCurrentRoleOwner,readRemoteWithTlsRetry,assertRunnerBytes,PACKAGE_ROOT,EXECUTION_ROOT} from './current-role-preflight-recovery.mjs'
const json=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n')
async function fixture(){
 const root=mkdtempSync(join(tmpdir(),'role-preflight-')),ledgerPath=join(root,'ledger.jsonl'),scope={batch:BATCH,count:COUNT,snapshot:'b'.repeat(40)}
 const seed={sequence:0,previous:'0'.repeat(64),event:{kind:'OFFLINE_ONLY'}};seed.hash=sha(JSON.stringify(seed));writeFileSync(ledgerPath,JSON.stringify(seed)+'\n');const baseline=readFileSync(ledgerPath)
 const binding={manifestSha256:'d'.repeat(64),identitiesSha256:'e'.repeat(64)}
 const units=Array.from({length:COUNT},(_,i)=>{const body={model:'deepseek-flash',temperature:0,reasoning:{effort:'none'},stream:false,max_output_tokens:8192,input:'Anonymous '+i};return {ordinal:i+1,body,requestSha256:sha(JSON.stringify(body)),unitIdentitySha256:sha('unit'+i)}})
 const pricing={sourceUrl:'https://api-docs.deepseek.com/quick_start/pricing/',verifiedAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),peakInputUsdPerMillion:.3,peakOutputUsdPerMillion:1.2,maxInputTokens:1048576,model:'deepseek-flash',endpoint:'https://api.deepseek.com/responses',maxOutputTokens:8192,tokenBoundMethod:'FULL_OFFICIAL_CONTEXT_UPPER_BOUND',reasoningMetering:'INCLUDED_IN_OUTPUT_TOKENS',additionalChargeUpperMicroUsd:0}
 writeFileSync(join(root,'USER_AUTHORIZATION.txt'),'OFFLINE_ORIGINAL_AUTH');json(join(root,'PRICE_EVIDENCE.json'),{role:'SYNTHETIC_OFFLINE_PRICE_NOT_OBSERVED',pricing})
 const auth={authorized:true,authorizationSource:'CURRENT_USER_MESSAGE',userMessageSha256:sha(readFileSync(join(root,'USER_AUTHORIZATION.txt'))),batch:BATCH,count:COUNT,model:'deepseek-flash',...binding,hardLimitMicroUsd:1300000,grantId:'OFFLINE_PREFLIGHT_GRANT',committedHead:'a'.repeat(40),endpoint:pricing.endpoint,retry:0,repair:0,verifier:0,pricing,hostVersion:'scoped-execution-host-2',snapshotCommit:scope.snapshot,ledgerBaselineRows:1,ledgerBaselineBytes:baseline.length,ledgerBaselineSha256:sha(baseline),priceEvidenceSha256:sha(readFileSync(join(root,'PRICE_EVIDENCE.json'))),units:units.map(u=>u.unitIdentitySha256),requestSha256s:units.map(u=>u.requestSha256)}
 json(join(root,'AUTHORIZATION.json'),auth)
 let checks=0,failAt=Infinity,fault='';const sends=[]
 const options={root,ledgerPath,engine:createScopedEngine(scope),packageRead:()=>({units,binding}),role:'OFFLINE_ANONYMOUS_FAKE_TRANSPORT',gitCheck:()=>{if(++checks===failAt)throw Error('OFFLINE_GIT_TLS_PREFLIGHT')},append:async({after})=>writeFileSync(ledgerPath,after),transport:{sendOnce:async(_,unit)=>{sends.push(unit.ordinal);return {status:200,text:JSON.stringify({usage:{input_tokens:10,output_tokens:5}})}}},fault:async s=>{if(s===fault)throw Error('OFFLINE_INJECTION')}}
 const host=createScopedHost(scope,options);await host.prepareAuthorized()
 return {root,auth,scope,host,options,sends,preflightFail:()=>{failAt=checks+3},clear:()=>{failAt=Infinity;fault=''},fault:s=>{fault=s}}
}
test('real original host preflight fails with zero reserve/send; only that pristine halt qualifies',async()=>{
 const x=await fixture();x.preflightFail();await assert.rejects(x.host.dispatchNext());const scene=await x.host.resumeReadOnly()
 assertPreflightRecoverable(scene);assert.deepEqual(x.sends,[]);assert.equal(scene.batchEvidence.reserveCount,0)
 for(const mutate of [s=>s.audit='UNRESOLVED',s=>s.uncertainty='UNKNOWN',s=>s.nextOrdinal=2,s=>s.halt.batch='OTHER',s=>s.halt.units[0].status='UNCERTAIN',s=>s.batchEvidence.reserveCount=1,s=>s.batchEvidence.rows=2,s=>s.localEvidence.rawFiles=1,s=>s.localEvidence.receiptFiles=2,s=>s.localEvidence.incompleteStateWrite=true,s=>s.state.units[0].status='SENDING',s=>s.state.units[0].haltReason='SEND']){
  const bad=structuredClone(scene);mutate(bad);assert.throws(()=>assertPreflightRecoverable(bad))
 }
})
test('renewed existing host sends each original identity once with original grant/auth; uncertain send remains sealed',async()=>{
 const x=await fixture();x.preflightFail();await assert.rejects(x.host.dispatchNext());x.clear()
 const original=readFileSync(join(x.root,'AUTHORIZATION.json'));renameSync(join(x.root,'HALT.json'),join(x.root,'HALT-original.json'));renameSync(join(x.root,'lock'),join(x.root,'lock-original'))
 const recovered=createRecoveryScopedHost(x.scope,{...x.options,renewal:a=>({...a,pricing:{...a.pricing,verifiedAt:new Date().toISOString(),validUntil:new Date(Date.now()+3600000).toISOString()}})})
 await assert.rejects(recovered.prepareAuthorized());for(let i=1;i<=COUNT;i++)assert.equal((await recovered.dispatchNext()).ordinal,i)
 assert.deepEqual(x.sends,[1,2,3,4]);assert.deepEqual(readFileSync(join(x.root,'AUTHORIZATION.json')),original)
 const scene=await recovered.resumeReadOnly();assert.equal(scene.audit,'CONSISTENT');assert.equal(scene.batchEvidence.grantCount,1);assert.equal(scene.batchEvidence.reserveCount,4);assert.equal(scene.batchEvidence.settleCount,4)
 const y=await fixture();y.fault('before_send');await assert.rejects(y.host.dispatchNext());const uncertain=await y.host.resumeReadOnly()
 assert.throws(()=>assertPreflightRecoverable(uncertain));await assert.rejects(y.host.dispatchNext());assert.deepEqual(y.sends,[]);assert.equal(existsSync(join(y.root,'HALT.json')),true)
})
test('fresh explicit supplement cannot expand cap, replace requests, route or original authorization',async()=>{
 const x=await fixture(),bytes=readFileSync(join(x.root,'AUTHORIZATION.json')),user=Buffer.from('OFFLINE_NEW_USER_PREAUTH'),price=Buffer.from(JSON.stringify({role:'OFFICIAL_PRICE_VERIFIED',pricing:x.auth.pricing}))
 const pack={authorizationSha256:sha(user),startedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3*3600000).toISOString(),batches:[{batch:BATCH,count:COUNT,hardLimitMicroUsd:1300000,executionRoot:join('..','autonomous-three-hour-20261008','execution-v7')}]}
 assert.equal(join(PACKAGE_ROOT,pack.batches[0].executionRoot),EXECUTION_ROOT)
 const s={version:'current-role-pre-reserve-recovery-1',batch:BATCH,startOrdinal:1,endOrdinal:COUNT,originalAuthorizationSha256:sha(bytes),grantId:x.auth.grantId,originalHead:x.auth.committedHead,hardLimitMicroUsd:1300000,manifestSha256:x.auth.manifestSha256,identitiesSha256:x.auth.identitiesSha256,userMessageSha256:sha(user),priceEvidenceSha256:sha(price),recoveryHead:'f'.repeat(40)}
 assert.deepEqual(assertRenewal(s,x.auth,bytes,user,price,pack),x.auth)
 for(const field of ['grantId','originalHead','hardLimitMicroUsd','manifestSha256','identitiesSha256','originalAuthorizationSha256','startOrdinal','endOrdinal','recoveryHead','userMessageSha256','priceEvidenceSha256'])assert.throws(()=>assertRenewal({...s,[field]:'wrong'},x.auth,bytes,user,price,pack))
 const changed=Buffer.from(JSON.stringify({role:'OFFICIAL_PRICE_VERIFIED',pricing:{...x.auth.pricing,peakInputUsdPerMillion:.4}}))
 assert.throws(()=>assertRenewal({...s,priceEvidenceSha256:sha(changed)},x.auth,bytes,user,changed,pack))
 assert.throws(()=>assertRenewal(s,x.auth,bytes,user,price,{...pack,expiresAt:new Date(Date.now()+4*3600000).toISOString()}))
})
test('other active or uninspectable dispatchers block quarantine; ordinary preview process does not',()=>{
 assert.throws(()=>assertNoCurrentRoleOwner([{pid:process.pid+1,name:'node.exe',command:'node scripts/current-role-host.mjs --dispatch-next'}]))
 assert.throws(()=>assertNoCurrentRoleOwner([{pid:process.pid+1,name:'node.exe',command:null}]))
 assertNoCurrentRoleOwner([{pid:process.pid+1,name:'node.exe',command:'node scripts/serve-candidate19-recorded.mjs 6913'}])
})
test('only non-billable remote TLS reads retry at most three; configuration errors and wrong SHA do not retry',()=>{
 let calls=0
 assert.equal(readRemoteWithTlsRetry(()=>{if(++calls<3)throw Object.assign(new Error('read'),{stderr:Buffer.from('schannel TLS handshake failed')});return 'sha'}),'sha')
 assert.equal(calls,3);calls=0
 assert.throws(()=>readRemoteWithTlsRetry(()=>{calls++;throw Object.assign(new Error('config'),{stderr:Buffer.from('access denied')})}));assert.equal(calls,1)
 calls=0;assert.throws(()=>readRemoteWithTlsRetry(()=>{calls++;throw Object.assign(new Error('read'),{stderr:Buffer.from('TLS failed')})}));assert.equal(calls,3)
 calls=0;assert.equal(readRemoteWithTlsRetry(()=>{calls++;return 'WRONG_SHA'}),'WRONG_SHA');assert.equal(calls,1)
})
test('exact checkout and Git bytes are independently frozen; only CRLF normalization is allowed',()=>{
 const blob=Buffer.from('const x=1\n'),runtime=Buffer.from('const x=1\r\n')
 const f={path:'anonymous.mjs',sha256:sha(runtime),gitSha256:sha(blob)}
 assertRunnerBytes(f,runtime,blob)
 assert.throws(()=>assertRunnerBytes(f,Buffer.from('const x=2\r\n'),blob))
 assert.throws(()=>assertRunnerBytes({...f,gitSha256:sha('const x=2\n')},runtime,Buffer.from('const x=2\n')))
 assert.throws(()=>assertRunnerBytes(f,blob,blob))
})
