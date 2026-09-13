import { plainJson, stableJson, type SemanticInput } from '../mainline04/semanticContract'
import { adaptModelWire, FLASH41_MODEL_NAME, MAX_OUTPUT_TOKENS, MODEL_JSON_SCHEMA, wireError, type ModelWire, type WireContext } from './modelWire'

export const EVIDENCE_ROLE_WIRE_VERSION = 'real-input-evidence-role-wire-1' as const
export const EVIDENCE_ROLES = ['directive_action', 'material_requirement', 'time_requirement', 'condition_or_dependency',
  'cancellation_or_revision', 'information_only'] as const
export type EvidenceRoleName = typeof EVIDENCE_ROLES[number]

type JsonSchema = { type?: string; const?: unknown; enum?: readonly unknown[]; properties?: Record<string, JsonSchema>;
  required?: string[]; additionalProperties?: boolean; items?: JsonSchema; minLength?: number; maxLength?: number;
  minimum?: number; maximum?: number; minItems?: number; maxItems?: number; uniqueItems?: boolean; anyOf?: JsonSchema[] }
type EvidenceRole = { id: string; role: EvidenceRoleName; scopeIds: string[] }
type EvidenceTask = Omit<ModelWire['tasks'][number], 'propositionScopeIds' | 'detail' | 'condition' | 'eventTempIds'> & {
  evidenceRoleIds: string[]
  detail: Omit<ModelWire['tasks'][number]['detail'], 'materialTempIds' | 'timePointTempIds'>
  condition: { value: ModelWire['tasks'][number]['condition']['value']; conditionRoleIds: string[]; factRoleIds: string[] }
}
type EvidenceMaterial = Omit<ModelWire['materials'][number], 'scopeIds'> & { evidenceRoleIds: string[] }
type EvidenceTime = Omit<ModelWire['timePoints'][number], 'scopeIds'> & { evidenceRoleIds: string[] }
type EvidenceEvent = Omit<ModelWire['events'][number], 'scopeIds'> & { evidenceRoleIds: string[] }
type EvidenceRevision = Omit<ModelWire['revisions'][number], 'scopeIds'> & { evidenceRoleIds: string[] }
type EvidenceConflict = Omit<ModelWire['conflicts'][number], 'scopeIds'> & { evidenceRoleIds: string[] }
export type EvidenceRoleWire = {
  schemaVersion: typeof EVIDENCE_ROLE_WIRE_VERSION
  evidenceRoles: EvidenceRole[]
  tasks: EvidenceTask[]
  materials: EvidenceMaterial[]
  timePoints: EvidenceTime[]
  events: EvidenceEvent[]
  revisions: EvidenceRevision[]
  conflicts: EvidenceConflict[]
  informationRoleIds: string[]
  unresolvedRoleIds: string[]
}

const schema = structuredClone(MODEL_JSON_SCHEMA) as unknown as JsonSchema
const object = (properties: Record<string, JsonSchema>): JsonSchema => ({ type: 'object', properties,
  required: Object.keys(properties), additionalProperties: false })
const text: JsonSchema = { type: 'string', minLength: 1, maxLength: 4000 }
const refs: JsonSchema = { type: 'array', items: text, maxItems: 200, uniqueItems: true }
const rename = (properties: Record<string, JsonSchema>, oldKey: string, nextKey: string, nextSchema: JsonSchema = refs) => {
  delete properties[oldKey]; properties[nextKey] = nextSchema
}
const required = (item: JsonSchema) => { item.required = Object.keys(item.properties ?? {}) }
const top = schema.properties!
top.schemaVersion = { type: 'string', const: EVIDENCE_ROLE_WIRE_VERSION }
top.evidenceRoles = { type: 'array', maxItems: 200, items: object({ id: text,
  role: { type: 'string', enum: EVIDENCE_ROLES }, scopeIds: refs }) }
