import {describe,it,expect} from 'vitest'
import {createOrdinaryMeasurement} from './ordinaryMeasurementD26'
import {MemoryWorkspaceRecordStore} from './repository'
import {D20ReviewSessionRepository} from '../../experiments/candidate16/d20ReviewSession'
import {emptyWorkspace} from '../../experiments/mainline01/fixtures'
import {CanonicalWorkspaceRepository} from './repository'
import {CapturePersistenceService} from './capture'
import {ordinaryFixtureResult,ordinaryFixtures} from '../../experiments/d26/fixtures'
import type {SourceReviewReceipt} from './sourceReviewD26'

async function setup(){
  let clock=0;const store=Object.assign(new MemoryWorkspaceRecordStore(),{name:'rco-mainline-01-02-i1-d26-ordinary-unit01'}),repo=new CanonicalWorkspaceRepository(store)
  await repo.initialize(emptyWorkspace());const capture=new CapturePersistenceService(repo),handle=await capture.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',title:'匿名',rawText:ordinaryFixtures[1].text,provider:'manual',modelName:'test',promptVersion:null,pipelineVersion:'test'})
  await capture.recognize(handle,async()=>ordinaryFixtureResult('no-date',handle.sourceId))
  const workspace=(await repo.load())!,measurement=createOrdinaryMeasurement(store,()=>clock),session=new D20ReviewSessionRepository(store,measurement.changed,measurement.activity,true)
  const receipt:SourceReviewReceipt={version:'source-review-d26-1',draftId:handle.draftId,commitId:'test-commit',disposition:'confirmed',entityIds:[],entityHashes:{}}
  return {measurement,session,workspace,receipt,setClock:(n:number)=>{clock=n},id:handle.draftId,store}
}
describe('D26 ordinary measured events use real checkpoint identities',()=>{
  it('ten seconds of only reading has zero editing, while missing completion remains missing',async()=>{
    const x=await setup();await x.measurement.begin(x.id);x.setClock(10_000);await x.measurement.append(x.id,'read')
    const report=await x.measurement.report(x.id,undefined)
    expect(report.semantic.activeEditMs).toBeNull();expect(report.semantic.missing.length).toBeGreaterThan(0)
    await x.measurement.committed(x.receipt,await x.session.load(x.workspace,x.id),x.workspace);await x.measurement.readback(x.receipt);await x.measurement.finish(x.id,false)
    const complete=await x.measurement.report(x.id,undefined)
    expect(complete.semantic.activeEditMs).toBe(0);expect(complete.semantic.readMs).toBe(10_000);expect(complete.humanMetrics).toBe('NOT_OBSERVABLE')
  })
  it('failed checkpoint + retry keeps one edit identity and can link it to commit/readback',async()=>{
    const x=await setup();await x.measurement.begin(x.id)
    const original=x.store.transactionMany.bind(x.store);let fail=true
    x.store.transactionMany=async(keys,mutate)=>{if(fail){fail=false;throw Error('injected checkpoint')}return original(keys,mutate)}
    await expect(x.session.stage(x.workspace,x.id,'task:x:deadline','','2026-10-12',x.session.writer)).rejects.toThrow('injected')
    await x.session.stage(x.workspace,x.id,'task:x:deadline','','2026-10-12',x.session.writer)
    x.setClock(2000);await x.measurement.blur();const s=await x.session.load(x.workspace,x.id)
    await x.measurement.committed(x.receipt,s,x.workspace);await x.measurement.readback(x.receipt);await x.measurement.readback(x.receipt);await x.measurement.finish(x.id,false)
    const rows=await x.measurement.events(x.id)
    expect(rows.filter(e=>e.kind==='edit')).toHaveLength(1);expect(rows.filter(e=>e.kind==='readback')).toHaveLength(1)
    expect((await x.measurement.report(x.id,s)).correctionCheckpointLinks[0].commits[0].commitId).toBe('test-commit')
  })
  it('counts title/date corrections but excludes an unrelated program duration default; an explicit duration edit still counts',async()=>{
    const x=await setup();await x.measurement.begin(x.id)
    const before={title:'保存手册',deadline:'',estimatedMinutes:30},userAfter={...before,title:'保存手册副本',deadline:'2026-10-12'}
    const draft=x.workspace.extractionDrafts.find(d=>d.id===x.id)!
    draft.legacyData={...draft.legacyData,v7Record:{items:[{id:'item',suggestion:{...userAfter,estimatedMinutes:60},history:[{actor:'user',field:'识别建议',before:JSON.stringify(before),after:JSON.stringify(userAfter)}]}]}}
    await x.session.stage(x.workspace,x.id,'task:item:title',before.title,userAfter.title,x.session.writer)
    await x.session.stage(x.workspace,x.id,'task:item:deadline',before.deadline,userAfter.deadline,x.session.writer)
    await x.measurement.committed(x.receipt,await x.session.load(x.workspace,x.id),x.workspace)
    expect((await x.measurement.events(x.id)).find(e=>e.kind==='commit')?.semanticFields?.sort()).toEqual(['task:item:deadline','task:item:title'])
    const edited={...userAfter,estimatedMinutes:45}
    draft.legacyData.v7Record={items:[{id:'item',suggestion:edited,history:[{actor:'user',field:'识别建议',before:JSON.stringify(before),after:JSON.stringify(userAfter)},{actor:'user',field:'识别建议',before:JSON.stringify({...userAfter,estimatedMinutes:60}),after:JSON.stringify(edited)}]}]}
    await x.session.stage(x.workspace,x.id,'task:item:facts',{...userAfter,estimatedMinutes:60},edited,x.session.writer)
    await x.measurement.committed({...x.receipt,commitId:'second'},await x.session.load(x.workspace,x.id),x.workspace)
    expect((await x.measurement.events(x.id)).find(e=>e.commitId==='second')?.semanticFields).toContain('task:item:estimatedMinutes')
  })
  it('retains input cost when the user returns to the initial value without counting a correction',async()=>{
    const x=await setup();await x.measurement.begin(x.id)
    const draft=x.workspace.extractionDrafts.find(d=>d.id===x.id)!
    draft.legacyData={...draft.legacyData,v7Record:{items:[{id:'item',suggestion:{title:'原值'},history:[{actor:'user',field:'识别建议',before:'{"title":"原值"}',after:'{"title":"改值"}'},{actor:'user',field:'识别建议',before:'{"title":"改值"}',after:'{"title":"原值"}'}]}]}}
    await x.session.stage(x.workspace,x.id,'task:item:title','原值','改值',x.session.writer)
    await x.session.stage(x.workspace,x.id,'task:item:title','原值','原值',x.session.writer)
    await x.measurement.committed(x.receipt,await x.session.load(x.workspace,x.id),x.workspace)
    const rows=await x.measurement.events(x.id)
    expect(rows.some(e=>e.kind==='edit')).toBe(true)
    expect(rows.find(e=>e.kind==='commit')?.semanticFields).toEqual([])
  })
})
