import {describe,it,expect} from 'vitest'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {assembleCurrentFirstSuggestion} from './materialChannelGrounding'
import {parseRecognitionResult} from './schema'

function course(kind:'course'|'assignment',negative=''){
  const subject=kind==='course'?'线上课程教学资源已开启，学习截止时间2027年8月29日。':'各门课程的“在线作业”环节已同步开启，截止时间2027年8月29日。'
  const grade=kind==='course'?'线上学习成绩占课程总评成绩的10%，请务必认真对待。':'在线作业占各门课程总评成绩的20%，请务必重视。'
  const instruction='课程学习和在线作业具体操作方式，请见附件。'
  const source=negative+subject+grade+instruction,r=ordinaryWorkflowFixture(source),t=r.standaloneTasks[0]
  t.actionVerb='完成';t.actionObject=kind==='course'?'线上课程学习':'在线作业';t.title='完成'+t.actionObject;t.materialTempIds=[];t.evidenceIds=['S','G','I'];t.timePointTempIds=['D'];r.materials=[]
  r.evidence=[{id:'S',sourceId:'pending-source',quote:negative+subject,field:'deadline'},{id:'G',sourceId:'pending-source',quote:grade,field:'requirement'},{id:'I',sourceId:'pending-source',quote:instruction,field:'description'}]
  r.timePoints=[{tempId:'D',type:'submission_deadline',rawText:'2027年8月29日',normalizedValue:'2027-08-29',timezone:'Asia/Shanghai',isAllDay:true,precision:'date_only',needsConfirmation:false,relatedTaskTempIds:[t.tempId],relatedMaterialTempIds:[],evidenceIds:['S'],confidence:1,selected:true}]
  return {source,r}
}
const context=(sourceText:string)=>({sourceText,referenceTime:'2027-03-01T09:00:00+08:00',timezone:'Asia/Shanghai'})
describe('existing completion verbs in explicitly opened assessed course components',()=>{
  it.each(['course','assignment'] as const)('retains the model-provided %s action and its date without inventing a field',kind=>{
    const {source,r}=course(kind),copy=structuredClone(r),first=assembleCurrentFirstSuggestion(parseRecognitionResult(r),context(source))
    expect(first.result.standaloneTasks[0].selected).toBe(true);expect(first.result.standaloneTasks[0].actionObject).toBe(copy.standaloneTasks[0].actionObject)
    expect(first.audit.unresolved).toEqual([]);expect(first.audit.actionFields.some(a=>a.status==='EXISTING_COURSE_COMPLETION_SUPPORT')).toBe(true)
    expect(first.result.timePoints[0].normalizedValue).toBe('2027-08-29');expect(first.result.timePoints).toHaveLength(1);expect(r).toEqual(copy)
  })
  it.each(['请勿','如果','例如','无需','已取消'])('does not turn %s course text into a current completion instruction',negative=>{
    const {source,r}=course('course',negative),first=assembleCurrentFirstSuggestion(r,context(source));expect(first.result.standaloneTasks[0].selected).toBe(false)
  })
  it.each(['different object','no deadline','no grade requirement','missing citation'])('retains the block for %s',kind=>{
    const {source,r}=course('course');if(kind==='different object')r.standaloneTasks[0].actionObject='另一课程学习'
    if(kind==='no deadline'){r.timePoints=[];r.standaloneTasks[0].timePointTempIds=[]}
    if(kind==='no grade requirement')r.standaloneTasks[0].evidenceIds=['S','I']
    if(kind==='missing citation')r.evidence=[]
    expect(assembleCurrentFirstSuggestion(r,context(source)).result.standaloneTasks[0].selected).toBe(false)
  })
})
