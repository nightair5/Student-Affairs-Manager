import {describe,expect,it} from 'vitest'
import {compileSemanticNotice} from '../../cloudflare/semantic-notice-compiler-v3.mjs'
import {parseRecognitionResult} from './schema'
import {assembleProductFirstSuggestion} from './materialChannelGrounding'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../domain/v2/repository'
import {createGoldenWorkspaceV8} from '../domain/v2/fixtures'
import {CapturePersistenceService} from '../domain/v2/capture'
import {commitDirectDraft,undoDirectBatch} from '../domain/v2/directIntake'
import {exportWorkspaceV8,importWorkspaceV8} from '../domain/v2/serialization'

const referenceTime='2026-11-02T04:00:00.000Z',timezone='Asia/Shanghai'
async function emptyRepo(){
 const workspace=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
 const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.save(workspace);return repo
}
async function add(repo:CanonicalWorkspaceRepository,operationId:string,text:string,value:unknown,promptVersion='recognition-semantic-notice-3.1.0'){
 const capture=new CapturePersistenceService(repo),handle=await capture.beginCapture({operationId,sourceType:'text',title:'匿名通知',rawText:text,provider:'deepseek',modelName:'synthetic-offline',promptVersion:null,pipelineVersion:'semantic-reliability-test',now:referenceTime})
 const result=parseRecognitionResult(compileSemanticNotice(value,{source:text,referenceTime,timezone,promptVersion}).result)
 result.evidence.forEach(e=>{e.sourceId=handle.sourceId})
 await capture.recognize(handle,async()=>result)
 const first=assembleProductFirstSuggestion(result,{sourceText:text,referenceTime,timezone})
 await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>d.id===handle.draftId?{...d,result:first.result}:d)}))
 return commitDirectDraft(repo,handle.draftId,referenceTime)
}

describe('semantic repairs across the existing save path',()=>{
 it('keeps two event times and rooms across independent adds, export and batch undo',async()=>{
  const text='校园交流日：11月8日9:00—10:00举办分享会，10:30—12:00举办体验展；地点：大学生活动中心报告厅（分享）、展厅（体验）。'
  const evidence=[text.slice(0,text.indexOf('；')),text.slice(text.indexOf('；')+1,-1)]
  const value={topic:'校园交流日',kind:'event',items:[
   {key:'a',kind:'event',title:'校园交流日分享会',evidence,location:'大学生活动中心报告厅',times:[{role:'start',raw:'11月8日9:00—10:00'},{role:'end',raw:'11月8日9:00—10:00'}]},
   {key:'b',kind:'event',title:'校园交流日体验展',evidence,location:'大学生活动中心展厅',times:[{role:'start',raw:'10:30—12:00'},{role:'end',raw:'10:30—12:00'}]},
  ],materials:[]}
  const repo=await emptyRepo(),first=await add(repo,'semantic-r1',text,value),second=await add(repo,'semantic-r2',text,value)
  const stored=(await repo.load())!
  expect(stored.events).toHaveLength(4)
  const firstEvent=stored.events.find(e=>e.id===first.batch!.items.find(item=>item.tempId==='sem-i2')?.id)!
  expect(firstEvent.location).toContain('展厅')
  expect(stored.timePoints.find(p=>p.id===firstEvent.startTimePointId)?.normalizedValue).toBe('2026-11-08T10:30')
  expect(stored.timePoints.find(p=>p.id===firstEvent.endTimePointId)?.normalizedValue).toBe('2026-11-08T12:00')
  expect(importWorkspaceV8(exportWorkspaceV8(stored)).events).toHaveLength(4)
  await undoDirectBatch(repo,second.batch!.id,referenceTime)
  expect((await repo.load())!.events.map(e=>e.id).sort()).toEqual(first.batch!.items.filter(item=>item.kind==='event').map(item=>item.id).sort())
 })
 it('keeps an alternative date as a description without a definite window',async()=>{
  const text='可选择11月18日或19日前来咨询。'
  const value={topic:'咨询安排',kind:'action',items:[{key:'a',kind:'task',title:'咨询办理安排',action:'咨询',object:'办理安排',evidence:[text],times:[{role:'window',raw:'11月18日或19日'}]}],materials:[]}
  const repo=await emptyRepo();await add(repo,'semantic-alternative',text,value)
  const stored=(await repo.load())!
  expect(stored.tasks[0].description).toContain('11月18日或19日')
  expect(stored.timePoints.every(p=>p.normalizedValue===null)).toBe(true)
  expect(importWorkspaceV8(exportWorkspaceV8(stored)).tasks[0].description).toContain('11月18日或19日')
 })
 it('keeps the thirteenth source-backed requirement in the formal task and export',async()=>{
  const requirements=Array.from({length:13},(_,i)=>`第${i+1}项原文明示要求`)
  const text='请提交材料。'+requirements.join('；')+'。'
  const value={topic:'材料提交',kind:'action',items:[{key:'a',kind:'task',title:'提交材料',action:'提交',object:'材料',evidence:['请提交材料'],requirements}],materials:[]}
  const repo=await emptyRepo();await add(repo,'semantic-requirements',text,value)
  const stored=(await repo.load())!
  for(const requirement of requirements)expect(stored.tasks[0].description).toContain(requirement)
  expect(importWorkspaceV8(exportWorkspaceV8(stored)).tasks[0].description).toContain(requirements[12])
 })
 it('saves shared source requirements on each named delivery and preserves them on export',async()=>{
  const text='作品须为本人原创，不得使用网络图片。电子版提交至平台，纸质版提交至服务台。'
  const value={topic:'作品提交',kind:'action',items:[
   {key:'digital',kind:'task',title:'提交电子版作品',action:'提交',object:'作品',deliveryForm:'电子版',evidence:['电子版提交至平台']},
   {key:'paper',kind:'task',title:'提交纸质版作品',action:'提交',object:'作品',deliveryForm:'纸质版',evidence:['纸质版提交至服务台']},
  ],materials:[],sharedRequirements:[{owners:['digital','paper'],evidence:['作品须为本人原创']},{owners:['digital','paper'],evidence:['不得使用网络图片']}]}
  const repo=await emptyRepo();await add(repo,'semantic-shared',text,value,'recognition-semantic-notice-3.2.0')
  const stored=(await repo.load())!,roundTrip=importWorkspaceV8(exportWorkspaceV8(stored))
  expect(stored.tasks).toHaveLength(2)
  for(const task of stored.tasks){expect(task.description).toContain('作品须为本人原创');expect(task.description).toContain('不得使用网络图片')}
  for(const task of roundTrip.tasks)expect(task.description).toContain('不得使用网络图片')
 })
})
