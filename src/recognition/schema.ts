import type {
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
const conflictTypes = new Set(['deadline', 'project_match', 'duplicate', 'hierarchy', 'other'])
const ignoredReasons = new Set(['background', 'contact', 'address', 'policy', 'format_requirement', 'other'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown, max = 50): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every((item) => typeof item === 'string')
}

function boundedString(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0)
}

function confidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
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
}

function validTimePoint(value: unknown): value is TimePointSuggestionV2 {
  if (!isRecord(value)) return false
  return boundedString(value.tempId, 100)
    && timePointTypes.has(String(value.type))
    && boundedString(value.rawText, 160)
    && (value.normalizedValue === null || (boundedString(value.normalizedValue, 80) && !Number.isNaN(new Date(value.normalizedValue).getTime())))
    && boundedString(value.timezone, 80)
    && typeof value.isAllDay === 'boolean'
    && ['exact', 'date_only', 'relative', 'vague'].includes(String(value.precision))
    && typeof value.needsConfirmation === 'boolean'
    && isStringArray(value.relatedTaskTempIds, 30)
    && isStringArray(value.relatedMaterialTempIds, 30)
    && isStringArray(value.evidenceIds, 20)
    && confidence(value.confidence)
}

function validMaterial(value: unknown): boolean {
  if (!isRecord(value)) return false
  return boundedString(value.tempId, 100)
    && boundedString(value.name, 100)
    && typeof value.required === 'boolean'
    && isStringArray(value.formatRequirements, 10)
    && isStringArray(value.namingRequirements, 10)
    && (value.quantity === null || (typeof value.quantity === 'number' && Number.isInteger(value.quantity) && value.quantity >= 1 && value.quantity <= 100))
    && (value.submissionChannel === null || boundedString(value.submissionChannel, 100))
    && isStringArray(value.relatedTaskTempIds, 30)
    && isStringArray(value.evidenceIds, 20)
    && confidence(value.confidence)
}

function validEvent(value: unknown): boolean {
  if (!isRecord(value)) return false
  return boundedString(value.tempId, 100)
    && boundedString(value.title, 100)
    && boundedString(value.description, 500, true)
    && (value.startTimePointTempId === null || boundedString(value.startTimePointTempId, 100))
    && (value.endTimePointTempId === null || boundedString(value.endTimePointTempId, 100))
    && (value.location === null || boundedString(value.location, 160))
    && isStringArray(value.evidenceIds, 20)
    && confidence(value.confidence)
    && inferenceLevels.has(String(value.inferenceLevel))
}

export function isRecognitionResult(value: unknown): value is RecognitionResult {
  if (!isRecord(value) || value.schemaVersion !== '2.0') return false
  if (!boundedString(value.promptVersion, 80) || !boundedString(value.modelName, 80) || !boundedString(value.createdAt, 80)) return false
  if (!isRecord(value.sourceSummary) || !boundedString(value.sourceSummary.title, 160)
    || !boundedString(value.sourceSummary.sourceType, 30)
    || !boundedString(value.sourceSummary.notificationType, 40)
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
      || !categories.has(String((value.projectSuggestion.category as Record<string, unknown>).value))) return false
  }
  if (!Array.isArray(value.milestones) || value.milestones.length > 10) return false
  for (const milestone of value.milestones) {
    if (!isRecord(milestone) || !boundedString(milestone.tempId, 100) || !boundedString(milestone.title, 100)
      || !boundedString(milestone.objective, 300, true) || typeof milestone.order !== 'number'
      || !isStringArray(milestone.evidenceIds, 20) || !Array.isArray(milestone.workPackages)
      || milestone.workPackages.length > 8 || !Array.isArray(milestone.tasks)
      || !milestone.tasks.every(validTask)) return false
    for (const workPackage of milestone.workPackages) {
      if (!isRecord(workPackage) || !boundedString(workPackage.tempId, 100) || !boundedString(workPackage.title, 100)
        || !boundedString(workPackage.objective, 300, true) || typeof workPackage.order !== 'number'
        || !isStringArray(workPackage.evidenceIds, 20) || !Array.isArray(workPackage.tasks)
        || workPackage.tasks.length > 20 || !workPackage.tasks.every(validTask)) return false
    }
  }
  if (!Array.isArray(value.standaloneTasks) || !value.standaloneTasks.every(validTask)) return false
  if (!Array.isArray(value.materials) || value.materials.length > 60 || !value.materials.every(validMaterial)) return false
  if (!Array.isArray(value.timePoints) || value.timePoints.length > 60 || !value.timePoints.every(validTimePoint)) return false
  if (!Array.isArray(value.events) || value.events.length > 30 || !value.events.every(validEvent)) return false
  if (!Array.isArray(value.evidence) || value.evidence.length > 120 || !value.evidence.every((item) => {
    if (!isRecord(item)) return false
    return boundedString(item.id, 100) && boundedString(item.sourceId, 100)
      && boundedString(item.quote ?? item.quotedText, 500)
      && boundedString(item.field, 40)
      && (item.confidence === undefined || confidence(item.confidence))
  })) return false
  if (!Array.isArray(value.conflicts) || value.conflicts.length > 30 || !value.conflicts.every((item) => {
    if (!isRecord(item)) return false
    return boundedString(item.id, 100)
      && conflictTypes.has(String(item.type))
      && boundedString(item.message, 500)
      && isStringArray(item.entityTempIds, 30)
      && isStringArray(item.evidenceIds, 20)
      && typeof item.requiresDecision === 'boolean'
  })) return false
  if (!Array.isArray(value.ambiguities) || value.ambiguities.length > 30 || !value.ambiguities.every((item) => {
    if (!isRecord(item)) return false
    return boundedString(item.id, 100)
      && boundedString(item.field, 100)
      && boundedString(item.message, 500)
      && isStringArray(item.options, 12)
      && isStringArray(item.evidenceIds, 20)
  })) return false
  if (!Array.isArray(value.ignoredContent) || value.ignoredContent.length > 30 || !value.ignoredContent.every((item) => {
    if (!isRecord(item)) return false
    return boundedString(item.text, 500)
      && ignoredReasons.has(String(item.reason))
  })) return false
  if (!isRecord(value.quality)) return false
  const quality = value.quality
  return ['overallConfidence', 'hierarchyConfidence', 'dateConfidence', 'evidenceCoverage', 'duplicateRisk', 'overFragmentationRisk', 'missingActionRisk']
    .every((key) => confidence(quality[key]))
    && typeof quality.needsHumanReview === 'boolean'
    && isStringArray(quality.reviewReasons, 20)
}

export function parseRecognitionResult(value: unknown): RecognitionResult {
  if (!isRecognitionResult(value)) throw new Error('DeepSeek 返回的 RecognitionResult 2.0 结构无效')
  return value
}
