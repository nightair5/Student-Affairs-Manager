import type {RecognitionResult,TaskSuggestionV2} from './types'
import type {DirectConversion,DirectItem,DirectTag} from './directResult'
import {cleanDirectTopic} from './directRetention'

/** The semantic adapter already assigned and checked source-backed facts.
 * Direct mode changes only selection/presentation, never re-extracts them. */
export function convertSemanticNotice(input:RecognitionResult,source:string):DirectConversion {
  const result=structuredClone(input),items:DirectItem[]=[],omitted:DirectConversion['omitted']=[]
  result.milestones=[]
  result.standaloneTasks=result.standaloneTasks.map(task=>{
    const condition=/适用条件待确认|资格待确认/u.test(task.description)
    const tags:DirectTag[]=condition?['如符合条件','待确认']:task.selected===false?['待确认']:[]
    if(!result.timePoints.some(p=>p.relatedTaskTempIds.includes(task.tempId)&&p.normalizedValue&&!p.needsConfirmation))tags.push('时间待定')
    items.push({tempId:task.tempId,kind:'task',tags})
    return {...task,title:condition&&!task.title.startsWith('如符合条件')?'如符合条件 '+task.title:task.title,selected:true}
  })
  result.events=result.events.map(event=>{
    const condition=/适用条件待确认|资格待确认/u.test(event.description)
    const tags:DirectTag[]=condition?['如符合条件','待确认']:event.selected===false?['待确认']:[]
    const start=result.timePoints.find(p=>p.tempId===event.startTimePointTempId)
    if(!start?.normalizedValue||start.needsConfirmation)tags.push('时间待定')
    items.push({tempId:event.tempId,kind:'event',tags})
    return {...event,selected:true}
  })
  if(!result.standaloneTasks.length&&!result.events.length){
    const information=result.sourceSummary.notificationType==='information_only',topic=cleanDirectTopic(result.sourceSummary.title||'通知'),id='sem-read-notice',quote=source.slice(0,500),eid='sem-notice-source'
    if(quote)result.evidence.push({id:eid,sourceId:result.evidence[0]?.sourceId??'source',quote,quotedText:quote,textStart:0,textEnd:quote.length,field:'description',extractionMethod:'parser',confidence:1})
    const task:TaskSuggestionV2={tempId:id,parentTempId:null,hierarchyType:'task',title:(information?'查看：':'待整理：')+topic,actionVerb:'查看',actionObject:topic,description:information?result.sourceSummary.summary:'部分内容尚未完整整理，请查看原通知。',completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'low',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:quote?[eid]:[],confidence:information ? .8 : .5,inferenceLevel:'optional_suggestion',userConfirmationRequired:!information,selected:true}
    result.standaloneTasks.push(task);items.push({tempId:id,kind:'task',tags:information?[]:['待确认']})
    if(!information)omitted.push({id,reason:'ACTION_OR_EVENT_NOT_FULLY_EXTRACTED'})
  }
  result.projectMatch={decision:'standalone_task',matchedProjectId:null,suggestedProjectTitle:null,confidence:1,reasons:['独立添加，来源可追溯']}
  return {result,items,omitted}
}
