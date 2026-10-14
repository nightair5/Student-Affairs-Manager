import {test} from 'node:test'
import assert from 'node:assert/strict'
import {buildD13Package,validateD13Requests,guardD13Unit,selectD13Development} from './prepare-candidate16-d13.mjs'
const pack=await buildD13Package(),prepared=pack.PREPARED_REQUEST_IDENTITIES??pack['PREPARED_REQUEST_IDENTITIES.json']
test('24 unique not-authorized requests; only the candidate component differs',()=>assert.deepEqual(validateD13Requests(prepared),{requests:24,AB:6,BA:6}))
test('identity drift, duplicate and unauthorized dispatch are refused',()=>{
  const changed=structuredClone(prepared.requests[0]);changed.body.temperature=1
  assert.throws(()=>guardD13Unit(prepared,changed),/IDENTITY_DRIFT/)
  const duplicate=structuredClone(prepared);duplicate.requests[1]=duplicate.requests[0];assert.throws(()=>validateD13Requests(duplicate),/STATE_OR_DUPLICATE/)
  assert.throws(()=>guardD13Unit(prepared,prepared.requests[0]),/DISPATCH_NOT_AUTHORIZED/)
})
test('already attempted, reserved or uncertain dispatch cannot be retried',()=>{
  for(const status of ['RESERVED','SENDING','SENT','UNKNOWN','RAW_SAVED','SETTLED','FAILED'])assert.throws(()=>guardD13Unit(prepared,prepared.requests[0],{status}),/ALREADY_RUN_OR_UNCERTAIN/)
})
test('same rules cover 24 historical results; diagnosis never claims Candidate16 evaluation',()=>{
  const d=pack['POSTHOC_DIAGNOSTIC.json'];assert.equal(d.cases.length,24);assert.equal(d.originalDecisionChanged,false);assert.equal(d.candidate16ModelResult,'NOT_RUN')
  assert.equal(d.arms.Candidate03.denominator,12);assert.equal(d.arms.Candidate15.denominator,12)
})
test('new selection reports improvement and risk separately, with no production decision',()=>{
  const score=complete=>({status:'SCORED',complete,currentTaskRisk:{fn:0,unsupportedActionable:0},severity:{severe:0,forbidden:0,keyMajor:0}})
  const rows=Array.from({length:12},(_,i)=>['A','B'].map(arm=>({sourceId:'s'+i,arm,determinate:true,score:score(arm==='B'&&i===0)}))).flat()
  assert.equal(selectD13Development(rows),'DEVELOPMENT_IMPROVEMENT_OBSERVED')
  rows[1].score.currentTaskRisk.fn=1;assert.equal(selectD13Development(rows),'MIXED_PROGRESS_RISK_REGRESSION')
  rows[1].determinate=false;assert.equal(selectD13Development(rows),'INCOMPLETE_NO_SELECTION')
})
