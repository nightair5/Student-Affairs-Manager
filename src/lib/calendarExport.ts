import type { Task } from '../types'
import {
  addDateOnlyDays,
  compactDateOnly,
  DEFAULT_WORKSPACE_TIMEZONE,
  isDateOnly,
  parseBusinessDateTime,
} from './timeSemantics'

export interface CalendarExportOptions {
  defaultTimezone?: string
  /** Legacy callers retain their original failure contract. Ordinary product
   * exports explicitly opt into the source-preserving revision. */
  policy?: 'legacy-v1' | 'source-preserving-v2'
}

export const SOURCE_PRESERVING_CALENDAR_EXPORT = { policy: 'source-preserving-v2' } as const

function escapeIcs(value: string): string {
  return value.replace(/\\/gu, '\\\\').replace(/\r?\n/gu, '\\n').replace(/,/gu, '\\,').replace(/;/gu, '\\;')
}

function utcStamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('INVALID_CALENDAR_DATE')
  return date.toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z')
}

function calendarHeader(name: string): string[] {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Student Affairs Manager//CN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeIcs(name)}`]
}

function calendarText(lines:string[],options:CalendarExportOptions):string {
  const folded=options.policy!=='source-preserving-v2'?lines:lines.flatMap(line=>{
    const parts:string[]=[],encoder=new TextEncoder();let current='',size=0
    for(const char of line){const bytes=encoder.encode(char).length;if(size+bytes>75){parts.push(current);current=' ';size=1}current+=char;size+=bytes}
    parts.push(current);return parts
  })
  return folded.join('\r\n')+'\r\n'
}

function explicitReminder(task: Task, timeZone: string): Date | null {
  const enabled = task.reminders
    .filter((reminder) => reminder.enabled && reminder.scheduledAt)
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))[0]
  if (enabled) {
    const scheduled = parseBusinessDateTime(enabled.scheduledAt, timeZone)
    if (scheduled) return scheduled
  }
  return null
}

function earliestReminder(task: Task, timeZone: string): Date {
  const explicit = explicitReminder(task, timeZone)
  if (explicit) return explicit
  const deadline = parseBusinessDateTime(task.deadline, timeZone)
  if (!deadline) throw new Error('INVALID_CALENDAR_DATE')
  return new Date(deadline.getTime() - 60 * 60 * 1000)
}

