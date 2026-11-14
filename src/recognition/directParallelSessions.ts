import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import type {EvidenceReference} from '../types'
import type {EventSuggestion, RecognitionResult, TimePointSuggestionV2} from './types'
import {localEventLocation} from './localNoticeFacts'
import {localActionExplicitlyNegated} from './localActionPolarity'

type LabelledLine={label:string;value:string;start:number;whole:string;wholeStart:number}
type Session={line:LabelledLine;role:string;date?:string;yearFromHeading?:boolean;displayTitle?:string}
type SessionSchedule={heading:string;date:string;sessions:Session[];places:Map<string,string>;dateAnchor?:{quote:string;start:number};sharedVenueList?:boolean}
const lines=(source:string):LabelledLine[]=>[...source.matchAll(/(?:^|\n)[ \t]*(?:【([^】\n]+)】|([^：:\n]{1,20})[：:])[ \t]*[：:]?[ \t]*([^\r\n]*)/gu)].map(m=>{
 const value=m[3].trim(),whole=m[0].replace(/^\n/u,'').trim(),wholeStart=m.index!+m[0].indexOf(whole)
 return {label:(m[1]??m[2]).trim(),value,start:wholeStart+whole.indexOf(value),whole,wholeStart}
})
const squash=(s:string)=>s.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'')
const roleKey=(s:string)=>squash(s).replace(/(?:活动|环节|阶段|专场|会)$/u,'')
const cleanHeading=(s:string)=>s.replace(/\[[^\]\n]{1,8}\]/gu,'').replace(/^【|】$/gu,'').trim()

const eventColumns=(s:string)=>{
 const c=s.split(/[|｜]/u).map(x=>x.trim()),time=c.findIndex(x=>x==='时间'),role=c.findIndex(x=>/^(?:名称|项目|活动|日程)$/u.test(x)),place=c.findIndex(x=>/^(?:地点|场地)$/u.test(x))
 return c.length===3&&new Set([time,role,place]).size===3&&time>=0&&role>=0&&place>=0?{time,role,place}:null
}
const rowsHeader=(source:string)=>source.split(/\r?\n/u).map(s=>s.trim()).find(s=>Boolean(eventColumns(s)))??''

/** A single heading can state the date and venue for an immediately following
 * list of named, timed sessions.  Only the closed list after that heading
 * shares those facts; later paragraphs and separate actions cannot inherit it. */
function sharedVenueSessionList(source:string):SessionSchedule|null {
 const headingPattern=/(?:^|[。！？\n])\s*([^。！？；;\n]{0,140}?(?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天][^。！？；;\n]{0,45}?在\s*([^，,。！？；;：:\n]{1,35}?)\s*(?:举办|举行|开展|安排)\s*([两二三四五六七八\d])\s*场(?:活动|日程|讲座|培训|交流)?\s*[：:])/gu
 const headings=[...source.matchAll(headingPattern)]
 if(headings.length!==1)return null
 const h=headings[0],heading=h[1].trim(),headingStart=h.index!+h[0].lastIndexOf(heading),venue=h[2].trim()
 const count=({'两':2,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8} as Record<string,number>)[h[3]]??Number(h[3])
 const dates=[...heading.matchAll(/(?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天]/gu)]
 if(count<2||count>8||dates.length!==1||source.indexOf(heading)!==source.lastIndexOf(heading)||/(?:取消|改期|延期|备选|任选|或)/u.test(heading))return null
 const after=headingStart+heading.length,tail=source.slice(after),end=tail.search(/[。！？；;\n]/u),body=end<0?tail:tail.slice(0,end)
 const rows=[...body.matchAll(/[^，,]+/gu)].map(m=>({text:m[0].trim(),start:after+m.index!+m[0].indexOf(m[0].trim())})).filter(row=>row.text)
 if(rows.length!==count)return null
 const sessions:Session[]=[],places=new Map<string,string>()
 for(const row of rows){
  const match=/^(\d{1,2}[:：][0-5]\d\s*[-－—–至到]\s*\d{1,2}[:：][0-5]\d)\s*([^，,。！？；;\n]{2,40})$/u.exec(row.text)
  if(!match||/^(?:请|须|需|应|提交|上传|填写|报名|申请|缴费|领取)/u.test(match[2])||/(?:取消|改期|延期|备选|任选|截止)/u.test(row.text)||source.indexOf(row.text)!==source.lastIndexOf(row.text))return null
  const clocks=[...match[1].matchAll(/(\d{1,2})[:：]([0-5]\d)/gu)].map(value=>Number(value[1])*60+Number(value[2]))
  const role=match[2].trim()
  if(clocks.length!==2||clocks.some(value=>value>=24*60)||clocks[1]<=clocks[0]||places.has(role))return null
  places.set(role,venue)
  sessions.push({role,line:{label:role+'时间',value:match[1],start:row.start+row.text.indexOf(match[1]),whole:row.text,wholeStart:row.start}})
 }
 return {heading,date:dates[0][0],sessions,places,sharedVenueList:true}
}

/** Parse a dated event schedule as rows, preserving literal source offsets. */
function eventScheduleTable(source:string,extended=false):SessionSchedule|null {
 const rows=[...source.matchAll(/[^\r\n]+/gu)].map(m=>({text:m[0].trim(),start:m.index!+m[0].indexOf(m[0].trim())}))
 const cells=(s:string)=>s.split(/[|｜]/u).map(x=>x.trim())
 const headerIndexes=rows.flatMap((row,index)=>eventColumns(row.text)?[index]:[])
 if(headerIndexes.length>1)return null
 // Both a labelled table and numbered, three-column event lines convey a
 // shared schedule. Require an adjacent dated heading and complete rows.
 const numbered=headerIndexes.length===0
 if(numbered&&!extended)return null
 const index=numbered?1:headerIndexes[0]+1,heading=numbered?rows[0]:rows[index-2]
 const headingTopic=heading?.text.replace(/(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]|(?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天]/gu,'')??''
 const explicitEvent=/(?:活动|日程|讲座|培训|工作坊)/u.test(headingTopic)
 const datedEventLabel=extended&&(/[\p{Script=Han}](?:日|周|节|季)(?:[】\]：:]|$)/u.test(headingTopic)||/[\p{Script=Han}](?:日|周|节|季|月)(?:的)?安排/u.test(headingTopic))
 if(!heading||!explicitEvent&&!datedEventLabel||/报名|申请|提交|上传|缴费|截止/u.test(headingTopic))return null
 const dates=[...heading.text.matchAll(/(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]|(?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天]/gu)]
 if(dates.length!==1||source.indexOf(heading.text)!==source.lastIndexOf(heading.text)||/取消|改期|待定|备选|或/u.test(heading.text))return null
 const sessions:{line:LabelledLine;role:string}[]=[],places=new Map<string,string>()
 for(const row of rows.slice(index)){
  const numberedRow=numbered?/^(?:[①②③④⑤⑥⑦⑧⑨⑩]|\d{1,2}[.、)]|【[^】\n]{1,16}】)\s*(.+)$/u.exec(row.text)?.[1]:null
  let c=numbered?(numberedRow?.replace(/[。；;]$/u,'').split(/[，,]/u).map(x=>x.trim())??[]):cells(row.text)
  if(numbered&&c.length===2){const first=/^(\d{1,2}[:：][0-5]\d\s*[-—–至到]\s*\d{1,2}[:：][0-5]\d)\s*(.{2,40})$/u.exec(c[0]);if(first)c=[first[1],first[2].trim(),c[1]]}
  // A malformed row must not silently turn a partial schedule into a complete one.
  if(c.length!==3){if(numbered&&numberedRow||!numbered&&/[|｜]/u.test(row.text))return null;break}
  const columns=numbered?{time:0,role:1,place:2}:eventColumns(rows[headerIndexes[0]].text)!
  const time=c[columns.time],role=c[columns.role],place=c[columns.place]
  const hours=/^(\d{1,2}):([0-5]\d)\s*[-—–至到]\s*(\d{1,2}):([0-5]\d)$/u.exec(time)
  // An action row is a user obligation, not evidence of a scheduled event.
  // Ambiguous or overnight ranges are left for the ordinary parser; inferring
  // the following day from a compact table would manufacture a date.
  if(!hours||Number(hours[1])>23||Number(hours[3])>23||Number(hours[1])*60+Number(hours[2])>=Number(hours[3])*60+Number(hours[4])||!role||/^(?:请|须|需|填写|填报|提交|递交|上传|报送|登记|申请|缴费|领取)/u.test(role)||role.length>40||!place||place.length>80||/取消|改期|待定|备选|或/u.test(row.text)||places.has(role)||source.indexOf(row.text)!==source.lastIndexOf(row.text))return null
  places.set(role,place);sessions.push({role,line:{label:role+'时间',value:time,start:row.start+row.text.indexOf(time),whole:row.text,wholeStart:row.start}})
 }
 return sessions.length>=2&&sessions.length<=8?{heading:heading.text,date:dates[0][0],sessions,places}:null
}

