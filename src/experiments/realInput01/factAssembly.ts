import { SEMANTIC_JSON_SCHEMA, plainJson } from '../mainline04/semanticContract'
import type { ModelWire } from './modelWire'

export const FACT_WIRE_VERSION = 'real-input-fact-wire-2' as const
type Coverage = ModelWire['tasks'][number]['coverage']
type FactTask = Omit<ModelWire['tasks'][number], 'detail' | 'eventTempIds' | 'coverage'> & {
  detail: Omit<ModelWire['tasks'][number]['detail'], 'materialTempIds' | 'timePointTempIds'>
  coverage: { [K in keyof Coverage]: Exclude<Coverage[K], 'present'> | null }
}
export type FactWire = Omit<ModelWire, 'schemaVersion' | 'tasks'> & {
  schemaVersion: typeof FACT_WIRE_VERSION; tasks: FactTask[]
}
const error = (code: string): never => { throw Error('REAL_INPUT_FACT_' + code) }
const localTime = ['normalizedValue', 'timezone', 'isAllDay', 'precision', 'needsConfirmation']
// A projection of the existing vocabulary. No second semantic taxonomy.
export const FACT_JSON_SCHEMA = structuredClone(SEMANTIC_JSON_SCHEMA)
for (const key of ['sourceId', 'sourceVersionId', 'sourceFingerprint']) delete FACT_JSON_SCHEMA.properties![key]
FACT_JSON_SCHEMA.properties!.schemaVersion = { type: 'string', const: FACT_WIRE_VERSION }
FACT_JSON_SCHEMA.required = Object.keys(FACT_JSON_SCHEMA.properties!)
const taskSchema = FACT_JSON_SCHEMA.properties!.tasks.items!
delete taskSchema.properties!.eventTempIds
taskSchema.required = Object.keys(taskSchema.properties!)
const detail = taskSchema.properties!.detail
for (const key of ['materialTempIds', 'timePointTempIds']) delete detail.properties![key]
detail.required = Object.keys(detail.properties!)
for (const [key, field] of Object.entries(taskSchema.properties!.coverage.properties!)) {
  const states = field.enum!.filter(value => value !== 'present')
  taskSchema.properties!.coverage.properties![key] = { anyOf: [{ type: 'null' }, { type: 'string', enum: states }] }
}
const timeSchema = FACT_JSON_SCHEMA.properties!.timePoints.items!
for (const key of localTime) delete timeSchema.properties![key]
timeSchema.required = Object.keys(timeSchema.properties!)

type Schema = typeof FACT_JSON_SCHEMA
function matches(value: unknown, schema: Schema): boolean {
  if ('const' in schema) return value === schema.const
  if (schema.anyOf) return schema.anyOf.some(s => matches(value, s))
  if (schema.enum && !schema.enum.includes(value)) return false
  if (schema.type === 'null') return value === null
  if (schema.type === 'string') return typeof value === 'string' && value.length >= (schema.minLength ?? 0) && value.length <= (schema.maxLength ?? 4000)
  if (schema.type === 'number') return typeof value === 'number' && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity)
  if (schema.type === 'boolean') return typeof value === 'boolean'
  if (schema.type === 'array') return Array.isArray(value) && value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? 200)
    && (!schema.uniqueItems || new Set(value.map(v => JSON.stringify(v))).size === value.length) && value.every(v => matches(v, schema.items!))
  if (schema.type === 'object') return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === schema.required!.length
    && schema.required!.every(k => Object.hasOwn(value, k) && matches((value as Record<string, unknown>)[k], schema.properties![k]))
  return false
}

/** Construct only inverses of explicit edges; do not repair or infer an edge. */
export function assembleFacts(input: unknown): { rawFacts: FactWire; assembledWire: ModelWire } {
  const copy = plainJson(input)
  if (!matches(copy, FACT_JSON_SCHEMA)) return error('SHAPE')
  const facts = copy as FactWire
  const tasks = new Set(facts.tasks.map(t => t.id)), materials = new Set(facts.materials.map(m => m.tempId))
  const times = new Set(facts.timePoints.map(t => t.tempId))
  const allIds = [...tasks, ...materials, ...times, ...facts.events.map(e => e.tempId)]
  const entityCount = facts.tasks.length + facts.materials.length + facts.timePoints.length + facts.events.length
  if (new Set(allIds).size !== entityCount || allIds.some(id => !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(id))) error('ENTITY_ID')
  const refs = (ids: string[], target: Set<string>) => { if (ids.some(id => !target.has(id))) error('REFERENCE') }
  for (const m of facts.materials) refs(m.relatedTaskTempIds, tasks)
  for (const t of facts.timePoints) { refs(t.relatedTaskTempIds, tasks); refs(t.relatedMaterialTempIds, materials) }
  for (const e of facts.events) {
    refs(e.relatedTaskTempIds, tasks)
    refs([e.startTimePointTempId, e.endTimePointTempId].filter((id): id is string => id !== null), times)
  }
  for (const t of facts.tasks) refs([...t.detail.dependencyTempIds, ...(t.detail.parentTempId ? [t.detail.parentTempId] : [])], tasks)
  for (const r of facts.revisions) refs([r.targetDirectiveId, ...(r.fromDirectiveId ? [r.fromDirectiveId] : [])], tasks)
  for (const c of facts.conflicts) refs(c.entityTempIds, new Set(allIds))
  const assembledTasks: ModelWire['tasks'] = facts.tasks.map(t => {
    const materialTempIds = facts.materials.filter(m => m.relatedTaskTempIds.includes(t.id)).map(m => m.tempId)
    const timePointTempIds = facts.timePoints.filter(p => p.relatedTaskTempIds.includes(t.id)).map(p => p.tempId)
    const events = facts.events.filter(e => e.relatedTaskTempIds.includes(t.id))
    // Indirect time ownership is evaluated, but never copied into a direct edge.
    const has = { material: materialTempIds.length > 0, event: events.length > 0,
      time: timePointTempIds.length > 0 || facts.timePoints.some(p => p.relatedMaterialTempIds.some(id => materialTempIds.includes(id)))
        || events.some(e => e.startTimePointTempId !== null || e.endTimePointTempId !== null) }
    const coverage = {} as Coverage
    for (const k of ['time', 'material', 'event'] as const) {
      const state = t.coverage[k]
      if (state === null) { if (!has[k]) error('COVERAGE_MISSING_FACT'); coverage[k] = 'present' }
      else { if (has[k] && state === 'not_stated') error('COVERAGE_CONTRADICTION'); coverage[k] = state }
    }
    return { ...t, coverage, detail: { ...t.detail, materialTempIds, timePointTempIds }, eventTempIds: events.map(e => e.tempId) }
  })
  return { rawFacts: facts, assembledWire: { ...plainJson(facts), schemaVersion: 'real-input-model-wire-1', tasks: assembledTasks } }
}
