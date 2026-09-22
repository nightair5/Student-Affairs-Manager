import {describe,expect,it} from 'vitest'
import {aggregateCandidate14Trials,calculateCandidate14Trial,type Candidate14MetricEvent,type Candidate14TrialRegistration} from './measurement'

const registration:Candidate14TrialRegistration={registrationId:'reg-1',trialId:'t1',sourceIdentitySha256:'s',candidateIdentitySha256:'c',origin:'HUMAN_TRIAL',status:'REGISTERED',registeredAtMs:0}
let sequence=0
const ev=(kind:Candidate14MetricEvent['kind'],atMs:number,extra:Partial<Candidate14MetricEvent>={}):Candidate14MetricEvent=>({eventId:`event-${++sequence}`,sequence,registrationId:registration.registrationId,trialId:registration.trialId,sourceIdentitySha256:registration.sourceIdentitySha256,candidateIdentitySha256:registration.candidateIdentitySha256,kind,atMs,...extra})
describe('candidate14 product metrics',()=>{
  it('requires commit/readback and a registered human trial',()=>{
    sequence=0;const incomplete=calculateCandidate14Trial(registration,[ev('trial_started',0),ev('first_snapshot_frozen',1,{snapshotSha256:'x'}),ev('suggestion_interactive',2),ev('confirmation_requested',10),ev('readback_verified',11,{operationId:'save-1'})],{firstWholeCorrect:true,finalDispositionCorrect:true,disposition:'confirmed'})
    expect(incomplete.correctDisposition).toBe(false)
    sequence=0;const good=calculateCandidate14Trial(registration,[ev('trial_started',0),ev('first_snapshot_frozen',1,{snapshotSha256:'x'}),ev('suggestion_interactive',2),ev('confirmation_requested',10),ev('commit_succeeded',11,{operationId:'save-1'}),ev('readback_verified',12,{operationId:'save-1'})],{firstWholeCorrect:true,finalDispositionCorrect:true,disposition:'confirmed'})
    expect(good.correctDisposition).toBe(true)
    expect(aggregateCandidate14Trials([good],[registration]).humanTrials).toBe(1)
    expect(aggregateCandidate14Trials([good],[]).humanTrials).toBe(0)
  })
  it('uses pause tokens and unions nested waits',()=>{
    sequence=0;const row=calculateCandidate14Trial(registration,[ev('trial_started',0),ev('first_snapshot_frozen',1,{snapshotSha256:'x'}),ev('suggestion_interactive',10),ev('pause_started',20,{pauseReason:'system_wait',pauseToken:'wait-a'}),ev('pause_started',25,{pauseReason:'system_wait',pauseToken:'wait-b'}),ev('pause_ended',30,{pauseReason:'system_wait',pauseToken:'wait-a'}),ev('pause_ended',40,{pauseReason:'system_wait',pauseToken:'wait-b'}),ev('confirmation_requested',50),ev('commit_succeeded',55,{operationId:'save'}),ev('readback_verified',60,{operationId:'save'})],{firstWholeCorrect:false,finalDispositionCorrect:true,disposition:'confirmed'})
    expect(row.activeEditMs).toBe(20);expect(row.systemWaitMs).toBe(20)
  })
  it('deduplicates edit events by persisted operation and rejects sequence drift',()=>{
    sequence=0;const events=[ev('trial_started',0),ev('first_snapshot_frozen',1,{snapshotSha256:'x'}),ev('suggestion_interactive',2),ev('edit_activity',3,{editCategory:'object',operationId:'edit-1'}),ev('edit_activity',4,{editCategory:'object',operationId:'edit-1'}),ev('confirmation_requested',5),ev('commit_succeeded',6,{operationId:'save'}),ev('readback_verified',7,{operationId:'save'})]
    expect(calculateCandidate14Trial(registration,events,{firstWholeCorrect:false,finalDispositionCorrect:true,disposition:'confirmed'}).substantiveEditCount).toBe(1)
    expect(calculateCandidate14Trial(registration,events.map((event,index)=>index===2?{...event,sequence:9}:event),{firstWholeCorrect:false,finalDispositionCorrect:true,disposition:'confirmed'}).status).toBe('IDENTITY_INVALID')
  })
})
