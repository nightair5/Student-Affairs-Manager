import { describe, expect, it } from 'vitest'
import { normalizeWorkspaceData } from './repository'

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
      schemaVersion: 4,
      courseBlocks: [],
      tasks: [{ id: 'task-1' }],
      projects: [{ id: 'project-1', milestones: [] }],
    })
  })

  it('拒绝缺少核心实体数组的导入', () => {
    expect(normalizeWorkspaceData({ schemaVersion: 4, tasks: [] })).toBeNull()
  })
})
