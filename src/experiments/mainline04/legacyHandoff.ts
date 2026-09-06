import { validateRecognitionResult } from '../../recognition/schema'
import type { RecognitionResult, TaskSuggestionV2, MaterialSuggestionV2, TimePointSuggestionV2, EventSuggestion } from '../../recognition/types'
import { composeSemantics } from './semanticComposer'
import type { ComposeContext } from './semanticComposer'
import { plainJson, stableJson } from './semanticContract'

const omit = (value: object, keys: string[]) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)))
export interface HandoffRow { taskId: string; capability: 'EQUIVALENT_OLD_V2' | 'NOT_SUPPORTED'; reasons: string[] }

type TaskLinks = Pick<TaskSuggestionV2, 'tempId' | 'parentTempId' | 'dependencyTempIds' | 'materialTempIds' | 'timePointTempIds'> & { eventTempIds?: string[] }
type EventLinks = Pick<EventSuggestion, 'tempId' | 'startTimePointTempId' | 'endTimePointTempId'> & { relatedTaskTempIds?: string[] }

// Follow explicit task dependencies/revisions, then their material/time/event links.
// A shared material does not make its other owner a task dependency: do not expand
// through that owner into unrelated assets. No input edge or entity is rewritten.
function relatedEntities(taskId: string, tasks: TaskLinks[], materials: Pick<MaterialSuggestionV2, 'tempId' | 'relatedTaskTempIds'>[],
  timePoints: Pick<TimePointSuggestionV2, 'tempId' | 'relatedTaskTempIds' | 'relatedMaterialTempIds'>[], events: EventLinks[],
  revisions: Array<{ targetDirectiveId: string; fromDirectiveId: string | null }> = []) {
  const taskIds = new Set([taskId]), materialIds = new Set<string>(), timeIds = new Set<string>(), eventIds = new Set<string>()
  let count = -1
  const size = () => taskIds.size + materialIds.size + timeIds.size + eventIds.size
  while (count !== size()) {
    count = size()
    for (const task of tasks) if (taskIds.has(task.tempId)) {
      task.dependencyTempIds.forEach(id => taskIds.add(id))
      if (task.parentTempId) taskIds.add(task.parentTempId)
      task.materialTempIds.forEach(id => materialIds.add(id))
      task.timePointTempIds.forEach(id => timeIds.add(id))
      task.eventTempIds?.forEach(id => eventIds.add(id))
    }
    for (const revision of revisions) if (taskIds.has(revision.targetDirectiveId) || (revision.fromDirectiveId && taskIds.has(revision.fromDirectiveId))) {
      taskIds.add(revision.targetDirectiveId)
      if (revision.fromDirectiveId) taskIds.add(revision.fromDirectiveId)
    }
    for (const material of materials) if (material.relatedTaskTempIds.some(id => taskIds.has(id))) materialIds.add(material.tempId)
    for (const time of timePoints) if (timeIds.has(time.tempId) || time.relatedTaskTempIds.some(id => taskIds.has(id))
      || time.relatedMaterialTempIds.some(id => materialIds.has(id))) {
      timeIds.add(time.tempId)
      time.relatedMaterialTempIds.forEach(id => materialIds.add(id))
    }
    for (const event of events) if (eventIds.has(event.tempId) || event.relatedTaskTempIds?.some(id => taskIds.has(id))
      || (event.startTimePointTempId && timeIds.has(event.startTimePointTempId)) || (event.endTimePointTempId && timeIds.has(event.endTimePointTempId))) {
      eventIds.add(event.tempId)
      if (event.startTimePointTempId) timeIds.add(event.startTimePointTempId)
      if (event.endTimePointTempId) timeIds.add(event.endTimePointTempId)
    }
  }
  return { taskIds, materialIds, timeIds, eventIds }
}
function entityValues(items: readonly { tempId: string }[], ids: Set<string>, omitted: string[]) {
  return items.filter(item => ids.has(item.tempId)).sort((a, b) => a.tempId.localeCompare(b.tempId)).map(item => omit(item, omitted))
}

/** No downgrade/conversion. The only result returned is the original valid old object.
 * This is a capability report, never a confirmation authorization or database writer. */
