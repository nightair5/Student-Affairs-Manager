import type {RecognitionResult,TaskSuggestionV2} from './types'
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&')
export interface ActivityRoleAudit {reusedNameEvidence:Array<{eventId:string;evidenceId:string}>;suppressedLocationTasks:Array<{task:TaskSuggestionV2;eventId:string;reason:string}>;invalidEnds:Array<{pointId:string;eventId:string;quote:string}>}
/** Existing closed graph only: the activity remains, its location is not a
 * second obligation, and a stated departure cannot serve as an event ending. */
export function groundActivityRoles(result:RecognitionResult,source:string,phase:'names'|'ends'='names'):ActivityRoleAudit{
 const audit:ActivityRoleAudit={reusedNameEvidence:[],suppressedLocationTasks:[],invalidEnds:[]},tasks=[...result.standaloneTasks,...result.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])],quoted=(ids:string[])=>result.evidence.filter(e=>ids.includes(e.id)&&e.quote&&source.includes(e.quote))
 for(const event of result.events){
  const own=quoted(event.evidenceIds)
  if(phase==='names'&&result.events.length===1&&!own.some(e=>e.quote.includes(event.title))){
   const prior=result.evidence.filter(e=>source.includes(e.quote)&&new RegExp('^'+escape(event.title)+'报名(?:已经|已)?(?:结束|截止)','u').test(e.quote)&&source.indexOf(e.quote)===source.lastIndexOf(e.quote))
   if(prior.length===1&&own.some(e=>/^已报名(?:的)?同学(?:请)?于/u.test(e.quote)&&source.indexOf(e.quote)>source.indexOf(prior[0].quote)+prior[0].quote.length-1&&/^[。\s]*$/u.test(source.slice(source.indexOf(prior[0].quote)+prior[0].quote.length,source.indexOf(e.quote))))){event.evidenceIds.push(prior[0].id);audit.reusedNameEvidence.push({eventId:event.tempId,evidenceId:prior[0].id})}
  }
  for(const task of phase==='names'?tasks:[]){
   const ids=[event.startTimePointTempId,event.endTimePointTempId].filter(Boolean)
   if(task.actionVerb!=='到'||task.actionObject!==event.location||!event.relatedTaskTempIds?.includes(task.tempId)||task.materialTempIds.length||result.materials.some(m=>m.relatedTaskTempIds.includes(task.tempId))||result.timePoints.some(p=>p.relatedTaskTempIds.includes(task.tempId)&&(!ids.includes(p.tempId)||p.relatedMaterialTempIds.length>0))||task.dependencyTempIds.length||task.parentTempId||!task.timePointTempIds.length||task.timePointTempIds.some(id=>!ids.includes(id))||tasks.some(t=>t.dependencyTempIds.includes(task.tempId)||t.parentTempId===task.tempId)||result.conflicts.some(c=>c.entityTempIds.includes(task.tempId)))continue
   const proof=quoted(task.evidenceIds).filter(e=>event.evidenceIds.includes(e.id)&&e.quote.includes('到'+task.actionObject+'集合')&&!/领取|提交|递交|准备|填写|缴|登记|取回|上传|发放/u.test(e.quote))
   if(!proof.length)continue
   audit.suppressedLocationTasks.push({task:structuredClone(task),eventId:event.tempId,reason:'EXISTING_EVENT_LOCATION_AND_ASSEMBLY_NOT_EXTRA_OBLIGATION'})
  }
  if(phase==='names')continue
  const end=result.timePoints.find(p=>p.tempId===event.endTimePointTempId)
  const clock=end&&/^(\d{1,2}:[0-5]\d)(?:出发|开始|开场)?$/u.exec(end.rawText)?.[1]
  if(end?.type==='event_end'&&clock){const proof=quoted(end.evidenceIds).find(e=>event.evidenceIds.includes(e.id)&&new RegExp(escape(clock)+'\\s*(?:出发|开始|开场)','u').test(e.quote)&&!new RegExp(escape(clock)+'\\s*(?:结束|散场|闭幕)','u').test(e.quote));if(proof){Object.assign(end,{normalizedValue:null,precision:'vague' as const,isAllDay:false,needsConfirmation:true,selected:false});audit.invalidEnds.push({pointId:end.tempId,eventId:event.tempId,quote:proof.quote});const id='source-activity-end-role:'+end.tempId;result.conflicts=result.conflicts.filter(c=>c.id!==id);result.conflicts.push({id,type:'other',message:'原文这是出发或开始，不能当活动结束；原时刻保留待核对，不猜补另一个活动。',entityTempIds:[event.tempId,end.tempId],evidenceIds:[proof.id],requiresDecision:true});result.quality.needsHumanReview=true}}
 }
 const removed=new Set(audit.suppressedLocationTasks.map(r=>r.task.tempId));result.standaloneTasks=result.standaloneTasks.filter(t=>!removed.has(t.tempId));for(const m of result.milestones){m.tasks=m.tasks.filter(t=>!removed.has(t.tempId));for(const w of m.workPackages)w.tasks=w.tasks.filter(t=>!removed.has(t.tempId))}for(const p of result.timePoints)p.relatedTaskTempIds=p.relatedTaskTempIds.filter(id=>!removed.has(id));for(const e of result.events)e.relatedTaskTempIds=(e.relatedTaskTempIds??[]).filter(id=>!removed.has(id))
 return audit
}
