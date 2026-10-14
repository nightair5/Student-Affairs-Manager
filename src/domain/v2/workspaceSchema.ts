import type { WorkspaceV8 } from './types'
import { validateWorkspaceV8 } from './validators/workspaceValidator'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const REQUIRED_ARRAYS = [
  'sources', 'sourceVersions', 'recognitionRuns', 'extractionDrafts', 'projects', 'milestones',
  'workPackages', 'tasks', 'materials', 'timePoints', 'events', 'evidenceRefs', 'changeProposals',
  'historyRecords', 'reminderRecords', 'migrationMetadata',
] as const

export function parseWorkspaceV8(value: unknown): WorkspaceV8 {
  if (!isRecord(value) || value.schemaVersion !== 8) throw new Error('WORKSPACE_V8_SCHEMA_REQUIRED')
  if (!isRecord(value.workspace) || !isRecord(value.settings) || !isRecord(value.preferences)) {
    throw new Error('WORKSPACE_V8_ROOT_INVALID')
  }
  if (REQUIRED_ARRAYS.some((key) => !Array.isArray(value[key]))) throw new Error('WORKSPACE_V8_ARRAY_REQUIRED')
  const workspace = value as unknown as WorkspaceV8
  const validation = validateWorkspaceV8(workspace)
  if (!validation.valid) {
    const first = validation.issues[0]
    throw new Error(`WORKSPACE_V8_INVALID:${first.code}:${first.path}`)
  }
  return workspace
}
