import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs'
import {renameSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {createScopedHost} from './scoped-execution-host.mjs'
import {inspectAuthorityObservedSite} from './single-authority-observed-readonly.mjs'
import {BATCH,COUNT,sha} from './single-authority-comparison.mjs'

async function sealedFixture(){
 const root=mkdtempSync(join(tmpdir(),'authority-observed-offline-')),ledger=join(root,'ledger.jsonl'),snapshot='b'.repeat(40),binding={manifestSha256:'d'.repeat(64),identitiesSha256:'e'.repeat(64)},scope={batch:BATCH,count:COUNT,snapshot}
 const write=(p,v)=>writeFileSync(join(root,p),JSON.stringify(v,null,2)+'\n'),seed={sequence:0,previous:'0'.repeat(64),event:{kind:'OFFLINE_ENGINEERING_ONLY'}};seed.hash=sha(JSON.stringify(seed));writeFileSync(ledger,JSON.stringify(seed)+'\n');const before=readFileSync(ledger)
 const units=Array.from({length:COUNT},(_,i)=>{const body={model:'deepseek-flash',temperature:0,reasoning:{effort:'none'},stream:false,max_output_tokens:8192,input:[{role:'user',content:'匿名测试'+i}]};return {ordinal:i+1,body,unitIdentitySha256:sha('offline-unit'+i),requestSha256:sha(JSON.stringify(body))}})
 const pricing={sourceUrl:'https://api-docs.deepseek.com/quick_start/pricing/',verifiedAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),peakInputUsdPerMillion:.3,peakOutputUsdPerMillion:1.2,maxInputTokens:1048576,model:'deepseek-flash',endpoint:'https://api.deepseek.com/responses',maxOutputTokens:8192,tokenBoundMethod:'FULL_OFFICIAL_CONTEXT_UPPER_BOUND',reasoningMetering:'INCLUDED_IN_OUTPUT_TOKENS',additionalChargeUpperMicroUsd:0}
 writeFileSync(join(root,'USER_AUTHORIZATION.txt'),'FAKE OFFLINE TEST ONLY, NO REAL AUTHORIZATION');write('PRICE_EVIDENCE.json',{role:'SYNTHETIC_OFFLINE_PRICE_NOT_OBSERVED',pricing})
 const auth={authorized:true,authorizationSource:'CURRENT_USER_MESSAGE',userMessageSha256:sha(readFileSync(join(root,'USER_AUTHORIZATION.txt'))),batch:BATCH,count:COUNT,model:'deepseek-flash',...binding,hardLimitMicroUsd:2600000,grantId:'OFFLINE_FAKE_AUTHORITY',committedHead:'a'.repeat(40),endpoint:pricing.endpoint,retry:0,repair:0,verifier:0,pricing,hostVersion:'scoped-execution-host-2',snapshotCommit:snapshot,ledgerBaselineRows:1,ledgerBaselineBytes:before.length,ledgerBaselineSha256:sha(before),priceEvidenceSha256:sha(readFileSync(join(root,'PRICE_EVIDENCE.json'))),units:units.map(u=>u.unitIdentitySha256),requestSha256s:units.map(u=>u.requestSha256)};write('AUTHORIZATION.json',auth)
 let sends=0
 const host=createScopedHost(scope,{root,ledgerPath:ledger,engine:createScopedEngine(scope),role:'OFFLINE_ANONYMOUS_FAKE_TRANSPORT',packageRead:()=>({units,binding}),gitCheck:()=>{},append:async({after})=>writeFileSync(ledger,after),transport:{sendOnce:async()=>{sends++;if(sends===3)throw Error('OFFLINE_UNKNOWN_TRANSPORT');return {status:200,text:JSON.stringify({id:'anonymous',usage:{input_tokens:10,output_tokens:5}})}}}})
 await host.prepareAuthorized();await host.dispatchNext();await host.dispatchNext();await assert.rejects(host.dispatchNext())
 return {root,ledger,pack:{units,snapshot,binding},host}
}
test('sealed read-only scene exposes two settled records, retains eight entries and does not mutate or dispatch',async()=>{
 const x=await sealedFixture(),paths=[x.ledger,join(x.root,'STATE.json'),join(x.root,'HALT.json'),join(x.root,'raw/01.json'),join(x.root,'raw/02.json')],before=paths.map(p=>readFileSync(p)),lockEntries=readdirSync(join(x.root,'lock'))
 const r=inspectAuthorityObservedSite(x.root,x.pack,x.ledger)
 assert.equal(r.known.length,2);assert.equal(r.scene.denominator,8);assert.equal(r.scene.units[2].status,'UNCERTAIN');assert.equal(r.scene.units[3].status,'NOT_SENT');assert.equal(r.scene.modelRequests,0);assert.equal(r.scene.ledgerWrites,0);assert.equal(r.scene.winner,'EVIDENCE_INCOMPLETE')
 assert.deepEqual(paths.map(p=>readFileSync(p)),before);assert.equal(existsSync(join(x.root,'lock')),true);assert.deepEqual(readdirSync(join(x.root,'lock')),lockEntries)
})
test('a tampered settled raw cannot enter ordinary replay',async()=>{
 const x=await sealedFixture(),p=join(x.root,'raw/01.json'),raw=JSON.parse(readFileSync(p));raw.rawHttpText+=' ';writeFileSync(p,JSON.stringify(raw))
 assert.throws(()=>inspectAuthorityObservedSite(x.root,x.pack,x.ledger),/AUTHORITY_OBSERVED_RAW/)
})
test('raw without a settled receipt is rejected, not promoted into a model result',async()=>{
 const x=await sealedFixture(),p=join(x.root,'raw/03.json');writeFileSync(p,'{}')
 assert.throws(()=>inspectAuthorityObservedSite(x.root,x.pack,x.ledger),/UNCERTAIN_EVIDENCE/)
})

test('a missing seal prevents replay; the reader does not repair it',async()=>{
 const x=await sealedFixture();renameSync(join(x.root,'HALT.json'),join(x.root,'HALT-preserved.json'))
 assert.throws(()=>inspectAuthorityObservedSite(x.root,x.pack,x.ledger),/SEALED_SITE_REQUIRED/)
 assert.equal(existsSync(join(x.root,'HALT.json')),false)
 assert.equal(existsSync(join(x.root,'HALT-preserved.json')),true)
})
