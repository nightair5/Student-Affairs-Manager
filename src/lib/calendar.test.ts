import { describe, expect, it } from 'vitest'
import { buildMonthCells, groupTasksByDate, localDateKey, summarizeDay } from './calendar'
import type { Task } from '../types'

function task(id: string, title: string, deadline: string, status: Task['status'] = '待开始'): Task {
  return {
    id, title, deadline, status, category: '其他', estimatedMinutes: 30,
    nextAction: title, description: '', priority: '中', riskFlags: [], materials: [],
    dependencies: [], reminders: [], sourceIds: [], priorityReason: '',
    createdAt: deadline, updatedAt: deadline, history: [],
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
    expect(summary?.timeLabel).toBe('09:00')
  })

  it('uses local date keys without UTC day drift', () => {
    expect(localDateKey(new Date(2026, 7, 3, 0, 30))).toBe('2026-08-03')
  })
})
