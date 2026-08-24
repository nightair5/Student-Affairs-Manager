import {
  E2_R10_PROTOCOL_VERSION,
  E2_R10_QUALIFICATION_VERSION,
  constantTimeHexEqual,
  sha256Text,
  validCommittedSha256,
  validRunLabel,
  validWorkerVersionId,
  validateQualificationRegistration,
} from './e2-r10-qualification-contract.mjs'

export const E2_R10_QUALIFICATION_LEDGER_VERSION = 'e2-r10-qualification-ledger-1.1.3'

const RECORD_KEY = 'qualification-record-v1'
const INTERNAL_VERSION_HEADER = 'x-e2-r10-ledger-worker-version-id'
const INTERNAL_BYTES_HEADER = 'x-e2-r10-ledger-worker-bytes-sha256'
const INTERNAL_CONFIG_HEADER = 'x-e2-r10-ledger-worker-config-sha256'

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

function safeText(value, limit) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '').trim().slice(0, limit)
    : ''
}

function internalDeploymentBinding(request) {
  const ledgerWorkerVersionId = safeText(request.headers.get(INTERNAL_VERSION_HEADER), 64)
  const ledgerWorkerBytesSha256 = safeText(request.headers.get(INTERNAL_BYTES_HEADER), 64)
  const ledgerWorkerConfigSha256 = safeText(request.headers.get(INTERNAL_CONFIG_HEADER), 64)
  if (!validWorkerVersionId(ledgerWorkerVersionId)
    || !validCommittedSha256(ledgerWorkerBytesSha256)
    || !validCommittedSha256(ledgerWorkerConfigSha256)) return null
  return { ledgerWorkerVersionId, ledgerWorkerBytesSha256, ledgerWorkerConfigSha256 }
}

function sameRegistration(record, registration) {
  return record.protocolBundleSha256 === registration.protocolBundleSha256
    && record.qualificationResultSha256 === registration.qualificationResultSha256
    && record.deploymentEvidenceSha256 === registration.deploymentEvidenceSha256
    && record.expectedWorkerVersionId === registration.expectedWorkerVersionId
}

export class E2R10QualificationLedger {
  constructor(state) {
    this.state = state
  }

