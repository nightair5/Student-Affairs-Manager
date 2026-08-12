import { runE2V4ProBenchmark } from './e2-v4-pro-benchmark.mjs'

export const E2_R2_PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.0.0'
export const E2_R2_BENCHMARK_VERSION = 'e2-9-r2-benchmark-3.0.0'
export const E2_R2_NORMALIZER_VERSION = 'e2-9-r2-role-aware-normalizer-3.0.0'

const MODEL_BY_ALIAS = Object.freeze({ flash: 'deepseek-v4-flash', pro: 'deepseek-v4-pro' })
const SEMANTIC_ROLES = new Set(['action_required', 'information_only', 'prompt_injection'])
const GENERATE_FIELDS = new Set([
  'runLabel', 'observationId', 'phase', 'modelAlias', 'semanticRole', 'sourceType', 'sourceTitle', 'content',
  'referenceTime', 'timezone', 'sourceSha256', 'inputSha256', 'phaseManifestSha256', 'protocolVersion',
])
const READINESS_FIELDS = new Set(['runLabel', 'observationId', 'modelAlias', 'inputSha256', 'phaseManifestSha256', 'protocolVersion'])

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
  const expectedOrigin = safeText(env.E2_R2_PREVIEW_ORIGIN, 300)
  if (env.E2_R2_BENCHMARK_ENABLED !== 'true' || !expectedOrigin || url.origin !== expectedOrigin) return 'NOT_FOUND'
  if (request.headers.get('origin') !== expectedOrigin) return 'ORIGIN_NOT_ALLOWED'
  const expected = safeText(env.E2_R2_BENCHMARK_TOKEN, 512)
  const supplied = safeText(request.headers.get('authorization'), 600)
  if (expected.length < 32 || supplied !== `Bearer ${expected}`) return 'UNAUTHORIZED'
  if (safeText(env.DEEPSEEK_API_KEY, 512).length < 20) return 'DEEPSEEK_NOT_CONFIGURED'
  if (!env.E2_R2_LEDGER || typeof env.E2_R2_LEDGER.fetch !== 'function') return 'LEDGER_NOT_CONFIGURED'
  return null
}

