import { exportWorkspaceV8, importWorkspaceV8 } from './serialization'
import type { WorkspaceV8 } from './types'
import { parseWorkspaceV8 } from './workspaceSchema'

const DATABASE_NAME = 'student-affairs-steward'
const STORE_NAME = 'workspace'
export const CURRENT_WORKSPACE_RECORD_KEY = 'current'

export type WorkspaceRecordMutation = (current: unknown) => unknown

export interface WorkspaceRecordStore {
  read(key: string): Promise<unknown>
  write(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
  transaction(key: string, mutate: WorkspaceRecordMutation): Promise<unknown>
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
}

export type CanonicalWorkspaceMutation = (workspace: WorkspaceV8) => WorkspaceV8

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

  exportJson(workspace: WorkspaceV8): string {
    return exportWorkspaceV8(workspace)
  }

  importJson(serialized: string): WorkspaceV8 {
    return importWorkspaceV8(serialized)
  }
}
