import type { WorkspaceV8 } from '../../domain/v2/types'
import type { ConfirmationEditV2, ConfirmationIntentV2 } from '../../domain/v2/confirmationV2'
import { applySemanticDomainCommitPlan, type SemanticDomainCommitPlan } from '../../domain/v2/domainCommit'
import { workspaceSnapshotHash } from '../../domain/v2/migration'
import { plainJson } from '../mainline04/semanticContract'
import { assert, exactKeys, equal, stateOf, life, canonicalFacts, saveState, semanticId, semanticRevision, type SemanticOperation } from './semanticState'
import type { SemanticRepository } from './semanticRepository'

export interface SemanticDispositionIntent {
  draftId: string; revision: string; taskTempIds: string[]; kind: 'defer' | 'reject' | 'review_info'; operationId: string
}
export function planOperation(workspace: WorkspaceV8, draftId: string, op: SemanticOperation): SemanticDomainCommitPlan {
  const old = stateOf(workspace, draftId), state = plainJson(old)
  state.operations.push(op)
  const current = life(state), facts = canonicalFacts(state)
  state.bindings = facts.bindings
  const terminal = current.informationReviewed || (state.rawResponse.tasks.length > 0 && Object.values(current.dispositions).every(d => ['confirmed','rejected'].includes(d)))
  const status = terminal ? 'confirmed' as const : current.accepted.length ? 'partially_confirmed' as const : 'needs_review' as const
  const draft = workspace.extractionDrafts.find(d => d.id === draftId)!
  const nextDraft = { ...saveState(workspace, state).extractionDrafts.find(d => d.id === draftId)!,
    status, updatedAt: op.at, acceptedEntityTempIds: current.accepted,
    rejectedEntityTempIds: Object.keys(current.dispositions).filter(id => current.dispositions[id] === 'rejected'),
    commitOperationIds: state.operations.filter(o => o.kind === 'confirm').map(o => semanticId('operation', state, o.id)) }
  return { operationId: semanticId('operation', state, op.id), draftRevisionHash: workspaceSnapshotHash(draft), draftId,
    recognitionRunId: state.runId, sourceVersionId: state.sourceVersionId, sourceId: state.sourceId,
    acceptedEntityTempIds: current.accepted, rejectedEntityTempIds: nextDraft.rejectedEntityTempIds, nextDraft, nextSourceStatus: status,
    create: { projects: [], milestones: [], workPackages: [], tasks: facts.tasks, materials: facts.materials, timePoints: facts.timePoints,
      events: facts.events, evidenceRefs: facts.evidenceRefs, historyRecords: facts.historyRecords } }
}
function sameOperation(workspace: WorkspaceV8, draftId: string, operationId: string, op: Omit<SemanticOperation, 'before' | 'at'>) {
  const old = stateOf(workspace, draftId).operations.find(o => o.id === operationId)
  if (!old) return false
  const { before, at, ...shape } = old; void before; void at
  assert(equal(shape, op), 'OPERATION_COLLISION'); return true
}
export async function editSemantic(repo: SemanticRepository, intent: ConfirmationEditV2, now = new Date().toISOString()) {
  exactKeys(intent, ['draftId','taskTempId','revision','operationId','field','value'])
  return repo.transaction(workspace => {
    const shape = { id: intent.operationId, kind: 'edit' as const, taskIds: [intent.taskTempId], field: intent.field, value: intent.value }
    if (sameOperation(workspace, intent.draftId, intent.operationId, shape)) return workspace
    assert(intent.revision === semanticRevision(workspace), 'STALE_RELOAD_REQUIRED')
    const state = stateOf(workspace, intent.draftId), values = life(state).values
    assert(values[intent.taskTempId] && ['title','deadline'].includes(intent.field), 'EDIT_TARGET_INVALID')
    const before = values[intent.taskTempId][intent.field]
    if (before === intent.value) return workspace
    // The exact plan applied at save is also the one checked by the joint validator.
    const plan = planOperation(workspace, intent.draftId, { ...shape, before, at: now })
    return applySemanticDomainCommitPlan(workspace, plan, now)
  })
}
export async function confirmSemantic(repo: SemanticRepository, intent: ConfirmationIntentV2, now = new Date().toISOString()) {
  exactKeys(intent, ['draftId','revision','taskTempIds'])
  assert(Array.isArray(intent.taskTempIds) && intent.taskTempIds.length > 0
    && Object.keys(intent.taskTempIds).length === intent.taskTempIds.length && new Set(intent.taskTempIds).size === intent.taskTempIds.length, 'SELECTION_INVALID')
  return repo.transaction(workspace => {
    const state = stateOf(workspace, intent.draftId), current = life(state)
    assert(intent.taskTempIds.every(id => Object.hasOwn(current.dispositions, id)), 'SELECTION_UNKNOWN_ID')
    if (intent.taskTempIds.every(id => current.dispositions[id] === 'confirmed')) return workspace
    assert(intent.revision === semanticRevision(workspace), 'STALE_RELOAD_REQUIRED')
    const plan = planOperation(workspace, intent.draftId, { id: crypto.randomUUID(), kind: 'confirm', at: now,
      taskIds: intent.taskTempIds, field: null, value: null, before: null })
    return applySemanticDomainCommitPlan(workspace, plan, now)
  })
}
export async function disposeSemantic(repo: SemanticRepository, intent: SemanticDispositionIntent, now = new Date().toISOString()) {
  exactKeys(intent, ['draftId','revision','taskTempIds','kind','operationId'])
  return repo.transaction(workspace => {
    const shape = { id: intent.operationId, kind: intent.kind, taskIds: intent.taskTempIds, field: null, value: null }
    if (sameOperation(workspace, intent.draftId, intent.operationId, shape)) return workspace
    assert(intent.revision === semanticRevision(workspace), 'STALE_RELOAD_REQUIRED')
    const plan = planOperation(workspace, intent.draftId, { ...shape, before: null, at: now })
    return applySemanticDomainCommitPlan(workspace, plan, now)
  })
}
