import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {buildProductRequest,reviewFacts} from './product-dev-evaluation.mjs'
const dataset=JSON.parse(readFileSync('src/recognition/fixtures/product-dev-v1/notifications.json'))
test('all 36 source-first references are absent from actual requests',()=>{
 assert.equal(dataset.length,36)
 for(const s of dataset){const body=JSON.stringify(buildProductRequest({...s,referenceTime:'2026-10-14T08:30:00+08:00',timezone:'Asia/Shanghai'}));assert.equal(body.includes('"reference"'),false);assert.equal(body.includes('provisional'),false);assert.equal(body.includes(s.text.replaceAll('\n','\\n')),true)}
 assert.equal(new Set(dataset.map(s=>s.scene)).size,9)
})
test('source evidence and task-owned deadline determine whole result; changes of owner/date fail',()=>{
 const s={text:'2026年10月22日18:00前提交报告。',reference:{tasks:[{object:'报告',verbs:['提交'],deadline:'2026-10-22T18:00',precision:'exact'}],events:[]}}
 const r={standaloneTasks:[{tempId:'T',title:'提交报告',actionObject:'报告',actionVerb:'提交',timePointTempIds:['P'],evidenceIds:['E']}],events:[],materials:[],timePoints:[{tempId:'P',type:'submission_deadline',normalizedValue:'2026-10-22T18:00+08:00',relatedTaskTempIds:['T'],evidenceIds:['E']}],evidence:[{id:'E',quote:s.text}]}
 assert.equal(reviewFacts(r,s).status,'完整')
 const wrong=structuredClone(r);wrong.timePoints[0].normalizedValue='2026-10-23T18:00+08:00';assert.notEqual(reviewFacts(wrong,s).status,'完整')
 const foreign=structuredClone(r);foreign.timePoints[0].relatedTaskTempIds=['OTHER'];foreign.standaloneTasks[0].timePointTempIds=[];assert.notEqual(reviewFacts(foreign,s).status,'完整')
 const quote=structuredClone(r);quote.evidence[0].quote='不存在的原文';assert.ok(reviewFacts(quote,s).severe.length)
})
test('cancelled action remains a severe risk and unpublished null is valid',()=>{
 const s={text:'交流延期，时间尚未公布。不要报名。',reference:{tasks:[],events:[{object:'交流',startUnknown:true}],forbidden:[{object:'报名',verbs:['报名']}]}}
 const r={standaloneTasks:[],events:[{tempId:'E',title:'交流',evidenceIds:['Q'],startTimePointTempId:null}],timePoints:[],materials:[],evidence:[{id:'Q',quote:s.text}]}
 assert.equal(reviewFacts(r,s).status,'完整');r.standaloneTasks.push({tempId:'T',title:'报名',actionVerb:'报名',evidenceIds:['Q']});assert.equal(reviewFacts(r,s).status,'错');assert.ok(reviewFacts(r,s).severe.some(s=>s.code==='FORBIDDEN_ACTION_AS_TASK'))
})
