import type {Task} from '../types'
import {isDateOnly,parseBusinessDateTime} from './timeSemantics'

/** An active interval affects visibility only; it is never a task deadline. */
export function sourceWindowActive(task:Pick<Task,'sourceWindowStart'|'sourceWindowEnd'>&Partial<Pick<Task,'deadline'>>,now:Date):boolean {
  if(!task.sourceWindowStart||!task.sourceWindowEnd)return false
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
  const notBefore=(value:string)=>isDateOnly(value)?today>=value:Boolean(parseBusinessDateTime(value,'Asia/Shanghai')&&now.getTime()>=parseBusinessDateTime(value,'Asia/Shanghai')!.getTime())
  const notAfter=(value:string)=>isDateOnly(value)?today<=value:Boolean(parseBusinessDateTime(value,'Asia/Shanghai')&&now.getTime()<=parseBusinessDateTime(value,'Asia/Shanghai')!.getTime())
  return notBefore(task.sourceWindowStart)&&notAfter(task.sourceWindowEnd)&&(!task.deadline||notAfter(task.deadline))
}
