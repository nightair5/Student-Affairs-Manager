import { describe, expect, it } from 'vitest'
import { workspaceLoadDiagnostic } from './workspaceRecoveryUi'

describe('content-free workspace diagnostic', () => {
  it('retains useful fault categories without messages, values, URLs or stack traces', () => {
    const result = workspaceLoadDiagnostic(new Error('INVALID_TYPE:extractionDrafts[2].result.ambiguities[0].field:学生甲的通知 https://private.invalid; MISSING_REFERENCE:tasks[0].projectId:SECRET'))
    expect(result.codes).toEqual(['INVALID_TYPE', 'MISSING_REFERENCE'])
    expect(result.sections).toEqual(['extractionDrafts', 'tasks'])
    expect(JSON.stringify(result)).not.toMatch(/学生甲|private|SECRET|stack|ambiguities/)
  })
  it('recognizes browser storage failure without copying arbitrary text', () => {
    const error = new Error('private body'); error.name = 'QuotaExceededError'
    expect(workspaceLoadDiagnostic(error).codes).toEqual(['QuotaExceededError'])
    expect(workspaceLoadDiagnostic(new Error('PRIVATE_VALUE_xyz')).codes).toEqual(['WORKSPACE_OPEN_FAILED'])
  })
})
