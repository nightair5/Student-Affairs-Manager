import { describe, it, expect } from 'vitest'
import { createCurrentMechanismFixture } from '../experiments/candidate19Recorded/currentMechanismFixtures'
import { createAuthorityFixture } from '../experiments/candidate19Recorded/singleAuthorityFixtures'
import { decodeAuthorityProductRecording } from './singleAuthorityProduct'
import { decodeSingleAuthorityRecording } from './sourceContractV5'
import { assembleCurrentFirstSuggestion } from './materialChannelGrounding'
import { groundSourceWindows, sourceWindowsFromSidecar } from './sourceWindowGrounding'
import { assembleSemanticFirstSuggestionD26 } from './firstSuggestionD26'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { CapturePersistenceService } from '../domain/v2/capture'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback } from '../domain/v2/sourceReviewD26'
import { buildPersonalPlan, defaultPlanOptions } from '../domain/v2/personalPlanD27'

const rewrite = (raw: string, facts: unknown) => { const e = JSON.parse(raw); e.output[0].content[0].text = JSON.stringify(facts); return JSON.stringify(e) }
describe('current ordinary title and explicitly owned calendar window', () => {
  it('a complete literal action does not duplicate its exact object; raw and semantic fields remain intact', async () => {
    const x = await createCurrentMechanismFixture('whole-action'), before = structuredClone(x.facts), d = decodeAuthorityProductRecording(x.rawHttpText, x.context)
    expect(d.result.standaloneTasks[0].title).toBe('完成相关信息登记')
    expect(d.result.standaloneTasks[0].actionObject).toBe('相关信息')
    expect(d.sidecar.originalResponse).toBe(x.rawHttpText); expect(x.facts).toEqual(before)
    for (const [action, object, title] of [['确认', '确认单', '确认确认单'], ['登记', '登记表', '登记登记表'], ['不要删除申请', '申请', '不要删除申请']]) {
      const r = structuredClone(d.result), t = r.standaloneTasks[0]
      const text = title + '。'; t.actionVerb = action; t.actionObject = object
      r.evidence.forEach(e => { e.quote = text })
      expect(assembleCurrentFirstSuggestion(r, { sourceText: text, referenceTime: x.context.referenceTime, timezone: x.context.timezone }).result.standaloneTasks[0].title).toBe(title)
    }
    const semantic = d.sidecar.originalSemantic
    expect(assembleSemanticFirstSuggestionD26(semantic, x.context).result.tasks[0].detail.title).toBe('完成相关信息登记')
  })
  it.each(['compact-window', 'expanded-window'] as const)('%s resolves both explicit endpoints and survives the second ordinary assembly', async kind => {
    const x = await createCurrentMechanismFixture(kind), before = structuredClone(x.facts)
    const old = decodeSingleAuthorityRecording(x.rawHttpText, x.context), d = decodeAuthorityProductRecording(x.rawHttpText, x.context)
    expect(old.result.timePoints.map(p => p.normalizedValue)).toEqual(kind === 'compact-window' ? ['2026-11-06', '2026-11-06'] : [null, null])
    const current = assembleCurrentFirstSuggestion(d.result, { sourceText: x.sourceText, referenceTime: x.context.referenceTime, timezone: x.context.timezone, sourceWindows: sourceWindowsFromSidecar(d.sidecar) })
    expect(current.result.timePoints.map(p => p.normalizedValue)).toEqual(['2026-11-06', '2026-11-08'])
    expect(current.result.timePoints.every(p => p.precision === 'date_only' && !p.needsConfirmation)).toBe(true)
    expect(current.result.timePoints.every(p => p.type !== 'task_deadline' && p.type !== 'planned_start')).toBe(true)
    expect(d.sourceWindowGrounding.decisions.every(r => r.status === 'CITED_DATE_RANGE_ENDPOINT')).toBe(true)
    expect(x.facts).toEqual(before); expect(d.sidecar.originalResponse).toBe(x.rawHttpText)
  })
  it('source month/day changes, original reference year, explicit cross-year and reversed ranges are respected', async () => {
    for (const [range, expected] of [['8月13—27日', ['2026-08-13', '2026-08-27']], ['2026年12月30日至2027年1月2日', ['2026-12-30', '2027-01-02']], ['2026年11月8—6日', [null, null]], ['2026年2月28—30日', [null, null]]] as const) {
      const x = await createCurrentMechanismFixture('compact-window', range), d = decodeAuthorityProductRecording(x.rawHttpText, x.context)
      expect(d.result.timePoints.map(p => p.normalizedValue)).toEqual(expected)
    }
  })
  it('a wrong endpoint, ambiguous ranges, missing/foreign ownership and a deadline cannot use the window projection', async () => {
    const x = await createCurrentMechanismFixture('expanded-window'), f = structuredClone(x.facts)
    f.timePoints[1].rawText = '2026年11月6日'
    expect(decodeAuthorityProductRecording(rewrite(x.rawHttpText, f), x.context).result.timePoints[1]).toMatchObject({ normalizedValue: null, needsConfirmation: true })
    const d = decodeAuthorityProductRecording(x.rawHttpText, x.context), windows = sourceWindowsFromSidecar(d.sidecar)
    const owner = structuredClone(windows); owner[1].owners[0].entityId = 'not-the-task'
    expect(groundSourceWindows(d.result, owner, { sourceText: x.sourceText, referenceTime: x.context.referenceTime, timezone: x.context.timezone }).result.timePoints[1].normalizedValue).toBeNull()
    const deadline = structuredClone(d.result); deadline.timePoints[1].type = 'task_deadline'
    expect(groundSourceWindows(deadline, windows, { sourceText: x.sourceText, referenceTime: x.context.referenceTime, timezone: x.context.timezone }).result.timePoints[1].normalizedValue).toBeNull()
    const ambiguous = await createCurrentMechanismFixture('compact-window', '2026年11月6—8日或2026年11月9—10日')
    expect(decodeAuthorityProductRecording(ambiguous.rawHttpText, ambiguous.context).result.timePoints.every(p => p.normalizedValue === null)).toBe(true)
    expect(() => sourceWindowsFromSidecar({ singleAuthorityAudit: { sourceWindows: [{ id: 'P1', role: 'deadline', owners: [] }] } })).toThrow('DECLARATIONS_INVALID')
  })
  it('existing clock endpoints and unannounced event times retain their values and meanings', async () => {
    for (const kind of ['window', 'single'] as const) {
      const x = await createAuthorityFixture(kind), old = decodeSingleAuthorityRecording(x.rawHttpText, x.context), d = decodeAuthorityProductRecording(x.rawHttpText, x.context)
      expect(d.result.timePoints).toEqual(old.result.timePoints)
    }
  })
  it('ordinary capture, one atomic formal save and independent readback preserve title, window roles/owners and exact dates', async () => {
    for (const kind of ['compact-window', 'whole-action'] as const) {
      const x = await createCurrentMechanismFixture(kind), d = decodeAuthorityProductRecording(x.rawHttpText, x.context), store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
      await repo.initialize(emptyWorkspace()); const capture = new CapturePersistenceService(repo)
      const h = await capture.beginCapture({ operationId: crypto.randomUUID(), sourceType: 'text', title: kind, rawText: x.sourceText, provider: 'manual', modelName: 'ENGINEERING_FIXTURE', promptVersion: 'existing-v5', pipelineVersion: 'current-mechanism' })
      await capture.recognize(h, async () => d.result)
      await repo.transaction(w => ({ ...w, extractionDrafts: w.extractionDrafts.map(v => v.id === h.draftId ? { ...v, legacyData: { ...v.legacyData, semanticSidecar: JSON.parse(JSON.stringify(d.sidecar)) } } : v) }))
      const view = (await new IndexedDbWorkspaceRepository(repo).load())!, receipt = await commitSourceReview(repo, buildSourceReviewPlan((await repo.load())!, view.drafts[0]))
      const read = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store), receipt)
      expect(read.tasks).toHaveLength(1); expect(read.events).toHaveLength(0)
      if (kind === 'compact-window') {
        expect(read.timePoints.map(p => p.normalizedValue)).toEqual(['2026-11-06', '2026-11-08'])
        expect(read.timePoints.map(p => p.legacyData?.sourceTimeRole)).toEqual(['window_start', 'window_end'])
        expect(read.timePoints.some(p => p.type === 'task_deadline' || p.type === 'planned_start')).toBe(false)
        const originals = structuredClone(read.timePoints), taskId = read.tasks[0].id
        expect(buildPersonalPlan(read, defaultPlanOptions(new Date('2026-10-07T09:00:00+08:00'))).unscheduled[0].code).toBe('SOURCE_WINDOW_OUTSIDE_PLAN')
        const options = { ...defaultPlanOptions(new Date('2026-11-06T09:00:00+08:00')), days: 4 }
        const proposal = buildPersonalPlan(read, options)
        expect(proposal.segments[0].start).toBe('2026-11-06T01:00:00.000Z')
        expect(proposal.segments[0].originalDeadline).toBeNull()
        expect(buildPersonalPlan(read, { ...options, overrides: { [taskId]: { start: '2026-11-08T17:30' } } }).segments).toHaveLength(1)
        expect(buildPersonalPlan(read, { ...options, overrides: { [taskId]: { start: '2026-11-09T09:00' } } }).unscheduled[0].code).toBe('INVALID_MANUAL_SLOT')
        expect(read.timePoints).toEqual(originals)
        read.timePoints[1].normalizedValue = null; read.timePoints[1].needsConfirmation = true
        expect(buildPersonalPlan(read, options).unscheduled[0].code).toBe('SOURCE_WINDOW_NEEDS_REVIEW')
      } else {
        expect(read.tasks[0].title).toBe('完成相关信息登记')
        expect(view.drafts[0].items[0].suggestion.nextAction).toBe('完成相关信息登记')
        expect(read.tasks[0].nextAction).toBe('完成相关信息登记')
      }
    }
  })
})
