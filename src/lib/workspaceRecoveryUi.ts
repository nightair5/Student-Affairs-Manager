import type { WorkspaceData } from '../types'

const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_]*(?::[A-Z0-9_.:[\]-]+)?$/u

export type WorkspaceRecoveryAction = 'blocked' | 'arm' | 'recover'

/**
 * `savedAt` is persistence metadata rather than an editable workspace fact.
 * Ignoring it lets hydration distinguish an unchanged compatibility view from
 * a real user edit, including under React StrictMode's repeated effects.
 */
export function workspacePersistenceRevision(workspace: WorkspaceData): string {
  const content: Partial<WorkspaceData> = { ...workspace }
  delete content.savedAt
  return JSON.stringify(content)
}

export function safeWorkspaceRecoveryErrors(
  errors: readonly string[],
  fallback = 'WORKSPACE_RECOVERY_REQUIRED',
): string[] {
  const safe = [...new Set(errors.filter((value) => SAFE_ERROR_CODE.test(value)).slice(0, 5))]
  return safe.length ? safe : [fallback]
}

export function nextWorkspaceRecoveryAction(
  backupExported: boolean,
  confirmationArmed: boolean,
): WorkspaceRecoveryAction {
  if (!backupExported) return 'blocked'
  return confirmationArmed ? 'recover' : 'arm'
}
