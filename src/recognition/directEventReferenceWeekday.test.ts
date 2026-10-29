import {describe,expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {convertDirectResult} from './directResult'

const source='阅读讲座。时间：周四 中午 12:40。地点：至善楼309。'
function makeResult(){
 const r=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名夹具',content:source,referenceTime:new Date('2026-10-29T05:55:17Z'),timezone:'Asia/Shanghai',projects:[],tasks:[]})
 r.createdAt='2026-10-29T13:55:17+08:00';r.promptVersion='recognition-two-step-2.3.0';r.standaloneTasks=[];r.materials=[]
 const add=(id:string,quote:string,field:'event'|'deadline'|'description')=>{const start=source.indexOf(quote);r.evidence.push({id,sourceId:'source',quote,quotedText:quote,textStart:start,textEnd:start+quote.length,field,extractionMethod:'parser',confidence:1})}
 add('event','阅读讲座','event');add('time','周四 中午 12:40','deadline');add('location','至善楼309','description')
 r.events=[{tempId:'g2-1',title:'阅读讲座',description:'参加须知：星期日期按通知接收时间推算，请确认。',startTimePointTempId:'g2-p1',endTimePointTempId:null,location:'至善楼309',evidenceIds:['event','time','location'],confidence:1,inferenceLevel:'explicit',selected:false}]
 r.timePoints=[{tempId:'g2-p1',type:'event_start',rawText:'周四 中午 12:40',normalizedValue:'2026-10-29T12:40',timezone:'Asia/Shanghai',isAllDay:false,precision:'exact',needsConfirmation:true,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:['time'],confidence:1,selected:false}]
 return r
}
describe('a candidate weekday retains its fixed source reference',()=>{
 it('preserves the anchored time and explicit uncertainty through direct conversion',()=>{
  const direct=convertDirectResult(makeResult(),source)
  expect(direct.result.events[0]?.location).toBe('至善楼309')
  expect(direct.result.timePoints[0]?.normalizedValue).toBe('2026-10-29T12:40')
  expect(direct.result.timePoints[0]?.needsConfirmation).toBe(true)
  expect(direct.items.find(i=>i.kind==='event')?.tags).toContain('待确认')
 })
 it('retains the fixed source weekday in 2.4 but not in the old 2.1 contract',()=>{
  const current=makeResult();current.promptVersion='recognition-two-step-2.4.0'
  const converted=convertDirectResult(current,source)
  expect(converted.result.timePoints[0]?.normalizedValue).toBe('2026-10-29T12:40')
  expect(converted.result.timePoints[0]?.needsConfirmation).toBe(true)
  const legacy=makeResult();legacy.promptVersion='recognition-two-step-2.1.0'
  expect(convertDirectResult(legacy,source).result.timePoints[0]?.normalizedValue).toBeNull()
 })
 it('does not accept a forged date, a different reference week, or enable it for 2.1',()=>{
  const forged=makeResult();forged.timePoints[0].normalizedValue='2026-11-05T12:40'
  expect(convertDirectResult(forged,source).result.timePoints[0]?.normalizedValue).toBeNull()
  const past=makeResult();past.createdAt='2026-10-30T13:55:17+08:00'
  expect(convertDirectResult(past,source).result.timePoints[0]?.normalizedValue).toBeNull()
  const legacy=makeResult();legacy.promptVersion='recognition-two-step-2.1.0'
  expect(convertDirectResult(legacy,source).result.timePoints[0]?.normalizedValue).toBeNull()
 })
})
