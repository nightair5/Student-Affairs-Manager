import type { WorkspaceV8 } from '../types'
import { validateDependencies } from './dependencyValidator'
import { validateEntities } from './entityValidator'
import { validateHierarchy } from './hierarchyValidator'
import { result, type ValidationResult } from './issues'
import { validateReferences } from './referenceValidator'
import { validateTimes } from './timeValidator'
import { validateWorkspaceShape } from './shapeValidator'
import { validatePersonalPlanMetadata } from '../personalPlanD27'

export function validateWorkspaceV8(value: unknown): ValidationResult {
  const shapeIssues = validateWorkspaceShape(value)
  if (shapeIssues.length) return result(shapeIssues)
  const workspace = value as WorkspaceV8
  try { validatePersonalPlanMetadata(workspace) } catch {
    return result([{ code: 'INVALID_TYPE', path: 'timePoints/preferences.personalPlanD27', message: '版本化个人计划或回执无效，保留原数据，拒绝载入。' }])
  }
  return result([
    ...validateEntities(workspace),
    ...validateReferences(workspace),
    ...validateHierarchy(workspace),
    ...validateDependencies(workspace),
    ...validateTimes(workspace),
  ])
}
