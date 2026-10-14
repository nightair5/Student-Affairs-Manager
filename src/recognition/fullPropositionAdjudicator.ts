import type { ActionCandidateComposition, CandidateLedgerStatus } from './actionCandidateComposerV2'
import type { LocalActionCandidate, LocalActionCandidateCatalog } from './localActionCandidateIndexV2'
import type { ImmutableScope, ImmutableScopeIndex } from './scopeReferenceContract'
import { jsonStructurallyEqual } from './jsonStructuralEqual'
import {
  DIRECTIVE_GOVERNOR_PROOF_VERSION,
  containsDirectiveGovernorMarker,
  proveDirectDirectiveGovernor,
  type DirectiveGovernorProof,
} from './directiveGovernorProof'

export const FULL_PROPOSITION_ADJUDICATOR_VERSION = 'full-proposition-adjudicator-1.1.0-rco-5-010-e1' as const

export type PropositionActionabilityAtom = 'definitely_not_required' | 'genuinely_unknown' | 'none'
export type FullPropositionOutcome = 'confirmed_non_task' | 'unresolved_task_force' | 'no_override'

export interface FullPropositionJudgment {
  candidateId: string
  scopeId: string
  actionSourceStart: number
  actionSourceEnd: number
  outcome: FullPropositionOutcome
  actionabilityAtom: PropositionActionabilityAtom
  matrixPredicate: string | null
  directiveGovernorProof: DirectiveGovernorProof | null
  evidenceScopeIds: string[]
  reasons: string[]
}

export interface ResolvedNonActionScope {
  scopeId: string
  evidenceScopeIds: string[]
  reasons: string[]
}

export interface FullPropositionAdjudication {
  schemaVersion: 'full-proposition-adjudication-1.1.0'
  adjudicatorVersion: typeof FULL_PROPOSITION_ADJUDICATOR_VERSION
  directiveGovernorPolicyVersion: typeof DIRECTIVE_GOVERNOR_PROOF_VERSION
  sourceId: string
  sourceVersionId: string
  sourceFingerprint: string
  catalogFingerprint: string
  judgments: FullPropositionJudgment[]
  confirmedNonTaskCandidateIds: string[]
  genuinelyUnknownCandidateIds: string[]
  resolvedNonActionScopes: ResolvedNonActionScope[]
  resolvedNonActionScopeIds: string[]
}

export interface AdjudicatedCandidateComposition {
  adjudication: FullPropositionAdjudication
  composition: ActionCandidateComposition
}

const INFORMATION_MATRIX_TAIL_RE = /(?<predicate>尚未说明|仍未说明|未予说明|没有说明|有待说明|仍不明确|尚不明确|仍不清楚|尚不清楚|仍待明确)\s*[。！？!?]?\s*$/u
const INFORMATION_MATRIX_ANY_RE = /(?<predicate>尚未说明|仍未说明|未予说明|没有说明|有待说明|仍不明确|尚不明确|仍不清楚|尚不清楚|仍待明确)/u
const UNKNOWN_DUTY_FRAME_RE = /(?:是否|能否|可否|要不要|有没有)\s*(?:需要|必须|应当|应该|须|应|要求|可以|可)?[^，,。；;！？!?：:]{0,16}$/u
const EMBEDDING_GOVERNOR_RE = /(?:询问|记录|记载|提到|说明|显示|写明|确认|明确|决定|公布)[^，,。；;！？!?：:]{0,12}(?:是否|能否|可否|要不要|有没有)\s*(?:需要|必须|应当|应该|须|应|要求|可以|可)?[^，,。；;！？!?：:]{0,12}$/u
const REPORTING_GOVERNOR_RE = /(?:报告|通知|文件|原文|说明|记录|档案|消息|有人|老师|系统)[^，,。；;！？!?：:]{0,12}(?:询问|记录|记载|提到|说明|显示|写明)\s*$/u
const CLAUSE_BOUNDARY_RE = /[，,。；;！？!?：:]/u
const STRONG_BOUNDARY_RE = /[。；;！？!?]\s*$/u
const QUESTION_END_RE = /(?:吗|么|呢)\s*[，,。；;：:？?]?\s*$|[？?]\s*$/u
const EXPLICIT_NON_INSTRUCTION_SCOPE_RE = /^(?:(?:这|此|上述|前述)(?:些|项|段|条|内容|文字|说法)?|该内容)?\s*(?:并)?(?:不是|并非|不构成)\s*(?:本次|当前)?(?:正式)?(?:安排|要求|指令|任务|操作要求|办理要求)\s*[。！？!?]?$/u
const FORWARD_DIRECTIVE_CONTEXT_RE = /^(?:从现在起|自现在起|即日起|自即日起|此后|后续|新的要求是|最新要求是|现行要求是|当前要求是)\s*[，,:：]\s*$/u

