import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {createScopedHost} from './scoped-execution-host.mjs'
import {createSafePhaseJournal} from './scoped-execution-diagnostics.mjs'
import {createBoundaryJournal,withTransportBoundaryDiagnostics,createBoundaryPinnedProxyFetch,BOUNDARY_VERSION} from './scoped-transport-boundary-diagnostics.mjs'
import {EventEmitter} from 'node:events'
import {Readable} from 'node:stream'

const sha=v=>createHash('sha256').update(v).digest('hex')
const json=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n')
// The real durable host/core, but only a tmp ledger and fake transport. No env,
// authoritative ledger, old execution directory, credentials or network access.
function fixture({fault,decorate=x=>x,noAuth=false}={}){
 const root=mkdtempSync(join(tmpdir(),'transport-boundary-offline-')),ledgerPath=join(root,'ledger.jsonl')
 const scope={batch:'OFFLINE-BOUNDARY-ONLY',count:1,snapshot:'b'.repeat(40)}
 const seed={sequence:0,previous:'0'.repeat(64),event:{kind:'OFFLINE_TEST_ONLY'}};seed.hash=sha(JSON.stringify(seed));writeFileSync(ledgerPath,JSON.stringify(seed)+'\n')
 const before=readFileSync(ledgerPath),binding={manifestSha256:'d'.repeat(64),identitiesSha256:'e'.repeat(64)}
 const body={model:'deepseek-flash',temperature:0,reasoning:{effort:'none'},stream:false,max_output_tokens:8192,input:[{role:'user',content:'PRIVATE_ANONYMOUS_BODY'}]}
 const units=[{ordinal:1,unitIdentitySha256:sha('offline'),requestSha256:sha(JSON.stringify(body)),body}]
 const pricing={sourceUrl:'https://api-docs.deepseek.com/quick_start/pricing/',verifiedAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),peakInputUsdPerMillion:.3,peakOutputUsdPerMillion:1.2,maxInputTokens:1048576,model:'deepseek-flash',endpoint:'https://api.deepseek.com/responses',maxOutputTokens:8192,tokenBoundMethod:'FULL_OFFICIAL_CONTEXT_UPPER_BOUND',reasoningMetering:'INCLUDED_IN_OUTPUT_TOKENS',additionalChargeUpperMicroUsd:0}
 writeFileSync(join(root,'USER_AUTHORIZATION.txt'),'OFFLINE SYNTHETIC CONSENT NOT AUTHORIZATION')
 json(join(root,'PRICE_EVIDENCE.json'),{role:'SYNTHETIC_OFFLINE_PRICE_NOT_OBSERVED',pricing})
 const auth={authorized:true,authorizationSource:'CURRENT_USER_MESSAGE',userMessageSha256:sha(readFileSync(join(root,'USER_AUTHORIZATION.txt'))),batch:scope.batch,count:1,model:'deepseek-flash',...binding,hardLimitMicroUsd:400000,grantId:'OFFLINE_FAKE_BOUNDARY_GRANT',committedHead:'a'.repeat(40),endpoint:pricing.endpoint,retry:0,repair:0,verifier:0,pricing,hostVersion:'scoped-execution-host-2',snapshotCommit:scope.snapshot,ledgerBaselineRows:1,ledgerBaselineBytes:before.length,ledgerBaselineSha256:sha(before),priceEvidenceSha256:sha(readFileSync(join(root,'PRICE_EVIDENCE.json'))),units:units.map(u=>u.unitIdentitySha256),requestSha256s:units.map(u=>u.requestSha256)}
 if(!noAuth)json(join(root,'AUTHORIZATION.json'),auth)
 let gitChecks=0,adapterCalls=0,postCalls=0,armed=false
 const bad=()=>{throw Error('PRIVATE_GIT_STDERR_BEARER_RESPONSE_STACK')}
 const options={root,ledgerPath,engine:createScopedEngine(scope,{diagnostics:createSafePhaseJournal(join(root,'v1'))}),role:'OFFLINE_ANONYMOUS_FAKE_TRANSPORT',packageRead:()=>({units,binding}),
  gitCheck:()=>{gitChecks++;if(armed&&fault==='git'&&gitChecks===6)bad()},
  append:async({after})=>writeFileSync(ledgerPath,after),
  fault:async stage=>{if(armed&&stage===fault)bad()},
  transport:{sendOnce:async(_body,_unit,_auth,observation)=>{
   adapterCalls++;if(fault==='configuration')bad()
   observation?.boundarySync?.('POST_REQUEST_API_ENTER');postCalls++;if(fault==='post')bad()
   observation?.boundarySync?.('POST_REQUEST_CREATED');observation?.boundarySync?.('POST_BODY_END_ENTER')
   await observation?.mark('HTTP_HEADERS_RECEIVED');if(fault==='body')bad()
   await observation?.mark('RESPONSE_BODY_RECEIVED')
   return {status:200,text:JSON.stringify({usage:{input_tokens:10,output_tokens:5},private:'PRIVATE_RESPONSE'})}
  }}}
 const host=createScopedHost(scope,decorate(options,root))
 return {host,root,ledgerPath,auth,save:()=>json(join(root,'AUTHORIZATION.json'),auth),arm:()=>{armed=true},counts:()=>({gitChecks,adapterCalls,postCalls}),rows:()=>readFileSync(join(root,'v1','01.jsonl'),'utf8').trim().split('\n').map(JSON.parse)}
}

