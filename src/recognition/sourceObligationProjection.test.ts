import {describe,it,expect} from 'vitest'
import {alternativeReceiptFixture} from './conditionalObligation.fixture'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {assembleProductFirstSuggestion} from './materialChannelGrounding'
import {parseRecognitionResult} from './schema'
import {verifiedReceiptGoals,verifiedPreparationRequirements} from './sourceObligationProjection'
import {sourceCoverageHints} from './sourceCoverageHints'
import {receiptOpportunityViews,applyReceiptOpportunity} from '../domain/v2/receiptOpportunity'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../domain/v2/repository'
import {CapturePersistenceService} from '../domain/v2/capture'
import {IndexedDbWorkspaceRepository} from '../lib/repository'
import {emptyWorkspace} from '../experiments/mainline01/fixtures'
import {buildSourceReviewPlan,commitSourceReview,verifySourceReviewReadback} from '../domain/v2/sourceReviewD26'
import {workspaceSnapshotHash} from '../domain/v2/migration'
import {canonicalHandlingWindow} from '../domain/v2/handlingWindow'
import {buildPersonalPlan} from '../domain/v2/personalPlanD27'

const first=(f:ReturnType<typeof alternativeReceiptFixture>)=>{f.r.promptVersion='recognition-product-contract-1.5.0';return assembleProductFirstSuggestion(parseRecognitionResult(f.r),{sourceText:f.source,referenceTime:'2027-04-01T09:00:00+08:00',timezone:'Asia/Shanghai'})}
async function capture(f:ReturnType<typeof alternativeReceiptFixture>){
  const out=first(f),store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store)
  await repo.initialize(emptyWorkspace())
  const h=await new CapturePersistenceService(repo).beginCapture({operationId:crypto.randomUUID(),rawText:f.source,sourceType:'text',title:'匿名源义务',provider:'manual',modelName:'ENGINEERING_FIXTURE',promptVersion:f.r.promptVersion,pipelineVersion:out.audit.version})
  await new CapturePersistenceService(repo).recognize(h,async()=>out.result)
  await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>d.id===h.draftId?{...d,legacyData:{...d.legacyData,firstSuggestionDisplayed:JSON.parse(JSON.stringify(out.result)),firstSuggestionAssembly:JSON.parse(JSON.stringify(out.audit)),originalResponse:JSON.stringify(f.r)}}:d)}))
  return {out,store,repo,h}
}
function preparation(){
  const title='环境工作坊',activity=title+'于2027年4月12日14:00—16:00在实践楼201进行。',rule='入选后需要自行准备绘图板，个人入选结果未知。',source=activity+'\n'+rule,r=ordinaryWorkflowFixture(source),base=r.standaloneTasks[0]
  r.promptVersion='recognition-product-contract-1.5.0';r.materials=[];r.timePoints=[];r.conflicts=[];r.ambiguities=[]
  r.evidence=[{id:'event',sourceId:'pending-source',quote:activity,field:'event'},{id:'rule',sourceId:'pending-source',quote:rule,field:'requirement'}]
  r.standaloneTasks=[{...base,tempId:'prepare',title:'准备绘图板',actionVerb:'准备',actionObject:'绘图板',description:rule,materialTempIds:[],timePointTempIds:[],dependencyTempIds:[],evidenceIds:['rule'],selected:false}]
  r.events=[{tempId:'event',title,description:activity,startTimePointTempId:null,endTimePointTempId:null,location:'实践楼201',relatedTaskTempIds:[],evidenceIds:['event'],confidence:1,inferenceLevel:'explicit',selected:true}]
  return {r,source}
}
describe('one declared receipt goal and activity-owned R3 requirements',()=>{
  it('projects both original receipt tasks into one goal and retains all windows, locations, materials, source IDs and audit',()=>{
    const f=alternativeReceiptFixture(),before=structuredClone(f.r),out=first(f)
    expect(out.result.standaloneTasks).toHaveLength(1);expect(out.result.events).toHaveLength(0);expect(out.result.timePoints).toHaveLength(4)
    expect(out.result.standaloneTasks[0].description).toContain('甲室');expect(out.result.standaloneTasks[0].description).toContain('乙室')
    expect(out.result.standaloneTasks[0].dependencyTempIds).toEqual([])
    expect(out.result.standaloneTasks[0].completionCriteria).toHaveLength(1)
    expect(out.result.standaloneTasks[0].completionCriteria[0]).toContain('无需重复完成')
    expect(out.result.timePoints.every(p=>p.relatedTaskTempIds.length===1&&p.relatedTaskTempIds[0]==='normal')).toBe(true)
    const goals=verifiedReceiptGoals(out.result,f.source,out.audit.sourceObligationViews)
    expect(goals).toHaveLength(1);expect(goals[0].originalTasks).toHaveLength(2);expect(goals[0].opportunities.map(o=>o.id)).toEqual(['normal','missed'])
    expect(out.audit.existingHandlingWindows?.rows).toHaveLength(2)
    expect(f.r.standaloneTasks).toEqual(before.standaloneTasks)
    expect(()=>parseRecognitionResult(out.result)).not.toThrow()
  })
  it.each(['different object','other delivery','dependency','foreign proof','missing point','changed time'])('keeps unsafe receipt declarations separate: %s',kind=>{
    const f=alternativeReceiptFixture()
    if(kind==='different object')f.r.standaloneTasks[1].actionObject='另一资料袋'
    if(kind==='other delivery'){f.source=f.source.replace('在乙室领取。','在乙室领取另一批。');f.r.evidence[1].quote=f.r.evidence[1].quote.replace('在乙室领取。','在乙室领取另一批。')}
    if(kind==='dependency')f.r.standaloneTasks[0].dependencyTempIds=['alternative']
    if(kind==='foreign proof')f.r.evidence[1].sourceId='other-source'
    if(kind==='missing point'){f.r.timePoints[3].rawText='时间另行通知';f.r.timePoints[3].normalizedValue=null}
    if(kind==='changed time')f.r.timePoints[3].rawText='2027年5月1日16:00'
    expect(first(f).audit.sourceObligationViews?.receiptGoals??[]).toEqual([])
  })
  it('rejects an edited owner, changed endpoint or forged source mapping instead of treating audit as authority',()=>{
    const f=alternativeReceiptFixture(),out=first(f),g=out.audit.sourceObligationViews
    const changed=structuredClone(out.result);changed.timePoints[3].normalizedValue='2027-04-10T16:00'
    expect(verifiedReceiptGoals(changed,f.source,g)).toEqual([])
    const forged=structuredClone(g)!;forged.receiptGoals[0].originalTasks[1].actionObject='其他对象'
    expect(verifiedReceiptGoals(out.result,f.source,forged)).toEqual([])
  })
  it.each(['normal','missed'] as const)('saves one goal, both source windows and the explicit %s opportunity; refresh and repeated confirmation stay identical',async choice=>{
    const f=alternativeReceiptFixture(true),{store,repo,h}=await capture(f)
    let w=(await repo.load())!
    const view=receiptOpportunityViews(w,h.draftId)[0]
    expect(view.choice).toBe('normal');expect(view.explicit).toBe(false)
    const input={taskId:view.goal.taskId,choice,expectedChoice:view.choice,expectedResult:workspaceSnapshotHash(w.extractionDrafts[0].result),operationId:crypto.randomUUID()}
    if(choice==='missed'){await repo.transaction(w=>applyReceiptOpportunity(w,h.draftId,input));await repo.transaction(w=>applyReceiptOpportunity(w,h.draftId,input))}
    w=(await repo.load())!;const draft=(await new IndexedDbWorkspaceRepository(repo).load())!.drafts.find(d=>d.id===h.draftId)!,plan=buildSourceReviewPlan(w,draft)
    expect(plan.create.tasks).toHaveLength(1);expect(plan.create.timePoints).toHaveLength(4)
    const saved=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),await commitSourceReview(repo,plan))
    expect(saved.tasks).toHaveLength(1);expect(saved.tasks[0].legacyData?.receiptGoal).toMatchObject({choice})
    expect(canonicalHandlingWindow(saved,saved.tasks[0])?.row.dayStart).toBe(choice==='normal'?'10:00':'13:00')
    const proposal=buildPersonalPlan(saved,{now:'2027-04-01T01:00:00Z',startDate:'2027-04-01',days:14,startTime:'09:00',endTime:'17:00',estimateMinutes:30,overrides:{}})
    expect(proposal.segments).toHaveLength(1);expect(proposal.segments[0].start).toContain(choice==='normal'?'2027-04-06T02:00':'2027-04-08T05:00')
    await commitSourceReview(repo,plan);expect((await repo.load())!.tasks).toHaveLength(1)
    expect(()=>applyReceiptOpportunity(saved,h.draftId,{...input,operationId:crypto.randomUUID()})).toThrow('CONFIRMED')
    const altered=structuredClone(saved);altered.tasks[0].legacyData!.receiptGoal={...altered.tasks[0].legacyData!.receiptGoal as object,choice:choice==='normal'?'missed':'normal'}
    expect(canonicalHandlingWindow(altered,altered.tasks[0])).toBeNull()
    const lostChoice=structuredClone(saved);delete lostChoice.tasks[0].legacyData!.receiptGoal
    expect(canonicalHandlingWindow(lostChoice,lostChoice.tasks[0])).toBeNull()
    const roundTrip=JSON.parse(JSON.stringify(saved));expect(canonicalHandlingWindow(roundTrip,roundTrip.tasks[0])).not.toBeNull()
  })
  it('does not schedule undeclared open days and never reopens a completed receipt',async()=>{
    const {repo,h}=await capture(alternativeReceiptFixture()),w=(await repo.load())!,d=(await new IndexedDbWorkspaceRepository(repo).load())!.drafts.find(d=>d.id===h.draftId)!
    await commitSourceReview(repo,buildSourceReviewPlan(w,d));let saved=(await repo.load())!
    const options={now:'2027-04-01T01:00:00Z',startDate:'2027-04-01',days:14,startTime:'09:00',endTime:'17:00',estimateMinutes:30,overrides:{}}
    expect(buildPersonalPlan(saved,options).unscheduled[0].code).toBe('SOURCE_WINDOW_NEEDS_REVIEW')
    saved={...saved,tasks:saved.tasks.map(t=>({...t,status:'completed' as const}))};expect(buildPersonalPlan(saved,options).unscheduled[0].code).toBe('COMPLETED')
  })
  it('rejects a stale competing opportunity choice while preserving the accepted choice and original facts',async()=>{
    const {repo,h}=await capture(alternativeReceiptFixture()),before=(await repo.load())!,view=receiptOpportunityViews(before,h.draftId)[0]
    const input={taskId:view.goal.taskId,choice:'missed' as const,expectedChoice:'normal' as const,expectedResult:workspaceSnapshotHash(before.extractionDrafts[0].result),operationId:crypto.randomUUID()}
    await repo.transaction(w=>applyReceiptOpportunity(w,h.draftId,input))
    const saved=(await repo.load())!
    expect(()=>applyReceiptOpportunity(saved,h.draftId,{...input,choice:'normal',operationId:crypto.randomUUID()})).toThrow('CHANGED')
    expect(receiptOpportunityViews(saved,h.draftId)[0].choice).toBe('missed')
    expect(saved.extractionDrafts[0].result).toEqual(before.extractionDrafts[0].result)
    expect(saved.historyRecords).toHaveLength(1)
  })
  it('retains equipment, applicability and evidence under the real activity rather than a second task',()=>{
    const f=preparation(),out=first(f)
    expect(out.result.standaloneTasks).toHaveLength(0);expect(out.result.events).toHaveLength(1)
    expect(out.result.events[0].description).toContain('入选后需要自行准备绘图板，个人入选结果未知。')
    expect(out.result.events[0].evidenceIds).toContain('rule');expect(out.result.events[0].selected).toBe(false)
    expect(out.audit.sourceObligationViews?.preparations[0].originalTask.tempId).toBe('prepare')
    expect(()=>parseRecognitionResult(out.result)).not.toThrow()
  })
  it('does not call a verified activity requirement missing, but keeps the warning when its live text, evidence or ownership is lost',()=>{
    const f=preparation(),out=first(f),proof=out.audit.sourceObligationViews
    expect(verifiedPreparationRequirements(out.result,f.source,proof)).toHaveLength(1)
    expect(sourceCoverageHints(f.source,out.result,proof).filter(h=>h.kind==='unrepresented_action')).toEqual([])
    for(const change of ['text','proof','owner']){
      const changed=structuredClone(out.result)
      if(change==='text')changed.events[0].description='仅参加活动'
      if(change==='proof')changed.events[0].evidenceIds=['event']
      if(change==='owner')changed.events[0].title='其他工作坊'
      expect(verifiedPreparationRequirements(changed,f.source,proof)).toEqual([])
      expect(sourceCoverageHints(f.source,changed,proof).some(h=>h.kind==='unrepresented_action')).toBe(true)
    }
  })
  it.each([['个人已入选该工作坊。','true'],['个人尚未入选该工作坊。','false'],['个人入选结果未知。','unknown']])('keeps preparation conditions for %s, without inventing a registration prerequisite',(state,value)=>{
    const f=preparation();f.source=f.source.replace('个人入选结果未知。',state);f.r.evidence[1].quote=f.source.split('\n')[1]
    const out=first(f)
    expect(out.audit.sourceObligationViews?.preparations).toHaveLength(1)
    expect(out.audit.sourceObligationViews?.preparations[0].applicability).toBe(value)
    expect(out.result.events[0].selected).toBe(value==='true')
    expect(out.result.events[0].description).toContain(state)
    expect(out.result.events[0].relatedTaskTempIds??[]).toEqual([])
    expect(out.result.standaloneTasks).toHaveLength(0)
  })
  it('does not allow a source-explicit completed receipt to become a second receipt or fallback',async()=>{
    const f=alternativeReceiptFixture(),fact='本人已领取'+f.r.standaloneTasks[0].actionObject+'。'
    f.source+='\n'+fact;f.r.evidence.push({id:'done',sourceId:f.r.evidence[0].sourceId,quote:fact,field:'requirement'});f.r.standaloneTasks[1].evidenceIds.push('done')
    const {repo,h,out}=await capture(f)
    expect(out.audit.sourceObligationViews?.receiptGoals[0].completedInSource).toBe(true)
    expect(out.result.standaloneTasks[0].selected).toBe(false)
    const w=(await repo.load())!,view=receiptOpportunityViews(w,h.draftId)[0]
    expect(()=>applyReceiptOpportunity(w,h.draftId,{taskId:view.goal.taskId,choice:'missed',expectedChoice:'normal',expectedResult:workspaceSnapshotHash(out.result),operationId:crypto.randomUUID()})).toThrow('CONFIRMED')
  })
  it('saves and reads back a deliberately retained activity with its conditional requirements and original proof, without a preparation task',async()=>{
    const f=preparation(),{repo,store,h}=await capture(f)
    await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>d.id===h.draftId?{...d,result:{...d.result!,events:d.result!.events.map(e=>({...e,selected:true}))}}:d)}))
    const w=(await repo.load())!,draft=(await new IndexedDbWorkspaceRepository(repo).load())!.drafts.find(d=>d.id===h.draftId)!
    const plan=buildSourceReviewPlan(w,draft),saved=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),await commitSourceReview(repo,plan))
    expect(saved.tasks).toHaveLength(0);expect(saved.events).toHaveLength(1)
    expect(saved.events[0].description).toContain('入选后需要自行准备绘图板，个人入选结果未知。')
    expect(saved.events[0].legacyData?.evidenceIds).toContain('rule')
    expect(saved.evidenceRefs.some(e=>e.quotedText?.includes('绘图板'))).toBe(true)
    const restored=JSON.parse(JSON.stringify(saved));expect(restored.events).toEqual(saved.events)
    expect(restored.extractionDrafts[0].legacyData.firstSuggestionAssembly.sourceObligationViews.preparations[0].originalTask.actionObject).toBe('绘图板')
  })
  it.each(['own cutoff','other office','two activities','unextracted activity heading','incoming dependency','wrong source','negative rule'])('does not swallow an independent or ambiguous preparation: %s',kind=>{
    const f=preparation()
    if(kind==='own cutoff'){f.source=f.source.replace('入选后','4月10日17:00前截止，入选后');f.r.evidence[1].quote=f.source.split('\n')[1]}
    if(kind==='other office'){f.source=f.source.replace('自行准备','到另一办公室准备');f.r.evidence[1].quote=f.source.split('\n')[1]}
    if(kind==='two activities')f.r.events.push({...f.r.events[0],tempId:'second',title:'另一工作坊'})
    if(kind==='unextracted activity heading')f.source=f.source.replace('\n入选后','\n辩论赛：入选后')
    if(kind==='incoming dependency')f.r.standaloneTasks.push({...f.r.standaloneTasks[0],tempId:'next',dependencyTempIds:['prepare']})
    if(kind==='wrong source')f.r.evidence[1].sourceId='other-source'
    if(kind==='negative rule'){f.source=f.source.replace('需要自行准备','不得准备');f.r.evidence[1].quote=f.source.split('\n')[1]}
    expect(first(f).audit.sourceObligationViews?.preparations??[]).toEqual([])
  })
})
