import type { D13Trace } from './measurement'
import type { ReviewSession } from './d20ReviewSession'

/** Evidence report only. Checkpoints are not canonical corrections or human observations. */
export function summarizeD20Engineering(session: ReviewSession | undefined, trace: readonly D13Trace[]) {
  const readbacks = new Set(trace.filter(row => row.kind === 'readback' && row.commitId).map(row => row.commitId!))
  const commits = trace.filter(row => row.kind === 'commit' && row.commitId)
  return {
    version: 'd20-review-session-measurement-1', role: 'ENGINEERING_REPLAY',
    checkpointStageCount: session?.history.filter(row => row.kind === 'stage').length ?? 0,
    unconfirmedFieldKeys: Object.keys(session?.fields ?? {}).sort(),
    conflictFieldKeys: Object.entries(session?.fields ?? {}).filter(([, field]) => field.conflict).map(([key]) => key),
    pageEditIds: trace.filter(row => row.kind === 'edit' && row.editId).map(row => row.editId!),
    verifiedCommitIds: commits.filter(row => readbacks.has(row.commitId!)).map(row => row.commitId!),
    unverifiedCommitIds: commits.filter(row => !readbacks.has(row.commitId!)).map(row => row.commitId!),
    checkpointToEditId: 'NOT_DIRECTLY_LINKED', humanMetrics: 'NOT_OBSERVABLE',
  } as const
}
