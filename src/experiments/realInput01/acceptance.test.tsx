import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from '../../App'
import { DashboardPage } from '../../pages/DashboardPage'
import { MemoryWorkspaceRecordStore } from '../../domain/v2/repository'
import { createRealInputRuntime, emptyRealInputWorkspace, sendRealInput, inputRunContext, dispatchRealInput } from './runtime'
import { createModelClient } from './modelClient'
import { buildModelRequest, parseModelEnvelope } from './modelWire'
import { composeSemantics } from '../mainline04/semanticComposer'
import { acquireText } from './inputAcquisition'
import { makeSendSnapshot, sha256Text } from './inputReceipt'
import { SemanticRepository } from '../mainline05/semanticRepository'
import { reviewSemanticFact } from '../mainline05/semanticConfirmation'
import { REAL_STATE_VERSION, semanticRevision, stateOfRuntime } from '../mainline05/semanticState'
import { cases, notices, seenWire, NOW } from './seenInputs'
import { FactCorrectionEditor } from './FactCorrectionEditor'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { CanonicalWorkspaceRepository } from '../../domain/v2/repository'
import { replayRecordedA02, replayRecordedBatch, recordedA02Identity, type RecordedBatch, type RecordedA02 } from './runtime'
import { editSemantic, reviewSemanticMaterial } from '../mainline05/semanticConfirmation'
import { effectiveStateFacts, readingOf } from '../mainline05/semanticState'
import { SemanticFacts } from '../mainline05/SemanticFacts'
import { buildBrowserReminderJobs } from '../../lib/notifications'
import { DraftReviewPanel } from '../../components/DraftReviewPanel'
import type { ComponentProps } from 'react'
import { correctSemanticFact, confirmSemantic, disposeSemantic } from '../mainline05/semanticConfirmation'
import { openFailedForCorrection } from '../mainline05/semanticCapture'
import { canAct, life, validateSemanticWorkspace } from '../mainline05/semanticState'
import type { FactChange } from './factCorrections'
import type { SemanticTask } from '../mainline04/semanticContract'
import { replayRecordedCandidate02, type RecordedCandidate02 } from './runtime'
import { CANDIDATE02_VERSION } from './candidate02'
import { InputReview } from './InputReview'
import { correctReadPage } from './inputReceipt'
import type { ReactElement } from 'react'
import { replayRecordedCandidate03, type RecordedCandidate03 } from './runtime'
import { CANDIDATE03_VERSION } from './candidate03'

describe('candidate03 recorded response integration, no model requests',()=>{
  async function recordedFixture(){
    const root='docs/recognition-optimization/mainline-real-input-01/runs/',D=root+'candidate03-20260908a/'
    const before=JSON.parse(readFileSync(root+'candidate02-20260908a/DELIVERY_BROWSER_DOWNLOAD.json','utf8'))
    const store=Object.assign(new MemoryWorkspaceRecordStore(),{name:before.workspace.id})
    await new CanonicalWorkspaceRepository(store).save(before)
    const repo=await SemanticRepository.open(store.name,store,undefined,'real-input-01')
    const item=JSON.parse(readFileSync(D+'BINDING.json','utf8')).items[0]
    const raw=JSON.parse(readFileSync(D+'D01_DISPATCH_RAW.jsonl','utf8'))
    const record:RecordedCandidate03={version:'recorded-candidate03-1',unitId:'D01',name:store.name,handle:item.handle,context:item.context,
      requestSha:raw.requestSha,responseSha:raw.responseSha,rawHttpText:raw.rawHttpText}
    return {before,store,repo,record,identity:{unitId:'D01',requestSha:raw.requestSha,responseSha:raw.responseSha}}
  }
  it('rejects source/run/version/request/response substitution before any write',async()=>{
    const {before,store,repo,record,identity}=await recordedFixture(),write=vi.spyOn(store,'transaction')
    const variants=[{...record,handle:{...record.handle,sourceId:'other'}},{...record,handle:{...record.handle,sourceVersionId:'other'}},
      {...record,handle:{...record.handle,recognitionRunId:'other'}},{...record,handle:{...record.handle,draftId:'other'}},
      {...record,requestSha:'0'.repeat(64)},{...record,rawHttpText:record.rawHttpText+' '},
      {...record,context:{...record.context,referenceTime:'2020-01-01T00:00:00Z'}}]
    for(const variant of variants){await expect(replayRecordedCandidate03(repo,variant,identity)).rejects.toThrow();expect(await repo.load()).toEqual(before)}
    expect(write).not.toHaveBeenCalled()
  },60000)
  it('failed transaction rolls back the entire import; successful retry of local save is terminal and duplicate-safe',async()=>{
    const {before,store,repo,record,identity}=await recordedFixture()
    vi.spyOn(store,'transaction').mockImplementationOnce(async()=>{throw Error('INJECTED_LOCAL_TRANSACTION_FAILURE')})
    await expect(replayRecordedCandidate03(repo,record,identity)).rejects.toThrow('INJECTED_LOCAL_TRANSACTION_FAILURE')
    expect(await repo.load()).toEqual(before)
    const write=vi.spyOn(store,'transaction'),saved=await replayRecordedCandidate03(repo,record,identity)
    const added=saved.recognitionRuns.filter(r=>!before.recognitionRuns.some((old:{id:string})=>old.id===r.id))
    expect(added).toHaveLength(1);expect(added[0].status).toBe('succeeded')
    expect(saved.recognitionRuns.filter(r=>before.recognitionRuns.some((old:{id:string})=>old.id===r.id))).toEqual(before.recognitionRuns)
    expect(saved.extractionDrafts.filter(d=>before.extractionDrafts.some((old:{id:string})=>old.id===d.id))).toEqual(before.extractionDrafts)
    expect(saved.tasks).toEqual(before.tasks);expect(saved.materials).toEqual(before.materials)
    const draft=saved.extractionDrafts.find(d=>d.recognitionRunId===added[0].id)!
    const handle={sourceId:record.handle.sourceId,sourceVersionId:record.handle.sourceVersionId,recognitionRunId:added[0].id,draftId:draft.id,duplicate:false}
    const execute=vi.fn(async()=>record.rawHttpText)
    await expect(dispatchRealInput(repo,handle,execute)).rejects.toThrow('RECORDED_NEVER_DISPATCHABLE')
    expect(execute).not.toHaveBeenCalled();expect(await repo.load()).toEqual(saved)
    const writes=write.mock.calls.length
    expect(await replayRecordedCandidate03(repo,record,identity)).toEqual(saved)
    expect(write.mock.calls).toHaveLength(writes)
  },60000)
  it.each(['D01','D02','D03','D05'])('%s preserves originals and confirms only reviewed expressible facts',async unitId=>{
    const root='docs/recognition-optimization/mainline-real-input-01/runs/',D=root+'candidate03-20260908a/'
    const before=JSON.parse(readFileSync(root+'candidate02-20260908a/DELIVERY_BROWSER_DOWNLOAD.json','utf8'))
    const store=Object.assign(new MemoryWorkspaceRecordStore(),{name:before.workspace.id})
    await new CanonicalWorkspaceRepository(store).save(before)
    const repo=await SemanticRepository.open(store.name,store,undefined,'real-input-01')
    const binding=JSON.parse(readFileSync(D+'BINDING.json','utf8')),item=binding.items.find((i:{unitId:string})=>i.unitId===unitId)
    const raw=JSON.parse(readFileSync(D+unitId+'_DISPATCH_RAW.jsonl','utf8'))
    const record:RecordedCandidate03={version:'recorded-candidate03-1',unitId,name:store.name,handle:item.handle,context:item.context,
      requestSha:raw.requestSha,responseSha:raw.responseSha,rawHttpText:raw.rawHttpText}
    const identity={unitId,requestSha:raw.requestSha,responseSha:raw.responseSha}
    await expect(replayRecordedCandidate03(repo,{...record,responseSha:'0'.repeat(64)},identity)).rejects.toThrow('C03_IDENTITY')
    expect(await repo.load()).toEqual(before)
    const loaded=await replayRecordedCandidate03(repo,record,identity)
    const draft=loaded.extractionDrafts.find(d=>(d.legacyData?.realInputPending as {operationId?:string})?.operationId==='recorded-candidate03-'+unitId)!
    expect(loaded.recognitionRuns.find(r=>r.id===draft.recognitionRunId)?.promptVersion).toBe(CANDIDATE03_VERSION)
    expect(loaded.recognitionRuns.filter(r=>before.recognitionRuns.some((old:{id:string})=>old.id===r.id))).toEqual(before.recognitionRuns)
    const first=stateOfRuntime(loaded,draft.id),facts=effectiveStateFacts(first).facts
    expect(first.first.items.every(i=>!i.defaultSelected)).toBe(true)
    if(unitId==='D03'){
      expect(facts.timePoints).toHaveLength(1)
      expect(facts.timePoints[0]).toMatchObject({normalizedValue:null,precision:'vague',needsConfirmation:true})
      await expect(confirmSemantic(repo,{draftId:draft.id,taskTempIds:[facts.tasks[0].id],revision:semanticRevision(loaded)})).rejects.toThrow()
      expect((await repo.load()).tasks).toEqual(before.tasks)
      return
    }
    expect(facts.tasks).toHaveLength(unitId==='D01'?2:1)
    for(const material of facts.materials)await reviewSemanticMaterial(repo,{draftId:draft.id,materialId:material.tempId,
      revision:semanticRevision(await repo.load()),operationId:crypto.randomUUID(),value:{required:material.required,status:'missing'}})
    for(const task of facts.tasks)await reviewSemanticFact(repo,{draftId:draft.id,taskId:task.id,revision:semanticRevision(await repo.load()),operationId:crypto.randomUUID()})
    const saved=await confirmSemantic(repo,{draftId:draft.id,taskTempIds:facts.tasks.map(t=>t.id),revision:semanticRevision(await repo.load())})
    expect(saved.tasks).toHaveLength(before.tasks.length+facts.tasks.length)
    expect(saved.tasks.filter(t=>before.tasks.some((old:{id:string})=>old.id===t.id))).toEqual(before.tasks)
    expect(saved.timePoints.filter(t=>!before.timePoints.some((old:{id:string})=>old.id===t.id)).map(t=>t.rawText).sort()).toEqual(facts.timePoints.map(t=>t.rawText).sort())
    expect(saved.reminderRecords).toEqual(before.reminderRecords)
    expect(stateOfRuntime(saved,draft.id).first).toEqual(first.first)
    expect(stateOfRuntime(saved,draft.id).rawResponse).toEqual(first.rawResponse)
    expect(await new CanonicalWorkspaceRepository(store).load()).toEqual(JSON.parse(JSON.stringify(saved)))
    await replayRecordedCandidate03(repo,record,identity)
    expect((await repo.load()).tasks).toEqual(saved.tasks)
    await confirmSemantic(repo,{draftId:draft.id,taskTempIds:facts.tasks.map(t=>t.id),revision:semanticRevision(await repo.load())})
    expect((await repo.load()).tasks).toEqual(saved.tasks)
  },60000)
})

