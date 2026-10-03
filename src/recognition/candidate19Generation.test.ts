import {describe,it,expect} from 'vitest'
import {createGenerationFixture} from '../experiments/d26Recorded/generationFixtures'
import {assembleSourceContractV4,decodeSourceContractRecording} from './sourceContractV4'
import {buildCandidate19Request,CANDIDATE19_PROMPT_VERSION} from '../experiments/realInput01/candidate19'
import {assembleRecognitionFirstSuggestionD26} from './firstSuggestionD26'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../domain/v2/repository'
import {CapturePersistenceService} from '../domain/v2/capture'
import {IndexedDbWorkspaceRepository} from '../lib/repository'
import {emptyWorkspace} from '../experiments/mainline01/fixtures'
import {buildSourceReviewPlan,commitSourceReview,verifySourceReviewReadback,sourceReviewProblem} from '../domain/v2/sourceReviewD26'
import {mapSourceWorkflowItem,selectPendingReviewItems} from '../lib/sourceWorkflow'
describe('Candidate19 generation contract and the ordinary source lifecycle',()=>{
 it.each([1,2,3,4,5,6])('authored scenario %i passes actual Schema/converter/display/formal repository with honest metadata',async n=>{
  const f=await createGenerationFixture(n),store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store);await repo.initialize(emptyWorkspace())
  const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',title:'匿名生成契约场景',rawText:f.sourceText,provider:'manual',modelName:'ENGINEERING_FIXTURE_NOT_GENERATED',promptVersion:CANDIDATE19_PROMPT_VERSION,pipelineVersion:'explicit-source-contract-4.0.0',sourceLegacyData:{recognitionProvenance:{responseRole:f.role,referenceTime:f.context.referenceTime}}})
  const rebound=await createGenerationFixture(n,{sourceId:h.sourceId,sourceVersionId:h.sourceVersionId}),decoded=decodeSourceContractRecording(rebound.rawHttpText,'EngineeringFixture',rebound.context)
  await capture.recognize(h,async()=>decoded.result)
  const view=(await new IndexedDbWorkspaceRepository(repo).load())!,draft=view.drafts[0],w=(await repo.load())!,first=assembleRecognitionFirstSuggestionD26(draft.recognitionResult!,{sourceText:f.sourceText,referenceTime:f.context.referenceTime,timezone:f.context.timezone})
  expect(first.result.events).toHaveLength(f.facts.events.length)
  expect(w.recognitionRuns[0].promptVersion).toBe(CANDIDATE19_PROMPT_VERSION)
  if(n===1||n===2){expect(selectPendingReviewItems(view.sources,view.drafts,w)).toHaveLength(1);expect(mapSourceWorkflowItem(view.sources[0],view.drafts,w).counts.pendingEvents).toBe(n)}
  const plan=buildSourceReviewPlan(w,draft),receipt=await commitSourceReview(repo,plan),read=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),receipt)
  expect(read.projects).toHaveLength(0);expect(read.events).toHaveLength(f.facts.events.length)
  if(n===1)expect(read.timePoints[0]).toMatchObject({normalizedValue:null,rawText:'周日晚间',precision:'vague'})
  if(n===2)expect(read.timePoints.map(p=>p.normalizedValue)).toContain(null)
  if(n===3){expect(read.tasks.map(t=>t.title)).not.toContain('领取演示器材');expect(sourceReviewProblem(draft.recognitionResult!,'T3')).toContain('资格尚未确认');expect(draft.recognitionResult!.standaloneTasks.find(t=>t.title==='递交场地使用登记')?.dependencyTempIds).toEqual(['T1']);expect(read.tasks.some(t=>t.title==='递交场地使用登记')).toBe(true)}
  if(n===4)expect(read.tasks.map(t=>t.title)).toEqual(['保存活动联系编号'])
  if(n===5){expect(read.materials[0]).toMatchObject({name:'统计表',formatRequirements:['PDF'],namingRequirements:['小组编号']});expect(read.timePoints.find(p=>p.type==='submission_deadline')?.normalizedValue).toBe('2026-11-13T09:25')}
  if(n===1||n===2){const refreshed=(await new IndexedDbWorkspaceRepository(repo).load())!;expect(mapSourceWorkflowItem(refreshed.sources[0],refreshed.drafts,read).counts.pendingEvents).toBe(0);expect(selectPendingReviewItems(refreshed.sources,refreshed.drafts,read)).toHaveLength(0)}
 })
 it('request carries four-state coverage, typed accounting and the original reference clock, never reference answers',async()=>{const f=await createGenerationFixture(2),r=await buildCandidate19Request(f.context);expect(r.dispatchAuthorized).toBe(false);expect(r.promptVersion).toBe(CANDIDATE19_PROMPT_VERSION);expect(r.serialized).toContain('explicit_none');expect(r.serialized).toContain('primaryEntityIds');expect(r.serialized).toContain(f.context.referenceTime);expect(r.serialized).not.toMatch(/\bexpected\b/i)})
 it('partially confirmed event sources retain only the remaining event in the refreshed queue',async()=>{
  const f=await createGenerationFixture(2),store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store);await repo.initialize(emptyWorkspace())
  const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',title:'两个事件',rawText:f.sourceText,provider:'manual',modelName:'工程',promptVersion:null,pipelineVersion:'source-contract-4'})
  const bound=await createGenerationFixture(2,{sourceId:h.sourceId,sourceVersionId:h.sourceVersionId}),decoded=decodeSourceContractRecording(bound.rawHttpText,'EngineeringFixture',bound.context);decoded.result.events[1].selected=false
  await capture.recognize(h,async()=>decoded.result);const viewRepo=new IndexedDbWorkspaceRepository(repo),view=(await viewRepo.load())!,receipt=await commitSourceReview(repo,buildSourceReviewPlan((await repo.load())!,view.drafts[0]));const read=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),receipt),fresh=(await viewRepo.load())!
  expect(read.events).toHaveLength(1);expect(receipt.disposition).toBe('partial');expect(mapSourceWorkflowItem(fresh.sources[0],fresh.drafts,read)).toMatchObject({status:'needs_review',counts:{pendingEvents:1}})
  expect(selectPendingReviewItems(fresh.sources,fresh.drafts,read)).toHaveLength(1)
 })
 it('source-less completed prerequisite, missing primary and wrong time endpoint reject without fabricating facts',async()=>{
  const f=await createGenerationFixture(3),bad=structuredClone(f.facts);bad.prerequisiteStates[0].completion='true';bad.tasks[0].semantics.status='completed';expect(()=>assembleSourceContractV4(bad,f.context)).toThrow()
  const e=await createGenerationFixture(2),missing=structuredClone(e.facts);missing.scopeAccounting.find(r=>r.kind==='event')!.primaryEntityIds=[];expect(()=>assembleSourceContractV4(missing,e.context)).toThrow('REFERENCE')
  const wrong=structuredClone(e.facts);wrong.events[0].endTimePointTempId='P3';expect(()=>assembleSourceContractV4(wrong,e.context)).toThrow()
 })
})
