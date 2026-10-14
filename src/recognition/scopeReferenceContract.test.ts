import { describe, expect, it } from 'vitest'
import {
  SCOPE_REFERENCE_CANDIDATE_JSON_SCHEMA,
  SCOPE_REFERENCE_SCHEMA_VERSION,
  SCOPE_REFERENCE_VERIFICATION_JSON_SCHEMA,
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

const SOURCE = '通知：请于周五在本机核对报名表。结果另行通知。'

function clone<T>(value: T): T {
  return structuredClone(value)
}

async function fixture(): Promise<{ index: ImmutableScopeIndex; candidate: ScopeReferenceCandidate; verification: ScopeReferenceVerification }> {
  const index = await indexImmutableScopes('source-rco-006', 'version-1', SOURCE)
  const [heading, directive, ignored] = index.scopes
  const candidate: ScopeReferenceCandidate = {
    schemaVersion: SCOPE_REFERENCE_SCHEMA_VERSION,
    sourceId: index.sourceId,
    sourceVersionId: index.sourceVersionId,
    sourceFingerprint: index.sourceFingerprint,
    producerRunId: 'producer-1',
    requiresAction: true,
    directives: [{
      id: 'd1',
      propositionScopeIds: [directive.id],
      semantics: { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'required' },
      inferenceLevel: 'explicit',
      actionType: 'review',
      action: { scopeId: directive.id, surface: '核对' },
      object: { scopeId: directive.id, surface: '报名表' },
      effect: 'local_change',
      timeRefs: [{ scopeId: directive.id, surface: '周五', type: 'task_deadline' }],
      materialRefs: [],
      eventRef: null,
      locationRef: { scopeId: directive.id, surface: '本机' },
      revisionRefs: [],
    }],
    observations: [],
    ignoredScopeIds: [heading.id, ignored.id],
  }
  const verification: ScopeReferenceVerification = {
    schemaVersion: SCOPE_REFERENCE_VERIFICATION_VERSION,
    method: 'contract_fixture_oracle',
    verifierRunId: 'verifier-1',
    sourceId: index.sourceId,
    sourceVersionId: index.sourceVersionId,
    sourceFingerprint: index.sourceFingerprint,
    candidateFingerprint: await scopeReferenceCandidateFingerprint(candidate),
    graphCoverage: 'complete',
    revisionCoverage: 'complete',
    consideredScopeIds: index.scopes.map((scope) => scope.id),
    assessments: [{
      directiveId: 'd1', verdict: 'entailed', semantics: clone(candidate.directives[0].semantics),
      inferenceLevel: 'explicit', actionType: 'review', effect: 'local_change', evidenceScopeIds: [directive.id],
    }],
    observationAssessments: [],
    missingDirectiveScopeIds: [],
  }
  return { index, candidate, verification }
}

function issueCodes(report: { issues: Array<{ code: string }> }): string[] {
  return report.issues.map((issue) => issue.code)
}

function propertyNames(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(propertyNames)
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, nested]) => [key, ...propertyNames(nested)])
}

describe('RCO-5-006 immutable scope index', () => {
  it('creates source-version-bound opaque ids and exact local offsets', async () => {
    const index = await indexImmutableScopes('source-rco-006', 'version-1', SOURCE)
    expect(index.scopes.map((scope) => scope.text)).toEqual(['通知：', '请于周五在本机核对报名表。', '结果另行通知。'])
    for (const scope of index.scopes) {
      expect(SOURCE.slice(scope.start, scope.end)).toBe(scope.text)
      expect(scope.id).toMatch(/^scope-\d{4}-[a-f0-9]{64}$/u)
      expect(scope.sourceFingerprint).toBe(index.sourceFingerprint)
    }
  })

  it('changes every binding when source id, version or bytes change', async () => {
    const original = await indexImmutableScopes('s1', 'v1', SOURCE)
    const changedSource = await indexImmutableScopes('s2', 'v1', SOURCE)
    const changedVersion = await indexImmutableScopes('s1', 'v2', SOURCE)
    const changedBytes = await indexImmutableScopes('s1', 'v1', `${SOURCE} `)
    expect(new Set([original.sourceFingerprint, changedSource.sourceFingerprint, changedVersion.sourceFingerprint, changedBytes.sourceFingerprint]).size).toBe(4)
    expect(changedSource.scopes[0].id).not.toBe(original.scopes[0].id)
    expect(changedVersion.scopes[0].id).not.toBe(original.scopes[0].id)
  })
})

