import test from 'node:test'
import assert from 'node:assert/strict'
import {sourceObjectSafety,applyProductReview} from './product-dev-review.mjs'
test('a prohibition in a correct task description cannot turn a different object into a forbidden action',()=>{
 const s={reference:{tasks:[{object:'登记表',verbs:['提交'],deadline:'2026-10-28'}],forbidden:[{object:'照片',verbs:['提交']}]}}
 const r={standaloneTasks:[{tempId:'T',title:'提交登记表',actionVerb:'提交',actionObject:'登记表',description:'提交登记表，不附照片。',timePointTempIds:['P']}],timePoints:[{tempId:'P',type:'task_deadline',normalizedValue:'2026-10-28',relatedTaskTempIds:['T']}]}
 assert.equal(sourceObjectSafety(r,s).length,0)
 const bad=structuredClone(r);bad.standaloneTasks[0].actionObject='照片';bad.standaloneTasks[0].title='提交照片';assert.equal(sourceObjectSafety(bad,s)[0].code,'FORBIDDEN_ACTION_AS_TASK')
 const date=structuredClone(r);date.timePoints[0].normalizedValue='2026-10-29';assert.equal(sourceObjectSafety(date,s)[0].code,'WRONG_DEADLINE_VALUE')
})
test('unresolved required source support is not a whole complete product suggestion',()=>{
 const b={status:'完整',issues:[],severe:[],matched:1,required:1},s={reference:{tasks:[]}},r={standaloneTasks:[],timePoints:[]}
 assert.equal(applyProductReview(b,r,s,{unresolved:[{entityId:'E',reason:'SOURCE_SUPPORT_MISSING'}]}).status,'未知')
 assert.equal(applyProductReview(b,r,s,{unresolved:[]}).status,'完整')
 assert.equal(b.status,'完整')
})
test('shared objects with distinct channels do not compare each deadline to every other task',()=>{
 const s={reference:{tasks:[{object:'报告',channel:'甲站',deadline:'2026-11-01'},{object:'报告',channel:'乙站',deadline:'2026-11-02'}]}},r={standaloneTasks:[{tempId:'A',title:'向甲站提交报告',actionObject:'报告',timePointTempIds:['P']},{tempId:'B',title:'向乙站提交报告',actionObject:'报告',timePointTempIds:['Q']}],timePoints:[{tempId:'P',type:'submission_deadline',normalizedValue:'2026-11-01',relatedTaskTempIds:['A']},{tempId:'Q',type:'submission_deadline',normalizedValue:'2026-11-02',relatedTaskTempIds:['B']}]}
 assert.equal(sourceObjectSafety(r,s).length,0);const bad=structuredClone(r);bad.timePoints[0].normalizedValue='2026-11-02';assert.equal(sourceObjectSafety(bad,s)[0].code,'WRONG_DEADLINE_VALUE')
})
