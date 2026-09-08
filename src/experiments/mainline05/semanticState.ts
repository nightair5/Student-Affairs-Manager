import type { WorkspaceV8, JsonValue, Task, Material, TimePoint, Event, EvidenceRef, HistoryRecord } from '../../domain/v2/types'
import { validateWorkspaceV8 } from '../../domain/v2/validators/workspaceValidator'
import { workspaceSnapshotHash } from '../../domain/v2/migration'
import { isDateOnly, parseBusinessDateTime } from '../../lib/timeSemantics'
import { composeSemantics, type ComposeContext, type ReviewPackage } from '../mainline04/semanticComposer'
import { parseSemanticInput, plainJson, stableJson, type SemanticInput } from '../mainline04/semanticContract'
import { effectiveFacts, appendCorrection, validateMaterialDecision, type MaterialDecision, type FactCorrection } from '../realInput01/factCorrections'
import { factIdentity, itemSafety, selectLiveTasks } from '../realInput01/modelPolicy'
import { parseModelEnvelope, MODEL_NAME, PROMPT_VERSION, type ModelWire } from '../realInput01/modelWire'
import { CANDIDATE02_VERSION } from '../realInput01/candidate02'
import { validateInputReceipt, validateSendSnapshot, effectivePages, type InputReceipt, type SendSnapshot } from '../realInput01/inputReceipt'

export const STATE_VERSION = 'mainline05-semantic-state-1' as const
export type Disposition = 'pending' | 'deferred' | 'rejected' | 'confirmed'
export interface SemanticOperation {
  id: string; kind: 'edit' | 'confirm' | 'defer' | 'reject' | 'review_info' | 'review_task' | 'correct_fact' | 'enable_material_review' | 'review_material'
  at: string; taskIds: string[]; field: 'title' | 'deadline' | null; value: string | null; before: string | null
  correction?: FactCorrection; factReview?: ReviewPackage; reviewIdentity?: string
  materialReview?: { materialId: string; identity: string; value: MaterialDecision }
}
export interface SemanticState {
  version: typeof STATE_VERSION
  sourceId: string; sourceVersionId: string; runId: string; draftId: string
  rawOutputText: string; rawResponse: SemanticInput; legacyResponse: JsonValue
  context: ComposeContext; first: ReviewPackage
  operations: SemanticOperation[]
  bindings: Record<string, string | null>
}
export const REAL_STATE_VERSION = 'mainline-real-input-state-1' as const
export interface RealInputState extends Omit<SemanticState, 'version' | 'rawResponse'> {
  version: typeof REAL_STATE_VERSION
  rawResponse: ModelWire
  rawHttpText: string
  adaptedResponse: SemanticInput
  inputReceipt: InputReceipt
  sendSnapshot: SendSnapshot
  execution: 'live' | 'seen_engineering_replay'
  recovery?: { kind: 'user_opened_failed_response'; at: string }
}
export type AnySemanticState = SemanticState | RealInputState
export function effectiveStateFacts(state: AnySemanticState) {
  return state.version === STATE_VERSION ? { facts: state.rawResponse, sourceFacts: state.rawResponse, manualMaterials: [] as string[] }
    : effectiveFacts(state.adaptedResponse, state.operations.filter(o => o.kind === 'correct_fact').map(o => {
      assert(o.correction, 'CORRECTION_MISSING'); return o.correction
    }), state.context.index)
}
export function effectiveReview(state: AnySemanticState) {
  if (state.version === STATE_VERSION) return state.first
  return state.operations.filter(o => o.kind === 'correct_fact').at(-1)?.factReview ?? state.first
}
export const equal = (a: unknown, b: unknown) => stableJson(a) === stableJson(b)
export const json = (value: unknown): JsonValue => plainJson(value) as JsonValue
export function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw Error('MAINLINE05_' + code)
}
export function exactKeys(value: object, keys: string[]) {
  assert(equal(Object.keys(value).sort(), [...keys].sort()), 'UNSUPPORTED_FIELDS')
}
export function semanticId(kind: string, state: Pick<SemanticState, 'draftId'>, id: string) {
  return 'mainline05:' + kind + ':' + state.draftId + ':' + encodeURIComponent(id)
}
export function stateOf(workspace: WorkspaceV8, draftId: string): SemanticState {
  const state = stateOfRuntime(workspace, draftId)
  assert(state.version === STATE_VERSION, 'EXPLICIT_REAL_INPUT_REQUIRED')
  return state
}
export function stateOfRuntime(workspace: WorkspaceV8, draftId: string): AnySemanticState {
  const value = workspace.extractionDrafts.find(d => d.id === draftId)?.legacyData?.mainline05
  assert(value && typeof value === 'object' && !Array.isArray(value), 'DRAFT_NOT_READY')
  return value as unknown as AnySemanticState
}
// Exact snapshot identity, not a short non-cryptographic hash used as an authorization token.
// The identity is passed in memory only and is never embedded recursively in history.
// v8 permits absent optional properties represented by undefined; its JSON export omits
// those properties. Strict semantic payloads are validated separately before this view.
export const semanticRevision = (workspace: unknown) => stableJson(JSON.parse(JSON.stringify(workspace)))

