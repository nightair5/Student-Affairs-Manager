import { isRecognitionResult } from '../../../recognition/schema'
import type { ValidationIssue } from './issues'

type UnknownRecord = Record<string, unknown>

const ENTITY_STATUS = new Set(['active', 'completed', 'archived'])
const TASK_CATEGORY = new Set(['比赛', '保研', '课程', '老师任务', '其他'])
const HISTORY_ENTITY_TYPE = new Set([
  'source', 'source_version', 'recognition_run', 'extraction_draft', 'project', 'milestone',
  'work_package', 'task', 'material', 'time_point', 'event', 'evidence', 'change_proposal', 'reminder',
])
const NOTIFICATION_TYPE = new Set([
  'new_project', 'project_addendum', 'project_correction', 'course_assignment', 'teacher_task',
  'event_notice', 'meeting_notice', 'material_submission', 'registration_notice', 'result_notice',
  'information_only', 'uncertain',
])

function issue(issues: ValidationIssue[], code: 'INVALID_TYPE' | 'INVALID_ENUM', path: string, message: string): void {
  issues.push({ code, path, message })
}

function isRecord(value: unknown): value is UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function record(value: unknown, path: string, issues: ValidationIssue[]): UnknownRecord | null {
  if (isRecord(value)) return value
  issue(issues, 'INVALID_TYPE', path, '必须是对象')
  return null
}

function stringField(value: UnknownRecord, key: string, path: string, issues: ValidationIssue[]): void {
  if (typeof value[key] !== 'string') issue(issues, 'INVALID_TYPE', `${path}.${key}`, '必须是字符串')
}

function nullableStringField(value: UnknownRecord, key: string, path: string, issues: ValidationIssue[]): void {
  if (value[key] !== null && typeof value[key] !== 'string') issue(issues, 'INVALID_TYPE', `${path}.${key}`, '必须是字符串或 null')
}

function booleanField(value: UnknownRecord, key: string, path: string, issues: ValidationIssue[]): void {
  if (typeof value[key] !== 'boolean') issue(issues, 'INVALID_TYPE', `${path}.${key}`, '必须是布尔值')
}

function numberField(value: UnknownRecord, key: string, path: string, issues: ValidationIssue[]): void {
  if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) issue(issues, 'INVALID_TYPE', `${path}.${key}`, '必须是有限数字')
}

function nullableNumberField(value: UnknownRecord, key: string, path: string, issues: ValidationIssue[]): void {
  if (value[key] !== null && (typeof value[key] !== 'number' || !Number.isFinite(value[key]))) {
    issue(issues, 'INVALID_TYPE', `${path}.${key}`, '必须是有限数字或 null')
  }
}

function enumField(value: UnknownRecord, key: string, allowed: ReadonlySet<string>, path: string, issues: ValidationIssue[]): void {
  if (typeof value[key] !== 'string') {
    issue(issues, 'INVALID_TYPE', `${path}.${key}`, '必须是字符串枚举')
  } else if (!allowed.has(value[key])) {
    issue(issues, 'INVALID_ENUM', `${path}.${key}`, `不支持的枚举值：${value[key]}`)
  }
}

function stringArrayField(value: UnknownRecord, key: string, path: string, issues: ValidationIssue[]): void {
  const field = value[key]
  if (!Array.isArray(field)) {
    issue(issues, 'INVALID_TYPE', `${path}.${key}`, '必须是字符串数组')
    return
  }
  field.forEach((item, index) => {
    if (typeof item !== 'string') issue(issues, 'INVALID_TYPE', `${path}.${key}[${index}]`, '必须是字符串')
  })
}

function jsonValue(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object') return false

  const isArray = Array.isArray(value)
  if (!isArray && !isRecord(value)) return false
  if (ancestors.has(value)) return false
  ancestors.add(value)

  try {
    if (Object.getOwnPropertySymbols(value).length > 0) return false

    if (isArray) {
      const propertyNames = Object.getOwnPropertyNames(value)
      if (propertyNames.length !== value.length + 1) return false
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (!descriptor || !('value' in descriptor) || !jsonValue(descriptor.value, ancestors)) return false
      }
      return true
    }

    const propertyNames = Object.getOwnPropertyNames(value)
    if (propertyNames.length !== Object.keys(value).length) return false
    return propertyNames.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      return Boolean(descriptor?.enumerable && 'value' in descriptor && jsonValue(descriptor.value, ancestors))
    })
  } catch {
    return false
  } finally {
    ancestors.delete(value)
  }
}

