import { describe, it, expect } from 'vitest'
import { createAuthorityFixture } from '../experiments/candidate19Recorded/singleAuthorityFixtures'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { projectAuthoritySupportContext } from './authoritySupportContext'
import { decodeAuthorityProductRecording } from './singleAuthorityProduct'
import { decodeSingleAuthorityRecording } from './sourceContractV5'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { CapturePersistenceService } from '../domain/v2/capture'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback } from '../domain/v2/sourceReviewD26'

async function fixture(object = '返校登记') {
  const base = await createAuthorityFixture('deadline')
  const sourceText = `请于2026年11月16日17:00通过学院系统完成${object}（https://portal.example.edu/app/1），并确保填写的信息完整、准确。`
  const context = { ...base.context, index: await indexImmutableScopesV11('support-test', 'support-v1', sourceText) }
  const facts = structuredClone(base.facts), [action, url, completion] = context.index.scopes, t = facts.tasks[0]
  facts.tasks = [t]; facts.materials = []; facts.events = []; facts.revisions = []; facts.conflicts = []; facts.prerequisiteStates = []
  t.action = { surface: '完成', scopeId: action.id }; t.object = { surface: object, scopeId: action.id }
  t.propositionScopeIds = [action.id, url.id, completion.id]; t.detail.parentTempId = null; t.detail.hierarchyType = 'task'
  t.detail.title = `完成${object}`; t.detail.description = sourceText; t.detail.dependencyTempIds = []
  t.detail.completionCriteria = ['确保填写的信息完整、准确']; t.condition = { value: 'not_applicable', conditionScopeIds: [], factScopeIds: [] }
  t.coverage = { time: { status: 'present', absenceScopeIds: [] }, event: { status: 'not_stated', absenceScopeIds: [] }, material: { status: 'not_stated', absenceScopeIds: [] } }
  facts.timePoints = [{ tempId: 'deadline', type: 'task_deadline', rawText: '2026年11月16日17:00', scopeIds: [action.id], owners: [{ kind: 'task', entityId: t.id }], confidence: 1 }]
  facts.scopeAccounting = context.index.scopes.map(s => ({ scopeId: s.id, kind: s.id === action.id ? 'action' : 'information', primaryEntityIds: [t.id] }))
  const envelope = (f = facts) => { const e = JSON.parse(base.rawHttpText); e.output[0].content[0].text = JSON.stringify(f); return JSON.stringify(e) }
  return { facts, context, sourceText, envelope }
}

describe('existing authoritative task support uses the ordinary product path', () => {
  it.each(['返校登记', '设备借用登记'])('URL and completion support retain the existing %s without altering raw facts', async object => {
    const f = await fixture(object), before = structuredClone(f.facts), raw = f.envelope()
    expect(() => decodeSingleAuthorityRecording(raw, f.context)).toThrow('INFORMATION_ENTITY')
    const d = decodeAuthorityProductRecording(raw, f.context)
    expect(d.result.standaloneTasks).toHaveLength(1); expect(d.result.events).toHaveLength(0)
    expect(d.result.timePoints[0].normalizedValue).toBe('2026-11-16T17:00')
    expect(d.result.standaloneTasks[0].completionCriteria).toContain('确保填写的信息完整、准确')
    expect(f.facts).toEqual(before); expect(d.sidecar.originalResponse).toBe(raw)
    expect(d.sidecar.authoritySupportContextAudit.changes).toHaveLength(2)
  })
  it('fake owners, foreign scopes, another directive and missing primary facts remain errors', async () => {
    const f = await fixture(), fake = structuredClone(f.facts)
    fake.scopeAccounting[1].primaryEntityIds = ['fake']; expect(() => projectAuthoritySupportContext(fake, f.context)).toThrow('CONTEXT_REFERENCE')
    const foreign = structuredClone(f.facts); foreign.scopeAccounting[1].scopeId = 'foreign'; expect(() => projectAuthoritySupportContext(foreign, f.context)).toThrow('CONTEXT_REFERENCE')
    const primary = structuredClone(f.facts); primary.scopeAccounting[0].kind = 'information'; expect(() => projectAuthoritySupportContext(primary, f.context)).toThrow('CONTEXT_REFERENCE')
    const absent = structuredClone(f.facts); absent.timePoints = []; expect(() => decodeAuthorityProductRecording(f.envelope(absent), f.context)).toThrow('MISSING_PRESENT_FACT')
    const context = { ...f.context, index: await indexImmutableScopesV11('other', 'other-v1', f.sourceText) }
    expect(() => projectAuthoritySupportContext(f.facts, context)).toThrow('CONTEXT_REFERENCE')
  })
  it('does not erase an additional obligation even if copied into the task description', async () => {
    const f = await fixture(), sourceText = f.sourceText + '另需缴纳报名费。', index = await indexImmutableScopesV11('support-test', 'support-v1', sourceText)
    const extra = index.scopes.at(-1)!, t = f.facts.tasks[0]
    t.propositionScopeIds.push(extra.id); t.detail.description += extra.text
    f.facts.scopeAccounting.push({ scopeId: extra.id, kind: 'information', primaryEntityIds: [t.id] })
    expect(() => projectAuthoritySupportContext(f.facts, { ...f.context, index })).toThrow('CONTEXT_REFERENCE')
  })
  it('formally confirms and independently reads the real converted task, time and criteria', async () => {
    const f = await fixture(), d = decodeAuthorityProductRecording(f.envelope(), f.context)
    const store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store); await repo.initialize(emptyWorkspace())
    const capture = new CapturePersistenceService(repo), h = await capture.beginCapture({ operationId: crypto.randomUUID(), sourceType: 'text', title: '匿名登记通知', rawText: f.sourceText, provider: 'manual', modelName: 'ENGINEERING_FIXTURE', promptVersion: 'test', pipelineVersion: 'support-context-1' })
    await capture.recognize(h, async () => d.result)
    const view = (await new IndexedDbWorkspaceRepository(repo).load())!, receipt = await commitSourceReview(repo, buildSourceReviewPlan((await repo.load())!, view.drafts[0]))
    const read = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store), receipt)
    expect(read.tasks).toHaveLength(1); expect(read.timePoints[0].normalizedValue).toBe('2026-11-16T17:00')
    expect(read.tasks[0].legacyData?.completionCriteria).toContain('确保填写的信息完整、准确')
  })
})
