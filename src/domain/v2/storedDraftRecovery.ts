import { repairLegacyDraftDiagnostics } from './legacyDraftDiagnostics'
import { validateWorkspaceV8 } from './validators/workspaceValidator'
import type { JsonValue, WorkspaceV8 } from './types'

export const STORED_DRAFT_RECOVERY_VERSION = 'stored-draft-recovery-1'
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** A stored suggestion is not a canonical task. Recover only draft-result faults;
 * all other facts/references must still pass the unchanged whole-workspace validator.
 * The repository must persist and verify a full original backup before applying. */
export function prepareStoredDraftRecovery(value: unknown, backupId: string, at: string): WorkspaceV8 | null {
  if (!record(value) || value.schemaVersion !== 8 || !Array.isArray(value.extractionDrafts)) return null
  const validation = validateWorkspaceV8(value)
  if (validation.valid || !validation.issues.length) return null
  const indices = new Set<number>()
  for (const issue of validation.issues) {
    const match = /^extractionDrafts\[(\d+)\]\.result(?:\.|\[|$)/u.exec(issue.path)
    if (!match) return null
    indices.add(Number(match[1]))
  }
  const candidate = structuredClone(value)
  const drafts = candidate.extractionDrafts as Record<string, unknown>[]
  for (const index of indices) {
    const draft = drafts[index]
    if (!record(draft) || !Array.isArray(draft.acceptedEntityTempIds) || !Array.isArray(draft.commitOperationIds)
      || (draft.legacyData !== undefined && !record(draft.legacyData))) return null
    const repair = repairLegacyDraftDiagnostics(draft.result)
    const canIsolate = ['processing', 'needs_review', 'failed'].includes(String(draft.status))
      && draft.acceptedEntityTempIds.length === 0 && draft.commitOperationIds.length === 0
    if (!repair && !canIsolate) return null
    // Do not overwrite an earlier recovery audit. A repeated load must be a no-op.
    if (record(draft.legacyData) && draft.legacyData.storedDraftRecovery) return null
    const issues = validation.issues.filter(issue => issue.path.startsWith(`extractionDrafts[${index}].result`))
      .map(issue => ({ code: issue.code, path: issue.path }))
    const audit = { version: STORED_DRAFT_RECOVERY_VERSION, backupId, at,
      mode: repair ? 'diagnostics_compatible' : 'isolated_unconfirmed_result',
      originalResult: draft.result as JsonValue, issues }
    draft.legacyData = { ...(draft.legacyData ?? {}), storedDraftRecovery: audit,
      ...(repair ? { diagnosticCompatibility: { version: 'legacy-draft-diagnostics-1', paths: repair.paths, blocksConfirmation: repair.blocksConfirmation } } : {}) }
    draft.result = repair?.result ?? null
    draft.needsReview = true
    if (!repair) draft.status = 'failed'
  }
  // Broken canonical data, owners or references are never repaired or discarded.
  return validateWorkspaceV8(candidate).valid ? candidate as unknown as WorkspaceV8 : null
}