function optionalReviewFields(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  if (value.needsReview !== undefined && typeof value.needsReview !== 'boolean') {
    issue(issues, 'INVALID_TYPE', `${path}.needsReview`, '必须是布尔值')
  }
  if (value.legacyData !== undefined) {
    if (!isRecord(value.legacyData)) {
      issue(issues, 'INVALID_TYPE', `${path}.legacyData`, '必须是对象')
    } else if (!jsonValue(value.legacyData)) {
      issue(issues, 'INVALID_TYPE', `${path}.legacyData`, '必须是可 JSON 往返的对象')
    }
  }
}

function idAndReview(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  stringField(value, 'id', path, issues)
  optionalReviewFields(value, path, issues)
}

function jsonField(value: UnknownRecord, key: string, path: string, issues: ValidationIssue[]): void {
  if (!jsonValue(value[key])) issue(issues, 'INVALID_TYPE', `${path}.${key}`, '必须是 JSON 值')
}

function entityArray(
  workspace: UnknownRecord,
  key: string,
  issues: ValidationIssue[],
  validate: (value: UnknownRecord, path: string, issues: ValidationIssue[]) => void,
): void {
  const values = workspace[key]
  if (!Array.isArray(values)) {
    issue(issues, 'INVALID_TYPE', key, '必须是数组')
    return
  }
  values.forEach((value, index) => {
    const path = `${key}[${index}]`
    const item = record(value, path, issues)
    if (item) validate(item, path, issues)
  })
}

function validateWorkspaceIdentity(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  idAndReview(value, path, issues)
  stringField(value, 'title', path, issues)
  stringField(value, 'createdAt', path, issues)
  stringField(value, 'updatedAt', path, issues)
}

function validateSource(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  idAndReview(value, path, issues)
  stringField(value, 'workspaceId', path, issues)
  enumField(value, 'type', new Set(['text', 'file', 'image', 'link']), path, issues)
  stringField(value, 'title', path, issues)
  enumField(value, 'status', new Set(['uploaded', 'extracting', 'needs_review', 'partially_confirmed', 'confirmed', 'failed', 'archived']), path, issues)
  stringField(value, 'currentVersionId', path, issues)
  stringField(value, 'createdAt', path, issues)
  stringField(value, 'updatedAt', path, issues)
}

function validateSourceVersion(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  idAndReview(value, path, issues)
  stringField(value, 'sourceId', path, issues)
  numberField(value, 'versionNo', path, issues)
  nullableStringField(value, 'contentHash', path, issues)
  nullableStringField(value, 'rawText', path, issues)
  nullableStringField(value, 'rawTextRef', path, issues)
  stringField(value, 'createdAt', path, issues)
}

function validateRecognitionRun(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  idAndReview(value, path, issues)
  stringField(value, 'sourceVersionId', path, issues)
  enumField(value, 'provider', new Set(['local-rules', 'deepseek', 'manual', 'legacy-unknown']), path, issues)
  nullableStringField(value, 'modelName', path, issues)
  nullableStringField(value, 'promptVersion', path, issues)
  stringField(value, 'schemaVersion', path, issues)
  stringField(value, 'pipelineVersion', path, issues)
  enumField(value, 'status', new Set(['queued', 'running', 'succeeded', 'failed']), path, issues)
  stringField(value, 'startedAt', path, issues)
  nullableStringField(value, 'completedAt', path, issues)
  nullableNumberField(value, 'durationMs', path, issues)
  if (value.tokenUsage !== null) {
    const tokenUsage = record(value.tokenUsage, `${path}.tokenUsage`, issues)
    if (tokenUsage) {
      numberField(tokenUsage, 'input', `${path}.tokenUsage`, issues)
      numberField(tokenUsage, 'output', `${path}.tokenUsage`, issues)
    }
  }
  stringArrayField(value, 'qualityFlags', path, issues)
  nullableStringField(value, 'errorCode', path, issues)
}

function optionalBooleanField(value: UnknownRecord, key: string, path: string, issues: ValidationIssue[]): void {
  if (value[key] !== undefined && typeof value[key] !== 'boolean') {
    issue(issues, 'INVALID_TYPE', `${path}.${key}`, '必须是布尔值')
  }
}

