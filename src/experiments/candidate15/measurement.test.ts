import {describe,expect,it} from 'vitest'
import {aggregateD8Trials,calculateD8Trial,type D8Event,type D8Registration,type D8Judgment} from './measurement'

const registration:D8Registration={trialId:'engineering-1',origin:'ENGINEERING_REPLAY',sourceSha256:'a'.repeat(64),candidateSha256:'b'.repeat(64),firstOutputSha256:'c'.repeat(64),registeredAtMs:0,humanAuthorityVerified:false}
const judgment:D8Judgment={firstWholeCorrect:false,finalDispositionCorrect:true,disposition:'confirmed'}
const event=(kind:D8Event['kind'],atMs:number,extra:Partial<D8Event>={}):D8Event=>({id:'e'+atMs,atMs,kind,trialId:registration.trialId,sourceSha256:registration.sourceSha256,candidateSha256:registration.candidateSha256,firstOutputSha256:registration.firstOutputSha256,...extra})
const start=[event('trial_started',0),event('first_snapshot_frozen',1),event('suggestion_interactive',2)]
describe('D8 human-measurement contract, engineering counterexamples only',()=>{
  it('does not turn ten seconds of reading into active editing',()=>{
    const row=calculateD8Trial(registration,[...start,event('read_started',3),event('read_ended',10003),event('confirmation_requested',10004),event('commit_succeeded',10005,{commitId:'save',includedEditIds:[]}),event('readback_verified',10006,{commitId:'save'})],{...judgment,firstWholeCorrect:true})
    expect(row.activeEditMs).toBe(0);expect(row.readMs).toBe(10000);expect(row.lowModificationCorrectDisposition).toBe(true)
    expect(aggregateD8Trials([row]).allStartedHumanTrials).toBe(0)
  })
  it('counts a corrected field even when edit and batch commit IDs differ',()=>{
    const row=calculateD8Trial(registration,[...start,event('edit_started',3,{editId:'edit-time'}),event('edit_activity',4,{editId:'edit-time',editCategory:'time'}),event('edit_ended',9,{editId:'edit-time'}),event('confirmation_requested',10),event('commit_succeeded',11,{commitId:'batch-save',includedEditIds:['edit-time']}),event('readback_verified',12,{commitId:'batch-save'})],judgment)
    expect(row.status).toBe('DETERMINATE');expect(row.substantiveEditCount).toBe(1);expect(row.lowModificationCorrectDisposition).toBe(false)
  })
  it('missing batch link stays unknown, never silently zero or low modification',()=>{
    const row=calculateD8Trial(registration,[...start,event('edit_started',3,{editId:'edit-time'}),event('edit_activity',4,{editId:'edit-time',editCategory:'time'}),event('edit_ended',5,{editId:'edit-time'}),event('confirmation_requested',6),event('commit_succeeded',7,{commitId:'batch-save',includedEditIds:[]}),event('readback_verified',8,{commitId:'batch-save'})],judgment)
    expect(row.status).toBe('INCOMPLETE');expect(row.substantiveEditCount).toBeNull();expect(row.lowModificationCorrectDisposition).toBeNull()
  })
  it('retains editing burden before timeout and separates hidden, waiting and idle',()=>{
    const rows=[...start,event('edit_started',3,{editId:'edit-time'}),event('edit_activity',4,{editId:'edit-time',editCategory:'time'}),event('pause_started',5,{pauseToken:'sys',pauseReason:'system_wait'}),event('pause_started',6,{pauseToken:'hidden',pauseReason:'visibility_hidden'}),event('pause_ended',16,{pauseToken:'hidden',pauseReason:'visibility_hidden'}),event('pause_ended',18,{pauseToken:'sys',pauseReason:'system_wait'}),event('idle_started',19),event('idle_ended',29),event('edit_ended',30,{editId:'edit-time'}),event('timed_out',31)]
    const row=calculateD8Trial(registration,rows,{firstWholeCorrect:false,finalDispositionCorrect:false,disposition:'timed_out'})
    expect(row.status).toBe('DETERMINATE');expect(row.activeEditMs).toBe(4);expect(row.systemWaitMs).toBe(3);expect(row.hiddenMs).toBe(10);expect(row.idleMs).toBe(10);expect(row.substantiveEditCount).toBe(1)
  })
  it('does not admit unverified human registration',()=>{
    const invalid=calculateD8Trial({...registration,origin:'HUMAN_TRIAL'},start,judgment)
    expect(invalid.status).toBe('REGISTRATION_INVALID')
    expect(aggregateD8Trials([invalid]).allStartedHumanTrials).toBe(0)
    expect(aggregateD8Trials([invalid]).invalidHumanRegistrations).toBe(1)
  })
  it('marks time across refresh unknown instead of counting the offline gap as reading',()=>{
    const row=calculateD8Trial(registration,[...start,event('read_started',3),event('page_restored',10000),event('read_started',10001),event('read_ended',10002),event('confirmation_requested',10003),event('commit_succeeded',10004,{commitId:'save',includedEditIds:[]}),event('readback_verified',10005,{commitId:'save'})],judgment)
    expect(row.status).toBe('INCOMPLETE');expect(row.readMs).toBeNull();expect(row.missing).toContain('refresh time discontinuity')
  })
})
