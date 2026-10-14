import type { ActionCandidateComposition } from './actionCandidateComposerV2'
import type { CandidateTaskSafetyResult } from './candidateTaskSafetyPolicy'
import { resolveCandidateRevisionRelations } from './candidateRevisionRelationResolver'
import type { FullPropositionAdjudication } from './fullPropositionAdjudicator'
import type { LocalActionCandidate, LocalActionCandidateCatalog, LocalClauseRole, LocalCurrentness } from './localActionCandidateIndexV2'
import type { ImmutableScopeIndex, ScopeReferenceSemantics } from './scopeReferenceContract'
import { jsonStructurallyEqual } from './jsonStructuralEqual'

export const THREE_VALUED_ACTIONABILITY_VERSION = 'three-valued-actionability-1.0.0' as const

export type ActionabilityValue = true | false | null
export type ActionabilityAtom = 'definitely_required' | 'definitely_not_required' | 'genuinely_unknown'

interface TaskEvidence {
  id: string
  originCandidateId: string
  propositionScopeIds: string[]
  action: CandidateTaskSafetyResult['tasks'][number]['action']
  actionSourceStart: number
  clauseRole: LocalClauseRole
  currentness: LocalCurrentness
  conditionTruth: CandidateTaskSafetyResult['tasks'][number]['conditionTruth']
  semantics: ScopeReferenceSemantics
}

export interface CandidateActionabilityAtom {
  candidateId: string
  atom: ActionabilityAtom
  taskId: string | null
  evidenceScopeIds: string[]
  reasons: string[]
}

export interface ThreeValuedActionabilityDecision {
  schemaVersion: 'three-valued-actionability-decision-1.0.0'
  policyVersion: typeof THREE_VALUED_ACTIONABILITY_VERSION
  sourceId: string
  sourceVersionId: string
  sourceFingerprint: string
  value: ActionabilityValue
  proof: 'CURRENT_OBLIGATION_EXISTS' | 'UNRESOLVED_POTENTIAL_OBLIGATION' | 'ALL_POTENTIAL_OBLIGATIONS_EXCLUDED'
  candidateAtoms: CandidateActionabilityAtom[]
  currentObligationTaskIds: string[]
  unresolvedCandidateIds: string[]
  unresolvedActionScopeIds: string[]
  unresolvedCurrentRevisionTaskIds: string[]
  selectedFieldConsumed: false
}

function unique<T>(values: T[]): T[] { return [...new Set(values)] }

function taskEvidence(result: CandidateTaskSafetyResult): TaskEvidence[] {
  return result.tasks.map((task) => ({
    id: task.id,
    originCandidateId: task.originCandidateId,
    propositionScopeIds: [...task.propositionScopeIds],
    action: { ...task.action },
    actionSourceStart: task.actionSourceStart,
    clauseRole: task.clauseRole,
    currentness: task.currentness,
    conditionTruth: task.conditionTruth,
    semantics: { ...task.semantics },
  }))
}

function isCurrentRequired(task: TaskEvidence): boolean {
  return (task.semantics.actor === 'addressee' || task.semantics.actor === 'addressed_group')
    && task.clauseRole === 'directive'
    && task.currentness === 'current'
    && (task.conditionTruth === 'none' || task.conditionTruth === 'true')
    && task.semantics.speechAct === 'directive'
    && task.semantics.polarity === 'affirmative'
    && task.semantics.tense === 'future'
    && task.semantics.status === 'pending'
    && task.semantics.validity === 'active'
    && task.semantics.modality === 'required'
}

function taskCouldStillRequire(task: TaskEvidence): boolean {
  if (task.currentness === 'historical' || task.currentness === 'completed') return false
  if (task.conditionTruth === 'false') return false
  if (isCurrentRequired(task)) return true
  if (task.conditionTruth === 'unknown') return true
  if (task.clauseRole === 'unclassified') return true
  if (task.semantics.speechAct === 'unknown'
    || task.semantics.actor === 'unknown'
    || task.semantics.polarity === 'uncertain'
    || task.semantics.tense === 'unknown'
    || task.semantics.status === 'unknown'
    || task.semantics.validity === 'uncertain'
    || task.semantics.modality === 'unknown') return true
  return false
}

function candidateCouldStillRequire(candidate: LocalActionCandidate): boolean {
  return candidate.localDisposition !== 'local_non_task'
    && candidate.clauseRole !== 'condition_antecedent'
    && candidate.clauseRole !== 'assertion'
    && candidate.clauseRole !== 'quoted_or_example'
    && candidate.currentness !== 'historical'
    && candidate.currentness !== 'completed'
}

