import {describe,it,expect} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback,recoverMissingDirectActions} from './directFallback'
import {convertDirectResult} from './directResult'
import {sameWeekdayTime,structuredOptionalEvent} from './directStructuredEvent'
const local=(text:string)=>buildLocalRecognition({sourceType:'text',sourceTitle:'匿名工程夹具',content:text,referenceTime:new Date('2026-10-28T02:00:00Z'),timezone:'Asia/Shanghai',projects:[],tasks:[]})
const converted=(text:string)=>convertDirectResult(improveDirectFallback(local(text),text),text)
describe('source-backed attendance without a concrete class time',()=>{
 it('keeps an explicit request to attend after class without inventing a date',()=>{
  const text='请同学们本周统计与数据课程结束后参加实习安排说明会，具体上课日期和下课时间尚未确定。'
  const r=converted(text).result
  expect(r.standaloneTasks.some(t=>t.actionVerb==='参加'&&t.actionObject==='实习安排说明会')).toBe(true)
  expect(r.timePoints.filter(p=>p.normalizedValue)).toEqual([])
 })
 it('recovers the action when the AI returned only a reading fallback',()=>{
  const text='请同学们本周统计与数据课程结束后参加实习安排说明会，具体上课日期和下课时间尚未确定。'
  const empty={...local(text),standaloneTasks:[],milestones:[],events:[],timePoints:[],materials:[]}
  const r=recoverMissingDirectActions(convertDirectResult(empty,text),local(text),text).result
  expect(r.standaloneTasks.some(t=>t.actionVerb==='参加'&&t.actionObject==='实习安排说明会')).toBe(true)
  expect(r.timePoints.filter(p=>p.normalizedValue)).toEqual([])
 })
 it('retains an explicitly stated event time when recovering a lost attendance action',()=>{
  const text='请同学们于2026年10月30日14:00在A101参加实习说明会。'
  const empty={...local(text),standaloneTasks:[],milestones:[],events:[],timePoints:[],materials:[]}
  const r=recoverMissingDirectActions(convertDirectResult(empty,text),local(text),text).result
  expect(r.standaloneTasks.some(t=>t.actionVerb==='参加')).toBe(true)
  expect(r.timePoints.some(p=>p.type==='event_start'&&p.normalizedValue==='2026-10-30T14:00')).toBe(true)
  expect(r.events.some(e=>e.location==='A101')).toBe(true)
 })
 it('keeps the time and venue of an optional training invitation after an empty AI result',()=>{
  const text='📢【就业指导培训会通知】\n同学们好！\n为帮助大家了解求职，顺利完成求职材料与面试准备，现组织指导培训会。\n⏰ 时间：周四 中午 12:40（请提前几分钟入场）\n📍 地点：东教学楼报告厅\n指导老师介绍材料准备和常见问题。有意向参加的同学建议到场聆听。'
  const input=local(text),empty={...input,standaloneTasks:[],milestones:[],events:[],timePoints:[],materials:[]}
  const r=recoverMissingDirectActions(convertDirectResult(empty,text),input,text).result
  expect(r.events.some(e=>e.title.includes('培训')&&e.location==='东教学楼报告厅'),JSON.stringify({events:r.events,tasks:r.standaloneTasks,times:r.timePoints})).toBe(true)
  expect(r.timePoints.some(p=>p.type==='event_start'&&p.normalizedValue==='2026-10-29T12:40')).toBe(true)
  expect(r.standaloneTasks.some(t=>t.actionVerb==='参加')).toBe(true)
  expect(r.standaloneTasks.some(t=>t.actionVerb==='完成')).toBe(false)
  expect(r.timePoints.find(p=>p.type==='event_start')?.needsConfirmation).toBe(true)
  expect(recoverMissingDirectActions(convertDirectResult(empty,text),input,text).items.every(i=>i.tags.includes('待确认'))).toBe(true)
 })
 it('does not guess a past weekday into next week or merge multiple event locations',()=>{
  expect(sameWeekdayTime('周一 中午12:40','2026-10-28T02:00:00Z')).toBeNull()
  expect(sameWeekdayTime('周四','2026-10-28T02:00:00Z')).toBeNull()
  const text='【就业指导培训会通知】\n时间：周四 中午12:40\n地点：A101\n地点：B201\n有意向的同学建议到场。'
  expect(structuredOptionalEvent(text)).toBeNull()
  expect(structuredOptionalEvent('【就业指导培训会通知】\n时间：周四 中午12:40\n地点：A101\n培训会取消，有意向的同学不要参加。')).toBeNull()
  expect(structuredOptionalEvent('【就业指导培训会通知】\n时间：周四 中午12:40\n地点：A101\n有意向的同学建议到场。请于周三提交报名表。')).toBeNull()
  expect(structuredOptionalEvent('【就业指导培训会通知】\n时间：周四 中午12:40\n地点：A101\n有意向的同学建议到场。'+'说明。'.repeat(200))).toBeNull()
 })
 it('does not create an attendance action for a prohibition or an eligibility description',()=>{
  for(const text of ['请同学们不要参加本周实习安排说明会。','参加实习说明会的同学需具备申请资格，本通知仅供知悉。'])
   {const input=local(text),r=converted(text).result;expect(r.standaloneTasks.some(t=>t.actionVerb==='参加'),text).toBe(false);const empty={...input,standaloneTasks:[],milestones:[],events:[],timePoints:[],materials:[]};expect(recoverMissingDirectActions(convertDirectResult(empty,text),input,text).result.standaloneTasks.some(t=>t.actionVerb==='参加'),text).toBe(false)}
 })
 it('does not duplicate an existing event or replace an unrelated existing action',()=>{
  const text='请同学们于2026年10月30日14:00在A101参加实习说明会。'
  const current=converted(text)
  expect(recoverMissingDirectActions(current,local(text),text)).toEqual(current)
  const task={...current.result.standaloneTasks[0],tempId:'existing',title:'提交报告',actionVerb:'提交',actionObject:'报告'}
  const unrelated={...current,result:{...current.result,standaloneTasks:[task],events:[],timePoints:[],materials:[]},items:[{tempId:'existing',kind:'task' as const,tags:[]}]}
  expect(recoverMissingDirectActions(unrelated,local(text),text)).toEqual(unrelated)
 })
})
