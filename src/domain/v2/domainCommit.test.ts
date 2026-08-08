import { describe, expect, it } from 'vitest'
import type { EvidenceReference } from '../../types'
import type { RecognitionResult, TaskSuggestionV2 } from '../../recognition/types'
import { buildDomainCommitPlan, commitDomainPlan, type DomainCommitSelection } from './domainCommit'
import { createGoldenWorkspaceV8 } from './fixtures'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from './repository'
import type { WorkspaceV8 } from './types'

const NOW = '2026-08-08T12:00:00.000Z'

function task(tempId: string, title: string, options: Partial<TaskSuggestionV2> = {}): TaskSuggestionV2 {
  return {
    tempId, parentTempId: null, hierarchyType: 'task', title, actionVerb: '完成', actionObject: title,
    description: `${title}说明`, completionCriteria: [`${title}完成`], estimatedMinutes: 60,
    statusSuggestion: 'todo', prioritySuggestion: 'medium', dependencyTempIds: [], materialTempIds: [],
    timePointTempIds: [], evidenceIds: [], confidence: 0.95, inferenceLevel: 'explicit',
    userConfirmationRequired: true, selected: true, ...options,
  }
}

function evidence(index: number): EvidenceReference {
  return {
    id: `e${index}`, sourceId: 'source-competition', page: index <= 5 ? 1 : 2,
    textStart: index * 10, textEnd: index * 10 + 8, quote: `证据片段 ${index}`,
    quotedText: `证据片段 ${index}`, field: index <= 5 ? 'title' : 'materials', extractionMethod: 'ai', confidence: 0.98,
  }
}

