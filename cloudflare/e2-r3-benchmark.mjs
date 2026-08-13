import { runE2V4ProBenchmark } from './e2-v4-pro-benchmark.mjs'
import { normalizeR2BenchmarkResult, validateR2Lineage, validateR2Result } from './e2-r2-benchmark.mjs'
import { attemptStatusForFailure, classifyR3Failure } from './e2-r3-transport-policy.mjs'

export const E2_R3_PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.1.0'
export const E2_R3_BENCHMARK_VERSION = 'e2-9-r3-benchmark-3.1.0'
export const E2_R3_NORMALIZER_VERSION = 'e2-9-r3-role-aware-normalizer-3.1.0'

const MODEL_BY_ALIAS = Object.freeze({ flash: 'deepseek-v4-flash', pro: 'deepseek-v4-pro' })
const SEMANTIC_ROLES = new Set(['action_required', 'information_only', 'prompt_injection'])
const GENERATE_FIELDS = new Set([
  'runLabel', 'observationId', 'phase', 'modelAlias', 'semanticRole', 'sourceType', 'sourceTitle', 'content',
  'referenceTime', 'timezone', 'sourceSha256', 'inputSha256', 'phaseManifestSha256', 'protocolVersion',
])
const READINESS_FIELDS = new Set(['runLabel', 'observationId', 'probeIndex', 'modelAlias', 'inputSha256', 'phaseManifestSha256', 'protocolVersion'])

function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store' } })
}

function safeText(value, limit) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '').trim().slice(0, limit)
    : ''
}

function onlyFields(value, fields) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
    && Object.keys(value).every((key) => fields.has(key))
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
  const expectedOrigin = safeText(env.E2_R3_PREVIEW_ORIGIN, 300)
  if (env.E2_R3_BENCHMARK_ENABLED !== 'true' || !expectedOrigin || url.origin !== expectedOrigin) return 'NOT_FOUND'
  if (request.headers.get('origin') !== expectedOrigin) return 'ORIGIN_NOT_ALLOWED'
  const expected = safeText(env.E2_V4_PRO_BENCHMARK_TOKEN, 512)
  const supplied = safeText(request.headers.get('authorization'), 600)
  if (expected.length < 32 || supplied !== `Bearer ${expected}`) return 'UNAUTHORIZED'
  if (safeText(env.DEEPSEEK_API_KEY, 512).length < 20) return 'DEEPSEEK_NOT_CONFIGURED'
  if (!env.E2_R3_LEDGER || typeof env.E2_R3_LEDGER.fetch !== 'function') return 'LEDGER_NOT_CONFIGURED'
  return null
}

