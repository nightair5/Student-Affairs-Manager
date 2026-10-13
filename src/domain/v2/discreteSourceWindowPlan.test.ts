import { describe, expect, it } from 'vitest'
import { createTaskRequirementsFixture } from '../../experiments/candidate19Recorded/taskRequirementsFixtures'
import { emptyWorkspace } from '../../experiments/mainline01/fixtures'
import { decodeTaskTimeAuthorityRecording, TASK_TIME_AUTHORITY_VERSION, type TaskTimeAuthorityFacts } from '../../recognition/taskTimeAuthorityContract'
import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { MemoryWorkspaceRecordStore, CanonicalWorkspaceRepository } from './repository'
import { CapturePersistenceService } from './capture'
import { IndexedDbWorkspaceRepository } from '../../lib/repository'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback } from './sourceReviewD26'
import { importWorkspaceV8, exportWorkspaceV8 } from './serialization'
import { applyPersonalPlan, acknowledgePersonalPlan, buildPersonalPlan, defaultPlanOptions, planBaseline, storedPersonalPlans, verifyPersonalPlan } from './personalPlanD27'
import type { WorkspaceV8, JsonValue } from './types'

const NOW = '2027-03-06T10:00:00+08:00'
async function setup(options: { dates?:string;sessions?:string[];unknown?:boolean;noAudit?:boolean } = {}) {
  const base=await createTaskRequirementsFixture(),dates=options.dates??'2027年3月6至7日',sessions=options.sessions??['上午09:00-11:30','下午14:00-17:00']
  const windowText=options.unknown?'办理日期尚未公布':`办理窗口：${dates}${sessions.length?'（'+sessions.join('，')+'）':''}`
  const sourceText=`请提交设备借用申请。${windowText}。提交截止为2027年3月10日。`
  const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store)
  await repo.initialize(emptyWorkspace())
  const capture=new CapturePersistenceService(repo),handle=await capture.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',title:'匿名离散办理窗口工程夹具',rawText:sourceText,provider:'manual',modelName:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT',promptVersion:'test',pipelineVersion:'test'})
  const context={...base.context,referenceTime:'2027-03-01T09:00:00+08:00',index:await indexImmutableScopesV11(handle.sourceId,handle.sourceVersionId,sourceText)}
  const scopes=(text:string)=>{const start=sourceText.indexOf(text),end=start+text.length;if(start<0)throw Error('FIXTURE_LITERAL');return context.index.scopes.filter(s=>s.start<end&&s.end>start).map(s=>s.id)}
  const {coverage,...old}=base.facts.tasks[0];void coverage
  const task:TaskTimeAuthorityFacts['tasks'][number]={...old,id:'T1',action:{surface:'提交',scopeId:scopes('请提交')[0]},object:{surface:'设备借用申请',scopeId:scopes('请提交')[0]},
    propositionScopeIds:context.index.scopes.map(s=>s.id),participation:{mode:'required',scopeIds:scopes('请提交')},executionChannel:null,absences:[],
    detail:{...old.detail,title:'提交设备借用申请',description:'',completionCriteria:[],dependencyTempIds:[]},
    timeFacts:{deadlines:[{type:'submission_deadline',rawText:'2027年3月10日',scopeIds:scopes('2027年3月10日'),confidence:1}],actionTimes:[],
      windows:[{rawText:windowText,scopeIds:scopes(windowText),dateText:options.unknown?windowText:dates,dateScopeIds:scopes(options.unknown?windowText:dates),confidence:1,
        sessions:options.unknown?[]:sessions.map(rawText=>{const[startText,endText]=rawText.split('-');return{rawText,startText,endText,scopeIds:scopes(rawText)}})}]}}
  const facts:TaskTimeAuthorityFacts={...base.facts,schemaVersion:TASK_TIME_AUTHORITY_VERSION,tasks:[task],materials:[],events:[],timePoints:[],requirements:[],revisions:[],conflicts:[],prerequisiteStates:[],
    scopeAccounting:context.index.scopes.map(s=>({scopeId:s.id,kind:'action',primaryEntityIds:['T1']}))}
  const raw=JSON.stringify({model:'deepseek-flash',status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(facts)}]}],usage:{input_tokens:0,output_tokens:0}})
  const decoded=decodeTaskTimeAuthorityRecording(raw,context)
  await capture.recognize(handle,async()=>decoded.result)
  if(!options.noAudit)await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>d.id===handle.draftId?{...d,legacyData:{...d.legacyData,semanticSidecar:JSON.parse(JSON.stringify(decoded.sidecar))}}:d)}))
  const view=(await new IndexedDbWorkspaceRepository(repo).load())!,sourcePlan=buildSourceReviewPlan((await repo.load())!,view.drafts[0])
  const receipt=await commitSourceReview(repo,sourcePlan),w=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),receipt)
  const opts={...defaultPlanOptions(new Date(NOW)),startDate:'2027-03-06',days:3,startTime:'08:00',endTime:'18:00'}
  return {store,repo,w,opts,handle,raw,decoded}
}
const declarations=(w:WorkspaceV8)=>w.tasks[0].legacyData!.sourceWindowDeclarations as Record<string,JsonValue>
const firstWindow=(w:WorkspaceV8)=>(declarations(w).windows as Array<Record<string,JsonValue>>)[0]

