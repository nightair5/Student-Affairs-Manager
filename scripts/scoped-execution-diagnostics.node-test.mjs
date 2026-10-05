import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {createSafePhaseJournal,classifyPhaseError,PHASE_DIAGNOSTIC_VERSION} from './scoped-execution-diagnostics.mjs'
const sha=v=>createHash('sha256').update(v).digest('hex')
function fixture(fault){
 const dir=mkdtempSync(join(tmpdir(),'safe-phase-offline-')),journal=createSafePhaseJournal(dir)
 const scope={batch:'OFFLINE-PHASE-OBSERVATION',count:1},binding={manifestSha256:'a'.repeat(64),identitiesSha256:'b'.repeat(64)}
 const body={model:'deepseek-flash',temperature:0,reasoning:{effort:'none'},stream:false,max_output_tokens:8192,input:[{role:'user',content:'UNTRUSTED_BODY_MUST_NOT_BE_LOGGED'}]}
 const unit={ordinal:1,unitIdentitySha256:sha('anonymous'),requestSha256:sha(JSON.stringify(body)),body},units=[unit]
 const diagnostics={record:async row=>{if(row.phase===fault)throw Error('SAFE_PHASE_DIAGNOSTIC_IO');return journal.record(row)}}
 const engine=createScopedEngine(scope,{diagnostics}),state=engine.newState(units,binding)
 const auth={authorized:true,authorizationSource:'CURRENT_USER_MESSAGE',userMessageSha256:'c'.repeat(64),batch:scope.batch,count:1,model:'deepseek-flash',...binding,
   hardLimitMicroUsd:400000,grantId:'OFFLINE_FAKE_NOT_A_REAL_GRANT',committedHead:'d'.repeat(40),endpoint:'https://api.deepseek.com/responses',retry:0,repair:0,verifier:0,
   units:units.map(u=>u.unitIdentitySha256),requestSha256s:units.map(u=>u.requestSha256),
   pricing:{sourceUrl:'https://api-docs.deepseek.com/quick_start/pricing/',verifiedAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),peakInputUsdPerMillion:.3,peakOutputUsdPerMillion:1.2,maxInputTokens:1048576}}
 let sends=0,reserves=0,settles=0,raws=0
 const bad=()=>{const e=Error('DO_NOT_LOG_SECRET_RESPONSE_OR_STACK');e.code='EIO';throw e}
 const options={state,auth,units,binding,lock:async f=>f(),preflight:async()=>{},
   persist:async s=>{if(fault==='persist_'+s.units[0].status)bad()},
   ledger:{reserve:async()=>{reserves++;if(fault==='reserve')bad()},settle:async()=>{settles++;if(fault==='settle')bad()}},
   rawStore:{writeOnce:async()=>{raws++;if(fault==='raw')bad()}},
   transport:{sendOnce:async(_body,_unit,observation)=>{sends++;if(fault==='transport')bad();await observation.mark('HTTP_HEADERS_RECEIVED');if(fault==='body')bad();await observation.mark('RESPONSE_BODY_RECEIVED');return {status:200,text:JSON.stringify({usage:{input_tokens:10,output_tokens:5},private:'DO_NOT_LOG_RESPONSE'})}}}}
 return {engine,options,state,counts:()=>({sends,reserves,settles,raws}),rows:()=>readFileSync(join(dir,'01.jsonl'),'utf8').trim().split('\n').map(JSON.parse)}
}
test('offline phase observations distinguish persistence, transport, headers, body, raw and settlement',async()=>{
 for(const [fault,phase,sends]of [['persist_SENDING','SENDING_STATE_WRITE_ENTER',0],['transport','TRANSPORT_ENTER',1],['body','HTTP_HEADERS_RECEIVED',1],['raw','RAW_WRITE_ENTER',1],['persist_RAW_SAVED','RAW_STATE_WRITE_ENTER',1],['settle','SETTLE_ENTER',1],['persist_SETTLED','SETTLED_STATE_WRITE_ENTER',1]]){
  const x=fixture(fault);await assert.rejects(x.engine.runOne(x.options),/D26_SAFETY_STOP_UNCERTAIN/u)
  assert.equal(x.state.units[0].status,'UNCERTAIN');assert.equal(x.counts().sends,sends)
  const rows=x.rows(),last=rows.at(-1);assert.equal(last.phase,'STOP_UNCERTAIN');assert.equal(last.failedPhase,phase);assert.equal(last.code,'IO_FAILURE')
  await assert.rejects(x.engine.runOne(x.options));assert.equal(x.counts().sends,sends)
  assert.doesNotMatch(JSON.stringify(rows),/UNTRUSTED_BODY|DO_NOT_LOG|Bearer|private|stack/u)
 }
})
test('observation failure before send or after raw/settle stops without repeating completed effects',async()=>{
 for(const [phase,sends,raws,settles]of [['TRANSPORT_ENTER',0,0,0],['RAW_WRITE_COMPLETED',1,1,0],['SETTLE_COMPLETED',1,1,1]]){
  const x=fixture(phase);await assert.rejects(x.engine.runOne(x.options));assert.equal(x.counts().sends,sends)
  assert.equal(x.counts().raws,raws);assert.equal(x.counts().settles,settles)
  assert.equal(x.state.units[0].status,'UNCERTAIN');assert.equal(x.rows().at(-1).code,'DIAGNOSTIC_IO_FAILURE')
  await assert.rejects(x.engine.runOne(x.options));assert.deepEqual(x.counts(),{sends,reserves:1,settles,raws})
 }
})
test('completed observation is bounded metadata, not model, billing or new authorization evidence',async()=>{
 const x=fixture();await x.engine.runOne(x.options);const rows=x.rows()
 assert.equal(rows.at(-1).phase,'SETTLED_STATE_WRITE_COMPLETED');assert.equal(x.counts().sends,1)
 assert.ok(rows.every(r=>r.version===PHASE_DIAGNOSTIC_VERSION&&Object.keys(r).length===9))
 assert.equal(classifyPhaseError({code:'SECRET_VALUE',message:'PRIVATE_BODY',cause:{message:'OTHER_SECRET'}}),'OTHER_FAILURE')
 const j=createSafePhaseJournal(mkdtempSync(join(tmpdir(),'phase-reject-')))
 await assert.rejects(j.record({ordinal:1,unitIdentitySha256:'x',requestSha256:'y',phase:'PRIVATE_LOG'}))
})
