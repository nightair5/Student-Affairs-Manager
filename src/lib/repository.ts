import type { DraftItem, ExtractionDraft, Project, Source, Task, WorkspaceData } from '../types'
import { materializeWorkspaceEntities } from './domainEntities'
import { isRecognitionResult } from '../recognition/schema'
import { CanonicalWorkspaceRepository, type RuntimeMigrationResult } from '../domain/v2/repository'
import { applyPreparedV8Migration, prepareV7ToV8Migration } from '../domain/v2/migration'
import { mergeLegacyViewIntoWorkspaceV8, workspaceV8ToLegacyView } from '../domain/v2/legacyView'

const DATABASE_NAME = 'student-affairs-steward'
const STORE_NAME = 'workspace'
const RECORD_KEY = 'current'
const CURRENT_SCHEMA_VERSION = 7

export interface WorkspaceRepository {
  load(): Promise<WorkspaceData | null>
  save(workspace: WorkspaceData): Promise<void>
  clear(): Promise<void>
  exportJson(workspace: WorkspaceData): string
  importJson(serialized: string): WorkspaceData
}

export class WorkspaceRecoveryRequiredError extends Error {
  readonly code = 'WORKSPACE_RECOVERY_REQUIRED' as const
  readonly status = 'recovery_required' as const
  readonly errors: readonly string[]

  constructor(readonly backupId: string, errors: readonly string[]) {
    super('WORKSPACE_RECOVERY_REQUIRED')
    this.name = 'WorkspaceRecoveryRequiredError'
    this.errors = [...errors]
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function validDateValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime()) ? value : fallback
}

function normalizeTaskRecord(value: unknown, index: number, savedAt: string): Task | null {
  if (!isRecord(value)) return null
  const id = stringValue(value.id, `task-migrated-${index}`)
  const category = ['比赛', '保研', '课程', '老师任务', '其他'].includes(stringValue(value.category))
    ? value.category as Task['category']
    : '其他'
  const status = ['待开始', '进行中', '已完成'].includes(stringValue(value.status))
    ? value.status as Task['status']
    : '待开始'
  const priority = ['高', '中', '低'].includes(stringValue(value.priority))
    ? value.priority as Task['priority']
    : '中'
  const deadline = validDateValue(value.deadline, '1970-01-01T00:00')
  const createdAt = validDateValue(value.createdAt, savedAt)
  const updatedAt = validDateValue(value.updatedAt, createdAt)
  const materials = Array.isArray(value.materials) ? value.materials.flatMap((item, materialIndex) => {
    if (!isRecord(item)) return []
    return [{
      id: stringValue(item.id, `${id}-material-${materialIndex}`),
      name: stringValue(item.name, `材料 ${materialIndex + 1}`),
      done: Boolean(item.done),
      status: ['missing', 'preparing', 'ready', 'submitted', 'verified', 'not_required'].includes(stringValue(item.status))
        ? item.status as Task['materials'][number]['status']
        : item.done ? 'ready' : 'missing',
      taskId: stringValue(item.taskId) || id,
      projectId: stringValue(item.projectId) || undefined,
      sourceId: stringValue(item.sourceId) || undefined,
    }]
  }) : []
  const reminders = Array.isArray(value.reminders) ? value.reminders.flatMap((item, reminderIndex) => {
    if (!isRecord(item) || !['browser', 'email', 'wechat-placeholder'].includes(stringValue(item.channel))) return []
    const status = ['draft', 'scheduled', 'sent', 'failed', 'unsupported'].includes(stringValue(item.status))
      ? item.status as Task['reminders'][number]['status']
      : undefined
    const sentAt = item.sentAt === null
      ? null
      : typeof item.sentAt === 'string' && !Number.isNaN(new Date(item.sentAt).getTime())
        ? item.sentAt
        : undefined
    return [{
      id: stringValue(item.id, `${id}-reminder-${reminderIndex}`),
      channel: item.channel as Task['reminders'][number]['channel'],
      scheduledAt: validDateValue(item.scheduledAt, deadline),
      enabled: Boolean(item.enabled),
      status,
      errorMessage: stringValue(item.errorMessage) || undefined,
      sentAt,
    }]
  }) : []
  const history = Array.isArray(value.history) ? value.history.flatMap((item, historyIndex) => {
    if (!isRecord(item)) return []
    return [{
      id: stringValue(item.id, `${id}-history-${historyIndex}`),
      field: stringValue(item.field, '迁移记录'),
      before: stringValue(item.before),
      after: stringValue(item.after),
      changedAt: validDateValue(item.changedAt, updatedAt),
      actor: item.actor === 'system' ? 'system' as const : 'user' as const,
      entityType: ['task', 'subtask', 'project', 'milestone', 'work_package', 'material', 'time_point', 'event', 'source', 'draft', 'reminder'].includes(stringValue(item.entityType))
        ? item.entityType as Task['history'][number]['entityType']
        : undefined,
      entityId: stringValue(item.entityId) || undefined,
      action: stringValue(item.action) || undefined,
    }]
  }) : []
  const riskFlags = stringArray(value.riskFlags).filter((item): item is Task['riskFlags'][number] =>
    ['紧急', '缺材料', '待确认', '有依赖', '已逾期'].includes(item))
  if (!validDateValue(value.deadline, '')) riskFlags.push('待确认')
  return {
    id,
    projectId: stringValue(value.projectId) || undefined,
    parentTaskId: stringValue(value.parentTaskId) || undefined,
    hierarchyType: value.hierarchyType === 'subtask' ? 'subtask' : value.hierarchyType === 'task' ? 'task' : undefined,
    milestoneId: stringValue(value.milestoneId) || undefined,
    workPackageId: stringValue(value.workPackageId) || undefined,
    actionVerb: stringValue(value.actionVerb) || undefined,
    actionObject: stringValue(value.actionObject) || undefined,
    completionCriteria: stringArray(value.completionCriteria),
    evidenceIds: stringArray(value.evidenceIds),
    inferenceLevel: ['explicit', 'strong_inference', 'optional_suggestion'].includes(stringValue(value.inferenceLevel))
      ? value.inferenceLevel as Task['inferenceLevel']
      : undefined,
    title: stringValue(value.title, '待核对任务'),
    category,
    status,
    deadline,
    estimatedMinutes: typeof value.estimatedMinutes === 'number' && Number.isFinite(value.estimatedMinutes)
      ? Math.min(10_080, Math.max(5, value.estimatedMinutes))
      : 60,
    nextAction: stringValue(value.nextAction, '核对任务内容'),
    description: stringValue(value.description),
    priority,
    riskFlags: [...new Set(riskFlags)],
    materials,
    dependencies: stringArray(value.dependencies),
    dependencyIds: stringArray(value.dependencyIds),
    reminders,
    sourceIds: stringArray(value.sourceIds),
    priorityReason: stringValue(value.priorityReason, '迁移后需要人工核对'),
    priorityReasons: stringArray(value.priorityReasons),
    plannedStart: stringValue(value.plannedStart) || undefined,
    completedAt: stringValue(value.completedAt) || undefined,
    manualPriority: typeof value.manualPriority === 'number' ? value.manualPriority : undefined,
    computedPriorityScore: typeof value.computedPriorityScore === 'number' ? value.computedPriorityScore : undefined,
    pinnedUntil: stringValue(value.pinnedUntil) || undefined,
    snoozedUntil: stringValue(value.snoozedUntil) || undefined,
    timePointIds: stringArray(value.timePointIds),
    materialIds: stringArray(value.materialIds),
    createdAt,
    updatedAt,
    history,
  }
}

