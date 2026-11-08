import {describe,expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'
const run=(source:string)=>{const input=buildLocalRecognition({sourceType:'text',sourceTitle:'手动粘贴消息',content:source,referenceTime:new Date('2026-11-08T09:00:00+08:00'),timezone:'Asia/Shanghai',projects:[],tasks:[]});return convertDirectResult(improveDirectFallback(input,source),source).result}
const point=(r:ReturnType<typeof run>,id:string|null)=>r.timePoints.find(p=>p.tempId===id)?.normalizedValue??null
const notice='2026年11月18日科学传播活动安排：\n时间｜项目｜地点\n09:00—10:00｜科普写作｜综合楼301\n14:00—15:00｜数据可视化｜综合楼302'
describe('structured event schedule tables in local fallback',()=>{
 it('retains each row as an independent event with the shared date and its own venue',()=>{
  const r=run(notice);expect(r.events).toHaveLength(2)
  const a=r.events.find(e=>e.title==='科普写作')!,b=r.events.find(e=>e.title==='数据可视化')!
  expect([point(r,a.startTimePointTempId),point(r,a.endTimePointTempId),a.location]).toEqual(['2026-11-18T09:00','2026-11-18T10:00','综合楼301'])
  expect([point(r,b.startTimePointTempId),point(r,b.endTimePointTempId),b.location]).toEqual(['2026-11-18T14:00','2026-11-18T15:00','综合楼302'])
  expect(r.standaloneTasks).toHaveLength(0)
 })
 it('keeps an unrelated form task in the same notice',()=>{
  const r=run(notice+'\n请于11月17日17:00前填写报名表。')
  expect(r.events).toHaveLength(2)
  expect(r.standaloneTasks.some(t=>t.title.includes('报名表'))).toBe(true)
 })
 it('does not convert registration steps in a table into events',()=>{
  const text=notice.replace('科普写作','填写报名表').replace('数据可视化','提交报名材料')
  expect(run(text).events).toHaveLength(0)
 })
 it('does not infer a next-day date for an overnight table row',()=>{
  const text=notice.replace('14:00—15:00','23:30—00:30')
  expect(run(text).events).toHaveLength(0)
 })
 it('does not materialize an invalid calendar date',()=>{
  const text=notice.replace('2026年11月18日','2026年2月30日')
  expect(run(text).events.some(event=>event.tempId.startsWith('direct-session:'))).toBe(false)
 })
 it('does not silently accept an incomplete table row',()=>{
  const text=notice+'\n16:00—17:00｜另一个讲座'
  expect(run(text).events.some(event=>event.tempId.startsWith('direct-session:'))).toBe(false)
 })
 it('does not resurrect rows from a cancelled schedule',()=>{
  expect(run(notice+'\n以上活动全部取消。').events).toHaveLength(0)
 })
 it('does not create event rows from a task table',()=>{
  const r=run(notice.replace('科学传播活动安排','学生提交材料').replace('项目','任务'))
  expect(r.events).toHaveLength(0)
 })
 it('does not invent a date when the table has no dated heading',()=>{
  const r=run(notice.replace('2026年11月18日','日期另行通知'))
  expect(r.timePoints.every(p=>p.normalizedValue===null||!p.normalizedValue.startsWith('2026-11-18'))).toBe(true)
 })
})
