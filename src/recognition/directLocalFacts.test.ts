import {describe,it,expect} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback,recoverMissingDirectActions} from './directFallback'
import {convertDirectResult} from './directResult'
import {directEventRevision} from './directLocalFacts'
const raw=(text:string)=>buildLocalRecognition({sourceType:'text',sourceTitle:'匿名工程夹具',content:text,referenceTime:new Date('2026-10-27T10:00:00Z'),timezone:'Asia/Shanghai',projects:[],tasks:[]})
const run=(text:string)=>convertDirectResult(improveDirectFallback(raw(text),text),text).result
describe('source-backed direct local facts',()=>{
 it('keeps the corrected event, location and exact time without reviving the cancelled slot',()=>{
  const r=run('原定2026年10月28日14:00在A101举行的课程说明会取消，改为2026年10月29日15:00在B201举行，请同学们参加。')
  expect(r.events).toHaveLength(1);expect(r.events[0]).toMatchObject({title:'课程说明会',location:'B201'})
  expect(r.standaloneTasks.map(t=>t.title)).toEqual(['参加课程说明会'])
  expect(r.timePoints.filter(p=>p.selected&&p.normalizedValue).map(p=>p.normalizedValue)).toEqual(['2026-10-29T15:00'])
 })
 it('does not infer a revision relation between different named events or sources',()=>{
  expect(directEventRevision('原定明天举行的迎新会取消，改为后天举行答辩会。')).toBeNull()
  expect(directEventRevision('原定明天举行的迎新会取消。答辩会改为后天。')).toBeNull()
 })
 it('recognizes a corrected named event without a holding verb, with its adjacent invitation',()=>{
  const text='原定2026年10月28日14:00的实习答疑会调整为2026年10月30日15:00至16:00，地点C302。请参加实习答疑会的同学按新安排到场。'
  const r=run(text)
  expect(r.events).toHaveLength(1);expect(r.events[0]).toMatchObject({title:'实习答疑会',location:'C302'})
  expect(r.standaloneTasks.map(t=>t.title)).toEqual(['参加实习答疑会'])
  expect(r.timePoints.filter(p=>p.normalizedValue).map(p=>p.normalizedValue)).toEqual(['2026-10-30T15:00','2026-10-30T16:00'])
  const base=convertDirectResult({...r,events:r.events.map(e=>({...e,title:'参加'+e.title}))},text)
  expect(recoverMissingDirectActions(base,raw(text),text)).toEqual(base)
  expect(directEventRevision('原定2026年10月28日14:00的报名材料调整为在线提交。')).toBeNull()
 })
 it('pure cancellation stays reading with no cancelled date or action',()=>{
  const r=run('原定2026年10月28日14:00在A101举行的实习说明会取消，请勿前往。')
  expect(r.events).toHaveLength(0);expect(r.standaloneTasks.map(t=>t.title)).toEqual(['查看：实习说明会取消']);expect(r.timePoints).toHaveLength(0)
 })
 it('retains separate electronic cutoff and paper delivery window with their own channels',()=>{
  const r=run('请于2026年10月29日17:00前在线提交实践报告。纸质报告请于2026年10月28日9:00至11:00在学院办公室递交。')
  expect(r.standaloneTasks).toHaveLength(2)
  const paper=r.standaloneTasks.find(t=>t.actionObject==='纸质报告')!
  expect(r.timePoints.filter(p=>p.relatedTaskTempIds.includes(paper.tempId)).map(p=>[p.type,p.normalizedValue])).toEqual([['event_start','2026-10-28T09:00'],['event_end','2026-10-28T11:00']])
  expect(r.materials.find(m=>m.relatedTaskTempIds.includes(paper.tempId))?.submissionChannel).toBe('学院办公室')
 })
 it('does not turn uncertain or alternative delivery slots into definite deadlines',()=>{
  const r=run('纸质报告请于2026年10月28日或29日在学院办公室递交，可选择其中一天。')
  expect(r.timePoints.filter(p=>p.type.endsWith('_deadline')&&p.normalizedValue)).toHaveLength(0)
 })
 it('fills the explicit end, never an estimated event duration',()=>{
  const r=run('请同学们于2026年10月28日14:00至16:00在图书馆302会议室参加新闻实践讲座。')
  expect(r.events[0].endTimePointTempId).toBeTruthy()
  expect(r.timePoints.find(p=>p.tempId===r.events[0].endTimePointTempId)?.normalizedValue).toBe('2026-10-28T16:00')
  const single=run('请同学们于2026年10月28日14:00在图书馆302会议室参加新闻实践讲座。')
  expect(single.events[0].endTimePointTempId).toBeNull()
 })
 it('completes a second evidenced action without modifying the retained AI action',()=>{
  const text='请于2026年10月28日17:00前提交课程论文。请于2026年10月30日18:00前填写实践报名表。',local=raw(text),full=run(text)
  const first=full.standaloneTasks[0],base=convertDirectResult({...full,standaloneTasks:[first],materials:full.materials.filter(m=>m.relatedTaskTempIds.includes(first.tempId)),timePoints:full.timePoints.filter(p=>p.relatedTaskTempIds.includes(first.tempId))},text)
  const next=recoverMissingDirectActions(base,local,text)
  expect(next.result.standaloneTasks).toHaveLength(2);expect(next.result.standaloneTasks[0]).toEqual(base.result.standaloneTasks[0])
  const added=next.result.standaloneTasks[1];expect(added.actionObject).toBe('实践报名表');expect(next.result.timePoints.find(p=>p.relatedTaskTempIds.includes(added.tempId))?.normalizedValue).toBe('2026-10-30T18:00')
 })
 it('ordinary information remains one short reading action with no invented time',()=>{
  const r=run('图书馆电子资源检索服务已升级，新增按学科筛选功能。')
  expect(r.standaloneTasks).toHaveLength(1);expect(r.standaloneTasks[0].actionVerb).toBe('查看');expect(r.timePoints).toHaveLength(0)
 })
 it('recovers a source-explicit replacement event from an empty AI result, never the old time',()=>{
  const text='原定2026年10月28日14:00在A101举行的课程说明会取消，改为2026年10月29日15:00在B201举行，请同学们参加。',local=raw(text)
  const base=convertDirectResult({...local,standaloneTasks:[],milestones:[],events:[],timePoints:[],materials:[]},text)
  const next=recoverMissingDirectActions(base,local,text)
  expect(next.result.events).toHaveLength(1);expect(next.result.standaloneTasks.map(t=>t.title)).toEqual(['参加课程说明会'])
  expect(next.result.timePoints.map(p=>p.normalizedValue)).toEqual(['2026-10-29T15:00']);expect(next.result.events[0].location).toBe('B201')
  expect(next.omitted.some(o=>o.reason==='LOCAL_SOURCE_ACTION_COMPLETION_AFTER_AI_ACTION_LOSS')).toBe(true)
 })
})
