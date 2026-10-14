import {describe,expect,it} from 'vitest'
import {MemoryWorkspaceRecordStore} from '../../domain/v2/repository'
import {createD5ObservationStore,D5_OBSERVATION_DATABASE} from './observation'

describe('Candidate13 D5 isolated observation sidecar',()=>{
  it('persists only minimal event metadata and protects first output identity',async()=>{
    const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:D5_OBSERVATION_DATABASE})
    const store=createD5ObservationStore(transport,'AUTOMATION'),base={trialId:'trial-1',sourceId:'source-1',candidateVersion:'candidate13'}
    await store.append({...base,kind:'trial_started',atMs:1,firstOutputSha256:null})
    await store.append({...base,kind:'suggestion_interactive',atMs:2,firstOutputSha256:'abc'})
    await store.append({...base,kind:'edit_activity',atMs:3,firstOutputSha256:'abc',editCategory:'time'})
    expect(await store.events()).toHaveLength(3)
    expect(JSON.stringify(await store.events())).not.toMatch(/sourceText|rawOutput|secret/i)
    await expect(store.append({...base,kind:'confirmation_requested',atMs:4,firstOutputSha256:'changed'})).rejects.toThrow('D5_FIRST_OUTPUT_IDENTITY_CHANGED')
  })
  it('blocks duplicate starts, duplicate events and a foreign database',async()=>{
    const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:D5_OBSERVATION_DATABASE})
    const store=createD5ObservationStore(transport),event={trialId:'trial-1',sourceId:'source-1',candidateVersion:'candidate13',kind:'trial_started' as const,atMs:1,firstOutputSha256:null}
    await store.append(event);await expect(store.append(event)).rejects.toThrow('D5_TRIAL_ALREADY_STARTED')
    transport.name='production';expect(()=>createD5ObservationStore(transport)).toThrow('D5_OBSERVATION_DATABASE_BINDING')
  })
})
