import test from 'node:test'
import assert from 'node:assert/strict'
import {reviewV5} from './product-dev-review-v5.mjs'
const source=(text,reference)=>({text,reference:{tasks:[],events:[],...reference},timezone:'Asia/Shanghai'})
const result=(text)=>({standaloneTasks:[],materials:[],events:[],timePoints:[],evidence:[{id:'q',quote:text}]})
const task=(name,verb='准备')=>({tempId:'t',title:verb+name,actionVerb:verb,actionObject:name,completionCriteria:[name+'已完成'],evidenceIds:['q'],selected:true})
test('same cited preparation object need not duplicate a material row; distinct attachments and wrong owners remain missing',()=>{
 const s=source('讨论前准备一页简报，不必提交。',{tasks:[{object:'简报',verbs:['准备'],material:'简报'}]}),r=result(s.text);r.standaloneTasks=[task('一页简报')]
 assert.equal(reviewV5(r,s).status,'完整')
 const other=structuredClone(r);other.standaloneTasks[0].actionObject='幻灯片';assert.notEqual(reviewV5(other,s).status,'完整')
 const attached=source('准备简报，并另附地图。',{tasks:[{object:'简报',verbs:['准备'],material:'地图'}]});assert.ok(reviewV5(r,attached).issues.some(i=>i.code==='MISSING_OWNED_MATERIAL'))
 const invalid=structuredClone(r);invalid.evidence[0].quote='别的来源';assert.equal(reviewV5(invalid,s).status,'错')
})
test('ZIP equivalence requires all owned components, packaging and original quantities',()=>{
 const s=source('提交3张照片和拍摄说明，合并为压缩包。',{tasks:[{object:'压缩包',verbs:['提交'],material:'压缩包'}],criteria:['照片','拍摄说明']}),r=result(s.text);r.standaloneTasks=[{...task('压缩包','提交'),completionCriteria:['3张照片和拍摄说明合并为压缩包']}];r.materials=['3张照片','拍摄说明'].map((name,i)=>({tempId:'m'+i,name,relatedTaskTempIds:['t'],evidenceIds:['q']}))
 assert.equal(reviewV5(r,s).status,'完整')
 for(const mutation of ['component','owner','quantity']){const b=structuredClone(r);if(mutation==='component')b.materials.pop();if(mutation==='owner')b.materials[1].relatedTaskTempIds=['foreign'];if(mutation==='quantity'){b.materials[0].name='2张照片';b.standaloneTasks[0].completionCriteria=['2张照片和拍摄说明合并为压缩包']}assert.notEqual(reviewV5(b,s).status,'完整',mutation)}
})
test('adjacent phase can share an event, but a departure encoded as end or another object cannot pass',()=>{
 const s=source('10月30日09:00集合，09:15出发。',{events:[{object:'集合',start:'2026-10-30T09:00'},{object:'出发',start:'2026-10-30T09:15'}]}),r=result(s.text)
 r.events=[{tempId:'e',title:'集合',description:s.text,startTimePointTempId:'p',evidenceIds:['q']}];r.timePoints=[{tempId:'p',type:'event_start',normalizedValue:'2026-10-30T09:00',relatedEventTempIds:['e'],rawText:'09:00集合',evidenceIds:['q']},{tempId:'q2',type:'event_start',normalizedValue:'2026-10-30T09:15',relatedEventTempIds:['e'],rawText:'09:15出发',evidenceIds:['q']}]
 assert.equal(reviewV5(r,s).status,'完整')
 for(const change of ['type','owner','date']){const b=structuredClone(r);if(change==='type')b.timePoints[1].type='event_end';if(change==='owner')b.timePoints[1].relatedEventTempIds=['foreign'];if(change==='date')b.timePoints[1].normalizedValue='2026-10-31T09:15';assert.notEqual(reviewV5(b,s).status,'完整',change)}
})
test('bare appointed date keeps date-only semantics; guessed clock and true cutoff never get this equivalence',()=>{
 const s=source('于11月3日提交简报。',{tasks:[{object:'简报',verbs:['提交'],deadline:'2026-11-03',precision:'date_only'}]}),r=result(s.text);r.standaloneTasks=[task('简报','提交')];r.timePoints=[{tempId:'p',type:'planned_start',normalizedValue:'2026-11-03',precision:'date_only',isAllDay:true,relatedTaskTempIds:['t'],evidenceIds:['q']}]
 assert.equal(reviewV5(r,s).status,'完整')
 const b=structuredClone(r);b.timePoints[0].normalizedValue='2026-11-03T18:00';assert.notEqual(reviewV5(b,s).status,'完整')
 const cutoff=source('11月3日前提交简报。',s.reference);const c=structuredClone(r);c.evidence[0].quote=cutoff.text;assert.notEqual(reviewV5(c,cutoff).status,'完整')
})
test('generic advice is not a preselected obligation; unknown and severe errors stay in denominator',()=>{
 const s=source('维护期间请安排好工作。',{}),r=result(s.text);r.standaloneTasks=[task('工作','安排')];assert.equal(reviewV5(r,s).issues[0].code,'GENERIC_ADVICE_AS_EXECUTABLE_TASK')
 const optional=structuredClone(r);optional.standaloneTasks[0].selected=false;optional.standaloneTasks[0].inferenceLevel='optional_suggestion';assert.equal(reviewV5(optional,s).status,'完整')
 assert.equal(reviewV5(null,s).status,'未知')
 const forbidden=source('不要提交简报。',{forbidden:[{object:'简报',verbs:['提交']}]});const b=result(forbidden.text);b.standaloneTasks=[task('简报','提交')];assert.equal(reviewV5(b,forbidden).status,'错');assert.ok(reviewV5(b,forbidden).severe.length)
})