export function relatedAssets(input: SemanticInput, ids: readonly string[]) {
  const tasks = new Set(ids), materials = new Set<string>(), times = new Set<string>(), events = new Set<string>()
  for (const task of input.tasks) if (tasks.has(task.id)) {
    task.detail.materialTempIds.forEach(id => materials.add(id)); task.detail.timePointTempIds.forEach(id => times.add(id))
    task.eventTempIds.forEach(id => events.add(id))
  }
  let size = -1
  while (size !== materials.size + times.size + events.size) {
    size = materials.size + times.size + events.size
    for (const m of input.materials) if (m.relatedTaskTempIds.some(id => tasks.has(id))) materials.add(m.tempId)
    for (const t of input.timePoints) if (times.has(t.tempId) || t.relatedTaskTempIds.some(id => tasks.has(id))
      || t.relatedMaterialTempIds.some(id => materials.has(id))) {
      times.add(t.tempId); t.relatedMaterialTempIds.forEach(id => materials.add(id))
    }
    for (const e of input.events) if (events.has(e.tempId) || e.relatedTaskTempIds.some(id => tasks.has(id))
      || (e.startTimePointTempId && times.has(e.startTimePointTempId)) || (e.endTimePointTempId && times.has(e.endTimePointTempId))) {
      events.add(e.tempId); if (e.startTimePointTempId) times.add(e.startTimePointTempId); if (e.endTimePointTempId) times.add(e.endTimePointTempId)
    }
  }
  return { tasks, materials, times, events }
}
const deadlineType = (type: string) => ['task_deadline', 'submission_deadline', 'registration_deadline', 'result_announcement'].includes(type)
export function editTimeSupport(state: AnySemanticState, id: string) {
  const input = effectiveStateFacts(state).facts
  const task = input.tasks.find(t => t.id === id)
  assert(task, 'TASK_MISSING')
  const assets = relatedAssets(input, [id]), points = input.timePoints.filter(t => assets.times.has(t.tempId))
  const shared = input.tasks.some(t => t.id !== id
    && [...relatedAssets(input, [t.id]).times].some(time => assets.times.has(time)))
  return { points, allowed: assets.events.size === 0 && points.length <= 1 && !shared
    && points.every(t => deadlineType(t.type)) && (points.length > 0 || task.coverage.time === 'not_stated') }
}
export function canAct(state: AnySemanticState, id: string): boolean {
  if(state.version===REAL_STATE_VERSION&&state.recovery&&(!state.operations.some(o=>o.kind==='correct_fact')
    ||effectiveReview(state).issues.some(i=>['BAD_ENTITY_REFERENCE','BAD_REVISION_REFERENCE'].includes(i.code))))return false
  if (state.version === REAL_STATE_VERSION) return !materialReviewProblem(state,id) && itemSafety(effectiveStateFacts(state).facts, effectiveReview(state), id).length === 0
  const item = state.first.items.find(i => i.tempId === id)
  const task = state.rawResponse.tasks.find(t => t.id === id)
  return Boolean(item && task && state.context.authority === 'human_engineering' && item.requiresAction === 'true'
    && item.issues.length === 0 && ['addressee', 'addressed_group'].includes(task.semantics.actor) && task.effect !== 'unknown')
}
export const materialReviewEnabled = (state: AnySemanticState) => state.version===REAL_STATE_VERSION
  && state.operations.some(o=>o.kind==='enable_material_review')
