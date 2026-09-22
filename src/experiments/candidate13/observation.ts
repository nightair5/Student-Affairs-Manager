import type {WorkspaceRecordStore} from '../../domain/v2/repository'
import type {D5EventKind,SubstantiveEditCategory} from './measurement'

export const D5_OBSERVATION_DATABASE='rco-candidate13-d5-engineering-1'
export const D5_OBSERVATION_KEY='candidate13-d5-observation-v1'
export type D5ObservationOrigin='ENGINEERING_REPLAY'|'AUTOMATION'|'REGISTERED_HUMAN_TRIAL'|'UNKNOWN'
export interface D5ObservationEvent {id:string;trialId:string;sourceId:string;candidateVersion:string;origin:D5ObservationOrigin;
  kind:D5EventKind;atMs:number;firstOutputSha256:string|null;editCategory?:SubstantiveEditCategory|'cosmetic'|'personalization'}

export function createD5ObservationStore(transport:WorkspaceRecordStore&{name:string},origin:D5ObservationOrigin='UNKNOWN'){
  if(transport.name!==D5_OBSERVATION_DATABASE)throw Error('D5_OBSERVATION_DATABASE_BINDING')
  const events=async()=>{const value=await transport.read(D5_OBSERVATION_KEY);return Array.isArray(value)?value as D5ObservationEvent[]:[]}
  const append=async(value:Omit<D5ObservationEvent,'id'|'origin'>)=>transport.transaction(D5_OBSERVATION_KEY,prior=>{
    const existing=Array.isArray(prior)?prior as D5ObservationEvent[]:[]
    if(value.kind==='trial_started'&&existing.some(item=>item.trialId===value.trialId&&item.kind==='trial_started'))throw Error('D5_TRIAL_ALREADY_STARTED')
    const first=existing.find(item=>item.trialId===value.trialId&&item.firstOutputSha256!==null)?.firstOutputSha256
    if(first&&value.firstOutputSha256&&first!==value.firstOutputSha256)throw Error('D5_FIRST_OUTPUT_IDENTITY_CHANGED')
    if(existing.some(item=>item.id===value.trialId+'-'+value.kind+'-'+value.atMs))throw Error('D5_EVENT_DUPLICATE')
    return [...existing,{...value,id:value.trialId+'-'+value.kind+'-'+value.atMs,origin}]
  })
  return {append,events}
}
