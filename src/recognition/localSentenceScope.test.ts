import {expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {assembleProductFirstSuggestion} from './materialChannelGrounding'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'
import {localSameDayTime} from './localReferencedFacts'
import {createSuggestions} from '../lib/parser'
import {scopeLocalDirectiveCandidates} from './localDirectiveCandidates'

const referenceTime='2026-11-15T09:00:00+08:00',timezone='Asia/Shanghai'
function recognize(source:string){
 const base=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:new Date(referenceTime),timezone,projects:[],tasks:[]})
 const assembled=assembleProductFirstSuggestion(base,{sourceText:source,referenceTime,timezone}).result
 return convertDirectResult(improveDirectFallback(assembled,source,{scopeAware:true,timezone}),source,undefined,{scopeAware:true}).result
}

it('resolves an explicit same-day reference across sentence stops without resurrecting a cancelled event',()=>{
 for(const mark of ['。','！','？','；']){
  const r=recognize(`原定11月20日9:00的校园参观取消${mark}同日15:00在图书馆的书展照常举行。`)
  expect(r.events).toHaveLength(1)
  expect(r.events[0].title).toBe('书展');expect(r.events[0].location).toBe('图书馆')
  expect(r.timePoints.find(p=>p.tempId===r.events[0].startTimePointTempId)?.normalizedValue).toBe('2026-11-20T15:00')
  expect(r.events[0].description).not.toContain('日期待定')
 }
})

it('retains both endpoints of a second, cross-midnight event with a separately cited day',()=>{
 const r=recognize('11月22日09:00在甲楼举行校史讲座。同日22:30至次日00:15在天台进行观测活动。')
 expect(r.events).toHaveLength(2)
 const first=r.events.find(e=>e.title==='校史讲座')!,night=r.events.find(e=>e.title==='观测活动')!
 expect(first.location).toBe('甲楼');expect(night.location).toBe('天台')
 expect(r.timePoints.find(p=>p.tempId===first.startTimePointTempId)?.normalizedValue).toBe('2026-11-22T09:00')
 expect(r.timePoints.find(p=>p.tempId===night.startTimePointTempId)?.normalizedValue).toBe('2026-11-22T22:30')
 expect(r.timePoints.find(p=>p.tempId===night.endTimePointTempId)?.normalizedValue).toBe('2026-11-23T00:15')
})

it('retains an owned clock when the day has alternatives, a revision, a paragraph break or a deadline antecedent',()=>{
 for(const prefix of ['周一或周二安排导览。','原定周一的导览改为周二。','周一举行导览。\n','请周二17:00前在平台填写信息。']){
  const source=prefix+'同日15:00在北馆的摄影展照常举行。'
  expect(localSameDayTime(source,'摄影展','15:00',referenceTime,timezone)).toBeNull()
  const r=recognize(source),event=r.events.find(e=>e.title==='摄影展')!
  expect(event).toBeTruthy()
  expect(r.timePoints.find(p=>p.tempId===event.startTimePointTempId)?.normalizedValue??null).toBeNull()
  expect(event.description).toContain('15:00（日期待定）')
 }
})

it('does not skip an intervening deadline to borrow an earlier event day',()=>{
 const r=recognize('11月20日09:00举行开放日。请于11月18日17:00前提交申请表。同日15:00在实验楼举行安全培训。')
 expect(r.events).toHaveLength(2)
 const training=r.events.find(e=>e.title==='安全培训')!
 expect(r.timePoints.find(p=>p.tempId===training.startTimePointTempId)?.normalizedValue).toBeNull()
 expect(training.description).toContain('15:00（日期待定）')
 expect(r.timePoints.some(p=>p.type.endsWith('_deadline')&&p.normalizedValue==='2026-11-18T17:00')).toBe(true)
})

