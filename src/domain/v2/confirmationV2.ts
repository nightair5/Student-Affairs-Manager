import { applyDomainCommitPlan, buildDomainCommitPlanV2, supportsTimeOverrideV2, type DomainCommitSelection } from './domainCommit'
import { workspaceSnapshotHash } from './migration'
import type { CanonicalWorkspaceRepository } from './repository'
import type { WorkspaceV8 } from './types'
import { validateWorkspaceV8 } from './validators/workspaceValidator'
import { isDateOnly, isValidTimeZone, parseBusinessDateTime } from '../../lib/timeSemantics'
import type { RecognitionResult, TaskSuggestionV2 } from '../../recognition/types'
/** Follow ownership links without traversing through a sibling task. */
function associated(result: RecognitionResult, task: TaskSuggestionV2) {
  const materials = result.materials.filter((item) => task.materialTempIds.includes(item.tempId)
    || item.relatedTaskTempIds.includes(task.tempId))
  const materialIds = new Set(materials.map((item) => item.tempId))
  const points = result.timePoints.filter((item) => task.timePointTempIds.includes(item.tempId)
    || item.relatedTaskTempIds.includes(task.tempId)
    || item.relatedMaterialTempIds.some((id) => materialIds.has(id)))
  const timeIds = new Set(points.map((item) => item.tempId))
  const events = result.events.filter((item) => (item.startTimePointTempId && timeIds.has(item.startTimePointTempId))
    || (item.endTimePointTempId && timeIds.has(item.endTimePointTempId)))
  const ids = new Set([task.tempId, ...materialIds, ...timeIds, ...events.map((item) => item.tempId)])
  return { materials, points, events, ids }
}

export type ConfirmationEditField = 'title' | 'deadline'
export interface ConfirmationEditV2 {
  draftId: string; taskTempId: string; revision: string; operationId: string
  field: ConfirmationEditField; value: string
}
export interface ConfirmationIntentV2 { draftId: string; revision: string; taskTempIds: string[] }
const EDIT_ACTION = 'confirmation_v2_edit'
const fail = (code: string): never => { throw new Error(`CONFIRMATION_V2_${code}`) }
function same(a: unknown, b: unknown) { return workspaceSnapshotHash(a) === workspaceSnapshotHash(b) }
function exactKeys(value: object, keys: string[]) {
  if (!same(Object.keys(value).sort(), [...keys].sort())) fail('UNSUPPORTED_FIELDS')
}
export function confirmationRevisionV2(workspace: WorkspaceV8): string { return workspaceSnapshotHash(workspace) }

function context(workspace: WorkspaceV8, draftId: string) {
  if (!validateWorkspaceV8(workspace).valid) fail('WORKSPACE_INVALID')
  const draft = workspace.extractionDrafts.find((item) => item.id === draftId)
  const result = draft?.result
  const run = workspace.recognitionRuns.find((item) => item.id === draft?.recognitionRunId)
  const version = workspace.sourceVersions.find((item) => item.id === run?.sourceVersionId)
  const source = workspace.sources.find((item) => item.id === version?.sourceId)
  if (!draft || !result || !run || run.status !== 'succeeded' || !version || !source
    || !version.rawText || version.contentHash !== workspaceSnapshotHash(version.rawText)
    || source.currentVersionId !== version.id) return fail('SOURCE_CHAIN_INVALID')
  for (const entity of [source, version, run, draft]) {
    const metadata = entity.legacyData?.reviewMetadata
    if (entity.needsReview || (metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      && (metadata.partialExtraction || metadata.truncated))) fail('INCOMPLETE_SOURCE')
  }
  const tasks = [...result.standaloneTasks, ...result.milestones.flatMap((milestone) =>
    [...milestone.tasks, ...milestone.workPackages.flatMap((group) => group.tasks)])]
  const fingerprint = workspaceSnapshotHash({ result, version })
  const edits = workspace.historyRecords.filter((row) => row.action === EDIT_ACTION && row.entityId === draftId)
  const values: Record<string, Partial<Record<ConfirmationEditField, string>>> = Object.create(null)
  const original = (taskId: string, field: ConfirmationEditField): string => {
    const task = tasks.find((item) => item.tempId === taskId)
    if (!task) return fail('TASK_MISSING')
    const { points } = associated(result, task)
    return field === 'title' ? task.title : points.length === 1 ? points[0].normalizedValue ?? '' : ''
  }
  for (const row of edits) {
    if (row.actor !== 'user' || row.entityType !== 'extraction_draft' || row.sourceVersionId !== version.id
      || row.reason !== `confirmation-v2:${fingerprint}` || typeof row.after !== 'string') fail('EDIT_HISTORY_INVALID')
    let key: unknown
    try { key = JSON.parse(row.fieldName ?? '') } catch { fail('EDIT_HISTORY_INVALID') }
    if (!Array.isArray(key) || key.length !== 2 || typeof key[0] !== 'string'
      || (key[1] !== 'title' && key[1] !== 'deadline')) fail('EDIT_HISTORY_INVALID')
    const [taskId, field] = key as [string, ConfirmationEditField]
    const current = values[taskId]?.[field] ?? original(taskId, field)
    if (row.before !== current) fail('EDIT_HISTORY_CHAIN_INVALID')
    values[taskId] = { ...values[taskId], [field]: row.after as string }
  }
  const overrides: DomainCommitSelection['taskOverrides'] = Object.create(null)
  for (const [taskId, fields] of Object.entries(values)) for (const field of ['title', 'deadline'] as const) {
    if (fields[field] !== undefined && fields[field] !== original(taskId, field)) {
      overrides![taskId] = { ...overrides![taskId], [field]: fields[field] }
    }
  }
  return { draft, result, run, version, source, tasks, fingerprint, edits, values, overrides: overrides!, original }
}

