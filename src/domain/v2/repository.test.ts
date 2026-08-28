import { describe, expect, it } from 'vitest'
import { deriveProjectState } from './derived'
import { createGoldenWorkspaceV8 } from './fixtures'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from './repository'

describe('B1 canonical Workspace v8 repository', () => {
  it('saves and reloads the complete validated canonical graph', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    const workspace = createGoldenWorkspaceV8()
    await repository.save(workspace)

    const reloaded = await repository.load()
    expect(reloaded).toEqual(workspace)
    expect(reloaded).not.toBe(workspace)
    expect(reloaded?.materials[2]).toMatchObject({
      formatRequirements: ['PDF'],
      namingRequirements: ['学校-团队-作品名'],
      deadlineTimePointId: 'time-3',
    })
    expect(reloaded?.timePoints).toHaveLength(5)
    expect(reloaded?.evidenceRefs[0]).toMatchObject({
      quotedText: '匿名通知依据片段 1',
      page: 1,
      fieldPath: 'tasks[0].title',
    })
    expect(reloaded?.historyRecords[0]).toMatchObject({ before: '填写表格', after: '填写报名表' })
    expect(reloaded?.reminderRecords[0]).toMatchObject({ status: 'scheduled', channel: 'browser' })
  })

  it('updates all canonical arrays in one record transaction without legacy projection', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    await repository.save(createGoldenWorkspaceV8())

    await repository.transaction((workspace) => ({
      ...workspace,
      materials: workspace.materials.map((item) => item.id === 'material-3'
        ? { ...item, requirements: ['A4 页面'], version: item.version + 1 }
        : item),
      timePoints: [...workspace.timePoints, {
        id: 'time-extra', projectId: 'project-competition', milestoneId: 'milestone-3', taskId: 'task-3',
        materialId: null, eventId: null, type: 'task_deadline', rawText: '补充核对时间', normalizedValue: null,
        relatedTaskIds: ['task-3'], relatedMaterialIds: [],
        timezone: null, isAllDay: false, precision: 'vague', needsConfirmation: true,
        createdAt: workspace.savedAt, updatedAt: workspace.savedAt,
      }],
      savedAt: '2026-08-08T09:00:00.000Z',
    }))

    const reloaded = await repository.load()
    expect(reloaded?.materials.find((item) => item.id === 'material-3')?.requirements).toEqual(['A4 页面'])
    expect(reloaded?.timePoints.map((item) => item.id)).toContain('time-extra')
    expect(reloaded?.evidenceRefs).toHaveLength(10)
    expect(reloaded?.reminderRecords).toHaveLength(1)
  })

  it('rejects an invalid transaction without changing the stored workspace', async () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    const original = createGoldenWorkspaceV8()
    await repository.save(original)

    await expect(repository.transaction((workspace) => ({
      ...workspace,
      materials: workspace.materials.map((item) => item.id === 'material-1'
        ? { ...item, relatedTaskIds: ['missing-task'] }
        : item),
    }))).rejects.toThrow(/MISSING_REFERENCE/u)
    expect(await repository.load()).toEqual(original)
  })

  it('imports and exports only validated Workspace v8 data', () => {
    const repository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
    const workspace = createGoldenWorkspaceV8()
    expect(repository.importJson(repository.exportJson(workspace))).toEqual(workspace)
    expect(() => repository.importJson('{"schemaVersion":7}')).toThrow('WORKSPACE_V8_SCHEMA_REQUIRED')
  })

  it('fails closed with deterministic errors for malformed nested arrays and enums', async () => {
    const invalidArray = structuredClone(createGoldenWorkspaceV8()) as unknown as {
      tasks: Array<Record<string, unknown>>
    }
    invalidArray.tasks[0].dependencyIds = { unexpected: true }
    const arrayRepository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore({ current: invalidArray }))
    await expect(arrayRepository.load()).rejects.toThrow('WORKSPACE_V8_INVALID:INVALID_TYPE:tasks[0].dependencyIds')
    expect(() => arrayRepository.importJson(JSON.stringify(invalidArray))).toThrow(
      'WORKSPACE_V8_INVALID:INVALID_TYPE:tasks[0].dependencyIds',
    )

    const invalidEnum = structuredClone(createGoldenWorkspaceV8()) as unknown as {
      tasks: Array<Record<string, unknown>>
    }
    invalidEnum.tasks[0].status = 'quietly-accepted-bogus-status'
    const enumRepository = new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore({ current: invalidEnum }))
    await expect(enumRepository.load()).rejects.toThrow('WORKSPACE_V8_INVALID:INVALID_ENUM:tasks[0].status')
    expect(() => enumRepository.importJson(JSON.stringify(invalidEnum))).toThrow(
      'WORKSPACE_V8_INVALID:INVALID_ENUM:tasks[0].status',
    )
  })

  it('recomputes ProjectState without mutating canonical facts', () => {
    const workspace = createGoldenWorkspaceV8()
    const before = JSON.stringify(workspace)
    const state = deriveProjectState(workspace, 'project-competition')
    expect(state.nextDeadlineTimePointId).toBe('time-1')
    expect(JSON.stringify(workspace)).toBe(before)
    expect('projectStates' in workspace).toBe(false)
  })
})
