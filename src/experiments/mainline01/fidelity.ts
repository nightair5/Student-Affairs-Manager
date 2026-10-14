import { buildDomainCommitPlan, commitDomainPlan } from '../../domain/v2/domainCommit'
import { captureFixture, confirmItems, memoryRepository, reviewView } from './chain'
import { NOW } from './fixtures'

// Evaluation-only comparison. No comparison values enter capture/selection/commit decisions.
export async function observeFidelity(useClientProjection: boolean) {
  const repository = memoryRepository()
  const handle = await captureFixture(repository, 'multi')
  const before = (await repository.load())!
  const response = before.extractionDrafts[0].result!
  const saved = useClientProjection
    ? (await confirmItems(repository, handle.draftId, reviewView(before, handle.draftId).draft.items)).saved
    : await commitDomainPlan(repository, buildDomainCommitPlan(before, handle.draftId, {
      taskTempIds: response.standaloneTasks.map((item) => item.tempId),
      materialTempIds: response.materials.map((item) => item.tempId),
      timePointTempIds: response.timePoints.map((item) => item.tempId), eventTempIds: [],
    }, NOW), NOW)
  const rows: Array<{ task: string; field: string; equal: boolean; supplied: unknown; stored: unknown }> = []
  const check = (task: string, field: string, supplied: unknown, stored: unknown) => rows.push({
    task, field, supplied, stored, equal: JSON.stringify(supplied) === JSON.stringify(stored),
  })
  response.standaloneTasks.forEach((input, index) => {
    const task = saved.tasks.find((item) => item.legacyData?.recognitionTempId === input.tempId)!
    const time = saved.timePoints.find((item) => item.legacyData?.recognitionTempId === `d${index}`)!
    const material = saved.materials.find((item) => item.legacyData?.recognitionTempId === `m${index}`)!
    const inputTime = response.timePoints[index]
    const inputMaterial = response.materials[index]
    check(input.tempId, 'action', input.actionVerb, task.legacyData?.actionVerb)
    check(input.tempId, 'object', input.actionObject, task.legacyData?.actionObject)
    check(input.tempId, 'title', input.title, task.title)
    check(input.tempId, 'description', input.description, task.description)
    check(input.tempId, 'completionCriteria', input.completionCriteria, task.legacyData?.completionCriteria)
    for (const field of ['rawText', 'normalizedValue', 'timezone', 'isAllDay', 'precision'] as const) check(input.tempId, `time.${field}`, inputTime[field], time[field])
    check(input.tempId, 'time.task', [task.id], time.relatedTaskIds)
    check(input.tempId, 'time.material', [material.id], time.relatedMaterialIds)
    for (const field of ['name', 'formatRequirements', 'namingRequirements', 'quantity', 'submissionChannel'] as const) check(input.tempId, `material.${field}`, inputMaterial[field], material[field])
    check(input.tempId, 'material.task', [task.id], material.relatedTaskIds)
    check(input.tempId, 'material.deadline', time.id, material.deadlineTimePointId)
    check(input.tempId, 'evidence.source', handle.sourceVersionId, saved.evidenceRefs[0].sourceVersionId)
    check(input.tempId, 'evidence.quote', response.evidence[0].quotedText, saved.evidenceRefs[0].quotedText)
  })
  return { path: useClientProjection ? 'real-client-projection-and-domain' : 'direct-domain-control',
    material: 'handcrafted engineering response; not semantic gold',
    checked: rows.length, equal: rows.filter((row) => row.equal).length,
    fidelity: rows.filter((row) => row.equal).length / rows.length,
    complete: rows.every((row) => row.equal), differences: rows.filter((row) => !row.equal), rows }
}
