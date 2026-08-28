import type { DraftItem, ParsedSuggestion } from '../../types'
import type { RecognitionResult, TaskSuggestionV2 } from '../../recognition/types'
import { workspaceSnapshotHash } from './migration'
import type { CanonicalWorkspaceRepository } from './repository'
import type {
  EvidenceRef, HistoryEntityType, HistoryRecord, JsonValue, Material, Milestone, Project, Task,
  TimePoint, WorkspaceV8, WorkPackage, Event,
} from './types'
import { validateWorkspaceV8 } from './validators/workspaceValidator'

export interface DomainCommitSelection {
  taskTempIds: string[]
  materialTempIds: string[]
  timePointTempIds: string[]
  eventTempIds: string[]
  rejectedTempIds?: string[]
  taskOverrides?: Record<string, Partial<ParsedSuggestion>>
}

export interface DomainCommitPlan {
  operationId: string
  draftRevisionHash: string
  draftId: string
  recognitionRunId: string
  sourceVersionId: string
  sourceId: string
  acceptedEntityTempIds: string[]
  rejectedEntityTempIds: string[]
  create: {
    projects: Project[]
    milestones: Milestone[]
    workPackages: WorkPackage[]
    tasks: Task[]
    materials: Material[]
    timePoints: TimePoint[]
    events: Event[]
    evidenceRefs: EvidenceRef[]
    historyRecords: HistoryRecord[]
  }
}

function jsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) return value.map(jsonValue)
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item)]))
  return null
}

function entityId(kind: string, draftId: string, tempId: string): string {
  return `${kind}:${draftId}:${tempId}`
}

function allRecognitionTasks(result: RecognitionResult): Array<TaskSuggestionV2 & { milestoneTempId: string | null; workPackageTempId: string | null }> {
  return [
    ...result.standaloneTasks.map((task) => ({ ...task, milestoneTempId: null, workPackageTempId: null })),
    ...result.milestones.flatMap((milestone) => [
      ...milestone.tasks.map((task) => ({ ...task, milestoneTempId: milestone.tempId, workPackageTempId: null })),
      ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks.map((task) => ({
        ...task, milestoneTempId: milestone.tempId, workPackageTempId: workPackage.tempId,
      }))),
    ]),
  ]
}

function rawRecognitionTasks(result: RecognitionResult): TaskSuggestionV2[] {
  return [
    ...result.standaloneTasks,
    ...result.milestones.flatMap((milestone) => [
      ...milestone.tasks,
      ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
    ]),
  ]
}

function normalizedMaterialName(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN')
}

function manualMaterialTempId(name: string): string {
  return `manual-material:${workspaceSnapshotHash({ name: normalizedMaterialName(name) })}`
}

function splitEntityTempId(kind: 'material' | 'time', sourceTempId: string, splitTaskTempId: string): string {
  return `split-${kind}:${workspaceSnapshotHash({ sourceTempId, splitTaskTempId })}`
}

function recognitionDraftRevisionHash(
  draft: Pick<WorkspaceV8['extractionDrafts'][number], 'recognitionRunId' | 'result' | 'acceptedEntityTempIds' | 'rejectedEntityTempIds'>,
): string {
  return workspaceSnapshotHash({
    recognitionRunId: draft.recognitionRunId,
    result: draft.result,
    acceptedEntityTempIds: [...draft.acceptedEntityTempIds].sort(),
    rejectedEntityTempIds: [...draft.rejectedEntityTempIds].sort(),
  })
}

/**
 * Converts a user-authored manual task into a rich draft result without
 * bypassing the normal confirmation and DomainCommitPlan path.
 */
