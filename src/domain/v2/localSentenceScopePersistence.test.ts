import {expect,it} from 'vitest'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {assembleProductFirstSuggestion} from '../../recognition/materialChannelGrounding'
import {flowEventDate} from '../../lib/flowPresentation'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,undoDirectBatchPreservingEdits} from './directIntake'
import {commitEventCompletion} from './eventCompletion'
import {commitTaskCommand} from './taskCommand'
import {setTaskSchedule} from './taskSchedule'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'
import {validateWorkspaceV8} from './validators/workspaceValidator'

const now='2026-11-15T09:00:00+08:00',timezone='Asia/Shanghai'
async function setup(){
 const blank=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)blank[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(blank)
 async function prepare(text:string,operationId:string){
  const raw=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:text,referenceTime:new Date(now),timezone,projects:[],tasks:[]})
  const assembled=assembleProductFirstSuggestion(raw,{sourceText:text,referenceTime:now,timezone})
  const handle=await capture.beginCapture({operationId,sourceType:'text',title:'匿名通知',rawText:text,provider:'local-rules',modelName:null,promptVersion:raw.promptVersion,pipelineVersion:'local-sentence-test',now})
  await capture.recognize(handle,async()=>assembled.result)
  return handle
 }
 async function add(text:string,operationId:string){return commitDirectDraft(repo,(await prepare(text,operationId)).draftId,now)}
 const read=async()=>new CanonicalWorkspaceRepository(store).load().then(w=>w!)
 return {repo,prepare,add,read}
}

it('keeps cross-sentence and cross-midnight endpoints after readback, independent completion, undo and backup',async()=>{
 const {repo,add,read}=await setup(),text='11月22日09:00在甲楼举行校史讲座。同日22:30至次日00:15在天台进行观测活动。'
 await add(text,'first')
 const original=await read(),view=workspaceV8ToLegacyView(original),night=view.events.find(e=>e.title==='观测活动')!
 expect(view.events).toHaveLength(2)
 expect([night.startAt,night.endAt,night.location]).toEqual(['2026-11-22T22:30','2026-11-23T00:15','天台'])
 const again=await add(text,'second')
 await undoDirectBatchPreservingEdits(repo,again.batch!.id,now)
 expect((await read()).events).toEqual(original.events)
 await commitEventCompletion(repo,{operationId:'complete-night',eventId:night.id,expected:false,completed:true,changedAt:now})
 let saved=workspaceV8ToLegacyView(await read())
 expect(saved.events.find(e=>e.id===night.id)?.personalCompleted).toBe(true)
 expect(saved.events.find(e=>e.id!==night.id)?.personalCompleted).not.toBe(true)
 await commitEventCompletion(repo,{operationId:'restore-night',eventId:night.id,expected:true,expectedRevision:'complete-night',completed:false,changedAt:now})
 const restored=importWorkspaceV8(exportWorkspaceV8(await read()));saved=workspaceV8ToLegacyView(restored)
 expect(saved.events.find(e=>e.id===night.id)?.endAt).toBe('2026-11-23T00:15')
 expect(saved.events.every(e=>!e.personalCompleted)).toBe(true)
 expect(validateWorkspaceV8(restored).valid).toBe(true)
 const pending=await add('周一或周二安排导览。同日15:00在北馆的摄影展照常举行。','unknown')
 expect(pending.batch).toBeTruthy()
 const exhibition=workspaceV8ToLegacyView(await read()).events.find(e=>e.title==='摄影展')!
 expect(flowEventDate(exhibition)).toBe('15:00（日期待定）')
})

it('keeps recovered long-notice actions and named requirements through editing, planning and protected undo',async()=>{
 const {repo,add,read}=await setup()
 const text='研究交流申请\n往年入选作品只作展示。\n申请者请周二12:00前在学院平台填写申请表；周四18:30前把研究提纲PDF发送至 study@example.edu。\n研究提纲须本人签名，最多3页。研究中心统一审核后公布结果，申请者无需参加审核。'
 const receipt=await add(text,'long'),original=await read()
 expect(original.events).toHaveLength(0);expect(original.tasks).toHaveLength(2)
 const task=original.tasks.find(t=>t.title.includes('填写'))!,other=original.tasks.find(t=>t.id!==task.id)!
 await commitTaskCommand(repo,{operationId:'fill-done',taskId:task.id,expected:{status:task.status},changes:{status:'completed'},changedAt:now})
 expect((await read()).tasks.find(t=>t.id===other.id)?.status).toBe(other.status)
 await commitTaskCommand(repo,{operationId:'fill-restore',taskId:task.id,expected:{status:'completed'},changes:{status:task.status},changedAt:now})
 await setTaskSchedule(repo,task.id,'2026-11-16',now)
 await commitTaskCommand(repo,{operationId:'rename',taskId:task.id,expected:{title:task.title},changes:{title:'填写我的申请表'},changedAt:now})
 const roundtrip=importWorkspaceV8(exportWorkspaceV8(await read())),view=workspaceV8ToLegacyView(roundtrip)
 expect(view.tasks.find(t=>t.id===task.id)).toMatchObject({title:'填写我的申请表',deadline:'2026-11-17T12:00',plannedStart:'2026-11-16'})
 expect(view.tasks.find(t=>t.id===other.id)?.deadline).toBe('2026-11-19T18:30')
 expect(roundtrip.materials.some(m=>m.requirements.some(req=>req.includes('本人签名，最多3页')))).toBe(true)
 expect(validateWorkspaceV8(roundtrip).valid).toBe(true)
 await expect(undoDirectBatchPreservingEdits(repo,receipt.batch!.id,now)).rejects.toThrow('这批事项已修改')
})

it('keeps a failed new multi-action commit atomic and safely retries the same saved draft',async()=>{
 const {repo,prepare,read}=await setup(),text='参加课程成果评选，请周二前在平台填写信息，周五20:00前把作品PDF发送至 review@example.edu。'
 const handle=await prepare(text,'failure'),before=await read(),transaction=repo.transaction.bind(repo)
 repo.transaction=async()=>{throw Error('INJECTED_STORAGE_FAILURE')}
 await expect(commitDirectDraft(repo,handle.draftId,now)).rejects.toThrow('INJECTED_STORAGE_FAILURE')
 expect(await read()).toEqual(before);expect(before.sourceVersions.some(s=>s.rawText===text)).toBe(true)
 repo.transaction=transaction
 await commitDirectDraft(repo,handle.draftId,now)
 await commitDirectDraft(repo,handle.draftId,now)
 expect((await read()).tasks).toHaveLength(2);expect((await read()).events).toHaveLength(0)
})
