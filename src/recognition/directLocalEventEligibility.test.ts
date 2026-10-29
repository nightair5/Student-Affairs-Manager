import {describe,expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {convertDirectResult} from './directResult'

function tags(text:string,otherEvent=false){
 const result=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名夹具',content:text,referenceTime:new Date('2026-10-28T02:00:00Z'),timezone:'Asia/Shanghai',projects:[],tasks:[]})
 const id='owned-local-event-source'
 result.evidence.push({id,sourceId:'source',quote:text,quotedText:text,textStart:0,textEnd:text.length,field:'event',extractionMethod:'parser',confidence:1})
 const event={tempId:'local-labelled-event',title:'阅读讲座',description:'',startTimePointTempId:null,endTimePointTempId:null,location:null,evidenceIds:[id],confidence:1,inferenceLevel:'explicit' as const,selected:true}
 result.events=otherEvent?[event,{...event,tempId:'other-event',title:'科技讲座'}]:[event]
 return convertDirectResult(result,text).items.find(item=>item.tempId===event.tempId)?.tags??[]
}

describe('local event qualification is attached to the relevant event',()=>{
 it('does not turn voluntary attendance or a question into a qualification',()=>{
  expect(tags('阅读讲座将举行。欢迎有意向的同学参加。如果有疑问，可以咨询老师。')).not.toContain('如符合条件')
 })
 it.each(['仅限本院学生参加','已报名的同学可以参加','入选后可参加'])('keeps an explicit attendance qualification: %s',condition=>{
  expect(tags(`阅读讲座将举行。${condition}。`)).toContain('如符合条件')
 })
 it('does not borrow an unrelated event registration or cancelled registration',()=>{
  expect(tags('阅读讲座将举行。已报名科技讲座的同学可以参加科技讲座。',true)).not.toContain('如符合条件')
  expect(tags('阅读讲座将举行。科技讲座取消报名。')).not.toContain('如符合条件')
 })
})
