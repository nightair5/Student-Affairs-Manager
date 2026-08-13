export const E2_R2_TRANSPORT_INTEGRITY_VERSION = 'e2-9-r2-transport-integrity-1.0.0'

function safeHeader(headers, name) {
  const value = headers && typeof headers === 'object' ? headers[name] : null
  return typeof value === 'string' ? value.slice(0, 200) : null
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function classifyInvalidJson(rawResponse) {
  const trimmed = rawResponse.trim()
  if (!trimmed) return 'EMPTY_RESPONSE_BODY'
  if (trimmed.startsWith('<')) return 'NON_JSON_HTML_BODY'
  const startsWithJsonToken = trimmed.startsWith('{') || trimmed.startsWith('[')
  const endsWithJsonToken = trimmed.endsWith('}') || trimmed.endsWith(']')
  if (startsWithJsonToken && !endsWithJsonToken) return 'TRUNCATED_JSON_BODY'
  return startsWithJsonToken ? 'MALFORMED_JSON_BODY' : 'NON_JSON_BODY'
}

export async function diagnoseR2UpstreamFailure(error, execution) {
  const rawResponse = typeof execution?.rawResponse === 'string' ? execution.rawResponse : null
  const attempts = Array.isArray(execution?.attempts) ? execution.attempts : []
  const evidence = {
    schemaVersion: E2_R2_TRANSPORT_INTEGRITY_VERSION,
    wrapperUpstreamInvocationCount: 1,
    providerAttemptRecords: attempts.length,
    providerResponseObserved: rawResponse !== null,
    providerResponseBytes: rawResponse === null ? null : new TextEncoder().encode(rawResponse).byteLength,
    providerResponseSha256: rawResponse === null ? null : await sha256(rawResponse),
    providerContentType: safeHeader(execution?.upstreamHeaders, 'content-type'),
    providerRequestIdPresent: Boolean(safeHeader(execution?.upstreamHeaders, 'request-id') || safeHeader(execution?.upstreamHeaders, 'x-request-id')),
    classification: 'UNCLASSIFIED_UPSTREAM_FAILURE',
  }
  if (error === 'UPSTREAM_JSON_INVALID' && rawResponse !== null) evidence.classification = classifyInvalidJson(rawResponse)
  else if (error === 'UPSTREAM_TIMEOUT') evidence.classification = 'UPSTREAM_TIMEOUT'
  else if (/^UPSTREAM_\d{3}$/u.test(error ?? '')) evidence.classification = 'UPSTREAM_HTTP_ERROR'
  else if (error === 'UPSTREAM_NETWORK_ERROR') evidence.classification = 'UPSTREAM_NETWORK_ERROR'
  return evidence
}
