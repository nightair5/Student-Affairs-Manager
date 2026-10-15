import {describe,it,expect} from 'vitest'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {assembleCurrentFirstSuggestion} from './materialChannelGrounding'
import {parseRecognitionResult} from './schema'
import {supportedEventOperation} from './compoundNameSupport'

const clock={referenceTime:'2026-10-15T09:00:00+08:00',timezone:'Asia/Shanghai'}
function correction(){
 const a='原通知：实践报告在2026年12月8日12:00前提交。',b='更正通知（以此为准）：上述截止取消，改为2026年12月10日15:00前，将实践报告上传课程系统。',source=a+'\n'+b,r=ordinaryWorkflowFixture(source),task=r.standaloneTasks[0]
 task.actionVerb='上传';task.actionObject='实践报告';task.title='上传实践报告';task.materialTempIds=[];task.timePointTempIds=['NEW'];task.evidenceIds=['B'];r.materials=[];r.events=[]
 r.evidence=[{id:'A',sourceId:'pending-source',quote:a,field:'deadline'},{id:'B',sourceId:'pending-source',quote:b,field:'deadline'}]
 const point={type:'submission_deadline' as const,timezone:'Asia/Shanghai',isAllDay:false,precision:'exact' as const,needsConfirmation:false,relatedMaterialTempIds:[],confidence:.9,selected:true}
 r.timePoints=[{...point,tempId:'OLD',rawText:'2026年12月8日12:00前',normalizedValue:'2026-12-08T12:00',relatedTaskTempIds:[],evidenceIds:['A']},{...point,tempId:'NEW',rawText:'2026年12月10日15:00前',normalizedValue:'2026-12-10T15:00',relatedTaskTempIds:[task.tempId],evidenceIds:['B']}]
 return{r,source,a,b}
}
describe('forwarded correction and wrapped window safety',()=>{
 it('a model-declared service suspension can use its literal same-object stopping-operation citation',()=>{
  const source='届时学校业务系统、科研平台服务将停止运行。'
  expect(supportedEventOperation('科研平台暂停服务',[source],source)).toBe(true)
  for(const text of ['如果停电，科研平台服务将停止运行。','科研平台服务不会停止运行。','其他平台服务将停止运行。','科研平台服务将停止运行的通知取消。'])expect(supportedEventOperation('科研平台暂停服务',[text],text)).toBe(false)
  expect(supportedEventOperation('科研平台暂停服务',[],source)).toBe(false)
 })
 it('keeps a separately cited explicit adjacent same-object replacement, never reactivating its old endpoint',()=>{
  const {r,source}=correction(),original=structuredClone(r),out=assembleCurrentFirstSuggestion(r,{sourceText:source,...clock})
  expect(out.result.timePoints.map(p=>p.tempId)).toEqual(['NEW']);expect(out.audit.sourceCurrentness[0]).toMatchObject({entityId:'OLD',replacementId:'NEW'})
  expect(()=>parseRecognitionResult(out.result)).not.toThrow();expect(r).toEqual(original)
 })
 it.each(['conditional','not cancelled','different object','intervening notice','missing cited replacement','duplicate old date'])('does not infer replacement from %s',mode=>{
  const {r,source,a,b}=correction();let text=source
  if(mode==='conditional')text=source.replace('上述截止取消','若获批则上述截止取消')
  if(mode==='not cancelled')text=source.replace('上述截止取消','上述截止未取消')
  if(mode==='different object')text=source.replace('将实践报告','将活动方案')
  if(mode==='intervening notice')text=a+'\n另一事项仍按原计划进行。\n'+b
  if(mode==='missing cited replacement')r.timePoints[1].evidenceIds=['A']
  if(mode==='duplicate old date')text=source+'另一份材料在2026年12月8日12:00前交。'
  r.evidence[1].quote=text.slice(text.indexOf('\n')+1).split('另一份材料')[0]
  const out=assembleCurrentFirstSuggestion(r,{sourceText:text,...clock});expect(out.audit.sourceCurrentness).toEqual([]);expect(out.result.timePoints.some(p=>p.tempId==='OLD')).toBe(true)
 })
 it('an OCR-style wrapped registration interval is retained as a local risk, not a fabricated cutoff',()=>{
  const r=ordinaryWorkflowFixture(),raw='2027\n年\n3\n月\n1\n日—\n3\n月\n31\n日',source='学生注册选课：\n'+raw,t=r.standaloneTasks[0]
  r.materials=[];r.events=[];t.title='注册选课';t.actionVerb='注册';t.actionObject='选课';t.materialTempIds=[];t.timePointTempIds=['P'];t.evidenceIds=['Q'];r.evidence=[{id:'Q',sourceId:'pending-source',quote:source,field:'deadline'}]
  r.timePoints=[{tempId:'P',type:'registration_deadline',rawText:raw,normalizedValue:'2027-03-31T23:59:59',timezone:'Asia/Shanghai',isAllDay:false,precision:'exact',needsConfirmation:false,relatedTaskTempIds:[t.tempId],relatedMaterialTempIds:[],evidenceIds:['Q'],confidence:.9,selected:true}]
  const first=assembleCurrentFirstSuggestion(r,{sourceText:source,...clock});expect(first.result.timePoints).toHaveLength(1);expect(first.result.timePoints[0]).toMatchObject({rawText:raw,normalizedValue:null,selected:false,needsConfirmation:true});expect(first.audit.sourceActionTimes.rejectedDeadlineRoles).toHaveLength(1)
  const exact=structuredClone(r);exact.timePoints[0].rawText='2027年3月31日';exact.evidence[0].quote='注册选课截止为2027年3月31日。';const valid=assembleCurrentFirstSuggestion(exact,{sourceText:exact.evidence[0].quote!,...clock});expect(valid.result.timePoints[0].normalizedValue).toBe('2027-03-31');expect(valid.audit.sourceActionTimes.rejectedDeadlineRoles).toHaveLength(0)
 })
})