test('original journal cannot distinguish last local Git failure from upstream POST failure',async()=>{
 const observations=[]
 for(const fault of ['git','post']){
  const x=fixture({fault});await x.host.prepareAuthorized();x.arm()
  await assert.rejects(x.host.dispatchNext(),/SAFETY_STOP_UNCERTAIN/)
  const last=x.rows().at(-1);observations.push([last.failedPhase,last.code])
  assert.equal(x.counts().postCalls,fault==='git'?0:1)
  assert.equal((await x.host.resumeReadOnly()).state.units[0].status,'UNCERTAIN')
  assert.ok(existsSync(join(x.root,'lock'))&&existsSync(join(x.root,'HALT.json')))
  const calls=x.counts().postCalls;await assert.rejects(x.host.dispatchNext());assert.equal(x.counts().postCalls,calls)
 }
 assert.deepEqual(observations,[['TRANSPORT_ENTER','OTHER_FAILURE'],['TRANSPORT_ENTER','OTHER_FAILURE']])
 // This proves an observation ambiguity, not what happened in a historical run.
})

const observed=(options,root)=>withTransportBoundaryDiagnostics(options,createBoundaryJournal(join(root,'boundary')))
const boundaryRows=x=>readFileSync(join(x.root,'boundary','01.jsonl'),'utf8').trim().split('\n').map(JSON.parse)

test('opt-in observation distinguishes final local checks, adapter preparation, POST and response without changing safety',async()=>{
 for(const [fault,phase,code,calls,corePhase] of [
  ['git','GIT_CHECK_ENTER','GIT_CHECK_FAILED',0,'TRANSPORT_ENTER'],
  ['before_send','PRE_ADAPTER_CHECK_ENTER','PRE_ADAPTER_CHECK_FAILED',0,'TRANSPORT_ENTER'],
  ['configuration','ADAPTER_ENTER','ADAPTER_OR_NETWORK_FAILED',0,'TRANSPORT_ENTER'],
  ['post','POST_REQUEST_API_ENTER','ADAPTER_OR_NETWORK_FAILED',1,'TRANSPORT_ENTER'],
  ['body','HTTP_HEADERS_RECEIVED','ADAPTER_OR_NETWORK_FAILED',1,'HTTP_HEADERS_RECEIVED'],
  ['before_raw','ADAPTER_RETURNED','HOST_OR_STORAGE_FAILED',1,'RAW_WRITE_ENTER'],
  ['before_scopedSettle','ADAPTER_RETURNED','HOST_OR_STORAGE_FAILED',1,'SETTLE_ENTER']]){
  const x=fixture({fault,decorate:observed});await x.host.prepareAuthorized();x.arm()
  await assert.rejects(x.host.dispatchNext(),/SAFETY_STOP_UNCERTAIN/)
  const last=boundaryRows(x).at(-1);assert.equal(last.failedPhase,phase);assert.equal(last.code,code)
  assert.equal(x.rows().at(-1).failedPhase,corePhase);assert.equal(x.counts().postCalls,calls)
  assert.equal((await x.host.resumeReadOnly()).state.units[0].status,'UNCERTAIN')
  const counts=x.counts();await assert.rejects(x.host.dispatchNext())
  assert.equal(x.counts().postCalls,counts.postCalls);assert.equal(x.counts().adapterCalls,counts.adapterCalls)
  assert.ok(existsSync(join(x.root,'lock'))&&existsSync(join(x.root,'HALT.json')))
  assert.doesNotMatch(JSON.stringify(boundaryRows(x)),/PRIVATE_|Bearer|stderr|headers|stack/)
 }
})

