import type {D13Trace} from './measurement'

export const D23_MEASUREMENT={version:'d23-semantic-measurement-1',idleLimitMs:5_000,maxFields:2,maxEditMs:30_000,completionWindowMs:600_000} as const
export type StudyEvent={id:string;atMs:number;kind:'source_visible'|'start'|'pause'|'resume'|'exit'|'timeout'|'candidate_complete'|'reload'|'draft_open'|'load_wait'|'load_end'}

/** Observed intervals remain available even when the final commit, adjudication or end is absent.
 * An interrupted final interval is unknown, never filled with zero. This is operational UI time. */
export function d23Timing(events:readonly StudyEvent[],trace:readonly D13Trace[]){
  const start=events.find(e=>e.kind==='start')
  const rows=[...events.filter(e=>!start||e.atMs>=start.atMs),...trace.filter(e=>!start||e.atMs>=start.atMs)].sort((a,b)=>a.atMs-b.atMs)
  let activity:'read'|'edit'='read',paused=false,hidden=false,waiting=0,last=start?.atMs,activeEditAt:number|undefined
  const totals={readingMs:0,activeEditMs:0,idleMs:0,waitMs:0,hiddenMs:0,pauseMs:0}
  const missing:string[]=[],terminal=events.find(e=>['exit','timeout','candidate_complete'].includes(e.kind)),segments:Array<{from:number;to:number;state:string;activeMs?:number}>=[]
  let ended=false
  for(const e of rows){
    if(!start||e.atMs<start.atMs||ended)continue
    const state=paused?'pause':hidden?'hidden':waiting>0?'wait':activity
    if(last!==undefined&&e.kind!=='reload'){
      const delta=e.atMs-last
      if(delta<0){missing.push('NON_MONOTONIC_TIME');continue}
      if(state==='edit'){
        const active=Math.max(0,Math.min(delta,(activeEditAt??last)+D23_MEASUREMENT.idleLimitMs-last))
        totals.activeEditMs+=active;totals.idleMs+=delta-active;segments.push({from:last,to:e.atMs,state,activeMs:active})
      }else{const key={read:'readingMs',wait:'waitMs',hidden:'hiddenMs',pause:'pauseMs'}[state] as Exclude<keyof typeof totals,'activeEditMs'|'idleMs'>;totals[key]+=delta;segments.push({from:last,to:e.atMs,state})}
    }
    last=e.atMs
    if(e.kind==='reload')missing.push('RELOAD_UNCLOSED_INTERVAL')
    if(e.kind==='pause')paused=true
    if(e.kind==='resume'){paused=false;activity='read'}
    if(e.kind==='hidden')hidden=true
    if(e.kind==='visible'){hidden=false;activity='read'}
    if(e.kind==='wait'||e.kind==='load_wait')waiting++
    if(e.kind==='load_end'||e.kind==='wait_end'){waiting=Math.max(0,waiting-1);activity='read'}
    if(e.kind==='read'||e.kind==='blur'||e.kind==='reload')activity='read'
    if((e.kind==='edit'||e.kind==='edit_activity')&&!paused&&!hidden){activity='edit';activeEditAt=e.atMs}
    if(['exit','timeout','candidate_complete'].includes(e.kind))ended=true
  }
  if(!start)missing.push('NO_PROCESSING_START')
  if(!terminal)missing.push('UNCLOSED_PROCESSING_INTERVAL')
  const intervalMissing=missing.length>0
  return {version:D23_MEASUREMENT.version,observed:totals,segments,missing,
    wallMs:start&&terminal&&!intervalMissing?terminal.atMs-start.atMs:null,
    completeActiveEditMs:start&&terminal&&!intervalMissing?totals.activeEditMs:null,
    costMeaning:'OBSERVED_UI_ACTIVITY_ONLY',cognitiveEffort:'NOT_OBSERVABLE'}
}
