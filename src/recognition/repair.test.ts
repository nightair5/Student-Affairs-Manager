import { describe, expect, it } from 'vitest'
import { buildLocalRecognition } from './pipeline'
import { mergeRecognitionRepair, shouldAttemptRecognitionRepair } from './repair'
import { RECOGNITION_VALIDATOR_VERSION, validateRecognitionQuality } from './qualityValidator'
import type { RecognitionResult } from './types'

function recognize(content: string) {
  return buildLocalRecognition({ sourceType: 'text', sourceTitle: '通知', content, referenceTime: new Date('2026-08-08T08:00:00+08:00'), timezone: 'Asia/Shanghai', projects: [], tasks: [] })
}

function allTasks(result: RecognitionResult) {
  return [...result.standaloneTasks, ...result.milestones.flatMap((milestone) => [
    ...milestone.tasks,
    ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
  ])]
}

describe('conditional recognition repair', () => {
  it('runs only for allow-listed repairable structural gaps', () => {
    const source = '请于8月20日提交申请表。'
    const result = recognize(source)
    const missing = { ...result, materials: [], timePoints: [] }
    expect(shouldAttemptRecognitionRepair(validateRecognitionQuality(missing, source))).toBe(true)
    expect(shouldAttemptRecognitionRepair({
      validatorVersion: RECOGNITION_VALIDATOR_VERSION,
      valid: true,
      repairRecommended: false,
      issues: [{ code: 'FALSE_ACTION', severity: 'warning', repairable: false, message: '需人工复核', entityId: 'task-1', evidence: '申请表' }],
    })).toBe(false)
  })

  it('merges evidence-backed missing material and time without replacing existing tasks', () => {
    const source = '请于8月20日18:00前提交申请表PDF。'
    const complete = recognize(source)
    const base = { ...complete, materials: [], timePoints: [] }
    const report = validateRecognitionQuality(base, source)
    const merged = mergeRecognitionRepair(base, complete, report, source)
    expect(merged.materials.length).toBeGreaterThan(0)
    expect(merged.timePoints.length).toBeGreaterThan(0)
    expect(allTasks(merged).map((task) => task.tempId)).toEqual(allTasks(base).map((task) => task.tempId))
    expect(allTasks(merged)[0].materialTempIds.length).toBeGreaterThan(0)
    expect(allTasks(merged)[0].timePointTempIds.length).toBeGreaterThan(0)
  })

  it('does not import unsupported evidence or invented tasks', () => {
    const source = '请提交报名表。'
    const base = recognize(source)
    const report = validateRecognitionQuality({ ...base, materials: [] }, source)
    const inventedTask = { ...base.standaloneTasks[0], tempId: 'invented-task', title: '联系负责人', actionVerb: '联系', actionObject: '负责人' }
    const candidate = {
      ...base,
      standaloneTasks: [...base.standaloneTasks, inventedTask],
      evidence: [...base.evidence, { ...base.evidence[0], id: 'fake-evidence', quote: '负责人电话', quotedText: '负责人电话' }],
    }
    const merged = mergeRecognitionRepair({ ...base, materials: [] }, candidate, report, source)
    expect(merged.standaloneTasks.some((task) => task.tempId === 'invented-task')).toBe(false)
    expect(merged.evidence.some((item) => item.id === 'fake-evidence')).toBe(false)
  })

  it('can only make vague time safer, never more precise', () => {
    const source = '请于近期提交材料，具体日期另行通知。'
    const base = recognize(source)
    const original = base.timePoints[0]
    const unsafe = { ...base, timePoints: [{ ...original, precision: 'vague' as const, normalizedValue: '2026-08-31', needsConfirmation: false }] }
    const report = validateRecognitionQuality(unsafe, source)
    const safeCandidate = { ...base, timePoints: [{ ...original, precision: 'vague' as const, normalizedValue: null, needsConfirmation: true }] }
    const merged = mergeRecognitionRepair(unsafe, safeCandidate, report, source)
    expect(merged.timePoints[0].normalizedValue).toBeNull()
    expect(merged.timePoints[0].needsConfirmation).toBe(true)
  })
})
