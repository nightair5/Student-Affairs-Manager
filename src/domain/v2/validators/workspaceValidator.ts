import type { WorkspaceV8 } from '../types'
import { validateDependencies } from './dependencyValidator'
import { validateEntities } from './entityValidator'
import { validateHierarchy } from './hierarchyValidator'
import { result, type ValidationResult } from './issues'
import { validateReferences } from './referenceValidator'
import { validateTimes } from './timeValidator'
import { validateWorkspaceShape } from './shapeValidator'

export function validateWorkspaceV8(value: unknown): ValidationResult {
  const shapeIssues = validateWorkspaceShape(value)
  if (shapeIssues.length) return result(shapeIssues)
  const workspace = value as WorkspaceV8
  return result([
    ...validateEntities(workspace),
    ...validateReferences(workspace),
    ...validateHierarchy(workspace),
    ...validateDependencies(workspace),
    ...validateTimes(workspace),
  ])
}
