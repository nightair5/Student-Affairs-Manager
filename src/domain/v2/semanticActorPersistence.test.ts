import {describe,expect,it} from 'vitest'
import {compileSemanticNotice} from '../../../cloudflare/semantic-notice-compiler-v3.mjs'
import {parseRecognitionResult} from '../../recognition/schema'
import {taskPublicSummary} from '../../lib/taskContentPresentation'
import {flowTaskDate} from '../../lib/flowPresentation'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'

const source='同学请于11月12日17:00前将申请表交给组长。组长于11月13日12:00前汇总发送申请表至office@example.org。'
const facts={topic:'申请表',kind:'action',items:[
 {key:'student',kind:'task',title:'向组长提交申请表',action:'提交',object:'申请表',evidence:['同学请于11月12日17:00前将申请表交给组长'],times:[{role:'deadline',raw:'11月12日17:00前'}],assignment:{scope:'audience',actor:'同学',evidence:'同学请于11月12日17:00前将申请表交给组长'}},
 {key:'leader',kind:'task',title:'组长汇总发送申请表',action:'发送',object:'申请表',evidence:['组长于11月13日12:00前汇总发送申请表至office@example.org'],times:[{role:'deadline',raw:'11月13日12:00前'}],channel:'office@example.org',dependsOn:['student'],assignment:{scope:'other',actor:'组长',evidence:'组长于11月13日12:00前汇总发送申请表至office@example.org',relatedTo:'student'}},
],materials:[]}

describe('downstream actor context through the canonical repository',()=>{
 it('retains the student deadline and the other role context without assigning its channel or time to the student',async()=>{
  const now='2026-11-05T10:00:00+08:00'
  const compiled=compileSemanticNotice(facts,{source,referenceTime:now,timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.3.0'})
  const result=parseRecognitionResult(compiled.result)
  const workspace=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
  const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store)
  await repo.save(workspace)
  const capture=new CapturePersistenceService(repo),handle=await capture.beginCapture({operationId:'actor-fixture',sourceType:'text',title:'申请表',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:'recognition-semantic-notice-3.3.0',pipelineVersion:'test',now})
  await capture.recognize(handle,async()=>result)
  await commitDirectDraft(repo,handle.draftId,now)
  const saved=(await new CanonicalWorkspaceRepository(store).load())!
  const view=workspaceV8ToLegacyView(saved),task=view.tasks[0]
  expect(view.tasks).toHaveLength(1)
  expect(task.deadline).toBe('2026-11-12T17:00')
  expect(task.description).toContain('后续由组长办理')
  expect(task.description).toContain('11月13日12:00')
  expect(task.description).toContain('office@example.org')
  expect(taskPublicSummary(task).channels).toContain('组长')
  expect(taskPublicSummary(task).channels).not.toContain('office@example.org')
  const restored=importWorkspaceV8(exportWorkspaceV8(saved))
  expect(workspaceV8ToLegacyView(restored).tasks[0].description).toBe(task.description)
  expect(workspaceV8ToLegacyView(restored).tasks[0].deadline).toBe(task.deadline)
 })
 it('retains a cited multi-date service schedule as unresolved context through save and JSON round trip',async()=>{
  const now='2026-11-05T10:00:00+08:00',text='需要设备借用的同学可在线预约并携学生证办理。服务点在11月10日、11月17日的9:00至11:00受理。'
  const action='需要设备借用的同学可在线预约并携学生证办理',schedule='服务点在11月10日、11月17日的9:00至11:00受理'
  const value={topic:'设备借用',kind:'action',items:[{key:'borrow',kind:'task',title:'办理设备借用',action:'办理',object:'设备借用',evidence:[action],assignment:{scope:'audience',actor:'同学',evidence:action},contextFacts:[{kind:'receiving_schedule',quote:schedule}]}],materials:[]}
  const result=parseRecognitionResult(compileSemanticNotice(value,{source:text,referenceTime:now,timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.5.0'}).result)
  const workspace=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
  const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store);await repo.save(workspace)
  const capture=new CapturePersistenceService(repo),handle=await capture.beginCapture({operationId:'service-context-fixture',sourceType:'text',title:'设备借用',rawText:text,provider:'deepseek',modelName:'fixture',promptVersion:'recognition-semantic-notice-3.5.0',pipelineVersion:'test',now})
  await capture.recognize(handle,async()=>result);await commitDirectDraft(repo,handle.draftId,now)
  const saved=(await new CanonicalWorkspaceRepository(store).load())!,task=workspaceV8ToLegacyView(saved).tasks[0]
  expect(task.sourceWindowLabel).toContain(schedule);expect(flowTaskDate(task)).toContain('11月10日、11月17日')
  expect(task.deadline).toBeFalsy();expect(task.sourceWindowStart).toBeUndefined();expect(task.sourceWindowEnd).toBeUndefined()
  const restored=workspaceV8ToLegacyView(importWorkspaceV8(exportWorkspaceV8(saved))).tasks[0]
  expect(restored.sourceWindowLabel).toBe(task.sourceWindowLabel);expect(restored.description).toContain(schedule)
 })
})
