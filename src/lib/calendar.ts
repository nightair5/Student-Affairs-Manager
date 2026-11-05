import type { Event, Task } from '../types'
import { addDateOnlyDays, DEFAULT_WORKSPACE_TIMEZONE, isDateOnly, parseBusinessDateTime, resolveWorkspaceTimeZone } from './timeSemantics'

export interface MonthCell {
  date: Date
  dateKey: string
  day: number
  inMonth: boolean
  isToday: boolean
}

export interface DaySummary {
  total: number
  active: number
  completed: number
  headline: string
  compactHeadline: string
  timeLabel: string
  riskCount: number
  taskCount: number
  eventCount: number
}

export type CalendarTimelineItem =
  | { kind: 'task'; id: string; title: string; at: string; task: Task; timeRole?: 'plan' | 'deadline' | 'both' | 'window' }
  | { kind: 'event'; id: string; title: string; at: string; event: Event }

const EXPLICIT_TIMEZONE_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/i

function partsInWorkspaceTimezone(value: Date, timeZone = DEFAULT_WORKSPACE_TIMEZONE): Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: resolveWorkspaceTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value)
}

function workspacePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? ''
}

function workspaceTimeLabel(value: string, timeZone = DEFAULT_WORKSPACE_TIMEZONE): string {
  if(isDateOnly(value))return '仅日期'
  const localMatch = value.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/)
  if (localMatch && !EXPLICIT_TIMEZONE_PATTERN.test(value)) {
    return `${localMatch[1]}:${localMatch[2]}`
  }
  const parts = partsInWorkspaceTimezone(new Date(value), timeZone)
  return `${workspacePart(parts, 'hour')}:${workspacePart(parts, 'minute')}`
}

export function localDateKey(value: Date | string, timeZone = DEFAULT_WORKSPACE_TIMEZONE): string {
  if (typeof value === 'string' && !EXPLICIT_TIMEZONE_PATTERN.test(value)) {
    const localMatch = value.match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/)
    if (localMatch) return localMatch[1]
  }
  const parts = partsInWorkspaceTimezone(typeof value === 'string' ? new Date(value) : value, timeZone)
  return `${workspacePart(parts, 'year')}-${workspacePart(parts, 'month')}-${workspacePart(parts, 'day')}`
}

export function buildMonthCells(viewDate: Date, today = new Date(), timeZone = DEFAULT_WORKSPACE_TIMEZONE): MonthCell[] {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const first = new Date(year, month, 1)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - mondayOffset)
  const todayKey = localDateKey(today, timeZone)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    const dateKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
    return {
      date,
      dateKey,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: dateKey === todayKey,
    }
  })
}

type TaskCalendarDate = { at:string; role:'plan'|'deadline'|'both'|'window' }

/** A date-only value remains a day; a clock value is interpreted in the workspace timezone. */
function validCalendarValue(value:string, timeZone:string):boolean {
  return isDateOnly(value) || Boolean(parseBusinessDateTime(value,timeZone))
}

function taskCalendarDates(task:Task, timeZone:string):TaskCalendarDate[] {
  const plan=task.plannedStart||task.directDate
  const dates:TaskCalendarDate[]=[]
  if(plan&&validCalendarValue(plan,timeZone))dates.push({at:plan,role:'plan'})
  if(task.deadline&&validCalendarValue(task.deadline,timeZone))dates.push({at:task.deadline,role:'deadline'})
  if(!dates.length&&task.sourceWindowLabel&&task.sourceWindowEnd&&validCalendarValue(task.sourceWindowEnd,timeZone))dates.push({at:task.sourceWindowEnd,role:'window'})
  return dates
}

function combineTaskDates(first:TaskCalendarDate,second:TaskCalendarDate,timeZone:string):TaskCalendarDate {
  const firstInstant=parseBusinessDateTime(first.at,timeZone),secondInstant=parseBusinessDateTime(second.at,timeZone)
  const at=!firstInstant?second.at:!secondInstant?first.at:firstInstant.getTime()<=secondInstant.getTime()?first.at:second.at
  return {at,role:'both'}
}

export function taskCalendarEntryForDay(task:Task, day:string, timeZone=DEFAULT_WORKSPACE_TIMEZONE):TaskCalendarDate|undefined {
  const matches=taskCalendarDates(task,timeZone).filter(value=>localDateKey(value.at,timeZone)===day)
  if(matches.length<2)return matches[0]
  return combineTaskDates(matches[0],matches[1],timeZone)
}

