import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'
import {validateRecognitionResult} from './recognition-contract.generated.mjs'
import {SEMANTIC_NOTICE_VERSION,semanticNoticeSystemPrompt} from './semantic-notice-contract-v3-0-5.mjs'

const referenceTime='2026-11-01T04:12:32.675Z',timezone='Asia/Shanghai'
function compile(source,raw){
  const out=compileSemanticNotice({topic:'匿名通知',kind:'action',items:[],materials:[],...raw},{source,referenceTime,timezone})
  assert.ok(out.result)
  assert.deepEqual(validateRecognitionResult(out.result,{sourceContent:source}),{valid:true,failureCategory:null,issues:[]})
  return out
}

test('semantic prompt distinguishes separate activities from an agenda and binds unknown deadlines to delivery',()=>{
  const prompt=semanticNoticeSystemPrompt()
  assert.equal(SEMANTIC_NOTICE_VERSION,'recognition-semantic-notice-3.0.5')
  assert.match(prompt,/不得把两个活动的首个开始与另一活动的结束合成一场/u)
  assert.match(prompt,/签到、分享、问答是流程/u)
  assert.match(prompt,/纸质版截止时间另行通知.*纸质提交任务/u)
  assert.match(prompt,/个人行动，即使给出可办理的时间段和地点，仍是task/u)
})

test('prompt examples use real source quotations and time text',()=>{
  const pairs=[...semanticNoticeSystemPrompt().matchAll(/示例原文：([^\n]+)\n示例JSON：([^\n]+)/gu)]
  assert.ok(pairs.length>=8)
  for(const [,source,json] of pairs){
    const example=JSON.parse(json)
    for(const item of [...example.items,...example.materials]){
      for(const quote of item.evidence??[])assert.ok(source.includes(quote),`quote is absent from example source: ${quote}`)
      for(const point of item.times??[])assert.ok(source.includes(point.raw),`time is absent from example source: ${point.raw}`)
    }
  }
})

test('a pickup window remains a task with an owned window, not an invented event',()=>{
  const source='请于11月13日9:00—10:00到服务台领取资料。'
  const {result}=compile(source,{items:[{key:'pickup',kind:'task',title:'领取资料',action:'领取',object:'资料',evidence:['请于11月13日9:00—10:00到服务台领取资料'],times:[{role:'window',raw:'11月13日9:00—10:00'}],location:'服务台'}]})
  assert.equal(result.standaloneTasks.length,1);assert.equal(result.events.length,0)
  assert.match(result.standaloneTasks[0].description,/地点：服务台/u)
  assert.deepEqual(result.timePoints.map(p=>[p.type,p.normalizedValue]),[['event_start','2026-11-13T09:00'],['event_end','2026-11-13T10:00']])
})

test('requirement containment removes duplicates in either order without erasing negation',()=>{
  const source='提交申请表。材料注明学院和姓名。不得提交原件。'
  const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:['提交申请表'],requirements:['注明学院和姓名','材料注明学院和姓名','不得提交原件','提交原件']}]})
  assert.deepEqual(result.standaloneTasks[0].completionCriteria,['材料注明学院和姓名','不得提交原件','提交原件'])
})

test('requirement containment preserves differences in exact or qualified quantities',()=>{
  const source='提交申请表。精选笔记4页，至少精选笔记4页。'
  const {result}=compile(source,{items:[{key:'a',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:['提交申请表'],requirements:['精选笔记4页','至少精选笔记4页']}]})
  assert.deepEqual(result.standaloneTasks[0].completionCriteria,['精选笔记4页','至少精选笔记4页'])
})

test('a paper delivery cannot take an explicitly electronic deadline or channel',()=>{
  const source='电子版截止11月7日23:59前；电子版发送至report@example.edu；纸质版截止与提交方式另行通知。'
  const {result,audit}=compile(source,{items:[
    {key:'e',kind:'task',title:'提交电子版作品',action:'提交',object:'作品',deliveryForm:'电子版',channel:'report@example.edu',evidence:['电子版截止11月7日23:59前'],times:[{role:'deadline',raw:'11月7日23:59前'}]},
    {key:'p',kind:'task',title:'提交纸质版作品',action:'提交',object:'作品',deliveryForm:'纸质版',channel:'report@example.edu',evidence:['纸质版截止与提交方式另行通知'],times:[{role:'deadline',raw:'11月7日23:59前'}]},
  ]})
  assert.equal(result.standaloneTasks.length,2)
  assert.match(result.standaloneTasks[0].description,/report@example\.edu/u)
  assert.doesNotMatch(result.standaloneTasks[1].description,/report@example\.edu/u)
  assert.deepEqual(result.standaloneTasks[1].timePointTempIds,[])
  assert.deepEqual(result.timePoints.map(p=>p.normalizedValue),['2026-11-07T23:59'])
  assert.ok(audit.losses.some(x=>x.id==='p'&&x.reason==='CHANNEL_OTHER_DELIVERY_SCOPE'))
  assert.ok(audit.losses.some(x=>x.id==='p'&&x.reason==='TIME_OTHER_DELIVERY_SCOPE'))
})

