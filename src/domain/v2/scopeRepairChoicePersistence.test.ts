import {expect,it} from 'vitest'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {assembleProductFirstSuggestion} from '../../recognition/materialChannelGrounding'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,undoDirectBatchPreservingEdits} from './directIntake'
import {commitTaskCommand} from './taskCommand'
import {setTaskSchedule} from './taskSchedule'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'

it('persists choice branches, shared materials and independent state without affecting another batch',async()=>{
 const source='【课程资料提交】本次资料可以选择电子版或纸质版，任选一种即可。电子版须在周二18:00前上传PDF至课程平台；纸质版须在周四12:00前交到教学楼办公室。无论选择哪种方式，均需在首页签名，并附一页承诺书。',now='2026-11-14T09:00:00+08:00'
 const blank=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)blank[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(blank)
 async function add(operationId:string){
  const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
  const assembled=assembleProductFirstSuggestion(local,{sourceText:source,referenceTime:now,timezone:'Asia/Shanghai'})
  const handle=await capture.beginCapture({operationId,sourceType:'text',title:'匿名通知',rawText:source,provider:'local-rules',modelName:null,promptVersion:local.promptVersion,pipelineVersion:'scope-repair-test',now})
  await capture.recognize(handle,async()=>assembled.result)
  return commitDirectDraft(repo,handle.draftId,now)
 }
 await add('choice-first')
 const first=(await new CanonicalWorkspaceRepository(store).load())!,view=workspaceV8ToLegacyView(first)
 expect(view.tasks).toHaveLength(2)
 expect(view.tasks[0].sourceChoice?.id).toBeTruthy()
 expect(view.tasks[0].sourceChoice?.id).toBe(view.tasks[1].sourceChoice?.id)
 expect(view.tasks.map(task=>task.deadline)).toEqual(['2026-11-17T18:00','2026-11-19T12:00'])
 expect(first.materials.find(material=>material.name==='承诺书')?.relatedTaskIds).toHaveLength(2)
 const second=await add('choice-second')
 expect((await repo.load())?.tasks).toHaveLength(4)
 await undoDirectBatchPreservingEdits(repo,second.batch!.id,now)
 expect((await repo.load())?.tasks).toEqual(first.tasks)
 const [a,b]=first.tasks
 await setTaskSchedule(repo,a.id,'2026-11-15',now)
 await commitTaskCommand(repo,{operationId:'choice-complete',taskId:a.id,expected:{status:a.status},changes:{status:'completed'},changedAt:now})
 let saved=(await new CanonicalWorkspaceRepository(store).load())!
 expect(saved.tasks.find(task=>task.id===a.id)?.status).toBe('completed')
 expect(saved.tasks.find(task=>task.id===b.id)?.status).toBe(b.status)
 expect(workspaceV8ToLegacyView(saved).tasks.find(task=>task.id===a.id)?.deadline).toBe('2026-11-17T18:00')
 await commitTaskCommand(repo,{operationId:'choice-restore',taskId:a.id,expected:{status:'completed'},changes:{status:a.status},changedAt:now})
 saved=(await new CanonicalWorkspaceRepository(store).load())!
 const restored=workspaceV8ToLegacyView(importWorkspaceV8(exportWorkspaceV8(saved)))
 expect(restored.tasks.map(task=>task.deadline)).toEqual(['2026-11-17T18:00','2026-11-19T12:00'])
 expect(restored.tasks[0].sourceChoice?.id).toBe(restored.tasks[1].sourceChoice?.id)
 expect(saved.tasks.find(task=>task.id===a.id)?.status).toBe(a.status)
})
