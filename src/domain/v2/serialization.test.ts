import { describe, expect, it } from 'vitest'
import { createGoldenWorkspaceV8 } from './fixtures'
import { exportWorkspaceV8, importWorkspaceV8 } from './serialization'

describe('Workspace v8 semantic round-trip', () => {
  it('preserves IDs, relationships and canonical facts through export/import/export', () => {
    const original = createGoldenWorkspaceV8()
    const first = exportWorkspaceV8(original)
    const imported = importWorkspaceV8(first)
    const second = exportWorkspaceV8(imported)
    expect(JSON.parse(second)).toEqual(JSON.parse(first))
    expect(imported.tasks).toHaveLength(7)
    expect(imported.materials).toHaveLength(4)
    expect(imported.timePoints).toHaveLength(5)
    expect(imported.evidenceRefs).toHaveLength(10)
    expect(imported.historyRecords[0].entityId).toBe('task-1')
  })

  it('preserves unknown legacyData without promoting it to canonical fields', () => {
    const imported = importWorkspaceV8(exportWorkspaceV8(createGoldenWorkspaceV8()))
    expect(imported.workspace.legacyData?.legacyCustomField).toEqual({ foo: 'bar' })
  })

  it('rejects invalid graphs instead of silently repairing them', () => {
    const workspace = createGoldenWorkspaceV8()
    workspace.tasks[0].projectId = 'missing-project'
    expect(() => importWorkspaceV8(JSON.stringify(workspace))).toThrow(/MISSING_REFERENCE/u)
  })
})
