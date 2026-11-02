import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'
import {validateRecognitionResult} from './recognition-contract.generated.mjs'
import {SEMANTIC_NOTICE_VERSION,semanticNoticeSystemPrompt} from './semantic-notice-contract-v3-1-0.mjs'

const referenceTime='2026-11-02T04:00:00.000Z', timezone='Asia/Shanghai'
function compile(source,raw){
  const out=compileSemanticNotice({topic:'匿名通知',kind:'action',items:[],materials:[],...raw},{source,referenceTime,timezone,promptVersion:SEMANTIC_NOTICE_VERSION})
  assert.ok(out.result)
  assert.deepEqual(validateRecognitionResult(out.result,{sourceContent:source}),{valid:true,failureCategory:null,issues:[]})
  return out
}

test('new shared-material examples use literal source evidence and time text',()=>{
  assert.equal(SEMANTIC_NOTICE_VERSION,'recognition-semantic-notice-3.1.0')
  const examples=[...semanticNoticeSystemPrompt().matchAll(/示例原文：([^\n]+)\n示例JSON：([^\n]+)/gu)]
  assert.ok(examples.length>=9)
  for(const [,source,json] of examples){
    const example=JSON.parse(json)
    for(const item of [...example.items,...example.materials]){
      for(const quote of item.evidence??[])assert.ok(source.includes(quote),`quote absent from source: ${quote}`)
      for(const time of item.times??[])assert.ok(source.includes(time.raw),`time absent from source: ${time.raw}`)
    }
  }
})

for(const [label,separator,locationLabel] of [['fullwidth colon','：','地点：'],['spaced colon','： ','地点：'],['bracket label','： ','【地点】']]){
  test(`same-day events retain their own times and rooms: ${label}`,()=>{
    const source=`校园交流日分为分享会和体验展${separator}11月8日9:00—10:00举办分享会，10:30—12:00举办体验展；${locationLabel}大学生活动中心报告厅（分享）、展厅（体验）。`
    const evidence=[source.slice(0,source.indexOf('；')),source.slice(source.indexOf('；')+1,-1)]
    const {result}=compile(source,{kind:'event',items:[
      {key:'a',kind:'event',title:'校园交流日分享会',evidence,times:[{role:'start',raw:'11月8日9:00—10:00'},{role:'end',raw:'11月8日9:00—10:00'}],location:'大学生活动中心报告厅'},
      {key:'b',kind:'event',title:'校园交流日体验展',evidence,times:[{role:'start',raw:'10:30—12:00'},{role:'end',raw:'10:30—12:00'}],location:'大学生活动中心展厅'},
    ]})
    const second=result.events[1]
    assert.equal(result.timePoints.find(p=>p.tempId===second.startTimePointTempId)?.normalizedValue,'2026-11-08T10:30')
    assert.equal(result.timePoints.find(p=>p.tempId===second.endTimePointTempId)?.normalizedValue,'2026-11-08T12:00')
    assert.match(second.location??'',/大学生活动中心.*展厅/u)
    for(const e of result.evidence)assert.equal(source.slice(e.textStart,e.textEnd),e.quote)
  })
}

test('an alternative window is never saved as its first definite date',()=>{
  const source='可选择11月18日或19日前来咨询。'
  const {result,audit}=compile(source,{items:[{key:'a',kind:'task',title:'咨询办理安排',action:'咨询',object:'办理安排',evidence:[source],times:[{role:'window',raw:'11月18日或19日'}]}]})
  assert.equal(result.standaloneTasks.length,1)
  assert.ok(result.timePoints.every(p=>p.normalizedValue===null))
  assert.match(result.standaloneTasks[0].description,/11月18日或19日/u)
  assert.ok(audit.losses.some(x=>/ALTERNATIVE/u.test(x.reason)))
})

test('a next-day activity never inherits the preceding activity date',()=>{
  const source='11月8日9:00举办分享会，次日10:30举办体验展。'
  const {result,audit}=compile(source,{kind:'event',items:[
    {key:'a',kind:'event',title:'分享会',evidence:['11月8日9:00举办分享会'],times:[{role:'start',raw:'11月8日9:00'}]},
    {key:'b',kind:'event',title:'体验展',evidence:['次日10:30举办体验展'],times:[{role:'start',raw:'10:30'}]},
  ]})
  const point=result.timePoints.find(p=>p.tempId===result.events[1].startTimePointTempId)
  assert.notEqual(point?.normalizedValue,'2026-11-08T10:30')
  assert.ok(audit.losses.some(x=>x.id==='b'&&x.reason==='TIME_DAY_OWNER_UNCERTAIN'))
})

test('a role-labelled room cannot be assigned to the other activity',()=>{
  const source='活动地点：大学生活动中心报告厅（分享）、展厅（体验）。分享会与体验展均开放参加。'
  const {result,audit}=compile(source,{kind:'event',items:[{key:'b',kind:'event',title:'体验展',location:'大学生活动中心报告厅',evidence:['活动地点：大学生活动中心报告厅（分享）、展厅（体验）']}]})
  assert.equal(result.events[0].location,null)
  assert.ok(audit.losses.some(x=>x.reason==='LOCATION_NOT_SOURCE_GROUNDED'))
})

