import type {WorkspaceRecordStore} from '../../domain/v2/repository'
import type {WorkspaceV8} from '../../domain/v2/types'

export type C11ObservationOrigin='ENGINEERING_REPLAY'|'AUTOMATION'|'REGISTERED_HUMAN_TRIAL'|'UNKNOWN'
export type C11EventKind='source_ready'|'suggestion_ready'|'edit_saved'|'rejected'|'confirmation_requested'|'commit_succeeded'|'commit_failed'|'readback_verified'
export interface C11Event {id:string;at:string;kind:C11EventKind;origin:C11ObservationOrigin;draftId:string|null;sourceVersionId:string|null;candidateVersion:string|null}
export const EVENTS_KEY='c11-observation-v1'
export const C11_DATABASE='rco-mainline-01-02-i1-real-input-candidate11-engineering-1'
export function assertC11Database(name:string) {if(name!==C11_DATABASE)throw Error('C11_DATABASE_BINDING')}
const workspace=(value:unknown):WorkspaceV8|undefined=>value&&typeof value==='object'&&'schemaVersion' in value&&value.schemaVersion===8?value as WorkspaceV8:undefined

export function createC11Store(transport:WorkspaceRecordStore&{name:string},origin:C11ObservationOrigin='UNKNOWN') {
  assertC11Database(transport.name)
  let failNext=false
  function event(kind:C11EventKind,w?:WorkspaceV8,draftId?:string):C11Event {
    const draft=w?.extractionDrafts.find(d=>d.id===draftId),run=w?.recognitionRuns.find(r=>r.id===draft?.recognitionRunId)
    return {id:crypto.randomUUID(),at:new Date().toISOString(),kind,origin,draftId:draftId??null,
      sourceVersionId:run?.sourceVersionId??null,candidateVersion:run?.promptVersion??null}
  }
  async function append(kind:C11EventKind,w?:WorkspaceV8,draftId?:string) {
    await transport.transaction(EVENTS_KEY,raw=>[...(Array.isArray(raw)?raw:[]),event(kind,w,draftId)])
  }
  const store:WorkspaceRecordStore&{name:string}={name:transport.name,read:key=>transport.read(key),
    write:async(key,value)=>{await store.transaction(key,raw=>{if(raw!==undefined)throw Error('C11_INITIALIZATION_OVERWRITE');return value})},
    remove:async()=>{throw Error('C11_DELETE_DISABLED')},transactionMany:async()=>{throw Error('C11_MIGRATION_DISABLED')},
    transaction:async(key,mutate)=>{
      if(key!=='current')throw Error('C11_WORKSPACE_KEY')
      const records=await transport.transactionMany([key,EVENTS_KEY],raw=>{
        const before=workspace(raw.get(key)),next=mutate(raw.get(key)),after=workspace(next)
        if(failNext){failNext=false;throw Error('C11_INJECTED_ATOMIC_FAILURE')}
        const events=[...(Array.isArray(raw.get(EVENTS_KEY))?raw.get(EVENTS_KEY) as C11Event[]:[])]
        if(after){
          if(after.sources.length>(before?.sources.length??0))events.push(event('source_ready',after))
          for(const draft of after.extractionDrafts){
            const old=before?.extractionDrafts.find(d=>d.id===draft.id)
            if(draft.legacyData?.mainline05&&!old?.legacyData?.mainline05)events.push(event('suggestion_ready',after,draft.id))
            if(draft.acceptedEntityTempIds.length>(old?.acceptedEntityTempIds.length??0))events.push(event('commit_succeeded',after,draft.id))
            if(draft.rejectedEntityTempIds.length>(old?.rejectedEntityTempIds.length??0))events.push(event('rejected',after,draft.id))
            const operations=(value:typeof draft|undefined)=>{
              const state=value?.legacyData?.mainline05
              return state&&typeof state==='object'&&!Array.isArray(state)&&Array.isArray(state.operations)?state.operations:[]
            }
            const added=operations(draft).slice(operations(old).length)
            if(added.some(op=>op&&typeof op==='object'&&!Array.isArray(op)&&['edit','correct_fact','review_material'].includes(String(op.kind))))events.push(event('edit_saved',after,draft.id))
          }
        }
        return new Map([[key,next],[EVENTS_KEY,events]])
      })
      return records.get(key)
    }}
  return {store,append,failNext:()=>{failNext=true},events:async()=>await transport.read(EVENTS_KEY) as C11Event[]??[]}
}