function unique<T>(values: T[]): T[] { return [...new Set(values)] }

interface PropositionWindow {
  text: string
  scopeIds: string[]
  actionStart: number
  actionEnd: number
}

function propositionWindow(index: ImmutableScopeIndex, scope: ImmutableScope, candidate: LocalActionCandidate): PropositionWindow {
  const position = index.scopes.findIndex((item) => item.id === scope.id)
  let start = position
  let end = position
  const paragraphBoundaryAfter = (order: number) => /[\r\n]/u.test(index.sourceContent.slice(index.scopes[order].end, index.scopes[order + 1].start))
  while (start > 0 && !STRONG_BOUNDARY_RE.test(index.scopes[start - 1].text) && !paragraphBoundaryAfter(start - 1)) start -= 1
  while (end < index.scopes.length - 1 && !STRONG_BOUNDARY_RE.test(index.scopes[end].text) && !paragraphBoundaryAfter(end)) end += 1
  const scopes = index.scopes.slice(start, end + 1)
  const sourceStart = scopes[0].start
  return {
    text: index.sourceContent.slice(sourceStart, scopes[scopes.length - 1].end),
    scopeIds: scopes.map((item) => item.id),
    actionStart: candidate.action.sourceStart - sourceStart,
    actionEnd: candidate.action.sourceEnd - sourceStart,
  }
}

function localClausePrefix(window: PropositionWindow): string {
  const prefix = window.text.slice(0, window.actionStart)
  let boundary = -1
  for (let index = 0; index < prefix.length; index += 1) {
    if (CLAUSE_BOUNDARY_RE.test(prefix[index])) boundary = index
  }
  return prefix.slice(boundary + 1).trim()
}

function informationMatrixPredicate(window: PropositionWindow): string | null {
  const suffix = window.text.slice(window.actionEnd)
  return suffix.match(INFORMATION_MATRIX_TAIL_RE)?.groups?.predicate
    ?? window.text.slice(0, window.actionStart).match(INFORMATION_MATRIX_ANY_RE)?.groups?.predicate
    ?? null
}

function unknownDutyFrame(prefix: string): boolean {
  return UNKNOWN_DUTY_FRAME_RE.test(prefix)
}

function actionNominalizedAsMatrixSubject(window: PropositionWindow): boolean {
  const suffix = window.text.slice(window.actionEnd)
  return /^[^，,。；;！？!?：:]{0,24}(?:的)?(?:结果|情况|状态|结论)(?:尚未说明|仍未说明|未予说明|没有说明|有待说明|仍不明确|尚不明确|仍不清楚|尚不清楚|仍待明确)\s*[。！？!?]?\s*$/u.test(suffix)
}

function actionHasUnprovedOuterForce(window: PropositionWindow): boolean {
  const prefix = window.text.slice(0, window.actionStart)
  const colonPosition = Math.max(prefix.lastIndexOf('：'), prefix.lastIndexOf(':'))
  // A colon introduces an outer frame. Its authority cannot be inferred from
  // the inner imperative. Question force also outranks an inner 请.
  const suffix = window.text.slice(window.actionEnd)
  const nextBoundary = suffix.search(CLAUSE_BOUNDARY_RE)
  const ownClauseSuffix = nextBoundary < 0 ? suffix : suffix.slice(0, nextBoundary + 1)
  return colonPosition >= 0 || QUESTION_END_RE.test(ownClauseSuffix)
}

