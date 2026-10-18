import{it,expect}from'vitest'
import{createContractFixture}from'../experiments/d26Recorded/contractFixtures'
import{decodeCurrentSourceRecording}from'./conditionalNonActionProduct'
import{assembleCurrentFirstSuggestion}from'./materialChannelGrounding'
import{parseRecognitionResult}from'./schema'
async function scenario(){
 const f=await createContractFixture('mixed'),r=decodeCurrentSourceRecording(f.rawHttpText,'EngineeringFixture',f.context).result,source='海风讲座5月13日下午2:30开始。报名截止时间为讲座开场时间前一周。',t=r.standaloneTasks[0],p=r.timePoints[0],e=r.events[0]
 r.sourceSummary={...r.sourceSummary,title:'海风讲座',summary:source,requiresAction:true};r.projectSuggestion=null;r.milestones=[];r.materials=[];r.ambiguities=[];r.conflicts=[]
 r.evidence=[{id:'A',sourceId:'same',quote:'海风讲座5月13日下午2:30开始。',field:'event'},{id:'F',sourceId:'same',quote:'报名截止时间为讲座开场时间前一周。',field:'deadline'}]
 r.standaloneTasks=[{...t,tempId:'T',title:'报名海风讲座',actionVerb:'报名',actionObject:'海风讲座',description:source,completionCriteria:[],dependencyTempIds:[],materialTempIds:[],timePointTempIds:['D'],evidenceIds:['A','F']}]
 r.events=[{...e,tempId:'E',title:'海风讲座',description:'海风讲座',location:null,startTimePointTempId:'S',endTimePointTempId:null,relatedTaskTempIds:['T'],evidenceIds:['A']}]
 r.timePoints=[{...p,tempId:'S',type:'event_start',rawText:'5月13日下午2:30',normalizedValue:'2026-05-13T14:30',relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:['A'],precision:'exact',needsConfirmation:false,isAllDay:false},{...p,tempId:'D',type:'registration_deadline',rawText:'5月13日下午2:30',normalizedValue:'2026-05-06T14:30',relatedTaskTempIds:['T'],relatedMaterialTempIds:[],evidenceIds:['A','F'],precision:'exact',needsConfirmation:false,isAllDay:false}]
 return {r,source,context:{sourceText:source,referenceTime:'2026-05-01T08:00:00+08:00',timezone:'Asia/Shanghai'}}
}
it('ordinary first assembly preserves a correct relative cutoff instead of replacing it with the event start',async()=>{
 const {r,context}=await scenario();const first=assembleCurrentFirstSuggestion(r,context)
 expect(first.result.timePoints.find(p=>p.tempId==='D')?.normalizedValue?.slice(0,16)).toBe('2026-05-06T14:30');expect(first.result.timePoints.find(p=>p.tempId==='S')?.normalizedValue?.slice(0,16)).toBe('2026-05-13T14:30');expect(first.audit.rangeSupport.some(s=>s.rule==='CITED_RELATIVE_CUTOFF')).toBe(true);expect(()=>parseRecognitionResult(first.result)).not.toThrow()
})
it('ordinary first assembly retains an unresolved relative proposal and never invents the missing anchor',async()=>{
 const {r,context}=await scenario();r.events[0].startTimePointTempId=null;r.timePoints=r.timePoints.filter(p=>p.tempId==='D');Object.assign(r.timePoints[0],{precision:'relative',needsConfirmation:true,selected:false})
 const first=assembleCurrentFirstSuggestion(r,context),point=first.result.timePoints.find(p=>p.tempId==='D')!
 expect(point.normalizedValue).toBe('2026-05-06T14:30');expect(point.precision).toBe('relative');expect(point.needsConfirmation).toBe(true);expect(point.selected).toBe(false);expect(first.result.timePoints).toHaveLength(1);expect(first.result.events[0].startTimePointTempId).toBeNull();expect(first.audit.unresolved.some(r=>r.reason==='RELATIVE_CUTOFF_TYPED_ANCHOR_UNRESOLVED')).toBe(true);expect(()=>parseRecognitionResult(first.result)).not.toThrow()
})
