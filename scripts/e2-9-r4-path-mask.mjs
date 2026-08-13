import { createHash } from 'node:crypto'

export const PATH_MASK_VERSION = 'e2-9-r4-path-mask-3.2.0'
export const PACKET_SCHEMA_VERSION = 'e2.9-r4-adjudication-packet-3.2.0'
export const COMMITMENT_VERSION = 'e2-9-r4-assignment-commitment-1.0.0'
export const CHRONOLOGY_VERSION = 'e2-9-r4-adjudication-chronology-1.0.0'

export const MODEL_LINEAGE_SENSITIVE_FIELD_REGISTRY = Object.freeze([
  'model', 'modelName', 'requestedModel', 'returnedModel', 'executionModel', 'modelAlias',
  'provider', 'providerName', 'systemFingerprint', 'system_fingerprint', 'fingerprint',
  'deploymentModel', 'modelVersion', 'modelId', 'model_id', 'responseModel',
  'execution', 'requestId', 'deploymentVersion', 'usage', 'tokenUsage', 'tokens', 'latency',
  'latencyMs', 'durationMs', 'finishReason', 'transportMetadata', 'rawResponse', 'rawResult',
  'protocolAttempts', 'responseHeaders', 'promptVersion', 'pipelineVersion',
])

const SENSITIVE_KEYS = new Set(MODEL_LINEAGE_SENSITIVE_FIELD_REGISTRY.map((key) => key.toLowerCase().replace(/[^a-z0-9]/gu, '')))
const BUSINESS_TOP_LEVEL = new Set([
  'sourceSummary', 'projectMatch', 'projectSuggestion', 'milestones', 'standaloneTasks',
  'materials', 'timePoints', 'events', 'ambiguities', 'conflicts', 'evidence', 'ignoredContent', 'quality',
])
const BUSINESS_NESTED_FIELDS = new Set([
  'title', 'sourceType', 'notificationType', 'summary', 'requiresAction', 'actionReason',
  'decision', 'matchedProjectId', 'matchedProjectTitle', 'suggestedProjectTitle', 'reason', 'confidence',
  'value', 'inferenceLevel', 'evidenceIds', 'category', 'objective', 'description', 'tempId', 'order',
  'workPackages', 'tasks', 'actionVerb', 'actionObject', 'taskType', 'estimatedMinutes', 'priority',
  'relatedTaskTempIds', 'materialTempIds', 'timePointTempIds', 'eventTempIds', 'selected', 'name',
  'required', 'formatRequirements', 'namingRequirements', 'quantity', 'submissionChannel', 'type',
  'rawText', 'normalizedValue', 'timezone', 'isAllDay', 'precision', 'needsConfirmation',
  'relatedMaterialTempIds', 'startTimePointTempId', 'endTimePointTempId', 'location', 'id', 'sourceId',
  'quote', 'quotedText', 'field', 'extractionMethod', 'message', 'entityTempIds', 'requiresDecision',
  'options', 'text', 'overallConfidence', 'hierarchyConfidence', 'dateConfidence', 'evidenceCoverage',
  'evidenceValidity', 'duplicateRisk', 'overFragmentationRisk', 'missingActionRisk', 'needsHumanReview',
  'reviewReasons', 'issueCodes', 'code', 'severity', 'ignoredContent',
])
const FORBIDDEN_VALUE_PATTERNS = Object.freeze([
  /deepseek[\s_-]*v4[\s_-]*flash/iu,
  /deepseek[\s_-]*v4[\s_-]*pro/iu,
  /deepseek\s+(?:flash|pro)/iu,
  /(?:^|[^a-z0-9])v4[\s_-]*pro(?:[^a-z0-9]|$)/iu,
  /(?:^|[^a-z0-9])v4pro(?:[^a-z0-9]|$)/iu,
  /(?:^|[^a-z0-9])flash(?:[^a-z0-9]|$)/iu,
  /fp_v4/iu,
])

