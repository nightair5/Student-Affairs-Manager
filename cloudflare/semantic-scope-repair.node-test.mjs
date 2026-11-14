import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'
import {validateRecognitionResult} from './recognition-contract.generated.mjs'

const options=source=>({source,referenceTime:'2026-11-14T09:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.11.0',goalContextVersion:'1.0.31',roleResolutionVersion:'1.0.0',participationScopeVersion:'1.1.0'})
const event=(key,title,quote,time,location)=>({key,kind:'event',title,evidence:[quote],times:[{role:'start',raw:time},{role:'end',raw:time}],location})
const dates=result=>result.events.map(e=>({title:e.title,start:result.timePoints.find(p=>p.tempId===e.startTimePointTempId)?.normalizedValue,end:result.timePoints.find(p=>p.tempId===e.endTimePointTempId)?.normalizedValue,location:e.location}))

test('a weekday heading governs individually cited list entries with separate clocks and locations',()=>{
 const source='【周五活动】\n1. 09:00—10:00阅读交流，东楼101。\n2. 14:30—16:00海报讲座，西楼202。'
 const raw={topic:'活动',kind:'event',items:[event('a','阅读交流','09:00—10:00阅读交流，东楼101','09:00—10:00','东楼101'),event('b','海报讲座','14:30—16:00海报讲座，西楼202','14:30—16:00','西楼202')],materials:[]}
 const {result,audit}=compileSemanticNotice(raw,options(source))
 assert.equal(audit.compilerVersion,'semantic-notice-compiler-1.0.39')
 assert.deepEqual(dates(result),[{title:'阅读交流',start:'2026-11-20T09:00',end:'2026-11-20T10:00',location:'东楼101'},{title:'海报讲座',start:'2026-11-20T14:30',end:'2026-11-20T16:00',location:'西楼202'}])
 assert.equal(validateRecognitionResult(result,{sourceContent:source}).valid,true)
})

