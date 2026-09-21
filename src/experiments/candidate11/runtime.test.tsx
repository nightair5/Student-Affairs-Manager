import {it,expect,describe} from 'vitest'
import {renderToString} from 'react-dom/server'
import {readFileSync} from 'node:fs'
import App from '../../App'
import {MemoryWorkspaceRecordStore} from '../../domain/v2/repository'
import {seenWire,cases} from '../realInput01/seenInputs'
import {sha256Text} from '../realInput01/inputReceipt'
import {createCandidate11Runtime} from './runtime'
import {C11_DATABASE} from './observation'
import type {C11ReplayRecord} from './replay'
import {stateOfRuntime,effectiveStateFacts,semanticRevision} from '../mainline05/semanticState'
import {reviewSemanticFact,reviewSemanticMaterial} from '../mainline05/semanticConfirmation'

async function fixture(name:typeof cases[number]):Promise<C11ReplayRecord>{
  const r=await seenWire(name,{sourceId:'original-'+name,sourceVersionId:'original-'+name+':1'})
  const {index,referenceTime,timezone}=r.original.context
  return {id:'fixture-'+name,label:'工程夹具 '+name,kind:'ENGINEERING_REPLAY',candidateVersion:null,
    context:{index,referenceTime,timezone},rawHttpText:r.rawHttpText,responseSha:await sha256Text(r.rawHttpText),requestSha:null}
}
async function setup(name:typeof cases[number]='multi'){
  const record=await fixture(name),transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:C11_DATABASE})
  const options={transport,choices:[record],read:async()=>record,origin:'AUTOMATION' as const}
  const app=await createCandidate11Runtime(options),draftId=await app.open(record.id)
  return {app,draftId,record,transport,options}
}
async function reviewAll(f:Awaited<ReturnType<typeof setup>>){
  const facts=effectiveStateFacts(stateOfRuntime(await f.app.runtime.load(),f.draftId)).facts
  for(const material of facts.materials)await reviewSemanticMaterial(f.app.repository,{draftId:f.draftId,materialId:material.tempId,
    revision:semanticRevision(await f.app.runtime.load()),operationId:crypto.randomUUID(),value:{required:material.required,status:'ready'}})
  for(const task of facts.tasks)await reviewSemanticFact(f.app.repository,{draftId:f.draftId,taskId:task.id,
    revision:semanticRevision(await f.app.runtime.load()),operationId:crypto.randomUUID()})
  return facts.tasks.map(t=>t.id)
}
describe('C11 actual App/runtime/repository engineering closure',()=>{
  it.each(cases)('preserves %s as durable unconfirmed source and draft, opens idempotently',async name=>{
    const f=await setup(name),w=await f.app.runtime.load()
    expect(w.sources).toHaveLength(1);expect(w.recognitionRuns).toHaveLength(1);expect(w.extractionDrafts).toHaveLength(1);expect(w.tasks).toHaveLength(0)
    expect(await f.app.open(f.record.id)).toBe(f.draftId);expect((await f.app.runtime.load()).sources).toHaveLength(1)
    expect(renderToString(<App runtime={f.app.runtime}/>)).toContain('app-shell')
    expect(await f.app.independentReadback()).toEqual(w)
    expect(f.app.runtime.view(w).drafts[0].modelName).toBe('人工工程夹具（非模型预测）')
    expect((await f.app.observed.events()).every(e=>e.origin==='AUTOMATION')).toBe(true)
  })
  it('edits, partially confirms, aborts a save, then explicitly retries; refresh and repeat cannot duplicate',async()=>{
    const f=await setup(),state=stateOfRuntime(await f.app.runtime.load(),f.draftId),raw=state.rawOutputText
    const taskIds=state.first.original.tasks.map(t=>t.id)
    await f.app.runtime.edit({draftId:f.draftId,taskTempId:taskIds[0],revision:semanticRevision(await f.app.runtime.load()),operationId:crypto.randomUUID(),field:'title',value:'提交活动报名表（已核对）'})
    await reviewAll(f)
    const first=await f.app.runtime.confirm({draftId:f.draftId,taskTempIds:[taskIds[0]],revision:semanticRevision(await f.app.runtime.load())})
    expect(first.tasks).toHaveLength(1);expect(first.extractionDrafts[0].status).toBe('partially_confirmed')
    f.app.observed.failNext()
    await expect(f.app.runtime.confirm({draftId:f.draftId,taskTempIds:[taskIds[1]],revision:semanticRevision(first)})).rejects.toThrow('INJECTED_ATOMIC_FAILURE')
    expect(await f.app.runtime.load()).toEqual(first)
    const intent={draftId:f.draftId,taskTempIds:[taskIds[1]],revision:semanticRevision(first)}
    const saved=await f.app.runtime.confirm(intent);expect(saved.tasks).toHaveLength(2)
    expect((await f.app.runtime.confirm(intent)).tasks).toHaveLength(2)
    const reopened=await createCandidate11Runtime(f.options)
    expect(await reopened.runtime.load()).toEqual(saved);expect(stateOfRuntime(saved,f.draftId).rawOutputText).toBe(raw)
    expect(await reopened.open(f.record.id)).toBe(f.draftId);expect(await reopened.runtime.load()).toEqual(saved)
    const events=await f.app.observed.events()
    for(const kind of ['source_ready','suggestion_ready','edit_saved','confirmation_requested','commit_succeeded','commit_failed','readback_verified'])expect(events.some(e=>e.kind===kind)).toBe(true)
    expect(events.filter(e=>e.kind==='commit_succeeded')).toHaveLength(2)
  })
  it('allows partial acceptance and explicit rejection without losing confirmed tasks',async()=>{
    const f=await setup(),ids=await reviewAll(f)
    await f.app.runtime.confirm({draftId:f.draftId,taskTempIds:[ids[0]],revision:semanticRevision(await f.app.runtime.load())})
    const w=await f.app.runtime.semantic!.dispose({draftId:f.draftId,taskTempIds:[ids[1]],kind:'reject',operationId:crypto.randomUUID(),revision:semanticRevision(await f.app.runtime.load())})
    expect(w.tasks).toHaveLength(1);expect(w.extractionDrafts[0].rejectedEntityTempIds).toContain(ids[1]);expect((await f.app.observed.events()).some(e=>e.kind==='rejected')).toBe(true)
  })
  it.each(['condition-unknown','condition-false','revision'] as const)('%s cannot force an inactive/unknown requirement into formal tasks',async name=>{
    const f=await setup(name),w=await f.app.runtime.load(),state=stateOfRuntime(w,f.draftId)
    const blocked=state.first.items.find(i=>i.requiresAction!=='true')!
    await expect(f.app.runtime.confirm({draftId:f.draftId,taskTempIds:[blocked.tempId],revision:semanticRevision(w)})).rejects.toThrow()
    expect((await f.app.runtime.load()).tasks).toHaveLength(0)
  })
  it('historical candidate03 original survives a reversible scope-only binding into the new library',async()=>{
    const path='docs/recognition-optimization/mainline-real-input-01/runs/opensource-methods-20260920a/',binding=JSON.parse(readFileSync(path+'BINDING_FINAL.json','utf8'))
    const raw=JSON.parse(readFileSync(path+'K04-A_RAW.jsonl','utf8')),context=binding.items.find((i:{id:string})=>i.id==='K04').context
    const record:C11ReplayRecord={id:'history-K04-A',label:'历史03 OS04',kind:'HISTORICAL_MODEL',candidateVersion:'real-input-source-semantics-3',context,
      rawHttpText:raw.rawHttpText,responseSha:raw.responseSha,requestSha:raw.requestSha}
    const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:C11_DATABASE})
    const app=await createCandidate11Runtime({transport,choices:[record],read:async()=>record}),draftId=await app.open(record.id)
    const original=await transport.read('c11-original-'+draftId) as {originalRawHttpText:string;originalResponseSha:string}
    expect(original.originalRawHttpText).toBe(record.rawHttpText);expect(original.originalResponseSha).toBe(raw.responseSha)
    expect((await app.runtime.load()).recognitionRuns[0].promptVersion).toBe('real-input-source-semantics-3')
    expect((await app.observed.events()).every(e=>e.origin==='UNKNOWN')).toBe(true)
  })
  it('database failure or a foreign database never falls back to a user library',async()=>{
    const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:'production'})
    await expect(createCandidate11Runtime({transport,choices:[],read:async()=>{throw Error('unused')}})).rejects.toThrow('DATABASE_BINDING')
    transport.name=C11_DATABASE;transport.read=async()=>{throw Error('OPEN_FAILED')}
    await expect(createCandidate11Runtime({transport,choices:[],read:async()=>{throw Error('unused')}})).rejects.toThrow('OPEN_FAILED')
  })
})