const task = top.tasks.items!, taskProperties = task.properties!
rename(taskProperties, 'propositionScopeIds', 'evidenceRoleIds')
const detail = taskProperties.detail, detailProperties = detail.properties!
delete detailProperties.materialTempIds; delete detailProperties.timePointTempIds; required(detail)
const condition = taskProperties.condition, conditionProperties = condition.properties!
rename(conditionProperties, 'conditionScopeIds', 'conditionRoleIds')
rename(conditionProperties, 'factScopeIds', 'factRoleIds'); required(condition)
delete taskProperties.eventTempIds; required(task)
for (const key of ['materials', 'timePoints', 'events', 'revisions', 'conflicts']) {
  const item = top[key].items!, properties = item.properties!
  rename(properties, 'scopeIds', 'evidenceRoleIds'); required(item)
}
delete top.informationScopeIds; delete top.unresolvedScopeIds
top.informationRoleIds = refs; top.unresolvedRoleIds = refs
schema.required = Object.keys(top)
export const EVIDENCE_ROLE_JSON_SCHEMA = schema

const record = (value: unknown, code: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) wireError(code)
  return value as Record<string, unknown>
}
const array = (value: unknown, code: string): unknown[] => {
  if (!Array.isArray(value) || value.length > 200) wireError(code)
  return value as unknown[]
}
const uniqueText = (value: unknown, code: string): string[] => {
  const values = array(value, code)
  if (values.some(item => typeof item !== 'string' || !item) || new Set(values).size !== values.length) wireError(code)
  return values as string[]
}
const localId = (value: unknown, code: string): string => {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(value)) wireError(code)
  return value as string
}

