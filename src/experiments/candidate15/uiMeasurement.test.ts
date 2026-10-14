import {describe,expect,it} from 'vitest'
import type {WorkspaceRecordStore} from '../../domain/v2/repository'
import {D8_DATABASE} from './d8Observation'
import {aggregateD8Trials,calculateD8Trial,type D8Registration} from './measurement'
import {createD8UiMeasurement} from './uiMeasurement'

function memoryStore(){
  const rows=new Map<string,unknown>()
  const store={name:D8_DATABASE,read:async(key:string)=>rows.get(key),write:async(key:string,value:unknown)=>{rows.set(key,value)},transaction:async(key:string,mutate:(value:unknown)=>unknown)=>{const next=mutate(rows.get(key));rows.set(key,next);return next},remove:async(key:string)=>{rows.delete(key)},transactionMany:async()=>new Map<string,unknown>()} satisfies WorkspaceRecordStore&{name:string}
  return store
}
const registration:D8Registration={trialId:'recorded-engineering',origin:'ENGINEERING_REPLAY',sourceSha256:'a'.repeat(64),candidateSha256:'b'.repeat(64),firstOutputSha256:'c'.repeat(64),registeredAtMs:Date.now(),humanAuthorityVerified:false}

describe('D8 real UI event recorder',()=>{
  it('counts 10 seconds of reading as zero editing and records verified no-task review',async()=>{
    const ui=createD8UiMeasurement(memoryStore()),draftId='info-draft'
    const reg={...registration,registeredAtMs:Date.now()-11_000}
    await ui.begin(draftId,reg)
    const rows=await ui.events(draftId)
    // The clock mutation is limited to this anonymous in-memory measurement test.
    rows.forEach(row=>{row.atMs-=10_000})
    await ui.reviewNoTask(draftId,async()=>{})
    const result=calculateD8Trial(reg,await ui.events(draftId),{firstWholeCorrect:true,finalDispositionCorrect:true,disposition:'no_task'})
    expect(result.status).toBe('DETERMINATE')
    expect(result.substantiveEditCount).toBe(0)
    expect(result.activeEditMs).toBe(0)
    expect(result.readMs).toBeGreaterThanOrEqual(10_000)
  })
  it('a failed no-task save has no terminal success and a later retry retains the source trial',async()=>{
    const ui=createD8UiMeasurement(memoryStore()),draftId='retry-draft'
    await ui.begin(draftId,registration)
    await expect(ui.reviewNoTask(draftId,async()=>{throw Error('injected write failure')})).rejects.toThrow('injected write failure')
    expect((await ui.events(draftId)).some(row=>row.kind==='no_task_archived')).toBe(false)
    await ui.reviewNoTask(draftId,async()=>{})
    const events=await ui.events(draftId)
    expect(events.filter(row=>row.kind==='no_task_archived')).toHaveLength(1)
    expect(calculateD8Trial(registration,events,{firstWholeCorrect:true,finalDispositionCorrect:true,disposition:'no_task'}).status).toBe('DETERMINATE')
  })
  it('maps two changed fields to one batch save and does not count reading as editing',async()=>{
    const ui=createD8UiMeasurement(memoryStore()),draftId='draft-1'
    await ui.begin(draftId,registration)
    await ui.changed(draftId,'title','task-1:title')
    await ui.changed(draftId,'time','task-1:deadline')
    await ui.saved(draftId,'batch-1')
    await ui.confirmation(draftId,async()=>{})
    const events=await ui.events(draftId),batch=events.find(e=>e.kind==='commit_succeeded'&&e.commitId==='batch-1')
    expect(batch?.includedEditIds).toHaveLength(2)
    const result=calculateD8Trial(registration,events,{firstWholeCorrect:false,finalDispositionCorrect:true,disposition:'confirmed'})
    expect(result.status).toBe('DETERMINATE')
    expect(result.substantiveEditCount).toBe(2)
    expect(result.lowModificationCorrectDisposition).toBe(false)
  })
  it('links an independent event correction to its saved commit and keeps a failed confirmation out of success',async()=>{
    const ui=createD8UiMeasurement(memoryStore()),draftId='independent-event-draft'
    await ui.begin(draftId,registration)
    await ui.changed(draftId,'event','event:location')
    await ui.saved(draftId,'event-edit-commit')
    await expect(ui.reviewNoTask(draftId,async()=>{throw Error('injected failure')})).rejects.toThrow('injected failure')
    expect((await ui.events(draftId)).some(row=>row.kind==='no_task_archived')).toBe(false)
    await ui.reviewNoTask(draftId,async()=>{})
    const rows=await ui.events(draftId),result=calculateD8Trial(registration,rows,{firstWholeCorrect:false,finalDispositionCorrect:true,disposition:'no_task'})
    expect(rows.find(row=>row.commitId==='event-edit-commit')?.includedEditIds).toHaveLength(1)
    expect(result.substantiveEditCount).toBe(1)
    expect(result.lowModificationCorrectDisposition).toBe(false)
    expect(aggregateD8Trials([result]).allStartedHumanTrials).toBe(0)
  })
})
