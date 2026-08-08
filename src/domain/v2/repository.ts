import { exportWorkspaceV8, importWorkspaceV8 } from './serialization'
import type { WorkspaceV8 } from './types'
import { parseWorkspaceV8 } from './workspaceSchema'
import {
  applyPreparedV8Migration,
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

/**
 * Workspace v8 repository. Canonical arrays are parsed and persisted verbatim;
 * this path never invokes the v7 materializeWorkspaceEntities compatibility projection.
 */
export class CanonicalWorkspaceRepository {
  constructor(
    private readonly store: WorkspaceRecordStore = new IndexedDbWorkspaceRecordStore(),
    private readonly recordKey = CURRENT_WORKSPACE_RECORD_KEY,
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
    if (raw && typeof raw === 'object' && (raw as { schemaVersion?: unknown }).schemaVersion === 8) {
      return { status: 'already_v8', workspace: cloneValue(parseWorkspaceV8(raw)), backupId: null, warnings: [], errors: [] }
    }

    let v7: ReturnType<typeof parseWorkspaceV7Snapshot>
    try {
      v7 = parseWorkspaceV7Snapshot(raw)
    } catch (error) {
      return { status: 'migration_failed', workspace: null, backupId: null, warnings: [], errors: [error instanceof Error ? error.message : 'WORKSPACE_V7_INVALID'] }
    }
    const sourceHash = workspaceSnapshotHash(v7)
    const migrationId = options.migrationId ?? `v7_to_v8_canonical_domain_001:${sourceHash}`
    const preparation = prepareV7ToV8Migration(v7, { ...options, migrationId })
    const backupKey = preparation.backup.id

    try {
      await this.store.transactionMany([this.recordKey, backupKey], (records) => {
        const current = parseWorkspaceV7Snapshot(records.get(this.recordKey))
        if (workspaceSnapshotHash(current) !== sourceHash) throw new Error('WORKSPACE_CHANGED_DURING_MIGRATION')
        const existing = records.get(backupKey)
        if (existing !== undefined && workspaceSnapshotHash((existing as WorkspaceV7Backup).snapshot) !== sourceHash) {
          throw new Error('MIGRATION_BACKUP_CONFLICT')
        }
        records.set(backupKey, cloneValue(preparation.backup))
        return records
      })
    } catch (error) {
      return { status: 'migration_failed', workspace: null, backupId: null, warnings: preparation.metadata.warnings, errors: [error instanceof Error ? error.message : 'MIGRATION_BACKUP_FAILED'] }
    }

    if (!preparation.workspace) {
      return { status: 'migration_failed', workspace: null, backupId: backupKey, warnings: preparation.metadata.warnings, errors: preparation.metadata.errors }
    }

    let candidate: WorkspaceV8
    try {
      candidate = importWorkspaceV8(exportWorkspaceV8(applyPreparedV8Migration(preparation)))
      await this.store.transactionMany([this.recordKey, backupKey], (records) => {
        const current = parseWorkspaceV7Snapshot(records.get(this.recordKey))
        const backup = records.get(backupKey) as WorkspaceV7Backup | undefined
        if (workspaceSnapshotHash(current) !== sourceHash) throw new Error('WORKSPACE_CHANGED_DURING_MIGRATION')
        if (!backup || backup.integrityHash !== sourceHash || workspaceSnapshotHash(backup.snapshot) !== sourceHash) {
          throw new Error('MIGRATION_BACKUP_INVALID')
        }
        records.set(this.recordKey, cloneValue(candidate))
        return records
      })
    } catch (error) {
      return { status: 'migration_failed', workspace: null, backupId: backupKey, warnings: preparation.metadata.warnings, errors: [error instanceof Error ? error.message : 'MIGRATION_APPLY_FAILED'] }
    }
    return { status: 'migration_success', workspace: cloneValue(candidate), backupId: backupKey, warnings: preparation.metadata.warnings, errors: [] }
  }

  async rollbackMigration(backupId: string): Promise<WorkspaceV7Backup> {
    const result = await this.store.transactionMany([this.recordKey, backupId], (records) => {
      const backup = records.get(backupId) as WorkspaceV7Backup | undefined
      if (!backup || backup.schemaVersion !== 7 || backup.integrityHash !== workspaceSnapshotHash(backup.snapshot)) {
        throw new Error('MIGRATION_BACKUP_INVALID')
      }
      records.set(this.recordKey, cloneValue(backup.snapshot))
      return records
    })
    const backup = result.get(backupId) as WorkspaceV7Backup
    return cloneValue(backup)
  }

  async readMigrationBackup(backupId: string): Promise<WorkspaceV7Backup | null> {
    const raw = await this.store.read(backupId)
    if (raw === undefined) return null
    const backup = raw as WorkspaceV7Backup
    if (backup.schemaVersion !== 7 || backup.integrityHash !== workspaceSnapshotHash(backup.snapshot)) {
      throw new Error('MIGRATION_BACKUP_INVALID')
    }
    return cloneValue(backup)
  }

  exportJson(workspace: WorkspaceV8): string {
    return exportWorkspaceV8(workspace)
  }

  importJson(serialized: string): WorkspaceV8 {
    return importWorkspaceV8(serialized)
  }
}