/** Candidate08's only local transformation: validate model facts, map evidence roles to scopes, and derive reverse links. */
export function assembleEvidenceRoleWire(input: unknown, context: WireContext) {
  const raw = plainJson(input) as unknown as EvidenceRoleWire
  const root = record(raw, 'EVIDENCE_OBJECT')
  const expected = Object.keys(EVIDENCE_ROLE_JSON_SCHEMA.properties!).sort()
  if (stableJson(Object.keys(root).sort()) !== stableJson(expected) || raw.schemaVersion !== EVIDENCE_ROLE_WIRE_VERSION) wireError('EVIDENCE_FIELDS')
  for (const key of ['evidenceRoles', 'tasks', 'materials', 'timePoints', 'events', 'revisions', 'conflicts'] as const) array(raw[key], 'EVIDENCE_ARRAY')
  uniqueText(raw.informationRoleIds, 'EVIDENCE_INFORMATION_REFS'); uniqueText(raw.unresolvedRoleIds, 'EVIDENCE_UNRESOLVED_REFS')

  const knownScopes = new Set(context.index.scopes.map(item => item.id)), roles = new Map<string, EvidenceRole>(), coveredScopes = new Set<string>()
  for (const value of raw.evidenceRoles) {
    const row = record(value, 'EVIDENCE_ROLE_OBJECT'), keys = ['id', 'role', 'scopeIds']
    if (stableJson(Object.keys(row).sort()) !== stableJson(keys.sort())) wireError('EVIDENCE_ROLE_FIELDS')
    const id = localId(row.id, 'EVIDENCE_ROLE_ID'), scopeIds = uniqueText(row.scopeIds, 'EVIDENCE_SCOPE_REFS')
    if (!EVIDENCE_ROLES.includes(row.role as EvidenceRoleName) || roles.has(id) || !scopeIds.length
      || scopeIds.some(scopeId => !knownScopes.has(scopeId))) wireError('EVIDENCE_ROLE_INVALID')
    for (const scopeId of scopeIds) coveredScopes.add(scopeId)
    roles.set(id, { id, role: row.role as EvidenceRoleName, scopeIds })
  }
  if (stableJson([...coveredScopes].sort()) !== stableJson([...knownScopes].sort())) wireError('EVIDENCE_SCOPE_COVERAGE')

  const consumed = new Set<string>()
  const scopesFor = (value: unknown, allowed: readonly EvidenceRoleName[], code: string) => {
    const ids = uniqueText(value, code), scopes: string[] = []
    for (const id of ids) {
      const role = roles.get(id)
      if (!role) throw Error('REAL_INPUT_' + code)
      if (!allowed.includes(role.role)) wireError(code)
      consumed.add(id)
      for (const scopeId of role.scopeIds) if (!scopes.includes(scopeId)) scopes.push(scopeId)
    }
    return scopes
  }
  const taskIds = new Set(raw.tasks.map(item => localId(record(item, 'EVIDENCE_TASK').id, 'EVIDENCE_TASK_ID')))
  if (taskIds.size !== raw.tasks.length) wireError('EVIDENCE_TASK_ID')
  const materialIds = new Set(raw.materials.map(item => localId(record(item, 'EVIDENCE_MATERIAL').tempId, 'EVIDENCE_MATERIAL_ID')))
  const timeIds = new Set(raw.timePoints.map(item => localId(record(item, 'EVIDENCE_TIME').tempId, 'EVIDENCE_TIME_ID')))
  const eventIds = new Set(raw.events.map(item => localId(record(item, 'EVIDENCE_EVENT').tempId, 'EVIDENCE_EVENT_ID')))
  const allEntityIds = [...taskIds, ...materialIds, ...timeIds, ...eventIds]
  if (new Set(allEntityIds).size !== allEntityIds.length) wireError('EVIDENCE_ENTITY_ID')

  const taskMaterials = new Map([...taskIds].map(id => [id, [] as string[]]))
  const taskTimes = new Map([...taskIds].map(id => [id, [] as string[]]))
  const taskEvents = new Map([...taskIds].map(id => [id, [] as string[]]))
  const validOwners = (ids: unknown, code: string) => {
    const result = uniqueText(ids, code)
    if (result.some(id => !taskIds.has(id))) wireError(code)
    return result
  }
  const materials = raw.materials.map(item => {
    const { evidenceRoleIds, ...rest } = item
    const owners = validOwners(rest.relatedTaskTempIds, 'EVIDENCE_MATERIAL_OWNER')
    for (const owner of owners) taskMaterials.get(owner)!.push(rest.tempId)
    return { ...rest, relatedTaskTempIds: owners,
      scopeIds: scopesFor(evidenceRoleIds, ['material_requirement'], 'EVIDENCE_MATERIAL_ROLE') }
  })
  const timePoints = raw.timePoints.map(item => {
    const { evidenceRoleIds, ...rest } = item
    const owners = validOwners(rest.relatedTaskTempIds, 'EVIDENCE_TIME_OWNER')
    if (rest.relatedMaterialTempIds.some(id => !materialIds.has(id))) wireError('EVIDENCE_TIME_MATERIAL')
    for (const owner of owners) taskTimes.get(owner)!.push(rest.tempId)
    return { ...rest, relatedTaskTempIds: owners,
      scopeIds: scopesFor(evidenceRoleIds, ['time_requirement'], 'EVIDENCE_TIME_ROLE') }
  })
  const events = raw.events.map(item => {
    const { evidenceRoleIds, ...rest } = item
    const owners = validOwners(rest.relatedTaskTempIds, 'EVIDENCE_EVENT_OWNER')
    if ((rest.startTimePointTempId !== null && !timeIds.has(rest.startTimePointTempId))
      || (rest.endTimePointTempId !== null && !timeIds.has(rest.endTimePointTempId))) wireError('EVIDENCE_EVENT_TIME')
    for (const owner of owners) taskEvents.get(owner)!.push(rest.tempId)
    return { ...rest, relatedTaskTempIds: owners,
      scopeIds: scopesFor(evidenceRoleIds, ['information_only', 'time_requirement'], 'EVIDENCE_EVENT_ROLE') }
  })
  const tasks = raw.tasks.map(item => {
    const { evidenceRoleIds, detail: rawDetail, condition: rawCondition, ...rest } = item
    const taskScopes = scopesFor(evidenceRoleIds, ['directive_action'], 'EVIDENCE_TASK_ROLE')
    if (!taskScopes.includes(rest.action.scopeId) || !taskScopes.includes(rest.object.scopeId)) wireError('EVIDENCE_TASK_SURFACE')
    const conditionScopeIds = scopesFor(rawCondition.conditionRoleIds, ['condition_or_dependency'], 'EVIDENCE_CONDITION_ROLE')
    const factScopeIds = scopesFor(rawCondition.factRoleIds, ['condition_or_dependency'], 'EVIDENCE_CONDITION_FACT_ROLE')
    const dependencyTempIds = validOwners(rawDetail.dependencyTempIds, 'EVIDENCE_DEPENDENCY')
    const materialTempIds = taskMaterials.get(rest.id)!, timePointTempIds = taskTimes.get(rest.id)!, eventTempIds = taskEvents.get(rest.id)!
    const actual = { time: timePointTempIds.length, material: materialTempIds.length, event: eventTempIds.length }
    for (const key of ['time', 'material', 'event'] as const) if ((rest.coverage[key] === 'present') !== (actual[key] > 0)) wireError('EVIDENCE_COVERAGE_' + key.toUpperCase())
    return { ...rest, propositionScopeIds: taskScopes, detail: { ...rawDetail, dependencyTempIds, materialTempIds, timePointTempIds },
      condition: { value: rawCondition.value, conditionScopeIds, factScopeIds }, eventTempIds }
  })
  const revisions = raw.revisions.map(item => {
    const { evidenceRoleIds, ...rest } = item
    if (!taskIds.has(rest.targetDirectiveId) || (rest.fromDirectiveId !== null && !taskIds.has(rest.fromDirectiveId))) wireError('EVIDENCE_REVISION_TARGET')
    return { ...rest, scopeIds: scopesFor(evidenceRoleIds, ['cancellation_or_revision'], 'EVIDENCE_REVISION_ROLE') }
  })
  const conflicts = raw.conflicts.map(item => {
    const { evidenceRoleIds, ...rest } = item
    if (rest.entityTempIds.some(id => !new Set(allEntityIds).has(id))) wireError('EVIDENCE_CONFLICT_TARGET')
    return { ...rest, scopeIds: scopesFor(evidenceRoleIds, EVIDENCE_ROLES, 'EVIDENCE_CONFLICT_ROLE') }
  })
  const informationScopeIds = scopesFor(raw.informationRoleIds, ['information_only'], 'EVIDENCE_INFORMATION_ROLE')
  const unresolvedScopeIds = scopesFor(raw.unresolvedRoleIds, EVIDENCE_ROLES, 'EVIDENCE_UNRESOLVED_ROLE')
  if (consumed.size !== roles.size) wireError('EVIDENCE_ROLE_ORPHAN')
  const assembledWire: ModelWire = { schemaVersion: 'real-input-model-wire-1', tasks, materials, timePoints, events, revisions,
    conflicts, informationScopeIds, unresolvedScopeIds }
  const adapted = adaptModelWire(assembledWire, context)
  return { rawEvidence: raw, assembledWire: adapted.wire, adaptedResponse: adapted.adapted }
}

