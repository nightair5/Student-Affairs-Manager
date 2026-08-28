import { describe, expect, it } from 'vitest'
import { createWorkspaceData } from './workspace'
import {
  nextWorkspaceRecoveryAction,
  safeWorkspaceRecoveryErrors,
  workspacePersistenceRevision,
} from './workspaceRecoveryUi'

describe('workspace recovery UI guards', () => {
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
