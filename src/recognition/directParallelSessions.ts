import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import type {EvidenceReference} from '../types'
import type {EventSuggestion, RecognitionResult, TimePointSuggestionV2} from './types'
import {localEventLocation} from './localNoticeFacts'

type LabelledLine={label:string;value:string;start:number;whole:string;wholeStart:number}
type Session={line:LabelledLine;role:string;date?:string;yearFromHeading?:boolean}
type SessionSchedule={heading:string;date:string;sessions:Session[];places:Map<string,string>}
const lines=(source:string):LabelledLine[]=>[...source.matchAll(/(?:^|\n)[ \t]*(?:【([^】\n]+)】|([^：:\n]{1,20})[：:])[ \t]*[：:]?[ \t]*([^\r\n]*)/gu)].map(m=>{
 const value=m[3].trim(),whole=m[0].replace(/^\n/u,'').trim(),wholeStart=m.index!+m[0].indexOf(whole)
 return {label:(m[1]??m[2]).trim(),value,start:wholeStart+whole.indexOf(value),whole,wholeStart}
})
const squash=(s:string)=>s.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'')
const roleKey=(s:string)=>squash(s).replace(/(?:活动|环节|阶段|专场|会)$/u,'')
const cleanHeading=(s:string)=>s.replace(/\[[^\]\n]{1,8}\]/gu,'').replace(/^【|】$/gu,'').trim()

const rowsHeader=(source:string)=>source.split(/\r?\n/u).map(s=>s.trim()).find(s=>{const c=s.split(/[|｜]/u).map(x=>x.trim());return c.length===3&&c[0]==='时间'&&/^(?:项目|活动|日程)$/u.test(c[1])&&/^(?:地点|场地)$/u.test(c[2])})??''

