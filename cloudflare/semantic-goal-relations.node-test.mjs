import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'
import {validateRecognitionResult} from './recognition-contract.generated.mjs'
import {semanticNoticeSystemPrompt,SEMANTIC_NOTICE_VERSION} from './semantic-notice-contract-v3-11-0.mjs'
import {createWorker} from './worker.mjs'

const options=source=>({source,referenceTime:'2026-11-07T10:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:SEMANTIC_NOTICE_VERSION})

test('new contract asks for source-backed goal relations while retaining independently actionable tasks',()=>{
 const prompt=semanticNoticeSystemPrompt()
 for(const word of ['eventRelation','eventAnchor','taskKeys','各自截止','不同活动'])assert.ok(prompt.includes(word),word)
 assert.equal(SEMANTIC_NOTICE_VERSION,'recognition-semantic-notice-3.11.0')
})

test('worker negotiates the new version in one request',async()=>{
 const source='请于11月20日前提交登记表。',origin='https://student-affairs-manager.example'
 let calls=0
 const worker=createWorker({logger:()=>{},fetcher:async()=>{calls++;return Response.json({model:'fixture-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify({topic:'登记',kind:'action',items:[{key:'t',kind:'task',title:'提交登记表',action:'提交',object:'登记表',evidence:[source]}],materials:[]})}}],usage:{prompt_tokens:20,completion_tokens:20}})}})
 const response=await worker.fetch(new Request(origin+'/api/deepseek/extract',{method:'POST',headers:{origin,'content-type':'application/json','X-Student-Affairs-Recognition':'semantic-notice-3.11'},body:JSON.stringify({content:source,sourceType:'text',referenceTime:'2026-11-07T10:00:00+08:00',timezone:'Asia/Shanghai'})}),{DEEPSEEK_API_KEY:'SYNTHETIC_TEST_PLACEHOLDER',ALLOWED_ORIGINS:origin,DEEPSEEK_GENERATION_MODE:'semantic-notice-3.0',RECOGNITION_LOCAL_ISOLATION_VERSION:'1.0.0',DEEPSEEK_MODEL:'deepseek-v4-flash',DEEPSEEK_EXTRACTION_MAX_TOKENS:'16384',EXTRACTION_RATE_LIMITER:{limit:async()=>({success:true})}})
 const body=await response.json()
 assert.equal(response.status,200);assert.equal(calls,1)
 assert.equal(body.execution.generationMode,'semantic-notice-3.11')
 assert.equal(body.execution.promptVersion,SEMANTIC_NOTICE_VERSION)
 assert.equal(body.execution.twoStep.compilerVersion,'semantic-notice-compiler-1.0.26')
})

test('event preparation remains separately saved with its own evidence and deadline',()=>{
 const source='求职分享会于2026年11月18日14:30在明德楼309举行。参加分享会请先填写报名表，再于11月17日17:00前提交个人简历。'
 const relation='参加分享会请先填写报名表，再于11月17日17:00前提交个人简历'
 const raw={topic:'求职分享会',kind:'mixed',items:[
  {key:'e',kind:'event',title:'求职分享会',location:'明德楼309',evidence:['求职分享会于2026年11月18日14:30在明德楼309举行'],times:[{role:'start',raw:'2026年11月18日14:30'}]},
  {key:'r',kind:'task',title:'填写报名表',action:'填写',object:'报名表',evidence:['填写报名表'],eventRelation:{eventKey:'e',eventAnchor:'分享会',evidence:relation}},
  {key:'cv',kind:'task',title:'提交个人简历',action:'提交',object:'个人简历',evidence:['11月17日17:00前提交个人简历'],times:[{role:'deadline',raw:'11月17日17:00前'}],eventRelation:{eventKey:'e',eventAnchor:'分享会',evidence:relation}},
 ],materials:[]}
 const {result,audit}=compileSemanticNotice(raw,options(source))
 assert.equal(result.standaloneTasks.length,2)
 assert.deepEqual(result.events[0].relatedTaskTempIds,result.standaloneTasks.map(t=>t.tempId))
 assert.equal(result.timePoints.find(p=>p.type==='task_deadline')?.normalizedValue,'2026-11-17T17:00')
 assert.equal(result.events[0].location,'明德楼309')
 assert.equal(audit.compilerVersion,'semantic-notice-compiler-1.0.26')
 assert.equal(validateRecognitionResult(result,{sourceContent:source}).valid,true)
})

test('ambiguous or unsupported relations do not hide tasks or attach to an unrelated event',()=>{
 const source='上午写作分享会和下午摄影分享会同时开放。请于11月20日前报名分享会。'
 const raw={topic:'分享活动',kind:'mixed',items:[
  {key:'a',kind:'event',title:'写作分享会',evidence:['上午写作分享会']},
  {key:'b',kind:'event',title:'摄影分享会',evidence:['下午摄影分享会']},
  {key:'r',kind:'task',title:'报名分享会',action:'报名',object:'分享会',evidence:['请于11月20日前报名分享会'],times:[{role:'deadline',raw:'11月20日前'}],eventRelation:{eventKey:'a',eventAnchor:'分享会',evidence:'请于11月20日前报名分享会'}}
 ],materials:[]}
 const {result,audit}=compileSemanticNotice(raw,options(source))
 assert.equal(result.standaloneTasks.length,1)
 assert.equal(result.events.length,2)
 assert.ok(result.events.every(event=>event.relatedTaskTempIds.length===0))
 assert.ok(audit.losses.some(loss=>loss.reason==='EVENT_GOAL_RELATION_UNCONFIRMED'))
 assert.equal(validateRecognitionResult(result,{sourceContent:source}).valid,true)
})

test('one delivery goal groups conditional tasks without changing either task',()=>{
 const source='思想汇报提交：2023级同学提交第一篇汇报；2024级同学提交第二篇汇报。'
 const raw={topic:'思想汇报',kind:'action',items:[
  {key:'one',kind:'task',title:'提交第一篇汇报',action:'提交',object:'第一篇汇报',condition:'2023级同学',evidence:['2023级同学提交第一篇汇报']},
  {key:'two',kind:'task',title:'提交第二篇汇报',action:'提交',object:'第二篇汇报',condition:'2024级同学',evidence:['2024级同学提交第二篇汇报']},
 ],materials:[],goals:[{key:'reports',title:'提交思想汇报',anchor:'汇报',evidence:'思想汇报提交',taskKeys:['one','two']}]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(result.goalGroups.length,1)
 assert.deepEqual(result.goalGroups[0].taskTempIds,result.standaloneTasks.map(t=>t.tempId))
 assert.ok(result.standaloneTasks[0].description.includes('2023级'))
 assert.ok(result.standaloneTasks[1].description.includes('2024级'))
 assert.equal(validateRecognitionResult(result,{sourceContent:source}).valid,true)
})

test('same date is not an actionable goal anchor',()=>{
 const source='11月8日前缴纳电费；11月8日前提交课程作业。'
 const raw={topic:'事项',kind:'action',items:[
  {key:'a',kind:'task',title:'缴纳电费',action:'缴纳',object:'电费',evidence:['11月8日前缴纳电费']},
  {key:'b',kind:'task',title:'提交课程作业',action:'提交',object:'课程作业',evidence:['11月8日前提交课程作业']},
 ],materials:[],goals:[{key:'g',title:'11月8日事项',anchor:'11月8日',evidence:'11月8日前缴纳电费',taskKeys:['a','b']}]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(result.standaloneTasks.length,2)
 assert.equal(result.goalGroups,undefined)
})

test('voluntary participation is not labelled as eligibility, while a real condition remains visible',()=>{
 const source='2026年11月19日9:00在教学楼101举办讲座。感兴趣者可扫码加入本次讲座交流群。'
 const quote='感兴趣者可扫码加入本次讲座交流群'
 const raw={topic:'讲座',kind:'mixed',items:[
  {key:'e',kind:'event',title:'讲座',evidence:['2026年11月19日9:00在教学楼101举办讲座'],times:[{role:'start',raw:'2026年11月19日9:00'}],location:'教学楼101'},
  {key:'join',kind:'task',title:'扫码加入讲座交流群',action:'扫码加入',object:'本次讲座交流群',condition:'感兴趣者',evidence:[quote],assignment:{scope:'conditional',actor:'感兴趣者',evidence:quote,actorEvidence:'感兴趣者'},eventRelation:{eventKey:'e',eventAnchor:'讲座',evidence:quote}}
 ],materials:[]}
 const {result}=compileSemanticNotice(raw,options(source)),task=result.standaloneTasks[0]
 assert.ok(task.description.includes('参加说明：感兴趣者'))
 assert.ok(!task.description.includes('适用条件待确认'))
 assert.equal(task.userConfirmationRequired,false)
 assert.deepEqual(result.events[0].relatedTaskTempIds,[task.tempId])
 const restricted='仅限完成安全培训的同学报名参观。'
 const limited={topic:'参观',kind:'action',items:[{key:'register',kind:'task',title:'报名参观',action:'报名',object:'参观',condition:'仅限完成安全培训的同学',evidence:[restricted],assignment:{scope:'conditional',actor:'完成安全培训的同学',evidence:restricted,actorEvidence:'完成安全培训的同学'}}],materials:[]}
 const qualified=compileSemanticNotice(limited,options(restricted)).result.standaloneTasks[0]
 assert.ok(qualified.description.includes('适用条件待确认'))
 assert.equal(qualified.userConfirmationRequired,true)
})
