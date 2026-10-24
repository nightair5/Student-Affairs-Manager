import { describe, expect, it } from 'vitest'
import { createWorkspaceData } from './workspace'
import {
  nextWorkspaceRecoveryAction,
  safeWorkspaceRecoveryErrors,
  workspacePersistenceRevision,
  safeIntakeError,
  workspaceLoadFailureText,
} from './workspaceRecoveryUi'

describe('workspace recovery UI guards', () => {
  it('never leaks raw schema details or unbounded errors into intake feedback', () => {
    const error = new Error('INVALID_TYPE:extractionDrafts[0].result.ambiguities[0].field:必须是字符串')
    expect(safeIntakeError(error)).toBe('整理暂时没有完成，输入仍在这里。请稍后重试。')
    expect(workspaceLoadFailureText(error)).toContain('历史数据')
    const missingReference = new Error('MISSING_REFERENCE:tasks[0].projectId:引用对象不存在')
    expect(workspaceLoadFailureText(missingReference)).toContain('历史数据')
    expect(safeIntakeError(missingReference)).not.toContain('projectId')
    expect(safeIntakeError(new Error('Error: private diagnostic'))).not.toContain('private')
    expect(safeIntakeError(new Error('字段错误'.repeat(300)))).not.toContain('字段错误')
    expect(safeIntakeError(new Error('当前请求较多，请稍后重试。'))).toBe('当前请求较多，请稍后重试。')
  })
  it('treats savedAt-only hydration changes as the same persistence revision', () => {
    const first = createWorkspaceData([], [])
    const second = { ...first, savedAt: '2099-01-01T00:00:00.000Z' }

    expect(workspacePersistenceRevision(second)).toBe(workspacePersistenceRevision(first))
    expect(workspacePersistenceRevision({
      ...second,
      legacyData: { changedByUser: true },
    })).not.toBe(workspacePersistenceRevision(first))
  })

  it('requires backup export and a separate confirmation step before recovery', () => {
    expect(nextWorkspaceRecoveryAction(false, false)).toBe('blocked')
    expect(nextWorkspaceRecoveryAction(true, false)).toBe('arm')
    expect(nextWorkspaceRecoveryAction(true, true)).toBe('recover')
  })

  it('only exposes bounded machine-readable recovery errors', () => {
    expect(safeWorkspaceRecoveryErrors([
      'MIGRATION_LINEAGE_MISMATCH',
      'MIGRATION_LINEAGE_MISMATCH',
      'unsafe user content / private data',
    ])).toEqual(['MIGRATION_LINEAGE_MISMATCH'])
    expect(safeWorkspaceRecoveryErrors(['not safe'])).toEqual(['WORKSPACE_RECOVERY_REQUIRED'])
  })
})
