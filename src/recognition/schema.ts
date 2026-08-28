import type {
  MaterialSuggestionV2,
  RecognitionResult,
  TaskSuggestionV2,
  TimePointSuggestionV2,
} from './types'

const categories = new Set(['比赛', '保研', '课程', '老师任务', '其他'])
const inferenceLevels = new Set(['explicit', 'strong_inference', 'optional_suggestion'])
const priorities = new Set(['low', 'medium', 'high', 'urgent'])
const timePointTypes = new Set([
  'registration_deadline', 'submission_deadline', 'task_deadline', 'event_start',
  'event_end', 'result_announcement', 'planned_start',
])
const notificationTypes = new Set([
  'new_project', 'project_addendum', 'project_correction', 'course_assignment', 'teacher_task',
  'event_notice', 'meeting_notice', 'material_submission', 'registration_notice', 'result_notice',
  'information_only', 'uncertain',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown, max = 50): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every((item) => typeof item === 'string' && item.trim().length > 0)
}

function boundedString(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0)
}

function confidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

function optionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean'
}

function validTask(value: unknown): value is TaskSuggestionV2 {
  if (!isRecord(value)) return false
  return boundedString(value.tempId, 100)
    && (value.parentTempId === null || boundedString(value.parentTempId, 100))
    && (value.hierarchyType === 'task' || value.hierarchyType === 'subtask')
    && boundedString(value.title, 80)
    && boundedString(value.actionVerb, 20)
    && boundedString(value.actionObject, 80)
    && boundedString(value.description, 800, true)
    && isStringArray(value.completionCriteria, 12)
    && (value.estimatedMinutes === null || (typeof value.estimatedMinutes === 'number' && value.estimatedMinutes >= 5 && value.estimatedMinutes <= 10_080))
    && value.statusSuggestion === 'todo'
    && priorities.has(String(value.prioritySuggestion))
    && isStringArray(value.dependencyTempIds, 20)
    && isStringArray(value.materialTempIds, 20)
    && isStringArray(value.timePointTempIds, 20)
    && isStringArray(value.evidenceIds, 20)
    && confidence(value.confidence)
    && inferenceLevels.has(String(value.inferenceLevel))
    && typeof value.userConfirmationRequired === 'boolean'
    && optionalBoolean(value.selected)
}

function validTimePoint(value: unknown): value is TimePointSuggestionV2 {
  if (!isRecord(value)) return false
  return boundedString(value.tempId, 100)
    && timePointTypes.has(String(value.type))
    && boundedString(value.rawText, 160)
    && (value.normalizedValue === null || (boundedString(value.normalizedValue, 80) && !Number.isNaN(new Date(value.normalizedValue).getTime())))
    && boundedString(value.timezone, 80, true)
    && typeof value.isAllDay === 'boolean'
    && ['exact', 'date_only', 'relative', 'vague'].includes(String(value.precision))
    && typeof value.needsConfirmation === 'boolean'
    && isStringArray(value.relatedTaskTempIds, 30)
    && isStringArray(value.relatedMaterialTempIds, 30)
    && isStringArray(value.evidenceIds, 20)
    && confidence(value.confidence)
    && optionalBoolean(value.selected)
}

function validMaterial(value: unknown): value is MaterialSuggestionV2 {
  if (!isRecord(value)) return false
  return boundedString(value.tempId, 100)
    && boundedString(value.name, 160)
    && typeof value.required === 'boolean'
    && isStringArray(value.formatRequirements, 20)
    && isStringArray(value.namingRequirements, 20)
    && (value.quantity === null || (typeof value.quantity === 'number' && Number.isFinite(value.quantity)))
    && (value.submissionChannel === null || boundedString(value.submissionChannel, 160))
    && isStringArray(value.relatedTaskTempIds, 30)
    && isStringArray(value.evidenceIds, 20)
    && confidence(value.confidence)
    && optionalBoolean(value.selected)
}

function validEvent(value: unknown): boolean {
  if (!isRecord(value)) return false
  return boundedString(value.tempId, 100)
    && boundedString(value.title, 160)
    && boundedString(value.description, 800, true)
    && (value.startTimePointTempId === null || boundedString(value.startTimePointTempId, 100))
    && (value.endTimePointTempId === null || boundedString(value.endTimePointTempId, 100))
    && (value.location === null || boundedString(value.location, 200))
    && isStringArray(value.evidenceIds, 20)
    && confidence(value.confidence)
    && inferenceLevels.has(String(value.inferenceLevel))
    && optionalBoolean(value.selected)
}

