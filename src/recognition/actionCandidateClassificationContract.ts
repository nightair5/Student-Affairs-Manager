import type { LocalActionCandidateCatalog } from './localActionCandidateIndex'
import type { ModelAnchorSelection } from './modelAnchorSelectionContract'

export const ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION = 'action-candidate-classification-1.0.0' as const

export type ActionCandidateVerdict = 'proposition' | 'mention_only' | 'uncertain'

export interface ActionCandidateClassification {
  candidateId: string
  verdict: ActionCandidateVerdict
  objectCandidateId: string | null
}

export interface ActionCandidateClassificationResponse {
  schemaVersion: typeof ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION
  sourceId: string
  sourceVersionId: string
  sourceFingerprint: string
  catalogFingerprint: string
  producerRunId: string
  classifications: ActionCandidateClassification[]
}

export interface ActionCandidateClassificationIssue {
  code: string
  path: string
  candidateId?: string
}

export interface ActionCandidateClassificationValidation {
  valid: boolean
  rootUsable: boolean
  completeness: 'complete' | 'partial' | 'rejected_global'
  globalIssues: ActionCandidateClassificationIssue[]
  candidateIssues: ActionCandidateClassificationIssue[]
  validClassifications: Map<string, ActionCandidateClassification>
}

export interface LegacySelectionProjection {
  response: ActionCandidateClassificationResponse
  unmatchedLegacyDirectiveIds: string[]
  missingLegacyCandidateIds: string[]
  ambiguousCandidateIds: string[]
}

const VERDICTS: ActionCandidateVerdict[] = ['proposition', 'mention_only', 'uncertain']
const ROOT_FIELDS = ['schemaVersion', 'sourceId', 'sourceVersionId', 'sourceFingerprint', 'catalogFingerprint', 'producerRunId', 'classifications'] as const
const CLASSIFICATION_FIELDS = ['candidateId', 'verdict', 'objectCandidateId'] as const

function keys(value: object): string { return Object.keys(value).sort().join('|') }
function exactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && keys(value as object) === [...expected].sort().join('|'))
}

export function buildActionCandidateClassificationJsonSchema(catalog: LocalActionCandidateCatalog) {
  const classifications = catalog.candidates.length === 0
    ? { type: 'array', const: [] }
    : {
        type: 'array',
        minItems: catalog.candidates.length,
        maxItems: catalog.candidates.length,
        items: {
          oneOf: catalog.candidates.map((candidate) => ({
            type: 'object',
            additionalProperties: false,
            required: [...CLASSIFICATION_FIELDS],
            properties: {
              candidateId: { const: candidate.id },
              verdict: { enum: VERDICTS },
              objectCandidateId: candidate.objectCandidates.length > 0
                ? { anyOf: [{ type: 'null' }, { enum: candidate.objectCandidates.map((item) => item.id) }] }
                : { type: 'null' },
            },
          })),
        },
      }
  return {
    type: 'object',
    additionalProperties: false,
    required: [...ROOT_FIELDS],
    properties: {
      schemaVersion: { const: ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION },
      sourceId: { const: catalog.sourceId },
      sourceVersionId: { const: catalog.sourceVersionId },
      sourceFingerprint: { const: catalog.sourceFingerprint },
      catalogFingerprint: { const: catalog.catalogFingerprint },
      producerRunId: { type: 'string', minLength: 1, maxLength: 160 },
      classifications,
    },
  } as const
}

