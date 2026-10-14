import { plainJson, stableJson, SEMANTIC_JSON_SCHEMA } from '../mainline04/semanticContract'
import { adaptModelWire, FLASH41_MODEL_NAME, MAX_OUTPUT_TOKENS, wireError, type ModelWire, type WireContext } from './modelWire'

export const EVIDENCE_ROLE_V2_VERSION = 'real-input-typed-fact-wire-2' as const
type Schema = { type?: string; const?: unknown; properties?: Record<string, Schema>; required?: string[]; items?: Schema }
type Typed<T, K extends string> = T & { factType: K }
type Task = Omit<ModelWire['tasks'][number], 'detail' | 'eventTempIds'> & {
  detail: Omit<ModelWire['tasks'][number]['detail'], 'materialTempIds' | 'timePointTempIds'>
}
export type EvidenceRoleWireV2 = Omit<ModelWire, 'schemaVersion' | 'tasks' | 'materials' | 'timePoints' | 'events' | 'revisions' | 'conflicts'> & {
  schemaVersion: typeof EVIDENCE_ROLE_V2_VERSION
  tasks: Typed<Task, 'task'>[]
  materials: Typed<ModelWire['materials'][number], 'material'>[]
  timePoints: Typed<ModelWire['timePoints'][number], 'time'>[]
  events: Typed<ModelWire['events'][number], 'event'>[]
  revisions: Typed<ModelWire['revisions'][number], 'revision'>[]
  conflicts: Typed<ModelWire['conflicts'][number], 'conflict'>[]
}
const kinds = { tasks: 'task', materials: 'material', timePoints: 'time', events: 'event', revisions: 'revision', conflicts: 'conflict' } as const
const schema = structuredClone(SEMANTIC_JSON_SCHEMA) as unknown as Schema
const top = schema.properties!
for (const key of ['sourceId', 'sourceVersionId', 'sourceFingerprint']) delete top[key]
for (const key of ['normalizedValue', 'timezone', 'isAllDay', 'precision', 'needsConfirmation']) delete top.timePoints.items!.properties![key]
top.timePoints.items!.required = Object.keys(top.timePoints.items!.properties!)
schema.required = Object.keys(top)
top.schemaVersion = { type: 'string', const: EVIDENCE_ROLE_V2_VERSION }
for (const [key, kind] of Object.entries(kinds)) {
  const item = top[key].items!
  item.properties!.factType = { type: 'string', const: kind }
  item.required = Object.keys(item.properties!)
}
const taskProperties = top.tasks.items!.properties!, detail = taskProperties.detail
delete taskProperties.eventTempIds
delete detail.properties!.materialTempIds
delete detail.properties!.timePointTempIds
detail.required = Object.keys(detail.properties!)
top.tasks.items!.required = Object.keys(taskProperties)
export const EVIDENCE_ROLE_V2_JSON_SCHEMA = schema

const record = (value: unknown, code: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) wireError(code)
  return value as Record<string, unknown>
}
const list = (value: unknown, code: string): unknown[] => {
  if (!Array.isArray(value) || value.length > 200) wireError(code)
  return value as unknown[]
}
const refs = (value: unknown, code: string): string[] => {
  const items = list(value, code)
  if (items.some(id => typeof id !== 'string' || !id) || new Set(items).size !== items.length) wireError(code)
  return items as string[]
}
const exact = (value: unknown, expected: string[], code: string) => {
  if (stableJson(Object.keys(record(value, code)).sort()) !== stableJson([...expected].sort())) wireError(code)
}

