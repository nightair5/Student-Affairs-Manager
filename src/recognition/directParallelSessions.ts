import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import type {EvidenceReference} from '../types'
import type {EventSuggestion, RecognitionResult, TimePointSuggestionV2} from './types'

type LabelledLine={label:string;value:string;start:number;whole:string;wholeStart:number}
const lines=(source:string):LabelledLine[]=>[...source.matchAll(/(?:^|\n)[ \t]*(?:【([^】\n]+)】|([^：:\n]{1,20})[：:])[ \t]*[：:]?[ \t]*([^\r\n]*)/gu)].map(m=>{
 const value=m[3].trim(),whole=m[0].replace(/^\n/u,'').trim(),wholeStart=m.index!+m[0].indexOf(whole)
 return {label:(m[1]??m[2]).trim(),value,start:wholeStart+whole.indexOf(value),whole,wholeStart}
})
const squash=(s:string)=>s.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'')
const roleKey=(s:string)=>squash(s).replace(/(?:活动|环节|阶段|专场|会)$/u,'')
const cleanHeading=(s:string)=>s.replace(/\[[^\]\n]{1,8}\]/gu,'').replace(/^【|】$/gu,'').trim()

const rowsHeader=(source:string)=>source.split(/\r?\n/u).map(s=>s.trim()).find(s=>{const c=s.split(/[|｜]/u).map(x=>x.trim());return c.length===3&&c[0]==='时间'&&/^(?:项目|活动|日程)$/u.test(c[1])&&/^(?:地点|场地)$/u.test(c[2])})??''

