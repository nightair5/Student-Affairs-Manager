import { describe, expect, it } from 'vitest'
import { buildLocalRecognition } from '../../recognition/pipeline'
import { createGoldenWorkspaceV8 } from './fixtures'
import { mergeLegacyViewIntoWorkspaceV8, workspaceV8ToLegacyView } from './legacyView'

function draftSeed() {
  const workspace = createGoldenWorkspaceV8()
  const result = buildLocalRecognition({ sourceType: 'text', sourceTitle: '匿名通知', content: '请提交报名表。', referenceTime: new Date('2026-10-02T08:00:00+08:00'), timezone: 'Asia/Shanghai', projects: [], tasks: [] })
  workspace.extractionDrafts[0] = { ...workspace.extractionDrafts[0], result, status: 'needs_review' }
  return { workspace, result, task: result.standaloneTasks[0] }
}

describe('D26 truthful ordinary display projections', () => {
  it('clears an old synthetic deadline without a source time or actual date edit', () => {
    const { workspace, task } = draftSeed()
    const view = workspaceV8ToLegacyView(workspace)
    const item = view.drafts[0].items.find((entry) => entry.suggestion.id === task.tempId)!
    item.suggestion.deadline = '2026-10-09T12:00'
    workspace.extractionDrafts[0].legacyData = { v7Record: JSON.parse(JSON.stringify(view.drafts[0])) }
    expect(workspaceV8ToLegacyView(workspace).drafts[0].items[0].suggestion.deadline).toBe('')
  })

  it('preserves an actual user date edit and its history even when the source has no date', () => {
    const { workspace } = draftSeed()
    const draft = workspaceV8ToLegacyView(workspace).drafts[0]
    draft.items[0].suggestion.deadline = '2026-10-09T12:00'
    draft.items[0].history = [{ id: 'history-user-date', field: '识别建议', before: '{"deadline":""}', after: '{"deadline":"2026-10-09T12:00"}', actor: 'user', changedAt: workspace.savedAt }]
    workspace.extractionDrafts[0].legacyData = { v7Record: JSON.parse(JSON.stringify(draft)) }
    expect(workspaceV8ToLegacyView(workspace).drafts[0].items[0].suggestion.deadline).toBe('2026-10-09T12:00')
  })

  it('keeps a known tentative date without filling an invented clock into the draft', () => {
    const { workspace, result, task } = draftSeed()
    result.timePoints = [{ tempId: 'tentative-time', type: 'task_deadline', rawText: '暂定10月9日下午', normalizedValue: '2026-10-09T12:00', timezone: 'Asia/Shanghai', isAllDay: false, precision: 'vague', needsConfirmation: true, relatedTaskTempIds: [task.tempId], relatedMaterialTempIds: [], evidenceIds: [], confidence: 0.6 }]
    task.timePointTempIds = ['tentative-time']
    expect(workspaceV8ToLegacyView(workspace).drafts[0].items[0].suggestion.deadline).toBe('2026-10-09')
  })

  it('keeps source date-only values while excluding event or personal plan times from task cutoff', () => {
    const { workspace, result, task } = draftSeed()
    result.timePoints = [{ tempId: 'source-date', type: 'submission_deadline', rawText: '10月9日前', normalizedValue: '2026-10-09', timezone: 'Asia/Shanghai', isAllDay: true, precision: 'date_only', needsConfirmation: false, relatedTaskTempIds: [task.tempId], relatedMaterialTempIds: [], evidenceIds: [], confidence: 0.9 }]
    task.timePointTempIds = ['source-date']
    expect(workspaceV8ToLegacyView(workspace).drafts[0].items[0].suggestion.deadline).toBe('2026-10-09')
    result.timePoints[0].type = 'planned_start'
    expect(workspaceV8ToLegacyView(workspace).drafts[0].items[0].suggestion.deadline).toBe('')
  })

  it('retains unresolved source wording for the task card without presenting it as a certain scheduled date', () => {
    const workspace = createGoldenWorkspaceV8()
    workspace.timePoints[0] = { ...workspace.timePoints[0], rawText: '暂定10月9日下午', normalizedValue: '2026-10-09', precision: 'vague', needsConfirmation: true, isAllDay: false }
    const task = workspaceV8ToLegacyView(workspace).tasks[0]
    expect(task.deadline).toBe('')
    expect(task.sourceDeadlineLabel).toBe('暂定10月9日下午')
    workspace.timePoints[0].normalizedValue = null
    workspace.timePoints[0].rawText = '截止时间尚未公布'
    expect(workspaceV8ToLegacyView(workspace).tasks[0].sourceDeadlineLabel).toBe('截止时间尚未公布')
  })

  it('does not convert the legacy numeric duration placeholder into an observed fact while editing a title', () => {
    const workspace = createGoldenWorkspaceV8()
    workspace.tasks[0].estimatedMinutes = null
    const view = workspaceV8ToLegacyView(workspace)
    expect(view.tasks[0].estimatedMinutesKnown).toBe(false)
    view.tasks[0].title = '修改标题并保留未估计'
    expect(mergeLegacyViewIntoWorkspaceV8(workspace, view).tasks[0].estimatedMinutes).toBeNull()
    view.tasks[0].estimatedMinutes = 40
    const saved = mergeLegacyViewIntoWorkspaceV8(workspace, view)
    expect(saved.tasks[0].estimatedMinutes).toBe(40)
    expect(workspaceV8ToLegacyView(saved).tasks[0].estimatedMinutesKnown).toBe(true)
  })
})
