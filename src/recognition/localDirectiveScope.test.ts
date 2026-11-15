import {expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {assembleProductFirstSuggestion} from './materialChannelGrounding'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'

const referenceTime='2026-11-15T12:00:00+08:00',timezone='Asia/Shanghai'
function recognize(content:string){
 const raw=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content,referenceTime:new Date(referenceTime),timezone,projects:[],tasks:[]})
 const assembled=assembleProductFirstSuggestion(raw,{sourceText:content,referenceTime,timezone}).result
 return convertDirectResult(improveDirectFallback(assembled,content,{scopeAware:true,timezone}),content,undefined,{scopeAware:true}).result
}

it('retains conditional extra deliveries with their own dates, materials and unknown applicability',()=>{
 for(const separator of ['；','。\n','。\n\u00a0\n']){
  const r=recognize('【调查项目申请】\n请周二12:00前填写申请表'+separator+'若使用第三方资料，还需周五17:00前提交授权书至资料平台。授权书须本人签名，最多2页。')
  expect(r.standaloneTasks).toHaveLength(2)
  const form=r.standaloneTasks.find(t=>t.actionVerb==='填写')!,authorization=r.standaloneTasks.find(t=>t.actionObject==='授权书')!
  expect(form.title).not.toContain('如符合条件')
  expect(authorization.title).toContain('如符合条件')
  expect(authorization.description).toContain('适用条件待确认：使用第三方资料')
  expect(r.timePoints.find(p=>p.relatedTaskTempIds.includes(authorization.tempId))?.normalizedValue).toBe('2026-11-20T17:00')
  const m=r.materials.find(m=>m.relatedTaskTempIds.includes(authorization.tempId))!
  expect(m.submissionChannel).toBe('资料平台');expect(m.requirements?.join('')).toContain('最多2页')
  expect(r.goalGroups?.[0].taskTempIds).toHaveLength(2)
 }
})

it('keeps overlapping conditions separate without inventing order, choices or a shared cutoff',()=>{
 const r=recognize('【课程成果验收】\n请周四前上传成果报告；如使用访谈资料，需提交同意书；如使用公开图片，还须提交出处清单。')
 expect(r.standaloneTasks).toHaveLength(3)
 const children=r.standaloneTasks.filter(t=>t.title.startsWith('如符合条件'))
 expect(children).toHaveLength(2)
 expect(children.every(t=>!t.timePointTempIds.length&&!t.dependencyTempIds.length)).toBe(true)
 expect(r.conflicts.some(c=>c.id.startsWith('sem-choice-'))).toBe(false)
 expect(r.goalGroups?.[0].taskTempIds).toHaveLength(3)
})

it('keeps generic requirement sections inside their named goal while a new subject stays separate',()=>{
 const r=recognize('【课程归档申请】\n背景仅用于说明课程目标。\n办理要求：\n请周四前上传成果报告。\n补充要求：\n如使用访谈资料，需提交同意书。\n【社团资料登记】\n办理要求：\n请周五前填写登记表。\n如使用图片，需提交来源清单。')
 expect(r.standaloneTasks).toHaveLength(4)
 expect(r.goalGroups).toHaveLength(2)
 for(const [title,objects] of [['课程归档申请',['成果报告','同意书']],['社团资料登记',['登记表','来源清单']]] as const){
  const group=r.goalGroups!.find(g=>g.title===title)!
  expect(group.taskTempIds.map(id=>r.standaloneTasks.find(t=>t.tempId===id)?.actionObject)).toEqual(objects)
 }
})

it('separates a pre-action deadline from its addressed destination',()=>{
 const r=recognize('【课程资料登记】\n请在周二18:00前向课程平台上传研究报告。若包含访谈，还须在周四12:00前向服务窗口递交同意书。')
 expect(r.standaloneTasks).toHaveLength(2)
 for(const [object,date,channel] of [['研究报告','2026-11-17T18:00','课程平台'],['同意书','2026-11-19T12:00','服务窗口']]){
  const task=r.standaloneTasks.find(t=>t.actionObject===object)!
  expect(r.timePoints.find(p=>p.relatedTaskTempIds.includes(task.tempId))?.normalizedValue).toBe(date)
  expect(r.materials.find(m=>m.relatedTaskTempIds.includes(task.tempId))?.submissionChannel).toBe(channel)
 }
})

