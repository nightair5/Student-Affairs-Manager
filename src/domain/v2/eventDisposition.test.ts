import { describe, it, expect } from 'vitest'
import { createAuthorityFixture } from '../../experiments/candidate19Recorded/singleAuthorityFixtures'
import { decodeSingleAuthorityRecording } from '../../recognition/sourceContractV5'
import { emptyWorkspace } from '../../experiments/mainline01/fixtures'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from './repository'
import { CapturePersistenceService } from './capture'
import { IndexedDbWorkspaceRepository } from '../../lib/repository'
import { eventDisposition, eventDispositionField, type EventDisposition } from './eventDisposition'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback, acknowledgeSourceReadback } from './sourceReviewD26'
import { D20ReviewSessionRepository } from '../../experiments/candidate16/d20ReviewSession'
import { createOrdinaryMeasurement } from './ordinaryMeasurementD26'

async function setup(kind: 'two' | 'shared' | 'single' = 'two') {
  const fixture = await createAuthorityFixture(kind), store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
  await repo.initialize(emptyWorkspace()); const capture = new CapturePersistenceService(repo), h = await capture.beginCapture({ operationId: crypto.randomUUID(), sourceType: 'text', title: kind, rawText: fixture.sourceText, provider: 'manual', modelName: 'ENGINEERING_FIXTURE', promptVersion: 'test', pipelineVersion: 'single-authority' })
  await capture.recognize(h, async () => decodeSingleAuthorityRecording(fixture.rawHttpText, fixture.context).result)
  await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>({...d,legacyData:{...d.legacyData,firstSuggestionDisplayed:JSON.parse(JSON.stringify(d.result))}})),recognitionRuns:w.recognitionRuns.map(r=>({...r,legacyData:{...r.legacyData,originalRecognitionResult:JSON.parse(JSON.stringify(w.extractionDrafts[0].result))}}))}))
  const viewRepo = new IndexedDbWorkspaceRepository(repo), view = (await viewRepo.load())!, sessionStore = Object.assign(store, { name: 'rco-mainline-01-02-i1-d27-plan-event-test' }), measurement = createOrdinaryMeasurement(store), session = new D20ReviewSessionRepository(sessionStore, measurement.changed, measurement.activity, true)
  return { fixture, store, repo, viewRepo, view, session, measurement, draftId: view.drafts[0].id }
}
async function choose(x: Awaited<ReturnType<typeof setup>>, eventId: string, decision: EventDisposition) {
  const w = (await x.repo.load())!, view = (await x.viewRepo.load())!, draft = view.drafts.find(d => d.id === x.draftId)!, base = eventDisposition(w, draft.id, eventId), key = `event:${eventId}:disposition`, mine = { eventId, decision }
  const staged = await x.session.stage(w, draft.id, key, base, mine, x.session.writer), field = staged.fields[key]
  await x.session.withFreshField(w, draft.id, key, x.session.writer, field.revision, mine, () => x.viewRepo.save({ ...view, drafts: view.drafts.map(d => d.id === draft.id ? { ...d, recognitionResult: { ...d.recognitionResult!, events: d.recognitionResult!.events.map(e => e.tempId === eventId ? { ...e, selected: decision === 'keep' } : e) } } : d), historyRecords: [...view.historyRecords, { id: crypto.randomUUID(), entityType: 'draft', entityId: draft.id, action: 'updated', field: eventDispositionField(eventId), before: base, after: decision, actor: 'user', changedAt: new Date().toISOString() }] }))
  await x.session.clear(w, draft.id, key, x.session.writer, field.revision)
}
async function confirm(x: Awaited<ReturnType<typeof setup>>) { const w = (await x.repo.load())!, view = (await x.viewRepo.load())!, plan = buildSourceReviewPlan(w, view.drafts[0]), receipt = await commitSourceReview(x.repo, plan); return { plan, receipt, read: await verifySourceReviewReadback(new CanonicalWorkspaceRepository(x.store), receipt) } }

