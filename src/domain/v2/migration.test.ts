import { describe, expect, it } from 'vitest'
import { demoSources, demoTasks } from '../../data/demo'
import { createWorkspaceData } from '../../lib/workspace'
import { applyPreparedV8Migration, prepareV7ToV8Migration, rollbackPreparedV8Migration } from './migration'
import { validateWorkspaceV8 } from './validators/workspaceValidator'

const NOW = '2026-08-08T08:00:00.000Z'

describe('offline v7 to v8 migration contract', () => {
  it('prepares a validated v8 graph without mutating the v7 input', () => {
    const input = createWorkspaceData(demoTasks, demoSources)
    const before = JSON.stringify(input)
    const preparation = prepareV7ToV8Migration(input, { now: NOW, migrationId: 'migration-test' })
    expect(JSON.stringify(input)).toBe(before)
    const migrated = applyPreparedV8Migration(preparation)
    expect(migrated.schemaVersion).toBe(8)
    expect(validateWorkspaceV8(migrated).valid).toBe(true)
    expect(migrated.tasks.map((task) => task.id)).toEqual(input.tasks.map((task) => task.id))
    expect(migrated.materials.length).toBe(input.materialItems.length)
    expect(migrated.timePoints.length).toBeGreaterThanOrEqual(input.timePoints.length)
    expect(preparation.backup.snapshot).toEqual(input)
  })

  it('maps legacy task deadlines to independent time points without sentinel dates', () => {
    const input = createWorkspaceData(demoTasks, demoSources)
    input.tasks[0].deadline = '1970-01-01T00:00'
    input.timePoints = input.timePoints.filter((point) => point.taskId !== input.tasks[0].id)
    const preparation = prepareV7ToV8Migration(input, { now: NOW, migrationId: 'migration-sentinel' })
    const migrated = applyPreparedV8Migration(preparation)
    const deadline = migrated.timePoints.find((point) => point.taskId === input.tasks[0].id && point.type === 'task_deadline')
    expect(deadline).toMatchObject({ normalizedValue: null, precision: 'vague', needsConfirmation: true })
    expect(preparation.metadata.status).toBe('needs_review')
  })

  it('creates stable independent milestones from embedded v7 milestones', () => {
    const input = createWorkspaceData(demoTasks, demoSources)
    const project = {
      id: 'project-legacy',
      title: '旧比赛项目',
      category: '比赛' as const,
      sourceIds: [input.sources[0].id],
      taskIds: [],
      milestones: [{ id: 'milestone-stable', projectId: 'project-legacy', title: '提交', dueAt: '2026-08-20', status: '待完成' as const, createdAt: NOW }],
      status: 'active' as const,
      createdAt: NOW,
      updatedAt: NOW,
    }
    input.projects.push(project)
    const first = applyPreparedV8Migration(prepareV7ToV8Migration(input, { now: NOW, migrationId: 'migration-first' }))
    const second = applyPreparedV8Migration(prepareV7ToV8Migration(input, { now: NOW, migrationId: 'migration-second' }))
    expect(first.milestones[0].id).toBe('milestone-stable')
    expect(second.milestones[0].id).toBe('milestone-stable')
    expect(first.projects[0].legacyData?.embeddedMilestones).toBeTruthy()
  })

  it('rolls back to the exact pre-migration v7 backup', () => {
    const input = createWorkspaceData(demoTasks, demoSources)
    input.legacyData = { legacyCustomField: { foo: 'bar' } }
    const preparation = prepareV7ToV8Migration(input, { now: NOW, migrationId: 'migration-rollback' })
    expect(rollbackPreparedV8Migration(preparation)).toEqual(input)
    const rollback = rollbackPreparedV8Migration(preparation)
    rollback.tasks.splice(0, 1)
    expect(preparation.backup.snapshot.tasks).toHaveLength(input.tasks.length)
  })

  it('fails closed on an invalid graph while keeping rollback data', () => {
    const input = createWorkspaceData(demoTasks, demoSources)
    input.tasks[0].projectId = 'missing-project'
    const preparation = prepareV7ToV8Migration(input, { now: NOW, migrationId: 'migration-invalid' })
    expect(preparation.workspace).toBeNull()
    expect(preparation.metadata.status).toBe('failed')
    expect(preparation.metadata.errors.some((error) => error.includes('MISSING_REFERENCE'))).toBe(true)
    expect(() => applyPreparedV8Migration(preparation)).toThrow('V8_MIGRATION_NOT_APPLICABLE')
    expect(rollbackPreparedV8Migration(preparation)).toEqual(input)
  })

  it('preserves unmappable old content instead of guessing', () => {
    const input = createWorkspaceData(demoTasks, demoSources)
    input.legacyData = { legacyCustomField: { foo: 'bar' } }
    ;(input.tasks[0] as typeof input.tasks[number] & { legacyCustomTaskField: { answer: number } }).legacyCustomTaskField = { answer: 42 }
    input.historyRecords.push({
      id: 'orphan-history', entityType: 'material', entityId: 'missing-material', field: '状态',
      before: '未知', after: '就绪', actor: 'user', action: 'updated', changedAt: NOW,
    })
    const preparation = prepareV7ToV8Migration(input, { now: NOW, migrationId: 'migration-preserve' })
    const migrated = applyPreparedV8Migration(preparation)
    expect(migrated.preferences.legacyData?.v7LegacyData).toEqual({ legacyCustomField: { foo: 'bar' } })
    expect(migrated.tasks[0].legacyData?.v7Record).toEqual(expect.objectContaining({ legacyCustomTaskField: { answer: 42 } }))
    expect(migrated.preferences.legacyData?.orphanHistoryRecords).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'orphan-history' })]))
    expect(preparation.metadata.status).toBe('needs_review')
  })
})
