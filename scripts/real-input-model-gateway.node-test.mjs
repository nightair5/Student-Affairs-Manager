import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile } from 'node:fs/promises'
import { join,resolve } from 'node:path'
import { createModelGateway,inspectRequest,createRawRecorder,createPinnedProxyFetch } from './real-input-model-gateway.mjs'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { BILLING_POLICY,FLASH41_POLICY,FLASH41_PAIRED06_POLICY,sha256,initializeBudget,openBudget } from './real-input-budget.mjs'

const ORIGIN='http://127.0.0.1:6637',CAP='a'.repeat(64),NOW='2026-09-07T00:00:00.000Z'
const FAKE_SECRET='NOT_A_REAL_CREDENTIAL_FOR_ENGINEERING'
function pinnedTransport({proxyStatus=200,authorized=true}={}) {
  const observed={connects:[],tls:[],requests:[],bodies:[]}
  const socket=()=>Object.assign(new EventEmitter(),{destroy(){}})
  const fetchImpl=createPinnedProxyFetch({
    proxyRequest(options){observed.connects.push(options);const req=socket()
      req.end=()=>queueMicrotask(()=>req.emit('connect',{statusCode:proxyStatus},socket(),Buffer.alloc(0)));return req},
    secureConnect(options){observed.tls.push(options);const s=Object.assign(socket(),{authorized})
      queueMicrotask(()=>s.emit('secureConnect'));return s},
    Agent:class {destroy(){}},
    upstreamRequest(url,options,callback){observed.requests.push({url,options});const req=socket()
      req.end=body=>{observed.bodies.push(body);const response=Readable.from([Buffer.from(raw('A02'))])
        response.statusCode=200;response.headers={'content-type':'application/json'};queueMicrotask(()=>callback(response))}
      return req}
  })
  const options=()=>({method:'POST',redirect:'manual',headers:{Authorization:'Bearer '+FAKE_SECRET,'Content-Type':'application/json'},
    body:request(),signal:new AbortController().signal})
  return {observed,fetchImpl,options}
}
test('pinned route sends no credentials to proxy and dispatches only after verified TLS, once',async()=>{
  const s=pinnedTransport(),response=await s.fetchImpl(BILLING_POLICY.endpoint,s.options())
  assert.equal(await response.text(),raw('A02'));assert.equal(s.observed.connects.length,1)
  assert.deepEqual(s.observed.connects[0],{hostname:'127.0.0.1',port:10081,method:'CONNECT',path:'api.deepseek.com:443',
    headers:{Host:'api.deepseek.com:443'},agent:false,maxHeaderSize:8192})
  assert.equal(s.observed.tls[0].servername,'api.deepseek.com');assert.equal(s.observed.tls[0].rejectUnauthorized,true)
  assert.equal(typeof s.observed.tls[0].checkServerIdentity,'function')
  assert.equal(s.observed.requests.length,1);assert.equal(s.observed.requests[0].url,BILLING_POLICY.endpoint)
  assert.equal(s.observed.requests[0].options.headers.Authorization,'Bearer '+FAKE_SECRET)
  await assert.rejects(()=>s.fetchImpl(BILLING_POLICY.endpoint,s.options()),/PINNED_ROUTE_CONSUMED/)
  assert.equal(s.observed.requests.length,1)
})
test('proxy authentication demand and unverified TLS cannot send the API credential or body',async()=>{
  for(const config of [{proxyStatus:407},{authorized:false}]) {
    const s=pinnedTransport(config)
    await assert.rejects(()=>s.fetchImpl(BILLING_POLICY.endpoint,s.options()),/PINNED_ROUTE_FAILED/)
    assert.equal(s.observed.requests.length,0);assert.deepEqual(s.observed.bodies,[])
    assert.equal(JSON.stringify(s.observed.connects).includes(FAKE_SECRET),false)
  }
})
test('abort and alternative destination fail before opening a proxy connection',async()=>{
  const s=pinnedTransport(),controller=new AbortController();controller.abort()
  await assert.rejects(()=>s.fetchImpl(BILLING_POLICY.endpoint,{...s.options(),signal:controller.signal}),/ABORTED/)
  assert.equal(s.observed.connects.length,0)
  const other=pinnedTransport();await assert.rejects(()=>other.fetchImpl('https://other.invalid/responses',other.options()),/PINNED_ROUTE/)
  assert.equal(other.observed.connects.length,0)
})
// Diagnostic fixtures are transport-only, with fake credentials and no live network.
const transportFailure=code=>()=>{throw new TypeError(FAKE_SECRET,{cause:Object.assign(new Error(FAKE_SECRET),{code})})}
const request=()=>JSON.stringify({model:BILLING_POLICY.model,temperature:0,reasoning:{effort:'none'},stream:false,max_output_tokens:8192,
  input:[{role:'system',content:[{type:'input_text',text:'Protocol test only; no semantic accuracy claim.'}]},
    {role:'user',content:[{type:'input_text',text:JSON.stringify({source:'工程协议占位文字',referenceTime:NOW,timezone:'Asia/Shanghai',scopes:[]})}]}],
  text:{format:{type:'json_schema',name:'source_semantics',schema:{type:'object',properties:{},required:[],additionalProperties:false}}}})
