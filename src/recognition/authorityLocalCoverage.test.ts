import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { decodeAuthorityProductRecording } from './singleAuthorityProduct'
import { decodeObligationProductRecording } from './sourceContractV6'
import { createObligationFixture, obligationEnvelope } from '../experiments/candidate19Recorded/obligationFixtures'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { CapturePersistenceService } from '../domain/v2/capture'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { buildDomainCommitPlanV2 } from '../domain/v2/domainCommit'
import { commitSourceReview, verifySourceReviewReadback } from '../domain/v2/sourceReviewD26'

describe('versioned partial display without invented facts or relaxed original scoring', () => {
  it('keeps a genuinely missing association blocked while retaining existing event and times', async () => {
    const f = await createObligationFixture('registration'), original = structuredClone(f.facts)
    original.tasks[0].eventLinks = []
    const raw = obligationEnvelope(original)
    expect(() => decodeObligationProductRecording(raw, f.context)).toThrow('MISSING_PRESENT_FACT')
    const d = decodeObligationProductRecording(raw, f.context, 'EngineeringFixture', true)
    expect(d.result.events).toHaveLength(1); expect(d.result.timePoints).toHaveLength(3)
    expect(d.result.events[0].relatedTaskTempIds ?? []).toEqual([])
    expect(d.result.standaloneTasks[0].selected).toBe(false)
    expect(d.result.conflicts.some(c => c.entityTempIds.includes('T1') && c.requiresDecision)).toBe(true)
    expect(d.sidecar.singleAuthorityAudit.localCoverage.missingCoverage).toContainEqual(expect.objectContaining({ taskId: 'T1', category: 'event', code: 'MISSING_PRESENT_FACT' }))
    expect(d.sidecar.originalResponse).toBe(raw); expect(original.tasks[0].coverage.event.status).toBe('present')
    const store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace()); const capture = new CapturePersistenceService(repo)
    const h = await capture.beginCapture({ operationId: crypto.randomUUID(), sourceType: 'text', title: '局部风险', rawText: f.sourceText, provider: 'manual', modelName: 'ENGINEERING_FIXTURE', promptVersion: 'local-coverage-1', pipelineVersion: 'local-coverage-1' })
    await capture.recognize(h, async () => d.result)
    const w = (await repo.load())!, plan = buildDomainCommitPlanV2(w, h.draftId, { taskTempIds: [], eventTempIds: ['E1'], timePointTempIds: ['P1', 'P2'], materialTempIds: [] })
    const receipt = await commitSourceReview(repo, plan), readback = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store), receipt)
    expect(readback.tasks).toHaveLength(0); expect(readback.events).toHaveLength(1)
  })
  it('preserves strict rejection of fake owners, malformed shapes and contradictory absence', async () => {
    const f = await createObligationFixture('registration')
    const fake = structuredClone(f.facts); fake.timePoints[0].owners[0].entityId = 'fake'
    expect(() => decodeObligationProductRecording(obligationEnvelope(fake), f.context, 'EngineeringFixture', true)).toThrow('TASK_OWNER')
    const contradictory = structuredClone(f.facts); contradictory.tasks[0].eventLinks = []; contradictory.tasks[0].coverage.event.absenceScopeIds = f.facts.tasks[0].propositionScopeIds
    expect(() => decodeObligationProductRecording(obligationEnvelope(contradictory), f.context, 'EngineeringFixture', true)).toThrow('MISSING_PRESENT_FACT')
    const bad = structuredClone(f.facts); Object.assign(bad, { extra: 'not allowed' })
    expect(() => decodeObligationProductRecording(obligationEnvelope(bad), f.context, 'EngineeringFixture', true)).toThrow('SHAPE')
  })
  it('unaffected tasks remain selectable and a missing shared window is never copied from another owner', async () => {
    const f = await createObligationFixture('shared-window')
    f.facts.timePoints.forEach(p => { p.owners = p.owners.filter(o => o.entityId !== 'T2') })
    const d = decodeObligationProductRecording(obligationEnvelope(f.facts), f.context, 'EngineeringFixture', true)
    expect(d.result.standaloneTasks.find(t => t.tempId === 'T1')?.selected).toBe(true)
    expect(d.result.standaloneTasks.find(t => t.tempId === 'T2')?.selected).toBe(false)
    expect(d.result.timePoints.every(p => !p.relatedTaskTempIds.includes('T2'))).toBe(true)
  })
  it('the four actual V5 wire copies retain facts rather than turning all declarations unknown', async () => {
    const artifact = JSON.parse(readFileSync('docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic/current-mechanism-followup/v5-diagnostic/paid-evidence/MODEL_FACTS.json', 'utf8'))
    for (const row of artifact.cases) {
      const context = { index: await indexImmutableScopesV11(row.sourceId, row.sourceId + '-v1', row.sourceText), referenceTime: row.referenceTime, timezone: row.timezone }
      const d = decodeAuthorityProductRecording(JSON.stringify({ model: 'deepseek-flash', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(row.wire) }] }], usage: { input_tokens: 0, output_tokens: 0 } }), context, 'SingleAuthority', true)
      expect(d.result.events.length).toBe(row.wire.events.length)
      expect(d.result.standaloneTasks.length).toBe(row.wire.tasks.length)
      expect(d.sidecar.singleAuthorityAudit.inferredFacts).toBe(0)
      expect(d.sidecar.singleAuthorityAudit.original.tasks).toEqual(row.wire.tasks)
    }
  })
})
