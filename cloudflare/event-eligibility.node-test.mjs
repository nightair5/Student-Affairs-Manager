import {test} from 'node:test'
import assert from 'node:assert/strict'
import {isEventEligibility} from './event-eligibility.mjs'

test('attendance counts, capacity and voluntary participation are not eligibility',()=>{
 for(const text of ['参与人数：37人','报名人数: 20人','名额有限，先到先得','有意向的同学建议参加','如果有意向，请参加','欢迎感兴趣的同学到场']){
  assert.equal(isEventEligibility(text),false,text)
 }
})

test('a genuine qualification remains a condition even when voluntary or capacity-limited',()=>{
 for(const text of ['仅限本院学生参加','符合条件的同学可报名','有意向的本院学生','有意向且仅限本校学生','名额有限，仅限本院学生','入选后方可参加','欢迎有意向的同学参加，须面试合格后方可参加','报名须经筛选通过','限大三及以上']){
  assert.equal(isEventEligibility(text),true,text)
 }
})