it('selects the actual directive rather than treating the application purpose as attendance',()=>{
 const r=recognize('参加课程成果评选，请周二前在平台填写信息，周五20:00前把作品PDF发送至 review@example.edu。')
 expect(r.events).toHaveLength(0);expect(r.standaloneTasks).toHaveLength(2)
 const fill=r.standaloneTasks.find(t=>t.actionVerb==='填写')!,send=r.standaloneTasks.find(t=>t.actionVerb==='发送')!
 expect(fill.actionObject).toBe('信息');expect(send.actionObject).toBe('作品PDF')
 expect(r.timePoints.some(p=>p.relatedTaskTempIds.includes(fill.tempId)&&p.normalizedValue==='2026-11-17')).toBe(true)
 expect(r.timePoints.some(p=>p.relatedTaskTempIds.includes(send.tempId)&&p.normalizedValue==='2026-11-20T20:00')).toBe(true)
})

it('keeps long background, current directives and separately named requirements in their own scopes',()=>{
 const source='研究交流申请\n欢迎有意交流的同学申报，往年入选作品只作展示。\n申请者请周二12:00前在学院平台填写申请表；周四18:30前把研究提纲PDF发送至 study@example.edu。\n研究提纲须本人签名，最多3页。研究中心统一审核后公布结果，申请者无需参加审核。'
 const r=recognize(source)
 expect(r.events).toHaveLength(0);expect(r.standaloneTasks).toHaveLength(2)
 const fill=r.standaloneTasks.find(t=>t.actionVerb==='填写')!,send=r.standaloneTasks.find(t=>t.actionVerb==='发送')!
 expect(r.materials.filter(m=>send.materialTempIds.includes(m.tempId)).some(m=>m.requirements?.some(req=>req.includes('本人签名，最多3页')))).toBe(true)
 expect(r.materials.filter(m=>fill.materialTempIds.includes(m.tempId)).every(m=>!m.requirements?.some(req=>req.includes('签名')))).toBe(true)
 expect(r.timePoints.some(p=>p.relatedTaskTempIds.includes(fill.tempId)&&p.normalizedValue==='2026-11-17T12:00')).toBe(true)
 expect(r.timePoints.some(p=>p.relatedTaskTempIds.includes(send.tempId)&&p.normalizedValue==='2026-11-19T18:30')).toBe(true)
})

it('preserves source-described paper/electronic choice branches without requiring the suffix 版',()=>{
 const r=recognize('项目申报采取电子或纸质二选一：电子申请表于周四18:00前上传平台；纸质申请表于周五12:00前交服务窗口。评审组下周一审核材料，申请人无需到场。')
 expect(r.events).toHaveLength(0);expect(r.standaloneTasks).toHaveLength(2)
 expect(r.conflicts.some(c=>c.id.startsWith('sem-choice-')&&c.entityTempIds.length===2&&!c.requiresDecision)).toBe(true)
 expect(r.materials.map(m=>m.submissionChannel)).toEqual(['平台','服务窗口'])
 expect(r.timePoints.filter(p=>p.normalizedValue).map(p=>p.normalizedValue).sort()).toEqual(['2026-11-19T18:00','2026-11-20T12:00'])
})

it('keeps eligibility and voluntary context when the original directive is already correct',()=>{
 const qualified=recognize('申请资助须为在读学生；请周四前填写申请表。')
 expect(qualified.standaloneTasks).toHaveLength(1)
 expect(qualified.standaloneTasks[0].description).toContain('须为在读学生')
 const text='【公共服务体验项目】本项目邀请学生了解服务台的工作流程。参与者可先浏览介绍，再自主决定是否申请。申请者请在周日18:00前填写报名表。'
 const parsed=createSuggestions(text,'text','匿名通知',new Date(referenceTime),timezone,{sourceOffsets:true})
 expect(parsed[0].description).toContain('自主决定是否申请')
 expect(scopeLocalDirectiveCandidates(parsed,text,'text','匿名通知',new Date(referenceTime),timezone)).toEqual(parsed)
})
