import { describe, expect, it } from 'vitest'
import { demoTasks } from '../data/demo'
import { buildActivityReport, buildReportContext, getReportRange } from './reports'

describe('activity reports', () => {
  it('uses Monday to Sunday for weekly reports', () => {
    const range = getReportRange('week', new Date('2026-08-05T12:00:00+08:00'))
    expect(range.label).toBe('2026-08-03 至 2026-08-09')
  })

  it('builds exportable local markdown and CSV without source bodies', () => {
    const tasks = demoTasks.map((task, index) => index === 0 ? {
      ...task,
      status: '已完成' as const,
      completedAt: '2026-08-05T12:00:00+08:00',
      deadline: '2026-08-06T18:00',
    } : task)
    const report = buildActivityReport(tasks, [], 'week', new Date('2026-08-05T12:00:00+08:00'))
    expect(report.completed).toHaveLength(1)
    expect(report.markdown).toContain('# 学生事务周报')
    expect(report.csv).toContain('任务,分类,状态')
    expect(buildReportContext(report)).toHaveLength(4)
    expect(buildReportContext(report).every((item) => item.excerpt.length <= 500)).toBe(true)
  })
})
