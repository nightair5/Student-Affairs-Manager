import { describe, expect, it } from 'vitest'
import { demoTasks } from '../data/demo'
import type { CourseBlock } from '../types'
import { findSuggestedWorkSlot } from './scheduling'

describe('findSuggestedWorkSlot', () => {
  it('避开同一天的课程时间', () => {
    const task = { ...demoTasks[0], estimatedMinutes: 60, deadline: '2026-08-03T18:00:00+08:00' }
    const blocks: CourseBlock[] = [{
      id: 'course-1',
      title: '专业课',
      weekday: 1,
      startTime: '08:00',
      endTime: '10:00',
      createdAt: '2026-08-01T00:00:00+08:00',
    }]
    const slot = findSuggestedWorkSlot(task, blocks, new Date('2026-08-03T07:50:00+08:00'))
    expect(new Date(slot?.start ?? '').getHours()).toBe(10)
    expect(slot?.reason).toContain('已避开')
  })

  it('已逾期任务不生成虚假的开工建议', () => {
    const task = { ...demoTasks[0], deadline: '2026-08-01T09:00:00+08:00' }
    expect(findSuggestedWorkSlot(task, [], new Date('2026-08-01T10:00:00+08:00'))).toBeNull()
  })
})
