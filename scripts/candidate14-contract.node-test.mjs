import test from 'node:test'
import assert from 'node:assert/strict'
import {CANDIDATE14_REFERENCE_VERSION,legalWireOracle,validateCandidate14Reference} from './candidate14-reference-contract.mjs'
import {scoreCandidate14} from './score-candidate14-contract-v5.mjs'

const field=value=>({canonical:value,aliases:[]})
const task=(id='e1')=>({id,action:field('提交'),object:field('报名表'),actor:'addressee',currentness:'current',condition:'not_applicable',actionability:'actionable',defaultSelection:'selected',confirmation:'required',materials:'N/A',times:'N/A',completionStandards:['提交完成'],dependencies:'N/A',scopeIds:['s1']})
const reference=()=>({version:CANDIDATE14_REFERENCE_VERSION,sourceId:'S',completeness:'complete',allowedAliases:[],tasks:[task()],noTaskFacts:[]})
const actual=(overrides={})=>({action:{surface:'提交'},object:{surface:'报名表'},semantics:{actor:'addressee',polarity:'affirmative',tense:'future',status:'pending',validity:'active'},condition:{value:'not_applicable'},inferenceLevel:'explicit',detail:{userConfirmationRequired:true,completionCriteria:['提交完成'],materialTempIds:[],timePointTempIds:[],dependencyTempIds:[]},...overrides})
test('legal-wire oracle represents every separated dimension',()=>assert.equal(legalWireOracle(reference())[0].selected,true))
test('one predicted task cannot satisfy two expected tasks',()=>{const ref=reference();ref.tasks.push({...task('e2'),object:field('承诺书')});const score=scoreCandidate14(ref,{tasks:[actual({description:'同时包含承诺书'})]});assert.equal(score.taskMetrics.fn,1);assert.equal(score.complete,false)})
test('negative mutations fail independently',()=>{
  const mutations=[actual({semantics:{actor:'issuer',polarity:'affirmative',tense:'future',status:'pending',validity:'active'}}),actual({condition:{value:'false'}}),actual({detail:{userConfirmationRequired:true,completionCriteria:['核验通过'],materialTempIds:[],timePointTempIds:[],dependencyTempIds:[]}})]
  assert.ok(mutations.every(row=>scoreCandidate14(reference(),{tasks:[row]}).complete===false))
})
test('N/A is not scored as zero',()=>{const score=scoreCandidate14(reference(),{tasks:[actual()]});assert.equal(score.matches[0].check.fields.materials.pass,null);assert.equal(score.complete,true)})
test('invalid alias collisions are blocked',()=>{const ref=reference();ref.allowedAliases=[{canonical:'提交',aliases:['交']},{canonical:'交',aliases:[]}];assert.throws(()=>validateCandidate14Reference(ref),/ALIAS_COLLISION/)})
