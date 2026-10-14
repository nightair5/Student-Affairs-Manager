export const SCOPE_REFERENCE_SCHEMA_VERSION = 'scope-reference-candidate-1.0' as const
export const SCOPE_REFERENCE_VERIFICATION_VERSION = 'scope-reference-verification-1.0' as const
export const SCOPE_REFERENCE_PROMPT_VERSION = 'recognition-scope-reference-1.0.0'
export const SCOPE_REFERENCE_MODEL_STATUS = 'NOT_RUN' as const

const ACTORS = ['addressee', 'addressed_group', 'issuer', 'third_party', 'unknown'] as const
const SPEECH_ACTS = ['directive', 'assertive', 'interrogative', 'hypothetical', 'quoted', 'unknown'] as const
const POLARITIES = ['affirmative', 'negative', 'uncertain'] as const
const TENSES = ['future', 'present', 'past', 'unknown'] as const
const STATUSES = ['pending', 'completed', 'cancelled', 'unknown'] as const
const VALIDITIES = ['active', 'superseded', 'uncertain'] as const
const MODALITIES = ['required', 'recommended', 'optional', 'informational', 'unknown'] as const
const INFERENCE_LEVELS = ['explicit', 'strong_inference', 'optional_suggestion'] as const
const EFFECTS = ['local_change', 'external_transfer', 'external_interaction', 'physical_action', 'unknown'] as const
const ACTION_TYPES = ['review', 'complete', 'fill', 'prepare', 'attend', 'carry', 'save', 'print', 'submit', 'upload', 'send', 'contact', 'collect', 'sign', 'register', 'pay', 'other'] as const
const TIME_TYPES = ['registration_deadline', 'submission_deadline', 'task_deadline', 'event_start', 'event_end', 'result_announcement', 'planned_start'] as const
const REVISION_TYPES = ['supersedes', 'cancels', 'amends'] as const
const VERDICTS = ['entailed', 'contradicted', 'unknown'] as const
const OBSERVATION_KINDS = ['event', 'information'] as const

type Actor = typeof ACTORS[number]
type SpeechAct = typeof SPEECH_ACTS[number]
type Polarity = typeof POLARITIES[number]
type Tense = typeof TENSES[number]
type Status = typeof STATUSES[number]
type Validity = typeof VALIDITIES[number]
type Modality = typeof MODALITIES[number]
type InferenceLevel = typeof INFERENCE_LEVELS[number]
type Effect = typeof EFFECTS[number]
type ActionType = typeof ACTION_TYPES[number]
type TimeType = typeof TIME_TYPES[number]
type RevisionType = typeof REVISION_TYPES[number]
type Verdict = typeof VERDICTS[number]
type ObservationKind = typeof OBSERVATION_KINDS[number]

export interface ScopeReferenceSemantics {
  actor: Actor
  speechAct: SpeechAct
  polarity: Polarity
  tense: Tense
  status: Status
  validity: Validity
  modality: Modality
}

export interface ImmutableScope {
  id: string
  sourceId: string
  sourceVersionId: string
  sourceFingerprint: string
  order: number
  start: number
  end: number
  text: string
  contentHash: string
}

export interface ImmutableScopeIndex {
  sourceId: string
  sourceVersionId: string
  sourceFingerprint: string
  sourceContent: string
  scopes: ImmutableScope[]
}

export interface SurfaceReference {
  scopeId: string
  surface: string
}

export interface TimeReference extends SurfaceReference {
  type: TimeType
}

export interface MaterialReference extends SurfaceReference {
  required: boolean
}

export interface RevisionReference {
  type: RevisionType
  targetDirectiveId: string
  scopeIds: string[]
}

export interface ScopeReferenceDirective {
  id: string
  propositionScopeIds: string[]
  semantics: ScopeReferenceSemantics
  inferenceLevel: InferenceLevel
  actionType: ActionType
  action: SurfaceReference
  object: SurfaceReference
  effect: Effect
  timeRefs: TimeReference[]
  materialRefs: MaterialReference[]
  eventRef: SurfaceReference | null
  locationRef: SurfaceReference | null
  revisionRefs: RevisionReference[]
}

export interface ScopeReferenceObservation {
  id: string
  kind: ObservationKind
  propositionScopeIds: string[]
  semantics: ScopeReferenceSemantics
  inferenceLevel: InferenceLevel
  subject: SurfaceReference
  timeRefs: TimeReference[]
  locationRef: SurfaceReference | null
}

export interface ScopeReferenceCandidate {
  schemaVersion: typeof SCOPE_REFERENCE_SCHEMA_VERSION
  sourceId: string
  sourceVersionId: string
  sourceFingerprint: string
  producerRunId: string
  requiresAction: boolean
  directives: ScopeReferenceDirective[]
  observations: ScopeReferenceObservation[]
  ignoredScopeIds: string[]
}

export interface ScopeReferenceAssessment {
  directiveId: string
  verdict: Verdict
  semantics: ScopeReferenceSemantics
  inferenceLevel: InferenceLevel
  actionType: ActionType
  effect: Effect
  evidenceScopeIds: string[]
}

export interface ScopeReferenceVerification {
  schemaVersion: typeof SCOPE_REFERENCE_VERIFICATION_VERSION
  method: 'contract_fixture_oracle' | 'independent_semantic_verifier'
  verifierRunId: string
  sourceId: string
  sourceVersionId: string
  sourceFingerprint: string
  candidateFingerprint: string
  graphCoverage: 'complete' | 'incomplete' | 'unknown'
  revisionCoverage: 'complete' | 'incomplete' | 'unknown'
  consideredScopeIds: string[]
  assessments: ScopeReferenceAssessment[]
  observationAssessments: Array<{
    observationId: string
    verdict: Verdict
    semantics: ScopeReferenceSemantics
    inferenceLevel: InferenceLevel
    evidenceScopeIds: string[]
  }>
  missingDirectiveScopeIds: string[]
}

export interface ScopeReferenceIssue {
  category: 'schema' | 'binding' | 'surface' | 'coverage' | 'semantic' | 'verification' | 'safety'
  code: string
  path: string
}

export interface DerivedSpan extends SurfaceReference {
  start: number
  end: number
}

export interface DerivedEvidence {
  scopeId: string
  start: number
  end: number
  quote: string
}

export interface DerivedRelation {
  id: string
  type: 'task_time' | 'task_material' | 'task_event' | 'task_location' | 'event_time' | 'event_location' | RevisionType
  fromId: string
  toId: string
  evidenceScopeIds: string[]
}

