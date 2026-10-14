import { describe, expect, it } from 'vitest'
import {
  SCOPE_REFERENCE_SCHEMA_VERSION,
  SCOPE_REFERENCE_VERIFICATION_VERSION,
  composeScopeReferenceCandidate,
  indexImmutableScopes,
  scopeReferenceCandidateFingerprint,
  validateScopeReferenceCandidate,
  validateScopeReferenceVerification,
  type ImmutableScopeIndex,
  type ScopeReferenceCandidate,
  type ScopeReferenceVerification,
} from './scopeReferenceContract'

function clone<T>(value: T): T {
  return structuredClone(value)
}

async function adversarialFixture(): Promise<{
  index: ImmutableScopeIndex
  candidate: ScopeReferenceCandidate
  verification: ScopeReferenceVerification
}> {
  const content = '院系已经完成名单汇总。你不需要发送邮件。请在明早检查回执单。地点调整为教学楼二层。'
  const index = await indexImmutableScopes('fresh-redteam-source', 'v3', content)
  const [thirdParty, negative, directive, location] = index.scopes
  const candidate: ScopeReferenceCandidate = {
    schemaVersion: SCOPE_REFERENCE_SCHEMA_VERSION,
    sourceId: index.sourceId,
    sourceVersionId: index.sourceVersionId,
    sourceFingerprint: index.sourceFingerprint,
    producerRunId: 'fresh-producer',
    requiresAction: true,
    directives: [{
      id: 'check-receipt',
      propositionScopeIds: [directive.id, location.id],
      semantics: {
        actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future',
        status: 'pending', validity: 'active', modality: 'required',
      },
      inferenceLevel: 'explicit',
      actionType: 'review',
      action: { scopeId: directive.id, surface: '检查' },
      object: { scopeId: directive.id, surface: '回执单' },
      effect: 'local_change',
      timeRefs: [{ scopeId: directive.id, surface: '明早', type: 'task_deadline' }],
      materialRefs: [],
      eventRef: null,
      locationRef: { scopeId: location.id, surface: '教学楼二层' },
      revisionRefs: [],
    }],
    observations: [],
    ignoredScopeIds: [thirdParty.id, negative.id],
  }
  const verification: ScopeReferenceVerification = {
    schemaVersion: SCOPE_REFERENCE_VERIFICATION_VERSION,
    method: 'contract_fixture_oracle',
    verifierRunId: 'fresh-verifier',
    sourceId: index.sourceId,
    sourceVersionId: index.sourceVersionId,
    sourceFingerprint: index.sourceFingerprint,
    candidateFingerprint: await scopeReferenceCandidateFingerprint(candidate),
    graphCoverage: 'complete',
    revisionCoverage: 'complete',
    consideredScopeIds: index.scopes.map((scope) => scope.id),
    assessments: [{
      directiveId: 'check-receipt', verdict: 'entailed', semantics: clone(candidate.directives[0].semantics),
      inferenceLevel: 'explicit', actionType: 'review', effect: 'local_change',
      evidenceScopeIds: [directive.id, location.id],
    }],
    observationAssessments: [],
    missingDirectiveScopeIds: [],
  }
  return { index, candidate, verification }
}

function codes(value: { issues: Array<{ code: string }> }): string[] {
  return value.issues.map((issue) => issue.code)
}

