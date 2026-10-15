import {it,expect} from 'vitest'
import {ordinaryWorkflowFixture} from '../../recognition/ordinaryProviderSupport.fixture'
import {assembleCurrentFirstSuggestion} from '../../recognition/materialChannelGrounding'
import {emptyWorkspace} from '../../experiments/mainline01/fixtures'
import {MemoryWorkspaceRecordStore,CanonicalWorkspaceRepository} from './repository'
import {CapturePersistenceService} from './capture'
import {IndexedDbWorkspaceRepository} from '../../lib/repository'
import {buildSourceReviewPlan,commitSourceReview} from './sourceReviewD26'
import {buildPersonalPlan,defaultPlanOptions,planBaseline} from './personalPlanD27'
it('ordinary shared native date window survives formal confirmation and constrains plans without a sidecar',async()=>{
 const r=ordinaryWorkflowFixture(),source='同学须在4月12—26日登录选课系统和激活账号。',t=r.standaloneTasks[0];r.projectMatch.decision='standalone_task';r.projectSuggestion=null;r.milestones=[];r.materials=[];r.events=[];r.conflicts=[];r.ambiguities=[];
 r.evidence=[{id:'Q',sourceId:'pending-source',quote:source,field:'requirement'}];r.standaloneTasks=[['A','登录','选课系统'],['B','激活','账号']].map(([tempId,actionVerb,actionObject])=>({...t,tempId,title:actionVerb+actionObject,actionVerb,actionObject,parentTempId:null,dependencyTempIds:[],materialTempIds:[],timePointTempIds:['S','E'],evidenceIds:['Q'],estimatedMinutes:15,selected:true}));
 r.timePoints=['S','E'].map((tempId,i)=>({tempId,type:i?'event_end':'event_start',rawText:'4月12—26日',normalizedValue:i?'2027-04-26':'2027-04-12',timezone:'Asia/Shanghai',isAllDay:true,precision:'date_only',needsConfirmation:false,relatedTaskTempIds:['A','B'],relatedMaterialTempIds:[],evidenceIds:['Q'],confidence:1,selected:true}));
 const result=assembleCurrentFirstSuggestion(r,{sourceText:source,referenceTime:'2027-04-01T09:00:00+08:00',timezone:'Asia/Shanghai'}).result,store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store);await repo.initialize(emptyWorkspace());const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',rawText:source,title:'选课窗口',provider:'manual',modelName:'fixture',promptVersion:'native',pipelineVersion:'fixture'});await capture.recognize(h,async()=>result);
 const view=(await new IndexedDbWorkspaceRepository(repo).load())!;await commitSourceReview(repo,buildSourceReviewPlan((await repo.load())!,view.drafts[0]));const w=(await repo.load())!,before=structuredClone(w);
 const outside=buildPersonalPlan(w,defaultPlanOptions(new Date('2027-05-01T09:00:00+08:00')));expect(outside.segments).toHaveLength(0);expect(outside.unscheduled.map(x=>x.code)).toEqual(['SOURCE_WINDOW_OUTSIDE_PLAN','SOURCE_WINDOW_OUTSIDE_PLAN']);
 const inside=buildPersonalPlan(w,defaultPlanOptions(new Date('2027-04-14T09:00:00+08:00')));expect(inside.segments).toHaveLength(2);expect(inside.segments.every(s=>s.originalDeadline===null)).toBe(true);expect(w).toEqual(before);
 const changedGraph=structuredClone(w);changedGraph.extractionDrafts[0].result!.timePoints[0].evidenceIds=[];expect(planBaseline(changedGraph)).not.toBe(planBaseline(w));
 const broken=structuredClone(w);broken.timePoints.find(p=>p.type==='event_end')!.normalizedValue='2027-04-25';expect(buildPersonalPlan(broken,defaultPlanOptions(new Date('2027-04-14T09:00:00+08:00'))).segments).toHaveLength(0);
 const foreign=structuredClone(w);foreign.evidenceRefs.forEach(e=>e.quotedText='另一个来源');expect(buildPersonalPlan(foreign,defaultPlanOptions(new Date('2027-04-14T09:00:00+08:00'))).segments).toHaveLength(0)
})
