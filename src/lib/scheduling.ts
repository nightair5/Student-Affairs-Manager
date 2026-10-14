import type { CourseBlock, Task } from '../types'
import {
  DEFAULT_WORKSPACE_TIMEZONE,
  instantToWallClock,
  parseBusinessDateTime,
  wallClockToInstant,
} from './timeSemantics'

export interface SuggestedWorkSlot {
  start: string
  end: string
  reason: string
}

function weekday(date: Date): CourseBlock['weekday'] {
  const day = date.getUTCDay()
  return (day === 0 ? 7 : day) as CourseBlock['weekday']
}

function minutesSinceMidnight(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function roundToHalfHour(date: Date): Date {
  const result = new Date(date)
  result.setUTCSeconds(0, 0)
  result.setUTCMinutes(Math.ceil(result.getUTCMinutes() / 30) * 30)
  return result
}

function overlapsCourse(start: Date, end: Date, blocks: CourseBlock[]): boolean {
  const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes()
  const endMinutes = end.getUTCHours() * 60 + end.getUTCMinutes()
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
  timeZone = DEFAULT_WORKSPACE_TIMEZONE,
): SuggestedWorkSlot | null {
  const deadlineInstant = parseBusinessDateTime(task.deadline, timeZone)
  if (!deadlineInstant || deadlineInstant <= now) return null
  const duration = Math.max(30, task.estimatedMinutes) * 60_000
  let cursor = roundToHalfHour(instantToWallClock(now, timeZone))
  const deadline = instantToWallClock(deadlineInstant, timeZone)
  const latest = deadline.getTime() - duration

  while (cursor.getTime() <= latest) {
    if (cursor.getUTCHours() < 8) cursor.setUTCHours(8, 0, 0, 0)
    const end = new Date(cursor.getTime() + duration)
    const endMinutes = end.getUTCHours() * 60 + end.getUTCMinutes()
    if (end.getUTCDate() !== cursor.getUTCDate() || endMinutes > 22 * 60) {
      cursor.setUTCDate(cursor.getUTCDate() + 1)
      cursor.setUTCHours(8, 0, 0, 0)
      continue
    }
    if (!overlapsCourse(cursor, end, courseBlocks)) {
      return {
        start: wallClockToInstant(cursor, timeZone).toISOString(),
        end: wallClockToInstant(end, timeZone).toISOString(),
        reason: courseBlocks.length
          ? '已避开已录入课程时段，仍需你确认其他安排'
          : '尚未录入课程表，当前仅按 08:00–22:00 建议',
      }
    }
    cursor = new Date(cursor.getTime() + 30 * 60_000)
  }
  return null
}
