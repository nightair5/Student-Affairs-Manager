import { describe, expect, it } from 'vitest'
import type { WorkspaceData } from '../../types'
import anonymousV7Copy from './fixtures/workspace-v7-anonymous-copy.json'
import { createGoldenWorkspaceV8 } from './fixtures'
import { parseWorkspaceV7Snapshot, workspaceSnapshotHash } from './migration'
import {
  CanonicalWorkspaceRepository,
  CURRENT_WORKSPACE_RECORD_KEY,
  MemoryWorkspaceRecordStore,
  type WorkspaceRecordStore,
} from './repository'

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

  it('persists the exact v7 backup before nested malformed data fails migration', async () => {
    const malformed = structuredClone(v7Copy) as unknown as { tasks: unknown[] }
    malformed.tasks[0] = null
    const store = new MemoryWorkspaceRecordStore({ [CURRENT_WORKSPACE_RECORD_KEY]: malformed })
    const repository = new CanonicalWorkspaceRepository(store)

    const result = await repository.loadOrMigrate({
      now: '2026-08-08T10:00:00.000Z',
      migrationId: 'nested-malformed-v7',
    })

    expect(result).toMatchObject({ status: 'migration_failed', errors: ['WORKSPACE_V7_NESTED_INVALID'] })
    expect(result.backupId).toBe('backup:nested-malformed-v7')
    expect(await store.read(CURRENT_WORKSPACE_RECORD_KEY)).toEqual(malformed)
    expect((await repository.readMigrationBackup(result.backupId!))?.snapshot).toEqual(malformed)
  })

  it('commits the backup transaction before invoking a migration preparer that throws', async () => {
    const delegate = new MemoryWorkspaceRecordStore({ [CURRENT_WORKSPACE_RECORD_KEY]: v7Copy })
    const order: string[] = []
    const store: WorkspaceRecordStore = {
      read: (key) => delegate.read(key),
      write: (key, value) => delegate.write(key, value),
      remove: (key) => delegate.remove(key),
      transaction: (key, mutate) => delegate.transaction(key, mutate),
      transactionMany: async (keys, mutate) => {
        const result = await delegate.transactionMany(keys, mutate)
        order.push('backup-transaction-committed')
        return result
      },
    }
    const repository = new CanonicalWorkspaceRepository(
      store,
      CURRENT_WORKSPACE_RECORD_KEY,
      () => {
        order.push('prepare-started')
        throw new Error('INJECTED_PREPARE_FAILURE')
      },
    )

    const result = await repository.loadOrMigrate({
      now: '2026-08-08T10:00:00.000Z',
      migrationId: 'prepare-fault-injection',
    })

    expect(order).toEqual(['backup-transaction-committed', 'prepare-started'])
    expect(result).toMatchObject({
      status: 'migration_failed',
      backupId: 'backup:prepare-fault-injection',
      errors: ['INJECTED_PREPARE_FAILURE'],
    })
    expect(await delegate.read(CURRENT_WORKSPACE_RECORD_KEY)).toEqual(v7Copy)
    expect((await repository.readMigrationBackup(result.backupId!))?.snapshot).toEqual(v7Copy)
  })

  it('reports a usable backup after migration and rejects rollback over later edits', async () => {
    const store = new MemoryWorkspaceRecordStore({ [CURRENT_WORKSPACE_RECORD_KEY]: v7Copy })
    const repository = new CanonicalWorkspaceRepository(store)
    const migrated = await repository.loadOrMigrate({
      now: '2026-08-08T10:00:00.000Z',
      migrationId: 'lineage-protected-migration',
    })
    expect(migrated.status).toBe('migration_success')

    const backupStatus = await repository.loadOrMigrate()
    expect(backupStatus).toMatchObject({
      status: 'backup_available',
      backupId: migrated.backupId,
      errors: [],
    })

    await repository.transaction((workspace) => ({
      ...workspace,
      workspace: {
        ...workspace.workspace,
        title: '迁移后由用户修改的工作区',
        updatedAt: '2026-08-08T11:00:00.000Z',
      },
      savedAt: '2026-08-08T11:00:00.000Z',
    }))
    const edited = await repository.load()
    await expect(repository.rollbackMigration(migrated.backupId!)).rejects.toThrow(
      'MIGRATION_ROLLBACK_WORKSPACE_CHANGED',
    )
    expect(await repository.load()).toEqual(edited)
  })

  it('keeps the persisted v7 backup immutable across apply, rollback and same-lineage retry', async () => {
    const store = new MemoryWorkspaceRecordStore({ [CURRENT_WORKSPACE_RECORD_KEY]: v7Copy })
    const repository = new CanonicalWorkspaceRepository(store)
    const first = await repository.loadOrMigrate({
      now: '2026-08-08T10:00:00.000Z',
      migrationId: 'immutable-backup',
    })
    const backupAfterApply = await repository.readMigrationBackup(first.backupId!)
    expect(backupAfterApply).not.toHaveProperty('targetIntegrityHash')

    await repository.rollbackMigration(first.backupId!)
    const second = await repository.loadOrMigrate({ migrationId: 'immutable-backup' })

    expect(second.status).toBe('migration_success')
    expect(await repository.readMigrationBackup(first.backupId!)).toEqual(backupAfterApply)
  })

  it('reports recovery_required when a migrated v8 record becomes structurally invalid', async () => {
    const store = new MemoryWorkspaceRecordStore({ [CURRENT_WORKSPACE_RECORD_KEY]: v7Copy })
    const repository = new CanonicalWorkspaceRepository(store)
    const migrated = await repository.loadOrMigrate({
      now: '2026-08-08T10:00:00.000Z',
      migrationId: 'recoverable-v8',
    })
    const corrupted = structuredClone(migrated.workspace!) as unknown as {
      tasks: Array<Record<string, unknown>>
    }
    corrupted.tasks[0].status = 'invalid-status'
    await store.write(CURRENT_WORKSPACE_RECORD_KEY, corrupted)

    const result = await repository.loadOrMigrate()
    expect(result).toMatchObject({
      status: 'recovery_required',
      backupId: migrated.backupId,
      workspace: null,
      errors: ['WORKSPACE_V8_INVALID:INVALID_ENUM:tasks[0].status'],
    })
    expect((await repository.readMigrationBackup(migrated.backupId!))?.snapshot).toEqual(v7Copy)

    await repository.rollbackMigration(migrated.backupId!)
    expect(parseWorkspaceV7Snapshot(await store.read(CURRENT_WORKSPACE_RECORD_KEY))).toEqual(v7Copy)
  })

  it('refuses damaged v8 recovery when the raw migration lineage is missing', async () => {
    const store = new MemoryWorkspaceRecordStore({ [CURRENT_WORKSPACE_RECORD_KEY]: v7Copy })
    const repository = new CanonicalWorkspaceRepository(store)
    const migrated = await repository.loadOrMigrate({
      now: '2026-08-08T10:00:00.000Z',
      migrationId: 'missing-raw-lineage',
    })
    const corrupted = structuredClone(migrated.workspace!) as unknown as {
      tasks: Array<Record<string, unknown>>
      migrationMetadata: unknown[]
    }
    corrupted.tasks[0].status = 'invalid-status'
    corrupted.migrationMetadata = []
    await store.write(CURRENT_WORKSPACE_RECORD_KEY, corrupted)

    await expect(repository.rollbackMigration(migrated.backupId!)).rejects.toThrow(
      'MIGRATION_ROLLBACK_LINEAGE_MISMATCH',
    )
    expect(await store.read(CURRENT_WORKSPACE_RECORD_KEY)).toEqual(corrupted)
  })

  it('rejects a backup whose snapshot does not satisfy the v7 envelope even when its hash matches', async () => {
    const store = new MemoryWorkspaceRecordStore({ [CURRENT_WORKSPACE_RECORD_KEY]: v7Copy })
    const repository = new CanonicalWorkspaceRepository(store)
    const migrated = await repository.loadOrMigrate({
      now: '2026-08-08T10:00:00.000Z',
      migrationId: 'invalid-backup-snapshot',
    })
    const backup = await store.read(migrated.backupId!) as Record<string, unknown>
    const invalidSnapshot = { schemaVersion: 7, tasks: [] }
    await store.write(migrated.backupId!, {
      ...backup,
      snapshot: invalidSnapshot,
      integrityHash: workspaceSnapshotHash(invalidSnapshot),
    })

    await expect(repository.readMigrationBackup(migrated.backupId!)).rejects.toThrow('MIGRATION_BACKUP_INVALID')
    await expect(repository.rollbackMigration(migrated.backupId!)).rejects.toThrow('MIGRATION_BACKUP_INVALID')
    expect((await store.read(CURRENT_WORKSPACE_RECORD_KEY) as { schemaVersion?: unknown }).schemaVersion).toBe(8)
  })

  it('does not migrate or rewrite an already canonical Workspace v8', async () => {
    const canonical = createGoldenWorkspaceV8()
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore({ [CURRENT_WORKSPACE_RECORD_KEY]: canonical }))
    const result = await repository.loadOrMigrate()
    expect(result).toMatchObject({ status: 'already_v8', backupId: null, errors: [] })
    expect(result.workspace).toEqual(canonical)
  })
})
