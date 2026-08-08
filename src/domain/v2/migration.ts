import type { MaterialItemEntity, WorkspaceData } from '../../types'
import { DEFAULT_WORKSPACE_TIMEZONE, isDateOnly, parseBusinessDateTime } from '../../lib/timeSemantics'
import type {
  Event, EvidenceRef, ExtractionDraft, HistoryEntityType, HistoryRecord, JsonValue, LegacyData,
  Material, MigrationMetadata, Project, RecognitionRun, ReminderRecord, Source, SourceVersion,
  Task, TimePoint, WorkspaceV8,
} from './types'
import { validateWorkspaceV8 } from './validators/workspaceValidator'

export interface WorkspaceV7Backup {
  id: string
  schemaVersion: 7
  createdAt: string
  integrityHash: string
  snapshot: WorkspaceData
}

export interface V7ToV8MigrationPreparation {
  backup: WorkspaceV7Backup
  workspace: WorkspaceV8 | null
  metadata: MigrationMetadata
}

export interface MigrationOptions {
  now?: string
  migrationId?: string
  workspaceId?: string
  defaultTimezone?: string
}

function jsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) return value.map(jsonValue)
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item)]))
  }
  return null
}

function legacy(value: Record<string, unknown>): LegacyData {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item)]))
}

function cloneV7(workspace: WorkspaceData): WorkspaceData {
  return JSON.parse(JSON.stringify(workspace)) as WorkspaceData
}

export function workspaceSnapshotHash(value: unknown): string {
  const text = JSON.stringify(value)
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function parseWorkspaceV7Snapshot(value: unknown): WorkspaceData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('WORKSPACE_V7_INVALID')
  const record = value as Partial<Record<keyof WorkspaceData, unknown>> & { schemaVersion?: unknown }
  const requiredArrays: Array<keyof WorkspaceData> = [
    'tasks', 'sources', 'drafts', 'projects', 'evidence', 'timePoints', 'materialItems', 'historyRecords',
    'reminderRecords', 'workPackages', 'events', 'migrationLog', 'recognitionFeedback', 'courseBlocks',
  ]
  if (record.schemaVersion !== 7 || requiredArrays.some((key) => !Array.isArray(record[key]))) {
    throw new Error('WORKSPACE_V7_INVALID')
  }
  return cloneV7(value as WorkspaceData)
}

function sourceStatus(source: WorkspaceData['sources'][number]): Source['status'] {
  if (source.status) return source.status
  if (source.extractionStatus === '已确认') return 'confirmed'
  if (source.extractionStatus === '部分确认') return 'partially_confirmed'
  if (source.extractionStatus === '已拒绝') return 'archived'
  return 'needs_review'
}

function taskStatus(status: WorkspaceData['tasks'][number]['status']): Task['status'] {
  return status === '已完成' ? 'completed' : status === '进行中' ? 'in_progress' : 'todo'
}

function projectStatus(status: WorkspaceData['projects'][number]['status']): Project['status'] {
  return status ?? 'active'
}

function versionId(sourceId: string): string {
  return `source-version:${sourceId}:1`
}

function validInstant(value: string | undefined): string | null {
  if (!value || Number.isNaN(new Date(value).getTime())) return null
  return value
}

function canonicalTimeValue(value: string | null, timezone: string): Pick<TimePoint, 'normalizedValue' | 'precision' | 'needsConfirmation' | 'isAllDay' | 'timezone'> {
  if (!value || /^(?:1900-01-01|1970-01-01|9999-12-31)(?:T|$)/u.test(value)) {
    return { normalizedValue: null, precision: 'vague', needsConfirmation: true, isAllDay: false, timezone: null }
  }
  if (isDateOnly(value)) {
    return { normalizedValue: value, precision: 'date_only', needsConfirmation: false, isAllDay: true, timezone: null }
  }
  if (parseBusinessDateTime(value, timezone)) {
    return { normalizedValue: value, precision: 'exact', needsConfirmation: false, isAllDay: false, timezone }
  }
  return { normalizedValue: null, precision: 'vague', needsConfirmation: true, isAllDay: false, timezone: null }
}

