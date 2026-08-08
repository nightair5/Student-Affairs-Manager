import type {
  DraftItem,
  CourseBlock,
  IntegrationState,
  KnowledgeSettings,
  ExtractionDraft,
  ParsedSuggestion,
  Project,
  Milestone,
  RiskFlag,
  Source,
  Task,
  WorkspaceData,
  WorkPackage,
  Event,
  MigrationRecord,
  RecognitionFeedbackRecord,
} from '../types'
import { materializeWorkspaceEntities } from './domainEntities'
import { calculateTaskPriority } from './taskLogic'
import type { RecognitionResult } from '../recognition/types'

export function createWorkspaceData(
  tasks: Task[],
  sources: Source[],
  drafts: ExtractionDraft[] = [],
  projects: Project[] = [],
  courseBlocks: CourseBlock[] = [],
  integrations: IntegrationState = createIntegrationState(),
  knowledgeSettings: KnowledgeSettings = {},
  workPackages: WorkPackage[] = [],
  events: Event[] = [],
  migrationLog: MigrationRecord[] = [],
  recognitionFeedback: RecognitionFeedbackRecord[] = [],
  legacyData: Record<string, unknown> = {},
): WorkspaceData {
  const entities = materializeWorkspaceEntities(tasks, sources, drafts, projects)
  return {
    schemaVersion: 7,
    ...entities,
    courseBlocks,
    integrations,
    knowledgeSettings,
    workPackages,
    events,
    migrationLog,
    recognitionFeedback,
    legacyData,
    savedAt: new Date().toISOString(),
  }
}

export function createIntegrationState(): IntegrationState {
  return {
    sync: {
      endpoint: 'http://127.0.0.1:8787',
    },
    webMonitors: [],
    connectionIntents: [],
  }
}

export function createExtractionDraft(
  sourceId: string,
  suggestions: ParsedSuggestion[],
  now = new Date().toISOString(),
  recognitionResult?: RecognitionResult,
): ExtractionDraft {
  return {
    id: `draft-${Date.now()}`,
    sourceId,
    status: '待确认',
    createdAt: now,
    updatedAt: now,
    schemaVersion: recognitionResult?.schemaVersion,
    modelName: recognitionResult?.modelName,
    promptVersion: recognitionResult?.promptVersion,
    recognitionResult: recognitionResult
      ? {
          ...recognitionResult,
          evidence: recognitionResult.evidence.map((reference) => ({ ...reference, sourceId })),
        }
      : undefined,
    items: suggestions.map((suggestion, index): DraftItem => ({
      id: `draft-item-${Date.now()}-${index}`,
      selected: (() => {
        if (!recognitionResult) return true
        const recognizedTask = [
          ...recognitionResult.standaloneTasks,
          ...recognitionResult.milestones.flatMap((milestone) => [
            ...milestone.tasks,
            ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
          ]),
        ].find((task) => task.tempId === suggestion.id)
        return recognizedTask?.selected !== false
      })(),
      suggestion: {
        ...suggestion,
        evidenceRefs: suggestion.evidenceRefs ?? [
          {
            id: `evidence-${Date.now()}-${index}`,
            sourceId,
            quote: suggestion.evidence,
            field: 'description',
          },
        ],
      },
      status: '待确认',
      updatedAt: now,
    })),
  }
}

export function deriveDraftStatus(items: DraftItem[]): ExtractionDraft['status'] {
  if (!items.length || items.every((item) => item.status === '已拒绝')) return '已拒绝'
  if (items.every((item) => item.status === '已确认')) return '已确认'
  if (items.some((item) => item.status !== '待确认')) return '部分确认'
  return '待确认'
}