export function recognitionResultFromManualSuggestion(
  result: RecognitionResult,
  suggestion: ParsedSuggestion,
): RecognitionResult {
  const taskTempId = suggestion.id.slice(0, 100)
  const evidenceIds = result.evidence.slice(0, 20).map((item) => item.id)
  const actionMatch = suggestion.nextAction.trim().match(/^(提交|上传|填写|完成|准备|核对|确认|联系|参加|阅读|下载|打印|盖章|签字|回复|领取|整理|撰写|制作|报名)/u)
  const actionVerb = actionMatch?.[1] ?? '完成'
  const actionObject = (actionMatch
    ? suggestion.nextAction.trim().slice(actionVerb.length).trim()
    : suggestion.nextAction.trim()) || suggestion.title.trim()
  const materialSuggestions = suggestion.materials.map((name, index) => ({
    tempId: `${taskTempId.slice(0, 72)}:material:${index + 1}`,
    name: name.trim(), required: true, formatRequirements: [], namingRequirements: [], quantity: 1,
    submissionChannel: null, relatedTaskTempIds: [taskTempId], evidenceIds, confidence: 1, selected: true,
  }))
  const deadlineTempId = `${taskTempId.slice(0, 78)}:deadline`
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/u.test(suggestion.deadline)
  const timezone = result.timePoints[0]?.timezone || 'Asia/Shanghai'
  const prioritySuggestion = suggestion.priority === '高' ? 'high' as const
    : suggestion.priority === '低' ? 'low' as const
      : 'medium' as const
  return {
    ...result,
    modelName: 'manual-entry',
    sourceSummary: {
      ...result.sourceSummary,
      title: suggestion.title,
      summary: suggestion.evidence.slice(0, 800),
      requiresAction: true,
      actionReason: '用户手动录入，确认后创建正式任务',
    },
    projectMatch: {
      decision: 'standalone_task', matchedProjectId: null, suggestedProjectTitle: null,
      confidence: 1, reasons: ['用户手动录入为独立事项'],
    },
    projectSuggestion: {
      title: { value: suggestion.title, evidenceIds, confidence: 1, inferenceLevel: 'explicit' },
      category: { value: suggestion.category, evidenceIds, confidence: 1, inferenceLevel: 'explicit' },
      objective: { value: suggestion.nextAction, evidenceIds, confidence: 1, inferenceLevel: 'explicit' },
      description: { value: suggestion.description, evidenceIds, confidence: 1, inferenceLevel: 'explicit' },
    },
    milestones: [],
    standaloneTasks: [{
      tempId: taskTempId, parentTempId: null, hierarchyType: 'task', title: suggestion.title,
      actionVerb, actionObject, description: suggestion.description,
      completionCriteria: [suggestion.nextAction], estimatedMinutes: suggestion.estimatedMinutes,
      statusSuggestion: 'todo', prioritySuggestion, dependencyTempIds: [],
      materialTempIds: materialSuggestions.map((item) => item.tempId), timePointTempIds: [deadlineTempId],
      evidenceIds, confidence: 1, inferenceLevel: 'explicit', userConfirmationRequired: true, selected: true,
    }],
    materials: materialSuggestions,
    timePoints: [{
      tempId: deadlineTempId, type: 'task_deadline', rawText: suggestion.deadline,
      normalizedValue: suggestion.deadline, timezone, isAllDay: isDateOnly,
      precision: isDateOnly ? 'date_only' : 'exact', needsConfirmation: false,
      relatedTaskTempIds: [taskTempId], relatedMaterialTempIds: materialSuggestions.map((item) => item.tempId),
      evidenceIds, confidence: 1, selected: true,
    }],
    events: [],
    conflicts: [],
    ambiguities: [],
    quality: {
      ...result.quality,
      overallConfidence: 1, hierarchyConfidence: 1, dateConfidence: 1,
      evidenceCoverage: evidenceIds.length ? 1 : 0, needsHumanReview: true,
      reviewReasons: ['手动录入仍需用户确认'],
    },
  }
}

/** Keeps a UI split inside the canonical draft result so it survives reload. */
export function splitRecognitionTask(
  result: RecognitionResult,
  sourceTaskTempId: string,
  splitTaskTempId: string,
  splitTitle: string,
): RecognitionResult {
  const recognitionTasks = rawRecognitionTasks(result)
  if (recognitionTasks.some((item) => item.tempId === splitTaskTempId)) {
    throw new Error('DOMAIN_SPLIT_TASK_ID_CONFLICT')
  }
  const sourceTask = recognitionTasks.find((item) => item.tempId === sourceTaskTempId)
  if (!sourceTask) throw new Error('DOMAIN_SPLIT_SOURCE_TASK_MISSING')
  const sourceMaterialIds = new Set([
    ...sourceTask.materialTempIds,
    ...result.materials.filter((item) => item.relatedTaskTempIds.includes(sourceTaskTempId)).map((item) => item.tempId),
  ])
  const materialTempIds = new Map([...sourceMaterialIds].map((tempId) => [
    tempId,
    splitEntityTempId('material', tempId, splitTaskTempId),
  ]))
  const sourceTimePointIds = new Set([
    ...sourceTask.timePointTempIds,
    ...result.timePoints.filter((item) => item.relatedTaskTempIds.includes(sourceTaskTempId)).map((item) => item.tempId),
  ])
  const timePointTempIds = new Map([...sourceTimePointIds].map((tempId) => [
    tempId,
    splitEntityTempId('time', tempId, splitTaskTempId),
  ]))
  const splitTask: TaskSuggestionV2 = {
    ...sourceTask,
    tempId: splitTaskTempId,
    title: splitTitle,
    actionObject: splitTitle,
    completionCriteria: [splitTitle],
    materialTempIds: [...materialTempIds.values()],
    timePointTempIds: [...timePointTempIds.values()],
    selected: true,
  }
  const splitTasks = (tasks: TaskSuggestionV2[]): TaskSuggestionV2[] => tasks.flatMap((task) => {
    if (task.tempId !== sourceTaskTempId) return [task]
    return [task, splitTask]
  })
  const clonedMaterials = result.materials
    .filter((material) => sourceMaterialIds.has(material.tempId))
    .map((material) => ({
      ...material,
      tempId: materialTempIds.get(material.tempId)!,
      relatedTaskTempIds: [splitTaskTempId],
    }))
  const clonedTimePoints = result.timePoints
    .filter((point) => sourceTimePointIds.has(point.tempId))
    .map((point) => ({
      ...point,
      tempId: timePointTempIds.get(point.tempId)!,
      relatedTaskTempIds: [splitTaskTempId],
      relatedMaterialTempIds: point.relatedMaterialTempIds
        .map((tempId) => materialTempIds.get(tempId))
        .filter((tempId): tempId is string => Boolean(tempId)),
    }))
  const next: RecognitionResult = {
    ...result,
    standaloneTasks: splitTasks(result.standaloneTasks),
    milestones: result.milestones.map((milestone) => ({
      ...milestone,
      tasks: splitTasks(milestone.tasks),
      workPackages: milestone.workPackages.map((workPackage) => ({
        ...workPackage,
        tasks: splitTasks(workPackage.tasks),
      })),
    })),
    materials: [...result.materials, ...clonedMaterials],
    timePoints: [...result.timePoints, ...clonedTimePoints],
  }
  return next
}

