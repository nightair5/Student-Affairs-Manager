import { describe, expect, it } from 'vitest'
import { buildLocalRecognition } from './pipeline'
import { annotateRecognitionQuality, validateRecognitionQuality } from './qualityValidator'

function recognize(content: string) {
  return buildLocalRecognition({
    sourceType: 'text',
    sourceTitle: '测试通知',
    content,
    referenceTime: new Date('2026-08-08T08:00:00+08:00'),
    timezone: 'Asia/Shanghai',
    projects: [],
    tasks: [],
  })
}

describe('Recognition quality validator', () => {
  it('detects missing top-level times and materials without rewriting entities', () => {
    const source = '请于8月20日18:00前提交申请表PDF。'
    const result = recognize(source)
    const incomplete = { ...result, materials: [], timePoints: [] }
    const report = validateRecognitionQuality(incomplete, source)
    expect(report.repairRecommended).toBe(true)
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['MISSING_TIMEPOINT', 'MISSING_MATERIAL']))
    expect(incomplete.materials).toEqual([])
    expect(incomplete.timePoints).toEqual([])
  })

  it('rejects dangling references, unsupported evidence and subtask depth greater than one', () => {
    const source = '请提交报名表。'
    const result = recognize(source)
    const parent = result.standaloneTasks[0]
    const invalid = {
      ...result,
      evidence: result.evidence.map((item) => ({ ...item, quote: '不存在的证据', quotedText: '不存在的证据' })),
      standaloneTasks: [
        { ...parent, hierarchyType: 'subtask' as const, parentTempId: 'missing-parent', materialTempIds: ['missing-material'] },
      ],
    }
    const report = validateRecognitionQuality(invalid, source)
    expect(report.valid).toBe(false)
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'EVIDENCE_NOT_SUPPORTED', 'SUBTASK_DEPTH_EXCEEDED', 'INVALID_REFERENCE',
    ]))
  })

  it('marks vague time with a fabricated value as false precision', () => {
    const source = '请于近期提交材料，具体日期另行通知。'
    const result = recognize(source)
    const time = result.timePoints[0]
    const invalid = {
      ...result,
      timePoints: [{ ...time, precision: 'vague' as const, normalizedValue: '2026-08-31', needsConfirmation: false }],
    }
    const report = validateRecognitionQuality(invalid, source)
    expect(report.issues.some((issue) => issue.code === 'FALSE_PRECISION')).toBe(true)
  })

  it('adds transparent review reasons but does not alter canonical suggestions', () => {
    const source = '8月20日参加培训。'
    const result = recognize(source)
    const incomplete = { ...result, events: [] }
    const report = validateRecognitionQuality(incomplete, source)
    const annotated = annotateRecognitionQuality(incomplete, report)
    expect(annotated.quality.needsHumanReview).toBe(true)
    expect(annotated.quality.reviewReasons.some((reason) => reason.startsWith('MISSING_EVENT'))).toBe(true)
    expect(annotated.standaloneTasks).toEqual(incomplete.standaloneTasks)
  })
})