function recordArrayField(
  value: UnknownRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
  validate: (item: UnknownRecord, itemPath: string, issues: ValidationIssue[]) => void,
): void {
  const field = value[key]
  if (!Array.isArray(field)) {
    issue(issues, 'INVALID_TYPE', `${path}.${key}`, '必须是对象数组')
    return
  }
  field.forEach((item, index) => {
    const itemPath = `${path}.${key}[${index}]`
    const itemRecord = record(item, itemPath, issues)
    if (itemRecord) validate(itemRecord, itemPath, issues)
  })
}

function validateRecognitionTaskShape(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  stringField(value, 'tempId', path, issues)
  nullableStringField(value, 'parentTempId', path, issues)
  enumField(value, 'hierarchyType', new Set(['task', 'subtask']), path, issues)
  stringField(value, 'title', path, issues)
  stringField(value, 'actionVerb', path, issues)
  stringField(value, 'actionObject', path, issues)
  stringField(value, 'description', path, issues)
  stringArrayField(value, 'completionCriteria', path, issues)
  nullableNumberField(value, 'estimatedMinutes', path, issues)
  enumField(value, 'statusSuggestion', new Set(['todo']), path, issues)
  enumField(value, 'prioritySuggestion', new Set(['low', 'medium', 'high', 'urgent']), path, issues)
  stringArrayField(value, 'dependencyTempIds', path, issues)
  stringArrayField(value, 'materialTempIds', path, issues)
  stringArrayField(value, 'timePointTempIds', path, issues)
  stringArrayField(value, 'evidenceIds', path, issues)
  numberField(value, 'confidence', path, issues)
  enumField(value, 'inferenceLevel', new Set(['explicit', 'strong_inference', 'optional_suggestion']), path, issues)
  booleanField(value, 'userConfirmationRequired', path, issues)
  optionalBooleanField(value, 'selected', path, issues)
}

