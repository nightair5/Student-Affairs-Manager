import { SCOPE_REFERENCE_CANDIDATE_JSON_SCHEMA } from '../../recognition/scopeReferenceContract'
import type { ScopeReferenceDirective, RevisionReference } from '../../recognition/scopeReferenceContract'
import type { TaskSuggestionV2, MaterialSuggestionV2, TimePointSuggestionV2, EventSuggestion, RecognitionConflict } from '../../recognition/types'

export const SEMANTIC_VERSION = 'mainline04-task-semantics-1' as const
export const REVIEW_VERSION = 'mainline04-review-package-1' as const
export type Truth = 'true' | 'false' | 'unknown'
export type Coverage = 'present' | 'not_stated' | 'not_extracted' | 'unresolved'
// Reuse the frozen semantic vocabulary and reference types, not its keyword composer.
export type SemanticTask = Pick<ScopeReferenceDirective, 'id' | 'propositionScopeIds' | 'semantics' | 'inferenceLevel' | 'actionType' | 'action' | 'object' | 'effect'> & {
  detail: Omit<TaskSuggestionV2, 'tempId' | 'actionVerb' | 'actionObject' | 'inferenceLevel' | 'evidenceIds' | 'selected'>
  condition: { value: Truth | 'not_applicable'; conditionScopeIds: string[]; factScopeIds: string[] }
  coverage: { time: Coverage; material: Coverage; event: Coverage }
  eventTempIds: string[]
}
type Sourced<T> = Omit<T, 'selected' | 'evidenceIds'> & { scopeIds: string[] }
export type SemanticMaterial = Sourced<MaterialSuggestionV2>
export type SemanticTime = Sourced<TimePointSuggestionV2>
export type SemanticEvent = Sourced<EventSuggestion> & { relatedTaskTempIds: string[] }
export type SemanticRevision = RevisionReference & { fromDirectiveId: string | null; effective: Truth }
export interface SemanticInput {
  schemaVersion: typeof SEMANTIC_VERSION
  sourceId: string
  sourceVersionId: string
  sourceFingerprint: string
  tasks: SemanticTask[]
  materials: SemanticMaterial[]
  timePoints: SemanticTime[]
  events: SemanticEvent[]
  revisions: SemanticRevision[]
  conflicts: Sourced<RecognitionConflict>[]
  informationScopeIds: string[]
  unresolvedScopeIds: string[]
}

type Schema = { type?: string; const?: unknown; enum?: readonly unknown[]; properties?: Record<string, Schema>;
  required?: string[]; additionalProperties?: boolean; items?: Schema; minLength?: number; maxLength?: number;
  minimum?: number; maximum?: number; minItems?: number; maxItems?: number; uniqueItems?: boolean; anyOf?: Schema[] }
const object = (properties: Record<string, Schema>): Schema => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
const text: Schema = { type: 'string', minLength: 1, maxLength: 4000 }
const string: Schema = { type: 'string', maxLength: 4000 }
const bool: Schema = { type: 'boolean' }
const nullable = (schema: Schema): Schema => ({ anyOf: [schema, { type: 'null' }] })
const array = (items: Schema, uniqueItems = false): Schema => ({ type: 'array', items, maxItems: 200, uniqueItems })
const refs = array(text, true)
const confidence: Schema = { type: 'number', minimum: 0, maximum: 1 }
const nonnegative: Schema = { type: 'number', minimum: 0, maximum: 10080 }
const enumeration = (values: readonly string[]): Schema => ({ type: 'string', enum: values })
// The exported frozen schema is structurally described, hence this explicit schema-type view.
const frozen = SCOPE_REFERENCE_CANDIDATE_JSON_SCHEMA as unknown as Schema
const directive = frozen.properties!.directives.items!.properties!
const semantics = directive.semantics
const timeType = directive.timeRefs.items!.properties!.type
const revision = directive.revisionRefs.items!.properties!
const coverage = enumeration(['present', 'not_stated', 'not_extracted', 'unresolved'])
const truth = enumeration(['true', 'false', 'unknown'])
export const SEMANTIC_JSON_SCHEMA: Schema = object({
  schemaVersion: { const: SEMANTIC_VERSION }, sourceId: text, sourceVersionId: text, sourceFingerprint: text,
  tasks: array(object({ id: text, propositionScopeIds: refs, semantics, inferenceLevel: directive.inferenceLevel,
    actionType: directive.actionType, action: directive.action, object: directive.object, effect: directive.effect,
    detail: object({ parentTempId: nullable(text), hierarchyType: enumeration(['task', 'subtask']), title: text,
      description: string, completionCriteria: array(text), estimatedMinutes: nullable(nonnegative), statusSuggestion: { const: 'todo' },
      prioritySuggestion: enumeration(['low', 'medium', 'high', 'urgent']), dependencyTempIds: refs,
      materialTempIds: refs, timePointTempIds: refs, confidence, userConfirmationRequired: { const: true } }),
    condition: object({ value: enumeration(['true', 'false', 'unknown', 'not_applicable']), conditionScopeIds: refs, factScopeIds: refs }),
    coverage: object({ time: coverage, material: coverage, event: coverage }), eventTempIds: refs })),
  materials: array(object({ tempId: text, name: text, required: bool, formatRequirements: array(text), namingRequirements: array(text),
    quantity: nullable(nonnegative), submissionChannel: nullable(text), relatedTaskTempIds: refs, scopeIds: refs, confidence })),
  timePoints: array(object({ tempId: text, type: timeType, rawText: text, normalizedValue: nullable(text), timezone: text,
    isAllDay: bool, precision: enumeration(['exact', 'date_only', 'relative', 'vague']), needsConfirmation: bool,
    relatedTaskTempIds: refs, relatedMaterialTempIds: refs, scopeIds: refs, confidence })),
  events: array(object({ tempId: text, title: text, description: string, startTimePointTempId: nullable(text),
    endTimePointTempId: nullable(text), location: nullable(text), scopeIds: refs, confidence,
    inferenceLevel: directive.inferenceLevel, relatedTaskTempIds: refs })),
  revisions: array(object({ type: revision.type, targetDirectiveId: text, scopeIds: refs,
    fromDirectiveId: nullable(text), effective: truth })),
  conflicts: array(object({ id: text, type: enumeration(['deadline', 'project_match', 'duplicate', 'hierarchy', 'other']),
    message: text, entityTempIds: refs, scopeIds: refs, requiresDecision: bool })),
  informationScopeIds: refs, unresolvedScopeIds: refs,
})

