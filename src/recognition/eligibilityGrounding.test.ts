import { describe, it, expect } from 'vitest'
import { ELIGIBILITY_CASES, createEligibilityFixture } from '../experiments/candidate19Recorded/eligibilityFixtures'
import { decodeCurrentSourceRecording } from './conditionalNonActionProduct'
import { assembleCurrentFirstSuggestion } from './materialChannelGrounding'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { rebindRecordedScopes } from './recordedProjectionD26'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { CapturePersistenceService } from '../domain/v2/capture'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { buildSourceReviewPlan, commitSourceReview, sourceReviewProblem, verifySourceReviewReadback } from '../domain/v2/sourceReviewD26'

type Fixture = Awaited<ReturnType<typeof createEligibilityFixture>>
function http(f: Fixture) { const envelope = JSON.parse(f.rawHttpText); envelope.output[0].content[0].text = JSON.stringify(f.facts); return JSON.stringify(envelope) }
function first(f: Fixture) {
  const d = decodeCurrentSourceRecording(http(f), 'EngineeringFixture', f.context)
  return { d, p: assembleCurrentFirstSuggestion(d.result, { sourceText: f.sourceText, referenceTime: f.context.referenceTime, timezone: f.context.timezone }) }
}
async function append(f: Fixture, clause: string) {
  f.sourceText += clause
  const index = await indexImmutableScopesV11(f.context.index.sourceId, f.context.index.sourceVersionId, f.sourceText)
  let serialized = JSON.stringify(f.facts)
  for (const old of f.context.index.scopes) {
    const rebound = index.scopes.find(s => s.order === old.order && s.text === old.text)!
    serialized = serialized.replaceAll(old.id, rebound.id)
  }
  f.facts = JSON.parse(serialized)
  f.context.index = index
  const scope = index.scopes.at(-1)!
  f.facts.scopeAccounting.push({ scopeId: scope.id, kind: 'information', primaryEntityIds: [], secondaryEntityIds: [] })
  return scope
}

