import type {Task, Event} from '../types'
import {isDateOnly,parseBusinessDateTime} from './timeSemantics'
import {localDateKey} from './calendar'

/** Presentation only: never supplies a missing value or changes its role. */
export function flowDate(value:string|null|undefined):string {
  if(!value)return '未设日期'
  const dateOnly=/^(\d{4})-(\d{2})-(\d{2})$/u.exec(value)
  if(dateOnly)return `${Number(dateOnly[1])===new Date().getFullYear()?'':dateOnly[1]+'年'}${Number(dateOnly[2])}月${Number(dateOnly[3])}日`
  const date=parseBusinessDateTime(value,'Asia/Shanghai')
  if(!date)return '未设日期'
  return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',...(date.getFullYear()===new Date().getFullYear()?{}:{year:'numeric' as const}),month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(date)
}
export function flowTaskDate(task:Task):string {
  const plan=task.plannedStart||task.directDate
  if(plan)return `${flowDate(plan)} 计划${task.deadline?` · ${flowDate(task.deadline)} 截止`:task.sourceWindowLabel?` · 办理时段：${task.sourceWindowLabel}`:task.sourceDeadlineLabel&&/另行通知|另行公布|待通知/u.test(task.sourceDeadlineLabel)?' · 截止时间另行通知':''}`
  if(task.deadline)return `${flowDate(task.deadline)} 截止`
  if(task.sourceWindowLabel)return `办理时段：${task.sourceWindowLabel}`
  if(task.sourceDeadlineLabel&&/另行通知|另行公布|待通知/u.test(task.sourceDeadlineLabel))return '截止时间另行通知'
  return '未设日期'
}
/** Only flag a definite conflict; date-only values do not invent a clock time. */
export function planAfterDeadline(plan:string|null|undefined,deadline:string|null|undefined):boolean {
  if(!plan||!deadline)return false
  try {
    const planDay=localDateKey(plan),deadlineDay=localDateKey(deadline)
    if(planDay!==deadlineDay)return planDay>deadlineDay
    if(isDateOnly(plan)||isDateOnly(deadline))return false
    const planTime=parseBusinessDateTime(plan,'Asia/Shanghai'),deadlineTime=parseBusinessDateTime(deadline,'Asia/Shanghai')
    return Boolean(planTime&&deadlineTime&&planTime.getTime()>deadlineTime.getTime())
  } catch { return false }
}
export function flowEventDate(event:Event,hint?:string):string {
  if(!event.startAt)return event.endAt?`开始时间待定 · ${flowDate(event.endAt)}结束`:hint?`${hint} · 时间待定`:'时间待定'
  const start=flowDate(event.startAt)
  if(!event.endAt)return start
  return `${start} — ${flowDate(event.endAt)}`
}

export function flowEditValue(value:string|null|undefined):string {
  if(!value)return ''
  if(/^\d{4}-\d{2}-\d{2}$/u.test(value))return value
  const date=parseBusinessDateTime(value,'Asia/Shanghai');if(!date)return ''
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date),part=(type:Intl.DateTimeFormatPartTypes)=>parts.find(p=>p.type===type)?.value??''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}
