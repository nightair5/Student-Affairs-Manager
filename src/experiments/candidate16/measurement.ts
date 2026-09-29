import type {WorkspaceRecordStore} from '../../domain/v2/repository'
import type {WorkspaceV8} from '../../domain/v2/types'
import {effectiveStateFacts,life,stateOfRuntime} from '../mainline05/semanticState'
import {stableJson} from '../mainline04/semanticContract'

export const D13_DATABASE='rco-mainline-01-02-i1-real-input-candidate16-d13-engineering-2'
export const D14_DATABASE='rco-mainline-01-02-i1-real-input-candidate16-d14-trial-1'
export const d15Database=(participant:string)=>{
  if(!/^[a-z0-9]{2,20}$/.test(participant))throw Error('D15_PARTICIPANT_ID')
  return `rco-mainline-01-02-i1-real-input-candidate16-d15-trial-${participant}`
}
export const isD15Database=(name:string)=>/^rco-mainline-01-02-i1-real-input-candidate16-d15-trial-[a-z0-9]{2,20}$/.test(name)
export const d19Database=(participant:string)=>{
  if(!/^p[1-9][0-9]{0,2}$/.test(participant))throw Error('D19_SIMULATED_IDENTITY')
  return `rco-mainline-01-02-i1-real-input-d19-source-session-${participant}`
}
export const isD19Database=(name:string)=>/^rco-mainline-01-02-i1-real-input-d19-source-session-p[1-9][0-9]{0,2}$/.test(name)
export const isD20Database=(name:string)=>/^rco-mainline-01-02-i1-real-input-d20-review-session-p[1-9][0-9]{0,2}$/.test(name)
export const D13_TRACE_KEY='d13-measurement-low-edit-v2'
export const LOW_EDIT_POLICY={version:'low-edit-v2-exploratory-1',maxFields:2,maxActiveEditMs:30_000,idleLimitMs:5_000,origin:'ENGINEERING_REPLAY',humanTrialAuthorized:false} as const
type Kind='begin'|'read'|'edit'|'blur'|'hidden'|'visible'|'wait'|'wait_end'|'commit'|'readback'|'failure'|'restore'|'end'
export interface D13Trace {id:string;draftId:string;atMs:number;kind:Kind;editId?:string;fieldKey?:string;commitId?:string;includedEditIds?:string[];fields?:string[];semanticFields?:string[];structural?:boolean;error?:string;disposition?:'confirmed'|'partial'|'no_task';snapshot?:{recordId:string;sourceSha256:string;firstOutputSha256:string}}
type Store=WorkspaceRecordStore&{name:string}
export function assertD13Database(name:string){if(name!==D13_DATABASE&&name!==D14_DATABASE&&!isD15Database(name)&&!isD19Database(name)&&!isD20Database(name))throw Error('D13_ISOLATED_DATABASE_REQUIRED')}
const flatten=(value:unknown,prefix='',out:Record<string,unknown>={}):Record<string,unknown>=>{
  if(value&&typeof value==='object'&&!Array.isArray(value))for(const [key,v] of Object.entries(value))flatten(v,prefix?prefix+'.'+key:key,out)
  else out[prefix]=value
  return out
}
function semanticFields(w:WorkspaceV8,draftId:string){
  const s=stateOfRuntime(w,draftId),facts=effectiveStateFacts(s).facts
  const entities=Object.fromEntries((['tasks','materials','timePoints','events'] as const).map(kind=>[kind,Object.fromEntries(facts[kind].map(v=>['id' in v?v.id:v.tempId,v]))]))
  return flatten({...entities,revisions:facts.revisions,display:life(s).values})
}
export function committedFieldDiff(before:WorkspaceV8,after:WorkspaceV8,draftId:string){
  const a=semanticFields(before,draftId),b=semanticFields(after,draftId)
  const fields=[...new Set([...Object.keys(a),...Object.keys(b)])].filter(key=>stableJson(a[key]??null)!==stableJson(b[key]??null))
  const s1=effectiveStateFacts(stateOfRuntime(before,draftId)).facts,s2=effectiveStateFacts(stateOfRuntime(after,draftId)).facts
  const d1=life(stateOfRuntime(before,draftId)).dispositions,d2=life(stateOfRuntime(after,draftId)).dispositions
  const rejected=Object.keys(d2).filter(id=>d2[id]==='rejected'&&d1[id]!=='rejected')
  fields.push(...rejected.map(id=>'disposition.reject.'+id))
  // Title/deadline compatibility views are separate fields; derived ID/scope changes are never hidden.
  return {fields,structural:rejected.length>0||stableJson(s1.tasks.map(t=>t.id).sort())!==stableJson(s2.tasks.map(t=>t.id).sort())||stableJson(s1.revisions)!==stableJson(s2.revisions)}
}
/** D19 counts a user's semantic correction once while retaining every storage-path change for audit. */
export function groupD19SemanticFields(paths:readonly string[],after:WorkspaceV8,draftId:string){
  const facts=effectiveStateFacts(stateOfRuntime(after,draftId)).facts,groups=new Set<string>()
  let structural=false
  for(const path of paths){
    if(path==='revisions'||path.startsWith('disposition.reject.')){groups.add(path);structural=true;continue}
    const [kind,id,...parts]=path.split('.'),field=parts.join('.')
    if(!id||!field)continue
    if(kind==='display'){
      if(field==='deadline'){
        const task=facts.tasks.find(row=>row.id===id),points=task?.detail.timePointTempIds??[]
        groups.add(points.length===1?'time:'+points[0]+':value':'task:'+id+':deadline')
      }else if(field==='title')groups.add('task:'+id+':title')
      continue
    }
    if(/(?:^|\.)(?:tempId|id|scopeId|scopeIds|confidence|inferenceLevel)$/.test(field))continue
    if(kind==='timePoints'){
      if(field.includes('related')||field==='type'){groups.add('time:'+id+':relation');structural=true}
      else groups.add('time:'+id+':value')
    }else if(kind==='events'){
      if(field.includes('TimePointTempId')||field.includes('related')){groups.add('event:'+id+':relation');structural=true}
      else groups.add('event:'+id+':'+field)
    }else if(kind==='tasks'){
      if(field.includes('TempId')||field.includes('dependency')||field.includes('parent')){groups.add('task:'+id+':relation');structural=true}
      else groups.add('task:'+id+':'+(field.startsWith('detail.')?field.slice(7):field).split('.')[0])
    }else if(kind==='materials'){
      if(field.includes('related')){groups.add('material:'+id+':relation');structural=true}
      else groups.add('material:'+id+':'+field)
    }
  }
  return {fields:[...groups].sort(),structural}
}
export function createD13Measurement(transport:Store,now:()=>number=Date.now){
  assertD13Database(transport.name)
  let queue=Promise.resolve(),activeDraft:string|undefined
  const append=(draftId:string,kind:Kind,extra:Partial<D13Trace>={})=>{
    const e:D13Trace={id:crypto.randomUUID(),draftId,atMs:now(),kind,...extra}
    const run=queue.then(async()=>{await transport.transaction(D13_TRACE_KEY,raw=>[...(Array.isArray(raw)?raw:[]),e])})
    queue=run.catch(()=>undefined);return run
  }
  const events=async(draftId?:string)=>{await queue;const raw=await transport.read(D13_TRACE_KEY);return (Array.isArray(raw)?raw as D13Trace[]:[]).filter(e=>!draftId||e.draftId===draftId)}
  const finished=(rows:D13Trace[])=>rows.at(-1)?.kind==='end'&&rows.at(-1)?.disposition!=='partial'
  return {append,events,now,activeDraft:()=>activeDraft,
    finish:async(draftId:string,disposition:NonNullable<D13Trace['disposition']>)=>{const rows=await events(draftId),commit=[...rows].reverse().find(e=>e.kind==='commit'&&e.disposition===disposition);await append(draftId,'end',{disposition,...(commit?{commitId:commit.commitId}:{})});activeDraft=undefined},
    begin:async(draftId:string,snapshot:NonNullable<D13Trace['snapshot']>)=>{activeDraft=draftId;const rows=await events(draftId);if(rows.length){if(stableJson(rows[0].snapshot)!==stableJson(snapshot))throw Error('D13_SNAPSHOT_DRIFT');if(finished(rows)){activeDraft=undefined;return}await append(draftId,'restore')}else await append(draftId,'begin',{snapshot});await append(draftId,'read')},
    changed:async(draftId:string,fieldKey:string)=>{activeDraft=draftId;await append(draftId,'edit',{editId:crypto.randomUUID(),fieldKey})},
    blur:async(draftId:string)=>append(draftId,'blur'),
    visibility:async(hidden:boolean)=>{if(activeDraft)await append(activeDraft,hidden?'hidden':'visible')},
    restore:async(draftId:string)=>{activeDraft=draftId;if(finished(await events(draftId))){activeDraft=undefined;return}await append(draftId,'restore');await append(draftId,'read')},
    flush:()=>queue,
  }
}
export type D13Measurement=ReturnType<typeof createD13Measurement>
/** Every measured correction is derived from a real saved operation, then independently read back. */
export function createD13Store(transport:Store,metrics:D13Measurement,sourceSession=false){
  assertD13Database(transport.name);let fail=false
  const store:Store={name:transport.name,read:key=>transport.read(key),write:async(key,value)=>{await store.transaction(key,old=>{if(old!==undefined)throw Error('D13_OVERWRITE_INITIAL');return value})},remove:async()=>{throw Error('D13_DELETE_DISABLED')},transactionMany:async()=>{throw Error('D13_MIGRATION_DISABLED')},transaction:async(key,mutate)=>{
    if(key!=='current')throw Error('D13_WORKSPACE_KEY')
    const waitingDraft=metrics.activeDraft()
    if(waitingDraft)await metrics.append(waitingDraft,'wait');else await metrics.flush()
    let changedDrafts:string[]=[],nextValue:unknown,commitIds:Array<{draftId:string;commitId:string}>=[]
    try{
      const saved=await transport.transactionMany(['current',D13_TRACE_KEY],rows=>{
        const before=rows.get('current') as WorkspaceV8|undefined,next=mutate(before) as WorkspaceV8
        nextValue=next
        const traces=[...(Array.isArray(rows.get(D13_TRACE_KEY))?rows.get(D13_TRACE_KEY) as D13Trace[]:[])]
        for(const draft of next.extractionDrafts){const old=before?.extractionDrafts.find(d=>d.id===draft.id)
          if(!old?.legacyData?.mainline05||!draft.legacyData?.mainline05)continue
          const prev=stateOfRuntime(before!,draft.id),current=stateOfRuntime(next,draft.id),ops=current.operations.slice(prev.operations.length)
          if(!ops.length||!traces.some(e=>e.draftId===draft.id&&e.kind==='begin'))continue;changedDrafts.push(draft.id)
          const commitId=ops.map(o=>o.id).join(':'),diff=committedFieldDiff(before!,next,draft.id),semantic=sourceSession?groupD19SemanticFields(diff.fields,next,draft.id):null
          const trace=traces.filter(t=>t.draftId===draft.id),already=new Set(trace.flatMap(t=>t.includedEditIds??[])),includedEditIds=trace.filter(t=>t.kind==='edit'&&t.editId&&!already.has(t.editId)).map(t=>t.editId!)
          if(fail&&stableJson(before)!==stableJson(next)){fail=false;throw Error('D13_INJECTED_ATOMIC_FAILURE')}
          const disposition=ops.some(o=>o.kind==='review_info')?'no_task':ops.some(o=>o.kind==='confirm')?(draft.status==='confirmed'?'confirmed':'partial'):undefined
          traces.push({id:crypto.randomUUID(),draftId:draft.id,kind:'commit',atMs:metrics.now(),commitId,includedEditIds,fields:diff.fields,...(semantic?{semanticFields:semantic.fields}:{}),structural:diff.structural||Boolean(semantic?.structural),...(disposition?{disposition}:{})})
          commitIds.push({draftId:draft.id,commitId})
        }
        return new Map<string,unknown>([['current',next],[D13_TRACE_KEY,traces]])
      })
      const readback=await transport.read('current')
      if(stableJson(nextValue)!==stableJson(readback))throw Error('D13_INDEPENDENT_READBACK_MISMATCH')
      if(waitingDraft)await metrics.append(waitingDraft,'wait_end')
      for(const c of commitIds)await metrics.append(c.draftId,'readback',{commitId:c.commitId})
      return saved.get('current')
    }catch(error){commitIds=[];if(waitingDraft)await metrics.append(waitingDraft,'wait_end');changedDrafts=[...new Set([...changedDrafts,...(waitingDraft?[waitingDraft]:[])])];for(const id of changedDrafts)await metrics.append(id,'failure',{error:error instanceof Error?error.message:'UNKNOWN_STORE_FAILURE'});throw error}
  }}
  return {store,failNext:()=>{fail=true}}
}
export function calculateLowEditV2(events:readonly D13Trace[],finalCorrect:boolean|null=null){
  // One registration measures its first final disposition. Later navigation is not a new trial.
  const terminalIndex=events.findIndex(e=>e.kind==='end'&&['confirmed','no_task'].includes(e.disposition??''))
  const postTerminalEvents=terminalIndex<0?0:events.length-terminalIndex-1
  if(terminalIndex>=0)events=events.slice(0,terminalIndex+1)
  const missing=new Set<string>(),fields=new Set<string>(),commits=new Map<string,D13Trace>(),verified=new Set<string>()
  let state:'read'|'edit'|'wait'='read',hidden=false,activeEditMs=0,readMs=0,waitMs=0,hiddenMs=0,idleMs=0,structural=false
  if(!events.length||events[0].kind!=='begin')missing.add('registration')
  const ids=new Set<string>(),edits=new Map<string,D13Trace>();let waiting=false
  for(let i=0;i<events.length;i++){
    const e=events[i],p=events[i-1]
    if(ids.has(e.id)||!Number.isFinite(e.atMs)||(p&&e.atMs<p.atMs)||e.draftId!==events[0].draftId)missing.add('event identity/order');ids.add(e.id)
    if(p){const dt=e.atMs-p.atMs;if(hidden)hiddenMs+=dt;else if(state==='wait')waitMs+=dt;else if(state==='edit'){activeEditMs+=Math.min(dt,LOW_EDIT_POLICY.idleLimitMs);idleMs+=Math.max(0,dt-LOW_EDIT_POLICY.idleLimitMs)}else readMs+=dt}
    if(e.kind==='edit'){if(!e.editId||!e.fieldKey||edits.has(e.editId))missing.add('edit identity');else edits.set(e.editId,e);if(!waiting)state='edit'}
    if(e.kind==='end'&&(waiting||state==='edit'||hidden))missing.add('unclosed interval')
    if(['read','blur','readback','failure'].includes(e.kind)&&!waiting)state='read'
    if(e.kind==='wait'){if(waiting)missing.add('overlapping wait');waiting=true;state='wait'}
    if(e.kind==='wait_end'){if(!waiting)missing.add('unmatched wait');waiting=false;state='read'}
    if(e.kind==='hidden')hidden=true
    if(e.kind==='visible')hidden=false
    if(e.kind==='restore')missing.add('refresh time discontinuity')
    if(e.kind==='commit'){if(!e.commitId||!e.fields||!e.includedEditIds||commits.has(e.commitId))missing.add('commit fields');else commits.set(e.commitId,e)}
    if(e.kind==='readback'){if(!e.commitId||!commits.has(e.commitId))missing.add('readback mapping');else verified.add(e.commitId)}
  }
  for(const [id,c] of commits){if(!verified.has(id)){missing.add('unverified commit');continue}for(const path of c.fields??[])fields.add(path);structural ||= Boolean(c.structural)
    if(c.fields?.length&&!c.includedEditIds?.length)missing.add('unmapped correction')
    if(c.includedEditIds?.some(id=>!edits.has(id)||edits.get(id)!.atMs>c.atMs))missing.add('unknown edit link')
  }
  for(const id of edits.keys())if(![...commits.values()].some(c=>verified.has(c.commitId!)&&c.includedEditIds?.includes(id)))missing.add('uncommitted edit')
  const terminal=events.at(-1),complete=terminal?.kind==='end'&&['confirmed','no_task'].includes(terminal.disposition??'')
  if(terminal?.kind!=='end'||hidden||waiting)missing.add('unclosed interval')
  if(!terminal?.commitId||!verified.has(terminal.commitId)||commits.get(terminal.commitId)?.disposition!==terminal.disposition)missing.add('terminal commit/readback')
  const evidenceComplete=!missing.size,low=finalCorrect===null||!evidenceComplete?null:Boolean(finalCorrect&&complete&&!structural&&fields.size<=LOW_EDIT_POLICY.maxFields&&activeEditMs<=LOW_EDIT_POLICY.maxActiveEditMs)
  return {version:LOW_EDIT_POLICY.version,role:'ENGINEERING_REPLAY',correctDisposition:finalCorrect===null||!evidenceComplete?null:Boolean(finalCorrect&&complete),zeroSubstantiveModification:finalCorrect===null||!evidenceComplete?null:Boolean(finalCorrect&&complete&&!fields.size&&!structural),lowModificationCorrectDisposition:low,committedFields:[...fields],fieldCount:fields.size,structural,activeEditMs:evidenceComplete?activeEditMs:null,readMs:evidenceComplete?readMs:null,waitMs:evidenceComplete?waitMs:null,hiddenMs:evidenceComplete?hiddenMs:null,idleMs:evidenceComplete?idleMs:null,missing:[...missing],postTerminalEvents,humanMetrics:'NOT_OBSERVABLE'}
}