function validDate(value: string, timezone: string) {
  if (isDateOnly(value)) return true
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?$/u.test(value)
    || !isDateOnly(value.slice(0, 10)) || !isValidTimeZone(timezone)) return false
  const hour = Number(value.slice(11, 13)), minute = Number(value.slice(14, 16))
  const second = value[16] === ':' ? Number(value.slice(17, 19)) : 0
  return hour < 24 && minute < 60 && second < 60 && Boolean(parseBusinessDateTime(value, timezone))
}

function checkedEvidence(ctx: ReturnType<typeof context>, ids: string[]) {
  if (!ids.length) fail('EVIDENCE_REQUIRED')
  for (const id of ids) {
    const evidence = ctx.result.evidence.find((item) => item.id === id)
    if (!evidence || evidence.sourceId !== ctx.source.id || !Number.isInteger(evidence.textStart)
      || !Number.isInteger(evidence.textEnd) || evidence.textStart! < 0 || evidence.textEnd! <= evidence.textStart!
      || evidence.textEnd! > ctx.version.rawText!.length
      || ctx.version.rawText!.slice(evidence.textStart!, evidence.textEnd!) !== evidence.quotedText) fail('EVIDENCE_INVALID')
  }
}

export function confirmationStateV2(workspace: WorkspaceV8, draftId: string, taskId: string) {
  const ctx = context(workspace, draftId)
  const task = ctx.tasks.find((item) => item.tempId === taskId)
  if (!task) return fail('TASK_MISSING')
  const related = associated(ctx.result, task)
  const { points } = related
  const editedDate = ctx.overrides[taskId]?.deadline
  const dateEditBlockedReason = points.some((point) => !supportsTimeOverrideV2(point.type))
    ? '本轮不支持修改计划开始或事件时间，原始时间仍保留。' : undefined
  let blockedReason: string | undefined
  try {
    if (!task.actionVerb.trim() || !task.actionObject.trim()) fail('TASK_INCOMPLETE')
    if (!ctx.result.sourceSummary.requiresAction || task.selected === false) fail('TASK_REQUIRES_REVIEW')
    checkedEvidence(ctx, task.evidenceIds)
    for (const id of task.materialTempIds) {
      if (!ctx.result.materials.some((material) => material.tempId === id && material.relatedTaskTempIds.includes(taskId))) fail('MATERIAL_REFERENCE_INVALID')
    }
    for (const id of task.timePointTempIds) {
      if (!points.some((point) => point.tempId === id)) fail('TIME_REFERENCE_INVALID')
    }
    for (const material of related.materials) {
      if (material.selected === false) fail('MATERIAL_REQUIRES_REVIEW')
      checkedEvidence(ctx, material.evidenceIds)
    }
    if (ctx.result.conflicts.some((item) => item.requiresDecision && (!item.entityTempIds.length || item.entityTempIds.some((id) => related.ids.has(id))))) fail('CONFLICT_REQUIRES_REVIEW')
    // The current task-only intent cannot authorize an event. Keep its full draft and block locally.
    if (related.events.length) fail('EVENT_REQUIRES_SEPARATE_CONFIRMATION')
    // This contract cannot assign an unscoped deadline ambiguity to a sibling safely.
    if (ctx.result.ambiguities.some((item) => /deadline|time|date/iu.test(item.field))) fail('TIME_REQUIRES_REVIEW')
    for (const point of points) {
      if (!point.relatedTaskTempIds.includes(taskId) && !point.relatedMaterialTempIds.some((id) => related.materials.some((material) => material.tempId === id))) fail('TIME_REFERENCE_INVALID')
      if (point.relatedMaterialTempIds.some((id) => !ctx.result.materials.some((material) => material.tempId === id))) fail('TIME_REFERENCE_INVALID')
      checkedEvidence(ctx, point.evidenceIds)
      if (point.selected === false || point.needsConfirmation || !['exact', 'date_only'].includes(point.precision)
        || !point.normalizedValue || !validDate(point.normalizedValue, point.timezone)) fail('TIME_REQUIRES_REVIEW')
      if (point.precision === 'date_only' && (!isDateOnly(point.normalizedValue!) || !point.isAllDay)) fail('TIME_PRECISION_INVALID')
      if (point.precision === 'exact' && (isDateOnly(point.normalizedValue!) || point.isAllDay)) fail('TIME_PRECISION_INVALID')
    }
    if (editedDate !== undefined && dateEditBlockedReason) fail('TIME_TYPE_NOT_EDITABLE')
    if (editedDate !== undefined && !validDate(editedDate, points[0]?.timezone ?? workspace.settings.defaultTimezone)) fail('USER_DATE_INVALID')
  } catch (error) { blockedReason = error instanceof Error ? error.message : 'CONFIRMATION_V2_REVIEW_REQUIRED' }
  const firstDate = points.length === 1 ? points[0].normalizedValue ?? '' : ''
  const value = editedDate ?? firstDate
  return {
    defaultSelected: !blockedReason && task.inferenceLevel === 'explicit' && task.selected !== false,
    materialTempIds: related.materials.map((item) => item.tempId),
    timePointTempIds: points.length ? points.map((item) => item.tempId) : editedDate ? [`manual-deadline:${taskId}`] : [],
    blockedReason, dateEditBlockedReason, value, edited: editedDate !== undefined,
    dateLabel: blockedReason ? '待核对：不能按无日期直接确认'
      : value ? `${value}${isDateOnly(value) ? '（仅日期）' : `（${points[0]?.timezone ?? workspace.settings.defaultTimezone}）`}${editedDate !== undefined ? ' · 用户修改' : ''}`
        : points.length ? '多个时间节点，请回看原文' : '原文未说明截止时间 · 可无日期确认',
    originalDate: firstDate,
  }
}

