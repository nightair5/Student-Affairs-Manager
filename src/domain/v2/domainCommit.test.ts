import { describe, expect, it } from 'vitest'
import type { EvidenceReference, ParsedSuggestion } from '../../types'
import { createWorkspaceData } from '../../lib/workspace'
import type { RecognitionResult, TaskSuggestionV2 } from '../../recognition/types'
import { isRecognitionResult } from '../../recognition/schema'
import {
  buildDomainCommitPlan,
  commitDomainPlan,
  mergeRecognitionTasks,
  recognitionResultFromManualSuggestion,
  selectionFromDraftItems,
  splitRecognitionTask,
  type DomainCommitSelection,
} from './domainCommit'
import { createGoldenWorkspaceV8 } from './fixtures'
import { mergeLegacyViewIntoWorkspaceV8, workspaceV8ToLegacyView } from './legacyView'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from './repository'
import type { WorkspaceV8 } from './types'
import { validateWorkspaceV8 } from './validators/workspaceValidator'

const NOW = '2026-08-08T12:00:00.000Z'
const LATER = '2026-08-08T13:00:00.000Z'

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

function draftWorkspace(result = recognitionResult()): WorkspaceV8 {
  const workspace = createGoldenWorkspaceV8()
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
    const view = workspaceV8ToLegacyView(committed)
    const autosaveView = createWorkspaceData(
      view.tasks, view.sources, view.drafts, view.projects, view.courseBlocks, view.integrations,
      view.knowledgeSettings, view.workPackages, view.events, view.migrationLog, view.recognitionFeedback, view.legacyData,
    )
    expect(validateWorkspaceV8(mergeLegacyViewIntoWorkspaceV8(committed, autosaveView))).toEqual({ valid: true, issues: [] })
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
      rejectedTempIds: ['t2', 'mat3'], taskOverrides: { t1: { title: '填写并提交报名表', deadline: '2026-08-11T09:30' } },
    }
    const committed = await commitDomainPlan(repository, buildDomainCommitPlan(workspace, 'draft-rich', selection, NOW), NOW)
    expect(committed.tasks.map((item) => item.title)).toEqual(['填写并提交报名表', '核对团队信息'])
    expect(committed.tasks.some((item) => item.legacyData?.recognitionTempId === 't2')).toBe(false)
    expect(committed.timePoints[0]).toMatchObject({ normalizedValue: '2026-08-11T09:30', timezone: 'Asia/Shanghai', precision: 'exact' })
    expect(committed.extractionDrafts[0].status).toBe('partially_confirmed')
    expect(committed.extractionDrafts[0].rejectedEntityTempIds).toEqual(expect.arrayContaining(['t2', 'mat3']))
  })

  it('allows a later partial confirmation to reference a predecessor already committed from the same draft', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    const workspace = draftWorkspace()
    await repository.save(workspace)
    const first = await commitDomainPlan(repository, buildDomainCommitPlan(workspace, 'draft-rich', {
      taskTempIds: ['t1'], materialTempIds: [], timePointTempIds: [], eventTempIds: [],
    }, NOW), NOW)
    const secondPlan = buildDomainCommitPlan(first, 'draft-rich', {
      taskTempIds: ['t2'], materialTempIds: [], timePointTempIds: [], eventTempIds: [],
    }, NOW)
    expect(secondPlan.create.tasks[0].dependencyIds).toEqual(['task:draft-rich:t1'])
    const second = await commitDomainPlan(repository, secondPlan, NOW)
    expect(second.tasks.map((item) => item.id)).toEqual(expect.arrayContaining(['task:draft-rich:t1', 'task:draft-rich:t2']))
    expect((await repository.load())?.tasks.find((item) => item.id === 'task:draft-rich:t2')?.dependencyIds)
      .toEqual(['task:draft-rich:t1'])
  })

  it('keeps a split inside the rich draft and commits both tasks across sequential reload-safe confirmations', async () => {
    const result = splitRecognitionTask(recognitionResult(), 't1', 't1-split', '提交报名附件')
    expect(isRecognitionResult(result)).toBe(true)
    const splitTask = result.milestones[0].workPackages[0].tasks.find((item) => item.tempId === 't1-split')!
    const splitMaterialTempId = splitTask.materialTempIds[0]
    const splitTimePointTempId = splitTask.timePointTempIds[0]
    expect(splitMaterialTempId).not.toBe('mat1')
    expect(splitTimePointTempId).not.toBe('tp1')
    expect(result.materials.find((item) => item.tempId === splitMaterialTempId)?.relatedTaskTempIds).toEqual(['t1-split'])
    expect(result.timePoints.find((item) => item.tempId === splitTimePointTempId)).toMatchObject({
      relatedTaskTempIds: ['t1-split'], relatedMaterialTempIds: [splitMaterialTempId],
    })
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    const workspace = draftWorkspace(result)
    await repository.save(workspace)
    const first = await commitDomainPlan(repository, buildDomainCommitPlan(workspace, 'draft-rich', {
      taskTempIds: ['t1'], materialTempIds: ['mat1'], timePointTempIds: ['tp1'], eventTempIds: [],
      taskOverrides: { t1: { deadline: '2026-08-11T09:30' } },
    }, NOW), NOW)
    const second = await commitDomainPlan(repository, buildDomainCommitPlan(first, 'draft-rich', {
      taskTempIds: ['t1-split'], materialTempIds: [splitMaterialTempId], timePointTempIds: [splitTimePointTempId], eventTempIds: [],
      taskOverrides: { 't1-split': { deadline: '2026-08-12T18:45' } },
    }, LATER), LATER)
    expect(second.tasks.filter((item) => ['t1', 't1-split'].includes(String(item.legacyData?.recognitionTempId)))).toHaveLength(2)
    expect(second.materials.find((item) => item.id === 'material:draft-rich:mat1')?.relatedTaskIds).toEqual(['task:draft-rich:t1'])
    expect(second.materials.find((item) => item.id === `material:draft-rich:${splitMaterialTempId}`)?.relatedTaskIds)
      .toEqual(['task:draft-rich:t1-split'])
    expect(second.timePoints.find((item) => item.id === 'time:draft-rich:tp1')).toMatchObject({
      normalizedValue: '2026-08-11T09:30', relatedTaskIds: ['task:draft-rich:t1'],
    })
    expect(second.timePoints.find((item) => item.id === `time:draft-rich:${splitTimePointTempId}`)).toMatchObject({
      normalizedValue: '2026-08-12T18:45', relatedTaskIds: ['task:draft-rich:t1-split'],
    })
    const reloaded = await repository.load()
    expect(reloaded?.tasks).toHaveLength(2)
    expect(reloaded && workspaceV8ToLegacyView(reloaded).drafts[0].items.map((item) => item.suggestion.id))
      .toContain('t1-split')
    expect(reloaded && workspaceV8ToLegacyView(reloaded).tasks.map((item) => [item.id, item.deadline]))
      .toEqual(expect.arrayContaining([
        ['task:draft-rich:t1', '2026-08-11T09:30'],
        ['task:draft-rich:t1-split', '2026-08-12T18:45'],
      ]))
  })

  it('merges source references into the canonical target and keeps both task evidence records', async () => {
    const result = recognitionResult()
    const stageTasks = result.milestones[0].workPackages[0].tasks
    result.milestones[0].workPackages[0].tasks = stageTasks.map((item) => item.tempId === 't1s'
      ? { ...item, materialTempIds: ['mat2'], timePointTempIds: ['tp3'] }
      : item)
    result.materials = result.materials.map((item) => item.tempId === 'mat2'
      ? { ...item, relatedTaskTempIds: ['t1s'] }
      : item)
    result.timePoints = result.timePoints.map((item) => item.tempId === 'tp3'
      ? { ...item, relatedTaskTempIds: ['t1s'], relatedMaterialTempIds: ['mat2'] }
      : item)
    const mergedResult = mergeRecognitionTasks(result, 't1s', 't1')
    expect(isRecognitionResult(mergedResult)).toBe(true)
    const target = mergedResult.milestones[0].workPackages[0].tasks.find((item) => item.tempId === 't1')!
    expect(target.evidenceIds).toEqual(expect.arrayContaining(['e1', 'e2']))
    expect(target.materialTempIds).toEqual(expect.arrayContaining(['mat1', 'mat2']))
    expect(target.timePointTempIds).toEqual(expect.arrayContaining(['tp1', 'tp3']))
    expect(mergedResult.materials.find((item) => item.tempId === 'mat2')?.relatedTaskTempIds).toContain('t1')
    expect(mergedResult.timePoints.find((item) => item.tempId === 'tp3')?.relatedTaskTempIds).toContain('t1')

    const workspace = draftWorkspace(mergedResult)
    const reviewItems = workspaceV8ToLegacyView(workspace).drafts[0].items
    const targetItem = reviewItems.find((item) => item.suggestion.id === 't1')!
    const sourceItem = reviewItems.find((item) => item.suggestion.id === 't1s')!
    sourceItem.status = '已拒绝'
    const selection = selectionFromDraftItems(mergedResult, [targetItem, sourceItem])
    const plan = buildDomainCommitPlan(workspace, 'draft-rich', selection, NOW)
    expect(plan.create.evidenceRefs.map((item) => item.legacyData?.recognitionEvidenceId))
      .toEqual(expect.arrayContaining(['e1', 'e2']))
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await repository.save(workspace)
    const committed = await commitDomainPlan(repository, plan, NOW)
    expect(committed.tasks).toHaveLength(1)
    expect(committed.extractionDrafts[0].rejectedEntityTempIds).toContain('t1s')
    expect(committed.materials.find((item) => item.id === 'material:draft-rich:mat2')?.relatedTaskIds)
      .toContain('task:draft-rich:t1')
    expect((await repository.load())?.evidenceRefs.map((item) => item.legacyData?.recognitionEvidenceId))
      .toEqual(expect.arrayContaining(['e1', 'e2']))
  })

  it('records unique link_added history when later confirmation extends material and time relations', async () => {
    const result = recognitionResult()
    result.milestones[0].workPackages[0].tasks = result.milestones[0].workPackages[0].tasks.map((item) => (
      item.tempId === 't1s' ? { ...item, materialTempIds: ['mat1'], timePointTempIds: ['tp1'] } : item
    ))
    result.materials = result.materials.map((item) => item.tempId === 'mat1'
      ? { ...item, relatedTaskTempIds: [...item.relatedTaskTempIds, 't1s'] }
      : item)
    result.timePoints = result.timePoints.map((item) => item.tempId === 'tp1'
      ? { ...item, relatedTaskTempIds: [...item.relatedTaskTempIds, 't1s'] }
      : item)
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    const workspace = draftWorkspace(result)
    await repository.save(workspace)
    const first = await commitDomainPlan(repository, buildDomainCommitPlan(workspace, 'draft-rich', {
      taskTempIds: ['t1'], materialTempIds: ['mat1'], timePointTempIds: ['tp1'], eventTempIds: [],
    }, NOW), NOW)
    const secondPlan = buildDomainCommitPlan(first, 'draft-rich', {
      taskTempIds: ['t1s'], materialTempIds: ['mat1'], timePointTempIds: ['tp1'], eventTempIds: [],
    }, LATER)
    const linkHistory = secondPlan.create.historyRecords.filter((item) => item.action === 'link_added')
    expect(linkHistory).toHaveLength(2)
    expect(new Set(linkHistory.map((item) => item.id)).size).toBe(2)
    expect(linkHistory.map((item) => item.entityType)).toEqual(expect.arrayContaining(['material', 'time_point']))
    const second = await commitDomainPlan(repository, secondPlan, LATER)
    expect(second.materials.find((item) => item.id === 'material:draft-rich:mat1')).toMatchObject({
      relatedTaskIds: expect.arrayContaining(['task:draft-rich:t1', 'task:draft-rich:t1s']),
      updatedAt: LATER,
      version: 2,
    })
    expect(second.timePoints.find((item) => item.id === 'time:draft-rich:tp1')).toMatchObject({
      relatedTaskIds: expect.arrayContaining(['task:draft-rich:t1', 'task:draft-rich:t1s']),
      updatedAt: LATER,
    })
    const repeated = await commitDomainPlan(repository, secondPlan, LATER)
    expect(repeated.historyRecords.filter((item) => item.action === 'link_added')).toHaveLength(2)
  })

  it('fingerprints project choice, rejected selection and draft revision and rejects a stale plan transaction', async () => {
    const selection: DomainCommitSelection = {
      taskTempIds: ['t1'], materialTempIds: [], timePointTempIds: [], eventTempIds: [],
    }
    const workspace = draftWorkspace()
    const originalPlan = buildDomainCommitPlan(workspace, 'draft-rich', selection, NOW)
    const competingPlan = buildDomainCommitPlan(workspace, 'draft-rich', {
      ...selection,
      taskOverrides: { t1: { title: '另一标签页修改的报名任务' } },
    }, NOW)
    expect(competingPlan.operationId).not.toBe(originalPlan.operationId)
    expect(competingPlan.draftRevisionHash).toBe(originalPlan.draftRevisionHash)
    const rejectedPlan = buildDomainCommitPlan(workspace, 'draft-rich', { ...selection, rejectedTempIds: ['t2'] }, NOW)
    expect(rejectedPlan.operationId).not.toBe(originalPlan.operationId)

    const standaloneResult = recognitionResult()
    standaloneResult.projectMatch = {
      ...standaloneResult.projectMatch, decision: 'standalone_task', matchedProjectId: null,
    }
    const standaloneWorkspace = draftWorkspace(standaloneResult)
    const standalonePlan = buildDomainCommitPlan(standaloneWorkspace, 'draft-rich', selection, NOW)
    expect(standalonePlan.operationId).not.toBe(originalPlan.operationId)
    expect(standalonePlan.draftRevisionHash).not.toBe(originalPlan.draftRevisionHash)

    const revisedResult = recognitionResult()
    revisedResult.milestones[0].workPackages[0].tasks[0] = {
      ...revisedResult.milestones[0].workPackages[0].tasks[0], title: '填写新版报名表',
    }
    const revisedPlan = buildDomainCommitPlan(draftWorkspace(revisedResult), 'draft-rich', selection, NOW)
    expect(revisedPlan.operationId).not.toBe(originalPlan.operationId)
    expect(revisedPlan.draftRevisionHash).not.toBe(originalPlan.draftRevisionHash)

    const competingRepository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await competingRepository.save(workspace)
    const firstCommit = await commitDomainPlan(competingRepository, originalPlan, NOW)
    expect((await commitDomainPlan(competingRepository, originalPlan, NOW)).extractionDrafts[0].commitOperationIds)
      .toEqual(firstCommit.extractionDrafts[0].commitOperationIds)
    await expect(commitDomainPlan(competingRepository, competingPlan, NOW)).rejects.toThrow('DOMAIN_COMMIT_DRAFT_STALE')
    expect((await competingRepository.load())?.tasks[0].title).toBe('填写报名表')

    const staleRepository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await staleRepository.save(standaloneWorkspace)
    await expect(commitDomainPlan(staleRepository, originalPlan, NOW)).rejects.toThrow('DOMAIN_COMMIT_DRAFT_STALE')
    expect((await staleRepository.load())?.tasks).toHaveLength(0)
    expect((await staleRepository.load())?.projects).toHaveLength(0)
  })

  it('preserves manual category, duration, priority and materials through confirmation and reload', async () => {
    const manualSuggestion: ParsedSuggestion = {
      id: 'manual-task-1', title: '整理推免申请材料', category: '保研', deadline: '2026-08-18T20:30',
      estimatedMinutes: 135, nextAction: '核对申请表并整理证明', description: '用户手动录入', priority: '高',
      materials: ['申请表', '成绩证明'], evidence: '用户手动录入的任务', confidence: '高',
    }
    const result = recognitionResultFromManualSuggestion(recognitionResult(), manualSuggestion)
    expect(isRecognitionResult(result)).toBe(true)
    const workspace = draftWorkspace(result)
    const reviewItems = workspaceV8ToLegacyView(workspace).drafts[0].items
    expect(reviewItems[0].suggestion).toMatchObject({
      category: '保研', estimatedMinutes: 135, priority: '高', materials: ['申请表', '成绩证明'],
    })
    const plan = buildDomainCommitPlan(workspace, 'draft-rich', selectionFromDraftItems(result, reviewItems), NOW)
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await repository.save(workspace)
    const committed = await commitDomainPlan(repository, plan, NOW)
    expect(committed.projects).toHaveLength(0)
    expect(committed.tasks[0]).toMatchObject({ estimatedMinutes: 135, projectId: null })
    expect(committed.tasks[0].legacyData).toMatchObject({ category: '保研', priority: '高' })
    expect(committed.materials.map((item) => item.name)).toEqual(['申请表', '成绩证明'])
    const reloaded = await repository.load()
    expect(reloaded && workspaceV8ToLegacyView(reloaded).tasks[0]).toMatchObject({
      category: '保研', estimatedMinutes: 135, priority: '高',
    })
    expect(reloaded && workspaceV8ToLegacyView(reloaded).tasks[0].materials.map((item) => item.name))
      .toEqual(['申请表', '成绩证明'])
  })

  it('commits a selected event whose start time is independent from the accepted preparation task', () => {
    const result = recognitionResult()
    result.timePoints = result.timePoints.map((item) => item.tempId === 'tp5'
      ? { ...item, relatedTaskTempIds: [] }
      : item)
    const workspace = draftWorkspace(result)
    const preparationItem = workspaceV8ToLegacyView(workspace).drafts[0].items
      .find((item) => item.suggestion.id === 't1')!
    const selection = selectionFromDraftItems(result, [preparationItem])

    expect(selection).toMatchObject({
      taskTempIds: ['t1'],
      timePointTempIds: expect.arrayContaining(['tp1', 'tp5']),
      eventTempIds: ['ev1'],
    })
    const plan = buildDomainCommitPlan(workspace, 'draft-rich', selection, NOW)
    expect(plan.create.events).toHaveLength(1)
    expect(plan.create.events[0].startTimePointId).toBe('time:draft-rich:tp5')
    expect(plan.create.timePoints.map((item) => item.id)).toContain('time:draft-rich:tp5')
  })

  it('creates canonical materials from task material edits and includes WorkPackage evidence', () => {
    const workspace = draftWorkspace()
    const result = workspace.extractionDrafts[0].result!
    const editedItem = workspaceV8ToLegacyView(workspace).drafts[0].items.find((item) => item.suggestion.id === 't1')!
    editedItem.suggestion = { ...editedItem.suggestion, materials: ['补充证明'] }
    const editedPlan = buildDomainCommitPlan(workspace, 'draft-rich', selectionFromDraftItems(result, [editedItem]), NOW)
    expect(editedPlan.create.materials).toHaveLength(1)
    expect(editedPlan.create.materials[0]).toMatchObject({ name: '补充证明', relatedTaskIds: ['task:draft-rich:t1'] })

    const evidencePlan = buildDomainCommitPlan(workspace, 'draft-rich', {
      taskTempIds: ['t1'], materialTempIds: [], timePointTempIds: [], eventTempIds: [],
    }, NOW)
    expect(evidencePlan.create.evidenceRefs.map((item) => item.legacyData?.recognitionEvidenceId))
      .toEqual(expect.arrayContaining(['e1', 'e2']))
  })

  it('requires an explicit project decision instead of creating a project for an uncertain match', () => {
    const result = recognitionResult()
    result.projectMatch = { ...result.projectMatch, decision: 'uncertain', matchedProjectId: null }
    const workspace = draftWorkspace(result)
    expect(() => buildDomainCommitPlan(workspace, 'draft-rich', {
      taskTempIds: ['t1'], materialTempIds: [], timePointTempIds: [], eventTempIds: [],
    }, NOW)).toThrow('DOMAIN_COMMIT_PROJECT_DECISION_REQUIRED')
    expect(workspace.projects).toHaveLength(0)
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
