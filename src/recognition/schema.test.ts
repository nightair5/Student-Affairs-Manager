import { describe, expect, it } from 'vitest'
import { buildLocalRecognition, type RecognitionInput } from './pipeline'
import { isRecognitionResult } from './schema'

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
})