export function reviewEditsV2(workspace: WorkspaceV8, draftId: string) {
  const ctx = context(workspace, draftId)
  return { revision: confirmationRevisionV2(workspace), overrides: ctx.overrides, history: ctx.edits }
}

export async function editConfirmationV2(repository: CanonicalWorkspaceRepository, request: ConfirmationEditV2, now = new Date().toISOString()) {
  exactKeys(request, ['draftId', 'taskTempId', 'revision', 'operationId', 'field', 'value'])
  if (!['title', 'deadline'].includes(request.field) || typeof request.value !== 'string'
    || !/^[a-zA-Z0-9-]{1,100}$/u.test(request.operationId)) fail('EDIT_INVALID')
  return repository.transaction((workspace) => {
    const ctx = context(workspace, request.draftId)
    const id = `confirmation-v2-edit:${request.draftId}:${request.operationId}`
    const existing = workspace.historyRecords.find((row) => row.id === id)
    const fieldName = JSON.stringify([request.taskTempId, request.field])
    if (existing) {
      if (existing.fieldName !== fieldName || existing.after !== request.value) fail('OPERATION_COLLISION')
      return workspace
    }
    if (request.revision !== confirmationRevisionV2(workspace)) fail('STALE')
    if (ctx.draft.acceptedEntityTempIds.includes(request.taskTempId) || ctx.draft.rejectedEntityTempIds.includes(request.taskTempId)) fail('ALREADY_PROCESSED')
    const before = ctx.values[request.taskTempId]?.[request.field] ?? ctx.original(request.taskTempId, request.field)
    if (before === request.value) return workspace
    if (request.field === 'title' && (!request.value.trim() || request.value.length > 200)) fail('TITLE_INVALID')
    if (request.field === 'deadline') {
      const task = ctx.tasks.find((item) => item.tempId === request.taskTempId)!
      const { points, events } = associated(ctx.result, task)
      if (points.some((point) => !supportsTimeOverrideV2(point.type))) fail('TIME_TYPE_NOT_EDITABLE')
      if (events.length) fail('EVENT_REQUIRES_SEPARATE_CONFIRMATION')
      if (points.length > 1 || points.some((point) => point.relatedTaskTempIds.length !== 1
        || !point.relatedTaskTempIds.includes(request.taskTempId)
        || point.relatedMaterialTempIds.some((id) => ctx.result.materials.find((material) => material.tempId === id)?.relatedTaskTempIds.some((owner) => owner !== request.taskTempId)))) fail('SHARED_OR_MULTIPLE_TIME_EDIT_BLOCKED')
      if (request.value === '' ? points.length !== 0 : !validDate(request.value, points[0]?.timezone ?? workspace.settings.defaultTimezone)) fail('USER_DATE_INVALID')
      // A dry plan uses the real commit policy and current canonical entities, but writes nothing.
      const { materials } = associated(ctx.result, task)
      buildDomainCommitPlanV2(workspace, request.draftId, {
        taskTempIds: [task.tempId], materialTempIds: materials.map((material) => material.tempId),
        timePointTempIds: points.map((point) => point.tempId), eventTempIds: [],
        taskOverrides: { [task.tempId]: { ...ctx.overrides[task.tempId], deadline: request.value } },
      }, now)
    }
    return { ...workspace, workspace: { ...workspace.workspace, updatedAt: now }, historyRecords: [...workspace.historyRecords, {
      id, entityType: 'extraction_draft', entityId: request.draftId, action: EDIT_ACTION, fieldName,
      before, after: request.value, actor: 'user', reason: `confirmation-v2:${ctx.fingerprint}`,
      sourceVersionId: ctx.version.id, changedAt: now,
    }] }
  })
}

