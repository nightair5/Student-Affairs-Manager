import { exportWorkspaceV8, importWorkspaceV8 } from './serialization'
import type { WorkspaceV8 } from './types'
import { parseWorkspaceV8 } from './workspaceSchema'
import {
  applyPreparedV8Migration,
  createWorkspaceV7Backup,
  parseWorkspaceV7Backup,
  parseWorkspaceV7Snapshot,
  prepareV7ToV8Migration,
  workspaceSnapshotHash,
  type MigrationOptions,
  type WorkspaceV7Backup,
} from './migration'

const DATABASE_NAME = 'student-affairs-steward'
const STORE_NAME = 'workspace'
export const CURRENT_WORKSPACE_RECORD_KEY = 'current'

export type WorkspaceRecordMutation = (current: unknown) => unknown

export interface WorkspaceRecordStore {
  read(key: string): Promise<unknown>
  write(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
  transaction(key: string, mutate: WorkspaceRecordMutation): Promise<unknown>
  transactionMany(keys: string[], mutate: (records: Map<string, unknown>) => Map<string, unknown>): Promise<Map<string, unknown>>
}

function cloneValue<T>(value: T): T {
  return structuredClone(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function migrationBackupId(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value.migrationMetadata)) return null
  for (let index = value.migrationMetadata.length - 1; index >= 0; index -= 1) {
    const metadata = value.migrationMetadata[index]
    if (isRecord(metadata)
      && metadata.sourceVersion === 7
      && metadata.targetVersion === 8
      && typeof metadata.backupId === 'string') return metadata.backupId
  }
  return null
}

function hasMigrationLineage(value: unknown, backup: WorkspaceV7Backup): boolean {
  if (!backup.migrationId || !isRecord(value) || !Array.isArray(value.migrationMetadata)) return false
  return value.migrationMetadata.some((metadata) => isRecord(metadata)
    && metadata.migrationId === backup.migrationId
    && metadata.backupId === backup.id
    && metadata.sourceVersion === 7
    && metadata.targetVersion === 8
    && (metadata.status === 'completed' || metadata.status === 'needs_review'))
}

interface WorkspaceMigrationLineageRecord {
  id: string
  kind: 'workspace_v7_v8_lineage'
  backupId: string
  migrationId: string
  sourceIntegrityHash: string
  targetIntegrityHash: string
  createdAt: string
}

function migrationLineageKey(backupId: string): string {
  return `lineage:${backupId}`
}

function parseMigrationLineage(value: unknown, backup: WorkspaceV7Backup): WorkspaceMigrationLineageRecord {
  if (!isRecord(value)
    || value.id !== migrationLineageKey(backup.id)
    || value.kind !== 'workspace_v7_v8_lineage'
    || value.backupId !== backup.id
    || value.migrationId !== backup.migrationId
    || value.sourceIntegrityHash !== backup.integrityHash
    || typeof value.targetIntegrityHash !== 'string'
    || typeof value.createdAt !== 'string') {
    throw new Error('MIGRATION_LINEAGE_INVALID')
  }
  return cloneValue(value as unknown as WorkspaceMigrationLineageRecord)
}

function assertRollbackLineage(
  workspace: WorkspaceV8,
  backup: WorkspaceV7Backup,
  lineage: WorkspaceMigrationLineageRecord,
): void {
  if (!backup.migrationId || !hasMigrationLineage(workspace, backup)) {
    throw new Error('MIGRATION_ROLLBACK_LINEAGE_MISMATCH')
  }
  if (workspaceSnapshotHash(workspace) !== lineage.targetIntegrityHash) {
    throw new Error('MIGRATION_ROLLBACK_WORKSPACE_CHANGED')
  }
}

/** Test and non-browser adapter with the same single-record atomic contract. */
export class MemoryWorkspaceRecordStore implements WorkspaceRecordStore {
  private readonly records = new Map<string, unknown>()