export function groupTasksByDate(tasks: Task[], timeZone=DEFAULT_WORKSPACE_TIMEZONE): Map<string, Task[]> {
  const grouped = new Map<string, Task[]>()
  for (const task of tasks) {
    const days=new Set(taskCalendarDates(task,timeZone).map(value=>localDateKey(value.at,timeZone)))
    for(const key of days)grouped.set(key,[...(grouped.get(key)??[]),task])
  }
  for (const [key, items] of grouped) {
    grouped.set(key, items.sort((a, b) => (
      (taskCalendarEntryForDay(a,key,timeZone)?.at??'').localeCompare(taskCalendarEntryForDay(b,key,timeZone)?.at??'')
    )))
  }
  return grouped
}

/** A personal date determines placement; the original deadline remains on the task. */
export function taskCalendarDate(task: Task): string { return task.plannedStart || task.directDate || task.deadline || (task.sourceWindowLabel?task.sourceWindowEnd:'') || '' }

/** Calendar days overlapped by the actual event interval. Timed ends are exclusive. */
export function eventCalendarDays(event:Pick<Event,'startAt'|'endAt'>,timeZone=DEFAULT_WORKSPACE_TIMEZONE,range?:{start:string;end:string}):string[] {
  const start=event.startAt
  if(!start||!validCalendarValue(start,timeZone))return []
  const first=localDateKey(start,timeZone)
  let last=first
  if(event.endAt&&validCalendarValue(event.endAt,timeZone)){
    if(isDateOnly(event.endAt)){
      // A date has day precision, not an implicit midnight endpoint.
      if(event.endAt>=first)last=event.endAt
    }else{
      const endInstant=parseBusinessDateTime(event.endAt,timeZone)
      const startInstant=parseBusinessDateTime(start,timeZone)
      if(endInstant&&(!startInstant||endInstant.getTime()>startInstant.getTime()))last=localDateKey(new Date(endInstant.getTime()-1),timeZone)
    }
  }
  const from=range&&range.start>first?range.start:first,to=range&&range.end<last?range.end:last
  if(from>to)return []
  const days:string[]=[]
  for(let day=from;day<=to;day=addDateOnlyDays(day,1))days.push(day)
  return days
}

export function eventTimingState(event:Pick<Event,'startAt'|'endAt'>,now=new Date(),timeZone=DEFAULT_WORKSPACE_TIMEZONE):'unknown'|'upcoming'|'ongoing'|'ended' {
  const start=event.startAt
  if(!start||!validCalendarValue(start,timeZone))return 'unknown'
  const today=localDateKey(now,timeZone),startDay=localDateKey(start,timeZone)
  if(isDateOnly(start)){
    const end=event.endAt&&!isDateOnly(event.endAt)?parseBusinessDateTime(event.endAt,timeZone):null
    if(today<startDay)return 'upcoming'
    if(end)return now.getTime()<end.getTime()?'ongoing':'ended'
    const last=event.endAt&&validCalendarValue(event.endAt,timeZone)?localDateKey(event.endAt,timeZone):startDay
    return today<=last?'ongoing':'ended'
  }
  const startInstant=parseBusinessDateTime(start,timeZone)!
  if(startInstant.getTime()>now.getTime())return 'upcoming'
  if(event.endAt&&isDateOnly(event.endAt)&&validCalendarValue(event.endAt,timeZone)&&event.endAt>=startDay)
    return today<=event.endAt?'upcoming':'ended'
  const end=event.endAt&&!isDateOnly(event.endAt)?parseBusinessDateTime(event.endAt,timeZone):null
  if(end&&end.getTime()>startInstant.getTime())return now.getTime()<end.getTime()?'ongoing':'ended'
  // A missing end cannot establish that an activity is still ongoing.
  return today<=startDay?'upcoming':'ended'
}

export function groupEventsByDate(events: Event[],timeZone=DEFAULT_WORKSPACE_TIMEZONE,range?:{start:string;end:string}): Map<string, Event[]> {
  const grouped = new Map<string, Event[]>()
  for (const event of events) {
    for(const key of eventCalendarDays(event,timeZone,range))grouped.set(key,[...(grouped.get(key)??[]),event])
  }
  for (const [key, items] of grouped) {
    grouped.set(key, items.sort((a, b) => (
      (parseBusinessDateTime(a.startAt!,timeZone)?.getTime()??0) - (parseBusinessDateTime(b.startAt!,timeZone)?.getTime()??0)
    )))
  }
  return grouped
}

