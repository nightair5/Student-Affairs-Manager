import { describe, expect, it } from 'vitest'
import { demoSources, demoTasks } from '../data/demo'
import { buildConfirmedProjectBatch, createExtractionDraft, createTaskMilestone, syncTaskMilestone, taskSignals, updateDraftItem } from './workspace'
import { buildLocalRecognition, recognitionToLegacySuggestions } from '../recognition/pipeline'

describe('P0 workspace rules', () => {
  it('keeps draft items independent for partial confirmation and rejection', () => {
    const draft = createExtractionDraft('source-1', [
      { id: 'one', title: '事项一', category: '课程', deadline: '2026-08-04T18:00', estimatedMinutes: 30, nextAction: '开始', description: '', priority: '中', materials: [], evidence: '8 月 4 日', confidence: '高' },
      { id: 'two', title: '事项二', category: '课程', deadline: '2026-08-04T20:00', estimatedMinutes: 30, nextAction: '开始', description: '', priority: '中', materials: [], evidence: '8 月 4 日 20:00', confidence: '高' },
    ])
    const partial = updateDraftItem(draft, draft.items[0].id, {}, '已确认')
    const rejected = updateDraftItem(partial, draft.items[1].id, {}, '已拒绝')

    expect(partial.status).toBe('部分确认')
    expect(rejected.status).toBe('部分确认')
    expect(rejected.items.map((item) => item.status)).toEqual(['已确认', '已拒绝'])
  })

  it('explains deadline and material risks without mutating the task', () => {
    const task = { ...demoTasks[0], deadline: '2026-08-01T20:00' }
    const result = taskSignals(task, new Date('2026-08-01T12:00:00'))

    expect(result.risks).toContain('紧急')
    expect(result.risks).toContain('缺材料')
    expect(result.reason).toContain('24 小时内截止')
    expect(task.riskFlags).toEqual(demoTasks[0].riskFlags)
  })

  it('uses source evidence when creating a draft', () => {
    const draft = createExtractionDraft(demoSources[0].id, [
      { id: 'one', title: '提交报名', category: '比赛', deadline: '2026-08-04T18:00', estimatedMinutes: 60, nextAction: '核对材料', description: '', priority: '高', materials: [], evidence: '8 月 4 日前提交报名表', confidence: '中' },
    ])

    expect(draft.items[0].suggestion.evidenceRefs?.[0]).toMatchObject({
      sourceId: demoSources[0].id,
      quote: '8 月 4 日前提交报名表',
    })
  })

  it('keeps a task-backed milestone in sync with confirmed task changes', () => {
    const task = demoTasks[0]
    const project = {
      id: 'project-1',
      title: '比赛项目',
      category: '比赛' as const,
      sourceIds: task.sourceIds,
      taskIds: [task.id],
      milestones: [createTaskMilestone('project-1', task)],
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }
    const nextTask = { ...task, title: '完成报名', status: '已完成' as const }
    expect(syncTaskMilestone(project, nextTask).milestones[0]).toMatchObject({
      title: '完成报名',
      status: '已完成',
    })
  })

  it('creates a project only when one or more draft items are confirmed', () => {
    const draft = createExtractionDraft(demoSources[0].id, [
      { id: 'one', title: '提交报名', category: '比赛', deadline: '2026-08-04T18:00', estimatedMinutes: 60, nextAction: '核对材料', description: '', priority: '高', materials: ['报名表'], evidence: '8 月 4 日前提交报名表', confidence: '中' },
    ], '2026-08-01T00:00:00.000Z')
    const batch = buildConfirmedProjectBatch(
      [draft.items[0]],
      demoSources[0],
      undefined,
      '2026-08-01T00:00:00.000Z',
    )

    expect(batch.tasks).toHaveLength(1)
    expect(batch.project).not.toBeNull()
    expect(batch.tasks[0].projectId).toBe(batch.project!.id)
    expect(batch.project!.taskIds).toEqual([batch.tasks[0].id])
    expect(batch.project!.milestones).toHaveLength(1)
    expect(batch.tasks[0].history[0].after).not.toContain('演示')
  })

  it('stores draft rejection and reopening history', () => {
    const draft = createExtractionDraft(demoSources[0].id, [
      { id: 'one', title: '提交报名', category: '比赛', deadline: '2026-08-04T18:00', estimatedMinutes: 60, nextAction: '核对材料', description: '', priority: '高', materials: [], evidence: '原文', confidence: '中' },
    ], '2026-08-01T00:00:00.000Z')
    const rejected = updateDraftItem(draft, draft.items[0].id, {}, '已拒绝', '2026-08-01T01:00:00.000Z')
    const reopened = updateDraftItem(rejected, draft.items[0].id, {}, '待确认', '2026-08-01T02:00:00.000Z')
    expect(reopened.items[0].history?.map((entry) => entry.action)).toEqual(['rejected', 'reopened'])
  })

  it('keeps inferred recognition tasks visible but unselected by default', () => {
    const recognition = buildLocalRecognition({
      sourceType: 'text',
      sourceTitle: '课程通知',
      content: '请于 8 月 20 日前提交课程报告。',
      referenceTime: new Date('2026-08-08T08:00:00+08:00'),
      timezone: 'Asia/Shanghai',
      projects: [],
      tasks: [],
    })
    const task = recognition.milestones.flatMap((milestone) => milestone.tasks)[0]
      ?? recognition.standaloneTasks[0]
    if (!task) throw new Error('expected a recognition task')
    task.selected = false
    task.inferenceLevel = 'strong_inference'
    const draft = createExtractionDraft('source-1', recognitionToLegacySuggestions(recognition), '2026-08-08T00:00:00.000Z', recognition)
    expect(draft.items[0].selected).toBe(false)
    expect(draft.items[0].status).toBe('待确认')
  })
})
