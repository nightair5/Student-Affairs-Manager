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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeWorkspaceData(value: unknown): WorkspaceData | null {
  if (typeof value !== 'object' || value === null) return null
  const data = value as {
    schemaVersion?: number
    tasks?: unknown
    sources?: unknown
    drafts?: unknown
    projects?: unknown
    courseBlocks?: unknown
    integrations?: unknown
    savedAt?: unknown
  }
  if (
    (data.schemaVersion !== 3 && data.schemaVersion !== 4 && data.schemaVersion !== 5) ||
    !Array.isArray(data.tasks) ||
    !Array.isArray(data.sources) ||
    !Array.isArray(data.drafts) ||
    !Array.isArray(data.projects)
  ) return null

  return {
    schemaVersion: 5,
    tasks: data.tasks as WorkspaceData['tasks'],
    sources: data.sources.map((source) => isRecord(source)
      ? {
          ...source,
          duplicateOfSourceIds: Array.isArray(source.duplicateOfSourceIds)
            ? source.duplicateOfSourceIds.filter((id): id is string => typeof id === 'string')
            : undefined,
        }
      : source) as WorkspaceData['sources'],
    drafts: data.drafts as WorkspaceData['drafts'],
    projects: data.projects.map((project) => isRecord(project)
      ? { ...project, milestones: Array.isArray(project.milestones) ? project.milestones : [] }
      : project) as WorkspaceData['projects'],
    courseBlocks: Array.isArray(data.courseBlocks)
      ? data.courseBlocks as WorkspaceData['courseBlocks']
      : [],
    integrations:
      isRecord(data.integrations) && isRecord(data.integrations.sync)
        ? {
            sync: {
              endpoint: typeof data.integrations.sync.endpoint === 'string'
                ? data.integrations.sync.endpoint
                : 'http://127.0.0.1:8787',
              lastRemoteRevision: typeof data.integrations.sync.lastRemoteRevision === 'string'
                ? data.integrations.sync.lastRemoteRevision
                : undefined,
              lastSyncedAt: typeof data.integrations.sync.lastSyncedAt === 'string'
                ? data.integrations.sync.lastSyncedAt
                : undefined,
            },
            webMonitors: Array.isArray(data.integrations.webMonitors)
              ? data.integrations.webMonitors as WorkspaceData['integrations']['webMonitors']
              : [],
          }
        : { sync: { endpoint: 'http://127.0.0.1:8787' }, webMonitors: [] },
    savedAt: typeof data.savedAt === 'string' ? data.savedAt : new Date(0).toISOString(),
  }
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
      request.onsuccess = () => resolve(normalizeWorkspaceData(request.result))
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
    const normalized = normalizeWorkspaceData(parsed)
    if (!normalized) {
      throw new Error('导入文件不是有效的学生事务管家数据')
    }
    return normalized
  }
}
