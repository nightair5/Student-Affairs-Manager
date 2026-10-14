import type {RecognitionResult} from './types'
export const DECLARED_EVENT_NAME_SUPPORT_VERSION='declared-event-name-support-1.0.0'
export interface DeclaredEventNameAudit {eventId:string;beforeTitle:string;afterTitle:string;quote:string;reusedEvidenceIds:string[];rule:'DECLARED_SAME_OBJECT_REGISTRATION'|'IMMEDIATELY_CITED_SOURCE_HEADING'}
/** Existing event only. Reuse its explicit same-object registration edge or its
 * adjacent literal heading. No source scanning to invent omitted events/owners.
 */
export function completeDeclaredEventNameSupport(result:RecognitionResult,source:string):DeclaredEventNameAudit[]{
 const out:DeclaredEventNameAudit[]=[],tasks=[...result.standaloneTasks,...result.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])],quotes=(ids:string[])=>result.evidence.filter(e=>ids.includes(e.id)&&source.includes(e.quote))
 for(const event of result.events){
  const own=quotes(event.evidenceIds);if(own.some(e=>e.quote.includes(event.title)))continue
  const linked=tasks.filter(t=>event.relatedTaskTempIds?.includes(t.tempId)&&/报名|注册|申请|登记|扫描/u.test(t.actionVerb)),candidates=linked.filter(t=>{
   const same=t.actionObject===event.title,decorated=event.title===t.actionObject+'会'&&own.some(e=>e.quote.startsWith(t.actionObject.slice(-2)+'会'));
   return (same||decorated)&&quotes(t.evidenceIds).some(e=>e.quote.includes(t.actionObject))
  });
  if(candidates.length===1&&result.events.length===1){const t=candidates[0],proof=quotes(t.evidenceIds).filter(e=>e.quote.includes(t.actionObject)),before=event.title;event.title=t.actionObject;event.evidenceIds=[...new Set([...event.evidenceIds,...proof.map(e=>e.id)])];out.push({eventId:event.tempId,beforeTitle:before,afterTitle:event.title,quote:proof.map(e=>e.quote).join('\n'),reusedEvidenceIds:proof.map(e=>e.id),rule:'DECLARED_SAME_OBJECT_REGISTRATION'});continue}
  for(const q of own){const at=source.indexOf(q.quote);if(at<0||source.indexOf(q.quote,at+1)>=0)continue;const lines=source.slice(0,at).split('\n');if(/^(?:时间|日期|地点)[：:]?\s*$/u.test(lines.at(-1)??''))lines.pop();while(lines.length&&!lines.at(-1)?.trim())lines.pop();const literal=lines.at(-1)?.trim()??'',heading=literal.replace(/^[【\[]|[】\]]$/gu,'');if(heading!==event.title&&heading!==event.title+'信息')continue
   const id='program-event-heading-'+event.tempId;if(!result.evidence.some(e=>e.id===id))result.evidence.push({id,sourceId:q.sourceId,quote:literal,quotedText:literal,field:'event',extractionMethod:'parser'});event.evidenceIds=[...new Set([...event.evidenceIds,id])];out.push({eventId:event.tempId,beforeTitle:event.title,afterTitle:event.title,quote:literal,reusedEvidenceIds:[id],rule:'IMMEDIATELY_CITED_SOURCE_HEADING'});break
  }
 }
 return out
}