const raw=id=>JSON.stringify({id:'resp_'+id,object:'response',status:'completed',model:BILLING_POLICY.model,
  usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:10,output_tokens_details:{reasoning_tokens:0},total_tokens:110},
  output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'{}'}]}]})
const http=value=>new Response(value,{status:200,headers:{'content-type':'application/json'}})
async function setup(fetchOverride,extra={}) {
  const parent=process.env.REAL_INPUT_TEST_TEMP;assert.ok(parent&&resolve(parent)===parent)
  const root=await mkdtemp(join(parent,'gateway-test-')),dir=join(root,'run'),lockRoot=join(root,'control')
  await mkdir(dir);await mkdir(lockRoot)
  const requests=Object.fromEntries(Array.from({length:16},(_,i)=>[`${i<8?'A':'B'}0${i%8+1}`,request()]))
  const units=Object.entries(requests).map(([unitId,text])=>{const {requestSha,requestBytes,candidateSha,inputSha}=inspectRequest(text);return {unitId,requestSha,requestBytes,candidateSha,inputSha,scorerSha:sha256('protocol-scorer-not-a-model-score')}})
  const manifest={version:'real-input-request-manifest-2',packageId:'MAINLINE-REAL-INPUT-01',policy:BILLING_POLICY,
    billingEvidence:{checkedAt:NOW,validUntil:'2026-09-08T00:00:00.000Z',evidenceSha:sha256('engineering-only')},lockRoot,units}
  const manifestSha=await initializeBudget(dir,manifest),budget=await openBudget(dir,manifestSha),recorded=[],calls=[]
  let secretReads=0
  const fetchImpl=async(url,options)=>{calls.push({url,options});return fetchOverride?fetchOverride(url,options):http(raw('A01'))}
  const config={origin:ORIGIN,capability:CAP,budget,requests,recordRaw:async value=>{recorded.push(value)},clock:()=>NOW,
    readSecret:()=>{secretReads++;return FAKE_SECRET},fetchImpl,...extra}
  const gateway=await createModelGateway(config)
  const message=(id='A01')=>({method:'POST',path:'/api/real-input/recognize',headers:{host:new URL(ORIGIN).host,origin:ORIGIN,
    'sec-fetch-site':'same-origin','content-type':'application/json','x-real-input-capability':CAP},bodyText:JSON.stringify({unitId:id,requestSha:inspectRequest(requests[id]).requestSha})})
  return {gateway,budget,recorded,calls,config,requests,dir,manifestSha,message,secretReads:()=>secretReads}
}
test('the only successful path preserves raw response, binds usage and uses the fixed upstream without redirects',async()=>{
  const s=await setup(),r=await s.gateway.handle(s.message())
  assert.equal(r.status,200);assert.equal(r.body.rawHttpText,raw('A01'));assert.equal(r.body.costUpperMicroCny,390)
  assert.equal(s.recorded[0].rawHttpText,r.body.rawHttpText);assert.equal(s.recorded[0].requestSha,r.body.requestSha)
  assert.equal(s.calls.length,1);assert.equal(s.calls[0].url,'https://api.deepseek.com/responses')
  assert.equal(s.calls[0].options.redirect,'manual');assert.equal(s.calls[0].options.headers.Authorization,'Bearer '+FAKE_SECRET)
  assert.equal(JSON.stringify(r).includes(FAKE_SECRET),false);assert.equal(JSON.stringify(s.recorded).includes(FAKE_SECRET),false)
  assert.equal((await s.budget.snapshot()).reservations[0].status,'settled')
})
test('D unit passes only when present in the exact budget snapshot; original AB gateway rejects it before secret access',async()=>{
  const original=await setup(),unitId='D01',body=request(),identity=inspectRequest(body)
  const message={...original.message(),bodyText:JSON.stringify({unitId,requestSha:identity.requestSha})}
  assert.equal((await original.gateway.handle(message)).status,400)
  assert.equal(original.secretReads(),0);assert.equal(original.calls.length,0)
  let reservations=0,fetches=0,records=0
  const gateway=await createModelGateway({origin:ORIGIN,capability:CAP,requests:{D01:body},clock:()=>NOW,
    budget:{snapshot:async()=>({units:[{unitId,...identity}]}),reserve:async id=>{assert.equal(id,'D01');reservations++;
      return{complete:async()=>({usage:JSON.parse(raw('D01')).usage,costUpperMicroCny:390}),uncertain:async()=>{throw Error('UNEXPECTED')}}}},
    readSecret:()=>FAKE_SECRET,fetchImpl:async()=>{fetches++;return http(raw('D01'))},recordRaw:async r=>{assert.equal(r.unitId,'D01');records++}})
  assert.equal((await gateway.handle(message)).status,200)
  assert.equal(reservations,1);assert.equal(fetches,1);assert.equal(records,1)
  assert.equal((await gateway.handle({...message,bodyText:JSON.stringify({unitId:'D02',requestSha:identity.requestSha})})).status,400)
  assert.equal(fetches,1)
})
test('paired04 units require exact current budget membership; old gateway cannot dispatch them',async()=>{
  const original=await setup(),unitId='N01-03',body=request(),identity=inspectRequest(body)
  const message={...original.message(),bodyText:JSON.stringify({unitId,requestSha:identity.requestSha})}
  assert.equal((await original.gateway.handle(message)).status,400);assert.equal(original.secretReads(),0)
  let calls=0,reserves=0
  const gateway=await createModelGateway({origin:ORIGIN,capability:CAP,requests:{[unitId]:body},clock:()=>NOW,
    budget:{snapshot:async()=>({units:[{unitId,...identity}]}),reserve:async id=>{assert.equal(id,unitId);reserves++;
      return{complete:async()=>({usage:JSON.parse(raw(unitId)).usage,costUpperMicroCny:390}),uncertain:async()=>{throw Error('UNEXPECTED')}}}},
    readSecret:()=>FAKE_SECRET,fetchImpl:async()=>{calls++;return http(raw(unitId))},recordRaw:async row=>{assert.equal(row.unitId,unitId)}})
  assert.equal((await gateway.handle(message)).status,200)
  assert.equal((await gateway.handle({...message,bodyText:JSON.stringify({unitId:'N01-04',requestSha:identity.requestSha})})).status,400)
  assert.equal(calls,1);assert.equal(reserves,1)
})

