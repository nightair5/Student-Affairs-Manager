import {describe,it,expect} from 'vitest'
import {emptyWorkspace,artificialResponse,notices} from '../../experiments/mainline01/fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {IndexedDbWorkspaceRepository} from '../../lib/repository'
import {buildSourceReviewPlan,commitSourceReview,verifySourceReviewReadback,acknowledgeSourceReadback,PENDING_SOURCE_READBACK,sourceReviewProblem} from './sourceReviewD26'
import {updateDraftItem} from '../../lib/workspace'

async function setup(kind:'no-date'|'multi'|'information',text=notices[kind]){
  const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store)
  await repo.initialize(emptyWorkspace())
  const capture=new CapturePersistenceService(repo),handle=await capture.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',title:kind,rawText:text,provider:'manual',modelName:'anonymous-engineering',promptVersion:'test',pipelineVersion:'d26-test'})
  await capture.recognize(handle,async()=>artificialResponse(kind,handle.sourceId))
  const viewRepo=new IndexedDbWorkspaceRepository(repo),view=(await viewRepo.load())!
  return {store,repo,capture,handle,viewRepo,view,draft:view.drafts[0]}
}
describe('D26 ordinary source review through real capture/repository/DomainCommitPlan',()=>{
  it('accepts a genuine no-deadline obligation without inventing a time or project',async()=>{
    const x=await setup('no-date'),plan=buildSourceReviewPlan((await x.repo.load())!,x.draft)
    expect(plan.create.tasks).toHaveLength(1);expect(plan.create.timePoints).toHaveLength(0)
    const receipt=await commitSourceReview(x.repo,plan),read=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(x.store),receipt)
    expect(read.tasks[0].nextAction).toContain('保存');expect(read.projects).toHaveLength(0)
    await acknowledgeSourceReadback(x.repo,receipt)
    expect((await x.repo.load())!.extractionDrafts[0].legacyData?.[PENDING_SOURCE_READBACK]).toBeUndefined()
  })
  it('adopts an actual user date as a manual personal plan, leaving the source untimed',async()=>{
    const x=await setup('no-date'),draft=updateDraftItem(x.draft,x.draft.items[0].id,{deadline:'2026-10-12'})
    await x.viewRepo.save({...x.view,drafts:[draft]})
    const plan=buildSourceReviewPlan((await x.repo.load())!,draft)
    expect(plan.create.timePoints).toHaveLength(1)
    expect(plan.create.timePoints[0]).toMatchObject({type:'planned_start',normalizedValue:'2026-10-12',legacyData:{extractionMethod:'manual',meaning:'personal_plan_not_source_deadline'}})
  })
  it('persists zero-task information without manufacturing any domain facts',async()=>{
    const x=await setup('information'),plan=buildSourceReviewPlan((await x.repo.load())!,x.draft),receipt=await commitSourceReview(x.repo,plan)
    const read=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(x.store),receipt)
    expect(read.tasks).toHaveLength(0);expect(read.projects).toHaveLength(0);expect(read.extractionDrafts[0].status).toBe('confirmed')
  })
  it('event-only unknown-time source remains unknown and creates no project',async()=>{
    const x=await setup('information','平台将于周三晚停机，仅供了解，不要求操作。'),r=x.draft.recognitionResult!
    r.events=[{tempId:'stop',title:'平台停机',description:'',location:null,startTimePointTempId:'time',endTimePointTempId:null,evidenceIds:['notice'],confidence:1,inferenceLevel:'explicit',selected:true}]
    r.timePoints=[{tempId:'time',type:'event_start',rawText:'周三晚',normalizedValue:null,timezone:'Asia/Shanghai',isAllDay:false,precision:'vague',needsConfirmation:true,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:['notice'],confidence:1,selected:true}]
    await x.viewRepo.save(x.view)
    const plan=buildSourceReviewPlan((await x.repo.load())!,x.draft),receipt=await commitSourceReview(x.repo,plan)
    const read=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(x.store),receipt)
    expect(read.events).toHaveLength(1);expect(read.projects).toHaveLength(0);expect(read.timePoints[0]).toMatchObject({normalizedValue:null,rawText:'周三晚',precision:'vague',needsConfirmation:true})
  })
  it('source version changed after planning rejects atomically, preserving the historical source',async()=>{
    const x=await setup('no-date'),old=(await x.repo.load())!,plan=buildSourceReviewPlan(old,x.draft)
    await x.capture.beginRevision(x.handle.sourceId,{operationId:crypto.randomUUID(),rawText:'新通知要求下载手册。',provider:'manual',modelName:null,promptVersion:null,pipelineVersion:'d26-test'})
    await expect(commitSourceReview(x.repo,plan)).rejects.toThrow('SOURCE_VERSION_CHANGED')
    const read=(await x.repo.load())!;expect(read.tasks).toHaveLength(0);expect(read.sourceVersions.find(v=>v.id===x.handle.sourceVersionId)?.rawText).toBe(notices['no-date'])
  })
  it('repeated formal submission is idempotent and readback failure leaves a durable receipt',async()=>{
    const x=await setup('multi'),plan=buildSourceReviewPlan((await x.repo.load())!,x.draft),receipt=await commitSourceReview(x.repo,plan)
    await commitSourceReview(x.repo,plan)
    const unavailable={load:async()=>{throw Error('injected readback failure')}}
    await expect(verifySourceReviewReadback(unavailable,receipt)).rejects.toThrow('injected')
    const read=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(x.store),receipt)
    expect(read.tasks).toHaveLength(2);expect(read.extractionDrafts[0].legacyData?.[PENDING_SOURCE_READBACK]).toMatchObject({commitId:receipt.commitId})
  })
  it('a forward-only time link is blocked instead of silently discarded',async()=>{
    const x=await setup('multi'),r=x.draft.recognitionResult!,t=r.standaloneTasks[0],p=r.timePoints.find(p=>t.timePointTempIds.includes(p.tempId))!
    p.relatedTaskTempIds=[]
    expect(sourceReviewProblem(r,t.tempId)).toContain('两侧关联不一致')
  })
  it('one invalid event cannot erase an unrelated valid event; receipt stays partial',async()=>{
    const x=await setup('information','平台将于周三晚停机，仅供了解，不要求操作。'),r=x.draft.recognitionResult!
    const base={description:'',location:null,endTimePointTempId:null,evidenceIds:['notice'],confidence:1,inferenceLevel:'explicit' as const,selected:true}
    r.events=[{...base,tempId:'bad',title:'待核对事件',startTimePointTempId:null},{...base,tempId:'good',title:'平台停机',startTimePointTempId:null}]
    r.conflicts=[{id:'event-conflict',type:'other',message:'事件关系待核对',entityTempIds:['bad'],evidenceIds:['notice'],requiresDecision:true}]
    await x.viewRepo.save(x.view)
    const plan=buildSourceReviewPlan((await x.repo.load())!,x.draft),receipt=await commitSourceReview(x.repo,plan)
    expect(plan.create.events.map(e=>e.title)).toEqual(['平台停机']);expect(receipt.disposition).toBe('partial')
  })
  it('individual task confirmation remains partial and unverified materials remain unknown',async()=>{
    const x=await setup('multi'),plan=buildSourceReviewPlan((await x.repo.load())!,x.draft,x.draft.items[0].id)
    expect(plan.create.materials.every(m=>m.status==='unverified')).toBe(true)
    const receipt=await commitSourceReview(x.repo,plan);expect(receipt.disposition).toBe('partial')
    const reader=new CanonicalWorkspaceRepository(x.store),read=(await reader.load())!
    read.tasks[0].title='篡改事实'
    await expect(verifySourceReviewReadback({load:async()=>read},receipt)).rejects.toThrow('VALUE_CHANGED')
  })
  it('a source deadline correction remains a deadline instead of a personal plan',async()=>{
    const x=await setup('multi'),draft=updateDraftItem(x.draft,x.draft.items[0].id,{deadline:'2026-09-12'})
    await x.viewRepo.save({...x.view,drafts:[draft]})
    const plan=buildSourceReviewPlan((await x.repo.load())!,draft,draft.items[0].id)
    expect(plan.create.timePoints.some(p=>p.type==='task_deadline'&&p.normalizedValue==='2026-09-12')).toBe(true)
  })

})