function validateRecognitionResult(value: unknown, path: string, issues: ValidationIssue[]): void {
  const issueCount = issues.length
  const result = record(value, path, issues)
  if (!result) return
  const sourceSummary = record(result.sourceSummary, `${path}.sourceSummary`, issues)
  if (sourceSummary) enumField(sourceSummary, 'notificationType', NOTIFICATION_TYPE, `${path}.sourceSummary`, issues)

  if (result.projectSuggestion !== null) {
    const projectSuggestion = record(result.projectSuggestion, `${path}.projectSuggestion`, issues)
    if (projectSuggestion) {
      for (const key of ['title', 'category', 'objective', 'description']) {
        const field = record(projectSuggestion[key], `${path}.projectSuggestion.${key}`, issues)
        if (!field) continue
        stringField(field, 'value', `${path}.projectSuggestion.${key}`, issues)
        stringArrayField(field, 'evidenceIds', `${path}.projectSuggestion.${key}`, issues)
        numberField(field, 'confidence', `${path}.projectSuggestion.${key}`, issues)
        enumField(field, 'inferenceLevel', new Set(['explicit', 'strong_inference', 'optional_suggestion']), `${path}.projectSuggestion.${key}`, issues)
      }
    }
  }

  recordArrayField(result, 'milestones', path, issues, (milestone, milestonePath, milestoneIssues) => {
    stringField(milestone, 'tempId', milestonePath, milestoneIssues)
    stringField(milestone, 'title', milestonePath, milestoneIssues)
    stringField(milestone, 'objective', milestonePath, milestoneIssues)
    numberField(milestone, 'order', milestonePath, milestoneIssues)
    stringArrayField(milestone, 'evidenceIds', milestonePath, milestoneIssues)
    recordArrayField(milestone, 'workPackages', milestonePath, milestoneIssues, (workPackage, workPackagePath, workPackageIssues) => {
      stringField(workPackage, 'tempId', workPackagePath, workPackageIssues)
      stringField(workPackage, 'title', workPackagePath, workPackageIssues)
      stringField(workPackage, 'objective', workPackagePath, workPackageIssues)
      numberField(workPackage, 'order', workPackagePath, workPackageIssues)
      stringArrayField(workPackage, 'evidenceIds', workPackagePath, workPackageIssues)
      recordArrayField(workPackage, 'tasks', workPackagePath, workPackageIssues, validateRecognitionTaskShape)
    })
    recordArrayField(milestone, 'tasks', milestonePath, milestoneIssues, validateRecognitionTaskShape)
  })
  recordArrayField(result, 'standaloneTasks', path, issues, validateRecognitionTaskShape)

  recordArrayField(result, 'materials', path, issues, (item, itemPath, itemIssues) => {
    stringField(item, 'tempId', itemPath, itemIssues)
    stringField(item, 'name', itemPath, itemIssues)
    booleanField(item, 'required', itemPath, itemIssues)
    stringArrayField(item, 'formatRequirements', itemPath, itemIssues)
    stringArrayField(item, 'namingRequirements', itemPath, itemIssues)
    nullableNumberField(item, 'quantity', itemPath, itemIssues)
    nullableStringField(item, 'submissionChannel', itemPath, itemIssues)
    stringArrayField(item, 'relatedTaskTempIds', itemPath, itemIssues)
    stringArrayField(item, 'evidenceIds', itemPath, itemIssues)
    numberField(item, 'confidence', itemPath, itemIssues)
    optionalBooleanField(item, 'selected', itemPath, itemIssues)
  })
  recordArrayField(result, 'timePoints', path, issues, (item, itemPath, itemIssues) => {
    stringField(item, 'tempId', itemPath, itemIssues)
    enumField(item, 'type', new Set(['registration_deadline', 'submission_deadline', 'task_deadline', 'event_start', 'event_end', 'result_announcement', 'planned_start']), itemPath, itemIssues)
    stringField(item, 'rawText', itemPath, itemIssues)
    nullableStringField(item, 'normalizedValue', itemPath, itemIssues)
    stringField(item, 'timezone', itemPath, itemIssues)
    booleanField(item, 'isAllDay', itemPath, itemIssues)
    enumField(item, 'precision', new Set(['exact', 'date_only', 'relative', 'vague']), itemPath, itemIssues)
    booleanField(item, 'needsConfirmation', itemPath, itemIssues)
    stringArrayField(item, 'relatedTaskTempIds', itemPath, itemIssues)
    stringArrayField(item, 'relatedMaterialTempIds', itemPath, itemIssues)
    stringArrayField(item, 'evidenceIds', itemPath, itemIssues)
    numberField(item, 'confidence', itemPath, itemIssues)
    optionalBooleanField(item, 'selected', itemPath, itemIssues)
  })
  recordArrayField(result, 'events', path, issues, (item, itemPath, itemIssues) => {
    stringField(item, 'tempId', itemPath, itemIssues)
    stringField(item, 'title', itemPath, itemIssues)
    stringField(item, 'description', itemPath, itemIssues)
    nullableStringField(item, 'startTimePointTempId', itemPath, itemIssues)
    nullableStringField(item, 'endTimePointTempId', itemPath, itemIssues)
    nullableStringField(item, 'location', itemPath, itemIssues)
    stringArrayField(item, 'evidenceIds', itemPath, itemIssues)
    numberField(item, 'confidence', itemPath, itemIssues)
    enumField(item, 'inferenceLevel', new Set(['explicit', 'strong_inference', 'optional_suggestion']), itemPath, itemIssues)
    optionalBooleanField(item, 'selected', itemPath, itemIssues)
  })
  recordArrayField(result, 'evidence', path, issues, (item, itemPath, itemIssues) => {
    stringField(item, 'id', itemPath, itemIssues)
    stringField(item, 'sourceId', itemPath, itemIssues)
    if (typeof (item.quote ?? item.quotedText) !== 'string') issue(itemIssues, 'INVALID_TYPE', `${itemPath}.quote`, 'quote 或 quotedText 必须是字符串')
    enumField(item, 'field', new Set(['title', 'deadline', 'materials', 'description', 'project', 'milestone', 'event', 'requirement']), itemPath, itemIssues)
    if (item.extractionMethod !== undefined) enumField(item, 'extractionMethod', new Set(['manual', 'demo', 'ocr', 'parser', 'ai']), itemPath, itemIssues)
    if (item.confidence !== undefined) numberField(item, 'confidence', itemPath, itemIssues)
  })
  recordArrayField(result, 'conflicts', path, issues, (item, itemPath, itemIssues) => {
    stringField(item, 'id', itemPath, itemIssues)
    enumField(item, 'type', new Set(['deadline', 'project_match', 'duplicate', 'hierarchy', 'other']), itemPath, itemIssues)
    stringField(item, 'message', itemPath, itemIssues)
    stringArrayField(item, 'entityTempIds', itemPath, itemIssues)
    stringArrayField(item, 'evidenceIds', itemPath, itemIssues)
    booleanField(item, 'requiresDecision', itemPath, itemIssues)
  })
  recordArrayField(result, 'ambiguities', path, issues, (item, itemPath, itemIssues) => {
    stringField(item, 'id', itemPath, itemIssues)
    stringField(item, 'field', itemPath, itemIssues)
    stringField(item, 'message', itemPath, itemIssues)
    stringArrayField(item, 'options', itemPath, itemIssues)
    stringArrayField(item, 'evidenceIds', itemPath, itemIssues)
  })
  recordArrayField(result, 'ignoredContent', path, issues, (item, itemPath, itemIssues) => {
    stringField(item, 'text', itemPath, itemIssues)
    enumField(item, 'reason', new Set(['background', 'contact', 'address', 'policy', 'format_requirement', 'other']), itemPath, itemIssues)
  })
  if (!isRecognitionResult(value) && issues.length === issueCount) {
    issue(issues, 'INVALID_TYPE', path, '必须是引用完整的 RecognitionResult 2.0')
  }
}

