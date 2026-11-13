import type {RecognitionResult,TaskSuggestionV2} from './types'
import {convertDirectResult,type DirectConversion} from './directResult'
import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import {cleanDirectTopic} from './directRetention'
import {localDelivery,localSubmissionChannel,localMaterialRequirements} from './localNoticeFacts'
import {completeDirectLocalFacts,directEventRevision} from './directLocalFacts'
import {structuredOptionalEvent} from './directStructuredEvent'
import {completeNumberedActions} from './directNumberedActions'
import {retainLocalEventDetails} from './localEventDetails'
import {retainSourceEventContext} from './retainSourceEventContext'
import {recoverLabeledLocalEvent} from './directLabeledEvent'
import {completeParallelSessions,linkFollowingFormChannel,linkReferencedEventActions} from './directParallelSessions'
import {projectLocalDeliveryRoles} from './deliveryRoleProjection'
import {localActionExplicitlyNegated} from './localActionPolarity'
import {localMaterialOwnership} from './localMaterialOwnership'
import {localSubmissionChoices} from './localSubmissionChoices'
import {boundLocalResult} from './localResultCapacity'
import {scopeLocalOtherPartyActions} from './localResponsibilityScope'
import {retainLocalConditionalMaterials} from './localConditionalMaterials'

/** Used only after local-rules recognition. No cloud answer is rewritten here. */
export function improveDirectFallback(input:RecognitionResult,source:string):RecognitionResult {
 const actions=removeDuplicatedActionEvents(improveLocalActions(input,source))
 const improved=retainLocalEventDetails(retainSourceEventContext(recoverLabeledLocalEvent(completeNumberedActions(completeDirectLocalFacts(projectLocalDeliveryRoles(actions,source),source),source),source),source),source)
 const result=boundLocalResult(retainLocalConditionalMaterials(scopeLocalOtherPartyActions(clearUndatedSingleEventRevision(attachExplicitSharedGoal(linkReferencedEventActions(linkFollowingFormChannel(completeParallelSessions(removeLocalSectionHeadings(localMaterialOwnership(localSubmissionChoices(improved,source),source)),source,true),source),source),source),source),source),source))
 const rows=source.split(/\r?\n/u).map(line=>line.trim()).filter(line=>/^[\p{Script=Han}\d]{1,12}场[：:]/u.test(line)&&!/^(?:报名|申请|提交|缴费)/u.test(line))
 if(rows.length>1&&result.events.length<rows.length){
  const reason='部分内容尚未完整整理（活动场次），请核对原文'
  if(!result.quality.reviewReasons.includes(reason))result.quality.reviewReasons.push(reason)
  result.quality.needsHumanReview=true
 }
 // When local rules cannot retain both branches as an explicit relation,
 // disclose the limitation instead of calling the surviving branch complete.
 const choiceTasks=new Set([...result.standaloneTasks,...result.milestones.flatMap(stage=>[...stage.tasks,...stage.workPackages.flatMap(group=>group.tasks)])].map(task=>task.tempId))
 if(/二选一|任选(?:一种|其一)|任选[^。；;\n]{1,30}(?:或|或者)|择一/u.test(source)&&!result.conflicts.some(conflict=>conflict.id.startsWith('sem-choice-')&&conflict.entityTempIds.filter(id=>choiceTasks.has(id)).length>=2)){
  const reason='部分内容尚未完整整理：选择方式及各自时间请查看原通知。'
  if(!result.quality.reviewReasons.includes(reason))result.quality.reviewReasons.push(reason)
  result.quality.needsHumanReview=true
 }
 return result
}

/** When a single named event is explicitly rescheduled to an unknown time,
 * the previous labelled range must not survive as the current schedule. */
function clearUndatedSingleEventRevision(input:RecognitionResult,source:string):RecognitionResult {
 if(input.events.length!==1||/(?:第一场|第二场|第三场|一场|另一场|分别举行)/u.test(source))return input
 const event=input.events[0],heading=/^\s*[\p{Extended_Pictographic}\uFE0F\u200D\s]*【([^】\n]{3,100})】/u.exec(source)
 const normalize=(s:string)=>s.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'')
 const title=normalize(event.title),head=normalize(heading?.[1]??'')
 if(title.length<3||!head.includes(title))return input
 const revision=/(?:本次|该|此次)?(?:活动|会议|讲座|培训|宣讲|报告|赛事|比赛)[^。；;\n]{0,8}(?:改期|延期)[，,；;\s]*(?:具体|新的|后续)?(?:时间|日期)[^。；;\n]{0,8}(?:另行通知|待定|待通知)/u.exec(source)
 if(!revision||/[0-9０-９一二三四五六七八九十]{1,4}[年月日号]|\d{1,2}[:：]\d{2}/u.test(source.slice(revision.index+revision[0].length)))return input
 const oldPoints=new Set([event.startTimePointTempId,event.endTimePointTempId].filter((id):id is string=>Boolean(id)))
 if(!oldPoints.size)return input
 const result=structuredClone(input),owner=result.events[0]
 owner.startTimePointTempId=null;owner.endTimePointTempId=null
 owner.description=(owner.description?'原通知（已改期，不以旧时间为准）：\n'+owner.description+'\n':'')+'时间说明：'+revision[0]
 result.timePoints=result.timePoints.filter(point=>!oldPoints.has(point.tempId)||point.relatedTaskTempIds.length>0||point.relatedMaterialTempIds.length>0)
 const reason='活动已改期，具体时间待通知'
 if(!result.quality.reviewReasons.includes(reason))result.quality.reviewReasons.push(reason)
 result.quality.needsHumanReview=true
 return result
}

/** The local parser may classify a form action as an event merely because the
 * form names a lecture. Remove only a duplicate of an already retained form
 * action; genuine attendance events are independent and stay untouched. */