function recognitionResult(): RecognitionResult {
  const t1 = task('t1', '填写报名表', { materialTempIds: ['mat1'], timePointTempIds: ['tp1'], evidenceIds: ['e1'] })
  const t1s = task('t1s', '核对团队信息', { hierarchyType: 'subtask', parentTempId: 't1', evidenceIds: ['e2'] })
  const t2 = task('t2', '制作参赛作品', { dependencyTempIds: ['t1'], timePointTempIds: ['tp2'], evidenceIds: ['e3'] })
  const t2s = task('t2s', '导出作品 PDF', { hierarchyType: 'subtask', parentTempId: 't2', materialTempIds: ['mat3'], evidenceIds: ['e4'] })
  const t3 = task('t3', '提交参赛材料', { dependencyTempIds: ['t2'], materialTempIds: ['mat2', 'mat3'], timePointTempIds: ['tp3'], evidenceIds: ['e5'] })
  const t4 = task('t4', '准备答辩讲稿', { dependencyTempIds: ['t3'], materialTempIds: ['mat4'], timePointTempIds: ['tp4'], evidenceIds: ['e6'] })
  const t5 = task('t5', '参加现场答辩', { dependencyTempIds: ['t4'], timePointTempIds: ['tp5'], evidenceIds: ['e7'] })
  return {
    schemaVersion: '2.0', promptVersion: 'recognition-2.0.0', modelName: 'deepseek-v4-flash', createdAt: NOW,
    sourceSummary: { title: '匿名创新比赛通知', sourceType: 'text', notificationType: 'new_project', summary: '比赛完整流程', requiresAction: true, actionReason: '包含明确任务' },
    projectMatch: { decision: 'new_project', matchedProjectId: null, suggestedProjectTitle: '匿名创新比赛', confidence: 0.99, reasons: ['原文明示'] },
    projectSuggestion: {
      title: { value: '匿名创新比赛', evidenceIds: ['e1'], confidence: 0.99, inferenceLevel: 'explicit' },
      category: { value: '比赛', evidenceIds: ['e1'], confidence: 0.99, inferenceLevel: 'explicit' },
      objective: { value: '完成报名、作品和答辩', evidenceIds: ['e1'], confidence: 0.95, inferenceLevel: 'explicit' },
      description: { value: '匿名比赛事务', evidenceIds: ['e1'], confidence: 0.95, inferenceLevel: 'explicit' },
    },
    milestones: [
      { tempId: 'm1', title: '报名', objective: '完成报名', order: 1, evidenceIds: ['e1'], workPackages: [{ tempId: 'wp1', title: '报名资料', objective: '核对报名资料', order: 1, evidenceIds: ['e2'], tasks: [t1, t1s] }], tasks: [] },
      { tempId: 'm2', title: '制作', objective: '完成作品', order: 2, evidenceIds: ['e3'], workPackages: [], tasks: [t2, t2s] },
      { tempId: 'm3', title: '提交', objective: '提交材料', order: 3, evidenceIds: ['e5'], workPackages: [], tasks: [t3] },
      { tempId: 'm4', title: '答辩', objective: '完成答辩', order: 4, evidenceIds: ['e6'], workPackages: [], tasks: [t4, t5] },
    ],
    standaloneTasks: [],
    materials: [
      { tempId: 'mat1', name: '报名表', required: true, formatRequirements: ['DOCX'], namingRequirements: ['团队名-报名表'], quantity: 1, submissionChannel: '报名系统', relatedTaskTempIds: ['t1'], evidenceIds: ['e2'], confidence: 0.98, selected: true },
      { tempId: 'mat2', name: '原创声明', required: true, formatRequirements: ['PDF'], namingRequirements: [], quantity: 1, submissionChannel: '报名系统', relatedTaskTempIds: ['t3'], evidenceIds: ['e8'], confidence: 0.98, selected: true },
      { tempId: 'mat3', name: '作品 PDF', required: true, formatRequirements: ['PDF/A'], namingRequirements: ['学校-团队-作品名'], quantity: 1, submissionChannel: '比赛系统', relatedTaskTempIds: ['t2s', 't3'], evidenceIds: ['e9'], confidence: 0.99, selected: true },
      { tempId: 'mat4', name: '答辩 PPT', required: true, formatRequirements: ['PPTX'], namingRequirements: [], quantity: 1, submissionChannel: '现场携带', relatedTaskTempIds: ['t4'], evidenceIds: ['e10'], confidence: 0.95, selected: true },
    ],
    timePoints: [
      { tempId: 'tp1', type: 'registration_deadline', rawText: '8月10日18:00前报名', normalizedValue: '2026-08-10T18:00', timezone: 'Asia/Shanghai', isAllDay: false, precision: 'exact', needsConfirmation: false, relatedTaskTempIds: ['t1'], relatedMaterialTempIds: ['mat1'], evidenceIds: ['e1'], confidence: 0.99, selected: true },
      { tempId: 'tp2', type: 'task_deadline', rawText: '8月20日完成作品', normalizedValue: '2026-08-20', timezone: 'Asia/Shanghai', isAllDay: true, precision: 'date_only', needsConfirmation: false, relatedTaskTempIds: ['t2'], relatedMaterialTempIds: [], evidenceIds: ['e3'], confidence: 0.98, selected: true },
      { tempId: 'tp3', type: 'submission_deadline', rawText: '8月25日17:00提交', normalizedValue: '2026-08-25T17:00', timezone: 'Asia/Shanghai', isAllDay: false, precision: 'exact', needsConfirmation: false, relatedTaskTempIds: ['t3'], relatedMaterialTempIds: ['mat2', 'mat3'], evidenceIds: ['e5'], confidence: 0.99, selected: true },
      { tempId: 'tp4', type: 'planned_start', rawText: '答辩前一周开始', normalizedValue: null, timezone: 'Asia/Shanghai', isAllDay: false, precision: 'relative', needsConfirmation: true, relatedTaskTempIds: ['t4'], relatedMaterialTempIds: [], evidenceIds: ['e6'], confidence: 0.7, selected: true },
      { tempId: 'tp5', type: 'event_start', rawText: '9月2日14:00答辩', normalizedValue: '2026-09-02T14:00', timezone: 'Asia/Shanghai', isAllDay: false, precision: 'exact', needsConfirmation: false, relatedTaskTempIds: ['t5'], relatedMaterialTempIds: [], evidenceIds: ['e7'], confidence: 0.99, selected: true },
    ],
    events: [{ tempId: 'ev1', title: '现场答辩', description: '参加答辩', startTimePointTempId: 'tp5', endTimePointTempId: null, location: '校内会议室', evidenceIds: ['e7'], confidence: 0.99, inferenceLevel: 'explicit', selected: true }],
    evidence: Array.from({ length: 10 }, (_, index) => evidence(index + 1)), conflicts: [], ambiguities: [], ignoredContent: [],
    quality: { overallConfidence: 0.95, hierarchyConfidence: 0.94, dateConfidence: 0.95, evidenceCoverage: 1, duplicateRisk: 0, overFragmentationRisk: 0, missingActionRisk: 0, needsHumanReview: true, reviewReasons: ['需用户确认'] },
  }
}

function draftWorkspace(): WorkspaceV8 {
  const workspace = createGoldenWorkspaceV8()
  const result = recognitionResult()
  return {
    ...workspace,
    sources: workspace.sources.map((item) => ({ ...item, status: 'needs_review' as const })),
    extractionDrafts: [{ id: 'draft-rich', recognitionRunId: 'recognition-run-1', status: 'needs_review', result, commitOperationIds: [], acceptedEntityTempIds: [], rejectedEntityTempIds: [], createdAt: NOW, updatedAt: NOW }],
    projects: [], milestones: [], workPackages: [], tasks: [], materials: [], timePoints: [], events: [], evidenceRefs: [], historyRecords: [], reminderRecords: [],
  }
}

const fullSelection: DomainCommitSelection = {
  taskTempIds: ['t1', 't1s', 't2', 't2s', 't3', 't4', 't5'],
  materialTempIds: ['mat1', 'mat2', 'mat3', 'mat4'], timePointTempIds: ['tp1', 'tp2', 'tp3', 'tp4', 'tp5'], eventTempIds: ['ev1'],
}

