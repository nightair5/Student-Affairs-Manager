import {describe,expect,it} from 'vitest'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {commitTaskCommand,ensureTaskEditsSettled} from './taskCommand'
import {readCommandReceipt} from './commandReadback'
import {workspaceV8ToLegacyView} from './legacyView'
import {IndexedDbWorkspaceRepository} from '../../lib/repository'

async function setup(){const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store);await repo.save(createGoldenWorkspaceV8());return {repo,reader:new CanonicalWorkspaceRepository(store)}}
const at='2026-11-03T02:00:00Z'
describe('durable user task commands',()=>{
 it('waits for a successful edit to clear its draft and blocks completion after a failed edit',async()=>{
  let dirty=true,release!:()=>void
  const operation=new Promise<void>(resolve=>{release=resolve})
  const queue=operation.catch(()=>undefined)
  void operation.finally(()=>undefined).then(()=>{dirty=false})
  const ready=ensureTaskEditsSettled(queue,()=>dirty);release();await expect(ready).resolves.toBeUndefined()
  dirty=true
  await expect(ensureTaskEditsSettled(Promise.resolve(),()=>dirty)).rejects.toThrow(/未保存的修改/u)
 })
 it('returns only after an independent reader can see the change and idempotent history',async()=>{
  const {repo,reader}=await setup(),before=(await repo.load())!,task=before.tasks[0]
  const command={operationId:'complete-one',taskId:task.id,expected:{status:task.status},changes:{status:'completed' as const},changedAt:at}
  await commitTaskCommand(repo,command);await commitTaskCommand(repo,command)
  const after=(await reader.load())!
  expect(after.tasks.find(item=>item.id===task.id)?.status).toBe('completed')
  expect(after.historyRecords.filter(record=>record.id.startsWith('task-command:complete-one:'))).toHaveLength(1)
  await expect(commitTaskCommand(repo,{...command,changes:{status:'todo'}})).rejects.toThrow('TASK_COMMAND_ID_REUSED')
 })
 it('allows different fields to be changed concurrently without losing either',async()=>{
  const {repo}=await setup(),before=(await repo.load())!,task=before.tasks[0]
  await Promise.all([
   commitTaskCommand(repo,{operationId:'title',taskId:task.id,expected:{title:task.title},changes:{title:'新的标题'},changedAt:at}),
   commitTaskCommand(repo,{operationId:'note',taskId:task.id,expected:{description:task.description},changes:{description:'新的备注'},changedAt:at}),
  ])
  const after=(await repo.load())!.tasks.find(item=>item.id===task.id)!
  expect(after.title).toBe('新的标题');expect(after.description).toBe('新的备注')
 })
 it('rejects a stale same-field edit instead of overwriting another user edit',async()=>{
  const {repo}=await setup(),before=(await repo.load())!,task=before.tasks[0]
  await commitTaskCommand(repo,{operationId:'first',taskId:task.id,expected:{title:task.title},changes:{title:'第一份修改'},changedAt:at})
  await expect(commitTaskCommand(repo,{operationId:'second',taskId:task.id,expected:{title:task.title},changes:{title:'另一份修改'},changedAt:at})).rejects.toThrow('TASK_COMMAND_FIELD_CONFLICT')
  expect((await repo.load())!.tasks.find(item=>item.id===task.id)?.title).toBe('第一份修改')
 })
 it('does not retain half a change when the transaction fails',async()=>{
  const {repo}=await setup(),before=(await repo.load())!,task=before.tasks[0]
  const broken={transaction:async()=>{throw Error('INJECTED_WRITE_FAILURE')}}
  await expect(commitTaskCommand(broken,{operationId:'fail',taskId:task.id,expected:{status:task.status},changes:{status:'completed'},changedAt:at})).rejects.toThrow('INJECTED_WRITE_FAILURE')
  expect(await repo.load()).toEqual(before)
 })
 it('retries only independent readback after a successful write',async()=>{
  const {repo,reader}=await setup(),before=(await repo.load())!,task=before.tasks[0]
  const operationId='readback-only',receipt=await commitTaskCommand(repo,{operationId,taskId:task.id,expected:{title:task.title},changes:{title:'读回测试'},changedAt:at})
  let calls=0
  const temporaryFailure={load:async()=>{calls++;if(calls===1)throw Error('INJECTED_READ_FAILURE');return reader.load()}}
  const identity={kind:'task' as const,operationId,entityId:task.id,changed:receipt.changed}
  await expect(readCommandReceipt(temporaryFailure,identity)).rejects.toThrow('INJECTED_READ_FAILURE')
  const readback=await readCommandReceipt(temporaryFailure,identity)
  expect(calls).toBe(2)
  expect(readback.tasks.find(item=>item.id===task.id)?.title).toBe('读回测试')
  expect(readback.historyRecords.filter(item=>item.id.startsWith('task-command:readback-only:')&&item.fieldName==='任务名称')).toHaveLength(1)
 })
 it('keeps the canonical edit when the compatibility view subsequently saves',async()=>{
  const {repo}=await setup(),viewRepo=new IndexedDbWorkspaceRepository(repo),screen=(await viewRepo.load())!,task=screen.tasks[0]
  const canonical=(await repo.load())!.tasks.find(item=>item.id===task.id)!
  await commitTaskCommand(repo,{operationId:'view-rebase',taskId:task.id,expected:{title:canonical.title},changes:{title:'新的事项名称'},changedAt:at})
  const updated=workspaceV8ToLegacyView((await repo.load())!).tasks.find(item=>item.id===task.id)!
  screen.tasks=screen.tasks.map(item=>item.id===task.id?{...item,title:updated.title,nextAction:updated.nextAction,history:updated.history,updatedAt:updated.updatedAt}:item)
  await viewRepo.save(screen)
  expect((await repo.load())!.tasks.find(item=>item.id===task.id)?.title).toBe('新的事项名称')
 })
})
