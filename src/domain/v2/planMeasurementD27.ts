import type { WorkspaceRecordStore } from './repository'
import type { PlanOptions, PlanReceipt } from './personalPlanD27'
export const PLAN_MEASUREMENT = 'personal-plan-measurement-d27-1'
export interface PlanTrace {
  id: string; at: number; kind: 'begin' | 'read' | 'edit' | 'idle' | 'hidden' | 'wait' | 'failure' | 'restore' | 'commit' | 'readback' | 'end'
  field?: string; editId?: string; commitId?: string; reason?: string; semanticChanges?: number
}
export function summarizePlanTrace(rows: PlanTrace[]) {
  const totals = { readingMs: 0, activeEditingMs: 0, idleMs: 0, hiddenMs: 0, waitingMs: 0 }
  let mode: keyof typeof totals = 'readingMs', prior: number | null = null, missing = false
  for (const r of rows) {
    // A refresh/crash has no observed closing boundary. Do not call its gap reading time.
    if (prior !== null && r.kind !== 'restore') totals[mode] += Math.max(0, r.at - prior)
    prior = r.at
    if (r.kind === 'restore') missing = true
    if (r.kind === 'edit') mode = 'activeEditingMs'
    else if (r.kind === 'hidden') mode = 'hiddenMs'
    else if (r.kind === 'idle') mode = 'idleMs'
    else if (r.kind === 'wait') mode = 'waitingMs'
    else if (['read', 'failure', 'readback', 'commit'].includes(r.kind)) mode = 'readingMs'
  }
  const commits = [...new Map(rows.filter(r => r.kind === 'commit').map(r => [r.commitId!, r])).values()]
  const verified = commits.length > 0 && commits.every(c => rows.some(r => r.kind === 'readback' && r.commitId === c.commitId))
  const closed = rows.at(-1)?.kind === 'end'
  const countMissing = commits.length === 0 || commits.some(r => r.semanticChanges === undefined)
  return { version: PLAN_MEASUREMENT, role: 'ENGINEERING_REPLAY_OR_UNADJUDICATED_LOCAL_USE', denominator: rows.some(r => r.kind === 'begin') ? 1 : 0, commitCount: commits.length, independentReadbackCount: new Set(rows.filter(r => r.kind === 'readback').map(r => r.commitId)).size, semanticPlanChanges: countMissing ? null : commits.reduce((n, r) => n + r.semanticChanges!, 0), planChangeCountStatus: countMissing ? 'MISSING' : 'OBSERVED', attemptedEditIds: [...new Set(rows.map(r => r.editId).filter(Boolean))], completed: verified && closed && !missing, timingStatus: !closed || missing || !verified ? 'MISSING' : 'OBSERVED', missingReasons: [!closed ? 'INTERVAL_NOT_CLOSED' : '', missing ? 'REFRESH_OR_CRASH_GAP' : '', !verified ? 'COMMIT_OR_READBACK_MISSING' : '', countMissing ? 'PLAN_EDIT_COUNT_MISSING' : ''].filter(Boolean), wallMs: closed && !missing && verified && rows.length ? rows.at(-1)!.at - rows[0].at : null, ...totals, firstSuggestionAccuracy: 'NOT_MEASURED_BY_PLAN_TRACE', humanFourMetrics: 'NOT_OBSERVABLE' }
}
/** Separate plan trace/checkpoint. Neither is a Task or a substitute for canonical readback. */
export function createPlanMeasurement(store: WorkspaceRecordStore, now = Date.now) {
  let queue = Promise.resolve()
  let beginning: Promise<void> | null = null
  const traceKey = PLAN_MEASUREMENT, checkpointKey = PLAN_MEASUREMENT + ':checkpoint'
  const append = (kind: PlanTrace['kind'], extra: Partial<PlanTrace> = {}) => {
    const row: PlanTrace = { id: crypto.randomUUID(), at: now(), kind, ...extra }
    const work = queue.then(() => store.transaction(traceKey, raw => [...(Array.isArray(raw) ? raw : []), row]))
    queue = work.then(() => undefined, () => undefined)
    return work.then(() => undefined)
  }
  const events = async () => { await queue; return await store.read(traceKey) as PlanTrace[] | undefined ?? [] }
  return { append, events,
    begin: () => {
      beginning ??= (async () => { const rows = await events(); await append(rows.length && rows.at(-1)?.kind !== 'end' ? 'restore' : 'begin'); await append('read') })()
      return beginning
    },
    close: async () => { await append('end'); beginning = null },
    checkpoint: async (options: PlanOptions, baseline: string, editIds: Record<string, string>, initialOptions: PlanOptions = options) => {
      const work = queue.then(() => store.write(checkpointKey, { version: PLAN_MEASUREMENT, options, baseline, editIds, initialOptions }))
      queue = work.then(() => undefined, () => undefined); await work
    },
    restore: async () => { await queue; const raw = await store.read(checkpointKey); return raw as { version: string; options: PlanOptions; baseline: string; editIds: Record<string, string>; initialOptions?: PlanOptions } | undefined },
    commit: async (receipt: PlanReceipt, semanticChanges: number | undefined) => { const rows = await events(); if (!rows.some(r => r.kind === 'commit' && r.commitId === receipt.commitId)) await append('commit', { commitId: receipt.commitId, semanticChanges }) },
    report: async () => {
      const rows = await events(), trials: PlanTrace[][] = []
      for (const r of rows) { if (r.kind === 'begin' || !trials.length) trials.push([]); trials.at(-1)!.push(r) }
      const reports = trials.map(summarizePlanTrace), observed = reports.filter(r => r.timingStatus === 'OBSERVED').map(r => r.wallMs!).sort((a, b) => a - b)
      const middle = Math.floor(observed.length / 2)
      return { version: PLAN_MEASUREMENT, role: 'ENGINEERING_REPLAY_OR_UNADJUDICATED_LOCAL_USE', denominator: reports.length, completed: reports.filter(r => r.completed).length, incomplete: reports.filter(r => !r.completed).length, wallMedianMs: observed.length ? observed.length % 2 ? observed[middle] : (observed[middle - 1] + observed[middle]) / 2 : null, reports, trace: rows, humanFourMetrics: 'NOT_OBSERVABLE' }
    },
  }
}
