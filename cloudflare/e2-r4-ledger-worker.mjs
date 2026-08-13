const RUN_KEY = 'run'
const PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.2.0'
const TERMINAL_COMPLETE = new Set(['complete', 'complete_after_protocol_retry'])
const ATTEMPT_STATUSES = new Set(['complete', 'upstream_json_truncated', 'model_json_invalid', 'transport_failure', 'model_failure', 'integrity_failure', 'invalid_output'])

function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store' } })
}

function safeObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function deriveObservationStatus(record) {
  const attempts = record?.attempts ?? []
  const last = attempts.at(-1)
  if (!last) return null
  if (last.status === 'complete') {
    if (attempts.length === 1) return 'complete'
    return attempts.length === 2 && attempts[0].status === 'upstream_json_truncated' ? 'complete_after_protocol_retry' : null
  }
  if (last.status === 'upstream_json_truncated') return attempts.length === record.maxAttempts ? 'transport_integrity_failure' : null
  if (last.status === 'model_json_invalid') return 'model_json_invalid'
  if (last.status === 'integrity_failure') return 'integrity_failure'
  if (last.status === 'invalid_output') return 'invalid_output'
  if (last.status === 'transport_failure') return 'transport_failure'
  return 'model_failure'
}

function deriveRunStatus(run) {
  const records = Object.values(run.observations)
  const statuses = records.map((record) => record.status).filter(Boolean)
  if (statuses.includes('integrity_failure')) return 'INTEGRITY_FAILED'
  if (statuses.some((status) => !TERMINAL_COMPLETE.has(status))) return 'BLOCKED'
  if (records.some((record) => record.state === 'running')) return 'RUNNING'
  if (run.expectedObservationCount > 0 && records.length === run.expectedObservationCount && statuses.length === records.length && statuses.every((status) => TERMINAL_COMPLETE.has(status))) return 'COMPLETE'
  return records.length ? 'PARTIAL' : 'RUNNING'
}

function publicRun(run) {
  return { ...run, runStatus: deriveRunStatus(run) }
}

function phaseComplete(run, phase) {
  const expected = run.expectedByPhase[phase] ?? []
  return expected.length > 0 && expected.every((id) => TERMINAL_COMPLETE.has(run.observations[id]?.status))
}

export class E2R4RunLedger {
  constructor(state) {
    this.state = state
  }

  async readBody(request) {
    try { return await request.json() } catch { return null }
  }

