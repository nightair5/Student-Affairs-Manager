import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {workerRequest} from './mature-product.mjs'
const sha=b=>createHash('sha256').update(b).digest('hex')
test('48 development and 12 reserved retain all original36 and disjoint seeded source-first references',()=>{
 const root='src/recognition/fixtures/',old=JSON.parse(readFileSync(root+'product-dev-v1/notifications.json')),dev=JSON.parse(readFileSync(root+'product-dev-v2/notifications.json')),reserved=JSON.parse(readFileSync(root+'product-dev-v2/reserved/notifications.json')),m=JSON.parse(readFileSync(root+'product-dev-v2/MANIFEST.json'));
 assert.equal(dev.length,48);assert.equal(reserved.length,12);assert.equal(m.seed,20261014);assert.equal(sha(readFileSync(root+'product-dev-v1/notifications.json')),m.originalBytesSha256);
 for(let i=0;i<old.length;i++){assert.equal(dev[i].text,old[i].text);assert.deepEqual(dev[i].reference,old[i].reference)}assert.equal(reserved.some(s=>dev.some(d=>d.id===s.id)),false);
 for(const s of [...dev,...reserved]){const r=workerRequest(s);assert.equal(r.body.model,'deepseek-v4-flash');assert.equal(r.workerBody.content,s.text);assert.equal(JSON.stringify(r).includes(JSON.stringify(s.reference)),false)}
})
test('opt-in Worker route retains native Chat usage and once-send protocol; drift rejected before reserve',async()=>{
 const scope={batch:'MATURE-OFFLINE-TEST',count:1,parameters:{temperature:.1,maxOutputTokens:6000,transportRoute:'worker-chat-completions-1'}},engine=createScopedEngine(scope),s={id:'X',text:'提交报告。',referenceTime:'2026-10-14T10:00:00+08:00',timezone:'Asia/Shanghai'},body=workerRequest(s).body,unit={ordinal:1,unitIdentitySha256:'a'.repeat(64),requestSha256:sha(JSON.stringify(body)),body},binding={manifestSha256:'b'.repeat(64),identitiesSha256:'c'.repeat(64)},auth={authorized:true,authorizationSource:'CURRENT_USER_MESSAGE',userMessageSha256:'d'.repeat(64),batch:scope.batch,count:1,model:'deepseek-flash',...binding,hardLimitMicroUsd:330000,grantId:'OFFLINE_GRANT',committedHead:'e'.repeat(40),endpoint:'https://api.deepseek.com/chat/completions',retry:0,repair:0,verifier:0,units:[unit.unitIdentitySha256],requestSha256s:[unit.requestSha256],pricing:{sourceUrl:'https://api-docs.deepseek.com/quick_start/pricing/',verifiedAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),peakInputUsdPerMillion:.3,peakOutputUsdPerMillion:1.2,maxInputTokens:1048576}};
 let sends=0,reserves=0,settles=0;const args=()=>({state:engine.newState([unit],binding),auth,units:[unit],binding,ledger:{reserve:async()=>{reserves++},settle:async()=>{settles++}},transport:{sendOnce:async()=>{sends++;return {status:200,text:JSON.stringify({choices:[],usage:{prompt_tokens:100,completion_tokens:10,total_tokens:110}})}}},persist:async()=>{},rawStore:{writeOnce:async()=>{}},lock:async fn=>fn(),preflight:async()=>{}});
 const row=await engine.runOne(args());assert.equal(row.status,'SETTLED');assert.equal(row.usage.input_tokens,100);assert.equal(row.usage.output_tokens,10);assert.equal(row.costUpperMicroUsd,42);assert.equal(sends,1);assert.equal(settles,1);
 unit.body.max_tokens=6001;unit.requestSha256=sha(JSON.stringify(unit.body));auth.requestSha256s=[unit.requestSha256];await assert.rejects(engine.runOne(args()),/REQUEST_OR_PARAMETERS_DRIFT/);assert.equal(reserves,1);assert.equal(sends,1)
})
