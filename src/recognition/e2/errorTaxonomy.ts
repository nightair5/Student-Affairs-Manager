import type { ErrorCategory, EvaluationFailure, RecognitionErrorTag } from './types'

const baseTags: Record<ErrorCategory, RecognitionErrorTag[]> = {
  project_decision: ['PROJECT_DECISION_ERROR'],
  milestone_missing: ['MISSING_MILESTONE'],
  milestone_spurious: ['OVER_MILESTONE'],
  task_missing: ['MISSING_TASK'],
  task_spurious: ['OVER_TASK'],
  task_hierarchy: ['TASK_GRANULARITY_ERROR'],
  material_missing: ['MISSING_MATERIAL'],
  time_missing: ['MISSING_TIMEPOINT'],
  time_incorrect: ['WRONG_TIME_VALUE'],
  event_missing: ['MISSING_EVENT'],
  event_spurious: ['WRONG_EVENT'],
  evidence_missing: ['MISSING_EVIDENCE'],
  ambiguity_missing: ['MISSING_AMBIGUITY'],
  duplicate: ['OVER_TASK'],
  over_fragmentation: ['TASK_GRANULARITY_ERROR', 'OVER_TASK'],
  forbidden_output: ['PROMPT_INJECTION_FAILURE', 'SEVERE_ERROR'],
  invalid_output: ['INVALID_SCHEMA', 'SEVERE_ERROR'],
  request_failure: ['TRANSPORT_FAILURE', 'SEVERE_ERROR'],
}

export function errorTagsFor(category: ErrorCategory, reason = ''): RecognitionErrorTag[] {
  const tags = [...baseTags[category]]
  const upper = reason.toUpperCase()
  if (category === 'time_incorrect') {
    if (/TYPE|类型/u.test(reason)) tags.push('WRONG_TIMEPOINT_TYPE')
    if (/TIMEZONE|时区/u.test(reason)) tags.push('WRONG_TIMEZONE')
    if (/RELATIVE|相对/u.test(reason)) tags.push('RELATIVE_TIME_ERROR')
    if (/PRECISION|精度|伪精确/u.test(reason)) tags.push('FALSE_PRECISION')
  }
  if (category === 'material_missing' && /任务|TASK/u.test(reason)) tags.push('MATERIAL_TASK_CONFUSION')
  if (category === 'evidence_missing' && /不在原文|UNSUPPORTED/u.test(reason)) tags.push('EVIDENCE_NOT_SUPPORTED')
  if (category === 'request_failure') {
    if (upper.includes('TIMEOUT') || /超时/u.test(reason)) tags.push('TIMEOUT')
    if (upper.includes('502')) tags.push('UPSTREAM_502')
    if (upper.includes('503')) tags.push('UPSTREAM_503')
  }
  return [...new Set(tags)]
}

export function withErrorTags(failure: EvaluationFailure): EvaluationFailure {
  return { ...failure, tags: errorTagsFor(failure.category, failure.reason) }
}

export const recognitionErrorTaxonomy: ReadonlyArray<{
  tag: RecognitionErrorTag
  family: 'semantic' | 'schema' | 'transport' | 'safety' | 'repair'
}> = [
  ['PROJECT_DECISION_ERROR', 'semantic'], ['MISSING_MILESTONE', 'semantic'], ['WRONG_MILESTONE', 'semantic'], ['OVER_MILESTONE', 'semantic'],
  ['MISSING_TASK', 'semantic'], ['WRONG_TASK', 'semantic'], ['OVER_TASK', 'semantic'], ['TASK_GRANULARITY_ERROR', 'semantic'],
  ['MISSING_MATERIAL', 'semantic'], ['WRONG_MATERIAL', 'semantic'], ['MATERIAL_TASK_CONFUSION', 'semantic'],
  ['MISSING_TIMEPOINT', 'semantic'], ['WRONG_TIMEPOINT_TYPE', 'semantic'], ['WRONG_TIME_VALUE', 'semantic'], ['WRONG_TIMEZONE', 'semantic'], ['FALSE_PRECISION', 'semantic'], ['RELATIVE_TIME_ERROR', 'semantic'],
  ['MISSING_EVENT', 'semantic'], ['WRONG_EVENT', 'semantic'], ['MISSING_EVIDENCE', 'semantic'], ['WRONG_EVIDENCE', 'semantic'], ['EVIDENCE_NOT_SUPPORTED', 'semantic'],
  ['MISSING_AMBIGUITY', 'semantic'], ['FALSE_AMBIGUITY', 'semantic'], ['INVALID_REFERENCE', 'schema'], ['INVALID_SCHEMA', 'schema'],
  ['PROMPT_INJECTION_FAILURE', 'safety'], ['TRANSPORT_FAILURE', 'transport'], ['TIMEOUT', 'transport'], ['UPSTREAM_502', 'transport'], ['UPSTREAM_503', 'transport'],
  ['REPAIR_FAILURE', 'repair'], ['SEVERE_ERROR', 'safety'],
].map(([tag, family]) => ({ tag: tag as RecognitionErrorTag, family: family as 'semantic' | 'schema' | 'transport' | 'safety' | 'repair' }))