/** A compact sentence of named events may supply a weekday once or on every
 * clause. Only inherit it when every other substantive clause is another
 * fully specified event; a separate action or another paragraph blocks it. */
function weekdayInlineSessions(source:string):SessionSchedule|null {
 if(/[\r\n]/u.test(source)||/(?:取消|作废|改期|延期|调整|更正|备选|任选|入选|仅限|报名成功|通过审核)/u.test(source))return null
 const parts=[...source.matchAll(/[^，,；;。！？]+/gu)].map(m=>({text:m[0].trim(),start:m.index!+m[0].indexOf(m[0].trim())}))
 const candidates=parts.filter(part=>!/^(?:欢迎|诚邀)(?:大家|同学|师生)?(?:参加|参与|出席)$/u.test(part.text))
 if(candidates.length<2||candidates.length>8)return null
 const pattern=/^((?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天]|当天|同日|当日)?\s*((?:(?:凌晨|早上|上午|中午|下午|傍晚|晚上)\s*)?\d{1,2}[:：][0-5]\d(?:\s*[-—–至到]\s*(?:(?:上午|下午|晚上)\s*)?\d{1,2}[:：][0-5]\d)?)\s*在/u
 const first=pattern.exec(candidates[0].text),shared=first?.[1]
 if(!first||!shared||/^(?:当天|同日|当日)$/u.test(shared))return null
 const sessions:Session[]=[],places=new Map<string,string>()
 for(const part of candidates){
  const match=pattern.exec(part.text),heard=match&&/在\s*([^，,；;。！？\n]{1,35}?)\s*听\s*([^，,；;。！？\n]{2,40})$/u.exec(part.text)
  const place=match&&(localEventLocation(part.text)??(heard?{location:heard[1].trim(),name:heard[2].trim()}:null))
  if(!match||!place||places.has(place.name)||source.indexOf(part.text)!==source.lastIndexOf(part.text)||/(?:报名|提交|上传|填写|截止|缴费)/u.test(part.text))return null
  const day=match[1]&&!/^(?:当天|同日|当日)$/u.test(match[1])?match[1]:undefined,clock=match[2]
  const times=[...clock.matchAll(/(\d{1,2})[:：]([0-5]\d)/gu)].map(value=>Number(value[1])*60+Number(value[2]))
  if(times.some(value=>value>=24*60)||times.length===2&&times[1]<=times[0])return null
  places.set(place.name,place.location)
  sessions.push({role:place.name,date:day,line:{label:place.name+'时间',value:clock,start:part.start+part.text.indexOf(clock),whole:part.text,wholeStart:part.start}})
 }
 return {heading:candidates[0].text,date:shared,sessions,places,dateAnchor:{quote:candidates[0].text,start:candidates[0].start}}
}

/** A later, independent form instruction must not prevent interpreting a
 * complete event sentence. Restrict shared dates to that one source sentence
 * and retain offsets in the original source, not in a reconstructed string. */
function scopedWeekdayInlineSessions(source:string):SessionSchedule|null {
 const candidates=[...source.matchAll(/[^。！？；;\r\n]+/gu)].flatMap(part=>{
  const text=part[0].trim(),start=part.index!+part[0].indexOf(text)
  if(!text||source.indexOf(text)!==source.lastIndexOf(text))return []
  const parsed=weekdayInlineSessions(text)
  if(!parsed)return []
  return [{...parsed,sessions:parsed.sessions.map(session=>({...session,line:{...session.line,start:session.line.start+start,wholeStart:session.line.wholeStart+start}})),dateAnchor:parsed.dateAnchor?{...parsed.dateAnchor,start:parsed.dateAnchor.start+start}:undefined}]
 })
 return candidates.length===1?candidates[0]:null
}

/** A compact agenda may put the venue after a labelled comma rather than
 * before the event name. The date is shared only across explicit same-day
 * rows in this one bounded sentence; each row owns its own clock and venue. */
function weekdayLabelledVenueSessions(source:string):SessionSchedule|null {
 const candidates=[...source.matchAll(/[^。！？\r\n]+/gu)].flatMap(part=>{
  const sentence=part[0].trim(),at=part.index!+part[0].indexOf(sentence)
  if(!sentence||source.indexOf(sentence)!==source.lastIndexOf(sentence)||/(?:取消|改期|延期|备选|任选)/u.test(sentence))return []
  const rows=[...sentence.matchAll(/[^；;]+/gu)].map(row=>({text:row[0].trim(),start:at+row.index!+row[0].indexOf(row[0].trim())})).filter(row=>row.text)
  if(rows.length<2||rows.length>8)return []
  const sessions:Session[]=[],places=new Map<string,string>()
  let shared=''
  for(const row of rows){
   const match=/^((?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天]|同日|当日|当天)\s*((?:(?:早上|上午|中午|下午|晚上)\s*)?\d{1,2}[:：][0-5]\d(?:\s*[-－—–至到]\s*(?:(?:上午|下午|晚上)\s*)?\d{1,2}[:：][0-5]\d)?)\s*(?:有|举行|举办|召开|开展)\s*([^，,。；;\n]{2,40})\s*[，,]\s*(?:地点|场地)[：:]?\s*([^，,。；;\n]{2,50})$/u.exec(row.text)
   if(!match||/(?:报名|提交|上传|填写|截止|缴费|取消)/u.test(row.text)||places.has(match[3])||source.indexOf(row.text)!==source.lastIndexOf(row.text))return []
   const day=match[1],same=/^(?:同日|当日|当天)$/u.test(day)
   if(!shared){if(same)return [];shared=day}
   const role=match[3].trim(),clock=match[2],location=match[4].trim()
   places.set(role,location)
   sessions.push({role,date:same?undefined:day,line:{label:role+'时间',value:clock,start:row.start+row.text.indexOf(clock),whole:row.text,wholeStart:row.start}})
  }
  return [{heading:rows[0].text,date:shared,sessions,places,dateAnchor:{quote:rows[0].text,start:rows[0].start}}]
 })
 return candidates.length===1?candidates[0]:null
}

/** A named event followed by its own weekday, clock and venue is a schedule
 * row even when the activity name comes before the time. All rows must be
 * complete and occur within the same sentence. */
function namedWeekdayVenueSessions(source:string):SessionSchedule|null {
 const candidates=[...source.matchAll(/[^。！？\r\n]+/gu)].flatMap(part=>{
  const text=part[0].trim(),at=part.index!+part[0].indexOf(text)
  if(!text||source.indexOf(text)!==source.lastIndexOf(text)||/(?:取消|改期|延期|备选|任选)/u.test(text))return []
  const rows=[...text.matchAll(/[^，,]+/gu)].map(row=>({text:row[0].trim(),start:at+row.index!+row[0].indexOf(row[0].trim())})).filter(row=>row.text)
  if(rows.length<2||rows.length>8)return []
  const sessions:Session[]=[],places=new Map<string,string>()
  for(const row of rows){
   const m=/^(?:【[^】\n]{1,40}】\s*)?([^，,。；;：:\n]{2,30}?)((?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天])\s*((?:(?:上午|下午|晚上|早上|中午)\s*)?\d{1,2}[:：][0-5]\d(?:\s*[-－—–至到]\s*\d{1,2}[:：][0-5]\d)?)\s*在\s*([^，,。；;：:\n]{2,50})$/u.exec(row.text)
   if(!m||/^(?:请|须|需|应|提交|上传|填写|报名|申请|缴费|领取)/u.test(m[1])||/(?:另行通知|待定|报名|截止)/u.test(m[4])||places.has(m[1])||source.indexOf(row.text)!==source.lastIndexOf(row.text))return []
   const role=m[1].trim();places.set(role,m[4].trim())
   sessions.push({role,date:m[2],line:{label:role+'时间',value:m[3],start:row.start+row.text.indexOf(m[3]),whole:row.text,wholeStart:row.start}})
  }
  return [{heading:rows[0].text,date:sessions[0].date!,sessions,places}]
 })
 return candidates.length===1?candidates[0]:null
}

