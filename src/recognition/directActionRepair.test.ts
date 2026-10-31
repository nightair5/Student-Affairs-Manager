import {describe, expect, it} from 'vitest'
import {compileTwoStep} from '../../cloudflare/recognition-two-step-compiler-v2-1-14.mjs'
import {assembleProductFirstSuggestion} from './materialChannelGrounding'
import {buildLocalRecognition} from './pipeline'
import {convertDirectResult} from './directResult'
import {recoverMissingDirectActions} from './directFallback'
import {parseRecognitionResult} from './schema'

const referenceTime='2026-10-30T15:10:14+08:00', timezone='Asia/Shanghai'
function run(source:string, raw:Parameters<typeof compileTwoStep>[0]) {
 const compiled=parseRecognitionResult(compileTwoStep(raw,{source,referenceTime,timezone,version:'recognition-two-step-2.4.0'}).result)
 const assembled=assembleProductFirstSuggestion(compiled,{sourceText:source,referenceTime,timezone}).result
 const initial=convertDirectResult(assembled,source)
 const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名工程夹具',content:source,referenceTime:new Date(referenceTime),timezone,projects:[],tasks:[]})
 return {initial,actual:recoverMissingDirectActions(initial,local,source)}
}

describe('direct action completion preserves the actual delivery without turning event instructions into tasks',()=>{
 it('clarifies a generic registration task using its uniquely owned source-backed form action',()=>{
  const source='【校园科研志愿者报名调查】\n请同学们填写下方报名表。报名表须在2026年11月5日17:00前通过科研服务平台提交。'
  const raw={items:[{id:'a',kind:'任务',name:'校园科研志愿者报名',quote:'【校园科研志愿者报名调查】'}],facts:[{type:'截止',quote:'2026年11月5日17:00前',item:'a'},{type:'渠道',quote:'科研服务平台',item:'a'},{type:'材料',quote:'报名表',item:'a'}],noAction:false}
  const {initial,actual}=run(source,raw), task=actual.result.standaloneTasks[0]
  expect(actual.result.standaloneTasks).toHaveLength(1)
  expect(task.title).toMatch(/(?:填写|提交).*报名表/u)
  expect(initial.result.standaloneTasks[0].title).toBe('校园科研志愿者报名')
  const added=actual.result.evidence.find(e=>task.evidenceIds.includes(e.id)&&e.quote==='填写下方报名表')!
  expect(source.slice(added.textStart!,added.textEnd!)).toBe(added.quote)
  expect(actual.result.materials.find(m=>m.relatedTaskTempIds.includes(task.tempId))?.name).toBe('报名表')
  expect(actual.result.materials.find(m=>m.relatedTaskTempIds.includes(task.tempId))?.submissionChannel).toBe('科研服务平台')
  expect(actual.result.timePoints.find(p=>p.relatedTaskTempIds.includes(task.tempId))?.normalizedValue).toBe('2026-11-05T17:00')
  expect(()=>parseRecognitionResult(actual.result)).not.toThrow()
 })
 it('does not prepend the action twice when a conditional task already names its form',()=>{
  const source='【科研写作分享会】\n时间：2026年11月5日14:00—15:30。地点：教学楼B203。\n有意参加的同学请于2026年11月2日17:00前填写报名表，通过https://example.edu/signup提交。'
  const raw={items:[{id:'a',kind:'活动',name:'科研写作分享会',quote:'【科研写作分享会】'},{id:'b',kind:'任务',name:'填写报名表',quote:'填写报名表'}],facts:[{type:'开始',quote:'2026年11月5日14:00—15:30',item:'a'},{type:'结束',quote:'2026年11月5日14:00—15:30',item:'a'},{type:'地点',quote:'教学楼B203',item:'a'},{type:'截止',quote:'2026年11月2日17:00前',item:'b'},{type:'材料',quote:'报名表',item:'b'},{type:'渠道',quote:'https://example.edu/signup',item:'b'}],noAction:false}
  const {actual}=run(source,raw),task=actual.result.standaloneTasks.find(t=>t.actionObject==='报名表')
  expect(task).toBeDefined();expect(task!.title).not.toContain('填写如符合条件 填写');expect(task!.title).toMatch(/^(?:如符合条件\s*)?填写报名表$/u)
 })
 it('keeps attendance instructions in their event instead of making a second task',()=>{
  const source='【科学传播工作坊】\n活动主题：让数据讲故事。\n时间：2026年11月6日18:30—20:00。\n地点：学术中心206。\n主讲人：周老师，高校新闻学教师。\n内容：讲解图表制作、数据核验，并现场答疑。\n参加须知：请提前10分钟入场，自带笔记本电脑。'
  const raw={items:[{id:'a',kind:'活动',name:'科学传播工作坊',quote:'【科学传播工作坊】'}],facts:[{type:'开始',quote:'2026年11月6日18:30—20:00',item:'a'},{type:'结束',quote:'2026年11月6日18:30—20:00',item:'a'},{type:'地点',quote:'学术中心206',item:'a'},{type:'主讲人',quote:'主讲人：周老师，高校新闻学教师',item:'a'},{type:'活动内容',quote:'讲解图表制作、数据核验，并现场答疑',item:'a'},{type:'参加须知',quote:'请提前10分钟入场，自带笔记本电脑',item:'a'}],noAction:false}
  const {actual}=run(source,raw)
  expect(actual.result.events).toHaveLength(1)
  expect(actual.result.events[0].description).toContain('提前10分钟入场')
  expect(actual.result.standaloneTasks.map(t=>t.title)).not.toContain('参加须知：请提前10分钟入场')
  expect(actual.result.standaloneTasks.some(t=>/参加须知/u.test(t.title))).toBe(false)
  expect(actual.result.timePoints.find(p=>p.type==='event_end')?.normalizedValue).toBe('2026-11-06T20:00')
  expect(()=>parseRecognitionResult(actual.result)).not.toThrow()
 })
 it('does not turn a standalone heading without a colon into an attendance task',()=>{
  const source='【校园讲座】\n时间：2026年11月6日18:30。地点：教学楼301。\n参加须知\n请提前10分钟入场。'
  const raw={items:[{id:'a',kind:'活动',name:'校园讲座',quote:'【校园讲座】'}],facts:[{type:'开始',quote:'2026年11月6日18:30',item:'a'},{type:'地点',quote:'教学楼301',item:'a'},{type:'参加须知',quote:'请提前10分钟入场',item:'a'}],noAction:false}
  const {actual}=run(source,raw)
  expect(actual.result.events).toHaveLength(1)
  expect(actual.result.standaloneTasks.some(t=>/参加须知/u.test(t.title)),JSON.stringify(actual.result.standaloneTasks)).toBe(false)
 })
 it('does not suppress a separately stated event registration action',()=>{
  const source='【学术写作交流会】\n活动于2026年11月15日14:00在图书馆301举行。请于2026年11月12日17:00前填写参会报名表并提交至活动平台。参加须知：请提前10分钟入场。'
  const raw={items:[{id:'a',kind:'活动',name:'学术写作交流会',quote:'【学术写作交流会】'}],facts:[{type:'开始',quote:'2026年11月15日14:00',item:'a'},{type:'地点',quote:'图书馆301',item:'a'},{type:'参加须知',quote:'请提前10分钟入场',item:'a'}],noAction:false}
  const {actual}=run(source,raw)
  expect(actual.result.events).toHaveLength(1)
  const registration=actual.result.standaloneTasks.find(t=>/(?:填写|提交).*报名表/u.test(t.title))
  expect(registration,JSON.stringify(actual.result.standaloneTasks)).toBeDefined()
  expect(actual.result.timePoints.find(p=>p.relatedTaskTempIds.includes(registration!.tempId))?.normalizedValue).toBe('2026-11-12T17:00')
  expect(actual.result.materials.find(m=>m.relatedTaskTempIds.includes(registration!.tempId))?.submissionChannel).toBe('活动平台')
  expect(actual.result.standaloneTasks.some(t=>/参加须知/u.test(t.title))).toBe(false)
 })
 it('keeps a genuine form submission written inside an attendance section',()=>{
  const source='【学术交流会】\n活动于2026年11月15日14:00在图书馆301举行。\n参加须知：请于2026年11月12日17:00前填写参会报名表并提交至活动平台。'
  const raw={items:[{id:'a',kind:'活动',name:'学术交流会',quote:'【学术交流会】'}],facts:[{type:'开始',quote:'2026年11月15日14:00',item:'a'},{type:'地点',quote:'图书馆301',item:'a'}],noAction:false}
  const {actual}=run(source,raw)
  expect(actual.result.events).toHaveLength(1)
  expect(actual.result.standaloneTasks.some(t=>/(?:填写|提交).*报名表/u.test(t.title)),JSON.stringify(actual.result.standaloneTasks)).toBe(true)
  expect(actual.result.standaloneTasks.some(t=>/参加须知[：:]/u.test(t.title))).toBe(false)
 })
 it('does not turn an explicitly unnecessary form into an affirmative task',()=>{
  const source='【志愿服务报名】\n报名已经结束，无需填写报名表。'
  const raw={items:[{id:'a',kind:'任务',name:'志愿服务报名',quote:'【志愿服务报名】'}],facts:[{type:'材料',quote:'报名表',item:'a'}],noAction:false}
  const {actual}=run(source,raw)
  expect(actual.result.standaloneTasks.some(t=>/(?:填写|提交).*报名表/u.test(t.title)),JSON.stringify(actual.result.standaloneTasks)).toBe(false)
 })
 it('does not select one form when the same generic task owns two distinct forms',()=>{
  const source='【项目报名】\n请填写申请表和登记表。'
  const raw={items:[{id:'a',kind:'任务',name:'项目报名',quote:'【项目报名】'}],facts:[{type:'材料',quote:'申请表',item:'a'},{type:'材料',quote:'登记表',item:'a'}],noAction:false}
  const {initial,actual}=run(source,raw)
  const original=initial.result.standaloneTasks[0]
  expect(original).toBeDefined()
  expect(actual.result.standaloneTasks.find(t=>t.tempId===original.tempId)?.title).toBe(original.title)
 })
 it('does not present an example form as the required action',()=>{
  const source='【项目报名】\n示例：填写申请表。请在平台报名。'
  const raw={items:[{id:'a',kind:'任务',name:'项目报名',quote:'【项目报名】'}],facts:[{type:'材料',quote:'申请表',item:'a'}],noAction:false}
  const {initial,actual}=run(source,raw),original=initial.result.standaloneTasks[0]
  expect(original).toBeDefined()
  expect(actual.result.standaloneTasks.find(t=>t.tempId===original.tempId)?.title).toBe(original.title)
 })
 it('does not assign an action on one document to a different later form',()=>{
  const source='【项目报名】\n请填写作品表并查看报名表。'
  const raw={items:[{id:'a',kind:'任务',name:'项目报名',quote:'【项目报名】'}],facts:[{type:'材料',quote:'报名表',item:'a'}],noAction:false}
  const {initial,actual}=run(source,raw),original=initial.result.standaloneTasks[0]
  expect(original).toBeDefined()
  expect(actual.result.standaloneTasks.find(t=>t.tempId===original.tempId)?.title).toBe(original.title)
 })
})
