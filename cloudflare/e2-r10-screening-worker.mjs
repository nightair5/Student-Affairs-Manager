import {
  E2_R10_SCREENING_ENDPOINT_PREFIX,
  E2_R10_SCREENING_MODEL,
  E2_R10_SCREENING_PROTOCOL_VERSION,
  E2_R10_SCREENING_RUN_LABEL,
  constantTimeHexEqual,
  executeScreeningObservation,
  safeText,
  screeningContract,
  sha256Text,
  validSha256,
  validWorkerVersionId,
  validateGenerationRequest,
  validateRegistration,
  versionedOrigin,
} from './e2-r10-screening-contract.mjs'

function json(value, status = 200, headers = {}) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers } })
}

async function authorize(request, env, { requireModel = false } = {}) {
  if (env.E2_R10_SCREENING_ENABLED !== 'true') return { error: 'NOT_FOUND', status: 404 }
  const versionId = safeText(env.CF_VERSION_METADATA?.id, 64)
  const configuredOrigin = safeText(env.E2_R10_SCREENING_PREVIEW_ORIGIN, 300)
  if (!validWorkerVersionId(versionId) || !configuredOrigin) return { error: 'VERSIONED_PREVIEW_NOT_CONFIGURED', status: 503 }
  let expectedOrigin
  try { expectedOrigin = versionedOrigin(configuredOrigin, versionId) } catch { return { error: 'VERSIONED_PREVIEW_NOT_CONFIGURED', status: 503 } }
  const url = new URL(request.url)
  if (url.origin !== expectedOrigin) return { error: 'NOT_FOUND', status: 404 }
  if (request.headers.get('origin') !== expectedOrigin) return { error: 'ORIGIN_NOT_ALLOWED', status: 403 }
  const expectedHash = safeText(env.E2_R10_SCREENING_TOKEN_SHA256, 64)
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (token.length < 32 || !validSha256(expectedHash)
    || !constantTimeHexEqual(await sha256Text(token), expectedHash)) return { error: 'UNAUTHORIZED', status: 401 }
  if (!env.E2_R10_SCREENING_LEDGER || typeof env.E2_R10_SCREENING_LEDGER.fetch !== 'function') return { error: 'LEDGER_NOT_CONFIGURED', status: 503 }
  const ledgerToken = safeText(env.E2_R10_SCREENING_LEDGER_CALLER_TOKEN, 512)
  if (ledgerToken.length < 32) return { error: 'LEDGER_CALLER_NOT_CONFIGURED', status: 503 }
  if (requireModel && safeText(env.DEEPSEEK_API_KEY, 512).length < 20) return { error: 'DEEPSEEK_NOT_CONFIGURED', status: 503 }
  return { versionId, expectedOrigin, ledgerToken }
}