function judgeCandidate(index: ImmutableScopeIndex, scope: ImmutableScope | undefined, candidate: LocalActionCandidate): FullPropositionJudgment {
  const base = {
    candidateId: candidate.id,
    scopeId: candidate.scopeId,
    actionSourceStart: candidate.action.sourceStart,
    actionSourceEnd: candidate.action.sourceEnd,
  }
  if (!scope) {
    return { ...base, outcome: 'no_override', actionabilityAtom: 'none', matrixPredicate: null, directiveGovernorProof: null, evidenceScopeIds: [], reasons: ['PROPOSITION_SCOPE_MISSING'] }
  }
  if (candidate.localDisposition === 'local_non_task') {
    return { ...base, outcome: 'no_override', actionabilityAtom: 'none', matrixPredicate: null, directiveGovernorProof: null, evidenceScopeIds: [scope.id], reasons: ['CANDIDATE_ALREADY_LOCAL_NON_TASK'] }
  }
  if (candidate.currentness === 'historical' || candidate.currentness === 'completed') {
    return { ...base, outcome: 'no_override', actionabilityAtom: 'none', matrixPredicate: null, directiveGovernorProof: null, evidenceScopeIds: [scope.id], reasons: ['CANDIDATE_ALREADY_NON_CURRENT'] }
  }
  const window = propositionWindow(index, scope, candidate)
  const prefix = localClausePrefix(window)
  const matrixPredicate = informationMatrixPredicate(window)
  const dutyUnknown = unknownDutyFrame(prefix)
  const directiveGovernorProof = proveDirectDirectiveGovernor(prefix)
  const embeddedByOuterPredicate = EMBEDDING_GOVERNOR_RE.test(prefix)
  if (actionHasUnprovedOuterForce(window)) {
    return {
      ...base,
      outcome: 'unresolved_task_force',
      actionabilityAtom: 'genuinely_unknown',
      matrixPredicate,
      directiveGovernorProof,
      evidenceScopeIds: window.scopeIds,
      reasons: ['OUTER_SENTENCE_FORCE_NOT_PROVEN', 'SAFE_DEFAULT_SELECTION_BLOCKED'],
    }
  }
  const nominalizedMatrix = matrixPredicate && actionNominalizedAsMatrixSubject(window)
  if (nominalizedMatrix && directiveGovernorProof.governed) {
    return {
      ...base,
      outcome: 'unresolved_task_force',
      actionabilityAtom: 'genuinely_unknown',
      matrixPredicate,
      directiveGovernorProof,
      evidenceScopeIds: window.scopeIds,
      reasons: ['NOMINALIZED_MATRIX_COMPETES_WITH_DIRECTIVE', 'SAFE_DEFAULT_SELECTION_BLOCKED'],
    }
  }
  if (!dutyUnknown && directiveGovernorProof.governed) {
    return {
      ...base,
      outcome: 'no_override',
      actionabilityAtom: 'none',
      matrixPredicate,
      directiveGovernorProof,
      evidenceScopeIds: window.scopeIds,
      reasons: ['DIRECTIVE_GOVERNS_ACTION_BEFORE_INFORMATION_TAIL'],
    }
  }
  if (nominalizedMatrix) {
    return {
      ...base,
      outcome: 'confirmed_non_task',
      actionabilityAtom: 'definitely_not_required',
      matrixPredicate,
      directiveGovernorProof,
      evidenceScopeIds: window.scopeIds,
      reasons: ['ACTION_NOMINALIZED_AS_MATRIX_SUBJECT', 'ACTION_NOT_GOVERNED_BY_DIRECTIVE'],
    }
  }
  if (containsDirectiveGovernorMarker(prefix) && !directiveGovernorProof.governed && !(dutyUnknown && embeddedByOuterPredicate)) {
    return {
      ...base,
      outcome: 'unresolved_task_force',
      actionabilityAtom: 'genuinely_unknown',
      matrixPredicate,
      directiveGovernorProof,
      evidenceScopeIds: window.scopeIds,
      reasons: ['DIRECT_GOVERNANCE_NOT_PROVEN', 'SAFE_DEFAULT_SELECTION_BLOCKED'],
    }
  }
  const reportedContent = REPORTING_GOVERNOR_RE.test(prefix)
  if (!dutyUnknown && !embeddedByOuterPredicate && !(reportedContent && matrixPredicate)) {
    return {
      ...base,
      outcome: 'no_override',
      actionabilityAtom: 'none',
      matrixPredicate,
      directiveGovernorProof,
      evidenceScopeIds: window.scopeIds,
      reasons: [matrixPredicate ? 'INFORMATION_TAIL_WITH_AMBIGUOUS_ACTION_SCOPE' : 'NO_INFORMATION_STATE_MATRIX_PREDICATE'],
    }
  }
  const dutyTruthUnresolved = dutyUnknown && (!embeddedByOuterPredicate || Boolean(matrixPredicate))
  return {
    ...base,
    outcome: 'confirmed_non_task',
    actionabilityAtom: dutyTruthUnresolved ? 'genuinely_unknown' : 'definitely_not_required',
    matrixPredicate,
    directiveGovernorProof,
    evidenceScopeIds: window.scopeIds,
    reasons: dutyTruthUnresolved
      ? ['FULL_SCOPE_INFORMATION_STATE_ASSERTION', 'DUTY_EXISTENCE_EXPLICITLY_UNKNOWN']
      : ['ACTION_EMBEDDED_UNDER_OUTER_INFORMATION_PREDICATE', 'ACTION_NOT_GOVERNED_BY_DIRECTIVE'],
  }
}