test('paired06: Q membership requires explicit new policy and dispatches exactly the frozen new-model body',async()=>{
  const unitId='Q07-06',value=JSON.parse(request());value.model='deepseek-flash'
  const body=JSON.stringify(value),identity=inspectRequest(body,FLASH41_PAIRED06_POLICY)
  let secretReads=0,calls=0,reserves=0,records=0
  const envelope=JSON.parse(raw(unitId));envelope.model='deepseek-flash'
  const config={origin:ORIGIN,capability:CAP,requests:{[unitId]:body},clock:()=>NOW,
    budget:{snapshot:async()=>({units:[{unitId,...identity}]}),reserve:async(id,text,policy)=>{
      assert.equal(id,unitId);assert.equal(text,body);assert.deepEqual(policy,FLASH41_PAIRED06_POLICY);reserves++
      return{complete:async()=>({usage:envelope.usage,costUpperMicroCny:280}),uncertain:async()=>{throw Error('UNEXPECTED')}}}},
    readSecret:()=>{secretReads++;return FAKE_SECRET},fetchImpl:async(url,options)=>{
      calls++;assert.equal(url,'https://api.deepseek.com/responses');assert.equal(options.body,body);return http(JSON.stringify(envelope))},
    recordRaw:async row=>{records++;assert.equal(row.unitId,unitId);assert.equal(row.requestSha,identity.requestSha)}}
  for(const policy of [BILLING_POLICY,FLASH41_POLICY])await assert.rejects(()=>createModelGateway({...config,policy}),/PAIRED06_POLICY/)
  assert.equal(secretReads,0);assert.equal(calls,0)
  const gateway=await createModelGateway({...config,policy:FLASH41_PAIRED06_POLICY})
  const message={method:'POST',path:'/api/real-input/recognize',headers:{host:new URL(ORIGIN).host,origin:ORIGIN,
    'sec-fetch-site':'same-origin','content-type':'application/json','x-real-input-capability':CAP},bodyText:JSON.stringify({unitId,requestSha:identity.requestSha})}
  for(const other of ['Q07-03','Q13-06','Q07-05','P07-05']){
    assert.equal((await gateway.handle({...message,bodyText:JSON.stringify({unitId:other,requestSha:identity.requestSha})})).status,400)
  }
  assert.equal(secretReads,0)
  assert.equal((await gateway.handle(message)).status,200)
  assert.equal(secretReads,1);assert.equal(calls,1);assert.equal(reserves,1);assert.equal(records,1)
})