describe('read-close local review without model authorization',()=>{
  it('real runtime opens InputReview and saves independent corrections, while its send handler rejects before any run',async()=>{
    const initial=JSON.parse(readFileSync('docs/recognition-optimization/mainline-real-input-01/runs/correction-loop-20260908a/BROWSER_DOWNLOAD.json','utf8'))
    const store=Object.assign(new MemoryWorkspaceRecordStore(),{name:initial.workspace.id})
    await new CanonicalWorkspaceRepository(store).save(initial)
    const execute=vi.fn(async()=>{throw Error('NO_MODEL_ALLOWED')})
    const runtime=await createRealInputRuntime({name:store.name,store,execution:'live',resources,execute,recordedBatch:true,recordedCandidate02:true})
    const repo=await SemanticRepository.open(store.name,store,undefined,'real-input-01'),before=await repo.load()
    const Panel=runtime.realInput!.inputPanel
    const element=Panel({workspace:before,initialText:'',onSaved:async()=>{},onDraftReady:async()=>{}}) as ReactElement<ComponentProps<typeof InputReview>>
    expect(element.type).toBe(InputReview);expect(element.props.localOnly).toBe(true)
    const html=renderToStaticMarkup(element)
    expect(html).toContain('本机读取图片或文件');expect(html).toContain('模型发送已关闭')
    expect(html).not.toContain('生成待核对建议');expect(html).not.toContain('A08工程文字 ·')
    await expect(element.props.send('any',[1],[1],'blocked')).rejects.toThrow('REAL_INPUT_NEW_SEND_DISABLED')
    expect(await repo.load()).toEqual(before);expect(execute).not.toHaveBeenCalled()
    const original=await acquireText('local-review-test',notices.revision)
    const source=await repo.saveReading(original,'独立读取校对','local-review-test')
    const buffered=await correctReadPage(original,1,notices.revision+'\n已核对。','local-correction',NOW)
    expect(readingOf((await repo.load()).sources.find(s=>s.id===source.sourceId)!.legacyData?.realInput01).inputReceipt.corrections).toEqual([])
    await repo.saveReadingCorrection(source.sourceId,buffered,semanticRevision(await repo.load()))
    const restored=await new CanonicalWorkspaceRepository(store).load()
    expect(restored!.tasks).toEqual(before.tasks);expect(restored!.recognitionRuns).toEqual(before.recognitionRuns)
    expect(restored!.sources.filter(s=>s.id!==source.sourceId)).toEqual(before.sources)
    expect(readingOf(restored!.sources.find(s=>s.id===source.sourceId)!.legacyData?.realInput01).inputReceipt).toEqual(buffered)
    expect(execute).not.toHaveBeenCalled()
  })
})