describe('ordinary per-event user disposition and canonical recovery', () => {
  it('reject survives view reload, excludes its exclusive time, retains original recording, and counts a structural correction', async () => {
    const x = await setup(); await choose(x, 'E2', 'reject')
    const w = (await x.repo.load())!; expect(eventDisposition(w, x.draftId, 'E2')).toBe('reject'); expect(w.events).toHaveLength(0)
    const { receipt, read } = await confirm(x)
    expect(read.events.map(e => e.title)).toEqual(['设计分享会']); expect(read.timePoints).toHaveLength(1); expect(read.extractionDrafts[0].rejectedEntityTempIds).toContain('E2')
    expect(read.recognitionRuns[0].legacyData?.originalRecognitionResult).toEqual(decodeSingleAuthorityRecording(x.fixture.rawHttpText,x.fixture.context).result)
    await x.measurement.committed(receipt, await x.session.load(read, x.draftId), read); await x.measurement.committed(receipt, await x.session.load(read, x.draftId), read)
    const rows = await x.measurement.events(); expect(rows.filter(e => e.kind === 'commit')).toHaveLength(1); expect(rows.find(e => e.kind === 'commit')?.semanticFields).toEqual(['event:E2:reject'])
  })
  it('deferral is distinct from rejection; another event can be saved and later the shared owner is added idempotently', async () => {
    const x = await setup('shared'); await choose(x, 'E2', 'defer'); const first = await confirm(x)
    expect(first.receipt.disposition).toBe('partial'); expect(first.read.timePoints).toHaveLength(1); expect(first.read.events).toHaveLength(1); expect(first.read.extractionDrafts[0].rejectedEntityTempIds).not.toContain('E2')
    await acknowledgeSourceReadback(x.repo, first.receipt); await choose(x, 'E2', 'keep'); const second = await confirm(x)
    expect(second.read.events).toHaveLength(2); expect(second.read.timePoints).toHaveLength(1); expect(new Set(second.read.events.map(e => e.startTimePointId)).size).toBe(1)
    expect(second.read.timePoints[0].legacyData?.sharedEventIds).toHaveLength(2)
    await commitSourceReview(x.repo, second.plan); expect((await x.repo.load())!.events).toHaveLength(2)
  })
  it('rejecting one explicitly shared owner never discards the kept event time', async () => {
    const x = await setup('shared'); await choose(x, 'E1', 'reject'); const { read } = await confirm(x)
    expect(read.events.map(e => e.title)).toEqual(['乙组讨论']); expect(read.timePoints).toHaveLength(1); expect(read.timePoints[0].eventId).toBe(read.events[0].id)
    expect(read.timePoints[0].legacyData?.sharedEventIds).toEqual([read.events[0].id])
  })
  it('all events may be explicitly rejected without manufacturing empty projects or facts', async () => {
    const x = await setup(); await choose(x, 'E1', 'reject'); await choose(x, 'E2', 'reject'); const { receipt, read } = await confirm(x)
    expect(receipt.disposition).toBe('no_task'); expect(read.events).toHaveLength(0); expect(read.timePoints).toHaveLength(0); expect(read.projects).toHaveLength(0)
  })
  it('stale clear and stale resolution cannot erase another writer or a newer selection', async () => {
    const x = await setup(), w = (await x.repo.load())!, key = 'event:E1:disposition', a = await x.session.stage(w, x.draftId, key, 'keep', { eventId: 'E1', decision: 'reject' }, 'A'), b = await x.session.stage(w, x.draftId, key, 'keep', { eventId: 'E1', decision: 'defer' }, 'B')
    await expect(x.session.clear(w, x.draftId, key, 'A', a.fields[key].revision)).rejects.toThrow()
    const resolved = await x.session.resolve(w, x.draftId, key, 'incoming', 'B', b.fields[key].revision)
    await expect(x.session.resolve(w, x.draftId, key, 'latest', 'A', b.fields[key].revision)).rejects.toThrow('CONFLICT_MISSING')
    expect((await x.session.load(w, x.draftId)).fields[key].mine).toEqual({ eventId: 'E1', decision: 'defer' })
    await x.session.stage(w, x.draftId, key, 'keep', { eventId: 'E1', decision: 'keep' }, 'B')
    await expect(x.session.clear(w, x.draftId, key, 'B', resolved.fields[key].revision)).rejects.toThrow()
  })
})
