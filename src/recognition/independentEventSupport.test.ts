import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { decodeProductSourceRecording } from './sourceAccountingSupportProduct'
import { decodeSourceContractRecording, type SourceContractV4 } from './sourceContractV4'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { rebindRecordedScopes } from './recordedProjectionD26'
import { PUBLIC_NOTICE_SOURCES } from '../experiments/candidate19Recorded/publicNotices'
import { assembleCurrentFirstSuggestion } from './materialChannelGrounding'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { CapturePersistenceService } from '../domain/v2/capture'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback } from '../domain/v2/sourceReviewD26'

const recorded = JSON.parse(readFileSync('docs/recognition-optimization/candidate19-public-development/paid-evidence/raw-01.json', 'utf8')) as { rawHttpText: string }
const source = PUBLIC_NOTICE_SOURCES[0]
const context = async () => ({ index: await indexImmutableScopesV11(source.id, source.id + '-v1', source.text), referenceTime: source.published + 'T09:00:00+08:00', timezone: 'Asia/Shanghai' })
function changed(fn: (wire: SourceContractV4) => void) {
  const envelope = JSON.parse(recorded.rawHttpText), wire = JSON.parse(envelope.output[0].content[0].text) as SourceContractV4
  fn(wire); envelope.output[0].content[0].text = JSON.stringify(wire); return JSON.stringify(envelope)
}

