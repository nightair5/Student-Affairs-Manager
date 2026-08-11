import type { EvidenceReference } from '../../types'
import type { RecognitionResult, TaskSuggestionV2 } from '../types'

export const PATH_A_PLANNING_NORMALIZER_VERSION = 'path-a-planning-normalizer-1.0.0'

export type PlanningNormalizationChangeType =
  | 'NORMALIZE_TASK_TITLE'
  | 'MERGE_DUPLICATE_EVIDENCE'
  | 'MERGE_DUPLICATE_TASK'
  | 'MERGE_SHARED_PREDICATE_TASK'
  | 'DEDUPLICATE_REFERENCE'
  | 'REPAIR_TASK_HIERARCHY'
  | 'REPAIR_MATERIAL_TASK_REFERENCE'

export interface PlanningNormalizationChange {
  type: PlanningNormalizationChangeType
  entityIds: string[]
  detail: string
}

export interface PlanningNormalizationAudit {
  normalizerVersion: typeof PATH_A_PLANNING_NORMALIZER_VERSION
  changes: PlanningNormalizationChange[]
  before: { tasks: number; materials: number; timePoints: number; events: number; ambiguities: number; evidence: number }
  after: { tasks: number; materials: number; timePoints: number; events: number; ambiguities: number; evidence: number }
  invariants: {
    preservedTimePointIds: boolean
    preservedEventIds: boolean
    preservedAmbiguityIds: boolean
    preservedMaterialIds: boolean
    addedTaskIds: boolean
    addedMilestoneIds: boolean
  }
}

export interface PlanningNormalizationResult {
  result: RecognitionResult
  audit: PlanningNormalizationAudit
}

