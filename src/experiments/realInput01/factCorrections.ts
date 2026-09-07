import { parseSemanticInput, plainJson, stableJson, type SemanticInput, type SemanticMaterial } from '../mainline04/semanticContract'
import type { ImmutableScopeIndex, SurfaceReference } from '../../recognition/scopeReferenceContract'
import type { MaterialStatus } from '../../domain/v2/types'

/** User observation, not a model claim or a source quotation. */
export interface MaterialDecision { required: boolean; status: MaterialStatus }
export const materialStatusLabels: Record<MaterialStatus, string> = {missing:'确实缺少',preparing:'正在准备',ready:'已具备',submitted:'已提交',verified:'已核验',not_required:'不作为必备材料'}
export function validateMaterialDecision(value: unknown): MaterialDecision {
  const row=plainJson(value) as MaterialDecision
  if (!row || typeof row!=='object' || Array.isArray(row)) return reject('MATERIAL_DECISION')
  keys(row,['required','status'])
  if (typeof row.required!=='boolean' || typeof row.status!=='string' || !Object.hasOwn(materialStatusLabels,row.status)
    || (row.required && row.status==='not_required')) return reject('MATERIAL_DECISION')
  return row
}

export type MaterialEdit = Pick<SemanticMaterial, 'name' | 'quantity' | 'formatRequirements' | 'namingRequirements' | 'submissionChannel' | 'relatedTaskTempIds'>
export type FactChange = { kind: 'surface'; taskId: string; field: 'action' | 'object'; value: SurfaceReference }
  | { kind: 'material'; materialId: string; value: MaterialEdit }
export interface FactCorrection { id: string; at: string; change: FactChange; before: SurfaceReference | MaterialEdit }
const reject = (code: string): never => { throw Error('REAL_INPUT_CORRECTION_' + code) }
const same = (a: unknown, b: unknown) => stableJson(a) === stableJson(b)
function keys(value: object, names: string[]) {
  if (!same(Object.keys(value).sort(), names.sort())) reject('FIELDS')
}
export const materialEdit = (item: SemanticMaterial): MaterialEdit => ({ name: item.name, quantity: item.quantity,
  formatRequirements: [...item.formatRequirements], namingRequirements: [...item.namingRequirements],
  submissionChannel: item.submissionChannel, relatedTaskTempIds: [...item.relatedTaskTempIds] })

/** Explicit entity edges only. Dependencies carry safety, never ownership of dates. */
export function factAssets(input: SemanticInput, taskId: string) {
  const task = input.tasks.find(t => t.id === taskId)
  if (!task) return reject('TASK_MISSING')
  const materials = new Set(task.detail.materialTempIds), times = new Set(task.detail.timePointTempIds), events = new Set(task.eventTempIds)
  let size = -1
  while (size !== materials.size + times.size + events.size) {
    size = materials.size + times.size + events.size
    for (const m of input.materials) if (m.relatedTaskTempIds.includes(taskId)) materials.add(m.tempId)
    for (const t of input.timePoints) if (times.has(t.tempId) || t.relatedTaskTempIds.includes(taskId)
      || t.relatedMaterialTempIds.some(id => materials.has(id))) {
      times.add(t.tempId); t.relatedMaterialTempIds.forEach(id => materials.add(id))
    }
    for (const e of input.events) if (events.has(e.tempId) || e.relatedTaskTempIds.includes(taskId)
      || (e.startTimePointTempId && times.has(e.startTimePointTempId)) || (e.endTimePointTempId && times.has(e.endTimePointTempId))) {
      events.add(e.tempId); if (e.startTimePointTempId) times.add(e.startTimePointTempId); if (e.endTimePointTempId) times.add(e.endTimePointTempId)
    }
  }
  return { materials, times, events }
}
function safetyTasks(input: SemanticInput, initial: Set<string>) {
  const found = new Set(initial)
  let size = -1
  while (size !== found.size) {
    size = found.size
    for (const task of input.tasks) if (task.detail.dependencyTempIds.some(id => found.has(id))
      || (task.detail.parentTempId && found.has(task.detail.parentTempId))) found.add(task.id)
    for (const r of input.revisions) if (found.has(r.targetDirectiveId) || (r.fromDirectiveId && found.has(r.fromDirectiveId))) {
      found.add(r.targetDirectiveId); if (r.fromDirectiveId) found.add(r.fromDirectiveId)
    }
  }
  return found
}
function affected(input: SemanticInput, change: FactChange) {
  return safetyTasks(input, new Set(change.kind === 'surface' ? [change.taskId]
    : input.tasks.filter(t => factAssets(input, t.id).materials.has(change.materialId)).map(t => t.id)))
}
function apply(input: SemanticInput, change: FactChange, index: ImmutableScopeIndex) {
  if (change.kind === 'surface') {
    keys(change, ['kind', 'taskId', 'field', 'value']); keys(change.value, ['scopeId', 'surface'])
    if (!['action', 'object'].includes(change.field)) reject('SURFACE_FIELD')
    const task = input.tasks.find(t => t.id === change.taskId), scope = index.scopes.find(s => s.id === change.value.scopeId)
    if (!task || !scope || !task.propositionScopeIds.includes(scope.id) || !change.value.surface.trim()
      || !scope.text.includes(change.value.surface)) return reject('SURFACE_OUTSIDE_PROPOSITION')
    task[change.field] = plainJson(change.value)
  } else if (change.kind === 'material') {
    keys(change, ['kind', 'materialId', 'value'])
    keys(change.value, ['name', 'quantity', 'formatRequirements', 'namingRequirements', 'submissionChannel', 'relatedTaskTempIds'])
    const item = input.materials.find(m => m.tempId === change.materialId)
    if (!item) return reject('MATERIAL_MISSING')
    const ids = change.value.relatedTaskTempIds
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => !input.tasks.some(t => t.id === id))) reject('OWNER_INVALID')
    const previous = new Set(input.tasks.filter(t => factAssets(input, t.id).materials.has(item.tempId)).map(t => t.id))
    Object.assign(item, plainJson(change.value))
    // Both directions are updated together, never delete time/event edges to force ownership.
    for (const task of input.tasks) {
      task.detail.materialTempIds = task.detail.materialTempIds.filter(id => id !== item.tempId)
      if (ids.includes(task.id)) task.detail.materialTempIds.push(item.tempId)
      if (previous.has(task.id) || ids.includes(task.id)) task.coverage.material = factAssets(input, task.id).materials.size ? 'present' : 'not_stated'
    }
    for (const task of input.tasks) if (factAssets(input, task.id).materials.has(item.tempId) !== ids.includes(task.id)) reject('OWNER_HAS_OTHER_RELATIONS')
  } else reject('KIND')
  parseSemanticInput(input)
}
export function correctionBefore(input: SemanticInput, change: FactChange) {
  if (change.kind === 'surface') {
    const task = input.tasks.find(t => t.id === change.taskId)
    if (!task) return reject('TASK_MISSING')
    return plainJson(task[change.field])
  }
  const item = input.materials.find(m => m.tempId === change.materialId)
  if (!item) return reject('MATERIAL_MISSING')
  return materialEdit(item)
}