describe('candidate02 paid records replay without a model request',()=>{
  it('the candidate02 launcher exposes local carriers but keeps all upstream sending disabled',()=>{
    const result=spawnSync(process.execPath,['--input-type=module','-e',`
      import assert from 'node:assert/strict';
      import {createLocalApp} from './scripts/serve-mainline-real-input-01.mjs';
      const app=await createLocalApp({port:6631,carrierManifest:process.env.REAL_INPUT_CARRIERS_MANIFEST,checking:true,recordedBatch:true,recordedCandidate02:true});
      assert.equal(app.evidence.carriers,8);assert.equal(app.evidence.upstreamEnabled,false);
      assert.equal(app.evidence.realApp,true);assert.deepEqual(app.evidence.forbiddenBrowserInputs,[]);
      // The existing handoff import is parsed but tree-shaken; its emitted code,
      // not mere parser visitation, must remain absent from the live bundle.
      assert.deepEqual(app.evidence.parsedReferenceModules,['src/experiments/mainline01/fixtures.ts']);
      await assert.rejects(createLocalApp({port:6632,carrierManifest:process.env.REAL_INPUT_CARRIERS_MANIFEST,checking:true,recordedBatch:true,recordedCandidate02:true}));
      console.log('candidate02 launcher: eight local carriers, zero upstream, same required origin');
    `],{encoding:'utf8',timeout:60000,maxBuffer:1024*1024})
    expect(result.error?.message??'').toBe('');expect(result.status,result.stdout+'\n'+result.stderr).toBe(0)
  },65000)
  it.each(['C03','C05','C08'])('%s creates a separately identified run and confirms valid tasks without overwriting old work',async unitId=>{
    const root='docs/recognition-optimization/mainline-real-input-01/runs/',D=root+'candidate02-20260908a/'
    const initial=JSON.parse(readFileSync(root+'correction-loop-20260908a/BROWSER_DOWNLOAD.json','utf8'))
    const store=Object.assign(new MemoryWorkspaceRecordStore(),{name:initial.workspace.id})
    await new CanonicalWorkspaceRepository(store).save(initial)
    const repo=await SemanticRepository.open(store.name,store,undefined,'real-input-01'),before=await repo.load()
    const binding=JSON.parse(readFileSync(D+'BINDING.json','utf8')),item=binding.items.find((i:{unitId:string})=>i.unitId===unitId)
    const raw=JSON.parse(readFileSync(D+unitId+'_RAW.jsonl','utf8'))
    const record:RecordedCandidate02={version:'recorded-candidate02-1',unitId,name:store.name,handle:item.handle,context:item.context,
      requestSha:raw.requestSha,responseSha:raw.responseSha,rawHttpText:raw.rawHttpText}
    const identity={unitId,requestSha:raw.requestSha,responseSha:raw.responseSha}
    await expect(replayRecordedCandidate02(repo,{...record,responseSha:'0'.repeat(64)},identity)).rejects.toThrow('C02_IDENTITY')
    expect(await repo.load()).toEqual(before)
    const loaded=await replayRecordedCandidate02(repo,record,identity)
    const draft=loaded.extractionDrafts.find(d=>(d.legacyData?.realInputPending as {operationId?:string})?.operationId==='recorded-candidate02-'+unitId)!
    expect(loaded.recognitionRuns.find(r=>r.id===draft.recognitionRunId)?.promptVersion).toBe(CANDIDATE02_VERSION)
    const first=stateOfRuntime(loaded,draft.id),facts=effectiveStateFacts(first).facts
    if(unitId==='C03'){
      expect(first.first.items.some(i=>i.issues.includes('COVERAGE_TIME'))).toBe(true)
      expect(facts.tasks).toHaveLength(1);expect(canAct(first,facts.tasks[0].id)).toBe(false)
      await expect(confirmSemantic(repo,{draftId:draft.id,taskTempIds:[facts.tasks[0].id],revision:semanticRevision(loaded)})).rejects.toThrow()
      const rejected=await repo.load();expect(rejected.tasks).toEqual(before.tasks);expect(rejected.timePoints).toEqual(before.timePoints)
      expect(stateOfRuntime(rejected,draft.id).rawResponse).toEqual(first.rawResponse)
      return
    }
    const eligible=facts.tasks.filter(t=>t.semantics.validity==='active'&&t.condition.value!=='false')
    expect(eligible).toHaveLength(1)
    for(const m of facts.materials.filter(m=>m.relatedTaskTempIds.includes(eligible[0].id)))await reviewSemanticMaterial(repo,
      {draftId:draft.id,revision:semanticRevision(await repo.load()),operationId:crypto.randomUUID(),materialId:m.tempId,value:{required:m.required,status:'missing'}})
    await reviewSemanticFact(repo,{draftId:draft.id,taskId:eligible[0].id,revision:semanticRevision(await repo.load()),operationId:crypto.randomUUID()})
    await confirmSemantic(repo,{draftId:draft.id,taskTempIds:[eligible[0].id],revision:semanticRevision(await repo.load())})
    const saved=await repo.load();expect(saved.tasks.length).toBe(before.tasks.length+1)
    expect(saved.tasks.filter(t=>before.tasks.some(x=>x.id===t.id))).toEqual(before.tasks)
    expect(stateOfRuntime(saved,draft.id).first).toEqual(first.first)
    expect(stateOfRuntime(saved,draft.id).rawResponse).toEqual(first.rawResponse)
    expect(saved.timePoints).toEqual(before.timePoints);expect(saved.reminderRecords).toEqual(before.reminderRecords)
    await replayRecordedCandidate02(repo,record,identity)
    expect((await repo.load()).tasks).toEqual(saved.tasks)
    expect(await new CanonicalWorkspaceRepository(store).load()).toEqual(JSON.parse(JSON.stringify(saved)))
  },60000)
})