  constructor(initial: Record<string, unknown> = {}) {
    Object.entries(initial).forEach(([key, value]) => this.records.set(key, cloneValue(value)))
  }

  async read(key: string): Promise<unknown> {
    const value = this.records.get(key)
    return value === undefined ? undefined : cloneValue(value)
  }

  async write(key: string, value: unknown): Promise<void> {
    this.records.set(key, cloneValue(value))
  }

  async remove(key: string): Promise<void> {
    this.records.delete(key)
  }

  async transaction(key: string, mutate: WorkspaceRecordMutation): Promise<unknown> {
    const before = this.records.get(key)
    const next = mutate(before === undefined ? undefined : cloneValue(before))
    this.records.set(key, cloneValue(next))
    return cloneValue(next)
  }

  async transactionMany(keys: string[], mutate: (records: Map<string, unknown>) => Map<string, unknown>): Promise<Map<string, unknown>> {
    const before = new Map(keys.map((key) => [key, this.records.has(key) ? cloneValue(this.records.get(key)) : undefined]))
    const next = mutate(before)
    next.forEach((value, key) => this.records.set(key, cloneValue(value)))
    return new Map([...next].map(([key, value]) => [key, cloneValue(value)]))
  }
}

/** Browser adapter. The read, validation and write happen in one real IDB transaction. */
export class IndexedDbWorkspaceRecordStore implements WorkspaceRecordStore {
  private database: Promise<IDBDatabase> | null = null

  private open(): Promise<IDBDatabase> {
    if (this.database) return this.database
    this.database = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DATABASE_NAME, 1)
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
      }
      request.onsuccess = () => resolve(request.result)
    })
    return this.database
  }

  async read(key: string): Promise<unknown> {
    const database = await this.open()
    return new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async write(key: string, value: unknown): Promise<void> {
    const database = await this.open()
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error ?? new Error('INDEXEDDB_TRANSACTION_ABORTED'))
      transaction.oncomplete = () => resolve()
      transaction.objectStore(STORE_NAME).put(cloneValue(value), key)
    })
  }

  async remove(key: string): Promise<void> {
    const database = await this.open()
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error ?? new Error('INDEXEDDB_TRANSACTION_ABORTED'))
      transaction.oncomplete = () => resolve()
      transaction.objectStore(STORE_NAME).delete(key)
    })
  }

  async transaction(key: string, mutate: WorkspaceRecordMutation): Promise<unknown> {
    const database = await this.open()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      let result: unknown
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error ?? new Error('INDEXEDDB_TRANSACTION_ABORTED'))
      transaction.oncomplete = () => resolve(cloneValue(result))
      const request = store.get(key)
      request.onerror = () => transaction.abort()
      request.onsuccess = () => {
        try {
          result = mutate(request.result)
          store.put(cloneValue(result), key)
        } catch (error) {
          transaction.abort()
          reject(error)
        }
      }
    })
  }

  async transactionMany(keys: string[], mutate: (records: Map<string, unknown>) => Map<string, unknown>): Promise<Map<string, unknown>> {
    const database = await this.open()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const records = new Map<string, unknown>()
      let result = new Map<string, unknown>()
      let remaining = keys.length
      let settled = false
      const fail = (error: unknown) => {
        if (settled) return
        settled = true
        try { transaction.abort() } catch { /* transaction already inactive */ }
        reject(error)
      }
      transaction.onerror = () => fail(transaction.error)
      transaction.onabort = () => fail(transaction.error ?? new Error('INDEXEDDB_TRANSACTION_ABORTED'))
      transaction.oncomplete = () => {
        if (!settled) {
          settled = true
          resolve(new Map([...result].map(([key, value]) => [key, cloneValue(value)])))
        }
      }
      const apply = () => {
        try {
          result = mutate(records)
          result.forEach((value, key) => store.put(cloneValue(value), key))
        } catch (error) {
          fail(error)
        }
      }
      if (!remaining) {
        apply()
        return
      }
      keys.forEach((key) => {
        const request = store.get(key)
        request.onerror = () => fail(request.error)
        request.onsuccess = () => {
          records.set(key, request.result)
          remaining -= 1
          if (remaining === 0) apply()
        }
      })
    })
  }
}

