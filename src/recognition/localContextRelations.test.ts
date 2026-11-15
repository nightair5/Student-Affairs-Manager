import {expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {assembleProductFirstSuggestion} from './materialChannelGrounding'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'

const referenceTime='2026-11-15T09:00:00+08:00',timezone='Asia/Shanghai'
function recognize(content:string){
 const raw=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content,referenceTime:new Date(referenceTime),timezone,projects:[],tasks:[]})
 const assembled=assembleProductFirstSuggestion(raw,{sourceText:content,referenceTime,timezone}).result
 return convertDirectResult(improveDirectFallback(assembled,content,{scopeAware:true,timezone}),content,undefined,{scopeAware:true}).result
}

it('resolves explicit same-day references across wrapped paragraphs without dropping the clock or mixing locations',()=>{
 for(const gap of ['\n','\n\n','\n \u00a0\n']){
  const r=recognize('11月20日09:00在南馆举行摄影讲座。'+gap+'同日15:00至16:30在北馆举行版画体验。')
  expect(r.events).toHaveLength(2)
  const e=r.events.find(e=>e.title==='版画体验')!
  expect(e.location).toBe('北馆');expect(e.description).not.toContain('日期待定')
  expect(r.timePoints.find(p=>p.tempId===e.startTimePointTempId)?.normalizedValue).toBe('2026-11-20T15:00')
  expect(r.timePoints.find(p=>p.tempId===e.endTimePointTempId)?.normalizedValue).toBe('2026-11-20T16:30')
 }
})

it('refuses dates borrowed by an earlier parser across a new heading, alternatives or a deadline',()=>{
 for(const prefix of ['【甲项目】\n11月20日09:00在南馆举行交流。\n【乙项目】\n','11月20日举行摄影讲座，11月21日举行音乐分享。\n','请于11月19日17:00前提交申请表。\n','原定周一的导览改为周二。\n']){
  const r=recognize(prefix+'同日15:00在北馆举行版画体验。'),e=r.events.find(e=>e.title==='版画体验')!
  expect(e.description).toContain('15:00（日期待定）')
  expect(r.timePoints.find(p=>p.tempId===e.startTimePointTempId)?.normalizedValue).toBeNull()
 }
})

it('keeps a unique demonstrative material with its own signature, limit and channel',()=>{
 const r=recognize('【实践项目申请】\n申请者请周四前填写项目申请表。\n该表须本人签名，最多2页，交至学院窗口。')
 expect(r.standaloneTasks).toHaveLength(1)
 expect(r.materials).toHaveLength(1)
 expect(r.materials[0]).toMatchObject({name:'项目申请表',submissionChannel:'学院窗口',relatedTaskTempIds:[r.standaloneTasks[0].tempId]})
 expect(r.materials[0].requirements?.join('')).toContain('本人签名，最多2页')
})

it('ends material scope at a new subject and does not lend a record deadline to returned equipment',()=>{
 const r=recognize('实验安排说明\n仪器介绍仅供参考。\n请周四17:00前提交实验记录，同时归还借用仪器。实验记录须签名，仪器交至器材室。')
 expect(r.standaloneTasks).toHaveLength(2)
 const give=r.standaloneTasks.find(t=>t.actionVerb==='归还')!,record=r.standaloneTasks.find(t=>t.actionVerb==='提交')!
 expect(r.materials.find(m=>m.relatedTaskTempIds.includes(give.tempId))).toMatchObject({name:'借用仪器',submissionChannel:'器材室'})
 expect(r.materials.find(m=>m.relatedTaskTempIds.includes(record.tempId))?.submissionChannel).toBeNull()
 expect(r.timePoints.some(p=>p.relatedTaskTempIds.includes(give.tempId))).toBe(false)
 expect(r.materials.find(m=>m.name==='实验记录')?.requirements).toContain('实验记录须签名')
})

it('retains unresolved shared-object and conflicting-destination context without guessing a channel',()=>{
 const ambiguous=recognize('请周四前提交申请表，同时提交证明书。\n材料交至学院窗口。')
 expect(ambiguous.standaloneTasks).toHaveLength(2)
 expect(ambiguous.materials.every(m=>!m.submissionChannel)).toBe(true)
 const conflict=recognize('请周四前提交实验记录。\n实验记录交至甲窗口；实验记录交至乙窗口。')
 expect(conflict.standaloneTasks).toHaveLength(1)
 expect(conflict.standaloneTasks[0].description).toContain('提交渠道待确认：实验记录交至甲窗口；实验记录交至乙窗口')
 expect(conflict.materials.every(m=>!m.submissionChannel)).toBe(true)
})

it('groups differently worded actions under a bounded objective with independent times and channels',()=>{
 for(const heading of ['研究交流申请','【研究交流申请】','研究交流申请：']){
  const r=recognize(heading+'\n欢迎有意交流的同学申报，往年入选作品只作展示。\n申请者请周二12:00前在学院平台填写申请表；周四18:30前把研究提纲PDF发送至 study@example.edu。\n研究提纲须本人签名，最多3页。研究中心统一审核后公布结果，申请者无需参加审核。')
  expect(r.goalGroups).toHaveLength(1);expect(r.goalGroups![0].taskTempIds).toHaveLength(2)
  expect(r.events).toHaveLength(0)
  expect(r.standaloneTasks.every(t=>t.dependencyTempIds.length===0)).toBe(true)
  expect(r.materials.map(m=>m.submissionChannel).sort()).toEqual(['study@example.edu','学院平台'].sort())
  expect(r.materials).toHaveLength(2)
 }
 const prose=recognize('参加课程成果评选，请周二前在平台填写信息，周五20:00前把作品PDF发送至 review@example.edu。')
 expect(prose.goalGroups?.[0].title).toBe('课程成果评选');expect(prose.events).toHaveLength(0)
})

it('separates multiple goals, independent matters and different named events',()=>{
 const r=recognize('【器材借用申请】\n申请者请周二前填写借用表；周三前提交用途说明。\n【场地预约申请】\n申请者请周二前填写预约表；周四前提交活动方案。')
 expect(r.goalGroups).toHaveLength(2)
 expect(r.goalGroups!.map(g=>g.taskTempIds.length)).toEqual([2,2])
 expect(new Set(r.goalGroups!.flatMap(g=>g.taskTempIds)).size).toBe(4)
 for(const text of ['周二前填写宿舍报修表；周二前提交课程论文。这两件事彼此独立。','【交流课程申请】\n请报名摄影讲座；请报名历史讲座。'])expect(recognize(text).goalGroups??[]).toHaveLength(0)
})
