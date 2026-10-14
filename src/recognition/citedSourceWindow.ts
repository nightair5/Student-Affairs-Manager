import type {RecognitionResult} from './types'
import {interpretTimeD26} from '../lib/timeSemanticsD26'
export const CITED_SOURCE_WINDOW_VERSION='ordinary-cited-window-projection-1.0.0'
export interface CitedSourceWindow {ownerTempId:string;startPointId:string;endPointId:string;rawText:string;date:string;start:string;end:string;evidenceIds:string[];beforeType:string;beforeMaterialIds:string[]}
/** One existing, uniquely owned full quoted interval. Derive its two indexes,
 * rather than reinterpreting its beginning or end as an unstated deadline. */
export function completeCitedSourceWindows(r:RecognitionResult,source:string,referenceTime:string,timezone:string){
 const decisions:CitedSourceWindow[]=[],tasks=[...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
 for(const p of [...r.timePoints]){
  if(!['submission_deadline','task_deadline','event_start'].includes(p.type)||r.events.some(e=>[e.startTimePointTempId,e.endTimePointTempId].includes(p.tempId)))continue
  const m=/^(\d{4}年\d{1,2}月\d{1,2}日)\s*(\d{1,2}:[0-5]\d)\s*[-—–至到]\s*(\d{1,2}:[0-5]\d)$/u.exec(p.rawText)
  if(!m)continue
  const owners=tasks.filter(t=>p.relatedTaskTempIds.includes(t.tempId)&&t.timePointTempIds.includes(p.tempId));if(owners.length!==1)continue
  const owner=owners[0],proof=r.evidence.filter(e=>p.evidenceIds.includes(e.id)&&owner.evidenceIds.includes(e.id)&&source.includes(e.quote)&&e.quote.includes(p.rawText)&&e.quote.includes(owner.actionVerb))
  if(proof.length!==1||/截止|截至|最迟|之前|前交|前提交|不得|不要|禁止|取消|若|如果/u.test(proof[0].quote))continue
  const start=interpretTimeD26(m[1]+m[2],{type:'event_start',referenceTime,timezone}).point,end=interpretTimeD26(m[1]+m[3],{type:'event_end',referenceTime,timezone}).point
  if(!start.normalizedValue||!end.normalizedValue||start.needsConfirmation||end.needsConfirmation||end.normalizedValue<=start.normalizedValue)continue
  const existing=r.timePoints.filter(e=>e.tempId!==p.tempId&&e.type==='event_end'&&e.rawText===p.rawText&&e.relatedTaskTempIds.length===1&&e.relatedTaskTempIds[0]===owner.tempId&&owner.timePointTempIds.includes(e.tempId))
  if(existing.length>1)continue
  const endId=existing[0]?.tempId??p.tempId+'-quoted-window-end';if(!existing.length&&r.timePoints.some(e=>e.tempId===endId))continue
  decisions.push({ownerTempId:owner.tempId,startPointId:p.tempId,endPointId:endId,rawText:p.rawText,date:start.normalizedValue.slice(0,10),start:start.normalizedValue,end:end.normalizedValue,evidenceIds:proof.map(e=>e.id),beforeType:p.type,beforeMaterialIds:[...p.relatedMaterialTempIds]})
  p.type='event_start';p.relatedMaterialTempIds=[];Object.assign(p,{normalizedValue:start.normalizedValue,precision:'exact',needsConfirmation:false,isAllDay:false})
  const endpoint=existing[0]??{...structuredClone(p),tempId:endId};endpoint.type='event_end';endpoint.relatedMaterialTempIds=[];Object.assign(endpoint,{normalizedValue:end.normalizedValue,precision:'exact',needsConfirmation:false,isAllDay:false});if(!existing.length)r.timePoints.push(endpoint)
  owner.timePointTempIds=[...new Set([...owner.timePointTempIds,endId])]
 }
 return {version:CITED_SOURCE_WINDOW_VERSION,inferredFacts:0 as const,decisions}
}