function validateExtractionDraft(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  idAndReview(value, path, issues)
  stringField(value, 'recognitionRunId', path, issues)
  enumField(value, 'status', new Set(['processing', 'needs_review', 'partially_confirmed', 'confirmed', 'rejected', 'failed', 'archived']), path, issues)
  if (value.result !== null) validateRecognitionResult(value.result, `${path}.result`, issues)
  stringArrayField(value, 'commitOperationIds', path, issues)
  stringArrayField(value, 'acceptedEntityTempIds', path, issues)
  stringArrayField(value, 'rejectedEntityTempIds', path, issues)
  stringField(value, 'createdAt', path, issues)
  stringField(value, 'updatedAt', path, issues)
}

function validateProject(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  idAndReview(value, path, issues)
  stringField(value, 'workspaceId', path, issues)
  stringField(value, 'title', path, issues)
  enumField(value, 'category', TASK_CATEGORY, path, issues)
  nullableStringField(value, 'objective', path, issues)
  enumField(value, 'status', ENTITY_STATUS, path, issues)
  stringField(value, 'createdAt', path, issues)
  stringField(value, 'updatedAt', path, issues)
  numberField(value, 'version', path, issues)
}

function validateMilestone(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  idAndReview(value, path, issues)
  stringField(value, 'projectId', path, issues)
  stringField(value, 'title', path, issues)
  nullableStringField(value, 'objective', path, issues)
  numberField(value, 'sortOrder', path, issues)
  enumField(value, 'status', ENTITY_STATUS, path, issues)
  stringField(value, 'createdAt', path, issues)
  stringField(value, 'updatedAt', path, issues)
}

function validateWorkPackage(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  idAndReview(value, path, issues)
  stringField(value, 'projectId', path, issues)
  stringField(value, 'milestoneId', path, issues)
  stringField(value, 'title', path, issues)
  nullableStringField(value, 'objective', path, issues)
  numberField(value, 'sortOrder', path, issues)
  stringField(value, 'createdAt', path, issues)
  stringField(value, 'updatedAt', path, issues)
}

function validateTask(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  idAndReview(value, path, issues)
  nullableStringField(value, 'projectId', path, issues)
  nullableStringField(value, 'milestoneId', path, issues)
  nullableStringField(value, 'workPackageId', path, issues)
  nullableStringField(value, 'parentTaskId', path, issues)
  stringField(value, 'title', path, issues)
  nullableStringField(value, 'description', path, issues)
  nullableStringField(value, 'nextAction', path, issues)
  enumField(value, 'status', new Set(['todo', 'in_progress', 'completed', 'cancelled']), path, issues)
  nullableNumberField(value, 'estimatedMinutes', path, issues)
  nullableNumberField(value, 'manualPriority', path, issues)
  nullableStringField(value, 'snoozedUntil', path, issues)
  stringArrayField(value, 'dependencyIds', path, issues)
  stringField(value, 'createdAt', path, issues)
  stringField(value, 'updatedAt', path, issues)
  numberField(value, 'version', path, issues)
}

