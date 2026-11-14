import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'
import {validateRecognitionResult} from './recognition-contract.generated.mjs'

const options=source=>({source,referenceTime:'2026-11-07T10:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.11.0'})
const event=(key,title,evidence,time,location)=>({key,kind:'event',title,evidence:[evidence],times:[{role:'start',raw:time}],location})
const timeOf=(result,key)=>{const item=result.events.find(x=>x.title===key);return result.timePoints.find(p=>p.tempId===item?.startTimePointTempId)?.normalizedValue??null}

test('one source sentence and AI summary support two independent events on the same day',()=>{
 const source='2027年3月10日9:00在东楼101举行绘画工作坊，14:00在西楼202举行戏剧工作坊。'
 const raw={topic:'工作坊',summary:'2027年3月10日举办绘画工作坊和戏剧工作坊。',kind:'event',items:[event('a','绘画工作坊','2027年3月10日9:00在东楼101举行绘画工作坊','2027年3月10日9:00','东楼101'),event('b','戏剧工作坊','14:00在西楼202举行戏剧工作坊','14:00','西楼202')],materials:[]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(result.events.length,2)
 assert.equal(timeOf(result,'绘画工作坊'),'2027-03-10T09:00')
 assert.equal(timeOf(result,'戏剧工作坊'),'2027-03-10T14:00')
 assert.equal(result.events[1].location,'西楼202')
 assert.equal(validateRecognitionResult(result,{sourceContent:source}).valid,true)
})

test('a model-composed shared day and owned clock survive even when they are not contiguous in the source',()=>{
 const source='2027年3月10日9:00在东楼101举行绘画工作坊，14:00在西楼202举行戏剧工作坊。'
 const raw={topic:'工作坊',kind:'event',items:[event('a','绘画工作坊','2027年3月10日9:00在东楼101举行绘画工作坊','2027年3月10日9:00','东楼101'),event('b','戏剧工作坊','14:00在西楼202举行戏剧工作坊','2027年3月10日14:00','西楼202')],materials:[]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(timeOf(result,'戏剧工作坊'),'2027-03-10T14:00')
 assert.equal(result.events[1].location,'西楼202')
 assert.equal(validateRecognitionResult(result,{sourceContent:source}).valid,true)
})

test('an explicitly cited shared weekday can anchor each same-sentence event and its own time range',()=>{
 const source='本周四14:00—15:00在东楼101举办写作讲座，16:00—17:30在西楼202举办案例工作坊。'
 const raw={topic:'交流活动',kind:'event',items:[
  {...event('a','写作讲座','本周四14:00—15:00在东楼101举办写作讲座','本周四14:00—15:00','东楼101'),times:[{role:'start',raw:'本周四14:00—15:00'},{role:'end',raw:'本周四14:00—15:00'}]},
  {...event('b','案例工作坊','16:00—17:30在西楼202举办案例工作坊','本周四16:00—17:30','西楼202'),times:[{role:'start',raw:'本周四16:00—17:30'},{role:'end',raw:'本周四16:00—17:30'}]}
 ],materials:[]}
 const {result}=compileSemanticNotice(raw,{...options(source),referenceTime:'2026-11-09T09:00:00+08:00'})
 assert.equal(result.events.length,2)
 assert.equal(timeOf(result,'写作讲座'),'2026-11-12T14:00')
 assert.equal(timeOf(result,'案例工作坊'),'2026-11-12T16:00')
 const workshop=result.events.find(item=>item.title==='案例工作坊')
 assert.equal(result.timePoints.find(point=>point.tempId===workshop.endTimePointTempId)?.normalizedValue,'2026-11-12T17:30')
 assert.equal(workshop.location,'西楼202')
 assert.equal(validateRecognitionResult(result,{sourceContent:source}).valid,true)
})

test('a different explicit weekday cannot inherit a model-composed earlier weekday',()=>{
 const source='本周四14:00在东楼举办写作讲座，本周五16:00在西楼举办案例工作坊。'
 const raw={topic:'交流活动',kind:'event',items:[
  event('a','写作讲座','本周四14:00在东楼举办写作讲座','本周四14:00','东楼'),
  event('b','案例工作坊','本周五16:00在西楼举办案例工作坊','本周四16:00','西楼')
 ],materials:[]}
 const {result}=compileSemanticNotice(raw,{...options(source),referenceTime:'2026-11-09T09:00:00+08:00'})
 assert.notEqual(timeOf(result,'案例工作坊'),'2026-11-12T16:00')
})

test('a model-composed date absent from the source is not recovered as an event date',()=>{
 const source='2027年3月10日9:00在东楼101举行绘画工作坊，14:00在西楼202举行戏剧工作坊。'
 const raw={topic:'工作坊',kind:'event',items:[event('a','绘画工作坊','2027年3月10日9:00在东楼101举行绘画工作坊','2027年3月10日9:00','东楼101'),event('b','戏剧工作坊','14:00在西楼202举行戏剧工作坊','2027年3月12日14:00','西楼202')],materials:[]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(timeOf(result,'戏剧工作坊'),null)
})

test('a composed date cannot override a second event explicitly marked date-unknown',()=>{
 const source='2027年3月10日9:00在东楼举行绘画工作坊，14:00在西楼举行戏剧工作坊（日期另行通知）。'
 const raw={topic:'工作坊',kind:'event',items:[event('a','绘画工作坊','2027年3月10日9:00在东楼举行绘画工作坊','2027年3月10日9:00','东楼'),event('b','戏剧工作坊','14:00在西楼举行戏剧工作坊','2027年3月10日14:00','西楼')],materials:[]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(timeOf(result,'戏剧工作坊'),null)
})

test('a composed date cannot override a next-day marker',()=>{
 const source='2027年3月10日9:00在东楼举行绘画工作坊，次日14:00在西楼举行戏剧工作坊。'
 const raw={topic:'工作坊',kind:'event',items:[event('a','绘画工作坊','2027年3月10日9:00在东楼举行绘画工作坊','2027年3月10日9:00','东楼'),event('b','戏剧工作坊','次日14:00在西楼举行戏剧工作坊','2027年3月10日14:00','西楼')],materials:[]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.notEqual(timeOf(result,'戏剧工作坊'),'2027-03-10T14:00')
})

test('repeated clocks use each event citation rather than borrowing a different event',()=>{
 const source='2027年3月10日9:00在东楼举办绘画工作坊，14:00在西楼举办戏剧工作坊，14:00在南楼举办摄影工作坊。'
 const raw={topic:'工作坊',kind:'event',items:[
  event('a','绘画工作坊','2027年3月10日9:00在东楼举办绘画工作坊','2027年3月10日9:00','东楼'),
  event('b','戏剧工作坊','14:00在西楼举办戏剧工作坊','2027年3月10日14:00','西楼'),
  event('c','摄影工作坊','14:00在南楼举办摄影工作坊','2027年3月10日14:00','南楼')
 ],materials:[]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(result.events.length,3)
 assert.equal(timeOf(result,'戏剧工作坊'),'2027-03-10T14:00');assert.equal(timeOf(result,'摄影工作坊'),'2027-03-10T14:00')
 assert.equal(result.events[1].location,'西楼');assert.equal(result.events[2].location,'南楼')
})

test('an unanchored second event never inherits a prior date from a different sentence',()=>{
 const source='2027年3月10日9:00在东楼举行绘画工作坊。戏剧工作坊将于14:00开始，日期另行通知。'
 const raw={topic:'工作坊',summary:'两场工作坊均在2027年3月10日举行。',kind:'event',items:[event('a','绘画工作坊','2027年3月10日9:00在东楼举行绘画工作坊','2027年3月10日9:00','东楼'),event('b','戏剧工作坊','戏剧工作坊将于14:00开始，日期另行通知','14:00','')],materials:[]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(timeOf(result,'绘画工作坊'),'2027-03-10T09:00')
 assert.equal(timeOf(result,'戏剧工作坊'),null)
})

test('a next-day marker or second date cannot inherit the prior event date',()=>{
 const source='2027年3月10日9:00在东楼举行绘画工作坊，次日14:00在西楼举行戏剧工作坊。'
 const raw={topic:'工作坊',summary:'两场工作坊均在2027年3月10日举行。',kind:'event',items:[event('a','绘画工作坊','2027年3月10日9:00在东楼举行绘画工作坊','2027年3月10日9:00','东楼'),event('b','戏剧工作坊','次日14:00在西楼举行戏剧工作坊','14:00','西楼')],materials:[]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.notEqual(timeOf(result,'戏剧工作坊'),'2027-03-10T14:00')
})

test('an unknown date immediately following the second event is not filled from the first',()=>{
 const source='2027年3月10日9:00在东楼举行绘画工作坊，14:00在西楼举行戏剧工作坊（日期另行通知）。'
 const raw={topic:'工作坊',summary:'2027年3月10日举办绘画工作坊和戏剧工作坊。',kind:'event',items:[event('a','绘画工作坊','2027年3月10日9:00在东楼举行绘画工作坊','2027年3月10日9:00','东楼'),event('b','戏剧工作坊','14:00在西楼举行戏剧工作坊','14:00','西楼')],materials:[]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(timeOf(result,'戏剧工作坊'),null)
})

test('two dates each remain with their own event even if the AI summary is mistaken',()=>{
 const source='2027年3月10日9:00在东楼举行绘画工作坊，3月11日14:00在西楼举行戏剧工作坊。'
 const raw={topic:'工作坊',summary:'2027年3月10日举行绘画工作坊和戏剧工作坊。',kind:'event',items:[event('a','绘画工作坊','2027年3月10日9:00在东楼举行绘画工作坊','2027年3月10日9:00','东楼'),event('b','戏剧工作坊','3月11日14:00在西楼举行戏剧工作坊','3月11日14:00','西楼')],materials:[]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(timeOf(result,'绘画工作坊'),'2027-03-10T09:00')
 assert.equal(timeOf(result,'戏剧工作坊'),'2027-03-11T14:00')
})

test('a cited goal heading can own distinct conditional deliveries without erasing their deadlines',()=>{
 const source='学业总结提交：一年级同学请于2027年3月15日12:00前将课程心得PDF交给组长；二年级同学请于3月16日17:00前将课程反思Word交给老师。'
 const raw={topic:'学业总结提交',kind:'action',items:[
  {key:'a',kind:'task',title:'向组长提交课程心得PDF',action:'提交',object:'课程心得PDF',condition:'一年级同学',channel:'组长',evidence:['一年级同学请于2027年3月15日12:00前将课程心得PDF交给组长'],times:[{role:'deadline',raw:'2027年3月15日12:00前'}]},
  {key:'b',kind:'task',title:'向老师提交课程反思Word',action:'提交',object:'课程反思Word',condition:'二年级同学',channel:'老师',evidence:['二年级同学请于3月16日17:00前将课程反思Word交给老师'],times:[{role:'deadline',raw:'3月16日17:00前'}]}
 ],materials:[],goals:[{key:'summary',title:'提交学业总结',anchor:'学业总结',evidence:'学业总结提交',taskKeys:['a','b']}]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(result.goalGroups?.length,1)
 assert.deepEqual(result.goalGroups[0].taskTempIds,result.standaloneTasks.map(t=>t.tempId))
 assert.deepEqual(result.timePoints.filter(p=>p.type==='task_deadline').map(p=>p.normalizedValue),['2027-03-15T12:00','2027-03-16T17:00'])
 assert.match(result.standaloneTasks[0].description,/一年级/u);assert.match(result.standaloneTasks[1].description,/二年级/u)
})

test('a specific materials heading can group different document names without merging their facts',()=>{
 const source='生涯发展材料：低年级同学于2027年3月15日前提交生涯规划书；高年级同学于3月16日前提交个人简历。'
 const raw={topic:'生涯发展材料',kind:'action',items:[
  {key:'a',kind:'task',title:'提交生涯规划书',action:'提交',object:'生涯规划书',condition:'低年级同学',evidence:['低年级同学于2027年3月15日前提交生涯规划书'],times:[{role:'deadline',raw:'2027年3月15日前'}]},
  {key:'b',kind:'task',title:'提交个人简历',action:'提交',object:'个人简历',condition:'高年级同学',evidence:['高年级同学于3月16日前提交个人简历'],times:[{role:'deadline',raw:'3月16日前'}]}
 ],materials:[],goals:[{key:'g',title:'提交生涯发展材料',anchor:'生涯发展材料',evidence:'生涯发展材料',taskKeys:['a','b']}]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(result.goalGroups?.length,1);assert.equal(result.standaloneTasks.length,2)
 assert.deepEqual(result.timePoints.filter(p=>p.type==='task_deadline').map(p=>p.normalizedValue),['2027-03-15','2027-03-16'])
})

test('an explicit unrelated statement prevents a model-proposed heading group',()=>{
 const source='课程材料提交：提交课程表至教务处；提交课程费用至财务处。两项互不相关。'
 const raw={topic:'课程材料',kind:'action',items:[{key:'a',kind:'task',title:'提交课程表',action:'提交',object:'课程表',evidence:['提交课程表至教务处']},{key:'b',kind:'task',title:'提交课程费用',action:'提交',object:'课程费用',evidence:['提交课程费用至财务处']}],materials:[],goals:[{key:'g',title:'提交课程材料',anchor:'课程材料',evidence:'课程材料提交',taskKeys:['a','b']}]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(result.standaloneTasks.length,2);assert.equal(result.goalGroups,undefined)
})

test('a model-proposed group cannot combine actions explicitly assigned to different events',()=>{
 const source='活动报名：摄影讲座请填写报名表；戏剧讲座请填写报名表。'
 const raw={topic:'活动报名',kind:'mixed',items:[
  {key:'a',kind:'event',title:'摄影讲座',evidence:['摄影讲座']},
  {key:'b',kind:'event',title:'戏剧讲座',evidence:['戏剧讲座']},
  {key:'x',kind:'task',title:'填写摄影讲座报名表',action:'填写',object:'报名表',evidence:['摄影讲座请填写报名表'],eventRelation:{eventKey:'a',eventAnchor:'摄影讲座',evidence:'摄影讲座请填写报名表'}},
  {key:'y',kind:'task',title:'填写戏剧讲座报名表',action:'填写',object:'报名表',evidence:['戏剧讲座请填写报名表'],eventRelation:{eventKey:'b',eventAnchor:'戏剧讲座',evidence:'戏剧讲座请填写报名表'}}
 ],materials:[],goals:[{key:'g',title:'填写活动报名表',anchor:'活动报名',evidence:'活动报名',taskKeys:['x','y']}]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(result.events.length,2);assert.equal(result.standaloneTasks.length,2);assert.equal(result.goalGroups,undefined)
})

test('different named events cannot be grouped merely because both need the same action',()=>{
 const source='讲座报名：请报名摄影讲座；请报名戏剧讲座。'
 const raw={topic:'讲座报名',kind:'action',items:[
  {key:'a',kind:'task',title:'报名摄影讲座',action:'报名',object:'摄影讲座',evidence:['请报名摄影讲座']},
  {key:'b',kind:'task',title:'报名戏剧讲座',action:'报名',object:'戏剧讲座',evidence:['请报名戏剧讲座']}
 ],materials:[],goals:[{key:'g',title:'报名讲座',anchor:'讲座',evidence:'讲座报名',taskKeys:['a','b']}]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(result.standaloneTasks.length,2);assert.equal(result.goalGroups,undefined)
})

test('different cited events stay separate even when task relation fields are absent',()=>{
 const source='讲座报名：摄影讲座请填写报名表；戏剧讲座请填写报名表。'
 const raw={topic:'讲座报名',kind:'mixed',items:[
  {key:'e1',kind:'event',title:'摄影讲座',evidence:['摄影讲座']},
  {key:'e2',kind:'event',title:'戏剧讲座',evidence:['戏剧讲座']},
  {key:'a',kind:'task',title:'填写摄影讲座报名表',action:'填写',object:'报名表',evidence:['摄影讲座请填写报名表']},
  {key:'b',kind:'task',title:'填写戏剧讲座报名表',action:'填写',object:'报名表',evidence:['戏剧讲座请填写报名表']}
 ],materials:[],goals:[{key:'g',title:'填写讲座报名表',anchor:'讲座',evidence:'讲座报名',taskKeys:['a','b']}]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(result.events.length,2);assert.equal(result.standaloneTasks.length,2);assert.equal(result.goalGroups,undefined)
})

test('different named events in action titles remain separate without event entities',()=>{
 const source='讲座报名：摄影讲座请填写报名表；戏剧讲座请填写报名表。'
 const raw={topic:'讲座报名',kind:'action',items:[
  {key:'a',kind:'task',title:'填写摄影讲座报名表',action:'填写',object:'报名表',evidence:['摄影讲座请填写报名表']},
  {key:'b',kind:'task',title:'填写戏剧讲座报名表',action:'填写',object:'报名表',evidence:['戏剧讲座请填写报名表']}
 ],materials:[],goals:[{key:'g',title:'填写讲座报名表',anchor:'讲座',evidence:'讲座报名',taskKeys:['a','b']}]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(result.standaloneTasks.length,2);assert.equal(result.goalGroups,undefined)
})

test('a broad shared quotation cannot turn unrelated actions into a single goal',()=>{
 const source='今日事项：缴纳宿舍水费；提交课程报告。'
 const raw={topic:'今日事项',kind:'action',items:[
  {key:'a',kind:'task',title:'缴纳宿舍水费',action:'缴纳',object:'宿舍水费',evidence:[source]},
  {key:'b',kind:'task',title:'提交课程报告',action:'提交',object:'课程报告',evidence:[source]}
 ],materials:[],goals:[{key:'g',title:'处理今日事项',anchor:'今日事项',evidence:'今日事项',taskKeys:['a','b']}]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(result.standaloneTasks.length,2);assert.equal(result.goalGroups,undefined)
})

test('a generic materials heading does not make two different deliveries one goal',()=>{
 const source='今日材料：提交实验报告；提交宿舍缴费凭证。'
 const raw={topic:'今日材料',kind:'action',items:[
  {key:'a',kind:'task',title:'提交实验报告',action:'提交',object:'实验报告',evidence:['提交实验报告']},
  {key:'b',kind:'task',title:'提交宿舍缴费凭证',action:'提交',object:'宿舍缴费凭证',evidence:['提交宿舍缴费凭证']}
 ],materials:[],goals:[{key:'g',title:'提交今日材料',anchor:'今日材料',evidence:'今日材料',taskKeys:['a','b']}]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(result.standaloneTasks.length,2);assert.equal(result.goalGroups,undefined)
})
