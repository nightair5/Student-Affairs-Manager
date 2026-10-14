import {it,expect} from 'vitest'
import {createAuthorityFixture} from '../../experiments/candidate19Recorded/singleAuthorityFixtures'
import {decodeSingleAuthorityRecording} from '../../recognition/sourceContractV5'
import {emptyWorkspace} from '../../experiments/mainline01/fixtures'
import {MemoryWorkspaceRecordStore,CanonicalWorkspaceRepository} from './repository'
import {CapturePersistenceService} from './capture'
import {IndexedDbWorkspaceRepository} from '../../lib/repository'
import {buildSourceReviewPlan,commitSourceReview} from './sourceReviewD26'
import {buildPersonalPlan,defaultPlanOptions,planBaseline} from './personalPlanD27'
it('actual source-window capture constrains the reused D27 planner, without creating a deadline',async()=>{
 const x=await createAuthorityFixture('window'),store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store)
 await repo.initialize(emptyWorkspace());const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',rawText:x.sourceText,title:'原文办理窗口',provider:'manual',modelName:'ENGINEERING_FIXTURE',promptVersion:'test',pipelineVersion:'test'})
 const decoded=decodeSingleAuthorityRecording(x.rawHttpText,x.context)
 await capture.recognize(h,async()=>decoded.result)
 await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>d.id===h.draftId?{...d,legacyData:{...d.legacyData,semanticSidecar:JSON.parse(JSON.stringify(decoded.sidecar))}}:d)}))
 const view=(await new IndexedDbWorkspaceRepository(repo).load())!;await commitSourceReview(repo,buildSourceReviewPlan((await repo.load())!,view.drafts[0]));const w=(await repo.load())!,before=structuredClone(w.timePoints)
 expect(w.timePoints.map(p=>p.legacyData?.sourceTimeRole).sort()).toEqual(['window_end','window_start'])
 const outside=buildPersonalPlan(w,defaultPlanOptions(new Date('2026-10-06T09:00:00+08:00')))
 expect(outside.segments).toHaveLength(0);expect(outside.unscheduled[0].code).toBe('SOURCE_WINDOW_OUTSIDE_PLAN')
 const within=buildPersonalPlan(w,{...defaultPlanOptions(new Date('2026-11-06T09:00:00+08:00')),days:3})
 expect(within.segments).toHaveLength(1);expect(within.segments[0].start).toBe('2026-11-06T01:00:00.000Z');expect(within.segments[0].originalDeadline).toBeNull()
 const manual=buildPersonalPlan(w,{...defaultPlanOptions(new Date('2026-11-06T09:00:00+08:00')),days:3,overrides:{[w.tasks[0].id]:{start:'2026-11-08T16:50'}}})
 expect(manual.unscheduled[0].code).toBe('INVALID_MANUAL_SLOT');expect(w.timePoints).toEqual(before)
 const baseline=planBaseline(w);w.timePoints[0].legacyData!.sourceTimeRole='window_end';expect(planBaseline(w)).not.toBe(baseline)
 expect(buildPersonalPlan(w,defaultPlanOptions(new Date('2026-11-06T09:00:00+08:00'))).unscheduled[0].code).toBe('SOURCE_WINDOW_NEEDS_REVIEW')
})