export async function assessLegacyHandoff(semanticInput: unknown, oldInput: unknown, context: ComposeContext) {
  const review = await composeSemantics(semanticInput, context)
  const old = plainJson(oldInput)
  const report = validateRecognitionResult(old)
  const rows: HandoffRow[] = []
  if (!report.valid) return { review, rows: review.items.map(i => ({ taskId: i.tempId, capability: 'NOT_SUPPORTED' as const,
    reasons: ['OLD_CAPTURE_VALIDATION_FAILED'] })), originalLegacy: old, legacyResult: null, eligibleTaskTempIds: [], capture: 'REJECT_WHOLE_CAPTURE' as const }
  const original = old as RecognitionResult, raw = review.original
  const extraOldTasks = original.milestones.length > 0 || original.standaloneTasks.some(t => !raw.tasks.some(s => s.id === t.tempId))
  const sourceOkay = original.evidence.every(e => e.sourceId === raw.sourceId && Number.isInteger(e.textStart)
    && Number.isInteger(e.textEnd) && (e.textStart ?? -1) >= 0 && (e.textEnd ?? -1) > (e.textStart ?? -1)
    && context.index.sourceContent.slice(e.textStart!, e.textEnd!) === (e.quotedText ?? e.quote))
  const newTasks = raw.tasks.map(task => ({ tempId: task.id, ...task.detail, eventTempIds: task.eventTempIds }))
  for (const task of raw.tasks) {
    const reasons: string[] = [], item = review.items.find(i => i.tempId === task.id)!, s = task.semantics
    const previous = original.standaloneTasks.find(t => t.tempId === task.id)
    if (extraOldTasks || !sourceOkay) reasons.push('OLD_SOURCE_OR_EXTRA_ENTITY')
    if (!previous || stableJson(task.detail) !== stableJson(omit(previous, ['tempId', 'actionVerb', 'actionObject', 'inferenceLevel', 'evidenceIds', 'selected']))
      || previous.actionVerb !== task.action.surface || previous.actionObject !== task.object.surface || previous.inferenceLevel !== task.inferenceLevel) reasons.push('TASK_ATTRIBUTE_DIFFERENCE')
    const newRelated = relatedEntities(task.id, newTasks, raw.materials, raw.timePoints, raw.events, raw.revisions)
    const oldRelated = relatedEntities(task.id, original.standaloneTasks, original.materials, original.timePoints, original.events)
    const materialIds = new Set([...newRelated.materialIds, ...oldRelated.materialIds])
    const timeIds = new Set([...newRelated.timeIds, ...oldRelated.timeIds])
    const eventIds = new Set([...newRelated.eventIds, ...oldRelated.eventIds])
    const materialEqual = stableJson(entityValues(raw.materials, materialIds, ['scopeIds'])) === stableJson(entityValues(original.materials, materialIds, ['selected', 'evidenceIds']))
    const timeEqual = stableJson(entityValues(raw.timePoints, timeIds, ['scopeIds'])) === stableJson(entityValues(original.timePoints, timeIds, ['selected', 'evidenceIds']))
    const eventsEqual = stableJson(entityValues(raw.events, eventIds, ['scopeIds', 'relatedTaskTempIds'])) === stableJson(entityValues(original.events, eventIds, ['selected', 'evidenceIds']))
    if (!materialEqual || !timeEqual || !eventsEqual) reasons.push('FULL_ENTITY_DIFFERENCE')
    if (task.condition.value !== 'not_applicable') reasons.push('CONDITION_NOT_EXPRESSIBLE')
    if (raw.revisions.some(r => r.targetDirectiveId === task.id || r.fromDirectiveId === task.id)) reasons.push('REVISION_NOT_EXPRESSIBLE')
    if (s.speechAct !== 'directive' || s.polarity !== 'affirmative' || s.status !== 'pending' || s.validity !== 'active'
      || !['present', 'future'].includes(s.tense) || s.modality !== 'required' || !['addressee', 'addressed_group'].includes(s.actor)) reasons.push('STATUS_NOT_EXPRESSIBLE')
    if (eventIds.size) reasons.push('EVENT_NOT_CONFIRMABLE_IN_V2')
    if (item.issues.length || item.requiresAction !== 'true' || context.authority !== 'human_engineering'
      || !original.sourceSummary.requiresAction || previous?.selected === false) reasons.push('REQUIRES_REVIEW')
    rows.push({ taskId: task.id, capability: reasons.length ? 'NOT_SUPPORTED' : 'EQUIVALENT_OLD_V2', reasons })
  }
  return { review, rows, originalLegacy: old, legacyResult: original, eligibleTaskTempIds: rows.filter(r => r.capability === 'EQUIVALENT_OLD_V2').map(r => r.taskId),
    capture: 'ORIGINAL_OBJECT_ONLY' as const }
}
