import { describe, expect, it } from 'vitest'
import { buildLocalRecognition, type RecognitionInput } from './pipeline'
import {
  RECOGNITION_REPAIR_CONTRACT,
  isRecognitionResult,
  validateRecognitionRepair,
  validateRecognitionResult,
} from './schema'

function validResult() {
  const input: RecognitionInput = {
    sourceType: 'text',
    sourceTitle: '匿名比赛通知',
    content: '8月10日前完成报名并提交报名表，8月25日前上传作品文件，9月2日下午参加答辩。',
    referenceTime: new Date('2026-08-03T08:00:00+08:00'),
    timezone: 'Asia/Shanghai',
    projects: [],
    tasks: [],
  }
  const result = buildLocalRecognition(input)
  expect(isRecognitionResult(result)).toBe(true)
  return result
}

function firstTask(result: ReturnType<typeof validResult>) {
  return result.milestones.flatMap((milestone) => [
    ...milestone.tasks,
    ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
  ])[0]
}

describe('RecognitionResult 2.0 runtime schema', () => {
  it('fails closed for null nested elements and invalid nested enums without throwing', () => {
    const nullMaterial = structuredClone(validResult()) as unknown as { materials: unknown[] }
    nullMaterial.materials[0] = null
    expect(() => isRecognitionResult(nullMaterial)).not.toThrow()
    expect(isRecognitionResult(nullMaterial)).toBe(false)

    const nullWorkPackage = structuredClone(validResult()) as unknown as { milestones: Array<{ workPackages: unknown[] }> }
    nullWorkPackage.milestones[0].workPackages.push(null)
    expect(isRecognitionResult(nullWorkPackage)).toBe(false)

    const invalidTime = structuredClone(validResult()) as unknown as { timePoints: Array<Record<string, unknown>> }
    invalidTime.timePoints[0].precision = 'approximately'
    expect(isRecognitionResult(invalidTime)).toBe(false)

    const invalidEvent = structuredClone(validResult()) as unknown as { events: Array<Record<string, unknown>> }
    invalidEvent.events[0].inferenceLevel = 'guessed'
    expect(isRecognitionResult(invalidEvent)).toBe(false)

    const invalidEvidence = structuredClone(validResult()) as unknown as { evidence: Array<Record<string, unknown>> }
    invalidEvidence.evidence[0].field = 'secret'
    expect(isRecognitionResult(invalidEvidence)).toBe(false)

    const nullConflict = structuredClone(validResult()) as unknown as { conflicts: unknown[]; ambiguities: unknown[] }
    nullConflict.conflicts.push(null)
    nullConflict.ambiguities.push(null)
    expect(isRecognitionResult(nullConflict)).toBe(false)
  })

  it('rejects duplicate temp IDs and every missing task/material/time/event/evidence reference', () => {
    const duplicate = structuredClone(validResult())
    duplicate.materials[0].tempId = duplicate.timePoints[0].tempId
    expect(isRecognitionResult(duplicate)).toBe(false)

    const missingMaterial = structuredClone(validResult())
    firstTask(missingMaterial).materialTempIds = ['missing-material']
    expect(isRecognitionResult(missingMaterial)).toBe(false)

    const missingTask = structuredClone(validResult())
    missingTask.timePoints[0].relatedTaskTempIds = ['missing-task']
    expect(isRecognitionResult(missingTask)).toBe(false)

    const missingTime = structuredClone(validResult())
    missingTime.events[0].startTimePointTempId = 'missing-time'
    expect(isRecognitionResult(missingTime)).toBe(false)

    const missingEvidence = structuredClone(validResult())
    firstTask(missingEvidence).evidenceIds = ['missing-evidence']
    expect(isRecognitionResult(missingEvidence)).toBe(false)
  })

  it('reports schema and reference failures separately without changing the boolean validator', () => {
    const invalidIgnoredContent = structuredClone(validResult()) as unknown as { ignoredContent: unknown[] }
    invalidIgnoredContent.ignoredContent = ['背景文字']
    expect(validateRecognitionResult(invalidIgnoredContent)).toMatchObject({
      valid: false,
      failureCategory: 'schema',
    })

    const duplicate = structuredClone(validResult())
    duplicate.materials[0].tempId = duplicate.timePoints[0].tempId
    expect(validateRecognitionResult(duplicate)).toMatchObject({
      valid: false,
      failureCategory: 'schema',
      issues: expect.arrayContaining([expect.objectContaining({ code: 'DUPLICATE_ENTITY_ID' })]),
    })

    const missingTime = structuredClone(validResult())
    firstTask(missingTime).timePointTempIds = ['missing-time']
    expect(validateRecognitionResult(missingTime)).toMatchObject({
      valid: false,
      failureCategory: 'reference',
      issues: expect.arrayContaining([expect.objectContaining({ code: 'TASK_TIME_POINT_MISSING' })]),
    })

    const missingMaterialTask = structuredClone(validResult())
    missingMaterialTask.materials[0].relatedTaskTempIds = ['missing-task']
    expect(validateRecognitionResult(missingMaterialTask)).toMatchObject({
      valid: false,
      failureCategory: 'reference',
      issues: expect.arrayContaining([expect.objectContaining({ code: 'MATERIAL_TASK_MISSING' })]),
    })

    const missingEventTime = structuredClone(validResult())
    missingEventTime.events[0].startTimePointTempId = 'missing-time'
    expect(validateRecognitionResult(missingEventTime)).toMatchObject({
      valid: false,
      failureCategory: 'reference',
      issues: expect.arrayContaining([expect.objectContaining({ code: 'EVENT_TIME_POINT_MISSING' })]),
    })

    const missingConflictEvidence = structuredClone(validResult())
    missingConflictEvidence.conflicts.push({
      id: 'conflict-1',
      type: 'other',
      message: '需核对',
      entityTempIds: [firstTask(missingConflictEvidence).tempId],
      evidenceIds: ['missing-evidence'],
      requiresDecision: true,
    })
    expect(validateRecognitionResult(missingConflictEvidence)).toMatchObject({
      valid: false,
      failureCategory: 'reference',
      issues: expect.arrayContaining([expect.objectContaining({ code: 'CONFLICT_EVIDENCE_MISSING' })]),
    })

    const missingAmbiguityEvidence = structuredClone(validResult())
    missingAmbiguityEvidence.ambiguities.push({
      id: 'ambiguity-extra',
      field: 'timePoint',
      message: '需核对',
      options: [],
      evidenceIds: ['missing-evidence'],
    })
    expect(validateRecognitionResult(missingAmbiguityEvidence)).toMatchObject({
      valid: false,
      failureCategory: 'reference',
      issues: expect.arrayContaining([expect.objectContaining({ code: 'AMBIGUITY_EVIDENCE_MISSING' })]),
    })
  })

  it('reports missing critical fields and impossible calendar values without silent defaults', () => {
    const missingRequiresAction = structuredClone(validResult()) as unknown as {
      sourceSummary: Record<string, unknown>
    }
    delete missingRequiresAction.sourceSummary.requiresAction
    expect(validateRecognitionResult(missingRequiresAction)).toMatchObject({
      valid: false,
      failureCategory: 'schema',
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'REQUIRED_FIELD_MISSING', path: 'sourceSummary.requiresAction' }),
      ]),
    })

    const impossibleDate = structuredClone(validResult())
    impossibleDate.timePoints[0].normalizedValue = '2026-02-30T18:00'
    expect(validateRecognitionResult(impossibleDate)).toMatchObject({
      valid: false,
      failureCategory: 'semantic',
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'TIME_POINT_NORMALIZED_VALUE_INVALID', path: 'timePoints[0].normalizedValue' }),
      ]),
    })

    const unknownField = structuredClone(validResult()) as unknown as Record<string, unknown>
    unknownField.injected = true
    expect(validateRecognitionResult(unknownField)).toMatchObject({
      valid: false,
      failureCategory: 'schema',
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'UNKNOWN_FIELD', path: 'injected' }),
      ]),
    })
  })

  it('can verify evidence quotes against the exact source without retaining the source', () => {
    const result = validResult()
    const sourceContent = result.evidence.map((item) => item.quote).join('\n')
    expect(validateRecognitionResult(result, { sourceContent })).toMatchObject({ valid: true })
    expect(validateRecognitionResult(result, { sourceContent: '不包含任何证据原句' })).toMatchObject({
      valid: false,
      failureCategory: 'semantic',
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'EVIDENCE_QUOTE_NOT_IN_SOURCE' }),
      ]),
    })
  })

  it('allows one structure-only Repair and rejects added semantic facts or repeated attempts', () => {
    expect(RECOGNITION_REPAIR_CONTRACT).toMatchObject({
      maxAttempts: 1,
      allowNewSemanticEntities: false,
      allowFailureDeletion: false,
    })
    const before = structuredClone(validResult()) as unknown as { sourceSummary: Record<string, unknown> }
    delete before.sourceSummary.requiresAction
    const after = validResult()
    const sourceContent = after.evidence.map((item) => item.quote).join('\n')
    expect(validateRecognitionRepair(before, after, { attempt: 1, sourceContent })).toMatchObject({
      valid: true,
      harm: false,
    })

    const invented = structuredClone(after)
    invented.standaloneTasks.push({
      ...firstTask(invented), tempId: 'invented-task', title: '向陌生账户转账',
      actionVerb: '转账', actionObject: '陌生账户', materialTempIds: [], timePointTempIds: [],
    })
    expect(validateRecognitionRepair(before, invented, { attempt: 1, sourceContent })).toMatchObject({
      valid: false,
      harm: true,
      validation: { issues: expect.arrayContaining([expect.objectContaining({ code: 'REPAIR_NEW_SEMANTIC_ENTITY_FORBIDDEN' })]) },
    })
    expect(validateRecognitionRepair(before, after, { attempt: 2, sourceContent })).toMatchObject({
      valid: false,
      harm: true,
      validation: { issues: expect.arrayContaining([expect.objectContaining({ code: 'REPAIR_ATTEMPT_LIMIT_EXCEEDED' })]) },
    })

    const beforeWithConflict = structuredClone(before) as typeof before & { conflicts: unknown[] }
    beforeWithConflict.conflicts = [{
      id: 'conflict-1', type: 'other', message: '截止时间冲突', entityTempIds: [],
      evidenceIds: [], requiresDecision: true,
    }]
    expect(validateRecognitionRepair(beforeWithConflict, after, { attempt: 1, sourceContent })).toMatchObject({
      valid: false,
      harm: true,
      validation: { issues: expect.arrayContaining([expect.objectContaining({ code: 'REPAIR_FAILURE_DELETION_FORBIDDEN' })]) },
    })
  })
})
