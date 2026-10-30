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

/** Preserve independently labelled sessions from one announcement. Labels
 * and parenthetical venue qualifiers are joined by the same source role,
 * never by their order. Source offsets stay attached to each fact. */
export function completeParallelSessions(input:RecognitionResult,source:string):RecognitionResult {
 const parsedLines=lines(source)
 const timeLines=parsedLines.filter(l=>/^.{1,12}时间$/u.test(l.label)&&l.label!=='活动时间'&&l.label!=='会议时间'&&l.value&&l.value.length<=160&&l.whole.length<=500)
 const sessions=timeLines.map(l=>({line:l,role:l.label.slice(0,-2).trim()})).filter(s=>s.role&&!/(?:报名|申请|提交|登记|上传|缴费|领取|报送|截止)$/u.test(s.role))
 if(sessions.length<2||sessions.length>8||new Set(sessions.map(s=>s.role)).size!==sessions.length)return input
 // A revision or cancellation needs its own existing interpretation; do not
 // reintroduce the old schedule from a list of labelled times.
 if(/取消|作废|不再(?:举办|举行)|原定|改期|延期|调整为|更正为|变更为/u.test(source))return input
 const header=source.split(/\r?\n/u).find(line=>line.trim())?.trim()??'',topic=cleanHeading(header)
 if(!topic||topic.length>100)return input
 const roleLine=parsedLines.find(l=>/^(?:活动|会议|举办|具体)?地点$/u.test(l.label)&&l.value&&l.whole.length<=500)
 const choices=roleLine?[...roleLine.value.matchAll(/(?:^|[、，,；;])\s*([^、，,；;（）()]+?)\s*[（(]([^（）()]+)[）)]/gu)].map(m=>({place:m[1].trim(),role:m[2].trim()})):[]
 const base=choices[0]?.place.match(/^(.{2,30}?(?:中心|大楼|大厦|校区|园区|图书馆|体育馆|教学楼))(?=.)/u)?.[1]
 const locationFor=(role:string)=>{
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
  const current=r.events.find(e=>matchesRole(e,role)),id=current?.tempId??`direct-session:${line.wholeStart}`,timeId=id+':start',endId=id+':end',headingId=id+':heading',lineId=id+':time',placeId=id+':location'
  const parsed=parseDirectSourceTime(line.value,{type:'event_start',referenceTime:r.createdAt,timezone:'Asia/Shanghai'})
  const selectedTime=parsed.normalizedValue&&!parsed.needsConfirmation?parsed.normalizedValue:null
  const point=(tempId:string,type:'event_start'|'event_end',value:string):TimePointSuggestionV2=>({tempId,type,rawText:line.value,normalizedValue:value,timezone:parsed.timezone,isAllDay:parsed.isAllDay,precision:parsed.precision,needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:[lineId],confidence:1,selected:true})
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
  const event:EventSuggestion={tempId:id,title:current?.title??`${topic} · ${role}`,description,location:locationFor(role)??current?.location??null,startTimePointTempId:selectedTime?timeId:current?.startTimePointTempId??null,endTimePointTempId:end?endId:selectedTime?null:current?.endTimePointTempId??null,evidenceIds:[...new Set([...(current?.evidenceIds??aggregate[0]?.evidenceIds??[]).slice(0,Math.max(0,20-requiredRefs.length)),...requiredRefs])],confidence:current?.confidence??1,inferenceLevel:current?.inferenceLevel??'explicit',selected:true,relatedTaskTempIds:current?.relatedTaskTempIds??[]}
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
