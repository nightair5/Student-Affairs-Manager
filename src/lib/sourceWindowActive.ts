import type {Task} from '../types'
import {parseBusinessDateTime} from './timeSemantics'

/** An active interval affects visibility only; it is never a task deadline. */
export function sourceWindowActive(task:Pick<Task,'sourceWindowStart'|'sourceWindowEnd'>,now:Date):boolean {
  if(!task.sourceWindowStart||!task.sourceWindowEnd)return false
  const start=parseBusinessDateTime(task.sourceWindowStart,'Asia/Shanghai'),end=parseBusinessDateTime(task.sourceWindowEnd,'Asia/Shanghai')
  return Boolean(start&&end&&start.getTime()<=now.getTime()&&now.getTime()<=end.getTime())
}
