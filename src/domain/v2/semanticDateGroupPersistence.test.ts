import {describe,expect,it} from 'vitest'
import {compileSemanticNotice} from '../../../cloudflare/semantic-notice-compiler-v3.mjs'
import {parseRecognitionResult} from '../../recognition/schema'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,undoDirectBatchPreservingEdits} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {commitTaskCommand} from './taskCommand'
import {setTaskSchedule} from './taskSchedule'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'

describe('source-backed shared dates and grouped goals persist independently',()=>{
 it('retains each event, each due date and each task completion through readback, backup and batch undo',async()=>{
  const now='2026-11-07T10:00:00+08:00'
  const source='2027年3月10日9:00在东楼举办绘画工作坊，14:00在西楼举办戏剧工作坊。\n学业总结提交：一年级同学于2027年3月15日12:00前提交课程心得；二年级同学于3月16日17:00前提交课程反思。'
  const raw={topic:'工作坊与学业总结',summary:'2027年3月10日举办绘画工作坊和戏剧工作坊。',kind:'mixed',items:[
   {key:'a',kind:'event',title:'绘画工作坊',location:'东楼',evidence:['2027年3月10日9:00在东楼举办绘画工作坊'],times:[{role:'start',raw:'2027年3月10日9:00'}]},
   {key:'b',kind:'event',title:'戏剧工作坊',location:'西楼',evidence:['14:00在西楼举办戏剧工作坊'],times:[{role:'start',raw:'14:00'}]},
   {key:'c',kind:'task',title:'提交课程心得',action:'提交',object:'课程心得',condition:'一年级同学',evidence:['一年级同学于2027年3月15日12:00前提交课程心得'],times:[{role:'deadline',raw:'2027年3月15日12:00前'}]},
   {key:'d',kind:'task',title:'提交课程反思',action:'提交',object:'课程反思',condition:'二年级同学',evidence:['二年级同学于3月16日17:00前提交课程反思'],times:[{role:'deadline',raw:'3月16日17:00前'}]}
  ],materials:[],goals:[{key:'summary',title:'提交学业总结',anchor:'学业总结',evidence:'学业总结提交',taskKeys:['c','d']}]}
  const parsed=parseRecognitionResult(compileSemanticNotice(raw,{source,referenceTime:now,timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.11.0'}).result)
  const workspace=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
  const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
  await repo.save(workspace)
  async function add(operationId:string){const h=await capture.beginCapture({operationId,sourceType:'text',title:'匿名通知',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:parsed.promptVersion,pipelineVersion:'test',now});await capture.recognize(h,async()=>parsed);return commitDirectDraft(repo,h.draftId,now)}
  const first=await add('first'),saved=(await new CanonicalWorkspaceRepository(store).load())!,view=workspaceV8ToLegacyView(saved)
  expect(view.events).toHaveLength(2);expect(view.tasks).toHaveLength(2)
  expect(saved.timePoints.filter(p=>p.type==='event_start').map(p=>p.normalizedValue)).toEqual(['2027-03-10T09:00','2027-03-10T14:00'])
  expect(saved.timePoints.filter(p=>p.type==='task_deadline').map(p=>p.normalizedValue)).toEqual(['2027-03-15T12:00','2027-03-16T17:00'])
  expect(view.tasks[0].sourceGoal?.id).toBe(view.tasks[1].sourceGoal?.id);expect(view.tasks[0].sourceGoal?.title).toBe('提交学业总结')
  const second=await add('second');expect((await repo.load())!.tasks).toHaveLength(4)
  await undoDirectBatchPreservingEdits(repo,second.batch!.id,'2026-11-07T10:01:00+08:00')
  const after=(await new CanonicalWorkspaceRepository(store).load())!;expect(after.tasks).toEqual(saved.tasks);expect(after.events).toEqual(saved.events)
  const task=after.tasks[0],other=after.tasks[1]
  await commitTaskCommand(repo,{operationId:'finish-one',taskId:task.id,expected:{status:task.status},changes:{status:'completed'},changedAt:'2026-11-07T10:02:00+08:00'})
  await setTaskSchedule(repo,other.id,'2027-03-14','2026-11-07T10:03:00+08:00')
  const edited=(await new CanonicalWorkspaceRepository(store).load())!
  expect(edited.tasks.find(t=>t.id===task.id)?.status).toBe('completed');expect(edited.tasks.find(t=>t.id===other.id)?.status).toBe(other.status)
  expect(edited.timePoints.filter(p=>p.type==='task_deadline').map(p=>p.normalizedValue)).toEqual(['2027-03-15T12:00','2027-03-16T17:00'])
  const roundtrip=importWorkspaceV8(exportWorkspaceV8(edited));expect(roundtrip.tasks).toEqual(edited.tasks);expect(roundtrip.events).toEqual(edited.events);expect(roundtrip.timePoints).toEqual(edited.timePoints)
  await expect(undoDirectBatchPreservingEdits(repo,first.batch!.id,'2026-11-07T10:04:00+08:00')).rejects.toThrow()
  expect((await repo.load())!.tasks).toHaveLength(2)
 })
})
