import {formatSourceWeekdayAlternatives,sourceWeekdayAlternatives} from '../../cloudflare/source-action-weekday.mjs'
import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import {localDelivery} from './localNoticeFacts'
import type {RecognitionResult} from './types'

/** Recover a locally parsed object when its own source quote explicitly
 * places the object before a delivery verb. The action, recipient and time
 * remain owned by that single quoted instruction. */
export function repairLocalDeliveryOwnership(input:RecognitionResult,source:string,zone?:string):RecognitionResult {
 const result=structuredClone(input)
 const tasks=[...result.standaloneTasks,...result.milestones.flatMap(stage=>[...stage.tasks,...stage.workPackages.flatMap(group=>group.tasks)])]
 for(const task of tasks){
  const citations=task.evidenceIds.flatMap(id=>{const ref=result.evidence.find(value=>value.id===id);const quote=ref?.quote??'';const at=source.indexOf(quote);return quote&&at>=0&&at===source.lastIndexOf(quote)?[{quote,at}]:[]})
  const candidates=citations.flatMap(citation=>{const delivery=localDelivery(citation.quote);return delivery&&delivery.verb===task.actionVerb&&(task.actionObject===delivery.object||task.actionObject===task.actionVerb+delivery.object)&&!/(?:无需|无须|不必|不得|禁止|请勿|取消)[^。；;\n]{0,20}(?:提交|递交|上传|发送)/u.test(citation.quote)?[{...citation,delivery}]:[]})
  if(candidates.length!==1)continue
  const {quote,at,delivery}=candidates[0]
  const duplicatedTitle=task.actionObject===task.actionVerb+delivery.object&&task.title===task.actionVerb+task.actionObject
  task.actionObject=delivery.object
  if(duplicatedTitle)task.title=task.actionVerb+delivery.object
  if(/^(?:待核对事项|待确认事项)$/u.test(task.title))task.title=task.actionVerb+delivery.object
  if(task.description==='动作或对象缺少对应来源依据，请核对。')task.description=quote
  // A named, delivered document can be represented as a material without
  // changing the action or turning its recipient into a second task.
  const measure=/^(\d+|一|二|两|三)\s*(页|份|张|本)\s*(.{2,})$/u.exec(delivery.object)
  const name=(measure?.[3]??delivery.object).trim(),quantity=measure?({'一':1,'二':2,'两':2,'三':3}[measure[1]]??Number(measure[1])):null
  if(name&&quote.includes(delivery.object)&&!result.materials.some(material=>material.relatedTaskTempIds.includes(task.tempId))&&result.materials.length<60&&task.materialTempIds.length<20){
   const id=`local-delivery-material:${task.tempId}`
   if(!result.materials.some(material=>material.tempId===id))result.materials.push({tempId:id,name,required:true,formatRequirements:[],namingRequirements:[],requirements:measure?[measure[1]+measure[2]]:[],quantity,submissionChannel:delivery.channel,relatedTaskTempIds:[task.tempId],evidenceIds:[...task.evidenceIds],confidence:task.confidence,selected:true})
   if(!task.materialTempIds.includes(id))task.materialTempIds.push(id)
  }
  const channelLine='提交渠道：'+delivery.channel
  if(!task.description.includes(delivery.channel)&&task.description.length+channelLine.length+1<=800)task.description=[task.description,channelLine].filter(Boolean).join('\n')
  const clauses=[...quote.matchAll(/[^，,。！？；;\n]+/gu)].filter(part=>part[0].includes(delivery.object)&&part[0].includes(delivery.sourceVerb))
  if(clauses.length!==1)continue
  const clause=clauses[0],deadlines=[...clause[0].matchAll(/(?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天]\s*(?:(?:凌晨|早上|上午|中午|下午|傍晚|晚上|夜间)\s*)?(?:\d{1,2}\s*[:：]\s*\d{2})?\s*(?:之前|以前|前)/gu)]
  if(deadlines.length!==1)continue
  const time=deadlines[0],raw=time[0],start=at+clause.index!+time.index!,timezone=zone??result.timePoints.find(point=>point.timezone)?.timezone??'Asia/Shanghai'
  const parsed=parseDirectSourceTime(raw,{type:'task_deadline',referenceTime:result.createdAt,timezone})
  const existing=result.timePoints.filter(point=>point.type==='task_deadline'&&point.relatedTaskTempIds.includes(task.tempId)&&point.normalizedValue)
  if(!parsed.normalizedValue||parsed.needsConfirmation||existing.length>1||existing.some(point=>!raw.replace(/\s/gu,'').startsWith(point.rawText.replace(/\s/gu,'')))||result.evidence.length>=120||task.evidenceIds.length>=20)continue
  const eid=`local-delivery-deadline:${start}`,tid=`local-delivery-time:${start}`
  if(!result.evidence.some(ref=>ref.id===eid))result.evidence.push({id:eid,sourceId:result.evidence[0]?.sourceId??'source',quote:raw,quotedText:raw,textStart:start,textEnd:start+raw.length,field:'deadline',extractionMethod:'parser',confidence:1})
  if(existing.length){
   const point=existing[0]
   point.rawText=raw;point.normalizedValue=parsed.normalizedValue;point.timezone=parsed.timezone;point.isAllDay=parsed.isAllDay;point.precision=parsed.precision;point.needsConfirmation=false
   point.evidenceIds=[...new Set([...point.evidenceIds,eid])]
  }else{
   if(!result.timePoints.some(point=>point.tempId===tid))result.timePoints.push({tempId:tid,type:'task_deadline',rawText:raw,normalizedValue:parsed.normalizedValue,timezone:parsed.timezone,isAllDay:parsed.isAllDay,precision:parsed.precision,needsConfirmation:false,relatedTaskTempIds:[task.tempId],relatedMaterialTempIds:[],evidenceIds:[eid],confidence:1,selected:true})
   if(!task.timePointTempIds.includes(tid))task.timePointTempIds.push(tid)
  }
 }
 return result
}

