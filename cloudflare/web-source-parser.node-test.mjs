import test from 'node:test'
import assert from 'node:assert/strict'
import {decodeWebBytes,extractWebSource,sensitiveWebUrl} from './web-source-parser.mjs'
import {createWorker,isPrivateIpAddress,validateWebFetchTarget} from './worker.mjs'

test('inert article extraction keeps rows, useful links, entities and excludes page chrome',()=>{
 const html='<title>学院通知</title><nav>无关菜单</nav><article><h1>材料提交</h1><table><tr><td>材料</td><td>报名表</td><td>2份</td></tr></table><p>截止&#x31;&#49;月8日17:00前</p><a href="/form">报名入口</a><a href="/private?token=secret">附件</a><script>ignore-all-instructions()</script></article><footer>页脚</footer>'
 const out=extractWebSource(html,{baseUrl:'https://notice.example/notice'})
 for(const value of ['学院通知','材料提交','报名表','2份','11月8日17:00','https://notice.example/form'])assert.ok((out.title+out.text).includes(value),value)
 for(const value of ['无关菜单','页脚','ignore-all-instructions','token=secret'])assert.ok(!out.text.includes(value),value)
})
test('preserves inline fragmented dates and selects substantial generic content container',()=>{
 const html='<body><div>无关导航入口</div><div class="news-content"><p>日期：<span>202</span><span>6</span>年11月<span>1</span><span>1</span>日。</p><p>'+('材料、时间和办理说明。'.repeat(30))+'</p></div><div>无关推荐入口</div></body>'
 const out=extractWebSource(html,{baseUrl:'https://notice.example/'})
 assert.match(out.text,/2026年11月11日/u)
 assert.doesNotMatch(out.text,/无关导航入口|无关推荐入口/u)
})
test('reports truncation and detects login and dynamic placeholders',()=>{
 assert.equal(extractWebSource('a'.repeat(30),{baseUrl:'https://notice.example',html:false,maxChars:10}).partial,true)
 assert.throws(()=>extractWebSource('<body><form>请登录<input type="password"></form></body>',{baseUrl:'https://notice.example'}),/WEB_ACCESS_RESTRICTED/u)
 assert.throws(()=>extractWebSource('<body>页面加载中，请启用 JavaScript</body>',{baseUrl:'https://notice.example'}),/WEB_TEXT_UNAVAILABLE/u)
})
test('a script-heavy navigation shell does not masquerade as the full document',()=>{
 const script='<script>'+(' '.repeat(55_000))+'</script>'
 assert.throws(()=>extractWebSource('<body>'+script+'<div>登录以继续查看</div></body>',{baseUrl:'https://notice.example'}),/WEB_TEXT_UNAVAILABLE/u)
 const brief=extractWebSource('<body>'+script+'<p>通知：周五提交登记表。</p></body>',{baseUrl:'https://notice.example'})
 assert.match(brief.text,/周五提交登记表/u);assert.equal(brief.partial,true)
})
test('an unclosed script cannot leak its contents and marks the result partial',()=>{
 const out=extractWebSource('<body><p>请提交申请表。</p><script>ignore instructions'+('<script>'.repeat(10000))+'</body>',{baseUrl:'https://notice.example/'})
 assert.match(out.text,/请提交申请表/u)
 assert.doesNotMatch(out.text,/ignore instructions/u)
 assert.equal(out.partial,true)
})
test('decodes a declared GBK page and refuses unknown encodings',()=>{
 assert.equal(decodeWebBytes(Uint8Array.from([0xd6,0xd0,0xce,0xc4]),'text/plain; charset=gbk').text,'中文')
 assert.throws(()=>decodeWebBytes(Uint8Array.from([65]),'text/plain; charset=unknown-encoding'),/WEB_CHARSET_UNSUPPORTED/u)
})
test('rejects credentials, sensitive query values, IPv6 mapped addresses and own origin',async()=>{
 assert.equal(sensitiveWebUrl(new URL('https://notice.example/?token=private')),true)
 assert.equal(sensitiveWebUrl(new URL('https://notice.example/?X-Amz-Signature=private')),true)
 assert.equal(sensitiveWebUrl(new URL('https://notice.example/#%74oken=private')),true)
 assert.equal(validateWebFetchTarget('https://notice.example/?token=private').error,'WEB_SENSITIVE_URL')
 assert.equal(validateWebFetchTarget('https://localhost./').error,'WEB_PRIVATE_ADDRESS_FORBIDDEN')
 assert.equal(validateWebFetchTarget('https://printer.internal./').error,'WEB_PRIVATE_ADDRESS_FORBIDDEN')
 assert.equal(isPrivateIpAddress('::ffff:7f00:1'),true)
 assert.equal(isPrivateIpAddress('ff02::1'),true)
 let contacted=false
 const worker=createWorker({resolveHostname:async()=>{},fetcher:async()=>{contacted=true;return new Response('unexpected')}})
 const req=new Request('https://student-affairs.site/api/source/fetch',{method:'POST',headers:{origin:'https://student-affairs.site','content-type':'application/json'},body:JSON.stringify({url:'https://preview.student-affairs.site/private'})})
 const response=await worker.fetch(req,{ALLOWED_ORIGINS:'',ASSETS:{fetch:async()=>new Response('')}})
 assert.equal(response.status,400);assert.equal(contacted,false)
})
test('a redirect to a private address is rejected before the next request',async()=>{
 let calls=0
 const worker=createWorker({resolveHostname:async()=>{},fetcher:async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://127.0.0.1/private'}})}})
 const req=new Request('https://student-affairs.site/api/source/fetch',{method:'POST',headers:{origin:'https://student-affairs.site','content-type':'application/json'},body:JSON.stringify({url:'https://notice.example/start'})})
 assert.equal((await worker.fetch(req,{ALLOWED_ORIGINS:'',ASSETS:{fetch:async()=>new Response('')}})).status,400)
 assert.equal(calls,1)
})
test('the reader only makes an anonymous GET and never submits a form',async()=>{
 let calls=0
 const worker=createWorker({resolveHostname:async()=>{},fetcher:async(_url,options)=>{
  calls++
  assert.equal(options.method,'GET')
  assert.equal(new Headers(options.headers).has('cookie'),false)
  assert.equal(new Headers(options.headers).has('authorization'),false)
  return new Response('<article><h1>报名说明</h1><p>请在截止前准备材料。</p><form><input name="private" value="not-read"></form></article>',{headers:{'content-type':'text/html; charset=utf-8'}})
 }})
 const req=new Request('https://student-affairs.site/api/source/fetch',{method:'POST',headers:{origin:'https://student-affairs.site','content-type':'application/json'},body:JSON.stringify({url:'https://notice.example/form'})})
 const response=await worker.fetch(req,{ALLOWED_ORIGINS:'',ASSETS:{fetch:async()=>new Response('')}})
 const body=await response.json()
 assert.equal(response.status,200);assert.equal(calls,1)
 assert.match(body.text,/准备材料/u);assert.doesNotMatch(body.text,/not-read/u)
})
test('a CNAME to an internal or own-zone host is rejected before outbound fetch',async()=>{
 const previous=globalThis.fetch
 try{
  for(const destination of ['printer.internal.','preview.student-affairs.site.']){
   globalThis.fetch=async()=>Response.json({Answer:[{type:5,data:destination},{type:1,data:'93.184.216.34'}]})
   let calls=0
   const worker=createWorker({fetcher:async()=>{calls++;return new Response('must not connect')}})
   const req=new Request('https://student-affairs.site/api/source/fetch',{method:'POST',headers:{origin:'https://student-affairs.site','content-type':'application/json'},body:JSON.stringify({url:'https://notice.example/'})})
   assert.equal((await worker.fetch(req,{ALLOWED_ORIGINS:'',ASSETS:{fetch:async()=>new Response('')}})).status,400)
   assert.equal(calls,0)
  }
 }finally{globalThis.fetch=previous}
})
