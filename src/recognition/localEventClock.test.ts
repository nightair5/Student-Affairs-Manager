import {describe,expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {convertDirectResult} from './directResult'

function local(source:string){
 const result=buildLocalRecognition({content:source,sourceType:'text',sourceTitle:'匿名通知',referenceTime:new Date('2026-11-04T10:00:00+08:00'),timezone:'Asia/Shanghai',projects:[],tasks:[]})
 return convertDirectResult(result,source).result
}

describe('source-backed event facts in simple local processing',()=>{
 it('keeps a clock and approximate duration without inventing a day or a duplicate reading task',()=>{
  const result=local('晚上9点15分，我们开15分钟左右的年级线上大会。')
  expect(result.events).toHaveLength(1)
  expect(result.events[0].title).toBe('年级线上大会')
  expect(result.standaloneTasks).toHaveLength(0)
  expect(result.events[0].description).toContain('时间说明：晚上9点15分（日期待定）')
  expect(result.events[0].description).toContain('原文时长：15分钟左右')
  expect(result.timePoints.every(point=>point.normalizedValue===null)).toBe(true)
 })
 it('does not turn an arrival buffer into event duration',()=>{
  const result=local('11月8日19:00举行说明会，请提前15分钟入场。')
  expect(result.events).toHaveLength(1)
  expect(result.events[0].description).not.toContain('原文时长：15分钟')
 })
 it('retains an approximate duration following the event name',()=>{
  const result=local('晚上9点15分召开会议，约15分钟。')
  expect(result.events[0].description).toContain('原文时长：约15分钟')
  expect(result.timePoints.every(point=>point.normalizedValue===null)).toBe(true)
 })
 it('does not treat a delay until the event starts as its duration',()=>{
  const result=local('晚上9点15分召开会议，约15分钟后开始。')
  expect(result.events).toHaveLength(1)
  expect(result.events[0].description).not.toContain('原文时长：约15分钟')
 })
 it('does not assign one of several candidate clocks as the event time',()=>{
  const result=local('线上说明会备选晚上8点或9点举行，具体时间另行通知。')
  expect(result.events.every(event=>!event.description.includes('（日期待定）'))).toBe(true)
  expect(result.timePoints.every(point=>point.normalizedValue===null)).toBe(true)
 })
})
