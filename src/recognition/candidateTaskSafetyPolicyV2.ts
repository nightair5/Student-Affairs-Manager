import type { ActionCandidateComposition } from './actionCandidateComposerV2'
import {
  CANDIDATE_TASK_SAFETY_POLICY_VERSION,
  formCandidateSafeTaskSuggestions,
  validateCandidateSafeTaskSuggestions,
  type CandidateBoundTaskSuggestion,
  type CandidateTaskSafetyResult,
} from './candidateTaskSafetyPolicy'
import { resolveCandidateRevisionRelations } from './candidateRevisionRelationResolver'
import {
  applyFullPropositionAdjudication,
  validateAdjudicatedCandidateComposition,
  type FullPropositionAdjudication,
} from './fullPropositionAdjudicator'
import type { LocalActionCandidateCatalog } from './localActionCandidateIndexV2'
import type { ImmutableScopeIndex } from './scopeReferenceContract'
import {
  deriveThreeValuedActionability,
  validateThreeValuedActionability,
  type ThreeValuedActionabilityDecision,
} from './threeValuedActionability'
import { jsonStructurallyEqual } from './jsonStructuralEqual'
import { captureVerifiedCandidateInputs } from './candidateSourceIntegrity'

export const CANDIDATE_TASK_SAFETY_V2_SCHEMA_VERSION = 'candidate-task-safety-result-3.0.0' as const
export const CANDIDATE_TASK_SAFETY_V2_POLICY_VERSION = 'candidate-task-safety-policy-3.0.0-rco-5-010' as const

export interface CandidateTaskSafetyResultV2 extends Omit<CandidateTaskSafetyResult, 'schemaVersion' | 'policyVersion' | 'requiresAction'> {
  schemaVersion: typeof CANDIDATE_TASK_SAFETY_V2_SCHEMA_VERSION
  policyVersion: typeof CANDIDATE_TASK_SAFETY_V2_POLICY_VERSION
  basePolicyVersion: typeof CANDIDATE_TASK_SAFETY_POLICY_VERSION
  requiresAction: ThreeValuedActionabilityDecision['value']
  fullPropositionAdjudication: FullPropositionAdjudication
  actionabilityDecision: ThreeValuedActionabilityDecision
}

export interface CandidateTaskSafetyPipelineV2 {
  composition: ActionCandidateComposition
  result: CandidateTaskSafetyResultV2
}

function unique<T>(values: T[]): T[] { return [...new Set(values)] }

function applyEffectiveRevisionResolution(
  index: ImmutableScopeIndex,
  catalog: LocalActionCandidateCatalog,
  composition: ActionCandidateComposition,
  base: CandidateTaskSafetyResult,
): CandidateTaskSafetyResult {
  const candidateById = new Map(catalog.candidates.map((candidate) => [candidate.id, candidate]))
  const uncertainties = composition.ledger
    .filter((entry) => entry.status === 'quarantined')
    .map((entry) => candidateById.get(entry.candidateId))
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .map((candidate) => ({
      scopeId: candidate.scopeId,
      actionSourceStart: candidate.action.sourceStart,
      currentness: candidate.currentness,
    }))
  const resolution = resolveCandidateRevisionRelations(
    index,
    base.tasks,
    uncertainties,
    new Set(composition.diagnostics.unresolvedActionScopeIds),
  )
  const targetTaskIds = new Set(resolution.relations.map((relation) => relation.targetTaskId))
  const tasks = base.tasks.map((task): CandidateBoundTaskSuggestion => {
    const outgoing = resolution.relations.find((relation) => relation.targetTaskId === task.id)
    const incoming = resolution.relations.filter((relation) => relation.kind === 'supersedes'
      && relation.replacementTaskIds.includes(task.id))
    const revisionRefs = incoming.map((relation) => ({
      type: 'supersedes' as const,
      targetTaskId: relation.targetTaskId,
      scopeIds: [...relation.evidenceScopeIds],
    }))
    if (!outgoing) {
      return {
        ...task,
        revisionRefs,
        policyReasons: unique([
          ...task.policyReasons.filter((reason) => !reason.startsWith('P5_REVISION_')),
          ...incoming.map((relation) => `RCO5010_REVISION_REPLACEMENT_${relation.kind.toUpperCase()}`),
        ]),
      }
    }
    return {
      ...task,
      semantics: {
        ...task.semantics,
        speechAct: 'directive',
        polarity: 'negative',
        tense: 'past',
        status: 'cancelled',
        validity: 'superseded',
      },
      revisionRefs,
      selected: false,
      needsConfirmation: true,
      policyReasons: unique([
        ...task.policyReasons.filter((reason) => !reason.startsWith('P5_REVISION_')),
        `RCO5010_REVISION_${outgoing.kind.toUpperCase()}_EDGE`,
        `RCO5010_REVISION_EVIDENCE_${outgoing.resolution.toUpperCase()}`,
        'RCO5010_SAFE_DEFAULT_BLOCKED_BY_EFFECTIVE_REVISION',
      ]),
    }
  })
  return {
    ...base,
    tasks,
    revisionRelations: resolution.relations,
    unresolvedRevisionScopeIds: resolution.unresolvedRevisionScopeIds,
    revisionCoverageComplete: resolution.unresolvedRevisionScopeIds.length === 0,
    suppressedRevisionScopeIds: resolution.coverageSuppressedRevisionScopeIds,
    defaultSelectionBlockedTaskIds: base.defaultSelectionBlockedTaskIds.filter((taskId) => !targetTaskIds.has(taskId)),
    unsafeDefaultSelections: base.unsafeDefaultSelections.filter((taskId) => tasks.some((task) => task.id === taskId && task.selected)),
  }
}

