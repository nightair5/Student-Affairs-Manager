import test from 'node:test'
import assert from 'node:assert/strict'
import {compileTwoStep as before} from './recognition-two-step-compiler-v2-1-13.mjs'
import {compileTwoStep as after} from './recognition-two-step-compiler-v2-1-14.mjs'
import {validateRecognitionResult} from './recognition-contract.generated.mjs'
import {runTwoStep21Generation} from './two-step-generation-v2-1.mjs'
import {extractionProfile} from './extraction-profile.mjs'

const opts=source=>({source,referenceTime:'2026-10-30T09:05:10+08:00',timezone:'Asia/Shanghai',version:'recognition-two-step-2.4.0'})
const fixture=(name,quote,channel='下方问卷')=>({items:[{id:'a',kind:'任务',name,quote}],facts:[{type:'截止',quote:'截止11月5日17:00',item:'a'},...(channel?[{type:'渠道',quote:channel,item:'a'}]:[])],noAction:false})

test('a noun-only item keeps a single action and subject already present in its quoted source',()=>{
 for(const [source,name,quote,title] of [
  ['毕业去向调查。请同学们填写下方问卷。截止11月5日17:00。','毕业去向调查问卷','毕业去向调查。请同学们填写下方问卷。','填写毕业去向调查问卷'],
  ['课程反馈。请填写下方问卷。截止11月5日17:00。','课程反馈问卷','课程反馈。请填写下方问卷。','填写课程反馈问卷'],
  ['课程反馈。请填写下方问卷。截止11月5日17:00。','课程反馈','课程反馈。请填写下方问卷。','填写课程反馈问卷'],
  ['请提交课程报告。截止11月5日17:00。','课程报告','请提交课程报告。','提交课程报告'],
 ]){
  const raw=fixture(name,quote,source.includes('问卷')?'下方问卷':null),snapshot=JSON.stringify(raw)
  const old=before(raw,opts(source)),next=after(raw,opts(source))
  assert.equal(old.result.standaloneTasks.length,0)
  assert.equal(next.result.standaloneTasks[0]?.title,title)
  assert.equal(next.result.timePoints.find(p=>p.type==='task_deadline')?.normalizedValue,'2026-11-05T17:00')
  assert(next.result.evidence.every(e=>source.slice(e.textStart,e.textEnd)===e.quote))
  assert(next.audit.contextualItems.some(e=>e.rule==='SINGLE_ACTION_IN_ITEM_SOURCE_QUOTE'))
  assert(validateRecognitionResult(next.result,{sourceContent:source}).valid)
  assert.equal(JSON.stringify(raw),snapshot)
 }
})
test('the configured worker generation selects the new compiler',async()=>{
 const source='课程反馈。请填写下方问卷。截止11月5日17:00。'
 const raw=fixture('课程反馈问卷','课程反馈。请填写下方问卷。')
 const out=await runTwoStep21Generation({fetcher:async()=>new Response(JSON.stringify({model:'deepseek-flash',choices:[{message:{content:JSON.stringify(raw)},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}),{status:200,headers:{'content-type':'application/json'}}),apiKey:'SYNTHETIC_TEST_ONLY',profile:extractionProfile({}),source,referenceTime:opts(source).referenceTime,timezone:'Asia/Shanghai',mode:'two-step-2.4',compilerVersion:'2.1.14',userText:source})
 assert(out.ok)
 assert.equal(out.execution.twoStep.compilerVersion,'two-step-compiler-2.1.14')
 assert.equal(out.result.standaloneTasks[0]?.title,'填写课程反馈问卷')
})
test('a generic referential task retains its uniquely stated preceding topic',()=>{
 const source='课程反馈。请同学们填写下方问卷。截止11月5日17:00。'
 const raw=fixture('填写下方问卷','请同学们填写下方问卷')
 const next=after(raw,opts(source))
 assert.equal(next.result.standaloneTasks[0]?.title,'填写课程反馈问卷')
 assert.equal(next.result.timePoints.find(p=>p.type==='task_deadline')?.normalizedValue,'2026-11-05T17:00')
 assert(next.audit.contextualItems.some(e=>e.rule==='REFERENTIAL_ACTION_WITH_PRECEDING_TOPIC'))
 assert(next.result.evidence.every(e=>source.slice(e.textStart,e.textEnd)===e.quote))
})
test('a generic title does not borrow a topic across cancellation, history or competing actions',()=>{
 for(const [source,quote] of [
  ['课程反馈。请勿填写下方问卷。截止11月5日17:00。','请勿填写下方问卷'],
  ['课程反馈。不要填写下方问卷。截止11月5日17:00。','不要填写下方问卷'],
  ['课程反馈。已填写下方问卷。截止11月5日17:00。','已填写下方问卷'],
  ['课程反馈。曾经填写下方问卷。截止11月5日17:00。','曾经填写下方问卷'],
  ['课程反馈。请填写下方问卷并提交报告。截止11月5日17:00。','请填写下方问卷并提交报告'],
  ['课程反馈。请填写下方问卷或等待通知。截止11月5日17:00。','请填写下方问卷或等待通知'],
  ['请填写下方问卷。截止11月5日17:00。','请填写下方问卷'],
 ]){
  const next=after(fixture('填写下方问卷',quote),opts(source))
  assert(!next.audit.contextualItems.some(e=>e.rule==='REFERENTIAL_ACTION_WITH_PRECEDING_TOPIC'),source)
 }
})
test('does not promote a cancelled, ambiguous, unrelated or already completed action',()=>{
 const cases=[
  ['课程反馈。请勿填写下方问卷。截止11月5日17:00。','课程反馈问卷','课程反馈。请勿填写下方问卷。'],
  ['课程反馈。不要填写下方问卷。截止11月5日17:00。','课程反馈问卷','课程反馈。不要填写下方问卷。'],
  ['课程反馈。请填写下方问卷并提交报告。截止11月5日17:00。','课程反馈问卷','课程反馈。请填写下方问卷并提交报告。'],
  ['退宿申请。请填写下方问卷。截止11月5日17:00。','课程反馈问卷','退宿申请。请填写下方问卷。'],
  ['课程反馈。已填写下方问卷。截止11月5日17:00。','课程反馈问卷','课程反馈。已填写下方问卷。'],
  ['课程反馈。曾经填写下方问卷。截止11月5日17:00。','课程反馈问卷','课程反馈。曾经填写下方问卷。'],
  ['课程反馈。请填写下方问卷或提交纸质表。截止11月5日17:00。','课程反馈问卷','课程反馈。请填写下方问卷或提交纸质表。'],
 ]
 for(const [source,name,quote] of cases){
  const out=after(fixture(name,quote),opts(source))
  assert(!out.audit.contextualItems.some(e=>e.rule==='SINGLE_ACTION_IN_ITEM_SOURCE_QUOTE'),source)
 }
})