function validateMaterial(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  idAndReview(value, path, issues)
  nullableStringField(value, 'projectId', path, issues)
  stringField(value, 'name', path, issues)
  booleanField(value, 'required', path, issues)
  enumField(value, 'status', new Set(['missing', 'preparing', 'ready', 'submitted', 'verified', 'not_required']), path, issues)
  stringArrayField(value, 'requirements', path, issues)
  stringArrayField(value, 'formatRequirements', path, issues)
  stringArrayField(value, 'namingRequirements', path, issues)
  nullableNumberField(value, 'quantity', path, issues)
  nullableStringField(value, 'submissionChannel', path, issues)
  stringArrayField(value, 'relatedTaskIds', path, issues)
  nullableStringField(value, 'deadlineTimePointId', path, issues)
  stringField(value, 'createdAt', path, issues)
  stringField(value, 'updatedAt', path, issues)
  numberField(value, 'version', path, issues)
}

function validateTimePoint(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  idAndReview(value, path, issues)
  nullableStringField(value, 'projectId', path, issues)
  nullableStringField(value, 'milestoneId', path, issues)
  nullableStringField(value, 'taskId', path, issues)
  nullableStringField(value, 'materialId', path, issues)
  nullableStringField(value, 'eventId', path, issues)
  stringArrayField(value, 'relatedTaskIds', path, issues)
  stringArrayField(value, 'relatedMaterialIds', path, issues)
  enumField(value, 'type', new Set(['registration_deadline', 'submission_deadline', 'task_deadline', 'event_start', 'event_end', 'result_announcement', 'planned_start']), path, issues)
  stringField(value, 'rawText', path, issues)
  nullableStringField(value, 'normalizedValue', path, issues)
  nullableStringField(value, 'timezone', path, issues)
  booleanField(value, 'isAllDay', path, issues)
  enumField(value, 'precision', new Set(['exact', 'date_only', 'relative', 'vague']), path, issues)
  booleanField(value, 'needsConfirmation', path, issues)
  stringField(value, 'createdAt', path, issues)
  stringField(value, 'updatedAt', path, issues)
}

function validateEvent(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  idAndReview(value, path, issues)
  nullableStringField(value, 'projectId', path, issues)
  stringField(value, 'title', path, issues)
  nullableStringField(value, 'description', path, issues)
  nullableStringField(value, 'startTimePointId', path, issues)
  nullableStringField(value, 'endTimePointId', path, issues)
  nullableStringField(value, 'location', path, issues)
  stringField(value, 'createdAt', path, issues)
  stringField(value, 'updatedAt', path, issues)
}

function validateEvidence(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  idAndReview(value, path, issues)
  stringField(value, 'sourceVersionId', path, issues)
  nullableNumberField(value, 'page', path, issues)
  nullableNumberField(value, 'textStart', path, issues)
  nullableNumberField(value, 'textEnd', path, issues)
  nullableStringField(value, 'quotedText', path, issues)
  if (value.bbox !== null) {
    const bbox = record(value.bbox, `${path}.bbox`, issues)
    if (bbox) ['x', 'y', 'width', 'height'].forEach((key) => numberField(bbox, key, `${path}.bbox`, issues))
  }
  nullableStringField(value, 'fieldPath', path, issues)
  enumField(value, 'extractionMethod', new Set(['manual', 'demo', 'ocr', 'parser', 'ai', 'migration']), path, issues)
  nullableNumberField(value, 'confidence', path, issues)
  stringField(value, 'createdAt', path, issues)
}

function validateHistory(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  idAndReview(value, path, issues)
  enumField(value, 'entityType', HISTORY_ENTITY_TYPE, path, issues)
  stringField(value, 'entityId', path, issues)
  stringField(value, 'action', path, issues)
  nullableStringField(value, 'fieldName', path, issues)
  jsonField(value, 'before', path, issues)
  jsonField(value, 'after', path, issues)
  enumField(value, 'actor', new Set(['user', 'system', 'migration']), path, issues)
  nullableStringField(value, 'reason', path, issues)
  nullableStringField(value, 'sourceVersionId', path, issues)
  stringField(value, 'changedAt', path, issues)
}

function validateReminder(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  idAndReview(value, path, issues)
  stringField(value, 'taskId', path, issues)
  enumField(value, 'channel', new Set(['browser', 'email', 'wechat-placeholder']), path, issues)
  nullableStringField(value, 'scheduledAt', path, issues)
  enumField(value, 'status', new Set(['draft', 'scheduled', 'sent', 'failed', 'unsupported']), path, issues)
  nullableStringField(value, 'errorCode', path, issues)
  nullableStringField(value, 'sentAt', path, issues)
}