export async function formCandidateSafeTaskSuggestionsV2(
  index: ImmutableScopeIndex,
  catalog: LocalActionCandidateCatalog,
  originalComposition: ActionCandidateComposition,
): Promise<CandidateTaskSafetyPipelineV2> {
  const verified = await captureVerifiedCandidateInputs(index, catalog, originalComposition)
  return deriveVerifiedSuggestions(verified.index, verified.catalog, verified.composition)
}

function deriveVerifiedSuggestions(
  index: ImmutableScopeIndex,
  catalog: LocalActionCandidateCatalog,
  originalComposition: ActionCandidateComposition,
): CandidateTaskSafetyPipelineV2 {
  const adjudicated = applyFullPropositionAdjudication(index, catalog, originalComposition)
  const base = formCandidateSafeTaskSuggestions(index, catalog, adjudicated.composition)
  const baseIssues = validateCandidateSafeTaskSuggestions(base, index, catalog, adjudicated.composition)
  if (baseIssues.length > 0) throw new Error(`RCO5010_BASE_POLICY_VALIDATION_FAILED:${baseIssues.map((issue) => issue.code).join(',')}`)
  const revisionAdjusted = applyEffectiveRevisionResolution(index, catalog, adjudicated.composition, base)
  const actionabilityDecision = deriveThreeValuedActionability(
    index,
    catalog,
    adjudicated.composition,
    revisionAdjusted,
    adjudicated.adjudication,
  )
  return {
    composition: adjudicated.composition,
    result: {
      ...revisionAdjusted,
      schemaVersion: CANDIDATE_TASK_SAFETY_V2_SCHEMA_VERSION,
      policyVersion: CANDIDATE_TASK_SAFETY_V2_POLICY_VERSION,
      basePolicyVersion: CANDIDATE_TASK_SAFETY_POLICY_VERSION,
      requiresAction: actionabilityDecision.value,
      fullPropositionAdjudication: adjudicated.adjudication,
      actionabilityDecision,
    },
  }
}

export async function validateCandidateSafeTaskSuggestionsV2(
  value: CandidateTaskSafetyPipelineV2,
  index: ImmutableScopeIndex,
  catalog: LocalActionCandidateCatalog,
  originalComposition: ActionCandidateComposition,
): Promise<string[]> {
  try {
    const capturedValue = structuredClone(value)
    const verified = await captureVerifiedCandidateInputs(index, catalog, originalComposition)
    return validateVerifiedSuggestions(capturedValue, verified.index, verified.catalog, verified.composition)
  } catch (error) {
    return [error instanceof Error ? error.message : 'RCO5010_INPUT_VALIDATION_FAILED']
  }
}

function validateVerifiedSuggestions(
  value: CandidateTaskSafetyPipelineV2,
  index: ImmutableScopeIndex,
  catalog: LocalActionCandidateCatalog,
  originalComposition: ActionCandidateComposition,
): string[] {
  const issues = validateAdjudicatedCandidateComposition(
    { adjudication: value.result.fullPropositionAdjudication, composition: value.composition },
    index,
    catalog,
    originalComposition,
  )
  const base = formCandidateSafeTaskSuggestions(index, catalog, value.composition)
  issues.push(...validateCandidateSafeTaskSuggestions(base, index, catalog, value.composition).map((issue) => issue.code))
  const revisionAdjusted = applyEffectiveRevisionResolution(index, catalog, value.composition, base)
  issues.push(...validateThreeValuedActionability(
    value.result.actionabilityDecision,
    index,
    catalog,
    value.composition,
    revisionAdjusted,
    value.result.fullPropositionAdjudication,
  ))
  try {
    const expected = deriveVerifiedSuggestions(index, catalog, originalComposition)
    if (!jsonStructurallyEqual(value, expected)) issues.push('RCO5010_PIPELINE_RESULT_NOT_DERIVED')
  } catch (error) {
    issues.push(error instanceof Error ? error.message : 'RCO5010_PIPELINE_REDERIVATION_FAILED')
  }
  return [...new Set(issues)]
}
