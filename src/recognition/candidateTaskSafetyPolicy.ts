import type { ActionCandidateComposition, CandidateLedgerEntry } from './actionCandidateComposerV2'
import {
  type LocalActionCandidate,
  type LocalActionCandidateCatalog,
  type LocalClauseRole,
  type LocalCurrentness,
} from './localActionCandidateIndexV2'
import type { ImmutableScope, ImmutableScopeIndex, ScopeReferenceSemantics } from './scopeReferenceContract'
import {
  CANDIDATE_REVISION_RELATION_RESOLVER_VERSION,
  resolveCandidateRevisionRelations,
} from './candidateRevisionRelationResolver'
import type { LocalRevisionRelation } from './revisionRelationResolver'
import {
  type LocalTaskFormationIssue,
  type LocalTaskSuggestion,
} from './taskFormationPolicyV2'

export const CANDIDATE_TASK_SAFETY_SCHEMA_VERSION = 'candidate-task-safety-result-2.0.0' as const
export const CANDIDATE_TASK_SAFETY_POLICY_VERSION = 'candidate-task-safety-policy-2.0.0' as const

type ConditionTruth = LocalActionCandidate['conditionAttachment']['truth']

export interface CandidateBoundTaskSuggestion extends LocalTaskSuggestion {
  originCandidateId: string
  occurrenceId: string
  actionSourceStart: number
  actionSourceEnd: number
  objectCandidateId: string
  objectSourceStart: number
  objectSourceEnd: number
  clauseRole: LocalClauseRole
  currentness: LocalCurrentness
  conditionTruth: ConditionTruth
  conditionStatus: LocalActionCandidate['conditionAttachment']['status']
}

export interface CandidateTaskSafetyResult {
  schemaVersion: typeof CANDIDATE_TASK_SAFETY_SCHEMA_VERSION
  policyVersion: typeof CANDIDATE_TASK_SAFETY_POLICY_VERSION
  candidateCatalogPolicyVersion: LocalActionCandidateCatalog['policyVersion']
  sourceId: string
  sourceVersionId: string
  sourceFingerprint: string
  catalogFingerprint: string
  producerRunId: string
  requiresAction: boolean | null
  tasks: CandidateBoundTaskSuggestion[]
  observations: []
  ignoredScopeIds: string[]
  generatedLocally: {
    taskBoundaries: true
    semantics: true
    requiresAction: true
    selected: true
    explanationOwnership: true
    candidateIdentity: true
    occurrenceSpans: true
  }
  modelAuthorityFieldsUsed: []
  diagnostics: {
    inputDirectiveAnchors: number
    outputTasks: number
    mergedActionAnchors: 0
    promotedHistoricalDirectives: number
    attachedExplanationScopes: number
    acceptedCandidates: number
    ignoredCandidates: number
    quarantinedCandidates: number
    possiblyRequiredUnknowns: number
  }
  semanticEvidenceMode: 'candidate_occurrence_clause_role_currentness_and_condition'
  candidateEvidenceMode: 'closed_candidate_object_and_independent_safe_default'
  revisionResolverVersion: typeof CANDIDATE_REVISION_RELATION_RESOLVER_VERSION
  revisionRelations: LocalRevisionRelation[]
  unresolvedRevisionScopeIds: string[]
  responseContractComplete: boolean
  semanticCoverageComplete: boolean
  revisionCoverageComplete: boolean
  suppressedRevisionScopeIds: string[]
  defaultSelectionBlockedTaskIds: string[]
  unsafeDefaultSelections: string[]
}

interface BoundCandidate {
  candidate: LocalActionCandidate
  ledger: CandidateLedgerEntry
  object: LocalActionCandidate['objectCandidates'][number]
}

const DIRECTIVE_MARKER_RE = /(?:必须|务必|应当|应该|须|请|需要|不得|禁止|无需|不用|不需要|可以|可自行|自愿|按需|只需|要求|从现在起|现改为|调整为|变更为|修订为|更改为)/u
const DIRECT_NEGATIVE_RE = /(?:不得|禁止|无需|不用|不需要|暂勿|暂缓|先不要|不要求|不强制)/u
const OPTIONAL_RE = /(?:可以|可自行|自愿|按需)/u
const THIRD_PARTY_SUBJECT_RE = /(?:系统|平台|服务器|机器人|老师|辅导员|管理员|供应商|承办方|主办方).{0,12}(?:须|需|需要|应当|应该|必须|要求)/u
const GROUP_SUBJECT_RE = /(?:同学|人员|成员|全体|大家|获批免交者|旁听者|其余人).{0,12}(?:须|需|需要|应当|应该|必须|要求)/u

