export const E2_R6_PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.4.0'
export const E2_R6_PREVIEW_HARNESS_VERSION = 'e2-9-r6-preview-harness-1.0.0'

const QUALIFICATION_FIELDS = new Set([
  'runLabel', 'protocolVersion', 'qualificationBundleSha256', 'qualificationResultSha256', 'qualificationResult',
])
const RESULT_FIELDS = new Set([
  'schemaVersion', 'protocolVersion', 'runId', 'modelCalls', 'networkCalls', 'expectedAnswersLoaded',
  'qualificationBundleSha256', 'reviewerPacketSha256', 'privateManifestSha256', 'labelsSha256',
  'publicPacketFields', 'privateOnlyFields', 'protocolMetadataExcludedFromLabelLeakScan', 'failureTaxonomy',
  'stageSequence', 'syntheticScore', 'status', 'nextStagesAuthorized',
])
const LOCKED_PATHS = new Set(['readiness', 'generate', 'selection', 'blind'])

function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store' } })
}

function safeText(value, limit) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '').trim().slice(0, limit)
    : ''
}

function safeObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function onlyFields(value, fields) {
  return safeObject(value) && Object.keys(value).every((key) => fields.has(key))
}

function validSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value)
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function authorizationError(request, env) {
  const url = new URL(request.url)
  const expectedOrigin = safeText(env.E2_R6_PREVIEW_ORIGIN, 300)
  if (env.E2_R6_HARNESS_ENABLED !== 'true' || !expectedOrigin || url.origin !== expectedOrigin) return 'NOT_FOUND'
  if (request.headers.get('origin') !== expectedOrigin) return 'ORIGIN_NOT_ALLOWED'
  const expected = safeText(env.E2_R6_BENCHMARK_TOKEN, 512)
  const supplied = safeText(request.headers.get('authorization'), 600)
  if (expected.length < 32 || supplied !== `Bearer ${expected}`) return 'UNAUTHORIZED'
  if (!env.E2_R6_QUALIFICATION_LEDGER || typeof env.E2_R6_QUALIFICATION_LEDGER.fetch !== 'function') return 'LEDGER_NOT_CONFIGURED'
  return null
}

async function readQualification(request) {
  if (!/^application\/json(?:\s*;|$)/iu.test(request.headers.get('content-type') ?? '')) return { error: 'INVALID_CONTENT_TYPE', status: 415 }
  let body
  try { body = await request.json() } catch { return { error: 'INVALID_REQUEST', status: 400 } }
  if (!onlyFields(body, QUALIFICATION_FIELDS)) return { error: 'QUALIFICATION_FIREWALL_REJECTED', status: 400 }
  return { body }
}

function qualificationShapeValid(result) {
  return onlyFields(result, RESULT_FIELDS)
    && result.schemaVersion === 'e2.9-r6-harness-qualification-result-1.0.0'
    && result.protocolVersion === E2_R6_PROTOCOL_VERSION
    && result.status === 'HARNESS_QUALIFIED_FOR_FUTURE_PREFLIGHT'
    && result.modelCalls === 0 && result.networkCalls === 0 && result.expectedAnswersLoaded === false
    && result.protocolMetadataExcludedFromLabelLeakScan === true
    && safeObject(result.nextStagesAuthorized)
    && Object.keys(result.nextStagesAuthorized).sort().join(',') === 'blind,modelReadiness,production,screening,selection,smoke'
    && Object.values(result.nextStagesAuthorized).every((value) => value === false)
    && validSha256(result.qualificationBundleSha256)
}

async function ledgerRequest(env, runLabel, path, { method = 'POST', body } = {}) {
  const response = await env.E2_R6_QUALIFICATION_LEDGER.fetch(`https://e2-r6-qualification-ledger.internal${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-e2-r6-run-label': runLabel },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const payload = await response.json().catch(() => null)
  return { response, payload }
}

export async function runE2R6Harness(request, env, _providerFetcher = fetch) {
  const authError = authorizationError(request, env)
  if (authError) return json({ error: authError }, authError === 'NOT_FOUND' ? 404 : authError === 'ORIGIN_NOT_ALLOWED' ? 403 : authError === 'UNAUTHORIZED' ? 401 : 503)
  const url = new URL(request.url)
  const suffix = url.pathname.split('/').at(-1)

  if (LOCKED_PATHS.has(suffix)) {
    return json({
      error: 'MODEL_PHASE_NOT_AUTHORIZED',
      protocolVersion: E2_R6_PROTOCOL_VERSION,
      harnessVersion: E2_R6_PREVIEW_HARNESS_VERSION,
      modelCalls: 0,
    }, 412)
  }

  if (suffix === 'qualification' && request.method === 'POST') {
    const parsed = await readQualification(request)
    if (parsed.error) return json({ error: parsed.error }, parsed.status)
    const body = parsed.body
    const expectedBundle = safeText(env.E2_R6_QUALIFICATION_BUNDLE_SHA256, 64)
    const expectedResult = safeText(env.E2_R6_QUALIFICATION_RESULT_SHA256, 64)
    if (body.protocolVersion !== E2_R6_PROTOCOL_VERSION || !qualificationShapeValid(body.qualificationResult)
      || body.qualificationBundleSha256 !== expectedBundle || body.qualificationResult.qualificationBundleSha256 !== expectedBundle
      || body.qualificationResultSha256 !== expectedResult || await sha256(canonicalJson(body.qualificationResult)) !== expectedResult) {
      return json({ error: 'QUALIFICATION_BINDING_INVALID' }, 412)
    }
    const ledger = await ledgerRequest(env, body.runLabel, '/record', { body })
    return json(ledger.payload, ledger.response.status)
  }

  if (suffix === 'state' && request.method === 'GET') {
    const runLabel = url.searchParams.get('runLabel') ?? ''
    const ledger = await ledgerRequest(env, runLabel, '/state', { method: 'GET' })
    return json(ledger.payload, ledger.response.status)
  }
  return json({ error: 'NOT_FOUND' }, 404)
}