function validateChangeProposal(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  idAndReview(value, path, issues)
  stringField(value, 'projectId', path, issues)
  stringField(value, 'sourceVersionId', path, issues)
  nullableStringField(value, 'recognitionRunId', path, issues)
  enumField(value, 'status', new Set(['draft', 'needs_review', 'accepted', 'rejected']), path, issues)
  enumField(value, 'changeType', new Set(['NEW', 'UPDATE', 'CONFLICT', 'INFO']), path, issues)
  const changes = value.changes
  if (!Array.isArray(changes)) {
    issue(issues, 'INVALID_TYPE', `${path}.changes`, '必须是数组')
  } else {
    changes.forEach((change, index) => {
      const changePath = `${path}.changes[${index}]`
      const item = record(change, changePath, issues)
      if (!item) return
      enumField(item, 'entityType', HISTORY_ENTITY_TYPE, changePath, issues)
      nullableStringField(item, 'entityId', changePath, issues)
      stringField(item, 'fieldPath', changePath, issues)
      jsonField(item, 'before', changePath, issues)
      jsonField(item, 'after', changePath, issues)
    })
  }
  stringArrayField(value, 'conflicts', path, issues)
  stringField(value, 'createdAt', path, issues)
  stringField(value, 'updatedAt', path, issues)
}

function validateMigrationMetadata(value: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  stringField(value, 'migrationId', path, issues)
  numberField(value, 'sourceVersion', path, issues)
  numberField(value, 'targetVersion', path, issues)
  stringField(value, 'startedAt', path, issues)
  nullableStringField(value, 'completedAt', path, issues)
  enumField(value, 'status', new Set(['prepared', 'completed', 'rolled_back', 'failed', 'needs_review']), path, issues)
  stringArrayField(value, 'warnings', path, issues)
  stringArrayField(value, 'errors', path, issues)
  nullableStringField(value, 'backupId', path, issues)
}

export function validateWorkspaceShape(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const workspace = record(value, 'workspaceV8', issues)
  if (!workspace) return issues
  if (workspace.schemaVersion !== 8) {
    issues.push({ code: 'INVALID_SCHEMA', path: 'schemaVersion', message: 'Workspace v8 的 schemaVersion 必须为 8' })
    return issues
  }

  const identity = record(workspace.workspace, 'workspace', issues)
  if (identity) validateWorkspaceIdentity(identity, 'workspace', issues)
  const settings = record(workspace.settings, 'settings', issues)
  if (settings) {
    stringField(settings, 'defaultTimezone', 'settings', issues)
    stringField(settings, 'locale', 'settings', issues)
  }
  const preferences = record(workspace.preferences, 'preferences', issues)
  if (preferences) {
    nullableStringField(preferences, 'onboardingCompletedAt', 'preferences', issues)
    optionalReviewFields(preferences, 'preferences', issues)
  }
  if (typeof workspace.savedAt !== 'string') issue(issues, 'INVALID_TYPE', 'savedAt', '必须是字符串')

  entityArray(workspace, 'sources', issues, validateSource)
  entityArray(workspace, 'sourceVersions', issues, validateSourceVersion)
  entityArray(workspace, 'recognitionRuns', issues, validateRecognitionRun)
  entityArray(workspace, 'extractionDrafts', issues, validateExtractionDraft)
  entityArray(workspace, 'projects', issues, validateProject)
  entityArray(workspace, 'milestones', issues, validateMilestone)
  entityArray(workspace, 'workPackages', issues, validateWorkPackage)
  entityArray(workspace, 'tasks', issues, validateTask)
  entityArray(workspace, 'materials', issues, validateMaterial)
  entityArray(workspace, 'timePoints', issues, validateTimePoint)
  entityArray(workspace, 'events', issues, validateEvent)
  entityArray(workspace, 'evidenceRefs', issues, validateEvidence)
  entityArray(workspace, 'changeProposals', issues, validateChangeProposal)
  entityArray(workspace, 'historyRecords', issues, validateHistory)
  entityArray(workspace, 'reminderRecords', issues, validateReminder)
  entityArray(workspace, 'migrationMetadata', issues, validateMigrationMetadata)
  return issues
}
