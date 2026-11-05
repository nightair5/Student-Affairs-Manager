import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'
import {createWorker} from './worker.mjs'
import {readFileSync} from 'node:fs'

const referenceTime='2026-11-05T12:00:00+08:00',version='recognition-semantic-notice-3.6.0'
const source='学术交流会将于2026年11月20日14:00在文科楼201举行。有意向的同学可扫描原通知二维码加入交流社群。'
const eventQuote='学术交流会将于2026年11月20日14:00在文科楼201举行',notice='有意向的同学可扫描原通知二维码加入交流社群'
const sample=()=>({topic:'学术交流会',kind:'mixed',items:[
 {key:'event',kind:'event',title:'学术交流会',evidence:[eventQuote],times:[{role:'start',raw:'2026年11月20日14:00'}],location:'文科楼201',notices:[notice]},
 {key:'join',kind:'task',title:'加入交流社群',action:'加入',object:'交流社群',evidence:[notice],requirements:[notice],eventRelation:{kind:'incidental',eventKey:'event',evidence:notice}},
],materials:[]})
const compile=(raw=sample(),input=source,promptVersion=version)=>compileSemanticNotice(raw,{source:input,referenceTime,timezone:'Asia/Shanghai',promptVersion})

test('an explicitly related minor action is retained as a cited event notice rather than a second task',()=>{
 const {result,audit}=compile()
 assert.equal(result.events.length,1);assert.equal(result.standaloneTasks.length,0)
 assert.match(result.events[0].description,/参加须知：有意向的同学可扫描原通知二维码加入交流社群/u)
 assert.ok(result.events[0].evidenceIds.some(id=>result.evidence.find(e=>e.id===id)?.quote===notice))
 assert.ok(audit.facts.some(f=>f.role==='event_incidental_notice'))
})

test('a cited related action is added to the correct event even if the model omitted its notices array',()=>{
 const raw=sample();raw.items[0].notices=[]
 const {result}=compile(raw)
 assert.equal(result.standaloneTasks.length,0);assert.match(result.events[0].description,/参加须知：有意向的同学可扫描原通知二维码加入交流社群/u)
})

test('independent deadline, submission and user-owned material remain separate tasks',()=>{
 const dueText='学术交流会将于2026年11月20日14:00在文科楼201举行。请于11月18日17:00前填写报名表。'
 const due=sample();due.items[1]={key:'sign',kind:'task',title:'填写报名表',action:'填写',object:'报名表',evidence:['请于11月18日17:00前填写报名表'],times:[{role:'deadline',raw:'11月18日17:00前'}],eventRelation:{kind:'incidental',eventKey:'event',evidence:'请于11月18日17:00前填写报名表'}}
 const actual=compile(due,dueText).result
 assert.equal(actual.standaloneTasks.length,1);assert.ok(actual.timePoints.some(point=>point.type==='task_deadline'&&point.normalizedValue==='2026-11-18T17:00'))
 const deliveryText='学术交流会将于2026年11月20日14:00在文科楼201举行。请提前提交作品集。'
 const delivery=sample();delivery.items[1]={key:'portfolio',kind:'task',title:'提交作品集',action:'提交',object:'作品集',evidence:['请提前提交作品集'],eventRelation:{kind:'incidental',eventKey:'event',evidence:'请提前提交作品集'}}
 assert.equal(compile(delivery,deliveryText).result.standaloneTasks.length,1)
 const carryText='学术交流会将于2026年11月20日14:00在文科楼201举行。请携带学生证。'
 const carry=sample();carry.items[1]={key:'card',kind:'task',title:'携带学生证',action:'携带',object:'学生证',evidence:['请携带学生证'],materials:['id'],eventRelation:{kind:'incidental',eventKey:'event',evidence:'请携带学生证'}}
 carry.materials=[{key:'id',name:'学生证',owners:['card'],evidence:['学生证']}]
 assert.equal(compile(carry,carryText).result.standaloneTasks.length,1)
})