function validEvidence(value: unknown): boolean {
  if (!isRecord(value)) return false
  const box = value.boundingBox
  return boundedString(value.id, 100)
    && boundedString(value.sourceId, 100)
    && boundedString(value.quote ?? value.quotedText, 500)
    && ['title', 'deadline', 'materials', 'description', 'project', 'milestone', 'event', 'requirement'].includes(String(value.field))
    && (value.page === undefined || (typeof value.page === 'number' && Number.isFinite(value.page)))
    && (value.textStart === undefined || (typeof value.textStart === 'number' && Number.isFinite(value.textStart)))
    && (value.textEnd === undefined || (typeof value.textEnd === 'number' && Number.isFinite(value.textEnd)))
    && (box === undefined || (isRecord(box) && ['x', 'y', 'width', 'height'].every((key) => typeof box[key] === 'number' && Number.isFinite(box[key]))))
    && (value.extractionMethod === undefined || ['manual', 'demo', 'ocr', 'parser', 'ai'].includes(String(value.extractionMethod)))
    && (value.confidence === undefined || confidence(value.confidence))
}

function uniqueNonEmptyIds(values: unknown[]): boolean {
  const ids = values.map((item) => isRecord(item) ? item.tempId : null)
  return ids.every((id) => boundedString(id, 100)) && new Set(ids).size === ids.length
}

function referencesExist(result: RecognitionResult): boolean {
  const tasks = [
    ...result.standaloneTasks,
    ...result.milestones.flatMap((milestone) => [
      ...milestone.tasks,
      ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
    ]),
  ]
  const taskIds = new Set(tasks.map((item) => item.tempId))
  const materialIds = new Set(result.materials.map((item) => item.tempId))
  const timePointIds = new Set(result.timePoints.map((item) => item.tempId))
  const evidenceIds = new Set(result.evidence.map((item) => item.id))
  const entityIds = new Set<string>([
    ...taskIds,
    ...materialIds,
    ...timePointIds,
    ...result.events.map((item) => item.tempId),
    ...result.milestones.map((item) => item.tempId),
    ...result.milestones.flatMap((item) => item.workPackages.map((workPackage) => workPackage.tempId)),
  ])
  const refs = (ids: string[], existing: Set<string>) => ids.every((id) => existing.has(id))
  const projectEvidence = result.projectSuggestion
    ? Object.values(result.projectSuggestion).every((field) => refs(field.evidenceIds, evidenceIds))
    : true
  return projectEvidence
    && result.milestones.every((milestone) => refs(milestone.evidenceIds, evidenceIds)
      && milestone.workPackages.every((workPackage) => refs(workPackage.evidenceIds, evidenceIds)))
    && tasks.every((task) => (task.parentTempId === null || taskIds.has(task.parentTempId))
      && refs(task.dependencyTempIds, taskIds)
      && refs(task.materialTempIds, materialIds)
      && refs(task.timePointTempIds, timePointIds)
      && refs(task.evidenceIds, evidenceIds))
    && result.materials.every((material) => refs(material.relatedTaskTempIds, taskIds) && refs(material.evidenceIds, evidenceIds))
    && result.timePoints.every((point) => refs(point.relatedTaskTempIds, taskIds)
      && refs(point.relatedMaterialTempIds, materialIds)
      && refs(point.evidenceIds, evidenceIds))
    && result.events.every((event) => (event.startTimePointTempId === null || timePointIds.has(event.startTimePointTempId))
      && (event.endTimePointTempId === null || timePointIds.has(event.endTimePointTempId))
      && refs(event.evidenceIds, evidenceIds))
    && result.conflicts.every((conflict) => refs(conflict.entityTempIds, entityIds) && refs(conflict.evidenceIds, evidenceIds))
    && result.ambiguities.every((ambiguity) => refs(ambiguity.evidenceIds, evidenceIds))
}

