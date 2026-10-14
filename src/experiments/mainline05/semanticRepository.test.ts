import { describe, expect, it } from 'vitest'
import { MemoryWorkspaceRecordStore, type WorkspaceRecordMutation } from '../../domain/v2/repository'
import { emptyWorkspace } from '../mainline01/fixtures'
import { SemanticRepository } from './semanticRepository'
import { captureSemantic } from './semanticCapture'
import { engineeringReply, notices } from './engineeringReplay'
import { editSemantic, confirmSemantic } from './semanticConfirmation'
import { semanticRevision } from './semanticState'

class FaultStore extends MemoryWorkspaceRecordStore {
  readonly name='rco-mainline-01-02-i1-mainline05-repository-'+crypto.randomUUID()
  fail=false
  override async transaction(key:string, mutate:WorkspaceRecordMutation) {
    return super.transaction(key,raw=>{const next=mutate(raw);if(this.fail){this.fail=false;throw Error('INJECTED_ATOMIC_FAILURE')}return next})
  }
}
async function setup(){const store=new FaultStore(),initial=emptyWorkspace();initial.workspace.id=store.name
  const repo=await SemanticRepository.open(store.name,store,initial)
  const draftId=await captureSemantic(repo,{sourceType:'text',content:notices['no-date']},(_,h)=>engineeringReply('no-date',h))
  return{store,repo,draftId}}
describe('MAINLINE05 actual repository transactions',()=>{
  it('missing/wrong/invalid database fails without initialization or fallback',async()=>{
    const store=new FaultStore()
    await expect(SemanticRepository.open(store.name,store)).rejects.toThrow('MISSING')
    await expect(SemanticRepository.open('student-affairs',store)).rejects.toThrow('DATABASE_NAME')
    await store.write('current',{schemaVersion:8})
    await expect(SemanticRepository.open(store.name,store)).rejects.toThrow()
  })
  it('edit abort leaves no history; confirmation abort preserves previously saved edit; retry succeeds once',async()=>{
    const {store,repo,draftId}=await setup(),before=await repo.load()
    const edit={draftId,revision:semanticRevision(before),taskTempId:'save',field:'title' as const,value:'逐字修改后的保存任务',operationId:'save-edit'}
    store.fail=true
    await expect(editSemantic(repo,edit)).rejects.toThrow('INJECTED_ATOMIC_FAILURE')
    expect(await repo.load()).toEqual(before)
    const saved=await editSemantic(repo,edit)
    expect(saved.historyRecords).toHaveLength(1);expect(saved.tasks).toEqual([])
    const intent={draftId,revision:semanticRevision(saved),taskTempIds:['save']}
    store.fail=true
    await expect(confirmSemantic(repo,intent)).rejects.toThrow('INJECTED_ATOMIC_FAILURE')
    expect(await repo.load()).toEqual(saved)
    const confirmed=await confirmSemantic(repo,intent)
    expect(confirmed.tasks[0].title).toBe(edit.value)
    expect(await confirmSemantic(repo,intent)).toEqual(confirmed)
    const reopened=await SemanticRepository.open(store.name,store)
    expect(await reopened.load()).toEqual(confirmed);expect(JSON.parse(await reopened.exportJson())).toEqual(JSON.parse(JSON.stringify(confirmed)))
  })
  it('cross-client stale edit rejects and confirmed task properties cannot be overwritten',async()=>{
    const {store,repo,draftId}=await setup(),before=await repo.load(),other=await SemanticRepository.open(store.name,store)
    const edit={draftId,revision:semanticRevision(before),taskTempId:'save',field:'title' as const,value:'新名称',operationId:'first-edit'}
    const saved=await editSemantic(repo,edit)
    await expect(editSemantic(other,{...edit,operationId:'stale-edit',value:'过期名称'})).rejects.toThrow('STALE')
    expect(await other.load()).toEqual(saved)
    const confirmed=await confirmSemantic(repo,{draftId,revision:semanticRevision(saved),taskTempIds:['save']})
    await expect(repo.transaction(w=>({...w,tasks:w.tasks.map(t=>({...t,title:'overwritten'}))}))).rejects.toThrow('CANONICAL_FIDELITY')
    expect(await repo.load()).toEqual(confirmed)
  })
})
