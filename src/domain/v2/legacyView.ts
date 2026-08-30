import type {
  CourseBlock,
  Event as LegacyEvent,
  ExtractionDraft as LegacyDraft,
  HistoryEntry,
  IntegrationState,
  KnowledgeSettings,
  Material as LegacyTaskMaterial,
  MaterialItemEntity,
  MigrationRecord,
  Project as LegacyProject,
  RecognitionFeedbackRecord,
  Reminder,
  ReminderRecord as LegacyReminderRecord,
  Source as LegacySource,
  Task as LegacyTask,
  TimePoint as LegacyTimePoint,
  WorkPackage as LegacyWorkPackage,
  WorkspaceData,
} from '../../types'
import { recognitionToLegacySuggestions } from '../../recognition/pipeline'
import { normalizeFocusedReviewSourceMetadata } from '../../recognition/focusedReview'
import { isDateOnly, parseBusinessDateTime } from '../../lib/timeSemantics'
import { createIntegrationState } from '../../lib/workspace'
import { workspaceSnapshotHash } from './migration'
import type { JsonValue, LegacyData, WorkspaceV8 } from './types'

function record(value: JsonValue | undefined): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function v7Record<T>(legacyData: LegacyData | undefined): Partial<T> {
  return (record(legacyData?.v7Record) ?? {}) as Partial<T>
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function legacyTaskStatus(status: WorkspaceV8['tasks'][number]['status']): LegacyTask['status'] {
  if (status === 'completed') return '已完成'
  if (status === 'in_progress') return '进行中'
  return '待开始'
}

function legacyDraftStatus(status: WorkspaceV8['extractionDrafts'][number]['status']): LegacyDraft['status'] {
  if (status === 'confirmed') return '已确认'
  if (status === 'partially_confirmed') return '部分确认'
  if (status === 'rejected' || status === 'archived') return '已拒绝'
  return '待确认'
}

function legacySourceStatus(status: WorkspaceV8['sources'][number]['status']): LegacySource['extractionStatus'] {
  if (status === 'confirmed') return '已确认'
  if (status === 'partially_confirmed') return '部分确认'
  if (status === 'archived') return '已拒绝'
  if (status === 'uploaded' || status === 'extracting') return '待确认'
  return '待确认'
}

function legacyPriority(value: unknown): LegacyTask['priority'] {
  return value === '高' || value === '中' || value === '低' ? value : '中'
}

function preferredTaskDeadlinePoint(workspace: WorkspaceV8, taskId: string): WorkspaceV8['timePoints'][number] | undefined {
  const related = workspace.timePoints.filter((item) =>
    (item.taskId === taskId || item.relatedTaskIds.includes(taskId))
      && item.normalizedValue
      && item.type !== 'event_start'
      && item.type !== 'event_end'
      && item.type !== 'planned_start')
  return related.find((item) => item.type === 'task_deadline')
    ?? related.find((item) => item.type === 'submission_deadline')
    ?? related.find((item) => item.type === 'registration_deadline')
    ?? related.sort((a, b) => a.normalizedValue!.localeCompare(b.normalizedValue!))[0]
}

function taskDeadline(workspace: WorkspaceV8, taskId: string): string {
  return preferredTaskDeadlinePoint(workspace, taskId)?.normalizedValue ?? ''
}

function taskMaterials(workspace: WorkspaceV8, taskId: string, sourceId?: string): LegacyTaskMaterial[] {
  return workspace.materials.filter((item) => item.relatedTaskIds.includes(taskId)).map((item) => ({
    id: item.id,
    name: item.name,
    done: ['ready', 'submitted', 'verified', 'not_required'].includes(item.status),
    status: item.status,
    taskId,
    projectId: item.projectId ?? undefined,
    sourceId,
  }))
}

function taskReminders(workspace: WorkspaceV8, taskId: string): Reminder[] {
  return workspace.reminderRecords.filter((item) => item.taskId === taskId).map((item) => ({
    id: item.id,
    channel: item.channel,
    scheduledAt: item.scheduledAt ?? '',
    enabled: item.status === 'scheduled',
    status: item.status,
    errorMessage: item.errorCode ?? undefined,
    sentAt: item.sentAt,
  }))
}

function safeRecognitionFailureMessage(errorCode: string | null): string {
  if (errorCode === 'AI_TIMEOUT') return '智能整理超时，来源已保留，可重试或手动补充。'
  if (errorCode === 'INVALID_AI_RESPONSE') return '智能整理结果无效，来源已保留，可重试或手动补充。'
  if (errorCode === 'RECOGNITION_FAILED') return '识别失败，来源已保留，可重试或手动补充。'
  return '识别未完成，来源已保留，请重试或手动补充。'
}

const MILESTONE_DUE_SENTINEL = /^(?:1900-01-01|1970-01-01|9999-12-31)(?:T|$)/u

function milestoneDuePointId(milestoneId: string): string {
  return `time:milestone:${milestoneId}:deadline`
}

function standaloneMilestoneDuePoint(
  workspace: WorkspaceV8,
  milestoneId: string,
): WorkspaceV8['timePoints'][number] | undefined {
  const candidates = workspace.timePoints.filter((point) => point.milestoneId === milestoneId
    && point.taskId === null
    && point.materialId === null
    && point.eventId === null
    && ['registration_deadline', 'submission_deadline', 'task_deadline'].includes(point.type))
  return candidates.find((point) => point.id === milestoneDuePointId(milestoneId)) ?? candidates[0]
}

function milestoneDueTimeFields(
  dueAt: string,
  timezone: string,
): Pick<WorkspaceV8['timePoints'][number], 'normalizedValue' | 'timezone' | 'isAllDay' | 'precision' | 'needsConfirmation'> {
  if (!MILESTONE_DUE_SENTINEL.test(dueAt) && isDateOnly(dueAt)) {
    return { normalizedValue: dueAt, timezone: null, isAllDay: true, precision: 'date_only', needsConfirmation: false }
  }
  if (!MILESTONE_DUE_SENTINEL.test(dueAt) && parseBusinessDateTime(dueAt, timezone)) {
    return { normalizedValue: dueAt, timezone, isAllDay: false, precision: 'exact', needsConfirmation: false }
  }
  return { normalizedValue: null, timezone: null, isAllDay: false, precision: 'vague', needsConfirmation: true }
}

function taskHistory(workspace: WorkspaceV8, taskId: string): HistoryEntry[] {
  return workspace.historyRecords.filter((item) => item.entityType === 'task' && item.entityId === taskId).map((item) => ({
    id: item.id,
    field: item.fieldName ?? item.action,
    before: typeof item.before === 'string' ? item.before : JSON.stringify(item.before),
    after: typeof item.after === 'string' ? item.after : JSON.stringify(item.after),
    changedAt: item.changedAt,
    actor: item.actor === 'user' ? 'user' : 'system',
    entityType: 'task',
    entityId: taskId,
    action: item.action,
  }))
}

function sourceIdsForTask(task: WorkspaceV8['tasks'][number]): string[] {
  const legacy = v7Record<LegacyTask>(task.legacyData)
  const direct = typeof task.legacyData?.sourceId === 'string' ? [task.legacyData.sourceId] : []
  return [...new Set([...direct, ...(legacy.sourceIds ?? [])])]
}

function preferencesValue<T>(workspace: WorkspaceV8, key: string, fallback: T): T {
  const value = workspace.preferences.legacyData?.[key] ?? workspace.workspace.legacyData?.[key]
  return (value === undefined ? fallback : value) as T
}

/**
 * Read-only compatibility view for the current React screens. Canonical v8
 * entities remain the only persisted facts; this view must never be stored as
 * a replacement for those entity arrays.
 */
export function workspaceV8ToLegacyView(workspace: WorkspaceV8): WorkspaceData {
  const sources: LegacySource[] = workspace.sources.map((item) => {
    const legacy = v7Record<LegacySource>(item.legacyData)
    const version = workspace.sourceVersions.find((candidate) => candidate.id === item.currentVersionId)
    const rawText = version?.rawText ?? undefined
    const runsForVersion = workspace.recognitionRuns.filter((run) => run.sourceVersionId === version?.id)
    // Runs are append-only attempts. Completion time cannot define precedence:
    // an older request may finish after a newer retry and must not regain ownership.
    const latestRun = runsForVersion.at(-1)
    const flatMimeType = typeof item.legacyData?.mimeType === 'string' ? item.legacyData.mimeType : undefined
    const persistedReviewMetadata = normalizeFocusedReviewSourceMetadata(
      version?.legacyData?.reviewMetadata ?? item.legacyData?.reviewMetadata ?? legacy.reviewMetadata,
    )
    const runQualityFlags = latestRun?.qualityFlags ?? []
    const currentFailure = latestRun?.status === 'failed' || (item.status === 'failed' && !latestRun)
    const reviewMetadata = normalizeFocusedReviewSourceMetadata({
      ...persistedReviewMetadata,
      sourceType: item.type,
      mimeType: persistedReviewMetadata.mimeType ?? legacy.mimeType ?? flatMimeType,
      characterCount: persistedReviewMetadata.characterCount ?? rawText?.length,
      qualityFlags: [...(persistedReviewMetadata.qualityFlags ?? []), ...runQualityFlags],
    })
    return {
      id: item.id,
      currentVersionId: item.currentVersionId,
      type: item.type,
      title: item.title,
      contentPreview: legacy.contentPreview
        ?? (typeof item.legacyData?.contentPreview === 'string' ? item.legacyData.contentPreview : undefined)
        ?? rawText?.slice(0, 240)
        ?? '',
      content: legacy.content ?? rawText,
      rawText,
      url: legacy.url ?? (typeof item.legacyData?.url === 'string' ? item.legacyData.url : undefined),
      originalFileName: legacy.originalFileName ?? (typeof item.legacyData?.originalFileName === 'string' ? item.legacyData.originalFileName : undefined),
      mimeType: legacy.mimeType ?? flatMimeType,
      fileSize: legacy.fileSize ?? (typeof item.legacyData?.fileSize === 'number' && Number.isFinite(item.legacyData.fileSize) ? item.legacyData.fileSize : undefined),
      fileHash: legacy.fileHash ?? (typeof item.legacyData?.fileHash === 'string' ? item.legacyData.fileHash : undefined),
      status: item.status,
      processingError: currentFailure
        ? safeRecognitionFailureMessage(latestRun?.errorCode ?? null)
        : undefined,
      parserVersion: legacy.parserVersion ?? (typeof item.legacyData?.parserVersion === 'string' ? item.legacyData.parserVersion : undefined),
      reviewMetadata,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      extractionStatus: legacySourceStatus(item.status),
      extractionMethod: runsForVersion.some((run) => run.provider === 'deepseek')
        ? 'deepseek-v4-flash'
        : runsForVersion.length
          ? 'local-rules'
          : undefined,
      duplicateOfSourceIds: legacy.duplicateOfSourceIds ?? stringArray(item.legacyData?.duplicateOfSourceIds),
      duplicateReviewStatus: legacy.duplicateReviewStatus
        ?? (item.legacyData?.duplicateReviewStatus === '待核对' || item.legacyData?.duplicateReviewStatus === '保留为独立来源'
          ? item.legacyData.duplicateReviewStatus
          : undefined),
    }
  })

  const tasks: LegacyTask[] = workspace.tasks.map((item) => {
    const legacy = v7Record<LegacyTask>(item.legacyData)
    const sourceIds = sourceIdsForTask(item)
    const deadline = taskDeadline(workspace, item.id)
    return {
      id: item.id,
      projectId: item.projectId ?? undefined,
      parentTaskId: item.parentTaskId ?? undefined,
      hierarchyType: item.parentTaskId ? 'subtask' : legacy.hierarchyType ?? 'task',
      milestoneId: item.milestoneId ?? undefined,
      workPackageId: item.workPackageId ?? undefined,
      actionVerb: legacy.actionVerb ?? (typeof item.legacyData?.actionVerb === 'string' ? item.legacyData.actionVerb : undefined),
      actionObject: legacy.actionObject ?? (typeof item.legacyData?.actionObject === 'string' ? item.legacyData.actionObject : undefined),
      completionCriteria: legacy.completionCriteria ?? stringArray(item.legacyData?.completionCriteria),
      evidenceIds: legacy.evidenceIds ?? stringArray(item.legacyData?.evidenceIds),
      inferenceLevel: legacy.inferenceLevel,
      title: item.title,
      category: legacy.category ?? (item.legacyData?.category as LegacyTask['category'] | undefined) ?? '其他',
      status: legacyTaskStatus(item.status),
      deadline,
      estimatedMinutes: item.estimatedMinutes ?? 60,
      nextAction: item.nextAction ?? item.title,
      description: item.description ?? '',
      priority: legacyPriority(item.legacyData?.priority ?? item.legacyData?.prioritySuggestion ?? legacy.priority),
      riskFlags: legacy.riskFlags ?? (deadline ? [] : ['待确认']),
      materials: taskMaterials(workspace, item.id, sourceIds[0]),
      dependencies: legacy.dependencies ?? [],
      dependencyIds: item.dependencyIds,
      reminders: taskReminders(workspace, item.id),
      sourceIds,
      priorityReason: legacy.priorityReason ?? '由当前权威实体计算并允许手动调整',
      priorityReasons: legacy.priorityReasons,
      plannedStart: workspace.timePoints.find((point) => point.type === 'planned_start' && point.relatedTaskIds.includes(item.id))?.normalizedValue ?? undefined,
      completedAt: legacy.completedAt,
      manualPriority: item.manualPriority ?? undefined,
      computedPriorityScore: legacy.computedPriorityScore,
      pinnedUntil: legacy.pinnedUntil,
      snoozedUntil: item.snoozedUntil ?? undefined,
      timePointIds: workspace.timePoints.filter((point) => point.relatedTaskIds.includes(item.id)).map((point) => point.id),
      materialIds: workspace.materials.filter((material) => material.relatedTaskIds.includes(item.id)).map((material) => material.id),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      history: taskHistory(workspace, item.id),
    }
  })

  const drafts: LegacyDraft[] = workspace.extractionDrafts.map((item, attemptOrder) => {
    const run = workspace.recognitionRuns.find((candidate) => candidate.id === item.recognitionRunId)
    const version = run && workspace.sourceVersions.find((candidate) => candidate.id === run.sourceVersionId)
    const legacy = v7Record<LegacyDraft>(item.legacyData)
    const accepted = new Set(item.acceptedEntityTempIds)
    const rejected = new Set(item.rejectedEntityTempIds)
    const suggestions = item.result ? recognitionToLegacySuggestions(item.result) : []
    const recognizedTasks = item.result
      ? [
          ...item.result.standaloneTasks,
          ...item.result.milestones.flatMap((milestone) => [
            ...milestone.tasks,
            ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
          ]),
        ]
      : []
    const recognizedTasksById = new Map(recognizedTasks.map((task) => [task.tempId, task]))
    const legacyItems = legacy.items ?? []
    return {
      id: item.id,
      sourceId: version?.sourceId ?? legacy.sourceId ?? '',
      sourceVersionId: run?.sourceVersionId,
      sourceReviewMetadata: normalizeFocusedReviewSourceMetadata(version?.legacyData?.reviewMetadata),
      attemptOrder,
      status: legacyDraftStatus(item.status),
      workflowStatus: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      schemaVersion: item.result?.schemaVersion ?? run?.schemaVersion,
      modelName: item.result?.modelName ?? run?.modelName ?? undefined,
      promptVersion: item.result?.promptVersion ?? run?.promptVersion ?? undefined,
      recognitionResult: item.result ?? undefined,
      items: suggestions.length ? suggestions.map((suggestion) => {
        const previous = legacyItems.find((candidate) => candidate.suggestion.id === suggestion.id)
        const recognized = recognizedTasksById.get(suggestion.id)
        const selected = accepted.has(suggestion.id)
          ? true
          : rejected.has(suggestion.id)
            ? false
            : previous?.selected ?? recognized?.selected ?? recognized?.inferenceLevel === 'explicit'
        return {
          id: previous?.id ?? `draft-item:${item.id}:${suggestion.id}`,
          suggestion: previous?.suggestion ?? suggestion,
          selected,
          status: accepted.has(suggestion.id) ? '已确认' : rejected.has(suggestion.id) ? '已拒绝' : '待确认',
          updatedAt: previous?.updatedAt ?? item.updatedAt,
          history: previous?.history ?? [],
        }
      }) : legacyItems,
    }
  })

  const projects: LegacyProject[] = workspace.projects.map((item) => {
    const legacy = v7Record<LegacyProject>(item.legacyData)
    const projectTasks = tasks.filter((task) => task.projectId === item.id)
    return {
      id: item.id,
      title: item.title,
      category: item.category,
      sourceIds: legacy.sourceIds ?? (typeof item.legacyData?.sourceId === 'string' ? [item.legacyData.sourceId] : [...new Set(projectTasks.flatMap((task) => task.sourceIds))]),
      taskIds: projectTasks.map((task) => task.id),
      milestones: workspace.milestones.filter((milestone) => milestone.projectId === item.id).sort((a, b) => a.sortOrder - b.sortOrder).map((milestone) => {
        const old = v7Record<LegacyProject['milestones'][number]>(milestone.legacyData)
        const canonicalDuePoint = standaloneMilestoneDuePoint(workspace, milestone.id)
        const relatedFallback = workspace.timePoints.find((point) => point.milestoneId === milestone.id && point.normalizedValue)
        const dueAt = canonicalDuePoint
          ? canonicalDuePoint.normalizedValue ?? canonicalDuePoint.rawText
          : old.dueAt ?? relatedFallback?.normalizedValue ?? ''
        return {
          id: milestone.id,
          projectId: item.id,
          title: milestone.title,
          dueAt,
          status: milestone.status === 'completed' ? '已完成' : '待完成',
          objective: milestone.objective ?? undefined,
          order: milestone.sortOrder,
          evidenceIds: old.evidenceIds ?? [],
          workPackageIds: workspace.workPackages.filter((workPackage) => workPackage.milestoneId === milestone.id).map((workPackage) => workPackage.id),
          taskIds: projectTasks.filter((task) => task.milestoneId === milestone.id).map((task) => task.id),
          createdAt: milestone.createdAt,
        }
      }),
      status: item.status,
      objective: item.objective ?? undefined,
      keywords: legacy.keywords ?? [],
      currentMilestoneId: legacy.currentMilestoneId,
      evidenceIds: legacy.evidenceIds ?? [],
      description: legacy.description,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
  })

  const timePoints: LegacyTimePoint[] = workspace.timePoints.map((item) => ({
    id: item.id,
    taskId: item.taskId ?? undefined,
    projectId: item.projectId ?? undefined,
    type: item.type,
    value: item.normalizedValue,
    timezone: item.timezone ?? workspace.settings.defaultTimezone,
    isAllDay: item.isAllDay,
    originalText: item.rawText,
    precision: item.precision,
    relatedTaskIds: item.relatedTaskIds,
    relatedMaterialIds: item.relatedMaterialIds,
    confidence: typeof item.legacyData?.confidence === 'number' ? item.legacyData.confidence : undefined,
    needsConfirmation: item.needsConfirmation,
    evidenceIds: stringArray(item.legacyData?.evidenceIds),
  }))

  const materialItems: MaterialItemEntity[] = workspace.materials.map((item) => ({
    id: item.id,
    projectId: item.projectId ?? undefined,
    taskId: item.relatedTaskIds[0],
    name: item.name,
    required: item.required,
    status: item.status,
    formatRequirement: item.formatRequirements.join('；') || undefined,
    quantity: item.quantity ?? undefined,
    note: item.requirements.join('；') || undefined,
    deadline: item.deadlineTimePointId
      ? workspace.timePoints.find((point) => point.id === item.deadlineTimePointId)?.normalizedValue ?? undefined
      : undefined,
    evidenceIds: stringArray(item.legacyData?.evidenceIds),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }))

  const evidence = workspace.evidenceRefs.map((item) => ({
    id: item.id,
    sourceId: workspace.sourceVersions.find((version) => version.id === item.sourceVersionId)?.sourceId ?? '',
    page: item.page ?? undefined,
    textStart: item.textStart ?? undefined,
    textEnd: item.textEnd ?? undefined,
    quote: item.quotedText ?? '',
    quotedText: item.quotedText ?? undefined,
    boundingBox: item.bbox ?? undefined,
    field: (item.fieldPath && ['title', 'deadline', 'materials', 'description', 'project', 'milestone', 'event', 'requirement'].includes(item.fieldPath)
      ? item.fieldPath
      : 'description') as WorkspaceData['evidence'][number]['field'],
    extractionMethod: item.extractionMethod === 'migration' ? 'manual' as const : item.extractionMethod,
    confidence: item.confidence ?? undefined,
  }))

  const historyRecords: WorkspaceData['historyRecords'] = workspace.historyRecords.map((item) => ({
    id: item.id,
    entityType: item.entityType === 'extraction_draft' ? 'draft' : item.entityType === 'source_version' || item.entityType === 'recognition_run' || item.entityType === 'evidence' || item.entityType === 'change_proposal' ? 'source' : item.entityType,
    entityId: item.entityId,
    field: item.fieldName ?? item.action,
    before: item.before,
    after: item.after,
    actor: item.actor === 'user' ? 'user' : 'system',
    action: item.action,
    changedAt: item.changedAt,
  }))

  const reminderRecords: LegacyReminderRecord[] = workspace.reminderRecords.map((item) => ({
    id: item.id,
    taskId: item.taskId,
    channel: item.channel,
    scheduledAt: item.scheduledAt ?? '',
    enabled: item.status === 'scheduled',
    status: item.status,
    errorMessage: item.errorCode ?? undefined,
    sentAt: item.sentAt,
  }))

  const workPackages: LegacyWorkPackage[] = workspace.workPackages.map((item) => ({
    id: item.id,
    projectId: item.projectId,
    milestoneId: item.milestoneId,
    title: item.title,
    objective: item.objective ?? '',
    order: item.sortOrder,
    taskIds: tasks.filter((task) => task.workPackageId === item.id).map((task) => task.id),
    evidenceIds: stringArray(item.legacyData?.evidenceIds),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }))

  const events: LegacyEvent[] = workspace.events.map((item) => ({
    id: item.id,
    projectId: item.projectId ?? undefined,
    milestoneId: workspace.timePoints.find((point) => point.eventId === item.id)?.milestoneId ?? undefined,
    title: item.title,
    description: item.description ?? '',
    startAt: item.startTimePointId ? workspace.timePoints.find((point) => point.id === item.startTimePointId)?.normalizedValue ?? null : null,
    endAt: item.endTimePointId ? workspace.timePoints.find((point) => point.id === item.endTimePointId)?.normalizedValue ?? null : null,
    location: item.location ?? undefined,
    evidenceIds: stringArray(item.legacyData?.evidenceIds),
    needsConfirmation: [item.startTimePointId, item.endTimePointId].filter(Boolean).some((id) => workspace.timePoints.find((point) => point.id === id)?.needsConfirmation),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }))

  return {
    schemaVersion: 7,
    tasks,
    sources,
    drafts,
    projects,
    evidence,
    timePoints,
    materialItems,
    historyRecords,
    reminderRecords,
    workPackages,
    events,
    migrationLog: preferencesValue<MigrationRecord[]>(workspace, 'v7MigrationLog', []),
    recognitionFeedback: preferencesValue<RecognitionFeedbackRecord[]>(workspace, 'recognitionFeedback', []),
    legacyData: preferencesValue<Record<string, unknown>>(workspace, 'v7LegacyData', {}),
    courseBlocks: preferencesValue<CourseBlock[]>(workspace, 'courseBlocks', []),
    integrations: preferencesValue<IntegrationState>(workspace, 'integrations', createIntegrationState()),
    knowledgeSettings: preferencesValue<KnowledgeSettings>(workspace, 'knowledgeSettings', {}),
    savedAt: workspace.savedAt,
  }
}

function sameLegacyViewValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(legacyJsonValue(left)) === JSON.stringify(legacyJsonValue(right))
}

function withLegacyRecord(current: LegacyData | undefined, value: unknown, baseline?: unknown): LegacyData {
  const nextRecord = record(legacyJsonValue(value))
  const currentRecord = record(current?.v7Record)
  const baselineRecord = baseline === undefined ? null : record(legacyJsonValue(baseline))
  if (!nextRecord || !currentRecord || !baselineRecord) {
    return { ...(current ?? {}), v7Record: legacyJsonValue(value) }
  }

  const merged = { ...currentRecord } as Record<string, JsonValue>
  Object.entries(nextRecord).forEach(([key, nextValue]) => {
    if (!sameLegacyViewValue(nextValue, baselineRecord[key])) merged[key] = nextValue as JsonValue
  })
  return { ...(current ?? {}), v7Record: merged }
}

function legacyJsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) return value.map(legacyJsonValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, legacyJsonValue(item)]))
  }
  return null
}

