import { describe, expect, it } from 'vitest'
import { normalizeWorkspaceData } from './repository'

describe('workspace schema v7 migration', () => {
  it('preserves schema v6 entities and records uncertain legacy hierarchy', () => {
    const migrated = normalizeWorkspaceData({
      schemaVersion: 6,
      savedAt: '2026-08-03T00:00:00.000Z',
      tasks: [],
      sources: [],
      drafts: [],
      projects: [{
        id: 'project-old', title: '旧项目', category: '比赛', sourceIds: [], taskIds: [],
        milestones: [{ id: 'old-node', projectId: 'project-old', title: '旧节点', dueAt: '2026-08-20T18:00', status: '待完成', createdAt: '2026-08-03T00:00:00.000Z' }],
        createdAt: '2026-08-03T00:00:00.000Z', updatedAt: '2026-08-03T00:00:00.000Z',
      }],
      courseBlocks: [], integrations: { sync: { endpoint: 'http://127.0.0.1:8787' }, webMonitors: [], connectionIntents: [] }, knowledgeSettings: {},
    })
    expect(migrated?.schemaVersion).toBe(7)
    expect(migrated?.projects[0].id).toBe('project-old')
    expect(migrated?.migrationLog[0]).toMatchObject({ fromVersion: 6, toVersion: 7, status: 'needs_review' })
    expect(migrated?.legacyData).toMatchObject({ previousSchemaVersion: 6 })
  })
})
