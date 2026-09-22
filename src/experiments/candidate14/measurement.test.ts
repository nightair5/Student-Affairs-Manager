import {describe,expect,it} from 'vitest'
import {aggregateCandidate14Trials,calculateCandidate14Trial,type Candidate14MetricEvent} from './measurement'

const base={trialId:'t1',sourceIdentitySha256:'s',candidateIdentitySha256:'c',origin:'HUMAN_TRIAL' as const}
const ev=(kind:Candidate14MetricEvent['kind'],atMs:number,extra:Partial<Candidate14MetricEvent>={}):Candidate14MetricEvent=>({...base,kind,atMs,...extra})
describe('candidate14 product metrics',()=>{
  it('requires readback for no-task and excludes engineering replay from human rates',()=>{
    const incomplete=calculateCandidate14Trial([ev('trial_started',0),ev('first_snapshot_frozen',1,{snapshotSha256:'x'}),ev('suggestion_interactive',2),ev('no_task_archived',10)],{firstWholeCorrect:true,finalDispositionCorrect:true,disposition:'no_task'})
    expect(incomplete.status).toBe('INCOMPLETE')
    const good=calculateCandidate14Trial([ev('trial_started',0),ev('first_snapshot_frozen',1,{snapshotSha256:'x'}),ev('suggestion_interactive',2),ev('no_task_archived',10),ev('readback_verified',11)],{firstWholeCorrect:true,finalDispositionCorrect:true,disposition:'no_task'})
    expect(good.correctDisposition).toBe(true)
    expect(aggregateCandidate14Trials([good,{...good,origin:'ENGINEERING_REPLAY'}]).humanTrials).toBe(1)
  })
  it('handles overlapping pause reasons without counting system wait as edit time',()=>{
    const row=calculateCandidate14Trial([ev('trial_started',0),ev('first_snapshot_frozen',1,{snapshotSha256:'x'}),ev('suggestion_interactive',10),ev('pause_started',20,{pauseReason:'system_wait'}),ev('pause_started',25,{pauseReason:'visibility_hidden'}),ev('pause_ended',30,{pauseReason:'system_wait'}),ev('pause_ended',40,{pauseReason:'visibility_hidden'}),ev('confirmation_requested',50),ev('readback_verified',60)],{firstWholeCorrect:false,finalDispositionCorrect:true,disposition:'confirmed'})
    expect(row.activeEditMs).toBe(20)
    expect(row.systemWaitMs).toBe(10)
  })
})