test('a shared material cannot copy the electronic-only address into a paper owner',()=>{
  const source='电子版发送至report@example.edu；纸质版提交方式另行通知。两种形式均需报名表。'
  const {result,audit}=compile(source,{items:[
    {key:'e',kind:'task',title:'提交电子版报名表',action:'提交',object:'报名表',deliveryForm:'电子版',channel:'report@example.edu',materials:['m'],evidence:['电子版发送至report@example.edu']},
    {key:'p',kind:'task',title:'提交纸质版报名表',action:'提交',object:'报名表',deliveryForm:'纸质版',materials:['m'],evidence:['纸质版提交方式另行通知']},
  ],materials:[{key:'m',name:'报名表',channel:'report@example.edu',owners:['e','p'],evidence:['两种形式均需报名表']}]})
  assert.match(result.standaloneTasks[0].description,/report@example\.edu/u)
  assert.doesNotMatch(result.standaloneTasks[1].description,/report@example\.edu/u)
  assert.equal(result.materials[0].submissionChannel,null)
  assert.ok(audit.losses.some(x=>x.id==='m'&&x.reason==='CHANNEL_OTHER_DELIVERY_SCOPE'))
})

test('task and material requirement copies are merged in both orderings',()=>{
  const source='请提交报名表。纸质材料注明学院和姓名。'
  const resultFor=(taskRequirement,materialRequirement)=>compile(source,{items:[{key:'a',kind:'task',title:'提交报名表',action:'提交',object:'报名表',evidence:['请提交报名表'],materials:['m'],requirements:[taskRequirement]}],materials:[{key:'m',name:'报名表',owners:['a'],requirements:[materialRequirement],evidence:['纸质材料注明学院和姓名']}]}).result.standaloneTasks[0]
  for(const item of [resultFor('纸质材料注明学院和姓名','注明学院和姓名'),resultFor('注明学院和姓名','纸质材料注明学院和姓名')]){
    assert.deepEqual(item.completionCriteria,['纸质材料注明学院和姓名'])
    assert.equal(item.description.split('\n').filter(line=>line.includes('注明学院和姓名')).length,1)
  }
})

test('a delivery task retains its cited unknown deadline without inheriting another deadline',()=>{
  const source='电子版截止11月7日23:59前。纸质版截止时间在交流群中另行通知。请提交纸质版作品并加入交流群。'
  const {result}=compile(source,{items:[
    {key:'electronic',kind:'task',title:'提交电子版作品',action:'提交',object:'作品',deliveryForm:'电子版',evidence:['电子版截止11月7日23:59前'],times:[{role:'deadline',raw:'11月7日23:59前'}]},
    {key:'paper',kind:'task',title:'提交纸质版作品',action:'提交',object:'作品',deliveryForm:'纸质版',evidence:['纸质版截止时间在交流群中另行通知','请提交纸质版作品并加入交流群']},
    {key:'group',kind:'task',title:'加入交流群',action:'加入',object:'交流群',evidence:['请提交纸质版作品并加入交流群']},
  ]})
  assert.match(result.standaloneTasks[1].description,/纸质版截止时间在交流群中另行通知/u)
  assert.deepEqual(result.standaloneTasks[1].completionCriteria,['纸质版截止时间在交流群中另行通知'])
  assert.deepEqual(result.standaloneTasks[1].timePointTempIds,[])
  assert.doesNotMatch(result.standaloneTasks[2].description,/纸质版截止/u)
  assert.deepEqual(result.timePoints.map(p=>p.normalizedValue),['2026-11-07T23:59'])
})

test('unrelated delivery unknown deadline is not copied across owners',()=>{
  const source='电子版截止时间另行通知，纸质版请提交到办公室。'
  const {result}=compile(source,{items:[{key:'paper',kind:'task',title:'提交纸质版材料',action:'提交',object:'材料',deliveryForm:'纸质版',evidence:['电子版截止时间另行通知，纸质版请提交到办公室']}]})
  assert.equal(result.standaloneTasks[0].completionCriteria.length,0)
  assert.doesNotMatch(result.standaloneTasks[0].description,/电子版截止/u)
})