/** Preserve provider bytes and raw candidate08 output; assembly is a separate auditable derivative. */
export function parseEvidenceRoleEnvelope(rawHttpText: string, context: WireContext, expectedModel = FLASH41_MODEL_NAME) {
  if (typeof rawHttpText !== 'string' || new TextEncoder().encode(rawHttpText).length > 524288) wireError('RESPONSE_BYTES_LIMIT')
  const envelope = record(plainJson(JSON.parse(rawHttpText)), 'RESPONSE_ENVELOPE')
  if (expectedModel !== FLASH41_MODEL_NAME || typeof envelope.model !== 'string' || envelope.model.toLowerCase() !== expectedModel) wireError('MODEL_IDENTITY')
  if (envelope.status !== 'completed' || envelope.error) wireError('RESPONSE_INCOMPLETE')
  const outputs = Array.isArray(envelope.output) ? envelope.output : wireError('RESPONSE_INCOMPLETE')
  if (outputs.length !== 1) wireError('RESPONSE_INCOMPLETE')
  const message = record(outputs[0], 'RESPONSE_OUTPUT')
  if (message.type !== 'message' || message.role !== 'assistant') wireError('RESPONSE_OUTPUT_KIND')
  const contents = Array.isArray(message.content) ? message.content : wireError('RESPONSE_OUTPUT_KIND')
  if (contents.length !== 1) wireError('RESPONSE_OUTPUT_KIND')
  const output = record(contents[0], 'RESPONSE_CONTENT')
  if (output.type !== 'output_text' || typeof output.text !== 'string' || !output.text.trim()) wireError('RESPONSE_TEXT_MISSING')
  const usage = record(envelope.usage, 'RESPONSE_USAGE')
  if (![usage.input_tokens, usage.output_tokens].every(value => Number.isSafeInteger(value) && Number(value) >= 0)
    || Number(usage.output_tokens) > MAX_OUTPUT_TOKENS) wireError('USAGE_INVALID')
  const rawOutputText = output.text as string, rawResponse = JSON.parse(rawOutputText)
  const assembled = assembleEvidenceRoleWire(rawResponse, context)
  return { rawHttpText, envelope, rawOutputText, rawResponse: assembled.rawEvidence,
    assembledWire: assembled.assembledWire, adaptedResponse: assembled.adaptedResponse }
}

export type EvidenceRoleSemantic = SemanticInput