export function isRecognitionResult(value: unknown): value is RecognitionResult {
  if (!isRecord(value) || value.schemaVersion !== '2.0') return false
  if (!boundedString(value.promptVersion, 80) || !boundedString(value.modelName, 80) || !boundedString(value.createdAt, 80)) return false
  if (!isRecord(value.sourceSummary) || !boundedString(value.sourceSummary.title, 160)
    || !boundedString(value.sourceSummary.sourceType, 30)
    || !notificationTypes.has(String(value.sourceSummary.notificationType))
    || !boundedString(value.sourceSummary.summary, 800, true)
    || typeof value.sourceSummary.requiresAction !== 'boolean'
    || !boundedString(value.sourceSummary.actionReason, 300, true)) return false
  if (!isRecord(value.projectMatch)
    || !['new_project', 'existing_project', 'standalone_task', 'uncertain'].includes(String(value.projectMatch.decision))
    || !(value.projectMatch.matchedProjectId === null || boundedString(value.projectMatch.matchedProjectId, 100))
    || !(value.projectMatch.suggestedProjectTitle === null || boundedString(value.projectMatch.suggestedProjectTitle, 160))
    || !confidence(value.projectMatch.confidence)
    || !isStringArray(value.projectMatch.reasons, 12)) return false
  if (value.projectSuggestion !== null) {
    if (!isRecord(value.projectSuggestion)) return false
    for (const key of ['title', 'category', 'objective', 'description']) {
      const field = value.projectSuggestion[key]
      if (!isRecord(field) || !isStringArray(field.evidenceIds, 20) || !confidence(field.confidence)
        || !inferenceLevels.has(String(field.inferenceLevel))) return false
    }
    if (!boundedString((value.projectSuggestion.title as Record<string, unknown>).value, 160)
      || !categories.has(String((value.projectSuggestion.category as Record<string, unknown>).value))
      || !boundedString((value.projectSuggestion.objective as Record<string, unknown>).value, 500, true)
      || !boundedString((value.projectSuggestion.description as Record<string, unknown>).value, 1000, true)) return false
  }
  if (!Array.isArray(value.milestones) || value.milestones.length > 10) return false
  for (const milestone of value.milestones) {
    if (!isRecord(milestone) || !boundedString(milestone.tempId, 100) || !boundedString(milestone.title, 100)
      || !boundedString(milestone.objective, 300, true) || typeof milestone.order !== 'number'
      || !isStringArray(milestone.evidenceIds, 20) || !Array.isArray(milestone.workPackages)
      || milestone.workPackages.length > 8 || !Array.isArray(milestone.tasks)
      || milestone.tasks.length > 20 || !milestone.tasks.every(validTask)) return false
    for (const workPackage of milestone.workPackages) {
      if (!isRecord(workPackage) || !boundedString(workPackage.tempId, 100) || !boundedString(workPackage.title, 100)
        || !boundedString(workPackage.objective, 300, true) || typeof workPackage.order !== 'number'
        || !isStringArray(workPackage.evidenceIds, 20) || !Array.isArray(workPackage.tasks)
        || workPackage.tasks.length > 20 || !workPackage.tasks.every(validTask)) return false
    }
  }
  if (!Array.isArray(value.standaloneTasks) || value.standaloneTasks.length > 20 || !value.standaloneTasks.every(validTask)) return false
  if (!Array.isArray(value.materials) || value.materials.length > 60 || !value.materials.every(validMaterial)) return false
  if (!Array.isArray(value.timePoints) || value.timePoints.length > 60 || !value.timePoints.every(validTimePoint)) return false
  if (!Array.isArray(value.events) || value.events.length > 30 || !value.events.every(validEvent)) return false
  if (!Array.isArray(value.evidence) || value.evidence.length > 120 || !value.evidence.every(validEvidence)) return false
  if (!Array.isArray(value.conflicts) || !value.conflicts.every((item) => isRecord(item)
    && boundedString(item.id, 100) && ['deadline', 'project_match', 'duplicate', 'hierarchy', 'other'].includes(String(item.type))
    && boundedString(item.message, 500) && isStringArray(item.entityTempIds, 30)
    && isStringArray(item.evidenceIds, 20) && typeof item.requiresDecision === 'boolean')) return false
  if (!Array.isArray(value.ambiguities) || !value.ambiguities.every((item) => isRecord(item)
    && boundedString(item.id, 100) && boundedString(item.field, 100) && boundedString(item.message, 500)
    && isStringArray(item.options, 20) && isStringArray(item.evidenceIds, 20))) return false
  if (!Array.isArray(value.ignoredContent) || !value.ignoredContent.every((item) => isRecord(item)
    && boundedString(item.text, 1000, true)
    && ['background', 'contact', 'address', 'policy', 'format_requirement', 'other'].includes(String(item.reason)))) return false
  if (!isRecord(value.quality)) return false
  const quality = value.quality
  if (!['overallConfidence', 'hierarchyConfidence', 'dateConfidence', 'evidenceCoverage', 'duplicateRisk', 'overFragmentationRisk', 'missingActionRisk']
    .every((key) => confidence(quality[key]))
    || typeof quality.needsHumanReview !== 'boolean'
    || !isStringArray(quality.reviewReasons, 20)) return false

  const validated = value as unknown as RecognitionResult
  const allTempEntities = [
    ...validated.milestones,
    ...validated.milestones.flatMap((milestone) => milestone.workPackages),
    ...validated.milestones.flatMap((milestone) => [...milestone.tasks, ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks)]),
    ...validated.standaloneTasks,
    ...validated.materials,
    ...validated.timePoints,
    ...validated.events,
  ]
  if (!uniqueNonEmptyIds(allTempEntities) || new Set(validated.evidence.map((item) => item.id)).size !== validated.evidence.length) return false
  return referencesExist(validated)
}

export function parseRecognitionResult(value: unknown): RecognitionResult {
  if (!isRecognitionResult(value)) throw new Error('DeepSeek 返回的 RecognitionResult 2.0 结构无效')
  return value
}
