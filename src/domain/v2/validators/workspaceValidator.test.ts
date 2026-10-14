import { describe, expect, it } from 'vitest'
import { buildLocalRecognition } from '../../../recognition/pipeline'
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

  it('returns shape issues instead of throwing on unknown runtime input', () => {
    const malformed = structuredClone(createGoldenWorkspaceV8()) as unknown as {
      materials: unknown[]
      reminderRecords: Array<Record<string, unknown>>
    }
    malformed.materials[0] = null
    malformed.reminderRecords[0].channel = 'carrier-pigeon'
    expect(validateWorkspaceV8(malformed)).toEqual({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_TYPE', path: 'materials[0]' }),
        expect.objectContaining({ code: 'INVALID_ENUM', path: 'reminderRecords[0].channel' }),
      ]),
    })
  })

  it('treats explicit undefined review metadata as absent optional fields', () => {
    const workspace = createGoldenWorkspaceV8()
    workspace.sources[0].legacyData = undefined
    workspace.sources[0].needsReview = undefined
    expect(validateWorkspaceV8(workspace)).toEqual({ valid: true, issues: [] })
  })

  it('accepts nested JSON-safe review metadata in legacyData', () => {
    const workspace = createGoldenWorkspaceV8()
    workspace.sources[0].legacyData = {
      reviewMetadata: {
        sourceType: 'file',
        mimeType: 'application/pdf',
        characterCount: 12_345,
        pageCount: 8,
        extractionMethod: 'ocr',
        ocrConfidence: 0.72,
        partialExtraction: false,
        qualityFlags: ['OCR 置信度偏低', '第 4 页需要人工复核'],
        optionalObservation: null,
      },
    }

    expect(validateWorkspaceV8(workspace)).toEqual({ valid: true, issues: [] })
  })

  it.each([
    ['undefined', undefined],
    ['BigInt', BigInt(1)],
    ['function', () => 'not-json'],
    ['non-plain object', new Date('2026-08-08T08:00:00.000Z')],
    ['non-finite number', Number.POSITIVE_INFINITY],
    ['sparse array', Array(2)],
  ])('rejects nested %s values in legacyData', (_label, invalidValue) => {
    const workspace = createGoldenWorkspaceV8() as unknown as {
      sources: Array<Record<string, unknown>>
    }
    workspace.sources[0].legacyData = {
      reviewMetadata: {
        extractionObservation: {
          invalidValue,
        },
      },
    }

    expect(validateWorkspaceV8(workspace).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_TYPE', path: 'sources[0].legacyData' }),
    ]))
  })

  it('rejects cyclic legacyData without throwing', () => {
    const workspace = createGoldenWorkspaceV8() as unknown as {
      sources: Array<Record<string, unknown>>
    }
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    workspace.sources[0].legacyData = { reviewMetadata: cyclic }

    expect(validateWorkspaceV8(workspace).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_TYPE', path: 'sources[0].legacyData' }),
    ]))
  })

  it('reports stable nested RecognitionResult paths for null elements and invalid enums', () => {
    const workspace = createGoldenWorkspaceV8()
    const result = buildLocalRecognition({
      sourceType: 'text', sourceTitle: '匿名比赛通知',
      content: '8月10日前完成报名并提交报名表，9月2日下午参加答辩。',
      referenceTime: new Date('2026-08-03T08:00:00+08:00'), timezone: 'Asia/Shanghai',
      projects: [], tasks: [],
    })
    workspace.extractionDrafts[0].result = result
    const malformed = workspace as unknown as {
      extractionDrafts: Array<{ result: { materials: unknown[]; timePoints: Array<Record<string, unknown>> } }>
    }
    malformed.extractionDrafts[0].result.materials[0] = null
    malformed.extractionDrafts[0].result.timePoints[0].precision = 'approximately'
    const issues = validateWorkspaceV8(malformed).issues
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_TYPE', path: 'extractionDrafts[0].result.materials[0]' }),
      expect.objectContaining({ code: 'INVALID_ENUM', path: 'extractionDrafts[0].result.timePoints[0].precision' }),
    ]))
  })

  it('rejects source, root and canonical entity ownership contradictions', () => {
    const workspace = createGoldenWorkspaceV8()
    workspace.sources.push({
      ...workspace.sources[0], id: 'source-other', title: '其他来源', currentVersionId: 'source-version-other',
    })
    workspace.sourceVersions.push({
      ...workspace.sourceVersions[0], id: 'source-version-other', sourceId: 'source-other', versionNo: 1,
    })
    workspace.sources[0].currentVersionId = 'source-version-other'
    workspace.sources[0].workspaceId = 'workspace-other'
    workspace.projects[0].workspaceId = 'workspace-other'
    workspace.tasks[0].milestoneId = 'milestone-2'
    workspace.materials[0].projectId = null
    workspace.timePoints[0].projectId = null
    workspace.events[0].projectId = null

    const issues = validateWorkspaceV8(workspace).issues
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CROSS_PROJECT_REFERENCE', path: 'sources[0].currentVersionId' }),
      expect.objectContaining({ code: 'CROSS_PROJECT_REFERENCE', path: 'sources[0].workspaceId' }),
      expect.objectContaining({ code: 'CROSS_PROJECT_REFERENCE', path: 'projects[0].workspaceId' }),
      expect.objectContaining({ code: 'CROSS_PROJECT_REFERENCE', path: 'tasks[0].workPackageId' }),
      expect.objectContaining({ code: 'CROSS_PROJECT_REFERENCE', path: 'materials[0].relatedTaskIds[0]' }),
      expect.objectContaining({ code: 'CROSS_PROJECT_REFERENCE', path: 'timePoints[0].taskId' }),
      expect.objectContaining({ code: 'CROSS_PROJECT_REFERENCE', path: 'events[0].startTimePointId' }),
    ]))
  })
})
