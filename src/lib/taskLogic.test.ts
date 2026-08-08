import { describe, expect, it } from 'vitest'
import { demoTasks } from '../data/demo'
import {
  calculateTaskPriority,
  formatDuration,
  getFocusTasks,
  getMaterialProgress,
  getTaskScore,
} from './taskLogic'

describe('task prioritization', () => {
  const now = new Date('2026-07-31T09:00:00+08:00')

  it('keeps the focus list to at most three active tasks', () => {
    const result = getFocusTasks(demoTasks, now)
    expect(result).toHaveLength(3)
    expect(result.every((task) => task.status !== '已完成')).toBe(true)
  })

  it('raises the score of urgent tasks', () => {
    const urgent = demoTasks.find((task) => task.riskFlags.includes('紧急'))!
    const lowRisk = demoTasks.find((task) => task.riskFlags.length === 0)!
    expect(getTaskScore(urgent, now)).toBeGreaterThan(
      getTaskScore(lowRisk, now),
    )
  })

  it('explains material, dependency, pin, and snooze decisions', () => {
    const dependency = { ...demoTasks[1], id: 'dependency', status: '待开始' as const }
    const task = {
      ...demoTasks[0],
      dependencyIds: [dependency.id],
      pinnedUntil: '2026-08-02T09:00:00+08:00',
      snoozedUntil: '2026-08-01T09:00:00+08:00',
    }
    const result = calculateTaskPriority(task, [task, dependency], now)
    expect(result.isPinned).toBe(true)
    expect(result.isSnoozed).toBe(true)
    expect(result.risks).toEqual(expect.arrayContaining(['缺材料', '有依赖']))
    expect(result.reasons.join('；')).toContain('你已置顶')
    expect(result.reasons.join('；')).toContain('前置事项')
  })

  it('keeps snoozed tasks out of focus unless pinned', () => {
    const snoozed = { ...demoTasks[1], snoozedUntil: '2026-08-01T09:00:00+08:00' }
    expect(getFocusTasks([snoozed], now)).toHaveLength(0)
    expect(getFocusTasks([{ ...snoozed, pinnedUntil: '2026-08-02T09:00:00+08:00' }], now)).toHaveLength(1)
  })

  it('spreads focus across projects and does not lead with blocked work when ready work exists', () => {
    const dependency = { ...demoTasks[0], id: 'dependency-ready', projectId: 'project-a', status: '待开始' as const }
    const blocked = { ...demoTasks[0], id: 'blocked', projectId: 'project-a', dependencyIds: [dependency.id], deadline: '2026-07-31T10:00:00+08:00' }
    const sameProject = { ...demoTasks[1], id: 'same-project', projectId: 'project-a', deadline: '2026-07-31T11:00:00+08:00' }
    const otherProject = { ...demoTasks[2], id: 'other-project', projectId: 'project-b', deadline: '2026-08-01T10:00:00+08:00' }
    const result = getFocusTasks([blocked, dependency, sameProject, otherProject], now, 3)
    expect(result[0].id).not.toBe('blocked')
    expect(new Set(result.map((task) => task.projectId))).toEqual(new Set(['project-a', 'project-b']))
  })
})

describe('task presentation helpers', () => {
  it('formats minutes in human language', () => {
    expect(formatDuration(45)).toBe('45 分钟')
    expect(formatDuration(120)).toBe('2 小时')
    expect(formatDuration(150)).toBe('2 小时 30 分钟')
  })

  it('calculates material completion', () => {
    expect(getMaterialProgress(demoTasks[0])).toEqual({ done: 1, total: 3 })
  })
})