/** Parse a dated event schedule as rows, preserving literal source offsets. */
function eventScheduleTable(source:string,extended=false):{heading:string;date:string;sessions:{line:LabelledLine;role:string}[];places:Map<string,string>}|null {
 const rows=[...source.matchAll(/[^\r\n]+/gu)].map(m=>({text:m[0].trim(),start:m.index!+m[0].indexOf(m[0].trim())}))
 const cells=(s:string)=>s.split(/[|｜]/u).map(x=>x.trim())
 const headerIndexes=rows.flatMap((row,index)=>{const c=cells(row.text);return c.length===3&&c[0]==='时间'&&/^(?:项目|活动|日程)$/u.test(c[1])&&/^(?:地点|场地)$/u.test(c[2])?[index]:[]})
 if(headerIndexes.length>1)return null
 // Both a labelled table and numbered, three-column event lines convey a
 // shared schedule. Require an adjacent dated heading and complete rows.
 const numbered=headerIndexes.length===0
 if(numbered&&!extended)return null
 const index=numbered?1:headerIndexes[0]+1,heading=numbered?rows[0]:rows[index-2]
 const headingTopic=heading?.text.replace(/(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]/gu,'')??''
 const explicitEvent=/(?:活动|日程|讲座|培训|工作坊)/u.test(headingTopic)
 const datedEventLabel=extended&&(/[\p{Script=Han}](?:日|周|节|季)(?:[】\]：:]|$)/u.test(headingTopic)||/[\p{Script=Han}](?:日|周|节|季|月)(?:的)?安排/u.test(headingTopic))
 if(!heading||!explicitEvent&&!datedEventLabel||/报名|申请|提交|上传|缴费|截止/u.test(headingTopic))return null
 const dates=[...heading.text.matchAll(/(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]/gu)]
 if(dates.length!==1||source.indexOf(heading.text)!==source.lastIndexOf(heading.text)||/取消|改期|待定|备选|或/u.test(heading.text))return null
 const sessions:{line:LabelledLine;role:string}[]=[],places=new Map<string,string>()
 for(const row of rows.slice(index)){
  const numberedRow=numbered?/^(?:[①②③④⑤⑥⑦⑧⑨⑩]|\d{1,2}[.、)]|【[^】\n]{1,16}】)\s*(.+)$/u.exec(row.text)?.[1]:null
  const c=numbered?(numberedRow?.replace(/[。；;]$/u,'').split(/[，,]/u).map(x=>x.trim())??[]):cells(row.text)
  // A malformed row must not silently turn a partial schedule into a complete one.
  if(c.length!==3){if(numbered&&numberedRow||!numbered&&/[|｜]/u.test(row.text))return null;break}
  const [time,role,place]=c
  const hours=/^(\d{1,2}):([0-5]\d)\s*[-—–至到]\s*(\d{1,2}):([0-5]\d)$/u.exec(time)
  // An action row is a user obligation, not evidence of a scheduled event.
  // Ambiguous or overnight ranges are left for the ordinary parser; inferring
  // the following day from a compact table would manufacture a date.
  if(!hours||Number(hours[1])>23||Number(hours[3])>23||Number(hours[1])*60+Number(hours[2])>=Number(hours[3])*60+Number(hours[4])||!role||/^(?:请|须|需|填写|填报|提交|递交|上传|报送|登记|申请|缴费|领取)/u.test(role)||role.length>40||!place||place.length>80||/取消|改期|待定|备选|或/u.test(row.text)||places.has(role)||source.indexOf(row.text)!==source.lastIndexOf(row.text))return null
  places.set(role,place);sessions.push({role,line:{label:role+'时间',value:time,start:row.start+row.text.indexOf(time),whole:row.text,wholeStart:row.start}})
 }
 return sessions.length>=2&&sessions.length<=8?{heading:heading.text,date:dates[0][0],sessions,places}:null
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
 if(!firstDate||!anchorYear||explicitYears.size>1&&dates.some(d=>!/^\d{4}年/u.test(d[0])))return null
 const anchorMonthDay=Number(firstDate[2])*100+Number(firstDate[3])
 for(const part of parts){
  const m=/^((?:\d{4}年)?\d{1,2}月\d{1,2}[日号])\s*((?:(?:上午|中午|下午|傍晚|晚上)\s*)?\d{1,2}[:：][0-5]\d(?:\s*[-—–至到]\s*(?:(?:上午|中午|下午|傍晚|晚上)\s*)?\d{1,2}[:：][0-5]\d)?)\s*在/u.exec(part.text)
  if(!m)continue
  const location=localEventLocation(part.text),dateInfo=datePattern.exec(m[1])
  if(!location||!dateInfo||places.has(location.name)||source.indexOf(part.text)!==source.lastIndexOf(part.text)||/取消|作废|改期|延期|备选|调整|更正|报名|提交|上传|填写/u.test(part.text))return null
  const clocks=[...m[2].matchAll(/(\d{1,2})[:：]([0-5]\d)/gu)].map(x=>Number(x[1])*60+Number(x[2]))
  if(clocks.some(x=>x>=24*60)||clocks.length===2&&clocks[1]<=clocks[0])return null
  const yearFromHeading=Boolean(!dateInfo[1]&&anchorYear)
  if(!dateInfo[1]&&Number(dateInfo[2])*100+Number(dateInfo[3])<anchorMonthDay)return null
  const date=yearFromHeading?anchorYear+'年'+m[1]:m[1]
  matchedDates.add(part.start)
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
export function completeParallelSessions(input:RecognitionResult,source:string,localInline=false):RecognitionResult {
 const parsedLines=lines(source)
 const timeLines=parsedLines.filter(l=>/^.{1,12}时间$/u.test(l.label)&&l.label!=='活动时间'&&l.label!=='会议时间'&&l.value&&l.value.length<=160&&l.whole.length<=500)
 const scheduleTable=input.events.length===0?eventScheduleTable(source,localInline):null
 const inlineSessions=localInline&&!scheduleTable?inlineEventSessions(source):null
 const table=scheduleTable??inlineSessions
 const sessions:Session[]=table?.sessions??timeLines.map(l=>({line:l,role:l.label.slice(0,-2).trim()})).filter(s=>s.role&&!/(?:报名|申请|提交|登记|上传|缴费|领取|报送|截止)$/u.test(s.role))
 if(sessions.length<2||sessions.length>8||new Set(sessions.map(s=>s.role)).size!==sessions.length)return input
 if(table&&sessions.some(s=>{const p=parseDirectSourceTime((s.date??table.date)+' '+s.line.value,{type:'event_start',referenceTime:input.createdAt,timezone:'Asia/Shanghai'});return !p.normalizedValue||Boolean(scheduleTable&&!p.rangeEndNormalizedValue)||p.needsConfirmation}))return input
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
 const aggregate=input.events.filter(e=>!sessions.some(s=>e.title.endsWith(' · '+s.role))&&(sessions.every(s=>e.title.includes(s.role))||squash(cleanHeading(e.title))===squash(topic)))
 const r=structuredClone(input),removed=new Set(aggregate.map(e=>e.tempId))
 if(table){
  // The old local parser may have turned table rows into generic "核对"
  // tasks. Remove only placeholders whose evidence is the table itself;
  // separate real actions retain their own identities and dates.
  const headingQuote=rowsHeader(source)?table.heading+'\n'+rowsHeader(source):table.heading
  const tableQuotes=new Set([headingQuote,...table.sessions.map(s=>s.line.whole)].map(squash))
  const artifactIds=new Set([...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])].filter(t=>t.evidenceIds.some(id=>{const quote=r.evidence.find(e=>e.id===id)?.quote??'';return tableQuotes.has(squash(quote))&&(t.actionVerb==='核对'||squash(quote)===squash(headingQuote)&&!/(?:请|须|需|应|提交|上传|填写|报名)/u.test(quote))})).map(t=>t.tempId))
  const kept=(tasks:typeof r.standaloneTasks)=>tasks.filter(t=>!artifactIds.has(t.tempId)).map(t=>({...t,dependencyTempIds:t.dependencyTempIds.filter(id=>!artifactIds.has(id))}))
  r.standaloneTasks=kept(r.standaloneTasks)
  r.milestones=r.milestones.map(m=>({...m,tasks:kept(m.tasks),workPackages:m.workPackages.map(w=>({...w,tasks:kept(w.tasks)}))}))
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
 for(const {line,role,date,yearFromHeading} of sessions){
  const current=r.events.find(e=>matchesRole(e,role)),id=current?.tempId??`direct-session:${line.wholeStart}`,timeId=table&&localInline?`direct-inline-time:${line.wholeStart}:start`:id+':start',endId=table&&localInline?`direct-inline-time:${line.wholeStart}:end`:id+':end',headingId=id+':heading',lineId=id+':time',placeId=id+':location'
  const parsed=parseDirectSourceTime(table?(date??table.date)+' '+line.value:line.value,{type:'event_start',referenceTime:r.createdAt,timezone:'Asia/Shanghai'})
  const selectedTime=parsed.normalizedValue&&!parsed.needsConfirmation?parsed.normalizedValue:null
  const point=(tempId:string,type:'event_start'|'event_end',value:string):TimePointSuggestionV2=>({tempId,type,rawText:line.value,normalizedValue:value,timezone:parsed.timezone,isAllDay:parsed.isAllDay,precision:parsed.precision,needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:table&&(!date||yearFromHeading)?[headingId,lineId]:[lineId],confidence:1,selected:true})
  r.evidence=r.evidence.filter(e=>![headingId,lineId,placeId,id+':linked-info'].includes(e.id)&&!e.id.startsWith(id+':overview:'))
  r.evidence.push(evidence(headingId,header,headingStart,'event'),evidence(lineId,line.whole,line.wholeStart,'event'))
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
  const title=table?role:current&&squash(source).includes(squash(current.title))?current.title:`${topic} · ${role}`
  const event:EventSuggestion={tempId:id,title,description,location:locationFor(role)??current?.location??null,startTimePointTempId:selectedTime?timeId:current?.startTimePointTempId??null,endTimePointTempId:end?endId:selectedTime?null:current?.endTimePointTempId??null,evidenceIds:[...new Set([...(current?.evidenceIds??aggregate[0]?.evidenceIds??[]).slice(0,Math.max(0,20-requiredRefs.length)),...requiredRefs])],confidence:current?.confidence??1,inferenceLevel:current?.inferenceLevel??'explicit',selected:true,relatedTaskTempIds:current?.relatedTaskTempIds??[]}
  r.events=r.events.filter(e=>e.tempId!==id);r.events.push(event)
 }
 r.timePoints=r.timePoints.filter(p=>p.relatedTaskTempIds.length>0||p.relatedMaterialTempIds.length>0||r.events.some(e=>e.startTimePointTempId===p.tempId||e.endTimePointTempId===p.tempId)||!sessions.some(s=>[s.line.value,s.line.whole].some(quote=>squash(quote)===squash(p.rawText))))
 return r
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
