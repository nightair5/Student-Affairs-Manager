import test from 'node:test'
import assert from 'node:assert/strict'
import {semanticNoticeSystemPrompt,SEMANTIC_NOTICE_VERSION} from './semantic-notice-contract-v3-8-0.mjs'
import {semanticNoticeSystemPrompt as refinedPrompt,SEMANTIC_NOTICE_VERSION as REFINED_VERSION} from './semantic-notice-contract-v3-9-0.mjs'
import {createWorker} from './worker.mjs'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'

test('unified contract is standalone and defines consistent choice, actors and event grouping',()=>{
 const prompt=semanticNoticeSystemPrompt()
 assert.equal(SEMANTIC_NOTICE_VERSION,'recognition-semantic-notice-3.8.0')
 assert.ok(prompt.length<6000)
 for(const term of ['assignment','contextFacts','choice','owners','condition','required','各自输出event'])assert.ok(prompt.includes(term),term)
 assert.ok(!prompt.includes('二选一只输出一项'))
 assert.ok(!prompt.includes('入群必须单独'))
})

test('one unified request negotiates its own prompt and compiler without extra upstream calls',async()=>{
 const source='同学请于11月20日17:00前提交登记表。'
 for(const contract of [{mode:'semantic-notice-3.8',version:SEMANTIC_NOTICE_VERSION,prompt:semanticNoticeSystemPrompt},{mode:'semantic-notice-3.9',version:REFINED_VERSION,prompt:refinedPrompt}]){
 let calls=0,prompt=''
 const worker=createWorker({logger:()=>{},fetcher:async(_url,init)=>{
  calls++;prompt=JSON.parse(init.body).messages[0].content
  return Response.json({model:'fixture-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify({topic:'登记',kind:'action',items:[{key:'a',kind:'task',title:'提交登记表',action:'提交',object:'登记表',evidence:[source],times:[{role:'deadline',raw:'11月20日17:00前'}],assignment:{scope:'audience',actor:'同学',evidence:source}}],materials:[]})}}],usage:{prompt_tokens:100,completion_tokens:30,total_tokens:130}})
 }})
 const origin='https://student-affairs-manager.example'
 const response=await worker.fetch(new Request(origin+'/api/deepseek/extract',{method:'POST',headers:{origin,'content-type':'application/json','X-Student-Affairs-Recognition':contract.mode},body:JSON.stringify({content:source,sourceType:'text',referenceTime:'2026-11-07T10:00:00+08:00',timezone:'Asia/Shanghai'})}),{DEEPSEEK_API_KEY:'SYNTHETIC_TEST_PLACEHOLDER',ALLOWED_ORIGINS:origin,DEEPSEEK_GENERATION_MODE:'semantic-notice-3.0',RECOGNITION_LOCAL_ISOLATION_VERSION:'1.0.0',DEEPSEEK_MODEL:'deepseek-v4-flash',DEEPSEEK_EXTRACTION_MAX_TOKENS:'16384',EXTRACTION_RATE_LIMITER:{limit:async()=>({success:true})}})
 const body=await response.json()
 assert.equal(response.status,200);assert.equal(calls,1)
 assert.equal(body.execution.generationMode,contract.mode)
 assert.equal(body.execution.promptVersion,contract.version)
 assert.equal(body.execution.twoStep.compilerVersion,'semantic-notice-compiler-1.0.23')
 assert.equal(prompt,contract.prompt())
 assert.equal(body.result.standaloneTasks.length,1)
 }
})

test('shared materials stay attached to explicit choice branches with separate deadlines',()=>{
 const source='证明任选一种：11月20日17:00前上传电子材料；11月21日12:00前递交纸质材料。两种方式均须提交签名表。'
 const base={kind:'task',action:'提交',object:'材料',materials:['form'],choice:{key:'choice',evidence:'证明任选一种'},requirements:[]}
 const raw={topic:'证明',kind:'action',items:[
  {...base,key:'online',title:'提交电子材料',deliveryForm:'电子',evidence:['11月20日17:00前上传电子材料'],times:[{role:'deadline',raw:'11月20日17:00前'}]},
  {...base,key:'paper',title:'递交纸质材料',deliveryForm:'纸质',evidence:['11月21日12:00前递交纸质材料'],times:[{role:'deadline',raw:'11月21日12:00前'}]},
 ],materials:[{key:'form',name:'签名表',required:true,owners:['online','paper'],evidence:['两种方式均须提交签名表']}]}
 const {result}=compileSemanticNotice(raw,{source,referenceTime:'2026-11-07T10:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:SEMANTIC_NOTICE_VERSION})
 assert.equal(result.standaloneTasks.length,2)
 assert.equal(result.conflicts.find(c=>c.id.startsWith('sem-choice-'))?.entityTempIds.length,2)
 assert.ok(result.standaloneTasks.every(t=>t.materialTempIds.length>0))
 assert.deepEqual(result.timePoints.map(p=>p.normalizedValue).sort(),['2026-11-20T17:00','2026-11-21T12:00'])
})

test('an unspecified material obligation remains explicitly unresolved only in the new contract',()=>{
 const source='准备登记表，用于后续办理。'
 const raw={topic:'登记',kind:'action',items:[{key:'a',kind:'task',title:'准备登记表',action:'准备',object:'登记表',evidence:[source],materials:['m']}],materials:[{key:'m',name:'登记表',owners:['a'],evidence:[source]}]}
 const options={source,referenceTime:'2026-11-07T10:00:00+08:00',timezone:'Asia/Shanghai'}
 const fresh=compileSemanticNotice(raw,{...options,promptVersion:SEMANTIC_NOTICE_VERSION})
 assert.equal(fresh.result.materials[0].required,false)
 assert.ok(fresh.result.materials[0].requirements.includes('是否必交待确认'))
 assert.ok(fresh.audit.losses.some(x=>x.reason==='MATERIAL_REQUIRED_UNRESOLVED'))
 assert.equal(compileSemanticNotice(raw,{...options,promptVersion:'recognition-semantic-notice-3.7.0'}).result.materials[0].required,true)
})

test('a cited same-day agenda heading anchors each event without taking another date',()=>{
 const source='2026年12月2日在东楼举办开放日：9:00—10:00分享在201室；14:00—15:00咨询在202室。'
 const heading='2026年12月2日在东楼举办开放日'
 const events=[
  {key:'a',kind:'event',title:'分享',location:'东楼201室',evidence:[heading,'9:00—10:00分享在201室'],times:[{role:'start',raw:'2026年12月2日'},{role:'start',raw:'9:00—10:00'},{role:'end',raw:'9:00—10:00'}]},
  {key:'b',kind:'event',title:'咨询',location:'东楼202室',evidence:[heading,'14:00—15:00咨询在202室'],times:[{role:'start',raw:'2026年12月2日'},{role:'start',raw:'14:00—15:00'},{role:'end',raw:'14:00—15:00'}]},
 ]
 const compile=text=>compileSemanticNotice({topic:'开放日',kind:'event',items:events,materials:[]},{source:text,referenceTime:'2026-11-07T10:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:SEMANTIC_NOTICE_VERSION})
 const {result}=compile(source)
 assert.deepEqual(result.timePoints.map(p=>p.normalizedValue),['2026-12-02T09:00','2026-12-02T10:00','2026-12-02T14:00','2026-12-02T15:00'])
 assert.deepEqual(result.events.map(e=>e.location),['东楼 · 201室','东楼 · 202室'])
 const other=source.replace('14:00—15:00咨询','改至12月3日14:00—15:00咨询')
 const changed=compile(other).result
 assert.ok(!changed.timePoints.some(p=>p.normalizedValue==='2026-12-02T14:00'))
})

test('an adjacent file format belongs only to the cited material',()=>{
 const source='请提交申请表和成绩单PDF。'
 const raw={topic:'材料',kind:'action',items:[{key:'a',kind:'task',title:'提交材料',action:'提交',object:'材料',evidence:[source],materials:['form','grade']}],materials:[
  {key:'form',name:'申请表',required:true,owners:['a'],evidence:[source]},
  {key:'grade',name:'成绩单',required:true,owners:['a'],evidence:[source]},
 ]}
 const {result}=compileSemanticNotice(raw,{source,referenceTime:'2026-11-07T10:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:SEMANTIC_NOTICE_VERSION})
 assert.deepEqual(result.materials.find(m=>m.name==='申请表').formatRequirements,[])
 assert.deepEqual(result.materials.find(m=>m.name==='成绩单').formatRequirements,['PDF'])
})

test('a separately cited common day and its own exact start refine rather than cancel one another',()=>{
 const day='2027年3月15日', slot='下午14:10—15:20'
 const source=`${day}安排：上午10:00—11:00在东楼203举行写作交流；${slot}在西楼106举行专题讨论。`
 const item={key:'discussion',kind:'event',title:'专题讨论',evidence:[`${slot}在西楼106举行专题讨论`],times:[{role:'start',raw:day},{role:'start',raw:slot},{role:'end',raw:slot}],location:'西楼106'}
 const opts={source,referenceTime:'2027-03-01T10:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:SEMANTIC_NOTICE_VERSION}
 const compile=times=>compileSemanticNotice({topic:'交流安排',kind:'event',items:[{...item,times}],materials:[]},opts)
 for(const times of [item.times,[item.times[1],item.times[0],item.times[2]]]){
  const {result,audit}=compile(times),event=result.events[0]
  const start=result.timePoints.find(point=>point.tempId===event.startTimePointTempId)
  assert.equal(start.normalizedValue,'2027-03-15T14:10')
  assert.equal(start.precision,'exact')
  assert.ok(!audit.losses.some(loss=>loss.reason==='CONFLICTING_TIME_VALUES'))
 }
})

test('a document-level source context is kept as unassigned context without becoming a personal deadline',()=>{
 const first='请先登记借用需求',second='再提交确认表',context='服务台每周五上午受理，工作人员核验后通知领取'
 const source=`${first}，${second}。${context}。`
 const raw={topic:'借用',kind:'action',items:[
  {key:'a',kind:'task',title:'登记借用需求',action:'登记',object:'借用需求',evidence:[first]},
  {key:'b',kind:'task',title:'提交确认表',action:'提交',object:'确认表',evidence:[second],dependsOn:['a']},
 ],materials:[],contextFacts:[{kind:'receiving_schedule',quote:context}]}
 const opts={source,referenceTime:'2027-03-01T10:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:SEMANTIC_NOTICE_VERSION}
 const {result,audit}=compileSemanticNotice(raw,opts)
 assert.match(result.standaloneTasks[0].description,/通知补充说明（归属待确认）：服务台每周五上午受理/u)
 assert.ok(!result.standaloneTasks[1].description.includes(context))
 assert.ok(!result.timePoints.some(p=>p.type==='task_deadline'))
 assert.ok(audit.losses.some(loss=>loss.reason==='CONTEXT_OWNER_UNRESOLVED'))
 const unrelated=structuredClone(raw);unrelated.items[1].dependsOn=[]
 const other=compileSemanticNotice(unrelated,opts)
 assert.ok(other.result.standaloneTasks.every(task=>!task.description.includes(context)))
 assert.ok(other.audit.losses.some(loss=>loss.reason==='CONTEXT_OWNER_UNRESOLVED'))
})

test('different exact starts remain a conflict rather than being silently combined',()=>{
 const source='通知写明2027年4月6日09:00开始，但另一处写明2027年4月6日10:00开始。'
 const raw={topic:'时间冲突',kind:'event',items:[{key:'a',kind:'event',title:'活动',evidence:[source],times:[
  {role:'start',raw:'2027年4月6日09:00'},{role:'start',raw:'2027年4月6日10:00'},
 ]}],materials:[]}
 const {result,audit}=compileSemanticNotice(raw,{source,referenceTime:'2027-03-01T10:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:SEMANTIC_NOTICE_VERSION})
 assert.ok(audit.losses.some(loss=>loss.reason==='CONFLICTING_TIME_VALUES'))
 assert.ok(result.timePoints.every(point=>point.normalizedValue===null))
})

test('refined contract distinguishes explicit sequence from parallel actions',()=>{
 const raw={topic:'办理',kind:'action',items:[
  {key:'a',kind:'task',title:'填写申请单',action:'填写',object:'申请单',evidence:['请先填写申请单']},
  {key:'b',kind:'task',title:'提交身份证明',action:'提交',object:'身份证明',evidence:['再提交身份证明'],dependsOn:['a']},
 ],materials:[]}
 const options={referenceTime:'2027-03-01T10:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:REFINED_VERSION}
 const ordered=compileSemanticNotice(raw,{...options,source:'请先填写申请单，再提交身份证明。'})
 assert.equal(ordered.result.standaloneTasks[1].dependencyTempIds.length,1)
 const parallel=structuredClone(raw);parallel.items[0].evidence=['请填写申请单'];parallel.items[1].evidence=['并提交身份证明']
 const result=compileSemanticNotice(parallel,{...options,source:'请填写申请单，并提交身份证明。'})
 assert.deepEqual(result.result.standaloneTasks[1].dependencyTempIds,[])
 assert.ok(result.audit.losses.some(loss=>loss.reason==='DEPENDENCY_NOT_SOURCE_GROUNDED'))
 assert.ok(refinedPrompt().includes('“并、同时”本身不是前置关系'))
})

test('a cited action object makes its material required without promoting optional examples',()=>{
 const source='请提交登记表和成绩单；获奖证明如有可附。'
 const raw={topic:'材料',kind:'action',items:[{key:'a',kind:'task',title:'提交材料',action:'提交',object:'登记表和成绩单',evidence:['请提交登记表和成绩单'],materials:['form','grade','proof']}],materials:[
  {key:'form',name:'登记表',owners:['a'],evidence:['请提交登记表和成绩单']},
  {key:'grade',name:'成绩单',owners:['a'],evidence:['请提交登记表和成绩单']},
  {key:'proof',name:'获奖证明',owners:['a'],evidence:['获奖证明如有可附']},
 ]}
 const {result}=compileSemanticNotice(raw,{source,referenceTime:'2027-03-01T10:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:REFINED_VERSION})
 assert.equal(result.materials.find(m=>m.name==='登记表').required,true)
 assert.equal(result.materials.find(m=>m.name==='成绩单').required,true)
 assert.equal(result.materials.find(m=>m.name==='获奖证明').required,false)
})

test('a shared material retains a single required status only when all owners cite its use',()=>{
 const source='请将签字确认表提交给项目组，并将签字确认表提交给实验室。'
 const raw={topic:'确认',kind:'action',items:[
  {key:'a',kind:'task',title:'向项目组提交确认表',action:'提交',object:'签字确认表',evidence:['将签字确认表提交给项目组'],materials:['form']},
  {key:'b',kind:'task',title:'向实验室提交确认表',action:'提交',object:'签字确认表',evidence:['将签字确认表提交给实验室'],materials:['form']},
 ],materials:[{key:'form',name:'签字确认表',owners:['a','b'],evidence:['将签字确认表提交给项目组','将签字确认表提交给实验室']}]}
 const {result}=compileSemanticNotice(raw,{source,referenceTime:'2027-03-01T10:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:REFINED_VERSION})
 assert.equal(result.materials.length,1)
 assert.equal(result.materials[0].required,true)
 assert.equal(result.materials[0].relatedTaskTempIds.length,2)
})
