import {describe,expect,it} from 'vitest'
import type {WorkspaceRecordStore} from '../../domain/v2/repository'
import {D8_DATABASE} from './d8Observation'
import {calculateD8Trial,type D8Registration} from './measurement'
import {createD8UiMeasurement} from './uiMeasurement'

function memoryStore(){
  const rows=new Map<string,unknown>()
  const store={name:D8_DATABASE,read:async(key:string)=>rows.get(key),write:async(key:string,value:unknown)=>{rows.set(key,value)},transaction:async(key:string,mutate:(value:unknown)=>unknown)=>{const next=mutate(rows.get(key));rows.set(key,next);return next},remove:async(key:string)=>{rows.delete(key)},transactionMany:async()=>new Map<string,unknown>()} satisfies WorkspaceRecordStore&{name:string}
  return store
}
const registration:D8Registration={trialId:'recorded-engineering',origin:'ENGINEERING_REPLAY',sourceSha256:'a'.repeat(64),candidateSha256:'b'.repeat(64),firstOutputSha256:'c'.repeat(64),registeredAtMs:Date.now(),humanAuthorityVerified:false}

describe('D8 real UI event recorder',()=>{
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
})