function mapTimePointType(type: WorkspaceData['timePoints'][number]['type']): TimePoint['type'] {
  return type === 'deadline' ? 'task_deadline' : type
}

function mapSources(workspace: WorkspaceData, workspaceId: string): { sources: Source[]; sourceVersions: SourceVersion[] } {
  const sources = workspace.sources.map((item): Source => ({
    id: item.id,
    workspaceId,
    type: item.type,
    title: item.title,
    status: sourceStatus(item),
    currentVersionId: versionId(item.id),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt ?? item.createdAt,
    legacyData: legacy({ v7Record: item,
      url: item.url,
      originalFileName: item.originalFileName,
      mimeType: item.mimeType,
      fileSize: item.fileSize,
      parserVersion: item.parserVersion,
      duplicateOfSourceIds: item.duplicateOfSourceIds,
      duplicateReviewStatus: item.duplicateReviewStatus,
      extractionStatus: item.extractionStatus,
    }),
  }))
  const sourceVersions = workspace.sources.map((item): SourceVersion => ({
    id: versionId(item.id),
    sourceId: item.id,
    versionNo: 1,
    contentHash: item.fileHash ?? null,
    rawText: item.rawText ?? item.content ?? item.contentPreview ?? null,
    rawTextRef: null,
    createdAt: item.createdAt,
    needsReview: !item.fileHash,
    legacyData: legacy({ v7Record: item, contentPreview: item.contentPreview }),
  }))
  return { sources, sourceVersions }
}

function mapRecognition(workspace: WorkspaceData): { recognitionRuns: RecognitionRun[]; extractionDrafts: ExtractionDraft[] } {
  const recognitionRuns = workspace.drafts.map((draft): RecognitionRun => {
    const result = draft.recognitionResult
    const modelName = result?.modelName ?? draft.modelName ?? null
    const provider: RecognitionRun['provider'] = modelName === 'local-rules'
      ? 'local-rules'
      : modelName?.includes('deepseek') ? 'deepseek' : 'legacy-unknown'
    return {
      id: `recognition-run:${draft.id}`,
      sourceVersionId: versionId(draft.sourceId),
      provider,
      modelName,
      promptVersion: result?.promptVersion ?? draft.promptVersion ?? null,
      schemaVersion: result?.schemaVersion ?? draft.schemaVersion ?? 'legacy',
      pipelineVersion: 'v7-compatibility',
      status: draft.workflowStatus === 'failed' ? 'failed' : 'succeeded',
      startedAt: draft.createdAt,
      completedAt: draft.updatedAt,
      durationMs: null,
      tokenUsage: null,
      qualityFlags: result?.quality.reviewReasons ?? [],
      errorCode: draft.workflowStatus === 'failed' ? 'LEGACY_DRAFT_FAILED' : null,
      needsReview: provider === 'legacy-unknown',
      legacyData: legacy({ v7Record: draft }),
    }
  })
  const extractionDrafts = workspace.drafts.map((draft): ExtractionDraft => ({
    id: draft.id,
    recognitionRunId: `recognition-run:${draft.id}`,
    status: draft.workflowStatus ?? (draft.status === '已确认' ? 'confirmed' : draft.status === '部分确认' ? 'partially_confirmed' : draft.status === '已拒绝' ? 'rejected' : 'needs_review'),
    result: draft.recognitionResult ?? null,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    needsReview: !draft.recognitionResult,
    legacyData: legacy({ v7Record: draft, items: draft.items, legacyStatus: draft.status }),
  }))
  return { recognitionRuns, extractionDrafts }
}

