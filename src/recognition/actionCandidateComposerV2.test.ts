import { describe, expect, it } from 'vitest'
import {
  ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
  type ActionCandidateClassificationResponse,
} from './actionCandidateClassificationContract'
import {
  composeActionCandidatesV2,
  deriveRequiresActionWithCoverageV2,
} from './actionCandidateComposerV2'
import { indexLocalActionCandidatesV2 } from './localActionCandidateIndexV2'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { formLocalTaskSuggestionsP4 } from './taskFormationPolicyP4'

async function fixture(sourceText: string) {
  const index = await indexImmutableScopesV11('composer-source', 'source-v1', sourceText)
  const catalog = await indexLocalActionCandidatesV2(index)
  const response: ActionCandidateClassificationResponse = {
    schemaVersion: ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
    sourceId: catalog.sourceId,
    sourceVersionId: catalog.sourceVersionId,
    sourceFingerprint: catalog.sourceFingerprint,
    catalogFingerprint: catalog.catalogFingerprint,
    producerRunId: 'composer-run',
    classifications: catalog.candidates.map((candidate) => ({
      candidateId: candidate.id,
      verdict: 'proposition',
      objectCandidateId: candidate.defaultObjectCandidateId,
    })),
  }
  return { index, catalog, response }
}

describe('candidate-level local composer v2 and quarantine', () => {
  it('does not let the model delete local propositions or promote local non-tasks', async () => {
    const { index, catalog, response } = await fixture('请保存甲表。页面按钮名为“上传附件”，仅用于说明界面。')
    response.classifications[0] = { candidateId: catalog.candidates[0].id, verdict: 'mention_only', objectCandidateId: null }
    const result = await composeActionCandidatesV2(index, catalog, response, 'composer-run')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.ledger.map((entry) => entry.status)).toEqual(['accepted_local', 'ignored_local'])
    expect(result.value.reduced.directives.map((item) => item.actionSurfaceHint.surface)).toEqual(['保存'])
    const formed = formLocalTaskSuggestionsP4(index, result.value.reduced)
    expect(formed.tasks).toHaveLength(1)
    expect(formed.tasks[0]).toMatchObject({ action: { surface: '保存' }, object: { surface: '甲表' }, selected: true })
  })

  it('quarantines only a broken needs-model candidate and preserves sibling output byte-for-byte', async () => {
    const { index, catalog, response } = await fixture('保存甲表。核对乙表。')
    const baseline = await composeActionCandidatesV2(index, catalog, response, 'composer-run')
    expect(baseline.ok).toBe(true)
    if (!baseline.ok) return
    const missing = structuredClone(response)
    missing.classifications.splice(0, 1)
    const partial = await composeActionCandidatesV2(index, catalog, missing, 'composer-run')
    expect(partial.ok).toBe(true)
    if (!partial.ok) return
    expect(partial.value.status).toBe('partial')
    expect(partial.value.ledger.map((entry) => entry.status)).toEqual(['quarantined', 'accepted_model'])
    expect(partial.value.reduced.directives).toEqual([baseline.value.reduced.directives[1]])
    expect(partial.value.diagnostics.quarantined).toBe(1)
  })

  it('blocks cross-candidate object borrowing without collateral loss', async () => {
    const { index, catalog, response } = await fixture('保存甲表。核对乙表。')
    response.classifications[0].objectCandidateId = catalog.candidates[1].defaultObjectCandidateId
    const result = await composeActionCandidatesV2(index, catalog, response, 'composer-run')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.ledger.map((entry) => entry.status)).toEqual(['quarantined', 'accepted_model'])
    expect(result.value.reduced.directives.map((item) => item.objectSurfaceHint.surface)).toEqual(['乙表'])
  })

  it('keeps unknown injected IDs out while all known siblings survive', async () => {
    const { index, catalog, response } = await fixture('保存甲表。核对乙表。')
    response.classifications.push({ candidateId: 'action:unknown', verdict: 'proposition', objectCandidateId: catalog.candidates[0].defaultObjectCandidateId })
    const result = await composeActionCandidatesV2(index, catalog, response, 'composer-run')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.responseContractComplete).toBe(false)
    expect(result.value.semanticCoverageComplete).toBe(false)
    expect(result.value.status).toBe('partial')
    expect(result.value.reduced.directives).toHaveLength(2)
    expect(result.value.diagnostics.unknownResponseCandidateIds).toEqual(['action:unknown'])
  })

  it('reports unknown requiresAction when unresolved coverage remains', async () => {
    const ambiguous = await fixture('保存甲表。核对乙表。')
    ambiguous.response.classifications = ambiguous.response.classifications.map((item) => ({
      candidateId: item.candidateId,
      verdict: 'uncertain',
      objectCandidateId: null,
    }))
    const partial = await composeActionCandidatesV2(ambiguous.index, ambiguous.catalog, ambiguous.response, 'composer-run')
    expect(partial.ok).toBe(true)
    if (!partial.ok) return
    const partialFormation = formLocalTaskSuggestionsP4(ambiguous.index, partial.value.reduced)
    expect(deriveRequiresActionWithCoverageV2(partialFormation.requiresAction, partial.value)).toBeNull()

    const nonTask = await fixture('保存甲表。核对乙表。')
    nonTask.response.classifications = nonTask.response.classifications.map((item) => ({
      candidateId: item.candidateId,
      verdict: 'mention_only',
      objectCandidateId: null,
    }))
    const complete = await composeActionCandidatesV2(nonTask.index, nonTask.catalog, nonTask.response, 'composer-run')
    expect(complete.ok).toBe(true)
    if (!complete.ok) return
    const completeFormation = formLocalTaskSuggestionsP4(nonTask.index, complete.value.reduced)
    expect(deriveRequiresActionWithCoverageV2(completeFormation.requiresAction, complete.value)).toBe(false)

    const unknownAction = await fixture('请领取纪念品。')
    const unknownComposition = await composeActionCandidatesV2(unknownAction.index, unknownAction.catalog, unknownAction.response, 'composer-run')
    expect(unknownComposition.ok).toBe(true)
    if (!unknownComposition.ok) return
    expect(unknownComposition.value.diagnostics.unresolvedActionScopeIds).toEqual([unknownAction.index.scopes[0].id])
    expect(deriveRequiresActionWithCoverageV2(false, unknownComposition.value)).toBeNull()
  })

  it('keeps revision signals out of the action lane and lets P4 resolve the relation locally', async () => {
    const { index, catalog, response } = await fixture('先前安排要求联系校车司机。该安排停止执行。请保存归档副本。')
    expect(catalog.candidates.map((item) => item.action.surface)).toEqual(['联系', '保存'])
    const result = await composeActionCandidatesV2(index, catalog, response, 'composer-run')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const formed = formLocalTaskSuggestionsP4(index, result.value.reduced)
    expect(formed.tasks.map((item) => item.action.surface)).toEqual(['联系', '保存'])
    expect(formed.revisionRelations.map((item) => item.kind)).toEqual(['cancels'])
    expect(formed.tasks.find((item) => item.action.surface === '联系')).toMatchObject({
      semantics: { status: 'cancelled', validity: 'superseded' },
      selected: false,
    })
  })

  it('globally rejects a mismatched source binding or mutated local catalog', async () => {
    const { index, catalog, response } = await fixture('保存甲表。核对乙表。')
    const rebound = structuredClone(response)
    rebound.sourceFingerprint = 'sha256:replayed'
    expect((await composeActionCandidatesV2(index, catalog, rebound, 'composer-run')).ok).toBe(false)
    const tamperedCatalog = structuredClone(catalog)
    tamperedCatalog.candidates[0].action.surface = '核对'
    expect((await composeActionCandidatesV2(index, tamperedCatalog, response, 'composer-run')).ok).toBe(false)
  })
})
