import test from 'node:test'
import assert from 'node:assert/strict'
import {diagnoseD19} from './d19-offline-diagnostic.mjs'
import {comparePairV8} from './recognition-selector-v8.mjs'

test('selector uses matched obligations, not expected IDs for empty matches',()=>{
  const a={completeStatus:false,matchedObligations:['T1'],risks:[]},b={completeStatus:false,matchedObligations:[],risks:[]}
  assert.deepEqual(comparePairV8(a,b).lostObligations,['T1'])
  assert.equal(comparePairV8({...a,matchedObligations:[]},b).status,'TIE')
  assert.equal(comparePairV8(a,{...b,completeStatus:'UNKNOWN'}).status,'UNKNOWN')
})

test('posthoc diagnosis retains all historical denominators and separates risks from disputed representation',async()=>{
  const result=await diagnoseD19()
  assert.equal(result.d17.cases.length,24)
  assert.equal(result.d15.raw.length,24)
  assert.equal(result.oldD17.candidate03Complete,1)
  assert.equal(result.oldD17.candidate17Complete,2)
  const caseOf=(id,arm)=>result.d17.cases.find(row=>row.sourceId.endsWith(id)&&row.arm===arm).diagnostic
  assert.equal(caseOf('S10','B').relationFactsPass,true)
  assert.ok(caseOf('S10','B').disputes.some(row=>row.kind==='REVISION_EVIDENCE_NOT_ADJUDICATED'))
  assert.ok(caseOf('S05','B').risks.some(row=>row.kind==='TIME_GRAPH_CONFLICT'))
  assert.ok(caseOf('S06','B').risks.some(row=>row.field==='condition'))
  assert.ok(caseOf('S09','B').risks.some(row=>row.kind==='INDEPENDENT_INFORMATION_EVENT_OR_TIME_MISSING'))
  assert.equal(result.d17.pairs.find(row=>row.sourceId.endsWith('S04')).comparison.lostObligations.length,0)
})
