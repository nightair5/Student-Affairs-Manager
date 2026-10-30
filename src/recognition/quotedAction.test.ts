import {describe,expect,it} from 'vitest'
import {compileTwoStep} from '../../cloudflare/recognition-two-step-compiler-v2-1-14.mjs'
import {assembleProductFirstSuggestion} from './materialChannelGrounding'
import {convertDirectResult} from './directResult'
import {parseRecognitionResult} from './schema'

describe('an explicit source action reaches the direct result even when the model only names its object',()=>{
 it('keeps the action, topic and deadline through compilation and both product conversions',()=>{
  const source='课程反馈。请填写下方问卷。截止11月5日17:00。'
  const raw={items:[{id:'a',kind:'任务',name:'课程反馈问卷',quote:'课程反馈。请填写下方问卷。'}],facts:[{type:'截止',quote:'截止11月5日17:00',item:'a'},{type:'渠道',quote:'下方问卷',item:'a'}],noAction:false}
  const referenceTime='2026-10-30T09:05:10+08:00',timezone='Asia/Shanghai'
  const compiled=parseRecognitionResult(compileTwoStep(raw,{source,referenceTime,timezone,version:'recognition-two-step-2.4.0'}).result)
  const assembled=assembleProductFirstSuggestion(compiled,{sourceText:source,referenceTime,timezone}).result
  const result=convertDirectResult(assembled,source).result
  expect(result.standaloneTasks.map(t=>t.title)).toContain('填写课程反馈问卷')
  expect(result.timePoints.some(p=>p.type==='task_deadline'&&p.normalizedValue==='2026-11-05T17:00')).toBe(true)
 })
 it('retains the preceding topic when the model only describes a referential action',()=>{
  const source='课程反馈。请同学们填写下方问卷。截止11月5日17:00。'
  const raw={items:[{id:'a',kind:'任务',name:'填写下方问卷',quote:'请同学们填写下方问卷'}],facts:[{type:'截止',quote:'截止11月5日17:00',item:'a'}],noAction:false}
  const referenceTime='2026-10-30T09:05:10+08:00',timezone='Asia/Shanghai'
  const compiled=parseRecognitionResult(compileTwoStep(raw,{source,referenceTime,timezone,version:'recognition-two-step-2.4.0'}).result)
  const assembled=assembleProductFirstSuggestion(compiled,{sourceText:source,referenceTime,timezone}).result
  const result=convertDirectResult(assembled,source).result
  expect(result.standaloneTasks.map(t=>t.title)).toContain('填写课程反馈问卷')
  expect(result.timePoints.some(p=>p.type==='task_deadline'&&p.normalizedValue==='2026-11-05T17:00')).toBe(true)
 })
 it('keeps a model topic when the quoted passage supplies its referential action and object',()=>{
  const source='课程反馈。请填写下方问卷。截止11月5日17:00。'
  const raw={items:[{id:'a',kind:'任务',name:'课程反馈',quote:'课程反馈。请填写下方问卷。'}],facts:[{type:'截止',quote:'截止11月5日17:00',item:'a'},{type:'渠道',quote:'下方问卷',item:'a'}],noAction:false}
  const referenceTime='2026-10-30T09:05:10+08:00',timezone='Asia/Shanghai'
  const compiled=parseRecognitionResult(compileTwoStep(raw,{source,referenceTime,timezone,version:'recognition-two-step-2.4.0'}).result)
  const assembled=assembleProductFirstSuggestion(compiled,{sourceText:source,referenceTime,timezone}).result
  const result=convertDirectResult(assembled,source).result
  expect(result.standaloneTasks.map(t=>t.title)).toContain('填写课程反馈问卷')
  expect(result.timePoints.some(p=>p.type==='task_deadline'&&p.normalizedValue==='2026-11-05T17:00')).toBe(true)
 })
})
