import { describe, expect, it } from 'vitest'
import { buildLocalRecognition } from './pipeline'
import {
  RECOGNITION_REPAIR_PATCH_VERSION,
  buildRecognitionRepairInstruction,
  createRecognitionRepairCandidate,
  mergeRecognitionRepair,
  shouldAttemptRecognitionRepair,
  type RecognitionRepairPatch,
} from './repair'
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

function patch(overrides: Partial<RecognitionRepairPatch> = {}): RecognitionRepairPatch {
  return {
    contractVersion: RECOGNITION_REPAIR_PATCH_VERSION,
    issueCodes: [],
    evidence: [],
    materials: [],
    timePoints: [],
    events: [],
    ambiguities: [],
    taskReferenceUpdates: [],
    ...overrides,
  }
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
    const candidate = createRecognitionRepairCandidate(base, patch({
      issueCodes: ['MISSING_MATERIAL', 'MISSING_TIMEPOINT'],
      materials: complete.materials,
      timePoints: complete.timePoints,
      taskReferenceUpdates: allTasks(complete).map((task) => ({
        taskTempId: task.tempId,
        evidenceIds: task.evidenceIds,
        materialTempIds: task.materialTempIds,
        timePointTempIds: task.timePointTempIds,
      })),
    }), report)
    expect(candidate).not.toBeNull()
    const merged = mergeRecognitionRepair(base, candidate!, report, source)
    expect(merged.materials.length).toBeGreaterThan(0)
    expect(merged.timePoints.length).toBeGreaterThan(0)
    expect(allTasks(merged).map((task) => task.tempId)).toEqual(allTasks(base).map((task) => task.tempId))
    expect(allTasks(merged)[0].materialTempIds.length).toBeGreaterThan(0)
    expect(allTasks(merged)[0].timePointTempIds.length).toBeGreaterThan(0)
  })

  it('rejects full-result rewrites and unsupported patch evidence', () => {
    const source = '请提交申请表单。'
    const base = recognize(source)
    const report = validateRecognitionQuality({ ...base, materials: [] }, source)
    expect(createRecognitionRepairCandidate(base, { ...patch(), standaloneTasks: [] }, report)).toBeNull()
    const candidate = createRecognitionRepairCandidate(base, patch({
      issueCodes: ['MISSING_MATERIAL'],
      evidence: [{ ...base.evidence[0], id: 'fake-evidence', quote: '负责人电话', quotedText: '负责人电话' }],
    }), report)
    expect(candidate).not.toBeNull()
    const merged = mergeRecognitionRepair({ ...base, materials: [] }, candidate!, report, source)
    expect(merged.evidence.some((item) => item.id === 'fake-evidence')).toBe(false)
  })

  it('can only make vague time safer, never more precise', () => {
    const source = '请于近期提交材料，具体日期另行通知。'
    const base = recognize(source)
    const original = base.timePoints[0]
    const unsafe = { ...base, timePoints: [{ ...original, precision: 'vague' as const, normalizedValue: '2026-08-31', needsConfirmation: false }] }
    const report = validateRecognitionQuality(unsafe, source)
    const safeCandidate = createRecognitionRepairCandidate(unsafe, patch({
      issueCodes: ['FALSE_PRECISION'],
      timePoints: [{ ...original, precision: 'vague' as const, normalizedValue: null, needsConfirmation: true }],
    }), report)
    expect(safeCandidate).not.toBeNull()
    const merged = mergeRecognitionRepair(unsafe, safeCandidate!, report, source)
    expect(merged.timePoints[0].normalizedValue).toBeNull()
    expect(merged.timePoints[0].needsConfirmation).toBe(true)
  })

  it('requests only a bounded patch and never a full recognition rewrite', () => {
    const source = '请于8月20日提交申请表。'
    const result = recognize(source)
    const report = validateRecognitionQuality({ ...result, materials: [] }, source)
    const instruction = buildRecognitionRepairInstruction(report)
    expect(instruction).toContain(RECOGNITION_REPAIR_PATCH_VERSION)
    expect(instruction).toContain('不要重新生成 RecognitionResult')
    expect(instruction).toContain('taskReferenceUpdates')
    expect(instruction).not.toContain('返回完整 RecognitionResult')
  })
})
