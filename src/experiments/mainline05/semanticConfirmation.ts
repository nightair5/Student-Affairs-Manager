import type { WorkspaceV8 } from '../../domain/v2/types'
import type { ConfirmationEditV2, ConfirmationIntentV2 } from '../../domain/v2/confirmationV2'
import { applySemanticDomainCommitPlan, type SemanticDomainCommitPlan } from '../../domain/v2/domainCommit'
import { workspaceSnapshotHash } from '../../domain/v2/migration'
import { plainJson } from '../mainline04/semanticContract'
import { assert, exactKeys, equal, stateOfRuntime as stateOf, life, canonicalFacts, saveState, semanticId, semanticRevision,
  REAL_STATE_VERSION, effectiveStateFacts, liveReviewIdentity, isCurrentDraft, relatedAssets, materialIdentity, materialDecision, materialReviewEnabled, type SemanticOperation } from './semanticState'
import { appendCorrection, correctionBefore, validateMaterialDecision, type MaterialDecision, type FactChange } from '../realInput01/factCorrections'
import { composeSemantics } from '../mainline04/semanticComposer'
import { pendingDateEligible, pendingDateIdentity, hasPendingDateConsent } from './semanticState'

/** Records consent only. Formal tasks still require separate fact review and explicit confirmation. */
export async function acceptSemanticPendingDate(repo: SemanticRepository, intent: {draftId:string;taskId:string;revision:string;operationId:string}) {
  exactKeys(intent,['draftId','taskId','revision','operationId'])
  assert(intent.operationId&&/^[A-Za-z0-9-]{1,100}$/.test(intent.operationId),'PENDING_DATE_OPERATION')
  return repo.transaction(workspace=>{
    assert(repo.profile==='real-input-01'&&semanticRevision(workspace)===intent.revision,'STALE_VERSION')
    const state=stateOf(workspace,intent.draftId)
    assert(state.version===REAL_STATE_VERSION&&isCurrentDraft(workspace,intent.draftId),'PENDING_DATE_PROFILE')
    assert(pendingDateEligible(state,intent.taskId),'PENDING_DATE_NOT_ELIGIBLE')
    assert(!['confirmed','rejected'].includes(life(state).dispositions[intent.taskId]),'ALREADY_CONFIRMED_OR_REJECTED')
    if(hasPendingDateConsent(state,intent.taskId))return workspace
    const now=new Date().toISOString()
    return applySemanticDomainCommitPlan(workspace,planOperation(workspace,intent.draftId,{id:intent.operationId,
      kind:'accept_pending_date',at:now,taskIds:[intent.taskId],field:null,value:null,before:null,
      pendingDateIdentity:pendingDateIdentity(state,intent.taskId)}),now)
  })
}
import type { SemanticRepository } from './semanticRepository'

