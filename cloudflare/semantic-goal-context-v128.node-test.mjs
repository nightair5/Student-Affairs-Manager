import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'
import {createWorker} from './worker.mjs'

const options=source=>({source,referenceTime:'2027-03-01T09:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.11.0',goalContextVersion:'1.0.28'})
const source='【研究展示】2027年7月15日14:00—16:00在实验楼301举办展示会。请有意参加者在7月10日17:00前填写报名表，并于7月12日12:00前提交作品摘要。'
const eventQuote='2027年7月15日14:00—16:00在实验楼301举办展示会'
const actionQuote='请有意参加者在7月10日17:00前填写报名表，并于7月12日12:00前提交作品摘要'
const facts=()=>({topic:'研究展示',kind:'mixed',items:[
 {key:'event',kind:'event',title:'研究展示',location:'实验楼301',evidence:[eventQuote],times:[{role:'start',raw:'2027年7月15日14:00—16:00'},{role:'end',raw:'2027年7月15日14:00—16:00'}]},
 {key:'register',kind:'task',title:'填写报名表',action:'填写',object:'报名表',condition:'有意参加者',evidence:['请有意参加者在7月10日17:00前填写报名表'],times:[{role:'deadline',raw:'7月10日17:00前'}],eventRelation:{eventKey:'event',eventAnchor:'研究展示',evidence:actionQuote}},
 {key:'abstract',kind:'task',title:'提交作品摘要',action:'提交',object:'作品摘要',condition:'有意参加者',evidence:['并于7月12日12:00前提交作品摘要'],times:[{role:'deadline',raw:'7月12日12:00前'}],eventRelation:{eventKey:'event',eventAnchor:'研究展示',evidence:actionQuote}},
],materials:[]})

test('an adjacent participant reference links the model-declared actions without merging deadlines',()=>{
 const {result,audit}=compileSemanticNotice(facts(),options(source))
 assert.equal(audit.compilerVersion,'semantic-notice-compiler-1.0.28')
 assert.deepEqual(result.events[0].relatedTaskTempIds,result.standaloneTasks.map(task=>task.tempId))
 assert.deepEqual(result.timePoints.filter(p=>p.type==='task_deadline').map(p=>p.normalizedValue),['2027-07-10T17:00','2027-07-12T12:00'])
 assert.ok(result.standaloneTasks.every(task=>task.userConfirmationRequired===false&&task.description.includes('参加说明：有意参加者')))
})

