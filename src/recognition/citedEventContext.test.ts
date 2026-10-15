import {describe,it,expect} from 'vitest'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {assembleCurrentFirstSuggestion} from './materialChannelGrounding'
import {interpretTimeD26} from '../lib/timeSemanticsD26'
import {validateRecognitionResult} from './schema'
import {emptyWorkspace} from '../experiments/mainline01/fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../domain/v2/repository'
import {CapturePersistenceService} from '../domain/v2/capture'
import {IndexedDbWorkspaceRepository} from '../lib/repository'
import {buildSourceReviewPlan,commitSourceReview,verifySourceReviewReadback} from '../domain/v2/sourceReviewD26'
import {rangeEndpointSupport} from './rangeEndpointSupport'
const reference='2027-03-01T09:00:00+08:00',timezone='Asia/Shanghai'
function fixture(){
 const text='活动于2027年3月8日19:00开始，20:30结束',r=ordinaryWorkflowFixture();r.standaloneTasks=[];r.materials=[];r.evidence=[{id:'Q',sourceId:'pending-source',quote:text,field:'event'}];r.sourceSummary={...r.sourceSummary,title:'活动',notificationType:'event_notice',summary:text,requiresAction:false,actionReason:'仅通知活动'};r.events=[{tempId:'EV',title:'活动',description:text,startTimePointTempId:'S',endTimePointTempId:'E',location:null,relatedTaskTempIds:[],evidenceIds:['Q'],confidence:1,inferenceLevel:'explicit',selected:true}];r.timePoints=['S','E'].map((tempId,i)=>({tempId,type:i?'event_end':'event_start',rawText:text,normalizedValue:null,timezone,isAllDay:false,precision:'vague',needsConfirmation:true,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:['Q'],confidence:1,selected:true}));return{text,r}
}
describe('same-event literal context through ordinary Schema and canonical save',()=>{
 it('keeps two labelled endpoints without editing facts; another date changes actual values',async()=>{
  const {text,r}=fixture(),before=structuredClone(r),f=assembleCurrentFirstSuggestion(r,{sourceText:text,referenceTime:reference,timezone}).result
  expect(f.timePoints.map(p=>p.normalizedValue)).toEqual(['2027-03-08T19:00','2027-03-08T20:30']);expect(validateRecognitionResult(f).issues).toEqual([]);expect(r).toEqual(before)
  const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store);await repo.initialize(emptyWorkspace());const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId:crypto.randomUUID(),rawText:text,sourceType:'text',title:'活动',provider:'manual',modelName:'engineering',promptVersion:'context-fixture',pipelineVersion:'source-time-semantics-2.3.0'});await capture.recognize(h,async()=>f)
  const view=(await new IndexedDbWorkspaceRepository(repo).load())!,w=(await repo.load())!,draft=view.drafts.find(d=>d.id===h.draftId)!,plan=buildSourceReviewPlan(w,draft),receipt=await commitSourceReview(repo,plan),read=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),receipt)
  expect([read.tasks.length,read.events.length,read.timePoints.length]).toEqual([0,1,2]);expect(read.timePoints.map(p=>p.normalizedValue)).toEqual(['2027-03-08T19:00','2027-03-08T20:30']);await commitSourceReview(repo,plan);expect((await repo.load())!.events).toHaveLength(1)
  const changed=fixture();changed.r.timePoints.forEach(p=>p.rawText=p.rawText.replace('3月8日','4月9日'));changed.text=changed.text.replace('3月8日','4月9日');changed.r.evidence[0].quote=changed.text;expect(assembleCurrentFirstSuggestion(changed.r,{sourceText:changed.text,referenceTime:reference,timezone}).result.timePoints[1].normalizedValue).toBe('2027-04-09T20:30')
 })
 it('a duration estimate does not make an explicit start unknown, while tentative starts stay tentative',()=>{
  const raw='2027年3月8日23:00';expect(interpretTimeD26(raw,{type:'event_start',referenceTime:reference,timezone,sourceContext:raw+'开始，预计2小时，完成后恢复'}).point.needsConfirmation).toBe(false)
  expect(interpretTimeD26(raw,{type:'event_start',referenceTime:reference,timezone,sourceContext:'预计'+raw+'开始'}).point.needsConfirmation).toBe(true)
  expect(interpretTimeD26(raw,{type:'event_start',referenceTime:reference,timezone,sourceContext:'预计2小时后开始'}).point.needsConfirmation).toBe(true)
 })
 it('does not create missing endpoints or use foreign source evidence',()=>{
  for(const mode of ['missing','foreign']){const {text,r}=fixture();if(mode==='missing'){r.timePoints.pop();r.events[0].endTimePointTempId=null}else r.evidence[0].quote='另一个活动于2027年4月9日开始';const out=assembleCurrentFirstSuggestion(r,{sourceText:text,referenceTime:reference,timezone}).result;if(mode==='missing')expect(out.timePoints).toHaveLength(1);else expect(out.timePoints.every(p=>p.normalizedValue===null)).toBe(true)}
 })
 it('an existing date range may omit the first 日/year, but cannot gain a clock or cross-year guess',()=>{
  const quote='开放日期8月13—27日';expect(rangeEndpointSupport('8月13—27日','event_end',[quote],reference,timezone)?.expanded).toBe('2027年8月27日')
  expect(rangeEndpointSupport('12月31日—1月2日','event_end',['开放12月31日—1月2日'],reference,timezone)).toBe(null)
  expect(rangeEndpointSupport('8月13—27日09:00','event_end',['开放8月13—27日09:00'],reference,timezone)).toBe(null)
 })
})
