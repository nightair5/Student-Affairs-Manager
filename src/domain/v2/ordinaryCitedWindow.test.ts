import {describe,it,expect} from 'vitest'
import {ordinaryWorkflowFixture} from '../../recognition/ordinaryProviderSupport.fixture'
import {assembleCurrentFirstSuggestion} from '../../recognition/materialChannelGrounding'
import {parseRecognitionResult} from '../../recognition/schema'
import {emptyWorkspace} from '../../experiments/mainline01/fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {IndexedDbWorkspaceRepository} from '../../lib/repository'
import {buildSourceReviewPlan,commitSourceReview,verifySourceReviewReadback} from './sourceReviewD26'
import {buildPersonalPlan,defaultPlanOptions} from './personalPlanD27'
function fixture(source='请于2027年3月4日09:00—11:00到事务窗口递交申请书。'){
 const r=ordinaryWorkflowFixture(source),t=r.standaloneTasks[0],m=r.materials[0];t.actionVerb='递交';t.actionObject='申请书';t.title='递交申请书';t.estimatedMinutes=30;t.evidenceIds=['E'];t.timePointTempIds=['P'];m.name='申请书';m.submissionChannel='事务窗口';m.evidenceIds=['E'];r.evidence=[{id:'E',sourceId:'pending-source',quote:source,field:'description'}];r.timePoints=[{tempId:'P',type:'submission_deadline',rawText:'2027年3月4日09:00—11:00',normalizedValue:'2027-03-04T09:00',timezone:'Asia/Shanghai',isAllDay:false,precision:'exact',needsConfirmation:false,relatedTaskTempIds:[t.tempId],relatedMaterialTempIds:[m.tempId],evidenceIds:['E'],confidence:1,selected:true}];return{r,source}
}
describe('ordinary quoted interval through first Schema, capture, canonical confirmation and D27',()=>{
 it('retains two literal bounds, removes false cutoff, persists and schedules within the actual window',async()=>{
  const {r,source}=fixture(),store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store);await repo.initialize(emptyWorkspace());const capture=new CapturePersistenceService(repo),handle=await capture.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',title:'匿名办理窗口',rawText:source,provider:'manual',modelName:'engineering',promptVersion:'test',pipelineVersion:'test'})
  r.evidence.forEach(e=>e.sourceId=handle.sourceId)
  const f=assembleCurrentFirstSuggestion(parseRecognitionResult(r),{sourceText:source,referenceTime:'2027-03-03T08:00:00+08:00',timezone:'Asia/Shanghai'});expect(()=>parseRecognitionResult(f.result)).not.toThrow();expect(f.result.timePoints.map(p=>[p.type,p.normalizedValue])).toEqual([['event_start','2027-03-04T09:00'],['event_end','2027-03-04T11:00']])
  await capture.recognize(handle,async()=>f.result);await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>d.id===handle.draftId?{...d,legacyData:{...d.legacyData,firstSuggestionAssembly:JSON.parse(JSON.stringify(f.audit))}}:d)}))
  const view=(await new IndexedDbWorkspaceRepository(repo).load())!,plan=buildSourceReviewPlan((await repo.load())!,view.drafts[0]),receipt=await commitSourceReview(repo,plan),w=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),receipt)
  expect(w.tasks).toHaveLength(1);expect(w.timePoints).toHaveLength(2);expect(w.timePoints.some(p=>p.type.endsWith('_deadline'))).toBe(false)
  const p=buildPersonalPlan(w,{...defaultPlanOptions(new Date('2027-03-03T08:00:00+08:00')),startDate:'2027-03-04',days:1,startTime:'08:00',endTime:'18:00'});expect(p.segments,JSON.stringify(p.unscheduled)).toHaveLength(1);expect(p.segments[0].start).toBe('2027-03-04T01:00:00.000Z')
  const bad=structuredClone(w);bad.timePoints[1].normalizedValue='2027-03-04T16:00';expect(buildPersonalPlan(bad,p.options).unscheduled[0].code).toBe('SOURCE_WINDOW_NEEDS_REVIEW')
 })
 it.each(['declared cutoff','wrong owner','foreign quote','backward range'])('does not derive a window from %s',kind=>{
  const {r,source}=fixture();if(kind==='declared cutoff')r.evidence[0].quote=source+'截止09:00。';if(kind==='wrong owner')r.standaloneTasks[0].timePointTempIds=[];if(kind==='foreign quote')r.evidence[0].quote='另一通知请递交申请书。';if(kind==='backward range')r.timePoints[0].rawText='2027年3月4日11:00—09:00';const s=kind==='declared cutoff'?r.evidence[0].quote:source;expect(assembleCurrentFirstSuggestion(r,{sourceText:s,referenceTime:'2027-03-03T08:00:00+08:00',timezone:'Asia/Shanghai'}).audit.citedSourceWindows.decisions).toHaveLength(0)
 })
})
