export const E2_R4_TRANSPORT_POLICY_VERSION = 'e2-9-r4-transport-policy-3.2.0'

function safeHeader(headers, name) {
  const value = headers && typeof headers === 'object' ? headers[name] : null
  return typeof value === 'string' ? value.slice(0, 200) : null
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function extractEnvelopeModel(rawResponse) {
  const choicesAt = rawResponse.search(/"choices"\s*:/u)
  const prefix = choicesAt >= 0 ? rawResponse.slice(0, choicesAt) : rawResponse.slice(0, 2_000)
  return /(?:^|[,{}])\s*"model"\s*:\s*"([^"\\]{1,100})"/u.exec(prefix)?.[1] ?? null
}

function isStructurallyTruncated(rawResponse) {
  const trimmed = rawResponse.trim()
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return false
  try { JSON.parse(trimmed); return false } catch (error) {
    if (trimmed.endsWith('}') || trimmed.endsWith(']')) return false
    const message = error instanceof Error ? error.message : ''
    if (/unexpected end|unterminated string/iu.test(message)) return true
    const position = /position\s+(\d+)/iu.exec(message)?.[1]
    return /expected\s+.+\s+after/iu.test(message)
      && Number.isInteger(Number(position))
      && Number(position) >= trimmed.length
  }
}

export async function classifyR4Failure(error, execution, expectedModel) {
  const rawResponse = typeof execution?.rawResponse === 'string' ? execution.rawResponse : null
  const attempts = Array.isArray(execution?.attempts) ? execution.attempts : []
  const lastAttempt = attempts.at(-1) ?? null
  const contentType = safeHeader(execution?.upstreamHeaders, 'content-type')
  const observedModel = rawResponse === null ? null : extractEnvelopeModel(rawResponse)
  const responseSha256 = rawResponse === null ? null : await sha256(rawResponse)
  const truncationEvidence = error === 'UPSTREAM_JSON_INVALID'
    && rawResponse !== null
    && lastAttempt?.status === 200
    && lastAttempt?.transportStatus === 'response_received'
    && /^application\/json(?:\s*;|$)/iu.test(contentType ?? '')
    && observedModel === expectedModel
    && isStructurallyTruncated(rawResponse)
  let classification = 'MODEL_FAILURE'
  if (truncationEvidence) classification = 'UPSTREAM_JSON_TRUNCATED'
  else if (['UPSTREAM_JSON_INVALID', 'INVALID_AI_RESPONSE_JSON', 'INVALID_AI_RESPONSE_SCHEMA'].includes(error)) classification = 'MODEL_JSON_INVALID'
  else if (error === 'UPSTREAM_TIMEOUT' || error === 'UPSTREAM_NETWORK_ERROR') classification = 'TRANSPORT_FAILURE'
  else if (error === 'MODEL_FALLBACK_DETECTED' || error === 'SYSTEM_FINGERPRINT_MISSING' || error === 'TOKEN_USAGE_MISSING') classification = 'MODEL_IDENTITY_FAILURE'
  else if (/^UPSTREAM_(?:400|401|403|404|413|429)$/u.test(error ?? '')) classification = 'NON_RETRYABLE_UPSTREAM_FAILURE'
  else if (/^UPSTREAM_\d{3}$/u.test(error ?? '')) classification = 'UPSTREAM_HTTP_FAILURE'
  return {
    schemaVersion: E2_R4_TRANSPORT_POLICY_VERSION,
    classification,
    retryEligible: classification === 'UPSTREAM_JSON_TRUNCATED',
    providerResponseObserved: rawResponse !== null,
    providerResponseBytes: rawResponse === null ? null : new TextEncoder().encode(rawResponse).byteLength,
    providerResponseSha256: responseSha256,
    providerContentType: contentType,
    providerRequestIdPresent: Boolean(safeHeader(execution?.upstreamHeaders, 'request-id') || safeHeader(execution?.upstreamHeaders, 'x-request-id')),
    providerAttemptRecords: attempts.length,
    providerDurationMs: Number.isFinite(execution?.durationMs) ? execution.durationMs : null,
    providerHttpStatus: lastAttempt?.status ?? null,
    providerTransportStatus: lastAttempt?.transportStatus ?? null,
    expectedModel,
    observedEnvelopeModel: observedModel,
    structureEndedMidJson: rawResponse === null ? false : isStructurallyTruncated(rawResponse),
  }
}

export function attemptStatusForFailure(evidence) {
  if (evidence.classification === 'UPSTREAM_JSON_TRUNCATED') return 'upstream_json_truncated'
  if (evidence.classification === 'MODEL_JSON_INVALID') return 'model_json_invalid'
  if (evidence.classification === 'TRANSPORT_FAILURE' || evidence.classification === 'UPSTREAM_HTTP_FAILURE') return 'transport_failure'
  if (evidence.classification === 'MODEL_IDENTITY_FAILURE') return 'integrity_failure'
  return 'model_failure'
}