async function ledgerRequest(env, runLabel, path, { method = 'POST', body } = {}) {
  const response = await env.E2_R3_LEDGER.fetch(`https://e2-r3-ledger.internal${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-e2-r3-run-label': runLabel },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const payload = await response.json().catch(() => null)
  return { response, payload }
}

async function reserve(env, body) {
  return ledgerRequest(env, body.runLabel, '/reserve', { body: {
    observationId: body.observationId, phase: body.phase, modelAlias: body.modelAlias,
    inputSha256: body.inputSha256, phaseManifestSha256: body.phaseManifestSha256,
  } })
}

async function appendAttempt(env, body, reservationToken, attempt) {
  const recorded = await ledgerRequest(env, body.runLabel, '/attempt', { body: { observationId: body.observationId, reservationToken, ...attempt } })
  if (!recorded.response.ok) throw new Error(`LEDGER_ATTEMPT_FAILED_${recorded.response.status}`)
  return recorded.payload
}

async function finalize(env, body, reservationToken, details) {
  const finalized = await ledgerRequest(env, body.runLabel, '/finalize', { body: { observationId: body.observationId, reservationToken, ...details } })
  if (!finalized.response.ok) throw new Error(`LEDGER_FINALIZE_FAILED_${finalized.response.status}`)
  return finalized.payload
}

function r1Environment(env) {
  return {
    ...env,
    E2_V4_PRO_BENCHMARK_ENABLED: 'true',
    E2_V4_PRO_BENCHMARK_TOKEN: env.E2_V4_PRO_BENCHMARK_TOKEN,
  }
}

function r1Request(request, suffix, method, body) {
  const url = new URL(request.url)
  const [pathSuffix, query = ''] = suffix.split('?')
  url.pathname = `/api/experiments/e2-9/v4-pro-benchmark/${pathSuffix}`
  url.search = query ? `?${query}` : ''
  return new Request(url, {
    method,
    headers: { authorization: request.headers.get('authorization') ?? '', origin: request.headers.get('origin') ?? '', ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

async function readJsonRequest(request, fields) {
  if (!/^application\/json(?:\s*;|$)/iu.test(request.headers.get('content-type') ?? '')) return { error: 'INVALID_CONTENT_TYPE', status: 415 }
  let body
  try { body = await request.json() } catch { return { error: 'INVALID_REQUEST', status: 400 } }
  if (!onlyFields(body, fields)) return { error: 'GENERATION_FIREWALL_REJECTED', status: 400 }
  return { body }
}

function sanitizedFailure(error, body, protocolAttempts, evidence, protocolStatus) {
  return {
    error,
    protocolVersion: E2_R3_PROTOCOL_VERSION,
    benchmarkVersion: E2_R3_BENCHMARK_VERSION,
    observationId: body.observationId,
    protocolStatus,
    protocolAttempts,
    transportEvidence: evidence,
  }
}

async function handleReadiness(request, env, fetcher) {
  const parsed = await readJsonRequest(request, READINESS_FIELDS)
  if (parsed.error) return json({ error: parsed.error }, parsed.status)
  const body = { ...parsed.body, phase: 'readiness' }
  if (body.protocolVersion !== E2_R3_PROTOCOL_VERSION || !Object.hasOwn(MODEL_BY_ALIAS, body.modelAlias)
    || !Number.isInteger(body.probeIndex) || body.probeIndex < 1 || body.probeIndex > 3) return json({ error: 'PROTOCOL_OR_MODEL_INVALID' }, 400)
  const canonicalInput = canonicalJson({ kind: 'readiness', modelAlias: body.modelAlias, probeIndex: body.probeIndex, protocolVersion: body.protocolVersion })
  if (body.inputSha256 !== await sha256(canonicalInput)) return json({ error: 'INPUT_HASH_MISMATCH' }, 412)
  const reservation = await reserve(env, body)
  if (!reservation.response.ok) return json(reservation.payload, reservation.response.status)
  const token = reservation.payload.reservationToken
  const expected = MODEL_BY_ALIAS[body.modelAlias]
  try {
    const upstream = await runE2V4ProBenchmark(r1Request(request, `readiness?modelAlias=${body.modelAlias}`, 'GET'), r1Environment(env), fetcher)
    const payload = await upstream.json().catch(() => null)
    const deploymentVersion = safeText(env.CF_VERSION_METADATA?.id, 200)
    const complete = upstream.ok && payload?.requestedModel === expected && payload?.returnedModel === expected
      && payload?.systemFingerprint && payload?.usage && payload?.validJsonObject === true && deploymentVersion
    let evidence = null
    let attemptStatus = 'complete'
    let error = null
    if (!complete) {
      error = payload?.error ?? `HTTP_${upstream.status}`
      evidence = await classifyR3Failure(error, payload?.execution, expected)
      attemptStatus = attemptStatusForFailure(evidence)
    }
    const recorded = await appendAttempt(env, body, token, {
      attemptNumber: 1, status: attemptStatus, error, httpStatus: upstream.status,
      requestedModel: payload?.requestedModel ?? payload?.execution?.requestedModel ?? expected,
      returnedModel: payload?.returnedModel ?? payload?.execution?.returnedModel ?? null,
      deploymentVersion,
      responseSha256: payload?.rawOutputSha256 ?? evidence?.providerResponseSha256 ?? null,
      durationMs: payload?.durationMs ?? payload?.execution?.durationMs ?? evidence?.providerDurationMs ?? null,
      transportEvidence: evidence,
    })
    const finalized = await finalize(env, body, token, {
      requestedModel: payload?.requestedModel ?? payload?.execution?.requestedModel ?? expected,
      returnedModel: payload?.returnedModel ?? payload?.execution?.returnedModel ?? null,
      executionModel: payload?.returnedModel ?? null, resultModelName: payload?.returnedModel ?? null,
      deploymentVersion,
      rawOutputSha256: payload?.rawOutputSha256 ?? null,
    })
    if (!complete) return json(sanitizedFailure('READINESS_FAILED', body, recorded.attempts, evidence, finalized.status), upstream.status || 502)
    return json({
      ...payload, protocolVersion: E2_R3_PROTOCOL_VERSION, benchmarkVersion: E2_R3_BENCHMARK_VERSION,
      observationId: body.observationId, probeIndex: body.probeIndex, executionModel: payload.returnedModel,
      deploymentVersion,
      resultMetadata: { modelName: payload.returnedModel, promptVersion: 'recognition-2.4.1', pipelineVersion: 'recognition-pipeline-2.2.1', schemaVersion: '2.0' },
      protocolStatus: finalized.status, protocolAttempts: recorded.attempts,
    })
  } catch {
    return json({ error: 'HARNESS_FAILURE', observationId: body.observationId }, 502)
  }
}

async function handleGenerate(request, env, fetcher) {
  const parsed = await readJsonRequest(request, GENERATE_FIELDS)
  if (parsed.error) return json({ error: parsed.error }, parsed.status)
  const body = parsed.body
  if (body.protocolVersion !== E2_R3_PROTOCOL_VERSION || !['smoke', 'screening'].includes(body.phase)
    || !Object.hasOwn(MODEL_BY_ALIAS, body.modelAlias) || !SEMANTIC_ROLES.has(body.semanticRole)) return json({ error: 'PROTOCOL_REQUEST_INVALID' }, 400)
  const source = safeText(body.content, 24_000)
  const input = { sourceType: body.sourceType, sourceTitle: body.sourceTitle, content: source, referenceTime: body.referenceTime, timezone: body.timezone }
  if (body.sourceSha256 !== await sha256(source) || body.inputSha256 !== await sha256(canonicalJson(input))) return json({ error: 'INPUT_HASH_MISMATCH' }, 412)
  const reservation = await reserve(env, body)
  if (!reservation.response.ok) return json(reservation.payload, reservation.response.status)
  const token = reservation.payload.reservationToken
  const expectedModel = MODEL_BY_ALIAS[body.modelAlias]
  const upstreamBody = { modelAlias: body.modelAlias, sourceType: body.sourceType, sourceTitle: body.sourceTitle, content: source, referenceTime: body.referenceTime, timezone: body.timezone }
  let lastEvidence = null
  try {
    for (let attemptNumber = 1; attemptNumber <= 2; attemptNumber += 1) {
      const upstream = await runE2V4ProBenchmark(r1Request(request, 'generate', 'POST', upstreamBody), r1Environment(env), fetcher)
      const payload = await upstream.json().catch(() => null)
      if (!upstream.ok || !payload?.result || !payload?.execution) {
        const upstreamError = payload?.error ?? `HTTP_${upstream.status}`
        const evidence = await classifyR3Failure(upstreamError, payload?.execution, expectedModel)
        lastEvidence = evidence
        const recorded = await appendAttempt(env, body, token, {
          attemptNumber, status: attemptStatusForFailure(evidence), error: evidence.classification,
          httpStatus: upstream.status, requestedModel: payload?.execution?.requestedModel ?? expectedModel,
          returnedModel: payload?.execution?.returnedModel ?? evidence.observedEnvelopeModel,
          deploymentVersion: safeText(env.CF_VERSION_METADATA?.id, 200),
          responseSha256: evidence.providerResponseSha256, durationMs: evidence.providerDurationMs, transportEvidence: evidence,
        })
        if (attemptNumber === 1 && evidence.retryEligible) continue
        const finalized = await finalize(env, body, token, {
          sourceSha256: body.sourceSha256,
          requestedModel: payload?.execution?.requestedModel ?? expectedModel,
          returnedModel: payload?.execution?.returnedModel ?? evidence.observedEnvelopeModel,
          deploymentVersion: safeText(env.CF_VERSION_METADATA?.id, 200),
        })
        const error = evidence.classification === 'UPSTREAM_JSON_TRUNCATED' ? 'UPSTREAM_JSON_TRUNCATED'
          : evidence.classification === 'MODEL_JSON_INVALID' ? 'MODEL_JSON_INVALID' : upstreamError
        return json(sanitizedFailure(error, body, recorded.attempts, evidence, finalized.status), upstream.status || 502)
      }

      const executionModel = payload.execution.returnedModel
      const result = normalizeR2BenchmarkResult(payload.result, body.semanticRole, executionModel)
      const responsePayload = {
        ...payload,
        protocolVersion: E2_R3_PROTOCOL_VERSION,
        benchmarkVersion: E2_R3_BENCHMARK_VERSION,
        observationId: body.observationId,
        semanticRole: body.semanticRole,
        result,
        execution: { ...payload.execution, executionModel, semanticRole: body.semanticRole, normalizer: E2_R3_NORMALIZER_VERSION, deploymentVersion: safeText(env.CF_VERSION_METADATA?.id, 200) },
      }
      responsePayload.execution.resultSha256 = await sha256(JSON.stringify(result))
      const roleError = validateR2Result(result, body.semanticRole)
      const lineageError = validateR2Lineage(responsePayload, body.modelAlias)
      const error = roleError ?? lineageError
      const recorded = await appendAttempt(env, body, token, {
        attemptNumber, status: error ? (lineageError ? 'integrity_failure' : 'invalid_output') : 'complete', error,
        httpStatus: upstream.status, requestedModel: responsePayload.execution.requestedModel,
        returnedModel: responsePayload.execution.returnedModel, responseSha256: responsePayload.execution.rawOutputSha256,
        deploymentVersion: responsePayload.execution.deploymentVersion,
        resultSha256: responsePayload.execution.resultSha256, durationMs: responsePayload.execution.durationMs, transportEvidence: null,
      })
      const finalized = await finalize(env, body, token, {
        sourceSha256: body.sourceSha256, rawOutputSha256: responsePayload.execution.rawOutputSha256,
        resultSha256: responsePayload.execution.resultSha256,
        requestedModel: responsePayload.execution.requestedModel, returnedModel: responsePayload.execution.returnedModel,
        executionModel: responsePayload.execution.executionModel, resultModelName: result?.modelName,
        deploymentVersion: responsePayload.execution.deploymentVersion,
      })
      if (error) return json(sanitizedFailure(error, body, recorded.attempts, null, finalized.status), 502)
      return json({ ...responsePayload, protocolStatus: finalized.status, protocolAttempts: recorded.attempts })
    }
    return json(sanitizedFailure('PROTOCOL_RETRY_EXHAUSTED', body, [], lastEvidence, 'transport_integrity_failure'), 502)
  } catch {
    return json({ error: 'HARNESS_FAILURE', observationId: body.observationId }, 502)
  }
}

export async function runE2R3Benchmark(request, env, fetcher = fetch) {
  const authError = authorizationError(request, env)
  if (authError) return json({ error: authError }, authError === 'NOT_FOUND' ? 404 : authError === 'ORIGIN_NOT_ALLOWED' ? 403 : authError === 'UNAUTHORIZED' ? 401 : 503)
  const url = new URL(request.url)
  if (url.pathname.endsWith('/register') && request.method === 'POST') {
    const body = await request.json().catch(() => null)
    if (body?.protocolVersion !== E2_R3_PROTOCOL_VERSION) return json({ error: 'PROTOCOL_VERSION_MISMATCH' }, 412)
    const ledger = await ledgerRequest(env, body?.runLabel ?? '', '/register', { body })
    return json(ledger.payload, ledger.response.status)
  }
  if (url.pathname.endsWith('/state') && request.method === 'GET') {
    const runLabel = url.searchParams.get('runLabel') ?? ''
    const ledger = await ledgerRequest(env, runLabel, '/state', { method: 'GET' })
    return json(ledger.payload, ledger.response.status)
  }
  if (url.pathname.endsWith('/advance') && request.method === 'POST') {
    const body = await request.json().catch(() => null)
    const ledger = await ledgerRequest(env, body?.runLabel ?? '', '/advance', { body })
    return json(ledger.payload, ledger.response.status)
  }
  if (url.pathname.endsWith('/readiness') && request.method === 'POST') return handleReadiness(request, env, fetcher)
  if (url.pathname.endsWith('/generate') && request.method === 'POST') return handleGenerate(request, env, fetcher)
  return json({ error: 'NOT_FOUND' }, 404)
}