export async function confirmV2(repository: CanonicalWorkspaceRepository, intent: ConfirmationIntentV2, now = new Date().toISOString()) {
  exactKeys(intent, ['draftId', 'revision', 'taskTempIds'])
  if (!Array.isArray(intent.taskTempIds) || !intent.taskTempIds.length
    || Object.keys(intent.taskTempIds).length !== intent.taskTempIds.length
    || new Set(intent.taskTempIds).size !== intent.taskTempIds.length
    || intent.taskTempIds.some((id) => typeof id !== 'string')) fail('SELECTION_INVALID')
  const operationId = `confirmation-v2:${workspaceSnapshotHash(intent)}`
  return repository.transaction((workspace) => {
    const ctx = context(workspace, intent.draftId)
    if (ctx.draft.commitOperationIds.includes(operationId)) return workspace
    if (intent.revision !== confirmationRevisionV2(workspace)) fail('STALE')
    for (const taskId of intent.taskTempIds) {
      if (ctx.draft.acceptedEntityTempIds.includes(taskId) || ctx.draft.rejectedEntityTempIds.includes(taskId)) fail('ALREADY_PROCESSED')
      const state = confirmationStateV2(workspace, intent.draftId, taskId)
      if (state.blockedReason) throw new Error(state.blockedReason)
    }
    const related = intent.taskTempIds.map((id) => associated(ctx.result, ctx.tasks.find((task) => task.tempId === id)!))
    const materialIds = new Set(related.flatMap((item) => item.materials.map((material) => material.tempId)))
    const timeIds = new Set(related.flatMap((item) => item.points.map((point) => point.tempId)))
    const selection: DomainCommitSelection = {
      taskTempIds: [...intent.taskTempIds], materialTempIds: [...materialIds],
      timePointTempIds: [...timeIds], eventTempIds: [],
      taskOverrides: Object.fromEntries(intent.taskTempIds.filter((id) => ctx.overrides[id]).map((id) => [id, ctx.overrides[id]])),
    }
    const plan = buildDomainCommitPlanV2(workspace, intent.draftId, selection, now)
    plan.operationId = operationId
    return applyDomainCommitPlan(workspace, plan, now)
  })
}
