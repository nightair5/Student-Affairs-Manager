import {describe,it,expect} from 'vitest'
import {createObligationFixture} from '../../experiments/candidate19Recorded/obligationFixtures'
import {roleEnvelope,toRoleFixture} from '../../experiments/candidate19Recorded/roleFixtures'
import {decodeRoleProductRecording} from '../../recognition/sourceContractV7'
import {assembleCurrentFirstSuggestion} from '../../recognition/materialChannelGrounding'
import {sourceWindowsFromSidecar} from '../../recognition/sourceWindowGrounding'
import {validateRecognitionResult} from '../../recognition/schema'
import {emptyWorkspace} from '../../experiments/mainline01/fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {IndexedDbWorkspaceRepository} from '../../lib/repository'
import {workspaceSnapshotHash} from './migration'
import {applySourceReadiness,currentReadinessFlags,sourceReadinessGroups,sourceReadinessValue,type ReadinessInput} from './sourceReadiness'
import {buildSourceReviewPlan,commitSourceReview,verifySourceReviewReadback} from './sourceReviewD26'
import {D20ReviewSessionRepository} from '../../experiments/candidate16/d20ReviewSession'
import {createOrdinaryMeasurement} from './ordinaryMeasurementD26'
import {buildPersonalPlan,defaultPlanOptions} from './personalPlanD27'
import type {JsonValue} from './types'

async function fixture(kind:'shared-window'|'equipment'='shared-window'){
  const f=await createObligationFixture(kind),facts=toRoleFixture(f.facts)
  if(kind==='shared-window')for(const task of facts.tasks)task.condition={value:'unknown',conditionScopeIds:[],factScopeIds:[]}
  const raw=roleEnvelope(facts),decoded=decodeRoleProductRecording(raw,f.context,'EngineeringFixture',true,true)
  const first=assembleCurrentFirstSuggestion(decoded.result,{sourceText:f.sourceText,...f.context,sourceWindows:sourceWindowsFromSidecar(decoded.sidecar)}).result
  expect(validateRecognitionResult(first).valid).toBe(true)
  const store=Object.assign(new MemoryWorkspaceRecordStore(),{name:'rco-mainline-01-02-i1-d27-plan-readiness-test'}),repo=new CanonicalWorkspaceRepository(store)
  await repo.initialize(emptyWorkspace())
  const capture=new CapturePersistenceService(repo),handle=await capture.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',title:'匿名条件通知',rawText:f.sourceText,provider:'manual',modelName:'ENGINEERING_FIXTURE',promptVersion:'fixture',pipelineVersion:'readiness-test'})
  await capture.recognize(handle,async()=>first)
  await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>d.id===handle.draftId?{...d,legacyData:{...d.legacyData,semanticSidecar:JSON.parse(JSON.stringify(decoded.sidecar)),firstSuggestionDisplayed:JSON.parse(JSON.stringify(first)),originalResponse:raw}}:d)}))
  const viewRepo=new IndexedDbWorkspaceRepository(repo),measurement=createOrdinaryMeasurement(store),session=new D20ReviewSessionRepository(store,measurement.changed,measurement.activity,true)
  const state=async()=>({w:(await repo.load())!,draft:(await viewRepo.load())!.drafts[0]})
  const initial=await state(),group=sourceReadinessGroups(initial.w,handle.draftId)[0]
  const input:ReadinessInput={groupId:group.id,choice:kind==='equipment'?'meets_stated_condition':'no_extra_condition',expectedResult:workspaceSnapshotHash(initial.w.extractionDrafts[0].result),operationId:crypto.randomUUID()}
  const apply=()=>repo.transaction(w=>applySourceReadiness(w,handle.draftId,input))
  return {f,raw,decoded,store,repo,capture,handle,viewRepo,measurement,session,state,initial,group,input,apply}
}

