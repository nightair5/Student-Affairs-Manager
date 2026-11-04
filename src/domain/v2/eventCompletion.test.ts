import {describe,expect,it} from 'vitest'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {commitEventCompletion} from './eventCompletion'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'
import {readCommandReceipt} from './commandReadback'
import {CapturePersistenceService} from './capture'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {commitDirectDraft,undoDirectBatchPreservingEdits} from './directIntake'

const now='2026-11-04T08:00:00.000Z'
async function setup(){
 const workspace=createGoldenWorkspaceV8(),store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store)
 await repo.save(workspace)
 return {workspace,store,repo,id:workspace.events[0].id}
}
describe('personal event completion',()=>{
 it('persists independently, retains source facts and round-trips through export',async()=>{
  const {workspace,store,repo,id}=await setup(),command={operationId:'complete',eventId:id,expected:false,completed:true,changedAt:now}
  const receipt=await commitEventCompletion(repo,command)
  const readback=await readCommandReceipt(new CanonicalWorkspaceRepository(store),{kind:'event',operationId:'complete',entityId:id,changed:receipt.changed})
  expect(workspaceV8ToLegacyView(readback).events.find(event=>event.id===id)?.personalCompleted).toBe(true)
  expect(readback.timePoints).toEqual(workspace.timePoints)
  expect(readback.tasks).toEqual(workspace.tasks)
  expect(readback.sourceVersions).toEqual(workspace.sourceVersions)
  expect(importWorkspaceV8(exportWorkspaceV8(readback)).events.find(event=>event.id===id)?.legacyData?.personalCompletionV1).toBe(true)
  await commitEventCompletion(repo,command)
  expect(await repo.load()).toEqual(readback)
  await commitEventCompletion(repo,{operationId:'restore',eventId:id,expected:true,expectedRevision:'complete',completed:false,changedAt:now})
  expect(workspaceV8ToLegacyView((await repo.load())!).events.find(event=>event.id===id)?.personalCompleted).toBeUndefined()
  await expect(commitEventCompletion(repo,{operationId:'stale',eventId:id,expected:false,expectedRevision:null,completed:true,changedAt:now})).rejects.toThrow('EVENT_COMMAND_FIELD_CONFLICT')
 })
 it('does not change the record when the repository fails',async()=>{
  const {repo,id}=await setup(),before=await repo.load()
  await expect(commitEventCompletion({transaction:async()=>{throw Error('storage failure')}},{operationId:'fail',eventId:id,expected:false,completed:true,changedAt:now})).rejects.toThrow('storage failure')
  expect(await repo.load()).toEqual(before)
 })
 it('protects a user-completed event from a later whole-batch undo',async()=>{
  const w=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
  const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.save(w)
  const source='11月2日14:00至15:00在A101召开课程说明会，请准时参加。',capture=new CapturePersistenceService(repo)
  const handle=await capture.beginCapture({operationId:'event-source',sourceType:'text',title:'通知',rawText:source,provider:'local-rules',modelName:'local',promptVersion:'test',pipelineVersion:'test',now})
  await capture.recognize(handle,async()=>buildLocalRecognition({content:source,sourceType:'text',sourceTitle:'通知',referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]}))
  const batch=(await commitDirectDraft(repo,handle.draftId,now)).batch!,event=(await repo.load())!.events[0]
  expect(event).toBeTruthy()
  await commitEventCompletion(repo,{operationId:'user-complete',eventId:event.id,expected:false,completed:true,changedAt:now})
  const before=await repo.load()
  await expect(undoDirectBatchPreservingEdits(repo,batch.id,now)).rejects.toThrow('已修改')
  expect(await repo.load()).toEqual(before)
 })
})