/** Defensive JSON boundary: no getter execution, sparse arrays, exotic objects or hidden keys. */
export function plainJson<T>(input: T): T {
  let nodes = 0
  const ancestors = new Set<object>()
  function visit(value: unknown, depth: number): void {
    if (++nodes > 50000 || depth > 35) throw new Error('NON_JSON_LIMIT')
    if (value === null || typeof value === 'boolean') return
    if (typeof value === 'string') { if (value.length > 100000) throw new Error('NON_JSON_LIMIT'); return }
    if (typeof value === 'number' && Number.isFinite(value)) return
    if (typeof value !== 'object' || !value || ancestors.has(value)) throw new Error('NON_JSON')
    const isArray = Array.isArray(value)
    if (Object.getPrototypeOf(value) !== (isArray ? Array.prototype : Object.prototype)) throw new Error('NON_JSON_PROTOTYPE')
    ancestors.add(value)
    const keys = Reflect.ownKeys(value)
    if (isArray && (value.length > 1000 || keys.length !== value.length + 1)) throw new Error('NON_JSON_SPARSE')
    for (const key of keys) {
      if (isArray && key === 'length') continue
      if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('NON_JSON_KEY')
      if (isArray && !/^(0|[1-9][0-9]*)$/.test(key)) throw new Error('NON_JSON_ARRAY_KEY')
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!
      if (!('value' in descriptor) || !descriptor.enumerable) throw new Error('NON_JSON_ACCESSOR')
      visit(descriptor.value, depth + 1)
    }
    ancestors.delete(value)
  }
  visit(input, 0)
  return JSON.parse(JSON.stringify(input)) as T
}
export function stableJson(value: unknown): string {
  const copy = plainJson(value)
  function canonical(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(canonical)
    if (item !== null && typeof item === 'object') return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]))
    return item
  }
  return JSON.stringify(canonical(copy))
}
function matches(value: unknown, schema: Schema): boolean {
  if ('const' in schema) return value === schema.const
  if (schema.anyOf) return schema.anyOf.some(item => matches(value, item))
  if (schema.enum && !schema.enum.includes(value)) return false
  if (schema.type === 'null') return value === null
  if (schema.type === 'string') return typeof value === 'string' && value.length >= (schema.minLength ?? 0) && value.length <= (schema.maxLength ?? 4000)
  if (schema.type === 'boolean') return typeof value === 'boolean'
  if (schema.type === 'number') return typeof value === 'number' && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity)
  if (schema.type === 'array') return Array.isArray(value) && value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? 200)
    && (!schema.uniqueItems || new Set(value.map(stableJson)).size === value.length) && value.every(item => matches(item, schema.items!))
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const record = value as Record<string, unknown>, properties = schema.properties!
    return Object.keys(record).length === schema.required!.length && schema.required!.every(key => Object.hasOwn(record, key) && matches(record[key], properties[key]))
  }
  return false
}
export function parseSemanticInput(value: unknown): SemanticInput {
  const copy = plainJson(value)
  if (!matches(copy, SEMANTIC_JSON_SCHEMA)) throw new Error('SEMANTIC_SHAPE_INVALID')
  return copy as SemanticInput
}