export function materialIdentity(state: AnySemanticState, materialId: string) {
  const input=effectiveStateFacts(state).facts, material=input.materials.find(m=>m.tempId===materialId)
  assert(material,'MATERIAL_MISSING')
  return stableJson({material,owners:input.tasks.filter(t=>relatedAssets(input,[t.id]).materials.has(materialId))})
}
export function materialDecision(state: AnySemanticState, materialId: string): MaterialDecision | undefined {
  if (!materialReviewEnabled(state)) return undefined
  const op=state.operations.filter(o=>o.kind==='review_material'&&o.materialReview?.materialId===materialId).at(-1)
  return op?.materialReview?.identity===materialIdentity(state,materialId) ? validateMaterialDecision(op.materialReview.value) : undefined
}
export function materialReviewProblem(state: AnySemanticState,id: string): string | undefined {
  if (!materialReviewEnabled(state)) return undefined
  const input=effectiveStateFacts(state).facts, assets=relatedAssets(input,[id])
  const missing=input.materials.filter(m=>assets.materials.has(m.tempId)&&!materialDecision(state,m.tempId))
  return missing.length ? '材料必需性与当前准备状态尚待分别核对并保存：'+missing.map(m=>m.name).join('、') : undefined
}
function validDate(value: string, timezone: string) {
  return isDateOnly(value) || (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && parseBusinessDateTime(value, timezone) !== null)
}
export function informationReviewProblem(state: AnySemanticState): string | undefined {
  const input = effectiveStateFacts(state).facts, review = effectiveReview(state)
  if (input.tasks.length) return '包含任务建议，请逐项核对。'
  if (review.issues.length || input.unresolvedScopeIds.length) {
    return '原文尚有未覆盖或未解决的信息，需继续核对：' + review.issues.map(issue => issue.code).join('、')
  }
  return undefined
}
export function life(state: AnySemanticState): { dispositions: Record<string, Disposition>; values: Record<string, { title: string; deadline: string }>;
  confirmedAt: Record<string, string>; informationReviewed: boolean; accepted: string[]; reviewed?: Record<string, string> } {
  if (state.version === REAL_STATE_VERSION) return liveLife(state)
  const input = state.rawResponse
  const dispositions: Record<string, Disposition> = Object.fromEntries(input.tasks.map(t => [t.id, 'pending']))
  const values: Record<string, { title: string; deadline: string }> = Object.fromEntries(input.tasks.map(t => {
    const points = editTimeSupport(state, t.id).points.filter(p => deadlineType(p.type))
    return [t.id, { title: t.detail.title, deadline: points.length === 1 ? points[0].normalizedValue ?? '' : '' }]
  }))
  const confirmedAt: Record<string, string> = {}
  let informationReviewed = false
  const operations = new Set<string>()
  let lastAt = -Infinity
  for (const op of state.operations) {
    exactKeys(op, ['id', 'kind', 'at', 'taskIds', 'field', 'value', 'before'])
    assert(typeof op.id === 'string' && /^[A-Za-z0-9-]{1,100}$/.test(op.id) && !operations.has(op.id), 'OPERATION_ID')
    operations.add(op.id)
    assert(typeof op.at === 'string' && Number.isFinite(Date.parse(op.at)), 'OPERATION_DATE')
    assert(Date.parse(op.at) >= lastAt, 'OPERATION_TIME_ORDER')
    lastAt = Date.parse(op.at)
    assert(Array.isArray(op.taskIds) && op.taskIds.length === Object.keys(op.taskIds).length
      && new Set(op.taskIds).size === op.taskIds.length && op.taskIds.every(id => Object.hasOwn(dispositions, id)), 'OPERATION_TASKS')
    if (op.kind === 'review_info') {
      assert(!input.tasks.length && !op.taskIds.length && !informationReviewed && op.field === null && op.value === null && op.before === null, 'INFO_OPERATION')
      assert(!informationReviewProblem(state), 'INFORMATION_REQUIRES_REVIEW')
      informationReviewed = true; continue
    }
    assert(op.taskIds.length > 0 && op.taskIds.every(id => dispositions[id] !== 'confirmed'), 'ALREADY_CONFIRMED')
    if (op.kind === 'edit') {
      assert(op.taskIds.length === 1 && (op.field === 'title' || op.field === 'deadline') && typeof op.value === 'string', 'EDIT_SHAPE')
      const id = op.taskIds[0], field = op.field
      assert(dispositions[id] !== 'rejected' && op.before === values[id][field], 'EDIT_CHAIN')
      if (field === 'title') assert(op.value.trim() && op.value.length <= 200, 'TITLE_INVALID')
      else {
        const support = editTimeSupport(state, id)
        assert(support.allowed, 'TIME_TYPE_OR_SHARED_NOT_EDITABLE')
        assert(op.value === '' ? support.points.length === 0 : validDate(op.value, state.context.timezone), 'USER_DATE_INVALID')
        assert(canAct(state, id), 'ITEM_REQUIRES_REVIEW')
      }
      values[id][field] = op.value
    } else {
      assert(op.field === null && op.value === null && op.before === null, 'DISPOSITION_SHAPE')
      assert(['confirm', 'defer', 'reject'].includes(op.kind), 'OPERATION_KIND')
      for (const id of op.taskIds) {
        if (op.kind === 'confirm') {
          assert(canAct(state, id) && dispositions[id] !== 'rejected', 'ITEM_NOT_CONFIRMABLE')
          const task = input.tasks.find(t => t.id === id)!
          assert([...task.detail.dependencyTempIds, ...(task.detail.parentTempId ? [task.detail.parentTempId] : [])]
            .every(other => dispositions[other] === 'confirmed' || op.taskIds.includes(other)), 'DEPENDENCY_CONFIRM_FIRST')
          dispositions[id] = 'confirmed'; confirmedAt[id] = op.at
        } else dispositions[id] = op.kind === 'defer' ? 'deferred' : 'rejected'
      }
    }
  }
  return { dispositions, values, confirmedAt, informationReviewed, accepted: Object.keys(confirmedAt) }
}
export function operationHistory(state: AnySemanticState): HistoryRecord[] {
  return state.operations.map(op => ({ id: semanticId('history', state, op.id), entityType: 'extraction_draft', entityId: state.draftId,
    action: 'mainline05_' + op.kind, fieldName: op.field ? JSON.stringify([op.taskIds[0], op.field]) : null,
    before: op.before, after: op.kind === 'edit' ? op.value : json({ taskIds: op.taskIds, kind: op.kind,
      ...(op.correction ? { correction: op.correction } : {}), ...(op.reviewIdentity ? { reviewIdentity: op.reviewIdentity } : {}),
      ...(op.materialReview ? { materialReview: op.materialReview } : {}) }), actor: op.kind==='enable_material_review'?'system':'user',
    reason: state.version, sourceVersionId: state.sourceVersionId, changedAt: op.at }))
}
export function canonicalFacts(state: AnySemanticState) {
  const effective = effectiveStateFacts(state), input = effective.facts, current = life(state), accepted = new Set(current.accepted)
  const assets = relatedAssets(input, current.accepted)
  const taskId = (id: string) => semanticId('task', state, id)
  const materialId = (id: string) => semanticId('material', state, id)
  const timeId = (id: string) => semanticId('time', state, id)
  const eventId = (id: string) => semanticId('event', state, id)
  const taskAssets = Object.fromEntries(input.tasks.map(t => [t.id, relatedAssets(input, [t.id])]))
  const owners = (kind: 'materials' | 'times' | 'events', id: string) => current.accepted.filter(t => taskAssets[t][kind].has(id))
  const stamps = (ids: string[]) => {
    const times = ids.map(id => current.confirmedAt[id]).sort()
    assert(times.length > 0, 'ORPHAN_CANONICAL_ENTITY')
    return { createdAt: times[0], updatedAt: times.at(-1)! }
  }
  const pointer = (id: string) => ({ mainline05DraftId: state.draftId, recognitionTempId: id, sourceId: state.sourceId })
  const tasks: Task[] = input.tasks.filter(t => accepted.has(t.id)).map(t => ({ id: taskId(t.id), projectId: null, milestoneId: null,
    workPackageId: null, parentTaskId: t.detail.parentTempId ? taskId(t.detail.parentTempId) : null,
    title: current.values[t.id].title, description: t.detail.description, nextAction: t.action.surface + t.object.surface,
    status: 'todo', estimatedMinutes: t.detail.estimatedMinutes, manualPriority: null, snoozedUntil: null,
    dependencyIds: t.detail.dependencyTempIds.map(taskId), ...stamps([t.id]), version: 1, legacyData: pointer(t.id) }))
  const timePoints: TimePoint[] = input.timePoints.filter(t => assets.times.has(t.tempId)).map(t => {
    // Sharing a task owner does not assert a time-to-material edge.
    const taskOwners = owners('times', t.tempId)
    const materialOwners = [...new Set(t.relatedMaterialTempIds)].filter(id => assets.materials.has(id))
    const editOwner = taskOwners.find(id => state.operations.some(op => op.kind === 'edit' && op.field === 'deadline' && op.taskIds[0] === id))
    const value = editOwner ? current.values[editOwner].deadline : t.normalizedValue
    const changed = Boolean(editOwner)
    const eventOwners = input.events.filter(e => assets.events.has(e.tempId) && [e.startTimePointTempId, e.endTimePointTempId].includes(t.tempId))
    return { id: timeId(t.tempId), projectId: null, milestoneId: null, taskId: taskOwners[0] ? taskId(taskOwners[0]) : null,
      materialId: materialOwners[0] ? materialId(materialOwners[0]) : null, eventId: eventOwners.length === 1 ? eventId(eventOwners[0].tempId) : null,
      relatedTaskIds: taskOwners.map(taskId), relatedMaterialIds: materialOwners.map(materialId), type: t.type, rawText: t.rawText,
      normalizedValue: value, timezone: changed ? isDateOnly(value!) ? null : state.context.timezone : t.timezone,
      isAllDay: changed ? isDateOnly(value!) : t.isAllDay, precision: changed ? isDateOnly(value!) ? 'date_only' : 'exact' : t.precision,
      needsConfirmation: changed ? false : t.needsConfirmation, ...stamps(taskOwners), legacyData: pointer(t.tempId) }
  })
  for (const t of input.tasks.filter(t => accepted.has(t.id))) {
    const value = current.values[t.id].deadline
    if (value && !taskAssets[t.id].times.size) timePoints.push({ id: timeId('manual-deadline:' + t.id), projectId: null, milestoneId: null,
      taskId: taskId(t.id), materialId: null, eventId: null, relatedTaskIds: [taskId(t.id)], relatedMaterialIds: [], type: 'task_deadline',
      rawText: '', normalizedValue: value, timezone: isDateOnly(value) ? null : state.context.timezone,
      isAllDay: isDateOnly(value), precision: isDateOnly(value) ? 'date_only' : 'exact', needsConfirmation: false,
      ...stamps([t.id]), legacyData: { ...pointer('manual-deadline:' + t.id), extractionMethod: 'manual' } })
  }
  const materials: Material[] = input.materials.filter(m => assets.materials.has(m.tempId)).map(m => {
    const associated = timePoints.filter(t => deadlineType(t.type) && t.relatedMaterialIds.includes(materialId(m.tempId)))
    const decision=materialDecision(state,m.tempId)
    assert(!materialReviewEnabled(state)||decision,'MATERIAL_REVIEW_REQUIRED')
    return { id: materialId(m.tempId), projectId: null, name: m.name, required: decision?.required??m.required, status: decision?.status??(m.required ? 'missing' : 'not_required'),
      requirements: [], formatRequirements: [...m.formatRequirements], namingRequirements: [...m.namingRequirements], quantity: m.quantity,
      submissionChannel: m.submissionChannel, relatedTaskIds: owners('materials', m.tempId).map(taskId),
      deadlineTimePointId: associated.length === 1 ? associated[0].id : null, ...stamps(owners('materials', m.tempId)), version: 1,
      legacyData: { ...pointer(m.tempId), ...(effective.manualMaterials.includes(m.tempId) ? { extractionMethod: 'manual' } : {}),
        ...(decision ? {materialReviewVersion:'material-review-1',requirementAndAvailabilityOrigin:'user_observation'} : {}) } }
  })
  const events: Event[] = input.events.filter(e => assets.events.has(e.tempId)).map(e => ({ id: eventId(e.tempId), projectId: null,
    title: e.title, description: e.description, location: e.location,
    startTimePointId: e.startTimePointTempId ? timeId(e.startTimePointTempId) : null,
    endTimePointId: e.endTimePointTempId ? timeId(e.endTimePointTempId) : null,
    ...stamps(owners('events', e.tempId)), legacyData: pointer(e.tempId) }))
  const evidenceRefs: EvidenceRef[] = !accepted.size ? [] : state.context.index.scopes.map(scope => ({
    id: semanticId('evidence', state, scope.id), sourceVersionId: state.sourceVersionId, page: null, textStart: scope.start,
    textEnd: scope.end, quotedText: scope.text, bbox: null, fieldPath: scope.id, extractionMethod: 'manual', confidence: null,
    createdAt: Object.values(current.confirmedAt).sort()[0], legacyData: pointer(scope.id) }))
  const bindings: Record<string, string | null> = {}
  for (const [kind, entries, materialized] of [
    ['task', input.tasks.map(t => t.id), tasks], ['material', input.materials.map(t => t.tempId), materials],
    ['time', input.timePoints.map(t => t.tempId), timePoints], ['event', input.events.map(t => t.tempId), events],
  ] as const) for (const id of entries) bindings[kind + ':' + id] = materialized.some(e => e.id === semanticId(kind, state, id)) ? semanticId(kind, state, id) : null
  for (const t of timePoints) if (String(t.legacyData?.recognitionTempId).startsWith('manual-deadline:')) {
    bindings['time:' + t.legacyData!.recognitionTempId] = t.id
  }
  return { tasks, materials, timePoints, events, evidenceRefs, historyRecords: operationHistory(state), bindings }
}
export function liveReviewIdentity(state: RealInputState, id: string, values: Record<string, { title: string; deadline: string }>) {
  const identity = factIdentity(effectiveStateFacts(state).facts, id)
  const relevant = JSON.parse(identity) as { tasks: Array<{ id: string }> }
  return stableJson({ identity, userValues: Object.fromEntries(relevant.tasks.map(t => [t.id, values[t.id]])),
    ...(materialReviewEnabled(state)?{materialReviews:[...relatedAssets(effectiveStateFacts(state).facts,relevant.tasks.map(t=>t.id)).materials]
      .sort().map(id=>({id,decision:materialDecision(state,id)??null}))}:{}) })
}
export const titleReviewProblem = (title: string) => !title.trim() || title.length > 200
  ? '请明确编辑并保存1至200字的任务标题；原文动作和对象不会被截断。' : undefined