it('keeps negative instructions and a hypothetical staff duty out of personal tasks',()=>{
 const r=recognize('【资料预约】\n请周二前填写预约表。若已登记，无需再次提交预约表。禁止伪造签名。')
 expect(r.standaloneTasks).toHaveLength(1)
 const duty=recognize('【舞台志愿者招募】\n岗位职责：如设备故障，需检查线路和更换备用设备。报名方式：请周三前填写报名表。')
 expect(duty.standaloneTasks).toHaveLength(1)
 expect(duty.standaloneTasks[0].title).toBe('填写报名表')
 const prohibitions=recognize('请周二前提交研究报告。请勿在报告中填写证件号码。请在提交前检查签名，不要附私人信息。')
 expect(prohibitions.standaloneTasks).toHaveLength(1)
 expect(prohibitions.standaloneTasks[0].title).toBe('提交研究报告')
})

it('does not turn explanatory non-obligations into tasks, but retains a separately requested submission',()=>{
 const text='案例不代表本轮需要个人提交新的作品。图示并不属于报名类别。参加其中一场不表示已报名另一场。请周五前提交研究报告。'
 const r=recognize(text)
 expect(r.standaloneTasks.map(t=>t.title)).toEqual(['提交研究报告'])
 const positive=recognize('展示经历不代表需要提交作品，但请周五前提交申请表。')
 expect(positive.standaloneTasks.some(t=>t.actionObject==='申请表')).toBe(true)
 const events=recognize('12月8日09:30在东馆举行交流会。同日23:00在西馆举行观测。两场地点不同，参加其中一场不表示已报名另一场。')
 expect(events.events).toHaveLength(2);expect(events.standaloneTasks).toHaveLength(0)
 expect(events.events.every(e=>!e.title.includes('如符合条件'))).toBe(true)
})

it('keeps a conditionally activated organizer delivery as follow-up context',()=>{
 const r=recognize('【作品征集】\n请周四前提交作品说明。若报名人数超过30人，主办方需周五前提交汇总名单至评审处。')
 expect(r.standaloneTasks).toHaveLength(1)
 expect(r.standaloneTasks[0].description).toContain('后续办理（原文）：若报名人数超过30人')
 expect(r.timePoints.every(p=>p.relatedTaskTempIds.includes(r.standaloneTasks[0].tempId))).toBe(true)
 expect(r.materials.some(m=>m.name==='汇总名单')).toBe(false)
})

it('scopes conditional required and truly optional materials to one goal in a multi-goal source',()=>{
 const r=recognize('【校外访问申请】\n请周二前提交访问申请表至服务平台。\n本人办理时可提供行程说明。委托办理时须提供委托书。\n【社团资料登记】\n请周四前提交成员名单至社团邮箱。')
 expect(r.standaloneTasks).toHaveLength(2)
 const visit=r.standaloneTasks.find(t=>t.actionObject==='访问申请表')!
 expect(r.materials.find(m=>m.name==='行程说明')?.goalScope).toEqual({taskTempIds:[visit.tempId],condition:'本人办理',requirement:'optional'})
 expect(r.materials.find(m=>m.name==='委托书')?.goalScope).toEqual({taskTempIds:[visit.tempId],condition:'委托办理',requirement:'required'})
})

it('does not treat a singular reference to multiple documents as resolved',()=>{
 const r=recognize('请提交调研报告和费用清单。该材料须签名并交至北楼窗口。')
 expect(r.materials.map(m=>m.name)).toEqual(['调研报告','费用清单'])
 expect(r.materials.every(m=>!m.submissionChannel)).toBe(true)
})

it('retains a unique occurrence day across non-date context but not other dated roles or sections',()=>{
 const r=recognize('11月24日10:00在东楼举行讲座。欢迎自愿参加。\n\n同日23:00至次日01:00在西楼举行观测。')
 expect(r.events).toHaveLength(2)
 const event=r.events.find(e=>e.title==='观测')!
 expect(r.timePoints.find(p=>p.tempId===event.startTimePointTempId)?.normalizedValue).toBe('2026-11-24T23:00')
 expect(r.timePoints.find(p=>p.tempId===event.endTimePointTempId)?.normalizedValue).toBe('2026-11-25T01:00')
 for(const bridge of ['11月25日为资料领取日。','\n【另一项目】\n']){
  const x=recognize('11月24日10:00在东楼举行讲座。'+bridge+'同日15:00在西楼举行工作坊。'),e=x.events.find(e=>e.title==='工作坊')!
  expect(x.timePoints.find(p=>p.tempId===e.startTimePointTempId)?.normalizedValue).toBeNull()
  expect(e.description).toContain('15:00（日期待定）')
  expect(x.standaloneTasks).toHaveLength(0)
 }
})
