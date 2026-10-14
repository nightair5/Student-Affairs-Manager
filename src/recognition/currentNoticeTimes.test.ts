import { describe, expect, it } from 'vitest'
import { createCurrentNoticeFixture } from '../experiments/candidate19Recorded/currentNoticeFixtures'
import { decodeCurrentSourceRecording } from './conditionalNonActionProduct'
import { assembleCurrentFirstSuggestion } from './materialChannelGrounding'
import { interpretTimeD26 } from '../lib/timeSemanticsD26'
import { validateRecognitionResult } from './schema'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { rebindRecordedScopes } from './recordedProjectionD26'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { CapturePersistenceService } from '../domain/v2/capture'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback } from '../domain/v2/sourceReviewD26'
const options = { type: 'submission_deadline' as const, referenceTime: '2026-05-20T09:00:00+08:00', timezone: 'Asia/Shanghai' }
async function heading() {
  const f = await createCurrentNoticeFixture('heading-clock')
  const decoded = decodeCurrentSourceRecording(f.rawHttpText, 'EngineeringFixture', f.context)
  return { f, result: decoded.result }
}
const assemble = (result: Awaited<ReturnType<typeof heading>>['result'], f: Awaited<ReturnType<typeof heading>>['f']) => assembleCurrentFirstSuggestion(result, { sourceText: f.sourceText, referenceTime: f.context.referenceTime, timezone: f.context.timezone }).result

describe('public notice time values through the real ordinary product chain', () => {
  it('keeps the stated date and both already-present event endpoints without human correction', async () => {
    const { f, result } = await heading(), first = assemble(result, f)
    expect(first.timePoints.map(p => p.normalizedValue)).toEqual(['2026-10-12T12:30', '2026-10-12T14:00'])
    expect(first.timePoints.map(p => p.rawText)).toEqual(['12:30', '14:00'])
    expect(validateRecognitionResult(first).issues).toEqual([])
    expect(first.standaloneTasks).toHaveLength(0)
    const original = JSON.parse(JSON.parse(f.rawHttpText).output[0].content[0].text)
    expect(original.timePoints.every((p: { normalizedValue?: string }) => p.normalizedValue === undefined)).toBe(true)
  })
  it('changes the value when the source date changes, not a case identity exception', async () => {
    const f = await createCurrentNoticeFixture('heading-clock'), sourceText = f.sourceText.replace('10月12日（周一）', '11月3日（周二）')
    const index = await indexImmutableScopesV11('different-notice', 'v1', sourceText)
    // This is a newly authored counterfactual, not a recording replay: the
    // replay rebinder correctly refuses changed source bytes.
    let raw = f.rawHttpText
    f.context.index.scopes.forEach((scope, i) => { raw = raw.replaceAll(scope.id, index.scopes[i].id) })
    const result = decodeCurrentSourceRecording(raw, 'EngineeringFixture', { ...f.context, index }).result
    expect(assemble(result, { ...f, sourceText }).timePoints.map(p => p.normalizedValue)).toEqual(['2026-11-03T12:30', '2026-11-03T14:00'])
  })
  it('refuses absent, unrelated, repeated or contradictory date evidence and does not create missing endpoints', async () => {
    for (const kind of ['no-point-date', 'no-owner-date', 'wrong-type', 'repeated', 'other-event', 'contradictory', 'missing-end'] as const) {
      const { f, result } = await heading()
      const dateId = result.evidence.find(e => e.quote.includes('2026年'))!.id
      if (kind === 'no-point-date') result.timePoints.forEach(p => { p.evidenceIds = p.evidenceIds.filter(id => id !== dateId) })
      if (kind === 'no-owner-date') result.events[0].evidenceIds = result.events[0].evidenceIds.filter(id => id !== dateId)
      if (kind === 'wrong-type') result.timePoints.forEach(p => { p.type = 'submission_deadline' })
      if (kind === 'repeated') f.sourceText += '\n2026年10月12日（周一）'
      if (kind === 'other-event') result.events.push({ ...result.events[0], tempId: 'E2' })
      if (kind === 'contradictory') {
        f.sourceText += '\n2026年10月13日（周二）'
        result.evidence.push({ ...result.evidence[0], id: 'contradictory', quote: '2026年10月13日（周二）' })
        result.timePoints.forEach(p => p.evidenceIds.push('contradictory'))
        result.events[0].evidenceIds.push('contradictory')
      }
      if (kind === 'missing-end') { result.timePoints = result.timePoints.filter(p => p.tempId !== 'P1'); result.events[0].endTimePointTempId = null }
      const first = assemble(result, f)
      if (kind === 'missing-end') expect(first.timePoints).toHaveLength(1)
      else expect(first.timePoints.every(p => p.normalizedValue === null)).toBe(true)
    }
  })
  it('normalizes a literal end-of-day deadline across month/year without changing its raw text', () => {
    for (const [raw, value] of [['2026年6月30日24:00', '2026-07-01T00:00'], ['2026年12月31日24：00', '2027-01-01T00:00']]) {
      const t = interpretTimeD26(raw, options)
      expect(t.point.normalizedValue).toBe(value); expect(t.point.rawText).toBe(raw)
      expect(t.conversions).toEqual(['END_OF_DAY_24_00'])
    }
    for (const raw of ['2026年6月30日24:01', '2026年6月30日24:30', '2026年2月30日24:00', '下午24:00', '24:00', '2026年6月30日24:00:30']) {
      const t = interpretTimeD26(raw, options)
      expect(t.point.normalizedValue).toBeNull(); expect(t.conversions).toEqual([])
    }
    expect(interpretTimeD26('2026年6月30日24:00', { ...options, sourceContext: '时间暂定2026年6月30日24:00' }).point.needsConfirmation).toBe(true)
    expect(interpretTimeD26('尚未公布', options).point.normalizedValue).toBeNull()
  })
  it.each(['heading-clock', 'midnight-deadline'])('%s persists a single formal plan with an independent repository readback and idempotent repeat', async id => {
    const f = await createCurrentNoticeFixture(id), store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace())
    const capture = new CapturePersistenceService(repo), handle = await capture.beginCapture({ operationId: crypto.randomUUID(), rawText: f.sourceText, sourceType: 'text', title: f.sourceText.slice(0, 20), provider: 'manual', modelName: 'engineering', promptVersion: 'current-notice-fixture', pipelineVersion: 'source-time-semantics-2.1.0' })
    const index = await indexImmutableScopesV11(handle.sourceId, handle.sourceVersionId, f.sourceText), raw = rebindRecordedScopes(f.rawHttpText, f.context.index, index).reboundHttpText
    await capture.recognize(handle, async () => assemble(decodeCurrentSourceRecording(raw, 'EngineeringFixture', { ...f.context, index }).result, f))
    const view = (await new IndexedDbWorkspaceRepository(repo).load())!, w = (await repo.load())!, draft = view.drafts.find(d => d.id === handle.draftId)!
    const plan = buildSourceReviewPlan(w, draft), receipt = await commitSourceReview(repo, plan)
    const actual = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store), receipt)
    expect(actual.projects).toHaveLength(0)
    expect(actual.timePoints.map(p => p.normalizedValue)).toEqual(id === 'heading-clock' ? ['2026-10-12T12:30', '2026-10-12T14:00'] : ['2026-07-01T00:00'])
    expect([actual.tasks.length, actual.events.length]).toEqual(id === 'heading-clock' ? [0, 1] : [1, 0])
    await commitSourceReview(repo, plan)
    expect((await repo.load())!.timePoints).toHaveLength(actual.timePoints.length)
  })
})