  async fetch(request) {
    const url = new URL(request.url)
    const body = request.method === 'POST' ? await this.readBody(request) : null
    const run = await this.state.storage.get(RUN_KEY)

    if (url.pathname === '/register' && request.method === 'POST') {
      if (run) return json({ error: 'RUN_LABEL_ALREADY_REGISTERED' }, 409)
      if (!safeObject(body) || body.protocolVersion !== PROTOCOL_VERSION || typeof body.runLabel !== 'string'
        || typeof body.runManifestSha256 !== 'string' || !safeObject(body.bindings) || !Array.isArray(body.observations)) return json({ error: 'INVALID_REGISTRATION' }, 400)
      const ids = new Set()
      const expectedByPhase = { readiness: [], smoke: [], screening: [] }
      const expectedObservations = {}
      for (const item of body.observations) {
        const expectedMaxAttempts = item.phase === 'readiness' ? 1 : 2
        if (!safeObject(item) || typeof item.observationId !== 'string' || !Object.hasOwn(expectedByPhase, item.phase)
          || ids.has(item.observationId) || item.maxAttempts !== expectedMaxAttempts) return json({ error: 'INVALID_OBSERVATION_PLAN' }, 400)
        ids.add(item.observationId)
        expectedByPhase[item.phase].push(item.observationId)
        expectedObservations[item.observationId] = {
          phase: item.phase,
          modelAlias: item.modelAlias,
          inputSha256: item.inputSha256,
          phaseManifestSha256: item.phaseManifestSha256,
          maxAttempts: item.maxAttempts,
        }
      }
      if (expectedByPhase.readiness.length !== 6 || expectedByPhase.smoke.length !== 10 || expectedByPhase.screening.length !== 16) return json({ error: 'OBSERVATION_PLAN_CARDINALITY_INVALID' }, 400)
      const created = {
        schemaVersion: 'e2.9-r4-run-ledger-3.2.0', protocolVersion: PROTOCOL_VERSION,
        runLabel: body.runLabel, runManifestSha256: body.runManifestSha256, bindings: body.bindings,
        expectedByPhase, expectedObservations, expectedObservationCount: ids.size,
        stage: 'READINESS_OPEN', stageHistory: [{ stage: 'READINESS_OPEN', at: new Date().toISOString() }],
        observations: {}, createdAt: new Date().toISOString(),
      }
      await this.state.storage.put(RUN_KEY, created)
      return json(publicRun(created), 201)
    }

    if (!run) return json({ error: 'RUN_NOT_REGISTERED' }, 404)
    if (url.pathname === '/state' && request.method === 'GET') return json(publicRun(run))

    if (url.pathname === '/reserve' && request.method === 'POST') {
      const observationId = body?.observationId
      const phase = body?.phase
      const requiredStage = { readiness: 'READINESS_OPEN', smoke: 'SMOKE_OPEN', screening: 'SCREENING_OPEN' }[phase]
      if (!requiredStage || run.stage !== requiredStage) return json({ error: 'PHASE_PREREQUISITE_NOT_MET', stage: run.stage }, 412)
      if (!run.expectedByPhase[phase]?.includes(observationId)) return json({ error: 'OBSERVATION_NOT_PREREGISTERED' }, 400)
      const expected = run.expectedObservations[observationId]
      if (expected.modelAlias !== body.modelAlias || expected.inputSha256 !== body.inputSha256 || expected.phaseManifestSha256 !== body.phaseManifestSha256) return json({ error: 'OBSERVATION_BINDING_MISMATCH' }, 412)
      if (run.observations[observationId]) return json({ error: 'OBSERVATION_ALREADY_EXISTS', record: run.observations[observationId] }, 409)
      const reservationToken = crypto.randomUUID()
      run.observations[observationId] = {
        observationId, phase, state: 'running', status: null, attempts: [], maxAttempts: expected.maxAttempts,
        reservedAt: new Date().toISOString(), reservationToken, inputSha256: body.inputSha256, modelAlias: body.modelAlias,
      }
      await this.state.storage.put(RUN_KEY, run)
      return json({ observationId, reservationToken }, 201)
    }

    if (url.pathname === '/attempt' && request.method === 'POST') {
      const record = run.observations[body?.observationId]
      if (!record || record.state !== 'running' || record.reservationToken !== body?.reservationToken) return json({ error: 'ATTEMPT_NOT_ALLOWED' }, 409)
      const attemptNumber = record.attempts.length + 1
      if (body.attemptNumber !== attemptNumber || attemptNumber > record.maxAttempts || !ATTEMPT_STATUSES.has(body.status)) return json({ error: 'ATTEMPT_SEQUENCE_INVALID' }, 409)
      if (attemptNumber === 2 && record.attempts[0]?.status !== 'upstream_json_truncated') return json({ error: 'UNAUTHORIZED_PROTOCOL_RETRY' }, 409)
      record.attempts.push({
        attemptNumber, status: body.status, error: body.error ?? null, httpStatus: body.httpStatus ?? null,
        requestedModel: body.requestedModel ?? null, returnedModel: body.returnedModel ?? null,
        deploymentVersion: body.deploymentVersion ?? null,
        responseSha256: body.responseSha256 ?? null, resultSha256: body.resultSha256 ?? null,
        durationMs: Number.isFinite(body.durationMs) ? body.durationMs : null,
        transportEvidence: body.transportEvidence ?? null, recordedAt: new Date().toISOString(),
      })
      await this.state.storage.put(RUN_KEY, run)
      return json({ observationId: record.observationId, attempts: record.attempts })
    }

    if (url.pathname === '/finalize' && request.method === 'POST') {
      const record = run.observations[body?.observationId]
      if (!record || record.state !== 'running' || record.reservationToken !== body?.reservationToken) return json({ error: 'FINALIZE_NOT_ALLOWED' }, 409)
      const status = deriveObservationStatus(record)
      if (!status) return json({ error: 'FINAL_STATUS_NOT_DERIVABLE' }, 409)
      record.state = 'final'
      record.status = status
      record.sourceSha256 = body.sourceSha256 ?? null
      record.rawOutputSha256 = body.rawOutputSha256 ?? null
      record.resultSha256 = body.resultSha256 ?? null
      record.requestedModel = body.requestedModel ?? null
      record.returnedModel = body.returnedModel ?? null
      record.executionModel = body.executionModel ?? null
      record.resultModelName = body.resultModelName ?? null
      record.deploymentVersion = body.deploymentVersion ?? null
      record.finalizedAt = new Date().toISOString()
      delete record.reservationToken
      await this.state.storage.put(RUN_KEY, run)
      return json({ ...record, runStatus: deriveRunStatus(run) })
    }

    if (url.pathname === '/advance' && request.method === 'POST') {
      const transitions = {
        READINESS_OPEN: { next: 'SMOKE_OPEN', phase: 'readiness' },
        SMOKE_OPEN: { next: 'SCREENING_OPEN', phase: 'smoke' },
        SCREENING_OPEN: { next: 'PATH_MASK_PREVIEW_OPEN', phase: 'screening' },
      }
      const transition = transitions[run.stage]
      if (!transition || body?.nextStage !== transition.next) return json({ error: 'INVALID_STAGE_TRANSITION', stage: run.stage }, 412)
      if (!phaseComplete(run, transition.phase)) return json({ error: 'PHASE_OBSERVATIONS_INCOMPLETE', phase: transition.phase, runStatus: deriveRunStatus(run) }, 412)
      run.stage = transition.next
      run.stageHistory.push({ stage: transition.next, at: new Date().toISOString() })
      await this.state.storage.put(RUN_KEY, run)
      return json({ stage: run.stage, stageHistory: run.stageHistory, runStatus: deriveRunStatus(run) })
    }

    return json({ error: 'NOT_FOUND' }, 404)
  }
}

export default {
  async fetch(request, env) {
    const runLabel = request.headers.get('x-e2-r4-run-label') ?? ''
    if (!/^[a-z0-9][a-z0-9._-]{2,100}$/u.test(runLabel)) return json({ error: 'INVALID_RUN_LABEL' }, 400)
    const id = env.E2_R4_RUN_LEDGER.idFromName(runLabel)
    return env.E2_R4_RUN_LEDGER.get(id).fetch(request)
  },
}
