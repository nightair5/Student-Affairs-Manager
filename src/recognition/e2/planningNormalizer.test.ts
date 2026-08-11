import { describe, expect, it } from 'vitest'
import { buildLocalRecognition } from '../pipeline'
import type { RecognitionResult, TaskSuggestionV2 } from '../types'
import { normalizePathAPlanning, PATH_A_PLANNING_NORMALIZER_VERSION } from './planningNormalizer'

function seeded(): RecognitionResult {
  return buildLocalRecognition({
    sourceType: 'text',
    sourceTitle: '材料提交通知',
    content: '请于8月20日前提交申请表和承诺书。',
    referenceTime: new Date('2026-08-03T08:00:00+08:00'),
    timezone: 'Asia/Shanghai',
    projects: [],
    tasks: [],
  })
}

function tasks(result: RecognitionResult): TaskSuggestionV2[] {
  return [...result.standaloneTasks, ...result.milestones.flatMap((milestone) => [
    ...milestone.tasks,
    ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
  ])]
}

describe('Path A PlanningNormalizer', () => {
  it('merges only evidence-bound duplicate obligations and redirects every task reference', () => {
    const base = seeded()
    const original = tasks(base)[0]
    const duplicate = { ...structuredClone(original), tempId: 'duplicate-task', title: `  ${original.title}。  ` }
    base.milestones[0].tasks.push(duplicate)
    base.materials[0].relatedTaskTempIds.push('duplicate-task')
    base.timePoints[0].relatedTaskTempIds.push('duplicate-task')
    const normalized = normalizePathAPlanning(base)
    expect(tasks(normalized.result)).toHaveLength(tasks(base).length - 1)
    expect(normalized.result.materials[0].relatedTaskTempIds).not.toContain('duplicate-task')
    expect(normalized.result.timePoints[0].relatedTaskTempIds).not.toContain('duplicate-task')
    expect(normalized.audit.changes.some((change) => change.type === 'MERGE_DUPLICATE_TASK')).toBe(true)
  })

  it('merges a single shared submission predicate while retaining both material references', () => {
    const base = seeded()
    const original = tasks(base)[0]
    const firstMaterial = base.materials[0]
    const secondMaterial = base.materials[1]
    original.actionVerb = '提交'
    original.actionObject = firstMaterial.name
    original.title = `提交${firstMaterial.name}`
    original.materialTempIds = [firstMaterial.tempId]
    const sibling = {
      ...structuredClone(original),
      tempId: 'parallel-material-task',
      title: `提交${secondMaterial.name}`,
      actionObject: secondMaterial.name,
      materialTempIds: [secondMaterial.tempId],
    }
    base.milestones[0].tasks.push(sibling)
    secondMaterial.relatedTaskTempIds = [sibling.tempId]
    const normalized = normalizePathAPlanning(base)
    const merged = tasks(normalized.result).find((task) => task.tempId === original.tempId)
    expect(merged?.materialTempIds).toEqual(expect.arrayContaining([firstMaterial.tempId, secondMaterial.tempId]))
    expect(merged?.actionObject).toContain(firstMaterial.name)
    expect(merged?.actionObject).toContain(secondMaterial.name)
    expect(normalized.audit.changes.some((change) => change.type === 'MERGE_SHARED_PREDICATE_TASK')).toBe(true)
  })

  it('preserves unique tasks and all facts while repairing one-level hierarchy and deterministic material links', () => {
    const base = seeded()
    const originalIds = {
      times: base.timePoints.map((item) => item.tempId),
      events: base.events.map((item) => item.tempId),
      ambiguities: base.ambiguities.map((item) => item.id),
      materials: base.materials.map((item) => item.tempId),
    }
    const top = tasks(base)[0]
    const child = { ...structuredClone(top), tempId: 'child', title: '核对申请表', actionVerb: '核对', actionObject: '申请表', hierarchyType: 'subtask' as const, parentTempId: top.tempId, evidenceIds: [], materialTempIds: [] }
    const grandchild = { ...structuredClone(child), tempId: 'grandchild', title: '确认签名', actionVerb: '确认', actionObject: '签名', parentTempId: child.tempId, evidenceIds: [], materialTempIds: [] }
    base.milestones[0].tasks.push(child, grandchild)
    base.materials[0].relatedTaskTempIds = []
    base.materials[0].evidenceIds = [...top.evidenceIds]
    top.materialTempIds = []
    const normalized = normalizePathAPlanning(base)
    expect(tasks(normalized.result).find((task) => task.tempId === 'grandchild')?.parentTempId).toBe(top.tempId)
    expect(normalized.result.materials[0].relatedTaskTempIds).toContain(top.tempId)
    expect(tasks(normalized.result).find((task) => task.tempId === top.tempId)?.materialTempIds).toContain(base.materials[0].tempId)
    expect(normalized.result.timePoints.map((item) => item.tempId)).toEqual(originalIds.times)
    expect(normalized.result.events.map((item) => item.tempId)).toEqual(originalIds.events)
    expect(normalized.result.ambiguities.map((item) => item.id)).toEqual(originalIds.ambiguities)
    expect(normalized.result.materials.map((item) => item.tempId)).toEqual(originalIds.materials)
    expect(normalized.audit.invariants).toMatchObject({
      preservedTimePointIds: true,
      preservedEventIds: true,
      preservedAmbiguityIds: true,
      preservedMaterialIds: true,
      addedTaskIds: false,
      addedMilestoneIds: false,
    })
  })

  it('is idempotent and does not mutate its input', () => {
    const base = seeded()
    const snapshot = structuredClone(base)
    const once = normalizePathAPlanning(base)
    const twice = normalizePathAPlanning(once.result)
    expect(base).toEqual(snapshot)
    expect(twice.result).toEqual(once.result)
    expect(twice.audit.changes).toEqual([])
    expect(once.audit.normalizerVersion).toBe(PATH_A_PLANNING_NORMALIZER_VERSION)
  })
})