function historyJsonValue(value: unknown): JsonValue {
  if (value === undefined) return null
  try {
    const serialized = JSON.stringify(value)
    return serialized === undefined ? null : JSON.parse(serialized) as JsonValue
  } catch {
    return String(value)
  }
}

function canonicalHistoryEntityType(
  type: WorkspaceData['historyRecords'][number]['entityType'],
): WorkspaceV8['historyRecords'][number]['entityType'] {
  if (type === 'subtask') return 'task'
  if (type === 'draft') return 'extraction_draft'
  return type
}

function validReminderSentAt(value: string | null | undefined): string | null {
  return value && !Number.isNaN(new Date(value).getTime()) ? value : null
}

function mergedReminderDelivery(
  edited: WorkspaceData['reminderRecords'][number],
  current?: WorkspaceV8['reminderRecords'][number],
): Pick<WorkspaceV8['reminderRecords'][number], 'status' | 'errorCode' | 'sentAt' | 'needsReview'> {
  const sentAt = edited.sentAt === undefined
    ? current?.sentAt ?? null
    : validReminderSentAt(edited.sentAt)
  const sentWithoutEvidence = edited.status === 'sent' && !sentAt
  const status = sentWithoutEvidence ? 'failed' : edited.status
  const errorCode = sentWithoutEvidence
    ? 'LEGACY_SENT_AT_MISSING'
    : edited.errorMessage ?? (current?.status === status ? current.errorCode : null)
  return {
    status,
    errorCode,
    sentAt,
    needsReview: Boolean(current?.needsReview || sentWithoutEvidence),
  }
}