export function validateActionCandidateClassification(
  value: unknown,
  catalog: LocalActionCandidateCatalog,
  expectedProducerRunId?: string,
): ActionCandidateClassificationValidation {
  const globalIssues: ActionCandidateClassificationIssue[] = []
  const candidateIssues: ActionCandidateClassificationIssue[] = []
  const validClassifications = new Map<string, ActionCandidateClassification>()
  const finish = (): ActionCandidateClassificationValidation => {
    const rootUsable = globalIssues.length === 0
    if (!rootUsable) validClassifications.clear()
    const completeness = !rootUsable ? 'rejected_global' : candidateIssues.length > 0 ? 'partial' : 'complete'
    return {
      valid: completeness === 'complete',
      rootUsable,
      completeness,
      globalIssues,
      candidateIssues,
      validClassifications,
    }
  }

  if (!exactKeys(value, ROOT_FIELDS)) {
    globalIssues.push({ code: 'ROOT_KEYS_INVALID', path: 'response' })
    return finish()
  }
  const response = value as Record<string, unknown>
  if (response.schemaVersion !== ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION) globalIssues.push({ code: 'SCHEMA_VERSION_INVALID', path: 'schemaVersion' })
  if (response.sourceId !== catalog.sourceId || response.sourceVersionId !== catalog.sourceVersionId || response.sourceFingerprint !== catalog.sourceFingerprint) {
    globalIssues.push({ code: 'SOURCE_BINDING_MISMATCH', path: 'sourceId' })
  }
  if (response.catalogFingerprint !== catalog.catalogFingerprint) globalIssues.push({ code: 'CATALOG_FINGERPRINT_MISMATCH', path: 'catalogFingerprint' })
  if (typeof response.producerRunId !== 'string' || response.producerRunId.length < 1 || response.producerRunId.length > 160
    || expectedProducerRunId !== undefined && response.producerRunId !== expectedProducerRunId) {
    globalIssues.push({ code: 'PRODUCER_RUN_ID_MISMATCH', path: 'producerRunId' })
  }
  if (!Array.isArray(response.classifications)) {
    globalIssues.push({ code: 'CLASSIFICATIONS_NOT_ARRAY', path: 'classifications' })
    return finish()
  }

  const candidates = new Map(catalog.candidates.map((candidate) => [candidate.id, candidate]))
  const occurrences = new Map<string, number[]>()
  response.classifications.forEach((raw, position) => {
    const path = 'classifications[' + position + ']'
    if (!exactKeys(raw, CLASSIFICATION_FIELDS)) {
      const candidateId = raw && typeof raw === 'object' && !Array.isArray(raw) && typeof (raw as Record<string, unknown>).candidateId === 'string'
        ? String((raw as Record<string, unknown>).candidateId)
        : undefined
      candidateIssues.push({ code: 'CLASSIFICATION_KEYS_INVALID', path, candidateId })
      if (candidateId) {
        const positions = occurrences.get(candidateId) ?? []
        positions.push(position)
        occurrences.set(candidateId, positions)
      }
      return
    }
    const candidateId = typeof raw.candidateId === 'string' ? raw.candidateId : ''
    const positions = occurrences.get(candidateId) ?? []
    positions.push(position)
    occurrences.set(candidateId, positions)
    const candidate = candidates.get(candidateId)
    if (!candidate) {
      candidateIssues.push({ code: 'UNKNOWN_CANDIDATE_ID', path: path + '.candidateId', candidateId })
      return
    }
    if (typeof raw.verdict !== 'string' || !VERDICTS.includes(raw.verdict as ActionCandidateVerdict)) {
      candidateIssues.push({ code: 'VERDICT_INVALID', path: path + '.verdict', candidateId })
      return
    }
    const verdict = raw.verdict as ActionCandidateVerdict
    const objectIds = new Set(candidate.objectCandidates.map((item) => item.id))
    if (verdict === 'proposition') {
      if (typeof raw.objectCandidateId !== 'string' || !objectIds.has(raw.objectCandidateId)) {
        candidateIssues.push({ code: 'OBJECT_CANDIDATE_INVALID', path: path + '.objectCandidateId', candidateId })
      }
    } else if (raw.objectCandidateId !== null) {
      candidateIssues.push({ code: 'NON_PROPOSITION_OBJECT_MUST_BE_NULL', path: path + '.objectCandidateId', candidateId })
    }
  })

  for (const candidate of catalog.candidates) {
    const positions = occurrences.get(candidate.id) ?? []
    if (positions.length === 0) candidateIssues.push({ code: 'CANDIDATE_CLASSIFICATION_MISSING', path: 'classifications', candidateId: candidate.id })
    if (positions.length > 1) candidateIssues.push({ code: 'CANDIDATE_CLASSIFICATION_DUPLICATE', path: 'classifications', candidateId: candidate.id })
  }

  response.classifications.forEach((raw) => {
    if (!exactKeys(raw, CLASSIFICATION_FIELDS) || typeof raw.candidateId !== 'string') return
    if ((occurrences.get(raw.candidateId)?.length ?? 0) !== 1) return
    if (candidateIssues.some((issue) => issue.candidateId === raw.candidateId)) return
    if (!candidates.has(raw.candidateId) || typeof raw.verdict !== 'string' || !VERDICTS.includes(raw.verdict as ActionCandidateVerdict)) return
    validClassifications.set(raw.candidateId, raw as unknown as ActionCandidateClassification)
  })
  return finish()
}

export function projectLegacySelectionToCandidateClassifications(
  selection: ModelAnchorSelection,
  catalog: LocalActionCandidateCatalog,
  producerRunId: string,
): LegacySelectionProjection {
  const matchedDirectiveIds = new Set<string>()
  const missingLegacyCandidateIds: string[] = []
  const ambiguousCandidateIds: string[] = []
  const classifications = catalog.candidates.map((candidate): ActionCandidateClassification => {
    const matches = selection.directives.filter((directive) => {
      if (directive.action.scopeId !== candidate.scopeId || !directive.action.surface.includes(candidate.action.surface)) return false
      return candidate.objectCandidates.some((object) => object.scopeId === directive.object.scopeId && object.surface === directive.object.surface)
    })
    if (matches.length !== 1) {
      if (matches.length > 1) ambiguousCandidateIds.push(candidate.id)
      else missingLegacyCandidateIds.push(candidate.id)
      return { candidateId: candidate.id, verdict: 'uncertain', objectCandidateId: null }
    }
    matchedDirectiveIds.add(matches[0].id)
    const object = candidate.objectCandidates.find((item) => item.scopeId === matches[0].object.scopeId && item.surface === matches[0].object.surface)
    return object
      ? { candidateId: candidate.id, verdict: 'proposition', objectCandidateId: object.id }
      : { candidateId: candidate.id, verdict: 'uncertain', objectCandidateId: null }
  })
  return {
    response: {
      schemaVersion: ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
      sourceId: catalog.sourceId,
      sourceVersionId: catalog.sourceVersionId,
      sourceFingerprint: catalog.sourceFingerprint,
      catalogFingerprint: catalog.catalogFingerprint,
      producerRunId,
      classifications,
    },
    unmatchedLegacyDirectiveIds: selection.directives.filter((directive) => !matchedDirectiveIds.has(directive.id)).map((directive) => directive.id),
    missingLegacyCandidateIds,
    ambiguousCandidateIds,
  }
}
