import { describe, expect, it } from 'vitest'
import { MemoryWorkspaceRecordStore } from '../../domain/v2/repository'
import { emptyWorkspace } from '../mainline01/fixtures'
import { SemanticRepository } from './semanticRepository'
import { captureSemantic, type SemanticRecognizer } from './semanticCapture'
import { engineeringReply, notices } from './engineeringReplay'
import { stateOf, validateSemanticWorkspace, json } from './semanticState'

async function setup() {
  const name = 'rco-mainline-01-02-i1-mainline05-state-' + crypto.randomUUID()
  const store = Object.assign(new MemoryWorkspaceRecordStore(), { name })
  const initial = emptyWorkspace(); initial.workspace.id = name
  const repo = await SemanticRepository.open(name, store, initial)
  const draftId = await captureSemantic(repo, { sourceType:'text',content:notices.multi }, (_,h)=>engineeringReply('multi',h))
  return { repo, store, draftId }
}
describe('MAINLINE05 joint state integrity',()=>{
  it.each(['version','raw','first','binding','source','scope','history'] as const)('rejects %s tampering on every read',async fault=>{
    const {repo,store,draftId}=await setup(), w=await repo.load(), state=stateOf(w,draftId)
    if(fault==='version') w.extractionDrafts[0].legacyData!.mainline05={...json(state) as object,version:'unknown'}
    if(fault==='raw') state.rawOutputText='{}'
    if(fault==='first') state.first.items[0].defaultSelected=false
    if(fault==='binding') state.bindings['task:submit']='nonexistent'
    if(fault==='source') w.sourceVersions[0].rawText+=' changed'
    if(fault==='scope') state.context.index.scopes[0].text+=' changed'
    if(fault==='history') state.operations.push({id:'bad',kind:'edit',at:new Date().toISOString(),taskIds:['submit'],field:'title',value:'x',before:'not prior'})
    await store.write('current',w)
    await expect(repo.load()).rejects.toThrow()
    await expect(repo.exportJson()).rejects.toThrow()
  })
  it('allows JSON object ordering and whitespace without rewriting original raw text; arrays stay ordered',async()=>{
    const {repo,draftId}=await setup(), w=await repo.load(), state=stateOf(w,draftId)
    state.rawOutputText=JSON.stringify(Object.fromEntries(Object.entries(state.rawResponse).reverse()),null,2)
    expect(await validateSemanticWorkspace(w)).toBe(w)
    state.rawResponse.tasks.reverse()
    await expect(validateSemanticWorkspace(w)).rejects.toThrow('RAW_RESPONSE_MISMATCH')
  })
  it('rejects a pre-existing receipt object before any source transaction',async()=>{
    const {repo}=await setup(), before=await repo.load()
    const bad=await engineeringReply('no-date',{sourceId:'wrong',sourceVersionId:'wrong'})
    bad.rawOutputText='{}'
    await expect(captureSemantic(repo,{sourceType:'text',content:notices['no-date']},bad as unknown as SemanticRecognizer)).rejects.toThrow('RECEIPT_PRECHECK')
    expect(await repo.load()).toEqual(before)
  })
  it('failed semantic references retain the returned original receipt without a valid result or tasks',async()=>{
    const {repo,draftId}=await setup()
    await expect(captureSemantic(repo,{sourceType:'text',content:notices.multi},(_,h)=>engineeringReply('multi',h,input=>{
      input.tasks[0].detail.materialTempIds.push('dangling-material')
    }))).rejects.toThrow('INVALID_ENTITY_REFERENCE')
    const w=await repo.load(), draft=w.extractionDrafts.find(d=>d.id!==draftId)!
    expect(draft.status).toBe('failed');expect(draft.result).toBeNull();expect(draft.legacyData?.mainline05).toBeUndefined()
    expect(JSON.stringify(draft.legacyData?.mainline05Failure)).toContain('dangling-material')
    expect(w.tasks).toEqual([])
  })
  it('rejects changing source identity and first response even if all dependent hashes were recomputed',async()=>{
    const {repo}=await setup(), before=await repo.load()
    await expect(repo.transaction(w=>({...w,sources:w.sources.map(s=>({...s,title:'different original'}))}))).rejects.toThrow('SOURCE_IDENTITY_CHANGED')
    await expect(repo.transaction(w=>{stateOf(w,w.extractionDrafts[0].id).rawOutputText+=' ';return w})).rejects.toThrow('IMMUTABLE_RESPONSE_CHANGED')
    expect(await repo.load()).toEqual(before)
  })
})
