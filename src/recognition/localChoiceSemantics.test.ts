import {describe,expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'
import {extractSourceNoticeContext} from '../lib/noticeExcerpts'

const referenceTime=new Date('2026-11-13T08:00:00+08:00')
const run=(text:string)=>{
 const raw=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:text,referenceTime,timezone:'Asia/Shanghai',projects:[],tasks:[]})
 return convertDirectResult(improveDirectFallback(raw,text),text).result
}
const choices=(text:string)=>{
 const r=run(text),group=r.conflicts.find(c=>c.id.startsWith('sem-choice-local:'))
 const items=group?.entityTempIds.map(id=>{
  const task=r.standaloneTasks.find(t=>t.tempId===id)!
  const point=r.timePoints.find(t=>t.relatedTaskTempIds.includes(id))
  const material=r.materials.find(m=>m.relatedTaskTempIds.includes(id))
  return {title:task?.title,date:point?.normalizedValue,channel:material?.submissionChannel,format:material?.formatRequirements}
 })
 return {r,group,items}
}

describe('source-scoped local submission choices',()=>{
 it('retains each deadline and destination when the choice follows the branches in one sentence',()=>{
  const {r,group,items}=choices('成绩证明提交：电子版可在12月23日18:00前发送至平台，纸质版可在12月24日中午12:00前交至服务窗口，两种方式任选一种。')
  expect(group?.entityTempIds).toHaveLength(2)
  expect(r.standaloneTasks).toHaveLength(2)
  expect(items).toEqual(expect.arrayContaining([
   expect.objectContaining({date:'2026-12-23T18:00',channel:'平台'}),
   expect.objectContaining({date:'2026-12-24T12:00',channel:'服务窗口'}),
  ]))
 })
 it('retains choices expressed before separate branch paragraphs',()=>{
  const {r,group,items}=choices('【资料报送】请任选电子版或纸质版提交课程报告。选择电子版：12月3日17:00前上传至教学平台。选择纸质版：12月4日12:00前交至教学服务台。')
  expect(group?.entityTempIds).toHaveLength(2)
  expect(r.standaloneTasks).toHaveLength(2)
  expect(r.materials.map(m=>m.name)).toEqual(['课程报告','课程报告'])
  expect(items).toEqual(expect.arrayContaining([
   expect.objectContaining({date:'2026-12-03T17:00',channel:'教学平台'}),
   expect.objectContaining({date:'2026-12-04T12:00',channel:'教学服务台'}),
  ]))
 })
 it('recognises an explicit choice with dates immediately after each branch label',()=>{
  const {group,items}=choices('【论文备案】备案材料二选一：电子材料12月19日18:00前上传至备案系统；纸质材料12月20日12:00前交至资料室。')
  expect(group?.entityTempIds).toHaveLength(2)
  expect(items).toEqual(expect.arrayContaining([
   expect.objectContaining({date:'2026-12-19T18:00',channel:'备案系统'}),
   expect.objectContaining({date:'2026-12-20T12:00',channel:'资料室'}),
  ]))
 })
 it('retains each branch format, page and naming requirements',()=>{
  const source='请提交课程报告，可任选纸质版或电子版之一。选择纸质版者，请于12月19日16:00前交到教学服务台，打印内容不超过五页，首页注明姓名。选择电子版者，请于12月20日20:00前上传课程平台，格式为PDF，文件名为“学号+课程报告”。'
  const r=run(source),paper=r.materials.find(m=>m.formatRequirements.includes('纸质版'))!,online=r.materials.find(m=>m.formatRequirements.includes('电子版'))!
  expect(paper.requirements).toEqual(expect.arrayContaining(['打印内容不超过五页','首页注明姓名']))
  expect(online.formatRequirements).toContain('PDF')
  expect(online.namingRequirements.join(' ')).toContain('学号+课程报告')
 })
 it('retains online and offline channels without inventing a document',()=>{
  const {r,group,items}=choices('【设备登记】请任选线上或线下方式办理。线上于12月28日16:00前提交到设备平台；线下于12月29日12:00前提交到服务台。')
  expect(group?.entityTempIds).toHaveLength(2)
  expect(items?.map(item=>item.date).sort()).toEqual(['2026-12-28T16:00','2026-12-29T12:00'])
  expect(r.standaloneTasks.map(t=>t.description).join('\n')).toContain('设备平台')
  expect(r.standaloneTasks.map(t=>t.description).join('\n')).toContain('服务台')
  expect(r.materials).toHaveLength(0)
 })
 it('does not create a choice when both forms are explicitly required',()=>{
  const {r,group}=choices('课程报告电子版须于12月3日17:00前上传平台，纸质版须于12月4日12:00前提交服务窗口，两种材料均须提交。')
  expect(group).toBeUndefined()
  expect(r.standaloneTasks).toHaveLength(2)
  expect(r.timePoints.filter(p=>p.normalizedValue).map(p=>p.normalizedValue).sort()).toEqual(['2026-12-03T17:00','2026-12-04T12:00'])
  expect(r.quality.reviewReasons.join('\n')).toContain('提交对象和渠道')
 })
 it('does not guess a missing branch or a branch cutoff',()=>{
  const {r,group}=choices('证明材料任选一种方式提交，电子版须于12月3日17:00前上传平台，另一种方式另行通知。')
  expect(group).toBeUndefined()
  expect(r.timePoints.some(p=>p.normalizedValue==='2026-12-03T17:00'&&p.relatedTaskTempIds.length>1)).toBe(false)
 })
 it('does not treat two alternative dates for the same delivery as branch deadlines',()=>{
  const {group,r}=choices('请于12月3日17:00或12月4日12:00任选一个时间到服务台提交证明材料。')
  expect(group).toBeUndefined()
  expect(r.timePoints.some(p=>p.normalizedValue)).toBe(false)
 })
 it('keeps a semicolon-separated event start and submission deadline on their own items',()=>{
  const r=run('【活动与作业】12月25日10:00在教学楼101举办讲座；请于12月25日17:00前提交作业到课程平台。讲座和作业是不同事项。')
  const task=r.standaloneTasks.find(t=>t.actionObject==='作业')!
  expect(task).toBeTruthy()
  expect(r.timePoints.find(p=>p.relatedTaskTempIds.includes(task.tempId)&&p.type==='task_deadline')?.normalizedValue).toBe('2026-12-25T17:00')
  expect(r.events).toHaveLength(1)
  expect(r.timePoints.find(p=>p.tempId===r.events[0].startTimePointTempId)?.normalizedValue).toBe('2026-12-25T10:00')
 })
 it('recognises a located gathering and a separately timed action without borrowing dates',()=>{
  const r=run('【学术沙龙与作业】12月30日9:30在文理楼205举行交流会；请于12月30日17:30前提交练习到课程系统。两项分别办理。')
  const task=r.standaloneTasks.find(t=>t.actionObject==='练习')!,event=r.events.find(e=>e.title==='交流会')!
  expect(task).toBeTruthy();expect(event?.location).toBe('文理楼205')
  expect(r.timePoints.find(p=>p.relatedTaskTempIds.includes(task.tempId)&&p.type==='task_deadline')?.normalizedValue).toBe('2026-12-30T17:30')
  expect(r.timePoints.find(p=>p.tempId===event.startTimePointTempId)?.normalizedValue).toBe('2026-12-30T09:30')
 })
 it('does not turn an organiser-only review into a personal event',()=>{
  const source='主办方于12月30日9:30在会议楼205举行评审。请于12月28日17:00前提交材料。',r=run(source)
  expect(r.events.some(e=>e.title.includes('评审'))).toBe(false)
  expect(extractSourceNoticeContext(source,'task').sections.some(s=>s.kind==='process'&&s.text.includes('举行评审'))).toBe(true)
 })
})