test('open-ended actions and their deadlines survive semantic mapping',()=>{
  for(const [verb,object] of [['备份','实验数据'],['录制','项目介绍视频'],['校对','课程论文'],['装订','课程档案']]){
    const source=`请于11月8日18:00前${verb}${object}。`,raw={items:[{key:'a',kind:'task',title:verb+object,action:verb,object,evidence:[verb+object],times:[{role:'deadline',raw:'11月8日18:00前'}]}]}
    const {result,audit}=compile(source,raw)
    assert.equal(result.standaloneTasks[0].actionVerb,verb)
    assert.equal(result.timePoints[0].type,'task_deadline')
    assert.equal(result.timePoints[0].normalizedValue,'2026-11-08T18:00')
    assert.equal(audit.losses.length,0)
  }
})

test('shared deadline stays with both independent actions',()=>{
  const source='请于11月8日20:00前填写出行登记表并提交保险凭证。'
  const raw={items:[{key:'a',kind:'task',title:'填写出行登记表',action:'填写',object:'出行登记表',evidence:['填写出行登记表'],times:[{role:'deadline',raw:'11月8日20:00前'}]},{key:'b',kind:'task',title:'提交保险凭证',action:'提交',object:'保险凭证',evidence:['提交保险凭证'],times:[{role:'deadline',raw:'11月8日20:00前'}]}]}
  const {result}=compile(source,raw)
  assert.deepEqual(result.standaloneTasks.map(t=>t.actionObject),['出行登记表','保险凭证'])
  assert.deepEqual(result.timePoints.map(p=>[p.relatedTaskTempIds[0],p.normalizedValue]),[['sem-i1','2026-11-08T20:00'],['sem-i2','2026-11-08T20:00']])
})

test('material identity, formats and filename are not merged into a long name',()=>{
  const source='请于11月8日18:00前提交申请表，申请表须为Word和PDF两种格式，文件名为项目号加姓名。'
  const raw={items:[{key:'a',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:['提交申请表'],times:[{role:'deadline',raw:'11月8日18:00前'}],materials:['m']}],materials:[{key:'m',name:'申请表',formats:['Word','PDF'],naming:['项目号加姓名'],owners:['a'],evidence:['申请表须为Word和PDF两种格式，文件名为项目号加姓名']}]}
  const {result}=compile(source,raw),m=result.materials[0]
  assert.equal(m.name,'申请表');assert.deepEqual(m.formatRequirements,['Word','PDF']);assert.deepEqual(m.namingRequirements,['项目号加姓名'])
  assert.deepEqual(result.standaloneTasks[0].materialTempIds,[m.tempId])
})

test('a correction drops the cancelled event and retains its new time and place',()=>{
  const source='原定11月5日14:00在A201的写作分享会取消，改为11月6日15:00—16:00在B302举行。'
  const raw={kind:'event',items:[{key:'old',kind:'event',title:'写作分享会',status:'cancelled',evidence:['原定11月5日14:00在A201的写作分享会取消']},{key:'new',kind:'event',title:'写作分享会',status:'active',evidence:['改为11月6日15:00—16:00在B302举行'],location:'B302',times:[{role:'start',raw:'11月6日15:00—16:00'},{role:'end',raw:'11月6日15:00—16:00'}]}]}
  const {result}=compile(source,raw)
  assert.equal(result.events.length,1);assert.equal(result.events[0].location,'B302')
  assert.deepEqual(result.timePoints.map(p=>p.normalizedValue),['2026-11-06T15:00','2026-11-06T16:00'])
})

test('a window opening or an unsupported date cannot become a deadline',()=>{
  const source='请领取证书，办理窗口为11月8日09:00—11:00。'
  for(const rawTime of ['11月8日09:00','11月9日17:00']){
    const {result}=compile(source,{items:[{key:'a',kind:'task',title:'领取证书',action:'领取',object:'证书',evidence:['领取证书'],times:[{role:'deadline',raw:rawTime}]}]})
    assert.equal(result.standaloneTasks.length,1)
    assert.ok(!result.timePoints.some(p=>p.type==='task_deadline'&&p.normalizedValue))
  }
})

test('a missing material citation does not delete an otherwise valid task and deadline',()=>{
  const source='请于11月8日18:00前提交申请表。'
  const {result,audit}=compile(source,{items:[{key:'a',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:['提交申请表'],times:[{role:'deadline',raw:'11月8日18:00前'}]}],materials:[{key:'m',name:'申请表',owners:['a'],evidence:['不存在的材料引用']}]})
  assert.equal(result.standaloneTasks.length,1);assert.equal(result.timePoints[0].normalizedValue,'2026-11-08T18:00')
  assert.ok(audit.losses.some(x=>x.layer==='MATERIAL'));assert.equal(result.quality.needsHumanReview,true)
})

