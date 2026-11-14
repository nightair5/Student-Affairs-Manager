import {expect,it} from 'vitest'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {assembleProductFirstSuggestion} from '../../recognition/materialChannelGrounding'
import {eventActionGroups} from '../../lib/homeFlow'
import {flowEventDate} from '../../lib/flowPresentation'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,undoDirectBatchPreservingEdits} from './directIntake'
import {commitEventCompletion} from './eventCompletion'
import {commitTaskCommand} from './taskCommand'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'

it('keeps independently completed sessions and the form only with its named event across save and undo',async()=>{
 const source='【实践活动】为帮助同学了解内容，现安排两场面向报名同学的活动。周一上午09:00—10:30在东楼301举行选题讲座。周一下午14:00—16:00在西楼102举行成果工作坊。希望参加工作坊的同学请周日20:00前填写在线报名表；讲座无需报名。两场均可自愿参加。',now='2026-11-14T09:00:00+08:00'
 const blank=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)blank[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(blank)
 async function add(operationId:string){
  const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
  const assembled=assembleProductFirstSuggestion(local,{sourceText:source,referenceTime:now,timezone:'Asia/Shanghai'})
  const handle=await capture.beginCapture({operationId,sourceType:'text',title:'匿名通知',rawText:source,provider:'local-rules',modelName:null,promptVersion:local.promptVersion,pipelineVersion:'local-sessions-test',now})
  await capture.recognize(handle,async()=>assembled.result)
  return commitDirectDraft(repo,handle.draftId,now)
 }
 await add('scoped-first')
 const first=(await new CanonicalWorkspaceRepository(store).load())!,view=workspaceV8ToLegacyView(first)
 expect(view.events.map(event=>[event.title,event.startAt,event.endAt,event.location])).toEqual([
  ['选题讲座','2026-11-16T09:00','2026-11-16T10:30','东楼301'],['成果工作坊','2026-11-16T14:00','2026-11-16T16:00','西楼102'],
 ])
 expect(view.tasks).toHaveLength(1);expect(view.tasks[0].title).toContain('在线报名表');expect(view.tasks[0].deadline).toBe('2026-11-15T20:00')
 const groups=eventActionGroups(view.tasks,view.events,first),[lecture,workshop]=view.events
 expect(groups[workshop.id]?.map(task=>task.id)).toContain(view.tasks[0].id)
 expect(groups[lecture.id]??[]).toHaveLength(0)
 const second=await add('scoped-second')
 expect((await repo.load())?.events).toHaveLength(4)
 await undoDirectBatchPreservingEdits(repo,second.batch!.id,now)
 expect((await repo.load())?.events).toEqual(first.events)
 await commitEventCompletion(repo,{operationId:'complete-first-session',eventId:lecture.id,expected:false,completed:true,changedAt:now})
 let saved=(await new CanonicalWorkspaceRepository(store).load())!,reloaded=workspaceV8ToLegacyView(saved)
 expect(reloaded.events.find(event=>event.id===lecture.id)?.personalCompleted).toBe(true)
 expect(reloaded.events.find(event=>event.id===workshop.id)?.personalCompleted).not.toBe(true)
 const task=saved.tasks.find(item=>item.id===view.tasks[0].id)!
 await commitTaskCommand(repo,{operationId:'complete-form',taskId:task.id,expected:{status:task.status},changes:{status:'completed'},changedAt:now})
 await commitTaskCommand(repo,{operationId:'restore-form',taskId:task.id,expected:{status:'completed'},changes:{status:task.status},changedAt:now})
 await commitEventCompletion(repo,{operationId:'restore-first-session',eventId:lecture.id,expected:true,expectedRevision:'complete-first-session',completed:false,changedAt:now})
 saved=importWorkspaceV8(exportWorkspaceV8((await repo.load())!));reloaded=workspaceV8ToLegacyView(saved)
 expect(reloaded.events.every(event=>!event.personalCompleted)).toBe(true)
 expect(reloaded.tasks[0].deadline).toBe('2026-11-15T20:00')
 expect(eventActionGroups(reloaded.tasks,reloaded.events,saved)[workshop.id]?.map(item=>item.id)).toContain(task.id)
})

it('saves and reloads an undated event without fabricating a day or end time',async()=>{
 const source='线上经验交流会晚上9点15分开始，约15分钟；日期另行通知。欢迎参加。',now='2026-11-14T09:00:00+08:00'
 const blank=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)blank[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(blank)
 const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
 const assembled=assembleProductFirstSuggestion(local,{sourceText:source,referenceTime:now,timezone:'Asia/Shanghai'})
 const handle=await capture.beginCapture({operationId:'undated-clock',sourceType:'text',title:'匿名通知',rawText:source,provider:'local-rules',modelName:null,promptVersion:local.promptVersion,pipelineVersion:'local-sessions-test',now})
 await capture.recognize(handle,async()=>assembled.result)
 await commitDirectDraft(repo,handle.draftId,now)
 const saved=importWorkspaceV8(exportWorkspaceV8((await new CanonicalWorkspaceRepository(store).load())!)),view=workspaceV8ToLegacyView(saved)
 expect(view.events).toHaveLength(1);expect(view.tasks).toHaveLength(0)
 expect(view.events[0].startAt).toBeFalsy();expect(view.events[0].endAt).toBeFalsy()
 expect(flowEventDate(view.events[0])).toBe('晚上9点15分（日期待定）')
 expect(view.events[0].description).toContain('原文时长：约15分钟')
})

it('persists a later scoped registration with the correct event and its own deadline',async()=>{
 const source='周三上午10:00在一号楼举办信息会，下午15:00在二号楼举办作品交流；请于周二18:00前为信息会报名。',now='2026-11-14T09:00:00+08:00'
 const blank=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)blank[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(blank)
 const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
 const assembled=assembleProductFirstSuggestion(local,{sourceText:source,referenceTime:now,timezone:'Asia/Shanghai'})
 const handle=await capture.beginCapture({operationId:'later-registration',sourceType:'text',title:'匿名通知',rawText:source,provider:'local-rules',modelName:null,promptVersion:local.promptVersion,pipelineVersion:'local-sessions-test',now})
 await capture.recognize(handle,async()=>assembled.result)
 await commitDirectDraft(repo,handle.draftId,now)
 const saved=importWorkspaceV8(exportWorkspaceV8((await new CanonicalWorkspaceRepository(store).load())!)),view=workspaceV8ToLegacyView(saved)
 expect(view.events.map(event=>[event.title,event.startAt,event.location])).toEqual([['信息会','2026-11-18T10:00','一号楼'],['作品交流','2026-11-18T15:00','二号楼']])
 expect(view.tasks.map(task=>[task.title,task.deadline])).toEqual([['报名信息会','2026-11-17T18:00']])
 const groups=eventActionGroups(view.tasks,view.events,saved)
 expect(groups[view.events[0].id]?.map(task=>task.id)).toContain(view.tasks[0].id)
 expect(groups[view.events[1].id]??[]).toHaveLength(0)
})