function normalizeSourceRecord(value: unknown, index: number, savedAt: string): Source | null {
  if (!isRecord(value)) return null
  const type = ['text', 'file', 'image', 'link'].includes(stringValue(value.type))
    ? value.type as Source['type']
    : 'text'
  const extractionStatus = ['已识别', '待确认', '部分确认', '已确认', '已拒绝'].includes(stringValue(value.extractionStatus))
    ? value.extractionStatus as Source['extractionStatus']
    : '待确认'
  const createdAt = validDateValue(value.createdAt, savedAt)
  return {
    ...value,
    id: stringValue(value.id, `source-migrated-${index}`),
    type,
    title: stringValue(value.title, '已迁移来源'),
    contentPreview: stringValue(value.contentPreview),
    content: stringValue(value.content) || undefined,
    rawText: stringValue(value.rawText) || undefined,
    url: stringValue(value.url) || undefined,
    createdAt,
    updatedAt: validDateValue(value.updatedAt, createdAt),
    extractionStatus,
  } as Source
}

function normalizeDraftRecord(value: unknown, index: number, savedAt: string): ExtractionDraft | null {
  if (!isRecord(value) || !stringValue(value.sourceId)) return null
  const status = ['待确认', '部分确认', '已确认', '已拒绝'].includes(stringValue(value.status))
    ? value.status as ExtractionDraft['status']
    : '待确认'
  const items = Array.isArray(value.items) ? value.items.flatMap((item, itemIndex): DraftItem[] => {
    if (!isRecord(item) || !isRecord(item.suggestion)) return []
    const suggestion = item.suggestion
    const category = ['比赛', '保研', '课程', '老师任务', '其他'].includes(stringValue(suggestion.category))
      ? suggestion.category as DraftItem['suggestion']['category']
      : '其他'
    return [{
      id: stringValue(item.id, `draft-item-${index}-${itemIndex}`),
      selected: typeof item.selected === 'boolean' ? item.selected : true,
      status: ['待确认', '已确认', '已拒绝'].includes(stringValue(item.status))
        ? item.status as DraftItem['status']
        : '待确认',
      updatedAt: validDateValue(item.updatedAt, savedAt),
      history: Array.isArray(item.history) ? item.history.flatMap((entry, historyIndex) => {
        if (!isRecord(entry)) return []
        return [{
          id: stringValue(entry.id, `draft-item-${index}-${itemIndex}-history-${historyIndex}`),
          field: stringValue(entry.field, '识别建议'),
          before: stringValue(entry.before),
          after: stringValue(entry.after),
          changedAt: validDateValue(entry.changedAt, savedAt),
          actor: entry.actor === 'system' ? 'system' as const : 'user' as const,
          entityType: 'draft' as const,
          entityId: stringValue(entry.entityId) || stringValue(item.id, `draft-item-${index}-${itemIndex}`),
          action: stringValue(entry.action, 'updated'),
        }]
      }) : [],
      suggestion: {
        id: stringValue(suggestion.id, `suggestion-${index}-${itemIndex}`),
        title: stringValue(suggestion.title, '待核对事项'),
        category,
        deadline: validDateValue(suggestion.deadline, '1970-01-01T00:00'),
        estimatedMinutes: typeof suggestion.estimatedMinutes === 'number' ? Math.max(5, suggestion.estimatedMinutes) : 60,
        nextAction: stringValue(suggestion.nextAction, '核对事项内容'),
        description: stringValue(suggestion.description),
        priority: ['高', '中', '低'].includes(stringValue(suggestion.priority)) ? suggestion.priority as DraftItem['suggestion']['priority'] : '中',
        materials: stringArray(suggestion.materials),
        evidence: stringValue(suggestion.evidence),
        confidence: ['高', '中', '低'].includes(stringValue(suggestion.confidence)) ? suggestion.confidence as DraftItem['suggestion']['confidence'] : '低',
        evidenceRefs: Array.isArray(suggestion.evidenceRefs) ? suggestion.evidenceRefs as DraftItem['suggestion']['evidenceRefs'] : undefined,
      },
    }]
  }) : []
  const createdAt = validDateValue(value.createdAt, savedAt)
  return {
    id: stringValue(value.id, `draft-migrated-${index}`),
    sourceId: stringValue(value.sourceId),
    status,
    items,
    createdAt,
    updatedAt: validDateValue(value.updatedAt, createdAt),
    schemaVersion: stringValue(value.schemaVersion) || undefined,
    modelName: stringValue(value.modelName) || undefined,
    promptVersion: stringValue(value.promptVersion) || undefined,
    recognitionResult: isRecognitionResult(value.recognitionResult) ? value.recognitionResult : undefined,
  }
}