/** Reparse only a uniquely cited weekday deadline in the same action clause.
 * The source reference time is fixed, and an unrelated sibling's deadline is
 * never borrowed. This repairs local parser timezone or precision errors. */
export function retainLocalOwnedWeekdayDeadlines(input:RecognitionResult,source:string,zone?:string):RecognitionResult {
 const result=structuredClone(input)
 const tasks=[...result.standaloneTasks,...result.milestones.flatMap(stage=>[...stage.tasks,...stage.workPackages.flatMap(group=>group.tasks)])]
 for(const task of tasks){
  if(!task.actionVerb||!task.actionObject)continue
  const candidates=task.evidenceIds.flatMap(id=>{
   const quote=result.evidence.find(value=>value.id===id)?.quote??'',at=source.indexOf(quote)
   if(!quote||at<0||at!==source.lastIndexOf(quote))return []
   return [...quote.matchAll(/[^，,。！？；;\n]+/gu)].flatMap(part=>{
    const clause=part[0]
    if(!clause.includes(task.actionVerb)||!clause.includes(task.actionObject)||/(?:无需|无须|不必|不得|禁止|请勿|取消)[^。；;\n]{0,20}(?:提交|递交|上传|发送|填写)/u.test(clause))return []
    const days=[...clause.matchAll(/(?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天]\s*(?:(?:凌晨|早上|上午|中午|下午|傍晚|晚上|夜间)\s*)?(?:\d{1,2}\s*[:：]\s*\d{2})?\s*(?:之前|以前|前)/gu)]
    if(days.length!==1)return []
    const directive=/(?:请|须|需|应|务必|并在|并于)/u.test(clause)
    const directCommand=clause.replace(/\s/gu,'').startsWith(days[0][0].replace(/\s/gu,'')+task.actionVerb)
    if(!directive&&!directCommand)return []
    const afterDay=clause.slice(days[0].index!+days[0][0].length,clause.indexOf(task.actionVerb))
    if(/(?:审核|评审|复核|通知|汇总|审批|筛选|报送)[^，,。；;\n]{0,20}(?:后|再|之后)/u.test(afterDay))return []
    return [{raw:days[0][0],start:at+part.index!+days[0].index!}]
   })
  })
  const unique=[...new Map(candidates.map(value=>[String(value.start)+':'+value.raw,value])).values()]
  if(unique.length!==1)continue
  const {raw,start}=unique[0],timezone=zone??result.timePoints.find(point=>point.timezone)?.timezone??'Asia/Shanghai'
  const parsed=parseDirectSourceTime(raw,{type:'task_deadline',referenceTime:result.createdAt,timezone})
  const existing=result.timePoints.filter(point=>point.type.endsWith('_deadline')&&point.relatedTaskTempIds.includes(task.tempId)&&point.normalizedValue)
  if(!parsed.normalizedValue||parsed.needsConfirmation||existing.length>1||existing.some(point=>!raw.replace(/\s/gu,'').startsWith(point.rawText.replace(/\s/gu,'')))||result.evidence.length>=120)continue
  const eid=`local-owned-deadline:${start}`,tid=`local-owned-time:${start}`
  if(!result.evidence.some(ref=>ref.id===eid))result.evidence.push({id:eid,sourceId:result.evidence[0]?.sourceId??'source',quote:raw,quotedText:raw,textStart:start,textEnd:start+raw.length,field:'deadline',extractionMethod:'parser',confidence:1})
  if(existing.length){
   const point=existing[0]
   point.rawText=raw;point.normalizedValue=parsed.normalizedValue;point.timezone=parsed.timezone;point.isAllDay=parsed.isAllDay;point.precision=parsed.precision;point.needsConfirmation=false;point.selected=true
   point.evidenceIds=[...new Set([...point.evidenceIds,eid])]
  }else{
   if(!result.timePoints.some(point=>point.tempId===tid))result.timePoints.push({tempId:tid,type:'task_deadline',rawText:raw,normalizedValue:parsed.normalizedValue,timezone:parsed.timezone,isAllDay:parsed.isAllDay,precision:parsed.precision,needsConfirmation:false,relatedTaskTempIds:[task.tempId],relatedMaterialTempIds:[],evidenceIds:[eid],confidence:1,selected:true})
   if(!task.timePointTempIds.includes(tid))task.timePointTempIds.push(tid)
  }
 }
 return result
}

