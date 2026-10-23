import {describe,it,expect} from 'vitest'
import {createSuggestions} from '../lib/parser'
import {buildLocalRecognition} from './pipeline'
import {bindOrdinaryProviderSupport} from './ordinaryProviderSupport'
import {assembleProductFirstSuggestion,groundMaterialChannels} from './materialChannelGrounding'
import {isRecognitionResult} from './schema'
const referenceTime='2026-10-23T10:00:00+08:00',timezone='Asia/Shanghai'
const local=(content:string)=>buildLocalRecognition({content,sourceTitle:'匿名通知',sourceType:'text',referenceTime:new Date(referenceTime),timezone,projects:[],tasks:[]})
const first=(text:string)=>{const raw=local(text),context={sourceId:'anonymous',sourceVersionId:'anonymous-v1',sourceText:text,referenceTime,timezone};return assembleProductFirstSuggestion(bindOrdinaryProviderSupport(raw,context,JSON.stringify({result:raw})).result,context).result}
describe('conditional local delivery preserves literal evidence, not personal applicability',()=>{
 it.each(['；',';','。','\n'])('preserves original separator %j in an ordered contiguous source quotation',separator=>{
  const text='如已被录取，请于10月30日17:00前提交报名表至学院邮箱'+separator+'未录取者无需提交。',r=first(text)
  expect(isRecognitionResult(r)).toBe(true)
  expect(r.standaloneTasks).toHaveLength(1)
  expect(r.standaloneTasks[0]).toMatchObject({title:'提交报名表',actionVerb:'提交',actionObject:'报名表',selected:false})
  expect(r.timePoints[0]).toMatchObject({normalizedValue:'2026-10-30T17:00',precision:'exact',needsConfirmation:false})
  expect(r.materials[0]).toMatchObject({name:'报名表',submissionChannel:'学院邮箱'})
  expect(r.conflicts).toEqual([])
  for(const e of r.evidence)expect(text.includes(e.quote??'')).toBe(true)
  expect(r.evidence[0].quote).toContain(separator)
 })
 it('does not offset citations by trimmed leading whitespace',()=>{const text='  如已被录取，请于10月30日17:00前提交报名表至学院邮箱；未录取者无需提交。  ';for(const item of createSuggestions(text,'text','通知',new Date(referenceTime),timezone))expect(text.includes(item.evidence)).toBe(true)})
 it('keeps separate dates, objects and channels attached to their original source slices',()=>{
  const text='请于10月30日17:00前提交报名表至学院邮箱；请于11月2日18:00前提交申请表至学习通。',r=first(text)
  expect(r.standaloneTasks.map(t=>t.actionObject)).toEqual(['报名表','申请表'])
  expect(r.materials.map(m=>m.submissionChannel)).toEqual(['学院邮箱','学习通'])
  expect(r.timePoints.map(p=>p.normalizedValue)).toEqual(['2026-10-30T17:00','2026-11-02T18:00'])
  expect(r.standaloneTasks.every(t=>t.selected)).toBe(true)
 })
 it.each(['若已被录取','如符合条件','未录取者无需提交','请勿提交','禁止提交','取消提交'])('never selects an unknown, exempt, prohibited or cancelled delivery: %s',condition=>{
  const text=condition.includes('提交')?condition+'报名表至学院邮箱，10月30日17:00前。':condition+'，请于10月30日17:00前提交报名表至学院邮箱。'
  expect(first(text).standaloneTasks.every(t=>!t.selected)).toBe(true)
 })
 it('does not use the corrected citation to justify another material or destination',()=>{
  const text='如已被录取，请于10月30日17:00前提交报名表至学院邮箱；未录取者无需提交。',r=local(text)
  r.materials[0].submissionChannel='教务系统'
  expect(groundMaterialChannels(r,text).result.materials[0].submissionChannel).toBeNull()
  const wrong=local(text);wrong.standaloneTasks[0].actionObject='课程论文';wrong.materials[0].name='课程论文'
  expect(groundMaterialChannels(wrong,text).result.materials[0].submissionChannel).toBeNull()
 })
 it('does not turn an office window or alternative dates into a certain deadline',()=>{
  for(const text of ['若已录取，可在10月30日09:00至11:00办理报名。','如已录取，可选择10月30日或11月2日现场确认。']){
   const r=first(text);expect(r.standaloneTasks.every(t=>!t.selected)).toBe(true)
   expect(r.timePoints.filter(p=>p.type.endsWith('_deadline')&&p.normalizedValue&&!p.needsConfirmation)).toHaveLength(0)
  }
 })
})