describe('explicit paired source windows through ordinary confirmation and reused D27',()=>{
  it('round-trips four real source intervals and schedules one continuous slot without replacing the deadline',async()=>{
    const x=await setup(),before=structuredClone(x.w.timePoints),meta=declarations(x.w)
    expect(x.w.tasks).toHaveLength(1);expect(x.w.events).toHaveLength(0);expect(x.w.projects).toHaveLength(0)
    expect(x.w.timePoints).toHaveLength(9)
    expect(meta).toMatchObject({ownerTaskId:x.w.tasks[0].id,ownerTempId:'T1',sourceVersionId:x.handle.sourceVersionId})
    expect(firstWindow(x.w).intervals).toHaveLength(4)
    const plan=buildPersonalPlan(x.w,x.opts,'inside'),segment=plan.segments[0]
    expect(segment.start).toBe('2027-03-06T02:00:00.000Z');expect(segment.end).toBe('2027-03-06T02:30:00.000Z')
    expect(segment.originalDeadline).toBe('2027年3月10日')
    const receipt=await applyPersonalPlan(x.repo,plan,()=>new Date(NOW)),read=await verifyPersonalPlan(new CanonicalWorkspaceRepository(x.store),receipt)
    expect(read.timePoints.filter(p=>p.type!=='planned_start')).toEqual(before)
    expect(importWorkspaceV8(exportWorkspaceV8(read))).toEqual(read)
    expect(storedPersonalPlans(read)).toHaveLength(1)
  })
  it('afternoon allocation skips lunch; the last afternoon moves to the next morning, never through overnight',async()=>{
    const x=await setup()
    const lunch=buildPersonalPlan(x.w,{...x.opts,now:'2027-03-06T11:15:00+08:00'})
    expect(lunch.segments[0].start).toBe('2027-03-06T06:00:00.000Z')
    const overnight=buildPersonalPlan(x.w,{...x.opts,now:'2027-03-06T16:45:00+08:00'})
    expect(overnight.segments[0].start).toBe('2027-03-07T01:00:00.000Z')
    expect(buildPersonalPlan(x.w,{...x.opts,estimateMinutes:240}).unscheduled[0].code).toBe('CAPACITY')
  })
  it.each(['2027-03-06T11:15','2027-03-06T12:30','2027-03-06T16:45','2027-03-07T18:00','2027-03-08T09:00'])('manual slot %s cannot cross or escape one source interval',async start=>{
    const x=await setup(),taskId=x.w.tasks[0].id
    expect(buildPersonalPlan(x.w,{...x.opts,overrides:{[taskId]:{start}}}).unscheduled[0].code).toBe('INVALID_MANUAL_SLOT')
  })
  it('a retained locked plan in a closed gap remains visible with LOCK_CONFLICT and is not moved silently',async()=>{
    const x=await setup(),id=x.w.tasks[0].id
    const accepted=buildPersonalPlan(x.w,{...x.opts,overrides:{[id]:{start:'2027-03-06T14:00',locked:true}}},'locked')
    const receipt=await applyPersonalPlan(x.repo,accepted,()=>new Date(NOW));await acknowledgePersonalPlan(x.repo,receipt)
    const w=(await x.repo.load())!,point=w.timePoints.find(p=>p.legacyData?.personalPlanD27)!
    point.normalizedValue='2027-03-06T12:00:00+08:00'
    const plan=buildPersonalPlan(w,x.opts)
    expect(plan.segments[0]).toMatchObject({start:'2027-03-06T04:00:00.000Z',retained:true,locked:true})
    expect(plan.unscheduled[0].code).toBe('LOCK_CONFLICT')
  })
  it.each(['missing-pairs','wrong-owner','wrong-value','duplicate-point','foreign-evidence','removed-point','wrong-source','missing-metadata','wrong-state','wrong-pair-date','wrong-draft'] as const)('pair damage %s locally blocks this task and does not erase an unrelated task',async kind=>{
    const x=await setup(),w=x.w,meta=declarations(w),window=firstWindow(w),pair=(window.intervals as Array<Record<string,JsonValue>>)[0]
    if(kind==='missing-pairs')window.intervals=[]
    if(kind==='wrong-owner')w.timePoints.find(p=>p.id===pair.startPointId)!.relatedTaskIds=[]
    if(kind==='wrong-value')pair.start='2027-03-06T07:00'
    if(kind==='duplicate-point')pair.endPointId=pair.startPointId
    if(kind==='foreign-evidence')w.evidenceRefs.forEach(e=>e.sourceVersionId='different-source-version')
    if(kind==='removed-point')w.timePoints=w.timePoints.filter(p=>p.id!==pair.endPointId)
    if(kind==='wrong-source')meta.sourceVersionId='different-source-version'
    if(kind==='missing-metadata')delete w.tasks[0].legacyData!.sourceWindowDeclarations
    if(kind==='wrong-state')window.state='RESOLVED_DATE_RANGE'
    if(kind==='wrong-pair-date')pair.date='2027-03-09'
    if(kind==='wrong-draft')meta.draftId='foreign-draft'
    w.tasks.push({...structuredClone(w.tasks[0]),id:'unrelated',title:'保存另一份说明',legacyData:{sourceId:x.handle.sourceId,recognitionTempId:'OTHER'}})
    const plan=buildPersonalPlan(w,x.opts)
    expect(plan.unscheduled.find(u=>u.taskId===w.tasks[0].id)?.code).toBe('SOURCE_WINDOW_NEEDS_REVIEW')
    expect(plan.segments.map(s=>s.taskId)).toContain('unrelated')
  })
  it('preview read-set binds pair metadata and rejects a stale transaction before adding any plan',async()=>{
    const x=await setup(),plan=buildPersonalPlan(x.w,x.opts,'read-set')
    const before=planBaseline(x.w)
    await x.repo.transaction(w=>{const metadata=declarations(w);metadata.windows=[];return w})
    expect(planBaseline((await x.repo.load())!)).not.toBe(before)
    await expect(applyPersonalPlan(x.repo,plan,()=>new Date(NOW))).rejects.toThrow('PERSONAL_PLAN_INPUTS_CHANGED')
    expect(storedPersonalPlans((await x.repo.load())!)).toHaveLength(0)
  })
  it('unpublished dates and missing audit retain facts but never acquire a fabricated calendar slot',async()=>{
    for(const options of [{unknown:true},{noAudit:true}]){
      const x=await setup(options),plan=buildPersonalPlan(x.w,x.opts)
      expect(plan.segments).toHaveLength(0);expect(plan.unscheduled[0].code).toBe('SOURCE_WINDOW_NEEDS_REVIEW')
      if(options.unknown)expect(x.w.timePoints.filter(p=>p.type.startsWith('event_')).every(p=>p.normalizedValue===null&&p.needsConfirmation)).toBe(true)
    }
  })
  it('calendar-only windows keep date-only facts and constrain internal personal slots by whole stated days',async()=>{
    const x=await setup({sessions:[]}),plan=buildPersonalPlan(x.w,{...x.opts,now:'2027-03-07T17:00:00+08:00'})
    expect(plan.unscheduled).toEqual([])
    expect(x.w.timePoints.filter(p=>p.type.startsWith('event_')).map(p=>[p.normalizedValue,p.precision])).toEqual([['2027-03-06','date_only'],['2027-03-07','date_only']])
    expect(plan.segments[0].start).toBe('2027-03-07T09:00:00.000Z')
    expect(buildPersonalPlan(x.w,{...x.opts,now:'2027-03-08T09:00:00+08:00',startDate:'2027-03-08'}).unscheduled[0].code).toBe('SOURCE_WINDOW_OUTSIDE_PLAN')
  })
  it('a failed transaction leaves no plan; manual retry then independent read-only recovery creates one commit',async()=>{
    const x=await setup(),proposal=buildPersonalPlan(x.w,x.opts,'recover');let fail=true
    const repo=new CanonicalWorkspaceRepository({read:k=>x.store.read(k),write:(k,v)=>x.store.write(k,v),remove:k=>x.store.remove(k),transactionMany:(k,f)=>x.store.transactionMany(k,f),transaction:(k,f)=>x.store.transaction(k,raw=>{const next=f(raw);if(fail){fail=false;throw Error('INJECTED_FORMAL_SAVE_FAILURE')}return next})})
    await expect(applyPersonalPlan(repo,proposal,()=>new Date(NOW))).rejects.toThrow('INJECTED_FORMAL_SAVE_FAILURE')
    expect(storedPersonalPlans((await x.repo.load())!)).toHaveLength(0)
    const receipt=await applyPersonalPlan(repo,proposal,()=>new Date(NOW))
    await expect(verifyPersonalPlan({load:async()=>{throw Error('READ_UNAVAILABLE')}},receipt)).rejects.toThrow('READ_UNAVAILABLE')
    expect(await applyPersonalPlan(repo,proposal,()=>new Date(NOW))).toEqual(receipt)
    const read=await verifyPersonalPlan(new CanonicalWorkspaceRepository(x.store),receipt)
    expect(read.historyRecords.filter(h=>h.action==='personal_plan')).toHaveLength(1)
    expect(storedPersonalPlans(read)).toHaveLength(1)
  })
})