/** Preserve an explicitly linked selection follow-up as conditional source
 * context. It is not a new appointment and never claims that the reader was
 * selected. Ambiguous ownership and multiple potential actions stay unchanged. */
export function retainLocalConditionalFollowup(input:RecognitionResult,source:string,zone?:string):RecognitionResult {
 const tasks=[...input.standaloneTasks,...input.milestones.flatMap(stage=>[...stage.tasks,...stage.workPackages.flatMap(group=>group.tasks)])]
 if(tasks.length!==1||input.events.length||!/^(?:提交|递交|上传|发送|交|申请|报名|填写|核对)$/u.test(tasks[0].actionVerb))return input
 const task=tasks[0],citations=task.evidenceIds.flatMap(id=>{const ref=input.evidence.find(value=>value.id===id);return ref?.quote?[ref.quote]:[]})
 const owners=[...new Map(citations.flatMap(quote=>{const at=source.indexOf(quote);return at>=0&&at===source.lastIndexOf(quote)?[[String(at)+':'+String(at+quote.length),{quote,at,end:at+quote.length}] as const]:[]})).values()]
 const candidates=[...source.matchAll(/[^。！？；;\n]+/gu)].flatMap(part=>{
  const quote=part[0].trim(),at=part.index!+part[0].indexOf(quote)
  if(!/(?:根据|依据|按照)[^，,。；;\n]{0,20}(?:材料|资料|报名信息|申请信息|提交内容)[^。；;\n]{0,30}(?:筛选|选拔|审核)/u.test(quote)||!/(?:部分|若干|一些|入选|通过)/u.test(quote)||/(?:不再|不|未|取消|无需|禁止)(?:再)?(?:筛选|选拔|参加)/u.test(quote))return []
  const days=[...quote.matchAll(/(?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天]/gu)]
  if(days.length!==2)return []
  const suffix=quote.slice(days[1].index!+days[1][0].length),target=/(?:参加|进行|出席|接受|安排)\s*([^，,。；;！？\n]{2,24})/u.exec(suffix)?.[1]?.trim()
  if(!target)return []
  const choice=sourceWeekdayAlternatives(source,{object:target,evidence:[quote]})
  return choice&&source.indexOf(quote)===source.lastIndexOf(quote)?[{quote,at,choice}]:[]
 })
 if(candidates.length!==1)return input
 const candidate=candidates[0],prior=owners.filter(owner=>owner.end<=candidate.at&&candidate.at-owner.end<=180)
 if(prior.length!==1||/(?:另有|另外|此外|与.{0,12}无关)/u.test(source.slice(prior[0].end,candidate.at)+candidate.quote))return input
 const item={actionVerb:task.actionVerb,actionObject:task.actionObject,evidence:citations}
 const timezone=zone??input.timePoints.find(point=>point.timezone)?.timezone??'Asia/Shanghai'
 const formatted=formatSourceWeekdayAlternatives(source,candidate.choice,[item],input.createdAt,timezone)
 const line=`后续安排（筛选后适用）：${candidate.quote}；备选时间：${formatted??candidate.choice.raw+'（日期待确认）'}`
 if(task.description.includes(candidate.quote))return input
 if(task.description.length+line.length+1>800||task.evidenceIds.length>=20||input.evidence.length>=120||candidate.quote.length>500)return input
 const result=structuredClone(input),owner=[...result.standaloneTasks,...result.milestones.flatMap(stage=>[...stage.tasks,...stage.workPackages.flatMap(group=>group.tasks)])][0]
 const id=`local-followup:${candidate.at}`
 if(!result.evidence.some(ref=>ref.id===id))result.evidence.push({id,sourceId:result.evidence[0]?.sourceId??'source',quote:candidate.quote,quotedText:candidate.quote,textStart:candidate.at,textEnd:candidate.at+candidate.quote.length,field:'description',extractionMethod:'parser',confidence:1})
 owner.description=[owner.description,line].filter(Boolean).join('\n');owner.evidenceIds=[...new Set([...owner.evidenceIds,id])]
 return result
}

/** Restore time and place only from an event's uniquely cited personal
 * attendance clause. Attendance selection/eligibility is never changed. */