export interface SemanticDispositionIntent {
  draftId: string; revision: string; taskTempIds: string[]; kind: 'defer' | 'reject' | 'review_info'; operationId: string
}
/** Explicit opt-in before any user action; old states/default paths do not change. */
export async function enableMaterialReview(repo: SemanticRepository,draftId: string,now=new Date().toISOString()) {
  assert(repo.profile==='real-input-01','EXPLICIT_REAL_INPUT_REQUIRED')
  return repo.transaction(w=>{
    const state=stateOf(w,draftId);assert(state.version===REAL_STATE_VERSION,'EXPLICIT_REAL_INPUT_REQUIRED')
    if(materialReviewEnabled(state))return w
    const op:SemanticOperation={id:'material-review-mode-1',kind:'enable_material_review',at:now,taskIds:[],field:null,value:null,before:null}
    return applySemanticDomainCommitPlan(w,planOperation(w,draftId,op),now)
  })
}
export async function reviewSemanticMaterial(repo: SemanticRepository,intent:{draftId:string;materialId:string;revision:string;operationId:string;value:MaterialDecision},now=new Date().toISOString()) {
  exactKeys(intent,['draftId','materialId','revision','operationId','value'])
  assert(repo.profile==='real-input-01','EXPLICIT_REAL_INPUT_REQUIRED')
  const value=validateMaterialDecision(intent.value)
  return repo.transaction(w=>{
    const state=stateOf(w,intent.draftId)
    const previous=state.operations.find(o=>o.id===intent.operationId)
    if(previous){assert(previous.kind==='review_material'&&previous.materialReview?.materialId===intent.materialId
      &&equal(previous.materialReview.value,value),'OPERATION_COLLISION');return w}
    assert(semanticRevision(w)===intent.revision,'STALE_RELOAD_REQUIRED')
    assert(materialReviewEnabled(state),'MATERIAL_MODE_REQUIRED')
    if(equal(materialDecision(state,intent.materialId)??null,value))return w
    const facts=effectiveStateFacts(state).facts
    const op:SemanticOperation={id:intent.operationId,kind:'review_material',at:now,
      taskIds:facts.tasks.filter(t=>relatedAssets(facts,[t.id]).materials.has(intent.materialId)).map(t=>t.id).sort(),field:null,value:null,before:null,
      materialReview:{materialId:intent.materialId,identity:materialIdentity(state,intent.materialId),value}}
    return applySemanticDomainCommitPlan(w,planOperation(w,intent.draftId,op),now)
  })
}
export function planOperation(workspace: WorkspaceV8, draftId: string, op: SemanticOperation): SemanticDomainCommitPlan {
  const old = stateOf(workspace, draftId), state = plainJson(old)
  assert(state.version !== REAL_STATE_VERSION || isCurrentDraft(workspace, draftId), 'STALE_DRAFT_VERSION')
  state.operations.push(op)
  const current = life(state), facts = canonicalFacts(state)
  state.bindings = facts.bindings
  const terminal = current.informationReviewed || (effectiveStateFacts(state).facts.tasks.length > 0 && Object.values(current.dispositions).every(d => ['confirmed','rejected'].includes(d)))
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
export async function reviewSemanticFact(repo: SemanticRepository, intent: { draftId: string; taskId: string; revision: string; operationId: string }, now = new Date().toISOString()) {
  exactKeys(intent, ['draftId','taskId','revision','operationId'])
  assert(repo.profile === 'real-input-01', 'EXPLICIT_REAL_INPUT_REQUIRED')
  return repo.transaction(w => {
    assert(semanticRevision(w) === intent.revision, 'STALE_RELOAD_REQUIRED')
    const state = stateOf(w, intent.draftId); assert(state.version === REAL_STATE_VERSION, 'EXPLICIT_REAL_INPUT_REQUIRED')
    const current = life(state)
    const op: SemanticOperation = { id: intent.operationId, kind: 'review_task', at: now, taskIds: [intent.taskId],
      field: null, value: null, before: null, reviewIdentity: liveReviewIdentity(state, intent.taskId, current.values) }
    return applySemanticDomainCommitPlan(w, planOperation(w, intent.draftId, op), now)
  })
}
export async function correctSemanticFact(repo: SemanticRepository,
  input: { draftId: string; revision: string; operationId: string; change: FactChange }, now = new Date().toISOString()) {
  // revision is the exact whole-workspace CAS token, not a semantic text field.
  // Do not pass its serialized workspace through the 100k per-fact text bound.
  const descriptor=Object.getOwnPropertyDescriptor(input,'revision')
  assert(descriptor&&'value' in descriptor&&typeof descriptor.value==='string','REVISION_REQUIRED')
  assert(Object.getPrototypeOf(input)===Object.prototype&&Reflect.ownKeys(input).every(key=>{
    const d=Object.getOwnPropertyDescriptor(input,key)!;return typeof key==='string'&&'value' in d&&d.enumerable
  }),'INPUT_ACCESSOR')
  const intent = {...plainJson({...input,revision:''}),revision:descriptor.value as string}
  exactKeys(intent, ['draftId','revision','operationId','change'])
  assert(repo.profile === 'real-input-01', 'EXPLICIT_REAL_INPUT_REQUIRED')
  const before = await repo.load(); assert(semanticRevision(before) === intent.revision, 'STALE_RELOAD_REQUIRED')
  const state = stateOf(before, intent.draftId); assert(state.version === REAL_STATE_VERSION, 'EXPLICIT_REAL_INPUT_REQUIRED')
  const correction = { id: intent.operationId, at: now, change: intent.change, before: correctionBefore(effectiveStateFacts(state).facts, intent.change) }
  const next = appendCorrection(state.adaptedResponse, state.operations.filter(o => o.correction).map(o => o.correction!), correction,
    state.context.index, life(state).accepted)
  const review = await composeSemantics(next.sourceFacts, state.context)
  return repo.transaction(w => {
    assert(semanticRevision(w) === intent.revision, 'STALE_RELOAD_REQUIRED')
    const op: SemanticOperation = { id: intent.operationId, kind: 'correct_fact', at: now, taskIds: next.affectedTaskIds,
      field: null, value: null, before: null, correction, factReview: review }
    return applySemanticDomainCommitPlan(w, planOperation(w, intent.draftId, op), now)
  })
}
