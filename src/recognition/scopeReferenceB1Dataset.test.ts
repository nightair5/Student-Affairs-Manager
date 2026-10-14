import { describe, expect, it } from 'vitest'
import datasetJson from '../../docs/recognition-optimization/RCO-5-006-B1_DEVELOPMENT_DATASET.json'
import priorB02Json from '../../docs/recognition-optimization/RCO-5-005-B02_DEVELOPMENT_DATASET.json'
import {
  SCOPE_REFERENCE_SCHEMA_VERSION,
  SCOPE_REFERENCE_VERIFICATION_VERSION,
  composeScopeReferenceCandidate,
  scopeReferenceCandidateFingerprint,
  validateScopeReferenceCandidate,
  type ImmutableScopeIndex,
  type ScopeReferenceCandidate,
  type ScopeReferenceDirective,
  type ScopeReferenceObservation,
  type ScopeReferenceVerification,
  type SurfaceReference,
} from './scopeReferenceContract'
import { indexImmutableScopesV11, SCOPE_INDEX_VERSION } from './scopeIndexV11'

type ExpectedSurface = { scopeText: string; surface: string }
type ExpectedDirective = Omit<ScopeReferenceDirective, 'id' | 'propositionScopeIds' | 'action' | 'object' | 'timeRefs' | 'materialRefs' | 'eventRef' | 'locationRef' | 'revisionRefs'> & {
  expectedId: string
  propositionScopeTexts: string[]
  action: ExpectedSurface
  object: ExpectedSurface
  timeRefs: Array<ExpectedSurface & { type: ScopeReferenceDirective['timeRefs'][number]['type'] }>
  materialRefs: Array<ExpectedSurface & { required: boolean }>
  eventRef: ExpectedSurface | null
  locationRef: ExpectedSurface | null
  revisionRefs: Array<{ type: ScopeReferenceDirective['revisionRefs'][number]['type']; targetExpectedDirectiveId: string; scopeTexts: string[] }>
  expectedDefaultSelected: boolean
}
type ExpectedObservation = Omit<ScopeReferenceObservation, 'id' | 'propositionScopeIds' | 'subject' | 'timeRefs' | 'locationRef'> & {
  expectedId: string
  propositionScopeTexts: string[]
  subject: ExpectedSurface
  timeRefs: Array<ExpectedSurface & { type: ScopeReferenceObservation['timeRefs'][number]['type'] }>
  locationRef: ExpectedSurface | null
}
interface DatasetCase {
  id: string
  semanticFamilyId: string
  coverageTags: string[]
  sourceTitle: string
  sourceText: string
  referenceTime: string
  timezone: string
  expected: {
    requiresAction: boolean
    directives: ExpectedDirective[]
    observations: ExpectedObservation[]
    ignoredScopeTexts: string[]
    forbiddenDefaultSurfaces: string[]
  }
}
interface Dataset {
  schemaVersion: string
  datasetId: string
  split: string
  classification: string
  seenStatus: string
  labelProvenance: string
  contractSchemaVersion: string
  sampleCount: number
  cases: DatasetCase[]
}

const dataset = datasetJson as Dataset
const priorB02 = priorB02Json as { cases: Array<{ semanticFamilyId: string; sourceText: string }> }

function normalize(value: string): string {
  return value.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase()
}

function bigrams(value: string): Set<string> {
  const normalized = normalize(value)
  return new Set(Array.from({ length: Math.max(0, normalized.length - 1) }, (_, index) => normalized.slice(index, index + 2)))
}

function jaccard(left: string, right: string): number {
  const a = bigrams(left)
  const b = bigrams(right)
  const intersection = [...a].filter((item) => b.has(item)).length
  const union = new Set([...a, ...b]).size
  return union === 0 ? 1 : intersection / union
}

function lookupScope(index: ImmutableScopeIndex, text: string): string {
  const matches = index.scopes.filter((scope) => scope.text === text)
  expect(matches, `scope text must resolve exactly once: ${text}`).toHaveLength(1)
  return matches[0].id
}

function surface(index: ImmutableScopeIndex, value: ExpectedSurface): SurfaceReference {
  return { scopeId: lookupScope(index, value.scopeText), surface: value.surface }
}