/** A weekday heading and one explicitly named venue may scope a closed list
 * of time-range + activity rows. The venue must be a location expression,
 * and a later paragraph never inherits it. */
function headedVenueSessions(source:string):SessionSchedule|null {
 const candidates=[...source.matchAll(/[^。！？\r\n]+/gu)].flatMap(part=>{
  const text=part[0].trim(),at=part.index!+part[0].indexOf(text)
  const m=/^(【[^】\n]{1,40}】\s*)([^，,。；;\n]{2,40}?(?:厅|馆|楼|室|中心|广场|礼堂))(?=(?:上午|下午|晚上|早上|中午)?\s*\d{1,2}[:：])/u.exec(text)
  if(!m||source.indexOf(text)!==source.lastIndexOf(text)||/(?:取消|改期|延期|备选|任选)/u.test(text))return []
  const days=[...m[1].matchAll(/(?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天]/gu)]
  if(days.length!==1)return []
  const heading=m[0],venue=m[2].trim(),tail=text.slice(heading.length)
  const rows=[...tail.matchAll(/[^，,]+/gu)].map(row=>({text:row[0].trim(),start:at+heading.length+row.index!+row[0].indexOf(row[0].trim())})).filter(row=>row.text&&!/^(?:欢迎|诚邀)(?:大家|同学|师生)?(?:参加|参与|出席)$/u.test(row.text))
  if(rows.length<2||rows.length>8)return []
  const sessions:Session[]=[],places=new Map<string,string>()
  for(const row of rows){
   const item=/^((?:(?:上午|下午|晚上|早上|中午)\s*)?\d{1,2}[:：][0-5]\d\s*[-－—–至到]\s*\d{1,2}[:：][0-5]\d)\s*(?:有|举行|开展|安排)\s*([^，,。；;\n]{2,40})$/u.exec(row.text)
   if(!item||/^(?:请|须|需|应|提交|上传|填写|报名|申请|缴费|领取)/u.test(item[2])||places.has(item[2])||source.indexOf(row.text)!==source.lastIndexOf(row.text))return []
   const role=item[2].trim();places.set(role,venue)
   sessions.push({role,line:{label:role+'时间',value:item[1],start:row.start+row.text.indexOf(item[1]),whole:row.text,wholeStart:row.start}})
  }
  return [{heading,date:days[0][0],sessions,places}]
 })
 return candidates.length===1?candidates[0]:null
}

/** A labelled agenda can state a date on its first row and explicitly say
 * "同日" on later rows. Each row retains its own clock and venue. */
function labelledSessionRows(source:string):SessionSchedule|null {
 const rows=[...source.matchAll(/[^\r\n]+/gu)].map(m=>({text:m[0].trim(),start:m.index!+m[0].indexOf(m[0].trim())}))
 const header=rows[0],heading=header?.text??'',topic=cleanHeading(heading)
 if(!header||!/(?:活动|日程|讲座|培训|交流|开放日|工作坊)/u.test(topic)||/取消|改期|延期|备选|任选/u.test(source))return null
 const pattern=/^(?<role>[\p{Script=Han}\d]{1,12}场)[：:]\s*(?<day>(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]|同日|当日|当天)\s*(?<clock>\d{1,2}[:：][0-5]\d\s*[-－—–至到]\s*\d{1,2}[:：][0-5]\d)\s*[，,]\s*(?:地点|场地)[：:]\s*(?<place>[^。；;，,\n]{1,80})[。；;]?$/u
 const candidates=rows.slice(1).filter(row=>/^[\p{Script=Han}\d]{1,12}场[：:]/u.test(row.text))
 const parsed=candidates.map(row=>({row,match:pattern.exec(row.text)})).filter(item=>item.match)
 if(parsed.length!==candidates.length)return null
 if(parsed.length<2||parsed.length>8)return null
 const lastRow=rows.indexOf(parsed[parsed.length-1].row)
 if(rows.slice(1,lastRow).some(row=>!candidates.includes(row)&&/^(?:【[^】]+】|(?:另一|另有|其他|第二个).{0,12}(?:活动|讲座|会议|培训))/u.test(row.text)))return null
 const first=parsed[0],date=first.match!.groups!.day
 if(/^(?:同日|当日|当天)$/u.test(date)||source.indexOf(first.row.text)!==source.lastIndexOf(first.row.text))return null
 const places=new Map<string,string>(),sessions:Session[]=[]
 for(const {row,match} of parsed){
  const {role,day,clock,place}=match!.groups!
  if(/报名|申请|提交|上传|缴费|领取|报送/u.test(role)||places.has(role)||source.indexOf(row.text)!==source.lastIndexOf(row.text))return null
  if(!/^(?:同日|当日|当天)$/u.test(day)&&day!==date)return null
  places.set(role,place.trim())
  sessions.push({role,displayTitle:`${topic} · ${role}`,line:{label:role+'时间',value:clock,start:row.start+row.text.indexOf(clock),whole:row.text,wholeStart:row.start}})
 }
 return {heading,date,sessions,places,dateAnchor:{quote:first.row.text,start:first.row.start}}
}

/** Resolve parallel event clauses through the same local event/venue extractor.
 * Every retained session has its own clock, venue and named event; a shared
 * date is inherited only from a unique source date and an explicit same-day
 * reference, or the existing compact one-line schedule. */
function inlineEventSessions(source:string):SessionSchedule|null {
 const dates=[...source.matchAll(/(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]/gu)]
 if(dates.length>1)return explicitlyDatedEventSessions(source,dates)
 if(dates.length!==1)return null
 const parts=[...source.matchAll(/[^，,；;。！？\r\n]+/gu)].map(m=>({text:m[0].trim(),start:m.index!+m[0].indexOf(m[0].trim())}))
 const compactSchedule=!/[\r\n]/u.test(source)&&parts.length>=2&&parts.length<=3
 const sessions:{line:LabelledLine;role:string}[]=[],places=new Map<string,string>()
 let dateHeading='',usesUnmarkedDate=false
 for(const part of parts){
  const m=/^(?:(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]|当天|同日|当日)?\s*((?:(?:上午|中午|下午|傍晚|晚上)\s*)?\d{1,2}[:：][0-5]\d(?:\s*[-—–至到]\s*(?:(?:上午|中午|下午|傍晚|晚上)\s*)?\d{1,2}[:：][0-5]\d)?)\s*在/u.exec(part.text)
  const location=m&&localEventLocation(part.text)
  if(!m||!location)continue
  const hasDate=part.text.includes(dates[0][0]),sameDay=/^(?:当天|同日|当日)/u.test(part.text)
  if(!hasDate&&(!dateHeading||part.start<dates[0].index!||!sameDay&&!compactSchedule))continue
  if(!hasDate&&!sameDay)usesUnmarkedDate=true
  if(/取消|作废|改期|延期|备选|调整|更正|通知|报名|提交|上传|填写/u.test(part.text)||places.has(location.name)||source.indexOf(part.text)!==source.lastIndexOf(part.text))return null
  const clocks=[...m[1].matchAll(/(\d{1,2})[:：]([0-5]\d)/gu)].map(x=>Number(x[1])*60+Number(x[2]))
  if(clocks.some(x=>x>=24*60)||clocks.length===2&&clocks[1]<=clocks[0])return null
  if(hasDate)dateHeading=part.text
  places.set(location.name,location.location);sessions.push({role:location.name,line:{label:location.name+'时间',value:m[1],start:part.start+part.text.indexOf(m[1]),whole:part.text,wholeStart:part.start}})
 }
 // Without an explicit “same day” marker, only inherit when the entire
 // compact sentence consists of these event clauses; an intervening notice
 // or a later unrelated clock must not acquire the first event's date.
 return dateHeading&&sessions.length>=2&&sessions.length<=8&&(!usesUnmarkedDate||sessions.length===parts.length)?{heading:dateHeading,date:dates[0][0],sessions,places}:null
}

