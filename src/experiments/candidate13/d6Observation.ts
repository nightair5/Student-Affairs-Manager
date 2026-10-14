import type {WorkspaceRecordStore} from '../../domain/v2/repository'
import type {WorkspaceV8} from '../../domain/v2/types'

export type D6ObservationOrigin='ENGINEERING_REPLAY'|'AUTOMATION'|'UNKNOWN'
export type D6EventKind='source_ready'|'suggestion_ready'|'edit_saved'|'rejected'|'confirmation_requested'|'commit_succeeded'|'commit_failed'|'readback_verified'|'no_task_reviewed'
export interface D6Event {id:string;at:string;kind:D6EventKind;origin:D6ObservationOrigin;draftId:string|null;sourceVersionId:string|null;candidateVersion:string|null}
export const D6_EVENTS_KEY='candidate13-d6-observation-v1'
export const D6_DATABASE='rco-mainline-01-02-i1-real-input-candidate13-d6-engineering-1'
export function assertD6Database(name:string){if(name!==D6_DATABASE)throw Error('D6_DATABASE_BINDING')}
const workspace=(value:unknown):WorkspaceV8|undefined=>value&&typeof value==='object'&&'schemaVersion' in value&&value.schemaVersion===8?value as WorkspaceV8:undefined

export function createD6Store(transport:WorkspaceRecordStore&{name:string},origin:D6ObservationOrigin='UNKNOWN'){
  assertD6Database(transport.name);let failNext=false
  function event(kind:D6EventKind,w?:WorkspaceV8,draftId?:string):D6Event{
    const draft=w?.extractionDrafts.find(item=>item.id===draftId),run=w?.recognitionRuns.find(item=>item.id===draft?.recognitionRunId)
    return {id:crypto.randomUUID(),at:new Date().toISOString(),kind,origin,draftId:draftId??null,sourceVersionId:run?.sourceVersionId??null,candidateVersion:run?.promptVersion??null}
  }
  async function append(kind:D6EventKind,w?:WorkspaceV8,draftId?:string){await transport.transaction(D6_EVENTS_KEY,raw=>[...(Array.isArray(raw)?raw:[]),event(kind,w,draftId)])}
  const store:WorkspaceRecordStore&{name:string}={name:transport.name,read:key=>transport.read(key),
    write:async(key,value)=>{await store.transaction(key,raw=>{if(raw!==undefined)throw Error('D6_INITIALIZATION_OVERWRITE');return value})},
    remove:async()=>{throw Error('D6_DELETE_DISABLED')},transactionMany:async()=>{throw Error('D6_MIGRATION_DISABLED')},
    transaction:async(key,mutate)=>{
      if(key!=='current')throw Error('D6_WORKSPACE_KEY')
      const records=await transport.transactionMany([key,D6_EVENTS_KEY],raw=>{
        const before=workspace(raw.get(key)),next=mutate(raw.get(key)),after=workspace(next)
        const changed=stableWorkspace(before)!==stableWorkspace(after)
        if(failNext&&changed){failNext=false;throw Error('D6_INJECTED_ATOMIC_FAILURE')}
        const events=[...(Array.isArray(raw.get(D6_EVENTS_KEY))?raw.get(D6_EVENTS_KEY) as D6Event[]:[])]
        if(after){
          if(after.sources.length>(before?.sources.length??0))events.push(event('source_ready',after))
          for(const draft of after.extractionDrafts){
            const old=before?.extractionDrafts.find(item=>item.id===draft.id)
            if(draft.legacyData?.mainline05&&!old?.legacyData?.mainline05)events.push(event('suggestion_ready',after,draft.id))
            if(draft.acceptedEntityTempIds.length>(old?.acceptedEntityTempIds.length??0))events.push(event('commit_succeeded',after,draft.id))
            if(draft.rejectedEntityTempIds.length>(old?.rejectedEntityTempIds.length??0))events.push(event('rejected',after,draft.id))
            const operations=(value:typeof draft|undefined)=>{const state=value?.legacyData?.mainline05;return state&&typeof state==='object'&&!Array.isArray(state)&&Array.isArray(state.operations)?state.operations:[]}
            const added=operations(draft).slice(operations(old).length)
            if(added.some(op=>op&&typeof op==='object'&&!Array.isArray(op)&&['edit','correct_fact','review_material'].includes(String(op.kind))))events.push(event('edit_saved',after,draft.id))
            if(added.some(op=>op&&typeof op==='object'&&!Array.isArray(op)&&String(op.kind)==='review_info'))events.push(event('no_task_reviewed',after,draft.id))
          }
        }
        return new Map([[key,next],[D6_EVENTS_KEY,events]])
      })
      return records.get(key)
    }}
  return {store,append,failNext:()=>{failNext=true},events:async()=>await transport.read(D6_EVENTS_KEY) as D6Event[]??[]}
}

function stableWorkspace(value:WorkspaceV8|undefined){return JSON.stringify(value??null)}