/** Moves every source reference onto the merge target while retaining the rejected source for audit. */
export function mergeRecognitionTasks(
  result: RecognitionResult,
  sourceTaskTempId: string,
  targetTaskTempId: string,
): RecognitionResult {
  if (sourceTaskTempId === targetTaskTempId) throw new Error('DOMAIN_MERGE_TASK_IDENTICAL')
  const tasks = rawRecognitionTasks(result)
  const source = tasks.find((item) => item.tempId === sourceTaskTempId)
  const target = tasks.find((item) => item.tempId === targetTaskTempId)
  if (!source || !target) throw new Error('DOMAIN_MERGE_TASK_MISSING')
  const sourceMaterialTempIds = result.materials
    .filter((item) => item.relatedTaskTempIds.includes(sourceTaskTempId))
    .map((item) => item.tempId)
  const sourceTimePointTempIds = result.timePoints
    .filter((item) => item.relatedTaskTempIds.includes(sourceTaskTempId))
    .map((item) => item.tempId)
  const parentTempId = target.parentTempId === sourceTaskTempId ? source.parentTempId : target.parentTempId
  const mergedTarget: TaskSuggestionV2 = {
    ...target,
    parentTempId,
    hierarchyType: parentTempId ? 'subtask' : 'task',
    completionCriteria: [...new Set([...target.completionCriteria, ...source.completionCriteria])],
    dependencyTempIds: [...new Set([
      ...target.dependencyTempIds.filter((tempId) => tempId !== sourceTaskTempId),
      ...source.dependencyTempIds.filter((tempId) => tempId !== targetTaskTempId),
    ])],
    materialTempIds: [...new Set([...target.materialTempIds, ...source.materialTempIds, ...sourceMaterialTempIds])],
    timePointTempIds: [...new Set([...target.timePointTempIds, ...source.timePointTempIds, ...sourceTimePointTempIds])],
    evidenceIds: [...new Set([...target.evidenceIds, ...source.evidenceIds])],
  }
  const mergeTasks = (items: TaskSuggestionV2[]): TaskSuggestionV2[] => items.map((item) => {
    if (item.tempId === targetTaskTempId) return mergedTarget
    if (item.tempId === sourceTaskTempId) return item
    const nextParentTempId = item.parentTempId === sourceTaskTempId ? targetTaskTempId : item.parentTempId
    return {
      ...item,
      parentTempId: nextParentTempId,
      hierarchyType: nextParentTempId ? 'subtask' : 'task',
      dependencyTempIds: [...new Set(item.dependencyTempIds.map((tempId) => (
        tempId === sourceTaskTempId ? targetTaskTempId : tempId
      )).filter((tempId) => tempId !== item.tempId))],
    }
  })
  return {
    ...result,
    standaloneTasks: mergeTasks(result.standaloneTasks),
    milestones: result.milestones.map((milestone) => ({
      ...milestone,
      tasks: mergeTasks(milestone.tasks),
      workPackages: milestone.workPackages.map((workPackage) => ({
        ...workPackage,
        tasks: mergeTasks(workPackage.tasks),
      })),
    })),
    materials: result.materials.map((material) => material.relatedTaskTempIds.includes(sourceTaskTempId)
      ? { ...material, relatedTaskTempIds: [...new Set([...material.relatedTaskTempIds, targetTaskTempId])] }
      : material),
    timePoints: result.timePoints.map((point) => point.relatedTaskTempIds.includes(sourceTaskTempId)
      ? { ...point, relatedTaskTempIds: [...new Set([...point.relatedTaskTempIds, targetTaskTempId])] }
      : point),
  }
}

function appendUnique<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => {
    if (!byId.has(item.id)) byId.set(item.id, item)
  })
  return [...byId.values()]
}

function upsertMaterials(current: Material[], incoming: Material[]): Material[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => {
    const existing = byId.get(item.id)
    if (!existing) {
      byId.set(item.id, item)
      return
    }
    const relatedTaskIds = [...new Set([...existing.relatedTaskIds, ...item.relatedTaskIds])]
    const relatedChanged = relatedTaskIds.length !== existing.relatedTaskIds.length
    byId.set(item.id, {
      ...existing,
      required: existing.required || item.required,
      requirements: [...new Set([...existing.requirements, ...item.requirements])],
      formatRequirements: [...new Set([...existing.formatRequirements, ...item.formatRequirements])],
      namingRequirements: [...new Set([...existing.namingRequirements, ...item.namingRequirements])],
      quantity: existing.quantity ?? item.quantity,
      submissionChannel: existing.submissionChannel ?? item.submissionChannel,
      relatedTaskIds,
      deadlineTimePointId: existing.deadlineTimePointId ?? item.deadlineTimePointId,
      updatedAt: relatedChanged ? item.updatedAt : existing.updatedAt,
      version: relatedChanged ? existing.version + 1 : existing.version,
    })
  })
  return [...byId.values()]
}

