import { describe, expect, it } from 'vitest'
import datasetJson from '../../docs/recognition-optimization/RCO-5-007-B2_CHALLENGE_DATASET.json'
import priorB0Json from '../../docs/recognition-optimization/RCO-5-005-B0_DEVELOPMENT_DATASET.json'
import priorB02Json from '../../docs/recognition-optimization/RCO-5-005-B02_DEVELOPMENT_DATASET.json'
import priorB1Json from '../../docs/recognition-optimization/RCO-5-006-B1_DEVELOPMENT_DATASET.json'
import { validateScopeReferenceCandidate, type ImmutableScopeIndex, type ScopeReferenceCandidate, type ScopeReferenceDirective, type ScopeReferenceObservation, type SurfaceReference } from './scopeReferenceContract'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { TASK_FORMATION_EVALUATOR_VERSION } from './taskFormationEvaluation'
import { TASK_FORMATION_POLICY_VERSION } from './taskFormationPolicyV2'

type ExpectedSurface = { scopeText: string; surface: string }
type ExpectedDirective = Omit<ScopeReferenceDirective, 'id' | 'propositionScopeIds' | 'action' | 'object' | 'timeRefs' | 'materialRefs' | 'eventRef' | 'locationRef' | 'revisionRefs'> & {
  expectedId: string; propositionScopeTexts: string[]; action: ExpectedSurface; object: ExpectedSurface;
  timeRefs: Array<ExpectedSurface & { type: ScopeReferenceDirective['timeRefs'][number]['type'] }>;
  materialRefs: Array<ExpectedSurface & { required: boolean }>; eventRef: ExpectedSurface | null; locationRef: ExpectedSurface | null;
  revisionRefs: Array<{ type: ScopeReferenceDirective['revisionRefs'][number]['type']; targetExpectedDirectiveId: string; scopeTexts: string[] }>;
  expectedDefaultSelected: boolean;
}
type ExpectedObservation = Omit<ScopeReferenceObservation, 'id' | 'propositionScopeIds' | 'subject' | 'timeRefs' | 'locationRef'> & {
  expectedId: string; propositionScopeTexts: string[]; subject: ExpectedSurface;
  timeRefs: Array<ExpectedSurface & { type: ScopeReferenceObservation['timeRefs'][number]['type'] }>; locationRef: ExpectedSurface | null;
}
interface DatasetCase {
  id: string; semanticFamilyId: string; coverageTags: string[]; sourceTitle: string; sourceText: string; referenceTime: string; timezone: string;
  expected: { requiresAction: boolean; directives: ExpectedDirective[]; observations: ExpectedObservation[]; ignoredScopeTexts: string[]; forbiddenDefaultSurfaces: string[] }
}
interface Dataset { schemaVersion: string; datasetId: string; split: string; classification: string; seenStatus: string; labelProvenance: string; contractSchemaVersion: string; scopeIndexVersion: string; taskFormationPolicyVersion: string; sampleCount: number; cases: DatasetCase[] }
const dataset = datasetJson as Dataset
const priors = [priorB0Json, priorB02Json, priorB1Json] as Array<{ cases: Array<{ sourceText: string; semanticFamilyId?: string }> }>

function normalizedBigrams(value: string): Set<string> {
  const normalized = value.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase()
  return new Set(Array.from({ length: Math.max(0, normalized.length - 1) }, (_, index) => normalized.slice(index, index + 2)))
}
function jaccard(left: string, right: string): number {
  const a = normalizedBigrams(left); const b = normalizedBigrams(right)
  const intersection = [...a].filter((item) => b.has(item)).length
  return new Set([...a, ...b]).size === 0 ? 1 : intersection / new Set([...a, ...b]).size
}
function lookup(index: ImmutableScopeIndex, text: string): string {
  const scopes = index.scopes.filter((scope) => scope.text === text)
  expect(scopes, text).toHaveLength(1)
  return scopes[0].id
}
function surface(index: ImmutableScopeIndex, value: ExpectedSurface): SurfaceReference { return { scopeId: lookup(index, value.scopeText), surface: value.surface } }
function materialize(fixture: DatasetCase, index: ImmutableScopeIndex): ScopeReferenceCandidate {
  return {
    schemaVersion: 'scope-reference-candidate-1.0', sourceId: index.sourceId, sourceVersionId: index.sourceVersionId,
    sourceFingerprint: index.sourceFingerprint, producerRunId: `reference-${fixture.id}`, requiresAction: fixture.expected.requiresAction,
    directives: fixture.expected.directives.map((item) => ({
      id: item.expectedId, propositionScopeIds: item.propositionScopeTexts.map((text) => lookup(index, text)), semantics: item.semantics,
      inferenceLevel: item.inferenceLevel, actionType: item.actionType, action: surface(index, item.action), object: surface(index, item.object), effect: item.effect,
      timeRefs: item.timeRefs.map((ref) => ({ ...surface(index, ref), type: ref.type })), materialRefs: item.materialRefs.map((ref) => ({ ...surface(index, ref), required: ref.required })),
      eventRef: item.eventRef ? surface(index, item.eventRef) : null, locationRef: item.locationRef ? surface(index, item.locationRef) : null,
      revisionRefs: item.revisionRefs.map((ref) => ({ type: ref.type, targetDirectiveId: ref.targetExpectedDirectiveId, scopeIds: ref.scopeTexts.map((text) => lookup(index, text)) })),
    })),
    observations: fixture.expected.observations.map((item) => ({
      id: item.expectedId, kind: item.kind, propositionScopeIds: item.propositionScopeTexts.map((text) => lookup(index, text)), semantics: item.semantics,
      inferenceLevel: item.inferenceLevel, subject: surface(index, item.subject), timeRefs: item.timeRefs.map((ref) => ({ ...surface(index, ref), type: ref.type })),
      locationRef: item.locationRef ? surface(index, item.locationRef) : null,
    })),
    ignoredScopeIds: fixture.expected.ignoredScopeTexts.map((text) => lookup(index, text)),
  }
}