async function ledgerRequest(env, authorization, path, { method = 'POST', body } = {}) {
  const request = new Request(`https://e2-r10-screening-ledger.internal${path}`, {
    method,
    headers: {
      authorization: `Bearer ${authorization.ledgerToken}`,
      'content-type': 'application/json',
      'x-e2-r10-run-label': E2_R10_SCREENING_RUN_LABEL,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const response = await env.E2_R10_SCREENING_LEDGER.fetch(request)
  return { response, payload: await response.json().catch(() => ({ error: 'LEDGER_RESPONSE_INVALID' })) }
}

async function parseJsonBody(request) {
  if (!/^application\/json(?:\s*;|$)/iu.test(request.headers.get('content-type') ?? '')) return { error: 'INVALID_CONTENT_TYPE', status: 415 }
  const size = Number(request.headers.get('content-length'))
  if (Number.isFinite(size) && size > 100_000) return { error: 'INPUT_TOO_LARGE', status: 413 }
  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > 100_000) return { error: 'INPUT_TOO_LARGE', status: 413 }
  try { return { body: JSON.parse(raw) } } catch { return { error: 'INVALID_REQUEST', status: 400 } }
}

async function handleGenerate(request, env, authorization, fetcher) {
  const parsed = await parseJsonBody(request)
  if (parsed.error) return json({ error: parsed.error }, parsed.status)
  const body = parsed.body
  const requestError = await validateGenerationRequest(body, env)
  if (requestError) return json({ error: requestError }, requestError === 'INPUT_HASH_MISMATCH' ? 412 : 400)
  const reservation = await ledgerRequest(env, authorization, '/reserve', { body: {
    observationId: body.observationId,
    observationIndex: body.observationIndex,
    caseId: body.caseId,
    arm: body.arm,
    semanticRole: body.semanticRole,
    sourceSha256: body.sourceSha256,
    inputSha256: body.inputSha256,
  } })
  if (!reservation.response.ok) return json(reservation.payload, reservation.response.status)
  const reservationToken = reservation.payload.reservationToken
  const outcome = await executeScreeningObservation(body, env, fetcher)
  const complete = outcome.ok
  const status = complete ? 'complete' : outcome.integrityError ? 'integrity_failure'
    : ['UPSTREAM_TIMEOUT', 'UPSTREAM_NETWORK_ERROR'].includes(outcome.completion?.error) ? 'transport_failure' : 'model_failure'
  const finalDetails = complete ? {
    status,
    sourceSha256: body.sourceSha256,
    inputSha256: body.inputSha256,
    requestedModel: outcome.execution.requestedModel,
    returnedModel: outcome.execution.returnedModel,
    executionModel: outcome.execution.executionModel,
    resultModelName: outcome.result.modelName,
    rawOutputSha256: outcome.execution.rawOutputSha256,
    resultSha256: outcome.execution.resultSha256,
    ledgerSha256: outcome.execution.ledgerSha256,
    workerVersionId: authorization.versionId,
    durationMs: outcome.execution.durationMs,
  } : {
    status,
    error: outcome.integrityError ?? outcome.completion?.error ?? 'MODEL_FAILURE',
    sourceSha256: body.sourceSha256,
    inputSha256: body.inputSha256,
    requestedModel: E2_R10_SCREENING_MODEL,
    returnedModel: outcome.completion?.returnedModel ?? null,
    executionModel: outcome.completion?.returnedModel ?? null,
    resultModelName: null,
    workerVersionId: authorization.versionId,
    durationMs: outcome.completion?.durationMs ?? null,
  }
  const finalized = await ledgerRequest(env, authorization, '/finalize', { body: { observationId: body.observationId, reservationToken, ...finalDetails } })
  if (!finalized.response.ok) return json({ error: 'LEDGER_FINALIZE_FAILED', ledgerStatus: finalized.response.status }, 502)
  if (!complete) return json({
    error: finalDetails.error,
    protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
    runLabel: E2_R10_SCREENING_RUN_LABEL,
    observationId: body.observationId,
    arm: body.arm,
    status,
    modelCalls: 1,
  }, outcome.completion?.status ?? 502)
  return json({
    protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
    runLabel: E2_R10_SCREENING_RUN_LABEL,
    observationId: body.observationId,
    observationIndex: body.observationIndex,
    caseId: body.caseId,
    arm: body.arm,
    semanticRole: body.semanticRole,
    rawOutput: outcome.rawOutput,
    result: outcome.result,
    ledger: outcome.ledger,
    planningTrace: outcome.planningTrace,
    validation: outcome.validation,
    execution: { ...outcome.execution, workerVersionId: authorization.versionId, modelCallOrdinal: reservation.payload.modelCallOrdinal },
    protocolStatus: finalized.payload.record.status,
    modelCalls: 1,
  })
}

export async function runE2R10ScreeningWorker(request, env, fetcher = fetch) {
  const url = new URL(request.url)
  if (!url.pathname.startsWith(E2_R10_SCREENING_ENDPOINT_PREFIX)) return json({ error: 'NOT_FOUND' }, 404)
  const suffix = url.pathname.slice(E2_R10_SCREENING_ENDPOINT_PREFIX.length)
  const authorization = await authorize(request, env, { requireModel: suffix === 'generate' })
  if (authorization.error) return json({ error: authorization.error, modelCalls: 0 }, authorization.status)

  if (suffix === 'contract' && request.method === 'GET') return json(screeningContract(env))
  if (suffix === 'register' && request.method === 'POST') {
    const parsed = await parseJsonBody(request)
    if (parsed.error) return json({ error: parsed.error }, parsed.status)
    const error = validateRegistration(parsed.body)
    if (error
      || parsed.body.protocolBundleSha256 !== safeText(env.E2_R10_SCREENING_PROTOCOL_BUNDLE_SHA256, 64)
      || parsed.body.caseManifestSha256 !== safeText(env.E2_R10_SCREENING_CASE_MANIFEST_SHA256, 64)) return json({ error: error ?? 'REGISTRATION_BINDING_MISMATCH' }, 412)
    const ledger = await ledgerRequest(env, authorization, '/register', { body: parsed.body })
    return json(ledger.payload, ledger.response.status, ledger.response.headers.get('x-idempotent-replay') === 'true' ? { 'x-idempotent-replay': 'true' } : {})
  }
  if (suffix === 'state' && request.method === 'GET') {
    const ledger = await ledgerRequest(env, authorization, '/state', { method: 'GET' })
    return json(ledger.payload, ledger.response.status)
  }
  if (suffix === 'generate' && request.method === 'POST') return handleGenerate(request, env, authorization, fetcher)
  if (['selection', 'blind', 'production'].includes(suffix)) return json({ error: 'STAGE_NOT_AUTHORIZED', stage: suffix, modelCalls: 0 }, 412)
  return json({ error: 'NOT_FOUND', modelCalls: 0 }, 404)
}

export default { fetch: runE2R10ScreeningWorker }
