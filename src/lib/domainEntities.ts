import type {
  CanonicalDraftStatus,
  CanonicalSourceStatus,
  EvidenceReference,
  ExtractionDraft,
  HistoryRecord,
  MaterialItemEntity,
  Project,
  ReminderRecord,
  Source,
  Task,
  TimePoint,
  MaterialStatus,
  ReminderDeliveryStatus,
} from '../types'

export function materialStatusFromLegacy(done: boolean, status?: MaterialStatus): MaterialStatus {
  return status ?? (done ? 'ready' : 'missing')
}

export function isMaterialSatisfied(done: boolean, status?: MaterialStatus): boolean {
  return ['ready', 'submitted', 'verified', 'not_required'].includes(materialStatusFromLegacy(done, status))
}

function sourceStatus(source: Source): CanonicalSourceStatus {
  if (source.status) return source.status
  const statuses: Record<Source['extractionStatus'], CanonicalSourceStatus> = {
    已识别: 'needs_review',
    待确认: 'needs_review',
    部分确认: 'partially_confirmed',
    已确认: 'confirmed',
    已拒绝: 'archived',
  }
  return statuses[source.extractionStatus]
}

function draftStatus(draft: ExtractionDraft): CanonicalDraftStatus {
  if (draft.workflowStatus) return draft.workflowStatus
  const statuses: Record<ExtractionDraft['status'], CanonicalDraftStatus> = {
    待确认: 'needs_review',
    部分确认: 'partially_confirmed',
    已确认: 'confirmed',
    已拒绝: 'rejected',
  }
  return statuses[draft.status]
}

function evidenceMethod(source: Source | undefined): NonNullable<EvidenceReference['extractionMethod']> {
  if (source?.extractionMethod?.startsWith('deepseek-v4-flash')) return 'ai'
  return source?.type === 'text' ? 'manual' : 'parser'
}

function confidenceNumber(value: '高' | '中' | '低'): number {
  return value === '高' ? 0.9 : value === '中' ? 0.65 : 0.35
}

function validReminderSentAt(value: string | null | undefined): string | null {
  return value && !Number.isNaN(new Date(value).getTime()) ? value : null
}

function legacyReminderStatus(reminder: Task['reminders'][number]): {
  status: ReminderDeliveryStatus
  errorMessage: string | undefined
  sentAt: string | null
} {
  const sentAt = validReminderSentAt(reminder.sentAt)
  if (reminder.status === 'sent' && !sentAt) {
    return { status: 'failed', errorMessage: reminder.errorMessage ?? 'LEGACY_SENT_AT_MISSING', sentAt: null }
  }
  const status = reminder.status
    ?? (reminder.channel === 'wechat-placeholder'
      ? 'unsupported'
      : reminder.channel === 'email'
        ? 'draft'
        : reminder.enabled
          ? 'scheduled'
          : 'draft')
  return { status, errorMessage: reminder.errorMessage, sentAt }
}

export interface MaterializedWorkspaceEntities {
  tasks: Task[]
  sources: Source[]
  drafts: ExtractionDraft[]
  projects: Project[]
  evidence: EvidenceReference[]
  timePoints: TimePoint[]
  materialItems: MaterialItemEntity[]
  historyRecords: HistoryRecord[]
  reminderRecords: ReminderRecord[]
}

/**
 * @deprecated Legacy schema v7 compatibility projection. It must never be
 * used to rebuild or overwrite canonical Workspace v8 entity arrays.
 */
