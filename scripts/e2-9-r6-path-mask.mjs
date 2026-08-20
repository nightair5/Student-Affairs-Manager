import { createHash, createHmac } from 'node:crypto'

export const R6_PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.4.0'
export const PATH_MASK_VERSION = 'e2-9-r6-path-mask-1.0.0'
export const REVIEWER_PACKET_SCHEMA_VERSION = 'e2.9-r6-reviewer-packet-1.0.0'
export const PRIVATE_BINDING_SCHEMA_VERSION = 'e2.9-r6-private-binding-manifest-1.0.0'
export const LABELS_SCHEMA_VERSION = 'e2.9-r6-path-masked-labels-1.0.0'

export const R6_FAILURE_CODES = Object.freeze({
  DIRECT_IDENTITY_DISCLOSURE: 'DIRECT_IDENTITY_DISCLOSURE',
  LINKABILITY_RISK: 'LINKABILITY_RISK',
  REVIEWER_PACKET_SCHEMA_VIOLATION: 'REVIEWER_PACKET_SCHEMA_VIOLATION',
  LABEL_PAYLOAD_DISCLOSURE: 'LABEL_PAYLOAD_DISCLOSURE',
  PRIVATE_BINDING_MISMATCH: 'PRIVATE_BINDING_MISMATCH',
  CHRONOLOGY_INVALID: 'CHRONOLOGY_INVALID',
  HARNESS_INTEGRATION_FAILURE: 'HARNESS_INTEGRATION_FAILURE',
})

const REVIEWER_PACKET_KEYS = Object.freeze(['schemaVersion', 'pathMaskVersion', 'rubric', 'pairs'])
const REVIEWER_PAIR_KEYS = Object.freeze(['caseAnonymousId', 'source', 'X', 'Y'])
const REVIEWER_SOURCE_KEYS = Object.freeze(['sourceType', 'sourceTitle', 'text', 'referenceTime', 'timezone'])
const LABEL_ENVELOPE_KEYS = Object.freeze([
  'schemaVersion', 'protocolVersion', 'runId', 'reviewerPacketSha256', 'labelsCompletedAt',
  'labelsSha256', 'reviewerKind', 'reviewProcessId', 'labels',
])
const LABEL_KEYS = Object.freeze([
  'caseAnonymousId', 'preferredSide', 'xMajor', 'yMajor', 'xPlanningError', 'yPlanningError', 'reason',
])
const PRIVATE_MANIFEST_KEYS = Object.freeze(['schemaVersion', 'protocolVersion', 'runId', 'reviewerPacketSha256', 'pairs'])
const PRIVATE_PAIR_KEYS = Object.freeze([
  'caseAnonymousId', 'caseId', 'XAlias', 'YAlias', 'sideXHash', 'sideYHash', 'assignmentCommitmentHash',
])

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
const LINEAGE_KEYS = new Set([
  'model', 'modelname', 'requestedmodel', 'returnedmodel', 'executionmodel', 'modelalias',
  'provider', 'providername', 'systemfingerprint', 'fingerprint', 'deploymentmodel', 'modelversion',
  'modelid', 'responsemodel', 'execution', 'requestid', 'deploymentversion', 'usage', 'tokenusage',
  'tokens', 'latency', 'latencyms', 'durationms', 'finishreason', 'transportmetadata', 'rawresponse',
  'rawresult', 'protocolattempts', 'responseheaders', 'promptversion', 'pipelineversion',
])
const LINKABILITY_KEYS = new Set([
  'sidexhash', 'sideyhash', 'assignmentcommitmenthash', 'resultsha256', 'rawoutputsha256',
])
const MODEL_IDENTITY_PATTERNS = Object.freeze([
  /deepseek[\s_-]*v4[\s_-]*(?:flash|pro)/iu,
  /deepseek\s+(?:flash|pro)/iu,
  /(?:^|[^a-z0-9])v4[\s_-]*pro(?:[^a-z0-9]|$)/iu,
  /(?:^|[^a-z0-9])flash(?:[^a-z0-9]|$)/iu,
  /fp_v4/iu,
])

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value))
}

function normalizedKey(key) {
  return key.toLowerCase().replace(/[^a-z0-9]/gu, '')
}

function throwIntegrity(code, findings = []) {
  const error = new Error(code)
  error.code = code
  error.findings = findings
  throw error
}