async function correctionReplay(unitId:string){
  const root='docs/recognition-optimization/mainline-real-input-01/runs/',D=root+'replay-a02-implementation-20260907a/'
  const binding=JSON.parse(readFileSync(root+'usage-resume-20260907a/STATE.json','utf8'))
  const prep=JSON.parse(readFileSync(binding.preparation.path,'utf8')),original=JSON.parse(readFileSync(binding.independentRepositoryRead.path,'utf8'))
  const store=Object.assign(new MemoryWorkspaceRecordStore(),{name:prep.name})
  await new CanonicalWorkspaceRepository(store).save(original.workspace)
  const repo=await SemanticRepository.open(prep.name,store,undefined,'real-input-01')
  const p=prep.preparations.find((x:{unitId:string})=>x.unitId===unitId),unit=binding.units.find((x:{unitId:string})=>x.unitId===unitId)
  const raw=JSON.parse(readFileSync(D+'BATCH_'+unitId+'_RAW.jsonl','utf8'))
  const record:RecordedBatch={version:'recorded-batch-1',unitId,name:prep.name,handle:p.handle,context:p.context,requestSha:unit.requestSha,responseSha:raw.responseSha,rawHttpText:raw.rawHttpText}
  try{await replayRecordedBatch(repo,record,{unitId,requestSha:unit.requestSha,responseSha:raw.responseSha})}catch(e){if(!String(e).includes('REJECTED_PRESERVED'))throw e}
  return {repo,store,draftId:p.handle.draftId as string}
}
describe('complex notice correction public API, original model answers remain immutable',()=>{
  it.each(['separate','batch'])('B01 event mismatch corrected explicitly; %s confirmation preserves two different deadlines',async mode=>{
    const {repo,store,draftId}=await correctionReplay('B01'),first=stateOfRuntime(await repo.load(),draftId),input=effectiveStateFacts(first).facts
    expect(input.tasks).toHaveLength(2);expect(first.first.items.every(t=>t.issues.includes('COVERAGE_EVENT'))).toBe(true)
    for(const task of input.tasks){
      const change:FactChange={kind:'event',taskId:task.id,value:{coverage:'not_stated',event:null},scopeIds:task.propositionScopeIds,note:'人工对照原文：说明提交和打印要求，没有独立活动事实。'}
      await correctSemanticFact(repo,{draftId,revision:semanticRevision(await repo.load()),operationId:crypto.randomUUID(),change})
      for(const m of input.materials.filter(m=>m.relatedTaskTempIds.includes(task.id)))await reviewSemanticMaterial(repo,{draftId,revision:semanticRevision(await repo.load()),operationId:crypto.randomUUID(),materialId:m.tempId,value:{required:true,status:'ready'}})
      await reviewSemanticFact(repo,{draftId,taskId:task.id,revision:semanticRevision(await repo.load()),operationId:crypto.randomUUID()})
      if(mode==='separate')await confirmSemantic(repo,{draftId,taskTempIds:[task.id],revision:semanticRevision(await repo.load())})
    }
    if(mode==='batch')await confirmSemantic(repo,{draftId,taskTempIds:input.tasks.map(t=>t.id),revision:semanticRevision(await repo.load())})
    const saved=await repo.load(),state=stateOfRuntime(saved,draftId)
    expect(saved.tasks).toHaveLength(2);expect(saved.timePoints.map(t=>t.rawText).sort()).toEqual(input.timePoints.map(t=>t.rawText).sort())
    expect(state.first).toEqual(first.first);expect(state.rawResponse).toEqual(first.rawResponse);expect(saved.reminderRecords).toEqual([])
    expect(await new CanonicalWorkspaceRepository(store).load()).toEqual(JSON.parse(JSON.stringify(saved)))
    const frozen=structuredClone(saved)
    await expect(correctSemanticFact(repo,{draftId,revision:semanticRevision(saved),operationId:crypto.randomUUID(),change:{kind:'condition',taskId:input.tasks[0].id,value:{value:'unknown',conditionScopeIds:input.tasks[0].propositionScopeIds,factScopeIds:[]},scopeIds:input.tasks[0].propositionScopeIds,note:'不能改动已确认内容'}})).rejects.toThrow('CONFIRMED')
    expect(await repo.load()).toEqual(frozen)
  },20000)
  it.each(['A08','B08'])('%s failed raw is retained, missing old task and revision can be explicitly corrected and new task saved',async unit=>{
    const {repo,store,draftId}=await correctionReplay(unit),failed=await repo.load(),draft=failed.extractionDrafts.find(d=>d.id===draftId)!,run=failed.recognitionRuns.find(r=>r.id===draft.recognitionRunId)!
    expect(draft.status).toBe('failed')
    await openFailedForCorrection(repo,draftId,semanticRevision(failed))
    const first=stateOfRuntime(await repo.load(),draftId),input=effectiveStateFacts(first).facts,newTask=input.tasks[0],scopes=first.context.index.scopes
    const scope=scopes.find(s=>s.text.includes('纸质报名表'))!
    const oldTask:SemanticTask={...structuredClone(newTask),id:'user-old-requirement',action:{scopeId:scope.id,surface:'打印'},object:{scopeId:scope.id,surface:'纸质报名表'},propositionScopeIds:[scope.id],effect:'physical_action',
      semantics:{...newTask.semantics,tense:'past',status:'cancelled',validity:'superseded'},detail:{...newTask.detail,title:'打印纸质报名表',description:'用户依据原文补充已作废要求',completionCriteria:[],materialTempIds:[],timePointTempIds:[]},coverage:{time:'not_stated',material:'not_stated',event:'not_stated'}}
    expect(canAct(first,newTask.id)).toBe(false)
    await correctSemanticFact(repo,{draftId,revision:semanticRevision(await repo.load()),operationId:crypto.randomUUID(),change:{kind:'revision',index:0,value:{addedTask:oldTask,relation:{type:'supersedes',targetDirectiveId:oldTask.id,fromDirectiveId:newTask.id,effective:'true',scopeIds:scopes.map(s=>s.id)}},scopeIds:scopes.map(s=>s.id),note:'旧打印要求已取消，现要求提交电子报名表；用户补充并核对对应关系。'}})
    const corrected=stateOfRuntime(await repo.load(),draftId)
    expect(canAct(corrected,oldTask.id)).toBe(false)
    for(const m of input.materials)await reviewSemanticMaterial(repo,{draftId,revision:semanticRevision(await repo.load()),operationId:crypto.randomUUID(),materialId:m.tempId,value:{required:true,status:'ready'}})
    await reviewSemanticFact(repo,{draftId,taskId:newTask.id,revision:semanticRevision(await repo.load()),operationId:crypto.randomUUID()})
    await confirmSemantic(repo,{draftId,taskTempIds:[newTask.id],revision:semanticRevision(await repo.load())})
    await disposeSemantic(repo,{draftId,taskTempIds:[oldTask.id],kind:'reject',revision:semanticRevision(await repo.load()),operationId:crypto.randomUUID()})
    const saved=await repo.load(),final=stateOfRuntime(saved,draftId)
    expect(saved.tasks.map(t=>t.title)).toEqual(['提交电子报名表']);expect(saved.timePoints).toEqual([])
    expect(saved.recognitionRuns.find(r=>r.id===run.id)).toEqual(run)
    expect(saved.extractionDrafts.find(d=>d.id===draftId)!.legacyData!.mainline05Failure).toEqual(draft.legacyData!.mainline05Failure)
    expect(final.rawResponse).toEqual(first.rawResponse);expect(final.first).toEqual(first.first);expect(life(final).accepted).toEqual([newTask.id])
    expect(effectiveStateFacts(final).facts.revisions[0].targetDirectiveId).toBe(oldTask.id)
    await validateSemanticWorkspace(JSON.parse(JSON.stringify(await new CanonicalWorkspaceRepository(store).load())),'real-input-01')
  },20000)
})
const resources={workerPath:'http://127.0.0.1:16627/real-input-assets/worker.min.js',corePath:'http://127.0.0.1:16627/real-input-assets/core/',
  langPath:'http://127.0.0.1:16627/real-input-assets/lang/',pdfWorkerPath:'http://127.0.0.1:16627/real-input-assets/pdf.worker.mjs'}
