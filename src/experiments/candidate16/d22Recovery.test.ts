import {beforeAll,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {MemoryWorkspaceRecordStore} from '../../domain/v2/repository'
// @ts-expect-error Local anonymous fixture builder stays outside the app bundle.
import {buildD21Preview} from '../../../scripts/serve-d21-review-session.mjs'
import {createD13Runtime} from './runtime'
import type {D13ReplayRecord} from './replay'
import {effectiveStateFacts,readingOf,semanticRevision,stateOfRuntime} from '../mainline05/semanticState'
import {correctReadPage,makeSendSnapshot} from '../realInput01/inputReceipt'
import {FLASH41_MODEL_NAME} from '../realInput01/modelWire'
import {CANDIDATE03_VERSION} from '../realInput01/candidate03'
import {correctSemanticFact,editSemantic,reviewSemanticFact,reviewSemanticMaterial} from '../mainline05/semanticConfirmation'
import {D20ReviewSessionRepository} from './d20ReviewSession'
import {D22_PENDING_READBACK_KEY} from './d22Readback'
import {calculateD22Engineering} from './d22Measurement'
import {d22EditBelongsToCommit} from './d22EditLink'
import type {D13Trace} from './measurement'

let record:D13ReplayRecord,mixed:D13ReplayRecord,materialRecord:D13ReplayRecord
beforeAll(async()=>{
  const preview=await buildD21Preview('6720','p90','D22')
  record=JSON.parse(readFileSync(preview.directory+'/records/d13-fixture-task.json','utf8')) as D13ReplayRecord
  mixed=JSON.parse(readFileSync(preview.directory+'/records/d13-fixture-d21-mixed.json','utf8')) as D13ReplayRecord
  materialRecord=JSON.parse(readFileSync(preview.directory+'/records/d21-record-01.json','utf8')) as D13ReplayRecord
},30_000)
async function ready(){
  const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:'rco-mainline-01-02-i1-real-input-d21-review-session-p90'})
  const app=await createD13Runtime({transport,choices:[record],read:async()=>record,sourceSession:true})
  const draftId=await app.open(record.id),before=await app.repository.load()
  const reviewed=await reviewSemanticFact(app.repository,{draftId,taskId:'T1',revision:semanticRevision(before),operationId:crypto.randomUUID()})
  return {transport,app,draftId,revision:semanticRevision(reviewed)}
}
it('checkpoint failure retains no false checkpoint, manual retry writes input without creating tasks',async()=>{
  const {transport,app,draftId}=await ready(),workspace=await app.repository.load()
  const session=new D20ReviewSessionRepository(app.observed.checkpointTransport,(id,field)=>app.metrics.changed(id,field))
  app.observed.failCheckpointNext()
  await expect(session.stage(workspace,draftId,'task:T1:title','旧名','我的输入',session.writer)).rejects.toThrow('D22_INJECTED_CHECKPOINT_FAILURE')
  expect((await session.load(workspace,draftId)).fields).toEqual({})
  await session.stage(workspace,draftId,'task:T1:title','旧名','我的输入',session.writer)
  expect((await session.load(workspace,draftId)).fields['task:T1:title'].mine).toBe('我的输入')
  expect((await app.independentReadback()).tasks).toHaveLength(0)
  expect((await app.metrics.events(draftId)).filter(row=>row.kind==='edit')).toHaveLength(1)
  expect(await transport.read(D22_PENDING_READBACK_KEY)).toBeUndefined()
  const report=calculateD22Engineering(await app.metrics.events(draftId),await session.load(workspace,draftId),'assisted')
  expect(report.inputEpisodeCount).toBe(1)
  expect(report.semantic.activeEditMs).toBeNull()
  expect(report.humanMetrics.assisted.correctDisposition.status).toBe('NOT_OBSERVABLE')
})
it('opening a recovery form is reading; actual inputs resume activity with one edit identity',async()=>{
  const {app,draftId}=await ready(),workspace=await app.repository.load()
  const session=new D20ReviewSessionRepository(app.observed.checkpointTransport,(id,field)=>app.metrics.changed(id,field),async(id,fieldKey,editId)=>{await app.metrics.append(id,'edit_activity',{fieldKey,editId})})
  await session.stage(workspace,draftId,'task:T1:facts','base',{value:'original'},session.writer,false)
  expect((await app.metrics.events(draftId)).filter(row=>row.kind==='edit')).toHaveLength(0)
  await session.stage(workspace,draftId,'task:T1:facts','base',{value:'first input'},session.writer,true)
  await app.metrics.blur(draftId)
  await session.stage(workspace,draftId,'task:T1:facts','base',{value:'second input'},session.writer,true)
  const rows=await app.metrics.events(draftId)
  expect(rows.filter(row=>row.kind==='edit')).toHaveLength(1)
  expect(rows.find(row=>row.kind==='edit_activity')?.editId).toBe(rows.find(row=>row.kind==='edit')?.editId)
})
it('resumed typing counts active time without duplicating the logical correction or changing historical measurement',()=>{
  const row=(kind:D13Trace['kind'],atMs:number,extra:Partial<D13Trace>={}):D13Trace=>({id:kind+atMs,draftId:'d',kind,atMs,...extra})
  const trace=[row('begin',0),row('edit',1000,{editId:'e',fieldKey:'task:T1:title'}),row('blur',3000),row('edit_activity',10000,{editId:'e',fieldKey:'task:T1:title'}),row('blur',12000),row('commit',12001,{commitId:'c',includedEditIds:['e'],fields:['display.T1.title'],semanticFields:['task:T1:title'],disposition:'confirmed'}),row('readback',12002,{commitId:'c'}),row('end',12003,{commitId:'c',disposition:'confirmed'})]
  const result=calculateD22Engineering(trace,undefined,'assisted')
  expect(result.semantic.activeEditMs).toBe(4000)
  expect(result.semantic.legacyMeasurement32.activeEditMs).toBe(2000)
  expect(result.inputEpisodeCount).toBe(1)
  expect(result.semantic.semanticFieldCount).toBe(1)
})
it('the page relation editor maps a condition commit to its own task, not a concurrent event',async()=>{
  const {app,draftId}=await ready(),workspace=await app.repository.load()
  expect(d22EditBelongsToCommit('relation:T1:edit',['task:T1:condition'],workspace,draftId)).toBe(true)
  expect(d22EditBelongsToCommit('relation:T1:edit',['event:E1:title'],workspace,draftId)).toBe(false)
})
it('material observation cost links to its persisted review without inventing a model correction',async()=>{
  const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:'rco-mainline-01-02-i1-real-input-d21-review-session-p92'})
  const app=await createD13Runtime({transport,choices:[materialRecord],read:async()=>materialRecord,sourceSession:true})
  const draftId=await app.open(materialRecord.id),before=await app.repository.load()
  const facts=effectiveStateFacts(stateOfRuntime(before,draftId)).facts,task=facts.tasks[0],material=facts.materials[0]
  const session=new D20ReviewSessionRepository(app.observed.checkpointTransport,(id,field)=>app.metrics.changed(id,field))
  await session.stage(before,draftId,'task:'+task.id+':facts','base',{materialBuffer:{id:material.tempId,required:'yes',status:'unverified'}},session.writer,true)
  const edit=(await app.metrics.events(draftId)).find(row=>row.kind==='edit')!
  expect(edit.fieldKey).toBe('task:'+task.id+':material-review:'+material.tempId)
  await reviewSemanticMaterial(app.repository,{draftId,materialId:material.tempId,revision:semanticRevision(before),operationId:crypto.randomUUID(),value:{required:true,status:'unverified'}})
  const rows=await app.metrics.events(draftId),commit=rows.find(row=>row.kind==='commit')!
  expect(commit.includedEditIds).toEqual([edit.editId])
  expect(commit.fields).toEqual([])
  expect(commit.semanticFields).toEqual([])
  expect(rows.some(row=>row.kind==='readback'&&row.commitId===commit.commitId)).toBe(true)
  expect(d22EditBelongsToCommit(edit.fieldKey,[],before,draftId,[])).toBe(false)
  expect(d22EditBelongsToCommit('task:'+task.id+':facts',[],before,draftId,[stateOfRuntime(await app.repository.load(),draftId).operations.at(-1)!])).toBe(false)
})
it('partial confirmation selection persists without a correction and stale conflict cleanup is rejected',async()=>{
  const {app,draftId}=await ready(),workspace=await app.repository.load(),session=new D20ReviewSessionRepository(app.observed.checkpointTransport)
  const selected=await session.stage(workspace,draftId,'task:T1:selected',false,true,session.writer,false)
  expect((await session.load(workspace,draftId)).fields['task:T1:selected'].mine).toBe(true)
  expect((await app.metrics.events(draftId)).filter(row=>row.kind==='edit')).toHaveLength(0)
  const other=await session.stage(workspace,draftId,'task:T1:selected',false,false,'other-tab',false)
  expect(other.fields['task:T1:selected'].conflict?.incoming).toBe(false)
  await expect(session.clear(workspace,draftId,'task:T1:selected',session.writer,selected.fields['task:T1:selected'].revision)).rejects.toThrow()
  expect((await app.independentReadback()).tasks).toHaveLength(0)
})
it('an independent event commit cannot consume a pending task edit; each maps to its actual saved fact',async()=>{
  const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:'rco-mainline-01-02-i1-real-input-d21-review-session-p91'})
  const app=await createD13Runtime({transport,choices:[mixed],read:async()=>mixed,sourceSession:true})
  const draftId=await app.open(mixed.id),before=await app.repository.load()
  const taskEdit=await app.metrics.changed(draftId,'task:draft-item:'+draftId+':T1:title')
  const eventEdit=await app.metrics.changed(draftId,'event:E1:edit')
  const event=effectiveStateFacts(stateOfRuntime(before,draftId)).facts.events[0]
  await correctSemanticFact(app.repository,{draftId,revision:semanticRevision(before),operationId:crypto.randomUUID(),change:{kind:'independent_event',eventId:event.tempId,value:{...event,location:'匿名报告厅'},scopeIds:event.scopeIds,note:'匿名工程核对'}})
  let commits=(await app.metrics.events(draftId)).filter(row=>row.kind==='commit')
  expect(commits.at(-1)?.includedEditIds).toEqual([eventEdit])
  const latest=await app.repository.load()
  await editSemantic(app.repository,{draftId,taskTempId:'T1',revision:semanticRevision(latest),operationId:crypto.randomUUID(),field:'title',value:'复核成员资料清单'})
  commits=(await app.metrics.events(draftId)).filter(row=>row.kind==='commit')
  expect(commits.at(-1)?.includedEditIds).toEqual([taskEdit])
})
it('atomic failure leaves no formal facts and a manual retry creates one task',async()=>{
  const {app,draftId,revision}=await ready()
  app.observed.failNext()
  await expect(app.runtime.confirm({draftId,revision,taskTempIds:['T1']})).rejects.toThrow('D13_INJECTED_ATOMIC_FAILURE')
  expect((await app.independentReadback()).tasks).toHaveLength(0)
  await app.runtime.confirm({draftId,revision,taskTempIds:['T1']})
  expect((await app.independentReadback()).tasks).toHaveLength(1)
})
it('a committed readback failure survives runtime reopening; only readback recovers and never resubmits',async()=>{
  const {transport,app,draftId,revision}=await ready()
  app.observed.failReadbackNext()
  await expect(app.runtime.confirm({draftId,revision,taskTempIds:['T1']})).rejects.toThrow('已提交，读回尚未验证')
  const written=await app.repository.load(),historyCount=written.historyRecords.length
  expect(written.tasks).toHaveLength(1)
  expect(await app.observed.pending()).toBeDefined()
  await expect(app.repository.transaction(value=>value)).rejects.toThrow('读回尚未验证')
  const reopened=await createD13Runtime({transport,choices:[record],read:async()=>record,sourceSession:true})
  await reopened.runtime.realInput!.readbackRecovery!.retry()
  const recovered=await reopened.independentReadback()
  expect(recovered.tasks).toHaveLength(1)
  expect(recovered.historyRecords).toHaveLength(historyCount)
  expect(await reopened.observed.pending()).toBeUndefined()
  await reopened.runtime.realInput!.readbackRecovery!.retry()
  expect((await reopened.independentReadback()).tasks).toHaveLength(1)
  const rows=await reopened.metrics.events(draftId),commit=rows.filter(row=>row.kind==='commit'&&row.disposition==='confirmed')
  expect(commit).toHaveLength(1)
  expect(rows.filter(row=>row.kind==='readback'&&row.commitId===commit[0].commitId)).toHaveLength(1)
})
it('checkpoint reads current storage SourceVersion and rejects an old page without deleting its input',async()=>{
  const {app,draftId}=await ready(),before=await app.repository.load(),session=new D20ReviewSessionRepository(app.observed.checkpointTransport)
  const staged=await session.stage(before,draftId,'task:T1:title','旧值','保留输入',session.writer)
  const source=before.sources[0],version=before.sourceVersions[0]
  const receipt=await correctReadPage(readingOf(source.legacyData?.realInput01).inputReceipt,1,version.rawText+'\n匿名来源修订',crypto.randomUUID(),new Date().toISOString())
  const corrected=await app.repository.saveReadingCorrection(source.id,receipt,semanticRevision(before))
  await app.repository.beginInputRun(source.id,{...readingOf(source.legacyData?.realInput01),inputReceipt:receipt,sendSnapshot:await makeSendSnapshot(receipt,[1],[1],new Date().toISOString())},'seen_engineering_replay',crypto.randomUUID(),semanticRevision(corrected),undefined,CANDIDATE03_VERSION,FLASH41_MODEL_NAME)
  await expect(session.clear(before,draftId,'task:T1:title',session.writer,staged.fields['task:T1:title'].revision)).rejects.toThrow('D20_SOURCE_VERSION_CONFLICT')
  expect((await session.load(before,draftId)).fields['task:T1:title'].mine).toBe('保留输入')
  expect((await app.independentReadback()).tasks).toHaveLength(0)
})