export function materializeWorkspaceEntities(
  tasks: Task[],
  sources: Source[],
  drafts: ExtractionDraft[],
  projects: Project[],
): MaterializedWorkspaceEntities {
  const taskIds = new Set(tasks.map((task) => task.id))
  const sourceById = new Map(sources.map((source) => [source.id, source]))
  const normalizedSources = sources.map((source): Source => ({
    ...source,
    rawText: source.rawText ?? source.content,
    status: sourceStatus(source),
    updatedAt: source.updatedAt ?? source.createdAt,
  }))
  const normalizedDrafts = drafts.map((draft): ExtractionDraft => {
    const source = sourceById.get(draft.sourceId)
    return {
      ...draft,
      workflowStatus: draftStatus(draft),
      modelVersion: draft.modelVersion ?? (source?.extractionMethod?.startsWith('deepseek-v4-flash') ? source.extractionMethod : 'local-rules'),
      promptVersion: draft.promptVersion ?? 'extraction-v1',
    }
  })
  const normalizedProjects = projects.map((project): Project => ({
    ...project,
    status: project.status ?? (project.taskIds.length > 0 && project.taskIds.every((taskId) => tasks.find((task) => task.id === taskId)?.status === '已完成') ? 'completed' : 'active'),
  }))

  const evidence = normalizedDrafts.flatMap((draft) => {
    const source = sourceById.get(draft.sourceId)
    return draft.items.flatMap((item, itemIndex) => {
      const refs = item.suggestion.evidenceRefs?.length
        ? item.suggestion.evidenceRefs
        : [{
            id: `evidence-${draft.id}-${itemIndex}`,
            sourceId: draft.sourceId,
            quote: item.suggestion.evidence,
            field: 'description' as const,
          }]
      return refs.map((reference): EvidenceReference => ({
        ...reference,
        quote: reference.quote || item.suggestion.evidence,
        quotedText: reference.quotedText ?? reference.quote ?? item.suggestion.evidence,
        extractionMethod: reference.extractionMethod ?? evidenceMethod(source),
        confidence: reference.confidence ?? confidenceNumber(item.suggestion.confidence),
      }))
    })
  })
  const uniqueEvidence = [...new Map(evidence.map((item) => [item.id, item])).values()]
  const evidenceBySource = new Map<string, EvidenceReference[]>()
  uniqueEvidence.forEach((item) => evidenceBySource.set(item.sourceId, [...(evidenceBySource.get(item.sourceId) ?? []), item]))

  const normalizedTasks = tasks.map((task): Task => ({
    ...task,
    completedAt: task.completedAt ?? (task.status === '已完成' ? task.updatedAt : undefined),
    priorityReasons: task.priorityReasons?.length ? task.priorityReasons : [task.priorityReason].filter(Boolean),
    dependencyIds: task.dependencyIds ?? task.dependencies.filter((dependency) => taskIds.has(dependency)),
    timePointIds: task.timePointIds?.length ? task.timePointIds : [`timepoint-${task.id}-deadline`],
    materialIds: task.materialIds?.length ? task.materialIds : task.materials.map((material) => material.id),
  }))

  const timePoints = normalizedTasks.map((task): TimePoint => {
    const sourceEvidence = task.sourceIds.flatMap((sourceId) => evidenceBySource.get(sourceId) ?? [])
    const deadlineEvidence = sourceEvidence.filter((item) => item.field === 'deadline')
    return {
      id: task.timePointIds?.[0] ?? `timepoint-${task.id}-deadline`,
      taskId: task.id,
      projectId: task.projectId,
      type: 'deadline',
      value: Number.isNaN(new Date(task.deadline).getTime()) ? null : task.deadline,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
      isAllDay: false,
      originalText: deadlineEvidence[0]?.quotedText ?? deadlineEvidence[0]?.quote,
      confidence: task.riskFlags.includes('待确认') ? 0.4 : 0.9,
      needsConfirmation: task.riskFlags.includes('待确认') || Number.isNaN(new Date(task.deadline).getTime()),
      evidenceIds: (deadlineEvidence.length ? deadlineEvidence : sourceEvidence.slice(0, 1)).map((item) => item.id),
    }
  })

  const materialItems = normalizedTasks.flatMap((task) => task.materials.map((material): MaterialItemEntity => ({
    id: material.id,
    taskId: task.id,
    projectId: material.projectId ?? task.projectId,
    name: material.name,
    required: true,
    status: materialStatusFromLegacy(material.done, material.status),
    deadline: task.deadline,
    evidenceIds: task.sourceIds.flatMap((sourceId) => (evidenceBySource.get(sourceId) ?? [])
      .filter((item) => item.field === 'materials' || (item.quotedText ?? item.quote).includes(material.name))
      .map((item) => item.id)),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  })))

  const taskHistoryRecords = normalizedTasks.flatMap((task) => task.history.map((entry): HistoryRecord => ({
    id: entry.id,
    entityType: entry.entityType ?? 'task',
    entityId: entry.entityId ?? task.id,
    field: entry.field,
    before: entry.before,
    after: entry.after,
    actor: entry.actor,
    action: entry.action ?? (entry.field === '任务' ? 'confirmed' : 'updated'),
    changedAt: entry.changedAt,
  })))
  const draftHistoryRecords = normalizedDrafts.flatMap((draft) => draft.items.flatMap((item) =>
    (item.history ?? []).map((entry): HistoryRecord => ({
      id: entry.id,
      entityType: 'draft',
      entityId: entry.entityId ?? item.id,
      field: entry.field,
      before: entry.before,
      after: entry.after,
      actor: entry.actor,
      action: entry.action ?? 'updated',
      changedAt: entry.changedAt,
    }))))
  const historyRecords = [...taskHistoryRecords, ...draftHistoryRecords]

  const reminderRecords = normalizedTasks.flatMap((task) => task.reminders.map((reminder): ReminderRecord => {
    const delivery = legacyReminderStatus(reminder)
    return {
      id: reminder.id,
      taskId: task.id,
      channel: reminder.channel,
      scheduledAt: reminder.scheduledAt,
      enabled: reminder.enabled,
      status: delivery.status,
      errorMessage: delivery.errorMessage,
      sentAt: delivery.sentAt,
    }
  }))

  return {
    tasks: normalizedTasks,
    sources: normalizedSources,
    drafts: normalizedDrafts,
    projects: normalizedProjects,
    evidence: uniqueEvidence,
    timePoints,
    materialItems,
    historyRecords,
    reminderRecords,
  }
}