async function setup() {
  const name='rco-mainline-01-02-i1-real-input-acceptance-'+crypto.randomUUID(), store=Object.assign(new MemoryWorkspaceRecordStore(),{name})
  const seen=vi.fn(async(context:Parameters<ReturnType<typeof createModelClient>>[0])=>{
    const selected=cases.find(c=>notices[c]===context.index.sourceContent)
    if(!selected)throw Error('NO_SEEN_RESPONSE')
    const before=await repo.load()
    expect(before.recognitionRuns.at(-1)?.status).toBe('queued')
    expect(before.extractionDrafts.at(-1)?.result).toBeNull()
    return (await seenWire(selected,context.index)).rawHttpText
  })
  const runtime=await createRealInputRuntime({name,store,initial:emptyRealInputWorkspace(name,NOW),execution:'seen_engineering_replay',resources,execute:seen})
  const repo=await SemanticRepository.open(name,store,undefined,'real-input-01')
  return {name,store,runtime,repo,seen}
}
describe('real App runtime and public send connection; memory/SSR not browser acceptance',()=>{
  it('batch actual recorded responses retain raw and first suggestions, never default select, preserve A02 and reject identity substitution',async()=>{
    const root='docs/recognition-optimization/mainline-real-input-01/runs/',D=root+'replay-a02-implementation-20260907a/'
    const binding=JSON.parse(readFileSync(root+'usage-resume-20260907a/STATE.json','utf8'))
    const prep=JSON.parse(readFileSync(binding.preparation.path,'utf8')),original=JSON.parse(readFileSync(binding.independentRepositoryRead.path,'utf8'))
    const store=Object.assign(new MemoryWorkspaceRecordStore(),{name:prep.name})
    await new CanonicalWorkspaceRepository(store).save(original.workspace)
    const repo=await SemanticRepository.open(prep.name,store,undefined,'real-input-01')
    const execute=vi.fn(async()=>{throw Error('NO_NEW_REQUEST')})
    const runtime=await createRealInputRuntime({name:prep.name,store,execution:'live',recordedBatch:true,resources,execute})
    expect(renderToStaticMarkup(<App runtime={runtime}/>)).toContain('已记录真实模型批次')
    const a02=structuredClone(original.workspace.extractionDrafts.find((d:{id:string})=>d.id===recordedA02Identity.handle.draftId))
    let retainedValid=0,retainedRejected=0
    for(const unit of binding.units.slice(2)){
      const raw=JSON.parse(readFileSync(D+'BATCH_'+unit.unitId+'_RAW.jsonl','utf8'))
      const p=prep.preparations.find((p:{unitId:string})=>p.unitId===unit.unitId)
      const record:RecordedBatch={version:'recorded-batch-1',unitId:unit.unitId,name:prep.name,handle:p.handle,context:p.context,
        requestSha:unit.requestSha,responseSha:raw.responseSha,rawHttpText:raw.rawHttpText}
      const identity={unitId:unit.unitId,requestSha:unit.requestSha,responseSha:raw.responseSha},before=await repo.load()
      await expect(replayRecordedBatch(repo,{...record,rawHttpText:record.rawHttpText+' '},identity)).rejects.toThrow('IDENTITY')
      expect(await repo.load()).toEqual(before)
      const context={...p.context,authority:'live_model_candidate' as const,profile:'real-input-01' as const,ownershipMode:'mainline05-own-assets-1' as const}
      const actual=await composeSemantics(parseModelEnvelope(raw.rawHttpText,context).adaptedResponse,context)
      // The frozen contract rejects dangling references. Such actual model outputs
      // are negative controls, not valid drafts or repaired reference answers.
      if(actual.issues.some(i=>['BAD_ENTITY_REFERENCE','BAD_REVISION_REFERENCE'].includes(i.code))){
        await expect(replayRecordedBatch(repo,record,identity)).rejects.toThrow('REJECTED_PRESERVED')
        const failed=await repo.load(),draft=failed.extractionDrafts.find(d=>d.id===p.handle.draftId)!
        expect(draft.status).toBe('failed');expect(draft.result).toBeNull()
        expect(draft.legacyData?.mainline05Failure).toMatchObject({response:record.rawHttpText})
        expect(failed.tasks).toHaveLength(0);expect(failed.extractionDrafts.find(d=>d.id===a02.id)).toEqual(a02)
        await expect(replayRecordedBatch(repo,record,identity)).rejects.toThrow('REJECTED_PRESERVED')
        expect(await repo.load()).toEqual(failed);retainedRejected++;continue
      }
      const saved=await replayRecordedBatch(repo,record,identity),state=stateOfRuntime(saved,p.handle.draftId)
      if(state.version!==REAL_STATE_VERSION)throw Error('EXPECTED_REAL_STATE')
      expect(state.rawHttpText).toBe(raw.rawHttpText);expect(state.context.authority).toBe('live_model_candidate')
      expect(state.first.items.every(i=>!i.defaultSelected)).toBe(true);expect(saved.tasks).toHaveLength(0)
      expect(saved.extractionDrafts.find(d=>d.id===a02.id)).toEqual(a02)
      expect(await replayRecordedBatch(repo,record,identity)).toEqual(saved)
      retainedValid++
    }
    expect(retainedValid).toBe(12);expect(retainedRejected).toBe(2)
    const p=prep.preparations.find((p:{unitId:string})=>p.unitId==='B02'),draftId=p.handle.draftId
    const first=stateOfRuntime(await repo.load(),draftId),facts=effectiveStateFacts(first).facts,task=facts.tasks[0]
    for(const material of facts.materials)await reviewSemanticMaterial(repo,{draftId,materialId:material.tempId,
      revision:semanticRevision(await repo.load()),operationId:'batch-material-'+material.tempId,value:{required:true,status:'ready'}})
    await reviewSemanticFact(repo,{draftId,taskId:task.id,revision:semanticRevision(await repo.load()),operationId:'batch-fact'})
    const saved=await runtime.confirm({draftId,taskTempIds:[task.id],revision:semanticRevision(await repo.load())})
    expect(saved.tasks).toHaveLength(1);expect(saved.timePoints).toEqual([]);expect(saved.reminderRecords).toEqual([])
    expect(stateOfRuntime(saved,draftId).first).toEqual(first.first);expect(execute).not.toHaveBeenCalled()
    expect(JSON.parse(await runtime.exportJson())).toEqual(JSON.parse(JSON.stringify(await new CanonicalWorkspaceRepository(store).load())))
  },30000) // Fourteen full-graph recorded replays; no historical timeout or assertion changes.
  it('real-input source description changes only the review banner; engineering and ordinary defaults remain',async()=>{
    const {repo,runtime,seen}=await setup(), receipt=await acquireText('label-control',notices['no-date'])
    const source=await repo.saveReading(receipt,'已见工程通知','label-control',NOW)
    const draftId=await sendRealInput(repo,{sourceId:source.sourceId,pages:[1],reviewed:[1],operationId:'label-control',revision:semanticRevision(await repo.load())},'seen_engineering_replay',seen,NOW)
    const workspace=await repo.load(), draft=runtime.review(workspace,draftId).draft
    const noop=()=>{}
    const props:ComponentProps<typeof DraftReviewPanel>={draft,source:null,isolatedCapabilities:true,projectWillCreate:false,projects:[],
      onClose:noop,onUpdate:noop,onConfirm:noop,onReject:noop,onConfirmAll:noop,onProjectChoice:noop,onKeepExplicit:noop,onMoveTask:noop,
      onToggleRecognitionEntity:noop,onToggleTaskSelected:noop,onSplitTask:noop,onMergeTask:noop}
    const normal=renderToStaticMarkup(<DraftReviewPanel {...props}/>), withoutBanner=(html:string)=>html.replace(/第 2 步 · [^<]*<\/span>/,'SOURCE_LABEL</span>')
    expect(normal).toContain('人工工程响应（非模型预测）')
    for(const description of ['A02历史真实模型响应回放 · 本轮零调用','真实模型建议 · 尚未逐项核对','已见匿名工程回放 · 非模型预测']){
      const html=renderToStaticMarkup(<DraftReviewPanel {...props} {...{recognitionDescription:description}}/>)
      expect(html).toContain(description);expect(withoutBanner(html)).toBe(withoutBanner(normal))
    }
    expect(renderToStaticMarkup(<DraftReviewPanel {...props} isolatedCapabilities={false} draft={{...draft,modelName:'deepseek-v4-flash'}}/>)).toContain('第 2 步 · DeepSeek 建议')
    expect(renderToStaticMarkup(<DraftReviewPanel {...props} isolatedCapabilities={false} draft={{...draft,modelName:'local'}}/>)).toContain('第 2 步 · 本地规则建议')
    expect(await repo.load()).toEqual(workspace)
  })
  it('actual App forwards an existing description only for the real-input runtime',()=>{
    const probe=spawnSync(process.execPath,['--input-type=module','-e',`
      import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';import {runInNewContext} from 'node:vm';
      const source=readFileSync('src/App.tsx','utf8'),tree=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
      let attribute;const visit=n=>{if((ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n))&&n.tagName.getText(tree)==='DraftReviewPanel')attribute=n.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(tree)==='recognitionDescription');ts.forEachChild(n,visit)};visit(tree);
      assert(attribute?.initializer&&ts.isJsxExpression(attribute.initializer),'real App must pass the existing source description');
      const code=ts.transpileModule('('+attribute.initializer.expression.getText(tree)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
      for(const description of ['A02历史真实模型响应回放 · 本轮零调用','已见匿名工程回放 · 非模型预测'])assert.equal(runInNewContext(code,{runtime:{realInput:{profile:'real-input-01'},recognitionDescription:description}}),description);
      assert.equal(runInNewContext(code,{runtime:{recognitionDescription:'legacy-isolated'}}),undefined);
      assert.equal(runInNewContext(code,{runtime:undefined}),undefined);
    `],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024})
    expect(probe.status,probe.stdout+'\\n'+probe.stderr).toBe(0)
  })
  it('actual browser open wrapper rejects creation/upgrade events before legacy handlers, retains existing and old-default opens',()=>{
    const probe=spawnSync(process.execPath,['--input-type=module','-e',`
      import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';import {runInNewContext} from 'node:vm';
      const source=readFileSync('src/experiments/realInput01/browser.tsx','utf8'), tree=ts.createSourceFile('browser.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
      const assignment=tree.statements.find(s=>ts.isExpressionStatement(s)&&ts.isBinaryExpression(s.expression)&&s.expression.left.getText(tree)==='indexedDB.open');
      assert(assignment,'real wrapper must exist; no replacement test algorithm');
      const helper=tree.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='preventRecordedDatabaseUpgrade');
      const code=ts.transpileModule((helper?helper.getText(tree).replace(/^export\\s+/,''):'')+'\\n'+assignment.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
      const name='original-test-db';
      const harness=mode=>{
        let aborts=0,creates=0,opens=0;const req=new EventTarget();
        req.transaction={abort(){aborts++}};
        const indexedDB={},effects={databaseOpens:[],foreignDatabase:0,blockedDatabaseUpgrades:0};
        runInNewContext(code,{indexedDB,name,effects,config:{mode},nativeOpen(){opens++;return req}});
        return {indexedDB,req,effects,get counts(){return {aborts,creates,opens}},legacy(){req.addEventListener('upgradeneeded',()=>{creates++})}};
      };
      for(const oldVersion of [0,1]){
        const h=harness('recorded_a02');assert.equal(h.indexedDB.open(name,1),h.req);h.legacy();
        const event=new Event('upgradeneeded');Object.assign(event,{oldVersion,newVersion:oldVersion+1});h.req.dispatchEvent(event);
        assert.equal(h.counts.aborts,1,'upgrade transaction must abort');assert.equal(h.counts.creates,0,'legacy createObjectStore callback must not run');
      }
      const existing=harness('recorded_a02');assert.equal(existing.indexedDB.open(name,1),existing.req);existing.req.dispatchEvent(new Event('success'));
      assert.deepEqual(existing.counts,{aborts:0,creates:0,opens:1});
      assert.throws(()=>existing.indexedDB.open(name,2),/VERSION/);assert.throws(()=>existing.indexedDB.open('foreign',1),/FOREIGN/);
      assert.equal(existing.counts.opens,1);
      const old=harness('seen_engineering_replay');old.indexedDB.open(name,1);old.legacy();old.req.dispatchEvent(new Event('upgradeneeded'));
      assert.deepEqual(old.counts,{aborts:0,creates:1,opens:1});
      console.log('real wrapper EventTarget contract: missing/upgrade abort, existing success, version/foreign reject, old default retained; not real IndexedDB engine acceptance');
    `],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024})
    expect(probe.status,probe.stdout+'\n'+probe.stderr).toBe(0)
  })
  it('original A02 real App driver preserves provenance, material observation and explicit edits through independent reload',async()=>{
    const root='docs/recognition-optimization/mainline-real-input-01/runs/'
    const state=JSON.parse(readFileSync(root+'usage-resume-20260907a/STATE.json','utf8'))
    const bound=(path:string,sha:string)=>{const bytes=readFileSync(path);expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha);return JSON.parse(bytes.toString())}
    const preparation=bound(state.preparation.path,state.preparation.sha256), original=bound(state.independentRepositoryRead.path,state.independentRepositoryRead.sha256)
    const a02=preparation.preparations.find((p:{unitId:string})=>p.unitId==='A02')
    const raw=JSON.parse(readFileSync(root+'recovery-a02-20260907a/RAW_RESULTS.jsonl','utf8'))
    const record:RecordedA02={version:'recorded-a02-1',name:preparation.name,handle:a02.handle,context:a02.context,requestSha:raw.requestSha,responseSha:raw.responseSha,rawHttpText:raw.rawHttpText}
    const store=Object.assign(new MemoryWorkspaceRecordStore(),{name:record.name})
    await new CanonicalWorkspaceRepository(store).save(original.workspace)
    const execute=vi.fn(async()=>{throw Error('NEW_MODEL_REQUEST_FORBIDDEN')})
    const runtime=await createRealInputRuntime({name:record.name,store,execution:'live',recordedA02:true,resources,execute})
    const repo=await SemanticRepository.open(record.name,store,undefined,'real-input-01')
    const app=renderToStaticMarkup(<App runtime={runtime}/>);expect(app).toContain('禁止新发送')
    const pending=await replayRecordedA02(repo,record),first=stateOfRuntime(pending,record.handle.draftId)
    expect(first.context.authority).toBe('live_model_candidate');expect(first.first.items.every(i=>!i.defaultSelected)).toBe(true)
    const facts=effectiveStateFacts(first).facts,task=facts.tasks[0],material=facts.materials[0],draftId=record.handle.draftId
    const summary=renderToStaticMarkup(<SemanticFacts state={first} taskId={task.id}/>)
    expect(summary).toContain('没有截止日期要求');expect(summary).toContain('用户尚未核对');expect(summary).not.toContain('必须提供')
    const Panel=runtime.realInput!.inputPanel
    expect(renderToStaticMarkup(<Panel workspace={pending} initialText="" onSaved={async()=>{}} onDraftReady={async()=>{}}/>)).toContain('已关闭新录入和发送')
    await expect(runtime.capture({sourceType:'text',content:'禁止新来源'})).rejects.toThrow()
    await expect(runtime.confirm({draftId,taskTempIds:[task.id],revision:semanticRevision(pending)})).rejects.toThrow()
    expect(await repo.load()).toEqual(pending)
    await reviewSemanticMaterial(repo,{draftId,materialId:material.tempId,revision:semanticRevision(pending),operationId:'a02-material-observed',value:{required:true,status:'ready'}})
    const checked=await repo.load(),onDirty=vi.fn(),onSaved=vi.fn(async()=>{})
    renderToStaticMarkup(<FactCorrectionEditor repo={repo} workspace={checked} draftId={draftId} taskId={task.id} busy={false} onDirty={onDirty} onSaved={onSaved}/>)
    expect(onDirty).not.toHaveBeenCalled();expect(onSaved).not.toHaveBeenCalled();expect(await repo.load()).toEqual(checked)
    await editSemantic(repo,{draftId,taskTempId:task.id,revision:semanticRevision(checked),operationId:'a02-user-title',field:'title',value:'保存活动手册（已核对）'})
    await reviewSemanticFact(repo,{draftId,taskId:task.id,revision:semanticRevision(await repo.load()),operationId:'a02-task-reviewed'})
    const result=await runtime.confirm({draftId,taskTempIds:[task.id],revision:semanticRevision(await repo.load())})
    expect(result.tasks).toHaveLength(1);expect(result.tasks[0].title).toBe('保存活动手册（已核对）')
    expect(result.materials[0]).toMatchObject({required:true,status:'ready'})
    expect(result.timePoints).toEqual([]);expect(result.reminderRecords).toEqual([])
    expect(buildBrowserReminderJobs(runtime.view(result).tasks,new Date(NOW))).toEqual([])
    expect(result.sourceVersions).toEqual(pending.sourceVersions)
    // Confirmation legitimately advances only the matched Source lifecycle.
    const confirmedSource=result.sources.find(s=>s.id===record.handle.sourceId)!
    expect(confirmedSource.status).toBe('confirmed')
    expect(result.sources).toEqual(pending.sources.map(s=>s.id===confirmedSource.id
      ?{...s,status:'confirmed',updatedAt:confirmedSource.updatedAt}:s))
    const final=stateOfRuntime(result,draftId);expect(final.rawResponse).toEqual(first.rawResponse);expect(final.first).toEqual(first.first)
    expect(final.version===REAL_STATE_VERSION&&final.rawHttpText).toBe(record.rawHttpText)
    const independent=await SemanticRepository.open(record.name,store,undefined,'real-input-01')
    expect(JSON.parse(await runtime.exportJson())).toEqual(JSON.parse(JSON.stringify(await independent.load())))
    expect(await replayRecordedA02(repo,record)).toEqual(result)
    expect((await runtime.confirm({draftId,taskTempIds:[task.id],revision:semanticRevision(result)})).tasks).toEqual(result.tasks)
    expect(execute).not.toHaveBeenCalled()
  })
  it('recorded runtime rejects replacement database initialization and missing original storage',async()=>{
    const name=recordedA02Identity.name,store=Object.assign(new MemoryWorkspaceRecordStore(),{name}),execute=vi.fn(async()=>{throw Error('FORBIDDEN')})
    await expect(createRealInputRuntime({name,store,initial:emptyRealInputWorkspace(name),execution:'live',recordedA02:true,resources,execute})).rejects.toThrow('RECORDED_RUNTIME')
    await expect(createRealInputRuntime({name,store,execution:'live',recordedA02:true,resources,execute})).rejects.toThrow('WORKSPACE_MISSING')
    expect(execute).not.toHaveBeenCalled()
  })
  it('recorded launcher builds real App, serves only bound A02 and rejects unauthorized endpoints without model code',()=>{
    // A Node subprocess builds the actual launcher and exercises its real request
    // listener without opening a port, loading credentials or accessing a browser DB.
    const probe=spawnSync(process.execPath,['--input-type=module','-e',`
      import assert from 'node:assert/strict'; import {Readable} from 'node:stream';
      import {readFileSync} from 'node:fs'; import {createLocalApp,loadRecordedA02} from './scripts/serve-mainline-real-input-01.mjs';
      const carrierManifest='C:/Users/Winner/AppData/Local/Temp/real-input-carriers-e1da8dbf1e8a4f5a9732c02f6469c24f/carriers.json';
      const app=await createLocalApp({port:6631,carrierManifest,checking:true,recordedA02:true});
      assert.equal(app.evidence.mode,'recorded_a02');assert.equal(app.evidence.upstreamEnabled,false);assert.deepEqual(app.evidence.forbiddenBrowserInputs,[]);
      assert(!app.evidence.bundleInputs.some(p=>/real-input-budget|real-input-model-gateway|run-mainline-real-input/.test(p)));
      const call=(method,url,data='',extra={})=>new Promise(resolve=>{
        const req=Object.assign(Readable.from([Buffer.from(data)]),{method,url,headers:{host:'127.0.0.1:6631',...extra}});
        const headers={};let status=200;app.server.emit('request',req,{setHeader:(k,v)=>headers[k]=v,writeHead:v=>status=v,end:body=>resolve({status,body:String(body),headers})});
      });
      const js=await call('GET','/browser.js');assert.equal(js.status,200);
      const capability=js.body.match(/"?capability"?:\\s*"([a-f0-9]{64})"/)[1];
      const headers={origin:'http://127.0.0.1:6631','sec-fetch-site':'same-origin','content-type':'application/json','x-real-input-capability':capability};
      const record=loadRecordedA02(),payload=JSON.stringify({unitId:'A02',requestSha:record.requestSha});
      const valid=await call('POST','/api/real-input/recorded-a02',payload,headers);assert.equal(valid.status,200);assert.deepEqual(JSON.parse(valid.body),record);
      for(const [path,body,h]of [
        ['/api/real-input/replay',payload,headers],['/api/real-input/model',payload,headers],
        ['/api/real-input/recorded-a02',payload,{...headers,origin:'http://other.invalid'}],
        ['/api/real-input/recorded-a02',payload,{...headers,'x-real-input-capability':'wrong'}],
        ['/api/real-input/recorded-a02',JSON.stringify({unitId:'A01',requestSha:record.requestSha}),headers],
        ['/api/real-input/recorded-a02',JSON.stringify({unitId:'A02',requestSha:'0'.repeat(64)}),headers],
        ['/api/real-input/recorded-a02',JSON.stringify({unitId:'A02',requestSha:record.requestSha,rawHttpText:'replacement'}),headers]
      ])assert.equal((await call('POST',path,body,h)).status,400);
      assert.equal((await call('GET','/.env')).status,400);
      assert.equal((await call('POST','/api/real-input/recorded-a02',payload,headers)).body,valid.body);
      await assert.rejects(createLocalApp({port:6632,carrierManifest,checking:true,recordedA02:true}),/RECORDED_ORIGIN/);
      const source=readFileSync('scripts/serve-mainline-real-input-01.mjs','utf8');
      assert(!/readFileSync\\([^)]*\\.env|import[^\\n]*real-input-(?:budget|model-gateway)/.test(source));
      console.log('recorded launcher: build + bound response + 9 rejection/identity checks; zero external requests');
    `],{encoding:'utf8',timeout:60000,maxBuffer:1024*1024})
    expect(probe.error?.message??'').toBe('')
    expect(probe.status,probe.stdout+'\n'+probe.stderr).toBe(0)
  },65000)
  it('the input renderer is a React component retaining original text without invoking save callbacks during render',async()=>{
    const {runtime,repo,seen}=await setup(),Panel=runtime.realInput!.inputPanel
    const before=await repo.load(),onSaved=vi.fn(async()=>{}),onDraftReady=vi.fn(async()=>{})
    const initialText='  '+notices['no-date']+'  '
    const html=renderToStaticMarkup(<Panel workspace={before} initialText={initialText} onSaved={onSaved} onDraftReady={onDraftReady}/>)
    expect(html).toContain(initialText);expect(html).toContain('保存文字来源并核对')
    expect(onSaved).not.toHaveBeenCalled();expect(onDraftReady).not.toHaveBeenCalled();expect(seen).not.toHaveBeenCalled()
    expect(await repo.load()).toEqual(before)
  })
  it('the fact editor render preserves saved facts and does not publish dirty or saved notifications during render',async()=>{
    const {repo,seen}=await setup(),receipt=await acquireText('editor-render',notices['no-date'])
    const source=await repo.saveReading(receipt,'已见工程通知','editor-render-source',NOW)
    const draftId=await sendRealInput(repo,{sourceId:source.sourceId,pages:[1],reviewed:[1],operationId:'editor-render-send',revision:semanticRevision(await repo.load())},'seen_engineering_replay',seen,NOW)
    const before=await repo.load(),onDirty=vi.fn(),onSaved=vi.fn(async()=>{})
    const html=renderToStaticMarkup(<FactCorrectionEditor repo={repo} workspace={before} draftId={draftId} taskId="save" busy={false} onDirty={onDirty} onSaved={onSaved}/>)
    expect(html).toContain('本项事实已核对');expect(html).toContain('修改对象')
    expect(onDirty).not.toHaveBeenCalled();expect(onSaved).not.toHaveBeenCalled()
    expect(await repo.load()).toEqual(before)
  })
  it('real homepage retains dates and explains review before any send; old presentation remains',()=>{
    const props={dateViews:{},tasks:[],projects:[],pendingReviewCount:0,onQuickCapture:async()=>{},onOpenIntake:()=>{},onOpenTask:()=>{},
      onCompleteTask:()=>{},onStartTask:()=>{},onSnoozeTask:()=>{},onTogglePinTask:()=>{},onShowTasks:()=>{},onShowInbox:()=>{},smartExtractionStatus:'unavailable' as const}
    const real=renderToStaticMarkup(<DashboardPage {...props} realInput={{networkDescription:'只有核对并同意本次发送后才调用模型'}}/>)
    expect(real).toContain('先核对输入文字');expect(real).toContain('只有核对并同意本次发送后才调用模型')
    expect(real).not.toContain('不发送文字、不调用模型');expect(real).not.toContain('生成工程建议')
    const old=renderToStaticMarkup(<DashboardPage {...props}/>);expect(old).toContain('生成工程建议');expect(old).toContain('不发送文字、不调用模型')
  })
  it('mounts the actual App with isolated capabilities and does not read old storage',async()=>{
    const {runtime}=await setup(), legacy=vi.fn(()=>{throw Error('LEGACY_FORBIDDEN')})
    vi.stubGlobal('localStorage',{getItem:legacy,setItem:legacy})
    try{const html=renderToStaticMarkup(<App runtime={runtime}/>);expect(html).toContain('事务管家');expect(html).toContain('本机读取与已见工程回放');expect(legacy).not.toHaveBeenCalled()}
    finally{vi.unstubAllGlobals()}
    expect(runtime.realInput?.profile).toBe('real-input-01')
    await expect(runtime.capture({sourceType:'text',content:notices['no-date']})).rejects.toThrow('先在真实输入面板保存')
  })
  it.each(['no-date','multi','condition-true','revision'] as const)('source-first to correct confirmation and independent reload: %s',async kind=>{
    const {repo,runtime,store,name,seen}=await setup(), receipt=await acquireText(kind,notices[kind])
    const source=await repo.saveReading(receipt,'已见工程通知','source-'+kind,NOW)
    const draftId=await sendRealInput(repo,{sourceId:source.sourceId,pages:[1],reviewed:[1],operationId:'send-'+kind,revision:semanticRevision(await repo.load())},'seen_engineering_replay',seen,NOW)
    const first=stateOfRuntime(await repo.load(),draftId)
    const ids=kind==='no-date'?['save']:kind==='multi'?['submit','print']:kind==='revision'?['new']:['conditional']
    // IDs come from the existing engineering response; no Expected enters the driver.
    const actual=first.first.items.filter(i=>i.requiresAction==='true'&&!i.issues.length).map(i=>i.tempId)
    expect(actual.length).toBe(ids.length)
    for(const id of actual)await reviewSemanticFact(repo,{draftId,taskId:id,revision:semanticRevision(await repo.load()),operationId:'review-'+id})
    const final=await runtime.confirm({draftId,taskTempIds:actual,revision:semanticRevision(await repo.load())})
    expect(final.tasks).toHaveLength(actual.length);expect(seen).toHaveBeenCalledTimes(1)
    const independent=await SemanticRepository.open(name,store,undefined,'real-input-01')
    expect(JSON.parse(await runtime.exportJson())).toEqual(JSON.parse(JSON.stringify(await independent.load())))
    expect(stateOfRuntime(final,draftId).first).toEqual(first.first)
    if(kind==='no-date'){expect(final.timePoints).toEqual([]);expect(final.reminderRecords).toEqual([])}
  })
  it('a failed executor is terminal, no retry; missing or malformed database never falls back',async()=>{
    const {repo,name,store}=await setup(), receipt=await acquireText('failed',notices['no-date'])
    const source=await repo.saveReading(receipt,'失败对照','failure-source')
    const execute=vi.fn(async()=>{throw Error('simulated transport failure')})
    await expect(sendRealInput(repo,{sourceId:source.sourceId,pages:[1],reviewed:[1],operationId:'failure-run',revision:semanticRevision(await repo.load())},'seen_engineering_replay',execute,NOW)).rejects.toThrow('没有自动重试')
    expect(execute).toHaveBeenCalledTimes(1); expect((await repo.load()).recognitionRuns[0].status).toBe('failed')
    await expect(createRealInputRuntime({name,store:Object.assign(new MemoryWorkspaceRecordStore(),{name}),execution:'seen_engineering_replay',resources,execute})).rejects.toThrow('WORKSPACE_MISSING')
    await store.write('current',{});await expect(repo.load()).rejects.toThrow()
  })
  it('client sends exactly the bound text request once, then refuses duplicate or changed input',async()=>{
    const {repo}=await setup(),receipt=await acquireText('client',notices['no-date']), source=await repo.saveReading(receipt,'client','client-source')
    const handle=await repo.beginInputRun(source.sourceId,{version:REAL_STATE_VERSION,inputReceipt:receipt,sendSnapshot:await makeSendSnapshot(receipt,[1],[1],NOW)},
      'seen_engineering_replay','client-unit',semanticRevision(await repo.load()))
    const context=await inputRunContext(repo,handle),request=await buildModelRequest(context),requestSha=await sha256Text(request.serialized)
    const raw=(await seenWire('no-date',handle)).rawHttpText
    const transport=vi.fn(async()=>new Response(JSON.stringify({unitId:'A01',requestSha,rawHttpText:raw}),{status:200,headers:{'content-type':'application/json'}}))
    const client=createModelClient({origin:'http://127.0.0.1:16627',capability:'a'.repeat(64),units:[{unitId:'A01',requestSha}]},transport)
    await dispatchRealInput(repo,handle,client)
    expect(transport).toHaveBeenCalledTimes(1)
    await expect(client(context)).rejects.toThrow('未绑定')
    await expect(dispatchRealInput(repo,handle,client)).rejects.toThrow('NOT_DISPATCHABLE')
    expect(transport).toHaveBeenCalledTimes(1)
  })
})