function upsertTimePoints(current: TimePoint[], incoming: TimePoint[]): TimePoint[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => {
    const existing = byId.get(item.id)
    if (!existing) {
      byId.set(item.id, item)
      return
    }
    const relatedTaskIds = [...new Set([...existing.relatedTaskIds, ...item.relatedTaskIds])]
    const relatedMaterialIds = [...new Set([...existing.relatedMaterialIds, ...item.relatedMaterialIds])]
    const relatedChanged = relatedTaskIds.length !== existing.relatedTaskIds.length
      || relatedMaterialIds.length !== existing.relatedMaterialIds.length
    byId.set(item.id, {
      ...existing,
      milestoneId: existing.milestoneId ?? item.milestoneId,
      taskId: existing.taskId ?? item.taskId,
      materialId: existing.materialId ?? item.materialId,
      eventId: existing.eventId ?? item.eventId,
      relatedTaskIds,
      relatedMaterialIds,
      updatedAt: relatedChanged ? item.updatedAt : existing.updatedAt,
    })
  })
  return [...byId.values()]
}

function createdHistory(entityType: HistoryEntityType, entityIdValue: string, sourceVersionId: string, now: string, reason: string): HistoryRecord {
  return {
    id: `history:${entityIdValue}:created`, entityType, entityId: entityIdValue, action: 'created', fieldName: null,
    before: null, after: { id: entityIdValue }, actor: 'user', reason, sourceVersionId, changedAt: now,
  }
}

function linkAddedHistory(
  entityType: 'material' | 'time_point',
  entityIdValue: string,
  before: JsonValue,
  after: JsonValue,
  sourceVersionId: string,
  now: string,
): HistoryRecord {
  const changeHash = workspaceSnapshotHash({ entityType, entityId: entityIdValue, before, after })
  return {
    id: `history:${entityIdValue}:link-added:${changeHash}`,
    entityType,
    entityId: entityIdValue,
    action: 'link_added',
    fieldName: 'relations',
    before,
    after,
    actor: 'user',
    reason: '顺序确认补充实体关联',
    sourceVersionId,
    changedAt: now,
  }
}

function planEvidence(result: RecognitionResult, evidenceIds: Set<string>, draftId: string, sourceVersionId: string, now: string): EvidenceRef[] {
  return result.evidence.filter((item) => evidenceIds.has(item.id)).map((item) => ({
    id: entityId('evidence', draftId, item.id), sourceVersionId, page: item.page ?? null,
    textStart: item.textStart ?? null, textEnd: item.textEnd ?? null,
    quotedText: item.quotedText ?? item.quote ?? null, bbox: item.boundingBox ?? null,
    fieldPath: item.field ?? null, extractionMethod: item.extractionMethod ?? 'ai', confidence: item.confidence ?? null,
    createdAt: now, legacyData: { recognitionEvidenceId: item.id },
  }))
}

export function selectionFromDraftItems(result: RecognitionResult, items: DraftItem[]): DomainCommitSelection {
  const acceptedItems = items.filter((item) => item.status === '待确认' && item.selected !== false)
  const accepted = new Set(acceptedItems.map((item) => item.suggestion.id))
  const editedMaterials = new Map(acceptedItems.map((item) => [
    item.suggestion.id,
    new Set(item.suggestion.materials.map(normalizedMaterialName)),
  ]))
  const selectedTimePointIds = new Set(result.timePoints
    .filter((item) => item.selected !== false && item.relatedTaskTempIds.some((id) => accepted.has(id)))
    .map((item) => item.tempId))
  const recognizedMaterialTempIds = result.materials.filter((item) => item.selected !== false
    && item.relatedTaskTempIds.some((id) => accepted.has(id) && editedMaterials.get(id)?.has(normalizedMaterialName(item.name))))
    .map((item) => item.tempId)
  const addedMaterialTempIds = acceptedItems.flatMap((item) => item.suggestion.materials
    .filter((name) => !result.materials.some((material) => material.relatedTaskTempIds.includes(item.suggestion.id)
      && normalizedMaterialName(material.name) === normalizedMaterialName(name)))
    .map(manualMaterialTempId))
  return {
    taskTempIds: [...accepted],
    materialTempIds: [...new Set([...recognizedMaterialTempIds, ...addedMaterialTempIds])],
    timePointTempIds: [...selectedTimePointIds],
    eventTempIds: result.events.filter((item) => {
      const referenced = [item.startTimePointTempId, item.endTimePointTempId].filter((id): id is string => Boolean(id))
      return item.selected !== false && referenced.length > 0 && referenced.every((id) => selectedTimePointIds.has(id))
    }).map((item) => item.tempId),
    rejectedTempIds: items.filter((item) => item.status === '已拒绝' || item.selected === false).map((item) => item.suggestion.id),
    taskOverrides: Object.fromEntries(items.map((item) => [item.suggestion.id, item.suggestion])),
  }
}

