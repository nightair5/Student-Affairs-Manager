import { confirmationRevisionV2, confirmationStateV2, confirmV2, reviewEditsV2 } from '../../domain/v2/confirmationV2'
import type { WorkspaceV8 } from '../../domain/v2/types'
import { captureFixture, memoryRepository, reviewView } from '../mainline01/chain'
import { NOW } from '../mainline01/fixtures'

export function reviewV2(workspace: WorkspaceV8, draftId: string) {
  const view = reviewView(workspace, draftId)
  const edits = reviewEditsV2(workspace, draftId)
  const states = Object.fromEntries(view.draft.items.map((item) => [item.id, confirmationStateV2(workspace, draftId, item.suggestion.id)]))
  return { ...view, revision: edits.revision, states,
    draft: { ...view.draft, items: view.draft.items.map((item) => ({ ...item,
      selected: item.status === '待确认' ? states[item.id].defaultSelected : item.selected,
      suggestion: { ...item.suggestion, ...edits.overrides[item.suggestion.id], deadline: states[item.id].value },
    })) } }
}

// Test-only evaluation: identical 21 fields x 2 tasks to the protected V1 scorer.
// Comparison values never enter the V2 confirmation decision.
export async function observeV2Fidelity() {
  const repository = memoryRepository()
  const handle = await captureFixture(repository, 'multi')
  const before = (await repository.load())!
  const response = before.extractionDrafts[0].result!
  const view = reviewV2(before, handle.draftId)
  await confirmV2(repository, { draftId: handle.draftId, revision: confirmationRevisionV2(before),
    taskTempIds: view.draft.items.filter((item) => item.selected !== false).map((item) => item.suggestion.id) }, NOW)
  const saved = (await repository.load())!
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
  return { path: 'explicit-confirmation-v2',
    material: 'handcrafted engineering response; not semantic gold',
    checked: rows.length, equal: rows.filter((row) => row.equal).length,
    fidelity: rows.filter((row) => row.equal).length / rows.length,
    complete: rows.every((row) => row.equal), differences: rows.filter((row) => !row.equal), rows }
}
