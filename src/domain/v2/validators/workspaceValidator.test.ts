import { describe, expect, it } from 'vitest'
import { createGoldenWorkspaceV8 } from '../fixtures'
import { validateWorkspaceV8 } from './workspaceValidator'

describe('Workspace v8 domain graph validation', () => {
  it('accepts the canonical complex competition fixture', () => {
    expect(validateWorkspaceV8(createGoldenWorkspaceV8())).toEqual({ valid: true, issues: [] })
  })

  it('rejects globally duplicated entity IDs and missing references', () => {
    const workspace = createGoldenWorkspaceV8()
    workspace.materials[0].id = workspace.tasks[0].id
    workspace.tasks[1].projectId = 'missing-project'
    const issues = validateWorkspaceV8(workspace).issues
    expect(issues.some((issue) => issue.code === 'DUPLICATE_ID')).toBe(true)
    expect(issues.some((issue) => issue.code === 'MISSING_REFERENCE')).toBe(true)
  })

  it('enforces a maximum subtask depth of one', () => {
    const workspace = createGoldenWorkspaceV8()
    workspace.tasks[2].parentTaskId = 'task-1-sub'
    const issues = validateWorkspaceV8(workspace).issues
    expect(issues.some((issue) => issue.code === 'SUBTASK_DEPTH')).toBe(true)
  })

  it('detects dependency cycles', () => {
    const workspace = createGoldenWorkspaceV8()
    workspace.tasks[0].dependencyIds = ['task-5']
    const issues = validateWorkspaceV8(workspace).issues
    expect(issues.some((issue) => issue.code === 'DEPENDENCY_CYCLE')).toBe(true)
  })

  it('rejects sentinel dates and requires vague time to remain null', () => {
    const sentinel = createGoldenWorkspaceV8()
    sentinel.timePoints[0].normalizedValue = '1970-01-01T00:00'
    expect(validateWorkspaceV8(sentinel).issues.some((issue) => issue.code === 'SENTINEL_DATE')).toBe(true)

    const vague = createGoldenWorkspaceV8()
    vague.timePoints[3].normalizedValue = '2026-08-26T09:00'
    vague.timePoints[3].needsConfirmation = false
    expect(validateWorkspaceV8(vague).issues.some((issue) => issue.code === 'INVALID_TIME')).toBe(true)
  })

  it('rejects invalid workspace zones and entity timestamps', () => {
    const workspace = createGoldenWorkspaceV8()
    workspace.settings.defaultTimezone = 'Not/AZone'
    workspace.tasks[0].updatedAt = 'not-a-date'
    const issues = validateWorkspaceV8(workspace).issues
    expect(issues.some((issue) => issue.path === 'settings.defaultTimezone')).toBe(true)
    expect(issues.some((issue) => issue.path === 'tasks[0].updatedAt')).toBe(true)
  })
})
