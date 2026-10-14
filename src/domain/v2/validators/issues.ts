export type ValidationIssueCode =
  | 'INVALID_SCHEMA'
  | 'INVALID_TYPE'
  | 'INVALID_ENUM'
  | 'REQUIRED_FIELD'
  | 'DUPLICATE_ID'
  | 'MISSING_REFERENCE'
  | 'CROSS_PROJECT_REFERENCE'
  | 'SUBTASK_DEPTH'
  | 'DEPENDENCY_CYCLE'
  | 'INVALID_TIME'
  | 'SENTINEL_DATE'

export interface ValidationIssue {
  code: ValidationIssueCode
  path: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

export function result(issues: ValidationIssue[]): ValidationResult {
  return { valid: issues.length === 0, issues }
}
