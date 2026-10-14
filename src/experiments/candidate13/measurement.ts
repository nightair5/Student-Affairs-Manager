export const D5_MEASUREMENT_VERSION='candidate13-product-metrics-1.0.0' as const
export const SUBSTANTIVE_EDIT_CATEGORIES=['task_add','task_remove','task_split','task_merge','action','object','time','condition','material','completion_standard','revision','dependency'] as const
export type SubstantiveEditCategory=typeof SUBSTANTIVE_EDIT_CATEGORIES[number]
export type D5EventKind='trial_started'|'suggestion_interactive'|'edit_started'|'edit_activity'|'edit_paused'|'edit_resumed'
  |'system_wait_started'|'system_wait_ended'|'visibility_hidden'|'visibility_visible'|'confirmation_requested'
  |'commit_succeeded'|'readback_verified'|'no_task_archived'|'abandoned'|'timed_out'
export interface D5MetricEvent {kind:D5EventKind;atMs:number;editCategory?:SubstantiveEditCategory|'cosmetic'|'personalization'}
export interface D5SemanticJudgment {firstWholeCorrect:boolean|null;finalDispositionCorrect:boolean|null;
  disposition:'confirmed'|'no_task'|'partial'|'abandoned'|'timed_out'|'unknown'}
export interface D5TrialMetrics {eligibleStart:boolean;firstWholeCorrect:boolean|null;correctDisposition:boolean|null;
  lowModificationCorrectDisposition:boolean|null;substantiveEditCount:number;cosmeticEditCount:number;
  activeEditMs:number|null;wallMs:number|null;systemWaitMs:number;status:'DETERMINATE'|'SEMANTIC_JUDGMENT_REQUIRED'|'INCOMPLETE'}

const ordered=(events:readonly D5MetricEvent[])=>[...events].sort((a,b)=>a.atMs-b.atMs)
export function calculateD5Trial(events:readonly D5MetricEvent[],judgment:D5SemanticJudgment):D5TrialMetrics{
  const rows=ordered(events),start=rows.find(event=>event.kind==='trial_started')
  const end=[...rows].reverse().find(event=>['readback_verified','no_task_archived','abandoned','timed_out'].includes(event.kind))
  const edits=rows.filter(event=>event.kind==='edit_activity'&&event.editCategory)
  const substantiveEditCount=edits.filter(event=>SUBSTANTIVE_EDIT_CATEGORIES.includes(event.editCategory as SubstantiveEditCategory)).length
  const cosmeticEditCount=edits.filter(event=>event.editCategory==='cosmetic').length
  let editing=false,paused=false,last:number|null=null,active=0,waitStarted:number|null=null,systemWaitMs=0
  for(const event of rows){
    if(event.kind==='edit_started'||event.kind==='edit_resumed'){editing=true;paused=false;last=event.atMs}
    else if(event.kind==='edit_paused'||event.kind==='visibility_hidden'||event.kind==='system_wait_started'){
      if(editing&&!paused&&last!==null)active+=Math.max(0,event.atMs-last)
      paused=true;last=null;if(event.kind==='system_wait_started')waitStarted=event.atMs
    }else if(event.kind==='visibility_visible'||event.kind==='system_wait_ended'){
      if(event.kind==='system_wait_ended'&&waitStarted!==null){systemWaitMs+=Math.max(0,event.atMs-waitStarted);waitStarted=null}
      if(editing){paused=false;last=event.atMs}
    }else if(editing&&!paused&&['confirmation_requested','no_task_archived','abandoned','timed_out'].includes(event.kind)){
      if(last!==null)active+=Math.max(0,event.atMs-last);editing=false;last=null
    }
  }
  const activeEditMs=editing||waitStarted!==null?null:active
  const persisted=rows.some(event=>event.kind==='readback_verified')
  const noTask=rows.some(event=>event.kind==='no_task_archived')
  const terminal=(value:D5SemanticJudgment)=>value.disposition==='confirmed'?persisted:value.disposition==='no_task'?noTask:false
  const correctDisposition=judgment.finalDispositionCorrect===null?null:Boolean(judgment.finalDispositionCorrect&&terminal(judgment))
  return {eligibleStart:Boolean(start),firstWholeCorrect:judgment.firstWholeCorrect,correctDisposition,
    lowModificationCorrectDisposition:correctDisposition===null?null:correctDisposition&&substantiveEditCount===0,
    substantiveEditCount,cosmeticEditCount,activeEditMs,wallMs:start&&end?Math.max(0,end.atMs-start.atMs):null,systemWaitMs,
    status:!start||!end?'INCOMPLETE':judgment.firstWholeCorrect===null||judgment.finalDispositionCorrect===null?'SEMANTIC_JUDGMENT_REQUIRED':'DETERMINATE'}
}

export function aggregateD5Trials(rows:readonly D5TrialMetrics[]){
  const eligible=rows.filter(row=>row.eligibleStart),determinate=eligible.filter(row=>row.status==='DETERMINATE')
  const rate=(pick:(row:D5TrialMetrics)=>boolean|null)=>eligible.length?eligible.filter(row=>pick(row)===true).length/eligible.length:null
  const times=determinate.map(row=>row.activeEditMs).filter((value):value is number=>value!==null).sort((a,b)=>a-b)
  const quantile=(p:number)=>times.length?times[Math.ceil(p*times.length)-1]:null
  return {version:D5_MEASUREMENT_VERSION,eligibleStarts:eligible.length,determinate:determinate.length,
    firstWholeSuggestionAccuracy:rate(row=>row.firstWholeCorrect),correctDispositionRate:rate(row=>row.correctDisposition),
    lowModificationCorrectDispositionRate:rate(row=>row.lowModificationCorrectDisposition),
    activeEditMs:{n:times.length,median:quantile(.5),p95:quantile(.95)},
    boundary:'Program events require independent semantic judgments; engineering replay is not human evidence.'}
}