export function retainLocalCitedAttendance(input:RecognitionResult,source:string,zone?:string):RecognitionResult {
 const result=structuredClone(input)
 for(const event of result.events){
  if(event.sourceStatus==='alternative')continue
  const name=event.title.replace(/^(?:参加|出席)/u,'').trim()
  if(name.length<2)continue
  const candidates=event.evidenceIds.flatMap(id=>{
   const quote=result.evidence.find(ref=>ref.id===id)?.quote??'',at=source.indexOf(quote)
   if(!quote||at<0||at!==source.lastIndexOf(quote))return []
   const matches=[...quote.matchAll(/((?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天]\s*(?:(?:上午|中午|下午|晚上|早上)\s*)?\d{1,2}\s*[:：]\s*\d{2})\s*(?:到|至|在)\s*([^，,。；;！？\n]{2,35}?)(?:参加|出席)\s*([^，,。；;！？\n]{2,30})/gu)]
   return matches.length===1&&matches[0][3].includes(name)&&!/(?:取消|改期|备选|或者|或)/u.test(matches[0][0])?[{quote,at,match:matches[0]}]:[]
  })
  if(candidates.length!==1)continue
  const {at,match}=candidates[0],raw=match[1],location=match[2].trim(),start=at+match.index!+match[0].indexOf(raw)
  const timezone=zone??result.timePoints.find(point=>point.timezone)?.timezone??'Asia/Shanghai',parsed=parseDirectSourceTime(raw,{type:'event_start',referenceTime:result.createdAt,timezone})
  const previous=result.timePoints.find(point=>point.tempId===event.startTimePointTempId)
  if(!parsed.normalizedValue||parsed.needsConfirmation||previous?.normalizedValue&&previous.rawText!==raw||event.location&&event.location!==location||result.evidence.length>=120)continue
  const eid=`local-event-attendance:${start}`,tid=previous?.tempId??`local-event-time:${start}`
  if(!result.evidence.some(ref=>ref.id===eid))result.evidence.push({id:eid,sourceId:result.evidence[0]?.sourceId??'source',quote:raw,quotedText:raw,textStart:start,textEnd:start+raw.length,field:'event',extractionMethod:'parser',confidence:1})
  if(previous){previous.rawText=raw;previous.normalizedValue=parsed.normalizedValue;previous.timezone=parsed.timezone;previous.isAllDay=parsed.isAllDay;previous.precision=parsed.precision;previous.needsConfirmation=false;previous.selected=true;previous.evidenceIds=[...new Set([...previous.evidenceIds,eid])]}
  else result.timePoints.push({tempId:tid,type:'event_start',rawText:raw,normalizedValue:parsed.normalizedValue,timezone:parsed.timezone,isAllDay:parsed.isAllDay,precision:parsed.precision,needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:[eid],confidence:1,selected:true})
  event.startTimePointTempId=tid;event.location=location
  // The date is explicit, but eligibility is a separate unresolved fact.
  if(/(?:入选者|获选者|录取者|被选中者|通过审核者|筛选通过者)/u.test(candidates[0].quote.slice(0,match.index)))event.selected=false
 }
 return result
}

/** Reparse an existing local event's own cited weekday and clock using the
 * fixed source reference time. This never supplies a day from another event. */
export function retainLocalOwnedEventTimes(input:RecognitionResult,source:string,zone?:string):RecognitionResult {
 const result=structuredClone(input)
 for(const event of result.events){
  if(event.sourceStatus==='alternative')continue
  const title=event.title.replace(/^(?:参加|出席)/u,'').trim()
  if(title.length<2||/^(?:两|三|多|\d+)场(?:活动|日程|讲座|会议)[：:]?$/u.test(title))continue
  for(const [id,type] of [[event.startTimePointTempId,'event_start'],[event.endTimePointTempId,'event_end']] as const){
   const point=result.timePoints.find(value=>value.tempId===id&&value.type===type)
   if(!point?.rawText||!/(?:(?:周|星期|礼拜)[一二三四五六日天]|\d{1,2}月\d{1,2}[日号])/u.test(point.rawText))continue
   const clauses=event.evidenceIds.flatMap(eid=>{
    const quote=result.evidence.find(ref=>ref.id===eid)?.quote??''
    if(!quote||source.indexOf(quote)<0||source.indexOf(quote)!==source.lastIndexOf(quote))return []
    return [...quote.matchAll(/[^，,。！？；;\n]+/gu)].map(match=>match[0]).filter(clause=>clause.includes(title)&&clause.includes(point.rawText)&&!/(?:取消|作废|改期|延期|更正|变更|备选|或者|或)/u.test(clause))
   })
   if(new Set(clauses).size!==1)continue
   const parsed=parseDirectSourceTime(point.rawText,{type,referenceTime:result.createdAt,timezone:zone??point.timezone??'Asia/Shanghai'})
   const value=type==='event_end'&&parsed.rangeEndNormalizedValue?parsed.rangeEndNormalizedValue:parsed.normalizedValue
   if(!value||parsed.needsConfirmation||parsed.dateKind==='none')continue
   point.normalizedValue=value;point.timezone=parsed.timezone;point.isAllDay=parsed.isAllDay;point.precision=parsed.precision;point.needsConfirmation=false;point.selected=true
  }
  const start=result.timePoints.find(point=>point.tempId===event.startTimePointTempId&&point.type==='event_start')
  if(event.endTimePointTempId||!start?.normalizedValue||result.evidence.length>=120)continue
  const ranges=event.evidenceIds.flatMap(eid=>{
   const quote=result.evidence.find(ref=>ref.id===eid)?.quote??'',quoteAt=source.indexOf(quote)
   if(!quote||quoteAt<0||quoteAt!==source.lastIndexOf(quote))return []
   return [...quote.matchAll(/[^，,。！？；;\n]+/gu)].flatMap(part=>{
    const clause=part[0]
    if(!clause.includes(title)||/(?:取消|作废|改期|延期|更正|变更|备选|或者|或)/u.test(clause))return []
    const found=[...clause.matchAll(/(?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天]\s*(?:(?:凌晨|早上|上午|中午|下午|傍晚|晚上)\s*)?\d{1,2}[:：][0-5]\d\s*[-—–至到]\s*(?:(?:凌晨|早上|上午|中午|下午|傍晚|晚上)\s*)?\d{1,2}[:：][0-5]\d/gu)]
    return found.length===1?[{raw:found[0][0],at:quoteAt+part.index!+found[0].index!}]:[]
   })
  })
  const unique=[...new Map(ranges.map(range=>[`${range.at}:${range.raw}`,range])).values()]
  if(unique.length!==1)continue
  const range=unique[0],parsed=parseDirectSourceTime(range.raw,{type:'event_start',referenceTime:result.createdAt,timezone:zone??start.timezone??'Asia/Shanghai'})
  if(parsed.needsConfirmation||parsed.normalizedValue!==start.normalizedValue||!parsed.rangeEndNormalizedValue||parsed.rangeEndNormalizedValue<=parsed.normalizedValue)continue
  const eid=`local-event-range:${range.at}`,tid=eid+':end'
  result.evidence.push({id:eid,sourceId:result.evidence[0]?.sourceId??'source',quote:range.raw,quotedText:range.raw,textStart:range.at,textEnd:range.at+range.raw.length,field:'event',extractionMethod:'parser',confidence:1})
  result.timePoints.push({tempId:tid,type:'event_end',rawText:range.raw,normalizedValue:parsed.rangeEndNormalizedValue,timezone:parsed.timezone,isAllDay:parsed.isAllDay,precision:parsed.precision,needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:[eid],confidence:1,selected:true})
  event.endTimePointTempId=tid
 }
 return result
}