/** Distinct explicitly dated clauses own their own date and clock. An omitted
 * year may use one preceding explicit year only when the dates progress within
 * that year; ambiguous rollover is left to the ordinary recognition path. */
function explicitlyDatedEventSessions(source:string,dates:RegExpMatchArray[]):SessionSchedule|null {
 if(dates.length<2||dates.length>8)return null
 const parts=[...source.matchAll(/[^，,；;。！？\r\n]+/gu)].map(m=>({text:m[0].trim(),start:m.index!+m[0].indexOf(m[0].trim())}))
 const sessions:Session[]=[],places=new Map<string,string>(),matchedDates=new Set<number>()
 const datePattern=/^(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]/u
 const explicitYears=new Set(dates.flatMap(d=>{const m=/^(\d{4})年/u.exec(d[0]);return m?[m[1]]:[]}))
 const firstDate=datePattern.exec(dates[0][0]),anchorYear=firstDate?.[1]??null
 // If all clauses omit the year, parse each one against the same fixed source
 // reference time only when the repeated calendar day itself is identical.
 // A later explicit year cannot anchor an earlier clause.
 if(!firstDate||!anchorYear&&explicitYears.size>0||explicitYears.size>1&&dates.some(d=>!/^\d{4}年/u.test(d[0])))return null
 if(!anchorYear&&new Set(dates.map(date=>date[0])).size!==1)return null
 const anchorMonthDay=Number(firstDate[2])*100+Number(firstDate[3])
 for(const part of parts){
  const heading=part===parts[0]?/^([^：:]{2,40}[：:])(?=(?:\d{4}年)?\d{1,2}月\d{1,2}[日号])/u.exec(part.text)?.[1]:undefined
  if(heading&&(!/(?:活动|日程|讲座|培训|交流|开放日|工作坊)/u.test(heading)||/报名|申请|提交|缴费|截止/u.test(heading)))return null
  const body=heading?part.text.slice(heading.length):part.text
  const m=/^((?:\d{4}年)?\d{1,2}月\d{1,2}[日号])\s*((?:(?:上午|中午|下午|傍晚|晚上)\s*)?\d{1,2}[:：][0-5]\d(?:\s*[-—–至到]\s*(?:(?:上午|中午|下午|傍晚|晚上)\s*)?\d{1,2}[:：][0-5]\d)?)\s*在/u.exec(body)
  if(!m)continue
  const location=localEventLocation(part.text),dateInfo=datePattern.exec(m[1])
  if(!location||!dateInfo||places.has(location.name)||source.indexOf(part.text)!==source.lastIndexOf(part.text)||/取消|作废|改期|延期|备选|调整|更正|报名|提交|上传|填写/u.test(part.text))return null
  const clocks=[...m[2].matchAll(/(\d{1,2})[:：]([0-5]\d)/gu)].map(x=>Number(x[1])*60+Number(x[2]))
  if(clocks.some(x=>x>=24*60)||clocks.length===2&&clocks[1]<=clocks[0])return null
  const yearFromHeading=Boolean(!dateInfo[1]&&anchorYear)
  if(!dateInfo[1]&&Number(dateInfo[2])*100+Number(dateInfo[3])<anchorMonthDay)return null
  const date=yearFromHeading?anchorYear+'年'+m[1]:m[1]
  matchedDates.add(part.start+(heading?.length??0))
  places.set(location.name,location.location)
  sessions.push({role:location.name,date,yearFromHeading,line:{label:location.name+'时间',value:m[2],start:part.start+part.text.indexOf(m[2]),whole:part.text,wholeStart:part.start}})
 }
 // Each date must belong to one complete event clause: a deadline, background
 // year or unanchored date is not a shared event date.
 if(sessions.length!==dates.length||dates.some(d=>!matchedDates.has(d.index!)))return null
 return {heading:sessions[0].line.whole,date:sessions[0].date!,sessions,places}
}

/** Preserve independently labelled sessions from one announcement. Labels
 * and parenthetical venue qualifiers are joined by the same source role,
 * never by their order. Source offsets stay attached to each fact. */
