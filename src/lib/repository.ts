import type { WorkspaceData } from '../types'

const DATABASE_NAME = 'student-affairs-steward'
const STORE_NAME = 'workspace'
const RECORD_KEY = 'current'

export interface WorkspaceRepository {
  load(): Promise<WorkspaceData | null>
  save(workspace: WorkspaceData): Promise<void>
  clear(): Promise<void>
  exportJson(workspace: WorkspaceData): string
  importJson(serialized: string): WorkspaceData
}

function isWorkspaceData(value: unknown): value is WorkspaceData {
  if (typeof value !== 'object' || value === null) return false
  const data = value as Partial<WorkspaceData>
  return (
    data.schemaVersion === 3 &&
    Array.isArray(data.tasks) &&
    Array.isArray(data.sources) &&
    Array.isArray(data.drafts) &&
    Array.isArray(data.projects)
  )
}

export class IndexedDbWorkspaceRepository implements WorkspaceRepository {
  private database: Promise<IDBDatabase> | null = null

  private open(): Promise<IDBDatabase> {
    if (this.database) return this.database
    this.database = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DATABASE_NAME, 1)
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME)
        }
      }
      request.onsuccess = () => resolve(request.result)
    })
    return this.database
  }

  async load(): Promise<WorkspaceData | null> {
    const database = await this.open()
    return new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .get(RECORD_KEY)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(isWorkspaceData(request.result) ? request.result : null)
    })
  }

  async save(workspace: WorkspaceData): Promise<void> {
    const database = await this.open()
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.onerror = () => reject(transaction.error)
      transaction.oncomplete = () => resolve()
      transaction.objectStore(STORE_NAME).put(workspace, RECORD_KEY)
    })
  }

  async clear(): Promise<void> {
    const database = await this.open()
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.onerror = () => reject(transaction.error)
      transaction.oncomplete = () => resolve()
      transaction.objectStore(STORE_NAME).delete(RECORD_KEY)
    })
  }

  exportJson(workspace: WorkspaceData): string {
    return JSON.stringify(workspace, null, 2)
  }

  importJson(serialized: string): WorkspaceData {
    const parsed: unknown = JSON.parse(serialized)
    if (!isWorkspaceData(parsed)) {
      throw new Error('导入文件不是有效的学生事务管家数据')
    }
    return parsed
  }
}
