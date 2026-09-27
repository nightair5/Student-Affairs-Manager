/** D8 instrument contract. Engineering rows never enter human rates. */
export const D8_MEASUREMENT_VERSION='candidate15-product-metrics-3.0.0' as const
export const D8_IDLE_LIMIT_MS=5_000
export type D8Origin='ENGINEERING_REPLAY'|'AUTOMATION'|'HUMAN_TRIAL'
export type D8EditCategory='task_add'|'task_remove'|'task_split'|'task_merge'|'title'|'action'|'object'|'time'|'condition'|'material'|'completion_standard'|'revision'|'dependency'|'cosmetic'|'personalization'|'unknown'
export type D8EventKind='trial_started'|'first_snapshot_frozen'|'suggestion_interactive'|'page_restored'|'read_started'|'read_ended'|'edit_started'|'edit_activity'|'edit_ended'|'idle_started'|'idle_ended'|'pause_started'|'pause_ended'|'confirmation_requested'|'commit_succeeded'|'readback_verified'|'no_task_archived'|'abandoned'|'timed_out'
export interface D8Event {id:string;atMs:number;kind:D8EventKind;trialId:string;sourceSha256:string;candidateSha256:string;firstOutputSha256:string;editId?:string;editCategory?:D8EditCategory;commitId?:string;includedEditIds?:string[];pauseReason?:'system_wait'|'visibility_hidden'|'user_pause';pauseToken?:string}
export interface D8Registration {trialId:string;origin:D8Origin;sourceSha256:string;candidateSha256:string;firstOutputSha256:string;registeredAtMs:number;humanAuthorityVerified:boolean}
export interface D8Judgment {firstWholeCorrect:boolean|null;finalDispositionCorrect:boolean|null;disposition:'confirmed'|'partial'|'no_task'|'abandoned'|'timed_out'|'unknown'}
export interface D8Metrics {status:'DETERMINATE'|'INCOMPLETE'|'REGISTRATION_INVALID'|'IDENTITY_INVALID'|'SEMANTIC_JUDGMENT_REQUIRED';trialId:string;origin:D8Origin;firstWholeCorrect:boolean|null;correctDisposition:boolean|null;lowModificationCorrectDisposition:boolean|null;substantiveEditCount:number|null;activeEditMs:number|null;readMs:number|null;wallMs:number|null;systemWaitMs:number|null;hiddenMs:number|null;idleMs:number|null;unclassifiedMs:number|null;missing:string[]}
const substantive=new Set<D8EditCategory>(['task_add','task_remove','task_split','task_merge','title','action','object','time','condition','material','completion_standard','revision','dependency','unknown'])
const sha=(value:string)=>/^[a-f0-9]{64}$/u.test(value)
const blank=(r:D8Registration,status:D8Metrics['status'],missing:string[]=[]):D8Metrics=>({status,trialId:r.trialId,origin:r.origin,firstWholeCorrect:null,correctDisposition:null,lowModificationCorrectDisposition:null,substantiveEditCount:null,activeEditMs:null,readMs:null,wallMs:null,systemWaitMs:null,hiddenMs:null,idleMs:null,unclassifiedMs:null,missing})

