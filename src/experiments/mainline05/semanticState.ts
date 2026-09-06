import type { WorkspaceV8, JsonValue, Task, Material, TimePoint, Event, EvidenceRef, HistoryRecord } from '../../domain/v2/types'
import { validateWorkspaceV8 } from '../../domain/v2/validators/workspaceValidator'
import { workspaceSnapshotHash } from '../../domain/v2/migration'
import { isDateOnly, parseBusinessDateTime } from '../../lib/timeSemantics'
import { composeSemantics, type ComposeContext, type ReviewPackage } from '../mainline04/semanticComposer'
import { parseSemanticInput, plainJson, stableJson, type SemanticInput } from '../mainline04/semanticContract'

export const STATE_VERSION = 'mainline05-semantic-state-1' as const
export type Disposition = 'pending' | 'deferred' | 'rejected' | 'confirmed'
export interface SemanticOperation {
  id: string; kind: 'edit' | 'confirm' | 'defer' | 'reject' | 'review_info'
  at: string; taskIds: string[]; field: 'title' | 'deadline' | null; value: string | null; before: string | null
}
export interface SemanticState {
  version: typeof STATE_VERSION
  sourceId: string; sourceVersionId: string; runId: string; draftId: string
  rawOutputText: string; rawResponse: SemanticInput; legacyResponse: JsonValue
  context: ComposeContext; first: ReviewPackage
  operations: SemanticOperation[]
  bindings: Record<string, string | null>
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
  const value = workspace.extractionDrafts.find(d => d.id === draftId)?.legacyData?.mainline05
  assert(value && typeof value === 'object' && !Array.isArray(value), 'DRAFT_NOT_READY')
  return value as unknown as SemanticState
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
export function editTimeSupport(state: SemanticState, id: string) {
  const task = state.rawResponse.tasks.find(t => t.id === id)
  assert(task, 'TASK_MISSING')
  const assets = relatedAssets(state.rawResponse, [id]), points = state.rawResponse.timePoints.filter(t => assets.times.has(t.tempId))
  const shared = state.rawResponse.tasks.some(t => t.id !== id
    && [...relatedAssets(state.rawResponse, [t.id]).times].some(time => assets.times.has(time)))
  return { points, allowed: assets.events.size === 0 && points.length <= 1 && !shared
    && points.every(t => deadlineType(t.type)) && (points.length > 0 || task.coverage.time === 'not_stated') }
}
export function canAct(state: SemanticState, id: string): boolean {
  const item = state.first.items.find(i => i.tempId === id)
  const task = state.rawResponse.tasks.find(t => t.id === id)
  return Boolean(item && task && state.context.authority === 'human_engineering' && item.requiresAction === 'true'
    && item.issues.length === 0 && ['addressee', 'addressed_group'].includes(task.semantics.actor) && task.effect !== 'unknown')
}
function validDate(value: string, timezone: string) {
  return isDateOnly(value) || (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && parseBusinessDateTime(value, timezone) !== null)
}
export function informationReviewProblem(state: SemanticState): string | undefined {
  if (state.rawResponse.tasks.length) return '包含任务建议，请逐项核对。'
  if (state.first.issues.length || state.rawResponse.unresolvedScopeIds.length) {
    return '原文尚有未覆盖或未解决的信息，需继续核对：' + state.first.issues.map(issue => issue.code).join('、')
  }
  return undefined
}
export function life(state: SemanticState) {
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
export function operationHistory(state: SemanticState): HistoryRecord[] {
  return state.operations.map(op => ({ id: semanticId('history', state, op.id), entityType: 'extraction_draft', entityId: state.draftId,
    action: 'mainline05_' + op.kind, fieldName: op.field ? JSON.stringify([op.taskIds[0], op.field]) : null,
    before: op.before, after: op.kind === 'edit' ? op.value : json({ taskIds: op.taskIds, kind: op.kind }), actor: 'user',
    reason: STATE_VERSION, sourceVersionId: state.sourceVersionId, changedAt: op.at }))
}
export function canonicalFacts(state: SemanticState) {
  const input = state.rawResponse, current = life(state), accepted = new Set(current.accepted)
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
    return { id: materialId(m.tempId), projectId: null, name: m.name, required: m.required, status: m.required ? 'missing' : 'not_required',
      requirements: [], formatRequirements: [...m.formatRequirements], namingRequirements: [...m.namingRequirements], quantity: m.quantity,
      submissionChannel: m.submissionChannel, relatedTaskIds: owners('materials', m.tempId).map(taskId),
      deadlineTimePointId: associated.length === 1 ? associated[0].id : null, ...stamps(owners('materials', m.tempId)), version: 1, legacyData: pointer(m.tempId) }
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
export function saveState(workspace: WorkspaceV8, state: SemanticState): WorkspaceV8 {
  return { ...workspace, extractionDrafts: workspace.extractionDrafts.map(d => d.id === state.draftId
    ? { ...d, legacyData: { ...d.legacyData, mainline05: json(state) } } : d) }
}
export async function validateSemanticWorkspace(workspace: WorkspaceV8) {
  assert(validateWorkspaceV8(workspace).valid, 'V8_INVALID')
  assert(/^rco-mainline-01-02-i1-mainline05-[a-z0-9-]{10,100}$/.test(workspace.workspace.id), 'WORKSPACE_SCOPE')
  const expected = { tasks: [] as Task[], materials: [] as Material[], timePoints: [] as TimePoint[], events: [] as Event[],
    evidenceRefs: [] as EvidenceRef[], historyRecords: [] as HistoryRecord[] }
  for (const draft of workspace.extractionDrafts) {
    const run = workspace.recognitionRuns.find(r => r.id === draft.recognitionRunId)
    const version = workspace.sourceVersions.find(v => v.id === run?.sourceVersionId)
    const source = workspace.sources.find(s => s.id === version?.sourceId)
    assert(run && version && source && source.currentVersionId === version.id && typeof version.rawText === 'string'
      && version.contentHash === workspaceSnapshotHash(version.rawText) && draft.result === null, 'SOURCE_CHAIN_INVALID')
    assert(run.provider === 'manual' && run.modelName === 'human_engineering'
      && run.promptVersion === 'engineering-mainline-01' && run.pipelineVersion === STATE_VERSION, 'RUN_IDENTITY')
    const raw = draft.legacyData?.mainline05
    if (!raw) {
      assert(['queued', 'running', 'failed'].includes(run.status) && ['processing', 'failed'].includes(draft.status)
        && source.status === (draft.status === 'failed' ? 'failed' : 'extracting') && (run.status === 'failed') === (draft.status === 'failed')
        && !draft.acceptedEntityTempIds.length && !draft.rejectedEntityTempIds.length && !draft.commitOperationIds.length, 'MISSING_SEMANTIC_STATE')
      const failure = draft.legacyData?.mainline05Failure
      if (run.status === 'failed') {
        assert(failure && typeof failure === 'object' && !Array.isArray(failure), 'FAILURE_RECEIPT_MISSING')
        exactKeys(failure, ['version', 'response', 'code'])
        assert(failure.version === STATE_VERSION && failure.code === 'SEMANTIC_RESPONSE_REJECTED', 'FAILURE_RECEIPT_IDENTITY')
        plainJson(failure.response)
      } else assert(failure === undefined, 'UNEXPECTED_FAILURE_RECEIPT')
      continue
    }
    const state = plainJson(raw) as unknown as SemanticState
    exactKeys(state, ['version', 'sourceId', 'sourceVersionId', 'runId', 'draftId', 'rawOutputText', 'rawResponse',
      'legacyResponse', 'context', 'first', 'operations', 'bindings'])
    assert(state.version === STATE_VERSION && state.sourceId === source.id && state.sourceVersionId === version.id
      && state.runId === run.id && state.draftId === draft.id && run.schemaVersion === STATE_VERSION && run.status === 'succeeded', 'STATE_IDENTITY')
    assert(draft.legacyData?.mainline05Failure === undefined, 'FAILED_RECEIPT_WITH_SUCCESS')
    assert(typeof state.rawOutputText === 'string' && equal(JSON.parse(state.rawOutputText), state.rawResponse), 'RAW_RESPONSE_MISMATCH')
    parseSemanticInput(state.rawResponse)
    assert(state.context.index.sourceContent === version.rawText && state.rawResponse.sourceId === source.id
      && state.rawResponse.sourceVersionId === version.id, 'RESPONSE_SOURCE_MISMATCH')
    assert(state.context.ownershipMode === 'mainline05-own-assets-1', 'SEMANTIC_OWNERSHIP_MODE_REQUIRED')
    const recomposed = await composeSemantics(state.rawResponse, state.context)
    assert(equal(recomposed, state.first), 'FIRST_RESPONSE_MISMATCH')
    assert(!recomposed.issues.some(i => ['BAD_ENTITY_REFERENCE', 'BAD_REVISION_REFERENCE'].includes(i.code)), 'INVALID_ENTITY_REFERENCE')
    assert(Array.isArray(state.operations), 'OPERATIONS_INVALID')
    const current = life(state), facts = canonicalFacts(state)
    assert(equal(state.bindings, facts.bindings), 'CANONICAL_BINDINGS')
    assert(equal([...draft.acceptedEntityTempIds].sort(), [...current.accepted].sort()), 'ACCEPTED_STATE')
    assert(equal([...draft.rejectedEntityTempIds].sort(), Object.keys(current.dispositions).filter(id => current.dispositions[id] === 'rejected').sort()), 'REJECTED_STATE')
    assert(equal(draft.commitOperationIds, state.operations.filter(o => o.kind === 'confirm').map(o => semanticId('operation', state, o.id))), 'COMMIT_OPERATIONS')
    const terminal = current.informationReviewed || (state.rawResponse.tasks.length > 0 && Object.values(current.dispositions).every(d => ['confirmed','rejected'].includes(d)))
    const status = terminal ? 'confirmed' : current.accepted.length ? 'partially_confirmed' : 'needs_review'
    assert(draft.status === status && source.status === status, 'LIFECYCLE_STATUS')
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
