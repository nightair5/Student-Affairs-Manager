import { describe, expect, it } from 'vitest'
import { demoTasks } from '../data/demo'
import {
  calculateTaskPriority,
  formatDuration,
  getBlockedAndWaitingTasks,
  getExecutableTasks,
  getFocusTasks,
  getMaterialProgress,
  getTaskScore,
  summarizeCanonicalProjectMaterials,
} from './taskLogic'
import type { MaterialItemEntity } from '../types'

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

  it('keeps waiting tasks out of focus even when pinned', () => {
    const snoozed = { ...demoTasks[1], snoozedUntil: '2026-08-01T09:00:00+08:00' }
    expect(getFocusTasks([snoozed], now)).toHaveLength(0)
    expect(getFocusTasks([{ ...snoozed, pinnedUntil: '2026-08-02T09:00:00+08:00' }], now)).toHaveLength(0)
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

  it('does not backfill blocked tasks when every active task is blocked', () => {
    const dependency = { ...demoTasks[0], id: 'dependency', status: '待开始' as const, dependencyIds: [], dependencies: [] }
    const first = { ...demoTasks[1], id: 'blocked-a', dependencyIds: [dependency.id], dependencies: ['等待前置任务'] }
    const second = { ...demoTasks[2], id: 'blocked-b', dependencies: ['等待学院盖章'] }

    expect(getFocusTasks([first, second, dependency], now).map((task) => task.id)).toEqual(['dependency'])
    expect(getFocusTasks([first, second], now)).toEqual([])
  })

  it('keeps blocked and waiting work in a separate explainable queue', () => {
    const dependency = { ...demoTasks[0], id: 'dependency', status: '待开始' as const, dependencyIds: [], dependencies: [] }
    const blocked = { ...demoTasks[1], id: 'blocked', dependencyIds: [dependency.id] }
    const waiting = {
      ...demoTasks[2],
      id: 'waiting',
      dependencyIds: [],
      dependencies: [],
      snoozedUntil: '2026-08-02T09:00:00+08:00',
      pinnedUntil: '2026-08-02T09:00:00+08:00',
    }
    const queue = getBlockedAndWaitingTasks([blocked, dependency, waiting], now)

    expect(queue.map(({ task, state }) => `${state}:${task.id}`)).toEqual([
      'blocked:blocked',
      'waiting:waiting',
    ])
    expect(queue[0].reason).toContain('前置事项')
    expect(queue[1].reason).toContain('稍后到')
  })

  it('uses canonical dependency ids without stale legacy text after completion', () => {
    const completedDependency = { ...demoTasks[0], id: 'dependency-complete', status: '已完成' as const }
    const task = {
      ...demoTasks[1],
      id: 'dependent',
      dependencyIds: [completedDependency.id],
      dependencies: [completedDependency.id],
    }

    const priority = calculateTaskPriority(task, [task, completedDependency], now)

    expect(priority.risks).not.toContain('有依赖')
    expect(getExecutableTasks([task, completedDependency], now).map((item) => item.id)).toEqual(['dependent'])
  })

  it('fails closed for missing canonical dependencies and only falls back to text without ids', () => {
    const missingCanonical = { ...demoTasks[0], id: 'missing-canonical', dependencyIds: ['not-found'], dependencies: [] }
    const legacyTextOnly = { ...demoTasks[1], id: 'legacy-text', dependencyIds: [], dependencies: ['等待学院盖章'] }

    expect(getExecutableTasks([missingCanonical, legacyTextOnly], now)).toEqual([])
    expect(calculateTaskPriority(missingCanonical, [missingCanonical], now).reasons.join('；')).toContain('前置事项')
    expect(calculateTaskPriority(legacyTextOnly, [legacyTextOnly], now).reasons.join('；')).toContain('前置事项')
  })

  it('excludes both blocked and not-yet-due snoozed tasks from executable work', () => {
    const dependency = { ...demoTasks[0], id: 'dependency', status: '待开始' as const, dependencyIds: [], dependencies: [] }
    const blocked = { ...demoTasks[1], id: 'blocked', dependencyIds: [dependency.id], dependencies: [] }
    const snoozed = { ...demoTasks[2], id: 'snoozed', dependencyIds: [], dependencies: [], snoozedUntil: '2026-08-02T09:00:00+08:00' }

    expect(getExecutableTasks([blocked, snoozed, dependency], now).map((task) => task.id)).toEqual(['dependency'])
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

  it('deduplicates canonical project materials and includes project-level material updates', () => {
    const material = (
      id: string,
      projectId: string,
      status: MaterialItemEntity['status'],
      updatedAt: string,
      taskId?: string,
    ): MaterialItemEntity => ({
      id,
      projectId,
      taskId,
      name: `材料 ${id}`,
      required: true,
      status,
      evidenceIds: [],
      createdAt: '2026-08-01T08:00:00.000Z',
      updatedAt,
    })
    const summary = summarizeCanonicalProjectMaterials([
      material('shared', 'project-a', 'preparing', '2026-08-02T08:00:00.000Z', 'task-a'),
      material('shared', 'project-a', 'ready', '2026-08-03T08:00:00.000Z', 'task-b'),
      material('project-level', 'project-a', 'missing', '2026-08-04T08:00:00.000Z'),
      material('other', 'project-b', 'ready', '2026-08-05T08:00:00.000Z'),
    ], 'project-a')

    expect(summary).toEqual({
      total: 2,
      ready: 1,
      missing: 1,
      latestUpdatedAt: '2026-08-04T08:00:00.000Z',
    })
  })
})
