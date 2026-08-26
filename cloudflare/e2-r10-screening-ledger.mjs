import {
  E2_R10_SCREENING_LEDGER_VERSION,
  E2_R10_SCREENING_PROTOCOL_VERSION,
  E2_R10_SCREENING_RUN_LABEL,
  constantTimeHexEqual,
  sha256Text,
  validSha256,
  validateRegistration,
} from './e2-r10-screening-contract.mjs'

const RUN_KEY = 'screening-run'
const TERMINAL_STATUSES = new Set(['complete', 'model_failure', 'transport_failure', 'integrity_failure', 'invalid_output'])
const INTERNAL_AUTHORIZATION_HEADER = 'x-e2-r10-screening-ledger-authorized'
const INTERNAL_AUTHORIZATION_VALUE = 'screening-ledger-service-binding-v1'
const RESERVATION_LEASE_MS = 10 * 60 * 1000

function json(value, status = 200, headers = {}) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store', ...headers } })
}

async function authorized(request, env) {
  const expectedHash = typeof env.E2_R10_SCREENING_LEDGER_CALLER_TOKEN_SHA256 === 'string'
    ? env.E2_R10_SCREENING_LEDGER_CALLER_TOKEN_SHA256.trim()
    : ''
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  return token.length >= 32 && validSha256(expectedHash)
    && constantTimeHexEqual(await sha256Text(token), expectedHash)
}

function publicState(run) {
  const observations = Object.values(run.observations)
  const complete = observations.length === 16 && observations.every((item) => item.state === 'final' && item.status === 'complete')
  const failed = observations.some((item) => item.state === 'final' && item.status !== 'complete')
  const running = observations.some((item) => item.state === 'running')
  return {
    ...run,
    runStatus: failed ? 'FAILED' : complete ? 'GENERATION_COMPLETE' : running ? 'RUNNING' : observations.length ? 'PARTIAL' : 'REGISTERED',
  }
}

export class E2R10ScreeningLedger {
  constructor(state) {
    this.state = state
  }

