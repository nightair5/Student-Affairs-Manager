import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import type {RecognitionResult,TimePointSuggestionV2} from './types'
import {localEventLocation} from './localNoticeFacts'
import {localOrganizerOnlyEvent} from './localActionPolarity'

/** A dated sentence with one explicit venue and held event can stand on its
 * own. Multiple candidates or deadline/cancellation language remain with the
 * ordinary parser, which must not guess which fact belongs to which event. */
function recoverDatedEvent(input:RecognitionResult,source:string):RecognitionResult {
 const candidates=[...source.matchAll(/[^。！？\n]+/gu)].flatMap(m=>{
  const quote=m[0].trim(),location=localEventLocation(quote),dates=[...quote.matchAll(/(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]/gu)]
  if(!location||localOrganizerOnlyEvent(quote,location.name)||dates.length!==1||/取消|改期|延期|备选|任选|截止|报名|提交|上传|曾于|曾在|曾经|往年|历届|此前|去年|历史上/u.test(quote)||quote.length>160||source.indexOf(quote)!==source.lastIndexOf(quote))return []
  const parsed=parseDirectSourceTime(quote,{type:'event_start',referenceTime:input.createdAt,timezone:'Asia/Shanghai'})
  return parsed.normalizedValue&&!parsed.needsConfirmation?[{quote,location,parsed}]:[]
 })
 if(candidates.length!==1)return input
 const {quote,location,parsed}=candidates[0],r=structuredClone(input),at=source.indexOf(quote),id='local-dated-event',eid=id+':evidence',start=id+':start',end=parsed.rangeEndNormalizedValue?id+':end':null
 r.evidence.push({id:eid,sourceId:r.evidence[0]?.sourceId??'source',quote,quotedText:quote,textStart:at,textEnd:at+quote.length,field:'event',extractionMethod:'parser',confidence:1})
 const heading=/^\s*【([^】\n]{2,60})】/u.exec(source),headingTitle=heading?.[1].trim(),headingId=id+':heading'
 const useHeading=Boolean(headingTitle&&headingTitle.includes(location.name)&&source.indexOf(heading![0])===source.lastIndexOf(heading![0]))
 if(useHeading)r.evidence.push({id:headingId,sourceId:r.evidence[0]?.sourceId??'source',quote:heading![0],quotedText:heading![0],textStart:0,textEnd:heading![0].length,field:'event',extractionMethod:'parser',confidence:1})
 const point=(tempId:string,type:'event_start'|'event_end',normalizedValue:string):TimePointSuggestionV2=>({tempId,type,rawText:quote,normalizedValue,timezone:parsed.timezone,isAllDay:parsed.isAllDay,precision:parsed.precision,needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:[eid],confidence:1,selected:true})
 r.timePoints.push(point(start,'event_start',parsed.normalizedValue!))
 if(end&&parsed.rangeEndNormalizedValue)r.timePoints.push(point(end,'event_end',parsed.rangeEndNormalizedValue))
 r.events.push({tempId:id,title:useHeading?headingTitle!:location.name,description:quote,location:location.location,startTimePointTempId:start,endTimePointTempId:end,evidenceIds:useHeading?[headingId,eid]:[eid],confidence:1,inferenceLevel:'explicit',selected:true,relatedTaskTempIds:[]})
 return r
}

/** Resolve the heading and its unique labelled schedule as one local event.
 * Field labels are not event titles. Multiple schedules and corrections stay
 * with the separate-session/revision paths rather than being merged here. */