function removeDuplicatedActionEvents(input:RecognitionResult):RecognitionResult {
 const tasks=[...input.standaloneTasks,...input.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
 const key=(s:string)=>s.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'').replace(/^如符合条件/u,'')
 const removed=new Set(input.events.filter(e=>tasks.some(t=>/^(?:填写|填报|提交|递交|上传|报名|申请|申报|登记|缴费|领取)$/u.test(t.actionVerb)&&key(e.title)===key(t.actionVerb+t.actionObject))).map(e=>e.tempId))
 if(!removed.size)return input
 const r=structuredClone(input),points=new Set(r.events.filter(e=>removed.has(e.tempId)).flatMap(e=>[e.startTimePointTempId,e.endTimePointTempId]).filter((id):id is string=>Boolean(id)))
 r.events=r.events.filter(e=>!removed.has(e.tempId))
 r.timePoints=r.timePoints.filter(p=>!points.has(p.tempId)||p.relatedTaskTempIds.length>0||p.relatedMaterialTempIds.length>0||r.events.some(e=>e.startTimePointTempId===p.tempId||e.endTimePointTempId===p.tempId))
 return r
}

/** Keep source-declared related actions together without merging their data. */
function attachExplicitSharedGoal(input:RecognitionResult,source:string):RecognitionResult {
 if(input.events.length||input.goalGroups?.length||/互不相关|彼此无关|不属于同/u.test(source))return input
 const claims=[...source.matchAll(/(?:上述|以上|这)?([二两三四五六])(?:项|件事)(?:均|都)?(?:属于|是)同一(?:次|个|项)?([^，,。；;！？\n]{2,20})|(?:二者|两者)(?:均|都)为([^，,。；;！？\n]{2,20})/gu)]
 const tasks=[...input.standaloneTasks,...input.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])].filter(t=>t.selected)
 if(claims.length!==1||tasks.some(t=>!t.actionObject||['查看','核对'].includes(t.actionVerb)))return input
 const claim=claims[0],quote=claim[0],start=claim.index!,declaredTitle=(claim[2]??claim[3]).trim(),count=claim[3]?2:({'二':2,'两':2,'三':3,'四':4,'五':5,'六':6} as Record<string,number>)[claim[1]]
 const heading=source.slice(0,start).split(/[：:\n]/u)[0].trim(),title=heading.length<=40&&heading.endsWith(declaredTitle)&&heading.length>declaredTitle.length?heading:declaredTitle
 if(tasks.length!==count)return input
 if(source.indexOf(quote)!==source.lastIndexOf(quote)||tasks.some(t=>!t.evidenceIds.some(id=>{const e=input.evidence.find(x=>x.id===id);return e&&typeof e.textStart==='number'&&e.textStart<start})))return input
 // The explicitly counted actions must be the clauses immediately preceding
 // the shared-goal statement; an omitted intervening action is ambiguous.
 const prefix=source.slice(0,start)
 const sequences=[/[。；;\n]/u,/[。；;，,\n]/u].map(separators=>prefix.split(separators).map(s=>s.trim()).filter(Boolean).slice(-count))
 const preceding=sequences.find(parts=>{
  if(parts.length!==count)return false
  const matched=tasks.map(t=>parts.flatMap((s,i)=>s.includes(t.actionVerb)&&s.includes(t.actionObject)?[i]:[]))
  return matched.every(indices=>indices.length===1)&&new Set(matched.map(indices=>indices[0])).size===count
 })
 if(!preceding)return input
 const result=structuredClone(input),evidenceId=`local-shared-goal:${start}:evidence`
 result.evidence.push({id:evidenceId,sourceId:input.evidence[0]?.sourceId??'source',quote,quotedText:quote,textStart:start,textEnd:start+quote.length,field:'description',extractionMethod:'parser',confidence:1})
 result.goalGroups=[{id:`local-shared-goal:${start}`,title,taskTempIds:tasks.map(t=>t.tempId),evidenceIds:[evidenceId]}]
 return result
}

