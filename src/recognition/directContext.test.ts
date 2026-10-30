import {describe,expect,it} from 'vitest'
import {compileTwoStep} from '../../cloudflare/recognition-two-step-compiler-v2-1-13.mjs'
import {assembleProductFirstSuggestion} from './materialChannelGrounding'
import {convertDirectResult} from './directResult'
import {parseRecognitionResult} from './schema'
import {createGoldenWorkspaceV8} from '../domain/v2/fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../domain/v2/repository'
import {CapturePersistenceService} from '../domain/v2/capture'
import {commitDirectDraft} from '../domain/v2/directIntake'

describe('literal contextual evidence reaches the first saved suggestion',()=>{
 it('keeps an explicitly next-day event end tied to its own sourced start',()=>{
  const source='观星活动11月6日23:30开始，次日00:30结束，地点为天文台。参加者请自备外套。'
  const raw={items:[{id:'a',kind:'活动',name:'观星活动',quote:'观星活动'}],facts:[{type:'开始',quote:'11月6日23:30开始',item:'a'},{type:'结束',quote:'次日00:30结束',item:'a'},{type:'地点',quote:'地点为天文台',item:'a'}],noAction:false}
  const referenceTime='2026-10-30T09:05:10+08:00',timezone='Asia/Shanghai'
  const compiled=parseRecognitionResult(compileTwoStep(raw,{source,referenceTime,timezone,version:'recognition-two-step-2.4.0'}).result)
  const assembled=assembleProductFirstSuggestion(compiled,{sourceText:source,referenceTime,timezone}).result
  const converted=convertDirectResult(assembled,source)
  expect(converted.result.timePoints.find(p=>p.type==='event_start')?.normalizedValue).toBe('2026-11-06T23:30')
  expect(converted.result.timePoints.find(p=>p.type==='event_end')?.normalizedValue).toBe('2026-11-07T00:30')
  const noStart=structuredClone(assembled)
  noStart.events[0].startTimePointTempId=null
  expect(convertDirectResult(noStart,source).result.timePoints.find(p=>p.type==='event_end')?.normalizedValue).toBeNull()
  const unverifiedStart=structuredClone(assembled)
  unverifiedStart.timePoints.find(p=>p.type==='event_start')!.needsConfirmation=true
  expect(convertDirectResult(unverifiedStart,source).result.timePoints.find(p=>p.type==='event_end')?.normalizedValue).toBeNull()
  const sharedEnd=structuredClone(assembled)
  sharedEnd.events.push({...sharedEnd.events[0],tempId:'other-event'})
  expect(convertDirectResult(sharedEnd,source).result.timePoints.find(p=>p.type==='event_end')?.normalizedValue).toBeNull()
 })
 it('keeps the topic, referential action and deadline across both conversion layers',()=>{
  const source='毕业去向调查。请同学们填写下方问卷。截止11月5日17:00。'
  const raw={items:[{id:'a',kind:'任务',name:'填写毕业去向调查问卷',quote:'请同学们填写下方问卷'}],facts:[{type:'截止',quote:'截止11月5日17:00',item:'a'}],noAction:false}
  const referenceTime='2026-10-30T09:05:10+08:00',timezone='Asia/Shanghai'
  const compiled=parseRecognitionResult(compileTwoStep(raw,{source,referenceTime,timezone,version:'recognition-two-step-2.4.0'}).result)
  const assembled=assembleProductFirstSuggestion(compiled,{sourceText:source,referenceTime,timezone}).result
  const converted=convertDirectResult(assembled,source)
  expect(converted.result.standaloneTasks.map(t=>t.title)).toContain('填写毕业去向调查问卷')
  expect(converted.result.timePoints.some(p=>p.type==='task_deadline'&&p.normalizedValue==='2026-11-05T17:00')).toBe(true)
 })
 it('keeps a sourced action when the model placed it in a channel fact',()=>{
  const source='毕业去向调查。请同学们填写下方问卷。截止11月5日17:00。'
  const raw={items:[{id:'a',kind:'任务',name:'毕业去向调查',quote:'毕业去向调查'}],facts:[{type:'截止',quote:'截止11月5日17:00',item:'a'},{type:'渠道',quote:'填写下方问卷',item:'a'}],noAction:false}
  const referenceTime='2026-10-30T09:05:10+08:00',timezone='Asia/Shanghai'
  const compiled=parseRecognitionResult(compileTwoStep(raw,{source,referenceTime,timezone,version:'recognition-two-step-2.4.0'}).result)
  const assembled=assembleProductFirstSuggestion(compiled,{sourceText:source,referenceTime,timezone}).result
  const converted=convertDirectResult(assembled,source)
  expect(converted.result.standaloneTasks.map(t=>t.title)).toContain('填写毕业去向调查问卷')
  expect(converted.result.timePoints.some(p=>p.type==='task_deadline'&&p.normalizedValue==='2026-11-05T17:00')).toBe(true)
 })
 it('persists the sourced long event description through direct intake and an independent read',async()=>{
  const details=[
   ['主讲人','主讲人：陈老师负责写作训练。'],
   ['参加须知','参加须知：'+('请携带报名资料并提前入场'.repeat(16))+'。'],
   ['活动内容','活动内容：'+('本讲座介绍采访写作的方法与实践'.repeat(24))+'。'],
   ['嘉宾简介','嘉宾简介：'+('曾长期从事新闻传播与教学工作'.repeat(24))+'。'],
  ] as const
  const source='写作培训。\n'+details.map(([,quote])=>quote).join('\n')
  const raw={items:[{id:'event',kind:'活动',name:'写作培训',quote:'写作培训'}],facts:details.map(([type,quote])=>({type,quote,item:'event'})),noAction:false}
  const referenceTime='2026-10-30T09:05:10+08:00',timezone='Asia/Shanghai'
  const result=parseRecognitionResult(compileTwoStep(raw,{source,referenceTime,timezone,version:'recognition-two-step-2.4.0'}).result)
  const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),w=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
  await repo.save(w)
  const capture=new CapturePersistenceService(repo),handle=await capture.beginCapture({operationId:'event-details',sourceType:'text',title:'写作培训',rawText:source,provider:'deepseek',modelName:'engineering',promptVersion:'test',pipelineVersion:'test',now:referenceTime})
  await capture.recognize(handle,async()=>result)
  await commitDirectDraft(repo,handle.draftId,referenceTime)
  const read=await new CanonicalWorkspaceRepository(store).load()
  expect(read?.events).toHaveLength(1)
  expect(read?.events[0].description).toContain('嘉宾简介：')
  expect(read?.events[0].description?.length).toBeGreaterThan(800)
 })
})
