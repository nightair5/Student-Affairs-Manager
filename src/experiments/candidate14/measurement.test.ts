import {describe,expect,it} from 'vitest'
import {MemoryWorkspaceRecordStore} from '../../domain/v2/repository'
import {aggregateCandidate14Trials,calculateCandidate14Trial,candidate14HumanAuthorizationKey,CANDIDATE14_MEASUREMENT_DATABASE,registerCandidate14Trial,type Candidate14MetricEvent,type Candidate14TrialRegistration} from './measurement'

const sha='a'.repeat(64),snapshot='b'.repeat(64)
const registration:Candidate14TrialRegistration={registrationId:'reg-1',trialId:'t1',sourceIdentitySha256:sha,candidateIdentitySha256:'c'.repeat(64),firstOutputSha256:snapshot,origin:'HUMAN_TRIAL',status:'REGISTERED',registeredAtMs:0}
const makeStore=()=>Object.assign(new MemoryWorkspaceRecordStore(),{name:CANDIDATE14_MEASUREMENT_DATABASE})
const authorize=async(store:ReturnType<typeof makeStore>)=>store.write(candidate14HumanAuthorizationKey(registration.registrationId),registration)
let sequence=0
const ev=(kind:Candidate14MetricEvent['kind'],atMs:number,extra:Partial<Candidate14MetricEvent>={}):Candidate14MetricEvent=>({eventId:`event-${++sequence}`,sequence,registrationId:registration.registrationId,trialId:registration.trialId,sourceIdentitySha256:registration.sourceIdentitySha256,candidateIdentitySha256:registration.candidateIdentitySha256,kind,atMs,...(sequence>2?{snapshotSha256:snapshot}:{}),...extra})
describe('candidate14 product metrics',()=>{
  it('requires a persisted registration and ordered commit/readback',async()=>{
    const store=makeStore();await authorize(store);await registerCandidate14Trial(store,registration)
    sequence=0;const reversed=await calculateCandidate14Trial(store,registration,[ev('trial_started',0),ev('first_snapshot_frozen',1,{snapshotSha256:snapshot}),ev('suggestion_interactive',2),ev('confirmation_requested',10),ev('readback_verified',11,{operationId:'save-1'}),ev('commit_succeeded',12,{operationId:'save-1'}),ev('readback_verified',13,{operationId:'unrelated'})],{firstWholeCorrect:true,finalDispositionCorrect:true,disposition:'confirmed'})
    expect(reversed.correctDisposition).toBe(false)
    sequence=0;const good=await calculateCandidate14Trial(store,registration,[ev('trial_started',0),ev('first_snapshot_frozen',1,{snapshotSha256:snapshot}),ev('suggestion_interactive',2),ev('confirmation_requested',10),ev('commit_succeeded',11,{operationId:'save-1'}),ev('readback_verified',12,{operationId:'save-1'})],{firstWholeCorrect:true,finalDispositionCorrect:true,disposition:'confirmed'})
    expect(good.correctDisposition).toBe(true);expect(good.registryVerified).toBe(true);expect((await aggregateCandidate14Trials(store,[good])).humanTrials).toBe(1)
    expect((await calculateCandidate14Trial(makeStore(),registration,[],{firstWholeCorrect:true,finalDispositionCorrect:true,disposition:'confirmed'})).status).toBe('IDENTITY_INVALID')
  })
  it('uses pause tokens and unions nested waits',async()=>{
    const store=makeStore();await authorize(store);await registerCandidate14Trial(store,registration);sequence=0;const row=await calculateCandidate14Trial(store,registration,[ev('trial_started',0),ev('first_snapshot_frozen',1,{snapshotSha256:snapshot}),ev('suggestion_interactive',10),ev('pause_started',20,{pauseReason:'system_wait',pauseToken:'wait-a'}),ev('pause_started',25,{pauseReason:'system_wait',pauseToken:'wait-b'}),ev('pause_ended',30,{pauseReason:'system_wait',pauseToken:'wait-a'}),ev('pause_ended',40,{pauseReason:'system_wait',pauseToken:'wait-b'}),ev('confirmation_requested',50),ev('commit_succeeded',55,{operationId:'save'}),ev('readback_verified',60,{operationId:'save'})],{firstWholeCorrect:false,finalDispositionCorrect:true,disposition:'confirmed'})
    expect(row.activeEditMs).toBe(20);expect(row.systemWaitMs).toBe(20)
  })
  it('counts only edits with persisted commit/readback and rejects identity drift',async()=>{
    const store=makeStore();await authorize(store);await registerCandidate14Trial(store,registration);sequence=0;const events=[ev('trial_started',0),ev('first_snapshot_frozen',1,{snapshotSha256:snapshot}),ev('suggestion_interactive',2),ev('edit_activity',3,{editCategory:'object',operationId:'edit-1'}),ev('edit_activity',4,{editCategory:'object',operationId:'edit-2'}),ev('commit_succeeded',5,{operationId:'edit-1'}),ev('readback_verified',6,{operationId:'edit-1'}),ev('confirmation_requested',7),ev('commit_succeeded',8,{operationId:'save'}),ev('readback_verified',9,{operationId:'save'})]
    expect((await calculateCandidate14Trial(store,registration,events,{firstWholeCorrect:false,finalDispositionCorrect:true,disposition:'confirmed'})).substantiveEditCount).toBe(1)
    expect((await calculateCandidate14Trial(store,registration,events.map((event,index)=>index===2?{...event,sequence:9}:event),{firstWholeCorrect:false,finalDispositionCorrect:true,disposition:'confirmed'})).status).toBe('IDENTITY_INVALID')
    sequence=0;const late=[ev('trial_started',0),ev('first_snapshot_frozen',1,{snapshotSha256:snapshot}),ev('suggestion_interactive',2),ev('commit_succeeded',3,{operationId:'late'}),ev('readback_verified',4,{operationId:'late'}),ev('edit_activity',5,{editCategory:'object',operationId:'late'}),ev('confirmation_requested',6),ev('commit_succeeded',7,{operationId:'save'}),ev('readback_verified',8,{operationId:'save'})];expect((await calculateCandidate14Trial(store,registration,late,{firstWholeCorrect:false,finalDispositionCorrect:true,disposition:'confirmed'})).substantiveEditCount).toBe(0)
  })
  it('fails closed without an externally provisioned human-trial authorization',async()=>{await expect(registerCandidate14Trial(makeStore(),registration)).rejects.toThrow('CANDIDATE14_HUMAN_TRIAL_NOT_AUTHORIZED')})
})
