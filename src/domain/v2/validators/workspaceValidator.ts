import type { WorkspaceV8 } from '../types'
import { validateDependencies } from './dependencyValidator'
import { validateEntities } from './entityValidator'
import { validateHierarchy } from './hierarchyValidator'
import { result, type ValidationResult } from './issues'
import { validateReferences } from './referenceValidator'
import { validateTimes } from './timeValidator'

export function validateWorkspaceV8(workspace: WorkspaceV8): ValidationResult {
  if (workspace.schemaVersion !== 8) {
    return result([{ code: 'INVALID_SCHEMA', path: 'schemaVersion', message: 'Workspace v8 的 schemaVersion 必须为 8' }])
  }
  return result([
    ...validateEntities(workspace),
    ...validateReferences(workspace),
    ...validateHierarchy(workspace),
    ...validateDependencies(workspace),
    ...validateTimes(workspace),
  ])
}
