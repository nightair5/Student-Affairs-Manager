import {expect,it} from 'vitest'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,undoDirectBatchPreservingEdits} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {commitTaskCommand} from './taskCommand'
import {commitEventCompletion} from './eventCompletion'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'

it('persists explicit local grouping without joining deadlines or completion states',async()=>{
 const text='请于3月2日12:00前提交访谈提纲；3月5日18:00前提交调查报告。两项属于同一次课程调查。',now='2027-02-01T09:00:00+08:00'
 const w=createGoldenWorkspaceV8();for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo);await repo.save(w)
 async function add(operationId:string){const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:text,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]});const h=await capture.beginCapture({operationId,sourceType:'text',title:'匿名通知',rawText:text,provider:'local-rules',modelName:null,promptVersion:local.promptVersion,pipelineVersion:'local-goal-test',now});await capture.recognize(h,async()=>local);return commitDirectDraft(repo,h.draftId,now)}
 await add('goal-first');const first=(await new CanonicalWorkspaceRepository(store).load())!,view=workspaceV8ToLegacyView(first)
 expect(view.tasks).toHaveLength(2)
 expect(view.tasks[0].sourceGoal?.id).toBeTruthy();expect(view.tasks[0].sourceGoal?.id).toBe(view.tasks[1].sourceGoal?.id)
 expect(view.tasks.map(t=>t.deadline).sort()).toEqual(['2027-03-02T12:00','2027-03-05T18:00'])
 const second=await add('goal-second');expect((await repo.load())?.tasks).toHaveLength(4)
 await undoDirectBatchPreservingEdits(repo,second.batch!.id,now);expect((await repo.load())?.tasks).toEqual(first.tasks)
 const [a,b]=first.tasks;await commitTaskCommand(repo,{operationId:'goal-complete-one',taskId:a.id,expected:{status:a.status},changes:{status:'completed'},changedAt:now})
 const after=(await new CanonicalWorkspaceRepository(store).load())!
 expect(after.tasks.find(t=>t.id===a.id)?.status).toBe('completed');expect(after.tasks.find(t=>t.id===b.id)?.status).toBe(b.status)
 const backup=importWorkspaceV8(exportWorkspaceV8(after));expect(backup.tasks).toEqual(after.tasks);expect(backup.timePoints).toEqual(after.timePoints)
})

it('saves inline sessions independently and undoes only a second addition',async()=>{
 const text='2027年2月5日9:00—10:00在东楼101举行摄影基础讲座；当天14:00—15:00在西楼202举行声音工作坊。',now='2027-02-01T09:00:00+08:00'
 const w=createGoldenWorkspaceV8();for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo);await repo.save(w)
 async function add(operationId:string){const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:text,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]});const h=await capture.beginCapture({operationId,sourceType:'text',title:'匿名通知',rawText:text,provider:'local-rules',modelName:null,promptVersion:local.promptVersion,pipelineVersion:'local-session-test',now});await capture.recognize(h,async()=>local);return commitDirectDraft(repo,h.draftId,now)}
 await add('session-first');const first=(await new CanonicalWorkspaceRepository(store).load())!,view=workspaceV8ToLegacyView(first)
 expect(view.events.map(e=>[e.startAt,e.endAt,e.location])).toEqual([['2027-02-05T09:00','2027-02-05T10:00','东楼101'],['2027-02-05T14:00','2027-02-05T15:00','西楼202']])
 const second=await add('session-second');expect((await repo.load())?.events).toHaveLength(4)
 await undoDirectBatchPreservingEdits(repo,second.batch!.id,now);expect((await repo.load())?.events).toEqual(first.events)
 const [a,b]=first.events;await commitEventCompletion(repo,{operationId:'session-complete-one',eventId:a.id,expected:false,completed:true,changedAt:now})
 const after=(await new CanonicalWorkspaceRepository(store).load())!,v=workspaceV8ToLegacyView(after)
 expect(v.events.find(e=>e.id===a.id)?.personalCompleted).toBe(true);expect(v.events.find(e=>e.id===b.id)?.personalCompleted).not.toBe(true)
 const backup=importWorkspaceV8(exportWorkspaceV8(after));expect(backup.events).toEqual(after.events);expect(backup.timePoints).toEqual(after.timePoints)
})