function hash(value) { return createHash('sha256').update(value, 'utf8').digest('hex') }
function normalizedKey(key) { return key.toLowerCase().replace(/[^a-z0-9]/gu, '') }
function sanitizedPreview(value) {
  return String(value).replace(/deepseek[^\s"']*|fp_v4[^\s"']*|v4[\s_-]*pro|flash/giu, '[REDACTED_LINEAGE]').slice(0, 80)
}

export function scanPathMaskedPacket(value) {
  const leaks = []
  const visit = (current, path = '$') => {
    if (typeof current === 'string') {
      if (FORBIDDEN_VALUE_PATTERNS.some((pattern) => pattern.test(current))) leaks.push({ path, category: 'FORBIDDEN_VALUE', preview: sanitizedPreview(current) })
      return
    }
    if (Array.isArray(current)) return current.forEach((item, index) => visit(item, `${path}[${index}]`))
    if (!current || typeof current !== 'object') return
    for (const [key, nested] of Object.entries(current)) {
      const nestedPath = `${path}.${key}`
      const normalized = normalizedKey(key)
      if (SENSITIVE_KEYS.has(normalized)) leaks.push({ path: nestedPath, category: /usage|token|latency|duration|finish|attempt|header/iu.test(key) ? 'PERFORMANCE_KEY' : 'FORBIDDEN_KEY', preview: sanitizedPreview(key) })
      visit(nested, nestedPath)
    }
  }
  visit(value)
  return leaks
}

export function assertPathMaskedPacketSafe(packet) {
  const leaks = scanPathMaskedPacket(packet)
  if (leaks.length) {
    const error = new Error('PATH_MASKING_LEAK_DETECTED')
    error.leaks = leaks
    throw error
  }
  return { packetSafe: true, forbiddenFields: 0, forbiddenValues: 0, modelIdentityLeaks: 0, performanceLeaks: 0 }
}

function projectNested(value) {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value
  if (Array.isArray(value)) return value.map(projectNested)
  if (!value || typeof value !== 'object') return null
  return Object.fromEntries(Object.entries(value).flatMap(([key, nested]) => BUSINESS_NESTED_FIELDS.has(key) ? [[key, projectNested(nested)]] : []))
}

export function projectBusinessResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('PATH_MASK_SOURCE_RESULT_INVALID')
  const projected = Object.fromEntries(Object.entries(result).flatMap(([key, value]) => BUSINESS_TOP_LEVEL.has(key) ? [[key, projectNested(value)]] : []))
  assertPathMaskedPacketSafe(projected)
  return projected
}

export function deriveSideAssignment({ revealSecret, runId, caseId }) {
  if (typeof revealSecret !== 'string' || revealSecret.length < 64) throw new Error('PATH_MASK_REVEAL_SECRET_INVALID')
  return Number.parseInt(hash(`${COMMITMENT_VERSION}\0${revealSecret}\0${runId}\0${caseId}`).slice(0, 2), 16) % 2 === 0
    ? { X: 'flash', Y: 'pro' }
    : { X: 'pro', Y: 'flash' }
}

export function assignmentCommitment({ revealSecret, runId, anonymousCaseId, caseId, assignment }) {
  return hash([COMMITMENT_VERSION, revealSecret, runId, anonymousCaseId, caseId, assignment.X, assignment.Y].join('\0'))
}

export function buildPathMaskedPair({ revealSecret, runId, anonymousCaseId, caseId, source, resultsByAlias }) {
  const assignment = deriveSideAssignment({ revealSecret, runId, caseId })
  const X = projectBusinessResult(resultsByAlias[assignment.X])
  const Y = projectBusinessResult(resultsByAlias[assignment.Y])
  const pair = {
    caseAnonymousId: anonymousCaseId,
    source: { sourceType: source.sourceType, sourceTitle: source.sourceTitle, text: source.content, referenceTime: source.referenceTime, timezone: source.timezone },
    X, Y,
    sideXHash: hash(JSON.stringify(X)),
    sideYHash: hash(JSON.stringify(Y)),
    assignmentCommitmentHash: assignmentCommitment({ revealSecret, runId, anonymousCaseId, caseId, assignment }),
  }
  assertPathMaskedPacketSafe(pair)
  return pair
}

export function verifyRevealChronology(labelsCompletedAt, keyRevealedAt) {
  if (!Number.isFinite(Date.parse(labelsCompletedAt)) || !Number.isFinite(Date.parse(keyRevealedAt)) || Date.parse(labelsCompletedAt) >= Date.parse(keyRevealedAt)) throw new Error('ADJUDICATION_CHRONOLOGY_INVALID')
  return true
}

export function syntheticAssignmentBalance(revealSecret, count = 100) {
  const assignments = Array.from({ length: count }, (_, index) => deriveSideAssignment({ revealSecret, runId: 'synthetic-r4', caseId: `synthetic-${index + 1}` }).X)
  return { flashOnX: assignments.filter((side) => side === 'flash').length, proOnX: assignments.filter((side) => side === 'pro').length }
}
