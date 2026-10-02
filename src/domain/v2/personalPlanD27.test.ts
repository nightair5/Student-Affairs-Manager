import { describe, expect, it } from 'vitest'
import { emptyWorkspace, artificialResponse, notices } from '../../experiments/mainline01/fixtures'
import { MemoryWorkspaceRecordStore, CanonicalWorkspaceRepository } from './repository'
import { CapturePersistenceService } from './capture'
import { applyDomainCommitPlan } from './domainCommit'
import { buildSourceReviewPlan } from './sourceReviewD26'
import { workspaceV8ToLegacyView } from './legacyView'
import { importWorkspaceV8, exportWorkspaceV8 } from './serialization'
import { acknowledgePersonalPlan, applyPersonalPlan as applyPlan, buildPersonalPlan, defaultPlanOptions, pendingPersonalPlan, PLAN_RECEIPT, planBaseline, storedPersonalPlans, undoPersonalPlan, verifyPersonalPlan, type PlanOptions, type PlanProposal } from './personalPlanD27'
import { createPlanMeasurement, summarizePlanTrace } from './planMeasurementD27'
const NOW = '2026-09-05T00:00:00.000Z'
const applyPersonalPlan = (repository: CanonicalWorkspaceRepository, proposal: PlanProposal) => applyPlan(repository, proposal, () => new Date(NOW))
async function fixture(kind: 'multi' | 'no-date' = 'multi') {
  const store = new MemoryWorkspaceRecordStore(), repository = new CanonicalWorkspaceRepository(store)
  await repository.initialize(emptyWorkspace())
  const capture = new CapturePersistenceService(repository)
  const input = { operationId: crypto.randomUUID(), sourceType: 'text' as const, title: '匿名来源', rawText: notices[kind], provider: 'manual' as const, modelName: 'anonymous', promptVersion: 'test', pipelineVersion: 'engineering' }
  const handle = await capture.beginCapture(input)
  await capture.recognize(handle, async () => artificialResponse(kind, handle.sourceId))
  let w = (await repository.load())!
  const view = workspaceV8ToLegacyView(w).drafts[0]
  const plan = buildSourceReviewPlan(w, view, undefined, NOW)
  w = await repository.transaction(current => applyDomainCommitPlan(current, plan))
  return { store, repository, w, handle, opts: { ...defaultPlanOptions(new Date(NOW)), startTime: '09:00', endTime: '12:00', days: 2 } as PlanOptions }
}
describe('D27 canonical bounded shared plan', () => {
  it('rejects an expired preview before writing; current source version drift also rejects, even with identical task values', async () => {
    const x = await fixture(); const proposal = buildPersonalPlan(x.w, x.opts)
    await expect(applyPlan(x.repository, proposal, () => new Date('2026-09-05T10:00:00+08:00'))).rejects.toThrow('PERSONAL_PLAN_ELAPSED_SLOT')
    expect(storedPersonalPlans((await x.repository.load())!)).toHaveLength(0)
    await new CapturePersistenceService(x.repository).beginRevision(x.handle.sourceId, { operationId: crypto.randomUUID(), rawText: '匿名修订：改为下载新的登记表。', provider: 'manual', modelName: null, promptVersion: null, pipelineVersion: 'd27-test' })
    await expect(applyPersonalPlan(x.repository, proposal)).rejects.toThrow('PERSONAL_PLAN_INPUTS_CHANGED')
  })
  it('allocates shared capacity to two tasks, preserves facts, records transparent estimate; schema/export roundtrip', async () => {
    const x = await fixture(); const original = structuredClone(x.w)
    const p = buildPersonalPlan(x.w, x.opts)
    expect(p.segments).toHaveLength(2)
    expect(p.segments[0].durationOrigin).toBe('product_estimate')
    expect(Date.parse(p.segments[1].start)).toBeGreaterThanOrEqual(Date.parse(p.segments[0].end))
    const receipt = await applyPersonalPlan(x.repository, p)
    const read = await verifyPersonalPlan(new CanonicalWorkspaceRepository(x.store), receipt)
    expect(read.tasks).toEqual(original.tasks)
    expect(read.materials).toEqual(original.materials)
    expect(read.timePoints.filter(p => p.type !== 'planned_start')).toEqual(original.timePoints)
    expect(importWorkspaceV8(exportWorkspaceV8(read))).toEqual(read)
    expect(storedPersonalPlans(read).map(s => s.minutes)).toEqual([30, 30])
    await acknowledgePersonalPlan(x.repository, receipt)
    expect(pendingPersonalPlan((await x.repository.load())!)).toBeNull()
  })
  it('avoids exact fixed events and weekday courses, respects dependency order and snooze', async () => {
    const x = await fixture(); const a = x.w.tasks[0], b = x.w.tasks[1]
    b.dependencyIds = [a.id]; a.snoozedUntil = '2026-09-05T10:00:00+08:00'
    x.w.preferences.legacyData = { courseBlocks: [{ id: 'course', weekday: 6, startTime: '10:00', endTime: '10:30', title: '匿名课', createdAt: NOW }] }
    x.w.events.push({ id: 'e', projectId: null, title: '活动', description: null, startTimePointId: 'es', endTimePointId: 'ee', location: null, createdAt: NOW, updatedAt: NOW })
    const base = x.w.timePoints[0]
    x.w.timePoints.push(...['es', 'ee'].map((id, i) => ({ ...base, id, taskId: null, relatedTaskIds: [], relatedMaterialIds: [], materialId: null, eventId: 'e', type: i ? 'event_end' as const : 'event_start' as const, normalizedValue: i ? '2026-09-05T11:00' : '2026-09-05T10:30' })))
    const p = buildPersonalPlan(x.w, x.opts)
    expect(p.segments[0].start).toBe('2026-09-05T03:00:00.000Z')
    expect(p.segments[1].start).toBe(p.segments[0].end)
    expect(p.segments[1].conditionalOn).toEqual([a.id])
    expect(b.status).toBe('todo')
  })
  it('no deadline stays no deadline; unknown durations may be left unallocated, not compatibility 60 minutes', async () => {
    const x = await fixture('no-date')
    const unknown = buildPersonalPlan(x.w, { ...x.opts, estimateMinutes: null })
    expect(unknown.unscheduled[0].code).toBe('DURATION_UNKNOWN')
    const estimated = buildPersonalPlan(x.w, x.opts)
    expect(estimated.segments[0]).toMatchObject({ originalDeadline: null, minutes: 30, durationOrigin: 'product_estimate' })
    await applyPersonalPlan(x.repository, estimated)
    expect((await x.repository.load())!.timePoints.every(p => p.type === 'planned_start')).toBe(true)
  })
  it('capacity, overdue, cycles and missing prerequisites are explicit without fabricating completed state', async () => {
    const x = await fixture(); x.w.tasks.forEach(t => { t.estimatedMinutes = 120 })
    expect(buildPersonalPlan(x.w, { ...x.opts, days: 1, endTime: '10:00' }).unscheduled.every(t => t.code === 'CAPACITY')).toBe(true)
    expect(buildPersonalPlan(x.w, { ...x.opts, now: '2026-10-01T00:00:00Z', startDate: '2026-10-01' }).unscheduled.every(t => t.code === 'OVERDUE')).toBe(true)
    x.w.tasks[0].dependencyIds = [x.w.tasks[1].id]; x.w.tasks[1].dependencyIds = [x.w.tasks[0].id]
    expect(buildPersonalPlan(x.w, x.opts).unscheduled.every(t => t.code === 'DEPENDENCY_CYCLE')).toBe(true)
    x.w.tasks[0].dependencyIds = ['missing']; x.w.tasks[1].dependencyIds = []
    expect(buildPersonalPlan(x.w, x.opts).unscheduled.find(t => t.taskId === x.w.tasks[0].id)?.code).toBe('DEPENDENCY_MISSING')
  })
  it('vague event is not a fabricated busy interval; date-only deadline is a day boundary in declared timezone', async () => {
    const x = await fixture(); const point = x.w.timePoints[0]
    point.precision = 'date_only'; point.normalizedValue = '2026-09-05'; point.isAllDay = true
    x.w.events.push({ id: 'vague-event', title: '周三晚停机', projectId: null, startTimePointId: null, endTimePointId: null, location: null, description: null, createdAt: NOW, updatedAt: NOW })
    const p = buildPersonalPlan(x.w, x.opts)
    expect(p.segments.find(s => s.taskId === x.w.tasks[0].id)!.end < '2026-09-05T16:00:00Z').toBe(true)
    expect(p.warnings.some(v => v.includes('不能保证避开'))).toBe(true)
  })
  it('keeps locks, detects manual overlap/wrong deadline, allows later removal and safe undo without changing source facts', async () => {
    const x = await fixture()
    const p = buildPersonalPlan(x.w, { ...x.opts, overrides: { [x.w.tasks[0].id]: { locked: true } } })
    const r = await applyPersonalPlan(x.repository, p); await acknowledgePersonalPlan(x.repository, r)
    let w = (await x.repository.load())!
    const locked = storedPersonalPlans(w)[0]
    const next = buildPersonalPlan(w, { ...x.opts, startTime: '10:00' })
    expect(next.segments[0].start).toBe(locked.start)
    expect(next.segments[0].retained).toBe(true)
    const manual = buildPersonalPlan(w, { ...x.opts, overrides: { [x.w.tasks[1].id]: { start: '2026-09-05T09:00' } } })
    expect(manual.unscheduled.some(t => t.code === 'INVALID_MANUAL_SLOT')).toBe(true)
    const later = buildPersonalPlan(w, { ...x.opts, overrides: { [x.w.tasks[1].id]: { later: true } } })
    const rr = await applyPersonalPlan(x.repository, later); await acknowledgePersonalPlan(x.repository, rr)
    expect(storedPersonalPlans((await x.repository.load())!)).toHaveLength(1)
    const undo = await undoPersonalPlan(x.repository, rr.commitId); w = await verifyPersonalPlan(x.repository, undo); await acknowledgePersonalPlan(x.repository, undo)
    expect(storedPersonalPlans(w)).toHaveLength(2)
    expect(w.tasks).toEqual(x.w.tasks)
  })
  it('compares real current read set: unrelated description can coexist, source/event/dependency changes reject', async () => {
    const x = await fixture(); const p = buildPersonalPlan(x.w, x.opts)
    await x.repository.transaction(w => ({ ...w, tasks: w.tasks.map((t, i) => i ? t : { ...t, description: '个人备注更新' }) }))
    const r = await applyPersonalPlan(x.repository, p); expect(r.commitId).toBe(p.id)
    await acknowledgePersonalPlan(x.repository, r)
    const w = (await x.repository.load())!, stale = buildPersonalPlan(w, x.opts)
    await x.repository.transaction(w => ({ ...w, tasks: w.tasks.map((t, i) => i ? t : { ...t, snoozedUntil: '2026-09-06T09:00:00+08:00' }) }))
    await expect(applyPersonalPlan(x.repository, stale)).rejects.toThrow('PERSONAL_PLAN_INPUTS_CHANGED')
    expect((await x.repository.load())!.tasks[0].snoozedUntil).not.toBeNull()
  })
  it('atomic failure leaves zero plans; known committed/read failure resumes read only, same request idempotent, altered request rejected', async () => {
    const x = await fixture(); let fail = true
    const failing = new CanonicalWorkspaceRepository({ ...x.store, read: key => x.store.read(key), write: (k, v) => x.store.write(k, v), remove: k => x.store.remove(k), transactionMany: (k, f) => x.store.transactionMany(k, f), transaction: (key, f) => x.store.transaction(key, raw => { const next = f(raw); if (fail) { fail = false; throw Error('INJECTED') } return next }) })
    const p = buildPersonalPlan(x.w, x.opts)
    await expect(applyPersonalPlan(failing, p)).rejects.toThrow('INJECTED')
    expect(storedPersonalPlans((await x.repository.load())!)).toHaveLength(0)
    const r = await applyPersonalPlan(failing, p)
    await expect(verifyPersonalPlan({ load: async () => { throw Error('READ_FAILED') } }, r)).rejects.toThrow('READ_FAILED')
    expect(pendingPersonalPlan((await x.repository.load())!)?.commitId).toBe(p.id)
    expect(await applyPersonalPlan(failing, p)).toEqual(r)
    await expect(applyPersonalPlan(failing, { ...p, segments: [] })).rejects.toThrow('IDEMPOTENCY_CONFLICT')
    await verifyPersonalPlan(x.repository, r); await acknowledgePersonalPlan(x.repository, r)
    expect((await x.repository.load())!.historyRecords.filter(h => h.action === 'personal_plan')).toHaveLength(1)
  })
  it('tampering with proposal or metadata cannot bypass validation or silently restore a source deadline', async () => {
    const x = await fixture(); const p = buildPersonalPlan(x.w, x.opts)
    p.segments[0].start = '2026-09-05T23:00:00Z'
    await expect(applyPersonalPlan(x.repository, p)).rejects.toThrow('PROPOSAL_INVALID')
    const ok = await applyPersonalPlan(x.repository, buildPersonalPlan(x.w, x.opts))
    const raw = (await x.repository.load())!; const planned = raw.timePoints.find(p => p.type === 'planned_start')!
    planned.legacyData!.personalPlanD27 = { version: 'wrong-version' }
    expect(() => importWorkspaceV8(exportWorkspaceV8(raw))).toThrow('INVALID')
    const current = (await x.repository.load())!
    const data = current.preferences.legacyData![PLAN_RECEIPT] as { [key: string]: unknown }
    data.previousPoints = [x.w.timePoints[0]]
    expect(() => exportWorkspaceV8(current)).toThrow('INVALID')
    expect(JSON.parse(ok.payload).baseline).toBe(planBaseline(x.w))
  })
  it('plan timing separates reading, failed cost and waiting; open/refresh intervals are missing; read-only ten seconds has zero edits', async () => {
    const pure = summarizePlanTrace([{ id: 'a', at: 0, kind: 'begin' }, { id: 'b', at: 10_000, kind: 'end' }])
    expect(pure.readingMs).toBe(10_000); expect(pure.activeEditingMs).toBe(0)
    const trace = summarizePlanTrace([{ id: 'a', at: 0, kind: 'begin' }, { id: 'b', at: 1000, kind: 'edit', editId: 'e1' }, { id: 'c', at: 4000, kind: 'wait' }, { id: 'd', at: 5000, kind: 'failure' }, { id: 'e', at: 7000, kind: 'wait' }, { id: 'f', at: 8000, kind: 'commit', commitId: 'c', semanticChanges: 1 }, { id: 'g', at: 8001, kind: 'readback', commitId: 'c' }, { id: 'h', at: 8002, kind: 'end' }])
    expect(trace.activeEditingMs).toBe(3000); expect(trace.waitingMs).toBe(2000); expect(trace.semanticPlanChanges).toBe(1); expect(trace.completed).toBe(true)
    const store = new MemoryWorkspaceRecordStore(); let now = 0; const m = createPlanMeasurement(store, () => now)
    await m.begin(); now = 10_000; await m.append('restore'); expect((await m.report()).reports[0].timingStatus).toBe('MISSING')
  })
  it('recovered commits without edit evidence remain unknown; refresh gaps do not become reading time and edit baseline survives checkpoint retry', async () => {
    const trace = summarizePlanTrace([{ id: 'a', at: 0, kind: 'begin' }, { id: 'b', at: 1000, kind: 'edit', editId: 'e' }, { id: 'c', at: 100_000, kind: 'restore' }, { id: 'd', at: 100_100, kind: 'commit', commitId: 'c' }, { id: 'f', at: 100_110, kind: 'readback', commitId: 'c' }, { id: 'g', at: 100_120, kind: 'end' }])
    expect(trace.semanticPlanChanges).toBeNull(); expect(trace.planChangeCountStatus).toBe('MISSING')
    expect(trace.wallMs).toBeNull(); expect(trace.readingMs).toBe(1020); expect(trace.activeEditingMs).toBe(100)
    const x = await fixture(); const m = createPlanMeasurement(x.store, () => 0), changed = { ...x.opts, estimateMinutes: 35 }
    await m.checkpoint(changed, planBaseline(x.w), { estimate: 'e' }, x.opts)
    const restored = await m.restore(); expect(restored!.initialOptions!.estimateMinutes).toBe(30); expect(restored!.options.estimateMinutes).toBe(35)
  })
})
