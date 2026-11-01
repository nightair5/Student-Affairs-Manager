import {noticeDeliveryRoles} from '../../cloudflare/notice-delivery-roles.mjs'
import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import {locateSourceQuote} from '../../cloudflare/source-text-index.mjs'
import type {RecognitionResult,TaskSuggestionV2} from './types'

/** The local provider uses the same explicit delivery-role relation as the
 * compiler. A role section supplies requirements, not another invented task. */
export function projectLocalDeliveryRoles(input:RecognitionResult,source:string):RecognitionResult {
 const group=noticeDeliveryRoles(source)
 if(!group)return input
 const r=structuredClone(input),{delivery}=group,id='local-delivery:'+delivery.span.start,sourceId=r.evidence[0]?.sourceId??'source'
 const evidence=(span:{literal:string;start:number;end:number},field:'description'|'materials'|'requirement'|'deadline')=>{
  const eid=`${id}:${field}:${span.start}`
  if(!r.evidence.some(e=>e.id===eid))r.evidence.push({id:eid,sourceId,quote:span.literal,quotedText:span.literal,textStart:span.start,textEnd:span.end,field,extractionMethod:'parser',confidence:1})
  return eid
 }
 const taskEvidence=[evidence(delivery.span,'description')]
 const requirements=group.requirements.map(s=>s.role+'：'+s.body.trim()),conditions=group.conditions.map(s=>'适用条件待确认：'+s.body.trim())
 for(const section of [...group.requirements,...group.conditions])for(const match of section.text.matchAll(/[^。；;\n]+[。；;]?/gu)){
  if(match[0].length<=500)taskEvidence.push(evidence({literal:match[0],start:section.start+match.index!,end:section.start+match.index!+match[0].length},'requirement'))
 }
 const mid=id+':material',conditional=conditions.length>0
 const task:TaskSuggestionV2={tempId:id,parentTempId:null,hierarchyType:'task',title:delivery.title,actionVerb:delivery.verb,actionObject:delivery.object,description:[delivery.title,...conditions,...requirements].join('\n'),completionCriteria:requirements,estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[mid],timePointTempIds:[],evidenceIds:taskEvidence,confidence:1,inferenceLevel:'strong_inference',userConfirmationRequired:conditional,selected:!conditional}
 const previous=[...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
 const kept=previous.filter(t=>t.actionObject.length>=2&&!/^(?:工作|事项|内容|材料|要求)$/u.test(t.actionObject)&&!t.actionObject.includes(delivery.object)&&t.evidenceIds.some(eid=>{
  const e=r.evidence.find(e=>e.id===eid),span=locateSourceQuote(e?.quotedText||e?.quote,source,{start:e?.textStart})
  return span&&source.slice(span.start,span.end).includes(t.actionObject)&&!group.sections.some(s=>span.start<s.end&&span.end>s.start)
 }))
 const keptIds=new Set(kept.map(t=>t.tempId)),eventTimes=new Set(r.events.flatMap(e=>[e.startTimePointTempId,e.endTimePointTempId]))
 r.standaloneTasks=[...kept,task];r.milestones=[]
 r.materials=r.materials.filter(m=>m.relatedTaskTempIds.some(t=>keptIds.has(t)))
 r.timePoints=r.timePoints.filter(p=>p.relatedTaskTempIds.some(t=>keptIds.has(t))||eventTimes.has(p.tempId))
 r.materials.push({tempId:mid,name:delivery.object,required:true,formatRequirements:delivery.formats,namingRequirements:group.requirements.flatMap(s=>s.body.split(/[；;。\n]/u).filter(x=>/文件名|命名|注明/u.test(x)&&!/邮件正文/u.test(x)).map(x=>x.trim())),quantity:null,submissionChannel:delivery.channel,relatedTaskTempIds:[id],evidenceIds:[...taskEvidence,evidence(delivery.span,'materials')],confidence:1,selected:true})
 const parsed=parseDirectSourceTime(delivery.span.literal,{type:'task_deadline',referenceTime:r.createdAt,timezone:'Asia/Shanghai'})
 if(parsed.normalizedValue&&!parsed.needsConfirmation){
  const tid=id+':deadline';task.timePointTempIds=[tid]
  r.timePoints.push({tempId:tid,type:'task_deadline',rawText:delivery.span.literal,normalizedValue:parsed.normalizedValue,timezone:parsed.timezone,precision:parsed.precision,isAllDay:parsed.isAllDay,needsConfirmation:false,relatedTaskTempIds:[id],relatedMaterialTempIds:[mid],evidenceIds:[evidence(delivery.span,'deadline')],confidence:1,selected:true})
 }
 r.sourceSummary={...r.sourceSummary,title:delivery.title,requiresAction:true,notificationType:'material_submission'}
 return r
}