export type CanonicalWorkspaceMutation = (workspace: WorkspaceV8) => WorkspaceV8

export type RuntimeMigrationStatus =
  | 'already_v8'
  | 'migration_required'
  | 'migration_success'
  | 'migration_failed'
  | 'backup_available'
  | 'recovery_required'

export interface RuntimeMigrationResult {
  status: RuntimeMigrationStatus
  workspace: WorkspaceV8 | null
  backupId: string | null
  warnings: string[]
  errors: string[]
}

export type WorkspaceV7MigrationPreparer = typeof prepareV7ToV8Migration

/**
 * Workspace v8 repository. Canonical arrays are parsed and persisted verbatim;
 * this path never invokes the v7 materializeWorkspaceEntities compatibility projection.
 */
export class CanonicalWorkspaceRepository {
  constructor(
    private readonly store: WorkspaceRecordStore = new IndexedDbWorkspaceRecordStore(),
    private readonly recordKey = CURRENT_WORKSPACE_RECORD_KEY,
    private readonly prepareMigration: WorkspaceV7MigrationPreparer = prepareV7ToV8Migration,
  ) {}

  async load(): Promise<WorkspaceV8 | null> {
    const raw = await this.store.read(this.recordKey)
    if (raw === undefined) return null
    if (!raw || typeof raw !== 'object' || (raw as { schemaVersion?: unknown }).schemaVersion !== 8) {
      throw new Error('WORKSPACE_V8_MIGRATION_REQUIRED')
    }
    return cloneValue(parseWorkspaceV8(raw))
  }

  async save(workspace: WorkspaceV8): Promise<void> {
    await this.store.write(this.recordKey, cloneValue(parseWorkspaceV8(workspace)))
  }

  async transaction(mutate: CanonicalWorkspaceMutation): Promise<WorkspaceV8> {
    const result = await this.store.transaction(this.recordKey, (raw) => {
      if (raw === undefined) throw new Error('WORKSPACE_V8_NOT_INITIALIZED')
      const current = cloneValue(parseWorkspaceV8(raw))
      return cloneValue(parseWorkspaceV8(mutate(current)))
    })
    return cloneValue(parseWorkspaceV8(result))
  }

  async clear(): Promise<void> {
    await this.store.remove(this.recordKey)
  }

