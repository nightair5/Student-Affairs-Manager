import test from 'node:test'
import assert from 'node:assert/strict'
import {compileTwoStep as old} from './recognition-two-step-compiler-v2-1-12.mjs'
import {compileTwoStep as current} from './recognition-two-step-compiler-v2-1-13.mjs'
import {validateRecognitionResult} from './recognition-contract.generated.mjs'
import {contextualizeItems} from './two-step-contextual-items.mjs'

const opts=source=>({source,referenceTime:'2026-10-30T09:05:10+08:00',timezone:'Asia/Shanghai',version:'recognition-two-step-2.4.0'})
const sample=(name,quote)=>({items:[{id:'a',kind:'任务',name,quote}],facts:[{type:'截止',quote:'截止11月5日17:00',item:'a'}],noAction:false})
test('topic and referential action retain their title, deadline and real offsets',()=>{
 const source='毕业去向调查。请同学们填写下方问卷。截止11月5日17:00。',raw=sample('填写毕业去向调查问卷','请同学们填写下方问卷'),snapshot=JSON.stringify(raw)
 assert.equal(old(raw,opts(source)).result.standaloneTasks.length,0)
 const next=current(raw,opts(source)),task=next.result.standaloneTasks[0]
 assert.equal(task.title,'填写毕业去向调查问卷')
 assert.equal(next.result.timePoints[0].normalizedValue,'2026-11-05T17:00')
 assert(next.result.evidence.every(e=>source.slice(e.textStart,e.textEnd)===e.quote))
 assert(validateRecognitionResult(next.result,{sourceContent:source}).valid)
 assert.equal(JSON.stringify(raw),snapshot)
})
test('repeated identical mentions are cited as an honest bounded passage',()=>{
 const source='报名说明：提交申请表。其他材料说明后，再提醒提交申请表。截止11月5日17:00。',raw=sample('提交申请表','提交申请表')
 assert.equal(old(raw,opts(source)).result.standaloneTasks.length,0)
 const next=current(raw,opts(source))
 assert.equal(next.result.standaloneTasks.length,1)
 assert.equal(next.result.timePoints[0].normalizedValue,'2026-11-05T17:00')
 assert(next.result.evidence.every(e=>source.slice(e.textStart,e.textEnd)===e.quote))
 assert.equal(next.audit.contextualItems[0].rule,'REPEATED_MENTIONS_AS_ONE_LITERAL_SPAN')
})
test('does not borrow an unrelated topic, a conflicting delivery form or a cancelled action',()=>{
 const cases=[
  ['退宿申请。请填写就业调查问卷。截止11月5日17:00。',sample('填写退宿申请问卷','请填写就业调查问卷')],
  ['电子申请表。请填写纸质申请表。截止11月5日17:00。',sample('填写电子申请表','请填写纸质申请表')],
  ['毕业去向调查。请勿填写下方问卷。截止11月5日17:00。',sample('填写毕业去向调查问卷','请勿填写下方问卷')],
 ]
 for(const [source,raw] of cases){const next=current(raw,opts(source));assert.equal(next.result.standaloneTasks.length,0,source)}
})
test('repeated phrases across different delivery forms or dates remain ambiguous',()=>{
 for(const source of ['电子版提交申请表。纸质版提交申请表。截止11月5日17:00。','先提交申请表，11月1日截止。再次提交申请表。截止11月5日17:00。']){
  const raw=sample('提交申请表','提交申请表')
  assert.equal(contextualizeItems(raw,source).edits.length,0)
  assert.equal(current(raw,opts(source)).result.standaloneTasks.length,0)
 }
})
test('long sourced activity details survive the old description limit without losing their evidence',()=>{
 const chunks=[
  ['主讲人','主讲人：陈老师负责写作训练。'],
  ['参加须知','参加须知：'+('请携带报名资料并提前入场'.repeat(16))+'。'],
  ['活动内容','活动内容：'+('本讲座介绍采访写作的方法与实践'.repeat(24))+'。'],
  ['嘉宾简介','嘉宾简介：'+('曾长期从事新闻传播与教学工作'.repeat(24))+'。'],
 ]
 const source='写作培训。\n'+chunks.map(([,quote])=>quote).join('\n')
 const raw={items:[{id:'event',kind:'活动',name:'写作培训',quote:'写作培训'}],facts:chunks.map(([type,quote])=>({type,quote,item:'event'})),noAction:false}
 const before=old(raw,opts(source)),after=current(raw,opts(source))
 assert(before.audit.losses.some(loss=>loss.reason==='EVENT_DETAIL_EXCEEDS_DESCRIPTION_LIMIT'))
 assert(after.audit.restoredLongEventDetails.length>0)
 assert(after.result.events[0].description.length>800)
 assert(after.result.events[0].description.includes('嘉宾简介：'))
 assert(after.result.evidence.every(e=>source.slice(e.textStart,e.textEnd)===e.quote))
 assert(validateRecognitionResult(after.result,{sourceContent:source}).valid)
})