test('the configured Worker runs the new compiler in one model request',async()=>{
 const origin='https://student-affairs-manager.example'
 let calls=0
 const worker=createWorker({logger:()=>{},fetcher:async()=>{calls++;return Response.json({model:'fixture-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify(facts())}}],usage:{prompt_tokens:20,completion_tokens:20}})}})
 const response=await worker.fetch(new Request(origin+'/api/deepseek/extract',{method:'POST',headers:{origin,'content-type':'application/json','X-Student-Affairs-Recognition':'semantic-notice-3.11'},body:JSON.stringify({content:source,sourceType:'text',referenceTime:'2027-03-01T09:00:00+08:00',timezone:'Asia/Shanghai'})}),{DEEPSEEK_API_KEY:'SYNTHETIC_TEST_PLACEHOLDER',ALLOWED_ORIGINS:origin,DEEPSEEK_GENERATION_MODE:'semantic-notice-3.0',SEMANTIC_GOAL_CONTEXT_VERSION:'1.0.28',RECOGNITION_LOCAL_ISOLATION_VERSION:'1.0.0',DEEPSEEK_MODEL:'deepseek-v4-flash',DEEPSEEK_EXTRACTION_MAX_TOKENS:'16384',EXTRACTION_RATE_LIMITER:{limit:async()=>({success:true})}})
 const body=await response.json()
 assert.equal(response.status,200);assert.equal(calls,1)
 assert.equal(body.execution.twoStep.compilerVersion,'semantic-notice-compiler-1.0.28')
 assert.equal(body.result.events[0].relatedTaskTempIds.length,2)
})

test('the old compiler behaviour and version remain available when the new option is absent',()=>{
 const {goalContextVersion,...old}=options(source)
 void goalContextVersion
 const {result,audit}=compileSemanticNotice(facts(),old)
 assert.equal(audit.compilerVersion,'semantic-notice-compiler-1.0.27')
 assert.deepEqual(result.events[0].relatedTaskTempIds,[])
})

test('an intervening unrelated notice prevents the adjacent reference from linking',()=>{
 const changed=source.replace('举办展示会。请','举办展示会。另有住宿事项需咨询老师。请')
 const {result}=compileSemanticNotice(facts(),options(changed))
 assert.equal(result.standaloneTasks.length,2)
 assert.deepEqual(result.events[0].relatedTaskTempIds,[])
})

test('two candidate events cannot use an ambiguous participant reference',()=>{
 const changed=source.replace('举办展示会。请','举办展示会；7月16日10:00在实验楼302举行摄影讲座。请')
 const raw=facts()
 raw.items.push({key:'other',kind:'event',title:'摄影讲座',location:'实验楼302',evidence:['7月16日10:00在实验楼302举行摄影讲座'],times:[{role:'start',raw:'7月16日10:00'}]})
 const {result}=compileSemanticNotice(raw,options(changed))
 assert.equal(result.standaloneTasks.length,2)
 assert.ok(result.events.every(event=>event.relatedTaskTempIds.length===0))
})

test('a generic request with no reference to participants does not become an event action',()=>{
 const changed=source.replace('请有意参加者','请同学们')
 const raw=facts()
 for(const task of raw.items.filter(item=>item.kind==='task')){
  task.condition='';task.evidence=task.evidence.map(q=>q.replace('请有意参加者','请同学们'))
  task.eventRelation.evidence=task.eventRelation.evidence.replace('请有意参加者','请同学们')
 }
 const {result}=compileSemanticNotice(raw,options(changed))
 assert.equal(result.standaloneTasks.length,2)
 assert.deepEqual(result.events[0].relatedTaskTempIds,[])
})

test('an unrelated instruction inside a proposed relation is not attached to the event',()=>{
 const changed=source.replace('并于7月12日12:00前提交作品摘要','另请于7月12日12:00前缴纳宿舍水费')
 const raw=facts(),last=raw.items[2]
 last.title='缴纳宿舍水费';last.action='缴纳';last.object='宿舍水费'
 last.evidence=['另请于7月12日12:00前缴纳宿舍水费']
 for(const task of raw.items.filter(item=>item.kind==='task'))task.eventRelation.evidence=actionQuote.replace('并于7月12日12:00前提交作品摘要','另请于7月12日12:00前缴纳宿舍水费')
 const {result}=compileSemanticNotice(raw,options(changed))
 assert.ok(result.events.every(event=>event.relatedTaskTempIds.length===0))
 assert.equal(result.standaloneTasks.length,2)
})

test('a genuinely restricted audience remains a qualification condition',()=>{
 const changed=source.replace('有意参加者','有意参加且仅限二年级的同学')
 const raw=facts()
 for(const task of raw.items.filter(item=>item.kind==='task')){
  task.condition='有意参加且仅限二年级的同学'
  task.evidence=task.evidence.map(q=>q.replace('有意参加者','有意参加且仅限二年级的同学'))
  task.eventRelation.evidence=task.eventRelation.evidence.replace('有意参加者','有意参加且仅限二年级的同学')
 }
 const {result}=compileSemanticNotice(raw,options(changed))
 assert.ok(result.standaloneTasks.every(task=>task.userConfirmationRequired===true))
})

test('v1.0.29 locates the cited full participant clause when a relation quote is abbreviated',()=>{
 const raw=facts()
 const last=raw.items[2]
 last.eventRelation.evidence='【研究展示】……并于7月12日12:00前提交作品摘要'
 last.assignment={scope:'conditional',actor:'有意参加者',evidence:actionQuote,actorEvidence:'有意参加者'}
 const {result,audit}=compileSemanticNotice(raw,{...options(source),goalContextVersion:'1.0.29'})
 assert.equal(audit.compilerVersion,'semantic-notice-compiler-1.0.29')
 assert.deepEqual(result.events[0].relatedTaskTempIds,result.standaloneTasks.map(task=>task.tempId))
 assert.deepEqual(result.timePoints.filter(p=>p.type==='task_deadline').map(p=>p.normalizedValue),['2027-07-10T17:00','2027-07-12T12:00'])
 assert.ok(result.evidence.every(ref=>source.slice(ref.textStart,ref.textEnd)===ref.quote))
})

test('v1.0.29 does not use an abbreviated quote to attach an intervening unrelated action',()=>{
 const changed=source.replace('举办展示会。请','举办展示会。另有住宿事项需咨询老师。请')
 const raw=facts(),last=raw.items[2]
 last.eventRelation.evidence='【研究展示】……并于7月12日12:00前提交作品摘要'
 last.assignment={scope:'conditional',actor:'有意参加者',evidence:actionQuote,actorEvidence:'有意参加者'}
 const {result}=compileSemanticNotice(raw,{...options(changed),goalContextVersion:'1.0.29'})
 assert.deepEqual(result.events[0].relatedTaskTempIds,[])
 assert.equal(result.standaloneTasks.length,2)
})

test('v1.0.29 resolves a cited 同日 clock using a unique preceding calendar date',()=>{
 const notice='请于2027年7月8日12:00前提交课程报告；另请于同日20:00前缴纳住宿费，两项互不相关。'
 const raw={topic:'课程与住宿',kind:'action',materials:[],items:[
  {key:'a',kind:'task',title:'提交课程报告',action:'提交',object:'课程报告',evidence:['请于2027年7月8日12:00前提交课程报告'],times:[{role:'deadline',raw:'2027年7月8日12:00前'}]},
  {key:'b',kind:'task',title:'缴纳住宿费',action:'缴纳',object:'住宿费',evidence:['另请于同日20:00前缴纳住宿费'],times:[{role:'deadline',raw:'同日20:00前'}]},
 ]}
 const {result}=compileSemanticNotice(raw,{...options(notice),goalContextVersion:'1.0.29'})
 assert.deepEqual(result.timePoints.filter(p=>p.type==='task_deadline').map(p=>p.normalizedValue),['2027-07-08T12:00','2027-07-08T20:00'])
 assert.equal(result.standaloneTasks.length,2)
})

test('v1.0.29 leaves 同日 unresolved when the prior dates are ambiguous',()=>{
 const notice='7月8日或7月9日安排检查；请于同日20:00前提交记录。'
 const raw={topic:'检查记录',kind:'action',materials:[],items:[{key:'a',kind:'task',title:'提交记录',action:'提交',object:'记录',evidence:['请于同日20:00前提交记录'],times:[{role:'deadline',raw:'同日20:00前'}]}]}
 const {result}=compileSemanticNotice(raw,{...options(notice),goalContextVersion:'1.0.29'})
 assert.ok(result.timePoints.every(p=>!p.normalizedValue))
 assert.equal(result.standaloneTasks.length,1)
})

test('v1.0.29 does not choose between a relative and a calendar day',()=>{
 const notice='7月8日或明天安排检查；请于同日20:00前提交记录。'
 const raw={topic:'检查记录',kind:'action',materials:[],items:[{key:'a',kind:'task',title:'提交记录',action:'提交',object:'记录',evidence:['请于同日20:00前提交记录'],times:[{role:'deadline',raw:'同日20:00前'}]}]}
 const {result}=compileSemanticNotice(raw,{...options(notice),goalContextVersion:'1.0.29'})
 assert.ok(result.timePoints.every(p=>!p.normalizedValue))
})

test('v1.0.29 does not inherit a date across unrelated sentences',()=>{
 const notice='通知于7月8日发布。请于同日20:00前提交记录。'
 const raw={topic:'提交记录',kind:'action',materials:[],items:[{key:'a',kind:'task',title:'提交记录',action:'提交',object:'记录',evidence:['请于同日20:00前提交记录'],times:[{role:'deadline',raw:'同日20:00前'}]}]}
 const {result}=compileSemanticNotice(raw,{...options(notice),goalContextVersion:'1.0.29'})
 assert.ok(result.timePoints.every(p=>!p.normalizedValue))
})
