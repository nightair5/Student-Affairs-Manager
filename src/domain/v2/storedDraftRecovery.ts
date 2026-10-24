import { repairLegacyDraftDiagnostics } from './legacyDraftDiagnostics'
import { validateWorkspaceV8 } from './validators/workspaceValidator'
import type { JsonValue, WorkspaceV8 } from './types'

export const STORED_DRAFT_RECOVERY_VERSION = 'stored-draft-recovery-1'
export const HISTORICAL_DRAFT_RECOVERY_VERSION = 'stored-draft-history-recovery-1'
export interface StoredDraftRecoveryOptions {
  /** Explicit recovery action only; ordinary loading never isolates committed results. */
  isolateHistoricalResults?: boolean
}
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** A stored suggestion is not a canonical task. Recover only draft-result faults;
 * all other facts/references must still pass the unchanged whole-workspace validator.
 * The repository must persist and verify a full original backup before applying. */
export function prepareStoredDraftRecovery(value: unknown, backupId: string, at: string, options: StoredDraftRecoveryOptions = {}): WorkspaceV8 | null {
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
    const historical = !canIsolate && options.isolateHistoricalResults === true
      && ['processing', 'needs_review', 'failed', 'partially_confirmed', 'confirmed', 'rejected', 'archived'].includes(String(draft.status))
    if (!repair && !canIsolate && !historical) return null
    // Do not overwrite an earlier recovery audit. A repeated load must be a no-op.
    if (record(draft.legacyData) && draft.legacyData.storedDraftRecovery) return null
    const issues = validation.issues.filter(issue => issue.path.startsWith(`extractionDrafts[${index}].result`))
      .map(issue => ({ code: issue.code, path: issue.path }))
    const audit = { version: historical ? HISTORICAL_DRAFT_RECOVERY_VERSION : STORED_DRAFT_RECOVERY_VERSION, backupId, at,
      mode: repair ? 'diagnostics_compatible' : historical ? 'isolated_historical_result' : 'isolated_unconfirmed_result',
      originalResult: draft.result as JsonValue, issues }
    draft.legacyData = { ...(draft.legacyData ?? {}), storedDraftRecovery: audit,
      ...(repair ? { diagnosticCompatibility: { version: 'legacy-draft-diagnostics-1', paths: repair.paths, blocksConfirmation: repair.blocksConfirmation } } : {}) }
    draft.result = repair?.result ?? null
    draft.needsReview = true
    // A historical answer is not the saved task. Never reset its accepted/rejected
    // IDs, commit receipts or lifecycle, or make it available for confirmation again.
    if (!repair && !historical) draft.status = 'failed'
  }
  // Broken canonical data, owners or references are never repaired or discarded.
  return validateWorkspaceV8(candidate).valid ? candidate as unknown as WorkspaceV8 : null
}
