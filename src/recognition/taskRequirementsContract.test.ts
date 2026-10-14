import { describe,it,expect } from 'vitest'
import { createTaskRequirementsFixture } from '../experiments/candidate19Recorded/taskRequirementsFixtures'
import { projectTaskRequirements,decodeTaskRequirementsRecording,buildTaskRequirementsRequest,TASK_REQUIREMENTS_SCHEMA } from './taskRequirementsContract'
import { buildRoleAuthorityRequest } from './sourceContractV7'
import { validateRecognitionResult } from './schema'
import { CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { CapturePersistenceService } from '../domain/v2/capture'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { buildSourceReviewPlan,commitSourceReview,verifySourceReviewReadback } from '../domain/v2/sourceReviewD26'

describe('typed requirements retain one core action and independent obligations',()=>{
  it('uses literal typed ownership for information support without erasing unrelated references or coverage risks',async()=>{
    const x=await createTaskRequirementsFixture(),facts=structuredClone(x.facts),r=facts.requirements[0]
    const scopeId=r.scopeIds[0],row=facts.scopeAccounting.find(row=>row.scopeId===scopeId)!
    row.kind='information';row.primaryEntityIds=[r.ownerTaskId]
    const p=projectTaskRequirements(facts,x.context)
    expect(p.projected.scopeAccounting.find(row=>row.scopeId===scopeId)!.primaryEntityIds).toEqual([])
    expect(p.audit.informationIndexChanges).toContainEqual({scopeId,ownerTaskId:r.ownerTaskId})
    const envelope=JSON.parse(x.rawHttpText);envelope.output[0].content[0].text=JSON.stringify(facts)
    const raw=JSON.stringify(envelope),d=decodeTaskRequirementsRecording(raw,x.context)
    expect(d.sidecar.originalResponse).toBe(raw);expect(d.result.standaloneTasks).toHaveLength(2)
    const invalid=structuredClone(facts);invalid.scopeAccounting.find(row=>row.scopeId===scopeId)!.primaryEntityIds=['missing-owner']
    envelope.output[0].content[0].text=JSON.stringify(invalid)
    expect(()=>decodeTaskRequirementsRecording(JSON.stringify(envelope),x.context)).toThrow('REFERENCE')
    const missing=structuredClone(facts);missing.tasks[0].coverage.material.status='present';missing.materials=[]
    envelope.output[0].content[0].text=JSON.stringify(missing)
    const blocked=decodeTaskRequirementsRecording(JSON.stringify(envelope),x.context)
    expect(blocked.result.conflicts.some(c=>c.id.includes('material')&&c.requiresDecision)).toBe(true)
  })
  it('preserves conditional fields, two real actions and shared window through canonical save/readback',async()=>{
    const x=await createTaskRequirementsFixture(),d=decodeTaskRequirementsRecording(x.rawHttpText,x.context)
    expect(validateRecognitionResult(d.result).valid).toBe(true)
    expect(d.result.standaloneTasks).toHaveLength(2)
    expect(d.result.standaloneTasks[0].completionCriteria.join(' ')).toContain('校外实习者还须填写实习单位')
    expect(d.sidecar.roleAuthorityAudit.original.tasks[0].condition.value).toBe('not_applicable')
    expect(d.sidecar.originalResponse).toBe(x.rawHttpText)
    const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace())
    const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',title:'条件字段',rawText:x.sourceText,provider:'manual',modelName:'ENGINEERING_FIXTURE',promptVersion:'fixture',pipelineVersion:'fixture'})
    await capture.recognize(h,async()=>d.result)
    const view=new IndexedDbWorkspaceRepository(repo)
    for(let i=0;i<2;i++){
      const w=(await repo.load())!,draft=(await view.load())!.drafts[0],pending=draft.items.find(t=>t.status==='待确认')!
      const commit=await commitSourceReview(repo,buildSourceReviewPlan(w,draft,pending.id))
      await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),commit)
    }
    const w=(await repo.load())!
    expect(w.tasks).toHaveLength(2);expect(w.timePoints).toHaveLength(2)
    expect(w.tasks.some(t=>t.title.includes('领取门禁卡'))).toBe(true)
    expect(w.tasks[0].description).toContain('实习单位')
  })
  it('rejects fake owners, unknown or contradictory evidence instead of filling facts',async()=>{
    const x=await createTaskRequirementsFixture(),f=structuredClone(x.facts)
    f.requirements[0].ownerTaskId='SCOPE_NOT_TASK';expect(()=>projectTaskRequirements(f,x.context)).toThrow('OWNER')
    f.requirements[0].ownerTaskId='T1';f.requirements[0].text='另须缴费100元';expect(()=>projectTaskRequirements(f,x.context)).toThrow('EVIDENCE')
    f.requirements[0]=structuredClone(x.facts.requirements[0]);f.requirements[0].scopeIds=['other-source'];expect(()=>projectTaskRequirements(f,x.context)).toThrow('EVIDENCE')
  })
  it('changes structural request schema while preserving the original V7 request bytes',async()=>{
    const x=await createTaskRequirementsFixture(),before=await buildRoleAuthorityRequest(x.context),next=await buildTaskRequirementsRequest(x.context),after=await buildRoleAuthorityRequest(x.context)
    expect(before.serialized).toBe(after.serialized)
    expect(next.body.text.format.schema).toEqual(TASK_REQUIREMENTS_SCHEMA)
    expect(next.serialized).not.toBe(before.serialized);expect(next.dispatchAuthorized).toBe(false)
  })
})