function unique<T>(values: T[]): T[] { return [...new Set(values)] }

function effectFor(actionType: LocalTaskSuggestion['actionType']): LocalTaskSuggestion['effect'] {
  if (['submit', 'upload', 'send'].includes(actionType)) return 'external_transfer'
  if (['contact', 'register', 'pay'].includes(actionType)) return 'external_interaction'
  if (['attend', 'carry', 'print', 'sign'].includes(actionType)) return 'physical_action'
  if (['review', 'complete', 'fill', 'prepare', 'save', 'collect'].includes(actionType)) return 'local_change'
  return 'unknown'
}

function scopeMap(index: ImmutableScopeIndex): Map<string, ImmutableScope> {
  return new Map(index.scopes.map((scope) => [scope.id, scope]))
}

function localPrefix(candidate: LocalActionCandidate, catalog: LocalActionCandidateCatalog, scopes: Map<string, ImmutableScope>): string {
  const scope = scopes.get(candidate.scopeId)
  if (!scope) return ''
  const previous = catalog.candidates
    .filter((item) => item.scopeId === candidate.scopeId && item.action.endInScope <= candidate.action.startInScope)
    .sort((left, right) => right.action.endInScope - left.action.endInScope)[0]
  return scope.text.slice(previous?.action.endInScope ?? 0, candidate.action.startInScope)
}

function actorFor(prefix: string): ScopeReferenceSemantics['actor'] {
  const markerOffset = prefix.search(DIRECTIVE_MARKER_RE)
  const subject = prefix.slice(0, markerOffset >= 0 ? markerOffset : prefix.length)
  if (THIRD_PARTY_SUBJECT_RE.test(prefix) || /(?:系统|平台|服务器|机器人)$/u.test(subject.trim())) return 'third_party'
  if (GROUP_SUBJECT_RE.test(prefix) || /(?:同学|人员|成员|全体|大家)$/u.test(subject.trim()) || OPTIONAL_RE.test(prefix)) return 'addressed_group'
  return 'addressee'
}

function semanticsFor(
  candidate: LocalActionCandidate,
  catalog: LocalActionCandidateCatalog,
  scopes: Map<string, ImmutableScope>,
): ScopeReferenceSemantics {
  const prefix = localPrefix(candidate, catalog, scopes)
  const actor = actorFor(prefix)
  const optional = OPTIONAL_RE.test(prefix)
  const negative = DIRECT_NEGATIVE_RE.test(prefix)
  const modality: ScopeReferenceSemantics['modality'] = optional ? 'optional' : 'required'

  if (candidate.clauseRole !== 'directive') {
    return { actor: 'unknown', speechAct: 'unknown', polarity: 'uncertain', tense: 'unknown', status: 'unknown', validity: 'uncertain', modality: 'unknown' }
  }
  if (candidate.currentness === 'completed') {
    return { actor, speechAct: 'directive', polarity: 'affirmative', tense: 'past', status: 'completed', validity: 'active', modality }
  }
  if (candidate.currentness === 'historical') {
    return { actor, speechAct: 'directive', polarity: 'affirmative', tense: 'past', status: 'unknown', validity: 'uncertain', modality }
  }
  if (candidate.currentness === 'unknown') {
    return { actor, speechAct: 'unknown', polarity: 'uncertain', tense: 'unknown', status: 'unknown', validity: 'uncertain', modality: 'unknown' }
  }
  if (candidate.conditionAttachment.truth === 'false' || candidate.conditionAttachment.truth === 'unknown') {
    return { actor, speechAct: 'hypothetical', polarity: 'uncertain', tense: 'future', status: 'unknown', validity: 'uncertain', modality }
  }
  return {
    actor,
    speechAct: 'directive',
    polarity: negative ? 'negative' : 'affirmative',
    tense: 'future',
    status: negative ? 'cancelled' : 'pending',
    validity: 'active',
    modality,
  }
}

function currentRequired(semantics: ScopeReferenceSemantics): boolean {
  return (semantics.actor === 'addressee' || semantics.actor === 'addressed_group')
    && semantics.speechAct === 'directive'
    && semantics.polarity === 'affirmative'
    && semantics.tense === 'future'
    && semantics.status === 'pending'
    && semantics.validity === 'active'
    && semantics.modality === 'required'
}