export function getUndatedCalendarEvents(events: Event[]): Event[] {
  return events
    .filter((event) => {
      if (!event.startAt) return true
      return !Number.isFinite(new Date(event.startAt).getTime())
    })
    .slice()
    .sort((left, right) => {
      const leftUpdatedAt = new Date(left.updatedAt).getTime()
      const rightUpdatedAt = new Date(right.updatedAt).getTime()
      const safeLeft = Number.isFinite(leftUpdatedAt) ? leftUpdatedAt : 0
      const safeRight = Number.isFinite(rightUpdatedAt) ? rightUpdatedAt : 0
      return safeRight - safeLeft || left.id.localeCompare(right.id)
    })
}

export function buildUpcomingCalendarItems(
  tasks: Task[],
  events: Event[],
  now = new Date(),
  timeZone = DEFAULT_WORKSPACE_TIMEZONE,
): CalendarTimelineItem[] {
  const threshold = now.getTime()
  const taskItems: CalendarTimelineItem[] = tasks.filter(task=>task.status!=='已完成').flatMap(task=>{
    const future=taskCalendarDates(task,timeZone).filter(value=>isDateOnly(value.at)?value.at>=localDateKey(now,timeZone):(parseBusinessDateTime(value.at,timeZone)?.getTime()??0)>=threshold)
    const byDay=new Map<string,TaskCalendarDate>()
    for(const value of future){const day=localDateKey(value.at,timeZone),old=byDay.get(day);byDay.set(day,old?combineTaskDates(old,value,timeZone):value)}
    return [...byDay.values()].map(value=>({kind:'task' as const,id:task.id,title:task.title,at:value.at,timeRole:value.role,task}))
  })
  const eventItems: CalendarTimelineItem[] = events
    .filter(event=>['upcoming','ongoing'].includes(eventTimingState(event,now,timeZone)))
    .map((event) => ({ kind: 'event', id: event.id, title: event.title, at: event.startAt!, event }))
  return [...taskItems, ...eventItems].sort((a, b) => localDateKey(a.at,timeZone).localeCompare(localDateKey(b.at,timeZone)) || (parseBusinessDateTime(a.at,timeZone)?.getTime()??0)-(parseBusinessDateTime(b.at,timeZone)?.getTime()??0))
}

function shortTitle(title: string, limit = 9): string {
  const characters = [...title.trim()]
  return characters.length > limit ? `${characters.slice(0, limit).join('')}…` : characters.join('')
}

function compactTitle(title: string, limit = 4): string {
  return [...title.trim()].slice(0, limit).join('')
}

export function summarizeCalendarDay(tasks: Task[], events: Event[], day?:string, timeZone=DEFAULT_WORKSPACE_TIMEZONE): DaySummary | null {
  if (!tasks.length && !events.length) return null
  const sorted = [...tasks].sort((a, b) => new Date(taskCalendarDate(a)).getTime() - new Date(taskCalendarDate(b)).getTime())
  const activeTasks = sorted.filter((task) => task.status !== '已完成')
  const activeItems = [
    ...activeTasks.map((task) => ({ title: task.title, at: day?taskCalendarEntryForDay(task,day,timeZone)?.at??taskCalendarDate(task):taskCalendarDate(task) })),
    ...events.filter((event) => event.startAt).map((event) => ({ title: event.title, at: day&&localDateKey(event.startAt!,timeZone)!==day?day:event.startAt! })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  const fallback = sorted.map((task) => ({ title: task.title, at: taskCalendarDate(task) }))
  const focus = activeItems.length ? activeItems : fallback
  const timed=focus.filter(item=>!isDateOnly(item.at)),hasDateOnly=focus.some(item=>isDateOnly(item.at))
  const timeLabel = timed.length?(hasDateOnly?'含仅日期事项；':'')+workspaceTimeLabel(timed[0].at,timeZone):'仅日期'
  const riskCount = activeTasks.filter((task) => task.riskFlags.length > 0).length
    + events.filter((event) => event.needsConfirmation).length
  const active = activeItems.length
  const total = sorted.length + events.length

  return {
    total,
    active,
    completed: sorted.length - activeTasks.length,
    headline: active === 0
      ? `已完成 ${sorted.length} 项`
      : active === 1
        ? shortTitle(focus[0].title, 11)
        : `${shortTitle(focus[0].title, 5)}等 ${active} 项`,
    compactHeadline: active === 0 ? '已完成' : compactTitle(focus[0].title),
    timeLabel,
    riskCount,
    taskCount: sorted.length,
    eventCount: events.length,
  }
}

export function summarizeDay(tasks: Task[]): DaySummary | null {
  return summarizeCalendarDay(tasks, [])
}