function alarmLines(reminder: Date, task: Task): string[] {
  return [
    'BEGIN:VALARM',
    `TRIGGER;VALUE=DATE-TIME:${utcStamp(reminder)}`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(`该处理：${task.title}`)}`,
    'END:VALARM',
  ]
}

export function buildCalendarIcs(tasks: Task[], generatedAt = new Date(), options: CalendarExportOptions = {}): string {
  const lines = calendarHeader('学生事务管家')
  const timeZone = options.defaultTimezone ?? DEFAULT_WORKSPACE_TIMEZONE
  tasks.filter((task) => task.status !== '已完成').forEach((task) => {
    if (task.plannedStart) {
      const planned = parseBusinessDateTime(task.plannedStart, timeZone)
      if (!planned) throw new Error('INVALID_CALENDAR_DATE')
      const minutes = task.plannedMinutes ?? (task.estimatedMinutesKnown === false ? undefined : task.estimatedMinutes)
      if (minutes !== undefined && (!Number.isFinite(minutes) || minutes <= 0 || minutes > 480)) throw new Error('INVALID_PERSONAL_PLAN_DURATION')
      const reminder = explicitReminder(task, timeZone)
      lines.push('BEGIN:VEVENT', `UID:${escapeIcs(task.id)}@student-affairs.site`, `DTSTAMP:${utcStamp(generatedAt)}`,
        `DTSTART:${utcStamp(planned)}`,
        ...(minutes === undefined ? [] : [`DTEND:${utcStamp(new Date(planned.getTime() + minutes * 60_000))}`]),
        `SUMMARY:${escapeIcs(task.title)}`,
        `DESCRIPTION:${escapeIcs(`${task.nextAction}\n个人安排：${minutes === undefined ? '时长尚未确定，未生成结束时刻' : `${minutes}分钟`}\n原文截止：${task.sourceDeadlineLabel || task.deadline || '未说明'}\n分类：${task.category}`)}`,
        ...(reminder ? alarmLines(reminder, task) : []), 'END:VEVENT')
      return
    }
    if (!task.deadline && options.policy === 'source-preserving-v2') {
      // RFC 5545 3.6.2 permits a VTODO without DTSTART/DUE. It is not a
      // scheduled event; preserve the item instead of inventing a date.
      lines.push(...todoLines(task, generatedAt, timeZone, options))
      return
    }
    if (isDateOnly(task.deadline)) {
      const reminder = explicitReminder(task, timeZone)
      lines.push(
        'BEGIN:VEVENT',
        `UID:${escapeIcs(task.id)}@student-affairs.site`,
        `DTSTAMP:${utcStamp(generatedAt)}`,
        `DTSTART;VALUE=DATE:${compactDateOnly(task.deadline)}`,
        `DTEND;VALUE=DATE:${compactDateOnly(addDateOnlyDays(task.deadline, 1))}`,
        `SUMMARY:${escapeIcs(options.policy === 'source-preserving-v2' ? '截止：'+task.title : task.title)}`,
        `DESCRIPTION:${escapeIcs(options.policy === 'source-preserving-v2' ? `${task.nextAction}\n原文截止：${task.sourceDeadlineLabel || task.deadline}\n仅日期，未生成具体截止时刻` : `${task.nextAction}\n预计 ${task.estimatedMinutes} 分钟\n分类：${task.category}`)}`,
        ...(reminder ? alarmLines(reminder, task) : []),
        'END:VEVENT',
      )
      return
    }
    const deadline = parseBusinessDateTime(task.deadline, timeZone)
    if (!deadline) throw new Error('INVALID_CALENDAR_DATE')
    if (options.policy === 'source-preserving-v2') {
      // A cutoff is a point, not a guessed work interval before that point.
      lines.push('BEGIN:VEVENT', `UID:${escapeIcs(task.id)}@student-affairs.site`, `DTSTAMP:${utcStamp(generatedAt)}`,
        `DTSTART:${utcStamp(deadline)}`, `SUMMARY:${escapeIcs('截止：'+task.title)}`,
        `DESCRIPTION:${escapeIcs(`${task.nextAction}\n原文截止：${task.sourceDeadlineLabel || task.deadline}\n这是截止标记，个人安排另列`)}`,
        ...alarmLines(earliestReminder(task, timeZone), task), 'END:VEVENT')
      return
    }
    const planned = task.plannedStart ? parseBusinessDateTime(task.plannedStart, timeZone) : null
    const start = planned ?? new Date(deadline.getTime() - Math.max(15, task.estimatedMinutes) * 60_000)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcs(task.id)}@student-affairs.site`,
      `DTSTAMP:${utcStamp(generatedAt)}`,
      `DTSTART:${utcStamp(start)}`,
      `DTEND:${utcStamp(deadline)}`,
      `SUMMARY:${escapeIcs(task.title)}`,
      `DESCRIPTION:${escapeIcs(`${task.nextAction}\n预计 ${task.estimatedMinutes} 分钟\n分类：${task.category}`)}`,
      ...alarmLines(earliestReminder(task, timeZone), task),
      'END:VEVENT',
    )
  })
  lines.push('END:VCALENDAR')
  return calendarText(lines,options)
}

export function buildTodoIcs(tasks: Task[], generatedAt = new Date(), options: CalendarExportOptions = {}): string {
  const lines = calendarHeader('学生事务待办')
  const timeZone = options.defaultTimezone ?? DEFAULT_WORKSPACE_TIMEZONE
  tasks.filter((task) => task.status !== '已完成').forEach((task) => {
    lines.push(...todoLines(task, generatedAt, timeZone, options))
  })
  lines.push('END:VCALENDAR')
  return calendarText(lines,options)
}

function todoLines(task:Task, generatedAt:Date, timeZone:string, options:CalendarExportOptions):string[] {
    const due = !task.deadline && options.policy === 'source-preserving-v2' ? null : isDateOnly(task.deadline)
      ? `DUE;VALUE=DATE:${compactDateOnly(task.deadline)}`
      : `DUE:${utcStamp(parseBusinessDateTime(task.deadline, timeZone) ?? task.deadline)}`
    return [
      'BEGIN:VTODO',
      `UID:${escapeIcs(task.id)}-todo@student-affairs.site`,
      `DTSTAMP:${utcStamp(generatedAt)}`,
      ...(due ? [due] : []),
      `SUMMARY:${escapeIcs(task.title)}`,
      `DESCRIPTION:${escapeIcs(task.nextAction + (due ? '' : '\n原文未给出确定截止；未生成日期或提醒'))}`,
      `PRIORITY:${task.priority === '高' ? 1 : task.priority === '中' ? 5 : 9}`,
      'STATUS:NEEDS-ACTION',
      'END:VTODO',
    ]
}

export async function shareOrDownloadIcs(fileName: string, content: string): Promise<'shared' | 'downloaded'> {
  const file = new File([content], fileName, { type: 'text/calendar;charset=utf-8' })
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '学生事务提醒' })
      return 'shared'
    } catch (error) {
      // An explicit cancellation stays cancelled. Unsupported sharing falls
      // back to the reversible file handoff, never to a calendar write.
      if (error instanceof Error && error.name === 'AbortError') throw error
    }
  }
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
