import type { ImmutableScopeIndex, ScopeReferenceSemantics } from './scopeReferenceContract'
import { resolveLocalRevisionRelations, type LocalRevisionRelation, REVISION_RELATION_RESOLVER_VERSION } from './revisionRelationResolver'
import { formLocalTaskSuggestionsP2, type LocalTaskFormationP2Result } from './taskFormationPolicyP2'
import type { LocalTaskFormationIssue, LocalTaskSuggestion, ReducedModelAnchors } from './taskFormationPolicyV2'

export const TASK_FORMATION_P3_POLICY_VERSION = 'task-formation-policy-2.3.0-p3' as const

export type LocalTaskFormationP3Result = Omit<LocalTaskFormationP2Result, 'policyVersion'> & {
  policyVersion: typeof TASK_FORMATION_P3_POLICY_VERSION
  revisionResolverVersion: typeof REVISION_RELATION_RESOLVER_VERSION
  revisionRelations: LocalRevisionRelation[]
  unresolvedRevisionScopeIds: string[]
}

function currentRequired(semantics: ScopeReferenceSemantics): boolean {
  return (semantics.actor === 'addressee' || semantics.actor === 'addressed_group')
    && semantics.speechAct === 'directive' && semantics.polarity === 'affirmative'
    && semantics.tense === 'future' && semantics.status === 'pending'
    && semantics.validity === 'active' && semantics.modality === 'required'
}

function applyRelation(task: LocalTaskSuggestion, relations: LocalRevisionRelation[]): LocalTaskSuggestion {
  const relation = relations.find((item) => item.targetTaskId === task.id)
  if (!relation) return task
  return {
    ...task,
    semantics: { ...task.semantics, speechAct: 'directive', polarity: 'negative', tense: 'past', status: 'cancelled', validity: 'superseded' },
    selected: false,
    needsConfirmation: true,
    policyReasons: [...new Set([...task.policyReasons.filter((reason) => !reason.startsWith('P2_REVISION_')), `P3_REVISION_${relation.kind.toUpperCase()}_EDGE`, `P3_REVISION_EVIDENCE_${relation.resolution.toUpperCase()}`, 'P3_SAFE_DEFAULT_BLOCKED_SUPERSEDED'])],
  }
}

function attachRelationReference(task: LocalTaskSuggestion, relations: LocalRevisionRelation[]): LocalTaskSuggestion {
  const incoming = relations.filter((relation) => relation.kind === 'supersedes' && relation.replacementTaskIds.includes(task.id))
  if (incoming.length === 0) return task
  return {
    ...task,
    revisionRefs: [...task.revisionRefs, ...incoming.map((relation) => ({ type: 'supersedes' as const, targetTaskId: relation.targetTaskId, scopeIds: relation.evidenceScopeIds }))],
    policyReasons: [...new Set([...task.policyReasons, ...incoming.map((relation) => `P3_REVISION_REPLACEMENT_${relation.kind.toUpperCase()}`)])],
  }
}

function deriveP3(index: ImmutableScopeIndex, reduced: ReducedModelAnchors): LocalTaskFormationP3Result {
  const base = formLocalTaskSuggestionsP2(index, reduced)
  const resolution = resolveLocalRevisionRelations(index, base.tasks)
  const tasks = base.tasks.map((task) => attachRelationReference(applyRelation(task, resolution.relations), resolution.relations))
  return {
    ...base,
    policyVersion: TASK_FORMATION_P3_POLICY_VERSION,
    requiresAction: tasks.some((task) => currentRequired(task.semantics)),
    tasks,
    revisionResolverVersion: resolution.resolverVersion,
    revisionRelations: resolution.relations,
    unresolvedRevisionScopeIds: resolution.unresolvedRevisionScopeIds,
  }
}

export function formLocalTaskSuggestionsP3(index: ImmutableScopeIndex, reduced: ReducedModelAnchors): LocalTaskFormationP3Result {
  return deriveP3(index, reduced)
}

export function validateLocalTaskFormationP3(result: LocalTaskFormationP3Result, index: ImmutableScopeIndex, reduced: ReducedModelAnchors): LocalTaskFormationIssue[] {
  const issues: LocalTaskFormationIssue[] = []
  if (result.policyVersion !== TASK_FORMATION_P3_POLICY_VERSION) issues.push({ code: 'P3_POLICY_VERSION_INVALID', path: 'policyVersion' })
  if (result.revisionResolverVersion !== REVISION_RELATION_RESOLVER_VERSION) issues.push({ code: 'P3_REVISION_RESOLVER_VERSION_INVALID', path: 'revisionResolverVersion' })
  if (result.sourceId !== index.sourceId || result.sourceVersionId !== index.sourceVersionId || result.sourceFingerprint !== index.sourceFingerprint) issues.push({ code: 'P3_SOURCE_BINDING_MISMATCH', path: 'sourceId' })
  if (result.modelAuthorityFieldsUsed.length > 0) issues.push({ code: 'P3_MODEL_AUTHORITY_USED', path: 'modelAuthorityFieldsUsed' })
  const scopeIds = new Set(index.scopes.map((scope) => scope.id))
  const taskIds = new Set(result.tasks.map((task) => task.id))
  result.revisionRelations.forEach((relation, position) => {
    if (!taskIds.has(relation.targetTaskId) || relation.replacementTaskIds.some((id) => !taskIds.has(id))) issues.push({ code: 'P3_REVISION_TASK_REFERENCE_INVALID', path: `revisionRelations[${position}]` })
    if (relation.evidenceScopeIds.length < 2 || relation.evidenceScopeIds.some((id) => !scopeIds.has(id))) issues.push({ code: 'P3_REVISION_EVIDENCE_INVALID', path: `revisionRelations[${position}].evidenceScopeIds` })
  })
  const expected = deriveP3(index, reduced)
  if (result.requiresAction !== expected.requiresAction) issues.push({ code: 'P3_REQUIRES_ACTION_NOT_DERIVED', path: 'requiresAction' })
  if (JSON.stringify(result.tasks) !== JSON.stringify(expected.tasks)) issues.push({ code: 'P3_TASKS_NOT_DERIVED', path: 'tasks' })
  if (JSON.stringify(result.revisionRelations) !== JSON.stringify(expected.revisionRelations) || JSON.stringify(result.unresolvedRevisionScopeIds) !== JSON.stringify(expected.unresolvedRevisionScopeIds)) issues.push({ code: 'P3_REVISION_RELATIONS_NOT_DERIVED', path: 'revisionRelations' })
  return issues
}
