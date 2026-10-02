import {describe,it,expect} from 'vitest'
import {MemoryWorkspaceRecordStore} from '../../domain/v2/repository'
import {createD13Runtime} from '../candidate16/runtime'
import type {D13ReplayRecord} from '../candidate16/replay'
import {makeD25,sha} from '../../../scripts/prepare-d25.mjs'
import {indexImmutableScopesV11} from '../../recognition/scopeIndexV11'
import {semanticRevision,stateOfRuntime,effectiveStateFacts} from '../mainline05/semanticState'
import {reviewSemanticFact,reviewSemanticMaterial} from '../mainline05/semanticConfirmation'
import {CANDIDATE18_VERSION} from '../realInput01/candidate18'
import {calculateLowEditV2} from '../candidate16/measurement'
const data=await makeD25()
async function record(i:number):Promise<D13ReplayRecord>{
  const s=data['SOURCES.json'].sources[i],facts=data['LEGAL_WIRE_ORACLES.json'].oracles[i].rawFacts
  const rawHttpText=JSON.stringify({status:'completed',error:null,model:'deepseek-flash',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(facts)}]}],usage:{input_tokens:0,output_tokens:0}})
  return {id:'d13-fixture-d25-test-'+i,label:'D25匿名工程正例（不是模型输出）',kind:'ENGINEERING_FIXTURE',candidateVersion:CANDIDATE18_VERSION,context:{index:await indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone},rawHttpText,responseSha256:sha(rawHttpText),requestSha256:sha('NOT_SENT:'+i)}
}
async function setup(i:number,identity='alpha'){
  const r=await record(i),transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:'rco-mainline-01-02-i1-real-input-d23-study-engineering-d25-'+identity})
  const app=await createD13Runtime({transport,choices:[r],read:async()=>r,sourceSession:true,buildLabel:'D25定向产品工程测试'})
  return {...app,transport,record:r,draftId:await app.open(r.id)}
}
describe('D25 new mechanism uses existing ReviewSession, DomainCommitPlan and independent repository',()=>{
  it('zero tasks still saves event with a null vague time; raw facts and inverse conversion are separate',async()=>{
    const a=await setup(0),before=await a.repository.load()
    expect(before.tasks).toHaveLength(0);expect(before.events).toHaveLength(0)
    const saved=await a.runtime.semantic!.dispose({draftId:a.draftId,revision:semanticRevision(before),taskTempIds:[],kind:'review_info',operationId:'no-task-event'})
    expect(saved.tasks).toHaveLength(0);expect(saved.projects).toHaveLength(0);expect(saved.events).toHaveLength(1)
    expect(saved.timePoints[0]).toMatchObject({rawText:'周三晚',normalizedValue:null,precision:'vague',needsConfirmation:true,eventId:saved.events[0].id})
    expect(await a.independentReadback()).toEqual(saved)
    const raw=await a.transport.read('d13-original:'+a.draftId) as {rawHttpText:string;programConversion:{inferredFacts:number}}
    expect(raw.rawHttpText).toBe(a.record.rawHttpText);expect(raw.programConversion.inferredFacts).toBe(0)
  })
  it('dependent tasks are retained pending, with material and relation ownership; no fabricated completion',async()=>{
    const a=await setup(2),before=await a.repository.load(),facts=effectiveStateFacts(stateOfRuntime(before,a.draftId)).facts
    expect(facts.tasks[1].condition.value).toBe('not_applicable');expect(facts.tasks[1].detail.dependencyTempIds).toEqual(['T1'])
    for(const material of facts.materials)await reviewSemanticMaterial(a.repository,{draftId:a.draftId,materialId:material.tempId,revision:semanticRevision(await a.repository.load()),operationId:'material-'+material.tempId,value:{required:true,status:'unverified'}})
    for(const task of facts.tasks)await reviewSemanticFact(a.repository,{draftId:a.draftId,taskId:task.id,revision:semanticRevision(await a.repository.load()),operationId:'review-'+task.id})
    const saved=await a.runtime.confirm({draftId:a.draftId,revision:semanticRevision(await a.repository.load()),taskTempIds:['T1','T2']})
    expect(saved.tasks).toHaveLength(2);expect(saved.tasks.every(t=>t.status==='todo')).toBe(true);expect(saved.materials).toHaveLength(1)
    expect(await a.independentReadback()).toEqual(saved)
  })
  it('formal failure is atomic and manual retry idempotent; known commit readback recovery never resubmits',async()=>{
    const a=await setup(0),before=await a.repository.load(),intent={draftId:a.draftId,revision:semanticRevision(before),taskTempIds:[] as string[],kind:'review_info' as const,operationId:'save-once'}
    a.observed.failNext();await expect(a.runtime.semantic!.dispose(intent)).rejects.toThrow('D13_INJECTED_ATOMIC_FAILURE');expect((await a.independentReadback()).events).toHaveLength(0)
    a.observed.failReadbackNext();await expect(a.runtime.semantic!.dispose(intent)).rejects.toThrow();expect((await a.repository.load()).events).toHaveLength(1)
    const commits=(await a.repository.load()).historyRecords.length
    await a.runtime.realInput!.readbackRecovery!.retry();expect((await a.independentReadback()).historyRecords).toHaveLength(commits)
    await a.runtime.semantic!.dispose({...intent,revision:semanticRevision(await a.repository.load())});expect((await a.independentReadback()).events).toHaveLength(1)
    expect(calculateLowEditV2(await a.metrics.events(a.draftId))).toMatchObject({fieldCount:0,activeEditMs:0})
  })
  it('two isolated identities never share source, draft, edit or confirmed graph',async()=>{
    const a=await setup(0,'one'),b=await setup(2,'two')
    await a.runtime.semantic!.dispose({draftId:a.draftId,revision:semanticRevision(await a.repository.load()),taskTempIds:[],kind:'review_info',operationId:'one-event'})
    const second=await b.independentReadback();expect(second.events).toHaveLength(0);expect(second.sources[0].id).not.toBe((await a.independentReadback()).sources[0].id)
    expect((await b.metrics.events(b.draftId)).some(e=>e.kind==='commit')).toBe(false)
  })
  it('malformed new answer preserves Source/Version/Run/Draft and raw; never creates formal facts or silently repairs',async()=>{
    const r=await record(0),env=JSON.parse(r.rawHttpText),facts=JSON.parse(env.output[0].content[0].text);facts.events=[];env.output[0].content[0].text=JSON.stringify(facts);r.rawHttpText=JSON.stringify(env);r.responseSha256=sha(r.rawHttpText)
    const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:'rco-mainline-01-02-i1-real-input-d23-study-engineering-d25-fail'})
    const app=await createD13Runtime({transport,choices:[r],read:async()=>r,sourceSession:true,buildLabel:'D25拒绝反例'})
    await expect(app.open(r.id)).rejects.toThrow();const w=await app.independentReadback();expect(w.sources).toHaveLength(1);expect(w.sourceVersions).toHaveLength(1);expect(w.extractionDrafts[0].status).toBe('failed');expect(w.events).toHaveLength(0)
    expect(await transport.read('d25-replay-raw:'+r.id)).toMatchObject({rawHttpText:r.rawHttpText})
    await expect(app.open(r.id)).rejects.toThrow('D13_PRIOR_INCOMPLETE_PRESERVED');expect((await app.independentReadback()).sources).toHaveLength(1)
  })
})