test('weekday table heading governs each independently cited row',()=>{
 const source='周四校园安排：\n活动 | 时间 | 地点\n茶艺讲座 | 10:00—11:00 | 丙楼301\n音乐体验 | 15:00—16:30 | 丁楼102'
 const raw={topic:'校园安排',kind:'event',items:[event('a','茶艺讲座','茶艺讲座 | 10:00—11:00 | 丙楼301','10:00—11:00','丙楼301'),event('b','音乐体验','音乐体验 | 15:00—16:30 | 丁楼102','15:00—16:30','丁楼102')],materials:[]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.deepEqual(dates(result).map(x=>[x.start,x.end]),[['2026-11-19T10:00','2026-11-19T11:00'],['2026-11-19T15:00','2026-11-19T16:30']])
})

test('a different date or unrelated section cannot inherit a previous heading',()=>{
 const source='【周五活动】\n1. 09:00—10:00阅读交流，东楼101。\n【下周一活动】\n2. 14:30—16:00海报讲座，西楼202。'
 const raw={topic:'活动',kind:'event',items:[event('a','阅读交流','09:00—10:00阅读交流，东楼101','09:00—10:00','东楼101'),event('b','海报讲座','14:30—16:00海报讲座，西楼202','14:30—16:00','西楼202')],materials:[]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.deepEqual(dates(result).map(x=>x.start),['2026-11-20T09:00','2026-11-16T14:30'])
})

test('a time range without an owned date remains visible but does not become a calendar booking',()=>{
 const source='讲座具体日期另行通知，时间为14:00—15:30。'
 const raw={topic:'讲座',kind:'event',items:[event('a','讲座',source,'14:00—15:30','')],materials:[]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(result.events[0].startTimePointTempId,null)
 assert.ok(result.events[0].description.includes('14:00—15:30'))
 assert.equal(result.timePoints.some(p=>Boolean(p.normalizedValue)),false)
})

test('different actions within an explicitly cited specific goal retain distinct deadlines without artificial dependencies',()=>{
 const source='申请志愿岗位：周二18:00前填写登记表，周三19:00前发送个人简介到 team@example.org。'
 const raw={topic:'志愿岗位申请',kind:'action',items:[
  {key:'a',kind:'task',title:'填写登记表',action:'填写',object:'登记表',evidence:['申请志愿岗位：周二18:00前填写登记表'],times:[{role:'deadline',raw:'周二18:00前'}]},
  {key:'b',kind:'task',title:'发送个人简介',action:'发送',object:'个人简介',channel:'team@example.org',evidence:['周三19:00前发送个人简介到 team@example.org'],times:[{role:'deadline',raw:'周三19:00前'}]}
 ],materials:[],goals:[{key:'g',title:'申请志愿岗位',anchor:'申请志愿岗位',evidence:source.slice(0,-1),taskKeys:['a','b']}]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(result.goalGroups?.length,1)
 assert.equal(result.standaloneTasks.length,2)
 assert.deepEqual(result.standaloneTasks.map(t=>t.dependencyTempIds),[[],[]])
 assert.deepEqual(result.timePoints.filter(p=>p.type==='task_deadline').map(p=>p.normalizedValue),['2026-11-17T18:00','2026-11-18T19:00'])
})

test('a broad day heading and explicit unrelated clauses do not combine independent goals',()=>{
 const source='周二安排：请缴纳电费；另外请提交课程报告，两件事项互不相关。'
 const raw={topic:'安排',kind:'action',items:[{key:'a',kind:'task',title:'缴纳电费',action:'缴纳',object:'电费',evidence:['请缴纳电费']},{key:'b',kind:'task',title:'提交课程报告',action:'提交',object:'课程报告',evidence:['请提交课程报告']}],materials:[],goals:[{key:'g',title:'周二安排',anchor:'周二安排',evidence:source.slice(0,-1),taskKeys:['a','b']}]}
 const {result}=compileSemanticNotice(raw,options(source))
 assert.equal(result.standaloneTasks.length,2);assert.equal(result.goalGroups,undefined)
})

test('a source-supported wish to participate is not an identity qualification',()=>{
 const source='音乐讲座于周日15:00举办，想参加的同学请周六20:00前填写报名表。'
 const quote='想参加的同学请周六20:00前填写报名表'
 const raw={topic:'音乐讲座',kind:'mixed',items:[{key:'e',kind:'event',title:'音乐讲座',evidence:['音乐讲座于周日15:00举办'],times:[{role:'start',raw:'周日15:00'}]},{key:'t',kind:'task',title:'填写报名表',action:'填写',object:'报名表',condition:'想参加的同学',evidence:[quote],assignment:{scope:'conditional',actor:'想参加的同学',actorEvidence:'想参加的同学',evidence:quote}}],materials:[]}
 const {result}=compileSemanticNotice(raw,options(source)),task=result.standaloneTasks[0]
 assert.ok(task.description.includes('参加说明：想参加的同学'))
 assert.equal(task.description.includes('适用条件待确认'),false)
 assert.equal(task.userConfirmationRequired,false)
})

test('a source-backed collection office is a place, while a delivery channel stays a channel',()=>{
 const source='请下周一上午到图书室领取实习证明；周三17:00前提交报告到 course@example.org。'
 const raw={topic:'办理',kind:'action',items:[
  {key:'a',kind:'task',title:'到图书室领取实习证明',action:'领取',object:'实习证明',channel:'图书室',evidence:['请下周一上午到图书室领取实习证明'],times:[{role:'window',raw:'下周一上午'}]},
  {key:'b',kind:'task',title:'提交报告',action:'提交',object:'报告',channel:'course@example.org',evidence:['周三17:00前提交报告到 course@example.org'],times:[{role:'deadline',raw:'周三17:00前'}]}
 ],materials:[]}
 const {result}=compileSemanticNotice(raw,options(source)),[pickup,delivery]=result.standaloneTasks
 assert.ok(pickup.description.includes('地点：图书室'))
 assert.equal(pickup.description.includes('提交渠道：图书室'),false)
 assert.ok(delivery.description.includes('提交渠道：course@example.org'))
})
