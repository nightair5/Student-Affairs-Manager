import { describe, expect, it } from 'vitest'
import datasetJson from '../../docs/recognition-optimization/RCO-5-008-B8_DEVELOPMENT_DATASET.json'
import rawJson from '../../docs/recognition-optimization/rco-5-008-b8-runs/rco-5-008-b8-m1-20260904a/raw-results.json'
import {
  ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
  projectLegacySelectionToCandidateClassifications,
  type ActionCandidateClassificationResponse,
} from './actionCandidateClassificationContract'
import { composeActionCandidates, deriveRequiresActionWithCoverage } from './actionCandidateComposer'
import { indexLocalActionCandidates, type LocalActionCandidateCatalog } from './localActionCandidateIndex'
import type { ModelAnchorSelection } from './modelAnchorSelectionContract'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import type { ImmutableScopeIndex } from './scopeReferenceContract'
import { scoreTaskFormationCase, type TaskFormationExpectedCase, type TaskFormationPredictionCase } from './taskFormationEvaluation'
import {
  materializeRevisionRelationsByScope,
  scoreStableDefaultSafety,
  type ExpectedRevisionRelationV2,
} from './taskFormationEvaluationV2'
import { formLocalTaskSuggestionsP4, validateLocalTaskFormationP4 } from './taskFormationPolicyP4'

interface ExpectedSelection {
  expectedId: string
  propositionScopeTexts: string[]
  action: { scopeText: string; surface: string }
  object: { scopeText: string; surface: string }
}

interface Fixture extends TaskFormationExpectedCase {
  sourceText: string
  expected: TaskFormationExpectedCase['expected'] & {
    selections: ExpectedSelection[]
    revisionRelations: ExpectedRevisionRelationV2[]
    unresolvedRevisionScopeTexts: string[]
  }
}

interface RawRecord {
  caseId: string
  status: string
  parsed: ModelAnchorSelection
}

const dataset = datasetJson as { cases: Fixture[] }
const raw = rawJson as { records: RawRecord[] }

function scopeId(index: ImmutableScopeIndex, text: string): string {
  const matches = index.scopes.filter((scope) => scope.text === text)
  if (matches.length !== 1) throw new Error('B8_SCOPE_NOT_UNIQUE:' + text)
  return matches[0].id
}

function expectedCandidate(
  index: ImmutableScopeIndex,
  catalog: LocalActionCandidateCatalog,
  expected: ExpectedSelection,
) {
  const actionScopeId = scopeId(index, expected.action.scopeText)
  const matches = catalog.candidates.filter((candidate) => candidate.scopeId === actionScopeId && candidate.action.surface === expected.action.surface)
  if (matches.length !== 1) throw new Error('B8_EXPECTED_ACTION_NOT_UNIQUE:' + expected.expectedId)
  const object = matches[0].objectCandidates.find((candidate) => candidate.surface === expected.object.surface && candidate.scopeId === scopeId(index, expected.object.scopeText))
  if (!object) throw new Error('B8_EXPECTED_OBJECT_NOT_ENUMERATED:' + expected.expectedId)
  return { candidate: matches[0], object }
}

function oracleResponse(fixture: Fixture, index: ImmutableScopeIndex, catalog: LocalActionCandidateCatalog): ActionCandidateClassificationResponse {
  const expected = new Map(fixture.expected.selections.map((selection) => {
    const mapped = expectedCandidate(index, catalog, selection)
    return [mapped.candidate.id, mapped.object.id] as const
  }))
  return {
    schemaVersion: ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
    sourceId: catalog.sourceId,
    sourceVersionId: catalog.sourceVersionId,
    sourceFingerprint: catalog.sourceFingerprint,
    catalogFingerprint: catalog.catalogFingerprint,
    producerRunId: 'b8-oracle-' + fixture.id,
    classifications: catalog.candidates.map((candidate) => expected.has(candidate.id)
      ? { candidateId: candidate.id, verdict: 'proposition', objectCandidateId: expected.get(candidate.id) as string }
      : { candidateId: candidate.id, verdict: 'mention_only', objectCandidateId: null }),
  }
}

function prediction(
  fixture: Fixture,
  index: ImmutableScopeIndex,
  composition: Awaited<ReturnType<typeof composeActionCandidates>> & { ok: true },
) {
  const formed = formLocalTaskSuggestionsP4(index, composition.value.reduced)
  const scopeText = new Map(index.scopes.map((scope) => [scope.id, scope.text]))
  const requiresAction = deriveRequiresActionWithCoverage(formed.requiresAction, composition.value)
  const value: TaskFormationPredictionCase = {
    caseId: fixture.id,
    status: 'completed',
    requiresAction,
    tasks: formed.tasks.map((task) => ({
      id: task.id,
      propositionScopeTexts: task.propositionScopeIds.map((id) => scopeText.get(id)).filter((text): text is string => Boolean(text)),
      semantics: task.semantics,
      inferenceLevel: task.inferenceLevel,
      actionType: task.actionType,
      action: task.action.surface,
      object: task.object.surface,
      effect: task.effect,
      selected: task.selected,
    })),
  }
  return { formed, value, scopeText }
}

