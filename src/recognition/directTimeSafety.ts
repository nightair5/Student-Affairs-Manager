import type { TimePointSuggestionV2 } from './types'
import { parseChineseTimeAst, parseBusinessDateTime } from '../lib/timeSemantics'

const change = /调整至|调整为|更改为|改为|改至|延期至|延\s*期至|更正为|现为|旧截止取消了，改/gu
const obsolete = /原定|原截止|旧截止|之前说|原时间/u
const alternatives = /任选|备选|可选择|任一|(?:日|号|\d)\s*或.{0,20}(?:日|号)/u
const deadline = /截止|截至|最迟|不晚于|不得晚于|之前|以前|[日号点分\d]\s*前/u
const withoutQualificationCancellation = (s:string) => s.replace(/取消(?:其)?(?:申请|参评|获奖|评选)?资格|逾期[^，。；]{0,14}(?:不再受理|不予受理)|不得(?:缺席|迟到|早退)/gu,'')

export function timeSourceContext(source:string,raw:string):{text:string;start:number;at:number}|null {
  const at=source.indexOf(raw)
  if(!raw||at<0||source.lastIndexOf(raw)!==at)return null
  const before=source.slice(0,at),after=source.slice(at+raw.length)
  const start=Math.max(before.lastIndexOf('。'),before.lastIndexOf('；'),before.lastIndexOf(';'),before.lastIndexOf('！'),before.lastIndexOf('？'))+1
  const stop=after.search(/[。；;！？]/u)
  return {text:source.slice(start,at+raw.length+(stop<0?after.length:stop)),start,at}
}

/** Scopes revision language to the dated sentence. A different event changing
 * later in the notice never invalidates an earlier, unrelated date. */
export function inactiveSourceTime(source:string,raw:string):boolean {
  const context=timeSourceContext(source,raw)
  if(!context)return false
  const text=withoutQualificationCancellation(context.text),local=context.at-context.start
  const marker=[...text.matchAll(change)].find(m=>m.index>=local+raw.length)
  if(marker&&obsolete.test(text.slice(0,local+raw.length)))return true
  const prefix=text.slice(0,local),tail=text.slice(local+raw.length)
  if(/旧截止|原截止|之前说/u.test(prefix)&&/取消|作废|失效/u.test(tail))return true
  return /(?:活动|讲座|会议|考试|原安排|原时间)[^。；]{0,20}(?:取消|作废)|(?:取消|作废)[^。；]{0,20}(?:活动|讲座|会议|考试)/u.test(text)&&![...text.matchAll(change)].some(m=>m.index<local)
}

export function directTimeSafetyReason(point:TimePointSuggestionV2,source:string,referenceTime:string):string|null {
  if(!point.normalizedValue)return 'UNKNOWN_TIME'
  const raw=point.rawText,scope=timeSourceContext(source,raw),context=scope?.text??raw
  if(inactiveSourceTime(source,raw))return 'OBSOLETE_SOURCE_TIME'
  if(point.needsConfirmation||point.precision==='vague')return 'UNRESOLVED_TIME_VALUE_OR_ROLE'
  if(alternatives.test(context))return 'ALTERNATIVE_DATE_NOT_FIXED_TIME'
  if(/预计|暂估|可能|另行通知/u.test(raw)&&/截止|deadline|event_end/u.test(point.type))return 'ESTIMATED_ENDPOINT_NOT_FIXED_TIME'
  const datedDelivery=/\d\s*[日号]\s*(?:提交|交到|交至|报送|上传|发送)/u.test(raw)
  if(/deadline$/u.test(point.type)&&(!deadline.test(context)&&!datedDelivery||/办理时段|办理窗口|开放时间|领取时段/u.test(context)&&!/截止|截至|最迟/u.test(context)))return 'WINDOW_OR_UNPROVEN_DEADLINE_ROLE'
  const parsed=parseChineseTimeAst(raw,{type:point.type,referenceTime,timezone:point.timezone})
  if(parsed.needsConfirmation||!parsed.normalizedValue)return 'UNPARSED_SOURCE_TIME'
  if(point.type==='event_end'&&!parsed.rangeEndNormalizedValue&&!/结束|闭幕|终止|截至|截止|持续至|至此/u.test(context))return 'UNPROVEN_EVENT_END'
  const expected=point.type==='event_end'&&parsed.rangeEndNormalizedValue?parsed.rangeEndNormalizedValue:parsed.normalizedValue
  const same=expected.length===10?expected===point.normalizedValue:parseBusinessDateTime(expected,point.timezone)?.getTime()===parseBusinessDateTime(point.normalizedValue,point.timezone)?.getTime()
  return same?null:'SOURCE_TIME_VALUE_OR_PRECISION_MISMATCH'
}

/** Simple mode deliberately trusts model date computation. This is a basic
 * safety check, not another attempt to reconstruct every date with the legacy
 * parser. Parsing individual source spans below only identifies revoked dates. */
export function simpleTimeSafetyReason(point:TimePointSuggestionV2,source:string,referenceTime:string):string|null {
  if(!point.normalizedValue)return 'UNKNOWN_TIME'
  const context=point.rawText||source
  if(alternatives.test(context))return 'ALTERNATIVE_DATE_NOT_FIXED_TIME'
  if(/deadline$/u.test(point.type)&&/办理时段|办理窗口|开放时间|领取时段/u.test(context)&&!deadline.test(context))return 'WINDOW_NOT_DEADLINE'
  if(/预计|暂估|可能|另行通知/u.test(context)&&/deadline|event_end/u.test(point.type))return 'ESTIMATED_ENDPOINT_NOT_FIXED_TIME'
  if(point.normalizedValue.includes('T')&&!/\d{1,2}\s*[:：]\s*\d{2}|[一二三四五六七八九十两\d]\s*点|上午|下午|晚上|小时|分钟/u.test(context))return 'CLOCK_NOT_STATED'
  const spans=[...source.matchAll(/(?:\d{4}\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}\s*[日号](?:\s*(?:上午|下午|晚上)?\s*\d{1,2}(?:[:：]\d{2}|点(?:半|\d{1,2}分)?))?|\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[T\s]+\d{1,2}:\d{2})?/gu)]
  let revoked=false,active=false
  for(const span of spans){
    const parsed=parseChineseTimeAst(span[0],{type:point.type,referenceTime,timezone:point.timezone})
    if(!parsed.normalizedValue||parsed.needsConfirmation)continue
    const matches=parsed.normalizedValue.length===10?parsed.normalizedValue===point.normalizedValue.slice(0,10):parseBusinessDateTime(parsed.normalizedValue,point.timezone)?.getTime()===parseBusinessDateTime(point.normalizedValue,point.timezone)?.getTime()
    if(matches){if(inactiveSourceTime(source,span[0]))revoked=true;else active=true}
  }
  return revoked&&!active?'OBSOLETE_SOURCE_TIME':null
}