test('credential is not read at gateway initialization or on rejected origins and routes',async()=>{
  const s=await setup();assert.equal(s.secretReads(),0)
  const cases=[m=>{m.headers.origin='https://evil.test'},m=>{m.headers.host='evil.test'},m=>{delete m.headers.origin},
    m=>{m.headers['x-real-input-capability']='bad'},m=>{m.headers['sec-fetch-site']='cross-site'},m=>{m.method='GET'},
    m=>{m.path='/api/deepseek'},m=>{m.headers['content-type']='text/plain'}]
  for(const change of cases){const m=s.message();change(m);assert.ok((await s.gateway.handle(m)).status>=400)}
  assert.equal(s.secretReads(),0);assert.equal(s.calls.length,0);assert.equal((await s.budget.snapshot()).reservations.length,0)
})
test('browser cannot supply a model, endpoint, request body, usage or alternative budget book',async()=>{
  const s=await setup()
  for(const key of ['model','url','body','usage','ledger','secret']){const m=s.message();m.bodyText=JSON.stringify({...JSON.parse(m.bodyText),[key]:'injected'});assert.equal((await s.gateway.handle(m)).status,400)}
  assert.equal(s.secretReads(),0);assert.equal(s.calls.length,0)
})
test('missing credentials do not consume an allowance and are never reflected',async()=>{
  const s=await setup(null,{readSecret:()=>undefined}),r=await s.gateway.handle(s.message())
  assert.equal(r.status,409);assert.equal(s.calls.length,0);assert.equal((await s.budget.snapshot()).reservations.length,0)
})
test('reserved request cannot be duplicated by a second gateway or service restart',async()=>{
  const s=await setup();assert.equal((await s.gateway.handle(s.message())).status,200)
  const budget=await openBudget(s.dir,s.manifestSha),other=await createModelGateway({...s.config,budget})
  assert.equal((await other.handle(s.message())).status,409);assert.equal(s.calls.length,1)
})
test('concurrent browser and runner cannot dispatch the same logical request twice',async()=>{
  let release;const pending=new Promise(resolve=>{release=resolve})
  const s=await setup(async()=>{await pending;return http(raw('A01'))})
  const first=s.gateway.handle(s.message())
  await new Promise(resolve=>setTimeout(resolve,20))
  const second=await s.gateway.handle(s.message());assert.equal(second.status,409)
  release();assert.equal((await first).status,200);assert.equal(s.calls.length,1)
})
for(const [name,upstream] of [
  ['HTTP failure',()=>new Response('private upstream error',{status:500})],
  ['redirect',()=>new Response('',{status:302,headers:{location:'https://evil.test'}})],
  ['wrong content type',()=>new Response(raw('A01'),{headers:{'content-type':'text/html'}})],
  ['response size exceeded',()=>http('a'.repeat(524289))],
  ['credential echo',()=>http(JSON.stringify({error:FAKE_SECRET}))],
  ['usage missing',()=>http('{}')],
  ['model drift',()=>http(raw('A01').replace(BILLING_POLICY.model,'other-model'))],
])test(`${name} stops dispatch, retains the full reserve and returns only a safe code`,async()=>{
  const s=await setup(upstream),r=await s.gateway.handle(s.message())
  assert.equal(r.status,502);assert.deepEqual(r.body,{code:'MODEL_CALL_STOPPED_NO_RETRY'})
  const state=await s.budget.snapshot();assert.equal(state.reservations[0].status,'pending');assert.equal(state.reservations[0].reservedMicroCny,3300000)
  assert.equal(s.calls.length,1);assert.equal((await s.gateway.handle(s.message('A02'))).status,409);assert.equal(s.calls.length,1)
  assert.equal(JSON.stringify(s.recorded).includes(FAKE_SECRET),false)
})
test('timeout aborts once; late completion cannot settle or append a second response',async()=>{
  let finish;const pending=new Promise(resolve=>{finish=resolve})
  const s=await setup(()=>pending,{timeoutMs:20}),r=await s.gateway.handle(s.message())
  assert.equal(r.status,502);assert.equal(s.calls[0].options.signal.aborted,true)
  finish(http(raw('A01')));await new Promise(resolve=>setTimeout(resolve,10))
  assert.equal(s.recorded.length,0);assert.equal((await s.budget.snapshot()).reservations[0].status,'pending')
  assert.equal((await s.gateway.handle(s.message('A02'))).status,409);assert.equal(s.calls.length,1)
})
test('raw-result storage failure cannot release money or silently claim success',async()=>{
  const s=await setup(null,{recordRaw:async()=>{throw Error('disk failure with private text')}})
  assert.equal((await s.gateway.handle(s.message())).status,502)
  assert.equal((await s.budget.snapshot()).reservations[0].status,'pending')
})