  async fetch(request) {
    if (request.headers.get(INTERNAL_AUTHORIZATION_HEADER) !== INTERNAL_AUTHORIZATION_VALUE) return json({ error: 'INTERNAL_CALL_REQUIRED' }, 401)
    const url = new URL(request.url)
    const body = request.method === 'POST' ? await request.json().catch(() => null) : null
    const run = await this.state.storage.get(RUN_KEY)

    if (url.pathname === '/register' && request.method === 'POST') {
      const error = validateRegistration(body)
      if (error) return json({ error }, 400)
      if (run) {
        const same = JSON.stringify(run.registration) === JSON.stringify(body)
        return same
          ? json(publicState(run), 200, { 'x-idempotent-replay': 'true' })
          : json({ error: 'RUN_LABEL_ALREADY_REGISTERED' }, 409)
      }
      const expected = Object.fromEntries(body.observations.map((item) => [item.observationId, item]))
      const created = {
        schemaVersion: E2_R10_SCREENING_LEDGER_VERSION,
        protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
        runLabel: E2_R10_SCREENING_RUN_LABEL,
        registration: body,
        expected,
        observations: {},
        generationCallCap: 16,
        createdAt: new Date().toISOString(),
      }
      await this.state.storage.put(RUN_KEY, created)
      return json(publicState(created), 201)
    }

    if (!run) return json({ error: 'RUN_NOT_REGISTERED' }, 404)
    if (url.pathname === '/state' && request.method === 'GET') return json(publicState(run))

    if (url.pathname === '/reserve' && request.method === 'POST') {
      const expected = run.expected[body?.observationId]
      if (!expected) return json({ error: 'OBSERVATION_NOT_PREREGISTERED' }, 400)
      if (run.observations[body.observationId]) return json({ error: 'OBSERVATION_ALREADY_EXISTS', record: run.observations[body.observationId] }, 409)
      const bindingKeys = ['observationIndex', 'caseId', 'arm', 'sourceSha256', 'inputSha256']
      if (bindingKeys.some((key) => expected[key] !== body[key])) return json({ error: 'OBSERVATION_BINDING_MISMATCH' }, 412)
      const records = Object.values(run.observations)
      const running = records.find((item) => item.state === 'running')
      if (running) {
        const reservedAt = new Date(running.reservedAt).getTime()
        if (Number.isFinite(reservedAt) && Date.now() - reservedAt >= RESERVATION_LEASE_MS) {
          Object.assign(running, {
            state: 'final',
            status: 'integrity_failure',
            error: 'RESERVATION_LEASE_EXPIRED',
            finalizedAt: new Date().toISOString(),
          })
          delete running.reservationToken
          await this.state.storage.put(RUN_KEY, run)
          return json({ error: 'RUN_TERMINAL_FAILURE', record: running }, 412)
        }
        return json({ error: 'PREVIOUS_OBSERVATION_RUNNING', record: running }, 409)
      }
      if (records.some((item) => item.state === 'final' && item.status !== 'complete')) {
        return json({ error: 'RUN_TERMINAL_FAILURE' }, 412)
      }
      const completedIndices = new Set(records.filter((item) => item.state === 'final' && item.status === 'complete')
        .map((item) => item.observationIndex))
      if (body.observationIndex !== completedIndices.size + 1
        || Array.from({ length: body.observationIndex - 1 }, (_, index) => index + 1)
          .some((index) => !completedIndices.has(index))) return json({ error: 'OBSERVATION_SEQUENCE_VIOLATION' }, 412)
      if (Object.keys(run.observations).length >= run.generationCallCap) return json({ error: 'GENERATION_CALL_CAP_REACHED' }, 412)
      const reservationToken = crypto.randomUUID()
      run.observations[body.observationId] = {
        ...expected,
        state: 'running',
        status: null,
        reservationToken,
        reservedAt: new Date().toISOString(),
      }
      await this.state.storage.put(RUN_KEY, run)
      return json({ observationId: body.observationId, reservationToken, modelCallOrdinal: Object.keys(run.observations).length }, 201)
    }

    if (url.pathname === '/finalize' && request.method === 'POST') {
      const record = run.observations[body?.observationId]
      if (!record || record.state !== 'running' || record.reservationToken !== body?.reservationToken) return json({ error: 'FINALIZE_NOT_ALLOWED' }, 409)
      if (!TERMINAL_STATUSES.has(body.status)) return json({ error: 'FINAL_STATUS_INVALID' }, 400)
      if (body.status === 'complete') {
        const names = [body.requestedModel, body.returnedModel, body.executionModel, body.resultModelName]
        if (new Set(names).size !== 1 || names[0] !== 'deepseek-v4-flash') {
          Object.assign(record, { state: 'final', status: 'integrity_failure', error: 'MODEL_LINEAGE_MISMATCH', finalizedAt: new Date().toISOString() })
          delete record.reservationToken
          await this.state.storage.put(RUN_KEY, run)
          return json({ error: 'MODEL_LINEAGE_MISMATCH', record, runStatus: publicState(run).runStatus }, 412)
        }
        if (body.sourceSha256 !== record.sourceSha256 || body.inputSha256 !== record.inputSha256
          || !validSha256(body.rawOutputSha256) || !validSha256(body.resultSha256)) {
          Object.assign(record, { state: 'final', status: 'integrity_failure', error: 'RESULT_BINDING_MISMATCH', finalizedAt: new Date().toISOString() })
          delete record.reservationToken
          await this.state.storage.put(RUN_KEY, run)
          return json({ error: 'RESULT_BINDING_MISMATCH', record, runStatus: publicState(run).runStatus }, 412)
        }
      }
      Object.assign(record, {
        state: 'final',
        status: body.status,
        error: body.error ?? null,
        requestedModel: body.requestedModel ?? null,
        returnedModel: body.returnedModel ?? null,
        executionModel: body.executionModel ?? null,
        resultModelName: body.resultModelName ?? null,
        rawOutputSha256: body.rawOutputSha256 ?? null,
        resultSha256: body.resultSha256 ?? null,
        ledgerSha256: body.ledgerSha256 ?? null,
        workerVersionId: body.workerVersionId ?? null,
        durationMs: Number.isFinite(body.durationMs) ? body.durationMs : null,
        finalizedAt: new Date().toISOString(),
      })
      delete record.reservationToken
      await this.state.storage.put(RUN_KEY, run)
      return json({ record, runStatus: publicState(run).runStatus })
    }

    return json({ error: 'NOT_FOUND' }, 404)
  }
}

export default {
  async fetch(request, env) {
    if (!await authorized(request, env)) return json({ error: 'UNAUTHORIZED' }, 401)
    const runLabel = request.headers.get('x-e2-r10-run-label') ?? ''
    if (runLabel !== E2_R10_SCREENING_RUN_LABEL) return json({ error: 'INVALID_RUN_LABEL' }, 400)
    if (!env.E2_R10_SCREENING_LEDGER
      || typeof env.E2_R10_SCREENING_LEDGER.idFromName !== 'function'
      || typeof env.E2_R10_SCREENING_LEDGER.get !== 'function') return json({ error: 'LEDGER_NAMESPACE_NOT_CONFIGURED' }, 503)
    const id = env.E2_R10_SCREENING_LEDGER.idFromName(runLabel)
    const headers = new Headers(request.headers)
    headers.delete('authorization')
    headers.set(INTERNAL_AUTHORIZATION_HEADER, INTERNAL_AUTHORIZATION_VALUE)
    return env.E2_R10_SCREENING_LEDGER.get(id).fetch(new Request(request, { headers }))
  },
}