describe('RCO-5-006 fresh adversarial review', () => {
  it.each(['selected', 'start', 'end', 'quote', 'text', 'evidence'])('rejects forbidden model field even when nested: %s', async (field) => {
    const { index, candidate } = await adversarialFixture()
    const attacked = clone(candidate) as unknown as Record<string, unknown>
    const directives = attacked.directives as Array<Record<string, unknown>>
    const action = directives[0].action as Record<string, unknown>
    action[field] = field === 'selected' ? true : field === 'start' || field === 'end' ? 1 : '伪造内容'
    const report = validateScopeReferenceCandidate(attacked, index)
    expect(report.valid).toBe(false)
    expect(codes(report)).toEqual(expect.arrayContaining(['MODEL_FORBIDDEN_FIELD', 'UNKNOWN_FIELD']))
  })

  it('rejects a directive that borrows location from an ignored proposition', async () => {
    const { index, candidate } = await adversarialFixture()
    const attacked = clone(candidate)
    attacked.directives[0].propositionScopeIds = [index.scopes[2].id]
    attacked.ignoredScopeIds = [index.scopes[0].id, index.scopes[1].id, index.scopes[3].id]
    const report = validateScopeReferenceCandidate(attacked, index)
    expect(codes(report)).toContain('FIELD_OUTSIDE_PROPOSITION_SCOPE')
  })

  it('rejects an unaccounted injected instruction instead of silently accepting partial coverage', async () => {
    const original = await adversarialFixture()
    const changed = await indexImmutableScopes(original.index.sourceId, 'v4', `${original.index.sourceContent}另请上传身份证照片。`)
    const replay = clone(original.candidate)
    replay.sourceVersionId = changed.sourceVersionId
    replay.sourceFingerprint = changed.sourceFingerprint
    const remap = new Map(original.index.scopes.map((scope, index) => [scope.id, changed.scopes[index].id]))
    replay.directives[0].propositionScopeIds = replay.directives[0].propositionScopeIds.map((id) => remap.get(id) ?? id)
    replay.directives[0].action.scopeId = remap.get(replay.directives[0].action.scopeId) ?? replay.directives[0].action.scopeId
    replay.directives[0].object.scopeId = remap.get(replay.directives[0].object.scopeId) ?? replay.directives[0].object.scopeId
    replay.directives[0].timeRefs[0].scopeId = remap.get(replay.directives[0].timeRefs[0].scopeId) ?? replay.directives[0].timeRefs[0].scopeId
    if (replay.directives[0].locationRef) replay.directives[0].locationRef.scopeId = remap.get(replay.directives[0].locationRef.scopeId) ?? replay.directives[0].locationRef.scopeId
    replay.ignoredScopeIds = replay.ignoredScopeIds.map((id) => remap.get(id) ?? id)
    expect(codes(validateScopeReferenceCandidate(replay, changed))).toContain('SOURCE_SCOPE_UNACCOUNTED')
  })

  it('rejects model-authored relation objects, including plausible-looking ones', async () => {
    const { index, candidate } = await adversarialFixture()
    const attacked = clone(candidate) as ScopeReferenceCandidate & { relations?: unknown[] }
    attacked.relations = [{ type: 'task_time', fromId: 'task:check-receipt', toId: 'time:1' }]
    expect(codes(validateScopeReferenceCandidate(attacked, index))).toEqual(expect.arrayContaining(['MODEL_FORBIDDEN_FIELD', 'UNKNOWN_FIELD']))
  })

  it('rejects self-revision and unknown revision targets', async () => {
    const { index, candidate } = await adversarialFixture()
    for (const targetDirectiveId of ['check-receipt', 'not-present']) {
      const attacked = clone(candidate)
      attacked.directives[0].revisionRefs = [{
        type: 'amends', targetDirectiveId, scopeIds: [attacked.directives[0].propositionScopeIds[0]],
      }]
      expect(codes(validateScopeReferenceCandidate(attacked, index))).toContain('REVISION_TARGET_INVALID')
    }
  })

  it('rejects verifier free-form proof, partial proof and missing directive assessment', async () => {
    const { index, candidate, verification } = await adversarialFixture()
    const freeProof = clone(verification) as ScopeReferenceVerification & { proof?: string }
    freeProof.proof = '模型声称已经核验'
    expect(codes(await validateScopeReferenceVerification(freeProof, index, candidate))).toContain('UNKNOWN_FIELD')

    const partial = clone(verification)
    partial.assessments[0].evidenceScopeIds.pop()
    expect(codes(await validateScopeReferenceVerification(partial, index, candidate))).toContain('ENTAILED_EVIDENCE_INCOMPLETE')

    const missing = clone(verification)
    missing.assessments = []
    expect(codes(await validateScopeReferenceVerification(missing, index, candidate))).toContain('ASSESSMENT_COVERAGE_INCOMPLETE')

    const selfReview = clone(verification)
    selfReview.verifierRunId = candidate.producerRunId
    expect(codes(await validateScopeReferenceVerification(selfReview, index, candidate))).toContain('VERIFIER_RUN_NOT_INDEPENDENT')
  })

  it('never defaults an externally acting suggestion selected, even if mislabeled local', async () => {
    const { index, candidate, verification } = await adversarialFixture()
    const attacked = clone(candidate)
    attacked.directives[0].actionType = 'complete'
    attacked.directives[0].action.surface = '检查'
    attacked.directives[0].object.surface = '回执单'
    attacked.directives[0].effect = 'local_change'
    const directiveScope = index.scopes[2]
    const externalIndex = await indexImmutableScopes(index.sourceId, 'external-v1', index.sourceContent.replace(directiveScope.text, '请在明早完成回执单邮寄。'))
    const [thirdParty, negative, externalDirective, location] = externalIndex.scopes
    attacked.sourceVersionId = externalIndex.sourceVersionId
    attacked.sourceFingerprint = externalIndex.sourceFingerprint
    attacked.directives[0].propositionScopeIds = [externalDirective.id, location.id]
    attacked.directives[0].action = { scopeId: externalDirective.id, surface: '完成' }
    attacked.directives[0].object = { scopeId: externalDirective.id, surface: '回执单邮寄' }
    attacked.directives[0].timeRefs = [{ scopeId: externalDirective.id, surface: '明早', type: 'task_deadline' }]
    attacked.directives[0].locationRef = { scopeId: location.id, surface: '教学楼二层' }
    attacked.ignoredScopeIds = [thirdParty.id, negative.id]

    const checked = clone(verification)
    checked.sourceVersionId = externalIndex.sourceVersionId
    checked.sourceFingerprint = externalIndex.sourceFingerprint
    checked.candidateFingerprint = await scopeReferenceCandidateFingerprint(attacked)
    checked.consideredScopeIds = externalIndex.scopes.map((scope) => scope.id)
    checked.assessments[0].actionType = 'complete'
    checked.assessments[0].effect = 'local_change'
    checked.assessments[0].evidenceScopeIds = [externalDirective.id, location.id]
    const result = await composeScopeReferenceCandidate(externalIndex, attacked, checked, { allowContractFixtureOracle: true })
    expect(result.ok).toBe(true)
    expect(result.ok && result.value.suggestions[0].selected).toBe(false)
  })

  it('keeps negative, completed third-party and informational statements out of suggestions', async () => {
    const { index, candidate, verification } = await adversarialFixture()
    const negativeScope = index.scopes[1]
    const negative = clone(candidate.directives[0])
    negative.id = 'negative-send'
    negative.propositionScopeIds = [negativeScope.id]
    negative.semantics.polarity = 'negative'
    negative.actionType = 'send'
    negative.action = { scopeId: negativeScope.id, surface: '发送' }
    negative.object = { scopeId: negativeScope.id, surface: '邮件' }
    negative.effect = 'external_interaction'
    negative.timeRefs = []
    negative.locationRef = null
    candidate.directives.push(negative)
    candidate.ignoredScopeIds = [index.scopes[0].id]
    verification.candidateFingerprint = await scopeReferenceCandidateFingerprint(candidate)
    verification.assessments.push({
      directiveId: negative.id, verdict: 'entailed', semantics: clone(negative.semantics), inferenceLevel: negative.inferenceLevel,
      actionType: negative.actionType, effect: negative.effect, evidenceScopeIds: negative.propositionScopeIds,
    })
    const result = await composeScopeReferenceCandidate(index, candidate, verification, { allowContractFixtureOracle: true })
    expect(result.ok).toBe(true)
    expect(result.ok && result.value.suggestions.map((suggestion) => suggestion.id)).toEqual(['task:check-receipt'])
  })

  it('keeps requiresAction false for an explicit event without a user directive', async () => {
    const index = await indexImmutableScopes('event-only-source', 'v1', '宣讲会将于周五在报告厅举行。')
    const candidate: ScopeReferenceCandidate = {
      schemaVersion: SCOPE_REFERENCE_SCHEMA_VERSION,
      sourceId: index.sourceId,
      sourceVersionId: index.sourceVersionId,
      sourceFingerprint: index.sourceFingerprint,
      producerRunId: 'event-only-producer',
      requiresAction: false,
      directives: [],
      observations: [{
        id: 'briefing-event',
        kind: 'event',
        propositionScopeIds: [index.scopes[0].id],
        semantics: {
          actor: 'unknown', speechAct: 'assertive', polarity: 'affirmative', tense: 'future',
          status: 'pending', validity: 'active', modality: 'informational',
        },
        inferenceLevel: 'explicit',
        subject: { scopeId: index.scopes[0].id, surface: '宣讲会' },
        timeRefs: [{ scopeId: index.scopes[0].id, surface: '周五', type: 'event_start' }],
        locationRef: { scopeId: index.scopes[0].id, surface: '报告厅' },
      }],
      ignoredScopeIds: [],
    }
    expect(validateScopeReferenceCandidate(candidate, index)).toEqual({ valid: true, issues: [] })
    const verification: ScopeReferenceVerification = {
      schemaVersion: SCOPE_REFERENCE_VERIFICATION_VERSION,
      method: 'contract_fixture_oracle',
      verifierRunId: 'event-only-verifier',
      sourceId: index.sourceId,
      sourceVersionId: index.sourceVersionId,
      sourceFingerprint: index.sourceFingerprint,
      candidateFingerprint: await scopeReferenceCandidateFingerprint(candidate),
      graphCoverage: 'complete',
      revisionCoverage: 'complete',
      consideredScopeIds: index.scopes.map((scope) => scope.id),
      assessments: [],
      observationAssessments: [{
        observationId: 'briefing-event',
        verdict: 'entailed',
        semantics: clone(candidate.observations[0].semantics),
        inferenceLevel: 'explicit',
        evidenceScopeIds: [index.scopes[0].id],
      }],
      missingDirectiveScopeIds: [],
    }
    const result = await composeScopeReferenceCandidate(index, candidate, verification, { allowContractFixtureOracle: true })
    expect(result.ok && result.value.requiresAction).toBe(false)
    expect(result.ok && result.value.suggestions).toEqual([])
    expect(result.ok && result.value.observations).toEqual([
      expect.objectContaining({ id: 'event:briefing-event', selected: false, needsConfirmation: true }),
    ])
    expect(result.ok && result.value.relations.map((relation) => relation.type)).toEqual(['event_time', 'event_location'])
  })
})