function materializeCandidate(fixture: DatasetCase, index: ImmutableScopeIndex): ScopeReferenceCandidate {
  return {
    schemaVersion: SCOPE_REFERENCE_SCHEMA_VERSION,
    sourceId: index.sourceId,
    sourceVersionId: index.sourceVersionId,
    sourceFingerprint: index.sourceFingerprint,
    producerRunId: `reference-${fixture.id}`,
    requiresAction: fixture.expected.requiresAction,
    directives: fixture.expected.directives.map((directive) => ({
      id: directive.expectedId,
      propositionScopeIds: directive.propositionScopeTexts.map((text) => lookupScope(index, text)),
      semantics: directive.semantics,
      inferenceLevel: directive.inferenceLevel,
      actionType: directive.actionType,
      action: surface(index, directive.action),
      object: surface(index, directive.object),
      effect: directive.effect,
      timeRefs: directive.timeRefs.map((reference) => ({ ...surface(index, reference), type: reference.type })),
      materialRefs: directive.materialRefs.map((reference) => ({ ...surface(index, reference), required: reference.required })),
      eventRef: directive.eventRef ? surface(index, directive.eventRef) : null,
      locationRef: directive.locationRef ? surface(index, directive.locationRef) : null,
      revisionRefs: directive.revisionRefs.map((reference) => ({
        type: reference.type,
        targetDirectiveId: reference.targetExpectedDirectiveId,
        scopeIds: reference.scopeTexts.map((text) => lookupScope(index, text)),
      })),
    })),
    observations: fixture.expected.observations.map((observation) => ({
      id: observation.expectedId,
      kind: observation.kind,
      propositionScopeIds: observation.propositionScopeTexts.map((text) => lookupScope(index, text)),
      semantics: observation.semantics,
      inferenceLevel: observation.inferenceLevel,
      subject: surface(index, observation.subject),
      timeRefs: observation.timeRefs.map((reference) => ({ ...surface(index, reference), type: reference.type })),
      locationRef: observation.locationRef ? surface(index, observation.locationRef) : null,
    })),
    ignoredScopeIds: fixture.expected.ignoredScopeTexts.map((text) => lookupScope(index, text)),
  }
}

async function oracleVerification(index: ImmutableScopeIndex, candidate: ScopeReferenceCandidate): Promise<ScopeReferenceVerification> {
  return {
    schemaVersion: SCOPE_REFERENCE_VERIFICATION_VERSION,
    method: 'contract_fixture_oracle',
    verifierRunId: `verifier-${candidate.producerRunId}`,
    sourceId: index.sourceId,
    sourceVersionId: index.sourceVersionId,
    sourceFingerprint: index.sourceFingerprint,
    candidateFingerprint: await scopeReferenceCandidateFingerprint(candidate),
    graphCoverage: 'complete',
    revisionCoverage: 'complete',
    consideredScopeIds: index.scopes.map((scope) => scope.id),
    assessments: candidate.directives.map((directive) => ({
      directiveId: directive.id,
      verdict: 'entailed',
      semantics: structuredClone(directive.semantics),
      inferenceLevel: directive.inferenceLevel,
      actionType: directive.actionType,
      effect: directive.effect,
      evidenceScopeIds: directive.propositionScopeIds,
    })),
    observationAssessments: candidate.observations.map((observation) => ({
      observationId: observation.id,
      verdict: 'entailed',
      semantics: structuredClone(observation.semantics),
      inferenceLevel: observation.inferenceLevel,
      evidenceScopeIds: observation.propositionScopeIds,
    })),
    missingDirectiveScopeIds: [],
  }
}

