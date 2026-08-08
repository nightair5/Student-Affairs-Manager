import type { WorkspaceV8 } from './types'

const NOW = '2026-08-08T08:00:00.000Z'
const SOURCE_VERSION_ID = 'source-version-competition-v1'

export function createGoldenWorkspaceV8(): WorkspaceV8 {
  const milestones = ['报名', '制作', '提交', '答辩'].map((title, index) => ({
    id: `milestone-${index + 1}`,
    projectId: 'project-competition',
    title,
    objective: `完成${title}阶段`,
    sortOrder: index + 1,
    status: 'active' as const,
    createdAt: NOW,
    updatedAt: NOW,
  }))
  const baseTask = (id: string, title: string, milestoneId: string, parentTaskId: string | null = null) => ({
    id,
    projectId: 'project-competition',
    milestoneId,
    workPackageId: milestoneId === 'milestone-1' ? 'work-package-registration' : null,
    parentTaskId,
    title,
    description: null,
    nextAction: title,
    status: 'todo' as const,
    estimatedMinutes: 60,
    manualPriority: null,
    snoozedUntil: null,
    dependencyIds: [] as string[],
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  })
  const tasks = [
    baseTask('task-1', '填写报名表', 'milestone-1'),
    baseTask('task-1-sub', '核对团队信息', 'milestone-1', 'task-1'),
    baseTask('task-2', '制作参赛作品', 'milestone-2'),
    baseTask('task-2-sub', '导出作品 PDF', 'milestone-2', 'task-2'),
    baseTask('task-3', '提交参赛材料', 'milestone-3'),
    baseTask('task-4', '准备答辩讲稿', 'milestone-4'),
    baseTask('task-5', '参加现场答辩', 'milestone-4'),
  ]
  tasks[2].dependencyIds = ['task-1']
  tasks[4].dependencyIds = ['task-2']
  tasks[5].dependencyIds = ['task-3']
  tasks[6].dependencyIds = ['task-4']

  const timePoints: WorkspaceV8['timePoints'] = [
    { id: 'time-1', projectId: 'project-competition', milestoneId: 'milestone-1', taskId: 'task-1', materialId: null, eventId: null, type: 'registration_deadline', rawText: '8月10日18:00前报名', normalizedValue: '2026-08-10T18:00', timezone: 'Asia/Shanghai', isAllDay: false, precision: 'exact', needsConfirmation: false, createdAt: NOW, updatedAt: NOW },
    { id: 'time-2', projectId: 'project-competition', milestoneId: 'milestone-2', taskId: 'task-2', materialId: null, eventId: null, type: 'task_deadline', rawText: '8月20日完成作品', normalizedValue: '2026-08-20', timezone: null, isAllDay: true, precision: 'date_only', needsConfirmation: false, createdAt: NOW, updatedAt: NOW },
    { id: 'time-3', projectId: 'project-competition', milestoneId: 'milestone-3', taskId: 'task-3', materialId: null, eventId: null, type: 'submission_deadline', rawText: '8月25日17:00提交', normalizedValue: '2026-08-25T17:00', timezone: 'Asia/Shanghai', isAllDay: false, precision: 'exact', needsConfirmation: false, createdAt: NOW, updatedAt: NOW },
    { id: 'time-4', projectId: 'project-competition', milestoneId: 'milestone-4', taskId: 'task-4', materialId: null, eventId: null, type: 'planned_start', rawText: '答辩前一周开始准备', normalizedValue: null, timezone: null, isAllDay: false, precision: 'relative', needsConfirmation: true, createdAt: NOW, updatedAt: NOW },
    { id: 'time-5', projectId: 'project-competition', milestoneId: 'milestone-4', taskId: null, materialId: null, eventId: 'event-defense', type: 'event_start', rawText: '9月2日14:00答辩', normalizedValue: '2026-09-02T14:00', timezone: 'Asia/Shanghai', isAllDay: false, precision: 'exact', needsConfirmation: false, createdAt: NOW, updatedAt: NOW },
  ]
  const materials: WorkspaceV8['materials'] = ['报名表', '原创声明', '作品 PDF', '答辩 PPT'].map((name, index) => ({
    id: `material-${index + 1}`,
    projectId: 'project-competition',
    name,
    required: true,
    status: index === 0 ? 'preparing' as const : 'missing' as const,
    requirements: [],
    formatRequirements: index === 2 ? ['PDF'] : [],
    namingRequirements: index === 2 ? ['学校-团队-作品名'] : [],
    relatedTaskIds: [index < 2 ? 'task-1' : index === 2 ? 'task-3' : 'task-4'],
    deadlineTimePointId: index < 2 ? 'time-1' : index === 2 ? 'time-3' : null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  }))
  const evidenceRefs: WorkspaceV8['evidenceRefs'] = Array.from({ length: 10 }, (_, index) => ({
    id: `evidence-${index + 1}`,
    sourceVersionId: SOURCE_VERSION_ID,
    page: index < 5 ? 1 : 2,
    textStart: index * 20,
    textEnd: index * 20 + 10,
    quotedText: `匿名通知依据片段 ${index + 1}`,
    bbox: null,
    fieldPath: index < 5 ? `tasks[${index}].title` : `materials[${index - 5}].name`,
    extractionMethod: 'manual' as const,
    confidence: 1,
    createdAt: NOW,
  }))
  return {
    schemaVersion: 8,
    workspace: { id: 'workspace-local', title: '学生事务管家本机工作区', createdAt: NOW, updatedAt: NOW, legacyData: { legacyCustomField: { foo: 'bar' } } },
    settings: { defaultTimezone: 'Asia/Shanghai', locale: 'zh-CN' },
    sources: [{ id: 'source-competition', workspaceId: 'workspace-local', type: 'text', title: '匿名比赛通知', status: 'confirmed', currentVersionId: SOURCE_VERSION_ID, createdAt: NOW, updatedAt: NOW }],
    sourceVersions: [{ id: SOURCE_VERSION_ID, sourceId: 'source-competition', versionNo: 1, contentHash: 'sha256:fixture', rawText: '匿名比赛通知完整文字', rawTextRef: null, createdAt: NOW }],
    recognitionRuns: [{ id: 'recognition-run-1', sourceVersionId: SOURCE_VERSION_ID, provider: 'local-rules', modelName: 'local-rules', promptVersion: 'recognition-2.0.0', schemaVersion: '2.0', pipelineVersion: 'fixture', status: 'succeeded', startedAt: NOW, completedAt: NOW, durationMs: 10, tokenUsage: null, qualityFlags: [], errorCode: null }],
    extractionDrafts: [{ id: 'draft-1', recognitionRunId: 'recognition-run-1', status: 'confirmed', result: null, createdAt: NOW, updatedAt: NOW }],
    projects: [{ id: 'project-competition', workspaceId: 'workspace-local', title: '匿名创新比赛', category: '比赛', objective: '完成报名、作品提交与答辩', status: 'active', createdAt: NOW, updatedAt: NOW, version: 1 }],
    milestones,
    workPackages: [{ id: 'work-package-registration', projectId: 'project-competition', milestoneId: 'milestone-1', title: '报名资料', objective: '完成报名资料核对', sortOrder: 1, createdAt: NOW, updatedAt: NOW }],
    tasks,
    materials,
    timePoints,
    events: [{ id: 'event-defense', projectId: 'project-competition', title: '参加现场答辩', description: null, startTimePointId: 'time-5', endTimePointId: null, location: '校内会议室', createdAt: NOW, updatedAt: NOW }],
    evidenceRefs,
    changeProposals: [],
    historyRecords: [{ id: 'history-1', entityType: 'task', entityId: 'task-1', action: 'updated', fieldName: 'title', before: '填写表格', after: '填写报名表', actor: 'user', reason: '人工核对', sourceVersionId: SOURCE_VERSION_ID, changedAt: NOW }],
    reminderRecords: [{ id: 'reminder-1', taskId: 'task-1', channel: 'browser', scheduledAt: '2026-08-10T09:00:00+08:00', status: 'scheduled', errorCode: null, sentAt: null }],
    preferences: { onboardingCompletedAt: null },
    migrationMetadata: [],
    savedAt: NOW,
  }
}
