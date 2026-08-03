import { describe, expect, it } from 'vitest'
import { demoTasks } from '../data/demo'
import { updateTaskWithHistory } from './taskUpdates'

describe('task updates', () => {
  it('records each changed field with before and after values', () => {
    const result = updateTaskWithHistory(
      demoTasks[0],
      {
        category: '课程',
        estimatedMinutes: 90,
      },
      '2026-07-31T12:00:00.000Z',
    )

    expect(result.category).toBe('课程')
    expect(result.estimatedMinutes).toBe(90)
    expect(result.history).toHaveLength(2)
    expect(result.history[0]).toMatchObject({
      field: '分类',
      before: '比赛',
      after: '课程',
    })
  })

  it('does not add history when nothing changes', () => {
    const task = demoTasks[0]
    expect(updateTaskWithHistory(task, { title: task.title })).toBe(task)
  })

  it('records a material status transition against the material entity', () => {
    const task = demoTasks[0]
    const materials = task.materials.map((material) => material.id === 'mat-2'
      ? { ...material, done: true, status: 'submitted' as const }
      : material)
    const result = updateTaskWithHistory(
      task,
      { materials },
      '2026-08-01T10:00:00.000Z',
    )

    expect(result.materials.find((material) => material.id === 'mat-2')?.status).toBe('submitted')
    expect(result.history.at(-1)).toMatchObject({
      entityType: 'material',
      entityId: 'mat-2',
      action: 'material_status_changed',
      before: 'missing',
      after: 'submitted',
    })
  })
})
