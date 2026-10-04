import {test} from 'node:test'
import assert from 'node:assert/strict'
import {makePublicDiagnostic,BATCH,COUNT,sha} from './prepare-public-notice-diagnostic.mjs'
import {scorePublicNotice,reportPublicNotices} from './public-notice-scoring.mjs'
import {createScopedEngine} from './scoped-execution-core.mjs'

test('four current-C19 requests use source only and freeze the actual dynamic product graph',async()=>{
  const a=await makePublicDiagnostic(),requests=a['PREPARED_REQUEST_IDENTITIES.json'].requests
  assert.equal(COUNT,4);assert.equal(requests.length,4)
  assert.equal(new Set(requests.map(r=>r.requestSha256)).size,4)
  for(const [i,r]of requests.entries()){
    assert.equal(r.ordinal,i+1);assert.equal(r.candidate,'Candidate19');assert.equal(r.arm,'SINGLE')
    assert.equal(r.dispatchAuthorized,false);assert.equal(r.status,'NOT_RUN')
    assert.equal(r.requestSha256,sha(JSON.stringify(r.body)))
    assert.equal(r.body.model,'deepseek-flash');assert.equal(r.body.max_output_tokens,8192)
    assert.equal(r.body.reasoning.effort,'none');assert.equal(r.body.temperature,0)
    assert.doesNotMatch(JSON.stringify(r.body),/\bexpected\b/iu)
  }
  const paths=a['MANIFEST.json'].components.map(c=>c.path)
  for(const p of ['src/experiments/candidate19Recorded/publicNotices.ts','src/experiments/realInput01/candidate19.ts','src/recognition/materialChannelGrounding.ts','src/domain/v2/sourceReviewD26.ts'])assert.ok(paths.includes(p),p)
  const e=createScopedEngine({batch:BATCH,count:4,snapshot:'test'})
  const state=e.newState(requests,{manifestSha256:'test',identitiesSha256:'test'})
  assert.equal(state.units.length,4);assert.equal(state.authorized,false)
  assert.throws(()=>e.assertAuthorization(state,null,requests,{}),/AUTHORIZATION_REQUIRED/u)
})
const reference={sourceId:'public-a',assertions:[{id:'date'},{id:'owner'},{id:'extras'}]}
const complete=()=>reference.assertions.map(a=>({factId:a.id,verdict:'CORRECT',reason:'Provisional source comparison',outputPointer:'/facts/'+a.id}))
test('one actual wrong date cannot be outweighed by correct fields, and final-human cannot replace first answer',()=>{
  const rows=complete();rows[0].verdict='INCORRECT'
  const d=scorePublicNotice(reference,{modelFirstFacts:rows,displayBeforeHuman:complete(),humanFinal:complete()})
  assert.equal(d.stages.modelFirstFacts.complete,false)
  assert.equal(d.stages.displayBeforeHuman.complete,true)
  assert.equal(d.stages.humanFinal.complete,true)
})
test('missing, duplicate, unsupported decisions and unadjudicated prose remain unknown',()=>{
  for(const rows of [[],complete().slice(0,2),[...complete(),complete()[0]],[...complete(),{factId:'unexpected',verdict:'CORRECT',reason:'x',outputPointer:'/x'}],complete().map(r=>({...r,outputPointer:''}))]){
    assert.equal(scorePublicNotice(reference,{modelFirstFacts:rows}).stages.modelFirstFacts.complete,'UNKNOWN')
  }
})
test('all planned sources remain in denominator, absent layers are not zero-edit success',()=>{
  const refs=[reference,...['b','c','d'].map(sourceId=>({...reference,sourceId}))]
  const r=reportPublicNotices(refs,[{sourceId:'public-a',modelFirstFacts:complete()}])
  assert.deepEqual(r.summary.modelFirstFacts,{correct:1,incorrect:0,unknown:3,denominator:4})
  assert.deepEqual(r.summary.humanFinal,{correct:0,incorrect:0,unknown:4,denominator:4})
  assert.equal(reportPublicNotices([reference],[{sourceId:'public-a',modelFirstFacts:complete()},{sourceId:'public-a',modelFirstFacts:[]}]).summary.modelFirstFacts.unknown,1)
})