describe('already-true eligibility requires a matching source proof, not manual re-entry', () => {
  it.each(ELIGIBILITY_CASES)('$id uses real wire, source evidence, current first suggestion, atomic commit and independent readback', async row => {
    const f = await createEligibilityFixture(row.id), before = structuredClone(f.facts), { d, p } = first(f)
    expect(f.facts).toEqual(before)
    expect(d.sidecar.firstSemantic.tasks[0].condition).toEqual(before.tasks[0].condition)
    expect(d.sidecar.eligibilityAudit.decisions[0].status).toBe(row.expected)
    expect(p.result.standaloneTasks[0].selected).toBe(row.expected === 'SOURCE_PROVEN_TRUE')
    expect(Boolean(sourceReviewProblem(p.result, 'T1'))).toBe(row.expected !== 'SOURCE_PROVEN_TRUE')
    const reordered = await createEligibilityFixture(row.id, true), again = first(reordered)
    expect(again.d.sidecar.eligibilityAudit.decisions[0].status).toBe(row.expected)
    expect(again.p.result.timePoints.map(t => [t.type, t.rawText, t.normalizedValue])).toEqual(p.result.timePoints.map(t => [t.type, t.rawText, t.normalizedValue]))
    const store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace())
    const capture = new CapturePersistenceService(repo), h = await capture.beginCapture({ operationId: crypto.randomUUID(), rawText: f.sourceText, sourceType: 'text', title: '匿名资格依据', provider: 'manual', modelName: '匿名工程夹具', promptVersion: 'NOT_MODEL_OUTPUT', pipelineVersion: 'source-proven-eligibility-1.0.0' })
    const context = { ...f.context, index: await indexImmutableScopesV11(h.sourceId, h.sourceVersionId, f.sourceText) }
    const decoded = decodeCurrentSourceRecording(rebindRecordedScopes(http(f), f.context.index, context.index).reboundHttpText, 'EngineeringFixture', context)
    await capture.recognize(h, async () => assembleCurrentFirstSuggestion(decoded.result, { sourceText: f.sourceText, referenceTime: context.referenceTime, timezone: context.timezone }).result)
    // Same existing draft sidecar slot used by App, not a second persistence chain.
    await repo.transaction(w => ({ ...w, extractionDrafts: w.extractionDrafts.map(draft => draft.id === h.draftId ? { ...draft, legacyData: { ...draft.legacyData, semanticSidecar: JSON.parse(JSON.stringify(decoded.sidecar)) } } : draft) }))
    const w = (await repo.load())!, view = (await new IndexedDbWorkspaceRepository(repo).load())!.drafts.find(t => t.id === h.draftId)!
    const plan = buildSourceReviewPlan(w, view), receipt = await commitSourceReview(repo, plan), back = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store), receipt)
    expect(back.tasks).toHaveLength(row.expected === 'SOURCE_PROVEN_TRUE' ? 1 : 0)
    expect(back.materials).toHaveLength(row.expected === 'SOURCE_PROVEN_TRUE' ? 1 : 0)
    expect(back.events).toHaveLength(2); expect(back.projects).toHaveLength(0)
    expect(back.timePoints).toHaveLength(row.expected === 'SOURCE_PROVEN_TRUE' ? 5 : 4)
    expect(receipt.disposition).toBe(row.expected === 'SOURCE_PROVEN_TRUE' ? 'confirmed' : 'partial')
    expect(back.extractionDrafts[0].legacyData?.semanticSidecar).toEqual(JSON.parse(JSON.stringify(decoded.sidecar)))
    await commitSourceReview(repo, plan)
    expect((await repo.load())!.tasks).toHaveLength(back.tasks.length)
  })
  it.each(['no-proof', 'foreign-object', 'other-person', 'not-current', 'unknown-with-positive-proof', 'false-with-positive-proof'] as const)('does not promote %s to known eligibility', async variant => {
    const f = await createEligibilityFixture('approved-application'), t = f.facts.tasks[0]
    if (variant === 'no-proof') { t.condition.factScopeIds = []; expect(() => first(f)).toThrow('CONDITION_PROOF_REQUIRED'); return }
    if (variant === 'foreign-object') t.condition.conditionScopeIds = [f.context.index.scopes.find(s => s.text.includes('器材讲解会'))!.id]
    if (variant === 'other-person') { const scope = await append(f, '隔壁社团已获准。'); f.facts.tasks[0].condition.factScopeIds = [scope.id] }
    if (variant === 'not-current') t.semantics.status = 'cancelled'
    if (variant === 'unknown-with-positive-proof') t.condition.value = 'unknown'
    if (variant === 'false-with-positive-proof') t.condition.value = 'false'
    const { d, p } = first(f)
    expect(d.sidecar.eligibilityAudit.decisions[0].status).toBe('RETAIN_REVIEW')
    expect(sourceReviewProblem(p.result, 'T1')).toBeTruthy()
    expect(p.result.events.every(e => e.selected)).toBe(true)
  })
  it.each(['你的社团尚未获准。', '你的社团的获准资格已撤销。'])('does not ignore an uncited contradictory fact: %s', async clause => {
    const f = await createEligibilityFixture('approved-application'), scope = await append(f, clause), { d, p } = first(f)
    expect(d.sidecar.eligibilityAudit.decisions[0].contradictoryScopeIds).toContain(scope.id)
    expect(sourceReviewProblem(p.result, 'T1')).toBeTruthy()
  })
  it('approval for a different community is not a contradiction about the addressee', async () => {
    const f = await createEligibilityFixture('approved-application'); await append(f, '隔壁社团尚未获准。')
    expect(first(f).d.sidecar.eligibilityAudit.decisions[0].status).toBe('SOURCE_PROVEN_TRUE')
  })
  it('qualified eligibility never completes a prerequisite or deletes a waiting obligation', async () => {
    const f = await createEligibilityFixture('approved-application'), scope = await append(f, '先填写场地申请。')
    const predecessor = structuredClone(f.facts.tasks[0])
    predecessor.id = 'T0'; predecessor.propositionScopeIds = [scope.id]
    predecessor.action = { surface: '填写', scopeId: scope.id }; predecessor.object.scopeId = scope.id
    predecessor.condition = { value: 'not_applicable', conditionScopeIds: [], factScopeIds: [] }
    predecessor.detail.title = '填写场地申请'; predecessor.detail.completionCriteria = []
    predecessor.coverage = { time: { status: 'not_stated', entityIds: [], scopeIds: [] }, material: { status: 'not_stated', entityIds: [], scopeIds: [] }, event: { status: 'not_stated', entityIds: [], scopeIds: [] } }
    f.facts.tasks[0].detail.dependencyTempIds = ['T0']; f.facts.tasks.push(predecessor)
    f.facts.prerequisiteStates.push({ taskId: 'T1', predecessorId: 'T0', completion: 'unknown', factScopeIds: [] })
    const accounting = f.facts.scopeAccounting.find(s => s.scopeId === scope.id)!
    accounting.kind = 'action'; accounting.primaryEntityIds = ['T0']
    const { d, p } = first(f)
    expect(p.result.standaloneTasks.find(t => t.tempId === 'T1')?.dependencyTempIds).toEqual(['T0'])
    if (!('conversion' in d) || !d.conversion || !('prerequisiteStates' in d.conversion)) throw Error('CONVERSION_AUDIT_REQUIRED')
    expect(d.conversion.prerequisiteStates[0].completion).toBe('unknown')
    expect(d.sidecar.firstSemantic.tasks.find(t => t.id === 'T0')?.semantics.status).toBe('pending')
    expect(p.result.standaloneTasks).toHaveLength(2)
    expect(sourceReviewProblem(p.result, 'T1')).toBeUndefined()
  })
})
