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
 const reason=deferred.length?`部分内容尚未完整整理：有${deferred.length}项超出本次简单整理容量，完整内容保留在原通知中。`:''
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
  r.materials=r.materials.filter(m=>!m.relatedTaskTempIds.length||m.relatedTaskTempIds.some(id=>!removed.has(id))).map(m=>({...m,relatedTaskTempIds:m.relatedTaskTempIds.filter(id=>!removed.has(id))}))
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
 return r
}
