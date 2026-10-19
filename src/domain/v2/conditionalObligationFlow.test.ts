import {describe,it,expect} from 'vitest'
import {conditionalRefundFixture,alternativeReceiptFixture} from '../../recognition/conditionalObligation.fixture'
import {assembleCurrentFirstSuggestion} from '../../recognition/materialChannelGrounding'
import {parseRecognitionResult} from '../../recognition/schema'
import {emptyWorkspace} from '../../experiments/mainline01/fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {IndexedDbWorkspaceRepository} from '../../lib/repository'
import {sourceReadinessGroups,sourceReadinessValue,sourceReadinessProblem,applySourceReadiness,type ReadinessChoice} from './sourceReadiness'
import {workspaceSnapshotHash} from './migration'
import {buildSourceReviewPlan,commitSourceReview,verifySourceReviewReadback} from './sourceReviewD26'
import {buildPersonalPlan,defaultPlanOptions,planBaseline} from './personalPlanD27'
import {canonicalHandlingWindow,canonicalHandlingEvent} from './handlingWindow'

async function captured(x:ReturnType<typeof conditionalRefundFixture>){
 const first=assembleCurrentFirstSuggestion(parseRecognitionResult(x.r),{sourceText:x.source,referenceTime:'2027-04-01T09:00:00+08:00',timezone:'Asia/Shanghai'})
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store);await repo.initialize(emptyWorkspace())
 const service=new CapturePersistenceService(repo),handle=await service.beginCapture({operationId:crypto.randomUUID(),rawText:x.source,sourceType:'text',title:'匿名条件工程夹具',provider:'manual',modelName:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT',promptVersion:'r11-conditional-fixture',pipelineVersion:'r11-public-first'})
 await service.recognize(handle,async()=>first.result)
 await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>d.id===handle.draftId?{...d,legacyData:{...d.legacyData,firstSuggestionDisplayed:JSON.parse(JSON.stringify(first.result)),firstSuggestionAssembly:JSON.parse(JSON.stringify(first.audit)),originalResponse:JSON.stringify(x.r)}}:d)}))
 const view=new IndexedDbWorkspaceRepository(repo),state=async()=>({w:(await repo.load())!,draft:(await view.load())!.drafts[0]})
 async function judge(choice:ReadinessChoice){const s=await state(),group=sourceReadinessGroups(s.w,s.draft.id)[0];await repo.transaction(w=>applySourceReadiness(w,s.draft.id,{groupId:group.id,choice,expectedResult:workspaceSnapshotHash(w.extractionDrafts[0].result),operationId:crypto.randomUUID()}));return state()}
 return {...x,first,store,repo,handle,state,judge}
}
describe('cited conditional obligations use ordinary review and atomic persistence',()=>{
 it('keeps an unknown refund obligation and its supported channel without inventing arrival as a deadline',async()=>{
  const x=await captured(conditionalRefundFixture()),s=await x.state()
  expect(x.first.result.materials[0].submissionChannel).toBe('选修办理邮箱:[匿名邮箱]');expect(x.first.result.conflicts).toHaveLength(0)
  expect(x.first.result.timePoints).toHaveLength(1);expect(x.first.result.timePoints[0].type).toBe('submission_deadline')
  expect(sourceReadinessGroups(s.w,s.draft.id)).toHaveLength(1);expect(sourceReadinessValue(s.w,s.draft.id,'refund')).toBeUndefined()
  expect(()=>buildSourceReviewPlan(s.w,s.draft,s.draft.items[0].id)).toThrow('适用状态')
  expect(s.w.tasks).toHaveLength(0);expect(x.r.standaloneTasks[0].selected).toBe(false)
 })
 it('records one positive judgement, saves through DomainCommitPlan and independently reads the exact material/date',async()=>{
  const x=await captured(conditionalRefundFixture()),before=await x.state(),s=await x.judge('meets_stated_condition')
  expect(s.draft.items[0].selected).toBe(true);expect(sourceReadinessValue(s.w,s.draft.id,'refund')).toBe('true')
  const plan=buildSourceReviewPlan(s.w,s.draft),back=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(x.store),await commitSourceReview(x.repo,plan))
  expect(back.tasks).toHaveLength(1);expect(back.materials[0].submissionChannel).toBe('选修办理邮箱:[匿名邮箱]');expect(back.timePoints[0].normalizedValue).toBe('2027-04-08T17:00')
  expect(back.extractionDrafts[0].legacyData?.firstSuggestionDisplayed).toEqual(before.w.extractionDrafts[0].legacyData?.firstSuggestionDisplayed)
  expect(back.historyRecords.filter(h=>h.action==='user_condition_judgement')).toHaveLength(1)
  await commitSourceReview(x.repo,plan);expect((await x.repo.load())!.tasks).toHaveLength(1)
 })
 it('lets an explicit nonapplicable decision remain reversible and cannot directly accept it as executable',async()=>{
  const x=await captured(conditionalRefundFixture()),no=await x.judge('does_not_meet_condition')
  expect(sourceReadinessValue(no.w,no.draft.id,'refund')).toBe('false');expect(sourceReadinessProblem(no.w,no.draft.id,'refund')).toContain('不适用')
  expect(no.draft.items[0].selected).toBe(false);expect(()=>buildSourceReviewPlan(no.w,no.draft,no.draft.items[0].id)).toThrow('不适用')
  const yes=await x.judge('meets_stated_condition');expect(sourceReadinessValue(yes.w,yes.draft.id,'refund')).toBe('true');expect(yes.draft.items[0].selected).toBe(true)
  expect(yes.w.historyRecords.filter(h=>h.action==='user_condition_judgement')).toHaveLength(2)
 })
 it('cannot let an applicability click override a contrary personal source fact',async()=>{
  const x=await captured(conditionalRefundFixture('本人未缴费，决定继续修读。')),s=await x.state()
  expect(sourceReadinessGroups(s.w,s.draft.id)).toHaveLength(0);expect(sourceReadinessValue(s.w,s.draft.id,'refund')).toBe('false')
  expect(()=>buildSourceReviewPlan(s.w,s.draft,s.draft.items[0].id)).toThrow('不适用')
  expect(()=>applySourceReadiness(s.w,s.draft.id,{groupId:'forged',choice:'meets_stated_condition',expectedResult:workspaceSnapshotHash(s.w.extractionDrafts[0].result),operationId:crypto.randomUUID()})).toThrow('GROUP_UNAVAILABLE')
 })
 it('does not ask again when the same source explicitly states the personal condition is already true',async()=>{
  const f=conditionalRefundFixture('本人已缴费并决定放弃选修资格。');f.r.standaloneTasks[0].selected=true;f.r.timePoints[0].selected=true
  const x=await captured(f),s=await x.state();expect(sourceReadinessGroups(s.w,s.draft.id)).toHaveLength(0);expect(sourceReadinessValue(s.w,s.draft.id,'refund')).toBe('true')
  const back=await verifySourceReviewReadback(x.repo,await commitSourceReview(x.repo,buildSourceReviewPlan(s.w,s.draft)))
  expect(back.tasks).toHaveLength(1);expect(back.timePoints[0].normalizedValue).toBe('2027-04-08T17:00');expect(back.historyRecords.some(h=>h.action==='user_condition_judgement')).toBe(false)
 })
 it('never activates a tentative or unknown time when personal applicability is accepted',async()=>{
  const f=conditionalRefundFixture();f.source=f.source.replace('2027年4月8日17:00前','截止时间尚未公布，');f.r.evidence[1].quote=f.r.evidence[1].quote.replace('2027年4月8日17:00前','截止时间尚未公布，');Object.assign(f.r.timePoints[0],{rawText:'截止时间尚未公布',normalizedValue:null,precision:'vague',needsConfirmation:true,selected:false})
  const x=await captured(f),s=await x.judge('meets_stated_condition'),point=s.w.extractionDrafts[0].result!.timePoints[0]
  expect(point.normalizedValue).toBeNull();expect(point.selected).toBe(false)
 })
 it('keeps a relation conflict local even after the condition is explicitly confirmed',async()=>{
  const x=await captured(conditionalRefundFixture());await x.repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>({...d,result:{...d.result!,conflicts:[{id:'wrong-owner',type:'other',message:'该截止关联到另一个对象',entityTempIds:['refund'],evidenceIds:[],requiresDecision:true}]}}))}))
  const s=await x.judge('meets_stated_condition');expect(s.w.extractionDrafts[0].result!.conflicts[0].id).toBe('wrong-owner');expect(()=>buildSourceReviewPlan(s.w,s.draft,s.draft.items[0].id)).toThrow('另一个对象')
 })
 it('leaves no partial formal facts after a transaction failure and retries the same plan once',async()=>{
  const x=await captured(conditionalRefundFixture()),s=await x.judge('meets_stated_condition'),plan=buildSourceReviewPlan(s.w,s.draft),transaction=x.store.transaction.bind(x.store);let fail=true
  x.store.transaction=async(key,fn)=>transaction(key,current=>{const next=fn(current);if(key==='current'&&fail){fail=false;throw Error('R11_FORMAL_TRANSACTION_FAILURE')}return next})
  await expect(commitSourceReview(x.repo,plan)).rejects.toThrow('R11_FORMAL_TRANSACTION_FAILURE')
  expect((await x.repo.load())!.tasks).toHaveLength(0);expect((await x.repo.load())!.timePoints).toHaveLength(0);expect((await x.repo.load())!.extractionDrafts[0].result!.standaloneTasks[0].actionObject).toBe('《选修退费申请表》')
  const receipt=await commitSourceReview(x.repo,plan),read=x.repo.load.bind(x.repo);let readFail=true
  await expect(verifySourceReviewReadback({load:async()=>{if(readFail){readFail=false;throw Error('R11_READ_FAILURE')}return read()}},receipt)).rejects.toThrow('R11_READ_FAILURE')
  const back=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(x.store),receipt);expect(back.tasks).toHaveLength(1);expect(back.materials).toHaveLength(1);expect(back.timePoints).toHaveLength(1)
 })
 it('does not manufacture a structured obligation from a summary-only response',async()=>{
  const f=conditionalRefundFixture();f.r.standaloneTasks=[];f.r.materials=[];f.r.timePoints=[]
  const x=await captured(f),s=await x.state();expect(sourceReadinessGroups(s.w,s.draft.id)).toHaveLength(0);expect(s.draft.items).toHaveLength(0);expect(s.w.tasks).toHaveLength(0)
 })
 it('keeps a missed-window alternative separate from a completion dependency, and selects only the chosen receipt',async()=>{
  const x=await captured(alternativeReceiptFixture()),before=await x.state()
  expect(x.first.result.standaloneTasks[1].dependencyTempIds).toEqual([]);expect(x.first.result.standaloneTasks[1].title).toContain('错过正常窗口')
  expect(x.first.result.timePoints.map(p=>p.normalizedValue)).toEqual(['2027-04-06T10:00','2027-04-07T12:00','2027-04-08T13:00','2027-04-09T16:00'])
  expect(()=>buildSourceReviewPlan(before.w,before.draft,before.draft.items[1].id)).toThrow('适用状态')
  const s=await x.judge('meets_stated_condition');expect(s.draft.items.map(t=>t.selected)).toEqual([false,true]);expect(s.w.extractionDrafts[0].result!.events.map(e=>e.selected)).toEqual([false,true])
  expect(()=>buildSourceReviewPlan(s.w,s.draft,s.draft.items[0].id)).toThrow('已选择同一物品的补领')
  const back=await verifySourceReviewReadback(x.repo,await commitSourceReview(x.repo,buildSourceReviewPlan(s.w,s.draft)))
  expect(back.tasks).toHaveLength(1);expect(back.tasks[0].dependencyIds).toEqual([]);expect(back.events).toHaveLength(1);expect(back.timePoints).toHaveLength(2)
  const post=await x.state();expect(()=>buildSourceReviewPlan(post.w,post.draft,post.draft.items[0].id)).toThrow('已选择同一物品的补领')
  expect(canonicalHandlingWindow(back,back.tasks[0])?.row.kind).toBe('OPEN_DAYS_UNSTATED')
  const proposal=buildPersonalPlan(back,{...defaultPlanOptions(new Date('2027-04-08T05:00:00Z')),days:2})
  expect(proposal.segments).toHaveLength(0);expect(proposal.unscheduled[0].code).toBe('SOURCE_WINDOW_NEEDS_REVIEW')
  expect(back.timePoints.every(p=>p.type!=='submission_deadline')).toBe(true)
 })
 it('does not schedule a second receipt when the original same-object task has already been completed',async()=>{
  const x=await captured(alternativeReceiptFixture()),s=await x.state()
  await commitSourceReview(x.repo,buildSourceReviewPlan(s.w,s.draft,s.draft.items[0].id))
  await x.repo.transaction(w=>({...w,tasks:w.tasks.map(t=>({...t,status:'completed'}))}))
  const back=await x.state(),group=sourceReadinessGroups(back.w,back.draft.id)[0];expect(group.blockedReason).toContain('已经完成')
  await expect(x.judge('meets_stated_condition')).rejects.toThrow('GROUP_UNAVAILABLE')
 })
 it('constrains explicit daily opportunities and does not reserve the entire date range as attendance',async()=>{
  const x=await captured(alternativeReceiptFixture(true)),s=await x.judge('meets_stated_condition')
  const back=await verifySourceReviewReadback(x.repo,await commitSourceReview(x.repo,buildSourceReviewPlan(s.w,s.draft)))
  expect(canonicalHandlingWindow(back,back.tasks[0])?.row.kind).toBe('DAILY_CLOCKS')
  const options={...defaultPlanOptions(new Date('2027-04-08T00:00:00Z')),startTime:'08:00',endTime:'20:00',days:2},proposal=buildPersonalPlan(back,options)
  expect(proposal.segments).toHaveLength(1);expect(proposal.segments[0].start).toBe('2027-04-08T05:00:00.000Z');expect(proposal.segments[0].originalDeadline).toBeNull()
  const before=planBaseline(back),corrupt=structuredClone(back);corrupt.tasks[0].legacyData!.existingHandlingWindow={...(corrupt.tasks[0].legacyData!.existingHandlingWindow as object),rowHash:'bad'}
  expect(planBaseline(corrupt)).not.toBe(before);expect(buildPersonalPlan(corrupt,options).segments).toHaveLength(0)
 })
 it('retains opportunity semantics when only the event is accepted and its action is deferred',async()=>{
  const x=await captured(alternativeReceiptFixture(true)),s=await x.state(),view={...s.draft,items:s.draft.items.map(i=>({...i,selected:false}))}
  const back=await verifySourceReviewReadback(x.repo,await commitSourceReview(x.repo,buildSourceReviewPlan(s.w,view)))
  expect(back.tasks).toHaveLength(0);expect(back.events).toHaveLength(1);expect(canonicalHandlingEvent(back,back.events[0])?.kind).toBe('DAILY_CLOCKS')
  const bad=structuredClone(back);bad.timePoints[0].normalizedValue='2027-04-06T00:00';expect(canonicalHandlingEvent(bad,bad.events[0])).toBeNull()
 })
 it.each(['other delivery','approval predecessor','no more receipt','foreign object','missing endpoint'])('does not clear a real or unresolved prerequisite for %s',kind=>{
  const f=alternativeReceiptFixture();if(kind==='other delivery')f.source=f.source.replace('如果错过以上领取时间，可于','领取第一批后再于').replace('在乙室领取','在乙室领取另一批')
  if(kind==='approval predecessor')f.source=f.source.replace('如果错过以上领取时间，可于','登记并审核通过后，可于')
  if(kind==='no more receipt')f.source=f.source.replace('如果错过以上领取时间，可于','错过以后不再补领，不能于')
  if(kind==='foreign object')f.r.standaloneTasks[1].actionObject='另一份材料'
  if(kind==='missing endpoint')f.r.events[1].endTimePointTempId=null
  f.r.evidence[1].quote=f.source.split('\n')[1]
  const first=assembleCurrentFirstSuggestion(parseRecognitionResult(f.r),{sourceText:f.source,referenceTime:'2027-04-01T09:00:00+08:00',timezone:'Asia/Shanghai'})
  expect(first.result.standaloneTasks[1].dependencyTempIds).toEqual(['normal']);expect(first.audit.conditionalAlternatives?.decisions).toHaveLength(0)
 })
 it.each(['若审核通过-表格下载','仅限已毕业同学-表格下载','下载专区，勿提交'])('does not strip an instructional parenthesis: %s',note=>{
  const f=conditionalRefundFixture();f.source=f.source.replace('教务处官网-表格下载',note);f.r.evidence[1].quote=f.r.evidence[1].quote.replace('教务处官网-表格下载',note)
  const first=assembleCurrentFirstSuggestion(f.r,{sourceText:f.source,referenceTime:'2027-04-01T09:00:00+08:00',timezone:'Asia/Shanghai'});expect(first.result.materials[0].submissionChannel).toBeNull()
 })
})
