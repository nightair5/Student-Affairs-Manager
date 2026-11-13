import type {RecognitionResult,TaskSuggestionV2} from './types'
import type {DirectConversion,DirectItem,DirectTag} from './directResult'
import {cleanDirectTopic} from './directRetention'

/** A model can explicitly identify both ways to submit the same document but
 * omit its material rows. Recover only that already-declared object when the
 * same literal choice, each format, and its branch are all source-backed. The
 * material is required within its chosen branch, not across both branches. */
function retainChoiceDeliverables(result:RecognitionResult,source:string):void {
  const literal=(id:string)=>{
    const ref=result.evidence.find(e=>e.id===id),quote=ref?.quotedText||ref?.quote||''
    if(!quote)return ''
    const at=ref?.textStart
    return typeof at==='number'&&source.slice(at,at+quote.length)===quote||source.indexOf(quote)>=0&&source.indexOf(quote)===source.lastIndexOf(quote)?quote:''
  }
  for(const choice of result.conflicts){
    if(!choice.id.startsWith('sem-choice-')||choice.requiresDecision||choice.entityTempIds.length!==2
      ||!choice.evidenceIds.some(id=>/(?:任选|二选一|择一)/u.test(literal(id))))continue
    const pair=choice.entityTempIds.map(id=>result.standaloneTasks.find(t=>t.tempId===id))
    if(pair.some(t=>!t))continue
    const [a,b]=pair as [TaskSuggestionV2,TaskSuggestionV2]
    if(!a.actionObject||a.actionObject!==b.actionObject||a.actionObject.length>60||a.sourceStatus==='uncertain'||b.sourceStatus==='uncertain'
      ||![a,b].every(t=>/^(?:提交|上传|递交|报送|发送|交|邮寄)$/u.test(t.actionVerb)))continue
    const shared=a.evidenceIds.find(id=>b.evidenceIds.includes(id)&&literal(id).includes(a.actionObject)
      &&/(?:任选|二选一|择一)/u.test(literal(id)))
    if(!shared)continue
    const branches=[a,b].map(task=>{
      const label=/^交付形式[：:]\s*([^\n]{1,20})/mu.exec(task.description)?.[1].trim()??''
      const branch=task.evidenceIds.find(id=>id!==shared&&literal(id).includes(label))
      const supported=label&&/(?:版|文件|资料|材料|扫描件|纸质|电子|PDF|Word|DOCX?)/iu.test(label)&&branch
      const channel=/^提交渠道[：:]\s*([^\n]{1,100})/mu.exec(task.description)?.[1].trim()??''
      return {task,label,branch,supported,channel:branch&&channel&&literal(branch).includes(channel)?channel:null}
    })
    if(branches.some(branch=>!branch.supported)||branches[0].label===branches[1].label
      ||!branches.every(branch=>literal(shared).includes(branch.label)))continue
    for(const {task,label,branch,channel} of branches){
      if(result.materials.some(m=>m.relatedTaskTempIds.includes(task.tempId)))continue
      const id=`direct-choice-material:${task.tempId}`
      if(result.materials.some(m=>m.tempId===id))continue
      if(id.length>100||task.materialTempIds.length>=20||result.materials.length>=60){
        result.quality.needsHumanReview=true
        result.quality.reviewReasons=[...new Set([...result.quality.reviewReasons,'部分材料尚未整理，请查看原通知。'])].slice(-20)
        continue
      }
      result.materials.push({tempId:id,name:task.actionObject,required:true,formatRequirements:[label],namingRequirements:[],requirements:[],quantity:null,submissionChannel:channel,relatedTaskTempIds:[task.tempId],evidenceIds:[shared,branch!],confidence:task.confidence,selected:true})
      task.materialTempIds=[...task.materialTempIds,id]
    }
  }
}

/** Direct mode changes selection/presentation, with a narrowly scoped repair
 * for a choice's explicitly cited deliverable omitted by the model. */
export function convertSemanticNotice(input:RecognitionResult,source:string):DirectConversion {
  const result=structuredClone(input),items:DirectItem[]=[],omitted:DirectConversion['omitted']=[]
  retainChoiceDeliverables(result,source)
  result.milestones=[]
  result.standaloneTasks=result.standaloneTasks.map(task=>{
    const condition=/适用条件待确认|资格待确认/u.test(task.description)
    const personalNeed=/按需办理：/u.test(task.description)
    const tags:DirectTag[]=condition?['如符合条件','待确认']:task.selected===false?['待确认']:[]
    const statusNote=task.sourceStatus==='uncertain'?'事项状态待确认：原文是否取消尚不明确。':''
    if(!result.timePoints.some(p=>p.relatedTaskTempIds.includes(task.tempId)&&p.normalizedValue&&!p.needsConfirmation))tags.push('时间待定')
    items.push({tempId:task.tempId,kind:'task',tags})
    return {...task,title:condition&&!task.title.startsWith('如符合条件')?'如符合条件 '+task.title:personalNeed&&!task.title.startsWith('按需')?'按需 '+task.title:task.title,description:statusNote?[statusNote,task.description].filter(Boolean).join('\n').slice(0,800):task.description,selected:true}
  })
  result.events=result.events.map(event=>{
    const condition=/适用条件待确认|资格待确认/u.test(event.description)
    const tags:DirectTag[]=condition?['如符合条件','待确认']:event.selected===false?['待确认']:[]
    const start=result.timePoints.find(p=>p.tempId===event.startTimePointTempId)
    if(event.sourceStatus==='uncertain'||event.sourceStatus==='alternative'){
      const originalTimes=result.timePoints.filter(p=>[event.startTimePointTempId,event.endTimePointTempId].includes(p.tempId)).map(p=>p.rawText).filter(Boolean)
      const alternative=event.sourceStatus==='alternative'
      const note=[alternative?'任选一场，尚未安排。':'事项状态待确认：原文是否取消尚不明确。',originalTimes.length?`${alternative?'候选时间':'原时间（待确认）'}：${[...new Set(originalTimes)].join('；')}`:''].filter(Boolean).join('\n')
      if(!tags.includes('待确认'))tags.push('待确认')
      if(!tags.includes('时间待定'))tags.push('时间待定')
      items.push({tempId:event.tempId,kind:'event',tags})
      const title=alternative&&!event.title.includes('任选一场')?`${event.title.slice(0,153)}（任选一场）`:event.title
      return {...event,title,description:[note,event.description].filter(Boolean).join('\n').slice(0,2400),startTimePointTempId:null,endTimePointTempId:null,selected:true}
    }
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
