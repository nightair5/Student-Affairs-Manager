import test from'node:test';import assert from'node:assert/strict';import{createPinnedProxyFetch}from'./real-input-model-gateway.mjs';import{BILLING_POLICY}from'./real-input-budget.mjs';import{MATURE_WORKER_REQUEST_BYTE_CEILING,workerRequest}from'./mature-product.mjs'
import{createWorker}from'../cloudflare/worker.mjs'
import{productGenerationSchema,productGenerationContract,PRODUCT_CONTRACT_PROMPT_VERSION}from'../cloudflare/recognition-output-contract.mjs'
const endpoint='https://api.deepseek.com/chat/completions',options=body=>({method:'POST',redirect:'manual',body,headers:{Authorization:'Bearer SYNTHETIC_OFFLINE_NO_CREDENTIAL','Content-Type':'application/json'},signal:new AbortController().signal})
test('a product-sized frozen request passes bounded validation; legacy size and once-send protections stay intact',async()=>{
 const body=JSON.stringify(workerRequest({id:'LONG',text:'公开大学课程通知。'.repeat(1400),referenceTime:'2026-10-15T00:00:00+08:00',timezone:'Asia/Shanghai'}).body)
 assert.ok(Buffer.byteLength(body)>BILLING_POLICY.requestByteCeiling);assert.ok(Buffer.byteLength(body)<MATURE_WORKER_REQUEST_BYTE_CEILING)
 let connects=0;const proxyRequest=()=>{connects++;throw Error('OFFLINE_AFTER_VALIDATION_NO_NETWORK')}
 const legacy=createPinnedProxyFetch({endpoint,proxyRequest});await assert.rejects(()=>legacy(endpoint,options(body)),/PINNED_ROUTE/);assert.equal(connects,0)
 const product=createPinnedProxyFetch({endpoint,proxyRequest,requestByteCeiling:MATURE_WORKER_REQUEST_BYTE_CEILING});await assert.rejects(()=>product(endpoint,options(body)),/OFFLINE_AFTER_VALIDATION/);assert.equal(connects,1)
 await assert.rejects(()=>product(endpoint,options(body)),/CONSUMED/);assert.equal(connects,1)
})
test('oversized, unbounded, other-route and non-integer requests cannot start a connection',async()=>{
 let connects=0;const proxyRequest=()=>{connects++;throw Error('UNEXPECTED_CONNECTION')}
 for(const bound of[Infinity,262145,1.5])assert.throws(()=>createPinnedProxyFetch({endpoint,proxyRequest,requestByteCeiling:bound}),/PINNED_REQUEST_BOUND/)
 assert.throws(()=>createPinnedProxyFetch({proxyRequest,requestByteCeiling:262144}),/PINNED_REQUEST_BOUND/)
 const p=createPinnedProxyFetch({endpoint,proxyRequest,requestByteCeiling:262144});await assert.rejects(()=>p(endpoint,options('x'.repeat(262145))),/PINNED_ROUTE/);assert.equal(connects,0)
})
test('file evaluation builds the exact ordinary Worker payload rather than relabeling it as pasted text',async()=>{
 const s={id:'FILE-CONTROL',sourceTitle:'anonymous.txt',sourceType:'file',text:'请于2027年3月8日18:00前提交匿名报告。',referenceTime:'2027-03-01T00:00:00+08:00',timezone:'Asia/Shanghai'},expected=workerRequest(s);let observed=null
 const w=createWorker({fetcher:async(url,init)=>{assert.equal(url,endpoint);observed=JSON.parse(init.body);return new Response('{}',{headers:{'content-type':'application/json'}})}})
 await w.fetch(new Request('http://127.0.0.1:7180/api/deepseek/extract',{method:'POST',headers:{origin:'http://127.0.0.1:7180','content-type':'application/json'},body:JSON.stringify(expected.workerBody)}),{DEEPSEEK_API_KEY:'server-only-test-key',ALLOWED_ORIGINS:'http://127.0.0.1:7180'})
 assert.deepEqual(observed,expected.body);assert.match(observed.messages[1].content,/来源类型：file\n来源标题：anonymous.txt/u)
 let sends=0;const invalid=createWorker({fetcher:async()=>{sends++;throw Error('NO_SEND')}})
 const rejected=await invalid.fetch(new Request('http://127.0.0.1:7180/api/deepseek/extract',{method:'POST',headers:{origin:'http://127.0.0.1:7180','content-type':'application/json'},body:JSON.stringify({...expected.workerBody,sourceType:'unrecognized'})}),{DEEPSEEK_API_KEY:'SYNTHETIC_OFFLINE_NO_CREDENTIAL',ALLOWED_ORIGINS:'http://127.0.0.1:7180'})
 assert.equal(rejected.status,400);assert.equal(sends,0)
})
test('experimental entity-support guidance preserves the 2.0 shape and cannot silently fall back to the default input',async()=>{
 const old=structuredClone(productGenerationSchema('recognition-product-contract-1.5.0')),next=structuredClone(productGenerationSchema('recognition-product-contract-1.6.0'))
 function strip(v){if(!v||typeof v!=='object')return v;if(Array.isArray(v))return v.map(strip);return Object.fromEntries(Object.entries(v).filter(([k])=>k!=='description').map(([k,x])=>[k,strip(x)]))}
 next.properties.promptVersion.const=old.properties.promptVersion.const;assert.deepEqual(strip(next),strip(old));assert.equal(PRODUCT_CONTRACT_PROMPT_VERSION,'recognition-product-contract-1.5.0')
 const explicit=productGenerationContract('recognition-product-contract-1.6.0');assert.equal(explicit.split(JSON.stringify(productGenerationSchema('recognition-product-contract-1.6.0'))).length,2)
 let observed='';const w=createWorker({fetcher:async(url,init)=>{observed=JSON.parse(init.body).messages[0].content;return new Response('{}',{headers:{'content-type':'application/json'}})}})
 await w.fetch(new Request('http://127.0.0.1:7180/api/deepseek/extract',{method:'POST',headers:{origin:'http://127.0.0.1:7180','content-type':'application/json'},body:JSON.stringify({content:'请报名参加海岚讲座，讲座于2027年4月3日举行。',sourceType:'text',sourceTitle:'匿名正反例',referenceTime:'2027-03-01T00:00:00+08:00',timezone:'Asia/Shanghai'})}),{DEEPSEEK_API_KEY:'server-only-test-key',ALLOWED_ORIGINS:'http://127.0.0.1:7180',DEEPSEEK_PRODUCT_CONTRACT_VERSION:'recognition-product-contract-1.6.0'})
 assert.ok(observed.includes(explicit));assert.ok(observed.includes('与其他通知、其他活动或仅共享日期的任务不关联'))
})
