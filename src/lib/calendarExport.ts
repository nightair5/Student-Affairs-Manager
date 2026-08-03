import type { Task } from '../types'

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

function earliestReminder(task: Task): string {
  const enabled = task.reminders
    .filter((reminder) => reminder.enabled && reminder.scheduledAt)
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))[0]
  if (enabled) return enabled.scheduledAt
  return new Date(new Date(task.deadline).getTime() - 60 * 60 * 1000).toISOString()
}

export function buildCalendarIcs(tasks: Task[], generatedAt = new Date()): string {
  const lines = calendarHeader('学生事务管家')
  tasks.filter((task) => task.status !== '已完成').forEach((task) => {
    const deadline = new Date(task.deadline)
    const start = task.plannedStart ? new Date(task.plannedStart) : new Date(deadline.getTime() - Math.max(15, task.estimatedMinutes) * 60_000)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcs(task.id)}@student-affairs.site`,
      `DTSTAMP:${utcStamp(generatedAt)}`,
      `DTSTART:${utcStamp(start)}`,
      `DTEND:${utcStamp(deadline)}`,
      `SUMMARY:${escapeIcs(task.title)}`,
      `DESCRIPTION:${escapeIcs(`${task.nextAction}\n预计 ${task.estimatedMinutes} 分钟\n分类：${task.category}`)}`,
      'BEGIN:VALARM',
      `TRIGGER;VALUE=DATE-TIME:${utcStamp(earliestReminder(task))}`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcs(`该处理：${task.title}`)}`,
      'END:VALARM',
      'END:VEVENT',
    )
  })
  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}

export function buildTodoIcs(tasks: Task[], generatedAt = new Date()): string {
  const lines = calendarHeader('学生事务待办')
  tasks.filter((task) => task.status !== '已完成').forEach((task) => {
    lines.push(
      'BEGIN:VTODO',
      `UID:${escapeIcs(task.id)}-todo@student-affairs.site`,
      `DTSTAMP:${utcStamp(generatedAt)}`,
      `DUE:${utcStamp(task.deadline)}`,
      `SUMMARY:${escapeIcs(task.title)}`,
      `DESCRIPTION:${escapeIcs(task.nextAction)}`,
      `PRIORITY:${task.priority === '高' ? 1 : task.priority === '中' ? 5 : 9}`,
      'STATUS:NEEDS-ACTION',
      'END:VTODO',
    )
  })
  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}

export async function shareOrDownloadIcs(fileName: string, content: string): Promise<'shared' | 'downloaded'> {
  const file = new File([content], fileName, { type: 'text/calendar;charset=utf-8' })
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: '学生事务提醒' })
    return 'shared'
  }
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