export function recoverLabeledLocalEvent(input:RecognitionResult,source:string):RecognitionResult {
 if(/(?:活动|会议|讲座|培训|宣讲会)[^。；\n]{0,15}(?:取消|不再举办)|(?:原定|改期|延期|更正为)/u.test(source))return input
 const heading=/^\s*[\p{Extended_Pictographic}\uFE0F\u200D\s]*(?:【([^】\n]{3,60})】|(?:(?:活动|讲座|报告|会议|分享|培训)?(?:主题|名称))[：:]\s*([^\r\n]{3,80}))/u.exec(source)
 const headingText=heading?.[1]??heading?.[2]??''
 const fields=[...source.matchAll(/(?:^|\n)[ \t]*(?:【([^】\n]{1,20})】|([^：:\n]{1,20})[：:])[ \t]*[：:]?[ \t]*([^\r\n]*)/gu)].map(m=>({label:(m[1]??m[2]).replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D]+/gu,'').trim(),value:m[3].trim(),whole:m[0].trim(),at:m.index!+m[0].indexOf(m[0].trim())}))
 const eventField=/^(?:(?:活动|会议|宣讲|分享|讲座|培训|报告|参会|参观|举办|举行))?时间$/u
 const placeField=/^(?:(?:活动|会议|宣讲|分享|讲座|培训|报告|参会|参观|举办|举行))?地点$/u
 const times=fields.filter(f=>eventField.test(f.label)&&f.value),places=fields.filter(f=>placeField.test(f.label)&&f.value)
 const explicitActivity=times.length===1&&times[0].label==='活动时间'&&places.length===1&&places[0].label==='活动地点'
 if(!heading||times.length!==1||places.length>1||!explicitActivity&&!/(?:讲座|培训|实训|报告|论坛|研讨|交流|会议|分享|沙龙|宣讲|活动|开放日|招聘会|会$)/u.test(headingText))return input.events.length?input:recoverDatedEvent(input,source)
 const title=headingText.replace(/^\s*(?:(?:\d{4}年)?\d{1,2}月\d{1,2}[日号])\s*[|｜]\s*/u,'').trim(),time=times[0].value,location=places[0]?.value??null
 const parsed=parseDirectSourceTime(time,{type:'event_start',referenceTime:input.createdAt,timezone:'Asia/Shanghai'})
 if(!title||location&&location.length>160)return input
 const resolved=Boolean(parsed.normalizedValue&&!parsed.needsConfirmation)
 const r=structuredClone(input),sourceId=r.evidence[0]?.sourceId??'source',eid='local-labelled-event',timeId=eid+':start',start=times[0].at+times[0].whole.indexOf(time)
 if(!resolved){const reason='活动部分内容尚未完整整理，请核对原文';if(!r.quality.reviewReasons.includes(reason))r.quality.reviewReasons.push(reason);r.quality.needsHumanReview=true}
 const squash=(s:string)=>s.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'')
 const previous=r.events.filter(event=>{
  const name=squash(event.title.replace(/^(?:活动|讲座|报告|会议|分享|培训)?(?:主题|名称)[：:]/u,'')),matchesTitle=name===squash(title)
  const fieldTitle=/^【?(?:(?:活动|会议|宣讲|分享|讲座|培训|报告))?(?:时间|地点)】?/u.test(event.title.trim())
  const peoplePlaceholder=/^(?:(?:参加|出席|参加者|参与者)|(?:参加|参与).{1,20}(?:的同学|的学生|的人员))$/u.test(event.title.trim())
  const citesField=event.evidenceIds.some(id=>{const ref=r.evidence.find(e=>e.id===id),quote=ref?.quotedText||ref?.quote||'';return quote.includes(times[0].whole)||times[0].whole.includes(quote)&&quote.length>3||Boolean(places[0]&&quote.includes(places[0].whole))})
  return matchesTitle||fieldTitle&&citesField||peoplePlaceholder&&citesField
 })
 const previousIds=new Set(previous.map(e=>e.tempId)),placeholderPoints=new Set(previous.flatMap(e=>[e.startTimePointTempId,e.endTimePointTempId]).filter(Boolean))
 r.events=r.events.filter(e=>!previousIds.has(e.tempId))
 r.timePoints=r.timePoints.filter(p=>!placeholderPoints.has(p.tempId)||p.relatedTaskTempIds.length>0||p.relatedMaterialTempIds.length>0||r.events.some(e=>e.startTimePointTempId===p.tempId||e.endTimePointTempId===p.tempId))
 // A heading or an activity-description sentence is not an independent task.
 // Preserve any source-backed instruction to perform an action.
 const placeholder=(task:{tempId:string;evidenceIds:string[];actionVerb:string;actionObject:string})=>task.tempId.startsWith('task-')&&task.evidenceIds.some(id=>{
  const quote=r.evidence.find(e=>e.id===id)?.quotedText??''
  const directed=quote.split(/[。！？；;\n]/u).some(clause=>/(?:请|须|需|应|务必|必须|建议|记得)/u.test(clause)&&Boolean(task.actionVerb&&task.actionObject&&clause.includes(task.actionVerb)&&clause.includes(task.actionObject)))
  return quote.includes(heading[0].trim())&&!directed
 })
 r.standaloneTasks=r.standaloneTasks.filter(t=>!placeholder(t))
 r.milestones=r.milestones.map(m=>({...m,tasks:m.tasks.filter(t=>!placeholder(t)),workPackages:m.workPackages.map(w=>({...w,tasks:w.tasks.filter(t=>!placeholder(t))}))}))
 const evidenceId=eid+':heading',timeEvidence=eid+':time',headingQuote=heading[0].trim(),headingAt=source.indexOf(headingQuote)
 r.evidence.push({id:evidenceId,sourceId,quote:headingQuote,quotedText:headingQuote,textStart:headingAt,textEnd:headingAt+headingQuote.length,field:'event',extractionMethod:'parser',confidence:1})
 r.evidence.push({id:timeEvidence,sourceId,quote:time,quotedText:time,textStart:start,textEnd:start+time.length,field:'event',extractionMethod:'parser',confidence:1})
 const evidenceIds=[evidenceId,timeEvidence]
 if(location&&places[0]){const placeId=eid+':location',at=places[0].at+places[0].whole.indexOf(location);r.evidence.push({id:placeId,sourceId,quote:location,quotedText:location,textStart:at,textEnd:at+location.length,field:'event',extractionMethod:'parser',confidence:1});evidenceIds.push(placeId)}
 const point=(id:string,type:'event_start'|'event_end',normalizedValue:string|null):TimePointSuggestionV2=>({tempId:id,type,rawText:time,normalizedValue,timezone:'Asia/Shanghai',isAllDay:resolved&&parsed.isAllDay,precision:resolved?parsed.precision:'vague',needsConfirmation:!resolved,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:[timeEvidence],confidence:1,selected:resolved})
 r.timePoints.push(point(timeId,'event_start',resolved?parsed.normalizedValue:null))
 const end=resolved&&parsed.rangeEndNormalizedValue?eid+':end':null
 if(end&&parsed.rangeEndNormalizedValue)r.timePoints.push(point(end,'event_end',parsed.rangeEndNormalizedValue))
 r.events.push({tempId:eid,title,description:resolved?title:`${title}\n原文时间：${time}（需核对）`,location,startTimePointTempId:timeId,endTimePointTempId:end,evidenceIds,confidence:1,inferenceLevel:'explicit',selected:resolved,relatedTaskTempIds:[...new Set(previous.flatMap(e=>e.relatedTaskTempIds??[]))]})
 return r
}
