import {describe,it,expect} from 'vitest'
import {ordinaryWorkflowFixture} from '../../recognition/ordinaryProviderSupport.fixture'
import {assembleCurrentFirstSuggestion} from '../../recognition/materialChannelGrounding'
import {parseRecognitionResult} from '../../recognition/schema'
import {nativeQualificationReviews} from '../../recognition/nativeQualificationReview'
import {emptyWorkspace} from '../../experiments/mainline01/fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {IndexedDbWorkspaceRepository} from '../../lib/repository'
import {sourceReadinessGroups,sourceReadinessValue,unresolvedSourceReadiness,applySourceReadiness,currentReadinessFlags,type ReadinessInput} from './sourceReadiness'
import {workspaceSnapshotHash} from './migration'
import {buildSourceReviewPlan,commitSourceReview,verifySourceReviewReadback} from './sourceReviewD26'
import {buildDomainCommitPlanV2,selectionFromDraftItems} from './domainCommit'
import {buildPersonalPlan,defaultPlanOptions} from './personalPlanD27'

const rule='只有审核通过的同学才须提交住宿登记表。'
function response(fact='当前未提供本人的审核结果。'){
 const source=rule+fact,r=ordinaryWorkflowFixture(source),t=r.standaloneTasks[0]
 t.title='提交住宿登记表';t.actionVerb='提交';t.actionObject='住宿登记表';t.description=rule;t.completionCriteria=['住宿登记表已提交'];t.evidenceIds=['R'];t.materialTempIds=[];t.timePointTempIds=[];t.selected=false
 r.materials=[];r.timePoints=[];r.evidence=[{id:'R',sourceId:'pending-source',quote:rule,field:'description'},...(fact?[{id:'F',sourceId:'pending-source',quote:fact,field:'requirement' as const}]:[])]
 r.ambiguities=[{id:'A',field:'审核结果',message:'当前没有提供你的审核结果，无法确定你是否属于审核通过者。',options:[],evidenceIds:fact?['R','F']:['R']}]
 r.quality.needsHumanReview=true;r.quality.reviewReasons=['个人审核结果未知，提交义务是否适用需人工确认。']
 return {source,r}
}
async function captured(fact?:string,shared=false){
 const x=response(fact)
 if(shared){const newRule='只有审核通过的同学才须提交住宿登记表并领取住宿凭条。';x.source=x.source.replace(rule,newRule);x.r.evidence[0].quote=newRule;x.r.standaloneTasks.push({...x.r.standaloneTasks[0],tempId:'second',title:'领取住宿凭条',actionVerb:'领取',actionObject:'住宿凭条'})}
 const first=assembleCurrentFirstSuggestion(parseRecognitionResult(x.r),{sourceText:x.source,referenceTime:'2027-03-01T09:00:00+08:00',timezone:'Asia/Shanghai'})
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store);await repo.initialize(emptyWorkspace())
 const service=new CapturePersistenceService(repo),handle=await service.beginCapture({operationId:crypto.randomUUID(),rawText:x.source,sourceType:'text',title:'匿名资格工程反例',provider:'manual',modelName:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT',promptVersion:'native-qualification-fixture',pipelineVersion:'native-qualification-test'})
 await service.recognize(handle,async()=>first.result)
 await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>d.id===handle.draftId?{...d,legacyData:{...d.legacyData,firstSuggestionDisplayed:JSON.parse(JSON.stringify(first.result)),firstSuggestionAssembly:JSON.parse(JSON.stringify(first.audit)),originalResponse:JSON.stringify(x.r)}}:d)}))
 const view=new IndexedDbWorkspaceRepository(repo),state=async()=>({w:(await repo.load())!,draft:(await view.load())!.drafts[0]})
 return {...x,repo,store,handle,state,first}
}
describe('native qualification ambiguity uses the existing ordinary review and commit chain',()=>{
 it.each([undefined,''])('does not let a direct accept replace an unknown personal status, fact=%s',async fact=>{
  const x=await captured(fact),initial=await x.state(),id=initial.draft.items[0].suggestion.id,groups=sourceReadinessGroups(initial.w,initial.draft.id)
  expect(groups).toHaveLength(1);expect(groups[0].ruleQuotes).toEqual([rule]);expect(unresolvedSourceReadiness(initial.w,initial.draft.id,id)).toBe(true)
  expect(()=>buildSourceReviewPlan(initial.w,initial.draft,initial.draft.items[0].id)).toThrow('适用状态')
  const input:ReadinessInput={groupId:groups[0].id,choice:'meets_stated_condition',expectedResult:workspaceSnapshotHash(initial.w.extractionDrafts[0].result),operationId:crypto.randomUUID()}
  expect(()=>applySourceReadiness(initial.w,initial.draft.id,{...input,choice:'no_extra_condition'})).toThrow('CHOICE_MISMATCH')
  await x.repo.transaction(w=>applySourceReadiness(w,initial.draft.id,input));const current=await x.state()
  expect(sourceReadinessValue(current.w,current.draft.id,id)).toBe('true');expect(current.w.tasks).toHaveLength(0)
  expect(current.w.extractionDrafts[0].result!.ambiguities).toHaveLength(0);expect(current.w.extractionDrafts[0].result!.quality.needsHumanReview).toBe(false)
  expect(currentReadinessFlags(current.w,current.draft.id,['个人审核结果未知，提交义务是否适用需人工确认。','PDF提取不完整'])).toEqual(['PDF提取不完整'])
  expect(current.w.extractionDrafts[0].legacyData?.firstSuggestionDisplayed).toEqual(initial.w.extractionDrafts[0].legacyData?.firstSuggestionDisplayed)
  expect(current.w.extractionDrafts[0].legacyData?.originalResponse).toBe(initial.w.extractionDrafts[0].legacyData?.originalResponse)
  const receipt=await commitSourceReview(x.repo,buildSourceReviewPlan(current.w,current.draft)),back=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(x.store),receipt)
  expect(back.tasks).toHaveLength(1);expect(back.tasks[0].status).toBe('todo');expect(back.historyRecords.filter(h=>h.action==='user_condition_judgement')).toHaveLength(1)
  const forged=structuredClone(back);forged.historyRecords=forged.historyRecords.filter(h=>h.action!=='user_condition_judgement');expect(sourceReadinessValue(forged,current.draft.id,id)).toBeUndefined()
 })
 it('protects an older already-confirmed unknown native task from unconditional scheduling, then permits an attested later judgement',async()=>{
  const x=await captured(),initial=await x.state(),selection=selectionFromDraftItems(initial.draft.recognitionResult!,initial.draft.items.map(t=>({...t,selected:true})))
  // Reproduce the formerly allowed formal state through its unchanged domain
  // commit API, not by writing invented task rows or modifying historical data.
  await commitSourceReview(x.repo,buildDomainCommitPlanV2(initial.w,initial.draft.id,selection))
  const current=await x.state(),options={...defaultPlanOptions(new Date('2027-03-01T01:00:00Z')),days:2},before=buildPersonalPlan(current.w,options)
  expect(before.segments).toHaveLength(0);expect(before.unscheduled[0].code).toBe('QUALIFICATION_UNKNOWN')
  const group=sourceReadinessGroups(current.w,current.draft.id)[0];expect(group.resolved).toBe(false)
  await x.repo.transaction(w=>applySourceReadiness(w,current.draft.id,{groupId:group.id,choice:'meets_stated_condition',expectedResult:workspaceSnapshotHash(w.extractionDrafts[0].result),operationId:crypto.randomUUID()}))
  expect(buildPersonalPlan((await x.repo.load())!,options).segments).toHaveLength(1)
 })
 it('updates the ordinary compatibility selection checkpoint after an explicit qualification judgement',async()=>{
  const x=await captured(),initial=await x.state(),item=initial.draft.items[0]
  await x.repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>({...d,legacyData:{...d.legacyData,v7Record:JSON.parse(JSON.stringify({...initial.draft,items:[{...item,selected:false,history:[],updatedAt:'2027-03-01T00:00:00Z'}]}))}}))}))
  const s=await x.state(),group=sourceReadinessGroups(s.w,s.draft.id)[0]
  expect(s.draft.items[0].selected).toBe(false)
  await x.repo.transaction(w=>applySourceReadiness(w,s.draft.id,{groupId:group.id,choice:'meets_stated_condition',expectedResult:workspaceSnapshotHash(w.extractionDrafts[0].result),operationId:crypto.randomUUID()}))
  const after=await x.state();expect(after.draft.items[0].selected).toBe(true)
  expect(after.draft.items[0].suggestion).toEqual(item.suggestion)
  expect(after.w.extractionDrafts[0].legacyData?.firstSuggestionDisplayed).toEqual(initial.w.extractionDrafts[0].legacyData?.firstSuggestionDisplayed)
  const back=await verifySourceReviewReadback(x.repo,await commitSourceReview(x.repo,buildSourceReviewPlan(after.w,after.draft)))
  expect(back.tasks).toHaveLength(1)
 })
 it('keeps a contrary personal source fact blocked rather than letting a checkbox override it',async()=>{
  const x=await captured('当前本人审核未通过。'),s=await x.state(),group=sourceReadinessGroups(s.w,s.draft.id)[0]
  expect(group.unresolvedEvidence).toBe(true);expect(group.blockedReason).toContain('未满足条件')
  expect(()=>applySourceReadiness(s.w,s.draft.id,{groupId:group.id,choice:'meets_stated_condition',expectedResult:workspaceSnapshotHash(s.w.extractionDrafts[0].result),operationId:crypto.randomUUID()})).toThrow('GROUP_UNAVAILABLE')
 })
 it('keeps historical source warnings visible without crashing or inventing an eligibility gap for an unconditional saved task',async()=>{
  const x=await captured(),s=await x.state(),selection=selectionFromDraftItems(s.draft.recognitionResult!,s.draft.items.map(t=>({...t,selected:true})))
  await commitSourceReview(x.repo,buildDomainCommitPlanV2(s.w,s.draft.id,selection))
  const w=structuredClone((await x.repo.load())!);w.sources[0].currentVersionId='a-later-source-version'
  w.sourceVersions.push({...w.sourceVersions[0],id:'a-later-source-version',versionNo:2})
  expect(currentReadinessFlags(w,s.draft.id,['原文版本已变'])).toEqual(['原文版本已变'])
  const options={...defaultPlanOptions(new Date('2027-03-01T01:00:00Z')),days:2}
  expect(buildPersonalPlan(w,options).unscheduled[0].code).toBe('QUALIFICATION_UNKNOWN')
  const r=w.extractionDrafts[0].result!;r.ambiguities=[]
  w.extractionDrafts[0].legacyData!.firstSuggestionDisplayed=JSON.parse(JSON.stringify(r))
  const unconditional=buildPersonalPlan(w,options)
  expect(unresolvedSourceReadiness(w,s.draft.id,s.draft.items[0].suggestion.id,true)).toBe(false)
  // The existing stale-source plan guard still applies; eligibility does not
  // replace that independent version/revision decision.
  expect(unconditional.unscheduled[0].code).toBe('RELATION_NEEDS_REVIEW')
 })
 it('does not mistake a prohibition for the nonqualifying group for the current personal outcome',async()=>{
  const x=await captured('当前审核未通过者请勿提交。'),s=await x.state(),group=sourceReadinessGroups(s.w,s.draft.id)[0]
  expect(group.unresolvedEvidence).toBe(false);expect(group.blockedReason).toBeUndefined()
 })
 it('resolves only the personal status while keeping an unrelated bad relation and deadline warning',async()=>{
  const x=await captured();await x.repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>({...d,result:{...d.result!,conflicts:[{id:'bad-owner',type:'other',message:'另一事项的时间关联未核对',entityTempIds:[d.result!.standaloneTasks[0].tempId],evidenceIds:[],requiresDecision:true}],quality:{...d.result!.quality,reviewReasons:[...d.result!.quality.reviewReasons,'截止尚未确认']}}}))}))
  const s=await x.state(),group=sourceReadinessGroups(s.w,s.draft.id)[0];await x.repo.transaction(w=>applySourceReadiness(w,s.draft.id,{groupId:group.id,choice:'meets_stated_condition',expectedResult:workspaceSnapshotHash(w.extractionDrafts[0].result),operationId:crypto.randomUUID()}))
  const after=await x.state();expect(after.w.extractionDrafts[0].result!.quality.reviewReasons).toContain('截止尚未确认');expect(after.w.extractionDrafts[0].result!.conflicts[0].id).toBe('bad-owner');expect(()=>buildSourceReviewPlan(after.w,after.draft,after.draft.items[0].id)).toThrow('另一事项')
 })
 it('groups two real duties sharing the exact same cited qualification into one judgement',async()=>{
  const x=await captured(undefined,true),current=await x.state(),groups=sourceReadinessGroups(current.w,current.draft.id)
  expect(groups).toHaveLength(1);expect(groups[0].taskIds).toHaveLength(2)
  await x.repo.transaction(w=>applySourceReadiness(w,current.draft.id,{groupId:groups[0].id,choice:'meets_stated_condition',expectedResult:workspaceSnapshotHash(w.extractionDrafts[0].result),operationId:crypto.randomUUID()}))
  const after=await x.state();expect(after.w.extractionDrafts[0].result!.ambiguities).toHaveLength(0);expect(after.w.historyRecords.filter(h=>h.action==='user_condition_judgement')).toHaveLength(1)
 })
 it.each(['voluntary','predecessor','foreign rule'])('does not manufacture a qualification for %s',kind=>{
  const x=response();if(kind==='voluntary'){x.source='有意参加者可提交住宿登记表，是否参加由本人决定。';x.r.evidence[0].quote=x.source;x.r.ambiguities[0].field='参与意愿';x.r.ambiguities[0].message='当前未提供本人参与意愿。'}
  if(kind==='predecessor'){x.source='先完成表格填写，再提交住宿登记表，当前填写尚未完成。';x.r.evidence[0].quote=x.source;x.r.ambiguities[0].field='前置完成状态';x.r.ambiguities[0].message='当前未提供本人前置完成状态。'}
  if(kind==='foreign rule')x.r.evidence[0].quote='只有审核通过者才须提交另一份表。'
  expect(nativeQualificationReviews(x.r,x.source)).toEqual([])
 })
})
