import { describe, it, expect } from 'vitest'
import { createAuthorityFixture } from '../experiments/candidate19Recorded/singleAuthorityFixtures'
import { decodeAuthorityProductRecording } from './singleAuthorityProduct'
import { currentDraftSourceInformation, projectSourceInformation, SOURCE_INFORMATION_PREVIEW_VERSION } from './sourceInformationPreview'
import { MemoryWorkspaceRecordStore, CanonicalWorkspaceRepository } from '../domain/v2/repository'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { CapturePersistenceService } from '../domain/v2/capture'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback } from '../domain/v2/sourceReviewD26'

async function informationFixture() {
  const x = await createAuthorityFixture('information'), decoded = decodeAuthorityProductRecording(x.rawHttpText, x.context)
  return { x, result: decoded.result, source: { sourceId: x.context.index.sourceId, sourceVersionId: x.context.index.sourceVersionId, text: x.sourceText } }
}

describe('source information visible without inventing entity ownership', () => {
  it('keeps different objects and literal wording as source information, not an event attribute or task', async () => {
    const { result, source } = await informationFixture(), before = structuredClone(result)
    const preview = projectSourceInformation(result, source)
    expect(preview.items.map(i => i.text).join('')).toContain('参与证明的名称保持不变')
    expect(preview.items.map(i => i.text).join('')).toContain('办事指南采用新版版式')
    expect(preview.inferredFacts).toBe(0); expect(result).toEqual(before)
    expect(result.standaloneTasks).toHaveLength(0); expect(result.events).toHaveLength(0); expect(result.timePoints).toHaveLength(0)
  })
  it('missing model information is never filled from the source', async () => {
    const { result, source } = await informationFixture()
    expect(projectSourceInformation({ ...result, ignoredContent: [] }, source).items).toEqual([])
  })
  it('rejects unsupported, foreign-source and contradictory fabricated quotes; deduplicates literal information', async () => {
    const { result, source } = await informationFixture(), duplicate = result.ignoredContent[0]
    const r = structuredClone(result)
    r.ignoredContent.push(duplicate, { text: '必须提交报名表', reason: 'other' })
    const projected = projectSourceInformation(r, source)
    expect(projected.suppressed.map(s => s.reason)).toContain('DUPLICATE')
    expect(projected.suppressed.map(s => s.reason)).toContain('UNSUPPORTED_SOURCE')
    expect(projectSourceInformation({ ...r, evidence: r.evidence.map(e => ({ ...e, sourceId: 'other-notice' })) }, source).items).toEqual([])
  })
  it('does not repeat already displayed real event attributes, and does not infer ownership for unattached information', async () => {
    const x = await createAuthorityFixture('single'), r = decodeAuthorityProductRecording(x.rawHttpText, x.context).result
    const supported = r.evidence.find(e => e.quote?.includes('参与证明'))!
    r.ignoredContent.push({ text: supported.quote!, reason: 'other' })
    const p = projectSourceInformation(r, { sourceId: x.context.index.sourceId, sourceVersionId: x.context.index.sourceVersionId, text: x.sourceText })
    expect(p.suppressed.some(s => s.reason === 'ENTITY_EVIDENCE_ALREADY_DISPLAYED')).toBe(true)
    expect(p.items.every(i => !i.text.includes('参与证明'))).toBe(true)
    expect(r.events).toHaveLength(1); expect(r.events[0].description).toContain('参与证明')
  })
  it('ordinary capture, formal transaction and independent readback retain information and first snapshot without creating empty entities', async () => {
    const { result, source } = await informationFixture(), store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace()); const capture = new CapturePersistenceService(repo)
    const h = await capture.beginCapture({ operationId: crypto.randomUUID(), sourceType: 'text', title: '来源补充说明', rawText: source.text, provider: 'manual', modelName: 'ENGINEERING_FIXTURE', promptVersion: 'test', pipelineVersion: SOURCE_INFORMATION_PREVIEW_VERSION })
    const bound = { ...result, evidence: result.evidence.map(e => ({ ...e, sourceId: h.sourceId })) }
    await capture.recognize(h, async () => bound)
    const info = projectSourceInformation(bound, { sourceId: h.sourceId, sourceVersionId: h.sourceVersionId, text: source.text })
    await repo.transaction(w => ({ ...w, extractionDrafts: w.extractionDrafts.map(d => d.id === h.draftId ? { ...d, legacyData: { ...d.legacyData, firstSourceInformationDisplayed: JSON.parse(JSON.stringify(info)) } } : d) }))
    const view = (await new IndexedDbWorkspaceRepository(repo).load())!, receipt = await commitSourceReview(repo, buildSourceReviewPlan((await repo.load())!, view.drafts[0]))
    const read = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store), receipt)
    expect(read.tasks).toHaveLength(0); expect(read.events).toHaveLength(0); expect(read.timePoints).toHaveLength(0)
    const loaded = (await new CanonicalWorkspaceRepository(store).load())!, projected = currentDraftSourceInformation(loaded, h.draftId)
    expect(projected.status).toBe('CURRENT')
    if (projected.status === 'CURRENT') expect(projected.preview).toEqual(info)
    expect(loaded.projects).toHaveLength(0)
    expect(loaded.extractionDrafts[0].legacyData?.firstSourceInformationDisplayed).toEqual(info)
    const changed = structuredClone(loaded); changed.sources[0].currentVersionId = 'new-version'
    expect(currentDraftSourceInformation(changed, h.draftId).status).toBe('SOURCE_VERSION_UNAVAILABLE')
  })
})
