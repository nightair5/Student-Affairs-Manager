import { describe, it, expect } from 'vitest'
import { createAuthorityFixture } from '../experiments/candidate19Recorded/singleAuthorityFixtures'
import { decodeSingleAuthorityRecording } from './sourceContractV5'
import { decodeAuthorityProductRecording, projectAuthorityAttributeIndex } from './singleAuthorityProduct'
import { MemoryWorkspaceRecordStore, CanonicalWorkspaceRepository } from '../domain/v2/repository'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { CapturePersistenceService } from '../domain/v2/capture'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback } from '../domain/v2/sourceReviewD26'

describe('post-comparison attribute evidence inverse, no fact or time-owner inference', () => {
  const envelope = (raw: string, facts: unknown) => { const e = JSON.parse(raw); e.output[0].content[0].text = JSON.stringify(facts); return JSON.stringify(e) }
  it('nested literal attributes need not duplicate event scope indexes; original compiler/raw stay unchanged', async () => {
    const x = await createAuthorityFixture('single'), facts = structuredClone(x.facts)
    facts.events[0].scopeIds = facts.events[0].scopeIds.filter(id => !facts.events[0].attributes.some(a => a.scopeIds.includes(id)))
    const raw = envelope(x.rawHttpText, facts), before = structuredClone(facts)
    expect(() => decodeSingleAuthorityRecording(raw, x.context)).toThrow('ATTRIBUTE_EVIDENCE')
    const r = decodeAuthorityProductRecording(raw, x.context, 'SingleAuthority')
    expect(facts).toEqual(before); expect(r.sidecar.originalResponse).toBe(raw)
    expect(r.result.events).toHaveLength(1); expect(r.result.timePoints).toHaveLength(2)
    expect(r.result.events[0].description).toContain('参与证明')
    expect(r.attributeIndexAudit.inferredFacts).toBe(0); expect(r.attributeIndexAudit.additions.length).toBeGreaterThan(0)
  })
  it('unsupported text, foreign source scopes and contradictory primary ownership still fail', async () => {
    const x = await createAuthorityFixture('single')
    const wrong = structuredClone(x.facts); wrong.events[0].attributes[0].text = '必须付费'
    expect(() => projectAuthorityAttributeIndex(wrong, x.context)).toThrow('SOURCE_EVIDENCE')
    const foreign = structuredClone(x.facts); foreign.events[0].attributes[0].scopeIds = ['foreign-source']
    expect(() => projectAuthorityAttributeIndex(foreign, x.context)).toThrow('SOURCE_EVIDENCE')
    const owner = structuredClone(x.facts), id = owner.events[0].attributes[0].scopeIds[0]
    const row = owner.scopeAccounting.find(r => r.scopeId === id)!
    row.kind = 'event'; row.primaryEntityIds = ['another-event']
    expect(() => projectAuthorityAttributeIndex(owner, x.context)).toThrow('ACCOUNTING_OWNER')
  })
  it('adding an attribute index cannot make a previously wrong time owner pass', async () => {
    const x = await createAuthorityFixture('single'), f = structuredClone(x.facts), id = f.events[0].attributes[0].scopeIds[0]
    f.events[0].scopeIds = f.events[0].scopeIds.filter(s => s !== id)
    f.timePoints[0].scopeIds = [id]
    expect(() => projectAuthorityAttributeIndex(f, x.context)).toThrow('TIME_OWNER')
    const bad = await createAuthorityFixture('bad-owner'), d = decodeAuthorityProductRecording(bad.rawHttpText, bad.context)
    expect(d.singleAuthorityAudit.quarantinedOwners).toHaveLength(1)
    expect(d.result.conflicts.some(c => c.entityTempIds.includes('E1') && c.entityTempIds.includes('E2'))).toBe(true)
  })
  it('different actual activities and shared times retain their identities', async () => {
    for (const kind of ['similar', 'ceremony', 'shared'] as const) {
      const x = await createAuthorityFixture(kind), d = decodeAuthorityProductRecording(x.rawHttpText, x.context)
      expect(d.result.events).toHaveLength(2)
      if (kind === 'shared') expect(d.result.timePoints).toHaveLength(1)
    }
  })
  it('the repaired real compiler path preserves outcome and endpoints through one formal transaction and independent readback', async () => {
    const x = await createAuthorityFixture('single'), f = structuredClone(x.facts)
    f.events[0].scopeIds = f.events[0].scopeIds.filter(id => !f.events[0].attributes.some(a => a.scopeIds.includes(id)))
    const decoded = decodeAuthorityProductRecording(envelope(x.rawHttpText, f), x.context), store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace()); const capture = new CapturePersistenceService(repo)
    const h = await capture.beginCapture({ operationId: crypto.randomUUID(), sourceType: 'text', title: '附属活动说明', rawText: x.sourceText, provider: 'manual', modelName: 'ENGINEERING_FIXTURE', promptVersion: 'test', pipelineVersion: 'attribute-index-1' })
    await capture.recognize(h, async () => decoded.result)
    const view = (await new IndexedDbWorkspaceRepository(repo).load())!, receipt = await commitSourceReview(repo, buildSourceReviewPlan((await repo.load())!, view.drafts[0]))
    const read = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store), receipt)
    expect(read.events).toHaveLength(1); expect(read.tasks).toHaveLength(0); expect(read.timePoints).toHaveLength(2)
    expect(read.events[0].description).toContain('参与证明')
    expect(read.events[0].startTimePointId).toBe(read.timePoints.find(p => p.normalizedValue === '2026-11-12T14:00')!.id)
  })
})
