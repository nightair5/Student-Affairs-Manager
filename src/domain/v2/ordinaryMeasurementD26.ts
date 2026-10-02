import type {WorkspaceRecordStore} from './repository'
import type {WorkspaceV8} from './types'
import type {D13Trace} from '../../experiments/candidate16/measurement'
import {calculateD22Engineering} from '../../experiments/candidate16/d22Measurement'
import type {ReviewSession} from '../../experiments/candidate16/d20ReviewSession'
import type {SourceReviewReceipt} from './sourceReviewD26'
import {workspaceSnapshotHash} from './migration'

export const ORDINARY_MEASUREMENT_VERSION='ordinary-source-measurement-d26-1'
const key='ordinary-source-measurement-d26-1'
/** Ordinary page events, using the historical calculators without changing their old data. */
export function createOrdinaryMeasurement(store:WorkspaceRecordStore,now=Date.now){
  let queue=Promise.resolve(),active:string|undefined
  const append=(draftId:string,kind:D13Trace['kind'],extra:Partial<D13Trace>={})=>{
    const row:D13Trace={id:crypto.randomUUID(),draftId,atMs:now(),kind,...extra}
    const work=queue.then(()=>store.transaction(key,raw=>[...(Array.isArray(raw)?raw:[]),row]))
    queue=work.then(()=>undefined,()=>undefined);return work.then(()=>undefined)
  }
  const events=async(draftId?:string)=>{await queue;const raw=await store.read(key);return (Array.isArray(raw)?raw as D13Trace[]:[]).filter(e=>!draftId||e.draftId===draftId)}
  return {append,events,
    begin:async(draftId:string)=>{active=draftId;const rows=await events(draftId);if(!rows.length)await append(draftId,'begin');else if(rows.at(-1)?.kind!=='end')await append(draftId,'restore');await append(draftId,'read')},
    changed:async(draftId:string,fieldKey:string)=>{const editId=crypto.randomUUID();await append(draftId,'edit',{fieldKey,editId});return editId},
    activity:(draftId:string,fieldKey:string,editId:string)=>append(draftId,'edit_activity',{fieldKey,editId}),
    visibility:(hidden:boolean)=>active?append(active,hidden?'hidden':'visible'):Promise.resolve(),
    blur:()=>active?append(active,'blur'):Promise.resolve(),
    wait:(draftId:string)=>append(draftId,'wait'),waitEnd:(draftId:string)=>append(draftId,'wait_end'),
    failure:(draftId:string,error:string)=>append(draftId,'failure',{error}),
    committed:async(receipt:SourceReviewReceipt,session:ReviewSession,workspace:WorkspaceV8)=>{
      const rows=await events(receipt.draftId);if(rows.some(e=>e.kind==='commit'&&e.commitId===receipt.commitId))return
      const draft=workspace.extractionDrafts.find(d=>d.id===receipt.draftId)!
      const edits=session.history.filter(h=>h.kind==='stage'&&h.editId)
      const fields=[...new Set(edits.map(h=>h.field))]
      // Material/date input episodes are retained; only a persisted changed value is a correction.
      const original=draft.legacyData?.firstSuggestionDisplayed
      const changed=original!==undefined&&workspaceSnapshotHash(original)!==workspaceSnapshotHash(draft.result)
      const record=draft.legacyData?.v7Record
      const items=record&&typeof record==='object'&&!Array.isArray(record)?record.items:undefined
      const corrections=new Set<string>(),structural=new Set<string>()
      if(Array.isArray(items))for(const item of items){
        if(!item||typeof item!=='object'||Array.isArray(item)||!Array.isArray(item.history))continue
        const history=item.history.filter((h):h is {[key:string]:import('./types').JsonValue}=>Boolean(h&&typeof h==='object'&&!Array.isArray(h)&&h.actor==='user'))
        // Only differences in a user operation are eligible. Comparing an entire
        // old suggestion with a regenerated compatibility view counts program
        // defaults (for example 30 -> 60 minutes) as phantom human corrections.
        const baseline=new Map<string,unknown>(),userLeaves=new Set<string>()
        for(const operation of history.filter(h=>h.field==='识别建议'))try{
          if(typeof operation.before!=='string'||typeof operation.after!=='string')throw Error('missing operation values')
          const before=JSON.parse(operation.before),after=JSON.parse(operation.after)
          if(!before||!after||typeof before!=='object'||typeof after!=='object'||Array.isArray(before)||Array.isArray(after))throw Error('unstructured operation')
          for(const leaf of new Set([...Object.keys(before),...Object.keys(after)])){
            if(workspaceSnapshotHash(before[leaf]??null)===workspaceSnapshotHash(after[leaf]??null))continue
            if(!baseline.has(leaf))baseline.set(leaf,before[leaf]??null)
            userLeaves.add(leaf)
          }
        }catch{corrections.add('unresolved:task-history')}
        const after=item.suggestion
        if(after&&typeof after==='object'&&!Array.isArray(after))for(const leaf of userLeaves){
          const traced=fields.includes(`task:${String(item.id)}:${leaf}`)||fields.includes(`task:${String(item.id)}:facts`)
          if(traced&&workspaceSnapshotHash(baseline.get(leaf)??null)!==workspaceSnapshotHash(after[leaf]??null))corrections.add(`task:${String(item.id)}:${leaf}`)
        }
        if(item.status==='已拒绝'){corrections.add(`task:${String(item.id)}:reject`);structural.add('reject')}
      }
      if(changed&&fields.some(f=>f.startsWith('event:'))){corrections.add('source:events');structural.add('event-change')}
      await append(receipt.draftId,'commit',{commitId:receipt.commitId,disposition:receipt.disposition,includedEditIds:[...new Set(edits.flatMap(h=>h.editId?[h.editId]:[]))],includedOperationIds:[receipt.commitId],fields,semanticFields:[...corrections],structural:structural.size>0})
    },
    readback:async(receipt:SourceReviewReceipt)=>{const rows=await events(receipt.draftId);if(!rows.some(e=>e.kind==='readback'&&e.commitId===receipt.commitId))await append(receipt.draftId,'readback',{commitId:receipt.commitId})},
    finish:async(draftId:string,noTask:boolean)=>{const rows=await events(draftId);if(rows.some(e=>e.kind==='end'))return;await append(draftId,'end',{disposition:noTask?'no_task':'confirmed',commitId:[...rows].reverse().find(e=>e.kind==='commit')?.commitId});active=undefined},
    report:async(draftId:string,session:ReviewSession|undefined,condition:'manual'|'assisted'='assisted')=>({...calculateD22Engineering(await events(draftId),session,condition),version:ORDINARY_MEASUREMENT_VERSION,sourceRole:'ENGINEERING_REPLAY',correctionGrouping:'date leaf fields share one date episode; event addition is structural; no semantic correctness inferred from saving',humanMetrics:'NOT_OBSERVABLE'}),
  }
}
export type OrdinaryMeasurement=ReturnType<typeof createOrdinaryMeasurement>