for(const [name,fetchOverride,extra,phase,reason,status,uncertainty='PERSISTED',haltCode='TRANSPORT_OR_CRASH_UNKNOWN'] of [
  ['DNS',transportFailure('ENOTFOUND'),{},'CONNECT','DNS_FAILURE',null],
  ['connect timeout',transportFailure('UND_ERR_CONNECT_TIMEOUT'),{},'CONNECT','CONNECT_TIMEOUT',null],
  ['TLS',transportFailure('CERT_HAS_EXPIRED'),{},'CONNECT','TLS_FAILURE',null],
  ['connection reset',transportFailure('ECONNRESET'),{},'CONNECT','CONNECTION_RESET',null],
  ['unknown code',transportFailure(FAKE_SECRET),{},'CONNECT','TRANSPORT_UNKNOWN',null],
  ['HTTP 401',()=>new Response(FAKE_SECRET,{status:401}),{},'RESPONSE_HEADERS','UPSTREAM_HTTP_REJECTED',401],
  ['HTTP 502',()=>new Response(FAKE_SECRET,{status:502}),{},'RESPONSE_HEADERS','UPSTREAM_HTTP_REJECTED',502],
  ['content type',()=>new Response(FAKE_SECRET,{headers:{'content-type':'text/html'}}),{},'RESPONSE_HEADERS','UPSTREAM_PROTOCOL_REJECTED',200],
  ['body timeout',()=>new Response(new ReadableStream({start(c){c.error(Object.assign(new Error(FAKE_SECRET),{code:'UND_ERR_BODY_TIMEOUT'}))}}),{headers:{'content-type':'application/json'}}),{},'RESPONSE_BODY','RESPONSE_BODY_TIMEOUT',200],
  ['oversize',()=>http('x'.repeat(524289)),{},'RESPONSE_BODY','RESPONSE_SIZE_LIMIT',200],
  ['UTF8',()=>http(new Uint8Array([0xff])),{},'RESPONSE_DECODE','RESPONSE_DECODE_FAILED',200],
  ['JSON',()=>http(FAKE_SECRET),{},'RESPONSE_JSON','JSON_INVALID',200],
  ['reflection',()=>http(JSON.stringify({error:FAKE_SECRET})),{},'RESPONSE_SAFETY','CREDENTIAL_REFLECTION_REJECTED',200],
  ['raw store',null,{recordRaw:async()=>{throw Error(FAKE_SECRET)}},'RAW_STORAGE','RAW_STORAGE_FAILED',200],
  ['settlement',()=>http('{}'),{},'SETTLEMENT','SETTLEMENT_REJECTED',200,'FAILED','RESPONSE_OR_USAGE_INVALID'],
])test(`safe diagnostic ${name}: classified without error text and unknown reserve survives reopening`,async()=>{
  const s=await setup(fetchOverride,extra),r=await s.gateway.handle(s.message())
  assert.equal(r.status,502);assert.deepEqual(r.body,{code:'MODEL_CALL_STOPPED_NO_RETRY'})
  assert.deepEqual(r.diagnostic,{version:'real-input-safe-diagnostic-1',unitId:'A01',requestSha:inspectRequest(request()).requestSha,
    phase,reason,upstreamHttpStatus:status,localHttpStatus:502,reservationAcquired:true,uncertaintyAttempt:uncertainty})
  assert.equal(JSON.stringify(r).includes(FAKE_SECRET),false)
  const reopened=await openBudget(s.dir,s.manifestSha),state=await reopened.snapshot()
  assert.equal(state.halted,haltCode);assert.equal(state.reservations[0].status,'pending')
  assert.equal(state.reservations[0].costUpperMicroCny,3300000)
  const next=await createModelGateway({...s.config,budget:reopened})
  const rejected=await next.handle(s.message('A02'))
  assert.equal(rejected.status,409);assert.equal(rejected.diagnostic.reason,'RESERVATION_REJECTED');assert.equal(s.calls.length,1)
})