/** Only copies validated facts and derives inverse links. No semantic inference or repair. */
export function assembleEvidenceRoleWireV2(input: unknown, context: WireContext) {
  const raw = plainJson(input) as unknown as EvidenceRoleWireV2
  exact(raw, Object.keys(top), 'TYPED_FIELDS')
  if (raw.schemaVersion !== EVIDENCE_ROLE_V2_VERSION) wireError('TYPED_VERSION')
  for (const [key, kind] of Object.entries(kinds) as [keyof typeof kinds, string][]) {
    for (const value of list(raw[key], 'TYPED_ARRAY')) {
      exact(value, Object.keys(top[key].items!.properties!), 'TYPED_ENTITY_FIELDS')
      if (record(value, 'TYPED_ENTITY').factType !== kind) wireError('TYPED_ENTITY_KIND')
    }
  }
  const ids = (values: unknown[], key: string) => {
    const valuesIds = values.map(value => record(value, 'TYPED_ENTITY')[key])
    if (valuesIds.some(id => typeof id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(id))) wireError('TYPED_ID')
    if (new Set(valuesIds).size !== values.length) wireError('TYPED_DUPLICATE_ID')
    return new Set(valuesIds as string[])
  }
  const taskIds = ids(raw.tasks, 'id'), materialIds = ids(raw.materials, 'tempId'), timeIds = ids(raw.timePoints, 'tempId'), eventIds = ids(raw.events, 'tempId')
  const entityIds = new Set([...taskIds, ...materialIds, ...timeIds, ...eventIds])
  if (entityIds.size !== taskIds.size + materialIds.size + timeIds.size + eventIds.size) wireError('TYPED_DUPLICATE_ID')
  const knownScopes = new Set(context.index.scopes.map(item => item.id)), covered = new Set<string>()
  const scopes = (value: unknown, nonempty = false) => {
    const result = refs(value, 'TYPED_SCOPE')
    if ((nonempty && !result.length) || result.some(id => !knownScopes.has(id))) wireError('TYPED_SCOPE')
    result.forEach(id => covered.add(id))
    return result
  }
  const targets = (value: unknown, known: Set<string>, code: string) => {
    const result = refs(value, code)
    if (result.some(id => !known.has(id))) wireError(code)
    return result
  }
  const inverse = () => new Map([...taskIds].map(id => [id, [] as string[]]))
  const taskMaterials = inverse(), taskTimes = inverse(), taskEvents = inverse()
  const strip = <T extends { factType: string }>(item: T): Omit<T, 'factType'> => {
    const copy = { ...item }; delete (copy as Partial<T>).factType; return copy
  }
  const materials = raw.materials.map(item => {
    scopes(item.scopeIds, true)
    for (const owner of targets(item.relatedTaskTempIds, taskIds, 'TYPED_MATERIAL_OWNER')) taskMaterials.get(owner)!.push(item.tempId)
    return strip(item)
  })
  const timePoints = raw.timePoints.map(item => {
    scopes(item.scopeIds, true)
    targets(item.relatedMaterialTempIds, materialIds, 'TYPED_TIME_MATERIAL')
    for (const owner of targets(item.relatedTaskTempIds, taskIds, 'TYPED_TIME_OWNER')) taskTimes.get(owner)!.push(item.tempId)
    return strip(item)
  })
  const events = raw.events.map(item => {
    scopes(item.scopeIds, true)
    for (const id of [item.startTimePointTempId, item.endTimePointTempId]) if (id !== null && !timeIds.has(id)) wireError('TYPED_EVENT_TIME')
    for (const owner of targets(item.relatedTaskTempIds, taskIds, 'TYPED_EVENT_OWNER')) taskEvents.get(owner)!.push(item.tempId)
    return strip(item)
  })
  const tasks = raw.tasks.map(item => {
    exact(item.detail, Object.keys(detail.properties!), 'TYPED_DETAIL_FIELDS')
    const proposition = scopes(item.propositionScopeIds, true)
    if (!proposition.includes(item.action.scopeId) || !proposition.includes(item.object.scopeId)) wireError('TYPED_TASK_SURFACE')
    scopes(item.condition.conditionScopeIds); scopes(item.condition.factScopeIds)
    targets(item.detail.dependencyTempIds, taskIds, 'TYPED_DEPENDENCY')
    if (item.detail.dependencyTempIds.includes(item.id)) wireError('TYPED_DEPENDENCY')
    if (item.detail.parentTempId !== null && (!taskIds.has(item.detail.parentTempId) || item.detail.parentTempId === item.id)) wireError('TYPED_PARENT')
    const materialTempIds = taskMaterials.get(item.id)!, timePointTempIds = taskTimes.get(item.id)!, eventTempIds = taskEvents.get(item.id)!
    for (const [key, values] of [['material', materialTempIds], ['time', timePointTempIds], ['event', eventTempIds]] as const) {
      if ((item.coverage[key] === 'present') !== (values.length > 0)) wireError('TYPED_COVERAGE_' + key.toUpperCase())
    }
    return { ...strip(item), detail: { ...item.detail, materialTempIds, timePointTempIds }, eventTempIds }
  })
  // A reference existing is necessary but not sufficient: cyclic parent/dependency chains are invalid too.
  const byId = new Map(tasks.map(item => [item.id, item]))
  for (const relation of ['parent', 'dependency'] as const) {
    const visiting = new Set<string>(), visited = new Set<string>()
    const visit = (id: string) => {
      if (visiting.has(id)) wireError('TYPED_RELATION_CYCLE')
      if (visited.has(id)) return
      visiting.add(id)
      const item = byId.get(id)!, links = relation === 'parent' ? (item.detail.parentTempId ? [item.detail.parentTempId] : []) : item.detail.dependencyTempIds
      links.forEach(visit); visiting.delete(id); visited.add(id)
    }
    tasks.forEach(item => visit(item.id))
  }
  const revisions = raw.revisions.map(item => {
    scopes(item.scopeIds, true)
    if (!taskIds.has(item.targetDirectiveId) || (item.fromDirectiveId !== null && !taskIds.has(item.fromDirectiveId))) wireError('TYPED_REVISION_TARGET')
    return strip(item)
  })
  const conflicts = raw.conflicts.map(item => {
    scopes(item.scopeIds, true); targets(item.entityTempIds, entityIds, 'TYPED_CONFLICT_TARGET'); return strip(item)
  })
  const informationScopeIds = scopes(raw.informationScopeIds), unresolvedScopeIds = scopes(raw.unresolvedScopeIds)
  if (covered.size !== knownScopes.size) wireError('TYPED_SCOPE_COVERAGE')
  const assembled: ModelWire = { schemaVersion: 'real-input-model-wire-1', tasks, materials, timePoints, events, revisions, conflicts, informationScopeIds, unresolvedScopeIds }
  const checked = adaptModelWire(assembled, context)
  return { rawEvidence: raw, assembledWire: checked.wire, adaptedResponse: checked.adapted }
}

