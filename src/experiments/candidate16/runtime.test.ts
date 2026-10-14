import {describe,it,expect} from 'vitest'
import {MemoryWorkspaceRecordStore} from '../../domain/v2/repository'
import {buildD13Records} from '../../../scripts/candidate16-d13-records.mjs'
import {createD13Runtime} from './runtime'
import {D13_DATABASE,calculateLowEditV2} from './measurement'
import {effectiveStateFacts,stateOfRuntime,semanticRevision,canAct,REAL_STATE_VERSION} from '../mainline05/semanticState'
import {correctSemanticFact,reviewSemanticFact} from '../mainline05/semanticConfirmation'
import {inspectRevisionLinks,assertRevisionSelection} from './revisionGuard'
const records=await buildD13Records()
async function setup(id:string){const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:D13_DATABASE});const app=await createD13Runtime({transport,choices:records,read:async id=>records.find(r=>r.id===id)!});const draftId=await app.open(id);return {...app,draftId,transport}}
describe('D13 actual confirmation repository, recorded outputs remain immutable',()=>{
  it('no-task archive leaves zero tasks and projects; idempotent recorded reopening',async()=>{
    const a=await setup('d13-fixture-no-task'),before=await a.repository.load()
    const saved=await a.runtime.semantic!.dispose({draftId:a.draftId,revision:semanticRevision(before),taskTempIds:[],kind:'review_info',operationId:'no-task'})
    expect(saved.tasks).toHaveLength(0);expect(saved.projects).toHaveLength(0)
    expect(await a.independentReadback()).toEqual(saved);expect(await a.open('d13-fixture-no-task')).toBe(a.draftId)
    expect((await a.repository.load()).sources).toHaveLength(1)
  })
  it('event edit/save failure/manual retry/readback preserves original and vague time',async()=>{
    const a=await setup('d13-fixture-vague-event'),before=await a.repository.load(),state=stateOfRuntime(before,a.draftId),event=effectiveStateFacts(state).facts.events[0]
    await a.metrics.changed(a.draftId,'event.location')
    const intent={draftId:a.draftId,revision:semanticRevision(before),operationId:'correct-event',change:{kind:'independent_event' as const,eventId:event.tempId,value:{...event,location:'人工核对服务台'},scopeIds:event.scopeIds,note:'匿名工程人工纠正'}}
    a.observed.failNext();await expect(correctSemanticFact(a.repository,intent)).rejects.toThrow('D13_INJECTED_ATOMIC_FAILURE');expect(await a.independentReadback()).toEqual(before)
    await correctSemanticFact(a.repository,intent)
    const corrected=await a.repository.load();a.observed.failNext()
    const confirmation={draftId:a.draftId,revision:semanticRevision(corrected),taskTempIds:[] as string[],kind:'review_info' as const,operationId:'event-confirm'}
    await expect(a.runtime.semantic!.dispose(confirmation)).rejects.toThrow('D13_INJECTED_ATOMIC_FAILURE')
    expect((await a.repository.load()).events).toHaveLength(0)
    const saved=await a.runtime.semantic!.dispose(confirmation)
    expect(saved.events).toHaveLength(1);expect(saved.tasks).toHaveLength(0);expect(saved.projects).toHaveLength(0)
    expect(saved.timePoints[0]).toMatchObject({normalizedValue:null,needsConfirmation:true})
    expect(stateOfRuntime(saved,a.draftId).rawResponse).toEqual(state.rawResponse)
    expect(await a.independentReadback()).toEqual(saved)
    const metric=calculateLowEditV2(await a.metrics.events(a.draftId),true)
    expect(metric.fieldCount).toBe(1);expect(metric.missing).toEqual([]);expect(metric.lowModificationCorrectDisposition).toBe(true);expect(metric.zeroSubstantiveModification).toBe(false)
  })
  it('wrong revision blocks only its connected task; unrelated reviewed task can be partially confirmed',async()=>{
    const a=await setup('d13-fixture-partial-revision'),before=await a.repository.load(),facts=effectiveStateFacts(stateOfRuntime(before,a.draftId)).facts
    expect(inspectRevisionLinks(facts)[0].taskIds).toContain('T3')
    const legacy=structuredClone(stateOfRuntime(before,a.draftId));if(legacy.version===REAL_STATE_VERSION&&legacy.recovery)delete legacy.recovery.scopePolicy
    expect(canAct(legacy,'T4')).toBe(false)
    expect(()=>assertRevisionSelection(facts,['T3'])).toThrow('D13_REVISION_CONFIRMATION_BLOCKED')
    await expect(a.runtime.confirm({draftId:a.draftId,revision:semanticRevision(before),taskTempIds:['T3']})).rejects.toThrow('D13_REVISION_CONFIRMATION_BLOCKED')
    expect((await a.repository.load()).tasks).toHaveLength(0)
    await reviewSemanticFact(a.repository,{draftId:a.draftId,taskId:'T4',revision:semanticRevision(before),operationId:'review-safe'})
    const saved=await a.runtime.confirm({draftId:a.draftId,revision:semanticRevision(await a.repository.load()),taskTempIds:['T4']})
    expect(saved.tasks).toHaveLength(1);expect(saved.tasks[0].title).toContain('预约')
    expect(saved.extractionDrafts[0].status).toBe('partially_confirmed');expect(await a.independentReadback()).toEqual(saved)
  })
  it('task title edits are linked to a real correction commit, readback, and final confirmation',async()=>{
    const a=await setup('d13-fixture-task'),before=await a.repository.load()
    await a.metrics.changed(a.draftId,'T1:title')
    await a.runtime.edit({draftId:a.draftId,taskTempId:'T1',revision:semanticRevision(before),operationId:'task-title',field:'title',value:'复核项目成员资料（已核对）'})
    await reviewSemanticFact(a.repository,{draftId:a.draftId,taskId:'T1',revision:semanticRevision(await a.repository.load()),operationId:'review-title'})
    const saved=await a.runtime.confirm({draftId:a.draftId,taskTempIds:['T1'],revision:semanticRevision(await a.repository.load())})
    expect(saved.tasks[0].title).toContain('已核对');expect(await a.independentReadback()).toEqual(saved)
    expect(calculateLowEditV2(await a.metrics.events(a.draftId),true)).toMatchObject({fieldCount:1,lowModificationCorrectDisposition:true,zeroSubstantiveModification:false})
  })
  it('exact independent event becomes a canonical event/time while preserving zero tasks',async()=>{
    const a=await setup('d13-fixture-exact-event')
    const saved=await a.runtime.semantic!.dispose({draftId:a.draftId,revision:semanticRevision(await a.repository.load()),taskTempIds:[],kind:'review_info',operationId:'exact'})
    expect(saved.events).toHaveLength(1);expect(saved.tasks).toHaveLength(0);expect(saved.timePoints[0].normalizedValue).toBe('2026-10-14T19:00')
  })
  it('rejecting a wrong extra suggestion is a structural correction, never zero/low modification',async()=>{
    const a=await setup('d13-fixture-reject-extra')
    await a.runtime.semantic!.dispose({draftId:a.draftId,revision:semanticRevision(await a.repository.load()),taskTempIds:['T2'],kind:'reject',operationId:'reject-extra'})
    await reviewSemanticFact(a.repository,{draftId:a.draftId,taskId:'T1',revision:semanticRevision(await a.repository.load()),operationId:'review-kept'})
    const saved=await a.runtime.confirm({draftId:a.draftId,taskTempIds:['T1'],revision:semanticRevision(await a.repository.load())})
    expect(saved.tasks).toHaveLength(1);expect(await a.independentReadback()).toEqual(saved)
    expect(calculateLowEditV2(await a.metrics.events(a.draftId),true)).toMatchObject({structural:true,fieldCount:1,zeroSubstantiveModification:false,lowModificationCorrectDisposition:false,missing:[]})
  })
  it('repository queue delay is wait time captured before transaction execution',async()=>{
    const a=await setup('d13-fixture-task'),original=a.transport.transactionMany.bind(a.transport)
    a.transport.transactionMany=async(keys,mutate)=>{await new Promise(resolve=>setTimeout(resolve,60));return original(keys,mutate)}
    await a.metrics.changed(a.draftId,'T1:title')
    await a.runtime.edit({draftId:a.draftId,taskTempId:'T1',revision:semanticRevision(await a.repository.load()),operationId:'delayed-edit',field:'title',value:'复核项目成员资料（排队验证）'})
    const rows=await a.metrics.events(a.draftId),start=rows.find(e=>e.kind==='wait')!,end=rows.find(e=>e.kind==='wait_end')!
    expect(end.atMs-start.atMs).toBeGreaterThanOrEqual(50)
  })
  it('all 24 D11 recorded responses can be opened without a new model request',async()=>{
    for(const r of records.filter(r=>r.kind==='RECORDED_MODEL')){const a=await setup(r.id);expect((await a.repository.load()).sources).toHaveLength(1);expect((await a.repository.load()).tasks).toHaveLength(0)}
  },30000)
})