/**
 * Explicitly applies edits made by legacy screens. Independent v8 collections
 * are updated by stable ID and are never regenerated from Task/Draft projections.
 */
export function mergeLegacyViewIntoWorkspaceV8(workspace: WorkspaceV8, view: WorkspaceData): WorkspaceV8 {
  const baselineView = workspaceV8ToLegacyView(workspace)
  if (sameLegacyViewValue(view, baselineView)) return workspace
  const tasksById = new Map(view.tasks.map((item) => [item.id, item]))
  const sourcesById = new Map(view.sources.map((item) => [item.id, item]))
  const draftsById = new Map(view.drafts.map((item) => [item.id, item]))
  const projectsById = new Map(view.projects.map((item) => [item.id, item]))
  const materialsById = new Map(view.materialItems.map((item) => [item.id, item]))
  const remindersById = new Map(view.reminderRecords.map((item) => [item.id, item]))
  const baselineTasksById = new Map(baselineView.tasks.map((item) => [item.id, item]))
  const baselineSourcesById = new Map(baselineView.sources.map((item) => [item.id, item]))
  const baselineDraftsById = new Map(baselineView.drafts.map((item) => [item.id, item]))
  const baselineProjectsById = new Map(baselineView.projects.map((item) => [item.id, item]))
  const baselineMaterialsById = new Map(baselineView.materialItems.map((item) => [item.id, item]))
  const baselineRemindersById = new Map(baselineView.reminderRecords.map((item) => [item.id, item]))
  const now = view.savedAt

  const milestonesById = new Map<string, {
    milestone: WorkspaceData['projects'][number]['milestones'][number]
    project: WorkspaceData['projects'][number]
    index: number
  }>()
  view.projects.forEach((project) => project.milestones.forEach((milestone, index) => {
    if (!milestonesById.has(milestone.id)) milestonesById.set(milestone.id, { milestone, project, index })
  }))
  const baselineMilestonesById = new Map(baselineView.projects.flatMap((project) => project.milestones).map((item) => [item.id, item]))

  const canonicalMilestoneIds = new Set(workspace.milestones.map((item) => item.id))
  const addedMilestones: WorkspaceV8['milestones'] = [...milestonesById.values()]
    .filter(({ milestone }) => !canonicalMilestoneIds.has(milestone.id))
    .map(({ milestone, project, index }) => ({
      id: milestone.id,
      projectId: project.id,
      title: milestone.title,
      objective: milestone.objective ?? null,
      sortOrder: milestone.order ?? index + 1,
      status: milestone.status === '已完成' ? 'completed' : 'active',
      createdAt: milestone.createdAt,
      updatedAt: project.updatedAt || now,
      legacyData: withLegacyRecord(undefined, milestone),
    }))

  const canonicalReminderIds = new Set(workspace.reminderRecords.map((item) => item.id))
  const addedReminders: WorkspaceV8['reminderRecords'] = [...remindersById.values()]
    .filter((item) => !canonicalReminderIds.has(item.id))
    .map((item) => {
      const delivery = mergedReminderDelivery(item)
      return {
        id: item.id,
        taskId: item.taskId,
        channel: item.channel,
        scheduledAt: item.scheduledAt || null,
        ...delivery,
        legacyData: withLegacyRecord(undefined, item),
      }
    })

  const persistedMilestoneIds = new Set([
    ...workspace.milestones.map((item) => item.id),
    ...addedMilestones.map((item) => item.id),
  ])
  const dueEntryByPointId = new Map<string, (typeof milestonesById extends Map<string, infer T> ? T : never)>()
  const addedMilestoneDuePoints: WorkspaceV8['timePoints'] = []
  milestonesById.forEach((entry) => {
    if (!persistedMilestoneIds.has(entry.milestone.id)) return
    const existing = standaloneMilestoneDuePoint(workspace, entry.milestone.id)
    const canonicalMilestone = workspace.milestones.find((item) => item.id === entry.milestone.id)
    const legacyDueAt = canonicalMilestone
      ? v7Record<LegacyProject['milestones'][number]>(canonicalMilestone.legacyData).dueAt
      : undefined
    const relatedFallback = workspace.timePoints.find((point) => point.milestoneId === entry.milestone.id && point.normalizedValue)?.normalizedValue ?? ''
    const shouldPersist = Boolean(existing)
      || !canonicalMilestone
      || legacyDueAt !== undefined
      || entry.milestone.dueAt !== relatedFallback
    if (!shouldPersist) return
    const fields = milestoneDueTimeFields(entry.milestone.dueAt, workspace.settings.defaultTimezone)
    if (existing) {
      dueEntryByPointId.set(existing.id, entry)
      return
    }
    addedMilestoneDuePoints.push({
      id: milestoneDuePointId(entry.milestone.id),
      projectId: entry.project.id,
      milestoneId: entry.milestone.id,
      taskId: null,
      materialId: null,
      eventId: null,
      relatedTaskIds: [],
      relatedMaterialIds: [],
      type: 'task_deadline',
      rawText: entry.milestone.dueAt,
      ...fields,
      createdAt: entry.milestone.createdAt,
      updatedAt: now,
      legacyData: { legacyMilestoneDueAt: true },
    })
  })

  const canonicalHistoryIds = new Set(workspace.historyRecords.map((item) => item.id))
  const addedHistoryRecords: WorkspaceV8['historyRecords'] = []
  const addedHistoryIds = new Set<string>()
  view.historyRecords.forEach((item) => {
    if (canonicalHistoryIds.has(item.id) || addedHistoryIds.has(item.id)) return
    const entityType = canonicalHistoryEntityType(item.entityType)
    let entityId = item.entityId
    if (entityType === 'extraction_draft' && !workspace.extractionDrafts.some((draft) => draft.id === entityId)) {
      entityId = view.drafts.find((draft) => draft.items.some((draftItem) => draftItem.id === item.entityId))?.id ?? entityId
    }
    addedHistoryIds.add(item.id)
    addedHistoryRecords.push({
      id: item.id,
      entityType,
      entityId,
      action: item.action,
      fieldName: item.field || null,
      before: historyJsonValue(item.before),
      after: historyJsonValue(item.after),
      actor: item.actor,
      reason: null,
      sourceVersionId: null,
      changedAt: item.changedAt,
      needsReview: entityId !== item.entityId,
      legacyData: withLegacyRecord(undefined, {
        ...item,
        originalEntityId: entityId !== item.entityId ? item.entityId : null,
      }),
    })
  })

  const next: WorkspaceV8 = {
    ...workspace,
    tasks: workspace.tasks.map((item) => {
      const edited = tasksById.get(item.id)
      if (!edited) return item
      const baseline = baselineTasksById.get(item.id)
      if (baseline && sameLegacyViewValue(edited, baseline)) return item
      return {
        ...item,
        title: edited.title,
        description: edited.description || null,
        nextAction: edited.nextAction || null,
        status: edited.status === '已完成' ? 'completed' : edited.status === '进行中' ? 'in_progress' : 'todo',
        estimatedMinutes: edited.estimatedMinutes,
        manualPriority: edited.manualPriority ?? null,
        snoozedUntil: edited.snoozedUntil ?? null,
        dependencyIds: edited.dependencyIds ?? [],
        updatedAt: edited.updatedAt,
        version: item.version + (edited.updatedAt !== item.updatedAt ? 1 : 0),
        legacyData: withLegacyRecord(item.legacyData, edited, baseline),
      }
    }),
    sources: workspace.sources.map((item) => {
      const edited = sourcesById.get(item.id)
      const baseline = baselineSourcesById.get(item.id)
      return edited && !(baseline && sameLegacyViewValue(edited, baseline))
        ? { ...item, title: edited.title, status: edited.status ?? item.status, updatedAt: edited.updatedAt ?? item.updatedAt, legacyData: withLegacyRecord(item.legacyData, edited, baseline) }
        : item
    }),
    sourceVersions: workspace.sourceVersions.map((item) => {
      const source = sourcesById.get(item.sourceId)
      const baseline = baselineSourcesById.get(item.sourceId)
      const canonicalSource = workspace.sources.find((candidate) => candidate.id === item.sourceId)
      if (!source || canonicalSource?.currentVersionId !== item.id || (baseline && sameLegacyViewValue(source, baseline))) return item
      const rawText = source.rawText ?? source.content ?? item.rawText
      return {
        ...item,
        rawText,
        contentHash: rawText !== item.rawText ? workspaceSnapshotHash(rawText) : item.contentHash,
        legacyData: withLegacyRecord(item.legacyData, source, baseline),
      }
    }),
    extractionDrafts: workspace.extractionDrafts.map((item) => {
      const edited = draftsById.get(item.id)
      if (!edited) return item
      const baseline = baselineDraftsById.get(item.id)
      if (baseline && sameLegacyViewValue(edited, baseline)) return item
      const accepted = edited.items.filter((candidate) => candidate.status === '已确认').map((candidate) => candidate.suggestion.id)
      const rejected = edited.items.filter((candidate) => candidate.status === '已拒绝').map((candidate) => candidate.suggestion.id)
      const status = edited.workflowStatus
        ?? (edited.status === '已确认' ? 'confirmed' : edited.status === '部分确认' ? 'partially_confirmed' : edited.status === '已拒绝' ? 'rejected' : item.status)
      return {
        ...item,
        status,
        result: edited.recognitionResult ?? item.result,
        acceptedEntityTempIds: [...new Set([...item.acceptedEntityTempIds, ...accepted])],
        rejectedEntityTempIds: [...new Set([...item.rejectedEntityTempIds, ...rejected])],
        updatedAt: edited.updatedAt,
        legacyData: withLegacyRecord(item.legacyData, edited, baseline),
      }
    }),
    projects: workspace.projects.map((item) => {
      const edited = projectsById.get(item.id)
      const baseline = baselineProjectsById.get(item.id)
      return edited && !(baseline && sameLegacyViewValue(edited, baseline))
        ? { ...item, title: edited.title, category: edited.category, objective: edited.objective ?? null, status: edited.status ?? item.status, updatedAt: edited.updatedAt, version: item.version + (edited.updatedAt !== item.updatedAt ? 1 : 0), legacyData: withLegacyRecord(item.legacyData, edited, baseline) }
        : item
    }),
    milestones: [
      ...workspace.milestones.map((item) => {
        const entry = milestonesById.get(item.id)
        const edited = entry?.project.id === item.projectId ? entry.milestone : undefined
        const baseline = baselineMilestonesById.get(item.id)
        if (edited && baseline && sameLegacyViewValue(edited, baseline)) return item
        return edited ? {
          ...item,
          title: edited.title,
          objective: edited.objective ?? null,
          sortOrder: edited.order ?? item.sortOrder,
          status: edited.status === '已完成' ? 'completed' as const : 'active' as const,
          legacyData: withLegacyRecord(item.legacyData, edited, baseline),
        } : item
      }),
      ...addedMilestones,
    ],
    materials: workspace.materials.map((item) => {
      const edited = materialsById.get(item.id) ?? view.tasks.flatMap((task) => task.materials).find((material) => material.id === item.id)
      if (!edited) return item
      const baseline = baselineMaterialsById.get(item.id) ?? baselineView.tasks.flatMap((task) => task.materials).find((material) => material.id === item.id)
      if (baseline && sameLegacyViewValue(edited, baseline)) return item
      return { ...item, name: edited.name, status: edited.status ?? ('done' in edited && edited.done ? 'ready' : item.status), updatedAt: 'updatedAt' in edited ? edited.updatedAt : now, version: item.version + 1, legacyData: withLegacyRecord(item.legacyData, edited, baseline) }
    }),
    timePoints: [
      ...workspace.timePoints.map((item) => {
        const dueEntry = dueEntryByPointId.get(item.id)
        if (dueEntry) {
          const fields = milestoneDueTimeFields(dueEntry.milestone.dueAt, workspace.settings.defaultTimezone)
          const unchanged = item.projectId === dueEntry.project.id
            && item.milestoneId === dueEntry.milestone.id
            && item.taskId === null
            && item.materialId === null
            && item.eventId === null
            && item.rawText === dueEntry.milestone.dueAt
            && item.normalizedValue === fields.normalizedValue
            && item.timezone === fields.timezone
            && item.isAllDay === fields.isAllDay
            && item.precision === fields.precision
            && item.needsConfirmation === fields.needsConfirmation
          if (unchanged) return item
          return {
            ...item,
            projectId: dueEntry.project.id,
            milestoneId: dueEntry.milestone.id,
            taskId: null,
            materialId: null,
            eventId: null,
            relatedTaskIds: [],
            relatedMaterialIds: [],
            rawText: dueEntry.milestone.dueAt,
            ...fields,
            updatedAt: now,
            legacyData: { ...(item.legacyData ?? {}), legacyMilestoneDueAt: true },
          }
        }
        const relatedTaskId = item.taskId ?? item.relatedTaskIds[0]
        const canonicalTask = relatedTaskId ? workspace.tasks.find((task) => task.id === relatedTaskId) : undefined
        const editedTask = relatedTaskId ? tasksById.get(relatedTaskId) : undefined
        const preferred = relatedTaskId ? preferredTaskDeadlinePoint(workspace, relatedTaskId) : undefined
        if (!canonicalTask || !editedTask || preferred?.id !== item.id || editedTask.updatedAt === canonicalTask.updatedAt || !editedTask.deadline || editedTask.deadline === item.normalizedValue) return item
        const dateOnly = /^\d{4}-\d{2}-\d{2}$/u.test(editedTask.deadline)
        return {
          ...item,
          normalizedValue: editedTask.deadline,
          timezone: dateOnly ? null : item.timezone || workspace.settings.defaultTimezone,
          isAllDay: dateOnly,
          precision: dateOnly ? 'date_only' as const : 'exact' as const,
          needsConfirmation: false,
          rawText: editedTask.deadline,
          updatedAt: now,
          legacyData: withLegacyRecord(item.legacyData, { editedFromLegacyTaskId: editedTask.id }),
        }
      }),
      ...addedMilestoneDuePoints,
    ],
    reminderRecords: [
      ...workspace.reminderRecords.map((item) => {
        const edited = remindersById.get(item.id)
        if (!edited) return item
        const baseline = baselineRemindersById.get(item.id)
        if (baseline && sameLegacyViewValue(edited, baseline)) return item
        return {
          ...item,
          scheduledAt: edited.scheduledAt || null,
          ...mergedReminderDelivery(edited, item),
          legacyData: withLegacyRecord(item.legacyData, edited, baseline),
        }
      }),
      ...addedReminders,
    ],
    historyRecords: [...workspace.historyRecords, ...addedHistoryRecords],
    preferences: {
      ...workspace.preferences,
      legacyData: {
        ...(workspace.preferences.legacyData ?? {}),
        courseBlocks: view.courseBlocks as unknown as JsonValue,
        integrations: view.integrations as unknown as JsonValue,
        knowledgeSettings: view.knowledgeSettings as unknown as JsonValue,
        recognitionFeedback: view.recognitionFeedback as unknown as JsonValue,
        v7MigrationLog: view.migrationLog as unknown as JsonValue,
        v7LegacyData: view.legacyData as unknown as JsonValue,
      },
    },
    savedAt: now,
    workspace: { ...workspace.workspace, updatedAt: now },
  }
  return next
}