test('explicit cancellation is not revived even if the model labels it active',()=>{
  const source='原定的学习交流会取消。资格不符者取消报名资格。'
  const {result,audit}=compile(source,{kind:'event',items:[{key:'a',kind:'event',title:'学习交流会',status:'active',evidence:['学习交流会']}],materials:[]})
  assert.equal(result.events.length,0)
  assert.ok(audit.losses.some(x=>x.reason==='CANCELLED_ITEM'))
})

test('source-side handling start does not become a personal plan or an event',()=>{
  const source='11月8日起可领取证明，截止11月10日17:00前。'
  const {result}=compile(source,{items:[{key:'a',kind:'task',title:'领取证明',action:'领取',object:'证明',evidence:['领取证明'],times:[{role:'start',raw:'11月8日'},{role:'deadline',raw:'11月10日17:00前'}]}]})
  assert.deepEqual(result.timePoints.map(p=>[p.type,p.normalizedValue]),[['task_deadline','2026-11-10T17:00']])
  assert.match(result.standaloneTasks[0].description,/办理开始：11月8日/u)
})

test('a clock-only quote uses a same-clause date and never guesses today without one',()=>{
  const dated='讲座：11月3日（下周二）9:30-10:30在A101举行。'
  const {result}=compile(dated,{kind:'event',items:[{key:'a',kind:'event',title:'讲座',evidence:['讲座'],times:[{role:'start',raw:'9:30-10:30'},{role:'end',raw:'9:30-10:30'}]}]})
  assert.deepEqual(result.timePoints.map(p=>p.normalizedValue),['2026-11-03T09:30','2026-11-03T10:30'])
  const undated='讲座9:30在A101举行，日期另行通知。'
  const missing=compile(undated,{kind:'event',items:[{key:'a',kind:'event',title:'讲座',evidence:['讲座'],times:[{role:'start',raw:'9:30'}]}]})
  assert.equal(missing.result.timePoints.length,0)
  assert.ok(missing.audit.losses.some(x=>x.reason==='TIME_DAY_NOT_DETERMINED'))
})

test('full-width dates and emoji keep original UTF-16 evidence offsets',()=>{
  const source='📌 请于１１月８日１８：００前备份实验数据。'
  const {result}=compile(source,{items:[{key:'a',kind:'task',title:'备份实验数据',action:'备份',object:'实验数据',evidence:['备份实验数据'],times:[{role:'deadline',raw:'11月8日18:00前'}]}]})
  assert.equal(result.timePoints[0].normalizedValue,'2026-11-08T18:00')
  for(const e of result.evidence)assert.equal(source.slice(e.textStart,e.textEnd),e.quote)
})

test('unresolved model fields are visibly partial even if an item survives',()=>{
  const source='请提交申请表。'
  const {result}=compile(source,{partial:false,unresolved:['截止时间未知'],items:[{key:'a',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:['提交申请表']}]})
  assert.equal(result.standaloneTasks.length,1);assert.equal(result.quality.needsHumanReview,true)
})

test('voluntary participation is not an eligibility condition',()=>{
  const source='12月4日14:00举行阅读分享会，有意向的同学欢迎参加。'
  const {result}=compile(source,{kind:'event',items:[{key:'a',kind:'event',title:'阅读分享会',evidence:['举行阅读分享会'],condition:'有意向的同学欢迎参加',times:[{role:'start',raw:'12月4日14:00'}]}]})
  assert.equal(result.events[0].selected,true)
  assert.match(result.events[0].description,/有意向的同学欢迎参加/u)
  assert.doesNotMatch(result.events[0].description,/适用条件待确认/u)
})

test('dates with interspersed spaces preserve their cutoff, including 24:00 rollover',()=>{
  const source='线上登记截止：11 月 2 日 晚24：00；申请材料截止：11 月 3 日 中午 12:00。'
  const {result}=compile(source,{items:[
    {key:'a',kind:'task',title:'线上登记',action:'登记',object:'线上信息',evidence:['线上登记截止：11 月 2 日 晚24：00'],times:[{role:'deadline',raw:'11 月 2 日 晚24：00'}]},
    {key:'b',kind:'task',title:'提交申请材料',action:'提交',object:'申请材料',evidence:['申请材料截止：11 月 3 日 中午 12:00'],times:[{role:'deadline',raw:'11 月 3 日 中午 12:00'}]},
  ]})
  assert.deepEqual(result.timePoints.map(p=>p.normalizedValue),['2026-11-03T00:00','2026-11-03T12:00'])
  for(const e of result.evidence)assert.equal(source.slice(e.textStart,e.textEnd),e.quote)
})