export function buildDomainCommitPlan(
  workspace: WorkspaceV8,
  draftId: string,
  selection: DomainCommitSelection,
  now = new Date().toISOString(),
): DomainCommitPlan {
  const draft = workspace.extractionDrafts.find((item) => item.id === draftId)
  if (!draft?.result) throw new Error('DOMAIN_COMMIT_DRAFT_RESULT_REQUIRED')
  const result = draft.result
  const run = workspace.recognitionRuns.find((item) => item.id === draft.recognitionRunId)
  const sourceVersion = run && workspace.sourceVersions.find((item) => item.id === run.sourceVersionId)
  const source = sourceVersion && workspace.sources.find((item) => item.id === sourceVersion.sourceId)
  if (!run || !sourceVersion || !source) throw new Error('DOMAIN_COMMIT_SOURCE_CHAIN_INVALID')

  const recognizedTasks = allRecognitionTasks(result)
  const selectedTaskIds = new Set(selection.taskTempIds)
  const selectedTasks = recognizedTasks.filter((item) => selectedTaskIds.has(item.tempId))
  if (!selectedTasks.length && !selection.eventTempIds.length && !selection.materialTempIds.length) throw new Error('DOMAIN_COMMIT_EMPTY')
  const alreadyCommittedTaskIds = new Set(recognizedTasks
    .filter((task) => draft.acceptedEntityTempIds.includes(task.tempId)
      && workspace.tasks.some((item) => item.id === entityId('task', draftId, task.tempId)))
    .map((task) => task.tempId))
  const availableTaskIds = new Set([...selectedTaskIds, ...alreadyCommittedTaskIds])
  selectedTasks.forEach((task) => {
    if (task.parentTempId && !availableTaskIds.has(task.parentTempId)) throw new Error(`DOMAIN_COMMIT_PARENT_REQUIRED:${task.tempId}`)
    task.dependencyTempIds.forEach((dependency) => {
      if (!availableTaskIds.has(dependency)) throw new Error(`DOMAIN_COMMIT_DEPENDENCY_REQUIRED:${task.tempId}:${dependency}`)
    })
  })

  if (result.projectMatch.decision === 'uncertain') throw new Error('DOMAIN_COMMIT_PROJECT_DECISION_REQUIRED')
  const isStandalone = result.projectMatch.decision === 'standalone_task'
  const existingProject = result.projectMatch.decision === 'existing_project' && result.projectMatch.matchedProjectId
    ? workspace.projects.find((item) => item.id === result.projectMatch.matchedProjectId)
    : null
  if (result.projectMatch.decision === 'existing_project' && !existingProject) throw new Error('DOMAIN_COMMIT_MATCHED_PROJECT_MISSING')
  const projectId = isStandalone ? null : existingProject?.id ?? entityId('project', draftId, 'suggested')
  const existingDraftProject = projectId ? workspace.projects.find((item) => item.id === projectId) : null
  const taskIdMap = new Map([...availableTaskIds].map((tempId) => [tempId, entityId('task', draftId, tempId)]))
  const recognizedMaterialSuggestions = result.materials
    .filter((item) => selection.materialTempIds.includes(item.tempId))
    .map((item) => ({
      ...item,
      relatedTaskTempIds: item.relatedTaskTempIds.filter((taskTempId) => selectedTaskIds.has(taskTempId)
        && (selection.taskOverrides?.[taskTempId]?.materials === undefined
          || selection.taskOverrides[taskTempId].materials?.some((name) => normalizedMaterialName(name) === normalizedMaterialName(item.name)))),
    }))
    .filter((item) => item.relatedTaskTempIds.length > 0)
  const addedMaterials = new Map<string, typeof recognizedMaterialSuggestions[number]>()
  selectedTasks.forEach((task) => {
    selection.taskOverrides?.[task.tempId]?.materials?.forEach((name) => {
      const matchesRecognized = recognizedMaterialSuggestions.some((material) => material.relatedTaskTempIds.includes(task.tempId)
        && normalizedMaterialName(material.name) === normalizedMaterialName(name))
      if (matchesRecognized) return
      const tempId = manualMaterialTempId(name)
      const previous = addedMaterials.get(tempId)
      addedMaterials.set(tempId, previous ? {
        ...previous,
        relatedTaskTempIds: [...new Set([...previous.relatedTaskTempIds, task.tempId])],
        evidenceIds: [...new Set([...previous.evidenceIds, ...task.evidenceIds])],
      } : {
        tempId, name: name.trim(), required: true, formatRequirements: [], namingRequirements: [], quantity: 1,
        submissionChannel: null, relatedTaskTempIds: [task.tempId], evidenceIds: task.evidenceIds,
        confidence: 1, selected: true,
      })
    })
  })
  const materialSuggestions = [...recognizedMaterialSuggestions, ...addedMaterials.values()]
  const materialIdMap = new Map(materialSuggestions.map((item) => [item.tempId, entityId('material', draftId, item.tempId)]))
  const timeSuggestions = result.timePoints.filter((item) => selection.timePointTempIds.includes(item.tempId))
  const timeIdMap = new Map(timeSuggestions.map((item) => [item.tempId, entityId('time', draftId, item.tempId)]))
  const primaryOverrideTimeIds = new Map<string, string>()
  selectedTasks.forEach((task) => {
    const candidates = timeSuggestions.filter((point) => point.relatedTaskTempIds.includes(task.tempId)
      && point.type !== 'event_start' && point.type !== 'event_end' && point.type !== 'planned_start')
    const preferred = candidates.find((point) => point.type === 'task_deadline')
      ?? candidates.find((point) => point.type === 'submission_deadline')
      ?? candidates.find((point) => point.type === 'registration_deadline')
      ?? candidates[0]
    if (preferred && selection.taskOverrides?.[task.tempId]?.deadline) primaryOverrideTimeIds.set(task.tempId, preferred.tempId)
  })
  const eventSuggestions = result.events.filter((item) => selection.eventTempIds.includes(item.tempId))
  eventSuggestions.forEach((event) => {
    for (const timeId of [event.startTimePointTempId, event.endTimePointTempId]) {
      if (timeId && !timeIdMap.has(timeId)) throw new Error(`DOMAIN_COMMIT_EVENT_TIME_REQUIRED:${event.tempId}:${timeId}`)
    }
  })

  const milestoneIds = new Set(selectedTasks.map((item) => item.milestoneTempId).filter((id): id is string => Boolean(id)))
  const workPackageIds = new Set(selectedTasks.map((item) => item.workPackageTempId).filter((id): id is string => Boolean(id)))
  const milestones: Milestone[] = !projectId ? [] : result.milestones.filter((item) => milestoneIds.has(item.tempId)).map((item) => ({
    id: entityId('milestone', draftId, item.tempId), projectId, title: item.title, objective: item.objective || null,
    sortOrder: item.order, status: 'active', createdAt: now, updatedAt: now,
    legacyData: { recognitionTempId: item.tempId, evidenceIds: item.evidenceIds },
  }))
  const workPackages: WorkPackage[] = !projectId ? [] : result.milestones.flatMap((milestone) => milestone.workPackages
    .filter((item) => workPackageIds.has(item.tempId)).map((item) => ({
      id: entityId('work-package', draftId, item.tempId), projectId,
      milestoneId: entityId('milestone', draftId, milestone.tempId), title: item.title, objective: item.objective || null,
      sortOrder: item.order, createdAt: now, updatedAt: now,
      legacyData: { recognitionTempId: item.tempId, evidenceIds: item.evidenceIds },
    })))
  const projects: Project[] = projectId && !existingProject && !existingDraftProject ? [{
    id: projectId, workspaceId: workspace.workspace.id,
    title: result.projectSuggestion?.title.value || result.projectMatch.suggestedProjectTitle || result.sourceSummary.title,
    category: result.projectSuggestion?.category.value ?? '其他', objective: result.projectSuggestion?.objective.value || null,
    status: 'active', createdAt: now, updatedAt: now, version: 1,
    legacyData: { sourceId: source.id, recognitionRunId: run.id, evidenceIds: result.projectSuggestion?.title.evidenceIds ?? [] },
  }] : []
  const tasks: Task[] = selectedTasks.map((item) => {
    const override = selection.taskOverrides?.[item.tempId]
    return {
      id: taskIdMap.get(item.tempId)!, projectId,
      milestoneId: projectId && item.milestoneTempId ? entityId('milestone', draftId, item.milestoneTempId) : null,
      workPackageId: projectId && item.workPackageTempId ? entityId('work-package', draftId, item.workPackageTempId) : null,
      parentTaskId: item.parentTempId ? taskIdMap.get(item.parentTempId) ?? null : null,
      title: override?.title ?? item.title, description: override?.description ?? (item.description || null),
      nextAction: override?.nextAction ?? (item.actionVerb && item.actionObject ? `${item.actionVerb}${item.actionObject}` : item.title),
      status: 'todo', estimatedMinutes: override?.estimatedMinutes ?? item.estimatedMinutes, manualPriority: null,
      snoozedUntil: null, dependencyIds: item.dependencyTempIds.map((id) => taskIdMap.get(id)!),
      createdAt: now, updatedAt: now, version: 1,
      legacyData: {
        recognitionTempId: item.tempId, actionVerb: item.actionVerb, actionObject: item.actionObject,
        completionCriteria: item.completionCriteria, inferenceLevel: item.inferenceLevel,
        prioritySuggestion: override?.priority === '高' ? 'high' : override?.priority === '低' ? 'low' : override?.priority === '中' ? 'medium' : item.prioritySuggestion,
        priority: override?.priority ?? (item.prioritySuggestion === 'urgent' || item.prioritySuggestion === 'high' ? '高' : item.prioritySuggestion === 'low' ? '低' : '中'),
        evidenceIds: item.evidenceIds, sourceId: source.id,
        category: override?.category ?? result.projectSuggestion?.category.value ?? '其他',
      },
    }
  })
  const materials: Material[] = materialSuggestions.map((item) => ({
    id: materialIdMap.get(item.tempId)!, projectId, name: item.name, required: item.required, status: 'missing',
    requirements: [], formatRequirements: item.formatRequirements, namingRequirements: item.namingRequirements,
    quantity: item.quantity, submissionChannel: item.submissionChannel,
    relatedTaskIds: item.relatedTaskTempIds.map((id) => taskIdMap.get(id)).filter((id): id is string => Boolean(id)),
    deadlineTimePointId: timeSuggestions.find((point) => point.relatedMaterialTempIds.includes(item.tempId))
      ? timeIdMap.get(timeSuggestions.find((point) => point.relatedMaterialTempIds.includes(item.tempId))!.tempId) ?? null : null,
    createdAt: now, updatedAt: now, version: 1,
    legacyData: { recognitionTempId: item.tempId, evidenceIds: item.evidenceIds },
  }))
  const eventIdMap = new Map(eventSuggestions.map((item) => [item.tempId, entityId('event', draftId, item.tempId)]))
  const timePoints: TimePoint[] = timeSuggestions.map((item) => {
    const relatedTasks = item.relatedTaskTempIds.map((id) => taskIdMap.get(id)).filter((id): id is string => Boolean(id))
    const relatedMaterials = item.relatedMaterialTempIds.map((id) => materialIdMap.get(id)).filter((id): id is string => Boolean(id))
    const event = eventSuggestions.find((candidate) => candidate.startTimePointTempId === item.tempId || candidate.endTimePointTempId === item.tempId)
    const overrideTaskTempId = item.relatedTaskTempIds.find((id) => primaryOverrideTimeIds.get(id) === item.tempId)
    const overrideDeadline = overrideTaskTempId ? selection.taskOverrides?.[overrideTaskTempId]?.deadline : undefined
    const overrideIsDateOnly = Boolean(overrideDeadline && /^\d{4}-\d{2}-\d{2}$/u.test(overrideDeadline))
    const hasValidOverride = Boolean(overrideDeadline && (overrideIsDateOnly || !Number.isNaN(new Date(overrideDeadline).getTime())))
    return {
      id: timeIdMap.get(item.tempId)!, projectId,
      milestoneId: selectedTasks.find((task) => item.relatedTaskTempIds.includes(task.tempId))?.milestoneTempId
        ? entityId('milestone', draftId, selectedTasks.find((task) => item.relatedTaskTempIds.includes(task.tempId))!.milestoneTempId!) : null,
      taskId: relatedTasks[0] ?? null, materialId: relatedMaterials[0] ?? null,
      eventId: event ? eventIdMap.get(event.tempId)! : null, relatedTaskIds: relatedTasks, relatedMaterialIds: relatedMaterials,
      type: item.type, rawText: hasValidOverride ? overrideDeadline! : item.rawText,
      normalizedValue: hasValidOverride ? overrideDeadline! : item.normalizedValue,
      timezone: hasValidOverride ? (overrideIsDateOnly ? null : workspace.settings.defaultTimezone) : item.precision === 'exact' ? item.timezone : null,
      isAllDay: hasValidOverride ? overrideIsDateOnly : item.isAllDay,
      precision: hasValidOverride ? (overrideIsDateOnly ? 'date_only' : 'exact') : item.precision,
      needsConfirmation: hasValidOverride ? false : item.needsConfirmation,
      createdAt: now, updatedAt: now,
      legacyData: { recognitionTempId: item.tempId, evidenceIds: item.evidenceIds, confidence: item.confidence },
    }
  })
  const events: Event[] = eventSuggestions.map((item) => ({
    id: eventIdMap.get(item.tempId)!, projectId, title: item.title, description: item.description || null,
    startTimePointId: item.startTimePointTempId ? timeIdMap.get(item.startTimePointTempId) ?? null : null,
    endTimePointId: item.endTimePointTempId ? timeIdMap.get(item.endTimePointTempId) ?? null : null,
    location: item.location, createdAt: now, updatedAt: now,
    legacyData: { recognitionTempId: item.tempId, evidenceIds: item.evidenceIds, inferenceLevel: item.inferenceLevel },
  }))

  const evidenceIds = new Set<string>()
  selectedTasks.forEach((item) => item.evidenceIds.forEach((id) => evidenceIds.add(id)))
  materialSuggestions.forEach((item) => item.evidenceIds.forEach((id) => evidenceIds.add(id)))
  timeSuggestions.forEach((item) => item.evidenceIds.forEach((id) => evidenceIds.add(id)))
  eventSuggestions.forEach((item) => item.evidenceIds.forEach((id) => evidenceIds.add(id)))
  result.milestones.filter((item) => milestoneIds.has(item.tempId)).forEach((item) => item.evidenceIds.forEach((id) => evidenceIds.add(id)))
  result.milestones.flatMap((item) => item.workPackages).filter((item) => workPackageIds.has(item.tempId))
    .forEach((item) => item.evidenceIds.forEach((id) => evidenceIds.add(id)))
  result.projectSuggestion?.title.evidenceIds.forEach((id) => evidenceIds.add(id))
  const evidenceRefs = planEvidence(result, evidenceIds, draftId, sourceVersion.id, now)
  const materialLinkHistory = materials.flatMap((item) => {
    const existing = workspace.materials.find((candidate) => candidate.id === item.id)
    if (!existing) return []
    const relatedTaskIds = [...new Set([...existing.relatedTaskIds, ...item.relatedTaskIds])]
    if (relatedTaskIds.length === existing.relatedTaskIds.length) return []
    return [linkAddedHistory(
      'material', item.id,
      { relatedTaskIds: existing.relatedTaskIds }, { relatedTaskIds },
      sourceVersion.id, now,
    )]
  })
  const timePointLinkHistory = timePoints.flatMap((item) => {
    const existing = workspace.timePoints.find((candidate) => candidate.id === item.id)
    if (!existing) return []
    const relatedTaskIds = [...new Set([...existing.relatedTaskIds, ...item.relatedTaskIds])]
    const relatedMaterialIds = [...new Set([...existing.relatedMaterialIds, ...item.relatedMaterialIds])]
    if (relatedTaskIds.length === existing.relatedTaskIds.length
      && relatedMaterialIds.length === existing.relatedMaterialIds.length) return []
    return [linkAddedHistory(
      'time_point', item.id,
      { relatedTaskIds: existing.relatedTaskIds, relatedMaterialIds: existing.relatedMaterialIds },
      { relatedTaskIds, relatedMaterialIds },
      sourceVersion.id, now,
    )]
  })
  const historyRecords = [
    ...projects.map((item) => createdHistory('project', item.id, sourceVersion.id, now, '用户确认识别项目')),
    ...milestones.map((item) => createdHistory('milestone', item.id, sourceVersion.id, now, '用户确认识别阶段')),
    ...workPackages.map((item) => createdHistory('work_package', item.id, sourceVersion.id, now, '用户确认识别工作包')),
    ...tasks.map((item) => createdHistory('task', item.id, sourceVersion.id, now, '用户确认识别任务')),
    ...materials.filter((item) => !workspace.materials.some((existing) => existing.id === item.id))
      .map((item) => createdHistory('material', item.id, sourceVersion.id, now, '用户确认识别材料')),
    ...timePoints.filter((item) => !workspace.timePoints.some((existing) => existing.id === item.id))
      .map((item) => createdHistory('time_point', item.id, sourceVersion.id, now, '用户确认识别时间节点')),
    ...materialLinkHistory,
    ...timePointLinkHistory,
    ...events.map((item) => createdHistory('event', item.id, sourceVersion.id, now, '用户确认识别事件')),
  ]
  const acceptedEntityTempIds = [...new Set([
    ...selection.taskTempIds, ...materialSuggestions.map((item) => item.tempId), ...selection.timePointTempIds, ...selection.eventTempIds,
  ])].sort()
  const rejectedEntityTempIds = [...new Set(selection.rejectedTempIds ?? [])].sort()
  const draftRevisionHash = recognitionDraftRevisionHash(draft)
  const projectDecision = {
    decision: result.projectMatch.decision,
    matchedProjectId: result.projectMatch.matchedProjectId,
    suggestedProjectTitle: result.projectMatch.suggestedProjectTitle,
  }
  const operationId = `domain-commit:${draftId}:${workspaceSnapshotHash({
    acceptedEntityTempIds,
    rejectedEntityTempIds,
    overrides: jsonValue(selection.taskOverrides ?? {}),
    projectDecision,
    draftRevisionHash,
  })}`
  const plan: DomainCommitPlan = {
    operationId, draftRevisionHash, draftId, recognitionRunId: run.id, sourceVersionId: sourceVersion.id, sourceId: source.id,
    acceptedEntityTempIds, rejectedEntityTempIds,
    create: { projects, milestones, workPackages, tasks, materials, timePoints, events, evidenceRefs, historyRecords },
  }
  const validation = validateWorkspaceV8(applyDomainCommitPlan(workspace, plan, now))
  if (!validation.valid) throw new Error(`DOMAIN_COMMIT_INVALID:${validation.issues[0].code}:${validation.issues[0].path}`)
  return plan
}

