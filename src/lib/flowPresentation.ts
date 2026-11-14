import type {Task, Event} from '../types'
import {isDateOnly,parseBusinessDateTime} from './timeSemantics'
import {localDateKey} from './calendar'

/** Presentation only: never supplies a missing value or changes its role. */
export function flowDate(value:string|null|undefined,timeZone='Asia/Shanghai'):string {
  if(!value)return '未设日期'
  const dateOnly=/^(\d{4})-(\d{2})-(\d{2})$/u.exec(value)
  if(dateOnly)return `${Number(dateOnly[1])===new Date().getFullYear()?'':dateOnly[1]+'年'}${Number(dateOnly[2])}月${Number(dateOnly[3])}日`
  const date=parseBusinessDateTime(value,timeZone)
  if(!date)return '未设日期'
  return new Intl.DateTimeFormat('zh-CN',{timeZone,...(date.getFullYear()===new Date().getFullYear()?{}:{year:'numeric' as const}),month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(date)
}
export function flowTaskDate(task:Task,timeZone='Asia/Shanghai'):string {
  const plan=task.plannedStart||task.directDate
  const windowLabel=task.sourceWindowLabel?`${task.sourceWindowChoiceBranch?`方式${task.sourceWindowChoiceBranch}的`:'办理'}时段：${task.sourceWindowLabel}`:''
  const deadline=task.deadline?`${flowDate(task.deadline,timeZone)} 截止${task.sourceWeekdayInferred?'（按整理日期推算）':''}`:task.sourceDeadlineLabel&&/另行通知|另行公布|待通知/u.test(task.sourceDeadlineLabel)?'截止时间另行通知':''
  const period=task.sourceActionAt&&isDateOnly(task.sourceActionAt)?task.sourceActionRaw?.match(/凌晨|清晨|早上|上午|中午|下午|傍晚|晚上|夜间|夜里/u)?.[0]??'':''
  const sourceAction=task.sourceActionAt?`原文办理：${flowDate(task.sourceActionAt,timeZone)}${period}${task.sourceActionWeekdayInferred?'（按整理日期推算）':''}`:''
  const alternatives=task.description.split(/\r?\n/u).find(line=>line.startsWith('原文备选时间：'))??''
  const parts=[plan?`${flowDate(plan,timeZone)} 计划`:'',deadline,sourceAction,windowLabel,alternatives].filter(Boolean)
  if(parts.length)return parts.join(' · ')
  if(task.sourceDeadlineLabel&&/另行通知|另行公布|待通知/u.test(task.sourceDeadlineLabel))return '截止时间另行通知'
  return '未设日期'
}
/** Retain an actionable relative-time condition without guessing an anchor. */
export function taskRelativeTimeHint(task:Task):string|undefined {
  return task.description.split(/\r?\n/u).map(line=>line.trim()).find(line=>
    line.length>0&&line.length<=160&&/(?:开始|结束|开赛|上课|下课|开幕|入场)(?:前|后)|课后/u.test(line))
}
/** Only flag a definite conflict; date-only values do not invent a clock time. */
export function planAfterDeadline(plan:string|null|undefined,deadline:string|null|undefined,timeZone='Asia/Shanghai'):boolean {
  if(!plan||!deadline)return false
  try {
    const planDay=localDateKey(plan,timeZone),deadlineDay=localDateKey(deadline,timeZone)
    if(planDay!==deadlineDay)return planDay>deadlineDay
    if(isDateOnly(plan)||isDateOnly(deadline))return false
    const planTime=parseBusinessDateTime(plan,timeZone),deadlineTime=parseBusinessDateTime(deadline,timeZone)
    return Boolean(planTime&&deadlineTime&&planTime.getTime()>deadlineTime.getTime())
  } catch { return false }
}
export function flowEventDate(event:Event,hint?:string,timeZone='Asia/Shanghai'):string {
  if(!event.startAt){
    const clock=event.description.split(/\r?\n/u).map(line=>/^时间说明：(.+（日期待定）)$/u.exec(line.trim())?.[1]).find(Boolean)
    return event.endAt?`开始时间待定 · ${flowDate(event.endAt,timeZone)}结束`:clock??(hint?`${hint} · 时间待定`:'时间待定')
  }
  const start=flowDate(event.startAt,timeZone)
  const date=event.endAt?`${start} — ${flowDate(event.endAt,timeZone)}`:start
  return `${date}${event.sourceWeekdayInferred?'（按整理日期推算）':''}`
}

export function flowEditValue(value:string|null|undefined):string {
  if(!value)return ''
  if(/^\d{4}-\d{2}-\d{2}$/u.test(value))return value
  const date=parseBusinessDateTime(value,'Asia/Shanghai');if(!date)return ''
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date),part=(type:Intl.DateTimeFormatPartTypes)=>parts.find(p=>p.type===type)?.value??''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}
