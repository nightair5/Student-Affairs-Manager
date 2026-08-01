import type {
  DraftItem,
  CourseBlock,
  IntegrationState,
  ExtractionDraft,
  ParsedSuggestion,
  Project,
  Milestone,
  RiskFlag,
  Source,
  Task,
  WorkspaceData,
} from '../types'

const minute = 60_000
const day = 24 * 60 * minute

export function createWorkspaceData(
  tasks: Task[],
  sources: Source[],
  drafts: ExtractionDraft[] = [],
  projects: Project[] = [],
  courseBlocks: CourseBlock[] = [],
  integrations: IntegrationState = createIntegrationState(),
): WorkspaceData {
  return {
    schemaVersion: 5,
    tasks,
    sources,
    drafts,
    projects,
    courseBlocks,
    integrations,
    savedAt: new Date().toISOString(),
  }
}

export function createIntegrationState(): IntegrationState {
  return {
    sync: {
      endpoint: 'http://127.0.0.1:8787',
    },
  }
}

export function createExtractionDraft(
  sourceId: string,
  suggestions: ParsedSuggestion[],
  now = new Date().toISOString(),
): ExtractionDraft {
  return {
    id: `draft-${Date.now()}`,
    sourceId,
    status: '待确认',
    createdAt: now,
    updatedAt: now,
    items: suggestions.map((suggestion, index): DraftItem => ({
      id: `draft-item-${Date.now()}-${index}`,
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
): ExtractionDraft {
  const now = new Date().toISOString()
  const items = draft.items.map((item) =>
    item.id === itemId
      ? {
          ...item,
          suggestion: { ...item.suggestion, ...patch },
          status: status ?? item.status,
          updatedAt: now,
        }
      : item,
  )
  return { ...draft, items, status: deriveDraftStatus(items), updatedAt: now }
}

export function taskSignals(task: Task, now = new Date()): {
  risks: RiskFlag[]
  reason: string
} {
  const risks: RiskFlag[] = []
  const reasons: string[] = []
  const deadline = new Date(task.deadline).getTime()
  const remaining = deadline - now.getTime()
  const missing = task.materials.filter((item) => !item.done).length

  if (Number.isFinite(deadline) && remaining < 0) {
    risks.push('已逾期')
    reasons.push('已逾期')
  } else if (remaining <= day) {
    risks.push('紧急')
    reasons.push('24 小时内截止')
  }
  if (missing) {
    risks.push('缺材料')
    reasons.push(`缺 ${missing} 项材料`)
  }
  if (task.dependencies.length) {
    risks.push('有依赖')
    reasons.push('存在前置事项')
  }
  if (task.riskFlags.includes('待确认')) {
    risks.push('待确认')
    reasons.push('关键信息待核对')
  }

  return {
    risks: [...new Set(risks)],
    reason: reasons.join('；') || '按你的优先级与截止时间排序',
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
        after: '由用户确认演示识别建议后创建',
        changedAt: now,
        actor: 'user',
      },
    ],
  }
  const signal = taskSignals(base)
  return { ...base, riskFlags: signal.risks, priorityReason: signal.reason }
}