function maySelect(task: Pick<CandidateBoundTaskSuggestion, 'semantics' | 'effect' | 'actionType' | 'conditionTruth' | 'clauseRole' | 'currentness'>): boolean {
  if (task.clauseRole !== 'directive' || task.currentness !== 'current') return false
  if (task.conditionTruth !== 'none' && task.conditionTruth !== 'true') return false
  if (!currentRequired(task.semantics) || task.semantics.actor !== 'addressee') return false
  if (task.effect === 'local_change') return task.actionType !== 'other'
  return task.effect === 'physical_action' && ['carry', 'print'].includes(task.actionType)
}

function acceptedCandidates(catalog: LocalActionCandidateCatalog, composition: ActionCandidateComposition): BoundCandidate[] {
  const candidateById = new Map(catalog.candidates.map((candidate) => [candidate.id, candidate]))
  const acceptedEntries = composition.ledger.filter((ledger) => ledger.status === 'accepted_local' || ledger.status === 'accepted_model')
  const bindings = acceptedEntries.flatMap((ledger) => {
    const candidate = candidateById.get(ledger.candidateId)
    const object = candidate?.objectCandidates.find((item) => item.id === ledger.objectCandidateId)
    return candidate && object ? [{ candidate, ledger, object }] : []
  })
  if (bindings.length !== acceptedEntries.length
    || new Set(acceptedEntries.map((entry) => entry.candidateId)).size !== acceptedEntries.length) {
    throw new Error('P5_ACCEPTED_CANDIDATE_BINDING_NOT_BIJECTIVE')
  }
  return bindings.sort((left, right) => left.candidate.action.sourceStart - right.candidate.action.sourceStart)
}

function baseTask(
  binding: BoundCandidate,
  catalog: LocalActionCandidateCatalog,
  scopes: Map<string, ImmutableScope>,
): CandidateBoundTaskSuggestion {
  const { candidate, ledger, object } = binding
  const semantics = semanticsFor(candidate, catalog, scopes)
  return {
    id: `task:${candidate.id}`,
    originCandidateId: candidate.id,
    occurrenceId: candidate.id,
    actionSourceStart: candidate.action.sourceStart,
    actionSourceEnd: candidate.action.sourceEnd,
    objectCandidateId: object.id,
    objectSourceStart: object.sourceStart,
    objectSourceEnd: object.sourceEnd,
    clauseRole: candidate.clauseRole,
    currentness: candidate.currentness,
    conditionTruth: candidate.conditionAttachment.truth,
    conditionStatus: candidate.conditionAttachment.status,
    propositionScopeIds: unique([...candidate.propositionScopeIds, object.scopeId])
      .sort((left, right) => (scopes.get(left)?.order ?? 0) - (scopes.get(right)?.order ?? 0)),
    action: { scopeId: candidate.action.scopeId, surface: candidate.action.surface },
    object: { scopeId: object.scopeId, surface: object.surface },
    steps: [],
    actionType: candidate.action.actionType,
    effect: effectFor(candidate.action.actionType),
    semantics,
    inferenceLevel: 'explicit',
    timeRefs: [],
    materialRefs: [],
    eventRef: null,
    locationRef: null,
    revisionRefs: [],
    selected: false,
    needsConfirmation: true,
    policyReasons: unique([
      ...ledger.reasons,
      'P5_TASK_FROM_ACCEPTED_CANDIDATE_ID',
      'P5_ACTION_FROM_CANDIDATE_OCCURRENCE_SPAN',
      'P5_OBJECT_FROM_OWNED_CANDIDATE_SPAN',
      `P5_CLAUSE_ROLE_${candidate.clauseRole.toUpperCase()}`,
      `P5_CURRENTNESS_${candidate.currentness.toUpperCase()}`,
      `P5_CONDITION_${candidate.conditionAttachment.truth.toUpperCase()}`,
    ]),
  }
}