export interface DerivedSuggestion {
  id: string
  action: string
  object: string
  actionType: ActionType
  effect: Effect
  semantics: ScopeReferenceSemantics
  inferenceLevel: InferenceLevel
  actionSpan: DerivedSpan
  objectSpan: DerivedSpan
  timeRefs: Array<TimeReference & { span: DerivedSpan }>
  materialRefs: Array<MaterialReference & { span: DerivedSpan }>
  eventRef: (SurfaceReference & { span: DerivedSpan }) | null
  locationRef: (SurfaceReference & { span: DerivedSpan }) | null
  evidence: DerivedEvidence[]
  selected: boolean
  needsConfirmation: boolean
}

export interface DerivedObservation {
  id: string
  kind: ObservationKind
  subject: string
  semantics: ScopeReferenceSemantics
  inferenceLevel: InferenceLevel
  subjectSpan: DerivedSpan
  timeRefs: Array<TimeReference & { span: DerivedSpan }>
  locationRef: (SurfaceReference & { span: DerivedSpan }) | null
  evidence: DerivedEvidence[]
  selected: false
  needsConfirmation: true
}

export interface ScopeReferenceComposition {
  schemaVersion: 'scope-reference-composition-1.0'
  sourceId: string
  sourceVersionId: string
  sourceFingerprint: string
  candidateFingerprint: string
  requiresAction: boolean
  suggestions: DerivedSuggestion[]
  observations: DerivedObservation[]
  relations: DerivedRelation[]
  generatedLocally: {
    offsets: true
    verbatimEvidence: true
    relations: true
    selected: true
  }
}

export interface ComposeScopeReferenceOptions {
  allowContractFixtureOracle?: boolean
  trustedVerifierRunIds?: ReadonlySet<string>
}

const strictObject = (properties: Record<string, unknown>) => ({
  type: 'object', properties, required: Object.keys(properties), additionalProperties: false,
})
const stringSchema = { type: 'string', minLength: 1 }
const stringArraySchema = { type: 'array', items: stringSchema, uniqueItems: true }
const surfaceSchema = strictObject({ scopeId: stringSchema, surface: stringSchema })
const semanticsSchema = strictObject({
  actor: { type: 'string', enum: ACTORS }, speechAct: { type: 'string', enum: SPEECH_ACTS },
  polarity: { type: 'string', enum: POLARITIES }, tense: { type: 'string', enum: TENSES },
  status: { type: 'string', enum: STATUSES }, validity: { type: 'string', enum: VALIDITIES },
  modality: { type: 'string', enum: MODALITIES },
})
const timeReferenceSchema = strictObject({ scopeId: stringSchema, surface: stringSchema, type: { type: 'string', enum: TIME_TYPES } })
const materialReferenceSchema = strictObject({ scopeId: stringSchema, surface: stringSchema, required: { type: 'boolean' } })
const revisionReferenceSchema = strictObject({ type: { type: 'string', enum: REVISION_TYPES }, targetDirectiveId: stringSchema, scopeIds: stringArraySchema })
const directiveSchema = strictObject({
  id: stringSchema,
  propositionScopeIds: stringArraySchema,
  semantics: semanticsSchema,
  inferenceLevel: { type: 'string', enum: INFERENCE_LEVELS },
  actionType: { type: 'string', enum: ACTION_TYPES },
  action: surfaceSchema,
  object: surfaceSchema,
  effect: { type: 'string', enum: EFFECTS },
  timeRefs: { type: 'array', items: timeReferenceSchema },
  materialRefs: { type: 'array', items: materialReferenceSchema },
  eventRef: { anyOf: [surfaceSchema, { type: 'null' }] },
  locationRef: { anyOf: [surfaceSchema, { type: 'null' }] },
  revisionRefs: { type: 'array', items: revisionReferenceSchema },
})
const observationSchema = strictObject({
  id: stringSchema,
  kind: { type: 'string', enum: OBSERVATION_KINDS },
  propositionScopeIds: stringArraySchema,
  semantics: semanticsSchema,
  inferenceLevel: { type: 'string', enum: INFERENCE_LEVELS },
  subject: surfaceSchema,
  timeRefs: { type: 'array', items: timeReferenceSchema },
  locationRef: { anyOf: [surfaceSchema, { type: 'null' }] },
})

export const SCOPE_REFERENCE_CANDIDATE_JSON_SCHEMA = strictObject({
  schemaVersion: { const: SCOPE_REFERENCE_SCHEMA_VERSION },
  sourceId: stringSchema,
  sourceVersionId: stringSchema,
  sourceFingerprint: stringSchema,
  producerRunId: stringSchema,
  requiresAction: { type: 'boolean' },
  directives: { type: 'array', items: directiveSchema },
  observations: { type: 'array', items: observationSchema },
  ignoredScopeIds: stringArraySchema,
})

const assessmentSchema = strictObject({
  directiveId: stringSchema,
  verdict: { type: 'string', enum: VERDICTS },
  semantics: semanticsSchema,
  inferenceLevel: { type: 'string', enum: INFERENCE_LEVELS },
  actionType: { type: 'string', enum: ACTION_TYPES },
  effect: { type: 'string', enum: EFFECTS },
  evidenceScopeIds: stringArraySchema,
})
const observationAssessmentSchema = strictObject({
  observationId: stringSchema,
  verdict: { type: 'string', enum: VERDICTS },
  semantics: semanticsSchema,
  inferenceLevel: { type: 'string', enum: INFERENCE_LEVELS },
  evidenceScopeIds: stringArraySchema,
})

export const SCOPE_REFERENCE_VERIFICATION_JSON_SCHEMA = strictObject({
  schemaVersion: { const: SCOPE_REFERENCE_VERIFICATION_VERSION },
  method: { type: 'string', enum: ['contract_fixture_oracle', 'independent_semantic_verifier'] },
  verifierRunId: stringSchema,
  sourceId: stringSchema,
  sourceVersionId: stringSchema,
  sourceFingerprint: stringSchema,
  candidateFingerprint: stringSchema,
  graphCoverage: { type: 'string', enum: ['complete', 'incomplete', 'unknown'] },
  revisionCoverage: { type: 'string', enum: ['complete', 'incomplete', 'unknown'] },
  consideredScopeIds: stringArraySchema,
  assessments: { type: 'array', items: assessmentSchema },
  observationAssessments: { type: 'array', items: observationAssessmentSchema },
  missingDirectiveScopeIds: stringArraySchema,
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function boundedString(value: unknown, max = 500): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

function enumValue<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value)
}