test('diagnostic normal and missing-configuration controls do not alter raw success or consume a missing-key reservation',async()=>{
  const s=await setup(),r=await s.gateway.handle(s.message())
  assert.equal(r.status,200);assert.equal(r.diagnostic,undefined);assert.equal(r.body.rawHttpText,raw('A01'))
  assert.equal(r.body.costUpperMicroCny,390)
  const missing=await setup(null,{readSecret:()=>undefined}),noKey=await missing.gateway.handle(missing.message())
  assert.equal(noKey.diagnostic.reason,'NOT_CONFIGURED');assert.equal(noKey.diagnostic.phase,'CONFIGURATION')
  assert.equal(noKey.diagnostic.upstreamHttpStatus,null);assert.equal(noKey.diagnostic.uncertaintyAttempt,'NOT_APPLICABLE')
  assert.equal((await missing.budget.snapshot()).reservations.length,0);assert.equal(missing.calls.length,0)
})

test('diagnostic uses descriptors not error getters, and never exports arbitrary error properties',async()=>{
  let reads=0;const hostile=Object.defineProperties({},Object.fromEntries(['code','cause','message','stack'].map(key=>[key,{get(){reads++;throw Error(FAKE_SECRET)}}])))
  const s=await setup(()=>{throw hostile}),r=await s.gateway.handle(s.message())
  assert.equal(reads,0);assert.equal(r.diagnostic.reason,'TRANSPORT_UNKNOWN')
  assert.equal(JSON.stringify(r).includes(FAKE_SECRET),false)
})

test('local deadline diagnostic remains distinct from transport timeout and late headers cannot rewrite it',async()=>{
  let finish;const s=await setup(()=>new Promise(resolve=>{finish=resolve}),{timeoutMs:20})
  const r=await s.gateway.handle(s.message()),before=JSON.stringify(r)
  assert.equal(r.diagnostic.reason,'LOCAL_DEADLINE');assert.equal(r.diagnostic.upstreamHttpStatus,null)
  finish(http(raw('A01')));await new Promise(resolve=>setTimeout(resolve,10))
  assert.equal(JSON.stringify(r),before);assert.equal(s.recorded.length,0)
  assert.equal((await s.budget.snapshot()).reservations[0].status,'pending')
})

test('uncertainty persistence failure is visible without releasing or retrying the reserved call',async()=>{
  const s=await setup(transportFailure('ECONNRESET'))
  const budget={snapshot:()=>s.budget.snapshot(),reserve:async(...args)=>{const lease=await s.budget.reserve(...args);return {...lease,uncertain:async()=>{throw Error(FAKE_SECRET)}}}}
  const gateway=await createModelGateway({...s.config,budget}),r=await gateway.handle(s.message())
  assert.equal(r.diagnostic.uncertaintyAttempt,'FAILED');assert.equal(r.diagnostic.reason,'CONNECTION_RESET')
  assert.equal(JSON.stringify(r).includes(FAKE_SECRET),false)
  assert.equal((await s.budget.snapshot()).reservations[0].status,'pending');assert.equal(s.calls.length,1)
})
test('frozen request object cannot be swapped after gateway creation',async()=>{
  const s=await setup(),message=s.message();s.requests.A01='altered'
  assert.equal((await s.gateway.handle(message)).status,200);assert.equal(s.calls[0].options.body,request())
})
test('unapproved parameters and non-text content fail before any gateway can be created',async()=>{
  for(const change of [b=>{b.tools=[]},b=>{b.reasoning.effort='high'},b=>{b.model='other'},b=>{b.input[1].content[0].type='input_image'},
    b=>{b.stream=true},b=>{b.max_output_tokens=8193},b=>{b.input.push(b.input[0])}]){const body=JSON.parse(request());change(body);assert.throws(()=>inspectRequest(JSON.stringify(body)))}
  const s=await setup(),requests={...s.requests,A01:request().replace('工程协议占位文字','变更后的文字')}
  await assert.rejects(()=>createModelGateway({...s.config,requests}),/REQUEST_BINDING/)
  assert.equal(s.calls.length,0);assert.equal(s.secretReads(),0)
})

