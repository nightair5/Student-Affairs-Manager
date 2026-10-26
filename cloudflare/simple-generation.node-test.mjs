import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSimple,SIMPLE_EXAMPLES,simpleSystemPrompt} from './simple-generation.mjs'
import {compileTwoStep} from './recognition-two-step-compiler-direct-v1.mjs'
import {createWorker} from './worker.mjs'
const referenceTime='2026-10-20T12:00:00+08:00',timezone='Asia/Shanghai',env={DEEPSEEK_API_KEY:'TEST_PLACEHOLDER_NEVER_A_REAL_SECRET',DEEPSEEK_GENERATION_MODE:'simple-1.0'}
test('short, source-aligned independent examples and date precision',()=>{
 assert(simpleSystemPrompt().length<=1500)
 for(const e of SIMPLE_EXAMPLES){for(const item of e.items)assert(e.source.includes(item.quote));const c=compileSimple({items:e.items},{source:e.source,referenceTime,timezone});assert(c.result);assert.equal(c.result.standaloneTasks.length+c.result.events.length,e.items.length)}
})
test('calendar validation rejects impossible days, invented time and reversed ends; accepts timezone midnight',()=>{
 const item={kind:'待办',title:'提交申请表',due:'2026-02-30',quote:'请提交申请表。'}
 assert.equal(compileSimple({items:[item]},{source:item.quote,referenceTime,timezone}).result.timePoints.length,0)
 const dated={...item,due:'2026-10-25T00:00:00+08:00',quote:'请于2026年10月25日零点前提交申请表。'}
 assert.equal(compileSimple({items:[dated]},{source:dated.quote,referenceTime,timezone}).result.timePoints[0].normalizedValue,dated.due)
 const event={kind:'日程',title:'说明会',start:'2026-10-25T15:00',end:'2026-10-25T14:00',quote:'2026年10月25日召开说明会。'}
 const c=compileSimple({items:[event]},{source:event.quote,referenceTime,timezone});assert.equal(c.result.events[0].endTimePointTempId,null)
})
test('window and alternatives cannot become a deadline; cancellation is excluded, qualification is retained',()=>{
 for(const quote of ['办理窗口：2026年10月25日9:00至11:00领取教材。','10月25日或10月26日任选一天领取教材。']){const c=compileSimple({items:[{kind:'待办',title:'领取教材',due:'2026-10-25T09:00',quote}]},{source:quote,referenceTime,timezone});assert.equal(c.result.standaloneTasks.length,1);assert.equal(c.result.timePoints.length,0)}
 const source='原定活动已取消。';assert.equal(compileSimple({items:[{kind:'日程',title:'活动',quote:source}]},{source,referenceTime,timezone}).result.events.length,0)
 const quote='符合条件者请于10月25日前提交奖学金申请表。违规者取消申请资格。'
 const c=compileSimple({items:[{kind:'待办',title:'提交奖学金申请表',due:'2026-10-25',condition:'符合条件者',quote}]},{source:quote,referenceTime,timezone});assert.equal(c.result.standaloneTasks.length,1);assert.equal(c.result.standaloneTasks[0].selected,false)
})
test('retention compiler keeps composed object names and unresolved ownership with an audit',()=>{
 const source='奖学金申请。符合条件者提交电子材料。截止时间：2026年10月25日17:00。'
 const raw={items:[{id:'a',kind:'任务',name:'提交奖学金申请材料',quote:'符合条件者提交电子材料。'}],facts:[{type:'截止',quote:'截止时间：2026年10月25日17:00',item:null}],noAction:false}
 const c=compileTwoStep(raw,{source,referenceTime,timezone});assert(c.result);assert.equal(c.result.standaloneTasks.length,1);assert(c.result.timePoints.some(p=>p.normalizedValue==='2026-10-25T17:00'));assert(c.audit.losses.some(p=>/RETAINED|REVIEW/u.test(p.reason)))
})
test('simple mode actually uses one upstream call and passes the same Worker schema',async()=>{
 const e=SIMPLE_EXAMPLES[2];let calls=0
 const worker=createWorker({fetcher:async()=>{calls++;return new Response(JSON.stringify({model:'deepseek-flash',choices:[{message:{content:JSON.stringify({items:e.items})},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}}),{status:200,headers:{'content-type':'application/json'}})}})
 const response=await worker.fetch(new Request('https://student-affairs.site/api/deepseek/extract',{method:'POST',headers:{'content-type':'application/json',origin:'https://student-affairs.site'},body:JSON.stringify({content:e.source,sourceType:'text',sourceTitle:'匿名通知',referenceTime,timezone})}),env)
 const payload=await response.json();assert.equal(response.status,200,JSON.stringify(payload));assert.equal(calls,1);assert.equal(payload.execution.generationMode,'simple-1.0');assert.equal(payload.result.standaloneTasks.length,1)
})
