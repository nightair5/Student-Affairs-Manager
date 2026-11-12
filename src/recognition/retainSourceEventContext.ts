import {extractSourceNoticeContext} from '../lib/noticeExcerpts'
import type {RecognitionResult} from './types'

/** Preserve useful source passages for one clearly named event. Passages remain
 * labelled as notice excerpts; no role, entitlement or obligation is inferred. */
export function retainSourceEventContext(input:RecognitionResult,source:string):RecognitionResult {
  if(input.events.length!==1||/(?:原定|改期|延期|更正|取消|不再举办)/u.test(source))return input
  const event=input.events[0],heading=/^\s*[\p{Extended_Pictographic}\uFE0F\u200D\s]*【([^】\n]{3,100})】/u.exec(source)
  const normalize=(value:string)=>value.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'')
  if(normalize(event.title).length<4||!normalize(heading?.[1]??'').includes(normalize(event.title)))return input
  const scheduleLabels=source.split(/\r?\n/u).map(line=>line.replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D]+/gu,'')).filter(line=>/^(?:【[^】]{0,12}(?:时间|时段)】|[^：:\n]{0,12}(?:时间|时段)[：:])/u.test(line)&&!/(?:报名|申请|提交|截止|登记|缴费|领取|受理)/u.test(line.split(/[：:】]/u)[0]))
  if(scheduleLabels.length>1)return input
  const context=extractSourceNoticeContext(source,'event',event.description)
  let result=input,omitted=context.omitted
  for(const section of context.sections){
    if(section.kind==='time')continue
    // Evidence must be a unique exact source span, including original line
    // endings. A failed alignment only affects this excerpt.
    const variants=[section.text,section.text.replace(/\n/gu,'\r\n')]
    const quote=variants.find(value=>source.indexOf(value)>=0&&source.indexOf(value)===source.lastIndexOf(value))
    if(!quote||quote.length>500){omitted=true;continue}
    const current=result.events[0],line='通知补充：'+quote,at=source.indexOf(quote),id='source-notice-context:'+at
    const existing=result.evidence.find(item=>item.id===id),alreadyOwned=current.evidenceIds.includes(id)
    if(existing&&(existing.quote!==quote||existing.textStart!==at||existing.textEnd!==at+quote.length)){omitted=true;continue}
    if(current.description.length+line.length+1>2400||!alreadyOwned&&current.evidenceIds.length>=20||!existing&&result.evidence.length>=120){omitted=true;continue}
    if(result===input)result=structuredClone(input)
    const owner=result.events[0],sourceId=result.evidence[0]?.sourceId
    if(!sourceId){omitted=true;continue}
    if(!existing)result.evidence.push({id,sourceId,quote,quotedText:quote,textStart:at,textEnd:at+quote.length,field:'description',extractionMethod:'parser',confidence:1})
    owner.description+=(owner.description?'\n':'')+line;if(!alreadyOwned)owner.evidenceIds.push(id)
  }
  if(omitted){
    if(result===input)result=structuredClone(input)
    const reason='部分内容尚未完整整理，可在原文查看'
    if(!result.quality.reviewReasons.includes(reason))result.quality.reviewReasons.push(reason)
    result.quality.needsHumanReview=true
  }
  return result
}
