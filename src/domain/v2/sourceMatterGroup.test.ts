import {describe,expect,it} from 'vitest'
import {compileSemanticNotice} from '../../../cloudflare/semantic-notice-compiler-v3.mjs'
import {parseRecognitionResult} from '../../recognition/schema'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,editDirectItem,undoDirectBatchPreservingEdits} from './directIntake'
import {sourceGoalForTask,workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'
import {matterTaskRevision,setSourceMatterGroup} from './sourceMatterGroup'

const now='2026-11-11T09:00:00+08:00',source='请于11月13日17:00前填写登记表，并于11月14日12:00前发送证明。'
const facts={topic:'登记',kind:'action',items:[
 {key:'a',kind:'task',title:'填写登记表',action:'填写',object:'登记表',evidence:['请于11月13日17:00前填写登记表'],times:[{role:'deadline',raw:'11月13日17:00前'}]},
 {key:'b',kind:'task',title:'发送证明',action:'发送',object:'证明',evidence:['并于11月14日12:00前发送证明'],times:[{role:'deadline',raw:'11月14日12:00前'}]},
],materials:[]}
async function setup(){
 const workspace=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(workspace)
 const result=parseRecognitionResult(compileSemanticNotice(facts,{source,referenceTime:now,timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.11.0'}).result)
 const add=async(operationId:string)=>{const h=await capture.beginCapture({operationId,sourceType:'text',title:'匿名通知',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:result.promptVersion,pipelineVersion:'test',now});await capture.recognize(h,async()=>structuredClone(result));return {h,receipt:await commitDirectDraft(repo,h.draftId,now)}}
 return {repo,store,add}
}
describe('user-organized existing captures',()=>{
 it('changes only the relation, is idempotent, round-trips and can be undone',async()=>{
  const {repo,store,add}=await setup(),{h,receipt}=await add('manual-original'),before=(await repo.load())!
  const taskIds=before.tasks.map(task=>task.id),expectedTasks=Object.fromEntries(before.tasks.map(task=>[task.id,matterTaskRevision(task)]))
  const cmd={operationId:'manual-group',draftId:h.draftId,sourceVersionId:h.sourceVersionId,taskIds,title:'办理登记',expectedRevision:null,expectedTasks,changedAt:'2026-11-11T10:00:00+08:00'}
  expect((await setSourceMatterGroup(repo,cmd)).changed).toBe(true)
  expect((await setSourceMatterGroup(repo,cmd)).changed).toBe(false)
  const saved=(await new CanonicalWorkspaceRepository(store).load())!
  expect(saved.tasks).toEqual(before.tasks);expect(saved.timePoints).toEqual(before.timePoints)
  const projected=workspaceV8ToLegacyView(importWorkspaceV8(exportWorkspaceV8(saved)))
  expect(projected.tasks.every(task=>task.sourceGoal?.userOrganized&&task.sourceGoal.title==='办理登记')).toBe(true)
  await expect(undoDirectBatchPreservingEdits(repo,receipt.batch!.id,'2026-11-11T11:00:00+08:00')).rejects.toThrow(/已修改/u)
  const groupId=projected.tasks[0].sourceGoal!.id
  await setSourceMatterGroup(repo,{...cmd,operationId:'manual-ungroup',expectedRevision:'manual-group',removeGroupId:groupId,changedAt:'2026-11-11T12:00:00+08:00'})
  const after=(await repo.load())!
  expect(after.tasks).toEqual(before.tasks);expect(after.timePoints).toEqual(before.timePoints)
  expect(after.tasks.every(task=>!sourceGoalForTask(after,task))).toBe(true)
 })
 it('rejects stale edits and tasks from another batch without partial changes',async()=>{
  const {repo,add}=await setup(),first=await add('manual-stale'),before=(await repo.load())!
  const taskIds=before.tasks.map(task=>task.id),expectedTasks=Object.fromEntries(before.tasks.map(task=>[task.id,matterTaskRevision(task)]))
  const cmd={operationId:'stale-group',draftId:first.h.draftId,sourceVersionId:first.h.sourceVersionId,taskIds,title:'办理登记',expectedRevision:null,expectedTasks,changedAt:now}
  await editDirectItem(repo,taskIds[0],{title:'用户已编辑',date:'2026-11-13T17:00'},now)
  const edited=(await repo.load())!
  await expect(setSourceMatterGroup(repo,cmd)).rejects.toThrow(/已在其他页面修改/u)
  expect(await repo.load()).toEqual(edited)
  const second=await add('manual-second'),current=(await repo.load())!,other=current.tasks.find(task=>task.id.includes(second.h.draftId))!
  const refreshed=Object.fromEntries(current.tasks.map(task=>[task.id,matterTaskRevision(task)]))
  await expect(setSourceMatterGroup(repo,{...cmd,operationId:'cross-batch',taskIds:[taskIds[0],other.id],expectedTasks:refreshed})).rejects.toThrow(/同一批/u)
  expect(await repo.load()).toEqual(current)
 })
 it('leaves no relation or history when the transaction fails',async()=>{
  const {repo,add}=await setup(),{h}=await add('manual-failure'),before=(await repo.load())!
  const cmd={operationId:'failing-group',draftId:h.draftId,sourceVersionId:h.sourceVersionId,taskIds:before.tasks.map(task=>task.id),title:'办理登记',expectedRevision:null,expectedTasks:Object.fromEntries(before.tasks.map(task=>[task.id,matterTaskRevision(task)])),changedAt:now}
  const failing={transaction:async()=>{throw Error('INJECTED_FAILURE')}}
  await expect(setSourceMatterGroup(failing,cmd)).rejects.toThrow('INJECTED_FAILURE')
  expect(await repo.load()).toEqual(before)
  expect((await setSourceMatterGroup(repo,cmd)).changed).toBe(true)
 })
})