function normalizeProjectRecord(value: unknown, index: number, savedAt: string): Project | null {
  if (!isRecord(value)) return null
  const category = ['比赛', '保研', '课程', '老师任务', '其他'].includes(stringValue(value.category))
    ? value.category as Project['category']
    : '其他'
  const createdAt = validDateValue(value.createdAt, savedAt)
  return {
    id: stringValue(value.id, `project-migrated-${index}`),
    title: stringValue(value.title, '已迁移项目'),
    category,
    sourceIds: stringArray(value.sourceIds),
    taskIds: stringArray(value.taskIds),
    milestones: Array.isArray(value.milestones) ? value.milestones as Project['milestones'] : [],
    status: ['active', 'completed', 'archived'].includes(stringValue(value.status)) ? value.status as Project['status'] : undefined,
    objective: stringValue(value.objective) || undefined,
    keywords: stringArray(value.keywords),
    currentMilestoneId: stringValue(value.currentMilestoneId) || undefined,
    evidenceIds: stringArray(value.evidenceIds),
    description: stringValue(value.description) || undefined,
    createdAt,
    updatedAt: validDateValue(value.updatedAt, createdAt),
  }
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
    knowledgeSettings?: unknown
    workPackages?: unknown
    events?: unknown
    migrationLog?: unknown
    recognitionFeedback?: unknown
    legacyData?: unknown
    savedAt?: unknown
  }
  if (
    (data.schemaVersion !== 3 && data.schemaVersion !== 4 && data.schemaVersion !== 5 && data.schemaVersion !== 6 && data.schemaVersion !== 7) ||
    !Array.isArray(data.tasks) ||
    !Array.isArray(data.sources) ||
    !Array.isArray(data.drafts) ||
    !Array.isArray(data.projects)
  ) return null

  const savedAt = typeof data.savedAt === 'string' && !Number.isNaN(new Date(data.savedAt).getTime())
    ? data.savedAt
    : new Date(0).toISOString()
  const tasks = data.tasks.flatMap((task, index) => {
    const normalized = normalizeTaskRecord(task, index, savedAt)
    return normalized ? [normalized] : []
  })
  const sources = data.sources.flatMap((source, index) => {
    const normalized = normalizeSourceRecord(source, index, savedAt)
    return normalized ? [normalized] : []
  })
  const drafts = data.drafts.flatMap((draft, index) => {
    const normalized = normalizeDraftRecord(draft, index, savedAt)
    return normalized ? [normalized] : []
  })
  const projects = data.projects.flatMap((project, index) => {
    const normalized = normalizeProjectRecord(project, index, savedAt)
    return normalized ? [normalized] : []
  })
  const entities = materializeWorkspaceEntities(tasks, sources, drafts, projects)

  return {
    schemaVersion: 7,
    ...entities,
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
            connectionIntents: Array.isArray(data.integrations.connectionIntents)
              ? data.integrations.connectionIntents as WorkspaceData['integrations']['connectionIntents']
              : [],
          }
        : { sync: { endpoint: 'http://127.0.0.1:8787' }, webMonitors: [], connectionIntents: [] },
    knowledgeSettings: isRecord(data.knowledgeSettings) && typeof data.knowledgeSettings.localSearchAuthorizedAt === 'string'
      ? { localSearchAuthorizedAt: data.knowledgeSettings.localSearchAuthorizedAt }
      : {},
    workPackages: Array.isArray(data.workPackages)
      ? data.workPackages as WorkspaceData['workPackages']
      : [],
    events: Array.isArray(data.events)
      ? data.events as WorkspaceData['events']
      : [],
    migrationLog: Array.isArray(data.migrationLog)
      ? data.migrationLog as WorkspaceData['migrationLog']
      : data.schemaVersion === 7
        ? []
        : [{
            id: `migration-${data.schemaVersion}-7-${savedAt}`,
            fromVersion: data.schemaVersion,
            toVersion: 7,
            migratedAt: savedAt,
            status: 'needs_review',
            notes: ['旧任务和项目已保留；无法可靠判断的阶段关系保持为待整理状态。'],
          }],
    recognitionFeedback: Array.isArray(data.recognitionFeedback)
      ? data.recognitionFeedback as WorkspaceData['recognitionFeedback']
      : [],
    legacyData: isRecord(data.legacyData)
      ? data.legacyData
      : data.schemaVersion === 7
        ? {}
        : {
            previousSchemaVersion: data.schemaVersion,
            projectMilestones: projects.map((project) => ({
              projectId: project.id,
              milestones: project.milestones,
            })),
          },
    savedAt,
  }
}