/** An explicit discourse boundary can introduce a second independent
 * directive to the same addressee. Preserve its own object and cutoff; it
 * is not evidence for merging goals or inheriting the first deadline. */
export function retainLocalSeparateDirective(input:RecognitionResult,source:string,zone?:string):RecognitionResult {
 const tasks=[...input.standaloneTasks,...input.milestones.flatMap(stage=>[...stage.tasks,...stage.workPackages.flatMap(group=>group.tasks)])]
 if(!tasks.length||input.events.length||input.evidence.length>117||input.standaloneTasks.length>=20)return input
 const pieces=[...source.matchAll(/(?:^|[。！？\n])\s*(?:另外|此外)[，,]\s*([^。！？；;\n]+)/gu)]
 if(pieces.length!==1)return input
 const part=pieces[0],quote=part[1].trim(),at=part.index!+part[0].lastIndexOf(quote),prior=source.slice(0,part.index!)
 if(!/(?:请|须|需|应|务必)[^。！？\n]{0,45}(?:提交|递交|填写|上传|交|申请|领取|归还|缴费)/u.test(prior)||/(?:无需|无须|不必|不要|不得|禁止|取消|另行通知|待定|如果|若|例如)/u.test(quote))return input
 const match=/^(?:请|须|需|应|务必)?\s*((?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天]\s*(?:(?:早上|上午|中午|下午|晚上)\s*)?(?:\d{1,2}[:：]\d{2})?\s*(?:之前|以前|前))?\s*(归还|缴清|提交|递交|上传|领取)\s*([^，,。；;！？\n]{2,40})$/u.exec(quote)
 if(!match||tasks.some(task=>task.actionVerb===match[2]&&task.actionObject===match[3].trim()))return input
 const [,raw,verb,objectText]=match,object=objectText.trim()
 if(!object||/(?:老师|学院|组织方|工作人员)(?:负责|将|会)/u.test(quote))return input
 const result=structuredClone(input),id=`local-separate:${at}`,eid=id+':evidence',tid=id+':deadline',sourceId=result.evidence[0]?.sourceId??'source'
 result.evidence.push({id:eid,sourceId,quote,quotedText:quote,textStart:at,textEnd:at+quote.length,field:'description',extractionMethod:'parser',confidence:1})
 const parsed=raw?parseDirectSourceTime(raw,{type:'task_deadline',referenceTime:result.createdAt,timezone:zone??result.timePoints.find(point=>point.timezone)?.timezone??'Asia/Shanghai'}):null
 const hasTime=Boolean(parsed?.normalizedValue&&!parsed.needsConfirmation)
 result.standaloneTasks.push({tempId:id,parentTempId:null,hierarchyType:'task',title:verb+object,actionVerb:verb,actionObject:object,description:quote,completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:hasTime?[tid]:[],evidenceIds:[eid],confidence:1,inferenceLevel:'explicit',userConfirmationRequired:false,selected:true})
 if(hasTime&&raw&&parsed)result.timePoints.push({tempId:tid,type:'task_deadline',rawText:raw,normalizedValue:parsed.normalizedValue,timezone:parsed.timezone,isAllDay:parsed.isAllDay,precision:parsed.precision,needsConfirmation:false,relatedTaskTempIds:[id],relatedMaterialTempIds:[],evidenceIds:[eid],confidence:1,selected:true})
 return result
}

