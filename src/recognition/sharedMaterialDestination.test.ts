import {it,expect} from 'vitest'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {assembleCurrentFirstSuggestion} from './materialChannelGrounding'
import {emptyWorkspace} from '../experiments/mainline01/fixtures'
import {MemoryWorkspaceRecordStore,CanonicalWorkspaceRepository} from '../domain/v2/repository'
import {CapturePersistenceService} from '../domain/v2/capture'
import {IndexedDbWorkspaceRepository} from '../lib/repository'
import {buildSourceReviewPlan,commitSourceReview,verifySourceReviewReadback} from '../domain/v2/sourceReviewD26'
function fixture(second='并于2027年4月8日12:00向乙方窗口提交同一份实验清单'){
 const r=ordinaryWorkflowFixture(),a='请于2027年4月6日16:00向甲方窗口提交实验清单',source=a+'，'+second+'。',t=r.standaloneTasks[0],m=r.materials[0];r.projectMatch.decision='standalone_task';r.projectSuggestion=null;r.milestones=[];r.events=[];r.conflicts=[];r.ambiguities=[];r.evidence=[{id:'A',sourceId:'pending-source',quote:a,field:'requirement'},{id:'B',sourceId:'pending-source',quote:second,field:'requirement'}];r.standaloneTasks=['A','B'].map((id,i)=>({...t,tempId:'T'+id,title:'提交实验清单',actionVerb:'提交',actionObject:'实验清单',parentTempId:null,description:r.evidence[i].quote,completionCriteria:[r.evidence[i].quote],materialTempIds:['M'],timePointTempIds:[],dependencyTempIds:[],evidenceIds:[id],selected:true}));r.materials=[{...m,tempId:'M',name:'实验清单',submissionChannel:'甲方窗口；乙方窗口',relatedTaskTempIds:['TA','TB'],evidenceIds:['A','B']}];r.timePoints=[];return{r,source}
}
it('literal 同一份 keeps the same named shared material and separately cited destinations through the ordinary commit',async()=>{
 const{r,source}=fixture(),before=structuredClone(r),p=assembleCurrentFirstSuggestion(r,{sourceText:source,referenceTime:'2027-04-01T09:00:00+08:00',timezone:'Asia/Shanghai'});expect(p.materialChannelAudit.decisions[0].status).toBe('EXPLICIT_OWNER_CHANNELS');expect(p.result.standaloneTasks.every(t=>t.selected)).toBe(true);expect(p.result.materials[0].submissionChannel).toBe('甲方窗口；乙方窗口');expect(r).toEqual(before);
 const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.initialize(emptyWorkspace());const service=new CapturePersistenceService(repo),h=await service.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',rawText:source,title:'共享清单',provider:'manual',modelName:'anonymous-fixture',promptVersion:'fixture',pipelineVersion:'fixture'});await service.recognize(h,async()=>p.result);const view=(await new IndexedDbWorkspaceRepository(repo).load())!;const receipt=await commitSourceReview(repo,buildSourceReviewPlan((await repo.load())!,view.drafts[0]));const back=await verifySourceReviewReadback(repo,receipt);expect(back.tasks).toHaveLength(2);expect(back.materials).toHaveLength(1);expect(back.materials[0].relatedTaskIds).toHaveLength(2)
})
it('a material suffix, another object, conditional destination and a receipt remain unsupported',()=>{
 for(const text of ['并于2027年4月8日12:00向乙方窗口提交同一份实验清单照片','并于2027年4月8日12:00向乙方窗口提交同一份海报','若获准则于2027年4月8日12:00向乙方窗口提交同一份实验清单','乙方窗口显示实验清单接收成功']){const{r,source}=fixture(text),p=assembleCurrentFirstSuggestion(r,{sourceText:source,referenceTime:'2027-04-01T09:00:00+08:00',timezone:'Asia/Shanghai'});expect(p.materialChannelAudit.decisions[0].status).toBe('UNSUPPORTED_OR_AMBIGUOUS_CHANNEL');expect(p.result.materials[0].submissionChannel).toBeNull();expect(p.result.conflicts.length).toBeGreaterThan(0)}
})