test('successful real host settles once and read-only operation does not append observations',async()=>{
 const x=fixture({decorate:observed});await x.host.prepareAuthorized();x.arm()
 assert.equal((await x.host.dispatchNext()).status,'SETTLED')
 const log=readFileSync(join(x.root,'boundary','01.jsonl'))
 assert.equal((await x.host.resumeReadOnly()).audit,'CONSISTENT')
 assert.equal((await x.host.dispatchNext()).status,'COMPLETE')
 assert.deepEqual(readFileSync(join(x.root,'boundary','01.jsonl')),log)
 assert.equal(x.counts().postCalls,1)
 assert.ok(boundaryRows(x).every(row=>row.version===BOUNDARY_VERSION&&Object.keys(row).length===9))
})

test('missing consent or fresh gate rejection still writes no grant/reserve/observation and sends nothing',async()=>{
 for(const mode of ['missing','low-cap','expired','wrong-identity']){
  const x=fixture({decorate:observed,noAuth:mode==='missing'}),before=readFileSync(x.ledgerPath)
  if(mode==='low-cap')x.auth.hardLimitMicroUsd=1
  if(mode==='expired')x.auth.pricing.validUntil=new Date(0).toISOString()
  if(mode==='wrong-identity')x.auth.units[0]='f'.repeat(64)
  if(mode!=='missing')x.save()
  await assert.rejects(x.host.prepareAuthorized())
  assert.deepEqual(readFileSync(x.ledgerPath),before);assert.equal(x.counts().postCalls,0)
  assert.equal(existsSync(join(x.root,'boundary')),false)
 }
})

test('observation failure before adapter or before POST API halts without letting the operation continue',async()=>{
 for(const phase of ['HOST_REVALIDATION_ENTER','ADAPTER_ENTER','POST_REQUEST_API_ENTER']){
  const x=fixture({decorate:(options,root)=>{
   const journal=createBoundaryJournal(join(root,'boundary'))
   return withTransportBoundaryDiagnostics(options,{recordSync(row){if(row.phase===phase)throw Error('BOUNDARY_OBSERVATION_IO');journal.recordSync(row)}})
  }})
  await x.host.prepareAuthorized();x.arm();await assert.rejects(x.host.dispatchNext())
  assert.equal(x.counts().postCalls,0)
  assert.equal((await x.host.resumeReadOnly()).state.units[0].status,'UNCERTAIN')
  const before=x.counts();await assert.rejects(x.host.dispatchNext())
  assert.equal(x.counts().postCalls,before.postCalls);assert.equal(x.counts().adapterCalls,before.adapterCalls)
 }
})

