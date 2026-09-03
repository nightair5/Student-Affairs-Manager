import { describe, expect, it } from 'vitest'
import {
  SCOPE_REFERENCE_SCHEMA_VERSION,
  SCOPE_REFERENCE_VERIFICATION_VERSION,
  composeScopeReferenceCandidate,
  indexImmutableScopes,
  scopeReferenceCandidateFingerprint,
  validateScopeReferenceCandidate,
  type ImmutableScopeIndex,
  type ScopeReferenceCandidate,
  type ScopeReferenceVerification,
} from './scopeReferenceContract'

function clone<T>(value: T): T {
  return structuredClone(value)
}

async function buildBoundPair(content = '请在周三核对申请表，并携带学生证。背景说明仅供参考。'): Promise<{
  index: ImmutableScopeIndex
  candidate: ScopeReferenceCandidate
  verification: ScopeReferenceVerification
}> {
  const index = await indexImmutableScopes('metamorphic-source', 'v1', content)
  const [directiveScope, materialScope, ignoredScope] = index.scopes
  const candidate: ScopeReferenceCandidate = {
    schemaVersion: SCOPE_REFERENCE_SCHEMA_VERSION,
    sourceId: index.sourceId,
    sourceVersionId: index.sourceVersionId,
    sourceFingerprint: index.sourceFingerprint,
    producerRunId: 'metamorphic-producer',
    requiresAction: true,
    directives: [{
      id: 'directive-1',
      propositionScopeIds: [directiveScope.id, materialScope.id],
      semantics: {
        actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future',
        status: 'pending', validity: 'active', modality: 'required',
      },
      inferenceLevel: 'explicit',
      actionType: 'review',
      action: { scopeId: directiveScope.id, surface: '核对' },
      object: { scopeId: directiveScope.id, surface: '申请表' },
      effect: 'local_change',
      timeRefs: [{ scopeId: directiveScope.id, surface: '周三', type: 'task_deadline' }],
      materialRefs: [{ scopeId: materialScope.id, surface: '学生证', required: true }],
      eventRef: null,
      locationRef: null,
      revisionRefs: [],
    }],
    observations: [],
    ignoredScopeIds: [ignoredScope.id],
  }
  const verification: ScopeReferenceVerification = {
    schemaVersion: SCOPE_REFERENCE_VERIFICATION_VERSION,
    method: 'contract_fixture_oracle',
    verifierRunId: 'metamorphic-verifier',
    sourceId: index.sourceId,
    sourceVersionId: index.sourceVersionId,
    sourceFingerprint: index.sourceFingerprint,
    candidateFingerprint: await scopeReferenceCandidateFingerprint(candidate),
    graphCoverage: 'complete',
    revisionCoverage: 'complete',
    consideredScopeIds: index.scopes.map((scope) => scope.id),
    assessments: [{
      directiveId: 'directive-1', verdict: 'entailed', semantics: clone(candidate.directives[0].semantics),
      inferenceLevel: 'explicit', actionType: 'review', effect: 'local_change',
      evidenceScopeIds: [directiveScope.id, materialScope.id],
    }],
    observationAssessments: [],
    missingDirectiveScopeIds: [],
  }
  return { index, candidate, verification }
}

function codes(value: { issues: Array<{ code: string }> }): string[] {
  return value.issues.map((issue) => issue.code)
}

describe('RCO-5-006 property and metamorphic contract checks', () => {
  it('rebuilds byte-identical source scopes deterministically', async () => {
    const content = '请在周三核对申请表，并携带学生证。背景说明仅供参考。'
    const first = await indexImmutableScopes('metamorphic-source', 'v1', content)
    const second = await indexImmutableScopes('metamorphic-source', 'v1', content)
    expect(second).toEqual(first)
  })

  it.each([
    ' 请在周三核对申请表，并携带学生证。背景说明仅供参考。',
    '请在周三核对申请表；并携带学生证。背景说明仅供参考。',
    '请在周三核对申请表，并携带学生证。\n背景说明仅供参考。',
    '请在周三核对申请表，并携带学生证。背景说明仅供参考。 ',
  ])('invalidates an old candidate after any source-byte mutation: %s', async (changedContent) => {
    const original = await buildBoundPair()
    const changedIndex = await indexImmutableScopes(original.index.sourceId, original.index.sourceVersionId, changedContent)
    expect(changedIndex.sourceFingerprint).not.toBe(original.index.sourceFingerprint)
    expect(codes(validateScopeReferenceCandidate(original.candidate, changedIndex))).toContain('SOURCE_BINDING_MISMATCH')
  })

  it('rejects reordered proposition and ignored scope references', async () => {
    const { index, candidate } = await buildBoundPair()
    const propositionReordered = clone(candidate)
    propositionReordered.directives[0].propositionScopeIds.reverse()
    expect(codes(validateScopeReferenceCandidate(propositionReordered, index))).toContain('PROPOSITION_SCOPE_ORDER_INVALID')

    const ignoredReordered = clone(candidate)
    ignoredReordered.ignoredScopeIds = [index.scopes[2].id, index.scopes[0].id]
    expect(codes(validateScopeReferenceCandidate(ignoredReordered, index))).toEqual(expect.arrayContaining([
      'SCOPE_BOTH_REFERENCED_AND_IGNORED',
    ]))
  })

  it('derives every span and evidence quote from the exact local source', async () => {
    const { index, candidate, verification } = await buildBoundPair()
    const result = await composeScopeReferenceCandidate(index, candidate, verification, { allowContractFixtureOracle: true })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const [suggestion] = result.value.suggestions
    const spans = [suggestion.actionSpan, suggestion.objectSpan, ...suggestion.timeRefs.map((item) => item.span), ...suggestion.materialRefs.map((item) => item.span)]
    for (const span of spans) {
      expect(index.sourceContent.slice(span.start, span.end)).toBe(span.surface)
    }
    for (const evidence of suggestion.evidence) {
      expect(index.sourceContent.slice(evidence.start, evidence.end)).toBe(evidence.quote)
    }
  })

  it('keeps candidate fingerprint stable under object-key insertion order only', async () => {
    const { candidate } = await buildBoundPair()
    const reordered = {
      ignoredScopeIds: candidate.ignoredScopeIds,
      directives: candidate.directives,
      observations: candidate.observations,
      requiresAction: candidate.requiresAction,
      producerRunId: candidate.producerRunId,
      sourceFingerprint: candidate.sourceFingerprint,
      sourceVersionId: candidate.sourceVersionId,
      sourceId: candidate.sourceId,
      schemaVersion: candidate.schemaVersion,
    } as ScopeReferenceCandidate
    expect(await scopeReferenceCandidateFingerprint(reordered)).toBe(await scopeReferenceCandidateFingerprint(candidate))
  })

  it('handles surrogate-pair characters without inventing offsets', async () => {
    const content = '请核对𠮷同学的报名表。'
    const index = await indexImmutableScopes('unicode-source', 'v1', content)
    expect(index.scopes).toHaveLength(1)
    expect(content.slice(index.scopes[0].start, index.scopes[0].end)).toBe(index.scopes[0].text)
    expect(index.scopes[0].end).toBe(content.length)
  })
})