export function deriveThreeValuedActionability(
  index: ImmutableScopeIndex,
  catalog: LocalActionCandidateCatalog,
  composition: ActionCandidateComposition,
  result: CandidateTaskSafetyResult,
  adjudication: FullPropositionAdjudication,
): ThreeValuedActionabilityDecision {
  if (index.sourceId !== catalog.sourceId
    || result.sourceId !== catalog.sourceId
    || composition.sourceId !== catalog.sourceId
    || adjudication.sourceId !== catalog.sourceId
    || index.sourceVersionId !== catalog.sourceVersionId
    || result.sourceVersionId !== catalog.sourceVersionId
    || composition.sourceVersionId !== catalog.sourceVersionId
    || adjudication.sourceVersionId !== catalog.sourceVersionId
    || index.sourceFingerprint !== catalog.sourceFingerprint
    || result.sourceFingerprint !== catalog.sourceFingerprint
    || composition.sourceFingerprint !== catalog.sourceFingerprint
    || adjudication.sourceFingerprint !== catalog.sourceFingerprint
    || composition.catalogFingerprint !== catalog.catalogFingerprint
    || adjudication.catalogFingerprint !== catalog.catalogFingerprint) {
    throw new Error('ACTIONABILITY_SOURCE_OR_CATALOG_BINDING_MISMATCH')
  }

  const tasks = taskEvidence(result)
  const taskByCandidateId = new Map(tasks.map((task) => [task.originCandidateId, task]))
  const candidateById = new Map(catalog.candidates.map((candidate) => [candidate.id, candidate]))
  const judgmentByCandidateId = new Map(adjudication.judgments.map((judgment) => [judgment.candidateId, judgment]))
  const quarantinedCandidates = composition.ledger
    .filter((entry) => entry.status === 'quarantined')
    .map((entry) => candidateById.get(entry.candidateId))
    .filter((candidate): candidate is LocalActionCandidate => Boolean(candidate))
  const revisionResolution = resolveCandidateRevisionRelations(
    index,
    tasks,
    quarantinedCandidates.map((candidate) => ({
      scopeId: candidate.scopeId,
      actionSourceStart: candidate.action.sourceStart,
      currentness: candidate.currentness,
    })),
    new Set(composition.diagnostics.unresolvedActionScopeIds),
  )
  const unresolvedRevisionTargets = new Set(revisionResolution.unresolvedPossibleTargetTaskIds)
  const unresolvedCurrentRevisionTaskIds = tasks
    .filter((task) => unresolvedRevisionTargets.has(task.id) && taskCouldStillRequire(task))
    .map((task) => task.id)
  const currentObligationTaskIds = tasks
    .filter((task) => isCurrentRequired(task) && !unresolvedRevisionTargets.has(task.id))
    .map((task) => task.id)

  const candidateAtoms: CandidateActionabilityAtom[] = catalog.candidates.map((candidate) => {
    const task = taskByCandidateId.get(candidate.id)
    const judgment = judgmentByCandidateId.get(candidate.id)
    const ledger = composition.ledger.find((entry) => entry.candidateId === candidate.id)
    const evidenceScopeIds = unique([...(judgment?.evidenceScopeIds ?? []), ...(task?.propositionScopeIds ?? [candidate.scopeId])])
    if (judgment?.actionabilityAtom === 'genuinely_unknown') {
      return { candidateId: candidate.id, atom: 'genuinely_unknown', taskId: task?.id ?? null, evidenceScopeIds, reasons: ['DUTY_EXISTENCE_EXPLICITLY_UNKNOWN'] }
    }
    if (task && isCurrentRequired(task) && !unresolvedRevisionTargets.has(task.id)) {
      return { candidateId: candidate.id, atom: 'definitely_required', taskId: task.id, evidenceScopeIds, reasons: ['CURRENT_SUPPORTED_REQUIRED_PROPOSITION'] }
    }
    if ((task && (taskCouldStillRequire(task) || unresolvedRevisionTargets.has(task.id)))
      || (ledger?.status === 'quarantined' && candidateCouldStillRequire(candidate))) {
      return { candidateId: candidate.id, atom: 'genuinely_unknown', taskId: task?.id ?? null, evidenceScopeIds, reasons: ['POTENTIAL_CURRENT_OBLIGATION_UNRESOLVED'] }
    }
    return { candidateId: candidate.id, atom: 'definitely_not_required', taskId: task?.id ?? null, evidenceScopeIds, reasons: ['CANDIDATE_EXCLUDED_FROM_CURRENT_REQUIRED_PROPOSITIONS'] }
  })
  const unresolvedCandidateIds = candidateAtoms.filter((item) => item.atom === 'genuinely_unknown').map((item) => item.candidateId)
  const unresolvedActionScopeIds = [...composition.diagnostics.unresolvedActionScopeIds]
  const hasRequired = currentObligationTaskIds.length > 0
  const hasUnknown = unresolvedCandidateIds.length > 0
    || unresolvedActionScopeIds.length > 0
    || unresolvedCurrentRevisionTaskIds.length > 0
  const value: ActionabilityValue = hasRequired ? true : hasUnknown ? null : false
  return {
    schemaVersion: 'three-valued-actionability-decision-1.0.0',
    policyVersion: THREE_VALUED_ACTIONABILITY_VERSION,
    sourceId: catalog.sourceId,
    sourceVersionId: catalog.sourceVersionId,
    sourceFingerprint: catalog.sourceFingerprint,
    value,
    proof: hasRequired
      ? 'CURRENT_OBLIGATION_EXISTS'
      : hasUnknown ? 'UNRESOLVED_POTENTIAL_OBLIGATION' : 'ALL_POTENTIAL_OBLIGATIONS_EXCLUDED',
    candidateAtoms,
    currentObligationTaskIds,
    unresolvedCandidateIds,
    unresolvedActionScopeIds,
    unresolvedCurrentRevisionTaskIds,
    selectedFieldConsumed: false,
  }
}

export function validateThreeValuedActionability(
  decision: ThreeValuedActionabilityDecision,
  index: ImmutableScopeIndex,
  catalog: LocalActionCandidateCatalog,
  composition: ActionCandidateComposition,
  result: CandidateTaskSafetyResult,
  adjudication: FullPropositionAdjudication,
): string[] {
  try {
    const expected = deriveThreeValuedActionability(index, catalog, composition, result, adjudication)
    return jsonStructurallyEqual(decision, expected) ? [] : ['ACTIONABILITY_DECISION_NOT_DERIVED']
  } catch (error) {
    return [error instanceof Error ? error.message : 'ACTIONABILITY_DECISION_VALIDATION_FAILED']
  }
}