  async loadOrMigrate(options: MigrationOptions = {}): Promise<RuntimeMigrationResult> {
    const raw = await this.store.read(this.recordKey)
    if (raw === undefined) {
      return { status: 'migration_required', workspace: null, backupId: null, warnings: [], errors: ['WORKSPACE_NOT_INITIALIZED'] }
    }
    if (isRecord(raw) && raw.schemaVersion === 8) {
      let workspace: WorkspaceV8
      try {
        workspace = parseWorkspaceV8(raw)
      } catch (error) {
        const backupId = migrationBackupId(raw)
        if (backupId) {
          try {
            const backup = parseWorkspaceV7Backup(await this.store.read(backupId), backupId)
            parseMigrationLineage(await this.store.read(migrationLineageKey(backupId)), backup)
            if (hasMigrationLineage(raw, backup)) {
              return {
                status: 'recovery_required', workspace: null, backupId, warnings: [],
                errors: [errorMessage(error, 'WORKSPACE_V8_INVALID')],
              }
            }
          } catch {
            // The current v8 error remains authoritative when no valid recovery snapshot exists.
          }
        }
        return {
          status: 'migration_failed', workspace: null, backupId: null, warnings: [],
          errors: [errorMessage(error, 'WORKSPACE_V8_INVALID')],
        }
      }

      const backupId = migrationBackupId(workspace)
      if (backupId) {
        try {
          const backup = parseWorkspaceV7Backup(await this.store.read(backupId), backupId)
          const lineage = parseMigrationLineage(await this.store.read(migrationLineageKey(backupId)), backup)
          assertRollbackLineage(workspace, backup, lineage)
          return { status: 'backup_available', workspace: cloneValue(workspace), backupId, warnings: [], errors: [] }
        } catch (error) {
          return {
            status: 'already_v8', workspace: cloneValue(workspace), backupId: null,
            warnings: [errorMessage(error, 'MIGRATION_BACKUP_UNAVAILABLE')], errors: [],
          }
        }
      }
      return { status: 'already_v8', workspace: cloneValue(workspace), backupId: null, warnings: [], errors: [] }
    }

    let v7: ReturnType<typeof parseWorkspaceV7Snapshot>
    try {
      v7 = parseWorkspaceV7Snapshot(raw)
    } catch (error) {
      return { status: 'migration_failed', workspace: null, backupId: null, warnings: [], errors: [error instanceof Error ? error.message : 'WORKSPACE_V7_INVALID'] }
    }
    const sourceHash = workspaceSnapshotHash(v7)
    const migrationId = options.migrationId ?? `v7_to_v8_canonical_domain_001:${sourceHash}`
    const resolvedOptions = { ...options, migrationId, now: options.now ?? new Date().toISOString() }
    const backup = createWorkspaceV7Backup(v7, resolvedOptions)
    const backupKey = backup.id
    let persistedBackup: WorkspaceV7Backup

    try {
      const backupRecords = await this.store.transactionMany([this.recordKey, backupKey], (records) => {
        const current = parseWorkspaceV7Snapshot(records.get(this.recordKey))
        if (workspaceSnapshotHash(current) !== sourceHash) throw new Error('WORKSPACE_CHANGED_DURING_MIGRATION')
        const existing = records.get(backupKey)
        if (existing !== undefined) {
          try {
            const parsed = parseWorkspaceV7Backup(existing, backupKey)
            if (parsed.integrityHash !== sourceHash) throw new Error('MIGRATION_BACKUP_CONFLICT')
          } catch (error) {
            if (error instanceof Error && error.message === 'MIGRATION_BACKUP_CONFLICT') throw error
            throw new Error('MIGRATION_BACKUP_CONFLICT', { cause: error })
          }
        } else {
          records.set(backupKey, cloneValue(backup))
        }
        return records
      })
      persistedBackup = parseWorkspaceV7Backup(backupRecords.get(backupKey), backupKey)
    } catch (error) {
      return { status: 'migration_failed', workspace: null, backupId: null, warnings: [], errors: [errorMessage(error, 'MIGRATION_BACKUP_FAILED')] }
    }

    let preparation: ReturnType<WorkspaceV7MigrationPreparer>
    try {
      preparation = this.prepareMigration(v7, {
        ...resolvedOptions,
        migrationId: persistedBackup.migrationId ?? migrationId,
        now: persistedBackup.createdAt,
      }, persistedBackup)
    } catch (error) {
      return {
        status: 'migration_failed', workspace: null, backupId: backupKey, warnings: [],
        errors: [errorMessage(error, 'MIGRATION_PREPARE_FAILED')],
      }
    }

    if (!preparation.workspace) {
      return { status: 'migration_failed', workspace: null, backupId: backupKey, warnings: preparation.metadata.warnings, errors: preparation.metadata.errors }
    }

    let candidate: WorkspaceV8
    try {
      candidate = importWorkspaceV8(exportWorkspaceV8(applyPreparedV8Migration(preparation)))
      const targetIntegrityHash = workspaceSnapshotHash(candidate)
      const lineageKey = migrationLineageKey(backupKey)
      const lineage: WorkspaceMigrationLineageRecord = {
        id: lineageKey,
        kind: 'workspace_v7_v8_lineage',
        backupId: backupKey,
        migrationId: persistedBackup.migrationId ?? migrationId,
        sourceIntegrityHash: sourceHash,
        targetIntegrityHash,
        createdAt: preparation.metadata.completedAt ?? resolvedOptions.now,
      }
      await this.store.transactionMany([this.recordKey, backupKey, lineageKey], (records) => {
        const current = parseWorkspaceV7Snapshot(records.get(this.recordKey))
        const backup = parseWorkspaceV7Backup(records.get(backupKey), backupKey)
        if (workspaceSnapshotHash(current) !== sourceHash) throw new Error('WORKSPACE_CHANGED_DURING_MIGRATION')
        if (backup.integrityHash !== sourceHash
          || backup.migrationId !== migrationId
          || preparation.backup.id !== backupKey
          || preparation.backup.integrityHash !== sourceHash
          || preparation.backup.migrationId !== migrationId
          || preparation.targetIntegrityHash !== targetIntegrityHash) {
          throw new Error('MIGRATION_BACKUP_INVALID')
        }
        const existingLineage = records.get(lineageKey)
        if (existingLineage !== undefined) {
          const parsedLineage = parseMigrationLineage(existingLineage, backup)
          if (parsedLineage.targetIntegrityHash !== targetIntegrityHash) throw new Error('MIGRATION_LINEAGE_CONFLICT')
        } else {
          records.set(lineageKey, lineage)
        }
        records.set(this.recordKey, cloneValue(candidate))
        return records
      })
    } catch (error) {
      return { status: 'migration_failed', workspace: null, backupId: backupKey, warnings: preparation.metadata.warnings, errors: [errorMessage(error, 'MIGRATION_APPLY_FAILED')] }
    }
    return { status: 'migration_success', workspace: cloneValue(candidate), backupId: backupKey, warnings: preparation.metadata.warnings, errors: [] }
  }