describe('RCO-5-009 seen B8 zero-call candidate regression', () => {
  it('enumerates all twenty expected actions and exactly two explicit non-task decoys', async () => {
    let expectedCount = 0
    let catalogCount = 0
    let localNonTaskCount = 0
    for (const fixture of dataset.cases) {
      const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
      const catalog = await indexLocalActionCandidates(index)
      expectedCount += fixture.expected.selections.length
      catalogCount += catalog.candidates.length
      localNonTaskCount += catalog.candidates.filter((candidate) => candidate.localDisposition === 'local_non_task').length
      for (const expected of fixture.expected.selections) expectedCandidate(index, catalog, expected)
    }
    expect(expectedCount).toBe(20)
    expect(catalogCount).toBe(22)
    expect(localNonTaskCount).toBe(2)
  })

  it('has a perfect Expected-derived local ceiling without exposing Expected to a future request', async () => {
    for (const fixture of dataset.cases) {
      const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
      const catalog = await indexLocalActionCandidates(index)
      const response = oracleResponse(fixture, index, catalog)
      const composition = await composeActionCandidates(index, catalog, response, response.producerRunId)
      expect(composition.ok, fixture.id).toBe(true)
      if (!composition.ok) continue
      expect(composition.value.semanticCoverageComplete, fixture.id).toBe(true)
      expect(composition.value.ledger.filter((entry) => entry.status === 'quarantined'), fixture.id).toEqual([])
      const predicted = prediction(fixture, index, composition)
      expect(validateLocalTaskFormationP4(predicted.formed, index, composition.value.reduced), fixture.id).toEqual([])
      expect(scoreTaskFormationCase(fixture, predicted.value).completeTaskCase, fixture.id).toBe(true)
      expect(scoreStableDefaultSafety(fixture.expected.directives, predicted.value.tasks).unsafeDefaultFalsePositives, fixture.id).toBe(0)
      expect(materializeRevisionRelationsByScope(fixture.expected.directives, fixture.expected.revisionRelations, predicted.value.tasks, predicted.formed, index).exact, fixture.id).toBe(true)
      expect(predicted.formed.unresolvedRevisionScopeIds.map((id) => predicted.scopeText.get(id)), fixture.id).toEqual(fixture.expected.unresolvedRevisionScopeTexts)
    }
  })

  it('salvages legal siblings from frozen legacy raw while reporting rather than hiding model misses', async () => {
    let expectedModelHits = 0
    let expectedModelTotal = 0
    let unmatchedLegacyDirectives = 0
    let completeProductCases = 0
    const missedExpected: string[] = []
    for (const fixture of dataset.cases) {
      const record = raw.records.find((item) => item.caseId === fixture.id)
      expect(record?.status, fixture.id).toBe('completed_valid')
      if (!record) continue
      const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
      const catalog = await indexLocalActionCandidates(index)
      const projection = projectLegacySelectionToCandidateClassifications(record.parsed, catalog, 'b8-legacy-projection-' + fixture.id)
      unmatchedLegacyDirectives += projection.unmatchedLegacyDirectiveIds.length
      const expectedIds = fixture.expected.selections.map((selection) => expectedCandidate(index, catalog, selection).candidate.id)
      expectedModelTotal += expectedIds.length
      for (const id of expectedIds) {
        const classification = projection.response.classifications.find((item) => item.candidateId === id)
        if (classification?.verdict === 'proposition') expectedModelHits += 1
        else missedExpected.push(fixture.id + ':' + id)
      }
      const composition = await composeActionCandidates(index, catalog, projection.response, projection.response.producerRunId)
      expect(composition.ok, fixture.id).toBe(true)
      if (!composition.ok) continue
      const predicted = prediction(fixture, index, composition)
      if (scoreTaskFormationCase(fixture, predicted.value).completeTaskCase) completeProductCases += 1
      expect(composition.value.reduced.directives.every((item) => !/取消|停止执行/u.test(item.actionSurfaceHint.surface)), fixture.id).toBe(true)
    }
    expect({ expectedModelHits, expectedModelTotal }).toEqual({ expectedModelHits: 18, expectedModelTotal: 20 })
    expect(missedExpected.map((item) => item.split(':')[0])).toEqual(['rco-task-b8-07', 'rco-task-b8-11'])
    expect(unmatchedLegacyDirectives).toBe(2)
    expect(completeProductCases).toBe(12)
  })
})
