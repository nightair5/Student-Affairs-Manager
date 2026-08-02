import type { Task } from '../types'

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
  timeLabel: string
  riskCount: number
}

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

function shortTitle(title: string, limit = 9): string {
  const characters = [...title.trim()]
  return characters.length > limit ? `${characters.slice(0, limit).join('')}…` : characters.join('')
}

export function summarizeDay(tasks: Task[]): DaySummary | null {
  if (!tasks.length) return null
  const sorted = [...tasks].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  const activeTasks = sorted.filter((task) => task.status !== '已完成')
  const focus = activeTasks.length ? activeTasks : sorted
  const earliest = new Date(focus[0].deadline)
  const timeLabel = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(earliest)
  const riskCount = activeTasks.filter((task) => task.riskFlags.length > 0).length

  return {
    total: sorted.length,
    active: activeTasks.length,
    completed: sorted.length - activeTasks.length,
    headline: activeTasks.length === 0
      ? `已完成 ${sorted.length} 项`
      : activeTasks.length === 1
        ? shortTitle(activeTasks[0].title, 11)
        : `${shortTitle(activeTasks[0].title, 5)}等 ${activeTasks.length} 项`,
    timeLabel,
    riskCount,
  }
}
