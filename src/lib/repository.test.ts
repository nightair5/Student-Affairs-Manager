import { describe, expect, it } from 'vitest'
import { demoSources, demoTasks } from '../data/demo'
import { createWorkspaceData } from './workspace'
import { IndexedDbWorkspaceRepository, normalizeWorkspaceData } from './repository'

describe('normalizeWorkspaceData', () => {
  it('安全迁移 P0 数据并保留原实体', () => {
    const migrated = normalizeWorkspaceData({
      schemaVersion: 3,
      tasks: [{ id: 'task-1' }],
      sources: [{ id: 'source-1' }],
      drafts: [],
      projects: [{ id: 'project-1', title: '项目' }],
      savedAt: '2026-08-01T00:00:00.000Z',
    })

    expect(migrated).toMatchObject({
      schemaVersion: 6,
      courseBlocks: [],
      integrations: { sync: { endpoint: 'http://127.0.0.1:8787' }, webMonitors: [], connectionIntents: [] },
      knowledgeSettings: {},
      tasks: [{ id: 'task-1' }],
      projects: [{ id: 'project-1', milestones: [] }],
      evidence: [],
      timePoints: [{ taskId: 'task-1', type: 'deadline' }],
      materialItems: [],
      historyRecords: [],
      reminderRecords: [],
    })
  })

  it('preserves local knowledge authorization during hydration', () => {
    const migrated = normalizeWorkspaceData({
      schemaVersion: 5,
      tasks: [], sources: [], drafts: [], projects: [], courseBlocks: [],
      knowledgeSettings: { localSearchAuthorizedAt: '2026-08-01T00:00:00.000Z' },
      savedAt: '2026-08-01T00:00:00.000Z',
    })
    expect(migrated?.knowledgeSettings.localSearchAuthorizedAt).toBe('2026-08-01T00:00:00.000Z')
  })

  it('拒绝缺少核心实体数组的导入', () => {
    expect(normalizeWorkspaceData({ schemaVersion: 5, tasks: [] })).toBeNull()
  })

  it('exports and imports schema v6 with material, history, reminder, and time-point entities', () => {
    const repository = new IndexedDbWorkspaceRepository()
    const workspace = createWorkspaceData(demoTasks, demoSources)
    const restored = repository.importJson(repository.exportJson(workspace))

    expect(restored.schemaVersion).toBe(6)
    expect(restored.timePoints).toHaveLength(demoTasks.length)
    expect(restored.materialItems.map((item) => item.status)).toContain('missing')
    expect(restored.reminderRecords.every((item) => item.status !== 'sent')).toBe(true)
    expect(restored.tasks[0].materialIds).toEqual(demoTasks[0].materials.map((item) => item.id))
  })

  it('rejects malformed JSON, incompatible versions, unsafe keys, and oversized files', () => {
    const repository = new IndexedDbWorkspaceRepository()
    expect(() => repository.importJson('{broken')).toThrow()
    expect(() => repository.importJson(JSON.stringify({ schemaVersion: 99, tasks: [], sources: [], drafts: [], projects: [] }))).toThrow()
    expect(() => repository.importJson('{"schemaVersion":6,"tasks":[],"sources":[],"drafts":[],"projects":[],"__proto__":{"polluted":true}}')).toThrow(/不安全字段/)
    expect(() => repository.importJson(' '.repeat(5 * 1024 * 1024 + 1))).toThrow(/5 MB/)
  })

  it('strictly rejects incomplete or invalid current-schema backups', () => {
    const repository = new IndexedDbWorkspaceRepository()
    const incomplete = {
      schemaVersion: 6,
      tasks: [],
      sources: [],
      drafts: [],
      projects: [],
      savedAt: '2026-08-01T00:00:00.000Z',
    }
    expect(() => repository.importJson(JSON.stringify(incomplete))).toThrow(/证据列表/)

    const invalidEnum = createWorkspaceData(demoTasks, demoSources) as unknown as {
      tasks: Array<Record<string, unknown>>
    }
    invalidEnum.tasks[0].priority = '立刻处理'
    expect(() => repository.importJson(JSON.stringify(invalidEnum))).toThrow(/非法枚举值/)
  })

  it('rejects dangling references and circular task dependencies', () => {
    const repository = new IndexedDbWorkspaceRepository()
    const dangling = createWorkspaceData(demoTasks, demoSources)
    dangling.tasks[0] = { ...dangling.tasks[0], sourceIds: ['missing-source'] }
    expect(() => repository.importJson(JSON.stringify(dangling))).toThrow(/不存在的来源/)

    const cyclic = createWorkspaceData(demoTasks, demoSources)
    cyclic.tasks[0] = { ...cyclic.tasks[0], dependencyIds: [cyclic.tasks[1].id] }
    cyclic.tasks[1] = { ...cyclic.tasks[1], dependencyIds: [cyclic.tasks[0].id] }
    expect(() => repository.importJson(JSON.stringify(cyclic))).toThrow(/循环/)
  })

  it('keeps HTML-looking source text inert as ordinary imported text', () => {
    const repository = new IndexedDbWorkspaceRepository()
    const workspace = createWorkspaceData(demoTasks, [
      { ...demoSources[0], contentPreview: '<img src=x onerror=alert(1)>', content: '<script>steal()</script>' },
      ...demoSources.slice(1),
    ])
    const restored = repository.importJson(JSON.stringify(workspace))
    expect(restored.sources[0].contentPreview).toBe('<img src=x onerror=alert(1)>')
    expect(restored.sources[0].content).toBe('<script>steal()</script>')
  })
})
