import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {build} from 'esbuild'
import {auditFrozenD11,dispatchNext,UNIT_RESERVE_MICRO_USD,assertD11Identity,assertD11NextState,sealD11Uncertain} from './run-candidate15-d11.mjs'
import {referencesValid} from './score-candidate15-d11.mjs'
import {scoreCandidate15} from './score-candidate15-contract.mjs'

test('the frozen D10 identities and conservative USD cap are intact',()=>{
  const audit=auditFrozenD11()
  assert.equal(audit.status,'PASS')
  assert.equal(audit.requests,24)
  assert.deepEqual(audit.arms,{A:12,B:12})
  assert.equal(UNIT_RESERVE_MICRO_USD,324404)
  assert.equal(audit.batchWorstMicroUsd,7785696)
  assert.ok(audit.batchWorstMicroUsd<=audit.hardLimitMicroUsd)
})

test('a frozen package is never itself a dispatch grant',async()=>{
  await assert.rejects(dispatchNext(),{code:'ENOENT'})
})

test('identity drift is blocked before a request can be sent',()=>{
  const row=JSON.parse(readFileSync('docs/recognition-optimization/candidate15/d10-development/PREPARED_REQUEST_IDENTITIES.json')).requests[0]
  const bound={ordinal:row.ordinal,unitIdentitySha256:row.unitIdentitySha256,requestSha256:row.requestSha256}
  assert.equal(assertD11Identity(row,bound),true)
  assert.throws(()=>assertD11Identity({...row,unitIdentitySha256:'0'.repeat(64)},bound),/D11_IDENTITY_DRIFT/)
  assert.throws(()=>assertD11Identity({...row,body:{...row.body,temperature:1}},bound),/D11_IDENTITY_DRIFT/)
})

test('duplicate, pending, and uncertain sends are all blocked',()=>{
  const fresh=Array.from({length:24},(_,i)=>({ordinal:i+1,status:'NOT_SENT'}))
  assert.equal(assertD11NextState(fresh,1,1),true)
  assert.throws(()=>assertD11NextState(fresh,1,2),/D11_LEDGER_ORDER/)
  for(const status of ['RESERVED','SENDING','RAW_SAVED','UNCERTAIN','SETTLED']){
    const units=structuredClone(fresh);units[0].status=status
    assert.throws(()=>assertD11NextState(units,1,1),/D11_DUPLICATE_OR_UNCERTAIN/)
  }
  const resumed=structuredClone(fresh);resumed[0].status='SETTLED'
  assert.equal(assertD11NextState(resumed,2,3),true)
  resumed[0].status='UNCERTAIN'
  assert.throws(()=>assertD11NextState(resumed,2,3),/D11_DUPLICATE_OR_UNCERTAIN/)
})

test('transport, raw storage, usage and settlement failures seal the unit before any resend',()=>{
  for(const [reason,status] of [['SEND_OR_TRANSPORT','SENDING'],['RAW_STORAGE','SENDING'],['HTTP_OR_PROTOCOL','RAW_SAVED'],['USAGE','RAW_SAVED'],['SETTLEMENT','RAW_SAVED']]){
    const state={units:Array.from({length:24},(_,i)=>({ordinal:i+1,status:i===0?status:'NOT_SENT'}))}
    let persisted=false
    sealD11Uncertain(state,1,reason,()=>{persisted=true})
    assert.equal(persisted,true)
    assert.equal(state.units[0].status,'UNCERTAIN')
    assert.equal(state.units[0].haltReason,reason)
    assert.throws(()=>assertD11NextState(state.units,1,1),/D11_DUPLICATE_OR_UNCERTAIN/)
  }
})

test('the real common adapter and frozen v6 scorer accept a D9 legal oracle',async()=>{
  const source=JSON.parse(readFileSync('docs/recognition-optimization/candidate15/d8-development/SOURCES.json')).sources[0]
  const reference=JSON.parse(readFileSync('docs/recognition-optimization/candidate15/d9-development/REFERENCES.json')).references[0].reference
  const wire=JSON.parse(readFileSync('docs/recognition-optimization/candidate15/d9-development/LEGAL_WIRE_ORACLES.json')).oracles[0].wire
  const output=await build({stdin:{contents:"export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';export {adaptCandidate14CommonWire} from './src/experiments/candidate14/commonAdapter.ts';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
  const api=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].contents).toString('base64'))
  const context={index:await api.indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText),referenceTime:source.referenceTime,timezone:source.timezone}
  const adapted=api.adaptCandidate14CommonWire(wire,context).adapted
  assert.equal(referencesValid(adapted,context.index),true)
  assert.equal(scoreCandidate15(reference,adapted).complete,true)
})