export function calculateD8Trial(r:D8Registration,events:readonly D8Event[],j:D8Judgment):D8Metrics{
  if(!r.trialId||!sha(r.sourceSha256)||!sha(r.candidateSha256)||!sha(r.firstOutputSha256)||!Number.isFinite(r.registeredAtMs)||r.origin==='HUMAN_TRIAL'&&!r.humanAuthorityVerified)return blank(r,'REGISTRATION_INVALID',['registration'])
  if(!events.length)return blank(r,'INCOMPLETE',['events'])
  const rows=[...events].sort((a,b)=>a.atMs-b.atMs),ids=new Set<string>()
  for(const [i,e] of rows.entries()){
    if(!e.id||ids.has(e.id)||e.trialId!==r.trialId||e.sourceSha256!==r.sourceSha256||e.candidateSha256!==r.candidateSha256||e.firstOutputSha256!==r.firstOutputSha256||!Number.isFinite(e.atMs)||e.atMs<r.registeredAtMs||(i>0&&e.atMs<rows[i-1].atMs))return blank(r,'IDENTITY_INVALID',['event identity/order'])
    ids.add(e.id)
  }
  if(rows[0].kind!=='trial_started'||rows.filter(e=>e.kind==='first_snapshot_frozen').length!==1||rows.filter(e=>e.kind==='suggestion_interactive').length!==1||!['readback_verified','abandoned','timed_out'].includes(rows.at(-1)!.kind))return blank(r,'INCOMPLETE',['lifecycle'])
  const snapshot=rows.findIndex(e=>e.kind==='first_snapshot_frozen'),interactive=rows.findIndex(e=>e.kind==='suggestion_interactive')
  if(!(0<snapshot&&snapshot<interactive))return blank(r,'INCOMPLETE',['lifecycle order'])
  let reading=false,editing=false,idle=false,openedEditId:string|null=null,unclosedEdit=false
  const pauses=new Map<string,D8Event['pauseReason']>(),dur={activeEditMs:0,readMs:0,systemWaitMs:0,hiddenMs:0,idleMs:0,unclassifiedMs:0}
  const edits=new Map<string,D8EditCategory>(),commitLinks=new Map<string,Set<string>>(),readbacks=new Set<string>()
  const missing=new Set<string>(),terminal=rows.at(-1)!
  for(let i=0;i<rows.length;i++){
    const e=rows[i],previous=rows[i-1]
    if(previous&&i>interactive){
      const delta=e.atMs-previous.atMs
      const states=[...pauses.values()]
      if(states.includes('visibility_hidden'))dur.hiddenMs+=delta
      else if(states.includes('system_wait'))dur.systemWaitMs+=delta
      else if(idle)dur.idleMs+=delta
      else if(editing){const active=Math.min(delta,D8_IDLE_LIMIT_MS);dur.activeEditMs+=active;dur.idleMs+=delta-active}
      else if(reading)dur.readMs+=delta
      else dur.unclassifiedMs+=delta
    }
    switch(e.kind){
      case 'read_started': if(reading||editing)missing.add('overlapping read/edit');reading=true;break
      case 'page_restored': missing.add('refresh time discontinuity');reading=false;editing=false;idle=false;openedEditId=null;pauses.clear();break
      case 'read_ended': if(!reading)missing.add('unpaired read');reading=false;break
      case 'edit_started': if(editing||reading||!e.editId)missing.add('edit start');editing=true;openedEditId=e.editId??null;break
      case 'edit_activity': if(!editing||!e.editId||e.editId!==openedEditId||!e.editCategory)missing.add('edit activity');else edits.set(e.editId,e.editCategory);break
      case 'edit_ended': if(!editing||!e.editId||e.editId!==openedEditId)missing.add('unpaired edit');editing=false;openedEditId=null;break
      case 'idle_started': if(idle)missing.add('idle start');idle=true;break
      case 'idle_ended': if(!idle)missing.add('idle end');idle=false;break
      case 'pause_started': if(!e.pauseToken||!e.pauseReason||pauses.has(e.pauseToken))missing.add('pause start');else pauses.set(e.pauseToken,e.pauseReason);break
      case 'pause_ended': if(!e.pauseToken||!pauses.has(e.pauseToken)||pauses.get(e.pauseToken)!==e.pauseReason)missing.add('pause end');else pauses.delete(e.pauseToken);break
      case 'commit_succeeded': if(!e.commitId||!e.includedEditIds||commitLinks.has(e.commitId))missing.add('explicit commit mapping');else commitLinks.set(e.commitId,new Set(e.includedEditIds));break
      case 'readback_verified': if(!e.commitId||!commitLinks.has(e.commitId))missing.add('readback mapping');else readbacks.add(e.commitId);break
    }
  }
  if(editing||reading||idle||pauses.size){unclosedEdit=editing;missing.add('unclosed interval')}
  const linked=new Set([...commitLinks].filter(([id])=>readbacks.has(id)).flatMap(([,ids])=>[...ids]))
  const substantiveEdits=[...edits].filter(([,category])=>substantive.has(category))
  if(substantiveEdits.some(([id])=>!linked.has(id))&&['confirmed','partial','no_task'].includes(j.disposition))missing.add('unmapped substantive edit')
  if(unclosedEdit)missing.add('edit time incomplete')
  const terminalVerified=j.disposition==='confirmed'||j.disposition==='partial'||j.disposition==='no_task'?
    Boolean(terminal.kind==='readback_verified'&&terminal.commitId&&readbacks.has(terminal.commitId)):j.disposition==='abandoned'?terminal.kind==='abandoned':j.disposition==='timed_out'?terminal.kind==='timed_out':false
  const correct=j.finalDispositionCorrect===null?null:Boolean(j.finalDispositionCorrect&&terminalVerified)
  const semanticMissing=j.firstWholeCorrect===null||j.finalDispositionCorrect===null
  const criticalMissing=missing.has('unmapped substantive edit')||missing.has('explicit commit mapping')||missing.has('edit activity')||missing.has('unclosed interval')
  const timeDiscontinuous=missing.has('refresh time discontinuity')
  const result:D8Metrics={status:missing.size?'INCOMPLETE':semanticMissing?'SEMANTIC_JUDGMENT_REQUIRED':'DETERMINATE',trialId:r.trialId,origin:r.origin,firstWholeCorrect:j.firstWholeCorrect,correctDisposition:correct,lowModificationCorrectDisposition:criticalMissing||correct===null?null:correct&&substantiveEdits.length===0,substantiveEditCount:criticalMissing?null:substantiveEdits.length,activeEditMs:unclosedEdit||timeDiscontinuous?null:dur.activeEditMs,readMs:missing.has('unclosed interval')||timeDiscontinuous?null:dur.readMs,wallMs:terminal.atMs-rows[0].atMs,systemWaitMs:pauses.size||timeDiscontinuous?null:dur.systemWaitMs,hiddenMs:pauses.size||timeDiscontinuous?null:dur.hiddenMs,idleMs:missing.has('unclosed interval')||timeDiscontinuous?null:dur.idleMs,unclassifiedMs:timeDiscontinuous?null:dur.unclassifiedMs,missing:[...missing]}
  return result
}