const localSectionHeading=/^\s*(?:参加|参与|报名|活动)(?:须知|说明|要求|事项|方式|条件|时间|地点|流程|规则|注意事项)(?:\s*[：:]\s*|\s*$)/u
/** A section label can begin with a verb, but is not an action's object. */
function isLocalSectionHeading(task:TaskSuggestionV2):boolean {
 return localSectionHeading.test(task.title)
}
function removeLocalSectionHeadings(input:RecognitionResult):RecognitionResult {
 const all=[...input.standaloneTasks,...input.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
 // A parser-created “check” placeholder for the event's own descriptive
 // sentence is redundant once that event has been recovered. Preserve an
 // actual instruction to check, register, prepare or submit something.
 const isEventPlaceholder=(t:TaskSuggestionV2)=>t.actionVerb==='核对'&&input.events.some(event=>{
  if(!event.title||!t.actionObject.includes(event.title))return false
  return t.evidenceIds.some(id=>{const quote=input.evidence.find(ref=>ref.id===id)?.quote??'';return quote.includes(t.actionObject)&&quote.includes(event.title)&&!/(?:请|须|需|应|务必)[^。；]{0,25}(?:核对|检查|确认|查看|报名|提交|准备)/u.test(quote)&&event.evidenceIds.some(eventId=>{const cited=input.evidence.find(ref=>ref.id===eventId)?.quote??'';return cited===quote})})
 })
 const removed=new Set(all.filter(t=>isLocalSectionHeading(t)||isEventPlaceholder(t)).map(t=>t.tempId))
 if(!removed.size)return input
 const r=structuredClone(input)
 const keptTasks=(tasks:TaskSuggestionV2[])=>tasks.filter(t=>!removed.has(t.tempId)).map(t=>({...t,dependencyTempIds:t.dependencyTempIds.filter(id=>!removed.has(id))}))
 r.standaloneTasks=keptTasks(r.standaloneTasks)
 r.milestones=r.milestones.map(m=>({...m,tasks:keptTasks(m.tasks),workPackages:m.workPackages.map(w=>({...w,tasks:keptTasks(w.tasks)}))}))
 const eventPoints=new Set(r.events.flatMap(e=>[e.startTimePointTempId,e.endTimePointTempId]))
 r.events=r.events.map(e=>({...e,relatedTaskTempIds:e.relatedTaskTempIds?.filter(id=>!removed.has(id))}))
 r.materials=r.materials.filter(m=>!m.relatedTaskTempIds.length||m.relatedTaskTempIds.some(id=>!removed.has(id))).map(m=>({...m,relatedTaskTempIds:m.relatedTaskTempIds.filter(id=>!removed.has(id))}))
 const materialIds=new Set(r.materials.map(m=>m.tempId))
 r.timePoints=r.timePoints.filter(p=>!p.relatedTaskTempIds.length||p.relatedTaskTempIds.some(id=>!removed.has(id))||eventPoints.has(p.tempId)).map(p=>({...p,relatedTaskTempIds:p.relatedTaskTempIds.filter(id=>!removed.has(id)),relatedMaterialTempIds:p.relatedMaterialTempIds.filter(id=>materialIds.has(id))}))
 return r
}

/** Clarify an already retained generic registration only when one material's
 * existing source span is part of a single explicit, affirmative form action. */
function clarifyOwnedFormAction(base:DirectConversion,source:string):DirectConversion {
 const edits=new Map<string,{verb:string;object:string;quote:string;start:number;sourceId:string}>()
 for(const task of base.result.standaloneTasks){
  if(!/^(?:报名|登记|申请|申报|填写|填报|提交|递交|上传|报送)$/u.test(task.actionVerb))continue
  const owned=base.result.materials.filter(m=>m.required&&m.relatedTaskTempIds.length===1&&m.relatedTaskTempIds[0]===task.tempId&&/(?:表|材料|文件|文档|申请书)$/u.test(m.name))
  if(owned.length!==1)continue
  const material=owned[0],positions=base.result.evidence.flatMap(e=>{
   if(!material.evidenceIds.includes(e.id))return []
   const quote=e.quotedText||e.quote,at=e.textStart
   if(!quote||typeof at!=='number'||source.slice(at,at+quote.length)!==quote)return []
   const within=quote.indexOf(material.name)
   return within>=0?[{at:at+within,sourceId:e.sourceId}]:[]
  })
  if(/^(?:填写|填报|提交|递交|上传|报送)/u.test(task.title.replace(/^如符合条件\s*/u,''))&&task.title.includes(material.name))continue
  const matches=positions.flatMap(position=>{
   const before=source.slice(0,position.at),clauseStart=Math.max(before.lastIndexOf('。'),before.lastIndexOf('！'),before.lastIndexOf('？'),before.lastIndexOf('；'),before.lastIndexOf(';'),before.lastIndexOf('\n'))+1
   const clause=source.slice(clauseStart,position.at),verbs=[...clause.matchAll(/填写|填报|提交|递交|上传|报送/gu)]
   if(verbs.length!==1)return []
   const verb=verbs[0][0],start=clauseStart+verbs[0].index!,between=source.slice(start+verb.length,position.at),prefix=source.slice(clauseStart,start)
   if(between.length>16||/[，,、；;。！？\n]|或者|任选|二选一|例如|比如|并|以及|然后|随后|查看/u.test(between)||/(?:无需|无须|不用|不需要|不必|暂不|请勿|不要|不得|禁止|不再|取消|作废|例如|比如|示例|任选|二选一)/u.test(prefix)||/已(?:经)?\s*$/u.test(prefix))return []
   return [{verb,object:material.name,quote:source.slice(start,position.at+material.name.length),start,sourceId:position.sourceId}]
  })
  if(matches.length===1)edits.set(task.tempId,matches[0])
 }
 if(!edits.size)return base
 const result=structuredClone(base.result)
 for(const task of result.standaloneTasks){
  const edit=edits.get(task.tempId);if(!edit)continue
  const id=`direct-form-action:${task.tempId}:${edit.start}`,context=task.title.trim(),prefix=edit.verb+edit.object
  task.title=context.includes(edit.object)?edit.verb+context:`${prefix}（${context.slice(0,Math.max(0,78-prefix.length))}）`
  task.actionVerb=edit.verb;task.actionObject=edit.object;task.evidenceIds.push(id)
  result.evidence.push({id,sourceId:edit.sourceId,quote:edit.quote,quotedText:edit.quote,textStart:edit.start,textEnd:edit.start+edit.quote.length,field:'description',extractionMethod:'parser',confidence:1})
 }
 return {...base,result}
}
/** Preserve a concrete delivery embedded in a coordinated procedure, such as
 * “登记、上传材料等须登录平台”. The procedure does not make every noun
 * a task. Use its own source span and leave other steps explicitly partial. */
function recoverCoordinatedDelivery(input:RecognitionResult,source:string):RecognitionResult {
 const candidates=[...source.matchAll(/(上传|提交|递交|报送)([\p{Script=Han}\p{Number}]{2,24}?)(?=(?:等|均)?(?:需|须|应|要)(?:先)?(?:登录|登陆|进入|访问))/gu)]
 if(candidates.length!==1)return input
 const match=candidates[0],verb=match[1],object=match[2],at=match.index!
 const existing=[...input.standaloneTasks,...input.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
 if(existing.some(t=>t.actionVerb===verb&&t.actionObject===object))return input
 const before=source.slice(0,at),start=Math.max(before.lastIndexOf('。'),before.lastIndexOf('；'),before.lastIndexOf(';'),before.lastIndexOf('\n'))+1
 const after=source.slice(at),stop=after.search(/[。；;！？\n]/u),end=stop<0?source.length:at+stop
 const quote=source.slice(start,end).trim(),quoteAt=source.indexOf(quote,start)
 if(!quote||quote.length>500||source.lastIndexOf(quote)!==quoteAt||localActionExplicitlyNegated(quote,verb,object))return input
 const prefix=source.slice(start,at)
 if(/(?:讲解|介绍|演示|示范|课程内容|培训内容|例如)[^，,。；;\n]{0,35}$/u.test(prefix)
  ||/(?:^|[，,：:])\s*(?:由)?(?:主办方|组织方|工作人员|负责部门|学院|教师|老师)[^，,。；;\n]{0,20}$/u.test(prefix))return input
 const r=structuredClone(input),id=`local-coordinated:${at}`,eid=id+':evidence',mid=id+':material'
 r.evidence.push({id:eid,sourceId:r.evidence[0]?.sourceId??'source',quote,quotedText:quote,textStart:quoteAt,textEnd:quoteAt+quote.length,field:'description',extractionMethod:'parser',confidence:1})
 r.standaloneTasks.push({tempId:id,parentTempId:null,hierarchyType:'task',title:verb+object,actionVerb:verb,actionObject:object,description:quote,completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[mid],timePointTempIds:[],evidenceIds:[eid],confidence:1,inferenceLevel:'explicit',userConfirmationRequired:true,selected:true})
 r.materials.push({tempId:mid,name:object,required:true,formatRequirements:[],namingRequirements:[],requirements:[],quantity:null,submissionChannel:null,relatedTaskTempIds:[id],evidenceIds:[eid],confidence:1,selected:true})
 r.sourceSummary.requiresAction=true
 const reason='部分内容尚未完整整理：其他步骤及适用条件请查看原通知。'
 r.quality.needsHumanReview=true;r.quality.reviewReasons=[...new Set([...r.quality.reviewReasons,reason])].slice(-20)
 return r
}

function improveLocalActions(input:RecognitionResult,source:string):RecognitionResult {
 const positiveDirective=source.split(/[。！？；;，,\n]/u).some(clause=>/(?:请|须|需|应|务必)[^。；]{0,30}(?:提交|递交|填写|申请|申报|报名|领取|缴费|参加|上传|登记|预约)/u.test(clause)&&!/(?:无需|无须|不用|不必|不得|禁止|请勿|不要|不再)/u.test(clause))
 if(/仅供知悉|仅供参考|请知悉|无需操作|无需办理/u.test(source)&&!positiveDirective){const result=structuredClone(input);const topic=source.split(/[。！？\n]/u).find(line=>line.trim()&&!/^\s*(?:各位同学|同学们)/u.test(line));if(topic)result.sourceSummary.title=cleanDirectTopic(topic);return {...result,standaloneTasks:[],milestones:[]}}
 if(/无需办理|无需操作|仅供知悉/u.test(source)&&!/提交|报名|申请|申报|缴费|领取|上传/u.test(source.replace(/(?:无需|不必|不要|无须)(?:办理|操作|提交|报名|申请|申报|缴费|领取|上传)/gu,''))){const result=structuredClone(input);const topic=source.split(/[。！？\n]/u).find(line=>line.trim()&&!/仅供知悉|无需|无须|不必/u.test(line));if(topic)result.sourceSummary.title=cleanDirectTopic(topic);return {...result,standaloneTasks:[],milestones:[]}}
 const existing=[...input.standaloneTasks,...input.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
 if(existing.some(task=>task.description.split('\n').some(line=>{
  const prefix='后续办理（原文）：',quote=line.startsWith(prefix)?line.slice(prefix.length):''
  return Boolean(quote&&source.includes(quote)&&task.evidenceIds.some(id=>input.evidence.find(ref=>ref.id===id)?.quote===quote))
 })))return structuredClone(input)
 // A source-backed workflow material refers to stable task IDs. Replacing the
 // entire task list with heuristic candidates would orphan those facts and may
 // turn a material name (such as “申请人…”) into a spurious action.
 const taskIds=new Set(existing.map(task=>task.tempId))
 if(input.materials.some(material=>material.goalScope?.taskTempIds.length
   &&material.goalScope.taskTempIds.every(id=>taskIds.has(id))
   &&material.evidenceIds.some(id=>{const quote=input.evidence.find(ref=>ref.id===id)?.quote??'';return quote.includes(material.goalScope!.condition)&&quote.includes(material.name)&&source.includes(quote)})))return structuredClone(input)
 const grounded=existing.filter(t=>/^(?:提交|报送|上传|发送|填写|申请|申报|报名|领取|缴费|参加|完成|撰写)$/u.test(t.actionVerb)&&t.actionObject&&source.includes(t.actionObject)&&!/^的|^至|^到|https?:|\.edu\.|以下|期间|[（(]/u.test(t.actionObject)&&t.title.includes(t.actionVerb)&&!/^查看|^无需|^无须|^不必|待核对/u.test(t.title))
 // Preserve independently grounded multi-action notices and their owner IDs.
 if(grounded.length>1)return recoverCoordinatedDelivery(structuredClone(input),source)
 const r=structuredClone(input),heading=source.split(/[\n。]/u)[0],tasks:TaskSuggestionV2[]=[],sourceId=r.evidence[0]?.sourceId??'source'
 const award=/[“《]([^”》]{2,35}(?:奖学金|助学金)[^”》]{0,12})[”》]/u.exec(source)?.[1]
 const subject=(award&&heading.includes(award)?award:null)??(/《([^》]{2,50})》/u.exec(heading)?.[1]??/([^\s，。；：:]{2,45}(?:奖学金|助学金|项目|招募|报名|申请))/u.exec(heading)?.[1]??'').replace(/^(?:关于开展|关于|各位同学[：:]?)/u,'').replace(/(?:评审工作|评选工作|评定|申请|申报|招募|报名|通知)$/u,'').replace(/系统$/u,'')
 const spans=[...source.matchAll(/[^。！？\n]+/gu)].flatMap(m=>{
  // A semicolon separates independently addressed deliveries, but should not
  // split alternative eligibility cases into separate obligations.
  const clauses=[...m[0].matchAll(/[^；;]+/gu)]
  const deliveries=clauses.filter(c=>localDelivery(c[0])).length
  // An event time and a separately directed submission after a semicolon
  // are also independent; parsing both clocks as one deadline loses scope.
  const eventAndAction=clauses.some(c=>/(?:举行|举办|召开|开设)[^；;]{1,40}/u.test(c[0]))
   &&clauses.some(c=>/(?:请|须|需|应|务必)[^；;]{0,50}(?:提交|递交|上传|填写|报名|申请|预约)/u.test(c[0]))
  const sections=deliveries>1||eventAndAction?clauses:[{0:m[0],index:0}]
  // Split only a connector followed by another explicit verb and object.
  // “并提交至平台” continues the preceding delivery and is not a new object.
  return sections.flatMap(section=>{
   // Keep the existing “，并将…” boundary, then handle the bare “并提交…”
   // form within each part without losing either action's source offsets.
   const legacy=[...section[0].matchAll(/(?:^|(?<=[，,])(?=并(?:将|把)))[^，]*(?:[，,](?!并(?:将|把))[^，]*)*/gu)]
   const pieces=legacy.length>1?legacy:[{0:section[0],index:0}]
   return pieces.flatMap(piece=>{
    // A contrast may negate the first object while explicitly requiring a
    // different one. Give each clause its own polarity and source offsets.
    const contrasts=[...piece[0].matchAll(/[，,](?=(?:但|不过|然而|而)(?:仍|也|请|应|须|需|要|可))/gu)]
    const sectionsAt=[0,...contrasts.map(c=>c.index!+1),piece[0].length]
    return sectionsAt.slice(0,-1).flatMap((sectionStart,index)=>{
     const sectionText=piece[0].slice(sectionStart,sectionsAt[index+1])
     const connectors=[...sectionText.matchAll(/(?:并|以及|同时)(?=(?:提交|递交|报送|上传|发送|填写|登记|领取|缴费|申请|报名)(?!至|到|给|向|于|在|通过)[^，,；;。！？\n]{2})/gu)]
     const positions=[0,...connectors.map(c=>c.index!),sectionText.length]
     return positions.slice(0,-1).map((start,i)=>({text:sectionText.slice(start,positions[i+1]),at:m.index!+section.index!+piece.index!+sectionStart+start})).filter(part=>part.text.trim())
    })
   })
  })
 })
 const cutoff=(q:string)=>{
  const c=q.normalize('NFKC').replace(/\s/gu,'')
  const applicationEnd=/申请|申报|报名/u.test(q)&&/逾期[^。；]{0,20}(?:不再受理|不予受理|不受理)/u.test(source)
  if(/任选|备选|可选择|\d日或/u.test(c)||(!/截止|截至|之前|以前|[日号点分\d]前/u.test(c)&&!applicationEnd))return null
  const parsed=parseDirectSourceTime(applicationEnd?q+'。逾期不再受理':q,{type:'task_deadline',referenceTime:r.createdAt,timezone:'Asia/Shanghai'})
  return parsed.normalizedValue&&!parsed.needsConfirmation?parsed:null
 }
 const allCutoffs=spans.flatMap(s=>{const p=cutoff(s.text);return p?[{...s,p}]:[]})
 const evidence=(text:string,at:number,field:'description'|'deadline')=>{const id=`local-direct:${field}:${at}`;if(!r.evidence.some(e=>e.id===id))r.evidence.push({id,sourceId,quote:text,quotedText:text,textStart:at,textEnd:at+text.length,field,extractionMethod:'parser',confidence:1});return id}
 for(const span of spans){
  // Interpret section headings as labels, not as an object before “须”.
  // Keep q and its original offsets for evidence, deadlines and channel.
  const q=span.text,plain=q.replace(/[（(][^）)]*[）)]/gu,'').replace(localSectionHeading,'')
  if(/仅供知悉|无需办理|无需操作/u.test(q))continue
  const delivery=localDelivery(plain)
  let verb=delivery?.verb,object=delivery?.object?.replace(/交$/u,'')
  const choice=/(?:^|[，,])(?:请|须|需)?(提交|递交|报送|上传|发送)([^，,；;。！？\n]{2,30}?)(?=可任选|可选择|可以选择|任选)/u.exec(plain)
  if(choice&&/或者|二选一|任选|择一/u.test(plain)){verb=choice[1];object=choice[2].trim()}
  const registration=/(?:登录|进入|访问|打开)([^，,；;。！？\n]{1,30}?(?:系统|平台|网站))[^，,；;。！？\n]{0,15}?(?:完成|进行)(报名|登记|申请)/u.exec(plain)
  if(!verb&&registration){verb=registration[2];object=registration[1].replace(/^(?:报名|登记|申请)/u,'')||registration[1]}
  const routed=/(?:平台|系统)(提交|上传|填写)([^，,；;]{2,45})/u.exec(plain)
  if(routed&&(!verb||/申请|报名/u.test(verb))){verb=routed[1];object=routed[2].trim()}
  if(!verb){const m=/(?:请|须|需|应|可|有意|自愿|学生|同学)[^。；]{0,40}?(申请|申报|报名|提交|递交|报送|上传|填写|登记|预约|缴费|领取)\s*([^，,；;：:]{1,55})/u.exec(plain);if(m){verb=m[1];object=m[2].replace(/[（(][^）)]*[）)]/gu,'').replace(/^(?:本次|此次|该项)/u,'').split(/至|到|并|后|前|进行|即可/u)[0].trim()}}
  if(!verb){const m=/^\s*(?:并|以及|同时)(?:请)?(提交|递交|报送|上传|发送|填写|登记|领取|缴费|申请|报名)\s*([^，,；;：:。！？\n]{2,55})/u.exec(plain);if(m){verb=m[1];object=m[2].split(/至|到|给|并|后|前|进行|即可/u)[0].trim()}}
  if(!verb){const m=/(?:^|[，,]|后|分钟)(?:请(?:大家|同学们)?(?:准时)?|需要|须|应|需)?参加([^。；，,]{2,40})/u.exec(plain);if(m&&!/^(?:者|人员|资格|条件|对象)|的同学|的学生/u.test(m[1])){verb='参加';object=m[1].trim()}}
  if(/申请者须|^申请截止|^材料截止|^三、申请截止/u.test(q))continue
  if(!verb&&subject&&/申请|申报|报名/u.test(q)&&/系统|平台|截止|提交|填写|自愿/u.test(q)){verb=/申报/u.test(q)?'申报':'申请';object=subject}
  if(!verb||!object)continue
  if(localActionExplicitlyNegated(q,verb,object))continue
  const actionClause=q.split(/[，,；;]/u).find(c=>c.includes(verb!))??q
  if(/取消|作废|禁止|不得|无需|无须|不必|不再|请勿/u.test(actionClause.replace(/取消[^，。；]{0,10}资格|不得兼得/gu,'')))continue
  if(!registration&&/^(?:至|到|在|于|所需|相关|以下|的材料|申请$|材料$|表$)|系统|[（(]/u.test(object)&&subject){object=subject}
  object=object.replace(/交$/u,'').replace(/(?:截止时间|截止日期|时间为|时间：).*$/u,'').replace(/(?:的通知|有关事项|相关事宜)$/u,'').trim()
  if(object.length<2||object.length>70||!source.includes(object))continue
  if(/^(?:申请|申报|报名)$/u.test(verb)&&subject&&(/^(?:申请|申报|报名|资料|材料|信息|所需)/u.test(object)||object.length>26))object=subject
  if(tasks.some(t=>(t.actionVerb===verb||/申请|申报/u.test(t.actionVerb)&&/申请|申报/u.test(verb!))&&t.actionObject===object))continue
  const id=`local-direct-${span.at}`,eids=[evidence(q,span.at,'description')]
  if(!q.includes(object)&&heading.includes(object))eids.push(evidence(heading,0,'description'))
  const isConditional=/符合|参评|面向|对象|申请条件|自愿|有意|仅限|推荐名额|申请者|本科生|研究生|获得[^，。]{0,20}同学/u.test(source)
  const eligibility=spans.find(s=>/符合|面向|对象|申请条件|自愿|仅限|申请者/u.test(s.text));if(isConditional&&eligibility)eids.push(evidence(eligibility.text,eligibility.at,'description'))
  const taskTitle=registration&&!delivery&&verb===registration[2]?`完成${object}${verb}`:verb+object+(/提交|报送|上传/u.test(verb)&&/奖学金$|助学金$/u.test(object)?'申请材料':'')
  const t:TaskSuggestionV2={tempId:id,parentTempId:null,hierarchyType:'task',title:cleanDirectTopic(taskTitle),actionVerb:verb,actionObject:object,description:q+(isConditional?'\n适用条件待确认：'+(spans.find(s=>/符合|面向|对象|申请条件|自愿|仅限|申请者/u.test(s.text))?.text??q):''),completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:eids,confidence:1,inferenceLevel:'strong_inference',userConfirmationRequired:true,selected:!isConditional}
  const own=cutoff(q),formCutoffs=allCutoffs.filter(s=>/纸质|电子/u.test(object!)&&s.at>span.at&&s.at-span.at<200&&/纸质|电子/u.test(s.text))
  const uniqueCutoff=allCutoffs.length===1?allCutoffs[0]:null
  const between=uniqueCutoff?source.slice(Math.min(uniqueCutoff.at,span.at),Math.max(uniqueCutoff.at,span.at)):''
  // A different, explicitly addressed delivery in a separate sentence does
  // not supply this item's deadline. Preserve references to the same object.
  const cutoffText=uniqueCutoff?.text??''
  const objectAt=cutoffText.indexOf(object)
  const repeatedObject=object.length>=2&&objectAt>=0&&objectAt===cutoffText.lastIndexOf(object)&&/^(?:\s|[，,:：]|须|需|必须|应|于|在|截止)/u.test(cutoffText.slice(objectAt+object.length))
  const sameObject=taskTitle.length>=4&&cutoffText.includes(taskTitle)||repeatedObject
  const separated=uniqueCutoff&&(/[；;]/u.test(between)||/[。！？\r\n]/u.test(between)&&!sameObject&&/(?:提交|递交|上传|报送|发送|填写|登记|领取|缴费)/u.test(cutoffText))
  const unknownOwnTime=/(?:时间|截止|日期).{0,10}(?:另行通知|待通知|待定)|(?:之后|随后|另行).{0,8}(?:提交|办理|递交)/u.test(q)
  let chosen=own?{...span,p:own}:formCutoffs.length===1?formCutoffs[0]:uniqueCutoff&&!separated&&!unknownOwnTime?uniqueCutoff:null
  if(chosen&&/纸质|电子/u.test(object)){
   const fragments=[...chosen.text.matchAll(/[^，,；;]+/gu)].flatMap(m=>{const p=cutoff(m[0]);return p?[{text:m[0],at:chosen!.at+m.index!,p}]:[]})
   if(fragments.length>1&&new Set(fragments.map(f=>f.p.normalizedValue)).size===1)chosen=fragments[0]
  }
  if(chosen&&/申请|申报|报名/u.test(chosen.text)&&!/截止|截至|[日号点分\d]前/u.test(chosen.text)&&/逾期[^。；]{0,20}(?:不再受理|不予受理|不受理)/u.test(source)){chosen.text=source;chosen.at=0}
  if(chosen){const p=chosen.p,tid=id+'-deadline',eid=evidence(chosen.text,chosen.at,'deadline');r.timePoints.push({tempId:tid,type:'task_deadline',rawText:chosen.text,normalizedValue:p.normalizedValue,timezone:p.timezone,isAllDay:p.isAllDay,precision:p.precision,needsConfirmation:false,relatedTaskTempIds:[id],relatedMaterialTempIds:[],evidenceIds:[eid],confidence:1,selected:true});t.timePointTempIds.push(tid)}
  const channel=choice?null:delivery?.channel??localSubmissionChannel(q)
  if(channel||choice){const mid=id+'-material',req=localMaterialRequirements(q);r.materials.push({tempId:mid,name:object,required:true,formatRequirements:req.formats,namingRequirements:req.naming,quantity:null,submissionChannel:channel,relatedTaskTempIds:[id],evidenceIds:eids,confidence:1,selected:true});t.materialTempIds.push(mid)}
  tasks.push(t)
 }
 if(tasks.length){r.standaloneTasks=tasks.filter(t=>!subject||!tasks.some(other=>other!==t&&/申请|申报/u.test(other.actionVerb)&&other.actionObject===subject&&t.actionVerb==='填写'&&!/表|报告|论文/u.test(t.actionObject))).filter(t=>!tasks.some(other=>other!==t&&/提交|报送|上传/u.test(other.actionVerb)&&/申请|申报/u.test(t.actionVerb)&&t.actionObject===other.actionObject&&JSON.stringify(t.timePointTempIds.map(id=>r.timePoints.find(p=>p.tempId===id)?.normalizedValue))===JSON.stringify(other.timePointTempIds.map(id=>r.timePoints.find(p=>p.tempId===id)?.normalizedValue))));r.milestones=[];const ids=new Set(r.standaloneTasks.map(t=>t.tempId));r.materials=r.materials.filter(m=>m.relatedTaskTempIds.some(id=>ids.has(id)));const eventTimes=new Set(r.events.flatMap(e=>[e.startTimePointTempId,e.endTimePointTempId]));r.timePoints=r.timePoints.filter(p=>eventTimes.has(p.tempId)||p.relatedTaskTempIds.some(id=>ids.has(id)));r.sourceSummary.title=tasks[0].title}
 r.standaloneTasks=r.standaloneTasks.filter(t=>!/^无需|^无须|^不必|^不要/u.test(t.title));r.milestones=r.milestones.map(m=>({...m,tasks:m.tasks.filter(t=>!/^无需|^无须|^不必/u.test(t.title))}))
 return recoverCoordinatedDelivery(r,source)
}

/** Fill independently evidenced missing actions without replacing retained
 * AI entities or borrowing their times. The caller records local provenance. */
export function recoverMissingDirectActions(base:DirectConversion,local:RecognitionResult,source:string):DirectConversion {
 const completed=completeNumberedActions(base.result,source)
 if(JSON.stringify(completed)!==JSON.stringify(base.result))base=convertDirectResult(completed,source)
 base=clarifyOwnedFormAction(base,source)
 const candidate=convertDirectResult(improveDirectFallback(local,source),source)
 const key=(value:string)=>value.replace(/\s/gu,'').replace(/^如符合条件/u,'')
 const revision=directEventRevision(source)
 const eventKey=(title:string)=>key(title).replace(/^(?:参加|出席)/u,'')
 const noExistingAction=base.result.standaloneTasks.every(t=>t.actionVerb==='查看')
 const structured=structuredOptionalEvent(source)
 const missingEvents=candidate.result.events.filter(e=>{
  if(base.result.events.some(b=>eventKey(b.title)===eventKey(e.title)))return false
  if(revision&&/请[^。；\n]{0,50}(?:参加|出席)/u.test(revision.sentence)&&e.title===revision.title)return true
  if(!noExistingAction)return false
  if(structured&&!base.result.events.length&&e.title===structured.title&&e.relatedTaskTempIds?.length===1)return true
  const attendance=candidate.result.standaloneTasks.filter(t=>e.relatedTaskTempIds?.includes(t.tempId)&&t.tempId.startsWith('direct-attend:'))
  if(attendance.length!==1)return false
  const name=eventKey(e.title)
  return candidate.result.evidence.filter(x=>e.evidenceIds.includes(x.id)).some(x=>{
   const quote=x.quotedText||x.quote||''
   return quote&&source.includes(quote)&&key(quote).includes(name)&&/请[^。；\n]{0,50}(?:参加|出席)/u.test(quote)&&!/(?:不要|请勿|不得|禁止|取消|不再|不能|不可)[^。；\n]{0,30}(?:参加|出席)/u.test(quote)
  })
 })
 const attendance=missingEvents.flatMap(e=>candidate.result.standaloneTasks.filter(t=>e.relatedTaskTempIds?.includes(t.tempId)))
 const retainedAttendance=new Map(attendance.flatMap(t=>{const matches=base.result.standaloneTasks.filter(b=>b.actionVerb==='参加'&&key(b.actionObject)===key(t.actionObject));return matches.length===1?[[t.tempId,matches[0].tempId] as const]:[]}))
 const missing=candidate.result.standaloneTasks.filter(t=>{
  if(attendance.some(a=>a.tempId===t.tempId))return false
  if(t.actionVerb==='查看'||t.actionVerb==='核对'||t.tempId.startsWith('direct-attend:'))return false
  const hasAction=base.result.standaloneTasks.some(b=>b.actionVerb!=='查看')
  // Preserve the existing complete-loss recovery. Partial completion needs
  // stronger evidence of a separate delivery, not an incidental action word.
  if(!hasAction)return t.tempId.startsWith('local-direct-')
  const quotes=candidate.result.evidence.filter(e=>t.evidenceIds.includes(e.id)).map(e=>e.quotedText||e.quote||'')
  if(!quotes.some(q=>source.includes(q)&&q.includes(t.actionObject)&&q.includes(t.actionVerb)))return false
  if(hasAction){
   if(t.title.startsWith('如符合条件')||/适用条件待确认/u.test(t.description))return false
   if(!/^(?:提交|报送|上传|发送|填写|登记|递交|送交)$/u.test(t.actionVerb))return false
   const own=candidate.result.timePoints.filter(p=>p.relatedTaskTempIds.includes(t.tempId)&&p.normalizedValue),oldTimes=base.result.timePoints.filter(p=>p.relatedTaskTempIds.length&&p.normalizedValue)
   if(!own.length||!oldTimes.length||own.some(p=>oldTimes.some(old=>old.normalizedValue===p.normalizedValue)))return false
   if(!quotes.some(q=>/(?:请|须|需|应)(?:于|在|将|把)/u.test(q)&&q.includes(t.actionVerb)&&q.includes(t.actionObject)))return false
  }
  return !base.result.standaloneTasks.some(b=>b.actionVerb!=='查看'&&(key(b.actionObject)===key(t.actionObject)||key(b.title)===key(t.title)))
   &&!base.result.events.some(e=>t.actionVerb==='参加'&&key(e.title.replace(/^参加/u,''))===key(t.actionObject))
 })
 if(!missing.length&&!missingEvents.length)return base
 const r=structuredClone(base.result),extra=structuredClone(candidate.result),prefix=(id:string)=>'local-completion:'+id
 const tasks=[...missing,...attendance.filter(t=>!retainedAttendance.has(t.tempId))],ids=new Set(tasks.map(t=>t.tempId)),materials=extra.materials.filter(m=>m.relatedTaskTempIds.some(id=>ids.has(id))),materialIds=new Set(materials.map(m=>m.tempId)),eventTimes=new Set(missingEvents.flatMap(e=>[e.startTimePointTempId,e.endTimePointTempId])),times=extra.timePoints.filter(p=>p.relatedTaskTempIds.some(id=>ids.has(id))||eventTimes.has(p.tempId))
 const removed=new Set(r.standaloneTasks.filter(t=>t.tempId==='direct-read-notice').map(t=>t.tempId))
 r.standaloneTasks=r.standaloneTasks.filter(t=>!removed.has(t.tempId))
 r.timePoints=r.timePoints.filter(p=>!p.relatedTaskTempIds.length||p.relatedTaskTempIds.some(id=>!removed.has(id))).map(p=>({...p,relatedTaskTempIds:p.relatedTaskTempIds.filter(id=>!removed.has(id))}))
 r.materials=r.materials.filter(m=>m.relatedTaskTempIds.some(id=>!removed.has(id))).map(m=>({...m,relatedTaskTempIds:m.relatedTaskTempIds.filter(id=>!removed.has(id))}))
 const refs=new Set([...tasks,...materials,...times,...missingEvents].flatMap(x=>x.evidenceIds))
 r.evidence.push(...extra.evidence.filter(e=>refs.has(e.id)).map(e=>({...e,id:prefix(e.id)})))
 r.standaloneTasks.push(...tasks.map(t=>({...t,tempId:prefix(t.tempId),dependencyTempIds:[],evidenceIds:t.evidenceIds.map(prefix),materialTempIds:t.materialTempIds.filter(id=>materialIds.has(id)).map(prefix),timePointTempIds:t.timePointTempIds.map(prefix)})))
 r.materials.push(...materials.map(m=>({...m,tempId:prefix(m.tempId),relatedTaskTempIds:m.relatedTaskTempIds.filter(id=>ids.has(id)).map(prefix),evidenceIds:m.evidenceIds.map(prefix)})))
 r.timePoints.push(...times.map(p=>({...p,tempId:prefix(p.tempId),relatedTaskTempIds:p.relatedTaskTempIds.flatMap(id=>ids.has(id)?[prefix(id)]:retainedAttendance.has(id)?[retainedAttendance.get(id)!]:[]),relatedMaterialTempIds:p.relatedMaterialTempIds.filter(id=>materialIds.has(id)).map(prefix),evidenceIds:p.evidenceIds.map(prefix)})))
 for(const task of r.standaloneTasks)for(const point of r.timePoints)if(point.relatedTaskTempIds.includes(task.tempId)&&!task.timePointTempIds.includes(point.tempId))task.timePointTempIds.push(point.tempId)
 r.events.push(...missingEvents.map(e=>({...e,tempId:prefix(e.tempId),startTimePointTempId:e.startTimePointTempId?prefix(e.startTimePointTempId):null,endTimePointTempId:e.endTimePointTempId?prefix(e.endTimePointTempId):null,relatedTaskTempIds:e.relatedTaskTempIds?.map(id=>retainedAttendance.get(id)??prefix(id)),evidenceIds:e.evidenceIds.map(prefix)})))
 return {result:r,items:[...base.items.filter(i=>!removed.has(i.tempId)),...candidate.items.filter(i=>i.kind==='task'?ids.has(i.tempId):missingEvents.some(e=>e.tempId===i.tempId)).map(i=>({...i,tempId:prefix(i.tempId),tags:[...new Set([...i.tags,'待确认' as const])]}))],omitted:[...base.omitted,{id:'source-actions',reason:'LOCAL_SOURCE_ACTION_COMPLETION_AFTER_AI_ACTION_LOSS'}]}
}