function assertExactKeys(value, expectedKeys, path, failureCode = R6_FAILURE_CODES.REVIEWER_PACKET_SCHEMA_VIOLATION) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throwIntegrity(failureCode, [{ path, reason: 'OBJECT_REQUIRED' }])
  }
  const actual = Object.keys(value).sort()
  const expected = [...expectedKeys].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throwIntegrity(failureCode, [{ path, reason: 'EXACT_KEYS_REQUIRED', actual, expected }])
  }
}

function projectNested(value) {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value
  if (Array.isArray(value)) return value.map(projectNested)
  if (!value || typeof value !== 'object') return null
  return Object.fromEntries(Object.entries(value).flatMap(([key, nested]) => (
    BUSINESS_NESTED_FIELDS.has(key) ? [[key, projectNested(nested)]] : []
  )))
}

export function projectReviewerBusinessResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throwIntegrity(R6_FAILURE_CODES.REVIEWER_PACKET_SCHEMA_VIOLATION, [{ path: '$.result', reason: 'OBJECT_REQUIRED' }])
  }
  return Object.fromEntries(Object.entries(result).flatMap(([key, value]) => (
    BUSINESS_TOP_LEVEL.has(key) ? [[key, projectNested(value)]] : []
  )))
}

export function scanReviewerPayload(value, { scanIdentityValues = true } = {}) {
  const findings = []
  const visit = (current, path = '$') => {
    if (typeof current === 'string') {
      if (scanIdentityValues && MODEL_IDENTITY_PATTERNS.some((pattern) => pattern.test(current))) {
        findings.push({ code: R6_FAILURE_CODES.DIRECT_IDENTITY_DISCLOSURE, path, category: 'MODEL_IDENTITY_VALUE' })
      }
      return
    }
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`))
      return
    }
    if (!current || typeof current !== 'object') return
    for (const [key, nested] of Object.entries(current)) {
      const normalized = normalizedKey(key)
      const nestedPath = `${path}.${key}`
      if (LINEAGE_KEYS.has(normalized)) {
        findings.push({ code: R6_FAILURE_CODES.DIRECT_IDENTITY_DISCLOSURE, path: nestedPath, category: 'LINEAGE_KEY' })
      }
      if (LINKABILITY_KEYS.has(normalized)) {
        findings.push({ code: R6_FAILURE_CODES.LINKABILITY_RISK, path: nestedPath, category: 'DETERMINISTIC_CORRELATOR' })
      }
      visit(nested, nestedPath)
    }
  }
  visit(value)
  return findings
}

function assertReviewerSurfaceSafe(value, failureCode = R6_FAILURE_CODES.DIRECT_IDENTITY_DISCLOSURE) {
  const findings = scanReviewerPayload(value)
  if (findings.length) {
    const code = findings.some((item) => item.code === R6_FAILURE_CODES.LINKABILITY_RISK)
      ? R6_FAILURE_CODES.LINKABILITY_RISK
      : failureCode
    throwIntegrity(code, findings)
  }
}

export function assertReviewerPacketSafe(packet) {
  assertExactKeys(packet, REVIEWER_PACKET_KEYS, '$')
  if (packet.schemaVersion !== REVIEWER_PACKET_SCHEMA_VERSION || packet.pathMaskVersion !== PATH_MASK_VERSION
    || !packet.rubric || typeof packet.rubric !== 'object' || Array.isArray(packet.rubric)
    || !Array.isArray(packet.pairs) || packet.pairs.length === 0) {
    throwIntegrity(R6_FAILURE_CODES.REVIEWER_PACKET_SCHEMA_VIOLATION, [{ path: '$', reason: 'VERSION_OR_CARDINALITY_INVALID' }])
  }
  if (new Set(packet.pairs.map((pair) => pair.caseAnonymousId)).size !== packet.pairs.length) {
    throwIntegrity(R6_FAILURE_CODES.REVIEWER_PACKET_SCHEMA_VIOLATION, [{ path: '$.pairs', reason: 'ANONYMOUS_ID_DUPLICATE' }])
  }
  assertReviewerSurfaceSafe(packet.rubric)
  for (const [index, pair] of packet.pairs.entries()) {
    assertExactKeys(pair, REVIEWER_PAIR_KEYS, `$.pairs[${index}]`)
    assertExactKeys(pair.source, REVIEWER_SOURCE_KEYS, `$.pairs[${index}].source`)
    if (!/^review-case-[0-9]{3}$/u.test(pair.caseAnonymousId)) {
      throwIntegrity(R6_FAILURE_CODES.REVIEWER_PACKET_SCHEMA_VIOLATION, [{ path: `$.pairs[${index}].caseAnonymousId`, reason: 'ANONYMOUS_ID_INVALID' }])
    }
    if (!REVIEWER_SOURCE_KEYS.every((key) => typeof pair.source[key] === 'string')
      || !pair.X || typeof pair.X !== 'object' || Array.isArray(pair.X)
      || !pair.Y || typeof pair.Y !== 'object' || Array.isArray(pair.Y)) {
      throwIntegrity(R6_FAILURE_CODES.REVIEWER_PACKET_SCHEMA_VIOLATION, [{ path: `$.pairs[${index}]`, reason: 'SOURCE_OR_RESULT_TYPE_INVALID' }])
    }
    const sourceFindings = scanReviewerPayload(pair.source, { scanIdentityValues: false })
    if (sourceFindings.length) throwIntegrity(R6_FAILURE_CODES.LINKABILITY_RISK, sourceFindings)
    assertReviewerSurfaceSafe({ X: pair.X, Y: pair.Y })
  }
  return {
    packetSafe: true,
    directIdentityDisclosures: 0,
    deterministicCorrelators: 0,
    privateBindingsVisible: false,
  }
}

function hmac(revealSecret, fields) {
  if (typeof revealSecret !== 'string' || revealSecret.length < 64) throw new Error('PATH_MASK_REVEAL_SECRET_INVALID')
  return createHmac('sha256', revealSecret).update(fields.join('\0'), 'utf8').digest('hex')
}

export function deriveSideAssignment({ revealSecret, runId, caseId }) {
  const byte = Number.parseInt(hmac(revealSecret, ['R6_SIDE_ASSIGNMENT', runId, caseId]).slice(0, 2), 16)
  return byte % 2 === 0 ? { X: 'flash', Y: 'pro' } : { X: 'pro', Y: 'flash' }
}

export function assignmentCommitment({ revealSecret, runId, anonymousCaseId, caseId, assignment }) {
  return hmac(revealSecret, ['R6_ASSIGNMENT_COMMITMENT', runId, anonymousCaseId, caseId, assignment.X, assignment.Y])
}

export function buildSeparatedPairArtifacts({ revealSecret, runId, anonymousCaseId, caseId, source, resultsByAlias }) {
  const assignment = deriveSideAssignment({ revealSecret, runId, caseId })
  if (!resultsByAlias?.flash || !resultsByAlias?.pro) throw new Error('PAIR_ARM_MISSING')
  const X = projectReviewerBusinessResult(resultsByAlias[assignment.X])
  const Y = projectReviewerBusinessResult(resultsByAlias[assignment.Y])
  const reviewerPair = {
    caseAnonymousId: anonymousCaseId,
    source: {
      sourceType: source.sourceType,
      sourceTitle: source.sourceTitle,
      text: source.content,
      referenceTime: source.referenceTime,
      timezone: source.timezone,
    },
    X,
    Y,
  }
  const privateBinding = {
    caseAnonymousId: anonymousCaseId,
    caseId,
    XAlias: assignment.X,
    YAlias: assignment.Y,
    sideXHash: sha256(canonicalJson(X)),
    sideYHash: sha256(canonicalJson(Y)),
    assignmentCommitmentHash: assignmentCommitment({ revealSecret, runId, anonymousCaseId, caseId, assignment }),
  }
  return { reviewerPair, privateBinding }
}

export function buildReviewerPacket({ rubric, reviewerPairs }) {
  const packet = {
    schemaVersion: REVIEWER_PACKET_SCHEMA_VERSION,
    pathMaskVersion: PATH_MASK_VERSION,
    rubric,
    pairs: reviewerPairs,
  }
  assertReviewerPacketSafe(packet)
  return packet
}

export function buildPrivateBindingManifest({ protocolVersion, runId, reviewerPacket, privateBindings }) {
  assertReviewerPacketSafe(reviewerPacket)
  const manifest = {
    schemaVersion: PRIVATE_BINDING_SCHEMA_VERSION,
    protocolVersion,
    runId,
    reviewerPacketSha256: sha256(canonicalJson(reviewerPacket)),
    pairs: privateBindings,
  }
  assertPrivateBindingManifestShape(manifest, reviewerPacket.pairs.length)
  return manifest
}

function assertPrivateBindingManifestShape(manifest, expectedPairs) {
  assertExactKeys(manifest, PRIVATE_MANIFEST_KEYS, '$.privateManifest', R6_FAILURE_CODES.PRIVATE_BINDING_MISMATCH)
  if (manifest.schemaVersion !== PRIVATE_BINDING_SCHEMA_VERSION || typeof manifest.protocolVersion !== 'string'
    || typeof manifest.runId !== 'string' || !/^[a-f0-9]{64}$/u.test(manifest.reviewerPacketSha256)
    || !Array.isArray(manifest.pairs) || manifest.pairs.length !== expectedPairs) {
    throwIntegrity(R6_FAILURE_CODES.PRIVATE_BINDING_MISMATCH, [{ path: '$.privateManifest', reason: 'PRIVATE_MANIFEST_SHAPE_INVALID' }])
  }
  const anonymousIds = []
  for (const [index, binding] of manifest.pairs.entries()) {
    assertExactKeys(binding, PRIVATE_PAIR_KEYS, `$.privateManifest.pairs[${index}]`, R6_FAILURE_CODES.PRIVATE_BINDING_MISMATCH)
    anonymousIds.push(binding.caseAnonymousId)
    if (typeof binding.caseAnonymousId !== 'string' || typeof binding.caseId !== 'string'
      || !['flash', 'pro'].includes(binding.XAlias) || !['flash', 'pro'].includes(binding.YAlias)
      || binding.XAlias === binding.YAlias
      || !['sideXHash', 'sideYHash', 'assignmentCommitmentHash'].every((field) => /^[a-f0-9]{64}$/u.test(binding[field]))) {
      throwIntegrity(R6_FAILURE_CODES.PRIVATE_BINDING_MISMATCH, [{ path: `$.privateManifest.pairs[${index}]`, reason: 'PRIVATE_PAIR_SHAPE_INVALID' }])
    }
  }
  if (new Set(anonymousIds).size !== anonymousIds.length) {
    throwIntegrity(R6_FAILURE_CODES.PRIVATE_BINDING_MISMATCH, [{ path: '$.privateManifest.pairs', reason: 'PRIVATE_ANONYMOUS_ID_DUPLICATE' }])
  }
}

export function buildLabelsEnvelope({ protocolVersion, runId, reviewerPacket, labelsCompletedAt, reviewerKind, reviewProcessId, labels }) {
  const labelsSha256 = sha256(canonicalJson(labels))
  const envelope = {
    schemaVersion: LABELS_SCHEMA_VERSION,
    protocolVersion,
    runId,
    reviewerPacketSha256: sha256(canonicalJson(reviewerPacket)),
    labelsCompletedAt,
    labelsSha256,
    reviewerKind,
    reviewProcessId,
    labels,
  }
  validateLabelsEnvelope(envelope, { protocolVersion, runId, reviewerPacket })
  return envelope
}

export function validateLabelsEnvelope(envelope, { protocolVersion, runId, reviewerPacket }) {
  assertExactKeys(envelope, LABEL_ENVELOPE_KEYS, '$')
  if (envelope.schemaVersion !== LABELS_SCHEMA_VERSION || envelope.protocolVersion !== protocolVersion
    || envelope.runId !== runId || envelope.reviewerPacketSha256 !== sha256(canonicalJson(reviewerPacket))
    || envelope.labelsSha256 !== sha256(canonicalJson(envelope.labels)) || !Number.isFinite(Date.parse(envelope.labelsCompletedAt))
    || envelope.reviewerKind !== 'independent_fresh_read_only' || typeof envelope.reviewProcessId !== 'string'
    || envelope.reviewProcessId.length < 8 || !Array.isArray(envelope.labels)) {
    throwIntegrity(R6_FAILURE_CODES.REVIEWER_PACKET_SCHEMA_VIOLATION, [{ path: '$', reason: 'LABEL_ENVELOPE_BINDING_INVALID' }])
  }
  const expectedIds = reviewerPacket.pairs.map((pair) => pair.caseAnonymousId).sort()
  const actualIds = envelope.labels.map((label) => label.caseAnonymousId).sort()
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds) || new Set(actualIds).size !== expectedIds.length) {
    throwIntegrity(R6_FAILURE_CODES.REVIEWER_PACKET_SCHEMA_VIOLATION, [{ path: '$.labels', reason: 'LABEL_COVERAGE_INVALID' }])
  }
  for (const [index, label] of envelope.labels.entries()) {
    assertExactKeys(label, LABEL_KEYS, `$.labels[${index}]`)
    if (!['X', 'Y', 'TIE', 'INSUFFICIENT_INFORMATION'].includes(label.preferredSide)
      || !['xMajor', 'yMajor', 'xPlanningError', 'yPlanningError'].every((field) => typeof label[field] === 'boolean')
      || typeof label.reason !== 'string' || label.reason.length < 8) {
      throwIntegrity(R6_FAILURE_CODES.REVIEWER_PACKET_SCHEMA_VIOLATION, [{ path: `$.labels[${index}]`, reason: 'LABEL_VALUE_INVALID' }])
    }
  }
  const findings = scanReviewerPayload(envelope.labels)
  if (findings.length) throwIntegrity(R6_FAILURE_CODES.LABEL_PAYLOAD_DISCLOSURE, findings)
  return { labelsValid: true, protocolMetadataExcludedFromLeakScan: true }
}

export function revealSeparatedBindings({ revealSecret, protocolVersion, runId, reviewerPacket, privateManifest, labelsEnvelope, keyRevealedAt }) {
  assertReviewerPacketSafe(reviewerPacket)
  validateLabelsEnvelope(labelsEnvelope, { protocolVersion, runId, reviewerPacket })
  if (!Number.isFinite(Date.parse(keyRevealedAt)) || Date.parse(labelsEnvelope.labelsCompletedAt) >= Date.parse(keyRevealedAt)) {
    throwIntegrity(R6_FAILURE_CODES.CHRONOLOGY_INVALID, [{ path: '$.keyRevealedAt', reason: 'REVEAL_MUST_FOLLOW_LABEL_FREEZE' }])
  }
  const packetSha256 = sha256(canonicalJson(reviewerPacket))
  assertPrivateBindingManifestShape(privateManifest, reviewerPacket.pairs.length)
  if (privateManifest.protocolVersion !== protocolVersion
    || privateManifest.runId !== runId || privateManifest.reviewerPacketSha256 !== packetSha256
    || !Array.isArray(privateManifest.pairs) || privateManifest.pairs.length !== reviewerPacket.pairs.length) {
    throwIntegrity(R6_FAILURE_CODES.PRIVATE_BINDING_MISMATCH, [{ path: '$.privateManifest', reason: 'PRIVATE_MANIFEST_BINDING_INVALID' }])
  }
  const mappings = privateManifest.pairs.map((binding, index) => {
    const reviewerPair = reviewerPacket.pairs[index]
    const assignment = deriveSideAssignment({ revealSecret, runId, caseId: binding.caseId })
    const expectedCommitment = assignmentCommitment({ revealSecret, runId, anonymousCaseId: binding.caseAnonymousId, caseId: binding.caseId, assignment })
    const valid = binding.caseAnonymousId === reviewerPair.caseAnonymousId
      && binding.XAlias === assignment.X && binding.YAlias === assignment.Y
      && binding.sideXHash === sha256(canonicalJson(reviewerPair.X))
      && binding.sideYHash === sha256(canonicalJson(reviewerPair.Y))
      && binding.assignmentCommitmentHash === expectedCommitment
    if (!valid) throwIntegrity(R6_FAILURE_CODES.PRIVATE_BINDING_MISMATCH, [{ path: `$.privateManifest.pairs[${index}]`, reason: 'PAIR_BINDING_INVALID' }])
    return { caseAnonymousId: binding.caseAnonymousId, caseId: binding.caseId, X: assignment.X, Y: assignment.Y }
  })
  return {
    schemaVersion: 'e2.9-r6-reveal-result-1.0.0',
    protocolVersion,
    runId,
    reviewerPacketSha256: packetSha256,
    labelsSha256: labelsEnvelope.labelsSha256,
    labelsCompletedAt: labelsEnvelope.labelsCompletedAt,
    keyRevealedAt,
    mappings,
    status: 'REVEALED_FOR_SYNTHETIC_SCORING',
  }
}