export function adjudicateFullPropositions(
  index: ImmutableScopeIndex,
  catalog: LocalActionCandidateCatalog,
): FullPropositionAdjudication {
  if (index.sourceId !== catalog.sourceId
    || index.sourceVersionId !== catalog.sourceVersionId
    || index.sourceFingerprint !== catalog.sourceFingerprint) {
    throw new Error('FULL_PROPOSITION_SOURCE_BINDING_MISMATCH')
  }
  const scopes = new Map(index.scopes.map((scope) => [scope.id, scope]))
  const judgments = catalog.candidates.map((candidate) => judgeCandidate(index, scopes.get(candidate.scopeId), candidate))
  const unresolvedScopeIds = new Set(catalog.unresolvedActionScopeIds)
  const resolvedNonActionScopes = index.scopes.flatMap((scope): ResolvedNonActionScope[] => {
    if (!unresolvedScopeIds.has(scope.id)) return []
    if (EXPLICIT_NON_INSTRUCTION_SCOPE_RE.test(scope.text.trim())) {
      return [{ scopeId: scope.id, evidenceScopeIds: [scope.id], reasons: ['EXPLICIT_NON_INSTRUCTION_ASSERTION'] }]
    }
    if (!FORWARD_DIRECTIVE_CONTEXT_RE.test(scope.text.trim())) return []
    const nextScope = index.scopes.find((item) => item.order === scope.order + 1)
    const governedCandidates = nextScope
      ? catalog.candidates.filter((candidate) => candidate.scopeId === nextScope.id
        && candidate.localDisposition !== 'local_non_task'
        && candidate.currentness === 'current')
      : []
    return nextScope && governedCandidates.length > 0
      ? [{
          scopeId: scope.id,
          evidenceScopeIds: [scope.id, nextScope.id],
          reasons: ['FORWARD_DIRECTIVE_CONTEXT_BOUND_TO_CURRENT_CANDIDATE'],
        }]
      : []
  })
  return {
    schemaVersion: 'full-proposition-adjudication-1.1.0',
    adjudicatorVersion: FULL_PROPOSITION_ADJUDICATOR_VERSION,
    directiveGovernorPolicyVersion: DIRECTIVE_GOVERNOR_PROOF_VERSION,
    sourceId: catalog.sourceId,
    sourceVersionId: catalog.sourceVersionId,
    sourceFingerprint: catalog.sourceFingerprint,
    catalogFingerprint: catalog.catalogFingerprint,
    judgments,
    confirmedNonTaskCandidateIds: judgments.filter((item) => item.outcome === 'confirmed_non_task').map((item) => item.candidateId),
    genuinelyUnknownCandidateIds: judgments.filter((item) => item.actionabilityAtom === 'genuinely_unknown').map((item) => item.candidateId),
    resolvedNonActionScopes,
    resolvedNonActionScopeIds: resolvedNonActionScopes.map((item) => item.scopeId),
  }
}

function ledgerCounts(ledger: ActionCandidateComposition['ledger']): Record<CandidateLedgerStatus, number> {
  return {
    accepted_local: ledger.filter((entry) => entry.status === 'accepted_local').length,
    accepted_model: ledger.filter((entry) => entry.status === 'accepted_model').length,
    ignored_local: ledger.filter((entry) => entry.status === 'ignored_local').length,
    ignored_model: ledger.filter((entry) => entry.status === 'ignored_model').length,
    quarantined: ledger.filter((entry) => entry.status === 'quarantined').length,
  }
}