describe('RCO-5-006 model output boundary', () => {
  it('strict schemas contain no model-written offsets, raw evidence or selected', () => {
    const forbidden = new Set(['start', 'end', 'text', 'quote', 'evidence', 'selected'])
    for (const schema of [SCOPE_REFERENCE_CANDIDATE_JSON_SCHEMA, SCOPE_REFERENCE_VERIFICATION_JSON_SCHEMA]) {
      expect(propertyNames(schema).filter((key) => forbidden.has(key))).toEqual([])
      expect(JSON.stringify(schema)).toContain('"additionalProperties":false')
    }
  })

  it('accepts a fully bound candidate and rejects injected forbidden fields', async () => {
    const { index, candidate } = await fixture()
    expect(validateScopeReferenceCandidate(candidate, index)).toEqual({ valid: true, issues: [] })
    const injected = clone(candidate) as ScopeReferenceCandidate & { selected?: boolean; evidence?: string; start?: number }
    injected.selected = true
    injected.evidence = SOURCE
    injected.start = 0
    const report = validateScopeReferenceCandidate(injected, index)
    expect(report.valid).toBe(false)
    expect(issueCodes(report)).toContain('MODEL_FORBIDDEN_FIELD')
    expect(issueCodes(report)).toContain('UNKNOWN_FIELD')
  })

  it('rejects cross-source replay, unknown scopes and fields outside proposition coverage', async () => {
    const { index, candidate } = await fixture()
    const replay = clone(candidate)
    replay.sourceVersionId = 'version-replayed'
    expect(issueCodes(validateScopeReferenceCandidate(replay, index))).toContain('SOURCE_BINDING_MISMATCH')
    const unknown = clone(candidate)
    unknown.directives[0].action.scopeId = 'scope-forged'
    expect(issueCodes(validateScopeReferenceCandidate(unknown, index))).toEqual(expect.arrayContaining(['FIELD_OUTSIDE_PROPOSITION_SCOPE', 'SCOPE_REFERENCE_NOT_FOUND']))
    const borrowed = clone(candidate)
    borrowed.directives[0].object.scopeId = index.scopes[2].id
    borrowed.directives[0].object.surface = '结果'
    expect(issueCodes(validateScopeReferenceCandidate(borrowed, index))).toContain('FIELD_OUTSIDE_PROPOSITION_SCOPE')
  })

  it('rejects missing source coverage, duplicate references and requiresAction drift', async () => {
    const { index, candidate } = await fixture()
    const missing = clone(candidate)
    missing.ignoredScopeIds.pop()
    expect(issueCodes(validateScopeReferenceCandidate(missing, index))).toContain('SOURCE_SCOPE_UNACCOUNTED')
    const duplicate = clone(candidate)
    duplicate.directives[0].propositionScopeIds.push(duplicate.directives[0].propositionScopeIds[0])
    expect(issueCodes(validateScopeReferenceCandidate(duplicate, index))).toContain('DUPLICATE_REFERENCE')
    const inconsistent = clone(candidate)
    inconsistent.requiresAction = false
    expect(issueCodes(validateScopeReferenceCandidate(inconsistent, index))).toContain('REQUIRES_ACTION_INCONSISTENT')
  })

  it('rejects a surface that is absent or ambiguous inside its declared scope', async () => {
    const { index, candidate } = await fixture()
    const absent = clone(candidate)
    absent.directives[0].object.surface = '不存在的表'
    expect(issueCodes(validateScopeReferenceCandidate(absent, index))).toContain('SURFACE_NOT_IN_SCOPE')
    const ambiguousIndex = await indexImmutableScopes('s-ambiguous', 'v1', '请核对报名表并再次核对。')
    const ambiguous = clone(candidate)
    ambiguous.sourceId = ambiguousIndex.sourceId
    ambiguous.sourceVersionId = ambiguousIndex.sourceVersionId
    ambiguous.sourceFingerprint = ambiguousIndex.sourceFingerprint
    ambiguous.directives[0].propositionScopeIds = [ambiguousIndex.scopes[0].id]
    ambiguous.directives[0].action = { scopeId: ambiguousIndex.scopes[0].id, surface: '核对' }
    ambiguous.directives[0].object = { scopeId: ambiguousIndex.scopes[0].id, surface: '报名表' }
    ambiguous.directives[0].timeRefs = []
    ambiguous.directives[0].locationRef = null
    ambiguous.ignoredScopeIds = []
    expect(issueCodes(validateScopeReferenceCandidate(ambiguous, ambiguousIndex))).toContain('SURFACE_AMBIGUOUS_IN_SCOPE')
  })
})

