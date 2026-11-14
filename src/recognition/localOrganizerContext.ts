import {organizerProcessingClauses} from './localActionPolarity'
import type {RecognitionResult,TaskSuggestionV2} from './types'

/** Move source-attributed administrative processing to retained context.
 * Personal invitation/role instructions are outside this pass. Facts are
 * classified before saving; existing workspace entities are never edited. */
export function retainLocalOrganizerContext(input:RecognitionResult,source:string):RecognitionResult {
 if(input.modelName!=='local-rules')return input
 const processes=organizerProcessingClauses(source)
 if(!processes.length)return input
 const result=structuredClone(input)
 const lists=[result.standaloneTasks,...result.milestones.flatMap(stage=>[stage.tasks,...stage.workPackages.map(group=>group.tasks)])]
 const all=lists.flat(),removedTasks=new Set<string>(),removedEvents=new Set<string>(),removedPoints=new Set<string>()
 const quoted=(ids:string[])=>ids.flatMap(id=>{const ref=result.evidence.find(value=>value.id===id);return ref&&source.includes(ref.quote)?[ref.quote]:[]})
 const direct=(task:TaskSuggestionV2)=>/^(?:提交|递交|上传|发送|交|填写|填报|登记|申请|报名|领取)$/u.test(task.actionVerb)
 for(const process of processes){
  const matches=(title:string,object:string,ids:string[])=>{
   const name=(object||title).replace(/^(?:参加|出席|核对|如符合条件)\s*/u,'').trim()
   return name.length>=2&&process.text.includes(name)&&quoted(ids).some(quote=>(quote.includes(name)&&process.text.includes(quote))||quote.includes(process.text))
  }
  const processTasks=all.filter(task=>matches(task.title,task.actionObject,task.evidenceIds)&&!direct(task))
  const processEvents=result.events.filter(event=>matches(event.title,event.title,event.evidenceIds))
  // Keep a linked entity intact if its state/material/dependency semantics
  // cannot be safely represented by a source note.
  if(processTasks.some(task=>task.materialTempIds.length||task.dependencyTempIds.length
    ||all.some(other=>other.dependencyTempIds.includes(task.tempId))
    ||result.materials.some(material=>material.relatedTaskTempIds.includes(task.tempId)||material.goalScope?.taskTempIds.includes(task.tempId))
    ||result.events.some(event=>event.relatedTaskTempIds?.includes(task.tempId))
    ||result.conflicts.some(conflict=>conflict.entityTempIds.includes(task.tempId))
    ||result.goalGroups?.some(group=>group.taskTempIds.includes(task.tempId))))continue
  const candidates=all.filter(task=>direct(task)&&!processTasks.includes(task)&&quoted(task.evidenceIds).some(quote=>{
   const at=source.indexOf(quote),actionAt=quote.indexOf(task.actionObject)
   return at>=0&&actionAt>=0&&at+actionAt<process.start&&process.start-at<500
  }))
  const exact=candidates.filter(task=>process.text.includes(task.actionObject.replace(/(?:PDF|Word|PPT)$/iu,'')))
  const preceding=candidates.filter(task=>quoted(task.evidenceIds).some(quote=>{
   const at=source.indexOf(quote),gap=source.slice(at+quote.length,process.start)
   return at+quote.length<=process.start&&/^[\s。；;，,]*$/u.test(gap)
  }))
  const parent=exact.length===1?exact[0]:candidates.length===1&&preceding.length===1?preceding[0]:null
  const eid=`local-organizer-context:${process.start}`
  if(result.evidence.length>=120||process.text.length>500)continue
  if(!result.evidence.some(ref=>ref.id===eid))result.evidence.push({id:eid,sourceId:result.evidence[0]?.sourceId??'source',quote:process.text,quotedText:process.text,textStart:process.start,textEnd:process.start+process.text.length,field:'description',extractionMethod:'parser',confidence:1})
  const line=`后续办理（原文）：${process.text}`
  if(parent&&parent.description.length+line.length+1<=800&&parent.evidenceIds.length<20){
   if(!parent.description.includes(line))parent.description=[parent.description,line].filter(Boolean).join('\n')
   parent.evidenceIds=[...new Set([...parent.evidenceIds,eid])]
  }else if(!result.ignoredContent.some(info=>info.text===process.text)){
   result.ignoredContent.push({text:process.text,reason:'other'})
  }
  for(const task of processTasks){removedTasks.add(task.tempId);task.timePointTempIds.forEach(id=>removedPoints.add(id))}
  for(const event of processEvents){removedEvents.add(event.tempId);[event.startTimePointTempId,event.endTimePointTempId].forEach(id=>{if(id)removedPoints.add(id)})}
 }
 for(const list of lists)for(let i=list.length-1;i>=0;i--)if(removedTasks.has(list[i].tempId))list.splice(i,1)
 result.events=result.events.filter(event=>!removedEvents.has(event.tempId))
 for(const point of result.timePoints)point.relatedTaskTempIds=point.relatedTaskTempIds.filter(id=>!removedTasks.has(id))
 result.timePoints=result.timePoints.filter(point=>!removedPoints.has(point.tempId)||point.relatedTaskTempIds.length||point.relatedMaterialTempIds.length||result.events.some(event=>event.startTimePointTempId===point.tempId||event.endTimePointTempId===point.tempId))
 return result
}
