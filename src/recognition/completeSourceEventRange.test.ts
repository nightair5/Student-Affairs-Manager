import {describe,expect,it} from 'vitest'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {completeSourceEventRange} from './completeSourceEventRange'
import {convertDirectResult} from './directResult'
import {validateRecognitionResult} from './schema'

const source='【校园主题交流会】\n【活动时间】2026年12月4日14:00-16:00\n【活动地点】知行楼201\n报名截止12月3日18:00。'
const reference='2026-11-12T14:00:00Z'
function fixture(text=source){
 const result=ordinaryWorkflowFixture(text),quote='2026年12月4日14:00-16:00',at=text.indexOf(quote)
 result.promptVersion='recognition-semantic-notice-3.11.0';result.createdAt=reference
 result.milestones=[];result.standaloneTasks=[];result.materials=[];result.conflicts=[]
 result.evidence=[{id:'heading',sourceId:'source',quote:'校园主题交流会',field:'event'},...(at>=0?[{id:'time',sourceId:'source',quote,quotedText:quote,textStart:at,textEnd:at+quote.length,field:'event' as const}]:[])]
 result.timePoints=[{tempId:'start',type:'event_start',rawText:quote,normalizedValue:'2026-12-04T14:00',timezone:'Asia/Shanghai',isAllDay:false,precision:'exact',needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:at>=0?['time']:[],confidence:1}]
 result.events=[{tempId:'event',title:'校园主题交流会',description:'',startTimePointTempId:'start',endTimePointTempId:null,location:'知行楼201',evidenceIds:['heading'],confidence:1,inferenceLevel:'explicit'}]
 return result
}
describe('source-backed missing event ending',()=>{
 it('saves the second endpoint only when the named event and start agree',()=>{
  const before=fixture(),snapshot=structuredClone(before),after=completeSourceEventRange(before,source,reference,'Asia/Shanghai')
  expect(before).toEqual(snapshot)
  const event=after.events[0],end=after.timePoints.find(point=>point.tempId===event.endTimePointTempId)!
  expect(end.normalizedValue).toBe('2026-12-04T16:00')
  const evidence=after.evidence.find(item=>item.id===end.evidenceIds[0])!
  expect(source.slice(evidence.textStart,evidence.textEnd)).toBe(evidence.quote)
  expect(validateRecognitionResult(after).valid).toBe(true)
  expect(convertDirectResult(after,source).result.timePoints.find(point=>point.tempId===end.tempId)?.normalizedValue).toBe('2026-12-04T16:00')
 })
 it('does not guess through a conflicting start, another event, revised time or tentative range',()=>{
  const wrong=fixture();wrong.timePoints[0].normalizedValue='2026-12-04T15:00'
  expect(completeSourceEventRange(wrong,source,reference,'Asia/Shanghai')).toBe(wrong)
  for(const text of [source+'\n【另一场时间】12月4日18:00-19:00',source+'\n活动延期，另行通知。',source.replace('14:00-16:00','约14:00-16:00')]){
   const item=fixture(text);expect(completeSourceEventRange(item,text,reference,'Asia/Shanghai')).toBe(item)
  }
  const multiple=fixture();multiple.events.push({...multiple.events[0],tempId:'other'})
  expect(completeSourceEventRange(multiple,source,reference,'Asia/Shanghai')).toBe(multiple)
 })
 it('does not overwrite an existing or unknown source ending',()=>{
  const item=fixture();item.events[0].endTimePointTempId='already-provided'
  expect(completeSourceEventRange(item,source,reference,'Asia/Shanghai')).toBe(item)
  const text=source.replace('14:00-16:00','14:00开始，结束另行通知'),noEnd=fixture(text)
  expect(completeSourceEventRange(noEnd,text,reference,'Asia/Shanghai')).toBe(noEnd)
 })
})
