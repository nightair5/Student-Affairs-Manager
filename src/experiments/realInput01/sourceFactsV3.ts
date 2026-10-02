import { FACT_JSON_SCHEMA, FACT_WIRE_VERSION, assembleFacts, type FactWire } from './factAssembly'
import { plainJson } from '../mainline04/semanticContract'
import { FLASH41_MODEL_NAME, parseModelEnvelope, type ModelWire, type WireContext } from './modelWire'

export const SOURCE_FACT_VERSION = 'real-input-source-facts-3' as const
export const SOURCE_ASSEMBLY_VERSION = 'source-facts-assembly-3.0.0' as const
export interface ScopeAccounting { scopeId: string; kind: 'action' | 'event' | 'information' | 'unresolved'; entityIds: string[] }
export interface PrerequisiteState { taskId: string; predecessorId: string; completion: 'true' | 'false' | 'unknown'; factScopeIds: string[] }
export type SourceFacts = Omit<FactWire, 'schemaVersion'> & { schemaVersion: typeof SOURCE_FACT_VERSION; scopeAccounting: ScopeAccounting[]; prerequisiteStates: PrerequisiteState[] }
export const SOURCE_FACT_SCHEMA = structuredClone(FACT_JSON_SCHEMA)
SOURCE_FACT_SCHEMA.properties!.schemaVersion = { type: 'string', const: SOURCE_FACT_VERSION }
const id = { type: 'string', minLength: 1, maxLength: 4000 }
const ids = { type: 'array', maxItems: 200, uniqueItems: true, items: id }
SOURCE_FACT_SCHEMA.properties!.scopeAccounting = { type: 'array', maxItems: 200, items: { type: 'object', additionalProperties: false, required: ['scopeId', 'kind', 'entityIds'], properties: { scopeId: id, kind: { type: 'string', enum: ['action', 'event', 'information', 'unresolved'] }, entityIds: ids } } }
SOURCE_FACT_SCHEMA.properties!.prerequisiteStates = { type: 'array', maxItems: 200, items: { type: 'object', additionalProperties: false, required: ['taskId', 'predecessorId', 'completion', 'factScopeIds'], properties: { taskId: id, predecessorId: id, completion: { type: 'string', enum: ['true', 'false', 'unknown'] }, factScopeIds: ids } } }
// Events and times precede tasks in the generated object; all remain one response.
const order = ['schemaVersion', 'events', 'timePoints', 'materials', 'tasks', 'revisions', 'conflicts', 'informationScopeIds', 'unresolvedScopeIds', 'scopeAccounting', 'prerequisiteStates']
SOURCE_FACT_SCHEMA.properties = Object.fromEntries(order.map(key => [key, SOURCE_FACT_SCHEMA.properties![key]]))
SOURCE_FACT_SCHEMA.required = order
const check = (ok: unknown, code: string) => { if (!ok) throw Error('SOURCE_FACTS_' + code) }
const exact = (value: unknown, keys: string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const stringList = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 200 && v.every(s => typeof s === 'string' && s.length > 0 && s.length <= 4000) && new Set(v).size === v.length

/** Validate explicit accounting, then construct only inverse edges. No omitted fact is synthesized. */
export function assembleSourceFacts(input: unknown, context: WireContext) {
  const raw = plainJson(input) as SourceFacts
  check(exact(raw, order) && raw.schemaVersion === SOURCE_FACT_VERSION, 'SHAPE')
  check(Array.isArray(raw.scopeAccounting) && raw.scopeAccounting.length <= 200 && Array.isArray(raw.prerequisiteStates) && raw.prerequisiteStates.length <= 200, 'ACCOUNTING_SHAPE')
  const { scopeAccounting, prerequisiteStates, ...payload } = raw
  const { assembledWire } = assembleFacts({ ...payload, schemaVersion: FACT_WIRE_VERSION })
  const known = new Set(context.index.scopes.map(s => s.id)), accounted = new Set<string>()
  const entities = new Map<string, { kind: string; scopes: string[] }>([
    ...assembledWire.tasks.map(t => [t.id, { kind: 'action', scopes: t.propositionScopeIds }] as const),
    ...assembledWire.events.map(e => [e.tempId, { kind: 'event', scopes: e.scopeIds }] as const),
  ])
  for (const row of scopeAccounting) {
    check(exact(row, ['scopeId', 'kind', 'entityIds']) && known.has(row.scopeId) && !accounted.has(row.scopeId) && stringList(row.entityIds), 'ACCOUNTING_REFERENCE')
    accounted.add(row.scopeId)
    check(['action', 'event', 'information', 'unresolved'].includes(row.kind), 'ACCOUNTING_KIND')
    if (row.kind === 'action' || row.kind === 'event') {
      check(row.entityIds.length > 0 && row.entityIds.every(key => { const e = entities.get(key); return e?.kind === row.kind && e.scopes.includes(row.scopeId) }), 'ACCOUNTING_ENTITY_MISSING')
    } else check(row.entityIds.length === 0 && (row.kind === 'information' ? assembledWire.informationScopeIds : assembledWire.unresolvedScopeIds).includes(row.scopeId), 'ACCOUNTING_INFORMATION')
  }
  check(accounted.size === known.size, 'ACCOUNTING_INCOMPLETE')
  // Source declarations cannot certify their own semantic correctness; they are auditable coverage claims.
  for (const t of assembledWire.tasks) for (const scope of [...t.propositionScopeIds, ...t.condition.conditionScopeIds, ...t.condition.factScopeIds]) check(known.has(scope), 'UNKNOWN_SCOPE')
  for (const e of [...assembledWire.events, ...assembledWire.materials, ...assembledWire.timePoints, ...assembledWire.revisions]) for (const scope of e.scopeIds) check(known.has(scope), 'UNKNOWN_SCOPE')
  for (const scope of [...assembledWire.informationScopeIds, ...assembledWire.unresolvedScopeIds]) check(known.has(scope), 'UNKNOWN_SCOPE')
  const dependencies = assembledWire.tasks.flatMap(t => t.detail.dependencyTempIds.map(id => t.id + '/' + id)), seen = new Set<string>()
  for (const p of prerequisiteStates) {
    const key = p.taskId + '/' + p.predecessorId
    check(exact(p, ['taskId', 'predecessorId', 'completion', 'factScopeIds']) && dependencies.includes(key) && !seen.has(key) && ['true', 'false', 'unknown'].includes(p.completion) && stringList(p.factScopeIds) && p.factScopeIds.every(id => known.has(id)), 'PREREQUISITE_REFERENCE')
    check(p.completion === 'unknown' || p.factScopeIds.length > 0, 'PREREQUISITE_PROOF_REQUIRED')
    if (p.completion === 'true') {
      const predecessor = assembledWire.tasks.find(t => t.id === p.predecessorId)!
      check(predecessor.semantics.status === 'completed', 'PREREQUISITE_STATUS_CONFLICT')
      check(p.factScopeIds.some(id => { const text = context.index.scopes.find(s => s.id === id)!.text; return text.includes(predecessor.object.surface) && /已|已经|完成|填妥|通过/.test(text) && !/未|没有|尚未|待|若|如果|一旦|之后|以后|后[，。；]?\s*$/.test(text) }), 'CONDITIONAL_NOT_COMPLETION_PROOF')
    }
    seen.add(key)
  }
  check(seen.size === dependencies.length, 'PREREQUISITE_INCOMPLETE')
  for (const t of assembledWire.tasks) {
    check(!['true', 'false'].includes(t.condition.value) || t.condition.factScopeIds.length > 0, 'CONDITION_PROOF_REQUIRED')
    const visit = (id: string, path: Set<string>) => { check(!path.has(id), 'DEPENDENCY_CYCLE'); const next = new Set(path).add(id); for (const ref of assembledWire.tasks.find(x => x.id === id)!.detail.dependencyTempIds) visit(ref, next) }
    visit(t.id, new Set())
  }
  return { rawFacts: raw, assembledWire, conversion: { version: SOURCE_ASSEMBLY_VERSION, operation: 'EXPLICIT_EDGE_INVERSES_ONLY', scopeAccounting, prerequisiteStates, inferredFacts: 0 } }
}

export function convertCandidate18Envelope(rawHttpText: string, context: WireContext) {
  check(new TextEncoder().encode(rawHttpText).byteLength <= 524288, 'RESPONSE_SIZE')
  const envelope = plainJson(JSON.parse(rawHttpText)) as { output?: Array<{ content?: Array<{ text?: string }> }> }
  const output = envelope.output?.[0]?.content?.[0]
  check(typeof output?.text === 'string', 'RESPONSE_TEXT')
  const assembly = assembleSourceFacts(JSON.parse(output!.text!), context)
  output!.text = JSON.stringify(assembly.assembledWire)
  const convertedHttpText = JSON.stringify(envelope)
  parseModelEnvelope(convertedHttpText, context, FLASH41_MODEL_NAME)
  return { ...assembly, convertedHttpText }
}

/** Engineering-only projection of a legal oracle, never a model response or missing-fact repair. */
export function projectSourceFacts(wire: ModelWire, context: WireContext): SourceFacts {
  return { ...plainJson(wire), schemaVersion: SOURCE_FACT_VERSION,
    tasks: wire.tasks.map(t => {
      const rest = Object.fromEntries(Object.entries(t).filter(([key]) => !['eventTempIds','detail','coverage'].includes(key))) as Omit<ModelWire['tasks'][number], 'eventTempIds' | 'detail' | 'coverage'>
      const fields = Object.fromEntries(Object.entries(t.detail).filter(([key]) => !['materialTempIds','timePointTempIds'].includes(key))) as FactWire['tasks'][number]['detail']
      return { ...rest, detail: fields, coverage: { time: t.coverage.time === 'present' ? null : t.coverage.time, material: t.coverage.material === 'present' ? null : t.coverage.material, event: t.coverage.event === 'present' ? null : t.coverage.event } }
    }),
    scopeAccounting: context.index.scopes.map(s => {
      const events = wire.events.filter(e => e.scopeIds.includes(s.id)), tasks = wire.tasks.filter(t => t.propositionScopeIds.includes(s.id))
      return { scopeId: s.id, kind: events.length ? 'event' : tasks.length ? 'action' : wire.unresolvedScopeIds.includes(s.id) ? 'unresolved' : 'information', entityIds: events.length ? events.map(e => e.tempId) : tasks.map(t => t.id) }
    }),
    prerequisiteStates: wire.tasks.flatMap(t => t.detail.dependencyTempIds.map(predecessorId => ({ taskId: t.id, predecessorId, completion: 'unknown' as const, factScopeIds: [] }))),
  }
}