describe('B3 rich RecognitionResult domain atomic commit', () => {
  it('preserves the complete accepted graph through atomic commit and reload', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    const workspace = draftWorkspace()
    await repository.save(workspace)
    const plan = buildDomainCommitPlan(workspace, 'draft-rich', fullSelection, NOW)
    const committed = await commitDomainPlan(repository, plan, NOW)
    expect(committed.projects).toHaveLength(1)
    expect(committed.milestones).toHaveLength(4)
    expect(committed.workPackages).toHaveLength(1)
    expect(committed.tasks).toHaveLength(7)
    expect(committed.tasks.filter((item) => item.parentTaskId)).toHaveLength(2)
    expect(committed.materials).toHaveLength(4)
    expect(committed.materials.find((item) => item.name === '作品 PDF')).toMatchObject({ formatRequirements: ['PDF/A'], namingRequirements: ['学校-团队-作品名'], submissionChannel: '比赛系统' })
    expect(committed.timePoints).toHaveLength(5)
    expect(committed.events).toHaveLength(1)
    expect(committed.events[0].startTimePointId).toBe('time:draft-rich:tp5')
    expect(committed.evidenceRefs).toHaveLength(10)
    expect(committed.evidenceRefs[0]).toMatchObject({ quotedText: '证据片段 1', page: 1, fieldPath: 'title' })
    expect(committed.historyRecords.length).toBeGreaterThanOrEqual(20)
    expect((await repository.load())?.tasks).toEqual(committed.tasks)
    expect(committed.timePoints.some((item) => item.normalizedValue?.startsWith('1970-01-01'))).toBe(false)
  })

  it('is idempotent when the same confirmation operation is repeated', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    const workspace = draftWorkspace()
    await repository.save(workspace)
    const plan = buildDomainCommitPlan(workspace, 'draft-rich', fullSelection, NOW)
    await commitDomainPlan(repository, plan, NOW)
    const repeated = await commitDomainPlan(repository, plan, NOW)
    expect(repeated.tasks).toHaveLength(7)
    expect(repeated.materials).toHaveLength(4)
    expect(repeated.extractionDrafts[0].commitOperationIds).toEqual([plan.operationId])
  })

  it('supports partial confirmation while rejected suggestions stay absent', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    const workspace = draftWorkspace()
    await repository.save(workspace)
    const selection: DomainCommitSelection = {
      taskTempIds: ['t1', 't1s'], materialTempIds: ['mat1'], timePointTempIds: ['tp1'], eventTempIds: [],
      rejectedTempIds: ['t2', 'mat3'], taskOverrides: { t1: { title: '填写并提交报名表' } },
    }
    const committed = await commitDomainPlan(repository, buildDomainCommitPlan(workspace, 'draft-rich', selection, NOW), NOW)
    expect(committed.tasks.map((item) => item.title)).toEqual(['填写并提交报名表', '核对团队信息'])
    expect(committed.tasks.some((item) => item.legacyData?.recognitionTempId === 't2')).toBe(false)
    expect(committed.extractionDrafts[0].status).toBe('partially_confirmed')
    expect(committed.extractionDrafts[0].rejectedEntityTempIds).toEqual(expect.arrayContaining(['t2', 'mat3']))
  })

  it('prevents orphan subtasks, missing dependencies and missing event times', () => {
    const workspace = draftWorkspace()
    expect(() => buildDomainCommitPlan(workspace, 'draft-rich', { taskTempIds: ['t1s'], materialTempIds: [], timePointTempIds: [], eventTempIds: [] }, NOW)).toThrow('DOMAIN_COMMIT_PARENT_REQUIRED')
    expect(() => buildDomainCommitPlan(workspace, 'draft-rich', { taskTempIds: ['t2'], materialTempIds: [], timePointTempIds: [], eventTempIds: [] }, NOW)).toThrow('DOMAIN_COMMIT_DEPENDENCY_REQUIRED')
    expect(() => buildDomainCommitPlan(workspace, 'draft-rich', { taskTempIds: [], materialTempIds: [], timePointTempIds: [], eventTempIds: ['ev1'] }, NOW)).toThrow('DOMAIN_COMMIT_EVENT_TIME_REQUIRED')
  })

  it('rolls back the entire repository transaction when a plan is invalid', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    const workspace = draftWorkspace()
    await repository.save(workspace)
    const plan = buildDomainCommitPlan(workspace, 'draft-rich', fullSelection, NOW)
    plan.create.tasks[0].projectId = 'missing-project'
    await expect(commitDomainPlan(repository, plan, NOW)).rejects.toThrow('DOMAIN_COMMIT_INVALID')
    expect(await repository.load()).toEqual(workspace)
  })
})
