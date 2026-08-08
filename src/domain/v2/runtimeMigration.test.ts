import { describe, expect, it } from 'vitest'
import type { WorkspaceData } from '../../types'
import anonymousV7Copy from './fixtures/workspace-v7-anonymous-copy.json'
import { createGoldenWorkspaceV8 } from './fixtures'
import { parseWorkspaceV7Snapshot, workspaceSnapshotHash } from './migration'
import { CanonicalWorkspaceRepository, CURRENT_WORKSPACE_RECORD_KEY, MemoryWorkspaceRecordStore } from './repository'

const v7Copy = anonymousV7Copy as unknown as WorkspaceData

describe('B2 v7 to v8 runtime migration', () => {
  it('migrates, reloads and rolls back an anonymized real v7 workspace copy', async () => {
    const original = structuredClone(v7Copy)
    const store = new MemoryWorkspaceRecordStore({ [CURRENT_WORKSPACE_RECORD_KEY]: original })
    const repository = new CanonicalWorkspaceRepository(store)

    const result = await repository.loadOrMigrate({ now: '2026-08-08T10:00:00.000Z', migrationId: 'v7_to_v8_canonical_domain_001' })
    expect(result.status).toBe('migration_success')
    expect(result.workspace?.tasks.map((item) => item.id)).toEqual(['task-v7-copy'])
    expect(result.workspace?.milestones[0].id).toBe('milestone-v7-stable')
    expect(result.workspace?.materials[0]).toMatchObject({ formatRequirements: ['PDF/A'], quantity: 1, status: 'preparing' })
    expect(result.workspace?.evidenceRefs[0]).toMatchObject({ quotedText: '8月25日17:00前提交作品', page: 1 })
    expect(result.workspace?.events[0]).toMatchObject({ startTimePointId: 'time:event:event-v7-copy:start', endTimePointId: 'time:event:event-v7-copy:end' })
    expect(result.workspace?.timePoints.filter((item) => item.eventId === 'event-v7-copy')).toHaveLength(2)
    expect(result.workspace?.preferences.legacyData?.v7LegacyData).toEqual({ legacyCustomField: { foo: 'bar' } })
    expect(result.workspace?.preferences.legacyData?.unknownTopLevelFields).toEqual({ unknownTopLevelField: { mustSurvive: true } })

    const reloaded = await repository.load()
    expect(reloaded).toEqual(result.workspace)
    const backup = await repository.readMigrationBackup(result.backupId!)
    expect(backup?.snapshot).toEqual(original)
    expect(backup?.integrityHash).toBe(workspaceSnapshotHash(original))

    await repository.rollbackMigration(result.backupId!)
    const rolledBackRaw = await store.read(CURRENT_WORKSPACE_RECORD_KEY)
    expect(parseWorkspaceV7Snapshot(rolledBackRaw)).toEqual(original)
  })

  it('uses stable entity IDs when the same v7 snapshot is migrated twice', async () => {
    const migrate = async () => {
      const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore({ [CURRENT_WORKSPACE_RECORD_KEY]: v7Copy }))
      return (await repository.loadOrMigrate({ now: '2026-08-08T10:00:00.000Z', migrationId: 'stable-migration' })).workspace!
    }
    const first = await migrate()
    const second = await migrate()
    expect(second.milestones.map((item) => item.id)).toEqual(first.milestones.map((item) => item.id))
    expect(second.timePoints.map((item) => item.id)).toEqual(first.timePoints.map((item) => item.id))
    expect(second.materials.map((item) => item.id)).toEqual(first.materials.map((item) => item.id))
  })

  it('keeps the v7 current record and backup when graph validation fails', async () => {
    const invalid = structuredClone(v7Copy)
    invalid.tasks[0].projectId = 'missing-project'
    const store = new MemoryWorkspaceRecordStore({ [CURRENT_WORKSPACE_RECORD_KEY]: invalid })
    const repository = new CanonicalWorkspaceRepository(store)
    const result = await repository.loadOrMigrate({ now: '2026-08-08T10:00:00.000Z', migrationId: 'failed-migration' })

    expect(result.status).toBe('migration_failed')
    expect(result.errors.some((item) => item.includes('MISSING_REFERENCE'))).toBe(true)
    expect(parseWorkspaceV7Snapshot(await store.read(CURRENT_WORKSPACE_RECORD_KEY))).toEqual(invalid)
    expect(await repository.readMigrationBackup(result.backupId!)).not.toBeNull()
  })

  it('does not migrate or rewrite an already canonical Workspace v8', async () => {
    const canonical = createGoldenWorkspaceV8()
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore({ [CURRENT_WORKSPACE_RECORD_KEY]: canonical }))
    const result = await repository.loadOrMigrate()
    expect(result).toMatchObject({ status: 'already_v8', backupId: null, errors: [] })
    expect(result.workspace).toEqual(canonical)
  })
})
