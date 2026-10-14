import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {createScopedHost} from './scoped-execution-host.mjs'
const sha=v=>createHash('sha256').update(v).digest('hex'),json=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n')
function setup(options={}){
 const scope={batch:'C19-C17-C19-DEVELOPMENT-R1',count:12,snapshot:'b'.repeat(40)},engine=createScopedEngine(scope),root=mkdtempSync(join(tmpdir(),'c19-offline-')),ledgerPath=join(root,'ledger.jsonl')
 const seed={sequence:0,previous:'0'.repeat(64),event:{kind:'OFFLINE_TEST_ONLY'}};seed.hash=sha(JSON.stringify(seed));writeFileSync(ledgerPath,JSON.stringify(seed)+'\n')
 const before=readFileSync(ledgerPath),binding={manifestSha256:'d'.repeat(64),identitiesSha256:'e'.repeat(64)},units=Array.from({length:12},(_,i)=>{const body={model:'deepseek-flash',temperature:0,reasoning:{effort:'none'},stream:false,max_output_tokens:8192,input:[{role:'user',content:'匿名离线 '+i}]};return {ordinal:i+1,unitIdentitySha256:sha('unit'+i),requestSha256:sha(JSON.stringify(body)),body}})
 const pricing={sourceUrl:'https://api-docs.deepseek.com/quick_start/pricing/',verifiedAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),peakInputUsdPerMillion:.3,peakOutputUsdPerMillion:1.2,maxInputTokens:1048576,model:'deepseek-flash',endpoint:'https://api.deepseek.com/responses',maxOutputTokens:8192,tokenBoundMethod:'FULL_OFFICIAL_CONTEXT_UPPER_BOUND',reasoningMetering:'INCLUDED_IN_OUTPUT_TOKENS',additionalChargeUpperMicroUsd:0}
 writeFileSync(join(root,'USER_AUTHORIZATION.txt'),'FAKE OFFLINE AUTHORIZATION; NOT A REAL GRANT')
 json(join(root,'PRICE_EVIDENCE.json'),{role:'SYNTHETIC_OFFLINE_PRICE_NOT_OBSERVED',pricing})
 const auth={authorized:true,authorizationSource:'CURRENT_USER_MESSAGE',userMessageSha256:sha(readFileSync(join(root,'USER_AUTHORIZATION.txt'))),batch:scope.batch,count:12,model:'deepseek-flash',...binding,hardLimitMicroUsd:3900000,grantId:'OFFLINE_FAKE_C19_GRANT',committedHead:'a'.repeat(40),endpoint:pricing.endpoint,retry:0,repair:0,verifier:0,pricing,hostVersion:'scoped-execution-host-2',snapshotCommit:scope.snapshot,ledgerBaselineRows:1,ledgerBaselineBytes:before.length,ledgerBaselineSha256:sha(before),priceEvidenceSha256:sha(readFileSync(join(root,'PRICE_EVIDENCE.json'))),units:units.map(u=>u.unitIdentitySha256),requestSha256s:units.map(u=>u.requestSha256)}
 if(!options.noAuth)json(join(root,'AUTHORIZATION.json'),auth)
 let sends=0,appends=0
 const host=createScopedHost(scope,{root,ledgerPath,engine,role:'OFFLINE_ANONYMOUS_FAKE_TRANSPORT',packageRead:()=>({units,binding}),gitCheck:()=>{},append:async({after})=>{appends++;writeFileSync(ledgerPath,after)},fault:async stage=>{if(stage===options.fault)throw Error('OFFLINE_FAULT')},transport:{sendOnce:async()=>{sends++;if(options.sendThrow)throw Error('UNCERTAIN');return {status:200,text:JSON.stringify(options.noUsage?{id:'anonymous'}:{id:'anonymous',usage:{input_tokens:10,output_tokens:5}})}}}})
 return {host,auth,root,ledgerPath,before,save:()=>json(join(root,'AUTHORIZATION.json'),auth),counts:()=>({sends,appends})}
}
test('new 12-unit scope rejects no authorization and exhausted D26 identity before all mutation',async()=>{
 for(const mode of ['missing','old-batch','old-count','old-host','low-cap','extra','stale']){const x=setup({noAuth:mode==='missing'});if(mode==='old-batch')x.auth.batch='D26-C17-C18-DEVELOPMENT-R1';if(mode==='old-count')x.auth.count=16;if(mode==='old-host')x.auth.hostVersion='d26-execution-host-1';if(mode==='low-cap')x.auth.hardLimitMicroUsd=3892000;if(mode==='extra')x.auth.retry=1;if(mode==='stale')x.auth.pricing.validUntil=new Date(0).toISOString();if(mode!=='missing')x.save();await assert.rejects(x.host.prepareAuthorized());assert.deepEqual(readFileSync(x.ledgerPath),x.before);assert.equal(x.counts().sends,0);assert.equal(existsSync(join(x.root,'STATE.json')),false)}
})
test('12 fixed ordinals settle once and a repeated prepare or complete dispatch never resends',async()=>{
 const x=setup();await x.host.prepareAuthorized();for(let i=1;i<=12;i++){assert.equal((await x.host.dispatchNext()).ordinal,i);assert.equal((await x.host.resumeReadOnly()).audit,'CONSISTENT')}
 assert.equal((await x.host.dispatchNext()).status,'COMPLETE');await assert.rejects(x.host.prepareAuthorized());assert.deepEqual(x.counts(),{sends:12,appends:25});assert.equal((await x.host.resumeReadOnly()).nextOrdinal,null)
})
test('reserve/send/raw/settle/state uncertainty seals and retains the OS-visible lock; no following send',async()=>{
 for(const fault of ['after_grant_before_state','before_scopedReserve','after_scopedReserve','persist_RESERVED','persist_SENDING','before_send','after_send','before_raw','after_raw','persist_RAW_SAVED','before_scopedSettle','after_scopedSettle','persist_NOT_SENT']){
  const x=setup({fault});if(fault==='after_grant_before_state')await assert.rejects(x.host.prepareAuthorized());else {await x.host.prepareAuthorized();await assert.rejects(x.host.dispatchNext())}
  const before=x.counts().sends;await assert.rejects(x.host.dispatchNext());assert.equal(x.counts().sends,before);assert.equal(existsSync(join(x.root,'lock')),true);assert.equal(existsSync(join(x.root,'HALT.json')),true);assert.equal((await x.host.resumeReadOnly()).status,'HALTED_READ_ONLY')
 }
})
test('missing usage settles conservatively and stops; send uncertainty is not inferred as NOT_SENT',async()=>{
 for(const option of [{noUsage:true},{sendThrow:true}]){const x=setup(option);await x.host.prepareAuthorized();await assert.rejects(x.host.dispatchNext());const r=await x.host.resumeReadOnly();assert.equal(r.status,'HALTED_READ_ONLY');assert.equal(x.counts().sends,1);if(option.noUsage){assert.equal(r.state.units[0].costUpperMicroUsd,324404);assert.equal(r.state.units[0].status,'SETTLED')}else assert.equal(r.state.units[0].status,'UNCERTAIN');await assert.rejects(x.host.dispatchNext());assert.equal(x.counts().sends,1)}
})
