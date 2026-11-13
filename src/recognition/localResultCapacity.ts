import type {RecognitionResult,TaskSuggestionV2} from './types'
import {sourceTimeKind} from '../../cloudflare/source-time-kind.mjs'

/** Bound the local producer at the same boundary as the wire contract.
 * Full source remains in SourceVersion. Oversize notes move into the existing
 * editable requirements, while unprocessed actions are explicitly partial.
 * Never apply this to an AI result or describe a bounded result as complete. */
export function boundLocalResult(input:RecognitionResult,capacity:'container'|'direct'='container'):RecognitionResult {
 const r=structuredClone(input)
 const collections=[r.standaloneTasks,...r.milestones.flatMap(m=>[m.tasks,...m.workPackages.map(w=>w.tasks)])]
 const deferred:TaskSuggestionV2[]=[]
 let available=20
 // Capture accepts twenty actions per container. Only the flattened direct
 // result has a shared twenty-action budget. Applying that budget before
 // conversion would let discarded placeholders crowd out later valid actions.
 for(const list of collections){deferred.push(...list.splice(capacity==='direct'?available:20));available-=capacity==='direct'?list.length:0}
 const removed=new Set(deferred.map(task=>task.tempId))
 // Capacity is not permission to erase a prerequisite or turn the surviving
 // half of an either/or group into a mandatory action. Defer that dependent
 // unit as well; its complete source stays available for a later attempt.
 let changed=true
 while(changed){
  changed=false
  const incompleteChoices=new Set(r.conflicts.filter(c=>c.id.startsWith('sem-choice-')&&c.type==='other'&&!c.requiresDecision&&c.entityTempIds.some(id=>removed.has(id))).flatMap(c=>c.entityTempIds))
  for(const list of collections)for(let index=list.length-1;index>=0;index--){
   const task=list[index]
   if(task.dependencyTempIds.some(id=>removed.has(id))||task.parentTempId&&removed.has(task.parentTempId)||incompleteChoices.has(task.tempId)){
    deferred.push(...list.splice(index,1));removed.add(task.tempId);changed=true
   }
  }
 }
 const reason=deferred.length?`部分内容尚未完整整理：有${deferred.length}项超出本次简单整理容量或关联步骤尚未完整保留，完整内容保留在原通知中。`:''
 for(const task of collections.flat()){
  task.dependencyTempIds=task.dependencyTempIds.filter(id=>!removed.has(id))
  if(task.description.length>800){
   const full=task.description
   // Split only at paragraph boundaries. The last requirement retains all
   // remaining text when the twelve-entry container is reached.
   const details=[...new Set([...task.completionCriteria,...full.split('\n').filter(Boolean)])]
   task.completionCriteria=details.length<=12?details:[...details.slice(0,11),details.slice(11).join('\n')]
   const summary=full.split(/(?<=[。！？；])|\n/u).find(part=>part.trim()&&part.length<=700)
   task.description=[summary?.trim(), '完整说明与要求见下方清单；原通知已保留。'].filter(Boolean).join('\n')
  }
 }
 for(const point of r.timePoints){
  const refs=point.evidenceIds.map(id=>r.evidence.find(e=>e.id===id)).filter(e=>Boolean(e))
  const rawKind=sourceTimeKind(point.rawText).kind
  const bareRange=/^\s*\d{1,2}\s*[-—–~～/.]\s*\d{1,2}\s*$/u.test(point.rawText)
  const nonCalendar=rawKind!=='calendar'||bareRange&&refs.length>0&&refs.every(ref=>sourceTimeKind(ref!.quote).kind!=='calendar')
  if(nonCalendar&&point.normalizedValue){
   point.normalizedValue=null;point.precision='vague';point.needsConfirmation=true;point.selected=false
   r.quality.needsHumanReview=true
   r.quality.reviewReasons=[...new Set([...r.quality.reviewReasons,'周期或非日期范围未换算为单次日期，原文已保留。'])].slice(-20)
  }
 }
 if(removed.size){
  r.materials=r.materials.filter(m=>!m.relatedTaskTempIds.length||m.relatedTaskTempIds.some(id=>!removed.has(id))).map(m=>{
   const goalScope=m.goalScope?{...m.goalScope,taskTempIds:m.goalScope.taskTempIds.filter(id=>!removed.has(id))}:undefined
   return {...m,relatedTaskTempIds:m.relatedTaskTempIds.filter(id=>!removed.has(id)),...(goalScope?.taskTempIds.length?{goalScope}:goalScope?{goalScope:undefined,requirements:[...new Set(['适用事项待关联',...(m.requirements??[])])].slice(0,20)}:{})}
  })
  const materialIds=new Set(r.materials.map(m=>m.tempId))
  const eventTimes=new Set(r.events.flatMap(e=>[e.startTimePointTempId,e.endTimePointTempId]).filter(Boolean))
  r.timePoints=r.timePoints.filter(p=>eventTimes.has(p.tempId)||!p.relatedTaskTempIds.length||p.relatedTaskTempIds.some(id=>!removed.has(id))).map(p=>({...p,relatedTaskTempIds:p.relatedTaskTempIds.filter(id=>!removed.has(id)),relatedMaterialTempIds:p.relatedMaterialTempIds.filter(id=>materialIds.has(id))}))
  const timeIds=new Set(r.timePoints.map(p=>p.tempId))
  for(const t of collections.flat()){t.materialTempIds=t.materialTempIds.filter(id=>materialIds.has(id));t.timePointTempIds=t.timePointTempIds.filter(id=>timeIds.has(id))}
  r.events=r.events.map(e=>({...e,relatedTaskTempIds:e.relatedTaskTempIds?.filter(id=>!removed.has(id)),startTimePointTempId:e.startTimePointTempId&&timeIds.has(e.startTimePointTempId)?e.startTimePointTempId:null,endTimePointTempId:e.endTimePointTempId&&timeIds.has(e.endTimePointTempId)?e.endTimePointTempId:null}))
  r.goalGroups=r.goalGroups?.map(g=>({...g,taskTempIds:g.taskTempIds.filter(id=>!removed.has(id))})).filter(g=>g.taskTempIds.length>=2)
  r.conflicts=r.conflicts.map(c=>({...c,entityTempIds:c.entityTempIds.filter(id=>!removed.has(id))}))
  r.quality.needsHumanReview=true
  r.quality.reviewReasons=[...new Set([...r.quality.reviewReasons,reason])].slice(-20)
  r.ambiguities.push({id:'local-capacity',field:'source_reference',message:reason,options:['查看原通知'],evidenceIds:[]})
  r.ignoredContent.push(...deferred.flatMap(t=>{
   const full=`未处理行动：${t.title}\n${t.description}`,parts=[]
   for(let offset=0;offset<full.length;offset+=1000)parts.push({text:full.slice(offset,offset+1000),reason:'other' as const})
   return parts
  }))
 }
 // A source may yield more candidate quotations than can fit in the wire
 // contract even after dependent actions are deferred. Discard only evidence
 // which no retained entity references; the complete source is still saved.
 if(r.evidence.length>120){
  const used=new Set<string>()
  const add=(ids:readonly string[])=>ids.forEach(id=>used.add(id))
  for(const task of collections.flat())add(task.evidenceIds)
  for(const stage of r.milestones){add(stage.evidenceIds);for(const group of stage.workPackages)add(group.evidenceIds)}
  for(const item of [...r.materials,...r.timePoints,...r.events,...r.conflicts,...r.ambiguities])add(item.evidenceIds)
  for(const group of r.goalGroups??[])add(group.evidenceIds)
  if(r.projectSuggestion)for(const field of Object.values(r.projectSuggestion))add(field.evidenceIds)
  r.evidence=r.evidence.filter(ref=>used.has(ref.id))
 }
 return r
}