test('a paraphrased citation retains the uniquely supported source clause as uncertain',()=>{
  const source='请于11月8日18:00前把课程报告交到办公室。'
  const {result,audit}=compile(source,{items:[{key:'a',kind:'task',title:'递交课程报告',action:'递交',object:'课程报告',description:'支付100元之后递交',evidence:['请于11月8日18:00前将课程报告递交至办公室'],times:[{role:'deadline',raw:'11月8日18:00前'}]}]})
  assert.equal(result.standaloneTasks.length,1)
  assert.equal(result.standaloneTasks[0].userConfirmationRequired,true)
  assert.ok(!result.standaloneTasks[0].description.includes('支付100元'))
  assert.ok(result.evidence.some(e=>e.quote.includes('把课程报告交到办公室')))
  assert.equal(result.timePoints[0]?.normalizedValue,'2026-11-08T18:00')
  assert.equal(result.quality.needsHumanReview,true)
  assert.ok(audit.losses.some(x=>x.layer==='ALIGNMENT'))
})

test('distinct requirements beyond the wire array limit stay visible or explicitly partial',()=>{
  const requirements=Array.from({length:13},(_,i)=>`第${i+1}项原文明示要求`)
  const source='请提交材料。'+requirements.join('；')+'。'
  const {result,audit}=compile(source,{items:[{key:'a',kind:'task',title:'提交材料',action:'提交',object:'材料',evidence:['请提交材料'],requirements}]})
  const task=result.standaloneTasks[0],visible=[...task.completionCriteria,task.description].join('\n')
  for(const requirement of requirements)assert.ok(visible.includes(requirement),requirement)
  assert.ok(audit.losses.some(x=>/REQUIREMENT.*OVERFLOW/u.test(x.reason)))
  assert.equal(result.quality.needsHumanReview,true)
})

test('material requirements do not erase a task processing window',()=>{
  const source='请于11月13日9:00—10:00到服务台领取申请表。申请表须为PDF。'
  const {result}=compile(source,{items:[{key:'a',kind:'task',title:'领取申请表',action:'领取',object:'申请表',evidence:['请于11月13日9:00—10:00到服务台领取申请表'],times:[{role:'window',raw:'11月13日9:00—10:00'}],materials:['m']}],materials:[{key:'m',name:'申请表',owners:['a'],evidence:['申请表须为PDF'],requirements:['申请表须为PDF']}]})
  assert.match(result.standaloneTasks[0].description,/办理时段：11月13日9:00—10:00/u)
  assert.match(result.standaloneTasks[0].description,/申请表须为PDF/u)
  assert.deepEqual(result.timePoints.map(p=>p.normalizedValue),['2026-11-13T09:00','2026-11-13T10:00'])
})

test('an unsupported numeric requirement cannot become a definite task fact',()=>{
  const source='请提交课程报告。'
  const {result,audit}=compile(source,{items:[{key:'a',kind:'task',title:'提交课程报告',action:'提交',object:'课程报告',evidence:['请提交课程报告'],requirements:['必须缴纳500元报名费']}]})
  const task=result.standaloneTasks[0]
  assert.equal(task.completionCriteria.some(r=>r.includes('500元')),false)
  assert.doesNotMatch(task.description,/必须缴纳500元/u)
  assert.ok(audit.losses.some(x=>x.layer==='REQUIREMENT'))
  assert.equal(result.quality.needsHumanReview,true)
})

test('Chinese and Arabic quantities can refer to the same supported requirement',()=>{
  const source='请提交报名表，报告最多两页。'
  const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交报名表',action:'提交',object:'报名表',evidence:['请提交报名表'],requirements:['报告最多2页']}]})
  assert.ok(result.standaloneTasks[0].completionCriteria.includes('报告最多2页'))
})

test('equivalent choice units preserve the alternative channels',()=>{
  const source='请于11月22日17:00前提交申请表：纸质版交到A102，或者电子版上传课程平台，任选一种。'
  const requirement='任选一项：纸质版交到A102，或电子版上传课程平台'
  const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:[source],requirements:[requirement]}]})
  assert.ok(result.standaloneTasks[0].completionCriteria.includes(requirement))
})

test('different numbers of required choices are not treated as equivalent',()=>{
  const source='请提交申请表，以下材料任选两种。'
  const {result,audit}=compile(source,{items:[{key:'a',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:[source],requirements:['任选一项材料']} ]})
  assert.equal(result.standaloneTasks[0].completionCriteria.length,0)
  assert.ok(audit.losses.some(x=>x.reason==='REQUIREMENT_NUMBER_NOT_IN_SOURCE'))
})

test('a number contained inside a different number does not ground a requirement',()=>{
  const source='请提交课程报告，活动共有1500人参加。'
  const {result,audit}=compile(source,{items:[{key:'a',kind:'task',title:'提交课程报告',action:'提交',object:'课程报告',evidence:['请提交课程报告'],requirements:['必须缴纳500元报名费']}]})
  assert.equal(result.standaloneTasks[0].completionCriteria.length,0)
  assert.ok(audit.losses.some(x=>x.reason==='REQUIREMENT_NUMBER_NOT_IN_SOURCE'))
})

test('a count of attendees does not ground an invented amount of money',()=>{
  const source='请提交课程报告，活动共有500人参加。'
  const {result,audit}=compile(source,{items:[{key:'a',kind:'task',title:'提交课程报告',action:'提交',object:'课程报告',evidence:['请提交课程报告'],requirements:['必须缴纳500元报名费']}]})
  assert.equal(result.standaloneTasks[0].completionCriteria.length,0)
  assert.ok(audit.losses.some(x=>x.reason==='REQUIREMENT_NUMBER_UNIT_NOT_IN_SOURCE'))
})

test('a source prohibition does not ground the opposite affirmative requirement',()=>{
  const source='请提交申请表，不得提交原件。'
  const {result,audit}=compile(source,{items:[{key:'a',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:['请提交申请表'],requirements:['必须提交原件']}]})
  assert.equal(result.standaloneTasks[0].completionCriteria.length,0)
  assert.ok(audit.losses.some(x=>x.reason==='REQUIREMENT_POLARITY_CONFLICT'))
})
