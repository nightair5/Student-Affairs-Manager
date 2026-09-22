export const CANDIDATE14_MEASUREMENT_VERSION = 'candidate14-product-metrics-2.0.0' as const
export const CANDIDATE14_EDIT_CATEGORIES = ['task_add','task_remove','task_split','task_merge','action','object','time','condition','material','completion_standard','revision','dependency'] as const
export type Candidate14EditCategory = typeof CANDIDATE14_EDIT_CATEGORIES[number]
export type Candidate14Origin = 'HUMAN_TRIAL'|'AUTOMATION'|'ENGINEERING_REPLAY'
export type PauseReason = 'visibility_hidden'|'system_wait'|'user_pause'
export type Candidate14EventKind = 'trial_started'|'first_snapshot_frozen'|'suggestion_interactive'|'edit_activity'|'pause_started'|'pause_ended'|'confirmation_requested'|'commit_succeeded'|'readback_verified'|'no_task_archived'|'abandoned'|'timed_out'

export interface Candidate14MetricEvent {
  trialId:string; sourceIdentitySha256:string; candidateIdentitySha256:string; origin:Candidate14Origin
  kind:Candidate14EventKind; atMs:number; editCategory?:Candidate14EditCategory|'cosmetic'|'personalization'; pauseReason?:PauseReason
  snapshotSha256?:string
}
export interface Candidate14Judgment {firstWholeCorrect:boolean|null;finalDispositionCorrect:boolean|null;disposition:'confirmed'|'no_task'|'partial'|'abandoned'|'timed_out'|'unknown'}
export interface Candidate14TrialMetrics {status:'DETERMINATE'|'SEMANTIC_JUDGMENT_REQUIRED'|'INCOMPLETE'|'IDENTITY_INVALID';origin:Candidate14Origin|null;firstWholeCorrect:boolean|null;correctDisposition:boolean|null;lowModificationCorrectDisposition:boolean|null;substantiveEditCount:number|null;activeEditMs:number|null;wallMs:number|null;systemWaitMs:number|null}

function percentile(values:number[], p:number){if(!values.length)return null;return values[Math.ceil(p*values.length)-1]}
export function calculateCandidate14Trial(events:readonly Candidate14MetricEvent[], judgment:Candidate14Judgment):Candidate14TrialMetrics {
  if(!events.length)return {status:'INCOMPLETE',origin:null,firstWholeCorrect:null,correctDisposition:null,lowModificationCorrectDisposition:null,substantiveEditCount:null,activeEditMs:null,wallMs:null,systemWaitMs:null}
  const rows=[...events].sort((a,b)=>a.atMs-b.atMs), first=rows[0]
  if(rows.some(e=>e.trialId!==first.trialId||e.sourceIdentitySha256!==first.sourceIdentitySha256||e.candidateIdentitySha256!==first.candidateIdentitySha256||e.origin!==first.origin))return {status:'IDENTITY_INVALID',origin:first.origin,firstWholeCorrect:null,correctDisposition:null,lowModificationCorrectDisposition:null,substantiveEditCount:null,activeEditMs:null,wallMs:null,systemWaitMs:null}
  const starts=rows.filter(e=>e.kind==='trial_started'), snapshots=rows.filter(e=>e.kind==='first_snapshot_frozen'), end=[...rows].reverse().find(e=>['readback_verified','abandoned','timed_out'].includes(e.kind))
  if(starts.length!==1||snapshots.length!==1||!snapshots[0].snapshotSha256||!end)return {status:'INCOMPLETE',origin:first.origin,firstWholeCorrect:null,correctDisposition:null,lowModificationCorrectDisposition:null,substantiveEditCount:null,activeEditMs:null,wallMs:null,systemWaitMs:null}
  const pauses=new Map<PauseReason,number>(), substantive=rows.filter(e=>e.kind==='edit_activity'&&e.editCategory&&CANDIDATE14_EDIT_CATEGORIES.includes(e.editCategory as Candidate14EditCategory)).length
  let active=0,last=rows.find(e=>e.kind==='suggestion_interactive')?.atMs??null,systemWait=0
  for(const e of rows){
    if(e.kind==='pause_started'&&e.pauseReason&&!pauses.has(e.pauseReason)){if(last!==null&&pauses.size===0)active+=Math.max(0,e.atMs-last);pauses.set(e.pauseReason,e.atMs);last=null}
    else if(e.kind==='pause_ended'&&e.pauseReason&&pauses.has(e.pauseReason)){const began=pauses.get(e.pauseReason)!;if(e.pauseReason==='system_wait')systemWait+=Math.max(0,e.atMs-began);pauses.delete(e.pauseReason);if(pauses.size===0)last=e.atMs}
    else if(['confirmation_requested','no_task_archived','abandoned','timed_out'].includes(e.kind)&&last!==null&&pauses.size===0){active+=Math.max(0,e.atMs-last);last=null}
  }
  if(pauses.size||last!==null)return {status:'INCOMPLETE',origin:first.origin,firstWholeCorrect:null,correctDisposition:null,lowModificationCorrectDisposition:null,substantiveEditCount:null,activeEditMs:null,wallMs:null,systemWaitMs:null}
  const persisted=rows.some(e=>e.kind==='readback_verified'), noTask=rows.some(e=>e.kind==='no_task_archived')&&persisted
  const terminal=judgment.disposition==='confirmed'?persisted:judgment.disposition==='no_task'?noTask:false
  const correct=judgment.finalDispositionCorrect===null?null:Boolean(judgment.finalDispositionCorrect&&terminal)
  const status=judgment.firstWholeCorrect===null||judgment.finalDispositionCorrect===null?'SEMANTIC_JUDGMENT_REQUIRED':'DETERMINATE'
  return {status,origin:first.origin,firstWholeCorrect:judgment.firstWholeCorrect,correctDisposition:correct,lowModificationCorrectDisposition:correct===null?null:correct&&substantive===0,substantiveEditCount:substantive,activeEditMs:active,wallMs:Math.max(0,end.atMs-starts[0].atMs),systemWaitMs:systemWait}
}

export function aggregateCandidate14Trials(rows:readonly Candidate14TrialMetrics[]){
  const human=rows.filter(r=>r.origin==='HUMAN_TRIAL'), determinate=human.filter(r=>r.status==='DETERMINATE')
  const rate=(key:'firstWholeCorrect'|'correctDisposition'|'lowModificationCorrectDisposition')=>human.length?human.filter(r=>r[key]===true).length/human.length:null
  const times=determinate.flatMap(r=>r.activeEditMs===null?[]:[r.activeEditMs]).sort((a,b)=>a-b)
  return {version:CANDIDATE14_MEASUREMENT_VERSION,humanTrials:human.length,determinate:determinate.length,incomplete:human.filter(r=>r.status==='INCOMPLETE').length,identityInvalid:human.filter(r=>r.status==='IDENTITY_INVALID').length,firstWholeSuggestionAccuracy:rate('firstWholeCorrect'),correctDispositionRate:rate('correctDisposition'),lowModificationCorrectDispositionRate:rate('lowModificationCorrectDisposition'),activeEditMs:{n:times.length,median:percentile(times,.5),p95:percentile(times,.95)},excludedEngineeringRows:rows.length-human.length}
}
