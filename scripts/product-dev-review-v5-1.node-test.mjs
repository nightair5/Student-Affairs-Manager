import test from 'node:test'
import assert from 'node:assert/strict'
import {reviewV51} from './product-dev-review-v5-1.mjs'
const source={text:'请在2027年4月2日至5日登录系统。',reference:{tasks:[{object:'系统',verbs:['登录']}],events:[],window:'2027-04-02/2027-04-05'}}
const r={standaloneTasks:[{tempId:'T',title:'登录系统',actionVerb:'登录',actionObject:'系统',description:source.text,evidenceIds:['Q'],timePointTempIds:['P']}],materials:[],events:[],timePoints:[{tempId:'P',type:'registration_deadline',normalizedValue:'2027-04-02',rawText:'4月2日至5日',relatedTaskTempIds:['T'],evidenceIds:['Q']}],evidence:[{id:'Q',quote:source.text}]}
test('a global date window used as deadline is severe, including a declared end; inactive ownerless history remains inert',()=>{
 for(const date of ['2027-04-02','2027-04-05']){const b=structuredClone(r);b.timePoints[0].normalizedValue=date;assert.ok(reviewV51(b,source).severe.some(s=>s.code.startsWith('WINDOW_')))}
 const b=structuredClone(r);b.timePoints[0].selected=false;b.timePoints[0].relatedTaskTempIds=[];b.standaloneTasks[0].timePointTempIds=[];assert.equal(reviewV51(b,source).severe.length,0)
})
test('an independently stated cutoff may share a date with a window',()=>{
 const s=structuredClone(source);s.reference.tasks[0].deadline='2027-04-02';s.reference.tasks[0].precision='date_only';s.text+='报名截止4月2日。';const b=structuredClone(r);b.evidence[0].quote=s.text;assert.equal(reviewV51(b,s).severe.length,0)
})
test('material equivalence does not turn unresolved primary ownership into complete',()=>{
 const s={text:'准备讨论提纲。',reference:{tasks:[{object:'讨论提纲',verbs:['准备'],material:'讨论提纲'}],events:[]}},b={standaloneTasks:[{tempId:'T',title:'准备讨论提纲',actionVerb:'准备',actionObject:'讨论提纲',completionCriteria:['讨论提纲已完成'],evidenceIds:['Q']}],materials:[],events:[],timePoints:[],evidence:[{id:'Q',quote:'准备讨论提纲。'}]};assert.equal(reviewV51(b,s).status,'完整');assert.equal(reviewV51(b,s,{audit:{unresolved:[{entityId:'T',reason:'OWNER_MISSING'}]}}).status,'未知')
})
test('a project field cannot cite a request title absent from the body; ordinary standalone facts stay separate',()=>{
 const b=structuredClone(r);b.timePoints=[];b.standaloneTasks[0].timePointTempIds=[];b.projectSuggestion={title:{value:'请求标题',evidenceIds:['TITLE'],inferenceLevel:'strong_inference'}};b.evidence.push({id:'TITLE',quote:'请求标题'});assert.ok(reviewV51(b,source).severe.some(s=>s.entity==='project.title'))
 b.projectSuggestion.title.evidenceIds=['Q'];assert.equal(reviewV51(b,source).severe.length,0)
})
