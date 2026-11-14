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

const now='2026-11-14T09:00:00+08:00',timezone='Asia/Shanghai'
async function setup(){
 const blank=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)blank[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(blank)
 async function prepare(text:string,operationId:string){
  const raw=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:text,referenceTime:new Date(now),timezone,projects:[],tasks:[]})
  const assembled=assembleProductFirstSuggestion(raw,{sourceText:text,referenceTime:now,timezone})
  const handle=await capture.beginCapture({operationId,sourceType:'text',title:'匿名通知',rawText:text,provider:'local-rules',modelName:null,promptVersion:raw.promptVersion,pipelineVersion:'local-reference-test',now})
  await capture.recognize(handle,async()=>assembled.result)
  return handle
 }
 async function add(text:string,operationId:string){return commitDirectDraft(repo,(await prepare(text,operationId)).draftId,now)}
 const read=async()=>new CanonicalWorkspaceRepository(store).load().then(w=>w!)
 return {repo,add,prepare,read}
}

it('persists cross-midnight and continuing events, independent completion, repeat addition, undo and backup',async()=>{
 const {repo,add,read}=await setup()
 const night='周六23:30至次日00:30在天台进行观星活动，参与者需携带学生证。'
 const fair='原定周一10:00的校园导览取消；同日15:00在图书馆的书展照常举行。'
 await add(night,'night');await add(fair,'fair')
 const first=await read(),view=workspaceV8ToLegacyView(first)
 expect(view.tasks).toHaveLength(0);expect(view.events).toHaveLength(2)
 const event=view.events.find(e=>e.title==='观星活动')!,book=view.events.find(e=>e.title==='书展')!
 expect([event.startAt,event.endAt,event.location]).toEqual(['2026-11-14T23:30','2026-11-15T00:30','天台'])
 expect(flowEventDate(event)).toContain('23:30');expect(flowEventDate(event)).toContain('00:30')
 expect([book.startAt,book.location]).toEqual(['2026-11-16T15:00','图书馆'])
 const second=await add(night,'night-again');expect((await read()).events).toHaveLength(3)
 await undoDirectBatchPreservingEdits(repo,second.batch!.id,now)
 expect((await read()).events).toEqual(first.events)
 await commitEventCompletion(repo,{operationId:'night-done',eventId:event.id,expected:false,completed:true,changedAt:now})
 let saved=await read(),projection=workspaceV8ToLegacyView(saved)
 expect(projection.events.find(e=>e.id===event.id)?.personalCompleted).toBe(true)
 expect(projection.events.find(e=>e.id===book.id)?.personalCompleted).not.toBe(true)
 await commitEventCompletion(repo,{operationId:'night-restore',eventId:event.id,expected:true,expectedRevision:'night-done',completed:false,changedAt:now})
 saved=importWorkspaceV8(exportWorkspaceV8(await read()));projection=workspaceV8ToLegacyView(saved)
 expect(projection.events.every(e=>!e.personalCompleted)).toBe(true)
 expect(projection.events.find(e=>e.id===event.id)?.endAt).toBe('2026-11-15T00:30')
 expect(validateWorkspaceV8(saved).valid).toBe(true)
})

it('preserves referenced electronic submission facts through edits, planning, completion, restoration and protected undo',async()=>{
 const {repo,add,read}=await setup()
 const text='纸质申请材料取消提交，电子版仍须周四20:00前发至 office@example.edu。'
 const receipt=await add(text,'delivery'),saved=await read(),task=saved.tasks[0]
 let view=workspaceV8ToLegacyView(saved).tasks[0]
 expect(saved.tasks).toHaveLength(1);expect(saved.events).toHaveLength(0)
 expect(view.deadline).toBe('2026-11-19T20:00')
 expect(view.materials[0]).toMatchObject({name:'申请材料',submissionChannel:'office@example.edu',formatRequirements:['电子版']})
 const second=await add(text,'delivery-again')
 await undoDirectBatchPreservingEdits(repo,second.batch!.id,now)
 expect((await read()).tasks).toEqual(saved.tasks)
 await commitTaskCommand(repo,{operationId:'rename-delivery',taskId:task.id,expected:{title:task.title},changes:{title:'发送我的申请材料'},changedAt:now})
 await setTaskSchedule(repo,task.id,'2026-11-18',now)
 await commitTaskCommand(repo,{operationId:'delivery-done',taskId:task.id,expected:{status:task.status},changes:{status:'completed'},changedAt:now})
 expect((await read()).tasks[0].status).toBe('completed')
 await commitTaskCommand(repo,{operationId:'delivery-restore',taskId:task.id,expected:{status:'completed'},changes:{status:task.status},changedAt:now})
 const roundtrip=importWorkspaceV8(exportWorkspaceV8(await read()))
 view=workspaceV8ToLegacyView(roundtrip).tasks[0]
 expect([view.title,view.deadline,view.plannedStart]).toEqual(['发送我的申请材料','2026-11-19T20:00','2026-11-18'])
 expect(roundtrip.materials).toEqual(saved.materials)
 await expect(undoDirectBatchPreservingEdits(repo,receipt.batch!.id,now)).rejects.toThrow('这批事项已修改')
 expect((await read()).tasks.some(t=>t.id===task.id&&t.title==='发送我的申请材料')).toBe(true)
})

it('saves organizer processing as retained context, and an injected commit failure leaves the source recoverable without partial entities',async()=>{
 const {repo,prepare,read}=await setup()
 const text='请周一前提交申请表。学院周三审核并于周五公布名单。'
 const handle=await prepare(text,'org-flow'),before=await read(),transaction=repo.transaction.bind(repo)
 repo.transaction=async()=>{throw Error('INJECTED_COMMIT_FAILURE')}
 await expect(commitDirectDraft(repo,handle.draftId,now)).rejects.toThrow('INJECTED_COMMIT_FAILURE')
 expect(await read()).toEqual(before)
 expect(before.sourceVersions.some(version=>version.rawText===text)).toBe(true)
 repo.transaction=transaction
 await commitDirectDraft(repo,handle.draftId,now)
 const saved=importWorkspaceV8(exportWorkspaceV8(await read())),view=workspaceV8ToLegacyView(saved)
 expect(view.tasks).toHaveLength(1);expect(view.events).toHaveLength(0)
 expect(view.tasks[0].deadline).toBe('2026-11-16')
 expect(view.tasks[0].description).toContain('学院周三审核并于周五公布名单')
 expect(validateWorkspaceV8(saved).valid).toBe(true)
})
