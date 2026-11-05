import type {Event} from '../types'
import {localDateKey} from './calendar'
import {addDateOnlyDays,isDateOnly,parseBusinessDateTime} from './timeSemantics'

/** Presentation only. The next three calendar days include today, in the
 * same time zone used by the timeline. No missing event date is invented. */
export function isEventInNextThreeDays(event:Pick<Event,'startAt'|'personalCompleted'>,now=new Date()):boolean {
  if(event.personalCompleted||!event.startAt||!Number.isFinite(now.getTime()))return false
  const parsed=isDateOnly(event.startAt)?null:parseBusinessDateTime(event.startAt)
  if(!isDateOnly(event.startAt)&&!parsed)return false
  const date=isDateOnly(event.startAt)?event.startAt:localDateKey(parsed!)
  const today=localDateKey(now)
  return date>=today&&date<=addDateOnlyDays(today,2)
}
