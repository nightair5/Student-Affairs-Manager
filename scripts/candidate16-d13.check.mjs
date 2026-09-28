import {test} from 'node:test'
import assert from 'node:assert/strict'
import {makeD13References} from './candidate16-d13-reference.mjs'
import {scoreSemanticV7,scopeSupport} from './recognition-semantic-v7.mjs'
import {d13Oracles,d13Components,readJson} from './candidate16-d13-support.mjs'
import {loadD11DiagnosticInputs} from './diagnose-recognition-d12.mjs'

const references=makeD13References(), oracles=await d13Oracles(), x=await d13Components()
const score=(n,result=oracles[n].result,ref=references[n])=>scoreSemanticV7(ref,result)
test('all 12 sources have reachable complete references through actual wire schema and shared adapter',()=>{
  for(let n=0;n<12;n++)assert.equal(score(n).complete,true,JSON.stringify({n,score:score(n)}))
})
test('each source has a decisive negative and order invariance',()=>{
  for(let n=0;n<12;n++){
    const reordered=structuredClone(oracles[n].result);for(const k of ['tasks','materials','timePoints','events','revisions'])reordered[k].reverse()
    assert.equal(score(n,reordered).complete,true,'order '+n)
    const bad=structuredClone(oracles[n].result)
    if(n===3)bad.informationScopeIds=[]
    else if(n===8)bad.timePoints[0].normalizedValue='2099-01-01T00:00'
    else if(bad.revisions.length)bad.revisions[0].effective='unknown'
    else bad.tasks[0].detail.completionCriteria=['unsupported completion']
    assert.equal(score(n,bad).complete,false,'negative '+n)
  }
})
test('false condition may be absent or a non-actionable fact; unknown cannot disappear',()=>{
  const old=readJson('docs/recognition-optimization/candidate15/d9-development/LEGAL_WIRE_ORACLES.json').oracles[3].wire
  const value=x.adaptCandidate14CommonWire(old,oracles[3].context).adapted
  assert.equal(score(3,value).complete,true)
  value.tasks[0].condition.value='true';value.tasks[0].semantics.modality='required'
  assert.equal(score(3,value).complete,false);assert.equal(score(3,value).severity.forbidden,1)
  const unknown=structuredClone(oracles[4].result);unknown.tasks=[]
  assert.equal(score(4,unknown).taskPresence.fn,1)
})
test('empty matches, duplicates and wrong object give conserved presence counts, not scorer exceptions',()=>{
  for(const mutate of [r=>{r.tasks=[]},r=>{r.tasks.push({...structuredClone(r.tasks[0]),id:'duplicate'})},r=>{r.tasks[0].object.surface='other'}]){
    const r=structuredClone(oracles[0].result);mutate(r);const s=score(0,r)
    assert.equal(s.status,'SCORED');assert.equal(s.taskPresence.tp+s.taskPresence.fn,s.taskPresence.expected);assert.equal(s.taskPresence.tp+s.taskPresence.fp,s.taskPresence.actual);assert.equal(s.complete,false)
  }
})
test('field error does not masquerade as task absence; absent dependency is a risk',()=>{
  const r=structuredClone(oracles[0].result);r.timePoints[0].normalizedValue='2099-01-01T00:00'
  const s=score(0,r);assert.equal(s.taskPresence.tp,1);assert.equal(s.fullyCorrectTasks,0);assert.ok(s.severity.severe)
  const dep=structuredClone(oracles[5].result);dep.tasks[1].detail.dependencyTempIds=[];assert.equal(score(5,dep).complete,false)
})
test('related supplementary scopes are optional, arbitrary or contradictory supersets fail',()=>{
  const policy=references[0].representations[0].tasks[0].evidencePolicy.proposition
  assert.equal(scopeSupport(policy,[...new Set(policy.requiredAnyOf.flat())]).pass,true)
  assert.equal(scopeSupport(policy,[...policy.allowed,'unrelated']).pass,false)
  assert.equal(scopeSupport({requiredAnyOf:[['good']],allowed:['good'],contradictory:['bad']},['good','bad']).pass,false)
})

test('one vague time plus an unannounced-date information fact is equivalent to two raw unknown clues',()=>{
  const wire=structuredClone(oracles[6].wire),removed=wire.timePoints.pop();wire.tasks[0].detail.timePointTempIds.pop();wire.informationScopeIds.push(...removed.scopeIds)
  const result=x.adaptCandidate14CommonWire(wire,oracles[6].context).adapted
  assert.equal(score(6,result).complete,true)
  result.timePoints[0].normalizedValue='2026-09-30T12:00';assert.equal(score(6,result).complete,false)
})
test('legal declared alias/representation accepted while undeclared split/merge is rejected',()=>{
  const ref=structuredClone(references[0]),r=structuredClone(oracles[0].result)
  // A source-supported longer object is declared before evaluation, not supplied by a candidate.
  ref.representations[0].tasks[0].object.aliases.push('声明');r.tasks[0].object.surface='声明'
  assert.equal(score(0,r,ref).complete,true)
  const merged=structuredClone(oracles[1].result);merged.tasks[0].object.surface+='和监护人知情书';merged.tasks.pop()
  assert.equal(score(1,merged).complete,false)
  const alternative=structuredClone(ref.representations[0]);alternative.tasks[0].id='alternate-task-id';ref.representations.push(alternative)
  assert.equal(score(0,r,ref).complete,true)
})
test('partial and unresolved references never award complete correctness',()=>{
  for(const completeness of ['partial','unresolved']){
    const ref={...references[0],completeness,unresolved:['meaning requires review']}
    assert.equal(score(0,oracles[0].result,ref).complete,false)
  }
})
test('all 24 historical raw outputs get determinate diagnostic outcomes; bad references remain failed',async()=>{
  const rows=await loadD11DiagnosticInputs();assert.equal(rows.length,24)
  for(const row of rows){const s=scoreSemanticV7(references.find(r=>r.sourceId===row.unit.sourceId),row.result,{referenceValid:row.referenceValid});assert.notEqual(s.status,'MEASUREMENT_ERROR');if(!row.referenceValid)assert.equal(s.status,'REFERENCE_LINK_FAILURE')}
})
test('Candidate03 and Candidate16 use identical source/schema and non-candidate parameters',async()=>{
  const a=await x.buildCandidate03Request(oracles[0].context),b=await x.buildCandidate16Request(oracles[0].context)
  a.body.input[0].content[0].text='candidate';b.body.input[0].content[0].text='candidate';assert.deepEqual(a.body,b.body)
})

test('typed material, hierarchy, inverse time ownership and revision evidence errors cannot pass',()=>{
  const cases=[
    [0,r=>{r.materials[0].quantity='999'}],
    [0,r=>{r.materials[0].required=false}],
    [0,r=>{[r.materials[0].formatRequirements,r.materials[0].namingRequirements]=[r.materials[0].namingRequirements,r.materials[0].formatRequirements]}],
    [1,r=>{r.tasks[1].detail.parentTempId='T1'}],
    [1,r=>{r.timePoints[0].relatedTaskTempIds=['T2']}],
    [10,r=>{r.revisions[0].scopeIds=r.tasks[3].propositionScopeIds}],
  ]
  for(const [n,change] of cases){const r=structuredClone(oracles[n].result);change(r);assert.equal(score(n,r).complete,false,'mutation '+n)}
})