function liveLife(state: RealInputState) {
  const initial = { ...state, operations: [] }, input = effectiveStateFacts(initial).facts
  const finalInput = effectiveStateFacts(state).facts
  const dispositions: Record<string, Disposition> = Object.fromEntries(finalInput.tasks.map(t => [t.id, 'pending']))
  const values = Object.fromEntries(finalInput.tasks.map(t => {
    if (!input.tasks.some(old=>old.id===t.id)) return [t.id,{title:t.detail.title,deadline:''}]
    const p = editTimeSupport(initial, t.id).points.filter(t => deadlineType(t.type))
    return [t.id, { title: t.detail.title, deadline: p.length === 1 ? p[0].normalizedValue ?? '' : '' }]
  }))
  const confirmedAt: Record<string, string> = {}, reviewed: Record<string, string> = {}, ids = new Set<string>()
  const prefix: SemanticOperation[] = []
  let informationReviewed = false, lastAt = -Infinity
  for (const op of state.operations) {
    const extra = op.kind === 'correct_fact' ? ['correction', 'factReview'] : op.kind === 'review_task' ? ['reviewIdentity'] : op.kind==='review_material'?['materialReview']:[]
    exactKeys(op, ['id', 'kind', 'at', 'taskIds', 'field', 'value', 'before', ...extra])
    assert(typeof op.id === 'string' && /^[A-Za-z0-9-]{1,100}$/.test(op.id) && !ids.has(op.id), 'OPERATION_ID'); ids.add(op.id)
    assert(Number.isFinite(Date.parse(op.at)) && Date.parse(op.at) >= lastAt, 'OPERATION_TIME_ORDER'); lastAt = Date.parse(op.at)
    assert(Array.isArray(op.taskIds) && Object.keys(op.taskIds).length === op.taskIds.length
      && new Set(op.taskIds).size === op.taskIds.length && op.taskIds.every(id => Object.hasOwn(dispositions, id)), 'OPERATION_TASKS')
    const before = { ...state, operations: [...prefix] }, effective = effectiveStateFacts(before), review = effectiveReview(before)
    if(op.kind!=='correct_fact')assert(op.taskIds.every(id=>effective.facts.tasks.some(t=>t.id===id)),'TASK_NOT_YET_ADDED')
    if (op.kind==='enable_material_review') {
      assert(prefix.length===0&&!op.taskIds.length&&op.field===null&&op.value===null&&op.before===null,'MATERIAL_MODE_ACTIVATION')
    } else if (op.kind==='review_material') {
      assert(materialReviewEnabled(before)&&op.materialReview&&op.field===null&&op.value===null&&op.before===null,'MATERIAL_REVIEW_SHAPE')
      exactKeys(op.materialReview,['materialId','identity','value'])
      validateMaterialDecision(op.materialReview.value)
      const affected=effective.facts.tasks.filter(t=>relatedAssets(effective.facts,[t.id]).materials.has(op.materialReview!.materialId)).map(t=>t.id).sort()
      assert(affected.length&&equal(affected,[...op.taskIds].sort())&&affected.every(id=>!['confirmed','rejected'].includes(dispositions[id])),'MATERIAL_REVIEW_AFFECTED')
      assert(op.materialReview.identity===materialIdentity(before,op.materialReview.materialId),'MATERIAL_REVIEW_IDENTITY')
      assert(!equal(materialDecision(before,op.materialReview.materialId)??null,op.materialReview.value),'MATERIAL_REVIEW_NO_CHANGE')
      affected.forEach(id=>{delete reviewed[id]})
    } else if (op.kind === 'review_info') {
      assert(!op.taskIds.length && !informationReviewed && !informationReviewProblem(before), 'INFORMATION_REQUIRES_REVIEW')
      assert(op.field === null && op.value === null && op.before === null, 'INFO_OPERATION')
      informationReviewed = true
    } else {
      assert(op.taskIds.length && op.taskIds.every(id => dispositions[id] !== 'confirmed'), 'ALREADY_CONFIRMED')
      if (op.kind === 'correct_fact') {
        assert(op.correction && op.factReview && op.field === null && op.value === null && op.before === null, 'CORRECTION_SHAPE')
        assert(op.correction.id === op.id && op.correction.at === op.at, 'CORRECTION_IDENTITY')
        const changed = appendCorrection(state.adaptedResponse, prefix.filter(o => o.correction).map(o => o.correction!),
          op.correction, state.context.index, Object.keys(confirmedAt))
        assert(equal(changed.affectedTaskIds, [...op.taskIds].sort()) && op.taskIds.every(id => dispositions[id] !== 'rejected'), 'CORRECTION_AFFECTED')
        assert(equal(op.factReview.original, changed.sourceFacts), 'CORRECTION_REVIEW_BINDING')
        if (op.correction.change.kind === 'surface') {
          const id = op.correction.change.taskId, task = changed.facts.tasks.find(t => t.id === id)!
          // Only the untouched display default follows an explicitly saved fact correction.
          // User-authored titles remain separate; raw response and first suggestion never change.
          if (!prefix.some(o => o.kind === 'edit' && o.field === 'title' && o.taskIds[0] === id)) {
            values[id].title = task.action.surface + task.object.surface
          }
        }
        op.taskIds.forEach(id => { delete reviewed[id] })
      } else if (op.kind === 'edit') {
        assert(op.taskIds.length === 1 && (op.field === 'title' || op.field === 'deadline') && typeof op.value === 'string', 'EDIT_SHAPE')
        const id = op.taskIds[0], field = op.field
        assert(dispositions[id] !== 'rejected' && op.before === values[id][field], 'EDIT_CHAIN')
        if (field === 'title') assert(op.value.trim() && op.value.length <= 200, 'TITLE_INVALID')
        else {
          const support = editTimeSupport(before, id)
          assert(support.allowed, 'TIME_TYPE_OR_SHARED_NOT_EDITABLE')
          assert(op.value === '' ? support.points.length === 0 : validDate(op.value, state.context.timezone), 'USER_DATE_INVALID')
          assert(canAct(before, id), 'ITEM_REQUIRES_REVIEW')
        }
        values[id][field] = op.value; delete reviewed[id]
      } else if (op.kind === 'review_task') {
        assert(op.taskIds.length === 1 && op.field === null && op.value === null && op.before === null, 'REVIEW_SHAPE')
        const id = op.taskIds[0]
        assert(dispositions[id] !== 'rejected' && canAct(before, id), 'ITEM_NOT_REVIEWABLE')
        assert(!titleReviewProblem(values[id].title), 'TITLE_REQUIRES_EDIT')
        assert(op.reviewIdentity === liveReviewIdentity(before, id, values), 'REVIEW_FACTS_CHANGED')
        reviewed[id] = op.reviewIdentity; dispositions[id] = 'pending'
      } else {
        assert(op.field === null && op.value === null && op.before === null && ['confirm','defer','reject'].includes(op.kind), 'DISPOSITION_SHAPE')
        if (op.kind === 'confirm') {
          assert(op.taskIds.every(id=>canAct(before,id)),'ITEM_NOT_CONFIRMABLE')
          assert(op.taskIds.every(id=>!materialReviewProblem(before,id)),'MATERIAL_REVIEW_REQUIRED')
          assert(op.taskIds.every(id => !titleReviewProblem(values[id].title)), 'TITLE_REQUIRES_EDIT')
          const checked = effective.facts.tasks.filter(t => reviewed[t.id] === liveReviewIdentity(before, t.id, values))
            .map(t => ({ taskId: t.id, factIdentity: factIdentity(effective.facts, t.id) }))
          const selection = selectLiveTasks(effective.facts, review, checked, dispositions, op.taskIds, effective.sourceFacts)
          assert(op.taskIds.every(id => selection.find(t => t.taskId === id)?.selected), 'ITEM_NOT_CONFIRMABLE')
          for (const id of op.taskIds) { dispositions[id] = 'confirmed'; confirmedAt[id] = op.at }
        } else for (const id of op.taskIds) { dispositions[id] = op.kind === 'defer' ? 'deferred' : 'rejected'; delete reviewed[id] }
      }
    }
    prefix.push(op)
  }
  return { dispositions, values, confirmedAt, informationReviewed, reviewed, accepted: Object.keys(confirmedAt) }
}
export function saveState(workspace: WorkspaceV8, state: AnySemanticState): WorkspaceV8 {
  return { ...workspace, extractionDrafts: workspace.extractionDrafts.map(d => d.id === state.draftId
    ? { ...d, legacyData: { ...d.legacyData, mainline05: json(state) } } : d) }
}
export const realDatabaseName = (name: string) => /^rco-mainline-01-02-i1-real-input-[a-z0-9-]{10,100}$/.test(name)
export interface RealInputReading { version: typeof REAL_STATE_VERSION; inputReceipt: InputReceipt; sendSnapshot: SendSnapshot | null }
export function readingOf(value: unknown): RealInputReading {
  const row = plainJson(value) as RealInputReading
  assert(row && typeof row === 'object' && !Array.isArray(row), 'READING_MISSING')
  exactKeys(row, ['version', 'inputReceipt', 'sendSnapshot'])
  assert(row.version === REAL_STATE_VERSION, 'READING_VERSION')
  return row
}
async function validateReading(value: unknown) {
  const row = readingOf(value)
  await validateInputReceipt(row.inputReceipt)
  if (row.sendSnapshot !== null) await validateSendSnapshot(row.inputReceipt, row.sendSnapshot)
  return row
}
export function isLatestDraft(workspace: WorkspaceV8, draftId: string) {
  const draft = workspace.extractionDrafts.find(d => d.id === draftId), run = workspace.recognitionRuns.find(r => r.id === draft?.recognitionRunId)
  const version = workspace.sourceVersions.find(v => v.id === run?.sourceVersionId), source = workspace.sources.find(s => s.id === version?.sourceId)
  return Boolean(run && version && source?.currentVersionId === version.id
    && workspace.recognitionRuns.filter(r => r.sourceVersionId === version.id).at(-1)?.id === run.id)
}
/** Currentness is an input-scope identity, not just a run/version pointer.
 * Keep historical state readable and confirmed entities intact. An unrelated,
 * unsent page correction does not invalidate this explicitly limited response. */