export function completeParallelSessions(input:RecognitionResult,source:string,localInline=false,sourceTimezone?:string):RecognitionResult {
 const timezone=sourceTimezone??input.timePoints.find(point=>point.timezone)?.timezone??'Asia/Shanghai'
 const parsedLines=lines(source)
 const timeLines=parsedLines.filter(l=>/^.{1,12}时间$/u.test(l.label)&&l.label!=='活动时间'&&l.label!=='会议时间'&&l.value&&l.value.length<=160&&l.whole.length<=500)
 // A failed local first projection can leave only a generic, unlinked event
 // placeholder. It is not evidence that a complete agenda already exists.
 // Named events and anything with existing task relations remain protected.
 const onlyUnlinkedPlaceholders=localInline&&input.events.length>0&&input.events.every(event=>/^(?:待核对事件|待确认事件)$/u.test(event.title)&&!event.relatedTaskTempIds?.length&&event.sourceStatus!=='alternative')
 const scheduleTable=input.events.length===0||onlyUnlinkedPlaceholders?eventScheduleTable(source,localInline):null
 const labelledSessions=localInline&&!scheduleTable?labelledSessionRows(source):null
 const inlineSessions=localInline&&!scheduleTable&&!labelledSessions?(sharedVenueSessionList(source)??headedVenueSessions(source)??weekdayInlineSessions(source)??scopedWeekdayInlineSessions(source)??weekdayLabelledVenueSessions(source)??namedWeekdayVenueSessions(source)??inlineEventSessions(source)):null
 const table=scheduleTable??labelledSessions??inlineSessions
 const sessions:Session[]=table?.sessions??timeLines.map(l=>({line:l,role:l.label.slice(0,-2).trim()})).filter(s=>s.role&&!/(?:报名|申请|提交|登记|上传|缴费|领取|报送|截止)$/u.test(s.role))
 if(sessions.length<2||sessions.length>8||new Set(sessions.map(s=>s.role)).size!==sessions.length)return input
 if(table&&sessions.some(s=>{const p=parseDirectSourceTime((s.date??table.date)+' '+s.line.value,{type:'event_start',referenceTime:input.createdAt,timezone});return !p.normalizedValue||Boolean(scheduleTable&&!p.rangeEndNormalizedValue)||p.needsConfirmation}))return input
 // A revision or cancellation needs its own existing interpretation; do not
 // reintroduce the old schedule from a list of labelled times.
 if(/取消|作废|不再(?:举办|举行)|原定|改期|延期|调整为|更正为|变更为/u.test(source))return input
 const header=table?.heading??source.split(/\r?\n/u).find(line=>line.trim())?.trim()??'',topic=cleanHeading(header)
 if(!topic||topic.length>100)return input
 const roleLine=parsedLines.find(l=>/^(?:活动|会议|举办|具体)?地点$/u.test(l.label)&&l.value&&l.whole.length<=500)
 const choices=roleLine?[...roleLine.value.matchAll(/(?:^|[、，,；;])\s*([^、，,；;（）()]+?)\s*[（(]([^（）()]+)[）)]/gu)].map(m=>({place:m[1].trim(),role:m[2].trim()})):[]
 const base=choices[0]?.place.match(/^(.{2,30}?(?:中心|大楼|大厦|校区|园区|图书馆|体育馆|教学楼))(?=.)/u)?.[1]
 const locationFor=(role:string)=>{
  if(table)return table.places.get(role)??null
  const matching=choices.filter(c=>roleKey(c.role)===roleKey(role))
  if(matching.length!==1){
   // One unqualified venue is shared; alternatives remain unassigned.
   return choices.length===0&&roleLine&&!/[、，,；;或]/u.test(roleLine.value)&&roleLine.value.length<=160?roleLine.value:null
  }
  const place=matching[0].place
  // The shared building and room must both occur in the same location line.
  return base&&place!==base&&!place.includes(base)&&/^(?:展厅|报告厅|会议室|多功能厅|大厅|教室|礼堂)/u.test(place)?base+' · '+place:place
 }
 const sourceId=input.evidence[0]?.sourceId??'source'
 const evidence=(id:string,quote:string,start:number,field:EvidenceReference['field']):EvidenceReference=>({id,sourceId,quote,quotedText:quote,textStart:start,textEnd:start+quote.length,field,extractionMethod:'parser',confidence:1})
 const headingStart=source.indexOf(header)
 const matchesRole=(event:EventSuggestion,role:string)=>{
  if(event.title.endsWith(' · '+role))return true
  return event.title.includes(role)&&sessions.filter(s=>event.title.includes(s.role)).length===1
 }
 const aggregate=input.events.filter(e=>!sessions.some(s=>e.title.endsWith(' · '+s.role))&&(sessions.every(s=>e.title.includes(s.role))||squash(cleanHeading(e.title))===squash(topic)||Boolean(table?.sharedVenueList&&!e.relatedTaskTempIds?.length&&/^(?:两|二|三|四|五|六|七|八|\d)场(?:活动|日程|讲座|培训|交流)?[：:]?$/u.test(e.title.trim())&&e.evidenceIds.some(id=>input.evidence.find(ref=>ref.id===id)?.quote===table.heading))))
 const r=structuredClone(input),removed=new Set(aggregate.map(e=>e.tempId))
 if(table){
  // The old local parser may have turned table rows into generic "核对"
  // tasks. Remove only placeholders whose evidence is the table itself;
  // separate real actions retain their own identities and dates.
  const headingQuote=rowsHeader(source)?table.heading+'\n'+rowsHeader(source):table.heading
  const tableQuotes=new Set([headingQuote,...table.sessions.map(s=>s.line.whole)].map(squash))
  const allTasks=[...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
  const artifactIds=new Set(allTasks.filter(t=>t.evidenceIds.some(id=>{
   const quote=r.evidence.find(e=>e.id===id)?.quote??''
   const exact=tableQuotes.has(squash(quote))&&(t.actionVerb==='核对'||squash(quote)===squash(headingQuote)&&!/(?:请|须|需|应|提交|上传|填写|报名)/u.test(quote))
   // A local tokenizer can also misread a session name such as “阅读分享”
   // as an action. Only demote it when the exact cited schedule row names
   // that event and there is no directive or independent relation attached.
   const nounArtifact=!t.materialTempIds.length&&!t.dependencyTempIds.length
    &&!allTasks.some(other=>other.tempId!==t.tempId&&(other.parentTempId===t.tempId||other.dependencyTempIds.includes(t.tempId)))
    &&!r.materials.some(material=>material.relatedTaskTempIds.includes(t.tempId)||material.goalScope?.taskTempIds.includes(t.tempId))
    &&!r.events.some(event=>event.relatedTaskTempIds?.includes(t.tempId))
    &&!r.goalGroups?.some(group=>group.taskTempIds.includes(t.tempId))
    &&!r.conflicts.some(conflict=>conflict.entityTempIds.includes(t.tempId))
    &&!/(?:请|须|需|应|务必)[^。；;\n]{0,24}(?:阅读|提交|上传|填写|报名|缴费|领取)/u.test(quote)
    &&table.sessions.some(session=>squash(quote)===squash(session.line.whole)&&(squash(t.title)===squash(session.role)||squash(t.actionVerb+t.actionObject)===squash(session.role)))
   // A parser placeholder can cite a session and the following welcome in a
   // single quote. It is not an independent delivery, but only remove it when
   // its named session and citation both agree and no relation depends on it.
   const inline=t.actionVerb==='核对'&&!t.materialTempIds.length&&!t.dependencyTempIds.length
    &&!allTasks.some(other=>other.tempId!==t.tempId&&(other.parentTempId===t.tempId||other.dependencyTempIds.includes(t.tempId)))
    &&!r.materials.some(material=>material.relatedTaskTempIds.includes(t.tempId)||material.goalScope?.taskTempIds.includes(t.tempId))
    &&!r.events.some(event=>event.relatedTaskTempIds?.includes(t.tempId))
    &&!r.goalGroups?.some(group=>group.taskTempIds.includes(t.tempId))
    &&!r.conflicts.some(conflict=>conflict.entityTempIds.includes(t.tempId))
    &&table.sessions.some(session=>quote.includes(session.line.whole)&&(t.title.includes(session.role)||t.actionObject.includes(session.role)))
    &&!/(?:请|须|需|应|务必)[^。；;\n]{0,24}(?:提交|上传|填写|报名|缴费|领取)/u.test(quote)
   return exact||inline||nounArtifact
  })).map(t=>t.tempId))
  const kept=(tasks:typeof r.standaloneTasks)=>tasks.filter(t=>!artifactIds.has(t.tempId)).map(t=>({...t,dependencyTempIds:t.dependencyTempIds.filter(id=>!artifactIds.has(id))}))
  r.standaloneTasks=kept(r.standaloneTasks)
  r.milestones=r.milestones.map(m=>({...m,tasks:kept(m.tasks),workPackages:m.workPackages.map(w=>({...w,tasks:kept(w.tasks)}))}))
  const retainedEventTimes=new Set(r.events.flatMap(event=>[event.startTimePointTempId,event.endTimePointTempId]))
  r.timePoints=r.timePoints.flatMap(point=>{
   if(!point.relatedTaskTempIds.some(id=>artifactIds.has(id)))return [point]
   const owners=point.relatedTaskTempIds.filter(id=>!artifactIds.has(id))
   return owners.length||point.relatedMaterialTempIds.length||retainedEventTimes.has(point.tempId)?[{...point,relatedTaskTempIds:owners}]:[]
  })
 }
 const previousPoints=new Set(aggregate.flatMap(e=>[e.startTimePointTempId,e.endTimePointTempId]).filter((id):id is string=>Boolean(id)))
 r.events=r.events.filter(e=>!removed.has(e.tempId))
 r.timePoints=r.timePoints.filter(p=>!previousPoints.has(p.tempId)||p.relatedTaskTempIds.length>0||p.relatedMaterialTempIds.length>0||r.events.some(e=>e.startTimePointTempId===p.tempId||e.endTimePointTempId===p.tempId))
 for(const p of r.timePoints){
  if(!['event_start','event_end'].includes(p.type))continue
  const owner=sessions.find(s=>[s.line.value,s.line.whole].some(quote=>squash(quote)===squash(p.rawText)))
  if(!owner)continue
  // A session's start/end is not the deadline or schedule of an unrelated
  // form submission. Keep an explicit attendance task for that session.
  p.relatedTaskTempIds=p.relatedTaskTempIds.filter(id=>r.standaloneTasks.some(t=>t.tempId===id&&t.actionVerb==='参加'&&(t.title.includes(owner.role)||t.actionObject.includes(owner.role))))
 }
 const commonDescription=(aggregate.find(e=>e.description.trim())?.description??'').split('\n').filter(line=>{
  const text=line.trim()
  return text&&squash(cleanHeading(text))!==squash(topic)&&!/^【[^】\n]+时间】/u.test(text)
 }).join('\n')
 // Preserve a short shared overview and labelled information link as notice
 // context. These are source excerpts, not facts assigned to one session.
 const afterHeader=Math.max(...sessions.map(s=>s.line.wholeStart),roleLine?.wholeStart??0)
 const overviewLines=[...source.matchAll(/[^\r\n]+/gu)].map(m=>({quote:m[0].trim(),start:m.index!+m[0].indexOf(m[0].trim())})).filter(p=>p.start>afterHeader&&p.quote.length>=25&&p.quote.length<=350&&!/^【|^(?:请|须|需|截止|报名)/u.test(p.quote)&&!/(?:请|须|需).{0,60}(?:填写|提交|报名|登记|上传)/u.test(p.quote)&&!/(?:\d{1,2}[:：]\d{2}|\d{1,2}月\d{1,2}[日号])/u.test(p.quote))
 // Keep short, explicitly notice-wide preparation as context, not as another
 // task. A named or ordinal session instruction is not shared with others.
 const sharedNotes=localInline&&/(?:两场|多场|各场|每场|所有场次)/u.test(source)?[...source.matchAll(/[^。！？\r\n]+[。！？]?/gu)].map(m=>({quote:m[0].trim(),start:m.index!+m[0].indexOf(m[0].trim())})).filter(p=>p.start>afterHeader&&p.quote.length>=4&&p.quote.length<=160&&/^(?:请|建议|注意|参与者)/u.test(p.quote)&&!/(?:第一场|第二场|上午场|下午场|本场|该场)/u.test(p.quote)&&!sessions.some(s=>p.quote.includes(s.role))&&!/(?:报名|填写|提交|上传|缴费|登记|申请|预约|领取|截止|取消|改期|变更|\d{1,2}[:：]\d{2}|\d{1,2}月\d{1,2}[日号])/u.test(p.quote)):[]
 const overviews=[...overviewLines,...sharedNotes].filter((item,index,items)=>items.findIndex(other=>other.start===item.start&&other.quote===item.quote)===index).slice(0,4)
 const linkedInfo=parsedLines.find(l=>/(?:信息|介绍|详情|说明)$/u.test(l.label)&&/^https?:\/\//u.test(l.value)&&l.whole.length<=500)
 for(const {line,role,date,yearFromHeading,displayTitle} of sessions){
  const current=r.events.find(e=>matchesRole(e,role)),id=current?.tempId??`direct-session:${line.wholeStart}`,timeId=table&&localInline?`direct-inline-time:${line.wholeStart}:start`:id+':start',endId=table&&localInline?`direct-inline-time:${line.wholeStart}:end`:id+':end',headingId=id+':heading',lineId=id+':time',placeId=id+':location',anchorId=id+':date-anchor'
  const parsed=parseDirectSourceTime(table?(date??table.date)+' '+line.value:line.value,{type:'event_start',referenceTime:r.createdAt,timezone})
  const selectedTime=parsed.normalizedValue&&!parsed.needsConfirmation?parsed.normalizedValue:null
  const point=(tempId:string,type:'event_start'|'event_end',value:string):TimePointSuggestionV2=>({tempId,type,rawText:line.value,normalizedValue:value,timezone:parsed.timezone,isAllDay:parsed.isAllDay,precision:parsed.precision,needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:table&&(!date||yearFromHeading)?[headingId,lineId,...(table.dateAnchor?[anchorId]:[])]:[lineId],confidence:1,selected:true})
  r.evidence=r.evidence.filter(e=>![headingId,lineId,placeId,anchorId,id+':linked-info'].includes(e.id)&&!e.id.startsWith(id+':overview:'))
  r.evidence.push(evidence(headingId,header,headingStart,'event'),evidence(lineId,line.whole,line.wholeStart,'event'))
  if(table?.dateAnchor)r.evidence.push(evidence(anchorId,table.dateAnchor.quote,table.dateAnchor.start,'event'))
  if(roleLine)r.evidence.push(evidence(placeId,roleLine.whole,roleLine.wholeStart,'event'))
  const oldPoints=[current?.startTimePointTempId,current?.endTimePointTempId]
  if(selectedTime)r.timePoints=r.timePoints.filter(p=>!oldPoints.includes(p.tempId)||p.relatedTaskTempIds.length>0||p.relatedMaterialTempIds.length>0||r.events.some(e=>e.tempId!==id&&(e.startTimePointTempId===p.tempId||e.endTimePointTempId===p.tempId)))
  if(selectedTime)r.timePoints.push(point(timeId,'event_start',selectedTime))
  const end=selectedTime&&parsed.rangeEndNormalizedValue?parsed.rangeEndNormalizedValue:null
  if(end)r.timePoints.push(point(endId,'event_end',end))
  let description=(current?.description??commonDescription).trim()
  const supplementalIds:string[]=[]
  // A continuation immediately after this session's own clause describes
  // that session, provided it does not introduce another event or a separate
  // submission. Keep its literal, bounded source span for later tracing.
  const following=source.slice(line.wholeStart+line.whole.length).match(/^[，,]\s*([^。！？\n]{2,180})/u)
  const sessionText=following?.[1].trim()
  if(localInline&&sessionText&&!/(?:报名|提交|上传|缴费|截止)/u.test(sessionText)&&!sessions.some(s=>s.role!==role&&sessionText.includes(s.role))&&!squash(description).includes(squash(sessionText))){
   const quote=line.whole+following![0],detailId=id+':session-detail'
   description+=(description?'\n':'')+'活动内容：'+sessionText
   r.evidence.push(evidence(detailId,quote,line.wholeStart,'description'));supplementalIds.push(detailId)
  }
  for(const item of [...overviews.map((overview,index)=>({quote:overview.quote,start:overview.start,id:id+':overview:'+index,text:overview.quote})),linkedInfo&&{quote:linkedInfo.whole,start:linkedInfo.wholeStart,id:id+':linked-info',text:linkedInfo.label+'：'+linkedInfo.value}]){
   if(!item)continue
   const text=item.text.split(/(?<=[。！？])/u).filter(part=>part.trim()&&!squash(description).includes(squash(part))).join('').trim()
   if(!text||description.length+text.length>2200)continue
   description+=(description?'\n':'')+'通知补充：'+text;r.evidence.push(evidence(item.id,item.quote,item.start,'description'));supplementalIds.push(item.id)
  }
  const requiredRefs=[headingId,lineId,...(roleLine?[placeId]:[]),...supplementalIds]
  const title=table?displayTitle??role:current&&squash(source).includes(squash(current.title))?current.title:`${topic} · ${role}`
  const event:EventSuggestion={tempId:id,title,description,location:locationFor(role)??current?.location??null,startTimePointTempId:selectedTime?timeId:current?.startTimePointTempId??null,endTimePointTempId:end?endId:selectedTime?null:current?.endTimePointTempId??null,evidenceIds:[...new Set([...(current?.evidenceIds??aggregate[0]?.evidenceIds??[]).slice(0,Math.max(0,20-requiredRefs.length)),...requiredRefs])],confidence:current?.confidence??1,inferenceLevel:current?.inferenceLevel??'explicit',selected:true,relatedTaskTempIds:current?.relatedTaskTempIds??[]}
  r.events=r.events.filter(e=>e.tempId!==id);r.events.push(event)
 }
 r.timePoints=r.timePoints.filter(p=>p.relatedTaskTempIds.length>0||p.relatedMaterialTempIds.length>0||r.events.some(e=>e.startTimePointTempId===p.tempId||e.endTimePointTempId===p.tempId)||!sessions.some(s=>[s.line.value,s.line.whole].some(quote=>squash(quote)===squash(p.rawText))))
 return r
}

/** Recover a bare registration action only when its own clause explicitly
 * names the participating group and exactly one retained event. Its deadline
 * belongs to that action, never to the event or to a different session. */
export function retainNamedEventRegistration(input:RecognitionResult,source:string,sourceTimezone?:string):RecognitionResult {
 if(input.modelName!=='local-rules'||!input.events.length||input.standaloneTasks.length>=20||input.evidence.length>117)return input
 const tasks=[...input.standaloneTasks,...input.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
 const candidates=[...source.matchAll(/[^，,。；;！？\n]+/gu)].flatMap(part=>{
  const quote=part[0].trim(),at=part.index!+part[0].indexOf(quote)
  const match=/(?:参加|参与)([^，,。；;\n]{2,24}?)(?:的同学|的学生|的人员|的人|的师生|者)(?:须|需|应|请)[^，,。；;\n]{0,45}报名/u.exec(quote)
  if(!match||source.indexOf(quote)!==source.lastIndexOf(quote)||/(?:无需|无须|不必|不用|不要|不得|禁止|取消|不再|不需要)[^，,。；;\n]{0,15}报名/u.test(quote)||/(?:填写|填报|提交|问卷|表格|报名表)/u.test(quote))return []
  const subject=match[1].trim(),eventMatches=input.events.filter(event=>squash(event.title).includes(squash(subject)))
  if(eventMatches.length!==1||tasks.some(task=>/^(?:报名|登记|填写|填报)$/u.test(task.actionVerb)&&task.evidenceIds.some(id=>{
   const ref=input.evidence.find(value=>value.id===id),text=ref?.quote??''
   return text.includes(subject)&&text.includes('报名')&&source.includes(text)
  })))return []
  const dates=[...quote.matchAll(/(?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天]\s*(?:(?:上午|中午|下午|晚上|早上)\s*)?(?:\d{1,2}\s*[:：]\s*\d{2})?\s*(?:之前|以前|前)/gu)]
  if(dates.length>1)return []
  return [{quote,at,subject,event:eventMatches[0],date:dates[0]}]
 })
 if(candidates.length!==1)return input
 const c=candidates[0],result=structuredClone(input),id=`local-event-registration:${c.at}`,eid=id+':evidence',tid=id+':deadline',sourceId=result.evidence[0]?.sourceId??'source'
 if(result.evidence.some(ref=>ref.id===eid))return input
 result.evidence.push({id:eid,sourceId,quote:c.quote,quotedText:c.quote,textStart:c.at,textEnd:c.at+c.quote.length,field:'description',extractionMethod:'parser',confidence:1})
 const timezone=sourceTimezone??result.timePoints.find(point=>point.timezone)?.timezone??'Asia/Shanghai'
 const parsed=c.date?parseDirectSourceTime(c.date[0],{type:'task_deadline',referenceTime:result.createdAt,timezone}):null
 const hasTime=Boolean(parsed?.normalizedValue&&!parsed.needsConfirmation)
 if(hasTime&&c.date&&parsed){
  const timeId=id+':time-evidence',start=c.at+c.date.index!
  result.evidence.push({id:timeId,sourceId,quote:c.date[0],quotedText:c.date[0],textStart:start,textEnd:start+c.date[0].length,field:'deadline',extractionMethod:'parser',confidence:1})
  result.timePoints.push({tempId:tid,type:'task_deadline',rawText:c.date[0],normalizedValue:parsed.normalizedValue,timezone:parsed.timezone,isAllDay:parsed.isAllDay,precision:parsed.precision,needsConfirmation:false,relatedTaskTempIds:[id],relatedMaterialTempIds:[],evidenceIds:[timeId],confidence:1,selected:true})
 }
 result.standaloneTasks.push({tempId:id,parentTempId:null,hierarchyType:'task',title:'报名'+c.subject,actionVerb:'报名',actionObject:c.subject,description:c.quote,completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:hasTime?[tid]:[],evidenceIds:[eid],confidence:1,inferenceLevel:'explicit',userConfirmationRequired:true,selected:false})
 const event=result.events.find(item=>item.tempId===c.event.tempId)!
 event.relatedTaskTempIds=[...new Set([...(event.relatedTaskTempIds??[]),id])]
 return result
}

/** “为某场活动报名” names the event before the verb. Normalize an existing
 * locally parsed registration, or retain a missing one, only when its cited
 * event has exactly one owner and the action is explicitly affirmative. */
export function retainForEventRegistration(input:RecognitionResult,source:string,sourceTimezone?:string):RecognitionResult {
 if(input.modelName!=='local-rules'||!input.events.length||input.evidence.length>117)return input
 const candidates=[...source.matchAll(/[^，,。；;！？\n]+/gu)].flatMap(part=>{
  const quote=part[0].trim(),at=part.index!+part[0].indexOf(quote)
  const match=/(?:请|须|需|应|务必)[^，,。；;\n]{0,45}?为\s*([^，,。；;\n]{2,24}?)\s*报名/u.exec(quote)
  if(!match||source.indexOf(quote)!==source.lastIndexOf(quote)||/(?:无需|无须|不必|不用|不要|不得|禁止|取消|不再|不需要)[^，,。；;\n]{0,15}报名/u.test(quote))return []
  const subject=match[1].trim(),events=input.events.filter(event=>squash(event.title)===squash(subject))
  const dates=[...quote.matchAll(/(?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天]\s*(?:(?:上午|中午|下午|晚上|早上)\s*)?(?:\d{1,2}\s*[:：]\s*\d{2})?\s*(?:之前|以前|前)/gu)]
  return events.length===1&&dates.length<=1?[{quote,at,subject,event:events[0],date:dates[0]}]:[]
 })
 if(candidates.length!==1)return input
 const c=candidates[0],tasks=[...input.standaloneTasks,...input.milestones.flatMap(stage=>[...stage.tasks,...stage.workPackages.flatMap(group=>group.tasks)])]
 const existing=tasks.filter(task=>task.actionVerb==='报名'&&task.actionObject.includes(c.subject)&&task.evidenceIds.some(id=>{
  const quote=input.evidence.find(ref=>ref.id===id)?.quote??''
  return quote.includes(c.quote)&&source.includes(quote)
 }))
 if(existing.length>1||!existing.length&&input.standaloneTasks.length>=20)return input
 const result=structuredClone(input),id=existing[0]?.tempId??`local-for-event:${c.at}`,eid=`local-for-event:${c.at}:evidence`,tid=`local-for-event:${c.at}:deadline`
 if(result.evidence.some(ref=>ref.id===eid))return input
 result.evidence.push({id:eid,sourceId:result.evidence[0]?.sourceId??'source',quote:c.quote,quotedText:c.quote,textStart:c.at,textEnd:c.at+c.quote.length,field:'description',extractionMethod:'parser',confidence:1})
 const all=[...result.standaloneTasks,...result.milestones.flatMap(stage=>[...stage.tasks,...stage.workPackages.flatMap(group=>group.tasks)])]
 let task=all.find(item=>item.tempId===id)
 if(task){task.title='报名'+c.subject;task.actionObject=c.subject;task.evidenceIds=[...new Set([...task.evidenceIds,eid])]}
 else {
  task={tempId:id,parentTempId:null,hierarchyType:'task',title:'报名'+c.subject,actionVerb:'报名',actionObject:c.subject,description:c.quote,completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:[eid],confidence:1,inferenceLevel:'explicit',userConfirmationRequired:true,selected:true}
  result.standaloneTasks.push(task)
 }
 const timezone=sourceTimezone??result.timePoints.find(point=>point.timezone)?.timezone??'Asia/Shanghai'
 const parsed=c.date?parseDirectSourceTime(c.date[0],{type:'task_deadline',referenceTime:result.createdAt,timezone}):null
 if(c.date&&parsed?.normalizedValue&&!parsed.needsConfirmation&&!result.timePoints.some(point=>point.relatedTaskTempIds.includes(id)&&point.type==='task_deadline'&&point.normalizedValue)){
  const stale=new Set(result.timePoints.filter(point=>point.relatedTaskTempIds.length===1&&point.relatedTaskTempIds[0]===id&&point.type.endsWith('_deadline')&&!point.normalizedValue&&!point.relatedMaterialTempIds.length).map(point=>point.tempId))
  result.timePoints=result.timePoints.filter(point=>!stale.has(point.tempId));task.timePointTempIds=task.timePointTempIds.filter(timeId=>!stale.has(timeId))
  result.timePoints.push({tempId:tid,type:'task_deadline',rawText:c.date[0],normalizedValue:parsed.normalizedValue,timezone:parsed.timezone,isAllDay:parsed.isAllDay,precision:parsed.precision,needsConfirmation:false,relatedTaskTempIds:[id],relatedMaterialTempIds:[],evidenceIds:[eid],confidence:1,selected:true})
  task.timePointTempIds.push(tid)
 }
 const event=result.events.find(item=>item.tempId===c.event.tempId)!
 event.relatedTaskTempIds=[...new Set([...(event.relatedTaskTempIds??[]),id])]
 return result
}

/** An explicitly referenced form URL is a channel for that action, not a new
 * task. Only look after the action; a jobs-information link before it cannot
 * be silently substituted for the form. */
export function linkFollowingFormChannel(input:RecognitionResult,source:string):RecognitionResult {
 let r=input
 for(const task of input.standaloneTasks){
  if(!/^(?:填写|填报|提交|登记)$/u.test(task.actionVerb)||!/问卷|表格|报名表/u.test(task.actionObject))continue
  const refs=input.evidence.filter(e=>task.evidenceIds.includes(e.id)&&typeof e.textStart==='number'&&source.slice(e.textStart,e.textEnd)===e.quotedText)
  const ref=refs.find(e=>/(?:下方|以下|扫码|链接)/u.test(e.quotedText??''))
  if(!ref||typeof ref.textEnd!=='number')continue
  const subject=/(?:参加|参与)([^，,。；;\n]{1,30}?)(?:的同学|的学生|的人员)[^。；\n]{0,80}?(?:填写|填报)(?:下方|以下)?问卷/u.exec(ref.quotedText??'')?.[1]
  if(subject&&/^填写(?:下方|以下)?问卷$/u.test(task.title)){
   if(r===input)r=structuredClone(input)
   r.standaloneTasks.find(t=>t.tempId===task.tempId)!.title='填写'+subject+'问卷'
  }
  const after=source.slice(ref.textEnd,ref.textEnd+240),m=/^[^\n]*\n[ \t]*(?:【[^】\n]*(?:文档|问卷|报名|表单|链接)[^】\n]*】[^\n]*?\n?[ \t]*)?(https?:\/\/[^\s，。；;]+)/u.exec(after)
  if(!m)continue
  const url=m[1],start=ref.textEnd+m[0].lastIndexOf(url),existing=input.materials.find(x=>x.relatedTaskTempIds.includes(task.tempId))
  if(existing?.submissionChannel)continue
  if(r===input)r=structuredClone(input)
  const id=`direct-form-channel:${start}`,sourceId=ref.sourceId
  r.evidence.push({id,sourceId,quote:url,quotedText:url,textStart:start,textEnd:start+url.length,field:'description',extractionMethod:'parser',confidence:1})
  const target=r.standaloneTasks.find(t=>t.tempId===task.tempId)!
  const material=existing&&r.materials.find(x=>x.tempId===existing.tempId)
  if(material){material.submissionChannel=url;material.evidenceIds.push(id)}
  else {const mid=id+':material';r.materials.push({tempId:mid,name:task.actionObject,required:true,formatRequirements:[],namingRequirements:[],quantity:null,submissionChannel:url,relatedTaskTempIds:[task.tempId],evidenceIds:[...task.evidenceIds,id],confidence:1,selected:true});target.materialTempIds.push(mid)}
 }
 return r
}

/** A local fallback may summarize a registration as "申请 + heading" and cite
 * the heading and deadline separately. Link it only when the one event cites
 * that exact heading too, and the notice states a concrete registration form.
 * This preserves both entities and their independent completion states. */
function sharedHeadingRegistrationOwner(input:RecognitionResult,task:RecognitionResult['standaloneTasks'][number],source:string):EventSuggestion|null {
 if(input.events.length!==1||!/^(?:报名|登记|申请|申报|填写|填报|提交)$/u.test(task.actionVerb))return null
 const match=/^\s*([^\r\n]{1,120})/u.exec(source),heading=match?.[1]
 if(!heading||!/(?:报名|招募|申请|登记)/u.test(heading)||source.indexOf(heading)!==source.lastIndexOf(heading))return null
 const forms=[...source.matchAll(/(?:填写|填报|提交|完成)[^。；;\n]{0,24}(?:报名|登记|申请)[^。；;\n]{0,12}(?:表|问卷|表单)/gu)]
 const positiveForm=forms.some(form=>{
  const before=source.slice(Math.max(0,form.index-20),form.index)
  return !/(?:无需|无须|不必|不用|不需要|不要求|请勿|禁止|不得|取消)[^。；;\n]{0,8}$/u.test(before)
 })
 if(!positiveForm)return null
 const event=input.events[0],eventName=squash(event.title),object=squash(task.actionObject),headingKey=squash(heading)
 if(!eventName||!headingKey.includes(eventName))return null
 const start=source.indexOf(heading)
 const refs=(ids:string[])=>input.evidence.filter(e=>ids.includes(e.id)&&typeof e.textStart==='number'&&typeof e.textEnd==='number'&&source.slice(e.textStart,e.textEnd)===(e.quotedText||e.quote||''))
 const taskRefs=refs(task.evidenceIds),eventRefs=refs(event.evidenceIds)
 const citesHeading=(e:EvidenceReference)=>e.textStart===start&&e.textEnd===start+heading.length&&(e.quotedText||e.quote)===heading
 // A source-labelled registration method under the same uniquely named event
 // is an explicit form action, even when its title does not repeat the event.
 // Refuse cross-topic headings and multiple form candidates.
 const labelledRefs=taskRefs.filter(ref=>{
  const quote=ref.quotedText||ref.quote||''
  return /(?:报名|申请|登记)方式[：:]/u.test(quote)&&quote.includes(task.actionVerb+task.actionObject)
 })
 const labelledForm=/^(?:填写|填报|提交)$/u.test(task.actionVerb)&&/(?:报名|登记|申请)(?:表|问卷|表单)$/u.test(task.actionObject)&&forms.length===1&&labelledRefs.length===1
 const between=labelledForm?source.slice(start+heading.length,labelledRefs[0].textStart):''
 const otherHeadings=[...between.matchAll(/(?:^|\n)\s*【([^】\n]+)】/gu)].map(match=>match[1])
 const sameSection=Boolean(labelledForm&&labelledRefs[0].textStart!>=start+heading.length)&&otherHeadings.every(value=>/^(?:(?:活动|报名|申请|登记|提交|会议|讲座)?(?:时间|地点|方式|截止日期|截止时间|须知|说明))$/u.test(value))
 if(labelledForm&&sameSection&&eventRefs.some(citesHeading))return event
 if(object.length<4||!eventName.includes(object))return null
 if(!taskRefs.some(citesHeading)||!eventRefs.some(citesHeading)||!taskRefs.some(e=>/(?:报名|申请|登记)[^\n]{0,16}(?:截止|截至)/u.test(e.quotedText||e.quote||'')))return null
 return event
}

/** Link a preparation action only when its own source sentence names the
 * activity it prepares for and that name has exactly one event owner. Dates,
 * a shared source or a superficially similar task title are not relations. */
export function linkReferencedEventActions(input:RecognitionResult,source:string):RecognitionResult {
 let result=input
 const tasks=[...input.standaloneTasks,...input.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
 for(const task of tasks){
  if(!/^(?:填写|填报|报名|登记|提交|上传|预约|申请)$/u.test(task.actionVerb))continue
  const citations=input.evidence.filter(e=>task.evidenceIds.includes(e.id)).flatMap(e=>{
   const quote=e.quotedText||e.quote||'',at=e.textStart
   return quote&&typeof at==='number'&&source.slice(at,at+quote.length)===quote?[quote]:[]
  })
  const actionClauses=citations.flatMap(quote=>quote.split(/[。！？；;\n]/u)).filter(clause=>clause.includes(task.actionVerb)&&squash(clause).includes(squash(task.actionObject)))
  const subjects=actionClauses.flatMap(clause=>[...clause.matchAll(/(?:参加|参与|报名参加)([^，,。；;\n]{1,24}?)(?:的同学|的学生|的人员|的人|的师生|者)/gu)].filter(m=>!/(?:不|无需|无须|不必|不再|取消)\s*$/u.test(clause.slice(0,m.index))).map(m=>m[1].trim()))
  const genericAttendees=subjects.length===0&&actionClauses.some(clause=>/(?:参加者|参与者|参会者)/u.test(clause))&&input.events.length===1&&!/其他活动|另一场|各场|分别/u.test(source)
  const headingOwner=subjects.length===0&&!genericAttendees?sharedHeadingRegistrationOwner(input,task,source):null
  // A prohibition for a different session must not cancel this action's
  // relation. Check the cited action and object in their own clause instead.
  if(subjects.length!==1&&!genericAttendees&&!headingOwner||actionClauses.some(clause=>localActionExplicitlyNegated(clause,task.actionVerb,task.actionObject)))continue
  const subject=headingOwner?'':genericAttendees?'本次活动':squash(subjects[0]),eventMatches=headingOwner?[headingOwner]:input.events.filter(event=>{
   if(/^(?:参加|参与).{1,60}(?:的同学|的学生|的人员)$/u.test(event.title.trim()))return false
   const name=squash(event.title),unqualified=name.replace(/宣讲(?=会)/gu,'')
   return subject.length>=2&&(name.includes(subject)||unqualified.includes(subject)||/^(?:本次活动|此次活动|该活动)$/u.test(subject)&&input.events.length===1)
  })
  if(eventMatches.length!==1)continue
  const event=eventMatches[0]
  // Attendance relations use a different projection; do not change their
  // existing pairing semantics while adding preparation actions.
  if((event.relatedTaskTempIds??[]).some(id=>tasks.some(t=>t.tempId===id&&t.actionVerb==='参加')))continue
  if(event.relatedTaskTempIds?.includes(task.tempId))continue
  if(result===input)result=structuredClone(input)
  const target=result.events.find(e=>e.tempId===event.tempId)!
  target.relatedTaskTempIds=[...new Set([...(target.relatedTaskTempIds??[]),task.tempId])]
 }
 return result
}