export function applyDomainCommitPlan(workspace: WorkspaceV8, plan: DomainCommitPlan, now = new Date().toISOString()): WorkspaceV8 {
  const draft = workspace.extractionDrafts.find((item) => item.id === plan.draftId)
  if (!draft || draft.recognitionRunId !== plan.recognitionRunId) throw new Error('DOMAIN_COMMIT_DRAFT_STALE')
  if (draft.commitOperationIds.includes(plan.operationId)) return workspace
  if (recognitionDraftRevisionHash(draft) !== plan.draftRevisionHash) throw new Error('DOMAIN_COMMIT_DRAFT_STALE')
  const accepted = [...new Set([...draft.acceptedEntityTempIds, ...plan.acceptedEntityTempIds])]
  const allTaskIds = new Set(allRecognitionTasks(draft.result!).map((item) => item.tempId))
  const acceptedTaskCount = accepted.filter((id) => allTaskIds.has(id)).length
  const status = acceptedTaskCount >= allTaskIds.size ? 'confirmed' as const : 'partially_confirmed' as const
  const next: WorkspaceV8 = {
    ...workspace,
    projects: appendUnique(workspace.projects, plan.create.projects), milestones: appendUnique(workspace.milestones, plan.create.milestones),
    workPackages: appendUnique(workspace.workPackages, plan.create.workPackages), tasks: appendUnique(workspace.tasks, plan.create.tasks),
    materials: upsertMaterials(workspace.materials, plan.create.materials), timePoints: upsertTimePoints(workspace.timePoints, plan.create.timePoints),
    events: appendUnique(workspace.events, plan.create.events), evidenceRefs: appendUnique(workspace.evidenceRefs, plan.create.evidenceRefs),
    historyRecords: appendUnique(workspace.historyRecords, plan.create.historyRecords),
    extractionDrafts: workspace.extractionDrafts.map((item) => item.id === plan.draftId ? {
      ...item, status, updatedAt: now, commitOperationIds: [...item.commitOperationIds, plan.operationId],
      acceptedEntityTempIds: accepted, rejectedEntityTempIds: [...new Set([...item.rejectedEntityTempIds, ...plan.rejectedEntityTempIds])],
    } : item),
    sources: workspace.sources.map((item) => item.id === plan.sourceId ? {
      ...item, status: status === 'confirmed' ? 'confirmed' : 'partially_confirmed', updatedAt: now,
    } : item),
    savedAt: now,
  }
  const validation = validateWorkspaceV8(next)
  if (!validation.valid) throw new Error(`DOMAIN_COMMIT_INVALID:${validation.issues[0].code}:${validation.issues[0].path}`)
  return next
}

export async function commitDomainPlan(repository: CanonicalWorkspaceRepository, plan: DomainCommitPlan, now = new Date().toISOString()): Promise<WorkspaceV8> {
  return repository.transaction((workspace) => applyDomainCommitPlan(workspace, plan, now))
}
