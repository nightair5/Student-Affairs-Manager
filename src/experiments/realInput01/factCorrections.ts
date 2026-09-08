import { parseSemanticInput, plainJson, stableJson, type SemanticInput, type SemanticMaterial, type SemanticTask, type SemanticEvent, type SemanticRevision } from '../mainline04/semanticContract'
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
  | { kind: 'condition'; taskId: string; value: SemanticTask['condition']; scopeIds: string[]; note: string }
  | { kind: 'event'; taskId: string; value: { coverage: SemanticTask['coverage']['event']; event: SemanticEvent | null }; scopeIds: string[]; note: string }
  | { kind: 'revision'; index: number; value: { relation: SemanticRevision; addedTask: SemanticTask | null }; scopeIds: string[]; note: string }
  | { kind: 'add_task'; value: SemanticTask; scopeIds: string[]; note: string }
export interface FactCorrection { id: string; at: string; change: FactChange; before: unknown }
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
  const ids = change.kind === 'material' ? input.tasks.filter(t => factAssets(input, t.id).materials.has(change.materialId)).map(t => t.id)
    : change.kind === 'event' ? [change.taskId,...(change.value.event?.relatedTaskTempIds??[]),
      ...input.tasks.filter(t=>change.value.event&&factAssets(input,t.id).events.has(change.value.event.tempId)).map(t=>t.id)]
    : change.kind === 'revision' ? [change.value.relation.targetDirectiveId, change.value.relation.fromDirectiveId,
      input.revisions[change.index]?.targetDirectiveId, input.revisions[change.index]?.fromDirectiveId].filter((id): id is string => Boolean(id))
    : change.kind === 'add_task' ? [change.value.id] : [change.taskId]
  return new Set([...safetyTasks(input, new Set(ids))].filter(id => input.tasks.some(t => t.id === id)))
}
function reviewEvidence(change: FactChange, index: ImmutableScopeIndex) {
  if (!('note' in change)) return
  if (!change.note.trim() || change.note.length > 1000 || !change.scopeIds.length
    || new Set(change.scopeIds).size !== change.scopeIds.length || change.scopeIds.some(id => !index.scopes.some(s => s.id === id))) reject('REVIEW_EVIDENCE_REQUIRED')
}
function addTask(input: SemanticInput, task: SemanticTask, index: ImmutableScopeIndex) {
  if (!/^user-[a-zA-Z0-9-]{1,90}$/.test(task.id) || [...input.tasks.map(t=>t.id),...input.materials.map(m=>m.tempId),...input.events.map(e=>e.tempId),...input.timePoints.map(t=>t.tempId)].includes(task.id)) reject('NEW_TASK_ID')
  for (const ref of [task.action,task.object]) {
    const scope=index.scopes.find(s=>s.id===ref.scopeId)
    if (!scope || !task.propositionScopeIds.includes(scope.id) || !ref.surface.trim() || !scope.text.includes(ref.surface)) reject('NEW_TASK_SOURCE')
  }
  input.tasks.push(plainJson(task))
}
function apply(input: SemanticInput, change: FactChange, index: ImmutableScopeIndex) {
  reviewEvidence(change,index)
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
  } else if (change.kind === 'condition') {
    keys(change,['kind','taskId','value','scopeIds','note'])
    const task=input.tasks.find(t=>t.id===change.taskId); if(!task)return reject('TASK_MISSING')
    const c=change.value
    if (c.value==='not_applicable' ? c.conditionScopeIds.length||c.factScopeIds.length : !c.conditionScopeIds.length
      || (['true','false'].includes(c.value)&&!c.factScopeIds.length)) reject('CONDITION_EVIDENCE')
    if ([...c.conditionScopeIds,...c.factScopeIds].some(id=>!change.scopeIds.includes(id))) reject('CONDITION_EVIDENCE')
    task.condition=plainJson(c)
  } else if (change.kind === 'event') {
    keys(change,['kind','taskId','value','scopeIds','note']);keys(change.value,['coverage','event'])
    const task=input.tasks.find(t=>t.id===change.taskId);if(!task)return reject('TASK_MISSING')
    const e=change.value.event
    if (e) {
      if(change.value.coverage!=='present'||!e.relatedTaskTempIds.includes(task.id)||!e.scopeIds.length
        ||e.scopeIds.some(id=>!change.scopeIds.includes(id))||!e.title.trim()
        ||!e.scopeIds.some(id=>index.scopes.find(s=>s.id===id)?.text.includes(e.title)))reject('EVENT_EVIDENCE')
      const existing=input.events.find(x=>x.tempId===e.tempId)
      // Attach only; changing a shared event is a different, explicitly reviewed operation.
      if(existing&&!same(existing,e))reject('EXISTING_EVENT_IMMUTABLE')
      if(!existing){if(!/^user-[a-zA-Z0-9-]{1,90}$/.test(e.tempId))reject('NEW_EVENT_ID');input.events.push(plainJson(e))}
      if(!task.eventTempIds.includes(e.tempId))task.eventTempIds.push(e.tempId)
    } else if(factAssets(input,task.id).events.size)reject('EVENT_RELATION_REMOVAL')
    task.coverage.event=change.value.coverage
  } else if (change.kind === 'revision') {
    keys(change,['kind','index','value','scopeIds','note']);keys(change.value,['relation','addedTask'])
    if(!Number.isInteger(change.index)||change.index<0||change.index>input.revisions.length)reject('REVISION_INDEX')
    if(change.value.addedTask){if(change.value.addedTask.propositionScopeIds.some(id=>!change.scopeIds.includes(id)))reject('NEW_TASK_SOURCE');addTask(input,change.value.addedTask,index)}
    const r=change.value.relation
    if(!r.scopeIds.length||r.scopeIds.some(id=>!change.scopeIds.includes(id))||!input.tasks.some(t=>t.id===r.targetDirectiveId)
      ||(r.type==='cancels'?r.fromDirectiveId!==null:!input.tasks.some(t=>t.id===r.fromDirectiveId))||r.targetDirectiveId===r.fromDirectiveId)reject('REVISION_REFERENCE')
    input.revisions[change.index]=plainJson(r)
  } else if(change.kind==='add_task') {
    keys(change,['kind','value','scopeIds','note']);if(change.value.propositionScopeIds.some(id=>!change.scopeIds.includes(id)))reject('NEW_TASK_SOURCE');addTask(input,change.value,index)
  } else reject('KIND')
  parseSemanticInput(input)
}
export function correctionBefore(input: SemanticInput, change: FactChange) {
  if(change.kind==='add_task')return null
  if(change.kind==='revision')return {relation:plainJson(input.revisions[change.index]??null),addedTask:null}
  if(change.kind==='condition'||change.kind==='event'){
    const task=input.tasks.find(t=>t.id===change.taskId);if(!task)return reject('TASK_MISSING')
    return change.kind==='condition'?plainJson(task.condition):{coverage:task.coverage.event,event:null}
  }
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