interface TaskLocation {
  task: TaskSuggestionV2
  container: TaskSuggestionV2[]
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function normalizedText(value: string): string {
  return value.normalize('NFKC').trim().replace(/[\s\u3000]+/gu, '').replace(/[，。；、,.!?！？：:（）()【】[\]“”"']/gu, '').toLowerCase()
}

function normalizedTitle(value: string): string {
  return value.normalize('NFKC').trim().replace(/[\s\u3000]+/gu, ' ').replace(/^[，。；、,.!?！？：:]+|[，。；、,.!?！？：:]+$/gu, '')
}

function sortedKey(values: string[]): string {
  return unique(values).sort().join('|')
}

function sameMembers(left: string[], right: string[]): boolean {
  return sortedKey(left) === sortedKey(right)
}

function overlaps(left: string[], right: string[]): boolean {
  const rightSet = new Set(right)
  return left.some((value) => rightSet.has(value))
}

function allTaskLocations(result: RecognitionResult): TaskLocation[] {
  return [
    ...result.standaloneTasks.map((task) => ({ task, container: result.standaloneTasks })),
    ...result.milestones.flatMap((milestone) => [
      ...milestone.tasks.map((task) => ({ task, container: milestone.tasks })),
      ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks.map((task) => ({ task, container: workPackage.tasks }))),
    ]),
  ]
}

function allTasks(result: RecognitionResult): TaskSuggestionV2[] {
  return allTaskLocations(result).map(({ task }) => task)
}

function counts(result: RecognitionResult) {
  return {
    tasks: allTasks(result).length,
    materials: result.materials.length,
    timePoints: result.timePoints.length,
    events: result.events.length,
    ambiguities: result.ambiguities.length,
    evidence: result.evidence.length,
  }
}

function evidenceKey(item: EvidenceReference): string {
  return [
    item.sourceId,
    item.field,
    item.page ?? '',
    item.textStart ?? '',
    item.textEnd ?? '',
    item.quotedText ?? item.quote,
  ].join('\u0000')
}

function mergeEvidence(base: EvidenceReference, duplicate: EvidenceReference): EvidenceReference {
  return {
    ...base,
    quote: base.quote || duplicate.quote,
    quotedText: base.quotedText || duplicate.quotedText,
    confidence: Math.max(base.confidence ?? 0, duplicate.confidence ?? 0),
  }
}

function replaceIds(values: string[], replacements: Map<string, string>, changes: PlanningNormalizationChange[], entityId: string): string[] {
  const replaced = values.map((value) => replacements.get(value) ?? value)
  const deduplicated = unique(replaced)
  if (!sameMembers(values, deduplicated) || values.length !== deduplicated.length) {
    changes.push({ type: 'DEDUPLICATE_REFERENCE', entityIds: [entityId], detail: '重复或已合并的引用已重定向并去重。' })
  }
  return deduplicated
}

function rewriteEvidenceReferences(result: RecognitionResult, replacements: Map<string, string>, changes: PlanningNormalizationChange[]) {
  if (replacements.size === 0) return
  const rewrite = (entityId: string, values: string[]) => replaceIds(values, replacements, changes, entityId)
  if (result.projectSuggestion) {
    for (const field of Object.values(result.projectSuggestion)) field.evidenceIds = rewrite('projectSuggestion', field.evidenceIds)
  }
  result.milestones.forEach((milestone) => {
    milestone.evidenceIds = rewrite(milestone.tempId, milestone.evidenceIds)
    milestone.workPackages.forEach((workPackage) => { workPackage.evidenceIds = rewrite(workPackage.tempId, workPackage.evidenceIds) })
  })
  allTasks(result).forEach((task) => { task.evidenceIds = rewrite(task.tempId, task.evidenceIds) })
  result.materials.forEach((material) => { material.evidenceIds = rewrite(material.tempId, material.evidenceIds) })
  result.timePoints.forEach((timePoint) => { timePoint.evidenceIds = rewrite(timePoint.tempId, timePoint.evidenceIds) })
  result.events.forEach((event) => { event.evidenceIds = rewrite(event.tempId, event.evidenceIds) })
  result.conflicts.forEach((conflict) => { conflict.evidenceIds = rewrite(conflict.id, conflict.evidenceIds) })
  result.ambiguities.forEach((ambiguity) => { ambiguity.evidenceIds = rewrite(ambiguity.id, ambiguity.evidenceIds) })
}

function mergeTaskFields(canonical: TaskSuggestionV2, duplicate: TaskSuggestionV2) {
  canonical.description = canonical.description.length >= duplicate.description.length ? canonical.description : duplicate.description
  canonical.completionCriteria = unique([...canonical.completionCriteria, ...duplicate.completionCriteria])
  canonical.dependencyTempIds = unique([...canonical.dependencyTempIds, ...duplicate.dependencyTempIds])
  canonical.materialTempIds = unique([...canonical.materialTempIds, ...duplicate.materialTempIds])
  canonical.timePointTempIds = unique([...canonical.timePointTempIds, ...duplicate.timePointTempIds])
  canonical.evidenceIds = unique([...canonical.evidenceIds, ...duplicate.evidenceIds])
  canonical.confidence = Math.max(canonical.confidence, duplicate.confidence)
  canonical.userConfirmationRequired ||= duplicate.userConfirmationRequired
  canonical.selected = canonical.selected !== false || duplicate.selected !== false
}

function exactDuplicate(left: TaskSuggestionV2, right: TaskSuggestionV2): boolean {
  if (left.hierarchyType !== right.hierarchyType || left.parentTempId !== right.parentTempId) return false
  if (normalizedText(left.actionVerb) !== normalizedText(right.actionVerb)) return false
  if (normalizedText(left.actionObject) !== normalizedText(right.actionObject)) return false
  if (left.timePointTempIds.length > 0 && right.timePointTempIds.length > 0 && !sameMembers(left.timePointTempIds, right.timePointTempIds)) return false
  return overlaps(left.evidenceIds, right.evidenceIds)
    || (left.timePointTempIds.length > 0 && sameMembers(left.timePointTempIds, right.timePointTempIds))
}

function sharedPredicateDuplicate(left: TaskSuggestionV2, right: TaskSuggestionV2, evidence: Map<string, EvidenceReference>): boolean {
  if (left.hierarchyType !== right.hierarchyType || left.parentTempId !== right.parentTempId) return false
  if (!normalizedText(left.actionVerb) || normalizedText(left.actionVerb) !== normalizedText(right.actionVerb)) return false
  if (!sameMembers(left.evidenceIds, right.evidenceIds) || left.evidenceIds.length === 0) return false
  if (!sameMembers(left.timePointTempIds, right.timePointTempIds)) return false
  if (left.materialTempIds.length === 0 || right.materialTempIds.length === 0) return false
  const quotes = left.evidenceIds.map((id) => evidence.get(id)?.quotedText ?? evidence.get(id)?.quote ?? '').join('')
  const verb = left.actionVerb.trim()
  if (!verb) return false
  return quotes.split(verb).length - 1 === 1
}

function mergeTasks(result: RecognitionResult, changes: PlanningNormalizationChange[]) {
  const locations = allTaskLocations(result)
  const evidence = new Map(result.evidence.map((item) => [item.id, item]))
  const replacements = new Map<string, string>()
  for (let index = 0; index < locations.length; index += 1) {
    const canonical = locations[index].task
    if (replacements.has(canonical.tempId)) continue
    for (let candidateIndex = index + 1; candidateIndex < locations.length; candidateIndex += 1) {
      const duplicate = locations[candidateIndex].task
      if (replacements.has(duplicate.tempId)) continue
      const exact = exactDuplicate(canonical, duplicate)
      const sharedPredicate = !exact && sharedPredicateDuplicate(canonical, duplicate, evidence)
      if (!exact && !sharedPredicate) continue
      if (sharedPredicate && normalizedText(canonical.actionObject) !== normalizedText(duplicate.actionObject)) {
        const objects = unique([canonical.actionObject.trim(), duplicate.actionObject.trim()].filter(Boolean))
        canonical.actionObject = objects.join('、')
        canonical.title = `${canonical.actionVerb.trim()}${canonical.actionObject}`
      }
      mergeTaskFields(canonical, duplicate)
      replacements.set(duplicate.tempId, canonical.tempId)
      changes.push({
        type: sharedPredicate ? 'MERGE_SHARED_PREDICATE_TASK' : 'MERGE_DUPLICATE_TASK',
        entityIds: [canonical.tempId, duplicate.tempId],
        detail: sharedPredicate ? '同一逐字证据中的单一动作谓词及其并列材料已合并。' : '相同动作、对象及证据或时间绑定的重复任务已合并。',
      })
    }
  }
  if (replacements.size === 0) return
  const keep = (task: TaskSuggestionV2) => !replacements.has(task.tempId)
  result.standaloneTasks = result.standaloneTasks.filter(keep)
  result.milestones.forEach((milestone) => {
    milestone.tasks = milestone.tasks.filter(keep)
    milestone.workPackages.forEach((workPackage) => { workPackage.tasks = workPackage.tasks.filter(keep) })
  })
  allTasks(result).forEach((task) => {
    task.parentTempId = task.parentTempId ? replacements.get(task.parentTempId) ?? task.parentTempId : null
    task.dependencyTempIds = replaceIds(task.dependencyTempIds, replacements, changes, task.tempId)
  })
  result.materials.forEach((material) => { material.relatedTaskTempIds = replaceIds(material.relatedTaskTempIds, replacements, changes, material.tempId) })
  result.timePoints.forEach((timePoint) => { timePoint.relatedTaskTempIds = replaceIds(timePoint.relatedTaskTempIds, replacements, changes, timePoint.tempId) })
  result.conflicts.forEach((conflict) => { conflict.entityTempIds = replaceIds(conflict.entityTempIds, replacements, changes, conflict.id) })
}

function normalizeTaskHierarchy(result: RecognitionResult, changes: PlanningNormalizationChange[]) {
  const tasks = allTasks(result)
  const byId = new Map(tasks.map((task) => [task.tempId, task]))
  for (const task of tasks) {
    const originalParent = task.parentTempId
    const originalType = task.hierarchyType
    if (task.hierarchyType === 'task' && task.parentTempId !== null) task.parentTempId = null
    if (task.hierarchyType === 'subtask') {
      const visited = new Set([task.tempId])
      let parent = task.parentTempId ? byId.get(task.parentTempId) : undefined
      while (parent?.hierarchyType === 'subtask' && parent.parentTempId && !visited.has(parent.tempId)) {
        visited.add(parent.tempId)
        parent = byId.get(parent.parentTempId)
      }
      if (parent?.hierarchyType === 'task') task.parentTempId = parent.tempId
      else {
        task.hierarchyType = 'task'
        task.parentTempId = null
      }
    }
    if (task.parentTempId !== originalParent || task.hierarchyType !== originalType) {
      changes.push({ type: 'REPAIR_TASK_HIERARCHY', entityIds: [task.tempId], detail: '层级已限制为最多一层；无法唯一定位父任务的孤立子任务提升为顶层任务。' })
    }
  }
}

function normalizeTaskTitles(result: RecognitionResult, changes: PlanningNormalizationChange[]) {
  for (const task of allTasks(result)) {
    const normalized = normalizedTitle(task.title)
    const fallback = `${task.actionVerb.trim()}${task.actionObject.trim()}`
    const title = normalized || fallback
    if (title !== task.title) {
      task.title = title
      changes.push({ type: 'NORMALIZE_TASK_TITLE', entityIds: [task.tempId], detail: '仅规范首尾标点与空白；空标题回退为既有动作和对象。' })
    }
  }
}

function normalizeMaterialReferences(result: RecognitionResult, changes: PlanningNormalizationChange[]) {
  const tasks = allTasks(result)
  const taskById = new Map(tasks.map((task) => [task.tempId, task]))
  const materialById = new Map(result.materials.map((material) => [material.tempId, material]))
  for (const task of tasks) task.materialTempIds = unique(task.materialTempIds)
  for (const material of result.materials) {
    const prior = [...material.relatedTaskTempIds]
    const valid = unique(prior.filter((taskId) => taskById.has(taskId)))
    const reciprocal = tasks.filter((task) => task.materialTempIds.includes(material.tempId)).map((task) => task.tempId)
    let related = unique([...valid, ...reciprocal])
    if (related.length === 0) {
      const evidenceCandidates = tasks.filter((task) => overlaps(task.evidenceIds, material.evidenceIds))
      if (evidenceCandidates.length === 1) related = [evidenceCandidates[0].tempId]
    }
    material.relatedTaskTempIds = related.length > 0 ? related : prior
    for (const taskId of related) {
      const task = taskById.get(taskId)
      if (task && !task.materialTempIds.includes(material.tempId)) task.materialTempIds.push(material.tempId)
    }
    if (!sameMembers(prior, material.relatedTaskTempIds) || prior.length !== material.relatedTaskTempIds.length) {
      changes.push({ type: 'REPAIR_MATERIAL_TASK_REFERENCE', entityIds: [material.tempId, ...material.relatedTaskTempIds], detail: '依据既有双向引用或唯一共享证据修复 Material↔Task 关联。' })
    }
  }
  for (const task of tasks) {
    task.materialTempIds = unique(task.materialTempIds)
    for (const materialId of task.materialTempIds) {
      const material = materialById.get(materialId)
      if (material && !material.relatedTaskTempIds.includes(task.tempId)) material.relatedTaskTempIds.push(task.tempId)
    }
  }
}

function normalizeArrayReferences(result: RecognitionResult, changes: PlanningNormalizationChange[]) {
  for (const task of allTasks(result)) {
    task.dependencyTempIds = replaceIds(task.dependencyTempIds, new Map(), changes, task.tempId)
    task.materialTempIds = replaceIds(task.materialTempIds, new Map(), changes, task.tempId)
    task.timePointTempIds = replaceIds(task.timePointTempIds, new Map(), changes, task.tempId)
    task.evidenceIds = replaceIds(task.evidenceIds, new Map(), changes, task.tempId)
  }
  result.materials.forEach((item) => {
    item.relatedTaskTempIds = replaceIds(item.relatedTaskTempIds, new Map(), changes, item.tempId)
    item.evidenceIds = replaceIds(item.evidenceIds, new Map(), changes, item.tempId)
  })
  result.timePoints.forEach((item) => {
    item.relatedTaskTempIds = replaceIds(item.relatedTaskTempIds, new Map(), changes, item.tempId)
    item.relatedMaterialTempIds = replaceIds(item.relatedMaterialTempIds, new Map(), changes, item.tempId)
    item.evidenceIds = replaceIds(item.evidenceIds, new Map(), changes, item.tempId)
  })
  result.events.forEach((item) => { item.evidenceIds = replaceIds(item.evidenceIds, new Map(), changes, item.tempId) })
  result.ambiguities.forEach((item) => { item.evidenceIds = replaceIds(item.evidenceIds, new Map(), changes, item.id) })
}

function sameIdSet(before: string[], after: string[]): boolean {
  return before.length === after.length && sameMembers(before, after)
}

export function normalizePathAPlanning(input: RecognitionResult): PlanningNormalizationResult {
  const result = structuredClone(input)
  const changes: PlanningNormalizationChange[] = []
  const before = counts(input)
  const beforeIds = {
    tasks: allTasks(input).map((task) => task.tempId),
    milestones: input.milestones.map((item) => item.tempId),
    materials: input.materials.map((item) => item.tempId),
    timePoints: input.timePoints.map((item) => item.tempId),
    events: input.events.map((item) => item.tempId),
    ambiguities: input.ambiguities.map((item) => item.id),
  }

  const canonicalEvidence = new Map<string, EvidenceReference>()
  const evidenceReplacements = new Map<string, string>()
  for (const item of result.evidence) {
    const key = evidenceKey(item)
    const existing = canonicalEvidence.get(key)
    if (!existing) canonicalEvidence.set(key, item)
    else {
      canonicalEvidence.set(key, mergeEvidence(existing, item))
      evidenceReplacements.set(item.id, existing.id)
      changes.push({ type: 'MERGE_DUPLICATE_EVIDENCE', entityIds: [existing.id, item.id], detail: '相同来源位置、字段与逐字引文的 Evidence 已合并。' })
    }
  }
  result.evidence = [...canonicalEvidence.values()]
  rewriteEvidenceReferences(result, evidenceReplacements, changes)
  normalizeTaskTitles(result, changes)
  mergeTasks(result, changes)
  normalizeTaskHierarchy(result, changes)
  normalizeMaterialReferences(result, changes)
  normalizeArrayReferences(result, changes)

  const after = counts(result)
  const afterTaskIds = new Set(allTasks(result).map((task) => task.tempId))
  const afterMilestoneIds = new Set(result.milestones.map((item) => item.tempId))
  const audit: PlanningNormalizationAudit = {
    normalizerVersion: PATH_A_PLANNING_NORMALIZER_VERSION,
    changes,
    before,
    after,
    invariants: {
      preservedTimePointIds: sameIdSet(beforeIds.timePoints, result.timePoints.map((item) => item.tempId)),
      preservedEventIds: sameIdSet(beforeIds.events, result.events.map((item) => item.tempId)),
      preservedAmbiguityIds: sameIdSet(beforeIds.ambiguities, result.ambiguities.map((item) => item.id)),
      preservedMaterialIds: sameIdSet(beforeIds.materials, result.materials.map((item) => item.tempId)),
      addedTaskIds: [...afterTaskIds].some((id) => !beforeIds.tasks.includes(id)),
      addedMilestoneIds: [...afterMilestoneIds].some((id) => !beforeIds.milestones.includes(id)),
    },
  }
  if (!audit.invariants.preservedTimePointIds || !audit.invariants.preservedEventIds || !audit.invariants.preservedAmbiguityIds
    || !audit.invariants.preservedMaterialIds || audit.invariants.addedTaskIds || audit.invariants.addedMilestoneIds) {
    throw new Error('PATH_A_PLANNING_NORMALIZER_INVARIANT_FAILED')
  }
  return { result, audit }
}
