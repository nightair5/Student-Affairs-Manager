import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { buildBrowserReminderJobs, toDateTimeLocalValue } from './notifications'

const baseTask: Task = {
  id: 'task-1',
  title: '提交报名表',
  category: '比赛',
  status: '待开始',
  deadline: '2026-08-02T18:00:00+08:00',
  estimatedMinutes: 60,
  nextAction: '请老师签字',
  description: '',
  priority: '高',
  riskFlags: [],
  materials: [],
  dependencies: [],
  sourceIds: [],
  priorityReason: '',
  createdAt: '2026-08-01T00:00:00+08:00',
  updatedAt: '2026-08-01T00:00:00+08:00',
  history: [],
  reminders: [],
}

describe('buildBrowserReminderJobs', () => {
  it('只为已启用的浏览器提醒生成计划', () => {
    const tasks: Task[] = [
      {
        ...baseTask,
        reminders: [
          {
            id: 'browser-1',
            channel: 'browser',
            enabled: true,
            scheduledAt: '2026-08-01T10:05:00+08:00',
          },
          {
            id: 'email-1',
            channel: 'email',
            enabled: true,
            scheduledAt: '2026-08-01T10:05:00+08:00',
          },
        ],
      },
    ]

    const jobs = buildBrowserReminderJobs(
      tasks,
      new Date('2026-08-01T10:00:00+08:00'),
    )
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      reminderId: 'browser-1',
      delayMs: 300_000,
      title: '学生事务管家 · 提交报名表',
    })
  })

  it('跳过很早已错过和超出浏览器定时范围的提醒', () => {
    const tasks: Task[] = [
      {
        ...baseTask,
        reminders: [
          {
            id: 'old',
            channel: 'browser',
            enabled: true,
            scheduledAt: '2026-08-01T09:00:00+08:00',
          },
          {
            id: 'far',
            channel: 'browser',
            enabled: true,
            scheduledAt: '2026-09-01T10:00:00+08:00',
          },
        ],
      },
    ]

    expect(
      buildBrowserReminderJobs(tasks, new Date('2026-08-01T10:00:00+08:00')),
    ).toEqual([])
  })
})

describe('toDateTimeLocalValue', () => {
  it('不使用 UTC 偏移改写本地表单时间', () => {
    const date = new Date(2026, 7, 1, 9, 5)
    expect(toDateTimeLocalValue(date)).toBe('2026-08-01T09:05')
  })
})
