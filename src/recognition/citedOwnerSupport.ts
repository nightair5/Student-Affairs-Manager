import type {RecognitionResult} from './types'
export const CITED_OWNER_SUPPORT_VERSION='cited-owner-support-1.0.0'
export interface CitedOwnerDecision {entityId:string;field:'actionVerb'|'actionObject'|'rawText';before:string;after:string;reusedEvidenceIds:string[];rule:'CITED_ACTION_ALIAS'|'DECLARED_REGISTRATION_OBJECT'|'DECLARED_OWNER_TIME_QUOTE'}
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&')
/** Reindex existing facts along existing bidirectional owners. No missing entity,
 * time, owner, channel or action is discovered from an unrelated source clause. */
export function completeCitedOwnerSupport(result:RecognitionResult,source:string):CitedOwnerDecision[]{
 const changes:CitedOwnerDecision[]=[],tasks=[...result.standaloneTasks,...result.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
 const valid=(ids:string[])=>result.evidence.filter(e=>ids.includes(e.id)&&source.includes(e.quote))
 for(const task of tasks){
  const own=valid(task.evidenceIds)
  if(!own.some(e=>e.quote.includes(task.actionObject))&&/^(报名|注册|登记|申请)$/u.test(task.actionVerb)){
   const events=result.events.filter(e=>(e.relatedTaskTempIds??[]).includes(task.tempId)&&e.title===task.actionObject)
   const action=own.some(e=>e.quote.includes(task.actionVerb)&&!/请勿|不要|禁止|取消/u.test(e.quote))
   if(action&&events.length===1){const proof=valid(events[0].evidenceIds).filter(e=>e.quote.includes(task.actionObject));if(proof.length){task.evidenceIds=[...new Set([...task.evidenceIds,...proof.map(e=>e.id)])];changes.push({entityId:task.tempId,field:'actionObject',before:task.actionObject,after:task.actionObject,reusedEvidenceIds:proof.map(e=>e.id),rule:'DECLARED_REGISTRATION_OBJECT'})}}
  }
  if(task.actionVerb==='提交'&&!valid(task.evidenceIds).some(e=>e.quote.includes('提交'))){
   const candidates=valid(task.evidenceIds).flatMap(e=>e.quote.split(/[。；\n]/u).flatMap(clause=>{
    const direct=new RegExp('(上交|递交|交)(?:一份|一张)?'+escape(task.actionObject),'u').exec(clause)
    const ellipsis=e.quote.includes(task.actionObject)?/(?:，|前)(?:也)?(上交|递交|交)(?:到|至|给)?[^，。；]{1,24}$/u.exec(clause):null
    const match=direct??ellipsis
    if(!match||/请勿|不要|不得|无需|不必|禁止|不再/u.test(clause.slice(0,match.index)))return []
    return [{verb:match[1],id:e.id}]
   }))
   if(candidates.length&&new Set(candidates.map(x=>x.verb)).size===1){const before=task.actionVerb;task.actionVerb=candidates[0].verb;changes.push({entityId:task.tempId,field:'actionVerb',before,after:task.actionVerb,reusedEvidenceIds:candidates.map(x=>x.id),rule:'CITED_ACTION_ALIAS'})}
  }
 }
 for(const point of result.timePoints){
  if(valid(point.evidenceIds).some(e=>e.quote.includes(point.rawText)))continue
  const owners=tasks.filter(t=>point.relatedTaskTempIds.includes(t.tempId)&&t.timePointTempIds.includes(point.tempId))
  if(owners.length!==1)continue
  const task=owners[0],proof=valid(task.evidenceIds).filter(e=>e.quote.includes(point.rawText)&&e.quote.includes(task.actionObject)&&e.quote.includes(task.actionVerb))
  if(proof.length!==1)continue
  point.evidenceIds=[...new Set([...point.evidenceIds,proof[0].id])];changes.push({entityId:point.tempId,field:'rawText',before:point.rawText,after:point.rawText,reusedEvidenceIds:[proof[0].id],rule:'DECLARED_OWNER_TIME_QUOTE'})
 }
 return changes
}
