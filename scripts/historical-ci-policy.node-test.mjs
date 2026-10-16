import test from 'node:test'
import assert from 'node:assert/strict'
import {classifyHistorical} from './historical-ci-policy.mjs'
const policy={groups:{old:{reason:'frozen old hash',tests:['old assertion'],errors:['OLD_HASH']},private:{unavailable:true},'historical-originals':{reason:'unchanged starting bytes'}}}
const row={label:'old',outcome:'FAIL',log:'log'}
const options={readLog:()=>"not ok 1 - old assertion\nerror: 'OLD_HASH'",originalsUnchanged:()=>true}
test('known failures remain reported, not rewritten as passing assertions',()=>{
  const summary={results:[row,{label:'private',outcome:'NOT_AVAILABLE',reason:'HISTORICAL_PRIVATE_ORIGINALS_MISSING'}]},copy=structuredClone(summary)
  const r=classifyHistorical(summary,policy,options);assert.equal(r.unexpected.length,0);assert.equal(r.known.length,1);assert.equal(r.unavailable.length,1);assert.deepEqual(summary,copy)
})
test('a new test failure in an allowlisted group fails the CI policy',()=>{
  const r=classifyHistorical({results:[row]},policy,{...options,readLog:()=>options.readLog()+ '\nnot ok 2 - new assertion'})
  assert.equal(r.outcome,'FAIL')
})
test('missing signature, unlisted group, new missing prerequisite and new original drift fail',()=>{
  assert.equal(classifyHistorical({results:[row]},policy,{...options,readLog:()=>''}).outcome,'FAIL')
  assert.equal(classifyHistorical({results:[{...row,label:'new'}]},policy,options).outcome,'FAIL')
  assert.equal(classifyHistorical({results:[{...row,outcome:'NOT_AVAILABLE'}]},policy,options).outcome,'FAIL')
  assert.equal(classifyHistorical({results:[{...row,label:'historical-originals'}]},policy,{...options,originalsUnchanged:()=>false}).outcome,'FAIL')
})

test('authorized lock upgrade signature is allowed only for its exact audited bytes',()=>{
  const bound={groups:{old:{...policy.groups.old,errorAlternatives:[['OLD_HASH'],['FREEZE_HASH_MISMATCH:package-lock.json']],fileSha256:{'package-lock.json':'audited-sha'}}}}
  const readLog=()=>"not ok 1 - old assertion\nerror: 'FREEZE_HASH_MISMATCH:package-lock.json'"
  assert.equal(classifyHistorical({results:[row]},bound,{...options,readLog,filesMatch:files=>files['package-lock.json']==='audited-sha'}).outcome,'PASS_WITH_RECORDED_HISTORY')
  assert.equal(classifyHistorical({results:[row]},bound,{...options,readLog,filesMatch:()=>false}).outcome,'FAIL')
  assert.equal(classifyHistorical({results:[row]},bound,{...options,readLog}).outcome,'FAIL')
})
