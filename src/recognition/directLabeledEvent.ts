import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import type {RecognitionResult,TimePointSuggestionV2} from './types'

/** Recover one explicitly labelled event from local recognition only. The
 * complete short notice is its evidence, not an invented activity date. */
export function recoverLabeledLocalEvent(input:RecognitionResult,source:string):RecognitionResult {
 if(input.events.some(e=>!/^(?:参加|出席|参加者|参与者|参加的同学)$/u.test(e.title.trim()))||source.length>500||/取消|不再举办|禁止参加|请勿参加/u.test(source))return input
 const heading=/^\s*【([^】\n]{3,60})】/u.exec(source)
 const times=[...source.matchAll(/(?:^|\n)\s*(?:活动时间|会议时间|时间)[：:]\s*([^\n]+)/gu)]
 const places=[...source.matchAll(/(?:^|\n)\s*(?:活动地点|会议地点|地点)[：:]\s*([^\n（(]+)/gu)]
 if(!heading||times.length!==1||places.length!==1||!/(?:讲座|培训|实训|报告|论坛|研讨|交流|会议|分享|沙龙|宣讲|活动)/u.test(heading[1]))return input
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
