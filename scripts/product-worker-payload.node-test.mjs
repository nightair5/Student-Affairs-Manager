import test from'node:test';import assert from'node:assert/strict';import{createPinnedProxyFetch}from'./real-input-model-gateway.mjs';import{BILLING_POLICY}from'./real-input-budget.mjs';import{MATURE_WORKER_REQUEST_BYTE_CEILING,workerRequest}from'./mature-product.mjs'
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
