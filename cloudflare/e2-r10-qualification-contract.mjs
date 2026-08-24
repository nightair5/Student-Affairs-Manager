export const E2_R10_PROTOCOL_VERSION = 'e2-9-r10-facts-first-protocol-1.1.0'
export const E2_R10_QUALIFICATION_VERSION = 'e2-9-r10-zero-model-qualification-1.1.0'
export const E2_R10_CONTRACT_SCHEMA_VERSION = 'e2.9-r10-qualification-contract-1.2.0'
export const E2_R10_RESULT_SCHEMA_VERSION = E2_R10_QUALIFICATION_VERSION
export const E2_R10_REGISTRATION_SCHEMA_VERSION = 'e2.9-r10-qualification-registration-1.1.0'
export const E2_R10_DEPLOYMENT_EVIDENCE_SCHEMA_VERSION = 'e2.9-r10-deployment-evidence-1.0.0'

export const E2_R10_ENDPOINT_PREFIX = '/api/experiments/e2-9/r10/qualification/'

export const E2_R10_REQUIRED_COMPONENT_VERSIONS = Object.freeze({
  factLedger: 'e2-r10-fact-ledger-contract-1.1.0',
  bridge: 'e2-r10-ledger-planner-bridge-1.1.0',
  planner: 'e2-r10-isolated-planner-1.1.0',
  validator: 'e2-r10-ledger-plan-validator-1.1.0',
  qualification: E2_R10_QUALIFICATION_VERSION,
  qualificationContract: E2_R10_CONTRACT_SCHEMA_VERSION,
  qualificationWorker: 'e2-r10-qualification-worker-1.1.0',
  qualificationLedger: 'e2-r10-qualification-ledger-1.1.0',
  protocol: E2_R10_PROTOCOL_VERSION,
})

export const E2_R10_REQUIRED_CHECK_NAMES = Object.freeze([
  'sourceCommitFull',
  'sourceTreeBound',
  'sourceManifestBound',
  'sourceWorktreeClean',
  'protocolFilesTracked',
  'protocolBundleBound',
  'productionDependencyManifestBound',
  'factLedgerValidated',
  'bridgeStripsSourceText',
  'bridgeHasNoSemanticPermission',
  'plannerValidated',
  'validatorNoIssue',
  'pureInformationHasZeroTask',
  'informationalFactPreserved',
  'optionalTaskIsUnselected',
  'prohibitedFactIsNotTask',
  'unsupportedTimeRoleNotForged',
  'evidenceSpansPreserved',
  'serverModelIdentityInjected',
  'qualificationProviderModuleAbsent',
  'laterModelStagesLocked',
  'accessCountersInstrumented',
  'qualificationWorkerPreviewNameCompatible',
  'qualificationWorkerRouteIsolated',
  'qualificationLedgerPrivate',
  'ledgerCallerAuthenticationEnforced',
  'registrationFailurePathValidated',
  'deploymentEvidenceSchemaValidated',
])

const LOCKED_STAGES = Object.freeze([
  'readiness',
  'smoke',
  'screening',
  'selection',
  'blind',
  'production',
])

const NEXT_STAGE_FIELDS = LOCKED_STAGES

const ACCESS_COUNTER_FIELDS = Object.freeze([
  'expectedAnswerReads',
  'modelCalls',
  'upstreamNetworkCalls',
])

const RESULT_FIELDS = Object.freeze([
  'schemaVersion',
  'protocolVersion',
  'runLabel',
  'status',
  'sourceCommit',
  'sourceTree',
  'sourceManifestSha256',
  'productionIsolationManifestSha256',
  'protocolBundleSha256',
  'componentVersions',
  'checks',
  'accessCounters',
  'modelCalls',
  'upstreamNetworkCalls',
  'expectedAnswersLoaded',
  'nextStages',
])

const DEPLOYMENT_EVIDENCE_FIELDS = Object.freeze([
  'schemaVersion',
  'qualificationWorkerVersionId',
  'qualificationWorkerUploadedAt',
  'qualificationWorkerVersionedOrigin',
  'qualificationWorkerBytesSha256',
  'qualificationWorkerConfigSha256',
  'ledgerWorkerVersionId',
  'ledgerWorkerBytesSha256',
  'ledgerWorkerConfigSha256',
])