/** Preserve structured recruitment descriptions as source context, not as
 * separate obligations. Only one cited registration task may own the section. */
export function retainLocalRecruitmentGroups(input:RecognitionResult,source:string):RecognitionResult {
 const tasks=[...input.standaloneTasks,...input.milestones.flatMap(stage=>[...stage.tasks,...stage.workPackages.flatMap(group=>group.tasks)])]
 if(tasks.length!==1||input.events.length||!/^(?:填写|填报|报名|申请|登记)$/u.test(tasks[0].actionVerb)||!/(?:报名|申请|登记)/u.test(tasks[0].actionObject))return input
 const task=tasks[0],refs=task.evidenceIds.flatMap(id=>{const quote=input.evidence.find(ref=>ref.id===id)?.quote??'',at=source.indexOf(quote);return quote&&at>=0&&at===source.lastIndexOf(quote)?[{quote,at}]:[]})
 if(!refs.length)return input
 const before=source.slice(0,Math.min(...refs.map(ref=>ref.at))),matches=[...before.matchAll(/[^。！？\n]+/gu)].flatMap(part=>{
  const groups=[...part[0].matchAll(/(?:^|[；;，,、\s】])\s*([\p{Script=Han}]{1,8}组)/gu)]
  if(new Set(groups.map(group=>group[1])).size<2||[...part[0].matchAll(/(?:\d+|若干|数)人/gu)].length<2)return []
  const start=part.index!+groups[0].index!+groups[0][0].lastIndexOf(groups[0][1]),quote=source.slice(start,part.index!+part[0].length).trim()
  return /招募|招聘|征集/u.test(source.slice(0,start))&&quote&&source.indexOf(quote)===source.lastIndexOf(quote)?[{quote,start}]:[]
 })
 if(matches.length!==1||task.description.includes(matches[0].quote))return input
 const {quote,start}=matches[0],line='岗位说明：'+quote
 if(quote.length>500||task.description.length+line.length+1>800||task.evidenceIds.length>=20||input.evidence.length>=120)return input
 const result=structuredClone(input),owner=[...result.standaloneTasks,...result.milestones.flatMap(stage=>[...stage.tasks,...stage.workPackages.flatMap(group=>group.tasks)])][0],id=`local-recruitment-groups:${start}`
 if(!result.evidence.some(ref=>ref.id===id))result.evidence.push({id,sourceId:result.evidence[0]?.sourceId??'source',quote,quotedText:quote,textStart:start,textEnd:start+quote.length,field:'description',extractionMethod:'parser',confidence:1})
 owner.description=[owner.description,line].filter(Boolean).join('\n');owner.evidenceIds=[...new Set([...owner.evidenceIds,id])]
 return result
}

/** Keep an explicit post-registration action and a source-dated recruitment
 * event linked without claiming that the applicant was accepted. */
