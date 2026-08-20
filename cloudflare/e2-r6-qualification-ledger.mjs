const RECORD_KEY = 'qualification'
const PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.4.0'
const REGISTRATION_FIELDS = new Set([
  'runLabel', 'protocolVersion', 'qualificationBundleSha256', 'qualificationResultSha256', 'qualificationResult',
])

function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store' } })
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

export class E2R6QualificationLedger {
  constructor(state) {
    this.state = state
  }

  async fetch(request) {
    const url = new URL(request.url)
    const existing = await this.state.storage.get(RECORD_KEY)

    if (url.pathname === '/record' && request.method === 'POST') {
      let body
      try { body = await request.json() } catch { return json({ error: 'INVALID_REQUEST' }, 400) }
      if (!onlyFields(body, REGISTRATION_FIELDS) || body.protocolVersion !== PROTOCOL_VERSION
        || !/^[a-z0-9][a-z0-9._-]{2,100}$/u.test(body.runLabel ?? '')
        || !validSha256(body.qualificationBundleSha256) || !validSha256(body.qualificationResultSha256)
        || !safeObject(body.qualificationResult)) return json({ error: 'QUALIFICATION_RECORD_INVALID' }, 400)
      if (body.qualificationResult.protocolVersion !== PROTOCOL_VERSION
        || body.qualificationResult.status !== 'HARNESS_QUALIFIED_FOR_FUTURE_PREFLIGHT'
        || body.qualificationResult.modelCalls !== 0 || body.qualificationResult.networkCalls !== 0
        || body.qualificationResult.qualificationBundleSha256 !== body.qualificationBundleSha256
        || await sha256(canonicalJson(body.qualificationResult)) !== body.qualificationResultSha256) {
        return json({ error: 'QUALIFICATION_RECORD_BINDING_INVALID' }, 412)
      }
      if (existing) {
        const identical = existing.qualificationBundleSha256 === body.qualificationBundleSha256
          && existing.qualificationResultSha256 === body.qualificationResultSha256
        return json({ error: identical ? 'QUALIFICATION_ALREADY_RECORDED' : 'QUALIFICATION_IMMUTABLE' }, 409)
      }
      const record = {
        schemaVersion: 'e2.9-r6-qualification-ledger-record-1.0.0',
        ...body,
        status: 'QUALIFICATION_RECORDED_MODEL_PHASES_LOCKED',
        recordedAt: new Date().toISOString(),
      }
      await this.state.storage.put(RECORD_KEY, record)
      return json(record, 201)
    }

    if (url.pathname === '/state' && request.method === 'GET') {
      return existing ? json(existing) : json({ error: 'QUALIFICATION_NOT_RECORDED' }, 404)
    }
    return json({ error: 'NOT_FOUND' }, 404)
  }
}

export default {
  async fetch(request, env) {
    const runLabel = request.headers.get('x-e2-r6-run-label') ?? ''
    if (!/^[a-z0-9][a-z0-9._-]{2,100}$/u.test(runLabel)) return json({ error: 'INVALID_RUN_LABEL' }, 400)
    const id = env.E2_R6_QUALIFICATION_LEDGER.idFromName(runLabel)
    return env.E2_R6_QUALIFICATION_LEDGER.get(id).fetch(request)
  },
}
