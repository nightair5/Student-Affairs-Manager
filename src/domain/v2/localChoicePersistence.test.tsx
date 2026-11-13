import {describe,expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {FlowTimeline} from '../../components/FlowTimeline'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,undoDirectBatchPreservingEdits} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {selectSourceChoice} from './sourceChoice'
import {commitTaskCommand} from './taskCommand'
import {setTaskSchedule} from './taskSchedule'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'

const now='2026-11-13T08:00:00+08:00'
const source='成绩证明提交：电子版可在12月23日18:00前发送至平台，纸质版可在12月24日中午12:00前交至服务窗口，两种方式任选一种。'

describe('local choice through real capture and repository',()=>{
 it('saves both source-scoped branches and retains separate status, schedule, backup and batch undo',async()=>{
  const w=createGoldenWorkspaceV8()
  for(const k of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[k]=[]
  const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
  await repo.save(w)
  const result=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
  const add=async(operationId:string)=>{
   const h=await capture.beginCapture({operationId,sourceType:'text',title:'匿名通知',rawText:source,provider:'local-rules',modelName:'local-rules',promptVersion:result.promptVersion,pipelineVersion:'test',now})
   await capture.recognize(h,async()=>structuredClone(result))
   return commitDirectDraft(repo,h.draftId,now)
  }
  const first=await add('local-choice-first'),read=()=>new CanonicalWorkspaceRepository(store).load()
  let saved=(await read())!,view=workspaceV8ToLegacyView(saved)
  expect(view.tasks).toHaveLength(2)
  expect(new Set(view.tasks.map(t=>t.sourceChoice?.id)).size).toBe(1)
  expect(view.tasks.map(t=>t.deadline).sort()).toEqual(['2026-12-23T18:00','2026-12-24T12:00'])
  expect(view.tasks.map(t=>t.materials[0].submissionChannel).sort()).toEqual(['平台','服务窗口'])
  const html=renderToStaticMarkup(<FlowTimeline tasks={view.tasks} allTasks={view.tasks} events={[]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} />)
  expect(html).toContain('以下方式任选一项完成')
  const target=saved.tasks[0],other=saved.tasks[1]
  await selectSourceChoice(repo,target.id,null,now)
  await setTaskSchedule(repo,target.id,'2026-12-20',now)
  await commitTaskCommand(repo,{operationId:'local-choice-complete',taskId:target.id,expected:{status:target.status},changes:{status:'completed'},changedAt:now})
  saved=(await read())!;view=workspaceV8ToLegacyView(saved)
  expect(saved.tasks.find(t=>t.id===other.id)?.status).toBe(other.status)
  expect(view.tasks.map(t=>t.deadline).sort()).toEqual(['2026-12-23T18:00','2026-12-24T12:00'])
  expect(view.tasks.every(t=>t.sourceChoice?.selectedTaskId===target.id)).toBe(true)
  await commitTaskCommand(repo,{operationId:'local-choice-restore',taskId:target.id,expected:{status:'completed'},changes:{status:target.status},changedAt:now})
  const beforeRepeat=(await read())!,second=await add('local-choice-second')
  expect((await read())!.tasks).toHaveLength(4)
  await undoDirectBatchPreservingEdits(repo,second.batch!.id,now)
  const afterUndo=(await read())!
  expect(afterUndo.tasks).toEqual(beforeRepeat.tasks)
  expect(first.batch?.id).not.toBe(second.batch?.id)
  const restored=workspaceV8ToLegacyView(importWorkspaceV8(exportWorkspaceV8(afterUndo)))
  expect(restored.tasks.map(t=>t.sourceChoice)).toEqual(workspaceV8ToLegacyView(afterUndo).tasks.map(t=>t.sourceChoice))
  expect(restored.tasks.map(t=>t.deadline).sort()).toEqual(['2026-12-23T18:00','2026-12-24T12:00'])
 })
})