export function updateDraftItem(
  draft: ExtractionDraft,
  itemId: string,
  patch: Partial<DraftItem['suggestion']>,
  status?: DraftItem['status'],
  now = new Date().toISOString(),
): ExtractionDraft {
  const items = draft.items.map((item) => {
    if (item.id !== itemId) return item
    const nextStatus = status ?? item.status
    const suggestionChanged = Object.keys(patch).some((key) => {
      const field = key as keyof DraftItem['suggestion']
      return JSON.stringify(item.suggestion[field]) !== JSON.stringify(patch[field])
    })
    const statusChanged = nextStatus !== item.status
    if (!suggestionChanged && !statusChanged) return item
    return {
      ...item,
      suggestion: { ...item.suggestion, ...patch },
      status: nextStatus,
      updatedAt: now,
      history: [
        ...(item.history ?? []),
        {
          id: `${item.id}-history-${now}-${item.history?.length ?? 0}`,
          field: statusChanged ? '确认状态' : '识别建议',
          before: statusChanged ? item.status : JSON.stringify(item.suggestion),
          after: statusChanged ? nextStatus : JSON.stringify({ ...item.suggestion, ...patch }),
          changedAt: now,
          actor: 'user' as const,
          entityType: 'draft' as const,
          entityId: item.id,
          action: statusChanged
            ? nextStatus === '已确认' ? 'confirmed' : nextStatus === '已拒绝' ? 'rejected' : 'reopened'
            : 'updated',
        },
      ],
    }
  })
  return { ...draft, items, status: deriveDraftStatus(items), updatedAt: now }
}

export function taskSignals(task: Task, now = new Date()): {
  risks: RiskFlag[]
  reason: string
} {
  const result = calculateTaskPriority(task, [task], now)
  return {
    risks: result.risks,
    reason: result.reasons.slice(0, 3).join('；'),
  }
}

