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
      'INVALID_EVIDENCE', 'SUBTASK_DEPTH_EXCEEDED', 'INVALID_REFERENCE',
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
    expect(report.issues.some((issue) => issue.code === 'POSSIBLE_FALSE_PRECISION')).toBe(true)
  })

  it('adds transparent review reasons but does not alter canonical suggestions', () => {
    const source = '8月20日参加培训。'
    const result = recognize(source)
    const incomplete = { ...result, events: [] }
    const report = validateRecognitionQuality(incomplete, source)
    const annotated = annotateRecognitionQuality(incomplete, report)
    expect(annotated.quality.needsHumanReview).toBe(true)
    expect(annotated.quality.reviewReasons.some((reason) => reason.startsWith('EVENT_TASK_CONFUSION'))).toBe(true)
    expect(annotated.standaloneTasks).toEqual(incomplete.standaloneTasks)
  })

  it('accepts a semantic action outside the old verb list when action and object are explicit', () => {
    const source = '入校手续须于周五前办理。'
    const seeded = recognize('请提交入校手续。')
    const task = seeded.standaloneTasks[0]
    const semantic = {
      ...seeded,
      evidence: seeded.evidence.map((item) => ({ ...item, quote: source, quotedText: source })),
      standaloneTasks: [{ ...task, title: '办理入校手续', actionVerb: '办理', actionObject: '入校手续' }],
    }
    expect(validateRecognitionQuality(semantic, source).issues.some((issue) => issue.code === 'POSSIBLE_FALSE_ACTION')).toBe(false)
  })

  it('detects passive obligations and cutoff dates without inventing entities', () => {
    const source = '身份认证窗口将于8月20日关闭，逾期不再受理。'
    const result = recognize(source)
    const incomplete = {
      ...result,
      sourceSummary: { ...result.sourceSummary, requiresAction: true },
      standaloneTasks: [],
      milestones: [],
      timePoints: [],
    }
    const report = validateRecognitionQuality(incomplete, source)
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['MISSING_TASK', 'MISSING_TIMEPOINT']))
    expect(incomplete.standaloneTasks).toEqual([])
    expect(incomplete.timePoints).toEqual([])
  })

  it('distinguishes required objects from reference-only attachments and event-like words', () => {
    const referenceSource = '附件《培养方案》仅供参考，无需提交。'
    const reference = { ...recognize(referenceSource), materials: [] }
    expect(validateRecognitionQuality(reference, referenceSource).issues.some((issue) => issue.code === 'MISSING_MATERIAL')).toBe(false)

    const materialSource = '入场时须凭校园二维码核验身份。'
    const missingMaterial = { ...recognize(materialSource), materials: [] }
    expect(validateRecognitionQuality(missingMaterial, materialSource).issues.some((issue) => issue.code === 'MISSING_MATERIAL')).toBe(true)

    const reportSource = '请于周五前提交汇报材料。'
    const noEvent = { ...recognize(reportSource), events: [] }
    expect(validateRecognitionQuality(noEvent, reportSource).issues.some((issue) => issue.code === 'EVENT_TASK_CONFUSION')).toBe(false)
  })

  it('detects wrong time roles, missing conditional ambiguity and false actions', () => {
    const source = '请在9月1日前完成报名；入围团队9月8日参加答辩。'
    const result = recognize(source)
    const invalid = {
      ...result,
      ambiguities: [],
      timePoints: result.timePoints.map((item, index) => index === 0 ? { ...item, type: 'task_deadline' as const } : item),
      standaloneTasks: result.standaloneTasks.map((task, index) => index === 0 ? {
        ...task,
        title: '报名截止时间',
        actionVerb: '查看',
        actionObject: '报名截止时间',
      } : task),
    }
    const codes = validateRecognitionQuality(invalid, source).issues.map((issue) => issue.code)
    expect(codes).toEqual(expect.arrayContaining(['WRONG_TIME_ROLE', 'MISSING_AMBIGUITY', 'POSSIBLE_FALSE_ACTION']))
  })

  it('detects material/task confusion and over-merging without creating replacement tasks', () => {
    const source = '办理设备借用需出示校园卡并提交设备借用单。'
    const seeded = recognize('请提交设备借用单。')
    const task = seeded.standaloneTasks[0]
    const result = {
      ...seeded,
      evidence: seeded.evidence.map((item) => ({ ...item, quote: source, quotedText: source })),
      standaloneTasks: [{ ...task, title: '办理设备借用', actionVerb: '办理', actionObject: '设备借用' }],
      materials: seeded.materials.map((item) => ({ ...item, name: '设备借用单' })),
    }
    const report = validateRecognitionQuality(result, source)
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['MATERIAL_TASK_CONFUSION', 'OVER_MERGING']))
    expect(result.standaloneTasks).toHaveLength(1)
  })

  it('detects over-fragmentation in an isolated synthetic contract case', () => {
    const source = '请提交申请表。'
    const seeded = recognize('请提交报名表。')
    const task = seeded.standaloneTasks[0]
    const fragmented = {
      ...seeded,
      standaloneTasks: Array.from({ length: 6 }, (_, index) => ({ ...task, tempId: `task-${index + 1}` })),
    }
    expect(validateRecognitionQuality(fragmented, source).issues.some((issue) => issue.code === 'OVER_FRAGMENTATION')).toBe(true)
  })
})