function mapProjects(workspace: WorkspaceData, workspaceId: string): { projects: Project[]; milestones: WorkspaceV8['milestones'] } {
  const projects = workspace.projects.map((item): Project => ({
    id: item.id,
    workspaceId,
    title: item.title,
    category: item.category,
    objective: item.objective ?? null,
    status: projectStatus(item.status),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    version: 1,
    legacyData: legacy({ v7Record: item, sourceIds: item.sourceIds, taskIds: item.taskIds, keywords: item.keywords, evidenceIds: item.evidenceIds, embeddedMilestones: item.milestones }),
  }))
  const milestones = workspace.projects.flatMap((project) => project.milestones.map((item, index) => ({
    id: item.id,
    projectId: project.id,
    title: item.title,
    objective: item.objective ?? null,
    sortOrder: item.order ?? index + 1,
    status: item.status === '已完成' ? 'completed' as const : 'active' as const,
    createdAt: item.createdAt,
    updatedAt: project.updatedAt,
    legacyData: legacy({ v7Record: item, dueAt: item.dueAt, evidenceIds: item.evidenceIds, taskIds: item.taskIds, workPackageIds: item.workPackageIds }),
  })))
  return { projects, milestones }
}

function mapTasks(workspace: WorkspaceData): Task[] {
  return workspace.tasks.map((item): Task => ({
    id: item.id,
    projectId: item.projectId ?? null,
    milestoneId: item.milestoneId ?? null,
    workPackageId: item.workPackageId ?? null,
    parentTaskId: item.parentTaskId ?? null,
    title: item.title,
    description: item.description || null,
    nextAction: item.nextAction || null,
    status: taskStatus(item.status),
    estimatedMinutes: Number.isFinite(item.estimatedMinutes) && item.estimatedMinutes > 0 ? item.estimatedMinutes : null,
    manualPriority: item.manualPriority ?? null,
    snoozedUntil: validInstant(item.snoozedUntil),
    dependencyIds: item.dependencyIds ?? [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    version: 1,
    legacyData: legacy({ v7Record: item,
      category: item.category,
      priority: item.priority,
      riskFlags: item.riskFlags,
      materials: item.materials,
      reminders: item.reminders,
      sourceIds: item.sourceIds,
      evidenceIds: item.evidenceIds,
      inferenceLevel: item.inferenceLevel,
      completionCriteria: item.completionCriteria,
      priorityReason: item.priorityReason,
    }),
  }))
}

function mapTimePoints(workspace: WorkspaceData, timezone: string, now: string): TimePoint[] {
  const mapped = workspace.timePoints.map((item): TimePoint => ({
    id: item.id,
    projectId: item.projectId ?? null,
    milestoneId: null,
    taskId: item.taskId ?? null,
    materialId: item.relatedMaterialIds?.[0] ?? null,
    eventId: null,
    type: mapTimePointType(item.type),
    rawText: item.originalText ?? item.value ?? '',
    ...canonicalTimeValue(item.value, item.timezone || timezone),
    needsConfirmation: item.needsConfirmation || canonicalTimeValue(item.value, item.timezone || timezone).needsConfirmation,
    createdAt: now,
    updatedAt: now,
    legacyData: legacy({ v7Record: item, evidenceIds: item.evidenceIds, relatedTaskIds: item.relatedTaskIds, relatedMaterialIds: item.relatedMaterialIds, confidence: item.confidence }),
  }))
  const ids = new Set(mapped.map((item) => item.id))
  workspace.tasks.forEach((task) => {
    if (mapped.some((point) => point.taskId === task.id && point.type === 'task_deadline')) return
    const id = `time:${task.id}:deadline`
    if (ids.has(id)) return
    ids.add(id)
    const normalized = canonicalTimeValue(task.deadline, timezone)
    mapped.push({
      id, projectId: task.projectId ?? null, milestoneId: task.milestoneId ?? null, taskId: task.id,
      materialId: null, eventId: null, type: 'task_deadline', rawText: task.deadline,
      ...normalized, createdAt: task.createdAt, updatedAt: task.updatedAt,
      needsReview: normalized.needsConfirmation,
    })
  })
  workspace.events.forEach((event) => {
    const addEventPoint = (kind: 'start' | 'end', value: string | null) => {
      if (!value) return
      const id = `time:event:${event.id}:${kind}`
      if (ids.has(id)) return
      ids.add(id)
      const normalized = canonicalTimeValue(value, timezone)
      mapped.push({
        id,
        projectId: event.projectId ?? null,
        milestoneId: event.milestoneId ?? null,
        taskId: null,
        materialId: null,
        eventId: event.id,
        type: kind === 'start' ? 'event_start' : 'event_end',
        rawText: value,
        ...normalized,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        needsReview: normalized.needsConfirmation,
        legacyData: legacy({ v7EventId: event.id, v7Field: kind === 'start' ? 'startAt' : 'endAt' }),
      })
    }
    addEventPoint('start', event.startAt)
    addEventPoint('end', event.endAt)
  })
  return mapped
}

function mapMaterials(workspace: WorkspaceData, timePoints: TimePoint[]): Material[] {
  const source = workspace.materialItems.length
    ? workspace.materialItems
    : workspace.tasks.flatMap((task) => task.materials.map((material): MaterialItemEntity => ({
        id: material.id, projectId: task.projectId, taskId: task.id, name: material.name, required: true,
        status: material.status ?? (material.done ? 'ready' as const : 'missing' as const), evidenceIds: [],
        createdAt: task.createdAt, updatedAt: task.updatedAt, formatRequirement: undefined,
        quantity: undefined, note: undefined, deadline: undefined,
      })))
  return source.map((item): Material => ({
    id: item.id,
    projectId: item.projectId ?? null,
    name: item.name,
    required: item.required,
    status: item.status,
    requirements: item.note ? [item.note] : [],
    formatRequirements: item.formatRequirement ? [item.formatRequirement] : [],
    namingRequirements: [],
    quantity: item.quantity ?? null,
    submissionChannel: null,
    relatedTaskIds: item.taskId ? [item.taskId] : [],
    deadlineTimePointId: timePoints.find((point) => point.materialId === item.id)?.id ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    version: 1,
    legacyData: legacy({ v7Record: item, quantity: item.quantity, deadline: item.deadline, evidenceIds: item.evidenceIds }),
  }))
}

function mapEvents(workspace: WorkspaceData, timePoints: TimePoint[]): Event[] {
  return workspace.events.map((item): Event => ({
    id: item.id,
    projectId: item.projectId ?? null,
    title: item.title,
    description: item.description || null,
    startTimePointId: timePoints.find((point) => point.eventId === item.id && point.type === 'event_start')?.id ?? null,
    endTimePointId: timePoints.find((point) => point.eventId === item.id && point.type === 'event_end')?.id ?? null,
    location: item.location ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    needsReview: Boolean((item.startAt && !timePoints.some((point) => point.eventId === item.id && point.type === 'event_start' && !point.needsConfirmation))
      || (item.endAt && !timePoints.some((point) => point.eventId === item.id && point.type === 'event_end' && !point.needsConfirmation))),
    legacyData: legacy({ v7Record: item, startAt: item.startAt, endAt: item.endAt, milestoneId: item.milestoneId, evidenceIds: item.evidenceIds, needsConfirmation: item.needsConfirmation }),
  }))
}

function mapEvidence(workspace: WorkspaceData, now: string): EvidenceRef[] {
  return workspace.evidence.map((item): EvidenceRef => ({
    id: item.id,
    sourceVersionId: versionId(item.sourceId),
    page: item.page ?? null,
    textStart: item.textStart ?? null,
    textEnd: item.textEnd ?? null,
    quotedText: item.quotedText ?? item.quote ?? null,
    bbox: item.boundingBox ?? null,
    fieldPath: item.field ?? null,
    extractionMethod: item.extractionMethod ?? 'migration',
    confidence: item.confidence ?? null,
    createdAt: now,
    legacyData: legacy({ v7Record: item }),
  }))
}

function mapReminders(workspace: WorkspaceData): ReminderRecord[] {
  return workspace.reminderRecords.map((item): ReminderRecord => ({
    id: item.id,
    taskId: item.taskId,
    channel: item.channel,
    scheduledAt: validInstant(item.scheduledAt),
    status: item.status,
    errorCode: item.errorMessage ?? null,
    sentAt: item.status === 'sent' ? validInstant(item.scheduledAt) : null,
    needsReview: item.status === 'sent',
    legacyData: legacy({ v7Record: item, enabled: item.enabled }),
  }))
}

function mapHistory(workspace: WorkspaceData): { records: HistoryRecord[]; orphans: WorkspaceData['historyRecords'] } {
  const targets: Record<Exclude<HistoryEntityType, 'source_version' | 'recognition_run' | 'evidence' | 'change_proposal'>, Set<string>> = {
    source: new Set(workspace.sources.map((item) => item.id)),
    extraction_draft: new Set(workspace.drafts.map((item) => item.id)),
    project: new Set(workspace.projects.map((item) => item.id)),
    milestone: new Set(workspace.projects.flatMap((project) => project.milestones.map((item) => item.id))),
    work_package: new Set(workspace.workPackages.map((item) => item.id)),
    task: new Set(workspace.tasks.map((item) => item.id)),
    material: new Set(workspace.materialItems.map((item) => item.id)),
    time_point: new Set(workspace.timePoints.map((item) => item.id)),
    event: new Set(workspace.events.map((item) => item.id)),
    reminder: new Set(workspace.reminderRecords.map((item) => item.id)),
  }
  const records: HistoryRecord[] = []
  const orphans: WorkspaceData['historyRecords'] = []
  workspace.historyRecords.forEach((item) => {
    const entityType: keyof typeof targets = item.entityType === 'subtask'
      ? 'task'
      : item.entityType === 'draft' ? 'extraction_draft' : item.entityType
    let entityId = item.entityId
    if (entityType === 'extraction_draft' && !targets.extraction_draft.has(entityId)) {
      entityId = workspace.drafts.find((draft) => draft.items.some((draftItem) => draftItem.id === item.entityId))?.id ?? entityId
    }
    if (!targets[entityType].has(entityId)) {
      orphans.push(item)
      return
    }
    records.push({
      id: item.id,
      entityType,
      entityId,
      action: item.action,
      fieldName: item.field || null,
      before: jsonValue(item.before),
      after: jsonValue(item.after),
      actor: item.actor,
      reason: null,
      sourceVersionId: null,
      changedAt: item.changedAt,
      needsReview: entityId !== item.entityId,
      legacyData: legacy({ v7Record: item, originalEntityId: entityId !== item.entityId ? item.entityId : null }),
    })
  })
  return { records, orphans }
}

export function prepareV7ToV8Migration(workspace: WorkspaceData, options: MigrationOptions = {}): V7ToV8MigrationPreparation {
  const now = options.now ?? new Date().toISOString()
  const migrationId = options.migrationId ?? `migration-v7-v8-${now}`
  const workspaceId = options.workspaceId ?? 'workspace-local'
  const timezone = options.defaultTimezone ?? DEFAULT_WORKSPACE_TIMEZONE
  const backupSnapshot = cloneV7(workspace)
  const backup: WorkspaceV7Backup = {
    id: `backup:${migrationId}`,
    schemaVersion: 7,
    createdAt: now,
    integrityHash: workspaceSnapshotHash(backupSnapshot),
    snapshot: backupSnapshot,
  }
  const metadata: MigrationMetadata = {
    migrationId, sourceVersion: 7, targetVersion: 8, startedAt: now, completedAt: null,
    status: 'prepared', warnings: [], errors: [], backupId: backup.id,
  }
  const sourceMap = mapSources(workspace, workspaceId)
  const recognitionMap = mapRecognition(workspace)
  const projectMap = mapProjects(workspace, workspaceId)
  const tasks = mapTasks(workspace)
  const timePoints = mapTimePoints(workspace, timezone, now)
  const history = mapHistory(workspace)
  const knownTopLevelKeys = new Set([
    'schemaVersion', 'tasks', 'sources', 'drafts', 'projects', 'evidence', 'timePoints', 'materialItems',
    'historyRecords', 'reminderRecords', 'workPackages', 'events', 'migrationLog', 'recognitionFeedback',
    'legacyData', 'courseBlocks', 'integrations', 'knowledgeSettings', 'savedAt',
  ])
  const unknownTopLevelFields = Object.fromEntries(
    Object.entries(workspace as unknown as Record<string, unknown>).filter(([key]) => !knownTopLevelKeys.has(key)),
  )
  const topLevelLegacy = legacy({
    courseBlocks: workspace.courseBlocks,
    integrations: workspace.integrations,
    knowledgeSettings: workspace.knowledgeSettings,
    recognitionFeedback: workspace.recognitionFeedback,
    v7MigrationLog: workspace.migrationLog,
    v7LegacyData: workspace.legacyData,
    orphanHistoryRecords: history.orphans,
    unknownTopLevelFields,
  })
  const candidate: WorkspaceV8 = {
    schemaVersion: 8,
    workspace: { id: workspaceId, title: '学生事务管家本机工作区', createdAt: workspace.savedAt, updatedAt: now, legacyData: topLevelLegacy },
    settings: { defaultTimezone: timezone, locale: 'zh-CN' },
    ...sourceMap,
    ...recognitionMap,
    ...projectMap,
    workPackages: workspace.workPackages.map((item) => ({
      id: item.id, projectId: item.projectId, milestoneId: item.milestoneId, title: item.title,
      objective: item.objective || null, sortOrder: item.order, createdAt: item.createdAt, updatedAt: item.updatedAt,
      legacyData: legacy({ v7Record: item, taskIds: item.taskIds, evidenceIds: item.evidenceIds }),
    })),
    tasks,
    materials: mapMaterials(workspace, timePoints),
    timePoints,
    events: mapEvents(workspace, timePoints),
    evidenceRefs: mapEvidence(workspace, now),
    changeProposals: [],
    historyRecords: history.records,
    reminderRecords: mapReminders(workspace),
    preferences: { onboardingCompletedAt: null, legacyData: topLevelLegacy },
    migrationMetadata: [metadata],
    savedAt: workspace.savedAt,
  }
  const validation = validateWorkspaceV8(candidate)
  if (!validation.valid) {
    metadata.status = 'failed'
    metadata.errors = validation.issues.map((issue) => `${issue.code}:${issue.path}:${issue.message}`)
    return { backup, workspace: null, metadata }
  }
  const needsReview = candidate.sources.some((item) => item.needsReview)
    || candidate.sourceVersions.some((item) => item.needsReview)
    || candidate.extractionDrafts.some((item) => item.needsReview)
    || candidate.timePoints.some((item) => item.needsReview || item.needsConfirmation)
  if (needsReview) metadata.warnings.push('部分旧字段无法无歧义升级，已保留 legacyData 并标记 needsReview')
  if (history.orphans.length) metadata.warnings.push(`${history.orphans.length} 条无法定位目标的旧历史已保留在 legacyData`)
  metadata.status = needsReview ? 'needs_review' : 'completed'
  metadata.completedAt = now
  candidate.migrationMetadata = [{ ...metadata }]
  return { backup, workspace: candidate, metadata }
}

export function applyPreparedV8Migration(preparation: V7ToV8MigrationPreparation): WorkspaceV8 {
  if (!preparation.workspace || preparation.metadata.status === 'failed') throw new Error('V8_MIGRATION_NOT_APPLICABLE')
  return preparation.workspace
}

export function rollbackPreparedV8Migration(preparation: V7ToV8MigrationPreparation): WorkspaceData {
  return cloneV7(preparation.backup.snapshot)
}