function exactKeys(value: unknown, fields: readonly string[], path: string, issues: ScopeReferenceIssue[]): value is Record<string, unknown> {
  if (!isRecord(value)) {
    issues.push({ category: 'schema', code: 'OBJECT_REQUIRED', path })
    return false
  }
  for (const field of fields) if (!(field in value)) issues.push({ category: 'schema', code: 'REQUIRED_FIELD_MISSING', path: `${path}.${field}` })
  for (const field of Object.keys(value)) if (!fields.includes(field)) issues.push({ category: 'schema', code: 'UNKNOWN_FIELD', path: `${path}.${field}` })
  return true
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

async function sha256(value: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return `sha256:${Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

export async function scopeReferenceCandidateFingerprint(candidate: ScopeReferenceCandidate): Promise<string> {
  return sha256(canonicalJson(candidate))
}

function terminal(value: string): boolean {
  return /[。！？；;!?，,:：]/u.test(value.normalize('NFKC')) || /[؟⁇⁈⁉]/u.test(value)
}

export async function indexImmutableScopes(sourceId: string, sourceVersionId: string, sourceContent: string): Promise<ImmutableScopeIndex> {
  if (!boundedString(sourceId, 160) || !boundedString(sourceVersionId, 160) || !boundedString(sourceContent, 100_000)) {
    throw new Error('SCOPE_SOURCE_INVALID')
  }
  const sourceFingerprint = await sha256(`${sourceId}\u0000${sourceVersionId}\u0000${sourceContent}`)
  const boundaries: Array<{ start: number; end: number; text: string }> = []
  let cursor = 0
  const emit = (rawEnd: number) => {
    let start = cursor
    let end = rawEnd
    while (start < end && /\s/u.test(sourceContent[start])) start += 1
    while (end > start && /\s/u.test(sourceContent[end - 1])) end -= 1
    if (end > start) boundaries.push({ start, end, text: sourceContent.slice(start, end) })
    cursor = rawEnd
  }
  for (let index = 0; index < sourceContent.length; index += 1) {
    if (terminal(sourceContent[index])) {
      let end = index + 1
      while (end < sourceContent.length && terminal(sourceContent[end])) end += 1
      emit(end)
      index = end - 1
    } else if (/[\r\n]/u.test(sourceContent[index])) {
      let end = index + 1
      while (end < sourceContent.length && /[\r\n]/u.test(sourceContent[end])) end += 1
      emit(end)
      index = end - 1
    }
  }
  if (cursor < sourceContent.length) emit(sourceContent.length)
  const scopes = await Promise.all(boundaries.map(async (boundary, order) => {
    const contentHash = await sha256(`${sourceFingerprint}\u0000${order}\u0000${boundary.start}\u0000${boundary.end}\u0000${boundary.text}`)
    return {
      id: `scope-${String(order + 1).padStart(4, '0')}-${contentHash.slice(7)}`,
      sourceId, sourceVersionId, sourceFingerprint, order, ...boundary, contentHash,
    }
  }))
  return { sourceId, sourceVersionId, sourceFingerprint, sourceContent, scopes }
}

function validateSemantics(value: unknown, path: string, issues: ScopeReferenceIssue[]): value is ScopeReferenceSemantics {
  if (!exactKeys(value, ['actor', 'speechAct', 'polarity', 'tense', 'status', 'validity', 'modality'], path, issues)) return false
  const valid = enumValue(value.actor, ACTORS) && enumValue(value.speechAct, SPEECH_ACTS) && enumValue(value.polarity, POLARITIES)
    && enumValue(value.tense, TENSES) && enumValue(value.status, STATUSES) && enumValue(value.validity, VALIDITIES)
    && enumValue(value.modality, MODALITIES)
  if (!valid) issues.push({ category: 'schema', code: 'SEMANTICS_INVALID', path })
  return valid
}

function validateStringArray(value: unknown, path: string, issues: ScopeReferenceIssue[], max = 40): value is string[] {
  if (!Array.isArray(value) || value.length > max || value.some((item) => !boundedString(item, 200))) {
    issues.push({ category: 'schema', code: 'STRING_ARRAY_INVALID', path })
    return false
  }
  if (new Set(value).size !== value.length) issues.push({ category: 'schema', code: 'DUPLICATE_REFERENCE', path })
  return true
}

function validateSurfaceShape(value: unknown, path: string, issues: ScopeReferenceIssue[]): value is SurfaceReference {
  if (!exactKeys(value, ['scopeId', 'surface'], path, issues)) return false
  const valid = boundedString(value.scopeId, 200) && boundedString(value.surface, 300)
  if (!valid) issues.push({ category: 'schema', code: 'SURFACE_REFERENCE_INVALID', path })
  return valid
}

function validateTimeShape(value: unknown, path: string, issues: ScopeReferenceIssue[]): value is TimeReference {
  if (!exactKeys(value, ['scopeId', 'surface', 'type'], path, issues)) return false
  const valid = boundedString(value.scopeId, 200) && boundedString(value.surface, 300) && enumValue(value.type, TIME_TYPES)
  if (!valid) issues.push({ category: 'schema', code: 'TIME_REFERENCE_INVALID', path })
  return valid
}

function validateMaterialShape(value: unknown, path: string, issues: ScopeReferenceIssue[]): value is MaterialReference {
  if (!exactKeys(value, ['scopeId', 'surface', 'required'], path, issues)) return false
  const valid = boundedString(value.scopeId, 200) && boundedString(value.surface, 300) && typeof value.required === 'boolean'
  if (!valid) issues.push({ category: 'schema', code: 'MATERIAL_REFERENCE_INVALID', path })
  return valid
}

function validateRevisionShape(value: unknown, path: string, issues: ScopeReferenceIssue[]): value is RevisionReference {
  if (!exactKeys(value, ['type', 'targetDirectiveId', 'scopeIds'], path, issues)) return false
  const valid = enumValue(value.type, REVISION_TYPES) && boundedString(value.targetDirectiveId, 100)
    && validateStringArray(value.scopeIds, `${path}.scopeIds`, issues)
  if (!valid) issues.push({ category: 'schema', code: 'REVISION_REFERENCE_INVALID', path })
  return valid
}

function validateDirectiveShape(value: unknown, path: string, issues: ScopeReferenceIssue[]): value is ScopeReferenceDirective {
  if (!exactKeys(value, ['id', 'propositionScopeIds', 'semantics', 'inferenceLevel', 'actionType', 'action', 'object', 'effect', 'timeRefs', 'materialRefs', 'eventRef', 'locationRef', 'revisionRefs'], path, issues)) return false
  const valid = boundedString(value.id, 100)
    && validateStringArray(value.propositionScopeIds, `${path}.propositionScopeIds`, issues)
    && validateSemantics(value.semantics, `${path}.semantics`, issues)
    && enumValue(value.inferenceLevel, INFERENCE_LEVELS)
    && enumValue(value.actionType, ACTION_TYPES)
    && validateSurfaceShape(value.action, `${path}.action`, issues)
    && validateSurfaceShape(value.object, `${path}.object`, issues)
    && enumValue(value.effect, EFFECTS)
    && Array.isArray(value.timeRefs) && value.timeRefs.length <= 20
    && value.timeRefs.every((item, index) => validateTimeShape(item, `${path}.timeRefs[${index}]`, issues))
    && Array.isArray(value.materialRefs) && value.materialRefs.length <= 20
    && value.materialRefs.every((item, index) => validateMaterialShape(item, `${path}.materialRefs[${index}]`, issues))
    && (value.eventRef === null || validateSurfaceShape(value.eventRef, `${path}.eventRef`, issues))
    && (value.locationRef === null || validateSurfaceShape(value.locationRef, `${path}.locationRef`, issues))
    && Array.isArray(value.revisionRefs) && value.revisionRefs.length <= 20
    && value.revisionRefs.every((item, index) => validateRevisionShape(item, `${path}.revisionRefs[${index}]`, issues))
  if (!valid) issues.push({ category: 'schema', code: 'DIRECTIVE_INVALID', path })
  return valid
}

function validateObservationShape(value: unknown, path: string, issues: ScopeReferenceIssue[]): value is ScopeReferenceObservation {
  if (!exactKeys(value, ['id', 'kind', 'propositionScopeIds', 'semantics', 'inferenceLevel', 'subject', 'timeRefs', 'locationRef'], path, issues)) return false
  const valid = boundedString(value.id, 100)
    && enumValue(value.kind, OBSERVATION_KINDS)
    && validateStringArray(value.propositionScopeIds, `${path}.propositionScopeIds`, issues)
    && validateSemantics(value.semantics, `${path}.semantics`, issues)
    && enumValue(value.inferenceLevel, INFERENCE_LEVELS)
    && validateSurfaceShape(value.subject, `${path}.subject`, issues)
    && Array.isArray(value.timeRefs) && value.timeRefs.length <= 20
    && value.timeRefs.every((item, index) => validateTimeShape(item, `${path}.timeRefs[${index}]`, issues))
    && (value.locationRef === null || validateSurfaceShape(value.locationRef, `${path}.locationRef`, issues))
  if (!valid) issues.push({ category: 'schema', code: 'OBSERVATION_INVALID', path })
  return valid
}

function scopeOrderValid(ids: string[], scopeMap: Map<string, ImmutableScope>): boolean {
  return ids.every((id, index) => index === 0 || (scopeMap.get(ids[index - 1])?.order ?? Number.MAX_SAFE_INTEGER) < (scopeMap.get(id)?.order ?? -1))
}

function resolveSurface(reference: SurfaceReference, scopeMap: Map<string, ImmutableScope>, path: string, issues: ScopeReferenceIssue[]): DerivedSpan | null {
  const scope = scopeMap.get(reference.scopeId)
  if (!scope) {
    issues.push({ category: 'binding', code: 'SCOPE_REFERENCE_NOT_FOUND', path: `${path}.scopeId` })
    return null
  }
  const first = scope.text.indexOf(reference.surface)
  if (first < 0) {
    issues.push({ category: 'surface', code: 'SURFACE_NOT_IN_SCOPE', path: `${path}.surface` })
    return null
  }
  if (scope.text.indexOf(reference.surface, first + reference.surface.length) >= 0) {
    issues.push({ category: 'surface', code: 'SURFACE_AMBIGUOUS_IN_SCOPE', path: `${path}.surface` })
    return null
  }
  return { ...reference, start: scope.start + first, end: scope.start + first + reference.surface.length }
}

function currentRequiredDirective(directive: ScopeReferenceDirective): boolean {
  const semantics = directive.semantics
  return (semantics.actor === 'addressee' || semantics.actor === 'addressed_group') && semantics.speechAct === 'directive'
    && semantics.polarity === 'affirmative' && (semantics.tense === 'present' || semantics.tense === 'future')
    && semantics.status === 'pending' && semantics.validity === 'active' && semantics.modality === 'required'
    && directive.inferenceLevel === 'explicit'
}

function modelForbiddenKeys(value: unknown, path: string, issues: ScopeReferenceIssue[]): void {
  if (Array.isArray(value)) return value.forEach((item, index) => modelForbiddenKeys(item, `${path}[${index}]`, issues))
  if (!isRecord(value)) return
  for (const [key, nested] of Object.entries(value)) {
    if (['start', 'end', 'text', 'quote', 'evidence', 'selected', 'relations', 'fromId', 'toId'].includes(key)) {
      issues.push({ category: 'schema', code: 'MODEL_FORBIDDEN_FIELD', path: `${path}.${key}` })
    }
    modelForbiddenKeys(nested, `${path}.${key}`, issues)
  }
}

export function validateScopeReferenceCandidate(value: unknown, index: ImmutableScopeIndex): { valid: boolean; issues: ScopeReferenceIssue[] } {
  const issues: ScopeReferenceIssue[] = []
  modelForbiddenKeys(value, 'candidate', issues)
  if (!exactKeys(value, ['schemaVersion', 'sourceId', 'sourceVersionId', 'sourceFingerprint', 'producerRunId', 'requiresAction', 'directives', 'observations', 'ignoredScopeIds'], 'candidate', issues)) {
    return { valid: false, issues }
  }
  const shapeValid = value.schemaVersion === SCOPE_REFERENCE_SCHEMA_VERSION
    && boundedString(value.sourceId, 160) && boundedString(value.sourceVersionId, 160)
    && boundedString(value.sourceFingerprint, 100) && boundedString(value.producerRunId, 160)
    && typeof value.requiresAction === 'boolean'
    && Array.isArray(value.directives) && value.directives.length <= 40
    && value.directives.every((item, itemIndex) => validateDirectiveShape(item, `candidate.directives[${itemIndex}]`, issues))
    && Array.isArray(value.observations) && value.observations.length <= 40
    && value.observations.every((item, itemIndex) => validateObservationShape(item, `candidate.observations[${itemIndex}]`, issues))
    && validateStringArray(value.ignoredScopeIds, 'candidate.ignoredScopeIds', issues, 200)
  if (!shapeValid) {
    issues.push({ category: 'schema', code: 'CANDIDATE_INVALID', path: 'candidate' })
    return { valid: false, issues }
  }
  const candidate = value as unknown as ScopeReferenceCandidate
  if (candidate.sourceId !== index.sourceId || candidate.sourceVersionId !== index.sourceVersionId || candidate.sourceFingerprint !== index.sourceFingerprint) {
    issues.push({ category: 'binding', code: 'SOURCE_BINDING_MISMATCH', path: 'candidate' })
  }
  const scopeMap = new Map(index.scopes.map((scope) => [scope.id, scope]))
  const directiveMap = new Map<string, ScopeReferenceDirective>()
  const referencedScopes = new Set<string>()
  for (const [directiveIndex, directive] of candidate.directives.entries()) {
    const path = `candidate.directives[${directiveIndex}]`
    if (directiveMap.has(directive.id)) issues.push({ category: 'schema', code: 'DIRECTIVE_ID_DUPLICATE', path: `${path}.id` })
    directiveMap.set(directive.id, directive)
    if (directive.propositionScopeIds.length === 0 || directive.propositionScopeIds.some((id) => !scopeMap.has(id))) {
      issues.push({ category: 'binding', code: 'PROPOSITION_SCOPE_INVALID', path: `${path}.propositionScopeIds` })
    }
    if (!scopeOrderValid(directive.propositionScopeIds, scopeMap)) issues.push({ category: 'binding', code: 'PROPOSITION_SCOPE_ORDER_INVALID', path: `${path}.propositionScopeIds` })
    directive.propositionScopeIds.forEach((id) => referencedScopes.add(id))
    const nestedRefs: Array<{ reference: SurfaceReference; path: string }> = [
      { reference: directive.action, path: `${path}.action` }, { reference: directive.object, path: `${path}.object` },
      ...directive.timeRefs.map((reference, refIndex) => ({ reference, path: `${path}.timeRefs[${refIndex}]` })),
      ...directive.materialRefs.map((reference, refIndex) => ({ reference, path: `${path}.materialRefs[${refIndex}]` })),
      ...(directive.eventRef ? [{ reference: directive.eventRef, path: `${path}.eventRef` }] : []),
      ...(directive.locationRef ? [{ reference: directive.locationRef, path: `${path}.locationRef` }] : []),
    ]
    for (const item of nestedRefs) {
      if (!directive.propositionScopeIds.includes(item.reference.scopeId)) issues.push({ category: 'binding', code: 'FIELD_OUTSIDE_PROPOSITION_SCOPE', path: `${item.path}.scopeId` })
      resolveSurface(item.reference, scopeMap, item.path, issues)
    }
  }
  const observationIds = new Set<string>()
  for (const [observationIndex, observation] of candidate.observations.entries()) {
    const path = `candidate.observations[${observationIndex}]`
    if (observationIds.has(observation.id) || directiveMap.has(observation.id)) issues.push({ category: 'schema', code: 'PROPOSITION_ID_DUPLICATE', path: `${path}.id` })
    observationIds.add(observation.id)
    if (observation.propositionScopeIds.length === 0 || observation.propositionScopeIds.some((id) => !scopeMap.has(id))) {
      issues.push({ category: 'binding', code: 'PROPOSITION_SCOPE_INVALID', path: `${path}.propositionScopeIds` })
    }
    if (!scopeOrderValid(observation.propositionScopeIds, scopeMap)) issues.push({ category: 'binding', code: 'PROPOSITION_SCOPE_ORDER_INVALID', path: `${path}.propositionScopeIds` })
    observation.propositionScopeIds.forEach((id) => referencedScopes.add(id))
    const nestedRefs: Array<{ reference: SurfaceReference; path: string }> = [
      { reference: observation.subject, path: `${path}.subject` },
      ...observation.timeRefs.map((reference, refIndex) => ({ reference, path: `${path}.timeRefs[${refIndex}]` })),
      ...(observation.locationRef ? [{ reference: observation.locationRef, path: `${path}.locationRef` }] : []),
    ]
    for (const item of nestedRefs) {
      if (!observation.propositionScopeIds.includes(item.reference.scopeId)) issues.push({ category: 'binding', code: 'FIELD_OUTSIDE_PROPOSITION_SCOPE', path: `${item.path}.scopeId` })
      resolveSurface(item.reference, scopeMap, item.path, issues)
    }
  }
  for (const [directiveIndex, directive] of candidate.directives.entries()) {
    for (const [revisionIndex, revision] of directive.revisionRefs.entries()) {
      const path = `candidate.directives[${directiveIndex}].revisionRefs[${revisionIndex}]`
      if (!directiveMap.has(revision.targetDirectiveId) || revision.targetDirectiveId === directive.id) issues.push({ category: 'binding', code: 'REVISION_TARGET_INVALID', path: `${path}.targetDirectiveId` })
      if (revision.scopeIds.length === 0 || revision.scopeIds.some((id) => !directive.propositionScopeIds.includes(id))) issues.push({ category: 'binding', code: 'REVISION_SCOPE_INVALID', path: `${path}.scopeIds` })
      if (!scopeOrderValid(revision.scopeIds, scopeMap)) issues.push({ category: 'binding', code: 'REVISION_SCOPE_ORDER_INVALID', path: `${path}.scopeIds` })
    }
  }
  const ignored = new Set(candidate.ignoredScopeIds)
  if (candidate.ignoredScopeIds.some((id) => !scopeMap.has(id))) issues.push({ category: 'binding', code: 'IGNORED_SCOPE_INVALID', path: 'candidate.ignoredScopeIds' })
  if (candidate.ignoredScopeIds.some((id) => referencedScopes.has(id))) issues.push({ category: 'coverage', code: 'SCOPE_BOTH_REFERENCED_AND_IGNORED', path: 'candidate.ignoredScopeIds' })
  const accounted = new Set([...referencedScopes, ...ignored])
  if (index.scopes.some((scope) => !accounted.has(scope.id))) issues.push({ category: 'coverage', code: 'SOURCE_SCOPE_UNACCOUNTED', path: 'candidate' })
  if (candidate.requiresAction !== candidate.directives.some(currentRequiredDirective)) issues.push({ category: 'semantic', code: 'REQUIRES_ACTION_INCONSISTENT', path: 'candidate.requiresAction' })
  return { valid: issues.length === 0, issues }
}

function validateAssessmentShape(value: unknown, path: string, issues: ScopeReferenceIssue[]): value is ScopeReferenceAssessment {
  if (!exactKeys(value, ['directiveId', 'verdict', 'semantics', 'inferenceLevel', 'actionType', 'effect', 'evidenceScopeIds'], path, issues)) return false
  const valid = boundedString(value.directiveId, 100) && enumValue(value.verdict, VERDICTS)
    && validateSemantics(value.semantics, `${path}.semantics`, issues) && enumValue(value.inferenceLevel, INFERENCE_LEVELS)
    && enumValue(value.actionType, ACTION_TYPES) && enumValue(value.effect, EFFECTS)
    && validateStringArray(value.evidenceScopeIds, `${path}.evidenceScopeIds`, issues)
  if (!valid) issues.push({ category: 'schema', code: 'ASSESSMENT_INVALID', path })
  return valid
}

function validateObservationAssessmentShape(value: unknown, path: string, issues: ScopeReferenceIssue[]): value is ScopeReferenceVerification['observationAssessments'][number] {
  if (!exactKeys(value, ['observationId', 'verdict', 'semantics', 'inferenceLevel', 'evidenceScopeIds'], path, issues)) return false
  const valid = boundedString(value.observationId, 100) && enumValue(value.verdict, VERDICTS)
    && validateSemantics(value.semantics, `${path}.semantics`, issues)
    && enumValue(value.inferenceLevel, INFERENCE_LEVELS)
    && validateStringArray(value.evidenceScopeIds, `${path}.evidenceScopeIds`, issues)
  if (!valid) issues.push({ category: 'schema', code: 'OBSERVATION_ASSESSMENT_INVALID', path })
  return valid
}

export async function validateScopeReferenceVerification(value: unknown, index: ImmutableScopeIndex, candidate: ScopeReferenceCandidate): Promise<{ valid: boolean; issues: ScopeReferenceIssue[] }> {
  const issues: ScopeReferenceIssue[] = []
  modelForbiddenKeys(value, 'verification', issues)
  if (!exactKeys(value, ['schemaVersion', 'method', 'verifierRunId', 'sourceId', 'sourceVersionId', 'sourceFingerprint', 'candidateFingerprint', 'graphCoverage', 'revisionCoverage', 'consideredScopeIds', 'assessments', 'observationAssessments', 'missingDirectiveScopeIds'], 'verification', issues)) {
    return { valid: false, issues }
  }
  const shapeValid = value.schemaVersion === SCOPE_REFERENCE_VERIFICATION_VERSION
    && enumValue(value.method, ['contract_fixture_oracle', 'independent_semantic_verifier'] as const)
    && boundedString(value.verifierRunId, 160) && boundedString(value.sourceId, 160) && boundedString(value.sourceVersionId, 160)
    && boundedString(value.sourceFingerprint, 100) && boundedString(value.candidateFingerprint, 100)
    && enumValue(value.graphCoverage, ['complete', 'incomplete', 'unknown'] as const)
    && enumValue(value.revisionCoverage, ['complete', 'incomplete', 'unknown'] as const)
    && validateStringArray(value.consideredScopeIds, 'verification.consideredScopeIds', issues, 200)
    && Array.isArray(value.assessments) && value.assessments.length <= 40
    && value.assessments.every((item, itemIndex) => validateAssessmentShape(item, `verification.assessments[${itemIndex}]`, issues))
    && Array.isArray(value.observationAssessments) && value.observationAssessments.length <= 40
    && value.observationAssessments.every((item, itemIndex) => validateObservationAssessmentShape(item, `verification.observationAssessments[${itemIndex}]`, issues))
    && validateStringArray(value.missingDirectiveScopeIds, 'verification.missingDirectiveScopeIds', issues, 200)
  if (!shapeValid) {
    issues.push({ category: 'schema', code: 'VERIFICATION_INVALID', path: 'verification' })
    return { valid: false, issues }
  }
  const verification = value as unknown as ScopeReferenceVerification
  if (verification.sourceId !== index.sourceId || verification.sourceVersionId !== index.sourceVersionId || verification.sourceFingerprint !== index.sourceFingerprint) {
    issues.push({ category: 'verification', code: 'VERIFICATION_SOURCE_MISMATCH', path: 'verification' })
  }
  if (verification.verifierRunId === candidate.producerRunId) {
    issues.push({ category: 'verification', code: 'VERIFIER_RUN_NOT_INDEPENDENT', path: 'verification.verifierRunId' })
  }
  if (verification.candidateFingerprint !== await scopeReferenceCandidateFingerprint(candidate)) issues.push({ category: 'verification', code: 'VERIFICATION_CANDIDATE_MISMATCH', path: 'verification.candidateFingerprint' })
  const scopeMap = new Map(index.scopes.map((scope) => [scope.id, scope]))
  if (verification.consideredScopeIds.some((id) => !scopeMap.has(id)) || !scopeOrderValid(verification.consideredScopeIds, scopeMap)) issues.push({ category: 'verification', code: 'CONSIDERED_SCOPE_INVALID', path: 'verification.consideredScopeIds' })
  if (verification.missingDirectiveScopeIds.some((id) => !scopeMap.has(id)) || !scopeOrderValid(verification.missingDirectiveScopeIds, scopeMap)) issues.push({ category: 'verification', code: 'MISSING_SCOPE_INVALID', path: 'verification.missingDirectiveScopeIds' })
  const directiveMap = new Map(candidate.directives.map((directive) => [directive.id, directive]))
  const assessed = new Set<string>()
  for (const [assessmentIndex, assessment] of verification.assessments.entries()) {
    const path = `verification.assessments[${assessmentIndex}]`
    const directive = directiveMap.get(assessment.directiveId)
    if (!directive || assessed.has(assessment.directiveId)) issues.push({ category: 'verification', code: 'ASSESSMENT_DIRECTIVE_INVALID', path: `${path}.directiveId` })
    assessed.add(assessment.directiveId)
    if (directive) {
      if (assessment.evidenceScopeIds.some((id) => !directive.propositionScopeIds.includes(id)) || !scopeOrderValid(assessment.evidenceScopeIds, scopeMap)) {
        issues.push({ category: 'verification', code: 'ASSESSMENT_SCOPE_INVALID', path: `${path}.evidenceScopeIds` })
      }
      if (assessment.verdict === 'entailed' && canonicalJson(assessment.evidenceScopeIds) !== canonicalJson(directive.propositionScopeIds)) {
        issues.push({ category: 'verification', code: 'ENTAILED_EVIDENCE_INCOMPLETE', path: `${path}.evidenceScopeIds` })
      }
    }
  }
  if (assessed.size !== candidate.directives.length || candidate.directives.some((directive) => !assessed.has(directive.id))) issues.push({ category: 'verification', code: 'ASSESSMENT_COVERAGE_INCOMPLETE', path: 'verification.assessments' })
  const observationMap = new Map(candidate.observations.map((observation) => [observation.id, observation]))
  const assessedObservations = new Set<string>()
  for (const [assessmentIndex, assessment] of verification.observationAssessments.entries()) {
    const path = `verification.observationAssessments[${assessmentIndex}]`
    const observation = observationMap.get(assessment.observationId)
    if (!observation || assessedObservations.has(assessment.observationId)) issues.push({ category: 'verification', code: 'OBSERVATION_ASSESSMENT_INVALID', path: `${path}.observationId` })
    assessedObservations.add(assessment.observationId)
    if (observation) {
      if (assessment.evidenceScopeIds.some((id) => !observation.propositionScopeIds.includes(id)) || !scopeOrderValid(assessment.evidenceScopeIds, scopeMap)) {
        issues.push({ category: 'verification', code: 'OBSERVATION_ASSESSMENT_SCOPE_INVALID', path: `${path}.evidenceScopeIds` })
      }
      if (assessment.verdict === 'entailed' && canonicalJson(assessment.evidenceScopeIds) !== canonicalJson(observation.propositionScopeIds)) {
        issues.push({ category: 'verification', code: 'ENTAILED_OBSERVATION_EVIDENCE_INCOMPLETE', path: `${path}.evidenceScopeIds` })
      }
    }
  }
  if (assessedObservations.size !== candidate.observations.length || candidate.observations.some((observation) => !assessedObservations.has(observation.id))) {
    issues.push({ category: 'verification', code: 'OBSERVATION_ASSESSMENT_COVERAGE_INCOMPLETE', path: 'verification.observationAssessments' })
  }
  if (verification.graphCoverage === 'complete' && canonicalJson(verification.consideredScopeIds) !== canonicalJson(index.scopes.map((scope) => scope.id))) issues.push({ category: 'verification', code: 'GRAPH_COMPLETE_SCOPE_COVERAGE_INVALID', path: 'verification.consideredScopeIds' })
  if (verification.graphCoverage === 'complete' && verification.missingDirectiveScopeIds.length > 0) issues.push({ category: 'verification', code: 'GRAPH_COMPLETE_WITH_MISSING_DIRECTIVES', path: 'verification.missingDirectiveScopeIds' })
  return { valid: issues.length === 0, issues }
}

function assessmentAgrees(directive: ScopeReferenceDirective, assessment: ScopeReferenceAssessment): boolean {
  return assessment.verdict === 'entailed' && assessment.actionType === directive.actionType && assessment.effect === directive.effect
    && assessment.inferenceLevel === directive.inferenceLevel && canonicalJson(assessment.semantics) === canonicalJson(directive.semantics)
}

const LOCAL_DEFAULT_ACTIONS = new Set<ActionType>(['review', 'complete', 'fill', 'prepare', 'attend', 'carry', 'save', 'print'])
const OBVIOUS_EXTERNAL_SURFACE = /(?:提交|递交|报送|上传|发送|邮寄|寄送|转交|交付|联系|回复|付款|缴费|submit|upload|send|mail|pay)/iu

function defaultEligible(directive: ScopeReferenceDirective, assessment: ScopeReferenceAssessment, verification: ScopeReferenceVerification, options: ComposeScopeReferenceOptions): boolean {
  const verifierAllowed = (verification.method === 'independent_semantic_verifier'
      && options.trustedVerifierRunIds?.has(verification.verifierRunId) === true
    )
    || (verification.method === 'contract_fixture_oracle' && options.allowContractFixtureOracle === true)
  return verifierAllowed && verification.graphCoverage === 'complete' && verification.revisionCoverage === 'complete'
    && verification.missingDirectiveScopeIds.length === 0 && currentRequiredDirective(directive)
    && assessmentAgrees(directive, assessment) && LOCAL_DEFAULT_ACTIONS.has(directive.actionType)
    && (directive.effect === 'local_change' || directive.effect === 'physical_action')
    && !OBVIOUS_EXTERNAL_SURFACE.test(`${directive.action.surface}${directive.object.surface}`)
}

function evidenceFor(scopeIds: string[], scopeMap: Map<string, ImmutableScope>): DerivedEvidence[] {
  return scopeIds.map((scopeId) => {
    const scope = scopeMap.get(scopeId)
    if (!scope) throw new Error('COMPOSER_SCOPE_MISSING_AFTER_VALIDATION')
    return { scopeId, start: scope.start, end: scope.end, quote: scope.text }
  })
}

function relationScopes(ids: string[], scopeMap: Map<string, ImmutableScope>): string[] {
  return [...new Set(ids)].sort((left, right) => (scopeMap.get(left)?.order ?? 0) - (scopeMap.get(right)?.order ?? 0))
}

export async function composeScopeReferenceCandidate(index: ImmutableScopeIndex, candidate: ScopeReferenceCandidate, verification: ScopeReferenceVerification, options: ComposeScopeReferenceOptions = {}): Promise<{ ok: true; value: ScopeReferenceComposition; issues: [] } | { ok: false; value: null; issues: ScopeReferenceIssue[] }> {
  const candidateValidation = validateScopeReferenceCandidate(candidate, index)
  if (!candidateValidation.valid) return { ok: false, value: null, issues: candidateValidation.issues }
  const verificationValidation = await validateScopeReferenceVerification(verification, index, candidate)
  if (!verificationValidation.valid) return { ok: false, value: null, issues: verificationValidation.issues }
  const scopeMap = new Map(index.scopes.map((scope) => [scope.id, scope]))
  const assessmentMap = new Map(verification.assessments.map((assessment) => [assessment.directiveId, assessment]))
  const observationAssessmentMap = new Map(verification.observationAssessments.map((assessment) => [assessment.observationId, assessment]))
  const suggestions: DerivedSuggestion[] = []
  const observations: DerivedObservation[] = []
  const relations: DerivedRelation[] = []
  for (const directive of candidate.directives) {
    const assessment = assessmentMap.get(directive.id)
    if (!assessment) throw new Error('COMPOSER_ASSESSMENT_MISSING_AFTER_VALIDATION')
    const actionSpan = resolveSurface(directive.action, scopeMap, `compose.${directive.id}.action`, [])
    const objectSpan = resolveSurface(directive.object, scopeMap, `compose.${directive.id}.object`, [])
    if (!actionSpan || !objectSpan) throw new Error('COMPOSER_SURFACE_MISSING_AFTER_VALIDATION')
    const currentSuggestion = (directive.semantics.actor === 'addressee' || directive.semantics.actor === 'addressed_group')
      && directive.semantics.speechAct === 'directive' && directive.semantics.polarity === 'affirmative'
      && (directive.semantics.tense === 'present' || directive.semantics.tense === 'future')
      && directive.semantics.status === 'pending' && directive.semantics.validity === 'active'
      && directive.semantics.modality !== 'informational'
    const selected = defaultEligible(directive, assessment, verification, options)
    const taskId = `task:${directive.id}`
    const timeRefs = directive.timeRefs.map((reference, indexValue) => {
      const span = resolveSurface(reference, scopeMap, `compose.${directive.id}.timeRefs[${indexValue}]`, [])
      if (!span) throw new Error('COMPOSER_TIME_SURFACE_MISSING_AFTER_VALIDATION')
      const id = `time:${directive.id}:${indexValue + 1}`
      relations.push({ id: `relation:${directive.id}:time:${indexValue + 1}`, type: 'task_time', fromId: taskId, toId: id,
        evidenceScopeIds: relationScopes([directive.action.scopeId, directive.object.scopeId, reference.scopeId], scopeMap) })
      return { ...reference, span }
    })
    const materialRefs = directive.materialRefs.map((reference, indexValue) => {
      const span = resolveSurface(reference, scopeMap, `compose.${directive.id}.materialRefs[${indexValue}]`, [])
      if (!span) throw new Error('COMPOSER_MATERIAL_SURFACE_MISSING_AFTER_VALIDATION')
      const id = `material:${directive.id}:${indexValue + 1}`
      relations.push({ id: `relation:${directive.id}:material:${indexValue + 1}`, type: 'task_material', fromId: taskId, toId: id,
        evidenceScopeIds: relationScopes([directive.action.scopeId, directive.object.scopeId, reference.scopeId], scopeMap) })
      return { ...reference, span }
    })
    const eventRef = directive.eventRef ? { ...directive.eventRef, span: resolveSurface(directive.eventRef, scopeMap, `compose.${directive.id}.eventRef`, []) as DerivedSpan } : null
    const locationRef = directive.locationRef ? { ...directive.locationRef, span: resolveSurface(directive.locationRef, scopeMap, `compose.${directive.id}.locationRef`, []) as DerivedSpan } : null
    if (eventRef) relations.push({ id: `relation:${directive.id}:event`, type: 'task_event', fromId: taskId, toId: `event:${directive.id}`,
      evidenceScopeIds: relationScopes([directive.action.scopeId, directive.object.scopeId, eventRef.scopeId], scopeMap) })
    if (!eventRef && locationRef) relations.push({ id: `relation:${directive.id}:location`, type: 'task_location', fromId: taskId, toId: `location:${directive.id}`,
      evidenceScopeIds: relationScopes([directive.action.scopeId, directive.object.scopeId, locationRef.scopeId], scopeMap) })
    if (eventRef && locationRef) relations.push({ id: `relation:${directive.id}:event-location`, type: 'event_location', fromId: `event:${directive.id}`, toId: `location:${directive.id}`,
      evidenceScopeIds: relationScopes([eventRef.scopeId, locationRef.scopeId], scopeMap) })
    for (const [revisionIndex, revision] of directive.revisionRefs.entries()) {
      relations.push({ id: `relation:${directive.id}:revision:${revisionIndex + 1}`, type: revision.type, fromId: taskId,
        toId: `task:${revision.targetDirectiveId}`, evidenceScopeIds: relationScopes(revision.scopeIds, scopeMap) })
    }
    if (currentSuggestion) suggestions.push({
      id: taskId, action: directive.action.surface, object: directive.object.surface, actionType: directive.actionType,
      effect: directive.effect, semantics: directive.semantics, inferenceLevel: directive.inferenceLevel,
      actionSpan, objectSpan, timeRefs, materialRefs, eventRef, locationRef,
      evidence: evidenceFor(directive.propositionScopeIds, scopeMap), selected, needsConfirmation: !selected,
    })
  }
  for (const observation of candidate.observations) {
    const assessment = observationAssessmentMap.get(observation.id)
    if (!assessment) throw new Error('COMPOSER_OBSERVATION_ASSESSMENT_MISSING_AFTER_VALIDATION')
    const agreed = assessment.verdict === 'entailed'
      && assessment.inferenceLevel === observation.inferenceLevel
      && canonicalJson(assessment.semantics) === canonicalJson(observation.semantics)
    if (!agreed) continue
    const subjectSpan = resolveSurface(observation.subject, scopeMap, `compose.${observation.id}.subject`, [])
    if (!subjectSpan) throw new Error('COMPOSER_OBSERVATION_SURFACE_MISSING_AFTER_VALIDATION')
    const observationId = `${observation.kind}:${observation.id}`
    const timeRefs = observation.timeRefs.map((reference, indexValue) => {
      const span = resolveSurface(reference, scopeMap, `compose.${observation.id}.timeRefs[${indexValue}]`, [])
      if (!span) throw new Error('COMPOSER_OBSERVATION_TIME_SURFACE_MISSING_AFTER_VALIDATION')
      if (observation.kind === 'event') relations.push({
        id: `relation:${observation.id}:time:${indexValue + 1}`, type: 'event_time', fromId: observationId,
        toId: `time:${observation.id}:${indexValue + 1}`,
        evidenceScopeIds: relationScopes([observation.subject.scopeId, reference.scopeId], scopeMap),
      })
      return { ...reference, span }
    })
    const locationRef = observation.locationRef
      ? { ...observation.locationRef, span: resolveSurface(observation.locationRef, scopeMap, `compose.${observation.id}.locationRef`, []) as DerivedSpan }
      : null
    if (observation.kind === 'event' && locationRef) relations.push({
      id: `relation:${observation.id}:location`, type: 'event_location', fromId: observationId,
      toId: `location:${observation.id}`, evidenceScopeIds: relationScopes([observation.subject.scopeId, locationRef.scopeId], scopeMap),
    })
    observations.push({
      id: observationId, kind: observation.kind, subject: observation.subject.surface,
      semantics: observation.semantics, inferenceLevel: observation.inferenceLevel, subjectSpan,
      timeRefs, locationRef, evidence: evidenceFor(observation.propositionScopeIds, scopeMap),
      selected: false, needsConfirmation: true,
    })
  }
  return { ok: true, issues: [], value: {
    schemaVersion: 'scope-reference-composition-1.0', sourceId: index.sourceId, sourceVersionId: index.sourceVersionId,
    sourceFingerprint: index.sourceFingerprint, candidateFingerprint: await scopeReferenceCandidateFingerprint(candidate),
    requiresAction: candidate.requiresAction, suggestions, observations, relations,
    generatedLocally: { offsets: true, verbatimEvidence: true, relations: true, selected: true },
  } }
}
