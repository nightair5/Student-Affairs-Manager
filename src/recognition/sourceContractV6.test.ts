import { describe, it, expect } from 'vitest'
import { buildObligationAuthorityRequest, decodeObligationProductRecording, OBLIGATION_AUTHORITY_SCHEMA, OBLIGATION_PROMPT_VERSION, projectObligationAuthority } from './sourceContractV6'
import { createObligationFixture, OBLIGATION_CASES, obligationEnvelope, authorityToObligationFixture } from '../experiments/candidate19Recorded/obligationFixtures'
import { createAuthorityFixture } from '../experiments/candidate19Recorded/singleAuthorityFixtures'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { CapturePersistenceService } from '../domain/v2/capture'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback } from '../domain/v2/sourceReviewD26'
import { readEventTaskRelations } from '../domain/v2/eventTaskRelations'
import { buildDomainCommitPlanV2 } from '../domain/v2/domainCommit'
import { validateRecognitionResult } from './schema'
import { indexImmutableScopesV11 } from './scopeIndexV11'

describe('obligations first, one task-event authority, no missing-fact repair', () => {
  it.each(OBLIGATION_CASES)('%s is representable through actual schema and common first display', async kind => {
    const x = await createObligationFixture(kind), before = structuredClone(x.facts), d = decodeObligationProductRecording(x.rawHttpText, x.context)
    expect(d.sidecar.originalResponse).toBe(x.rawHttpText); expect(x.facts).toEqual(before)
    expect(d.sidecar.obligationAuthorityAudit.inferredFacts).toBe(0); expect(d.result.promptVersion).toBe(OBLIGATION_PROMPT_VERSION)
    if (kind === 'equipment') { expect(d.result.standaloneTasks[0].title).toBe('准备笔记本'); expect(d.result.standaloneTasks[0].selected).toBe(false); expect(d.result.timePoints.find(p => p.type === 'event_end')?.normalizedValue).toBe(null) }
    if (kind === 'registration') { expect(d.result.events[0].relatedTaskTempIds).toEqual(['T1']); expect(d.result.standaloneTasks[0].selected).toBe(true); expect(d.result.timePoints.find(p => p.type === 'submission_deadline')?.normalizedValue).toBe('2026-11-06T17:00') }
    if (kind === 'no-task') { expect(d.result.standaloneTasks).toHaveLength(0); expect(d.result.events).toHaveLength(1); expect(d.result.events[0].title).toBe('网络服务在周五晚上维护'); expect(d.result.events[0].selected).toBe(true); expect(d.result.timePoints.every(p => p.normalizedValue === null)).toBe(true) }
    if (kind === 'shared-window') expect(d.result.timePoints.every(p => p.relatedTaskTempIds.length === 2)).toBe(true)
  })
  it('missing link/owner, fake/cross-object links and duplicate inverse fields do not become correct', async () => {
    const x = await createObligationFixture('registration'), missing = structuredClone(x.facts); missing.tasks[0].eventLinks = []
    expect(() => decodeObligationProductRecording(obligationEnvelope(missing), x.context)).toThrow('MISSING_PRESENT_FACT')
    const fake = structuredClone(x.facts); fake.tasks[0].eventLinks[0].eventId = 'fake'
    expect(() => projectObligationAuthority(fake, x.context)).toThrow('EVENT_LINK_REFERENCE')
    const foreign = structuredClone(x.facts); foreign.tasks[0].eventLinks[0].scopeIds = ['foreign-source']
    expect(() => projectObligationAuthority(foreign, x.context)).toThrow('EVENT_LINK_EVIDENCE')
    const other = structuredClone(x.facts); other.events.push({ ...other.events[0], tempId: 'E2', title: '其他活动', scopeIds: [x.context.index.scopes.at(-1)!.id] }); other.tasks[0].eventLinks[0].eventId = 'E2'
    expect(() => projectObligationAuthority(other, x.context)).toThrow('EVENT_LINK_EVIDENCE')
    expect(() => projectObligationAuthority({ ...x.facts, events: x.facts.events.map(e => ({ ...e, relatedTaskTempIds: ['T1'] })) }, x.context)).toThrow('SHAPE')
    const shared = await createObligationFixture('shared-window'); shared.facts.timePoints.forEach(p => { p.owners = p.owners.filter(o => o.entityId !== 'T2') })
    expect(() => decodeObligationProductRecording(obligationEnvelope(shared.facts), shared.context)).toThrow('MISSING_PRESENT_FACT')
  })
  it('qualification unknown and predecessor unknown stay distinct, neither becomes completed', async () => {
    const x = await createAuthorityFixture('dependency'), f = authorityToObligationFixture(x.facts), d = decodeObligationProductRecording(obligationEnvelope(f), x.context)
    expect(d.result.standaloneTasks.some(t => t.dependencyTempIds.includes('T1'))).toBe(true)
    const wrong = structuredClone(f); wrong.prerequisiteStates[0].completion = 'true'; wrong.prerequisiteStates[0].factScopeIds = f.tasks[1].propositionScopeIds
    expect(() => decodeObligationProductRecording(obligationEnvelope(wrong), x.context)).toThrow('CONDITIONAL_NOT_COMPLETION_PROOF')
  })
  it('valid but mismatched link citations quarantine only the task; unknown identities still reject', async () => {
    const x=await createObligationFixture('registration'), f=structuredClone(x.facts)
    const id=x.context.index.scopes.at(-1)!.id
    f.tasks[0].eventLinks[0].scopeIds=[id]
    f.tasks[0].propositionScopeIds=f.tasks[0].propositionScopeIds.filter(s=>s!==id)
    expect(()=>projectObligationAuthority(f,x.context)).toThrow('EVENT_LINK_EVIDENCE')
    const d=projectObligationAuthority(f,x.context,true)
    expect(d.projected.events[0].relatedTaskTempIds).toEqual([])
    expect(d.audit.localRelations.quarantinedRelations).toHaveLength(1)
    expect(d.projected.conflicts[0].entityTempIds).toEqual([f.tasks[0].id])
    f.tasks[0].eventLinks[0].eventId='unseen-event'
    expect(()=>projectObligationAuthority(f,x.context,true)).toThrow('EVENT_LINK_REFERENCE')
  })
  it('links and all actual facts survive ordinary capture, formal transaction and independent readback without edits', async () => {
    const x = await createObligationFixture('registration'), d = decodeObligationProductRecording(x.rawHttpText, x.context), store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace()); const capture = new CapturePersistenceService(repo)
    const h = await capture.beginCapture({ operationId: crypto.randomUUID(), sourceType: 'text', title: '登记关联', rawText: x.sourceText, provider: 'manual', modelName: 'ENGINEERING_FIXTURE', promptVersion: OBLIGATION_PROMPT_VERSION, pipelineVersion: 'obligation-authority-1' })
    await capture.recognize(h, async () => d.result)
    const draft = (await new IndexedDbWorkspaceRepository(repo).load())!.drafts[0], receipt = await commitSourceReview(repo, buildSourceReviewPlan((await repo.load())!, draft))
    const r = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store), receipt)
    expect(r.tasks).toHaveLength(1); expect(r.events).toHaveLength(1); expect(r.timePoints).toHaveLength(3)
    expect(readEventTaskRelations((await repo.load())!, r.events[0])).toEqual([{ taskTempId: 'T1', taskId: r.tasks[0].id, state: 'confirmed' }])
  })
  it('request order/schema/version implement one new hypothesis, baseline bytes remain untouched', async () => {
    const x = await createObligationFixture('registration'), r = await buildObligationAuthorityRequest(x.context)
    expect(Object.keys(OBLIGATION_AUTHORITY_SCHEMA.properties!)[1]).toBe('tasks'); expect(r.dispatchAuthorized).toBe(false)
    expect(r.promptVersion).toBe(OBLIGATION_PROMPT_VERSION); expect(r.body.input[0].content[0].text).toContain('最小义务')
    expect(r.serialized).not.toMatch(/\bexpected\b/iu)
    expect(OBLIGATION_AUTHORITY_SCHEMA.properties!.events.items!.required).not.toContain('relatedTaskTempIds')
  })
  it('partial confirmation stores the relation without inventing a task, and later confirmation resolves it from canonical facts', async () => {
    const x = await createObligationFixture('registration'), d = decodeObligationProductRecording(x.rawHttpText, x.context), store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace()); const capture = new CapturePersistenceService(repo), h = await capture.beginCapture({ operationId: crypto.randomUUID(), sourceType: 'text', title: '分步接受', rawText: x.sourceText, provider: 'manual', modelName: 'ENGINEERING_FIXTURE', promptVersion: OBLIGATION_PROMPT_VERSION, pipelineVersion: 'obligation-authority-1' })
    d.result.standaloneTasks[0].selected = false
    await capture.recognize(h, async () => d.result)
    let view = (await new IndexedDbWorkspaceRepository(repo).load())!, w = (await repo.load())!
    await commitSourceReview(repo, buildSourceReviewPlan(w, view.drafts[0]))
    w = (await repo.load())!; expect(w.tasks).toHaveLength(0); expect(readEventTaskRelations(w, w.events[0])).toEqual([{ taskTempId: 'T1', taskId: null, state: 'pending' }])
    const p = buildDomainCommitPlanV2(w, h.draftId, { taskTempIds: ['T1'], timePointTempIds: ['P0'], eventTempIds: [], materialTempIds: [] })
    await commitSourceReview(repo, p)
    w = (await repo.load())!; expect(w.events).toHaveLength(1); expect(readEventTaskRelations(w, w.events[0])[0].taskId).toBe(w.tasks[0].id)
    view = (await new IndexedDbWorkspaceRepository(repo).load())!; expect(view.tasks).toHaveLength(1)
  })
  it('ordinary relation extension rejects fake, duplicate and malformed IDs before capture or formal writes', async () => {
    const x = await createObligationFixture('registration'), d = decodeObligationProductRecording(x.rawHttpText, x.context)
    for (const value of [['fake'], ['T1', 'T1'], 'T1']) {
      const r = structuredClone(d.result); Object.assign(r.events[0], { relatedTaskTempIds: value })
      expect(validateRecognitionResult(r).valid).toBe(false)
    }
  })
  it('different objects, dates and synonymous action wording change actual facts and never retain the old owner values', async () => {
    const old = await createObligationFixture('registration')
    const replace = (s: string) => s.replaceAll('制图讲座', '声学工作坊').replaceAll('报名', '登记').replaceAll('11月6日', '12月2日').replaceAll('11月9日', '12月5日')
    const sourceText = replace(old.sourceText), index = await indexImmutableScopesV11('different-notice', 'different-notice-v1', sourceText)
    const mappings = new Map(old.context.index.scopes.map(s => [s.id, index.scopes.find(n => n.text === replace(s.text))!.id]))
    const rewrite = (value: unknown): unknown => typeof value === 'string' ? mappings.get(value) ?? replace(value) : Array.isArray(value) ? value.map(rewrite) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v)])) : value
    const wire = rewrite(old.facts), context = { ...old.context, index }, d = decodeObligationProductRecording(obligationEnvelope(wire as typeof old.facts), context)
    expect(d.result.standaloneTasks[0].actionVerb).toBe('登记'); expect(d.result.standaloneTasks[0].actionObject).toBe('声学工作坊')
    expect(d.result.events[0].title).toBe('声学工作坊'); expect(d.result.events[0].relatedTaskTempIds).toEqual(['T1'])
    expect(d.result.timePoints.map(p => p.normalizedValue)).toEqual(['2026-12-02T17:00', '2026-12-05T14:00', '2026-12-05T15:00'])
    const wrong = structuredClone(wire) as typeof old.facts; wrong.timePoints[0].rawText = '2026年11月6日17:00前'
    const rejectedTime = decodeObligationProductRecording(obligationEnvelope(wrong), context)
    expect(rejectedTime.result.timePoints[0].normalizedValue).toBe(null)
    expect(rejectedTime.result.timePoints[0].needsConfirmation).toBe(true)
    expect(rejectedTime.sidecar.displayAudit.unresolved).toContainEqual({ entityId: 'P0', reason: 'TIME_SOURCE_SUPPORT_MISSING' })
  })
})