  async rollbackMigration(backupId: string): Promise<WorkspaceV7Backup> {
    const lineageKey = migrationLineageKey(backupId)
    const result = await this.store.transactionMany([this.recordKey, backupId, lineageKey], (records) => {
      const backup = parseWorkspaceV7Backup(records.get(backupId), backupId)
      const current = records.get(this.recordKey)
      if (isRecord(current) && current.schemaVersion === 7) {
        const rolledBack = parseWorkspaceV7Snapshot(current)
        if (workspaceSnapshotHash(rolledBack) !== backup.integrityHash) {
          throw new Error('MIGRATION_ROLLBACK_LINEAGE_MISMATCH')
        }
        return records
      }
      const lineage = parseMigrationLineage(records.get(lineageKey), backup)
      let workspace: WorkspaceV8
      try {
        workspace = parseWorkspaceV8(current)
      } catch {
        if (migrationBackupId(current) !== backupId || !hasMigrationLineage(current, backup)) {
          throw new Error('MIGRATION_ROLLBACK_LINEAGE_MISMATCH')
        }
        records.set(this.recordKey, cloneValue(backup.snapshot))
        return records
      }
      assertRollbackLineage(workspace, backup, lineage)
      records.set(this.recordKey, cloneValue(backup.snapshot))
      return records
    })
    return cloneValue(parseWorkspaceV7Backup(result.get(backupId), backupId))
  }

  async readMigrationBackup(backupId: string): Promise<WorkspaceV7Backup | null> {
    const raw = await this.store.read(backupId)
    if (raw === undefined) return null
    return cloneValue(parseWorkspaceV7Backup(raw, backupId))
  }

  exportJson(workspace: WorkspaceV8): string {
    return exportWorkspaceV8(workspace)
  }

  importJson(serialized: string): WorkspaceV8 {
    return importWorkspaceV8(serialized)
  }
}
