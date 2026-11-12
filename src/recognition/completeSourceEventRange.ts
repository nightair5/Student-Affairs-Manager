import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import {parseBusinessDateTime} from '../lib/timeSemantics'
import type {RecognitionResult,TimePointSuggestionV2} from './types'

/** Complete only an explicitly labelled range belonging to the one named
 * event. This runs before a new direct save; it never edits saved records. */
export function completeSourceEventRange(input:RecognitionResult,source:string,referenceTime:string,timezone:string):RecognitionResult {
  if(input.events.length!==1||/(?:原定|改期|延期|更正|取消|不再举办)/u.test(source))return input
  const event=input.events[0]
  if(event.endTimePointTempId||event.sourceStatus==='uncertain'||event.sourceStatus==='alternative')return input
  const start=input.timePoints.find(point=>point.tempId===event.startTimePointTempId&&point.type==='event_start')
  if(!start?.normalizedValue||start.needsConfirmation||start.precision!=='exact'||start.timezone!==timezone)return input
  const heading=/^\s*[\p{Extended_Pictographic}\uFE0F\u200D\s]*【([^】\n]{3,100})】/u.exec(source)
  const normalize=(value:string)=>value.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'')
  const title=normalize(event.title),head=normalize(heading?.[1]??'')
  if(title.length<4||!head.includes(title))return input
  const fields=[...source.matchAll(/(?:^|\n)(?:[ \t]|\p{Extended_Pictographic}|\uFE0F|\u200D)*(?:【([^】\n]{1,20})】[ \t]*|([^：:\n]{1,20})[：:][ \t]*)([^\r\n]+)/gu)]
    .map(match=>({label:(match[1]??match[2]).trim(),value:match[3].trim()}))
    .filter(field=>/(?:时间|时段)$/u.test(field.label)&&!/(?:报名|申请|提交|截止|登记|缴费|领取|受理)/u.test(field.label))
  if(fields.length!==1)return input
  const raw=fields[0].value
  if(!/\d{1,2}[:：]\d{2}\s*[-—–－~～至到]\s*\d{1,2}[:：]\d{2}/u.test(raw)||/(?:约|预计|暂定|拟|可能|备选|或者|任选)/u.test(raw))return input
  const at=source.indexOf(raw)
  if(at<0||at!==source.lastIndexOf(raw))return input
  const parsed=parseDirectSourceTime(raw,{type:'event_start',referenceTime,timezone})
  if(!parsed.normalizedValue||!parsed.rangeEndNormalizedValue||parsed.needsConfirmation||parsed.isAllDay)return input
  const actualStart=parseBusinessDateTime(start.normalizedValue,timezone),sourceStart=parseBusinessDateTime(parsed.normalizedValue,timezone)
  if(!actualStart||!sourceStart||actualStart.getTime()!==sourceStart.getTime()||event.evidenceIds.length>=20)return input
  const evidenceId='direct-source-event-range:'+at,endId=evidenceId+':end'
  if(input.evidence.some(item=>item.id===evidenceId)||input.timePoints.some(item=>item.tempId===endId))return input
  const result=structuredClone(input),owner=result.events[0],sourceId=result.evidence[0]?.sourceId
  if(!sourceId)return input
  result.evidence.push({id:evidenceId,sourceId,quote:raw,quotedText:raw,textStart:at,textEnd:at+raw.length,field:'event',extractionMethod:'parser',confidence:1})
  const end:TimePointSuggestionV2={tempId:endId,type:'event_end',rawText:raw,normalizedValue:parsed.rangeEndNormalizedValue,timezone,isAllDay:false,precision:parsed.precision,needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:[evidenceId],confidence:1,selected:true}
  result.timePoints.push(end);owner.endTimePointTempId=endId;owner.evidenceIds=[...owner.evidenceIds,evidenceId]
  return result
}