async function ledgerRequest(env, runLabel, path, { method = 'POST', body } = {}) {
  const response = await env.E2_R2_LEDGER.fetch(`https://e2-r2-ledger.internal${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-e2-r2-run-label': runLabel },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const payload = await response.json().catch(() => null)
  return { response, payload }
}

function businessEntityCount(result) {
  const milestoneTasks = (result.milestones ?? []).reduce((count, milestone) => count
    + (milestone.tasks?.length ?? 0)
    + (milestone.workPackages ?? []).reduce((subtotal, item) => subtotal + (item.tasks?.length ?? 0), 0), 0)
  return (result.standaloneTasks?.length ?? 0) + milestoneTasks + (result.milestones?.length ?? 0)
    + (result.materials?.length ?? 0) + (result.timePoints?.length ?? 0) + (result.events?.length ?? 0)
}

export function normalizeR2BenchmarkResult(result, semanticRole, executionModel) {
  if (!result || typeof result !== 'object' || !SEMANTIC_ROLES.has(semanticRole) || !Object.values(MODEL_BY_ALIAS).includes(executionModel)) return null
  return { ...result, modelName: executionModel, benchmarkSemanticRole: semanticRole }
}

export function validateR2Result(result, semanticRole) {
  if (semanticRole === 'information_only') {
    if (result.sourceSummary?.requiresAction !== false) return 'PURE_INFORMATION_REQUIRES_ACTION'
    if (businessEntityCount(result) !== 0) return 'PURE_INFORMATION_SPURIOUS_ENTITY'
  } else if (businessEntityCount(result) === 0) return 'BASIC_CONTENT_EMPTY'
  if (semanticRole !== 'information_only' && (!Array.isArray(result.evidence) || result.evidence.length === 0)) return 'EVIDENCE_COMPLETELY_MISSING'
  return null
}

export function validateR2Lineage(payload, modelAlias) {
  const expected = MODEL_BY_ALIAS[modelAlias]
  const values = [payload?.execution?.requestedModel, payload?.execution?.returnedModel, payload?.execution?.executionModel, payload?.result?.modelName]
  return values.every((value) => value === expected) ? null : 'MODEL_LINEAGE_MISMATCH'
}

async function reserve(env, body) {
  return ledgerRequest(env, body.runLabel, '/reserve', { body: {
    observationId: body.observationId,
    phase: body.phase,
    modelAlias: body.modelAlias,
    inputSha256: body.inputSha256,
    phaseManifestSha256: body.phaseManifestSha256,
  } })
}

async function finalize(env, body, reservationToken, details) {
  return ledgerRequest(env, body.runLabel, '/finalize', { body: { observationId: body.observationId, reservationToken, ...details } })
}

function r1Environment(env) {
  return {
    ...env,
    E2_V4_PRO_BENCHMARK_ENABLED: 'true',
    E2_V4_PRO_BENCHMARK_TOKEN: env.E2_R2_BENCHMARK_TOKEN,
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

async function handleReadiness(request, env, fetcher) {
  const parsed = await readJsonRequest(request, READINESS_FIELDS)
  if (parsed.error) return json({ error: parsed.error }, parsed.status)
  const body = { ...parsed.body, phase: 'readiness' }
  if (body.protocolVersion !== E2_R2_PROTOCOL_VERSION || !Object.hasOwn(MODEL_BY_ALIAS, body.modelAlias)) return json({ error: 'PROTOCOL_OR_MODEL_INVALID' }, 400)
  const canonicalInput = canonicalJson({ kind: 'readiness', modelAlias: body.modelAlias, protocolVersion: body.protocolVersion })
  if (body.inputSha256 !== await sha256(canonicalInput)) return json({ error: 'INPUT_HASH_MISMATCH' }, 412)
  const reservation = await reserve(env, body)
  if (!reservation.response.ok) return json(reservation.payload, reservation.response.status)
  const token = reservation.payload.reservationToken
  const upstream = await runE2V4ProBenchmark(r1Request(request, `readiness?modelAlias=${body.modelAlias}`, 'GET'), r1Environment(env), fetcher)
  const payload = await upstream.json().catch(() => null)
  const expected = MODEL_BY_ALIAS[body.modelAlias]
  const complete = upstream.ok && payload?.requestedModel === expected && payload?.returnedModel === expected && payload?.systemFingerprint && payload?.usage
  await finalize(env, body, token, { outcome: complete ? 'complete' : 'failure', error: complete ? null : (payload?.error ?? `HTTP_${upstream.status}`), requestedModel: payload?.requestedModel, returnedModel: payload?.returnedModel, executionModel: payload?.returnedModel, resultModelName: payload?.returnedModel, rawOutputSha256: payload?.rawOutputSha256 })
  return json({ ...payload, protocolVersion: E2_R2_PROTOCOL_VERSION, benchmarkVersion: E2_R2_BENCHMARK_VERSION, observationId: body.observationId, executionModel: payload?.returnedModel, status: complete ? 'complete' : 'failure' }, upstream.status)
}

async function handleGenerate(request, env, fetcher) {
  const parsed = await readJsonRequest(request, GENERATE_FIELDS)
  if (parsed.error) return json({ error: parsed.error }, parsed.status)
  const body = parsed.body
  if (body.protocolVersion !== E2_R2_PROTOCOL_VERSION || !['smoke', 'screening'].includes(body.phase) || !Object.hasOwn(MODEL_BY_ALIAS, body.modelAlias) || !SEMANTIC_ROLES.has(body.semanticRole)) return json({ error: 'PROTOCOL_REQUEST_INVALID' }, 400)
  const source = safeText(body.content, 24_000)
  const input = { sourceType: body.sourceType, sourceTitle: body.sourceTitle, content: source, referenceTime: body.referenceTime, timezone: body.timezone }
  if (body.sourceSha256 !== await sha256(source) || body.inputSha256 !== await sha256(canonicalJson(input))) return json({ error: 'INPUT_HASH_MISMATCH' }, 412)
  const reservation = await reserve(env, body)
  if (!reservation.response.ok) return json(reservation.payload, reservation.response.status)
  const token = reservation.payload.reservationToken
  let finalDetails = { outcome: 'failure', error: 'HARNESS_FAILURE', sourceSha256: body.sourceSha256 }
  try {
    const upstreamBody = { modelAlias: body.modelAlias, sourceType: body.sourceType, sourceTitle: body.sourceTitle, content: source, referenceTime: body.referenceTime, timezone: body.timezone }
    const upstream = await runE2V4ProBenchmark(r1Request(request, 'generate', 'POST', upstreamBody), r1Environment(env), fetcher)
    const payload = await upstream.json().catch(() => null)
    if (!upstream.ok || !payload?.result || !payload?.execution) {
      finalDetails = { ...finalDetails, error: payload?.error ?? `HTTP_${upstream.status}`, requestedModel: payload?.execution?.requestedModel, returnedModel: payload?.execution?.returnedModel }
      await finalize(env, body, token, finalDetails)
      return json({ ...payload, protocolVersion: E2_R2_PROTOCOL_VERSION, benchmarkVersion: E2_R2_BENCHMARK_VERSION, observationId: body.observationId }, upstream.status)
    }
    const executionModel = payload.execution.returnedModel
    const result = normalizeR2BenchmarkResult(payload.result, body.semanticRole, executionModel)
    const responsePayload = {
      ...payload,
      protocolVersion: E2_R2_PROTOCOL_VERSION,
      benchmarkVersion: E2_R2_BENCHMARK_VERSION,
      observationId: body.observationId,
      semanticRole: body.semanticRole,
      result,
      execution: { ...payload.execution, executionModel, semanticRole: body.semanticRole, normalizer: E2_R2_NORMALIZER_VERSION },
    }
    responsePayload.execution.resultSha256 = await sha256(JSON.stringify(result))
    const roleError = validateR2Result(result, body.semanticRole)
    const lineageError = validateR2Lineage(responsePayload, body.modelAlias)
    const error = roleError ?? lineageError
    finalDetails = {
      outcome: error ? 'failure' : 'complete', error, sourceSha256: body.sourceSha256,
      rawOutputSha256: responsePayload.execution.rawOutputSha256, resultSha256: responsePayload.execution.resultSha256,
      requestedModel: responsePayload.execution.requestedModel, returnedModel: responsePayload.execution.returnedModel,
      executionModel: responsePayload.execution.executionModel, resultModelName: result.modelName,
    }
    await finalize(env, body, token, finalDetails)
    if (error) return json({ error, observationId: body.observationId, execution: responsePayload.execution, result }, 502)
    return json(responsePayload)
  } catch (error) {
    finalDetails.error = error instanceof Error ? error.message : 'HARNESS_FAILURE'
    await finalize(env, body, token, finalDetails)
    return json({ error: 'HARNESS_FAILURE', observationId: body.observationId }, 502)
  }
}

export async function runE2R2Benchmark(request, env, fetcher = fetch) {
  const authError = authorizationError(request, env)
  if (authError) return json({ error: authError }, authError === 'NOT_FOUND' ? 404 : authError === 'ORIGIN_NOT_ALLOWED' ? 403 : authError === 'UNAUTHORIZED' ? 401 : 503)
  const url = new URL(request.url)
  if (url.pathname.endsWith('/register') && request.method === 'POST') {
    const body = await request.json().catch(() => null)
    if (body?.protocolVersion !== E2_R2_PROTOCOL_VERSION) return json({ error: 'PROTOCOL_VERSION_MISMATCH' }, 412)
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
