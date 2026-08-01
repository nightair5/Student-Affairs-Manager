import type {
  HistoryEntry,
  Material,
  Reminder,
  Source,
  Task,
  TaskCategory,
  TaskStatus,
} from '../types'

const WORKSPACE_KEY = 'student-affairs-steward:workspace:v2'
const LEGACY_TASKS_KEY = 'student-affairs-steward:tasks:v1'
const LEGACY_SOURCES_KEY = 'student-affairs-steward:sources:v1'
const SCHEMA_VERSION = 2

export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

interface WorkspaceSnapshot {
  schemaVersion: typeof SCHEMA_VERSION
  savedAt: string
  tasks: Task[]
  sources: Source[]
}

export interface HydratedWorkspace {
  tasks: Task[]
  sources: Source[]
  origin: 'current' | 'legacy' | 'fallback'
}

function browserStorage(): StorageAdapter | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function migrateMaterials(value: unknown): Material[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    if (!isRecord(item) || typeof item.name !== 'string') return []
    return [
      {
        id: stringValue(item.id, `material-migrated-${index}`),
        name: item.name,
        done: Boolean(item.done),
      },
    ]
  })
}

function migrateReminders(value: unknown): Reminder[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    if (!isRecord(item)) return []
    const channel =
      item.channel === 'email' || item.channel === 'wechat-placeholder'
        ? item.channel
        : null
    if (!channel) return []
    return [
      {
        id: stringValue(item.id, `reminder-migrated-${index}`),
        channel,
        scheduledAt: stringValue(item.scheduledAt),
        enabled: Boolean(item.enabled),
      },
    ]
  })
}

function migrateHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    if (!isRecord(item)) return []
    return [
      {
        id: stringValue(item.id, `history-migrated-${index}`),
        field: stringValue(item.field, '历史记录'),
        before: stringValue(item.before),
        after: stringValue(item.after),
        changedAt: stringValue(item.changedAt, new Date(0).toISOString()),
        actor: item.actor === 'system' ? 'system' : 'user',
      },
    ]
  })
}

function migrateTask(value: unknown): Task | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.deadline !== 'string'
  ) {
    return null
  }

  const categories: TaskCategory[] = ['比赛', '保研', '课程', '老师任务', '其他']
  const statuses: TaskStatus[] = ['待开始', '进行中', '已完成']
  const category = categories.includes(value.category as TaskCategory)
    ? (value.category as TaskCategory)
    : '其他'
  const status = statuses.includes(value.status as TaskStatus)
    ? (value.status as TaskStatus)
    : '待开始'
  const priority =
    value.priority === '高' || value.priority === '低' ? value.priority : '中'

  return {
    id: value.id,
    title: value.title,
    category,
    status,
    deadline: value.deadline,
    estimatedMinutes:
      typeof value.estimatedMinutes === 'number' ? value.estimatedMinutes : 60,
    nextAction: stringValue(value.nextAction, '确认下一步动作'),
    description: stringValue(value.description),
    priority,
    riskFlags: Array.isArray(value.riskFlags)
      ? (value.riskFlags as Task['riskFlags'])
      : [],
    materials: migrateMaterials(value.materials),
    dependencies: stringArray(value.dependencies),
    reminders: migrateReminders(value.reminders),
    sourceIds: stringArray(value.sourceIds),
    priorityReason: stringValue(value.priorityReason, '由用户保存的任务'),
    createdAt: stringValue(value.createdAt, new Date(0).toISOString()),
    updatedAt: stringValue(value.updatedAt, new Date(0).toISOString()),
    history: migrateHistory(value.history),
  }
}

function migrateTasks(value: unknown): Task[] | null {
  if (!Array.isArray(value)) return null
  return value.flatMap((item) => {
    const task = migrateTask(item)
    return task ? [task] : []
  })
}

function migrateSource(value: unknown): Source | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null
  const type =
    value.type === 'file' ||
    value.type === 'image' ||
    value.type === 'link' ||
    value.type === 'text'
      ? value.type
      : 'text'
  return {
    id: value.id,
    type,
    title: stringValue(value.title, '已保存来源'),
    contentPreview: stringValue(value.contentPreview),
    createdAt: stringValue(value.createdAt, new Date(0).toISOString()),
    extractionStatus: value.extractionStatus === '待确认' ? '待确认' : '已识别',
  }
}

function migrateSources(value: unknown): Source[] | null {
  if (!Array.isArray(value)) return null
  return value.flatMap((item) => {
    const source = migrateSource(item)
    return source ? [source] : []
  })
}

function parseJson(value: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

export function loadWorkspace(
  fallbackTasks: Task[],
  fallbackSources: Source[],
  storage: StorageAdapter | null = browserStorage(),
): HydratedWorkspace {
  if (!storage) {
    return { tasks: fallbackTasks, sources: fallbackSources, origin: 'fallback' }
  }

  const current = parseJson(storage.getItem(WORKSPACE_KEY))
  if (isRecord(current) && current.schemaVersion === SCHEMA_VERSION) {
    const tasks = migrateTasks(current.tasks)
    const sources = migrateSources(current.sources)
    if (tasks && sources) return { tasks, sources, origin: 'current' }
  }

  const legacyTasks = migrateTasks(
    parseJson(storage.getItem(LEGACY_TASKS_KEY)),
  )
  const legacySources = migrateSources(
    parseJson(storage.getItem(LEGACY_SOURCES_KEY)),
  )
  if (legacyTasks || legacySources) {
    return {
      tasks: legacyTasks ?? fallbackTasks,
      sources: legacySources ?? fallbackSources,
      origin: 'legacy',
    }
  }

  return { tasks: fallbackTasks, sources: fallbackSources, origin: 'fallback' }
}

export function saveWorkspace(
  tasks: Task[],
  sources: Source[],
  storage: StorageAdapter | null = browserStorage(),
): boolean {
  if (!storage) return false
  const snapshot: WorkspaceSnapshot = {
    schemaVersion: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    tasks,
    sources,
  }

  try {
    storage.setItem(WORKSPACE_KEY, JSON.stringify(snapshot))
    storage.removeItem?.(LEGACY_TASKS_KEY)
    storage.removeItem?.(LEGACY_SOURCES_KEY)
    return true
  } catch {
    return false
  }
}

export const storageKeys = {
  workspace: WORKSPACE_KEY,
  legacyTasks: LEGACY_TASKS_KEY,
  legacySources: LEGACY_SOURCES_KEY,
}