/** A manual overlay is not source evidence. sourceFacts is the only composer input;
 * facts is the displayed/saved view. Relations are explicit user edits, kept in deltas. */
export function effectiveFacts(original: SemanticInput, corrections: readonly FactCorrection[], index: ImmutableScopeIndex) {
  const input = parseSemanticInput(original), history = plainJson(corrections)
  if (input.sourceId !== index.sourceId || input.sourceVersionId !== index.sourceVersionId
    || input.sourceFingerprint !== index.sourceFingerprint) reject('SOURCE_IDENTITY')
  const seen = new Set<string>(), changedTasks = new Set<string>(), manualMaterials = new Set<string>()
  let lastAt = -Infinity
  for (const row of history) {
    keys(row, ['id', 'at', 'change', 'before'])
    if (!/^[A-Za-z0-9-]{1,100}$/.test(row.id) || seen.has(row.id)) reject('ID')
    seen.add(row.id)
    if (!Number.isFinite(Date.parse(row.at)) || Date.parse(row.at) < lastAt) reject('TIME')
    lastAt = Date.parse(row.at)
    const prior = correctionBefore(input, row.change)
    if (!same(prior, row.before) || same(prior, row.change.value)) reject('CHAIN_OR_NO_CHANGE')
    affected(input, row.change).forEach(id => changedTasks.add(id))
    apply(input, row.change, index)
    affected(input, row.change).forEach(id => changedTasks.add(id))
    if (row.change.kind === 'material') manualMaterials.add(row.change.materialId)
  }
  const facts = parseSemanticInput(input), sourceFacts = plainJson(facts)
  for (const id of manualMaterials) {
    const first = original.materials.find(m => m.tempId === id)!, current = sourceFacts.materials.find(m => m.tempId === id)!
    // Do not validate manual literal values as though the model/source supplied them.
    Object.assign(current, materialEdit(first), { relatedTaskTempIds: [...current.relatedTaskTempIds] })
  }
  return { facts, sourceFacts, changedTasks: [...changedTasks].sort(), manualMaterials: [...manualMaterials].sort() }
}

export function appendCorrection(original: SemanticInput, history: readonly FactCorrection[], row: FactCorrection,
  index: ImmutableScopeIndex, confirmedTaskIds: readonly string[]) {
  const before = effectiveFacts(original, history, index), next = [...plainJson(history), plainJson(row)]
  const after = effectiveFacts(original, next, index)
  const touched = new Set([...affected(before.facts, row.change), ...affected(after.facts, row.change)])
  if (confirmedTaskIds.some(id => touched.has(id))) reject('CONFIRMED_OR_SHARED_ENTITY')
  return { corrections: next, ...after, affectedTaskIds: [...touched].sort() }
}
