import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {createScopedHost} from './scoped-execution-host.mjs'
const sha=v=>createHash('sha256').update(v).digest('hex'),write=(p,v)=>writeFileSync(p,JSON.stringify(v)+'\n')
test('larger Worker budget is explicit; legacy reserve and Responses limits remain unchanged',()=>{
 const legacy=createScopedEngine({batch:'OFFLINE-LEGACY-WORKER',count:1,parameters:{temperature:.1,maxOutputTokens:6000,transportRoute:'worker-chat-completions-1'}})
 assert.equal(legacy.budgetOutputTokens,8192)
 assert.throws(()=>createScopedEngine({batch:'OFFLINE-RESPONSES',count:1,parameters:{temperature:0,maxOutputTokens:16384}}),/SCOPED_PARAMETERS/)
 assert.throws(()=>createScopedEngine({batch:'OFFLINE-EXCESS-WORKER',count:1,parameters:{temperature:.1,maxOutputTokens:16385,transportRoute:'worker-chat-completions-1'}}),/SCOPED_PARAMETERS/)
})
function setup(){
 const root=mkdtempSync(join(tmpdir(),'worker-budget-offline-')),ledgerPath=join(root,'ledger.jsonl'),scope={batch:'OFFLINE-WORKER-16384',count:1,snapshot:'b'.repeat(40),parameters:{temperature:.1,maxOutputTokens:16384,transportRoute:'worker-chat-completions-1'}},engine=createScopedEngine(scope)
 const seed={sequence:0,previous:'0'.repeat(64),event:{kind:'OFFLINE_TEST_ONLY'}};seed.hash=sha(JSON.stringify(seed));writeFileSync(ledgerPath,JSON.stringify(seed)+'\n');const before=readFileSync(ledgerPath)
 const body={model:'deepseek-v4-flash',thinking:{type:'disabled'},temperature:.1,max_tokens:16384,response_format:{type:'json_object'},messages:[]},unit={ordinal:1,unitIdentitySha256:'a'.repeat(64),requestSha256:sha(JSON.stringify(body)),body},binding={manifestSha256:'d'.repeat(64),identitiesSha256:'e'.repeat(64)}
 const pricing={sourceUrl:'https://api-docs.deepseek.com/quick_start/pricing/',verifiedAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),peakInputUsdPerMillion:.3,peakOutputUsdPerMillion:1.2,maxInputTokens:1048576,model:'deepseek-flash',endpoint:'https://api.deepseek.com/chat/completions',maxOutputTokens:16384,tokenBoundMethod:'FULL_OFFICIAL_CONTEXT_UPPER_BOUND',reasoningMetering:'INCLUDED_IN_OUTPUT_TOKENS',additionalChargeUpperMicroUsd:0}
 writeFileSync(join(root,'USER_AUTHORIZATION.txt'),'OFFLINE SYNTHETIC AUTHORIZATION ONLY');write(join(root,'PRICE_EVIDENCE.json'),{role:'SYNTHETIC_OFFLINE_PRICE_NOT_OBSERVED',pricing})
 const auth={authorized:true,authorizationSource:'CURRENT_USER_MESSAGE',userMessageSha256:sha(readFileSync(join(root,'USER_AUTHORIZATION.txt'))),batch:scope.batch,count:1,model:'deepseek-flash',...binding,hardLimitMicroUsd:334234,grantId:'OFFLINE_FAKE_WORKER_GRANT',committedHead:'a'.repeat(40),endpoint:pricing.endpoint,retry:0,repair:0,verifier:0,pricing,hostVersion:'scoped-execution-host-2',snapshotCommit:scope.snapshot,ledgerBaselineRows:1,ledgerBaselineBytes:before.length,ledgerBaselineSha256:sha(before),priceEvidenceSha256:sha(readFileSync(join(root,'PRICE_EVIDENCE.json'))),units:[unit.unitIdentitySha256],requestSha256s:[unit.requestSha256]};write(join(root,'AUTHORIZATION.json'),auth)
 let sends=0;const host=createScopedHost(scope,{root,ledgerPath,engine,role:'OFFLINE_ANONYMOUS_FAKE_TRANSPORT',packageRead:()=>({units:[unit],binding}),gitCheck:()=>{},append:async({after})=>writeFileSync(ledgerPath,after),transport:{sendOnce:async()=>{sends++;return {status:200,text:JSON.stringify({usage:{prompt_tokens:100,completion_tokens:12000,total_tokens:12100}})}}}})
 return {host,engine,auth,root,ledgerPath,before,sends:()=>sends,save:()=>write(join(root,'AUTHORIZATION.json'),auth)}
}
test('bound 16384 Worker usage reserves the full bound and settles once with read-only audit',async()=>{
 const x=setup();assert.equal(x.engine.conservativeUpperMicroUsd(1048576,16384,x.auth.pricing),334234)
 await x.host.prepareAuthorized();const row=await x.host.dispatchNext();assert.equal(row.status,'SETTLED');assert.equal(row.usage.output_tokens,12000);assert.equal(row.costUpperMicroUsd,14430);assert.equal((await x.host.resumeReadOnly()).audit,'CONSISTENT');assert.equal((await x.host.dispatchNext()).status,'COMPLETE');assert.equal(x.sends(),1)
})
test('under-budget or mismatched price cannot grant or send; excessive observed output is rejected',async()=>{
 for(const mode of ['low-cap','wrong-output']){const x=setup();if(mode==='low-cap')x.auth.hardLimitMicroUsd--;else x.auth.pricing.maxOutputTokens=8192;x.save();await assert.rejects(x.host.prepareAuthorized());assert.deepEqual(readFileSync(x.ledgerPath),x.before);assert.equal(x.sends(),0);assert.equal(existsSync(join(x.root,'STATE.json')),false)}
 const x=setup();assert.throws(()=>x.engine.conservativeUpperMicroUsd(10,16385,x.auth.pricing),/TOKEN_BOUND/)
})
