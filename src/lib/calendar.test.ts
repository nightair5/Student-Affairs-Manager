import { describe, expect, it } from 'vitest'
import {
  buildMonthCells,
  buildUpcomingCalendarItems,
  getUndatedCalendarEvents,
  groupEventsByDate,
  groupTasksByDate,
  localDateKey,
  summarizeCalendarDay,
  summarizeDay,
} from './calendar'
import type { Event, Task } from '../types'

function task(id: string, title: string, deadline: string, status: Task['status'] = '待开始'): Task {
  return {
    id, title, deadline, status, category: '其他', estimatedMinutes: 30,
    nextAction: title, description: '', priority: '中', riskFlags: [], materials: [],
    dependencies: [], reminders: [], sourceIds: [], priorityReason: '',
    createdAt: deadline, updatedAt: deadline, history: [],
  }
}

function calendarEvent(id: string, title: string, startAt: string | null, needsConfirmation = false): Event {
  return {
    id,
    title,
    startAt,
    endAt: null,
    description: '',
    evidenceIds: [],
    needsConfirmation,
    createdAt: startAt ?? '2026-08-01T08:00:00+08:00',
    updatedAt: startAt ?? '2026-08-01T08:00:00+08:00',
  }
}

describe('calendar summaries', () => {
  it('builds a stable six-week Monday-first month grid', () => {
    const cells = buildMonthCells(new Date(2026, 7, 1), new Date(2026, 7, 2))
    expect(cells).toHaveLength(42)
    expect(cells[0].dateKey).toBe('2026-07-27')
    expect(cells[6].dateKey).toBe('2026-08-02')
    expect(cells[6].isToday).toBe(true)
  })

  it('groups tasks by full local date instead of mixing the same day across months', () => {
    const grouped = groupTasksByDate([
      task('aug', '八月任务', '2026-08-03T09:00'),
      task('sep', '九月任务', '2026-09-03T09:00'),
    ])
    expect(grouped.get('2026-08-03')?.[0].title).toBe('八月任务')
    expect(grouped.get('2026-09-03')?.[0].title).toBe('九月任务')
  })

  it('compresses a busy day into one action-led headline and counts risks', () => {
    const first = task('a', '提交报名表和确认函', '2026-08-03T09:00')
    first.riskFlags = ['紧急']
    const summary = summarizeDay([
      first,
      task('b', '参加学院说明会', '2026-08-03T11:00'),
      task('c', '导师签字', '2026-08-03T15:00', '已完成'),
    ])
    expect(summary).toMatchObject({ total: 3, active: 2, completed: 1, riskCount: 1 })
    expect(summary?.headline).toBe('提交报名表…等 2 项')
    expect(summary?.compactHeadline).toBe('提交报名')
    expect(summary?.timeLabel).toBe('09:00')
  })

  it('keeps a readable compact action label for narrow calendar cells', () => {
    expect(summarizeDay([
      task('long', '完成调研报告初稿', '2026-08-03T20:00'),
    ])?.compactHeadline).toBe('完成调研')
    expect(summarizeDay([
      task('done', '提交报名表', '2026-08-03T09:00', '已完成'),
    ])?.compactHeadline).toBe('已完成')
  })

  it('uses local date keys without UTC day drift', () => {
    expect(localDateKey(new Date(2026, 7, 3, 0, 30))).toBe('2026-08-03')
    expect(localDateKey('2026-08-03T00:30:00+08:00')).toBe('2026-08-03')
    expect(localDateKey('2026-08-03T09:00')).toBe('2026-08-03')
  })

  it('groups canonical events and includes them in day summaries', () => {
    const event = calendarEvent('event', '参加答辩说明会', '2026-08-03T08:30:00+08:00', true)
    const events = groupEventsByDate([event, calendarEvent('unknown', '时间待确认', null)])
    const summary = summarizeCalendarDay([
      task('task', '提交答辩材料', '2026-08-03T09:00:00+08:00'),
    ], events.get('2026-08-03') ?? [])

    expect(events.get('2026-08-03')).toEqual([event])
    expect(summary).toMatchObject({ total: 2, active: 2, taskCount: 1, eventCount: 1, riskCount: 1 })
    expect(summary?.headline).toBe('参加答辩说…等 2 项')
    expect(summary?.timeLabel).toBe('08:30')
  })

  it('returns the complete upcoming task and event timeline without truncation', () => {
    const now = new Date('2026-08-03T08:00:00+08:00')
    const items = buildUpcomingCalendarItems(
      Array.from({ length: 6 }, (_, index) => task(`task-${index}`, `任务 ${index}`, `2026-08-03T${String(9 + index).padStart(2, '0')}:00:00+08:00`)),
      [calendarEvent('event', '说明会', '2026-08-03T08:30:00+08:00')],
      now,
    )

    expect(items).toHaveLength(7)
    expect(items.map((item) => `${item.kind}:${item.id}`)).toEqual([
      'event:event',
      'task:task-0',
      'task:task-1',
      'task:task-2',
      'task:task-3',
      'task:task-4',
      'task:task-5',
    ])
  })

  it('keeps null and invalid event times in an explicit undated queue', () => {
    const missing = calendarEvent('missing', '答辩时间待确认', null, true)
    const invalid = {
      ...calendarEvent('invalid', '地点已定、时间待确认', 'not-a-date', true),
      updatedAt: '2026-08-04T08:00:00+08:00',
    }
    const dated = calendarEvent('dated', '答辩说明会', '2026-08-05T08:30:00+08:00')

    expect(getUndatedCalendarEvents([missing, dated, invalid]).map((event) => event.id)).toEqual([
      'invalid',
      'missing',
    ])
    expect(buildUpcomingCalendarItems([], [missing, dated, invalid], new Date('2026-08-03T08:00:00+08:00'))
      .map((item) => item.id)).toEqual(['dated'])
  })
})