export function retainLocalRecruitmentFlow(input:RecognitionResult,source:string,zone?:string):RecognitionResult {
 const tasks=[...input.standaloneTasks,...input.milestones.flatMap(stage=>[...stage.tasks,...stage.workPackages.flatMap(group=>group.tasks)])]
 if(tasks.length!==1||input.events.length||!/^(?:填写|填报|报名|申请|登记)$/u.test(tasks[0].actionVerb)||!/(?:报名|申请|登记)/u.test(tasks[0].actionObject))return input
 const heading=/^\s*【([^】\n]{2,60}?(?:志愿者|工作人员)(?:招募|招聘|征集)(?:通知)?)】/u.exec(source)
 if(!heading)return input
 const parent=tasks[0],quotes=parent.evidenceIds.flatMap(id=>{const quote=input.evidence.find(ref=>ref.id===id)?.quote??'';const at=source.indexOf(quote);return quote&&at>=0&&at===source.lastIndexOf(quote)?[{quote,at}]:[]})
 const followups=quotes.flatMap(ref=>[...ref.quote.matchAll(/(?:提交|报名|填写)(?:完成|完毕)?后\s*(加入|进入)\s*([\p{Script=Han}]{2,20}群)/gu)].map(match=>({ref,match})))
 const distinct=[...new Map(followups.map(value=>[String(value.ref.at+value.match.index!),value])).values()]
 const result=structuredClone(input),owner=[...result.standaloneTasks,...result.milestones.flatMap(stage=>[...stage.tasks,...stage.workPackages.flatMap(group=>group.tasks)])][0]
 const related=[owner.tempId]
 if(distinct.length===1){
  const {ref,match}=distinct[0],start=ref.at+match.index!,before=source.slice(Math.max(ref.at,start-12),start)
  if(!/(?:无需|无须|不必|不要|不得|禁止|取消)/u.test(before)&&result.standaloneTasks.length<20&&result.evidence.length<119){
   const id=`local-recruitment-step:${start}`,eid=id+':evidence',quote=match[0],target=match[2]
   if(!result.evidence.some(item=>item.id===eid))result.evidence.push({id:eid,sourceId:result.evidence[0]?.sourceId??'source',quote,quotedText:quote,textStart:start,textEnd:start+quote.length,field:'description',extractionMethod:'parser',confidence:1})
   if(!result.standaloneTasks.some(task=>task.tempId===id))result.standaloneTasks.push({tempId:id,parentTempId:null,hierarchyType:'task',title:match[1]+target,actionVerb:match[1],actionObject:target,description:quote,completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[owner.tempId],materialTempIds:[],timePointTempIds:[],evidenceIds:[eid],confidence:1,inferenceLevel:'explicit',userConfirmationRequired:false,selected:true})
   related.push(id)
  }
 }
 const times=[...source.matchAll(/活动时间(?:为|[:：])?\s*((?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天])\s*[，,；;]\s*(?:活动)?地点(?:为|[:：])?\s*([^，,。；;！？\n]{2,35})/gu)]
 const conditions=[...source.matchAll(/报名不代表[^。；;\n]{0,20}(?:录取|入选)/gu)]
 if(times.length!==1||conditions.length!==1||result.evidence.length>117)return result
 const time=times[0],condition=conditions[0],raw=time[1],location=time[2].trim(),start=time.index!+time[0].indexOf(raw),timezone=zone??result.timePoints.find(point=>point.timezone)?.timezone??'Asia/Shanghai'
 if(/(?:取消|改期|延期|待定|另行通知)/u.test(time[0])||source.indexOf(time[0])!==source.lastIndexOf(time[0]))return result
 const parsed=parseDirectSourceTime(raw,{type:'event_start',referenceTime:result.createdAt,timezone})
 const title=heading[1].replace(/(?:志愿者|工作人员)(?:招募|招聘|征集)(?:通知)?$/u,'').trim()
 if(title.length<2||!parsed.normalizedValue||parsed.needsConfirmation)return result
 const sourceId=result.evidence[0]?.sourceId??'source',head='【'+heading[1]+'】',headAt=source.indexOf(head),timeId=`local-recruitment-time:${start}`,eventId=`local-recruitment-event:${start}`
 const values=[{id:eventId+':heading',quote:head,at:headAt},{id:eventId+':schedule',quote:time[0],at:time.index!},{id:eventId+':condition',quote:condition[0],at:condition.index!}]
 for(const value of values)if(!result.evidence.some(ref=>ref.id===value.id))result.evidence.push({id:value.id,sourceId,quote:value.quote,quotedText:value.quote,textStart:value.at,textEnd:value.at+value.quote.length,field:'event',extractionMethod:'parser',confidence:1})
 result.timePoints.push({tempId:timeId,type:'event_start',rawText:raw,normalizedValue:parsed.normalizedValue,timezone:parsed.timezone,isAllDay:parsed.isAllDay,precision:parsed.precision,needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:[eventId+':schedule'],confidence:1,selected:true})
 result.events.push({tempId:eventId,title,description:'参加状态待确认：'+condition[0],startTimePointTempId:timeId,endTimePointTempId:null,location,relatedTaskTempIds:related,evidenceIds:values.map(value=>value.id),confidence:1,inferenceLevel:'explicit',selected:false})
 return result
}

/** A specific named goal plus an explicit joint-completion statement can
 * organize independently cited steps without inventing a prerequisite. */
export function retainLocalJointGoal(input:RecognitionResult,source:string):RecognitionResult {
 const tasks=[...input.standaloneTasks,...input.milestones.flatMap(stage=>[...stage.tasks,...stage.workPackages.flatMap(group=>group.tasks)])]
 if(tasks.length!==2||input.goalGroups?.length||/(?:互不相关|彼此无关|分别独立|不属于同)/u.test(source))return input
 const heading=/^\s*【([^】\n]{4,60})】/u.exec(source)
 if(!heading||/^(?:通知|活动通知|事项安排|本周安排|其他事项|任务安排)$/u.test(heading[1]))return input
 const claims=[...source.matchAll(/两项(?:均|都)(?:须|需|应|要|必须)(?:完成|办理|提交)/gu)]
 if(claims.length!==1)return input
 const claim=claims[0],at=claim.index!,before=source.slice(0,at),start=Math.max(before.lastIndexOf('。'),before.lastIndexOf('！'),before.lastIndexOf('？'),before.lastIndexOf('\n'))+1,scope=source.slice(start,at)
 if(/(?:另请|另外|此外|另一(?:件|项|个))/u.test(scope)||!/(?:申请者|报名者|参与者|参赛者|申请人|报名人)(?:请|须|需|应)/u.test(scope))return input
 const supported=tasks.every(task=>task.actionVerb&&task.actionObject&&scope.includes(task.actionObject)&&task.evidenceIds.some(id=>{
  const quote=input.evidence.find(ref=>ref.id===id)?.quote??''
  return quote&&source.indexOf(quote)>=0&&source.indexOf(quote)===source.lastIndexOf(quote)&&quote.includes(task.actionVerb)&&quote.includes(task.actionObject)
 }))
 if(!supported||input.evidence.length>118)return input
 const result=structuredClone(input),sourceId=result.evidence[0]?.sourceId??'source',headingStart=heading.index!+heading[0].indexOf('【'),headingQuote='【'+heading[1]+'】',h='local-joint-goal:'+headingStart,c='local-joint-claim:'+at
 if(!result.evidence.some(ref=>ref.id===h))result.evidence.push({id:h,sourceId,quote:headingQuote,quotedText:headingQuote,textStart:headingStart,textEnd:headingStart+headingQuote.length,field:'description',extractionMethod:'parser',confidence:1})
 if(!result.evidence.some(ref=>ref.id===c))result.evidence.push({id:c,sourceId,quote:claim[0],quotedText:claim[0],textStart:at,textEnd:at+claim[0].length,field:'description',extractionMethod:'parser',confidence:1})
 result.goalGroups=[{id:'local-joint-goal:'+at,title:heading[1],taskTempIds:tasks.map(task=>task.tempId),evidenceIds:[h,c]}]
 return result
}

