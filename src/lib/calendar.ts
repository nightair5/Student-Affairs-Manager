import type { Event, Task } from '../types'

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
  | { kind: 'task'; id: string; title: string; at: string; task: Task }
  | { kind: 'event'; id: string; title: string; at: string; event: Event }

export function localDateKey(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function buildMonthCells(viewDate: Date, today = new Date()): MonthCell[] {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const first = new Date(year, month, 1)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - mondayOffset)
  const todayKey = localDateKey(today)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    const dateKey = localDateKey(date)
    return {
      date,
      dateKey,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: dateKey === todayKey,
    }
  })
}

export function groupTasksByDate(tasks: Task[]): Map<string, Task[]> {
  const grouped = new Map<string, Task[]>()
  for (const task of tasks) {
    const date = new Date(task.deadline)
    if (Number.isNaN(date.getTime())) continue
    const key = localDateKey(date)
    grouped.set(key, [...(grouped.get(key) ?? []), task])
  }
  for (const [key, items] of grouped) {
    grouped.set(key, items.sort((a, b) => (
      new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    )))
  }
  return grouped
}

export function groupEventsByDate(events: Event[]): Map<string, Event[]> {
  const grouped = new Map<string, Event[]>()
  for (const event of events) {
    if (!event.startAt) continue
    const start = new Date(event.startAt)
    if (Number.isNaN(start.getTime())) continue
    const key = localDateKey(start)
    grouped.set(key, [...(grouped.get(key) ?? []), event])
  }
  for (const [key, items] of grouped) {
    grouped.set(key, items.sort((a, b) => (
      new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime()
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
): CalendarTimelineItem[] {
  const threshold = now.getTime()
  const taskItems: CalendarTimelineItem[] = tasks
    .filter((task) => task.status !== '已完成')
    .filter((task) => Number.isFinite(new Date(task.deadline).getTime()) && new Date(task.deadline).getTime() >= threshold)
    .map((task) => ({ kind: 'task', id: task.id, title: task.title, at: task.deadline, task }))
  const eventItems: CalendarTimelineItem[] = events
    .filter((event) => Boolean(event.startAt) && Number.isFinite(new Date(event.startAt!).getTime()) && new Date(event.startAt!).getTime() >= threshold)
    .map((event) => ({ kind: 'event', id: event.id, title: event.title, at: event.startAt!, event }))
  return [...taskItems, ...eventItems].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}

function shortTitle(title: string, limit = 9): string {
  const characters = [...title.trim()]
  return characters.length > limit ? `${characters.slice(0, limit).join('')}…` : characters.join('')
}

function compactTitle(title: string, limit = 4): string {
  return [...title.trim()].slice(0, limit).join('')
}

export function summarizeCalendarDay(tasks: Task[], events: Event[]): DaySummary | null {
  if (!tasks.length && !events.length) return null
  const sorted = [...tasks].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  const activeTasks = sorted.filter((task) => task.status !== '已完成')
  const activeItems = [
    ...activeTasks.map((task) => ({ title: task.title, at: task.deadline })),
    ...events.filter((event) => event.startAt).map((event) => ({ title: event.title, at: event.startAt! })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  const fallback = sorted.map((task) => ({ title: task.title, at: task.deadline }))
  const focus = activeItems.length ? activeItems : fallback
  const earliest = new Date(focus[0].at)
  const timeLabel = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(earliest)
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
