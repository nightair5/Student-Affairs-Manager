import type { CourseBlock, Task } from '../types'

export interface SuggestedWorkSlot {
  start: string
  end: string
  reason: string
}

function weekday(date: Date): CourseBlock['weekday'] {
  const day = date.getDay()
  return (day === 0 ? 7 : day) as CourseBlock['weekday']
}

function minutesSinceMidnight(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function roundToHalfHour(date: Date): Date {
  const result = new Date(date)
  result.setSeconds(0, 0)
  result.setMinutes(Math.ceil(result.getMinutes() / 30) * 30)
  return result
}

function overlapsCourse(start: Date, end: Date, blocks: CourseBlock[]): boolean {
  const startMinutes = start.getHours() * 60 + start.getMinutes()
  const endMinutes = end.getHours() * 60 + end.getMinutes()
  return blocks.some((block) =>
    block.weekday === weekday(start) &&
    startMinutes < minutesSinceMidnight(block.endTime) &&
    endMinutes > minutesSinceMidnight(block.startTime),
  )
}

export function findSuggestedWorkSlot(
  task: Task,
  courseBlocks: CourseBlock[],
  now = new Date(),
): SuggestedWorkSlot | null {
  const deadline = new Date(task.deadline)
  if (!Number.isFinite(deadline.getTime()) || deadline <= now) return null
  const duration = Math.max(30, task.estimatedMinutes) * 60_000
  let cursor = roundToHalfHour(now)
  const latest = deadline.getTime() - duration

  while (cursor.getTime() <= latest) {
    if (cursor.getHours() < 8) cursor.setHours(8, 0, 0, 0)
    const end = new Date(cursor.getTime() + duration)
    const endMinutes = end.getHours() * 60 + end.getMinutes()
    if (end.getDate() !== cursor.getDate() || endMinutes > 22 * 60) {
      cursor.setDate(cursor.getDate() + 1)
      cursor.setHours(8, 0, 0, 0)
      continue
    }
    if (!overlapsCourse(cursor, end, courseBlocks)) {
      return {
        start: cursor.toISOString(),
        end: end.toISOString(),
        reason: courseBlocks.length
          ? '已避开已录入课程时段，仍需你确认其他安排'
          : '尚未录入课程表，当前仅按 08:00–22:00 建议',
      }
    }
    cursor = new Date(cursor.getTime() + 30 * 60_000)
  }
  return null
}