const escapedFake=()=>[...FAKE_SECRET].map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join('')
const escapedEnvelope=change=>{const e=JSON.parse(raw('A01'));change(e);return JSON.stringify(e).split(FAKE_SECRET).join(escapedFake())}
for(const [name,responseText] of [
  ['JSON escaped output value',()=>escapedEnvelope(e=>{e.output[0].content[0].text=FAKE_SECRET})],
  ['JSON escaped object key',()=>escapedEnvelope(e=>{e[FAKE_SECRET]='not a secret value'})],
  ['nested model JSON value',()=>{const e=JSON.parse(raw('A01'));e.output[0].content[0].text=JSON.stringify({note:FAKE_SECRET}).replace(FAKE_SECRET,escapedFake());return JSON.stringify(e)}],
  ['nested model JSON key',()=>{const e=JSON.parse(raw('A01'));e.output[0].content[0].text=JSON.stringify({[FAKE_SECRET]:0}).replace(FAKE_SECRET,escapedFake());return JSON.stringify(e)}],
  ['twice nested model JSON',()=>{const e=JSON.parse(raw('A01'));e.output[0].content[0].text=JSON.stringify({embedded:JSON.stringify({note:FAKE_SECRET}).replace(FAKE_SECRET,escapedFake())});return JSON.stringify(e)}],
  ['discarded duplicate JSON property',()=>'{"discarded":"'+escapedFake()+'","discarded":null,'+raw('A01').slice(1)],
])test(`${name} cannot reach recording, response or settlement`,async()=>{
  const s=await setup(()=>http(responseText())),path=join(s.dir,'rejected-raw.jsonl'),recorder=await createRawRecorder(path)
  let writes=0
  try {
    const gateway=await createModelGateway({...s.config,recordRaw:async value=>{writes++;await recorder.write(value)}})
    const r=await gateway.handle(s.message())
    assert.equal(r.status,502);assert.deepEqual(r.body,{code:'MODEL_CALL_STOPPED_NO_RETRY'})
    assert.equal(writes,0);assert.equal(await readFile(path,'utf8'),'')
    const state=await s.budget.snapshot();assert.equal(state.reservations[0].status,'pending')
    assert.equal(state.reservations[0].reservedMicroCny,3300000)
    assert.equal((await gateway.handle(s.message('A02'))).status,409);assert.equal(s.calls.length,1)
    const restarted=await openBudget(s.dir,s.manifestSha)
    assert.equal((await restarted.snapshot()).reservations[0].status,'pending')
  } finally {await recorder.close()}
})
test('normal escaped Chinese and nested JSON retain exact raw bytes and can be recorded and settled',async()=>{
  const e=JSON.parse(raw('A01'));e.output[0].content[0].text=JSON.stringify({note:'请核对“日期”与路径 C:\\临时',metadata:JSON.stringify({text:'普通材料'})})
  const expected=JSON.stringify(e).replace('请','\\u8bf7'),s=await setup(()=>http(expected)),path=join(s.dir,'valid-raw.jsonl'),recorder=await createRawRecorder(path)
  try {
    const gateway=await createModelGateway({...s.config,recordRaw:value=>recorder.write(value)})
    const r=await gateway.handle(s.message());assert.equal(r.status,200);assert.equal(r.body.rawHttpText,expected)
    const disk=JSON.parse(await readFile(path,'utf8'));assert.equal(disk.rawHttpText,expected)
    assert.equal(disk.responseSha,sha256(expected));assert.equal((await s.budget.snapshot()).reservations[0].status,'settled')
  } finally {await recorder.close()}
})