/** Original provider envelope, original typed facts, and derived wire remain separate. */
export function parseEvidenceRoleEnvelopeV2(rawHttpText: string, context: WireContext, expectedModel = FLASH41_MODEL_NAME) {
  if (typeof rawHttpText !== 'string' || new TextEncoder().encode(rawHttpText).length > 524288) wireError('RESPONSE_BYTES_LIMIT')
  const envelope = record(plainJson(JSON.parse(rawHttpText)), 'RESPONSE_ENVELOPE')
  if (expectedModel !== FLASH41_MODEL_NAME || typeof envelope.model !== 'string' || envelope.model.toLowerCase() !== expectedModel) wireError('MODEL_IDENTITY')
  if (envelope.status !== 'completed' || envelope.error) wireError('RESPONSE_INCOMPLETE')
  const outputs = list(envelope.output, 'RESPONSE_INCOMPLETE')
  if (outputs.length !== 1) wireError('RESPONSE_INCOMPLETE')
  const message = record(outputs[0], 'RESPONSE_OUTPUT')
  if (message.type !== 'message' || message.role !== 'assistant') wireError('RESPONSE_OUTPUT_KIND')
  const contents = list(message.content, 'RESPONSE_OUTPUT_KIND')
  if (contents.length !== 1) wireError('RESPONSE_OUTPUT_KIND')
  const output = record(contents[0], 'RESPONSE_CONTENT')
  if (output.type !== 'output_text' || typeof output.text !== 'string' || !output.text.trim()) wireError('RESPONSE_TEXT_MISSING')
  const usage = record(envelope.usage, 'RESPONSE_USAGE')
  if (![usage.input_tokens, usage.output_tokens].every(value => Number.isSafeInteger(value) && Number(value) >= 0) || Number(usage.output_tokens) > MAX_OUTPUT_TOKENS) wireError('USAGE_INVALID')
  const rawOutputText = output.text as string, assembled = assembleEvidenceRoleWireV2(JSON.parse(rawOutputText), context)
  return { rawHttpText, envelope, rawOutputText, rawResponse: assembled.rawEvidence, assembledWire: assembled.assembledWire, adaptedResponse: assembled.adaptedResponse }
}