test('distinct role-labelled rooms can share a source-backed building without mixing sessions',()=>{
  const source='【活动地点】明德中心二楼报告厅（分享）、展厅（招聘）\n分享会与招聘会开放参加。'
  const raw={kind:'event',items:[
    {key:'a',kind:'event',title:'分享会',location:'明德中心二楼报告厅',evidence:['【活动地点】明德中心二楼报告厅（分享）、展厅（招聘）']},
    {key:'b',kind:'event',title:'招聘会',location:'明德中心展厅',evidence:['【活动地点】明德中心二楼报告厅（分享）、展厅（招聘）']},
    {key:'c',kind:'event',title:'分享会与招聘会',location:'明德中心展厅',evidence:['【活动地点】明德中心二楼报告厅（分享）、展厅（招聘）']},
  ]}
  const {result,audit}=compile(source,raw)
  assert.equal(result.events[0].location,'明德中心二楼报告厅')
  assert.equal(result.events[1].location,'明德中心 · 展厅')
  assert.equal(result.events[2].location,null)
  assert.ok(audit.losses.some(x=>x.id==='c'&&x.reason==='LOCATION_NOT_SOURCE_GROUNDED'))
})

test('wrapped URLs and choices retain source-backed destinations even in long notices',()=>{
  const source='说明。'.repeat(400)+'请填写问卷。报名链接：https://forms.example.edu/join\n纸质交教学楼101，或者电子版发送至report@example.edu，任选一种。'
  const {result}=compile(source,{items:[
    {key:'a',kind:'task',title:'填写问卷',action:'填写',object:'问卷',channel:'在线问卷（https://forms.example.edu/join）',evidence:['请填写问卷']},
    {key:'b',kind:'task',title:'提交报告',action:'提交',object:'报告',channel:'纸质交教学楼101，或电子版发送至report@example.edu',evidence:['纸质交教学楼101，或者电子版发送至report@example.edu，任选一种']},
  ]})
  assert.match(result.standaloneTasks[0].description,/https:\/\/forms\.example\.edu\/join/u)
  assert.match(result.standaloneTasks[1].description,/纸质交教学楼101.*电子版发送至report@example\.edu/u)
})

test('a stated prerequisite does not become an eligibility condition',()=>{
  const source='完成登记后提交申请材料。'
  const {result}=compile(source,{items:[
    {key:'a',kind:'task',title:'完成登记',action:'完成',object:'登记',evidence:['完成登记']},
    {key:'b',kind:'task',title:'提交申请材料',action:'提交',object:'申请材料',condition:'完成登记后',dependsOn:['a'],evidence:['提交申请材料']},
  ]})
  assert.deepEqual(result.standaloneTasks[1].dependencyTempIds,['sem-i1'])
  assert.match(result.standaloneTasks[1].description,/前置事项/u)
  assert.doesNotMatch(result.standaloneTasks[1].description,/适用条件/u)
  assert.equal(result.standaloneTasks[1].selected,true)
})

test('material formats and naming stay with the corresponding delivery',()=>{
  const source='提交项目表电子版PDF到邮箱，文件名写编号；纸质版交办公室，注明姓名。'
  const {result}=compile(source,{items:[
    {key:'e',kind:'task',title:'提交项目表电子版',action:'提交',object:'项目表',deliveryForm:'电子版',materials:['me'],evidence:['提交项目表电子版PDF到邮箱']},
    {key:'p',kind:'task',title:'提交项目表纸质版',action:'提交',object:'项目表',deliveryForm:'纸质版',materials:['mp'],evidence:['纸质版交办公室，注明姓名']},
  ],materials:[
    {key:'me',name:'项目表',formats:['PDF'],naming:['编号'],owners:['e'],evidence:['提交项目表电子版PDF到邮箱，文件名写编号']},
    {key:'mp',name:'项目表',formats:['纸质版'],requirements:['注明姓名'],owners:['p'],evidence:['纸质版交办公室，注明姓名']},
  ]})
  assert.deepEqual(result.standaloneTasks.map(t=>t.materialTempIds),[['sem-m1'],['sem-m2']])
  assert.deepEqual(result.materials.map(m=>m.formatRequirements),[['PDF'],['纸质版']])
  assert.deepEqual(result.materials.map(m=>m.namingRequirements),[['编号'],[]])
  assert.match(result.standaloneTasks[1].description,/注明姓名/u)
  assert.doesNotMatch(result.standaloneTasks[1].description,/文件名写编号/u)
})