export function isCurrentDraft(workspace: WorkspaceV8, draftId: string) {
  if (!isLatestDraft(workspace, draftId)) return false
  const draft = workspace.extractionDrafts.find(d => d.id === draftId)!
  const run = workspace.recognitionRuns.find(r => r.id === draft.recognitionRunId)!
  const version = workspace.sourceVersions.find(v => v.id === run.sourceVersionId)!
  const source = workspace.sources.find(s => s.id === version.sourceId)!
  if (!source.legacyData?.realInput01) return true // old explicit runtime is unchanged
  const pending = draft.legacyData?.realInputPending as unknown as { reading?: RealInputReading } | undefined
  if (!pending?.reading?.sendSnapshot) return false
  const sent = pending.reading, current = readingOf(source.legacyData.realInput01)
  const pages = new Set(sent.sendSnapshot!.pages)
  return current.inputReceipt.inputId === sent.inputReceipt.inputId
    && current.inputReceipt.originalSha256 === sent.inputReceipt.originalSha256
    && equal(current.inputReceipt.corrections.filter(c => pages.has(c.page)), sent.inputReceipt.corrections.filter(c => pages.has(c.page)))
    && equal(effectivePages(current.inputReceipt).filter(p => pages.has(p.number)), effectivePages(sent.inputReceipt).filter(p => pages.has(p.number)))
}
async function validateRealRoots(workspace: WorkspaceV8) {
  for (const source of workspace.sources) {
    const reading = await validateReading(source.legacyData?.realInput01)
    assert(source.type === reading.inputReceipt.sourceType, 'FILE_SOURCE_TYPE')
    const versions = workspace.sourceVersions.filter(v => v.sourceId === source.id).sort((a,b) => a.versionNo - b.versionNo)
    assert(versions.length && versions.at(-1)?.id === source.currentVersionId, 'CURRENT_VERSION')
    if (source.legacyData?.contentPreview !== undefined) assert(source.legacyData.contentPreview === versions.at(-1)!.rawText?.slice(0, 500), 'SOURCE_PREVIEW_MISMATCH')
    for (const [i, version] of versions.entries()) {
      assert(version.versionNo === i + 1 && typeof version.rawText === 'string'
        && version.contentHash === workspaceSnapshotHash(version.rawText), 'SOURCE_VERSION_HASH')
      const metadata = version.legacyData?.reviewMetadata
      assert(metadata && typeof metadata === 'object' && !Array.isArray(metadata), 'VERSION_READING_MISSING')
      const original = await validateReading(metadata.realInput01)
      assert(original.inputReceipt.inputId === reading.inputReceipt.inputId && original.inputReceipt.originalSha256 === reading.inputReceipt.originalSha256
        && equal(original.inputReceipt.corrections, reading.inputReceipt.corrections.slice(0, original.inputReceipt.corrections.length)), 'READING_ORIGINAL_CHANGED')
      const originalText = original.inputReceipt.pages.map(p => p.chunks.join('')).join('\n\n')
      assert(version.rawText === (original.sendSnapshot?.text ?? originalText), 'VERSION_TEXT_READING_MISMATCH')
    }
    const latest = workspace.recognitionRuns.filter(r => r.sourceVersionId === source.currentVersionId).at(-1)
    const draft = latest && workspace.extractionDrafts.find(d => d.recognitionRunId === latest.id)
    assert(source.status === (!latest ? 'uploaded' : draft?.status === 'processing' ? 'extracting' : draft?.status), 'SOURCE_CURRENT_RUN_STATUS')
  }
}
export async function validateSemanticWorkspace(workspace: WorkspaceV8, profile?: 'real-input-01') {
  assert(validateWorkspaceV8(workspace).valid, 'V8_INVALID')
  const real = profile === 'real-input-01'
  assert(real ? realDatabaseName(workspace.workspace.id) : /^rco-mainline-01-02-i1-mainline05-[a-z0-9-]{10,100}$/.test(workspace.workspace.id), 'WORKSPACE_SCOPE')
  if (real) await validateRealRoots(workspace)
  const expected = { tasks: [] as Task[], materials: [] as Material[], timePoints: [] as TimePoint[], events: [] as Event[],
    evidenceRefs: [] as EvidenceRef[], historyRecords: [] as HistoryRecord[] }
  for (const draft of workspace.extractionDrafts) {
    const run = workspace.recognitionRuns.find(r => r.id === draft.recognitionRunId)
    const version = workspace.sourceVersions.find(v => v.id === run?.sourceVersionId)
    const source = workspace.sources.find(s => s.id === version?.sourceId)
    assert(run && version && source && (real || source.currentVersionId === version.id) && typeof version.rawText === 'string'
      && version.contentHash === workspaceSnapshotHash(version.rawText) && draft.result === null, 'SOURCE_CHAIN_INVALID')
    if (real) {
      assert(run.modelName === MODEL_NAME && [PROMPT_VERSION,CANDIDATE02_VERSION].includes(run.promptVersion as typeof PROMPT_VERSION)
        && run.pipelineVersion === REAL_STATE_VERSION, 'RUN_IDENTITY')
      const pending = draft.legacyData?.realInputPending
      assert(pending && typeof pending === 'object' && !Array.isArray(pending), 'SEND_RECEIPT_MISSING')
      exactKeys(pending, ['reading', 'execution', 'operationId'])
      assert(typeof pending.operationId === 'string' && /^[A-Za-z0-9-]{1,100}$/.test(pending.operationId), 'SEND_OPERATION_ID')
      const reading = await validateReading(pending.reading)
      assert(reading.sendSnapshot && reading.sendSnapshot.text === version.rawText && reading.inputReceipt.sourceType === source.type, 'SEND_VERSION_BINDING')
      assert(['live','seen_engineering_replay'].includes(String(pending.execution))
        && run.provider === (pending.execution === 'live' ? 'deepseek' : 'manual'), 'EXECUTION_IDENTITY')
    } else assert(run.provider === 'manual' && run.modelName === 'human_engineering'
      && run.promptVersion === 'engineering-mainline-01' && run.pipelineVersion === STATE_VERSION, 'RUN_IDENTITY')
    const raw = draft.legacyData?.mainline05
    if (!raw) {
      assert(['queued', 'running', 'failed'].includes(run.status) && ['processing', 'failed'].includes(draft.status)
        && (real || source.status === (draft.status === 'failed' ? 'failed' : 'extracting')) && (run.status === 'failed') === (draft.status === 'failed')
        && !draft.acceptedEntityTempIds.length && !draft.rejectedEntityTempIds.length && !draft.commitOperationIds.length, 'MISSING_SEMANTIC_STATE')
      const failure = draft.legacyData?.mainline05Failure
      if (run.status === 'failed') {
        assert(failure && typeof failure === 'object' && !Array.isArray(failure), 'FAILURE_RECEIPT_MISSING')
        exactKeys(failure, ['version', 'response', 'code'])
        assert(failure.version === (real ? REAL_STATE_VERSION : STATE_VERSION) && failure.code === 'SEMANTIC_RESPONSE_REJECTED', 'FAILURE_RECEIPT_IDENTITY')
        plainJson(failure.response)
      } else assert(failure === undefined, 'UNEXPECTED_FAILURE_RECEIPT')
      continue
    }
    const state = plainJson(raw) as unknown as AnySemanticState
    const recovery = state.version === REAL_STATE_VERSION ? state.recovery : undefined
    exactKeys(state, ['version', 'sourceId', 'sourceVersionId', 'runId', 'draftId', 'rawOutputText', 'rawResponse',
      'legacyResponse', 'context', 'first', 'operations', 'bindings', ...(real ? ['rawHttpText', 'adaptedResponse', 'inputReceipt', 'sendSnapshot', 'execution',...(recovery?['recovery']:[])] : [])])
    assert(state.version === (real ? REAL_STATE_VERSION : STATE_VERSION) && state.sourceId === source.id && state.sourceVersionId === version.id
      && state.runId === run.id && state.draftId === draft.id && run.schemaVersion === state.version && run.status === (recovery?'failed':'succeeded'), 'STATE_IDENTITY')
    if(recovery){
      exactKeys(recovery,['kind','at'])
      assert(recovery.kind==='user_opened_failed_response'&&Number.isFinite(Date.parse(recovery.at)),'RECOVERY_IDENTITY')
      const f=draft.legacyData?.mainline05Failure as {response?:unknown;code?:unknown;version?:unknown}|undefined
      assert(f&&equal(f,{version:REAL_STATE_VERSION,response:(state as RealInputState).rawHttpText,code:'SEMANTIC_RESPONSE_REJECTED'}),'RECOVERY_RAW_BINDING')
    } else assert(draft.legacyData?.mainline05Failure === undefined, 'FAILED_RECEIPT_WITH_SUCCESS')
    assert(typeof state.rawOutputText === 'string' && equal(JSON.parse(state.rawOutputText), state.rawResponse), 'RAW_RESPONSE_MISMATCH')
    const initialFacts = state.version === STATE_VERSION ? state.rawResponse : state.adaptedResponse
    parseSemanticInput(initialFacts)
    assert(state.context.index.sourceContent === version.rawText && initialFacts.sourceId === source.id
      && initialFacts.sourceVersionId === version.id, 'RESPONSE_SOURCE_MISMATCH')
    if (state.version === REAL_STATE_VERSION) {
      assert(state.context.profile === 'real-input-01' && state.context.authority === 'live_model_candidate' && state.legacyResponse === null, 'LIVE_AUTHORITY')
      const parsed = parseModelEnvelope(state.rawHttpText, state.context)
      assert(equal(parsed.rawResponse, state.rawResponse) && parsed.rawOutputText === state.rawOutputText
        && equal(parsed.adaptedResponse, state.adaptedResponse), 'MODEL_ADAPTATION_MISMATCH')
      const pending = draft.legacyData!.realInputPending as unknown as { reading: RealInputReading; execution: string }
      assert(state.execution === pending.execution && equal(state.inputReceipt, pending.reading.inputReceipt)
        && equal(state.sendSnapshot, pending.reading.sendSnapshot), 'STATE_READING_BINDING')
    }
    assert(state.context.ownershipMode === 'mainline05-own-assets-1', 'SEMANTIC_OWNERSHIP_MODE_REQUIRED')
    const recomposed = await composeSemantics(initialFacts, state.context)
    assert(equal(recomposed, state.first), 'FIRST_RESPONSE_MISMATCH')
    assert(recovery || !recomposed.issues.some(i => ['BAD_ENTITY_REFERENCE', 'BAD_REVISION_REFERENCE'].includes(i.code)), 'INVALID_ENTITY_REFERENCE')
    assert(Array.isArray(state.operations), 'OPERATIONS_INVALID')
    if (state.version === REAL_STATE_VERSION) for (let i = 0; i < state.operations.length; i++) {
      const op = state.operations[i]
      if (op.kind !== 'correct_fact') continue
      const effective = effectiveStateFacts({ ...state, operations: state.operations.slice(0, i + 1) })
      const checked = await composeSemantics(effective.sourceFacts, state.context)
      assert(equal(op.factReview, checked), 'CORRECTION_RECOMPOSITION_MISMATCH')
      // A saved correction may leave another item unresolved. The unchanged per-item
      // safety policy still independently rejects that item's confirmation.
    }
    const current = life(state), facts = canonicalFacts(state)
    assert(equal(state.bindings, facts.bindings), 'CANONICAL_BINDINGS')
    assert(equal([...draft.acceptedEntityTempIds].sort(), [...current.accepted].sort()), 'ACCEPTED_STATE')
    assert(equal([...draft.rejectedEntityTempIds].sort(), Object.keys(current.dispositions).filter(id => current.dispositions[id] === 'rejected').sort()), 'REJECTED_STATE')
    assert(equal(draft.commitOperationIds, state.operations.filter(o => o.kind === 'confirm').map(o => semanticId('operation', state, o.id))), 'COMMIT_OPERATIONS')
    const terminal = current.informationReviewed || (initialFacts.tasks.length > 0 && Object.values(current.dispositions).every(d => ['confirmed','rejected'].includes(d)))
    const status = terminal ? 'confirmed' : current.accepted.length ? 'partially_confirmed' : 'needs_review'
    assert(draft.status === status && (real || source.status === status), 'LIFECYCLE_STATUS')
    for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
      // Per-array comparison below does not rely on an unchecked union assignment.
      const values = facts[key]; (expected[key] as Array<{ id: string }>).push(...values)
    }
  }
  assert(!workspace.projects.length && !workspace.milestones.length && !workspace.workPackages.length
    && !workspace.reminderRecords.length && !workspace.changeProposals.length, 'UNSUPPORTED_CANONICAL_WRITES')
  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    const sorted = (rows: ReadonlyArray<{ id: string }>) => [...rows].sort((a,b) => a.id.localeCompare(b.id))
    assert(equal(sorted(workspace[key]), sorted(expected[key])), 'CANONICAL_FIDELITY:' + key)
  }
  return workspace
}
