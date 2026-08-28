import { describe, expect, it } from 'vitest'
import type { WorkspaceData } from '../../types'
import { materializeWorkspaceEntities } from '../../lib/domainEntities'
import { buildLocalRecognition } from '../../recognition/pipeline'
import anonymousV7Copy from './fixtures/workspace-v7-anonymous-copy.json'
import { createGoldenWorkspaceV8 } from './fixtures'
import { applyPreparedV8Migration, prepareV7ToV8Migration } from './migration'
import { mergeLegacyViewIntoWorkspaceV8, workspaceV8ToLegacyView } from './legacyView'

describe('Workspace v8 legacy UI view', () => {
  it('projects canonical facts without losing rich fields when UI edits are merged', () => {
    const canonical = applyPreparedV8Migration(prepareV7ToV8Migration(anonymousV7Copy as unknown as WorkspaceData, {
      now: '2026-08-08T10:00:00.000Z',
      migrationId: 'legacy-view-test',
    }))
    canonical.materials[0] = {
      ...canonical.materials[0],
      requirements: ['需要盖章'],
      formatRequirements: ['PDF/A', '小于 10 MB'],
      namingRequirements: ['学号-姓名'],
      quantity: 2,
      submissionChannel: '官网',
    }
    canonical.timePoints.push({
      ...canonical.timePoints[0],
      id: 'time:second',
      rawText: '答辩当天下午',
      normalizedValue: null,
      precision: 'relative',
      needsConfirmation: true,
    })

    const view = workspaceV8ToLegacyView(canonical)
    view.tasks[0] = { ...view.tasks[0], title: '用户修改后的任务', updatedAt: '2026-08-08T11:00:00.000Z' }
    const merged = mergeLegacyViewIntoWorkspaceV8(canonical, view)

    expect(merged.tasks[0].title).toBe('用户修改后的任务')
    expect(merged.materials[0]).toMatchObject({
      requirements: ['需要盖章'],
      formatRequirements: ['PDF/A', '小于 10 MB'],
      namingRequirements: ['学号-姓名'],
      quantity: 2,
      submissionChannel: '官网',
    })
    expect(merged.timePoints.map((item) => item.id)).toEqual(expect.arrayContaining(canonical.timePoints.map((item) => item.id)))
    expect(merged.timePoints).toHaveLength(canonical.timePoints.length + 1)
    expect(merged.evidenceRefs).toEqual(canonical.evidenceRefs)
  })

  it('appends new legacy milestones, reminders, and history once with stable canonical references', () => {
    const canonical = applyPreparedV8Migration(prepareV7ToV8Migration(anonymousV7Copy as unknown as WorkspaceData, {
      now: '2026-08-08T10:00:00.000Z',
      migrationId: 'legacy-view-new-entities-test',
    }))
    const view = workspaceV8ToLegacyView(canonical)
    const project = view.projects[0]
    const task = view.tasks[0]
    const savedAt = '2026-08-08T12:00:00.000Z'
    const milestone = {
      id: 'milestone:manual:stable',
      projectId: project.id,
      title: '人工添加的里程碑',
      dueAt: '2026-08-21T18:00:00+08:00',
      status: '待完成' as const,
      objective: '完成线下确认',
      createdAt: savedAt,
    }
    const reminder = {
      id: 'reminder:manual:stable',
      taskId: task.id,
      channel: 'browser' as const,
      scheduledAt: '2026-08-20T09:00:00+08:00',
      enabled: true,
      status: 'sent' as const,
    }
    const history = {
      id: 'history:manual:stable',
      entityType: 'milestone' as const,
      entityId: milestone.id,
      field: '里程碑',
      before: '',
      after: milestone.title,
      actor: 'user' as const,
      action: 'created',
      changedAt: savedAt,
    }

    project.milestones.push(milestone)
    task.reminders.push({ id: reminder.id, channel: reminder.channel, scheduledAt: reminder.scheduledAt, enabled: true })
    task.history.push({
      id: history.id,
      field: history.field,
      before: history.before,
      after: history.after,
      changedAt: history.changedAt,
      actor: history.actor,
      entityType: history.entityType,
      entityId: history.entityId,
      action: history.action,
    })
    view.reminderRecords.push(reminder)
    view.historyRecords.push(history)
    view.savedAt = savedAt

    const merged = mergeLegacyViewIntoWorkspaceV8(canonical, view)
    const roundTrippedView = workspaceV8ToLegacyView(merged)
    const mergedAgain = mergeLegacyViewIntoWorkspaceV8(merged, roundTrippedView)

    expect(merged.milestones.find((item) => item.id === milestone.id)).toMatchObject({
      projectId: project.id,
      title: milestone.title,
      objective: milestone.objective,
    })
    expect(merged.reminderRecords.find((item) => item.id === reminder.id)).toMatchObject({
      taskId: task.id,
      channel: reminder.channel,
      scheduledAt: reminder.scheduledAt,
      status: 'failed',
      errorCode: 'LEGACY_SENT_AT_MISSING',
      sentAt: null,
      needsReview: true,
    })
    expect(merged.historyRecords.find((item) => item.id === history.id)).toMatchObject({
      entityType: 'milestone',
      entityId: milestone.id,
      fieldName: history.field,
      action: history.action,
    })
    expect(roundTrippedView.projects[0].milestones.find((item) => item.id === milestone.id)?.dueAt).toBe(milestone.dueAt)
    expect(roundTrippedView.tasks[0].reminders).toContainEqual(expect.objectContaining({
      id: reminder.id,
      status: 'failed',
      errorMessage: 'LEGACY_SENT_AT_MISSING',
      sentAt: null,
    }))
    expect(roundTrippedView.historyRecords).toContainEqual(expect.objectContaining({ id: history.id }))
    expect(mergedAgain.milestones.filter((item) => item.id === milestone.id)).toHaveLength(1)
    expect(mergedAgain.reminderRecords.filter((item) => item.id === reminder.id)).toHaveLength(1)
    expect(mergedAgain.historyRecords.filter((item) => item.id === history.id)).toHaveLength(1)
    const duePoints = mergedAgain.timePoints.filter((item) => item.milestoneId === milestone.id
      && item.taskId === null
      && item.eventId === null)
    expect(duePoints).toHaveLength(1)
    expect(duePoints[0]).toMatchObject({
      id: `time:milestone:${milestone.id}:deadline`,
      projectId: project.id,
      normalizedValue: milestone.dueAt,
      precision: 'exact',
      needsConfirmation: false,
    })

    const invalidDueView = workspaceV8ToLegacyView(mergedAgain)
    invalidDueView.projects[0].milestones.find((item) => item.id === milestone.id)!.dueAt = '待学院另行通知'
    invalidDueView.savedAt = '2026-08-08T13:00:00.000Z'
    const invalidDueMerged = mergeLegacyViewIntoWorkspaceV8(mergedAgain, invalidDueView)
    expect(invalidDueMerged.timePoints.filter((item) => item.milestoneId === milestone.id && item.taskId === null)).toHaveLength(1)
    expect(invalidDueMerged.timePoints.find((item) => item.id === duePoints[0].id)).toMatchObject({
      rawText: '待学院另行通知',
      normalizedValue: null,
      precision: 'vague',
      needsConfirmation: true,
    })
    expect(workspaceV8ToLegacyView(invalidDueMerged).projects[0].milestones.find((item) => item.id === milestone.id)?.dueAt).toBe('待学院另行通知')
  })

  it('preserves canonical sent and failed reminder facts through the React legacy projection', () => {
    const canonical = createGoldenWorkspaceV8()
    canonical.reminderRecords = [
      {
        id: 'reminder:sent:audited',
        taskId: 'task-1',
        channel: 'browser',
        scheduledAt: '2026-08-10T09:00:00+08:00',
        status: 'sent',
        errorCode: null,
        sentAt: '2026-08-10T09:00:03+08:00',
      },
      {
        id: 'reminder:failed:audited',
        taskId: 'task-1',
        channel: 'email',
        scheduledAt: '2026-08-10T10:00:00+08:00',
        status: 'failed',
        errorCode: 'PROVIDER_REJECTED',
        sentAt: null,
      },
    ]
    const view = workspaceV8ToLegacyView(canonical)
    const rebuilt = materializeWorkspaceEntities(view.tasks, view.sources, view.drafts, view.projects)
    view.reminderRecords = rebuilt.reminderRecords

    const merged = mergeLegacyViewIntoWorkspaceV8(canonical, view)

    expect(merged.reminderRecords.find((item) => item.id === 'reminder:sent:audited')).toMatchObject({
      status: 'sent',
      errorCode: null,
      sentAt: '2026-08-10T09:00:03+08:00',
    })
    expect(merged.reminderRecords.find((item) => item.id === 'reminder:failed:audited')).toMatchObject({
      status: 'failed',
      errorCode: 'PROVIDER_REJECTED',
      sentAt: null,
    })
  })

  it('defaults only explicit recognition tasks to selected and preserves later user choices', () => {
    const canonical = createGoldenWorkspaceV8()
    const result = buildLocalRecognition({
      sourceType: 'text',
      sourceTitle: '匿名通知',
      content: '请于8月20日18:00前提交报名表。',
      referenceTime: new Date('2026-08-08T08:00:00+08:00'),
      timezone: 'Asia/Shanghai',
      projects: [],
      tasks: [],
    })
    const base = result.standaloneTasks[0]
    result.milestones = []
    result.standaloneTasks = [
      { ...base, tempId: 'task:explicit-default', inferenceLevel: 'explicit', selected: undefined },
      { ...base, tempId: 'task:strong-default', inferenceLevel: 'strong_inference', selected: undefined },
      { ...base, tempId: 'task:optional-default', inferenceLevel: 'optional_suggestion', selected: undefined },
      { ...base, tempId: 'task:strong-recorded', inferenceLevel: 'strong_inference', selected: true },
    ]
    canonical.extractionDrafts[0] = {
      ...canonical.extractionDrafts[0],
      status: 'needs_review',
      result,
    }

    const firstView = workspaceV8ToLegacyView(canonical)
    const selectedById = new Map(firstView.drafts[0].items.map((item) => [item.suggestion.id, item.selected]))
    expect(selectedById).toEqual(new Map([
      ['task:explicit-default', true],
      ['task:strong-default', false],
      ['task:optional-default', false],
      ['task:strong-recorded', true],
    ]))

    firstView.drafts[0].items.find((item) => item.suggestion.id === 'task:optional-default')!.selected = true
    const merged = mergeLegacyViewIntoWorkspaceV8(canonical, firstView)
    const roundTripped = workspaceV8ToLegacyView(merged)
    expect(roundTripped.drafts[0].items.find((item) => item.suggestion.id === 'task:optional-default')?.selected).toBe(true)
  })
})
