import {describe, expect, it} from 'vitest'
import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'
import {completeParallelSessions} from './directParallelSessions'
import {isRecognitionResult} from './schema'

// Anonymous engineering examples, not model responses or private student data.
const ref='2026-10-30T15:56:11Z'
const notice='【职业探索活动】\n【宣讲时间】11月3日（周二）9:30-10:30\n【交流时间】11月3日（周二）10:30-12:00\n【活动地点】文化中心一楼报告厅（宣讲）、展厅（交流）\n请参加交流的同学在11.1日晚上6:00前填写下方问卷。\n【报名链接】https://example.edu/form'
const local=(text:string)=>buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:text,referenceTime:new Date(ref),timezone:'Asia/Shanghai',projects:[],tasks:[]})
const run=(text:string)=>convertDirectResult(improveDirectFallback(local(text),text),text).result
const time=(r:ReturnType<typeof run>,id:string|null)=>r.timePoints.find(p=>p.tempId===id)?.normalizedValue??null

describe('parallel event sessions and source-specific dates',()=>{
 it('parses explicit M.D日, without treating decimals as dates',()=>{
  const options={type:'task_deadline' as const,referenceTime:ref,timezone:'Asia/Shanghai'}
  expect(parseDirectSourceTime('11.1日晚上6:00前',options).normalizedValue).toBe('2026-11-01T18:00')
  expect(parseDirectSourceTime('报告评分3.5分',options).normalizedValue).toBeNull()
 })
 it('keeps the two sessions, their own times and their own locations',()=>{
  const r=run(notice)
  expect(isRecognitionResult(r)).toBe(true)
  const a=r.events.find(e=>e.title.includes('宣讲')),b=r.events.find(e=>e.title.includes('交流'))
  expect(r.events).toHaveLength(2);expect(a).toBeTruthy();expect(b).toBeTruthy()
  expect([time(r,a!.startTimePointTempId),time(r,a!.endTimePointTempId)]).toEqual(['2026-11-03T09:30','2026-11-03T10:30'])
  expect([time(r,b!.startTimePointTempId),time(r,b!.endTimePointTempId)]).toEqual(['2026-11-03T10:30','2026-11-03T12:00'])
  expect(a!.location).toContain('报告厅');expect(a!.location).not.toContain('展厅')
  expect(b!.location).toContain('展厅');expect(b!.location).not.toContain('报告厅')
  const form=r.standaloneTasks.find(t=>t.actionObject.includes('问卷'))
  expect(form).toBeTruthy()
  expect(form!.title).toBe('填写交流问卷')
  expect(r.timePoints.find(p=>p.relatedTaskTempIds.includes(form!.tempId)&&p.type==='task_deadline')?.normalizedValue).toBe('2026-11-01T18:00')
  expect(r.materials.find(m=>m.relatedTaskTempIds.includes(form!.tempId))?.submissionChannel).toBe('https://example.edu/form')
 })
 it('keeps AI session titles that combine the topic and role without inventing a literal quote',()=>{
  const parsed=completeParallelSessions(local(notice),notice)
  expect(parsed.events).toHaveLength(2)
  parsed.events=parsed.events.map((event,index)=>({...event,tempId:`g2-${index+1}`,title:index===0?'职业探索活动宣讲会':'职业探索活动交流会'}))
  const r=convertDirectResult(completeParallelSessions(parsed,notice),notice).result
  expect(r.events).toHaveLength(2)
  expect(r.events.find(e=>e.title.includes('宣讲'))?.location).toContain('报告厅')
  expect(r.events.find(e=>e.title.includes('交流'))?.location).toContain('展厅')
 })
 it('matches role labels even when the location order is reversed',()=>{
  const swapped=notice.replace('文化中心一楼报告厅（宣讲）、展厅（交流）','文化中心展厅（交流）、报告厅（宣讲）')
  const r=run(swapped)
  expect(r.events.find(e=>e.title.includes('宣讲'))?.location).toContain('报告厅')
  expect(r.events.find(e=>e.title.includes('交流'))?.location).toContain('展厅')
 })
 it('recognizes a venue qualifier with an ordinary role suffix',()=>{
  const text=notice.replace('（宣讲）、展厅（交流）','（宣讲会）、展厅（交流环节）')
  const r=run(text)
  expect(r.events.find(e=>e.title.includes('宣讲'))?.location).toContain('报告厅')
  expect(r.events.find(e=>e.title.includes('交流'))?.location).toContain('展厅')
 })
 it('does not create sessions from submission and registration windows',()=>{
  const text='【材料办理】\n【报名时间】11月3日9:30-10:30\n【提交时间】11月3日10:30-12:00\n【活动地点】服务中心大厅（报名）、办公室（提交）'
  expect(run(text).events).toHaveLength(0)
 })
 it('does not fabricate a location when parallel location labels are missing',()=>{
  const text=notice.replace('文化中心一楼报告厅（宣讲）、展厅（交流）','文化中心一楼报告厅或展厅')
  const r=run(text)
  expect(r.events.every(e=>!e.location||!e.location.includes(' · '))).toBe(true)
 })
 it('shares a single explicitly common venue without manufacturing rooms',()=>{
  const text=notice.replace('文化中心一楼报告厅（宣讲）、展厅（交流）','文化中心报告厅')
  expect(run(text).events.map(e=>e.location)).toEqual(['文化中心报告厅','文化中心报告厅'])
 })
 it('does not attach an event time to a form submission',()=>{
  const before=improveDirectFallback(local(notice),notice),form=before.standaloneTasks.find(t=>t.actionObject.includes('问卷'))!
  const point=before.timePoints.find(p=>p.type==='event_start')!
  point.relatedTaskTempIds=[form.tempId]
  const after=completeParallelSessions(before,notice)
  expect(after.events).toHaveLength(2)
  expect(after.timePoints.filter(p=>p.type==='event_start').every(p=>!p.relatedTaskTempIds.includes(form.tempId))).toBe(true)
 })
})
