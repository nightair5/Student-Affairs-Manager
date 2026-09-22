import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {MemoryWorkspaceRecordStore} from '../../domain/v2/repository'
import {createD6Runtime} from './d6Runtime'
import {D6_DATABASE} from './d6Observation'
import type {D6ReplayRecord} from './d6Replay'
import {stateOfRuntime,effectiveStateFacts,semanticRevision} from '../mainline05/semanticState'
import {reviewSemanticFact,reviewSemanticMaterial} from '../mainline05/semanticConfirmation'

const d6='docs/recognition-optimization/candidate13/d6-development-20260922a',d5='docs/recognition-optimization/candidate13/d5-development'
const binding=JSON.parse(readFileSync(d6+'/BINDING.json','utf8')),packets=JSON.parse(readFileSync(d5+'/PREPARED_REQUEST_IDENTITIES.json','utf8')).requests
function record(unitId:string):D6ReplayRecord{
  const target=binding.targets.find((item:{unitId:string})=>item.unitId===unitId),packet=packets.find((item:{unitId:string})=>item.unitId===unitId),raw=JSON.parse(readFileSync(`${d6}/raw/${unitId}.jsonl`,'utf8'))
  return {id:'d6-'+unitId,label:'D6 '+unitId,kind:'RECORDED_MODEL',candidateVersion:target.candidateVersion,context:packet.prepared.context,rawHttpText:raw.rawHttpText,responseSha256:raw.responseSha256,requestSha256:target.requestSha256}
}
async function setup(unitId='D5R1-S02-A'){
  const replay=record(unitId),transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:D6_DATABASE}),options={transport,choices:[replay],read:async()=>replay,origin:'AUTOMATION' as const}
  const app=await createD6Runtime(options),draftId=await app.open(replay.id);return {app,draftId,replay,transport,options}
}
async function reviewAll(f:Awaited<ReturnType<typeof setup>>){const facts=effectiveStateFacts(stateOfRuntime(await f.app.runtime.load(),f.draftId)).facts
  for(const material of facts.materials)await reviewSemanticMaterial(f.app.repository,{draftId:f.draftId,materialId:material.tempId,revision:semanticRevision(await f.app.runtime.load()),operationId:crypto.randomUUID(),value:{required:material.required,status:'ready'}})
  for(const task of facts.tasks)await reviewSemanticFact(f.app.repository,{draftId:f.draftId,taskId:task.id,revision:semanticRevision(await f.app.runtime.load()),operationId:crypto.randomUUID()})
  return facts.tasks.map(task=>task.id)}

describe('D6 recorded-result engineering replay',()=>{
  it('opens a recorded answer with source evidence and preserves the immutable original',async()=>{
    const f=await setup(),workspace=await f.app.runtime.load(),state=stateOfRuntime(workspace,f.draftId)
    expect(workspace.sources).toHaveLength(1);expect(workspace.tasks).toHaveLength(0);expect(state.first.original.tasks.length).toBeGreaterThanOrEqual(2)
    for(const task of state.first.original.tasks)expect(task.propositionScopeIds.length).toBeGreaterThan(0)
    const original=await f.transport.read('d6-original-'+f.draftId) as {originalRawHttpText:string;originalResponseSha256:string}
    expect(original.originalRawHttpText).toBe(f.replay.rawHttpText);expect(original.originalResponseSha256).toBe(f.replay.responseSha256)
  })
  it('edits, partially confirms, recovers from an injected save failure, reads back and survives refresh',async()=>{
    const f=await setup(),state=stateOfRuntime(await f.app.runtime.load(),f.draftId),ids=state.first.original.tasks.map(task=>task.id),raw=state.rawOutputText
    await f.app.runtime.edit({draftId:f.draftId,taskTempId:ids[0],revision:semanticRevision(await f.app.runtime.load()),operationId:crypto.randomUUID(),field:'title',value:'确认竞赛队伍信息（已核对）'})
    await reviewAll(f);const first=await f.app.runtime.confirm({draftId:f.draftId,taskTempIds:[ids[0]],revision:semanticRevision(await f.app.runtime.load())})
    expect(first.tasks).toHaveLength(1);expect(first.extractionDrafts[0].status).toBe('partially_confirmed')
    f.app.observed.failNext();await expect(f.app.runtime.confirm({draftId:f.draftId,taskTempIds:[ids[1]],revision:semanticRevision(first)})).rejects.toThrow('D6_INJECTED_ATOMIC_FAILURE');expect(await f.app.runtime.load()).toEqual(first)
    const intent={draftId:f.draftId,taskTempIds:[ids[1]],revision:semanticRevision(first)},saved=await f.app.runtime.confirm(intent);expect(saved.tasks).toHaveLength(2);expect(await f.app.independentReadback()).toEqual(saved)
    const reopened=await createD6Runtime(f.options);expect(await reopened.runtime.load()).toEqual(saved);expect(stateOfRuntime(saved,f.draftId).rawOutputText).toBe(raw);expect(await reopened.open(f.replay.id)).toBe(f.draftId)
  })
  it('supports explicit rejection after partial acceptance',async()=>{
    const f=await setup(),ids=await reviewAll(f);await f.app.runtime.confirm({draftId:f.draftId,taskTempIds:[ids[0]],revision:semanticRevision(await f.app.runtime.load())})
    const saved=await f.app.runtime.semantic!.dispose({draftId:f.draftId,taskTempIds:[ids[1]],kind:'reject',operationId:crypto.randomUUID(),revision:semanticRevision(await f.app.runtime.load())})
    expect(saved.tasks).toHaveLength(1);expect(saved.extractionDrafts[0].rejectedEntityTempIds).toContain(ids[1])
  })
  it('keeps the correct no-task result task-free and exposes the remaining information-review block',async()=>{
    const f=await setup('D5R1-S09-B'),before=await f.app.runtime.load();expect(stateOfRuntime(before,f.draftId).first.original.tasks).toHaveLength(0)
    await expect(f.app.runtime.semantic!.dispose({draftId:f.draftId,taskTempIds:[],kind:'review_info',operationId:crypto.randomUUID(),revision:semanticRevision(before)})).rejects.toThrow('INFORMATION_REQUIRES_REVIEW')
    expect((await f.app.runtime.load()).tasks).toHaveLength(0)
  })
  it('refuses a foreign database and new model execution',async()=>{
    const replay=record('D5R1-S01-A'),transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:'foreign'})
    await expect(createD6Runtime({transport,choices:[replay],read:async()=>replay})).rejects.toThrow('D6_DATABASE_BINDING')
  })
  it('keeps the injected failure armed across a no-op write',async()=>{
    const f=await setup(),ids=await reviewAll(f),before=await f.app.runtime.load();f.app.observed.failNext()
    await f.app.observed.store.transaction('current',value=>value)
    await expect(f.app.runtime.confirm({draftId:f.draftId,taskTempIds:[ids[0]],revision:semanticRevision(await f.app.runtime.load())})).rejects.toThrow('D6_INJECTED_ATOMIC_FAILURE')
    expect(await f.app.runtime.load()).toEqual(expect.objectContaining({tasks:before.tasks}))
  })
})
