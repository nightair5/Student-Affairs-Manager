import {describe,expect,it} from 'vitest'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {commitDirectDraft,undoDirectBatchPreservingEdits} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {commitTaskCommand} from './taskCommand'
import {homeFlow} from '../../lib/homeFlow'
import {linearTaskWorkflows} from '../../lib/taskWorkflow'

const now='2026-11-01T08:00:00.000Z'

describe('ordered presentation over persisted direct tasks',()=>{
 it('keeps independent tasks, deadlines and progress across readback without mutating the saved batch',async()=>{
  const initial=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)initial[key]=[]
  const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
  await repo.save(initial)
  const text='请于2026年11月7日17:00前填写实践报名表。完成后请于2026年11月8日12:00前提交课程论文。'
  const capture=new CapturePersistenceService(repo)
  const handle=await capture.beginCapture({operationId:'workflow-fixture',sourceType:'text',title:'匿名工程夹具',rawText:text,provider:'local-rules',modelName:'local-rules',promptVersion:'local',pipelineVersion:'test',now})
  await capture.recognize(handle,async()=>{
   const result=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名工程夹具',content:text,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
   expect(result.standaloneTasks).toHaveLength(2)
   result.standaloneTasks[1].dependencyTempIds=[result.standaloneTasks[0].tempId]
   return result
  })
  const receipt=await commitDirectDraft(repo,handle.draftId,now)
  const saved=(await repo.load())!,before=structuredClone(saved)
  let view=workspaceV8ToLegacyView(saved),flow=homeFlow(view.tasks,[],new Date(now))
  const visible=new Set([...flow.today,...flow.next,...flow.undated,...flow.deferred.map(item=>item.task)].map(task=>task.id))
  const groups=linearTaskWorkflows(view.tasks,visible,new Set(),new Date(now))
  expect(groups).toHaveLength(1)
  expect(groups[0]).toHaveLength(2)
  expect(groups[0][1].dependencyIds).toEqual([groups[0][0].id])
  expect((await repo.load())!.tasks).toEqual(before.tasks)
  const first=saved.tasks.find(task=>task.id===groups[0][0].id)!
  const second=saved.tasks.find(task=>task.id===groups[0][1].id)!
  await commitTaskCommand(repo,{operationId:'complete-first',taskId:first.id,expected:{status:first.status},changes:{status:'completed'},changedAt:'2026-11-01T08:01:00Z'})
  const after=(await repo.load())!
  expect(after.tasks.find(task=>task.id===second.id)?.status).toBe(second.status)
  expect(after.timePoints).toEqual(before.timePoints)
  view=workspaceV8ToLegacyView(after);flow=homeFlow(view.tasks,[],new Date(now))
  const ready=new Set([...flow.today,...flow.next,...flow.undated].map(task=>task.id))
  expect(ready.has(second.id)).toBe(true)
  expect(linearTaskWorkflows(view.tasks,ready,new Set(),new Date(now))[0].map(task=>task.status)).toEqual(['已完成','待开始'])
  // An unchanged batch can still be undone; completing a task is protected by
  // the pre-existing user-edit guard instead of silently deleting the edit.
  await expect(undoDirectBatchPreservingEdits(repo,receipt.batch!.id)).rejects.toThrow()
  expect((await repo.load())!.tasks).toHaveLength(2)
 })
})