describe('RCO-5-006 verifier and deterministic composer', () => {
  it('binds verifier to the complete source and exact candidate without free evidence', async () => {
    const { index, candidate, verification } = await fixture()
    expect(await validateScopeReferenceVerification(verification, index, candidate)).toEqual({ valid: true, issues: [] })
    const injected = clone(verification) as ScopeReferenceVerification & { evidence?: string }
    injected.evidence = '原文明确要求核对'
    expect(issueCodes(await validateScopeReferenceVerification(injected, index, candidate))).toEqual(expect.arrayContaining(['MODEL_FORBIDDEN_FIELD', 'UNKNOWN_FIELD']))
    const replay = clone(verification)
    replay.candidateFingerprint = 'sha256:replayed'
    expect(issueCodes(await validateScopeReferenceVerification(replay, index, candidate))).toContain('VERIFICATION_CANDIDATE_MISMATCH')
  })

  it('requires one assessment per directive and full scope evidence for entailed verdicts', async () => {
    const { index, candidate, verification } = await fixture()
    const missing = clone(verification)
    missing.assessments = []
    expect(issueCodes(await validateScopeReferenceVerification(missing, index, candidate))).toContain('ASSESSMENT_COVERAGE_INCOMPLETE')
    const emptyEvidence = clone(verification)
    emptyEvidence.assessments[0].evidenceScopeIds = []
    expect(issueCodes(await validateScopeReferenceVerification(emptyEvidence, index, candidate))).toContain('ENTAILED_EVIDENCE_INCOMPLETE')
  })

  it('derives exact spans, verbatim evidence, relations and selected locally', async () => {
    const { index, candidate, verification } = await fixture()
    const withoutFixtureAuthority = await composeScopeReferenceCandidate(index, candidate, verification)
    expect(withoutFixtureAuthority.ok && withoutFixtureAuthority.value.suggestions[0].selected).toBe(false)
    const composed = await composeScopeReferenceCandidate(index, candidate, verification, { allowContractFixtureOracle: true })
    expect(composed.ok).toBe(true)
    if (!composed.ok) return
    const suggestion = composed.value.suggestions[0]
    expect(SOURCE.slice(suggestion.actionSpan.start, suggestion.actionSpan.end)).toBe('核对')
    expect(SOURCE.slice(suggestion.objectSpan.start, suggestion.objectSpan.end)).toBe('报名表')
    expect(suggestion.evidence.map((item) => item.quote)).toEqual(['请于周五在本机核对报名表。'])
    expect(suggestion.selected).toBe(true)
    expect(composed.value.generatedLocally).toEqual({ offsets: true, verbatimEvidence: true, relations: true, selected: true })
    expect(composed.value.relations.map((relation) => relation.type)).toEqual(['task_time', 'task_location'])
    expect(composed.value.relations[0].evidenceScopeIds).toEqual([index.scopes[1].id])
  })

  it('keeps verifier disagreement, incomplete coverage and external actions unselected', async () => {
    const { index, candidate, verification } = await fixture()
    for (const mutate of [
      (report: ScopeReferenceVerification) => { report.assessments[0].verdict = 'contradicted' },
      (report: ScopeReferenceVerification) => { report.graphCoverage = 'incomplete' },
      (report: ScopeReferenceVerification) => { report.revisionCoverage = 'unknown' },
    ]) {
      const changed = clone(verification)
      mutate(changed)
      const composed = await composeScopeReferenceCandidate(index, candidate, changed, { allowContractFixtureOracle: true })
      expect(composed.ok && composed.value.suggestions[0].selected).toBe(false)
    }
    const externalCandidate = clone(candidate)
    externalCandidate.directives[0].actionType = 'send'
    externalCandidate.directives[0].action.surface = '核对'
    externalCandidate.directives[0].effect = 'external_interaction'
    const externalVerification = clone(verification)
    externalVerification.candidateFingerprint = await scopeReferenceCandidateFingerprint(externalCandidate)
    externalVerification.assessments[0].actionType = 'send'
    externalVerification.assessments[0].effect = 'external_interaction'
    const composed = await composeScopeReferenceCandidate(index, externalCandidate, externalVerification, { allowContractFixtureOracle: true })
    expect(composed.ok && composed.value.suggestions[0].selected).toBe(false)
  })

  it('does not trust a verifier merely because its model output claims to be independent', async () => {
    const { index, candidate, verification } = await fixture()
    verification.method = 'independent_semantic_verifier'
    const untrusted = await composeScopeReferenceCandidate(index, candidate, verification)
    expect(untrusted.ok && untrusted.value.suggestions[0].selected).toBe(false)
    const trusted = await composeScopeReferenceCandidate(index, candidate, verification, {
      trustedVerifierRunIds: new Set([verification.verifierRunId]),
    })
    expect(trusted.ok && trusted.value.suggestions[0].selected).toBe(true)
  })

  it('derives revision relation ids and endpoints rather than accepting model relation objects', async () => {
    const index = await indexImmutableScopes('revision-source', 'v1', '原要求填写旧表。现改为填写新表。')
    const [oldScope, newScope] = index.scopes
    const base = await fixture()
    const oldDirective = clone(base.candidate.directives[0])
    oldDirective.id = 'old'
    oldDirective.propositionScopeIds = [oldScope.id]
    oldDirective.action = { scopeId: oldScope.id, surface: '填写' }
    oldDirective.object = { scopeId: oldScope.id, surface: '旧表' }
    oldDirective.actionType = 'fill'
    oldDirective.semantics.validity = 'superseded'
    oldDirective.timeRefs = []
    oldDirective.locationRef = null
    const newer = clone(oldDirective)
    newer.id = 'new'
    newer.propositionScopeIds = [newScope.id]
    newer.action = { scopeId: newScope.id, surface: '填写' }
    newer.object = { scopeId: newScope.id, surface: '新表' }
    newer.semantics.validity = 'active'
    newer.revisionRefs = [{ type: 'supersedes', targetDirectiveId: 'old', scopeIds: [newScope.id] }]
    const candidate: ScopeReferenceCandidate = {
      schemaVersion: SCOPE_REFERENCE_SCHEMA_VERSION, sourceId: index.sourceId, sourceVersionId: index.sourceVersionId,
      sourceFingerprint: index.sourceFingerprint, producerRunId: 'revision-producer', requiresAction: true,
      directives: [oldDirective, newer], observations: [], ignoredScopeIds: [],
    }
    const verification: ScopeReferenceVerification = {
      schemaVersion: SCOPE_REFERENCE_VERIFICATION_VERSION, method: 'contract_fixture_oracle', verifierRunId: 'revision-verifier',
      sourceId: index.sourceId, sourceVersionId: index.sourceVersionId, sourceFingerprint: index.sourceFingerprint,
      candidateFingerprint: await scopeReferenceCandidateFingerprint(candidate), graphCoverage: 'complete', revisionCoverage: 'complete',
      consideredScopeIds: index.scopes.map((scope) => scope.id),
      assessments: candidate.directives.map((directive) => ({ directiveId: directive.id, verdict: 'entailed', semantics: clone(directive.semantics),
        inferenceLevel: directive.inferenceLevel, actionType: directive.actionType, effect: directive.effect, evidenceScopeIds: directive.propositionScopeIds })),
      observationAssessments: [],
      missingDirectiveScopeIds: [],
    }
    const composed = await composeScopeReferenceCandidate(index, candidate, verification, { allowContractFixtureOracle: true })
    expect(composed.ok).toBe(true)
    if (!composed.ok) return
    expect(composed.value.relations).toContainEqual({ id: 'relation:new:revision:1', type: 'supersedes', fromId: 'task:new', toId: 'task:old', evidenceScopeIds: [newScope.id] })
    expect(composed.value.suggestions.map((item) => item.object)).toEqual(['新表'])
  })
})