describe('independent event support metadata: existing facts only, ordinary product chain', () => {
  it('restores the actual pause and two endpoints without changing the recorded wire or evidence', async () => {
    const c = await context()
    expect(() => decodeSourceContractRecording(recorded.rawHttpText, 'Candidate19', c)).toThrow('SOURCE_CONTRACT_INFORMATION_ENTITY')
    const p = decodeProductSourceRecording(recorded.rawHttpText, 'Candidate19', c)
    expect(p.supportAccountingAudit?.inferredFacts).toBe(0)
    expect(p.supportAccountingAudit?.originalWire).toEqual(JSON.parse(JSON.parse(recorded.rawHttpText).output[0].content[0].text))
    expect(p.result.standaloneTasks).toHaveLength(0)
    expect(p.result.events).toHaveLength(1)
    expect(p.result.timePoints.map(t => [t.type, t.normalizedValue])).toEqual([['event_start', '2026-05-09T15:00'], ['event_end', '2026-05-11T08:30']])
    expect(new Set(p.supportAccountingAudit?.changes.map(x => x.reason))).toEqual(new Set(['INDEPENDENT_EVENT_CONTEXT', 'EVENT_TIME_CONTEXT', 'EVENT_TIME_LABEL_CONTEXT']))
    expect(p.result.timePoints.every(t => t.evidenceIds.every(id => id.includes(c.index.scopes[4].id)))).toBe(true)
  })
  it('accepts another object, dates, label and accounting order; changed source changes the values', async () => {
    const c = await context(), text = source.text.replaceAll('图书馆查收查引服务', '信息门户查询服务').replaceAll('暂停时间', '开放调整时间').replaceAll('2026年5月9日15:00', '2026年6月3日16:40').replaceAll('2026年5月11日8:30', '2026年6月5日9:10')
    const index = await indexImmutableScopesV11('anonymous-portal', 'anonymous-portal-v1', text)
    // This is an authored counterexample, not a same-source recording replay.
    expect(index.scopes).toHaveLength(c.index.scopes.length)
    let raw = recorded.rawHttpText
    for (const [i, scope] of c.index.scopes.entries()) raw = raw.replaceAll(scope.id, index.scopes[i].id)
    raw = raw.replaceAll('图书馆查收查引服务', '信息门户查询服务').replaceAll('2026年5月9日15:00', '2026年6月3日16:40').replaceAll('2026年5月11日8:30', '2026年6月5日9:10')
    const envelope = JSON.parse(raw), wire = JSON.parse(envelope.output[0].content[0].text) as SourceContractV4
    wire.scopeAccounting.reverse(); envelope.output[0].content[0].text = JSON.stringify(wire)
    const p = decodeProductSourceRecording(JSON.stringify(envelope), 'EngineeringFixture', { ...c, index })
    expect(p.result.events[0].title).toContain('信息门户查询服务')
    expect(p.result.timePoints.map(t => t.normalizedValue)).toEqual(['2026-06-03T16:40', '2026-06-05T09:10'])
  })
  it('rejects wrong IDs, missing primary, wrong type/value, foreign scope, false ownership and non-label context', async () => {
    const c = await context()
    const mutations: Array<(f: SourceContractV4) => void> = [
      f => { f.scopeAccounting[0].secondaryEntityIds = ['invented'] },
      f => { f.scopeAccounting[1].primaryEntityIds = [] },
      f => { f.timePoints[0].type = 'planned_start' },
      f => { f.timePoints[0].rawText = '2026年5月8日15:00' },
      f => { f.timePoints[0].scopeIds = ['foreign-source-scope'] },
      f => { f.events[0].relatedTaskTempIds = ['invented-task'] },
      f => { f.events[0].startTimePointTempId = 'time-0002' },
      f => { f.timePoints[0].relatedMaterialTempIds = ['invented-material'] },
      f => { f.scopeAccounting[0].secondaryEntityIds = ['time-0001'] },
      f => { f.events[0].scopeIds = [c.index.scopes[0].id, c.index.scopes[2].id] },
      f => { f.events = [] },
    ]
    for (const mutate of mutations) expect(() => decodeProductSourceRecording(changed(mutate), 'Candidate19', c)).toThrow()
    const foreign = await indexImmutableScopesV11('foreign', 'foreign-v1', source.text)
    expect(() => decodeProductSourceRecording(recorded.rawHttpText, 'Candidate19', { ...c, index: foreign })).toThrow()
  })
  it('does not invent an event or endpoints when the answer classified everything as information', async () => {
    const c = await context(), raw = changed(f => { f.events = []; f.timePoints = []; f.scopeAccounting.forEach(row => { row.kind = 'information'; row.primaryEntityIds = []; row.secondaryEntityIds = [] }) })
    const p = decodeProductSourceRecording(raw, 'Candidate19', c)
    expect(p.result.events).toHaveLength(0); expect(p.result.timePoints).toHaveLength(0)
  })
  it('commits through real capture and DomainCommitPlan, independently reads exact facts and retries idempotently', async () => {
    const c = await context(), store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace())
    const capture = new CapturePersistenceService(repo), handle = await capture.beginCapture({ operationId: crypto.randomUUID(), rawText: source.text, sourceType: 'text', title: source.title, provider: 'manual', modelName: 'Candidate19 recorded', promptVersion: 'recorded', pipelineVersion: 'source-support-accounting-projection-1.1.0' })
    const index = await indexImmutableScopesV11(handle.sourceId, handle.sourceVersionId, source.text), rebound = rebindRecordedScopes(recorded.rawHttpText, c.index, index)
    await capture.recognize(handle, async () => assembleCurrentFirstSuggestion(decodeProductSourceRecording(rebound.reboundHttpText, 'Candidate19', { ...c, index }).result, { sourceText: source.text, referenceTime: c.referenceTime, timezone: c.timezone }).result)
    const view = (await new IndexedDbWorkspaceRepository(repo).load())!, workspace = (await repo.load())!, draft = view.drafts.find(d => d.id === handle.draftId)!
    const plan = buildSourceReviewPlan(workspace, draft), receipt = await commitSourceReview(repo, plan)
    const w = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store), receipt)
    expect([w.tasks.length, w.projects.length, w.events.length, w.timePoints.length]).toEqual([0, 0, 1, 2])
    expect(w.timePoints.map(t => t.normalizedValue)).toEqual(['2026-05-09T15:00', '2026-05-11T08:30'])
    expect(w.events[0].startTimePointId).toBe(w.timePoints[0].id)
    expect(w.events[0].endTimePointId).toBe(w.timePoints[1].id)
    await commitSourceReview(repo, plan)
    expect((await repo.load())!.events).toHaveLength(1)
  })
})
