import { describe, expect, it } from 'vitest'
import { workspaceLoadDiagnosticV2 } from './workspaceRecoveryUi'

describe('workspace diagnostic v2 schema locations', () => {
  it('identifies exact result fields without including values or arbitrary property names', () => {
    const value = workspaceLoadDiagnosticV2(new Error('INVALID_TYPE:extractionDrafts[4].result.quality:通知正文 secret@example.com,INVALID_ENUM:extractionDrafts[4].result.ignoredContent[0].reason:私人信息,INVALID_TYPE:extractionDrafts[2].result.PRIVATE_STUDENT_NAME:private text'))
    expect(value.locations).toEqual([
      { code: 'INVALID_TYPE', path: 'extractionDrafts[4].result.quality' },
      { code: 'INVALID_ENUM', path: 'extractionDrafts[4].result.ignoredContent[0].reason' },
      { code: 'INVALID_TYPE', path: 'extractionDrafts[2].result.[field]' },
    ])
    expect(value.canTryHistoricalRepair).toBe(true)
    expect(JSON.stringify(value)).not.toMatch(/通知正文|secret|私人信息|PRIVATE_STUDENT_NAME|private text/)
  })
  it('does not offer result recovery for metadata, canonical reference or unknown failures', () => {
    for (const message of [
      'INVALID_TYPE:extractionDrafts[0].acceptedEntityTempIds:错误',
      'INVALID_TYPE:extractionDrafts[0].result.quality:错误,MISSING_REFERENCE:tasks[0].projectId:错误',
      'WORKSPACE_CHANGED_DURING_RECOVERY',
      'private error without a recognized schema path',
    ]) expect(workspaceLoadDiagnosticV2(new Error(message)).canTryHistoricalRepair).toBe(false)
  })
  it('bounds the exported report and never serializes a stack or Error object', () => {
    const value = workspaceLoadDiagnosticV2(new Error(Array.from({ length: 100 }, (_, i) => `INVALID_TYPE:extractionDrafts[${i}].result:私人值`).join(',')))
    expect(value.locations).toHaveLength(80)
    expect(value.locationsTruncated).toBe(true)
    expect(JSON.stringify(value)).not.toMatch(/私人值|stack|Error:/)
  })
})
