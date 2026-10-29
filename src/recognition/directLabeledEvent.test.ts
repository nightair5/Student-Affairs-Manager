import {describe,expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'

const local=(text:string)=>buildLocalRecognition({sourceType:'text',sourceTitle:'匿名工程夹具',content:text,referenceTime:new Date('2026-10-28T02:00:00Z'),timezone:'Asia/Shanghai',projects:[],tasks:[]})
describe('labelled local event recovery',()=>{
 it('retains the complete date and time range even with a weekday in parentheses',()=>{
  const text='【校园采访实训】\n技术时代的信息实践\n时间：10月29日（周四）15:00-16:30\n地点：教学楼301\n主讲嘉宾：林老师\n欢迎有意向的同学参加。'
  const r=convertDirectResult(improveDirectFallback(local(text),text),text).result
  expect(r.events).toHaveLength(1)
  expect(r.events[0].location).toBe('教学楼301')
  expect(r.timePoints.find(t=>t.type==='event_start')?.normalizedValue).toBe('2026-10-29T15:00')
  expect(r.timePoints.find(t=>t.type==='event_end')?.normalizedValue).toBe('2026-10-29T16:30')
  expect(r.events[0].description).toContain('主讲人：林老师')
  expect(r.standaloneTasks.some(task=>task.actionVerb==='查看')).toBe(false)
 })
 it('does not fold two labelled event times into a single event',()=>{
  const text='【校园采访实训】\n时间：10月29日15:00-16:30\n地点：教学楼301\n另一场活动\n时间：10月30日14:00\n地点：教学楼302'
  const input=local(text);input.events=[]
  expect(improveDirectFallback(input,text).events).toHaveLength(0)
 })
})