const REGISTRATION_FIELDS = Object.freeze([
  'schemaVersion',
  'runLabel',
  'protocolVersion',
  'qualificationVersion',
  'expectedWorkerVersionId',
  'protocolBundleSha256',
  'qualificationResultSha256',
  'qualificationResult',
  'deploymentEvidenceSha256',
  'deploymentEvidence',
])

function json(value, status = 200, extraHeaders = {}) {
  return Response.json(value, {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=UTF-8',
      'x-content-type-options': 'nosniff',
      ...extraHeaders,
    },
  })
}

function safeObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function safeText(value, limit) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '').trim().slice(0, limit)
    : ''
}

function hasExactFields(value, fields) {
  if (!safeObject(value)) return false
  const actual = Object.keys(value).sort()
  const expected = [...fields].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

export function validRunLabel(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{2,100}$/u.test(value)
}

export function validWorkerVersionId(value) {
  return typeof value === 'string'
    && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(value)
    && value.toLowerCase() !== '00000000-0000-4000-8000-000000000000'
}

export function validCommittedSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value) && !/^0{64}$/u.test(value)
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export async function sha256Text(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function sha256Canonical(value) {
  return sha256Text(canonicalJson(value))
}

export function constantTimeHexEqual(left, right) {
  const normalizedLeft = /^[a-f0-9]{64}$/u.test(left) ? left : '0'.repeat(64)
  const normalizedRight = /^[a-f0-9]{64}$/u.test(right) ? right : '0'.repeat(64)
  let difference = 0
  for (let index = 0; index < 64; index += 1) {
    difference |= normalizedLeft.charCodeAt(index) ^ normalizedRight.charCodeAt(index)
  }
  return difference === 0 && normalizedLeft === left && normalizedRight === right
}

function frozenStageAuthorization() {
  return Object.freeze(Object.fromEntries(NEXT_STAGE_FIELDS.map((stage) => [stage, false])))
}

function workerVersionId(env) {
  const value = safeText(env.CF_VERSION_METADATA?.id, 64)
  return validWorkerVersionId(value) ? value : ''
}

function workerUploadedAt(env) {
  const value = safeText(env.CF_VERSION_METADATA?.timestamp, 50)
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u.test(value) ? value : ''
}

export function versionedOrigin(baseOrigin, versionId) {
  const canonical = new URL(baseOrigin)
  return `${canonical.protocol}//${versionId.slice(0, 8)}-${canonical.host}`
}

export function validateDeploymentEvidence(value) {
  if (!hasExactFields(value, DEPLOYMENT_EVIDENCE_FIELDS)
    || value.schemaVersion !== E2_R10_DEPLOYMENT_EVIDENCE_SCHEMA_VERSION
    || !validWorkerVersionId(value.qualificationWorkerVersionId)
    || !validWorkerVersionId(value.ledgerWorkerVersionId)
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u.test(value.qualificationWorkerUploadedAt ?? '')
    || !validCommittedSha256(value.qualificationWorkerBytesSha256)
    || !validCommittedSha256(value.qualificationWorkerConfigSha256)
    || !validCommittedSha256(value.ledgerWorkerBytesSha256)
    || !validCommittedSha256(value.ledgerWorkerConfigSha256)) return false
  let origin
  try {
    origin = new URL(value.qualificationWorkerVersionedOrigin)
  } catch {
    return false
  }
  return origin.origin === value.qualificationWorkerVersionedOrigin
    && origin.protocol === 'https:'
    && origin.hostname.startsWith(`${value.qualificationWorkerVersionId.slice(0, 8)}-`)
}

function deploymentEvidenceFromEnvironment(env, expectedOrigin) {
  return {
    schemaVersion: E2_R10_DEPLOYMENT_EVIDENCE_SCHEMA_VERSION,
    qualificationWorkerVersionId: workerVersionId(env),
    qualificationWorkerUploadedAt: workerUploadedAt(env),
    qualificationWorkerVersionedOrigin: expectedOrigin,
    qualificationWorkerBytesSha256: safeText(env.E2_R10_QUALIFICATION_WORKER_BYTES_SHA256, 64),
    qualificationWorkerConfigSha256: safeText(env.E2_R10_QUALIFICATION_WORKER_CONFIG_SHA256, 64),
    ledgerWorkerVersionId: safeText(env.E2_R10_LEDGER_WORKER_VERSION_ID, 64),
    ledgerWorkerBytesSha256: safeText(env.E2_R10_LEDGER_WORKER_BYTES_SHA256, 64),
    ledgerWorkerConfigSha256: safeText(env.E2_R10_LEDGER_WORKER_CONFIG_SHA256, 64),
  }
}

async function authorize(request, env) {
  if (env.E2_R10_QUALIFICATION_ENABLED !== 'true') return { error: 'NOT_FOUND', status: 404 }

  const versionId = workerVersionId(env)
  if (!versionId || !workerUploadedAt(env)) return { error: 'VERSION_METADATA_NOT_CONFIGURED', status: 503 }

  const configuredOrigin = safeText(env.E2_R10_QUALIFICATION_PREVIEW_ORIGIN, 300)
  let parsedOrigin
  try {
    parsedOrigin = new URL(configuredOrigin)
  } catch {
    return { error: 'PREVIEW_ORIGIN_NOT_CONFIGURED', status: 503 }
  }
  if (parsedOrigin.origin !== configuredOrigin || parsedOrigin.protocol !== 'https:') {
    return { error: 'PREVIEW_ORIGIN_NOT_CONFIGURED', status: 503 }
  }

  const expectedOrigin = env.E2_R10_VERSIONED_PREVIEW_ONLY === 'true'
    ? versionedOrigin(configuredOrigin, versionId)
    : configuredOrigin
  const requestUrl = new URL(request.url)
  if (requestUrl.origin !== expectedOrigin) return { error: 'NOT_FOUND', status: 404 }
  if (request.headers.get('origin') !== expectedOrigin) return { error: 'ORIGIN_NOT_ALLOWED', status: 403 }

  const expectedHash = safeText(env.E2_R10_QUALIFICATION_TOKEN_SHA256, 64)
  const authorization = safeText(request.headers.get('authorization'), 600)
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const suppliedHash = await sha256Text(token)
  if (!validCommittedSha256(expectedHash) || token.length < 32 || token.length > 512
    || !constantTimeHexEqual(suppliedHash, expectedHash)) {
    return { error: 'UNAUTHORIZED', status: 401 }
  }

  if (!env.E2_R10_QUALIFICATION_LEDGER || typeof env.E2_R10_QUALIFICATION_LEDGER.fetch !== 'function') {
    return { error: 'LEDGER_NOT_CONFIGURED', status: 503 }
  }
  const ledgerCallerToken = safeText(env.E2_R10_LEDGER_CALLER_TOKEN, 512)
  if (ledgerCallerToken.length < 32) return { error: 'LEDGER_CALLER_AUTH_NOT_CONFIGURED', status: 503 }

  const deploymentEvidence = deploymentEvidenceFromEnvironment(env, expectedOrigin)
  if (!validateDeploymentEvidence(deploymentEvidence)
    || deploymentEvidence.qualificationWorkerVersionedOrigin !== versionedOrigin(configuredOrigin, versionId)) {
    return { error: 'DEPLOYMENT_BINDINGS_NOT_CONFIGURED', status: 503 }
  }
  return { versionId, expectedOrigin, ledgerCallerToken, deploymentEvidence }
}

function exactBooleanObject(value, fields) {
  return hasExactFields(value, fields) && Object.values(value).every((item) => typeof item === 'boolean')
}

function exactNonNegativeIntegerObject(value, fields) {
  return hasExactFields(value, fields)
    && Object.values(value).every((item) => Number.isInteger(item) && item >= 0)
}

function exactComponentVersions(value) {
  return hasExactFields(value, Object.keys(E2_R10_REQUIRED_COMPONENT_VERSIONS))
    && Object.entries(E2_R10_REQUIRED_COMPONENT_VERSIONS).every(([key, version]) => value[key] === version)
}

export function validateQualificationResult(result) {
  if (!hasExactFields(result, RESULT_FIELDS)) return false
  if (result.schemaVersion !== E2_R10_RESULT_SCHEMA_VERSION
    || result.protocolVersion !== E2_R10_PROTOCOL_VERSION
    || !validRunLabel(result.runLabel)
    || !/^[a-f0-9]{40}$/u.test(result.sourceCommit ?? '')
    || !/^[a-f0-9]{40}$/u.test(result.sourceTree ?? '')
    || !validCommittedSha256(result.sourceManifestSha256)
    || !validCommittedSha256(result.productionIsolationManifestSha256)
    || !validCommittedSha256(result.protocolBundleSha256)
    || !exactComponentVersions(result.componentVersions)
    || !exactBooleanObject(result.checks, E2_R10_REQUIRED_CHECK_NAMES)
    || !exactNonNegativeIntegerObject(result.accessCounters, ACCESS_COUNTER_FIELDS)
    || result.modelCalls !== result.accessCounters.modelCalls
    || result.upstreamNetworkCalls !== result.accessCounters.upstreamNetworkCalls
    || result.expectedAnswersLoaded !== (result.accessCounters.expectedAnswerReads > 0)
    || !exactBooleanObject(result.nextStages, NEXT_STAGE_FIELDS)
    || Object.values(result.nextStages).some(Boolean)) return false

  const checksPass = Object.values(result.checks).every(Boolean)
  const countersPass = result.modelCalls === 0
    && result.upstreamNetworkCalls === 0
    && result.accessCounters.expectedAnswerReads === 0
  if (result.status === 'LOCAL_QUALIFIED_PREVIEW_UPLOAD_REQUESTABLE') return checksPass && countersPass
  if (result.status === 'LOCAL_QUALIFICATION_FAILED_PREVIEW_LOCKED') return !checksPass || !countersPass
  return false
}

export async function validateQualificationRegistration(registration) {
  if (!hasExactFields(registration, REGISTRATION_FIELDS)) return false
  if (registration.schemaVersion !== E2_R10_REGISTRATION_SCHEMA_VERSION
    || registration.protocolVersion !== E2_R10_PROTOCOL_VERSION
    || registration.qualificationVersion !== E2_R10_QUALIFICATION_VERSION
    || !validRunLabel(registration.runLabel)
    || !validWorkerVersionId(registration.expectedWorkerVersionId)
    || !validCommittedSha256(registration.protocolBundleSha256)
    || !validCommittedSha256(registration.qualificationResultSha256)
    || !validCommittedSha256(registration.deploymentEvidenceSha256)
    || !validateQualificationResult(registration.qualificationResult)
    || !validateDeploymentEvidence(registration.deploymentEvidence)) return false

  return registration.qualificationResult.runLabel === registration.runLabel
    && registration.qualificationResult.protocolBundleSha256 === registration.protocolBundleSha256
    && registration.expectedWorkerVersionId === registration.deploymentEvidence.qualificationWorkerVersionId
    && await sha256Canonical(registration.qualificationResult) === registration.qualificationResultSha256
    && await sha256Canonical(registration.deploymentEvidence) === registration.deploymentEvidenceSha256
}

async function readRegistration(request) {
  if (!/^application\/json(?:\s*;|$)/iu.test(request.headers.get('content-type') ?? '')) {
    return { error: 'INVALID_CONTENT_TYPE', status: 415 }
  }
  let body
  try {
    body = await request.json()
  } catch {
    return { error: 'INVALID_REQUEST', status: 400 }
  }
  if (!hasExactFields(body, REGISTRATION_FIELDS)) return { error: 'REGISTRATION_FIELDS_INVALID', status: 400 }
  return { body }
}

async function ledgerRequest(env, runLabel, pathname, { method = 'GET', body, ledgerCallerToken } = {}) {
  const response = await env.E2_R10_QUALIFICATION_LEDGER.fetch(`https://e2-r10-qualification-ledger.internal${pathname}`, {
    method,
    headers: {
      authorization: `Bearer ${ledgerCallerToken}`,
      'content-type': 'application/json',
      'x-e2-r10-run-label': runLabel,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return {
    response,
    payload: await response.json().catch(() => ({ error: 'LEDGER_RESPONSE_INVALID', modelCalls: 0 })),
  }
}

export async function runE2R10Qualification(request, env) {
  const authorization = await authorize(request, env)
  if (authorization.error) return json({ error: authorization.error, modelCalls: 0 }, authorization.status)

  const url = new URL(request.url)
  const suffix = url.pathname.slice(E2_R10_ENDPOINT_PREFIX.length)
  const versionId = authorization.versionId
  const protocolBundleSha256 = safeText(env.E2_R10_PROTOCOL_BUNDLE_SHA256, 64)
  const qualificationResultSha256 = safeText(env.E2_R10_QUALIFICATION_RESULT_SHA256, 64)

  if (!validCommittedSha256(protocolBundleSha256) || !validCommittedSha256(qualificationResultSha256)) {
    return json({ error: 'HASH_BINDINGS_NOT_CONFIGURED', modelCalls: 0 }, 503)
  }

  if (suffix === 'contract') {
    if (request.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED', modelCalls: 0 }, 405)
    return json({
      schemaVersion: E2_R10_CONTRACT_SCHEMA_VERSION,
      protocolVersion: E2_R10_PROTOCOL_VERSION,
      qualificationVersion: E2_R10_QUALIFICATION_VERSION,
      workerVersionId: versionId,
      protocolBundleSha256,
      qualificationResultSha256,
      deploymentEvidence: authorization.deploymentEvidence,
      qualificationOnly: true,
      modelCalls: 0,
      nextStagesAuthorized: frozenStageAuthorization(),
    })
  }

  if (LOCKED_STAGES.includes(suffix)) {
    return json({
      error: 'MODEL_PHASE_NOT_AUTHORIZED',
      protocolVersion: E2_R10_PROTOCOL_VERSION,
      qualificationVersion: E2_R10_QUALIFICATION_VERSION,
      workerVersionId: versionId,
      stage: suffix,
      modelCalls: 0,
    }, 412)
  }

  if (suffix === 'record') {
    if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED', modelCalls: 0 }, 405)
    const parsed = await readRegistration(request)
    if (parsed.error) return json({ error: parsed.error, modelCalls: 0 }, parsed.status)
    const registration = parsed.body
    if (!await validateQualificationRegistration(registration)
      || registration.expectedWorkerVersionId !== versionId
      || registration.protocolBundleSha256 !== protocolBundleSha256
      || registration.qualificationResultSha256 !== qualificationResultSha256
      || canonicalJson(registration.deploymentEvidence) !== canonicalJson(authorization.deploymentEvidence)) {
      return json({ error: 'QUALIFICATION_BINDING_INVALID', modelCalls: 0 }, 412)
    }
    const ledger = await ledgerRequest(env, registration.runLabel, '/record', {
      method: 'POST', body: registration, ledgerCallerToken: authorization.ledgerCallerToken,
    })
    return json(ledger.payload, ledger.response.status, {
      ...(ledger.response.headers.get('x-idempotent-replay') === 'true' ? { 'x-idempotent-replay': 'true' } : {}),
    })
  }

  if (suffix === 'state') {
    if (request.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED', modelCalls: 0 }, 405)
    const runLabel = url.searchParams.get('runLabel') ?? ''
    if (!validRunLabel(runLabel)) return json({ error: 'INVALID_RUN_LABEL', modelCalls: 0 }, 400)
    const ledger = await ledgerRequest(env, runLabel, '/state', { ledgerCallerToken: authorization.ledgerCallerToken })
    return json(ledger.payload, ledger.response.status)
  }

  return json({ error: 'NOT_FOUND', modelCalls: 0 }, 404)
}
