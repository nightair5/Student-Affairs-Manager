import {describe, expect, it} from 'vitest'
import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'
import {completeParallelSessions,linkReferencedEventActions} from './directParallelSessions'
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
  expect(b!.relatedTaskTempIds).toContain(form!.tempId)
  expect(a!.relatedTaskTempIds??[]).not.toContain(form!.tempId)
 })
 it('does not link an action to an ambiguous owner or an unrelated sentence',()=>{
  const first=improveDirectFallback(local(notice),notice),form=first.standaloneTasks.find(task=>task.actionObject.includes('问卷'))!
  const ambiguous=structuredClone(first),event=ambiguous.events.find(value=>value.title.includes('交流'))!
  ambiguous.events.forEach(value=>value.relatedTaskTempIds=[])
  ambiguous.events.push({...structuredClone(event),tempId:'other-event',title:'另一交流'})
  expect(linkReferencedEventActions(ambiguous,notice).events.every(value=>!value.relatedTaskTempIds?.includes(form.tempId))).toBe(true)
  const separate='参加交流的同学请入场。另请填写报名问卷。',unrelated=structuredClone(first)
  unrelated.events.forEach(value=>value.relatedTaskTempIds=[])
  unrelated.evidence=[{id:'other',sourceId:'pending-source',quote:separate,quotedText:separate,textStart:0,textEnd:separate.length,field:'description'}]
  unrelated.standaloneTasks.find(task=>task.tempId===form.tempId)!.evidenceIds=['other']
  expect(linkReferencedEventActions(unrelated,separate).events.every(value=>!value.relatedTaskTempIds?.includes(form.tempId))).toBe(true)
  const placeholder=structuredClone(first)
  placeholder.events=placeholder.events.filter(value=>value.title.includes('交流')).map(value=>({...value,title:'参加交流的同学',relatedTaskTempIds:[]}))
  expect(linkReferencedEventActions(placeholder,notice).events[0].relatedTaskTempIds).toEqual([])
 })
 it('links a locally summarized registration to the uniquely cited event heading',()=>{
  const text='【2026校园讲解志愿者招募】\n活动时间：11月8日\n活动地点：展览楼101\n报名截止日期：11月5日12:00\n报名方式：填写报名问卷，报名后加入志愿者群。'
  const r=run(text),event=r.events[0],task=r.standaloneTasks[0]
  expect(r.events).toHaveLength(1);expect(r.standaloneTasks).toHaveLength(1)
  expect(event.relatedTaskTempIds).toContain(task.tempId)
  expect(r.timePoints.find(point=>point.relatedTaskTempIds.includes(task.tempId)&&point.type==='task_deadline')?.normalizedValue).toBe('2026-11-05T12:00')
  expect(time(r,event.startTimePointTempId)).toBe('2026-11-08')
  const noRelation=structuredClone(r);noRelation.events[0].relatedTaskTempIds=[]
  const multipleEvents=structuredClone(noRelation);multipleEvents.events.push({...structuredClone(event),tempId:'other-event',relatedTaskTempIds:[]})
  expect(linkReferencedEventActions(multipleEvents,text).events.every(value=>!value.relatedTaskTempIds?.includes(task.tempId))).toBe(true)
  const missingHeading=structuredClone(noRelation);missingHeading.events[0].evidenceIds=[]
  expect(linkReferencedEventActions(missingHeading,text).events[0].relatedTaskTempIds??[]).not.toContain(task.tempId)
  const noDeadlineEvidence=structuredClone(noRelation);noDeadlineEvidence.standaloneTasks[0].evidenceIds=noDeadlineEvidence.standaloneTasks[0].evidenceIds.filter(id=>!id.includes('description:'))
  expect(linkReferencedEventActions(noDeadlineEvidence,text).events[0].relatedTaskTempIds??[]).not.toContain(task.tempId)
 })
 it('retains separately named same-day agenda rows with their own venue and time',()=>{
  const text='【校园交流开放日】\n上午场：11月3日09:00-10:00，地点：东校区一号厅。\n下午场：同日14:00-15:00，地点：西校区二号厅。'
  const r=run(text),morning=r.events.find(event=>event.title.includes('上午场'))!,afternoon=r.events.find(event=>event.title.includes('下午场'))!
  expect(r.events).toHaveLength(2)
  expect([time(r,morning.startTimePointTempId),time(r,morning.endTimePointTempId),morning.location]).toEqual(['2026-11-03T09:00','2026-11-03T10:00','东校区一号厅'])
  expect([time(r,afternoon.startTimePointTempId),time(r,afternoon.endTimePointTempId),afternoon.location]).toEqual(['2026-11-03T14:00','2026-11-03T15:00','西校区二号厅'])
 })
 it('does not assign an unanchored or conflicting day to agenda rows',()=>{
  const unanchored='【校园交流开放日】\n上午场：同日09:00-10:00，地点：一号厅。\n下午场：同日14:00-15:00，地点：二号厅。'
  const conflicting='【校园交流开放日】\n上午场：11月3日09:00-10:00，地点：一号厅。\n下午场：11月4日14:00-15:00，地点：二号厅。'
  const separate='【校园交流开放日】\n上午场：11月3日09:00-10:00，地点：一号厅。\n【另一项独立活动】\n下午场：同日14:00-15:00，地点：二号厅。'
  for(const text of [unanchored,conflicting,separate])expect(improveDirectFallback(local(text),text).events.some(event=>event.tempId.startsWith('direct-session:'))).toBe(false)
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
