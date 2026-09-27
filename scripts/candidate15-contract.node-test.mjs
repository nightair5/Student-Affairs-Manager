import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {scoreCandidate15} from './score-candidate15-contract.mjs'
import {CANDIDATE15_REFERENCE_VERSION,validateCandidate15Reference} from './candidate15-reference-contract.mjs'

async function components(){
  const bundle=await build({stdin:{contents:`export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';export {adaptCandidate14CommonWire} from './src/experiments/candidate14/commonAdapter.ts';export {buildCandidate03Request} from './src/experiments/realInput01/candidate03.ts';export {buildCandidate15Request} from './src/experiments/realInput01/candidate15.ts';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
  return import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'))
}
const source='校园义诊将于10月3日晚上6点举行。'
async function caseFixture(){
  const x=await components(),index=await x.indexImmutableScopesV11('D8-EVENT','D8-EVENT-v1',source),scope=index.scopes[0].id
  const context={index,referenceTime:'2026-09-22T00:00:00.000Z',timezone:'Asia/Shanghai'}
  const time={tempId:'p1',type:'event_start',rawText:'10月3日晚上6点',relatedTaskTempIds:[],relatedMaterialTempIds:[],scopeIds:[scope],confidence:1}
  const wire={schemaVersion:'real-input-model-wire-1',tasks:[],materials:[],timePoints:[time],events:[{tempId:'e1',title:'校园义诊',description:'',startTimePointTempId:'p1',endTimePointTempId:null,location:null,scopeIds:[scope],confidence:1,inferenceLevel:'explicit',relatedTaskTempIds:[]}],revisions:[],conflicts:[],informationScopeIds:[scope],unresolvedScopeIds:[]}
  const reference={version:CANDIDATE15_REFERENCE_VERSION,sourceId:index.sourceId,completeness:'complete',referenceTime:context.referenceTime,timezone:context.timezone,scopeTextById:Object.fromEntries(index.scopes.map(s=>[s.id,s.text])),allowedAliases:[],tasks:[],relations:[],noTaskFacts:[{id:'event',kind:'event',value:'校园义诊',aliases:[],sourceText:'校园义诊',scopeIds:[scope],timeFactIds:['time'],locationFactIds:[]},{id:'time',kind:'time',value:'10月3日晚上6点',aliases:[],sourceText:'10月3日晚上6点',scopeIds:[scope],time:{type:'event_start',rawText:'10月3日晚上6点',normalizedValue:'2026-10-03T18:00',timezone:'Asia/Shanghai',precision:'exact',isAllDay:false,needsConfirmation:false}}]}
  return {x,wire,reference,context,scope}
}
test('lawful no-task event can pass both wire adapter and scorer, and both candidates share non-prompt request fields',async()=>{
  const {x,wire,reference,context}=await caseFixture()
  validateCandidate15Reference(reference)
  const adapted=x.adaptCandidate14CommonWire(wire,context).adapted
  assert.equal(scoreCandidate15(reference,adapted).complete,true)
  const a=(await x.buildCandidate03Request(context)).body,b=(await x.buildCandidate15Request(context)).body
  assert.deepEqual({...a,input:a.input.slice(1)},{...b,input:b.input.slice(1)})
  assert.notEqual(a.input[0].content[0].text,b.input[0].content[0].text)
  assert.equal(JSON.stringify(b).includes('NO_TASK_TIME_SEMANTICS'),false)
})
test('independent event time semantic mutations fail one field at a time',async()=>{
  const {x,wire,reference,context}=await caseFixture()
  const good=x.adaptCandidate14CommonWire(wire,context).adapted
  for(const [field,value] of Object.entries({type:'event_end',normalizedValue:'1900-01-01T00:00',timezone:'UTC',precision:'vague',isAllDay:true,needsConfirmation:true})){
    const bad=structuredClone(good);bad.timePoints[0][field]=value
    assert.equal(scoreCandidate15(reference,bad).complete,false,field)
  }
  const detached=structuredClone(good);detached.events[0].startTimePointTempId=null
  assert.equal(scoreCandidate15(reference,detached).complete,false)
  const wrongScope=structuredClone(good);wrongScope.informationScopeIds=[]
  assert.equal(scoreCandidate15(reference,wrongScope).complete,false)
  const wrongWire=structuredClone(wire);wrongWire.timePoints[0].type='event_end'
  assert.equal(scoreCandidate15(reference,x.adaptCandidate14CommonWire(wrongWire,context).adapted).complete,false)
})
test('reference cannot call a raw-only time complete, or treat partial as complete',async()=>{
  const {x,wire,reference,context}=await caseFixture()
  const rawOnly=structuredClone(reference);delete rawOnly.noTaskFacts[1].time
  assert.throws(()=>validateCandidate15Reference(rawOnly),/NO_TASK_TIME_SEMANTICS/)
  const partial={...reference,completeness:'partial'}
  assert.equal(scoreCandidate15(partial,x.adaptCandidate14CommonWire(wire,context).adapted).status,'PARTIAL_REFERENCE')
})
test('false conditional is retained as non-actionable and its scope stays informational',()=>{
  const field=value=>({canonical:value,aliases:[]}),scope='若考核通过，请领取胸牌；记录显示未通过。'
  const task={id:'old',action:field('领取'),object:field('胸牌'),actor:'addressee',currentness:'current',condition:'false',conditionScopeIds:['s'],factScopeIds:['s'],actionability:'not_actionable',defaultSelection:'not_selected',confirmation:'required',materials:'N/A',times:'N/A',completionStandards:'N/A',dependencies:'N/A',actionScopeIds:['s'],objectScopeIds:['s'],scopeIds:['s']}
  const ref={version:CANDIDATE15_REFERENCE_VERSION,sourceId:'FALSE',completeness:'complete',referenceTime:'2026-09-22T00:00:00.000Z',timezone:'Asia/Shanghai',scopeTextById:{s:scope},allowedAliases:[],tasks:[task],relations:[],noTaskFacts:[]}
  const row={id:'old',propositionScopeIds:['s'],action:{surface:'领取',scopeId:'s'},object:{surface:'胸牌',scopeId:'s'},semantics:{actor:'addressee',speechAct:'directive',polarity:'affirmative',tense:'future',status:'pending',validity:'active',modality:'informational'},condition:{value:'false',conditionScopeIds:['s'],factScopeIds:['s']},inferenceLevel:'explicit',detail:{userConfirmationRequired:true,completionCriteria:[],materialTempIds:[],timePointTempIds:[],dependencyTempIds:[]}}
  const actual={tasks:[row],materials:[],timePoints:[],events:[],revisions:[],conflicts:[],informationScopeIds:['s'],unresolvedScopeIds:[]}
  assert.equal(scoreCandidate15(ref,actual).complete,true)
  assert.equal(scoreCandidate15(ref,{...actual,informationScopeIds:[]}).complete,false)
})
test('an ordinary current task accepts grounded wording aliases but rejects a changed completion standard',()=>{
  const field=(canonical,aliases=[])=>({canonical,aliases}),scope='请提交项目资料，页面显示提交成功才算完成。'
  const task={id:'task-1',action:field('提交',['报送']),object:field('项目资料',['项目材料']),actor:'addressee',currentness:'current',condition:'not_applicable',conditionScopeIds:[],factScopeIds:[],actionability:'actionable',defaultSelection:'selected',confirmation:'required',materials:'N/A',times:'N/A',completionStandards:['页面显示提交成功'],dependencies:'N/A',actionScopeIds:['s'],objectScopeIds:['s'],scopeIds:['s']}
  const ref={version:CANDIDATE15_REFERENCE_VERSION,sourceId:'TASK',completeness:'complete',referenceTime:'2026-09-22T00:00:00.000Z',timezone:'Asia/Shanghai',scopeTextById:{s:scope},allowedAliases:[],tasks:[task],relations:[],noTaskFacts:[]}
  const row={id:'pred-1',propositionScopeIds:['s'],action:{surface:'报送',scopeId:'s'},object:{surface:'项目材料',scopeId:'s'},semantics:{actor:'addressee',speechAct:'directive',polarity:'affirmative',tense:'future',status:'pending',validity:'active',modality:'required'},condition:{value:'not_applicable',conditionScopeIds:[],factScopeIds:[]},inferenceLevel:'explicit',detail:{userConfirmationRequired:true,completionCriteria:['页面显示提交成功'],materialTempIds:[],timePointTempIds:[],dependencyTempIds:[]}}
  const actual={tasks:[row],materials:[],timePoints:[],events:[],revisions:[],conflicts:[],informationScopeIds:[],unresolvedScopeIds:[]}
  assert.equal(scoreCandidate15(ref,actual).complete,true)
  const bad=structuredClone(actual);bad.tasks[0].detail.completionCriteria=['文件已经发出']
  assert.equal(scoreCandidate15(ref,bad).complete,false)
})