function applyRelations(task: CandidateBoundTaskSuggestion, relations: LocalRevisionRelation[]): CandidateBoundTaskSuggestion {
  const outgoing = relations.find((relation) => relation.targetTaskId === task.id)
  const incoming = relations.filter((relation) => relation.kind === 'supersedes' && relation.replacementTaskIds.includes(task.id))
  const revisionRefs = incoming.map((relation) => ({
    type: 'supersedes' as const,
    targetTaskId: relation.targetTaskId,
    scopeIds: relation.evidenceScopeIds,
  }))
  if (!outgoing) {
    return {
      ...task,
      revisionRefs,
      policyReasons: unique([...task.policyReasons, ...incoming.map((relation) => `P5_REVISION_REPLACEMENT_${relation.kind.toUpperCase()}`)]),
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
    policyReasons: unique([
      ...task.policyReasons,
      `P5_REVISION_${outgoing.kind.toUpperCase()}_EDGE`,
      `P5_REVISION_EVIDENCE_${outgoing.resolution.toUpperCase()}`,
    ]),
  }
}

function candidateCouldStillRequireAction(candidate: LocalActionCandidate): boolean {
  return candidate.localDisposition !== 'local_non_task'
    && candidate.clauseRole !== 'condition_antecedent'
    && candidate.clauseRole !== 'assertion'
    && candidate.clauseRole !== 'quoted_or_example'
    && candidate.currentness !== 'historical'
    && candidate.currentness !== 'completed'
}

function deriveCandidateSafeTasks(
  index: ImmutableScopeIndex,
  catalog: LocalActionCandidateCatalog,
  composition: ActionCandidateComposition,
): CandidateTaskSafetyResult {
  const scopes = scopeMap(index)
  const bindings = acceptedCandidates(catalog, composition)
  const unrelationalTasks = bindings.map((binding) => baseTask(binding, catalog, scopes))
  const candidateById = new Map(catalog.candidates.map((candidate) => [candidate.id, candidate]))
  const quarantinedEntries = composition.ledger.filter((entry) => entry.status === 'quarantined')
  const revisionUncertainties = quarantinedEntries.map((entry) => candidateById.get(entry.candidateId)).filter((candidate): candidate is LocalActionCandidate => Boolean(candidate)).map((candidate) => ({
    scopeId: candidate.scopeId,
    actionSourceStart: candidate.action.sourceStart,
    currentness: candidate.currentness,
  }))
  const rawResolution = resolveCandidateRevisionRelations(
    index,
    unrelationalTasks,
    revisionUncertainties,
    new Set(catalog.unresolvedActionScopeIds),
  )
  const revisionRelations = rawResolution.relations
  const unresolvedRevisionScopeIds = rawResolution.unresolvedRevisionScopeIds
  const revisionCoverageComplete = unresolvedRevisionScopeIds.length === 0
  const revisionBlockedTaskIds = new Set(rawResolution.unresolvedPossibleTargetTaskIds)
  const relatedTasks = unrelationalTasks.map((task) => applyRelations(task, revisionRelations))
  const defaultSelectionBlockedTaskIds: string[] = []
  const tasks = relatedTasks.map((task) => {
    const locallyEligible = maySelect(task)
    const selected = locallyEligible && !revisionBlockedTaskIds.has(task.id)
    if (locallyEligible && !selected) defaultSelectionBlockedTaskIds.push(task.id)
    return {
      ...task,
      selected,
      needsConfirmation: !selected,
      policyReasons: unique([...task.policyReasons, selected ? 'P5_SAFE_DEFAULT_ALLOWED' : 'P5_SAFE_DEFAULT_BLOCKED']),
    }
  })

  const acceptedCandidateIds = new Set(bindings.map((binding) => binding.candidate.id))
  const quarantinedCandidateIds = new Set(quarantinedEntries.map((entry) => entry.candidateId))
  const uncertainTasks = tasks.filter((task) => task.conditionTruth === 'unknown'
    || task.currentness === 'unknown'
    || task.semantics.speechAct === 'unknown').length
  const quarantinedPossibilities = catalog.candidates.filter((candidate) => quarantinedCandidateIds.has(candidate.id)
    && candidateCouldStillRequireAction(candidate)).length
  const unresolvedScopePossibilities = catalog.unresolvedActionScopeIds.length
  const unresolvedRevisionPossibilities = tasks.filter((task) => revisionBlockedTaskIds.has(task.id)
    && task.currentness !== 'historical'
    && task.currentness !== 'completed').length
  const possiblyRequiredUnknowns = uncertainTasks + quarantinedPossibilities + unresolvedScopePossibilities + unresolvedRevisionPossibilities
  const definitelyRequired = tasks.some((task) => currentRequired(task.semantics) && !revisionBlockedTaskIds.has(task.id))
  const requiresAction = definitelyRequired ? true : possiblyRequiredUnknowns > 0 ? null : false
  const unsafeDefaultSelections = tasks.filter((task) => task.selected && !maySelect(task)).map((task) => task.id)

  return {
    schemaVersion: CANDIDATE_TASK_SAFETY_SCHEMA_VERSION,
    policyVersion: CANDIDATE_TASK_SAFETY_POLICY_VERSION,
    candidateCatalogPolicyVersion: catalog.policyVersion,
    sourceId: index.sourceId,
    sourceVersionId: index.sourceVersionId,
    sourceFingerprint: index.sourceFingerprint,
    catalogFingerprint: catalog.catalogFingerprint,
    producerRunId: composition.reduced.producerRunId,
    requiresAction,
    tasks,
    observations: [],
    ignoredScopeIds: composition.reduced.ignoredScopeIds.filter((id) => scopes.has(id)),
    generatedLocally: {
      taskBoundaries: true,
      semantics: true,
      requiresAction: true,
      selected: true,
      explanationOwnership: true,
      candidateIdentity: true,
      occurrenceSpans: true,
    },
    modelAuthorityFieldsUsed: [],
    diagnostics: {
      inputDirectiveAnchors: composition.reduced.directives.length,
      outputTasks: tasks.length,
      mergedActionAnchors: 0,
      promotedHistoricalDirectives: tasks.filter((task) => task.currentness === 'historical').length,
      attachedExplanationScopes: unique(bindings.flatMap((binding) => binding.candidate.conditionAttachment.factScopeIds)).length,
      acceptedCandidates: acceptedCandidateIds.size,
      ignoredCandidates: composition.ledger.filter((entry) => entry.status === 'ignored_local' || entry.status === 'ignored_model').length,
      quarantinedCandidates: quarantinedCandidateIds.size,
      possiblyRequiredUnknowns,
    },
    semanticEvidenceMode: 'candidate_occurrence_clause_role_currentness_and_condition',
    candidateEvidenceMode: 'closed_candidate_object_and_independent_safe_default',
    revisionResolverVersion: CANDIDATE_REVISION_RELATION_RESOLVER_VERSION,
    revisionRelations,
    unresolvedRevisionScopeIds,
    responseContractComplete: composition.responseContractComplete,
    semanticCoverageComplete: composition.semanticCoverageComplete,
    revisionCoverageComplete,
    suppressedRevisionScopeIds: rawResolution.coverageSuppressedRevisionScopeIds,
    defaultSelectionBlockedTaskIds,
    unsafeDefaultSelections,
  }
}

export function formCandidateSafeTaskSuggestions(
  index: ImmutableScopeIndex,
  catalog: LocalActionCandidateCatalog,
  composition: ActionCandidateComposition,
): CandidateTaskSafetyResult {
  if (index.sourceId !== catalog.sourceId
    || index.sourceVersionId !== catalog.sourceVersionId
    || index.sourceFingerprint !== catalog.sourceFingerprint
    || composition.sourceId !== catalog.sourceId
    || composition.sourceVersionId !== catalog.sourceVersionId
    || composition.sourceFingerprint !== catalog.sourceFingerprint
    || composition.catalogFingerprint !== catalog.catalogFingerprint) {
    throw new Error('P5_SOURCE_OR_CATALOG_BINDING_MISMATCH')
  }
  return deriveCandidateSafeTasks(index, catalog, composition)
}

export function validateCandidateSafeTaskSuggestions(
  result: CandidateTaskSafetyResult,
  index: ImmutableScopeIndex,
  catalog: LocalActionCandidateCatalog,
  composition: ActionCandidateComposition,
): LocalTaskFormationIssue[] {
  const issues: LocalTaskFormationIssue[] = []
  const accepted = new Set(composition.ledger
    .filter((entry) => entry.status === 'accepted_local' || entry.status === 'accepted_model')
    .map((entry) => entry.candidateId))
  const seenTasks = new Set<string>()
  const seenCandidates = new Set<string>()
  if (result.tasks.length !== accepted.size) issues.push({ code: 'P5_ACCEPTED_TASK_COUNT_MISMATCH', path: 'tasks' })
  for (const [position, task] of result.tasks.entries()) {
    if (seenTasks.has(task.id)) issues.push({ code: 'P5_TASK_ID_DUPLICATE', path: `tasks[${position}].id` })
    if (seenCandidates.has(task.originCandidateId)) issues.push({ code: 'P5_CANDIDATE_MATERIALIZED_TWICE', path: `tasks[${position}].originCandidateId` })
    if (!accepted.has(task.originCandidateId)) issues.push({ code: 'P5_TASK_NOT_FROM_ACCEPTED_CANDIDATE', path: `tasks[${position}].originCandidateId` })
    seenTasks.add(task.id)
    seenCandidates.add(task.originCandidateId)
  }
  if ([...accepted].some((candidateId) => !seenCandidates.has(candidateId))) {
    issues.push({ code: 'P5_ACCEPTED_CANDIDATE_NOT_MATERIALIZED', path: 'tasks' })
  }
  const expected = deriveCandidateSafeTasks(index, catalog, composition)
  if (JSON.stringify(result) !== JSON.stringify(expected)) issues.push({ code: 'P5_RESULT_NOT_DERIVED', path: 'result' })
  return issues
}