export function applyFullPropositionAdjudication(
  index: ImmutableScopeIndex,
  catalog: LocalActionCandidateCatalog,
  composition: ActionCandidateComposition,
  adjudication: FullPropositionAdjudication = adjudicateFullPropositions(index, catalog),
): AdjudicatedCandidateComposition {
  const expectedAdjudication = adjudicateFullPropositions(index, catalog)
  if (!jsonStructurallyEqual(adjudication, expectedAdjudication)) throw new Error('FULL_PROPOSITION_ADJUDICATION_NOT_DERIVED')
  if (composition.sourceId !== catalog.sourceId
    || composition.sourceVersionId !== catalog.sourceVersionId
    || composition.sourceFingerprint !== catalog.sourceFingerprint
    || composition.catalogFingerprint !== catalog.catalogFingerprint) {
    throw new Error('FULL_PROPOSITION_COMPOSITION_BINDING_MISMATCH')
  }
  const confirmed = new Set(adjudication.confirmedNonTaskCandidateIds)
  const unresolvedTaskForce = new Set(adjudication.judgments
    .filter((item) => item.outcome === 'unresolved_task_force')
    .map((item) => item.candidateId))
  const ledger = composition.ledger.map((entry) => {
    if (confirmed.has(entry.candidateId)) return {
        ...entry,
        anchorId: null,
        status: 'ignored_local' as const,
        objectCandidateId: null,
        reasons: unique([...entry.reasons, 'FULL_PROPOSITION_CONFIRMED_NON_TASK']),
      }
    if (unresolvedTaskForce.has(entry.candidateId)) return {
      ...entry,
      anchorId: null,
      status: 'quarantined' as const,
      objectCandidateId: null,
      reasons: unique([...entry.reasons, 'DIRECTIVE_GOVERNANCE_UNRESOLVED']),
    }
    return { ...entry, reasons: [...entry.reasons] }
  })
  const directives = composition.reduced.directives.filter((directive) => !confirmed.has(directive.anchorId)
    && !unresolvedTaskForce.has(directive.anchorId))
  const usedScopeIds = new Set(directives.flatMap((directive) => directive.propositionScopeIds))
  const counts = ledgerCounts(ledger)
  const resolvedNonActionScopeIds = new Set(adjudication.resolvedNonActionScopeIds)
  const unresolvedActionScopeIds = catalog.unresolvedActionScopeIds.filter((scopeId) => !resolvedNonActionScopeIds.has(scopeId))
  const semanticCoverageComplete = composition.responseContractComplete
    && counts.quarantined === 0
    && unresolvedActionScopeIds.length === 0
  const transformed: ActionCandidateComposition = {
    ...composition,
    status: semanticCoverageComplete ? 'complete' : 'partial',
    semanticCoverageComplete,
    reduced: {
      ...composition.reduced,
      directives,
      ignoredScopeIds: index.scopes.filter((scope) => !usedScopeIds.has(scope.id)).map((scope) => scope.id),
    },
    ledger,
    diagnostics: {
      ...composition.diagnostics,
      acceptedLocal: counts.accepted_local,
      acceptedModel: counts.accepted_model,
      ignoredLocal: counts.ignored_local,
      ignoredModel: counts.ignored_model,
      quarantined: counts.quarantined,
      unresolvedActionScopeIds,
    },
  }
  return { adjudication, composition: transformed }
}

export function validateAdjudicatedCandidateComposition(
  value: AdjudicatedCandidateComposition,
  index: ImmutableScopeIndex,
  catalog: LocalActionCandidateCatalog,
  originalComposition: ActionCandidateComposition,
): string[] {
  try {
    const expected = applyFullPropositionAdjudication(index, catalog, originalComposition)
    return jsonStructurallyEqual(value, expected) ? [] : ['ADJUDICATED_COMPOSITION_NOT_DERIVED']
  } catch (error) {
    return [error instanceof Error ? error.message : 'ADJUDICATED_COMPOSITION_VALIDATION_FAILED']
  }
}
