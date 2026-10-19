import {describe,it,expect} from 'vitest'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {assembleCurrentFirstSuggestion} from './materialChannelGrounding'
import {parseRecognitionResult} from './schema'
import {emptyWorkspace} from '../experiments/mainline01/fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../domain/v2/repository'
import {CapturePersistenceService} from '../domain/v2/capture'
import {IndexedDbWorkspaceRepository} from '../lib/repository'
import {buildSourceReviewPlan,commitSourceReview,verifySourceReviewReadback} from '../domain/v2/sourceReviewD26'
import {projectCitedTimeLiterals} from '../../cloudflare/cited-time-literal.mjs'
const referenceTime='2027-04-01T09:00:00+08:00',timezone='Asia/Shanghai'
function event(){
  const rawText='2027年4月9日09:00—4月12日16:00',source='答疑活动时间：'+rawText+'。',r=ordinaryWorkflowFixture(source)
  r.standaloneTasks=[];r.materials=[];r.milestones=[];r.projectSuggestion=null
  r.sourceSummary.requiresAction=false;r.sourceSummary.notificationType='event_notice'
  r.evidence=[{id:'Q',sourceId:'pending-source',quote:source,field:'event'}]
  r.timePoints=(['event_start','event_end'] as const).map((type,i)=>({tempId:i?'E':'S',type,rawText,normalizedValue:i?'2027-04-12T16:00':'2027-04-09T09:00',timezone,isAllDay:false,precision:'exact',needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:['Q'],confidence:1,selected:true}))
  r.events=[{tempId:'EV',title:'答疑活动',description:source,startTimePointTempId:'S',endTimePointTempId:'E',location:null,evidenceIds:['Q'],relatedTaskTempIds:[],confidence:1,inferenceLevel:'explicit',selected:true}]
  return {r,source}
}
describe('existing cross-date clock values through the ordinary confirmation chain',()=>{
  it('retains a quantity range on its existing cited material without discovering materials or copying another object quantity',()=>{
    const check=(source:string,name='图片')=>{const r=ordinaryWorkflowFixture(source),m=r.materials[0];m.name=name;m.quantity=null;m.formatRequirements=[];m.evidenceIds=['Q'];r.evidence=[{id:'Q',sourceId:'pending-source',quote:source,field:'materials'}];const out=assembleCurrentFirstSuggestion(r,{sourceText:source,referenceTime,timezone});expect(out.result.materials).toHaveLength(r.materials.length);return out}
    const good=check('每人提交2—4\n张图片。');expect(good.result.materials[0].formatRequirements).toContain('2—4\n张图片');expect(good.audit.citedMaterialQuantities).toHaveLength(1)
    for(const [s,name]of [['每人提交2—4张图片。','成绩单'],['不要提交2—4张图片。','图片'],['若通过才提交2—4张图片。','图片'],['每人提交2—4张图片。另需提交6—8张图片。','图片']])expect(check(s,name).audit.citedMaterialQuantities??[]).toHaveLength(0)
  })
  it('repairs only a unique shared cutoff heading and keeps a staff-review date out of the student action',()=>{
    const {r}=event();r.events=[]
    r.standaloneTasks=[{...ordinaryWorkflowFixture('提交画稿').standaloneTasks[0],tempId:'T',actionVerb:'提交',actionObject:'画稿',evidenceIds:['Q'],timePointTempIds:['S']}]
    r.timePoints=[{...r.timePoints[0],tempId:'S',type:'submission_deadline',rawText:'截止时间：2027年4月9日。',relatedTaskTempIds:['T']}]
    const source='截止时间：\n2027\n年4月9日。';r.evidence[0].quote=source
    const out=projectCitedTimeLiterals(r,source);expect(out.result.timePoints[0].rawText).toBe(source);expect(out.audit.decisions).toHaveLength(1)
    const staff='老师审核画稿截止时间：\n2027\n年4月9日。';r.evidence[0].quote=staff
    expect(projectCitedTimeLiterals(r,staff).audit.decisions).toHaveLength(0)
    r.evidence.push({...r.evidence[0],id:'Other',quote:'截止时间：2027年4月10日。'})
    expect(projectCitedTimeLiterals(r,staff+'\n截止时间：2027年4月10日。').audit.decisions).toHaveLength(0)
  })
  it('keeps a tentative time across a layout break and does not borrow uncertainty from a later sentence',()=>{
    const {r}=event(),literal='2027年4月16日14:30',source='答疑活动暂时定于\n'+literal+'开始。'
    r.events[0].title='答疑活动';r.events[0].endTimePointTempId=null;r.timePoints=[{...r.timePoints[0],rawText:literal,normalizedValue:'2027-04-16T14:30'}];r.evidence[0].quote=source
    const first=assembleCurrentFirstSuggestion(r,{sourceText:source,referenceTime,timezone});expect(first.result.timePoints[0]).toMatchObject({normalizedValue:'2027-04-16T14:30',needsConfirmation:true,selected:false})
    const firm='答疑活动于'+literal+'开始。之后可能下雨。';r.evidence[0].quote=firm
    expect(assembleCurrentFirstSuggestion(r,{sourceText:firm,referenceTime,timezone}).result.timePoints[0].needsConfirmation).toBe(false)
  })
  it.each(['预计','可能','拟定','暂定','尚未确定','待确定'])('a %s schedule stays unselected through the ordinary first suggestion',status=>{
    const {r}=event(),literal='2027年4月16日14:30-16:30',source=`讲座${status}于${literal}举行。`
    r.evidence[0].quote=source;r.events[0].title='讲座';r.events[0].description=source
    r.timePoints.forEach((p,i)=>{p.rawText=literal;p.normalizedValue='2027-04-16T'+(i?'16:30':'14:30')})
    const before=structuredClone(r),first=assembleCurrentFirstSuggestion(r,{sourceText:source,referenceTime,timezone})
    expect(first.result.timePoints.every(p=>p.needsConfirmation&&p.selected===false)).toBe(true)
    expect(r).toEqual(before)
  })
  it('an unrelated later uncertain effect does not make a firm interval tentative',()=>{
    const {r}=event(),literal='2027年4月16日14:30-16:30',source=`讲座时间：${literal}，结束后可能下雨。`
    r.evidence[0].quote=source;r.events[0].title='讲座';r.events[0].description=source
    r.timePoints.forEach((p,i)=>{p.rawText=literal;p.normalizedValue='2027-04-16T'+(i?'16:30':'14:30')})
    const first=assembleCurrentFirstSuggestion(r,{sourceText:source,referenceTime,timezone})
    expect(first.result.timePoints.map(p=>p.normalizedValue)).toEqual(['2027-04-16T14:30','2027-04-16T16:30'])
    expect(first.result.timePoints.every(p=>!p.needsConfirmation&&p.selected)).toBe(true)
  })
  it('preserves the correct end at first display and formal independent readback without human edits',async()=>{
    const {r,source}=event(),original=structuredClone(r),first=assembleCurrentFirstSuggestion(parseRecognitionResult(r),{sourceText:source,referenceTime,timezone})
    expect(first.result.timePoints.map(p=>p.normalizedValue)).toEqual(['2027-04-09T09:00','2027-04-12T16:00'])
    expect(first.audit.citedClockRanges?.[1].before.normalizedValue).toBe('2027-04-12T16:00');expect(r).toEqual(original)
    const store=new MemoryWorkspaceRecordStore(),repository=new CanonicalWorkspaceRepository(store);await repository.initialize(emptyWorkspace())
    const capture=new CapturePersistenceService(repository),handle=await capture.beginCapture({operationId:crypto.randomUUID(),rawText:source,sourceType:'text',title:'答疑活动',provider:'manual',modelName:'engineering-positive',promptVersion:'unchanged-engineering-wire',pipelineVersion:first.audit.version})
    await capture.recognize(handle,async()=>first.result)
    const view=(await new IndexedDbWorkspaceRepository(repository).load())!,workspace=(await repository.load())!,draft=view.drafts.find(d=>d.id===handle.draftId)!
    const receipt=await commitSourceReview(repository,buildSourceReviewPlan(workspace,draft)),saved=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),receipt)
    expect(saved.events).toHaveLength(1);expect(saved.tasks).toHaveLength(0);expect(saved.timePoints.map(p=>p.normalizedValue)).toEqual(['2027-04-09T09:00','2027-04-12T16:00'])
  })
  it('keeps interval-as-deadline local and retains the original correct value in audit',()=>{
    const {r,source}=event();r.events=[];r.timePoints.forEach(p=>{p.type='registration_deadline'})
    const original=structuredClone(r),first=assembleCurrentFirstSuggestion(r,{sourceText:source,referenceTime,timezone})
    expect(first.result.timePoints.every(p=>p.normalizedValue===null&&p.needsConfirmation&&p.selected===false)).toBe(true)
    expect(first.audit.citedClockRanges?.[1].before.normalizedValue).toBe('2027-04-12T16:00')
    expect(first.result.conflicts.filter(c=>c.id.startsWith('cited-clock-range:'))).toHaveLength(2)
    expect(()=>parseRecognitionResult(first.result)).not.toThrow();expect(r).toEqual(original)
  })
  it('does not invent a missing end or attach a range to an uncited event owner',()=>{
    const {r,source}=event();r.events[0].evidenceIds=[];r.timePoints.pop();r.events[0].endTimePointTempId=null
    const first=assembleCurrentFirstSuggestion(r,{sourceText:source,referenceTime,timezone})
    expect(first.result.timePoints).toHaveLength(1);expect(first.result.timePoints[0].normalizedValue).toBeNull()
    expect(first.result.events[0].endTimePointTempId).toBeNull()
  })
})
