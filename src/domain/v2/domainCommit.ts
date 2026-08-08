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

function appendUnique<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => {
    if (!byId.has(item.id)) byId.set(item.id, item)
  })
  return [...byId.values()]
}

function createdHistory(entityType: HistoryEntityType, entityIdValue: string, sourceVersionId: string, now: string, reason: string): HistoryRecord {
  return {
    id: `history:${entityIdValue}:created`, entityType, entityId: entityIdValue, action: 'created', fieldName: null,
    before: null, after: { id: entityIdValue }, actor: 'user', reason, sourceVersionId, changedAt: now,
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
  const accepted = new Set(items.filter((item) => item.status === '待确认' && item.selected !== false).map((item) => item.suggestion.id))
  return {
    taskTempIds: [...accepted],
    materialTempIds: result.materials.filter((item) => item.selected !== false && item.relatedTaskTempIds.some((id) => accepted.has(id))).map((item) => item.tempId),
    timePointTempIds: result.timePoints.filter((item) => item.selected !== false && item.relatedTaskTempIds.some((id) => accepted.has(id))).map((item) => item.tempId),
    eventTempIds: result.events.filter((item) => item.selected !== false).map((item) => item.tempId),
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
  selectedTasks.forEach((task) => {
    if (task.parentTempId && !selectedTaskIds.has(task.parentTempId)) throw new Error(`DOMAIN_COMMIT_PARENT_REQUIRED:${task.tempId}`)
    task.dependencyTempIds.forEach((dependency) => {
      if (!selectedTaskIds.has(dependency)) throw new Error(`DOMAIN_COMMIT_DEPENDENCY_REQUIRED:${task.tempId}:${dependency}`)
    })
  })

  const isStandalone = result.projectMatch.decision === 'standalone_task'
  const existingProject = result.projectMatch.decision === 'existing_project' && result.projectMatch.matchedProjectId
    ? workspace.projects.find((item) => item.id === result.projectMatch.matchedProjectId)
    : null
  if (result.projectMatch.decision === 'existing_project' && !existingProject) throw new Error('DOMAIN_COMMIT_MATCHED_PROJECT_MISSING')
  const projectId = isStandalone ? null : existingProject?.id ?? entityId('project', draftId, 'suggested')
  const taskIdMap = new Map(selectedTasks.map((item) => [item.tempId, entityId('task', draftId, item.tempId)]))
  const materialSuggestions = result.materials.filter((item) => selection.materialTempIds.includes(item.tempId))
  const materialIdMap = new Map(materialSuggestions.map((item) => [item.tempId, entityId('material', draftId, item.tempId)]))
  const timeSuggestions = result.timePoints.filter((item) => selection.timePointTempIds.includes(item.tempId))
  const timeIdMap = new Map(timeSuggestions.map((item) => [item.tempId, entityId('time', draftId, item.tempId)]))
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
  const projects: Project[] = projectId && !existingProject ? [{
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
        prioritySuggestion: item.prioritySuggestion, evidenceIds: item.evidenceIds, sourceId: source.id,
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
    return {
      id: timeIdMap.get(item.tempId)!, projectId,
      milestoneId: selectedTasks.find((task) => item.relatedTaskTempIds.includes(task.tempId))?.milestoneTempId
        ? entityId('milestone', draftId, selectedTasks.find((task) => item.relatedTaskTempIds.includes(task.tempId))!.milestoneTempId!) : null,
      taskId: relatedTasks[0] ?? null, materialId: relatedMaterials[0] ?? null,
      eventId: event ? eventIdMap.get(event.tempId)! : null, relatedTaskIds: relatedTasks, relatedMaterialIds: relatedMaterials,
      type: item.type, rawText: item.rawText, normalizedValue: item.normalizedValue,
      timezone: item.precision === 'exact' ? item.timezone : null, isAllDay: item.isAllDay,
      precision: item.precision, needsConfirmation: item.needsConfirmation,
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
  result.projectSuggestion?.title.evidenceIds.forEach((id) => evidenceIds.add(id))
  const evidenceRefs = planEvidence(result, evidenceIds, draftId, sourceVersion.id, now)
  const historyRecords = [
    ...projects.map((item) => createdHistory('project', item.id, sourceVersion.id, now, '用户确认识别项目')),
    ...milestones.map((item) => createdHistory('milestone', item.id, sourceVersion.id, now, '用户确认识别阶段')),
    ...workPackages.map((item) => createdHistory('work_package', item.id, sourceVersion.id, now, '用户确认识别工作包')),
    ...tasks.map((item) => createdHistory('task', item.id, sourceVersion.id, now, '用户确认识别任务')),
    ...materials.map((item) => createdHistory('material', item.id, sourceVersion.id, now, '用户确认识别材料')),
    ...timePoints.map((item) => createdHistory('time_point', item.id, sourceVersion.id, now, '用户确认识别时间节点')),
    ...events.map((item) => createdHistory('event', item.id, sourceVersion.id, now, '用户确认识别事件')),
  ]
  const acceptedEntityTempIds = [...new Set([
    ...selection.taskTempIds, ...selection.materialTempIds, ...selection.timePointTempIds, ...selection.eventTempIds,
  ])].sort()
  const operationId = `domain-commit:${draftId}:${workspaceSnapshotHash({ acceptedEntityTempIds, overrides: jsonValue(selection.taskOverrides ?? {}) })}`
  const plan: DomainCommitPlan = {
    operationId, draftId, recognitionRunId: run.id, sourceVersionId: sourceVersion.id, sourceId: source.id,
    acceptedEntityTempIds, rejectedEntityTempIds: [...new Set(selection.rejectedTempIds ?? [])].sort(),
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
  const accepted = [...new Set([...draft.acceptedEntityTempIds, ...plan.acceptedEntityTempIds])]
  const allTaskIds = new Set(allRecognitionTasks(draft.result!).map((item) => item.tempId))
  const acceptedTaskCount = accepted.filter((id) => allTaskIds.has(id)).length
  const status = acceptedTaskCount >= allTaskIds.size ? 'confirmed' as const : 'partially_confirmed' as const
  const next: WorkspaceV8 = {
    ...workspace,
    projects: appendUnique(workspace.projects, plan.create.projects), milestones: appendUnique(workspace.milestones, plan.create.milestones),
    workPackages: appendUnique(workspace.workPackages, plan.create.workPackages), tasks: appendUnique(workspace.tasks, plan.create.tasks),
    materials: appendUnique(workspace.materials, plan.create.materials), timePoints: appendUnique(workspace.timePoints, plan.create.timePoints),
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
