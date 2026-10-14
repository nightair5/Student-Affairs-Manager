import {describe,expect,it} from 'vitest'
import type {SemanticInput} from '../mainline04/semanticContract'
import {revisionLabel,taskReviewFingerprint} from './staleRecovery'

const facts={tasks:[{id:'task-1',detail:{materialTempIds:['m1'],timePointTempIds:['t1']},action:{surface:'提交'}}],
  materials:[{tempId:'m1',name:'表格'}],timePoints:[{tempId:'t1',rawText:'周五前'}],events:[],revisions:[]} as unknown as SemanticInput

describe('safe manual reload for an unsaved task edit',()=>{
  it('permits an unrelated independent event update, but detects changes to this task and its material',()=>{
    const before=taskReviewFingerprint(facts,'task-1',{title:'提交表格'})
    const eventOnly={...facts,events:[{tempId:'event-1',title:'讲座'}]} as SemanticInput
    expect(taskReviewFingerprint(eventOnly,'task-1',{title:'提交表格'})).toBe(before)
    const changedMaterial={...facts,materials:[{tempId:'m1',name:'知情书'}]} as SemanticInput
    expect(taskReviewFingerprint(changedMaterial,'task-1',{title:'提交表格'})).not.toBe(before)
    expect(taskReviewFingerprint(facts,'task-1',{title:'已变更标题'})).not.toBe(before)
    expect(()=>taskReviewFingerprint(facts,'missing',{})).toThrow('D16_TASK_MISSING_AFTER_REFRESH')
    expect(revisionLabel('{"revision":1}')).toMatch(/^[0-9a-f]{8}$/)
    expect(revisionLabel('{"revision":2}')).not.toBe(revisionLabel('{"revision":1}'))
  })
})