  async fetch(request) {
    const url = new URL(request.url)
    const runLabel = request.headers.get('x-e2-r10-run-label') ?? ''
    if (!validRunLabel(runLabel)) return json({ error: 'INVALID_RUN_LABEL', modelCalls: 0 }, 400)
    const deploymentBinding = internalDeploymentBinding(request)
    if (!deploymentBinding) return json({ error: 'LEDGER_DEPLOYMENT_BINDING_INVALID', modelCalls: 0 }, 412)

    if (url.pathname === '/record') {
      if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED', modelCalls: 0 }, 405)
      if (!/^application\/json(?:\s*;|$)/iu.test(request.headers.get('content-type') ?? '')) {
        return json({ error: 'INVALID_CONTENT_TYPE', modelCalls: 0 }, 415)
      }
      let registration
      try {
        registration = await request.json()
      } catch {
        return json({ error: 'INVALID_REQUEST', modelCalls: 0 }, 400)
      }
      if (!await validateQualificationRegistration(registration)
        || registration.runLabel !== runLabel
        || registration.deploymentEvidence.ledgerWorkerVersionId !== deploymentBinding.ledgerWorkerVersionId
        || registration.deploymentEvidence.ledgerWorkerBytesSha256 !== deploymentBinding.ledgerWorkerBytesSha256
        || registration.deploymentEvidence.ledgerWorkerConfigSha256 !== deploymentBinding.ledgerWorkerConfigSha256) {
        return json({ error: 'QUALIFICATION_RECORD_INVALID', modelCalls: 0 }, 412)
      }
      if (!this.state.storage || typeof this.state.storage.transaction !== 'function') {
        return json({ error: 'LEDGER_TRANSACTION_UNAVAILABLE', modelCalls: 0 }, 503)
      }

      const outcome = await this.state.storage.transaction(async (transaction) => {
        const existing = await transaction.get(RECORD_KEY)
        if (existing) {
          return {
            kind: sameRegistration(existing, registration) ? 'IDEMPOTENT' : 'IMMUTABLE',
            record: existing,
          }
        }
        const passed = registration.qualificationResult.status === 'LOCAL_QUALIFIED_PREVIEW_UPLOAD_REQUESTABLE'
        const record = {
          ledgerSchemaVersion: 'e2.9-r10-qualification-ledger-record-1.1.0',
          ...registration,
          ledgerState: passed
            ? 'R10_QUALIFICATION_RECORDED_MODEL_PHASES_LOCKED'
            : 'R10_QUALIFICATION_FAILURE_RECORDED_MODEL_PHASES_LOCKED',
          recordedAt: new Date().toISOString(),
          modelCalls: 0,
        }
        await transaction.put(RECORD_KEY, record)
        return { kind: 'CREATED', record }
      })

      if (outcome.kind === 'IMMUTABLE') {
        return json({ error: 'QUALIFICATION_IMMUTABLE', modelCalls: 0 }, 409)
      }
      if (outcome.kind === 'IDEMPOTENT') {
        return json(outcome.record, 200, { 'x-idempotent-replay': 'true' })
      }
      return json(outcome.record, 201)
    }

    if (url.pathname === '/state') {
      if (request.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED', modelCalls: 0 }, 405)
      const existing = await this.state.storage.get(RECORD_KEY)
      return existing
        ? json(existing)
        : json({
          error: 'QUALIFICATION_NOT_RECORDED',
          protocolVersion: E2_R10_PROTOCOL_VERSION,
          qualificationVersion: E2_R10_QUALIFICATION_VERSION,
          modelCalls: 0,
        }, 404)
    }

    return json({ error: 'NOT_FOUND', modelCalls: 0 }, 404)
  }
}

async function authorizeCaller(request, env) {
  const expectedHash = safeText(env.E2_R10_LEDGER_CALLER_TOKEN_SHA256, 64)
  const authorization = safeText(request.headers.get('authorization'), 600)
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const suppliedHash = await sha256Text(token)
  return validCommittedSha256(expectedHash)
    && token.length >= 32
    && token.length <= 512
    && constantTimeHexEqual(suppliedHash, expectedHash)
}

export default {
  async fetch(request, env) {
    if (!await authorizeCaller(request, env)) return json({ error: 'LEDGER_CALLER_UNAUTHORIZED', modelCalls: 0 }, 401)
    const runLabel = request.headers.get('x-e2-r10-run-label') ?? ''
    if (!validRunLabel(runLabel)) return json({ error: 'INVALID_RUN_LABEL', modelCalls: 0 }, 400)
    const ledgerWorkerVersionId = safeText(env.CF_VERSION_METADATA?.id, 64)
    const ledgerWorkerBytesSha256 = safeText(env.E2_R10_LEDGER_WORKER_BYTES_SHA256, 64)
    const ledgerWorkerConfigSha256 = safeText(env.E2_R10_LEDGER_WORKER_CONFIG_SHA256, 64)
    if (!validWorkerVersionId(ledgerWorkerVersionId)
      || !validCommittedSha256(ledgerWorkerBytesSha256)
      || !validCommittedSha256(ledgerWorkerConfigSha256)) {
      return json({ error: 'LEDGER_DEPLOYMENT_BINDING_INVALID', modelCalls: 0 }, 503)
    }
    if (!env.E2_R10_QUALIFICATION_LEDGER
      || typeof env.E2_R10_QUALIFICATION_LEDGER.idFromName !== 'function'
      || typeof env.E2_R10_QUALIFICATION_LEDGER.get !== 'function') {
      return json({ error: 'LEDGER_NAMESPACE_NOT_CONFIGURED', modelCalls: 0 }, 503)
    }
    const id = env.E2_R10_QUALIFICATION_LEDGER.idFromName(runLabel)
    const headers = new Headers(request.headers)
    headers.delete('authorization')
    headers.set(INTERNAL_VERSION_HEADER, ledgerWorkerVersionId)
    headers.set(INTERNAL_BYTES_HEADER, ledgerWorkerBytesSha256)
    headers.set(INTERNAL_CONFIG_HEADER, ledgerWorkerConfigSha256)
    return env.E2_R10_QUALIFICATION_LEDGER.get(id).fetch(new Request(request, { headers }))
  },
}