export function aggregateD8Trials(rows:readonly D8Metrics[]){
  const human=rows.filter(r=>r.origin==='HUMAN_TRIAL'&&r.status!=='REGISTRATION_INVALID'),rate=(key:'firstWholeCorrect'|'correctDisposition'|'lowModificationCorrectDisposition')=>human.length?human.filter(r=>r[key]===true).length/human.length:null
  const times=human.flatMap(r=>r.activeEditMs===null?[]:[r.activeEditMs]).sort((a,b)=>a-b)
  const pct=(p:number)=>times.length?times[Math.ceil(p*times.length)-1]:null
  return {version:D8_MEASUREMENT_VERSION,allStartedHumanTrials:human.length,invalidHumanRegistrations:rows.filter(r=>r.origin==='HUMAN_TRIAL'&&r.status==='REGISTRATION_INVALID').length,determinate:human.filter(r=>r.status==='DETERMINATE').length,missing:human.filter(r=>r.status!=='DETERMINATE').length,firstWholeSuggestionAccuracy:rate('firstWholeCorrect'),correctDispositionRate:rate('correctDisposition'),lowModificationCorrectDispositionRate:rate('lowModificationCorrectDisposition'),activeEditMs:{validN:times.length,missingN:human.length-times.length,median:pct(.5),p95:pct(.95)},excludedEngineeringRows:rows.filter(r=>r.origin!=='HUMAN_TRIAL').length}
}
