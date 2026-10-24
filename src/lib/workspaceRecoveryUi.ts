import type { WorkspaceData } from '../types'

const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_]*(?::[A-Z0-9_.:[\]-]+)?$/u

const INTERNAL_DETAIL = /(?:\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b|extractionDrafts\[|\.result\.|(?:Type|Syntax|Reference)Error|\bat\s+\S+\.(?:tsx?|m?js):)/u

/** Never turn schema paths, storage dumps, or provider diagnostics into UI copy. */
export function safeIntakeError(error: unknown, fallback = '整理暂时没有完成，输入仍在这里。请稍后重试。'): string {
  const message = error instanceof Error ? error.message.trim() : ''
  return message && message.length <= 220 && /[\u4e00-\u9fff]/u.test(message) && !INTERNAL_DETAIL.test(message)
    ? message : fallback
}

export function workspaceLoadFailureText(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  return INTERNAL_DETAIL.test(message)
    ? '历史数据暂未能打开，原记录没有被覆盖。请先下载备份，再重试加载；不要清空浏览器数据。'
    : '暂时无法打开本机存储。请保留当前输入，检查浏览器的存储权限后重试；不要清空浏览器数据。'
}

export type WorkspaceRecoveryAction = 'blocked' | 'arm' | 'recover'

/** Allowlisted diagnostics only: never serialize an Error or copy arbitrary text. */
export function workspaceLoadDiagnostic(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const known = ['INVALID_TYPE', 'INVALID_ENUM', 'MISSING_REFERENCE', 'WORKSPACE_V8_INVALID',
    'WORKSPACE_V7_INVALID', 'WORKSPACE_V7_NESTED_INVALID', 'WORKSPACE_CHANGED_DURING_RECOVERY',
    'DRAFT_RECOVERY_BACKUP_INVALID', 'MIGRATION_BACKUP_INVALID', 'MIGRATION_BACKUP_CONFLICT',
    'PRODUCT_UPGRADE_BACKUP_INVALID', 'WORKSPACE_RECOVERY_EMPTY']
  const codes = known.filter(code => new RegExp(`(?:^|[^A-Z_])${code}(?:$|[^A-Z_])`, 'u').test(message))
  if (error instanceof Error && ['QuotaExceededError', 'SecurityError', 'InvalidStateError', 'VersionError'].includes(error.name)) codes.push(error.name)
  const sections = ['extractionDrafts', 'tasks', 'materials', 'events', 'timePoints', 'sourceVersions', 'sources', 'recognitionRuns', 'historyRecords']
    .filter(section => new RegExp(`(?:^|[.:,])${section}\\[\\d+\\]`, 'u').test(message))
  return { version: 'workspace-load-diagnostic-1', createdAt: new Date().toISOString(),
    codes: codes.length ? codes : ['WORKSPACE_OPEN_FAILED'], sections, containsUserContent: false }
}

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