export function createProjectFromConfirmation(
  source: Source,
  suggestion: ParsedSuggestion,
  tasks: Task[],
  now = new Date().toISOString(),
): Project {
  const projectId = `project-${source.id}`
  return {
    id: projectId,
    title: source.title,
    category: suggestion.category,
    sourceIds: [source.id],
    taskIds: tasks.map((task) => task.id),
    milestones: tasks.map((task) => createTaskMilestone(projectId, task, now)),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
}

export function createTaskMilestone(
  projectId: string,
  task: Task,
  now = new Date().toISOString(),
): Milestone {
  return {
    id: `milestone-${task.id}`,
    projectId,
    title: task.title,
    dueAt: task.deadline,
    status: task.status === '已完成' ? '已完成' : '待完成',
    createdAt: now,
  }
}

export function createManualMilestone(
  projectId: string,
  title: string,
  dueAt: string,
  now = new Date().toISOString(),
): Milestone {
  return {
    id: `milestone-${Date.now()}`,
    projectId,
    title: title.trim(),
    dueAt,
    status: '待完成',
    createdAt: now,
  }
}

export function syncTaskMilestone(project: Project, task: Task): Project {
  const milestoneId = `milestone-${task.id}`
  if (!project.milestones.some((milestone) => milestone.id === milestoneId)) return project
  return {
    ...project,
    milestones: project.milestones.map((milestone) => milestone.id === milestoneId
      ? {
          ...milestone,
          title: task.title,
          dueAt: task.deadline,
          status: task.status === '已完成' ? '已完成' : '待完成',
        }
      : milestone),
    updatedAt: task.updatedAt,
  }
}

export function buildConfirmedTask(
  item: DraftItem,
  source: Source,
  now = new Date().toISOString(),
): Task {
  const taskId = `task-${Date.now()}-${item.id}`
  const base: Task = {
    id: taskId,
    title: item.suggestion.title,
    category: item.suggestion.category,
    status: '待开始',
    deadline: item.suggestion.deadline,
    estimatedMinutes: item.suggestion.estimatedMinutes,
    nextAction: item.suggestion.nextAction,
    description: item.suggestion.description,
    priority: item.suggestion.priority,
    riskFlags: item.suggestion.confidence === '低' ? ['待确认'] : [],
    materials: item.suggestion.materials.map((name, index) => ({
      id: `${taskId}-material-${index}`,
      name,
      done: false,
      status: 'missing',
      taskId,
      sourceId: source.id,
    })),
    dependencies: [],
    reminders: [],
    sourceIds: [source.id],
    priorityReason: '',
    createdAt: now,
    updatedAt: now,
    history: [
      {
        id: `${taskId}-created`,
        field: '任务',
        before: '',
        after: source.extractionMethod === 'deepseek-v4-flash'
          ? '由用户确认 DeepSeek 建议后创建'
          : '由用户确认本地规则建议后创建',
        changedAt: now,
        actor: 'user',
        entityType: 'task',
        entityId: taskId,
        action: 'confirmed',
      },
    ],
  }
  const signal = taskSignals(base)
  return { ...base, riskFlags: signal.risks, priorityReason: signal.reason }
}

export function buildConfirmedProjectBatch(
  items: DraftItem[],
  source: Source,
  existingProject: Project | undefined,
  now = new Date().toISOString(),
  recognitionResult?: RecognitionResult,
): { tasks: Task[]; project: Project | null; workPackages: WorkPackage[]; events: Event[] } {
  if (!items.length) throw new Error('至少需要一项已确认建议')
  const standalone = recognitionResult?.projectMatch.decision === 'standalone_task'
  const projectId = standalone ? '' : existingProject?.id ?? `project-${source.id}`
  const recognitionTasks = recognitionResult
    ? [
        ...recognitionResult.standaloneTasks,
        ...recognitionResult.milestones.flatMap((milestone) => [
          ...milestone.tasks,
          ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
        ]),
      ]
    : []
  const taskIdByTempId = new Map(items.map((item) => [item.suggestion.id, `task-${Date.now()}-${item.id}`]))
  const tasks = items.map((item) => {
    const task = buildConfirmedTask(item, source, now)
    const recognized = recognitionTasks.find((candidate) => candidate.tempId === item.suggestion.id)
    const milestone = recognitionResult?.milestones.find((candidate) =>
      candidate.tasks.some((candidateTask) => candidateTask.tempId === item.suggestion.id)
      || candidate.workPackages.some((workPackage) => workPackage.tasks.some((candidateTask) => candidateTask.tempId === item.suggestion.id)))
    const workPackage = milestone?.workPackages.find((candidate) => candidate.tasks.some((candidateTask) => candidateTask.tempId === item.suggestion.id))
    return {
      ...task,
      id: taskIdByTempId.get(item.suggestion.id) ?? task.id,
      projectId: projectId || undefined,
      hierarchyType: recognized?.hierarchyType ?? 'task',
      parentTaskId: recognized?.parentTempId ? taskIdByTempId.get(recognized.parentTempId) : undefined,
      milestoneId: milestone ? `milestone-${projectId}-${milestone.tempId}` : undefined,
      workPackageId: workPackage ? `work-package-${projectId}-${workPackage.tempId}` : undefined,
      actionVerb: recognized?.actionVerb,
      actionObject: recognized?.actionObject,
      completionCriteria: recognized?.completionCriteria,
      evidenceIds: recognized?.evidenceIds,
      inferenceLevel: recognized?.inferenceLevel,
      dependencies: recognized?.dependencyTempIds.map((tempId) => taskIdByTempId.get(tempId)).filter((id): id is string => Boolean(id)) ?? [],
      dependencyIds: recognized?.dependencyTempIds.map((tempId) => taskIdByTempId.get(tempId)).filter((id): id is string => Boolean(id)) ?? [],
      materials: task.materials.map((material) => ({ ...material, taskId: taskIdByTempId.get(item.suggestion.id) ?? task.id, projectId: projectId || undefined })),
    }
  })
  const recognizedMilestones: Milestone[] = recognitionResult?.milestones.map((milestone) => {
    const relatedTasks = tasks.filter((task) => task.milestoneId === `milestone-${projectId}-${milestone.tempId}`)
    const dueAt = relatedTasks.map((task) => task.deadline).filter((value) => !Number.isNaN(new Date(value).getTime())).sort()[0] ?? now
    return {
      id: `milestone-${projectId}-${milestone.tempId}`,
      projectId,
      title: milestone.title,
      objective: milestone.objective,
      order: milestone.order,
      dueAt,
      status: relatedTasks.length > 0 && relatedTasks.every((task) => task.status === '已完成') ? '已完成' : '待完成',
      evidenceIds: milestone.evidenceIds,
      workPackageIds: milestone.workPackages.map((workPackage) => `work-package-${projectId}-${workPackage.tempId}`),
      taskIds: relatedTasks.map((task) => task.id),
      createdAt: now,
    }
  }) ?? []
  const recognizedWorkPackages: WorkPackage[] = recognitionResult?.milestones.flatMap((milestone) => milestone.workPackages.map((workPackage) => ({
    id: `work-package-${projectId}-${workPackage.tempId}`,
    projectId,
    milestoneId: `milestone-${projectId}-${milestone.tempId}`,
    title: workPackage.title,
    objective: workPackage.objective,
    order: workPackage.order,
    taskIds: tasks.filter((task) => task.workPackageId === `work-package-${projectId}-${workPackage.tempId}`).map((task) => task.id),
    evidenceIds: workPackage.evidenceIds,
    createdAt: now,
    updatedAt: now,
  }))) ?? []
  const pointById = new Map(recognitionResult?.timePoints.map((point) => [point.tempId, point]) ?? [])
  const recognizedEvents: Event[] = recognitionResult?.events.filter((event) => event.selected !== false).map((event) => ({
    id: `event-${projectId}-${event.tempId}`,
    projectId,
    title: event.title,
    description: event.description,
    startAt: event.startTimePointTempId ? pointById.get(event.startTimePointTempId)?.normalizedValue ?? null : null,
    endAt: event.endTimePointTempId ? pointById.get(event.endTimePointTempId)?.normalizedValue ?? null : null,
    location: event.location ?? undefined,
    evidenceIds: event.evidenceIds,
    needsConfirmation: event.inferenceLevel !== 'explicit' || !event.startTimePointTempId || Boolean(pointById.get(event.startTimePointTempId)?.needsConfirmation),
    createdAt: now,
    updatedAt: now,
  })) ?? []
  if (standalone) return { tasks, project: null, workPackages: [], events: recognizedEvents.map((event) => ({ ...event, projectId: undefined })) }
  if (!existingProject) {
    const project = createProjectFromConfirmation(source, items[0].suggestion, tasks, now)
    return {
      tasks,
      project: {
        ...project,
        title: recognitionResult?.projectSuggestion?.title.value || project.title,
        category: recognitionResult?.projectSuggestion?.category.value || project.category,
        objective: recognitionResult?.projectSuggestion?.objective.value,
        description: recognitionResult?.projectSuggestion?.description.value || project.description,
        milestones: recognizedMilestones.length ? recognizedMilestones : project.milestones,
        evidenceIds: recognitionResult?.projectSuggestion?.title.evidenceIds,
        currentMilestoneId: recognizedMilestones[0]?.id,
      },
      workPackages: recognizedWorkPackages,
      events: recognizedEvents,
    }
  }
  return {
    tasks,
    project: {
      ...existingProject,
      taskIds: [...new Set([...existingProject.taskIds, ...tasks.map((task) => task.id)])],
      sourceIds: [...new Set([...existingProject.sourceIds, source.id])],
      milestones: recognizedMilestones.length
        ? [
            ...existingProject.milestones.map((current) => {
              const incoming = recognizedMilestones.find((milestone) => milestone.title === current.title)
              return incoming ? {
                ...current,
                objective: current.objective || incoming.objective,
                taskIds: [...new Set([...(current.taskIds ?? []), ...(incoming.taskIds ?? [])])],
                workPackageIds: [...new Set([...(current.workPackageIds ?? []), ...(incoming.workPackageIds ?? [])])],
                evidenceIds: [...new Set([...(current.evidenceIds ?? []), ...(incoming.evidenceIds ?? [])])],
                dueAt: [current.dueAt, incoming.dueAt].filter(Boolean).sort()[0],
              } : current
            }),
            ...recognizedMilestones.filter((milestone) => !existingProject.milestones.some((current) => current.title === milestone.title)),
          ]
        : [...existingProject.milestones, ...tasks.map((task) => createTaskMilestone(existingProject.id, task, now))],
      updatedAt: now,
    },
    workPackages: recognizedWorkPackages,
    events: recognizedEvents,
  }
}