test('new journal refuses old-version files and strips arbitrary diagnostic fields',async()=>{
 const root=mkdtempSync(join(tmpdir(),'boundary-journal-offline-')),journal=createBoundaryJournal(root)
 const row={ordinal:1,unitIdentitySha256:'a'.repeat(64),requestSha256:'b'.repeat(64),phase:'ADAPTER_ENTER',error:{message:'PRIVATE_CONTENT'},body:'PRIVATE_BODY'}
 journal.recordSync(row);assert.doesNotMatch(readFileSync(join(root,'01.jsonl'),'utf8'),/PRIVATE_/)
 const good=readFileSync(join(root,'01.jsonl'))
 assert.throws(()=>journal.recordSync({...row,unitIdentitySha256:'c'.repeat(64)}),/OBSERVATION_IO/)
 assert.deepEqual(readFileSync(join(root,'01.jsonl')),good)
 const file=join(root,'01.jsonl');writeFileSync(file,'{"version":"scoped-safe-phase-diagnostic-1"}\n');const original=readFileSync(file)
 assert.throws(()=>journal.recordSync(row),/OBSERVATION_IO/);assert.deepEqual(readFileSync(file),original)
})

function fakePinnedRoute({authorized=true,proxyStatus=200,faultPhase}={}){
 const counts={proxy:0,tls:0,posts:0,bodies:0},rows=[]
 const socket=()=>Object.assign(new EventEmitter(),{destroy(){}})
 const deps={
  proxyRequest(){counts.proxy++;const req=socket();req.end=()=>queueMicrotask(()=>req.emit('connect',{statusCode:proxyStatus},socket(),Buffer.alloc(0)));return req},
  secureConnect(){counts.tls++;const s=Object.assign(socket(),{authorized});queueMicrotask(()=>s.emit('secureConnect'));return s},
  Agent:class{destroy(){}},
  upstreamRequest(_url,_options,callback){counts.posts++;const req=socket();req.end=()=>{counts.bodies++;const r=Readable.from([Buffer.from('anonymous')]);r.statusCode=200;r.headers={};queueMicrotask(()=>callback(r))};return req}}
 const fetch=createBoundaryPinnedProxyFetch({boundarySync(phase){if(phase===faultPhase)throw Error('BOUNDARY_OBSERVATION_IO');rows.push(phase)}},deps)
 const options={method:'POST',redirect:'manual',headers:{Authorization:'Bearer OFFLINE_NOT_A_REAL_CREDENTIAL','Content-Type':'application/json'},body:'anonymous',signal:new AbortController().signal}
 return {fetch,options,counts,rows}
}

test('exact pinned API observation retains verified TLS, once-only transport and no delivery claim',async()=>{
 const x=fakePinnedRoute();const response=await x.fetch('https://api.deepseek.com/responses',x.options)
 assert.equal(await response.text(),'anonymous')
 assert.deepEqual(x.rows,['PROXY_CONNECT_API_ENTER','TLS_API_ENTER','POST_REQUEST_API_ENTER','POST_REQUEST_CREATED','POST_BODY_END_ENTER'])
 assert.deepEqual(x.counts,{proxy:1,tls:1,posts:1,bodies:1})
 await assert.rejects(x.fetch('https://api.deepseek.com/responses',x.options),/CONSUMED/)
 for(const params of [{authorized:false},{proxyStatus:407}]){
  const y=fakePinnedRoute(params);await assert.rejects(y.fetch('https://api.deepseek.com/responses',y.options),/FAILED/)
  assert.equal(y.counts.posts,0);assert.equal(y.counts.bodies,0)
 }
})

test('journal failures inside CONNECT/TLS event callbacks reject and destroy rather than escape or issue a POST',async()=>{
 for(const [phase,posts] of [['TLS_API_ENTER',0],['POST_REQUEST_API_ENTER',0],['POST_REQUEST_CREATED',1],['POST_BODY_END_ENTER',1]]){
  const x=fakePinnedRoute({faultPhase:phase})
  await assert.rejects(x.fetch('https://api.deepseek.com/responses',x.options),/FAILED/)
  assert.equal(x.counts.posts,posts);assert.equal(x.counts.bodies,0)
 }
})