describe('RCO-5-006-B1 frozen Development dataset', () => {
  it('has the declared anonymous Development identity and size', () => {
    expect(dataset.schemaVersion).toBe('rco-5-006-b1-development-1.0.0')
    expect(dataset.datasetId).toBe('rco-5-006-b1-development-20260903')
    expect(dataset.split).toBe('Development')
    expect(dataset.classification).toBe('anonymous_synthetic_codex_authored_development')
    expect(dataset.seenStatus).toBe('UNSEEN_BY_DEEPSEEK_FROZEN_BEFORE_MODEL_CALLS')
    expect(dataset.contractSchemaVersion).toBe(SCOPE_REFERENCE_SCHEMA_VERSION)
    expect((dataset as Dataset & { scopeIndexVersion?: string }).scopeIndexVersion).toBe(SCOPE_INDEX_VERSION)
    expect(dataset.labelProvenance).toContain('not independent human ground truth')
    expect(dataset.sampleCount).toBe(12)
    expect(dataset.cases).toHaveLength(12)
  })

  it('uses unique ids, source texts and semantic families that do not reuse B02', () => {
    expect(new Set(dataset.cases.map((item) => item.id)).size).toBe(12)
    expect(new Set(dataset.cases.map((item) => item.sourceText)).size).toBe(12)
    expect(new Set(dataset.cases.map((item) => item.semanticFamilyId)).size).toBe(12)
    const priorSources = new Set(priorB02.cases.map((item) => item.sourceText))
    const priorFamilies = new Set(priorB02.cases.map((item) => item.semanticFamilyId))
    for (const fixture of dataset.cases) {
      expect(priorSources.has(fixture.sourceText)).toBe(false)
      expect(priorFamilies.has(fixture.semanticFamilyId)).toBe(false)
      expect(Math.max(...priorB02.cases.map((item) => jaccard(fixture.sourceText, item.sourceText)))).toBeLessThan(0.55)
    }
  })

  it('contains no obvious direct identifiers or credential values', () => {
    const content = dataset.cases.map((item) => `${item.sourceTitle}\n${item.sourceText}`).join('\n')
    expect(content).not.toMatch(/\b1[3-9]\d{9}\b|\b\d{15,18}[0-9Xx]\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:api|access)[-_ ]?key\s*[:=]/iu)
  })

  it('covers negative, optional, revision, event-only, multi-task and external-effect cases', () => {
    const tags = new Set(dataset.cases.flatMap((item) => item.coverageTags))
    for (const required of ['no_current_action', 'optional', 'revision', 'event_only', 'multi_task', 'external_transfer', 'credential_safety']) {
      expect(tags.has(required), required).toBe(true)
    }
    expect(dataset.cases.filter((item) => !item.expected.requiresAction)).toHaveLength(4)
    expect(dataset.cases.flatMap((item) => item.expected.directives).length).toBeGreaterThanOrEqual(12)
  })

  it('materializes every Expected graph into the frozen scope contract', async () => {
    for (const fixture of dataset.cases) {
      const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
      const candidate = materializeCandidate(fixture, index)
      expect(validateScopeReferenceCandidate(candidate, index), fixture.id).toEqual({ valid: true, issues: [] })
    }
  })

  it('matches every frozen expectedDefaultSelected value under the explicit fixture oracle', async () => {
    for (const fixture of dataset.cases) {
      const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
      const candidate = materializeCandidate(fixture, index)
      const result = await composeScopeReferenceCandidate(index, candidate, await oracleVerification(index, candidate), { allowContractFixtureOracle: true })
      expect(result.ok, fixture.id).toBe(true)
      if (!result.ok) continue
      const selected = new Map(result.value.suggestions.map((item) => [item.id.replace(/^task:/u, ''), item.selected]))
      for (const directive of fixture.expected.directives) {
        expect(selected.get(directive.expectedId) ?? false, `${fixture.id}:${directive.expectedId}`).toBe(directive.expectedDefaultSelected)
      }
      expect(result.value.observations.every((item) => !item.selected && item.needsConfirmation)).toBe(true)
    }
  })

  it('keeps Expected and default-selection labels out of the future model request projection', async () => {
    for (const fixture of dataset.cases) {
      const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
      const projected = {
        sourceId: index.sourceId,
        sourceVersionId: index.sourceVersionId,
        sourceFingerprint: index.sourceFingerprint,
        sourceTitle: fixture.sourceTitle,
        sourceText: fixture.sourceText,
        referenceTime: fixture.referenceTime,
        timezone: fixture.timezone,
        scopeCatalog: index.scopes.map(({ id, order, text }) => ({ id, order, text })),
      }
      const serialized = JSON.stringify(projected)
      expect(serialized).not.toMatch(/expected|forbiddenDefault|expectedDefaultSelected|semanticFamilyId/iu)
      expect(projected.scopeCatalog).toHaveLength(index.scopes.length)
    }
  })
})
