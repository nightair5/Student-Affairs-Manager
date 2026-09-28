import {describe,it,expect} from 'vitest'
import {MemoryWorkspaceRecordStore} from '../../domain/v2/repository'
import {D14_DATABASE} from './measurement'
import {beginTrial,loadTrial,trialAction,metricEntry,calculateFourIndicators} from './d14Trial'
const store=()=>Object.assign(new MemoryWorkspaceRecordStore(),{name:D14_DATABASE})
describe('D14 isolated engineering trial',()=>{
  it('manual trial persists exact source and waits for canonical app confirmation',async()=>{
    const s=store(),trial=await beginTrial(s,'manual','请归档匿名材料。',null,null)
    expect(trial.draftId).toBeNull()
    expect(trial.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    expect((await loadTrial(s,trial.id))?.status).toBe('started')
    await trialAction(s,trial.id,'attach','draft')
    const completed=await trialAction(s,trial.id,'complete','draft')
    expect(completed.history.map(x=>x.kind)).toEqual(['start','attach','complete'])
    expect(metricEntry(completed).humanMetrics.correctDisposition).toBe('NOT_OBSERVABLE')
  })
  it('assisted identity, pause, resume, attach and complete are stateful',async()=>{
    const s=store(),trial=await beginTrial(s,'assisted','匿名原文','fixture','a'.repeat(64))
    expect((await trialAction(s,trial.id,'pause')).status).toBe('paused')
    await expect(trialAction(s,trial.id,'attach','draft')).rejects.toThrow('D14_TRIAL_TRANSITION')
    expect((await trialAction(s,trial.id,'resume')).status).toBe('started')
    await trialAction(s,trial.id,'attach','draft')
    expect((await trialAction(s,trial.id,'complete','draft')).status).toBe('completed')
    await expect(trialAction(s,trial.id,'resume')).rejects.toThrow('D14_TRIAL_TRANSITION')
  })
  it('wrong database and missing source fail closed',async()=>{
    await expect(beginTrial(Object.assign(store(),{name:'old-user-db'}),'manual','text',null,null)).rejects.toThrow('D14_TRIAL_IDENTITY')
    await expect(beginTrial(store(),'manual','',null,null)).rejects.toThrow('D14_TRIAL_IDENTITY')
  })
  it('four human indicators keep started denominators and missing values visible',()=>{
    expect(calculateFourIndicators([]).firstWholeSuggestionCorrect.status).toBe('NOT_OBSERVABLE')
    const row={trialId:'anonymous',condition:'assisted' as const,registered:true,consented:true,started:true,sourceSha256:'a'.repeat(64),firstOutputSha256:'b'.repeat(64),firstWholeCorrect:true,finalCorrect:true,readbackVerified:true,lowEditCorrect:null,activeEditMs:null,measurementComplete:false}
    const result=calculateFourIndicators([row])
    expect(result.firstWholeSuggestionCorrect).toMatchObject({status:'OBSERVED',numerator:1,denominator:1})
    expect(result.correctDisposition).toMatchObject({status:'OBSERVED',numerator:1,denominator:1})
    expect(result.lowModificationCorrectDisposition).toMatchObject({status:'INCOMPLETE',denominator:1,missing:1})
    expect(result.activeModificationTime).toMatchObject({status:'INCOMPLETE',meanMs:null,denominator:1,missing:1})
  })
})