/** Parse a dated event schedule as rows, preserving literal source offsets. */
function eventScheduleTable(source:string):{heading:string;date:string;sessions:{line:LabelledLine;role:string}[];places:Map<string,string>}|null {
 const rows=[...source.matchAll(/[^\r\n]+/gu)].map(m=>({text:m[0].trim(),start:m.index!+m[0].indexOf(m[0].trim())}))
 const cells=(s:string)=>s.split(/[|｜]/u).map(x=>x.trim())
 const headerIndexes=rows.flatMap((row,index)=>{const c=cells(row.text);return c.length===3&&c[0]==='时间'&&/^(?:项目|活动|日程)$/u.test(c[1])&&/^(?:地点|场地)$/u.test(c[2])?[index]:[]})
 if(headerIndexes.length!==1)return null
 const index=headerIndexes[0],heading=rows[index-1]
 if(!heading||!/活动|日程|讲座|培训|工作坊/u.test(heading.text))return null
 const dates=[...heading.text.matchAll(/(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]/gu)]
 if(dates.length!==1||source.indexOf(heading.text)!==source.lastIndexOf(heading.text)||/取消|改期|待定|备选|或/u.test(heading.text))return null
 const sessions:{line:LabelledLine;role:string}[]=[],places=new Map<string,string>()
 for(const row of rows.slice(index+1)){
  const c=cells(row.text)
  // A malformed row must not silently turn a partial schedule into a complete one.
  if(c.length!==3){if(/[|｜]/u.test(row.text))return null;break}
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

/** Conservative local fallback for explicit date + parallel event clauses.
 * Both the event verb and venue must be stated in each clause. */
function inlineEventSessions(source:string):{heading:string;date:string;sessions:{line:LabelledLine;role:string}[];places:Map<string,string>}|null {
 if(/[\r\n]/u.test(source))return null
 const dates=[...source.matchAll(/(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]/gu)]
 if(dates.length!==1)return null
 const parts=[...source.matchAll(/[^，,；;。！？]+/gu)].map(m=>({text:m[0].trim(),start:m.index!+m[0].indexOf(m[0].trim())}))
 if(parts.length<2||parts.length>3)return null
 const sessions:{line:LabelledLine;role:string}[]=[],places=new Map<string,string>()
 for(const [index,part] of parts.entries()){
  const re=index===0?/^(?:【[^】\n]+】)?(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]\s*(\d{1,2}:[0-5]\d(?:\s*[-—–至到]\s*\d{1,2}:[0-5]\d)?)在([^，,；;。]{1,40}?)(?:举行|举办)([^，,；;。]{2,40})$/u:/^(?:当天|同日|当日)?\s*(\d{1,2}:[0-5]\d(?:\s*[-—–至到]\s*\d{1,2}:[0-5]\d)?)在([^，,；;。]{1,40}?)(?:举行|举办)([^，,；;。]{2,40})$/u
  const m=re.exec(part.text)
  if(!m||/取消|作废|改期|延期|备选|调整|更正|通知|报名|提交|上传|填写/u.test(part.text)||places.has(m[3])||source.indexOf(part.text)!==source.lastIndexOf(part.text))return null
  const clocks=[...m[1].matchAll(/(\d{1,2}):([0-5]\d)/gu)].map(x=>Number(x[1])*60+Number(x[2]))
  if(clocks.some(x=>x>=24*60)||clocks.length===2&&clocks[1]<=clocks[0])return null
  places.set(m[3],m[2]);sessions.push({role:m[3],line:{label:m[3]+'时间',value:m[1],start:part.start+part.text.indexOf(m[1]),whole:part.text,wholeStart:part.start}})
 }
 return {heading:parts[0].text,date:dates[0][0],sessions,places}
}

/** Preserve independently labelled sessions from one announcement. Labels
 * and parenthetical venue qualifiers are joined by the same source role,
 * never by their order. Source offsets stay attached to each fact. */
export function completeParallelSessions(input:RecognitionResult,source:string,localInline=false):RecognitionResult {
 const parsedLines=lines(source)
 const timeLines=parsedLines.filter(l=>/^.{1,12}时间$/u.test(l.label)&&l.label!=='活动时间'&&l.label!=='会议时间'&&l.value&&l.value.length<=160&&l.whole.length<=500)
 const scheduleTable=input.events.length===0?eventScheduleTable(source):null
 const inlineSessions=localInline&&!scheduleTable?inlineEventSessions(source):null
 const table=scheduleTable??inlineSessions
 const sessions=table?.sessions??timeLines.map(l=>({line:l,role:l.label.slice(0,-2).trim()})).filter(s=>s.role&&!/(?:报名|申请|提交|登记|上传|缴费|领取|报送|截止)$/u.test(s.role))
 if(sessions.length<2||sessions.length>8||new Set(sessions.map(s=>s.role)).size!==sessions.length)return input
 if(table&&sessions.some(s=>{const p=parseDirectSourceTime(table.date+' '+s.line.value,{type:'event_start',referenceTime:input.createdAt,timezone:'Asia/Shanghai'});return !p.normalizedValue||Boolean(scheduleTable&&!p.rangeEndNormalizedValue)||p.needsConfirmation}))return input
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
  const tableQuotes=new Set([table.heading+'\n'+rowsHeader(source),...table.sessions.map(s=>s.line.whole)])
  const artifactIds=new Set([...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])].filter(t=>t.actionVerb==='核对'&&t.evidenceIds.some(id=>tableQuotes.has(r.evidence.find(e=>e.id===id)?.quote??''))).map(t=>t.tempId))
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
 const overviews=[...source.matchAll(/[^\r\n]+/gu)].map(m=>({quote:m[0].trim(),start:m.index!+m[0].indexOf(m[0].trim())})).filter(p=>p.start>afterHeader&&p.quote.length>=25&&p.quote.length<=350&&!/^【|^(?:请|须|需|截止|报名)/u.test(p.quote)&&!/(?:请|须|需).{0,60}(?:填写|提交|报名|登记|上传)/u.test(p.quote)).slice(0,4)
 const linkedInfo=parsedLines.find(l=>/(?:信息|介绍|详情|说明)$/u.test(l.label)&&/^https?:\/\//u.test(l.value)&&l.whole.length<=500)
 for(const {line,role} of sessions){
  const current=r.events.find(e=>matchesRole(e,role)),id=current?.tempId??`direct-session:${line.wholeStart}`,timeId=inlineSessions?`direct-inline-time:${line.wholeStart}:start`:id+':start',endId=inlineSessions?`direct-inline-time:${line.wholeStart}:end`:id+':end',headingId=id+':heading',lineId=id+':time',placeId=id+':location'
  const parsed=parseDirectSourceTime(table?table.date+' '+line.value:line.value,{type:'event_start',referenceTime:r.createdAt,timezone:'Asia/Shanghai'})
  const selectedTime=parsed.normalizedValue&&!parsed.needsConfirmation?parsed.normalizedValue:null
  const point=(tempId:string,type:'event_start'|'event_end',value:string):TimePointSuggestionV2=>({tempId,type,rawText:line.value,normalizedValue:value,timezone:parsed.timezone,isAllDay:parsed.isAllDay,precision:parsed.precision,needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:table?[headingId,lineId]:[lineId],confidence:1,selected:true})
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
