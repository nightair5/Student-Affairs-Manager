import type {Event} from '../types'
import {isDateOnly,parseBusinessDateTime} from './timeSemantics'
import {formatDuration} from './taskLogic'

/** The persisted description is the authority; labels are only a display projection. */
export function eventDescriptionSections(description:string):Array<{label:string;content:string}> {
  const labels=new Set(['主讲人','主持人','活动内容','参加须知','准备要求','嘉宾简介','原文时长'])
  const sections:Array<{label:string;content:string}>=[]
  for(const line of description.split(/\r?\n/u)){
    const match=/^\s*([^：:]{1,12})[：:]\s*(.*)$/u.exec(line)
    if(match&&labels.has(match[1]))sections.push({label:match[1],content:match[2]})
    else if(sections.length)sections[sections.length-1].content+=`${sections[sections.length-1].content?'\n':''}${line}`
    else if(line.trim())sections.push({label:'活动说明',content:line})
  }
  const grouped:Array<{label:string;content:string}>=[]
  const mergeLabels=new Set(['活动内容','参加须知','准备要求'])
  for(const section of sections){
    const content=section.content.trim();if(!content)continue
    const prior=mergeLabels.has(section.label)?grouped.find(s=>s.label===section.label):undefined
    if(!prior){grouped.push({...section,content});continue}
    // Only identical facts are deduplicated; distinct requirements remain
    // readable and the original saved description stays untouched.
    const normalized=(s:string)=>s.normalize('NFKC').replace(/\s/gu,'').replace(/[。；;]$/u,'')
    if(!prior.content.split('\n').some(line=>normalized(line)===normalized(content)))prior.content+='\n'+content
  }
  return grouped
}

/** Actual duration requires two explicit clock times; estimates never fill an end. */
export function eventDurationLabel(event:Event):string|undefined {
  let actual:string|undefined
  if(event.startAt&&event.endAt&&!isDateOnly(event.startAt)&&!isDateOnly(event.endAt)){
    const start=parseBusinessDateTime(event.startAt,'Asia/Shanghai'),end=parseBusinessDateTime(event.endAt,'Asia/Shanghai')
    const minutes=start&&end?(end.getTime()-start.getTime())/60000:0
    if(Number.isInteger(minutes)&&minutes>0)actual=`时长 ${formatDuration(minutes)}`
  }
  const explicit=eventDescriptionSections(event.description).find(s=>s.label==='原文时长')
  if(!actual&&explicit)actual=`时长 ${explicit.content}`
  if(event.estimatedMinutesKnown){
    const personal=event.estimatedMinutes&&event.estimatedMinutes>0?`个人预计 ${formatDuration(event.estimatedMinutes)}`:undefined
    return [actual,personal].filter(Boolean).join(' · ')||undefined
  }
  if(actual)return actual
  if(/培训|讲座|报告会|说明会|研讨会/u.test(event.title))return '建议预留约 1 小时'
  return undefined
}
