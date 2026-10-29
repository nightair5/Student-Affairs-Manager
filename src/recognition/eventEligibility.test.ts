import {describe,expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'

describe('event eligibility from the owned source evidence',()=>{
 for(const condition of ['已报名的同学','持学生证的同学','有意向的本院学生','仅对通过审核的学生开放，欢迎有意向者参加'])it(`retains eligibility for ${condition}`,()=>{
  const text=`【阅读讲座】\n时间：10月29日15:00-16:30\n地点：教学楼301\n${condition}欢迎感兴趣的同学参加。`
  const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名夹具',content:text,referenceTime:new Date('2026-10-28T02:00:00Z'),timezone:'Asia/Shanghai',projects:[],tasks:[]})
  const r=improveDirectFallback(local,text);r.promptVersion='recognition-two-step-2.3.0'
  const e=r.events[0];expect(e).toBeDefined();e.selected=false
  const start=text.indexOf(condition),id='eligibility-test'
  r.evidence.push({id,sourceId:'source',quote:condition,quotedText:condition,textStart:start,textEnd:start+condition.length,field:'requirement',extractionMethod:'parser',confidence:1});e.evidenceIds.push(id)
  const direct=convertDirectResult(r,text)
  expect(direct.items.find(item=>item.kind==='event')?.tags).toContain('如符合条件')
 })
 it('a mere optional invitation is not eligibility',()=>{
  const text='【阅读讲座】\n时间：10月29日15:00-16:30\n地点：教学楼301\n欢迎感兴趣的同学参加。'
  const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名夹具',content:text,referenceTime:new Date('2026-10-28T02:00:00Z'),timezone:'Asia/Shanghai',projects:[],tasks:[]})
  const r=improveDirectFallback(local,text);r.promptVersion='recognition-two-step-2.3.0'
  const e=r.events[0],condition='欢迎感兴趣的同学参加',start=text.indexOf(condition),id='invitation-test'
  expect(e).toBeDefined();e.selected=true
  r.evidence.push({id,sourceId:'source',quote:condition,quotedText:condition,textStart:start,textEnd:start+condition.length,field:'requirement',extractionMethod:'parser',confidence:1});e.evidenceIds.push(id)
  expect(convertDirectResult(r,text).items.find(item=>item.kind==='event')?.tags).not.toContain('如符合条件')
 })
 it('candidate does not delete an event when its source says cancellation will not happen',()=>{
  const text='阅读讲座不取消，届时正常举行。'
  const r=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名夹具',content:text,referenceTime:new Date('2026-10-28T02:00:00Z'),timezone:'Asia/Shanghai',projects:[],tasks:[]});r.promptVersion='recognition-two-step-2.3.0'
  const id='not-cancelled-test';r.evidence.push({id,sourceId:'source',quote:text,quotedText:text,textStart:0,textEnd:text.length,field:'event',extractionMethod:'parser',confidence:1})
  r.events=[{tempId:'test-event',title:'阅读讲座',description:'',startTimePointTempId:null,endTimePointTempId:null,location:null,evidenceIds:[id],confidence:1,inferenceLevel:'explicit',selected:true}]
  expect(convertDirectResult(r,text).result.events).toHaveLength(1)
 })
})
