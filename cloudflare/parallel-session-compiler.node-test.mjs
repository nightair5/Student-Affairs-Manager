import test from 'node:test'
import assert from 'node:assert/strict'
import {compileTwoStep as before} from './recognition-two-step-compiler-v2-1-14.mjs'
import {compileTwoStep as after} from './recognition-two-step-compiler-v2-1-15.mjs'
import {runTwoStep21Generation} from './two-step-generation-v2-1.mjs'
import {extractionProfile} from './extraction-profile.mjs'

// Anonymous engineering notice, not model output or a user's notice.
const source='【校园实践活动：宣讲会+交流会】\n【宣讲时间】11月3日（周二）9:30-10:30\n【交流时间】11月3日（周二）10:30-12:00\n【活动地点】文化中心报告厅（宣讲）、展厅（交流）\n宣讲会结束后参加交流会。'
const raw={items:[{id:'a',kind:'活动',name:'校园实践活动宣讲会',quote:'宣讲会'},{id:'b',kind:'活动',name:'校园实践活动交流会',quote:'交流会'}],facts:[{type:'开始',quote:'11月3日（周二）9:30-10:30',item:'a'},{type:'结束',quote:'11月3日（周二）9:30-10:30',item:'a'},{type:'地点',quote:'文化中心报告厅（宣讲）',item:'a'},{type:'开始',quote:'11月3日（周二）10:30-12:00',item:'b'},{type:'结束',quote:'11月3日（周二）10:30-12:00',item:'b'},{type:'地点',quote:'展厅（交流）',item:'b'}],noAction:false}
const opts={source,referenceTime:'2026-10-30T09:05:10+08:00',timezone:'Asia/Shanghai',version:'recognition-two-step-2.4.0'}

test('retains two model activities when their own unique labelled time identifies them',()=>{
 const snapshot=JSON.stringify(raw),old=before(raw,opts),next=after(raw,opts)
 assert.equal(old.result.events.length,0);assert.equal(next.result.events.length,2)
 assert.equal(next.audit.contextualItems.filter(x=>x.rule==='UNIQUE_LABELLED_SESSION_TIME_ANCHOR').length,2)
 for(const event of next.result.events){const start=next.result.timePoints.find(p=>p.tempId===event.startTimePointTempId);const end=next.result.timePoints.find(p=>p.tempId===event.endTimePointTempId);assert(start?.normalizedValue);assert(end?.normalizedValue)}
 assert(next.result.evidence.every(e=>source.slice(e.textStart,e.textEnd)===e.quote));assert.equal(JSON.stringify(raw),snapshot)
})
test('does not guess when the time label does not identify a unique item',()=>{
 const ambiguous=structuredClone(raw);ambiguous.items[1].name='校园实践活动宣讲交流会'
 const next=after(ambiguous,opts)
 assert(!next.audit.contextualItems.some(x=>x.id==='a'&&x.rule==='UNIQUE_LABELLED_SESSION_TIME_ANCHOR'))
})
test('does not invent an event title unsupported by the source',()=>{
 const ungrounded=structuredClone(raw);ungrounded.items[0].name='不存在的宣讲会'
 const next=after(ungrounded,opts)
 assert(!next.result.events.some(e=>e.title==='不存在的宣讲会'))
})
test('does not reactivate a cancelled or rescheduled session from its old time line',()=>{
 for(const update of ['宣讲会取消，不再举行。交流会正常举行。','宣讲会时间更正为11月4日9:30，原时间作废。交流会正常举行。','本次活动全部取消。']){
  const amended=source+'\n'+update,next=after(raw,{...opts,source:amended})
  assert(!next.audit.contextualItems.some(x=>x.id==='a'&&x.rule==='UNIQUE_LABELLED_SESSION_TIME_ANCHOR'),update)
  assert(!next.result.events.some(e=>e.title==='校园实践活动宣讲会'&&next.result.timePoints.some(p=>p.tempId===e.startTimePointTempId&&p.normalizedValue==='2026-11-03T09:30')),update)
 }
})
test('an unrelated eligibility cancellation does not hide a valid session',()=>{
 const amended=source+'\n违反活动纪律者取消资格。',next=after(raw,{...opts,source:amended})
 assert(next.audit.contextualItems.some(x=>x.id==='a'&&x.rule==='UNIQUE_LABELLED_SESSION_TIME_ANCHOR'))
})
test('generation selects compiler 2.1.15 while preserving the old compiler',async()=>{
 const generate=compilerVersion=>runTwoStep21Generation({fetcher:async()=>new Response(JSON.stringify({model:'deepseek-flash',choices:[{message:{content:JSON.stringify(raw)},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}),{status:200,headers:{'content-type':'application/json'}}),apiKey:'SYNTHETIC_TEST_ONLY',profile:extractionProfile({}),source,referenceTime:opts.referenceTime,timezone:'Asia/Shanghai',mode:'two-step-2.4',compilerVersion,userText:source})
 const old=await generate('2.1.14'),next=await generate('2.1.15')
 assert(old.ok&&next.ok);assert.equal(old.result.events.length,0);assert.equal(next.result.events.length,2);assert.equal(next.execution.twoStep.compilerVersion,'two-step-compiler-2.1.15')
})
