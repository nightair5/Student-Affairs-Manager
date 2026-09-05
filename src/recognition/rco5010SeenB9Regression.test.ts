import { describe, expect, it } from 'vitest'
import dataFreezeJson from '../../docs/recognition-optimization/RCO-5-009-B9_DATA_FREEZE.json'
import datasetJson from '../../docs/recognition-optimization/RCO-5-009-B9_DEVELOPMENT_DATASET.json'
import frozenResultJson from '../../docs/recognition-optimization/rco-5-009-b9-runs/rco-5-009-b9-zero-call-20260904a/result.json'
import {
  ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
  type ActionCandidateClassificationResponse,
  type ActionCandidateVerdict,
} from './actionCandidateClassificationContract'
import { composeActionCandidatesV2 } from './actionCandidateComposerV2'
import { formCandidateSafeTaskSuggestionsV2, validateCandidateSafeTaskSuggestionsV2 } from './candidateTaskSafetyPolicyV2'
import { compareExactCountMaps } from './countMapComparison'
import { indexLocalActionCandidatesV2 } from './localActionCandidateIndexV2'
import { indexImmutableScopesV11 } from './scopeIndexV11'

interface B9Fixture {
  id: string
  sourceText: string
  expected: { requiresAction: boolean | null; tasks: Array<{ candidateKey: string; selected: boolean }> }
}

interface FrozenCandidate {
  key: string
  candidateId: string
  responseVerdict: ActionCandidateVerdict
  responseObjectCandidateId: string | null
}

interface FrozenCase {
  caseId: string
  candidates: FrozenCandidate[]
}

const fixtures = (datasetJson as { cases: B9Fixture[] }).cases
const frozenCases = (frozenResultJson as { cases: FrozenCase[] }).cases
const ledgerKeys = ['accepted_local', 'accepted_model', 'ignored_local', 'ignored_model', 'quarantined'] as const

describe('RCO-5-010 seen B9 diagnostic replay', () => {
  it('characterizes the historical count failure as key-order-only without changing B9', () => {
    expect(frozenResultJson.evaluation.gate).toBe('FAIL')
    expect(frozenResultJson.evaluation.gateFailures).toContain('EXPECTED_COUNTS_DO_NOT_MATCH_DATA_FREEZE')
    expect(compareExactCountMaps(
      dataFreezeJson.expectedLedgerCounts,
      frozenResultJson.evaluation.counts.actualLedger,
      ledgerKeys,
    )).toMatchObject({ exact: true, issues: [] })
  })

  it('keeps the frozen label dispute visible instead of claiming a new B9 pass', async () => {
    const observed: Array<{ caseId: string; requiresAction: boolean | null }> = []
    for (const fixture of fixtures) {
      const frozenCase = frozenCases.find((item) => item.caseId === fixture.id)
      expect(frozenCase, fixture.id).toBeDefined()
      if (!frozenCase) continue
      const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
      const catalog = await indexLocalActionCandidatesV2(index)
      expect(catalog.candidates.map((candidate) => candidate.id), fixture.id).toEqual(frozenCase.candidates.map((candidate) => candidate.candidateId))
      const response: ActionCandidateClassificationResponse = {
        schemaVersion: ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
        sourceId: catalog.sourceId,
        sourceVersionId: catalog.sourceVersionId,
        sourceFingerprint: catalog.sourceFingerprint,
        catalogFingerprint: catalog.catalogFingerprint,
        producerRunId: `rco5010-seen-${fixture.id}`,
        classifications: frozenCase.candidates.map((candidate) => ({
          candidateId: candidate.candidateId,
          verdict: candidate.responseVerdict,
          objectCandidateId: candidate.responseObjectCandidateId,
        })),
      }
      const composition = await composeActionCandidatesV2(index, catalog, response, response.producerRunId)
      expect(composition.ok, fixture.id).toBe(true)
      if (!composition.ok) continue
      const pipeline = await formCandidateSafeTaskSuggestionsV2(index, catalog, composition.value)
      expect(await validateCandidateSafeTaskSuggestionsV2(pipeline, index, catalog, composition.value), fixture.id).toEqual([])
      const expectedSelectedIds = fixture.expected.tasks.filter((task) => task.selected)
        .map((task) => frozenCase.candidates.find((candidate) => candidate.key === task.candidateKey)?.candidateId)
      const selectedIds = pipeline.result.tasks.filter((task) => task.selected).map((task) => task.originCandidateId)
      expect(selectedIds.filter((id) => !expectedSelectedIds.includes(id)), fixture.id).toEqual([])
      expect(pipeline.result.unsafeDefaultSelections, fixture.id).toEqual([])
      observed.push({ caseId: fixture.id, requiresAction: pipeline.result.requiresAction })
    }
    const mismatches = observed.filter((item) => item.requiresAction !== fixtures.find((fixture) => fixture.id === item.caseId)?.expected.requiresAction)
    expect(mismatches).toEqual([{ caseId: 'rco-task-b9-07', requiresAction: null }])
    expect(observed).toHaveLength(12)
  })

  it('keeps both B9-07 ambiguity and the B9-12 semantic-label limitation explicit', async () => {
    const outcomes: Record<string, { requiresAction: boolean | null; nonTasks: number; unknownAtoms: number }> = {}
    for (const fixture of fixtures.filter((item) => ['rco-task-b9-07', 'rco-task-b9-12'].includes(item.id))) {
      const frozenCase = frozenCases.find((item) => item.caseId === fixture.id)
      if (!frozenCase) throw new Error(`MISSING_FROZEN_CASE:${fixture.id}`)
      const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
      const catalog = await indexLocalActionCandidatesV2(index)
      const response: ActionCandidateClassificationResponse = {
        schemaVersion: ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
        sourceId: catalog.sourceId,
        sourceVersionId: catalog.sourceVersionId,
        sourceFingerprint: catalog.sourceFingerprint,
        catalogFingerprint: catalog.catalogFingerprint,
        producerRunId: `rco5010-focus-${fixture.id}`,
        classifications: frozenCase.candidates.map((candidate) => ({ candidateId: candidate.candidateId, verdict: candidate.responseVerdict, objectCandidateId: candidate.responseObjectCandidateId })),
      }
      const composition = await composeActionCandidatesV2(index, catalog, response, response.producerRunId)
      if (!composition.ok) throw new Error(`COMPOSITION_FAILED:${fixture.id}`)
      const pipeline = await formCandidateSafeTaskSuggestionsV2(index, catalog, composition.value)
      outcomes[fixture.id] = {
        requiresAction: pipeline.result.requiresAction,
        nonTasks: pipeline.result.fullPropositionAdjudication.confirmedNonTaskCandidateIds.length,
        unknownAtoms: pipeline.result.actionabilityDecision.unresolvedCandidateIds.length,
      }
    }
    expect(outcomes['rco-task-b9-07']).toMatchObject({ requiresAction: null, nonTasks: 0 })
    expect(outcomes['rco-task-b9-07'].unknownAtoms).toBeGreaterThan(0)
    expect(outcomes['rco-task-b9-12']).toEqual({ requiresAction: null, nonTasks: 0, unknownAtoms: 1 })
    expect(frozenResultJson.knownLabelLimitations).toEqual(expect.arrayContaining([
      expect.objectContaining({ caseId: 'rco-task-b9-12', code: 'IMPLEMENTATION_BOUNDARY_LABEL_NOT_INDEPENDENT_SEMANTIC_TRUTH' }),
    ]))
  })
})