/** Apply a uniquely cited correction to the place of one named event. When
 * the same sentence explicitly keeps its time, also retain an otherwise
 * missing, unambiguous weekday clock from that sentence. */
export function retainLocalLocationCorrection(input:RecognitionResult,source:string,zone?:string):RecognitionResult {
 if(input.events.length!==1||input.events[0].sourceStatus==='alternative')return input
 const event=input.events[0]
 if(!event.location||!event.title)return input
 const candidates=[...source.matchAll(/[^。！？\n]+/gu)].flatMap(part=>{
  const quote=part[0].trim(),at=part.index!+part[0].indexOf(quote)
  const changes=[...quote.matchAll(/(?:现(?:已)?\s*)?(?:(?:更正|变更|调整|修改)(?:活动)?(?:地点|地址)|(?:活动)?(?:地点|地址)(?:更正|变更|调整|修改))(?:为|至|到)\s*([^，,；;。！？\n]{2,50})/gu)]
  if(changes.length!==1||!quote.includes(event.title)||!quote.slice(0,changes[0].index).includes(event.location!)||source.indexOf(quote)!==source.lastIndexOf(quote))return []
  if([...quote.matchAll(/举行|举办|召开|开展/gu)].length!==1||/(?:或者|任选|二选一|取消|日期待定)/u.test(changes[0][1]))return []
  return [{quote,at,location:changes[0][1].trim()}]
 })
 if(candidates.length!==1||candidates[0].location===event.location)return input
 const change=candidates[0],existing=event.evidenceIds.find(id=>{const ref=input.evidence.find(value=>value.id===id);return ref?.quote===change.quote})
 if(!existing&&(event.evidenceIds.length>=20||input.evidence.length>=120||change.quote.length>500))return input
 const result=structuredClone(input),updated=result.events[0],id=existing??`local-location:${change.at}`
 if(!existing)result.evidence.push({id,sourceId:result.evidence[0]?.sourceId??'source',quote:change.quote,quotedText:change.quote,textStart:change.at,textEnd:change.at+change.quote.length,field:'event',extractionMethod:'parser',confidence:1})
 updated.location=change.location;updated.evidenceIds=[...new Set([...updated.evidenceIds,id])]
 const oldTime=result.timePoints.find(point=>point.tempId===updated.startTimePointTempId)
 if(/时间(?:保持)?不变/u.test(change.quote)){
  const before=change.quote.slice(0,change.quote.indexOf(updated.title)),matches=[...before.matchAll(/(?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天]\s*(?:(?:凌晨|早上|上午|中午|下午|傍晚|晚上)\s*)?\d{1,2}\s*[:：]\s*\d{2}/gu)]
  if(matches.length===1&&result.evidence.length<120&&(!oldTime?.normalizedValue||oldTime.rawText.replace(/\s/gu,'')===matches[0][0].replace(/\s/gu,''))){
   const match=matches[0],raw=match[0],start=change.at+match.index!,timezone=zone??oldTime?.timezone??'Asia/Shanghai'
   const parsed=parseDirectSourceTime(raw,{type:'event_start',referenceTime:result.createdAt,timezone})
   if(parsed.normalizedValue&&!parsed.needsConfirmation){
    const eid=`local-corrected-time:${start}`,tid=oldTime?.tempId??`local-corrected-point:${start}`
    if(!result.evidence.some(ref=>ref.id===eid))result.evidence.push({id:eid,sourceId:result.evidence[0]?.sourceId??'source',quote:raw,quotedText:raw,textStart:start,textEnd:start+raw.length,field:'event',extractionMethod:'parser',confidence:1})
    if(oldTime){oldTime.rawText=raw;oldTime.normalizedValue=parsed.normalizedValue;oldTime.timezone=parsed.timezone;oldTime.isAllDay=parsed.isAllDay;oldTime.precision=parsed.precision;oldTime.needsConfirmation=false;oldTime.selected=true;oldTime.evidenceIds=[...new Set([...oldTime.evidenceIds,eid])]}
    else result.timePoints.push({tempId:tid,type:'event_start',rawText:raw,normalizedValue:parsed.normalizedValue,timezone:parsed.timezone,isAllDay:parsed.isAllDay,precision:parsed.precision,needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:[eid],confidence:1,selected:true})
    updated.startTimePointTempId=tid
   }
  }
 }
 return result
}