describe('RCO-5-007-B2 post-policy challenge dataset', () => {
  it('has a fixed post-policy anonymous identity and coverage', () => {
    expect(dataset).toMatchObject({ schemaVersion: 'rco-5-007-b2-challenge-1.0.0', datasetId: 'rco-5-007-b2-challenge-20260904', split: 'Development-Challenge', sampleCount: 16 })
    expect(dataset.classification).toContain('anonymous_synthetic')
    expect(dataset.seenStatus).toBe('UNSEEN_BY_DEEPSEEK_AND_NOT_USED_TO_AUTHOR_POLICY_2_0_0')
    expect(dataset.taskFormationPolicyVersion).toBe(TASK_FORMATION_POLICY_VERSION)
    expect(TASK_FORMATION_EVALUATOR_VERSION).toBe('task-formation-evaluator-1.0.0')
    const tags = new Set(dataset.cases.flatMap((item) => item.coverageTags))
    for (const tag of ['compound_action', 'conditional', 'external_transfer', 'requires_action_without_default', 'shared_material_subset', 'lexical_novelty', 'cross_paragraph']) {
      expect(tags.has(tag), tag).toBe(true)
    }
  })

  it('does not reuse source text or semantic families from B0, B02 or B1', () => {
    const oldCases = priors.flatMap((prior) => prior.cases)
    const oldTexts = new Set(oldCases.map((item) => item.sourceText))
    const oldFamilies = new Set(oldCases.map((item) => item.semanticFamilyId).filter(Boolean))
    expect(new Set(dataset.cases.map((item) => item.id)).size).toBe(16)
    expect(new Set(dataset.cases.map((item) => item.semanticFamilyId)).size).toBe(16)
    for (const fixture of dataset.cases) {
      expect(oldTexts.has(fixture.sourceText)).toBe(false)
      expect(oldFamilies.has(fixture.semanticFamilyId)).toBe(false)
      expect(Math.max(...oldCases.map((item) => jaccard(fixture.sourceText, item.sourceText)))).toBeLessThan(0.55)
    }
  })

  it('contains no obvious direct identifier, credential or secret value', () => {
    const text = dataset.cases.map((item) => `${item.sourceTitle}\n${item.sourceText}`).join('\n')
    expect(text).not.toMatch(/\b1[3-9]\d{9}\b|\b\d{15,18}[0-9Xx]\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:api|access)[-_ ]?key\s*[:=]/iu)
  })

  it('materializes every Expected item into the unchanged scope-reference contract', async () => {
    for (const fixture of dataset.cases) {
      const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
      expect(validateScopeReferenceCandidate(materialize(fixture, index), index), fixture.id).toEqual({ valid: true, issues: [] })
    }
  })

  it('keeps every selected label within a controlled local-action safety set', () => {
    const allowed = new Set(['review', 'fill', 'prepare', 'carry', 'save', 'print', 'complete'])
    for (const item of dataset.cases.flatMap((fixture) => fixture.expected.directives)) {
      if (!item.expectedDefaultSelected) continue
      expect(item.semantics).toMatchObject({ actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'required' })
      expect(allowed.has(item.actionType)).toBe(true)
      expect(['local_change', 'physical_action']).toContain(item.effect)
    }
  })

  it('defines requiresAction independently from default selection', () => {
    const externalOnly = dataset.cases.filter((fixture) => fixture.expected.requiresAction && !fixture.expected.directives.some((item) => item.expectedDefaultSelected))
    expect(externalOnly.length).toBeGreaterThanOrEqual(3)
  })

  it('keeps Expected and labels out of the future request projection', async () => {
    for (const fixture of dataset.cases) {
      const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
      const projection = { sourceId: fixture.id, sourceVersionId: 'source-v1', sourceFingerprint: index.sourceFingerprint, sourceTitle: fixture.sourceTitle, sourceText: fixture.sourceText, referenceTime: fixture.referenceTime, timezone: fixture.timezone, scopeCatalog: index.scopes.map(({ id, order, text }) => ({ id, order, text })) }
      expect(JSON.stringify(projection)).not.toMatch(/expected|forbiddenDefault|expectedDefaultSelected|semanticFamilyId/iu)
    }
  })
})
