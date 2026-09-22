import {describe,expect,it} from 'vitest'
import {aggregateD5Trials,calculateD5Trial} from './measurement'

describe('Candidate13 D5 product metric accounting',()=>{
  it('requires semantic correctness and independent readback for a correct confirmation',()=>{
    const events=[{kind:'trial_started' as const,atMs:0},{kind:'suggestion_interactive' as const,atMs:100},
      {kind:'confirmation_requested' as const,atMs:200},{kind:'commit_succeeded' as const,atMs:300}]
    const withoutReadback=calculateD5Trial(events,{firstWholeCorrect:true,finalDispositionCorrect:true,disposition:'confirmed'})
    expect(withoutReadback.correctDisposition).toBe(false)
    const withReadback=calculateD5Trial([...events,{kind:'readback_verified',atMs:400}],
      {firstWholeCorrect:true,finalDispositionCorrect:true,disposition:'confirmed'})
    expect(withReadback.correctDisposition).toBe(true)
  })
  it('separates substantive corrections, cosmetic edits, waiting and hidden time',()=>{
    const result=calculateD5Trial([
      {kind:'trial_started',atMs:0},{kind:'edit_started',atMs:100},{kind:'edit_activity',atMs:200,editCategory:'time'},
      {kind:'system_wait_started',atMs:300},{kind:'system_wait_ended',atMs:1300},{kind:'edit_activity',atMs:1400,editCategory:'cosmetic'},
      {kind:'visibility_hidden',atMs:1500},{kind:'visibility_visible',atMs:2500},{kind:'confirmation_requested',atMs:2700},
      {kind:'readback_verified',atMs:2800}],{firstWholeCorrect:false,finalDispositionCorrect:true,disposition:'confirmed'})
    expect(result.activeEditMs).toBe(600);expect(result.systemWaitMs).toBe(1000)
    expect(result.substantiveEditCount).toBe(1);expect(result.cosmeticEditCount).toBe(1)
    expect(result.lowModificationCorrectDisposition).toBe(false)
  })
  it('keeps every started trial in the denominator and missing judgments out of numerators',()=>{
    const good=calculateD5Trial([{kind:'trial_started',atMs:0},{kind:'no_task_archived',atMs:100}],
      {firstWholeCorrect:true,finalDispositionCorrect:true,disposition:'no_task'})
    const unknown=calculateD5Trial([{kind:'trial_started',atMs:0},{kind:'timed_out',atMs:100}],
      {firstWholeCorrect:null,finalDispositionCorrect:null,disposition:'timed_out'})
    const aggregate=aggregateD5Trials([good,unknown])
    expect(aggregate.eligibleStarts).toBe(2);expect(aggregate.firstWholeSuggestionAccuracy).toBe(.5)
    expect(aggregate.correctDispositionRate).toBe(.5);expect(aggregate.activeEditMs.n).toBe(1)
  })
})