export const MAX_WORKSPACE_IMPORT_BYTES = 5 * 1024 * 1024
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

function validateSafeJson(value: unknown, depth = 0, budget = { nodes: 0 }): void {
  budget.nodes += 1
  if (budget.nodes > 100_000 || depth > 12) throw new Error('导入文件结构过大或嵌套过深')
  if (typeof value === 'string') {
    if (value.length > 100_000) throw new Error('导入文件包含过长文本字段')
    return
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return
  if (Array.isArray(value)) {
    if (value.length > 10_000) throw new Error('导入文件包含过多记录')
    value.forEach((item) => validateSafeJson(item, depth + 1, budget))
    return
  }
  if (!isRecord(value)) throw new Error('导入文件包含不支持的数据类型')
  for (const [key, item] of Object.entries(value)) {
    if (UNSAFE_KEYS.has(key)) throw new Error('导入文件包含不安全字段')
    validateSafeJson(item, depth + 1, budget)
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label}格式无效`)
  return value
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label}缺失或不是数组`)
  return value
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label}缺失或格式无效`)
  return value
}

function requireEnum(value: unknown, allowed: readonly string[], label: string): void {
  const candidate = requireString(value, label)
  if (!allowed.includes(candidate)) throw new Error(`${label}包含非法枚举值`)
}

function requireDate(value: unknown, label: string): void {
  const candidate = requireString(value, label)
  if (Number.isNaN(new Date(candidate).getTime())) throw new Error(`${label}包含无效日期`)
}

/**
 * Version 7 is the current, exported contract. It must be rejected instead of
 * silently repaired when required fields or enums are invalid. Older versions
 * remain intentionally lenient so existing local data can migrate safely.
 */
function validateCurrentSchemaInput(value: unknown): void {
  const root = requireRecord(value, '工作区')
  if (root.schemaVersion !== 7) return

  const tasks = requireArray(root.tasks, '任务列表')
  const sources = requireArray(root.sources, '来源列表')
  const drafts = requireArray(root.drafts, '草稿列表')
  const projects = requireArray(root.projects, '项目列表')
  const evidence = requireArray(root.evidence, '证据列表')
  const timePoints = requireArray(root.timePoints, '时间节点列表')
  const materialItems = requireArray(root.materialItems, '材料列表')
  const historyRecords = requireArray(root.historyRecords, '历史列表')
  const reminderRecords = requireArray(root.reminderRecords, '提醒列表')
  const workPackages = requireArray(root.workPackages, '工作包列表')
  const events = requireArray(root.events, '事件列表')
  const migrationLog = requireArray(root.migrationLog, '迁移日志')
  const recognitionFeedback = requireArray(root.recognitionFeedback, '识别反馈')
  requireRecord(root.legacyData, '旧版保留数据')
  requireDate(root.savedAt, '保存时间')

  tasks.forEach((item, index) => {
    const task = requireRecord(item, `任务 ${index + 1}`)
    requireString(task.id, `任务 ${index + 1} ID`)
    requireString(task.title, `任务 ${index + 1} 标题`)
    requireEnum(task.category, ['比赛', '保研', '课程', '老师任务', '其他'], `任务 ${index + 1} 分类`)
    requireEnum(task.status, ['待开始', '进行中', '已完成'], `任务 ${index + 1} 状态`)
    requireEnum(task.priority, ['高', '中', '低'], `任务 ${index + 1} 优先级`)
    requireDate(task.deadline, `任务 ${index + 1} 截止时间`)
    requireDate(task.createdAt, `任务 ${index + 1} 创建时间`)
    requireDate(task.updatedAt, `任务 ${index + 1} 更新时间`)
    if (typeof task.estimatedMinutes !== 'number' || !Number.isFinite(task.estimatedMinutes)) {
      throw new Error(`任务 ${index + 1} 预计耗时无效`)
    }
    requireArray(task.materials, `任务 ${index + 1} 材料`).forEach((entry, materialIndex) => {
      const material = requireRecord(entry, `任务 ${index + 1} 材料 ${materialIndex + 1}`)
      requireString(material.id, `任务 ${index + 1} 材料 ${materialIndex + 1} ID`)
      requireString(material.name, `任务 ${index + 1} 材料 ${materialIndex + 1} 名称`)
      if (material.status !== undefined) {
        requireEnum(material.status, ['missing', 'preparing', 'ready', 'submitted', 'verified', 'not_required'], `任务 ${index + 1} 材料状态`)
      }
    })
  })

  sources.forEach((item, index) => {
    const source = requireRecord(item, `来源 ${index + 1}`)
    requireString(source.id, `来源 ${index + 1} ID`)
    requireEnum(source.type, ['text', 'file', 'image', 'link'], `来源 ${index + 1} 类型`)
    requireEnum(source.extractionStatus, ['已识别', '待确认', '部分确认', '已确认', '已拒绝'], `来源 ${index + 1} 提取状态`)
    requireEnum(source.status, ['uploaded', 'extracting', 'needs_review', 'partially_confirmed', 'confirmed', 'failed', 'archived'], `来源 ${index + 1} 工作流状态`)
    requireDate(source.createdAt, `来源 ${index + 1} 创建时间`)
    requireDate(source.updatedAt, `来源 ${index + 1} 更新时间`)
  })

  drafts.forEach((item, index) => {
    const draft = requireRecord(item, `草稿 ${index + 1}`)
    requireString(draft.id, `草稿 ${index + 1} ID`)
    requireString(draft.sourceId, `草稿 ${index + 1} 来源 ID`)
    requireEnum(draft.status, ['待确认', '部分确认', '已确认', '已拒绝'], `草稿 ${index + 1} 状态`)
    requireEnum(draft.workflowStatus, ['processing', 'needs_review', 'partially_confirmed', 'confirmed', 'rejected', 'failed', 'archived'], `草稿 ${index + 1} 工作流状态`)
    requireDate(draft.createdAt, `草稿 ${index + 1} 创建时间`)
    requireDate(draft.updatedAt, `草稿 ${index + 1} 更新时间`)
    requireArray(draft.items, `草稿 ${index + 1} 建议`)
    if (draft.recognitionResult !== undefined && !isRecognitionResult(draft.recognitionResult)) {
      throw new Error(`草稿 ${index + 1} 的 RecognitionResult 2.0 无效`)
    }
  })

  projects.forEach((item, index) => {
    const project = requireRecord(item, `项目 ${index + 1}`)
    requireString(project.id, `项目 ${index + 1} ID`)
    requireString(project.title, `项目 ${index + 1} 标题`)
    requireEnum(project.category, ['比赛', '保研', '课程', '老师任务', '其他'], `项目 ${index + 1} 分类`)
    requireEnum(project.status, ['active', 'completed', 'archived'], `项目 ${index + 1} 状态`)
    requireDate(project.createdAt, `项目 ${index + 1} 创建时间`)
    requireDate(project.updatedAt, `项目 ${index + 1} 更新时间`)
  })

  evidence.forEach((item, index) => {
    const record = requireRecord(item, `证据 ${index + 1}`)
    requireString(record.id, `证据 ${index + 1} ID`)
    requireString(record.sourceId, `证据 ${index + 1} 来源 ID`)
  })
  timePoints.forEach((item, index) => {
    const record = requireRecord(item, `时间节点 ${index + 1}`)
    requireString(record.id, `时间节点 ${index + 1} ID`)
    requireEnum(record.type, ['deadline', 'registration_deadline', 'submission_deadline', 'task_deadline', 'event_start', 'event_end', 'result_announcement', 'planned_start'], `时间节点 ${index + 1} 类型`)
    if (record.value !== null) requireDate(record.value, `时间节点 ${index + 1} 时间`)
  })
  materialItems.forEach((item, index) => {
    const record = requireRecord(item, `材料 ${index + 1}`)
    requireString(record.id, `材料 ${index + 1} ID`)
    requireEnum(record.status, ['missing', 'preparing', 'ready', 'submitted', 'verified', 'not_required'], `材料 ${index + 1} 状态`)
  })
  historyRecords.forEach((item, index) => {
    const record = requireRecord(item, `历史 ${index + 1}`)
    requireString(record.id, `历史 ${index + 1} ID`)
    requireEnum(record.entityType, ['task', 'subtask', 'project', 'milestone', 'work_package', 'material', 'time_point', 'event', 'source', 'draft', 'reminder'], `历史 ${index + 1} 实体类型`)
    requireDate(record.changedAt, `历史 ${index + 1} 时间`)
  })
  reminderRecords.forEach((item, index) => {
    const record = requireRecord(item, `提醒 ${index + 1}`)
    requireString(record.id, `提醒 ${index + 1} ID`)
    requireEnum(record.channel, ['browser', 'email', 'wechat-placeholder'], `提醒 ${index + 1} 渠道`)
    requireEnum(record.status, ['draft', 'scheduled', 'sent', 'failed', 'unsupported'], `提醒 ${index + 1} 状态`)
    requireDate(record.scheduledAt, `提醒 ${index + 1} 时间`)
  })
  workPackages.forEach((item, index) => {
    const record = requireRecord(item, `工作包 ${index + 1}`)
    requireString(record.id, `工作包 ${index + 1} ID`)
    requireString(record.projectId, `工作包 ${index + 1} 项目 ID`)
    requireString(record.milestoneId, `工作包 ${index + 1} 阶段 ID`)
    requireString(record.title, `工作包 ${index + 1} 标题`)
    requireArray(record.taskIds, `工作包 ${index + 1} 任务引用`)
    requireDate(record.createdAt, `工作包 ${index + 1} 创建时间`)
    requireDate(record.updatedAt, `工作包 ${index + 1} 更新时间`)
  })
  events.forEach((item, index) => {
    const record = requireRecord(item, `事件 ${index + 1}`)
    requireString(record.id, `事件 ${index + 1} ID`)
    requireString(record.title, `事件 ${index + 1} 标题`)
    if (record.startAt !== null) requireDate(record.startAt, `事件 ${index + 1} 开始时间`)
    if (record.endAt !== null) requireDate(record.endAt, `事件 ${index + 1} 结束时间`)
    requireDate(record.createdAt, `事件 ${index + 1} 创建时间`)
    requireDate(record.updatedAt, `事件 ${index + 1} 更新时间`)
  })
  migrationLog.forEach((item, index) => {
    const record = requireRecord(item, `迁移日志 ${index + 1}`)
    requireString(record.id, `迁移日志 ${index + 1} ID`)
    requireEnum(record.status, ['completed', 'needs_review'], `迁移日志 ${index + 1} 状态`)
    requireDate(record.migratedAt, `迁移日志 ${index + 1} 时间`)
  })
  recognitionFeedback.forEach((item, index) => {
    const record = requireRecord(item, `识别反馈 ${index + 1}`)
    requireString(record.id, `识别反馈 ${index + 1} ID`)
    requireString(record.draftId, `识别反馈 ${index + 1} 草稿 ID`)
    requireEnum(record.action, ['modified', 'rejected', 'merged', 'split', 'moved'], `识别反馈 ${index + 1} 动作`)
    requireDate(record.createdAt, `识别反馈 ${index + 1} 时间`)
  })
}

function assertUniqueIds(items: Array<{ id: string }>, label: string): void {
  const ids = new Set<string>()
  for (const item of items) {
    if (!item.id || ids.has(item.id)) throw new Error(`${label}包含空 ID 或重复 ID`)
    ids.add(item.id)
  }
}

function assertValidDate(value: string | undefined, label: string): void {
  if (value !== undefined && (!value || Number.isNaN(new Date(value).getTime()))) {
    throw new Error(`${label}包含无效日期`)
  }
}

function assertEnum(value: string | undefined, allowed: readonly string[], label: string): void {
  if (value !== undefined && !allowed.includes(value)) throw new Error(`${label}包含非法状态或枚举值`)
}

function assertNoDependencyCycles(workspace: WorkspaceData): void {
  const graph = new Map(workspace.tasks.map((task) => [task.id, task.dependencyIds ?? []]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (taskId: string) => {
    if (visiting.has(taskId)) throw new Error('任务依赖存在循环')
    if (visited.has(taskId)) return
    visiting.add(taskId)
    ;(graph.get(taskId) ?? []).forEach(visit)
    visiting.delete(taskId)
    visited.add(taskId)
  }
  workspace.tasks.forEach((task) => visit(task.id))
}

function validateWorkspaceIntegrity(workspace: WorkspaceData): void {
  assertUniqueIds(workspace.tasks, '任务')
  assertUniqueIds(workspace.sources, '来源')
  assertUniqueIds(workspace.drafts, '草稿')
  assertUniqueIds(workspace.projects, '项目')
  assertUniqueIds(workspace.evidence, '证据')
  assertUniqueIds(workspace.timePoints, '时间节点')
  assertUniqueIds(workspace.materialItems, '材料')
  assertUniqueIds(workspace.historyRecords, '历史')
  assertUniqueIds(workspace.reminderRecords, '提醒')
  assertUniqueIds(workspace.workPackages, '工作包')
  assertUniqueIds(workspace.events, '事件')
  assertUniqueIds(workspace.migrationLog, '迁移日志')
  assertUniqueIds(workspace.recognitionFeedback, '识别反馈')

  const taskIds = new Set(workspace.tasks.map((item) => item.id))
  const sourceIds = new Set(workspace.sources.map((item) => item.id))
  const projectIds = new Set(workspace.projects.map((item) => item.id))
  const milestoneIds = new Set(workspace.projects.flatMap((item) => item.milestones.map((milestone) => milestone.id)))
  const workPackageIds = new Set(workspace.workPackages.map((item) => item.id))
  workspace.tasks.forEach((task) => {
    assertEnum(task.category, ['比赛', '保研', '课程', '老师任务', '其他'], `任务“${task.title}”分类`)
    assertEnum(task.status, ['待开始', '进行中', '已完成'], `任务“${task.title}”状态`)
    assertEnum(task.priority, ['高', '中', '低'], `任务“${task.title}”优先级`)
    task.riskFlags.forEach((risk) => assertEnum(risk, ['紧急', '缺材料', '待确认', '有依赖', '已逾期'], `任务“${task.title}”风险`))
    if (!Number.isFinite(task.estimatedMinutes) || task.estimatedMinutes < 5 || task.estimatedMinutes > 10_080) {
      throw new Error(`任务“${task.title}”预计耗时无效`)
    }
    assertValidDate(task.deadline, `任务“${task.title}”`)
    assertValidDate(task.createdAt, `任务“${task.title}”`)
    assertValidDate(task.updatedAt, `任务“${task.title}”`)
    if (task.projectId && !projectIds.has(task.projectId)) throw new Error('任务引用了不存在的项目')
    if (task.parentTaskId && !taskIds.has(task.parentTaskId)) throw new Error('任务引用了不存在的父任务')
    if (task.milestoneId && !milestoneIds.has(task.milestoneId)) throw new Error('任务引用了不存在的阶段')
    if (task.workPackageId && !workPackageIds.has(task.workPackageId)) throw new Error('任务引用了不存在的工作包')
    if (task.sourceIds.some((id) => !sourceIds.has(id))) throw new Error('任务引用了不存在的来源')
    if ((task.dependencyIds ?? []).some((id) => !taskIds.has(id))) throw new Error('任务引用了不存在的依赖任务')
  })
  workspace.sources.forEach((source) => {
    assertEnum(source.type, ['text', 'file', 'image', 'link'], `来源“${source.title}”类型`)
    assertEnum(source.status, ['uploaded', 'extracting', 'needs_review', 'partially_confirmed', 'confirmed', 'failed', 'archived'], `来源“${source.title}”状态`)
    assertValidDate(source.createdAt, `来源“${source.title}”`)
    assertValidDate(source.updatedAt, `来源“${source.title}”`)
  })
  workspace.drafts.forEach((draft) => {
    assertEnum(draft.workflowStatus, ['processing', 'needs_review', 'partially_confirmed', 'confirmed', 'rejected', 'failed', 'archived'], '草稿状态')
    if (!sourceIds.has(draft.sourceId)) throw new Error('草稿引用了不存在的来源')
    assertValidDate(draft.createdAt, '草稿')
    assertValidDate(draft.updatedAt, '草稿')
  })
  workspace.projects.forEach((project) => {
    assertEnum(project.category, ['比赛', '保研', '课程', '老师任务', '其他'], `项目“${project.title}”分类`)
    assertEnum(project.status, ['active', 'completed', 'archived'], `项目“${project.title}”状态`)
    if (project.sourceIds.some((id) => !sourceIds.has(id))) throw new Error('项目引用了不存在的来源')
    if (project.taskIds.some((id) => !taskIds.has(id))) throw new Error('项目引用了不存在的任务')
  })
  workspace.evidence.forEach((evidence) => {
    if (!sourceIds.has(evidence.sourceId)) throw new Error('证据引用了不存在的来源')
  })
  workspace.timePoints.forEach((point) => {
    assertEnum(point.type, ['deadline', 'registration_deadline', 'submission_deadline', 'task_deadline', 'event_start', 'event_end', 'result_announcement', 'planned_start'], '时间节点类型')
    if (point.taskId && !taskIds.has(point.taskId)) throw new Error('时间节点引用了不存在的任务')
    if (point.projectId && !projectIds.has(point.projectId)) throw new Error('时间节点引用了不存在的项目')
    assertValidDate(point.value ?? undefined, '时间节点')
  })
  workspace.materialItems.forEach((material) => {
    assertEnum(material.status, ['missing', 'preparing', 'ready', 'submitted', 'verified', 'not_required'], `材料“${material.name}”状态`)
    if (material.taskId && !taskIds.has(material.taskId)) throw new Error('材料引用了不存在的任务')
    if (material.projectId && !projectIds.has(material.projectId)) throw new Error('材料引用了不存在的项目')
  })
  workspace.reminderRecords.forEach((reminder) => {
    assertEnum(reminder.channel, ['browser', 'email', 'wechat-placeholder'], '提醒渠道')
    assertEnum(reminder.status, ['draft', 'scheduled', 'sent', 'failed', 'unsupported'], '提醒状态')
    if (!taskIds.has(reminder.taskId)) throw new Error('提醒引用了不存在的任务')
    assertValidDate(reminder.scheduledAt, '提醒')
  })
  workspace.workPackages.forEach((workPackage) => {
    if (!projectIds.has(workPackage.projectId)) throw new Error('工作包引用了不存在的项目')
    if (!milestoneIds.has(workPackage.milestoneId)) throw new Error('工作包引用了不存在的阶段')
    if (workPackage.taskIds.some((id) => !taskIds.has(id))) throw new Error('工作包引用了不存在的任务')
  })
  workspace.events.forEach((event) => {
    if (event.projectId && !projectIds.has(event.projectId)) throw new Error('事件引用了不存在的项目')
    if (event.milestoneId && !milestoneIds.has(event.milestoneId)) throw new Error('事件引用了不存在的阶段')
    if (event.startAt) assertValidDate(event.startAt, `事件“${event.title}”开始时间`)
    if (event.endAt) assertValidDate(event.endAt, `事件“${event.title}”结束时间`)
  })
  assertNoDependencyCycles(workspace)
}

export class IndexedDbWorkspaceRepository implements WorkspaceRepository {
  private database: Promise<IDBDatabase> | null = null
  private latestCanonicalBackupId: string | null = null

  constructor(private readonly canonical = new CanonicalWorkspaceRepository()) {}

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
    const migration = await this.canonical.loadOrMigrate()
    this.rememberCanonicalBackup(migration.backupId)
    if (migration.workspace) return workspaceV8ToLegacyView(migration.workspace)
    if (migration.status === 'recovery_required') {
      if (!migration.backupId) throw new Error('WORKSPACE_RECOVERY_BACKUP_MISSING')
      throw new WorkspaceRecoveryRequiredError(migration.backupId, migration.errors)
    }
    if (migration.status === 'migration_required') return null

    const migratedLegacy = await this.tryMigratePreV7Workspace()
    if (migratedLegacy) return migratedLegacy
    throw new Error(migration.errors.join(',') || 'WORKSPACE_V8_MIGRATION_FAILED')
  }

  private rememberCanonicalBackup(backupId: string | null): void {
    if (backupId) this.latestCanonicalBackupId = backupId
  }

  private async tryMigratePreV7Workspace(): Promise<WorkspaceData | null> {
    let database: IDBDatabase
    try {
      database = await this.open()
    } catch {
      return null
    }
    const raw = await new Promise<unknown>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .get(RECORD_KEY)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    if (!isRecord(raw)
      || typeof raw.schemaVersion !== 'number'
      || raw.schemaVersion >= CURRENT_SCHEMA_VERSION) return null
    await this.saveMigrationBackup(database, raw, raw.schemaVersion)
    const v7 = normalizeWorkspaceData(raw)
    if (!v7) throw new Error('WORKSPACE_LEGACY_MIGRATION_FAILED')
    const canonical = applyPreparedV8Migration(prepareV7ToV8Migration(v7))
    await this.canonical.save(canonical)
    return workspaceV8ToLegacyView(canonical)
  }

  private async saveMigrationBackup(database: IDBDatabase, raw: Record<string, unknown>, version: number): Promise<void> {
    const savedAt = typeof raw.savedAt === 'string' ? raw.savedAt : 'unknown'
    const backupKey = `migration-backup-v${version}-${savedAt}`
    const existing = await new Promise<unknown>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(backupKey)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    if (existing !== undefined) return
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.onerror = () => reject(transaction.error)
      transaction.oncomplete = () => resolve()
      transaction.objectStore(STORE_NAME).put(structuredClone(raw), backupKey)
    })
  }

  async exportLatestMigrationBackup(): Promise<string | null> {
    if (this.latestCanonicalBackupId) {
      return this.exportMigrationBackup(this.latestCanonicalBackupId)
    }
    const database = await this.open()
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAllKeys()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    const backupKeys = keys.map(String).filter((key) => key.startsWith('migration-backup-v') || key.startsWith('backup:')).sort()
    const latestKey = backupKeys.at(-1)
    if (!latestKey) return null
    const backup = await new Promise<unknown>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(latestKey)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    return backup === undefined ? null : JSON.stringify(backup, null, 2)
  }

  async exportMigrationBackup(backupId: string): Promise<string | null> {
    const backup = await this.canonical.readMigrationBackup(backupId)
    return backup ? JSON.stringify(backup, null, 2) : null
  }

  async recoverMigration(backupId: string): Promise<WorkspaceData> {
    if (!backupId.trim()) throw new Error('MIGRATION_BACKUP_ID_REQUIRED')
    const backup = await this.canonical.rollbackMigration(backupId)
    const migration = await this.canonical.loadOrMigrate(backup.migrationId
      ? { migrationId: backup.migrationId, now: backup.createdAt }
      : {})
    this.rememberCanonicalBackup(migration.backupId ?? backupId)
    if (migration.workspace) return workspaceV8ToLegacyView(migration.workspace)
    if (migration.status === 'recovery_required') {
      if (!migration.backupId) throw new Error('WORKSPACE_RECOVERY_BACKUP_MISSING')
      throw new WorkspaceRecoveryRequiredError(migration.backupId, migration.errors)
    }
    throw this.migrationFailure(migration, 'WORKSPACE_RECOVERY_FAILED')
  }

  private migrationFailure(migration: RuntimeMigrationResult, fallback: string): Error {
    return new Error(migration.errors.join(',') || fallback)
  }

  async save(workspace: WorkspaceData): Promise<void> {
    const current = await this.canonical.load()
    if (!current) {
      await this.canonical.save(applyPreparedV8Migration(prepareV7ToV8Migration(workspace)))
      return
    }
    await this.canonical.transaction((canonical) => mergeLegacyViewIntoWorkspaceV8(canonical, workspace))
  }

  async clear(): Promise<void> {
    await this.canonical.clear()
  }

  async exportCurrentJson(): Promise<string> {
    const workspace = await this.canonical.load()
    if (!workspace) throw new Error('WORKSPACE_V8_NOT_INITIALIZED')
    return this.canonical.exportJson(workspace)
  }

  async importAndReplace(serialized: string): Promise<WorkspaceData> {
    if (new TextEncoder().encode(serialized).byteLength > MAX_WORKSPACE_IMPORT_BYTES) throw new Error('导入文件超过 5 MB 上限')
    const parsed: unknown = JSON.parse(serialized)
    validateSafeJson(parsed)
    if (isRecord(parsed) && parsed.schemaVersion === 8) {
      const canonical = this.canonical.importJson(serialized)
      await this.canonical.save(canonical)
      return workspaceV8ToLegacyView(canonical)
    }
    const legacy = this.importJson(serialized)
    const canonical = applyPreparedV8Migration(prepareV7ToV8Migration(legacy))
    await this.canonical.save(canonical)
    return workspaceV8ToLegacyView(canonical)
  }

  exportJson(workspace: WorkspaceData): string {
    return JSON.stringify(workspace, null, 2)
  }

  importJson(serialized: string): WorkspaceData {
    if (new TextEncoder().encode(serialized).byteLength > MAX_WORKSPACE_IMPORT_BYTES) {
      throw new Error('导入文件超过 5 MB 上限')
    }
    const parsed: unknown = JSON.parse(serialized)
    validateSafeJson(parsed)
    validateCurrentSchemaInput(parsed)
    let normalized: WorkspaceData | null
    try {
      normalized = normalizeWorkspaceData(parsed)
    } catch {
      throw new Error('导入文件包含无法迁移的字段')
    }
    if (!normalized) {
      throw new Error('导入文件不是有效的学生事务管家数据')
    }
    validateWorkspaceIntegrity(normalized)
    return normalized
  }
}
