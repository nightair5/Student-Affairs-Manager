import {describe,expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'

const run=(source:string)=>{
 const input=buildLocalRecognition({sourceType:'text',sourceTitle:'手动粘贴消息',content:source,referenceTime:new Date('2027-02-01T09:00:00+08:00'),timezone:'Asia/Shanghai',projects:[],tasks:[]})
 return convertDirectResult(improveDirectFallback(input,source),source).result
}
const value=(r:ReturnType<typeof run>,id:string|null)=>r.timePoints.find(p=>p.tempId===id)?.normalizedValue??null

describe('explicit parallel events in a single sentence',()=>{
 it('preserves the common date, each session time and its literal venue',()=>{
  const r=run('2027年2月5日9:00—10:00在东楼101举行摄影基础讲座；当天14:00—15:00在西楼202举行声音工作坊。')
  expect(r.events).toHaveLength(2)
  const first=r.events.find(e=>e.title.includes('摄影基础讲座'))!,second=r.events.find(e=>e.title.includes('声音工作坊'))!
  expect([value(r,first.startTimePointTempId),value(r,first.endTimePointTempId),first.location]).toEqual(['2027-02-05T09:00','2027-02-05T10:00','东楼101'])
  expect([value(r,second.startTimePointTempId),value(r,second.endTimePointTempId),second.location]).toEqual(['2027-02-05T14:00','2027-02-05T15:00','西楼202'])
  expect(r.standaloneTasks).toHaveLength(0)
 })
 it('keeps separate same-day starts without inventing end times',()=>{
  const r=run('2月6日10:00在展馆大厅举行旧地图导览，15:30在行政楼302举行选课咨询会。')
  expect(r.events).toHaveLength(2)
  expect(r.events.map(e=>[e.title,value(r,e.startTimePointTempId),value(r,e.endTimePointTempId),e.location])).toEqual(expect.arrayContaining([
   ['旧地图导览','2027-02-06T10:00',null,'展馆大厅'],['选课咨询会','2027-02-06T15:30',null,'行政楼302']
  ]))
 })
 it('does not interpret cancelled or alternative events as certain sessions',()=>{
  const r=run('2027年2月5日9:00在东楼101举行摄影讲座；当天14:00在西楼202举行声音工作坊，后者取消。')
  expect(r.events.some(e=>e.title==='声音工作坊'&&value(r,e.startTimePointTempId)==='2027-02-05T14:00')).toBe(false)
 })
 it('does not treat separate deadlines as a shared activity date',()=>{
  const r=run('2月22日17:00前上传统计练习；同日20:00前归还图书馆借阅的相机，两件事无关。')
  expect(r.events).toHaveLength(0)
  expect(r.standaloneTasks.length).toBeGreaterThanOrEqual(1)
 })
 it('does not infer a shared date when two dates are present',()=>{
  const r=run('2月9日16:00在图书馆举行新书分享；2月10日10:00在报告厅举行作者访谈。')
  expect(r.events.filter(e=>e.tempId.startsWith('direct-session:'))).toHaveLength(0)
 })
 it('does not turn an activity attendance or registration requirement into a separate event',()=>{
  const r=run('2月5日9:00在东楼101举行摄影讲座；当天14:00请在报名平台填写表格。')
  expect(r.events.filter(e=>e.tempId.startsWith('direct-session:'))).toHaveLength(0)
 })
})
