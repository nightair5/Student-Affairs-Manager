import type {WorkspaceRecordStore} from '../../domain/v2/repository'
import type {D8Event,D8EventKind,D8EditCategory,D8Registration} from './measurement'
import {D8_DATABASE} from './d8Observation'

type Store=WorkspaceRecordStore&{name:string}
const regKey=(draftId:string)=>`d8-metric-registration:${draftId}`
const eventKey=(draftId:string)=>`d8-metric-events:${draftId}`
/** One append queue keeps browser event order intact across IndexedDB transactions. */
export function createD8UiMeasurement(store:Store){
  if(store.name!==D8_DATABASE)throw Error('D8_METRIC_DATABASE')
  let queue=Promise.resolve()
  let transitions=Promise.resolve()
  function sequence<T>(work:()=>Promise<T>):Promise<T>{const result=transitions.then(work);transitions=result.then(()=>undefined,()=>undefined);return result}
  const activeEdit=new Map<string,{id:string;fieldKey:string}>(),pendingEdits=new Map<string,string[]>(),savedEdits=new Map<string,string[]>()
  async function append(draftId:string,kind:D8EventKind,extra:Partial<D8Event>={}){
    queue=queue.then(async()=>{
      const r=await store.read(regKey(draftId)) as D8Registration|undefined
      if(!r)throw Error('D8_METRIC_UNREGISTERED')
      const row:D8Event={id:crypto.randomUUID(),atMs:Date.now(),kind,trialId:r.trialId,sourceSha256:r.sourceSha256,candidateSha256:r.candidateSha256,firstOutputSha256:r.firstOutputSha256,...extra}
      await store.transaction(eventKey(draftId),raw=>[...(Array.isArray(raw)?raw:[]),row])
    })
    await queue
  }
  async function begin(draftId:string,r:D8Registration){
    if(r.origin==='HUMAN_TRIAL')throw Error('D8_HUMAN_TRIAL_DISABLED')
    const old=await store.read(regKey(draftId))
    if(old!==undefined){const previous=old as D8Registration;if(previous.trialId!==r.trialId||previous.sourceSha256!==r.sourceSha256||previous.candidateSha256!==r.candidateSha256||previous.firstOutputSha256!==r.firstOutputSha256||previous.origin!==r.origin)throw Error('D8_METRIC_IDENTITY_DRIFT');return}
    await store.write(regKey(draftId),r)
    await append(draftId,'trial_started');await append(draftId,'first_snapshot_frozen');await append(draftId,'suggestion_interactive');await append(draftId,'read_started')
  }
  async function changed(draftId:string,category:D8EditCategory|undefined,fieldKey:string){return sequence(async()=>{
    let active=activeEdit.get(draftId)
    if(active&&active.fieldKey!==fieldKey){await append(draftId,'edit_ended',{editId:active.id});active=undefined}
    if(!active){
      if(!activeEdit.has(draftId))await append(draftId,'read_ended')
      active={id:crypto.randomUUID(),fieldKey};activeEdit.set(draftId,active)
      pendingEdits.set(draftId,[...(pendingEdits.get(draftId)??[]),active.id])
      await append(draftId,'edit_started',{editId:active.id})
    }
    await append(draftId,'edit_activity',{editId:active.id,editCategory:category??'unknown'})
  })}
  async function saved(draftId:string,commitId:string=crypto.randomUUID()){return sequence(async()=>{
    const active=activeEdit.get(draftId),includedEditIds=pendingEdits.get(draftId)??[]
    if(!includedEditIds.length)return
    if(active)await append(draftId,'edit_ended',{editId:active.id})
    activeEdit.delete(draftId);pendingEdits.delete(draftId)
    await append(draftId,'commit_succeeded',{commitId,includedEditIds});await append(draftId,'readback_verified',{commitId})
    savedEdits.set(draftId,[...(savedEdits.get(draftId)??[]),...includedEditIds]);await append(draftId,'read_started')
  })}
  async function confirmation(draftId:string,work:()=>Promise<void>){return sequence(async()=>{
    const active=activeEdit.get(draftId)
    if(active)await append(draftId,'edit_ended',{editId:active.id})
    else await append(draftId,'read_ended')
    await append(draftId,'confirmation_requested')
    await work()
    const commitId=crypto.randomUUID();await append(draftId,'commit_succeeded',{commitId,includedEditIds:[...(savedEdits.get(draftId)??[]),...(pendingEdits.get(draftId)??[])]});await append(draftId,'readback_verified',{commitId})
    activeEdit.delete(draftId);pendingEdits.delete(draftId)
  })}
  async function reviewNoTask(draftId:string,work:()=>Promise<void>){return sequence(async()=>{
    const active=activeEdit.get(draftId)
    if(active)await append(draftId,'edit_ended',{editId:active.id})
    else await append(draftId,'read_ended')
    await append(draftId,'confirmation_requested')
    try {await work()} catch(error) {activeEdit.delete(draftId);await append(draftId,'read_started');throw error}
    const commitId=crypto.randomUUID()
    await append(draftId,'commit_succeeded',{commitId,includedEditIds:[...(savedEdits.get(draftId)??[]),...(pendingEdits.get(draftId)??[])]})
    await append(draftId,'readback_verified',{commitId})
    await append(draftId,'no_task_archived')
    activeEdit.delete(draftId);pendingEdits.delete(draftId)
  })}
  async function resume(draftIds:readonly string[]){for(const id of draftIds)if(await store.read(regKey(id))){await append(id,'page_restored');await append(id,'read_started')}}
  const events=async(draftId:string)=>await store.read(eventKey(draftId)) as D8Event[]??[]
  return {begin,append,changed,saved,confirmation,reviewNoTask,resume,events}
}
