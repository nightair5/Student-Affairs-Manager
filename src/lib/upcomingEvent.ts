import type {Event} from '../types'
import {eventTimingState,localDateKey} from './calendar'
import {addDateOnlyDays,isDateOnly,parseBusinessDateTime,DEFAULT_WORKSPACE_TIMEZONE} from './timeSemantics'

/** Presentation only. The next three calendar days include today, in the
 * same time zone used by the timeline. No missing event date is invented. */
export function isEventInNextThreeDays(event:Pick<Event,'startAt'|'personalCompleted'>&Partial<Pick<Event,'endAt'>>,now=new Date(),timeZone=DEFAULT_WORKSPACE_TIMEZONE):boolean {
  if(event.personalCompleted||!event.startAt||!Number.isFinite(now.getTime()))return false
  const parsed=isDateOnly(event.startAt)?null:parseBusinessDateTime(event.startAt,timeZone)
  if(!isDateOnly(event.startAt)&&!parsed)return false
  const state=eventTimingState({startAt:event.startAt,endAt:event.endAt??null},now,timeZone)
  if(state==='ended')return false
  if(state==='ongoing')return true
  const date=isDateOnly(event.startAt)?event.startAt:localDateKey(parsed!,timeZone)
  const today=localDateKey(now,timeZone)
  return date>=today&&date<=addDateOnlyDays(today,2)
}
