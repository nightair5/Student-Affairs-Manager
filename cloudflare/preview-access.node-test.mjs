import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createWorker} from './worker.mjs'
import {constantTimeCodeEqual} from './preview-access.mjs'

const origin='https://preview.example',code='preview-test-only-code'
const env={PREVIEW_ACCESS_REQUIRED:'true',PREVIEW_ACCESS_CODE:code,DEEPSEEK_API_KEY:'server-only-test-key-placeholder',ASSETS:{fetch:async()=>new Response('ordinary product')}}
const request=(path='/',init={})=>new Request(origin+path,init)
const login=(worker,value=code,extra={})=>worker.fetch(request('/_preview/access',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded','cf-connecting-ip':'test-only-ip',...extra},body:new URLSearchParams({code:value})}),env)
const cookie=response=>response.headers.get('set-cookie').split(';')[0]

test('preview fails closed without its code, for pages, assets, APIs and preflight',async()=>{
  let accesses=0;const worker=createWorker(),missing={...env,PREVIEW_ACCESS_CODE:undefined,ASSETS:{fetch:async()=>{accesses++;return new Response('should not run')}}}
  for(const path of ['/','/assets/app.js','/api/deepseek/status','/api/source/status','/_preview/access'])assert.equal((await worker.fetch(request(path),missing)).status,503)
  assert.equal((await worker.fetch(request('/api/deepseek',{method:'OPTIONS'}),missing)).status,503)
  assert.equal(accesses,0)
})
test('only preview is gated; production behavior and static assets stay unchanged',async()=>{
  const worker=createWorker();assert.equal(await (await worker.fetch(request(),{...env,PREVIEW_ACCESS_REQUIRED:undefined})).text(),'ordinary product')
  assert.equal((await worker.fetch(request('/api/deepseek/status'),{...env,PREVIEW_ACCESS_REQUIRED:undefined})).status,200)
  for(const path of ['/','/assets/main.js','/api/deepseek/status'])assert.equal((await worker.fetch(request(path),env)).status,401)
})
test('valid login issues a scoped expiring MAC cookie; password is never in the cookie',async()=>{
  const worker=createWorker(),response=await login(worker)
  assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/')
  const header=response.headers.get('set-cookie');assert.match(header,/^__Host-/u)
  for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/','Max-Age=28800'])assert.ok(header.includes(flag))
  assert.ok(!header.includes(code));assert.ok(!header.includes('Domain='))
  const authenticated=await worker.fetch(request('/',{headers:{cookie:cookie(response)}}),env)
  assert.equal(await authenticated.text(),'ordinary product');assert.match(authenticated.headers.get('cache-control'),/no-store/u)
})
test('tampering, expiration, code rotation and another origin invalidate sessions',async()=>{
  let time=1700000000000;const worker=createWorker({previewNow:()=>time}),token=cookie(await login(worker))
  assert.equal((await worker.fetch(request('/',{headers:{cookie:token+'x'}}),env)).status,401)
  assert.equal((await worker.fetch(request('/',{headers:{cookie:token}}),{...env,PREVIEW_ACCESS_CODE:'rotated-test-only-code'})).status,401)
  assert.equal((await worker.fetch(new Request('https://other.example/',{headers:{cookie:token}}),env)).status,401)
  time+=28800*1000;assert.equal((await worker.fetch(request('/',{headers:{cookie:token}}),env)).status,401)
})
test('wrong codes are throttled and cross-origin/oversized forms cannot authenticate',async()=>{
  const worker=createWorker()
  for(let i=0;i<5;i++)assert.equal((await login(worker,'wrong-test-only-code')).status,401)
  assert.equal((await login(worker)).status,429)
  assert.equal((await login(createWorker(),code,{origin:'https://foreign.example'})).status,403)
  assert.equal((await login(createWorker(),'x'.repeat(3000))).status,413)
  assert.ok(await constantTimeCodeEqual(code,code));assert.equal(await constantTimeCodeEqual(code+'x',code),false)
})
test('preview config sends every asset through Worker and has no custom routes',()=>{
  const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'))
  assert.equal(config.env.preview.vars.PREVIEW_ACCESS_REQUIRED,'true')
  assert.equal(config.env.preview.assets.run_worker_first,true);assert.deepEqual(config.env.preview.routes,[])
  assert.ok(Array.isArray(config.assets.run_worker_first));assert.equal(config.vars?.PREVIEW_ACCESS_REQUIRED,undefined)
})

async function authorized(worker,path,body,token,extra={}) {
  return worker.fetch(request(path,{method:'POST',headers:{origin,cookie:token,'content-type':'application/json','cf-connecting-ip':'limits-test-only',...extra},body:JSON.stringify(body)}),env)
}
const extraction={content:'请提交匿名报告。',sourceType:'text',referenceTime:'2026-10-17T09:00:00+08:00',timezone:'Asia/Shanghai'}
test('authenticated preview keeps per-IP frequency and output token bounds',async()=>{
  let calls=0;const worker=createWorker({fetcher:async(_url,init)=>{calls++;assert.equal(JSON.parse(init.body).max_tokens,6000);return Response.json({})}}),token=cookie(await login(worker))
  for(let i=0;i<8;i++)await authorized(worker,'/api/deepseek/extract',extraction,token)
  assert.equal((await authorized(worker,'/api/deepseek/extract',extraction,token)).status,429);assert.equal(calls,8)
})
test('authenticated preview enforces concurrent requests and actual body bytes',async()=>{
  const releases=[];let calls=0
  const worker=createWorker({fetcher:async()=>{calls++;await new Promise(resolve=>releases.push(resolve));return Response.json({})}}),token=cookie(await login(worker))
  const one=authorized(worker,'/api/deepseek/extract',extraction,token),two=authorized(worker,'/api/deepseek/extract',extraction,token)
  for(let i=0;releases.length<2&&i<1000;i++)await new Promise(resolve=>setTimeout(resolve,1))
  assert.equal(releases.length,2,'both requests must reach the injected upstream')
  assert.equal((await authorized(worker,'/api/deepseek/extract',extraction,token)).status,429)
  releases.forEach(release=>release());await Promise.all([one,two]);assert.equal(calls,2)
  assert.equal((await authorized(worker,'/api/deepseek/extract',{...extraction,content:'文'.repeat(40000)},token)).status,413);assert.equal(calls,2)
})
test('request logs contain metadata rather than body, credentials or cookies',async()=>{
  const logs=[],previous=console.log;console.log=entry=>logs.push(entry)
  try{const worker=createWorker({fetcher:async()=>Response.json({})}),token=cookie(await login(worker));await authorized(worker,'/api/deepseek/extract',extraction,token)
    const text=JSON.stringify(logs);for(const value of [code,env.DEEPSEEK_API_KEY,token,extraction.content])assert.equal(text.includes(value),false)
    assert.ok(logs.length>0);assert.ok(logs.every(row=>Object.keys(row).every(key=>['requestId','timestamp','path','method','status','durationMs','inputLength','outputTokens','errorType','client'].includes(key))))
  }finally{console.log=previous}
})
