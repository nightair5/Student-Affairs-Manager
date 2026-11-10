import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import type {RecognitionResult,TimePointSuggestionV2} from './types'
import {localEventLocation} from './localNoticeFacts'

/** A dated sentence with one explicit venue and held event can stand on its
 * own. Multiple candidates or deadline/cancellation language remain with the
 * ordinary parser, which must not guess which fact belongs to which event. */
function recoverDatedEvent(input:RecognitionResult,source:string):RecognitionResult {
 const candidates=[...source.matchAll(/[^。！？\n]+/gu)].flatMap(m=>{
  const quote=m[0].trim(),location=localEventLocation(quote),dates=[...quote.matchAll(/(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]/gu)]
  if(!location||dates.length!==1||/取消|改期|延期|备选|任选|截止|报名|提交|上传|曾于|曾在|曾经|往年|历届|此前|去年|历史上/u.test(quote)||quote.length>160||source.indexOf(quote)!==source.lastIndexOf(quote))return []
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

/** Recover one explicitly labelled event from local recognition only. The
 * complete short notice is its evidence, not an invented activity date. */
export function recoverLabeledLocalEvent(input:RecognitionResult,source:string):RecognitionResult {
 if(input.events.some(e=>!/^(?:参加|出席|参加者|参与者|参加的同学)$/u.test(e.title.trim()))||source.length>500||/取消|不再举办|禁止参加|请勿参加/u.test(source))return input
 const heading=/^\s*【([^】\n]{3,60})】/u.exec(source)
 const times=[...source.matchAll(/(?:^|\n)\s*(?:活动时间|会议时间|时间)[：:]\s*([^\n]+)/gu)]
 const places=[...source.matchAll(/(?:^|\n)\s*(?:活动地点|会议地点|地点)[：:]\s*([^\n（(]+)/gu)]
 if(!heading||times.length!==1||places.length!==1||!/(?:讲座|培训|实训|报告|论坛|研讨|交流|会议|分享|沙龙|宣讲|活动)/u.test(heading[1]))return recoverDatedEvent(input,source)
 const title=heading[1].trim(),time=times[0][1].trim(),location=places[0][1].trim(),parsed=parseDirectSourceTime(time,{type:'event_start',referenceTime:input.createdAt,timezone:'Asia/Shanghai'})
 if(!parsed.normalizedValue||parsed.needsConfirmation||!location||location.length>160)return input
 const r=structuredClone(input),sourceId=r.evidence[0]?.sourceId??'source',eid='local-labelled-event',timeId=eid+':start',start=source.indexOf(time)
 const placeholderPoints=new Set(r.events.flatMap(e=>[e.startTimePointTempId,e.endTimePointTempId]).filter(Boolean))
 r.events=[]
 r.timePoints=r.timePoints.filter(p=>!placeholderPoints.has(p.tempId)||p.relatedTaskTempIds.length>0)
 const evidenceId=eid+':evidence',timeEvidence=eid+':time'
 r.evidence.push({id:evidenceId,sourceId,quote:source,quotedText:source,textStart:0,textEnd:source.length,field:'event',extractionMethod:'parser',confidence:1})
 r.evidence.push({id:timeEvidence,sourceId,quote:time,quotedText:time,textStart:start,textEnd:start+time.length,field:'deadline',extractionMethod:'parser',confidence:1})
 const point=(id:string,type:'event_start'|'event_end',normalizedValue:string):TimePointSuggestionV2=>({tempId:id,type,rawText:time,normalizedValue,timezone:'Asia/Shanghai',isAllDay:parsed.isAllDay,precision:parsed.precision,needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:[timeEvidence],confidence:1,selected:true})
 r.timePoints.push(point(timeId,'event_start',parsed.normalizedValue))
 const end=parsed.rangeEndNormalizedValue?eid+':end':null
 if(end&&parsed.rangeEndNormalizedValue)r.timePoints.push(point(end,'event_end',parsed.rangeEndNormalizedValue))
 r.events.push({tempId:eid,title,description:title,location,startTimePointTempId:timeId,endTimePointTempId:end,evidenceIds:[evidenceId,timeEvidence],confidence:1,inferenceLevel:'explicit',selected:true,relatedTaskTempIds:[]})
 return r
}
