import type {RecognitionResult} from './types'
import {resolveLiteralSourceSpan} from '../../cloudflare/recognition-literal-evidence.mjs'

export const CITED_LAYOUT_SUPPORT_VERSION = 'cited-time-layout-support-1.0.0'
export interface CitedLayoutDecision {pointId:string;before:string;after:string;start:number;end:number;evidenceIds:string[];rule:'UNIQUE_REVERSIBLE_LITERAL_WITHIN_OWN_CITATION'}

/** Recover only the original typography of an existing time field. The same
 * reversible literal matcher used by the Worker must identify one continuous
 * source span, fully covered by this point's own citations from one source.
 * No date, endpoint, owner or semantic paraphrase is added. */
export function projectCitedTimeLayouts(result:RecognitionResult,source:string){
  const decisions:CitedLayoutDecision[]=[]
  for(const point of result.timePoints){
    // A literal typography match is not proof of a time's semantic role. Limit
    // this projection to an existing event's paired, purely temporal range;
    // never resurrect a prose fragment that was mislabelled as a deadline.
    if(!['event_start','event_end'].includes(point.type)||!/^[\d\s年月日点时分秒早上午下晚凌晨：:—–\-至到]+$/u.test(point.rawText))continue
    const owners=result.events.filter(e=>e.startTimePointTempId===point.tempId||e.endTimePointTempId===point.tempId)
    if(owners.length!==1)continue
    const owner=owners[0],other=result.timePoints.find(p=>p.tempId===(point.type==='event_start'?owner.endTimePointTempId:owner.startTimePointTempId))
    if(!other||other.type!==(point.type==='event_start'?'event_end':'event_start')||other.rawText!==point.rawText)continue
    const own=result.evidence.filter(e=>point.evidenceIds.includes(e.id)&&e.quote&&source.includes(e.quote))
    if(own.some(e=>e.quote.includes(point.rawText)))continue
    if(!own.length||new Set(own.map(e=>e.sourceId)).size!==1||!own.some(e=>owner.evidenceIds.includes(e.id)&&other.evidenceIds.includes(e.id)))continue
    const span=resolveLiteralSourceSpan(point.rawText,source)
    if(!span||span.literal===point.rawText)continue
    const proofs=own.flatMap(e=>{const at=source.indexOf(e.quote);return at>=0&&source.indexOf(e.quote,at+1)<0?[{id:e.id,start:at,end:at+e.quote.length}]:[]}).sort((a,b)=>a.start-b.start)
    let covered=span.start
    const ids:string[]=[]
    for(const proof of proofs)if(proof.start<=covered&&proof.end>covered){covered=proof.end;ids.push(proof.id)}
    if(covered<span.end)continue
    decisions.push({pointId:point.tempId,before:point.rawText,after:span.literal,start:span.start,end:span.end,evidenceIds:ids,rule:'UNIQUE_REVERSIBLE_LITERAL_WITHIN_OWN_CITATION'})
  }
  // Decide from one unchanged graph, then apply together. Otherwise changing
  // the start first would make the end appear to have a different raw range.
  for(const decision of decisions)result.timePoints.find(p=>p.tempId===decision.pointId)!.rawText=decision.after
  return {version:CITED_LAYOUT_SUPPORT_VERSION,decisions}
}