test('does not guess a relationship when it is missing, ambiguous, ungrounded or an old contract',()=>{
 const missing=sample();delete missing.items[1].eventRelation
 assert.equal(compile(missing).result.standaloneTasks.length,1)
 const wrong=sample();wrong.items[1].eventRelation.evidence='不存在的提示'
 assert.equal(compile(wrong).result.standaloneTasks.length,1)
 const independent=sample();independent.items[1].eventRelation.kind='independent'
 assert.equal(compile(independent).result.standaloneTasks.length,1)
 assert.equal(compile(sample(),source,'recognition-semantic-notice-3.5.0').result.standaloneTasks.length,1)
})

test('a source-backed relation attaches only to its named event when there are two events',()=>{
 const text='上午产品讲座于11月21日9:00在A201举行。下午设计工作坊于11月21日14:00在B305举行；工作坊参加者可扫描二维码加入交流社群。'
 const quote='工作坊参加者可扫描二维码加入交流社群'
 const raw={topic:'两场活动',kind:'mixed',items:[
  {key:'morning',kind:'event',title:'上午产品讲座',evidence:['上午产品讲座于11月21日9:00在A201举行'],times:[{role:'start',raw:'11月21日9:00'}],location:'A201'},
  {key:'afternoon',kind:'event',title:'下午设计工作坊',evidence:['下午设计工作坊于11月21日14:00在B305举行'],times:[{role:'start',raw:'11月21日14:00'}],location:'B305'},
  {key:'join',kind:'task',title:'加入交流社群',action:'加入',object:'交流社群',evidence:[quote],eventRelation:{kind:'incidental',eventKey:'afternoon',evidence:'下午设计工作坊于11月21日14:00在B305举行；工作坊参加者可扫描二维码加入交流社群'}},
 ],materials:[]}
 const {result}=compile(raw,text)
 assert.equal(result.standaloneTasks.length,0);assert.equal(result.events.length,2)
 assert.doesNotMatch(result.events.find(event=>event.title==='上午产品讲座').description,/交流社群/u)
 assert.match(result.events.find(event=>event.title==='下午设计工作坊').description,/交流社群/u)
 const ambiguous=structuredClone(raw);ambiguous.items[2].eventRelation.evidence=quote
 assert.equal(compile(ambiguous,text).result.standaloneTasks.length,1)
})

test('does not fold an action that another task depends on',()=>{
 const raw=sample();raw.items.push({key:'later',kind:'task',title:'填写资料',action:'填写',object:'资料',evidence:['加入交流社群'],dependsOn:['join']})
 assert.ok(compile(raw).result.standaloneTasks.some(task=>task.title==='加入交流社群'))
})

test('does not lose an extra channel or separately cited requirement when folding',()=>{
 const text=source+'群链接为https://example.org/group，请使用实名。'
 const withChannel=sample();withChannel.items[1].channel='https://example.org/group'
 assert.equal(compile(withChannel,text).result.standaloneTasks.length,1)
 const withSecondEvidence=sample();withSecondEvidence.items[1].evidence=[notice,'请使用实名']
 assert.equal(compile(withSecondEvidence,text).result.standaloneTasks.length,1)
})

test('the opt-in request actually uses the new event contract and compiles its related notice',async()=>{
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'))
 let prompt=''
 const worker=createWorker({logger:()=>{},fetcher:async(_url,options)=>{
  prompt=JSON.parse(options.body).messages[0].content
  return Response.json({model:'fixture-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify(sample())}}],usage:{prompt_tokens:100,completion_tokens:30,total_tokens:130}})
 }})
 const origin='https://student-affairs-manager.example'
 const env={...config.vars,DEEPSEEK_API_KEY:'SYNTHETIC_TEST_PLACEHOLDER',EXTRACTION_RATE_LIMITER:{limit:async()=>({success:true})}}
 const request=new Request(origin+'/api/deepseek/extract',{method:'POST',headers:{origin,'content-type':'application/json','x-student-affairs-recognition':'semantic-notice-3.6'},body:JSON.stringify({sourceType:'text',content:source,referenceTime,timezone:'Asia/Shanghai'})})
 const body=await(await worker.fetch(request,env)).json()
 assert.equal(body.execution.generationMode,'semantic-notice-3.6')
 assert.equal(body.result.promptVersion,version)
 assert.match(prompt,/活动与附带提示/u)
 assert.equal(body.result.standaloneTasks.length,0)
 assert.match(body.result.events[0].description,/交流社群/u)
})
