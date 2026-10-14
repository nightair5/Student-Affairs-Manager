import test from 'node:test'
import assert from 'node:assert/strict'
import {reviewFacts} from './product-dev-evaluation.mjs'
import {applyProductReview} from './product-dev-review.mjs'
const s={text:'设备检查暂定2026年12月6日下午，准确开始和结束另行通知。',referenceTime:'2026-10-14T08:00:00+08:00',timezone:'Asia/Shanghai',reference:{tasks:[],events:[{object:'设备检查',startUnknown:true,endUnknown:true}]}}
const r={standaloneTasks:[],materials:[],sourceSummary:{},events:[{tempId:'E',title:'设备检查',description:s.text,startTimePointTempId:'P',endTimePointTempId:null,evidenceIds:['Q']}],timePoints:[{tempId:'P',type:'event_start',rawText:'暂定2026年12月6日下午',normalizedValue:'2026-12-06',precision:'vague',needsConfirmation:true,evidenceIds:['Q']}],evidence:[{id:'Q',quote:s.text}]}
test('explicitly unknown clock may preserve its correct date; wrong date or invented clock cannot',()=>{
 assert.equal(reviewFacts(r,s).status,'部分');assert.equal(applyProductReview(reviewFacts(r,s),r,s).status,'完整')
 for(const value of ['2026-12-07','2026-12-06T15:00']){const bad=structuredClone(r);bad.timePoints[0].normalizedValue=value;assert.equal(applyProductReview(reviewFacts(bad,s),bad,s).status,'部分')}
 const certain=structuredClone(r);certain.timePoints[0].needsConfirmation=false;assert.equal(applyProductReview(reviewFacts(certain,s),certain,s).status,'部分')
})
