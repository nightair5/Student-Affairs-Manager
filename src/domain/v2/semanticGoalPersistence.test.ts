import {describe,expect,it} from 'vitest'
import {compileSemanticNotice} from '../../../cloudflare/semantic-notice-compiler-v3.mjs'
import {parseRecognitionResult} from '../../recognition/schema'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,undoDirectBatch,undoDirectBatchPreservingEdits} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'
import {eventActionGroups} from '../../lib/homeFlow'
import {directReplacementDiff} from './directReplacementSafety'
import {setEventActionLink} from './eventActionLink'
import {readCommandReceipt} from './commandReadback'

const now='2026-11-07T10:00:00+08:00',version='recognition-semantic-notice-3.11.0'
async function repository(){
 const workspace=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store);await repo.save(workspace)
 return {repo,store,capture:new CapturePersistenceService(repo)}
}

describe('source-backed goal groups in canonical storage',()=>{
 it('preserves an event with separate actions, independent deadlines and a second reversible batch',async()=>{
  const source='求职分享会于2026年11月18日14:30在明德楼309举行。参加分享会请先填写报名表，再于11月17日17:00前提交个人简历。'
  const relation='参加分享会请先填写报名表，再于11月17日17:00前提交个人简历'
  const facts={topic:'求职分享会',kind:'mixed',items:[
   {key:'e',kind:'event',title:'求职分享会',location:'明德楼309',evidence:['求职分享会于2026年11月18日14:30在明德楼309举行'],times:[{role:'start',raw:'2026年11月18日14:30'}]},
   {key:'r',kind:'task',title:'填写报名表',action:'填写',object:'报名表',evidence:['填写报名表'],eventRelation:{eventKey:'e',eventAnchor:'分享会',evidence:relation}},
   {key:'cv',kind:'task',title:'提交个人简历',action:'提交',object:'个人简历',evidence:['11月17日17:00前提交个人简历'],times:[{role:'deadline',raw:'11月17日17:00前'}],eventRelation:{eventKey:'e',eventAnchor:'分享会',evidence:relation}},
  ],materials:[]}
  const result=parseRecognitionResult(compileSemanticNotice(facts,{source,referenceTime:now,timezone:'Asia/Shanghai',promptVersion:version}).result)
  const {repo,store,capture}=await repository()
  async function add(operationId:string){const h=await capture.beginCapture({operationId,sourceType:'text',title:'匿名通知',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:version,pipelineVersion:'test',now});await capture.recognize(h,async()=>result);return commitDirectDraft(repo,h.draftId,now)}
  await add('first');const first=(await new CanonicalWorkspaceRepository(store).load())!
  expect(first.tasks).toHaveLength(2);expect(first.events).toHaveLength(1)
  expect(first.events[0].legacyData?.sourceTaskRelations).toMatchObject({version:'source-event-task-relations-2',taskTempIds:result.standaloneTasks.map(task=>task.tempId)})
  const view=workspaceV8ToLegacyView(first)
  expect(eventActionGroups(view.tasks,view.events,first)[view.events[0].id].map(task=>task.id)).toEqual(view.tasks.map(task=>task.id))
  const mismatched=structuredClone(first);mismatched.tasks[0].legacyData!.sourceId='another-source'
  expect(eventActionGroups(view.tasks,view.events,mismatched)[view.events[0].id]).toHaveLength(1)
  expect(view.tasks.find(task=>task.title.includes('简历'))?.deadline).toBe('2026-11-17T17:00')
  expect(view.tasks.find(task=>task.title.includes('报名'))?.deadline).toBe('')
  const restored=importWorkspaceV8(exportWorkspaceV8(first)),restoredView=workspaceV8ToLegacyView(restored)
  expect(restoredView.events[0].location).toBe('明德楼309')
  expect(eventActionGroups(restoredView.tasks,restoredView.events,restored)[restoredView.events[0].id]).toHaveLength(2)
  const withoutLink=structuredClone(first);delete withoutLink.events[0].legacyData!.sourceTaskRelations
  const ids=new Set([...first.tasks.map(task=>task.id),...first.events.map(event=>event.id)])
  expect(directReplacementDiff(first,withoutLink,ids,ids).issues).toContainEqual(expect.objectContaining({field:'relationship'}))
  const second=await add('second');expect((await repo.load())!.events).toHaveLength(2)
  await undoDirectBatch(repo,second.batch!.id)
  expect((await new CanonicalWorkspaceRepository(store).load())!.events).toEqual(first.events)
  expect((await repo.load())!.tasks).toEqual(first.tasks)
 })

 it('round-trips a goal-only group while preserving conditional tasks separately',async()=>{
  const source='思想汇报提交：2023级同学提交第一篇汇报；2024级同学提交第二篇汇报。'
  const facts={topic:'思想汇报',kind:'action',items:[
   {key:'one',kind:'task',title:'提交第一篇汇报',action:'提交',object:'第一篇汇报',condition:'2023级同学',evidence:['2023级同学提交第一篇汇报']},
   {key:'two',kind:'task',title:'提交第二篇汇报',action:'提交',object:'第二篇汇报',condition:'2024级同学',evidence:['2024级同学提交第二篇汇报']},
  ],materials:[],goals:[{key:'reports',title:'提交思想汇报',anchor:'汇报',evidence:'思想汇报提交',taskKeys:['one','two']}]}
  const result=parseRecognitionResult(compileSemanticNotice(facts,{source,referenceTime:now,timezone:'Asia/Shanghai',promptVersion:version}).result)
  const {repo,store,capture}=await repository(),h=await capture.beginCapture({operationId:'goal',sourceType:'text',title:'匿名通知',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:version,pipelineVersion:'test',now})
  await capture.recognize(h,async()=>result);await commitDirectDraft(repo,h.draftId,now)
  const saved=(await new CanonicalWorkspaceRepository(store).load())!,view=workspaceV8ToLegacyView(saved)
  expect(view.tasks).toHaveLength(2)
  expect(view.tasks[0].sourceGoal?.title).toBe('提交思想汇报')
  expect(view.tasks[1].sourceGoal?.id).toBe(view.tasks[0].sourceGoal?.id)
  expect(view.tasks[0].description).toContain('2023级');expect(view.tasks[1].description).toContain('2024级')
  const restored=workspaceV8ToLegacyView(importWorkspaceV8(exportWorkspaceV8(saved)))
  expect(restored.tasks.map(task=>task.sourceGoal)).toEqual(view.tasks.map(task=>task.sourceGoal))
 })
 it('lets a user link and unlink existing same-source records without changing facts or deleting edits',async()=>{
  const source='11月18日14:30举办分享会。请报名并提交简历。'
  const facts={topic:'分享会',kind:'mixed',items:[{key:'e',kind:'event',title:'分享会',evidence:['11月18日14:30举办分享会'],times:[{role:'start',raw:'11月18日14:30'}]},{key:'t',kind:'task',title:'提交简历',action:'提交',object:'简历',evidence:['提交简历']}],materials:[]}
  const result=parseRecognitionResult(compileSemanticNotice(facts,{source,referenceTime:now,timezone:'Asia/Shanghai',promptVersion:version}).result)
  const {repo,store,capture}=await repository(),h=await capture.beginCapture({operationId:'manual',sourceType:'text',title:'匿名通知',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:version,pipelineVersion:'test',now})
  await capture.recognize(h,async()=>result);const receipt=await commitDirectDraft(repo,h.draftId,now)
  const original=(await repo.load())!,eventId=original.events[0].id,taskId=original.tasks[0].id
  const command={operationId:'link',eventId,taskIds:[taskId],linked:true,expectedRevision:null,changedAt:'2026-11-07T11:00:00+08:00'}
  expect((await setEventActionLink(repo,command)).changed).toBe(true)
  expect((await setEventActionLink(repo,command)).changed).toBe(false)
  const readback=await readCommandReceipt(new CanonicalWorkspaceRepository(store),{kind:'event',operationId:'link',entityId:eventId,changed:true}),view=workspaceV8ToLegacyView(readback)
  expect(eventActionGroups(view.tasks,view.events,readback)[eventId]).toHaveLength(1)
  const unknown=structuredClone(readback)
  unknown.events[0].legacyData!.manualActionLinksV1={version:'future-format',taskIds:[taskId],excludedTaskIds:[],revision:'unknown'}
  expect(eventActionGroups(view.tasks,view.events,unknown)[eventId]).toBeUndefined()
  expect(readback.tasks).toEqual(original.tasks);expect(readback.timePoints).toEqual(original.timePoints)
  await expect(setEventActionLink(repo,{...command,operationId:'stale',linked:false})).rejects.toThrow('关联已在其他页面更改')
  await expect(undoDirectBatchPreservingEdits(repo,receipt.batch!.id,'2026-11-07T12:00:00+08:00')).rejects.toThrow()
  const restored=importWorkspaceV8(exportWorkspaceV8(readback)),restoredView=workspaceV8ToLegacyView(restored)
  expect(eventActionGroups(restoredView.tasks,restoredView.events,restored)[eventId]).toHaveLength(1)
  await setEventActionLink(repo,{...command,operationId:'unlink',linked:false,expectedRevision:'link',changedAt:'2026-11-07T12:30:00+08:00'})
  const after=(await repo.load())!,afterView=workspaceV8ToLegacyView(after)
  expect(eventActionGroups(afterView.tasks,afterView.events,after)[eventId]).toBeUndefined()
  expect(after.tasks).toEqual(original.tasks);expect(after.timePoints).toEqual(original.timePoints)
 })
})