describe('ordinary source-level user judgement, with unchanged model first answer',()=>{
  it('one shared explicit judgement enables two existing duties, with real checkpoint/commit/readback and distinct semantic audit',async()=>{
    const x=await fixture(),id=x.handle.draftId,key=`task:readiness-${x.group.id}:facts`
    expect(x.group.taskIds).toHaveLength(2)
    expect(x.initial.w.extractionDrafts[0].result!.conflicts[0].message).toContain('没有给出条件依据')
    expect(()=>buildSourceReviewPlan(x.initial.w,x.initial.draft,x.initial.draft.items[0].id)).toThrow('适用状态')
    expect(x.initial.w.tasks).toHaveLength(0)
    await x.measurement.begin(id)
    const staged=await x.session.stage(x.initial.w,id,key,{value:'unknown'},x.input,x.session.writer,true),field=staged.fields[key]
    await x.session.withFreshField(x.initial.w,id,key,x.session.writer,field.revision,x.input,x.apply)
    await x.session.clear(x.initial.w,id,key,x.session.writer,field.revision)
    const current=await x.state()
    expect(sourceReadinessGroups(current.w,id)[0].resolved).toBe(true)
    expect(current.w.tasks).toHaveLength(0)
    expect(current.w.extractionDrafts[0].legacyData?.firstSuggestionDisplayed).toEqual(x.initial.w.extractionDrafts[0].legacyData?.firstSuggestionDisplayed)
    expect(current.w.extractionDrafts[0].legacyData?.originalResponse).toBe(x.raw)
    expect(current.w.extractionDrafts[0].result!.conflicts).toHaveLength(0)
    expect(current.w.extractionDrafts[0].result!.quality.reviewReasons).toHaveLength(0)
    const sourceFlags=[...x.initial.w.extractionDrafts[0].result!.quality.reviewReasons,'PDF仅部分提取']
    expect(currentReadinessFlags(current.w,id,sourceFlags)).toEqual(['PDF仅部分提取'])
    expect(currentReadinessFlags(x.initial.w,id,sourceFlags)).toEqual(sourceFlags)
    const receipt=await commitSourceReview(x.repo,buildSourceReviewPlan(current.w,current.draft))
    const read=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(x.store),receipt)
    expect(read.tasks).toHaveLength(2);expect(read.projects).toHaveLength(0)
    expect(read.timePoints.map(p=>p.normalizedValue).sort()).toEqual(['2026-11-10T09:00','2026-11-12T17:00'])
    expect(read.timePoints.every(p=>p.type!=='task_deadline')).toBe(true)
    const checkpoint=await x.session.load(read,id)
    await x.measurement.committed(receipt,checkpoint,read);await x.measurement.readback(receipt)
    const commit=(await x.measurement.events(id)).find(e=>e.kind==='commit')!
    expect(commit.includedEditIds).toHaveLength(1)
    expect(commit.semanticFields).toHaveLength(2)
    expect(commit.semanticFields!.every(s=>s.endsWith('qualification-user-input'))).toBe(true)
    expect((await x.measurement.report(id,checkpoint)).humanMetrics).toBe('NOT_OBSERVABLE')
  })

  it('keeps a real condition, unknown end and predecessor waiting; user qualification is not predecessor completion',async()=>{
    const x=await fixture('equipment')
    expect(x.group.ruleQuotes[0]).toContain('若已获')
    expect(x.initial.w.extractionDrafts[0].result!.conflicts[0].message).toContain('资格尚未确认')
    expect(()=>applySourceReadiness(x.initial.w,x.handle.draftId,{...x.input,choice:'no_extra_condition'})).toThrow('CHOICE_MISMATCH')
    await x.apply();const current=await x.state(),id=x.group.taskIds[0]
    expect(sourceReadinessValue(current.w,x.handle.draftId,id)).toBe('true')
    const receipt=await commitSourceReview(x.repo,buildSourceReviewPlan(current.w,current.draft))
    const read=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(x.store),receipt)
    expect(read.timePoints.find(p=>p.type==='event_end')).toMatchObject({normalizedValue:null,rawText:'结束时间尚未公布'})
    expect(read.tasks[0].status).toBe('todo')
    const originalTask=read.tasks[0],dependent={...structuredClone(originalTask),id:'wait-install',title:'安装会议软件',dependencyIds:[originalTask.id]}
    read.tasks.push(dependent)
    const plan=buildPersonalPlan(read,{...defaultPlanOptions(new Date('2026-11-17T00:00:00Z')),days:2})
    expect(plan.unscheduled.every(r=>r.code!=='QUALIFICATION_UNKNOWN')).toBe(true)
    expect(plan.segments.find(s=>s.taskId==='wait-install')?.conditionalOn).toEqual([originalTask.id])
    expect(read.tasks.every(t=>t.status==='todo')).toBe(true)
  })

  it('never clears an unrelated wrong owner/relation; valid item still saves partially',async()=>{
    const x=await fixture(),bad=x.group.taskIds[1]
    await x.repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>({...d,result:{...d.result!,conflicts:[...d.result!.conflicts,{id:'wrong-owner',type:'other',message:'关联到另一个对象',entityTempIds:[bad],evidenceIds:[],requiresDecision:true}]}}))}))
    x.input.expectedResult=workspaceSnapshotHash((await x.repo.load())!.extractionDrafts[0].result)
    await x.apply();const current=await x.state()
    expect(current.w.extractionDrafts[0].result!.conflicts.map(c=>c.id)).toContain('wrong-owner')
    expect(()=>buildSourceReviewPlan(current.w,current.draft,current.draft.items[1].id)).toThrow('另一个对象')
    const receipt=await commitSourceReview(x.repo,buildSourceReviewPlan(current.w,current.draft,current.draft.items[0].id))
    expect(receipt.disposition).toBe('partial')
    expect((await verifySourceReviewReadback(new CanonicalWorkspaceRepository(x.store),receipt)).tasks).toHaveLength(1)
  })

  it('blocks stale CAS, changed source, duplicate operation with changed meaning, and forged unattested metadata',async()=>{
    const x=await fixture()
    expect(()=>applySourceReadiness(x.initial.w,x.handle.draftId,{...x.input,expectedResult:'wrong'})).toThrow('DRAFT_CHANGED')
    await x.apply();const w=(await x.repo.load())!
    expect(applySourceReadiness(w,x.handle.draftId,x.input)).toBe(w)
    expect(()=>applySourceReadiness(w,x.handle.draftId,{...x.input,choice:'meets_stated_condition'})).toThrow('OPERATION_CHANGED')
    const forged=structuredClone(w);forged.historyRecords=[]
    expect(sourceReadinessValue(forged,x.handle.draftId,x.group.taskIds[0])).toBeUndefined()
    await x.capture.beginRevision(x.handle.sourceId,{operationId:crypto.randomUUID(),rawText:'新通知取消账号激活。',provider:'manual',modelName:null,promptVersion:null,pipelineVersion:'test'})
    const changed=(await x.repo.load())!
    expect(sourceReadinessValue(changed,x.handle.draftId,x.group.taskIds[0])).toBeUndefined()
    expect(()=>applySourceReadiness(changed,x.handle.draftId,x.input)).toThrow('SOURCE_CHANGED')
  })

  it('checkpoint/transaction failure retains input; manual retry applies once and independently reads identical facts',async()=>{
    const x=await fixture(),key=`task:readiness-${x.group.id}:facts`,id=x.handle.draftId
    const transact=x.store.transactionMany.bind(x.store);let checkpointFailure=true
    x.store.transactionMany=async(keys,fn)=>{if(checkpointFailure){checkpointFailure=false;throw Error('CHECKPOINT_FAILURE')}return transact(keys,fn)}
    await expect(x.session.stage(x.initial.w,id,key,{value:'unknown'},x.input,x.session.writer,true)).rejects.toThrow('CHECKPOINT_FAILURE')
    const staged=await x.session.stage(x.initial.w,id,key,{value:'unknown'},x.input,x.session.writer,true)
    const transaction=x.store.transaction.bind(x.store);let failure=true
    x.store.transaction=async(k,fn)=>transaction(k,raw=>{const next=fn(raw);if(k==='current'&&failure){failure=false;throw Error('TRANSACTION_FAILURE')}return next})
    await expect(x.apply()).rejects.toThrow('TRANSACTION_FAILURE')
    expect(sourceReadinessGroups((await x.repo.load())!,id)[0].resolved).toBe(false)
    const restored=await x.session.load((await x.repo.load())!,id)
    expect(restored.fields[key].mine).toEqual(x.input)
    await x.session.withFreshField(x.initial.w,id,key,x.session.writer,staged.fields[key].revision,x.input,x.apply)
    await x.apply()
    const w=(await x.repo.load())!
    expect(w.historyRecords.filter(h=>h.action==='user_condition_judgement')).toHaveLength(1)
    expect((await new CanonicalWorkspaceRepository(x.store).load())!.extractionDrafts[0]).toEqual(w.extractionDrafts[0])
    expect((await x.measurement.events(id)).filter(e=>e.kind==='edit')).toHaveLength(1)
  })

  it('an unknown value with incomplete rule evidence cannot be relabelled as no condition; false qualification stays false',async()=>{
    const x=await fixture(),w=structuredClone(x.initial.w),draft=w.extractionDrafts[0]
    const sidecar=draft.legacyData!.semanticSidecar as {[key:string]:JsonValue},first=sidecar.firstSemantic as {[key:string]:JsonValue},tasks=first.tasks as Array<{[key:string]:JsonValue}>
    tasks[0].condition={value:'unknown',conditionScopeIds:[],factScopeIds:['missing']}
    const group=sourceReadinessGroups(w,x.handle.draftId).find(g=>g.taskIds.includes(x.group.taskIds[0]))!
    expect(group.unresolvedEvidence).toBe(true)
    expect(()=>applySourceReadiness(w,x.handle.draftId,{...x.input,groupId:group.id})).toThrow('GROUP_UNAVAILABLE')
    tasks[0].condition={value:'false',conditionScopeIds:[],factScopeIds:[]}
    expect(sourceReadinessGroups(w,x.handle.draftId).some(g=>g.taskIds.includes(x.group.taskIds[0]))).toBe(false)
  })
})
