const RUN_KEY = 'run'

function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store' } })
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function completed(record) {
  return record?.state === 'final' && record?.outcome === 'complete'
}

export class E2R2RunLedger {
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
      if (!safeObject(body) || typeof body.runLabel !== 'string' || typeof body.protocolVersion !== 'string'
        || !safeObject(body.bindings) || !Array.isArray(body.observations)) return json({ error: 'INVALID_REGISTRATION' }, 400)
      const ids = new Set()
      const expectedByPhase = { readiness: [], smoke: [], screening: [], selection: [], blind: [] }
      const expectedObservations = {}
      for (const item of body.observations) {
        if (!safeObject(item) || typeof item.observationId !== 'string' || !Object.hasOwn(expectedByPhase, item.phase) || ids.has(item.observationId)) return json({ error: 'INVALID_OBSERVATION_PLAN' }, 400)
        ids.add(item.observationId)
        expectedByPhase[item.phase].push(item.observationId)
        expectedObservations[item.observationId] = {
          phase: item.phase,
          modelAlias: item.modelAlias,
          inputSha256: item.inputSha256,
          phaseManifestSha256: item.phaseManifestSha256,
        }
      }
      if (expectedByPhase.readiness.length === 0 || expectedByPhase.smoke.length === 0 || expectedByPhase.screening.length === 0) return json({ error: 'REQUIRED_PHASE_EMPTY' }, 400)
      const created = {
        schemaVersion: 'e2.9-r2-run-ledger-3.0.0',
        runLabel: body.runLabel,
        protocolVersion: body.protocolVersion,
        bindings: body.bindings,
        expectedByPhase,
        expectedObservations,
        stage: 'READINESS_OPEN',
        stageHistory: [{ stage: 'READINESS_OPEN', at: new Date().toISOString() }],
        observations: {},
        createdAt: new Date().toISOString(),
      }
      await this.state.storage.put(RUN_KEY, created)
      return json(created, 201)
    }

    if (!run) return json({ error: 'RUN_NOT_REGISTERED' }, 404)
    if (url.pathname === '/state' && request.method === 'GET') return json(run)

    if (url.pathname === '/reserve' && request.method === 'POST') {
      const observationId = body?.observationId
      const phase = body?.phase
      const requiredStage = { readiness: 'READINESS_OPEN', smoke: 'SMOKE_OPEN', screening: 'SCREENING_OPEN', selection: 'SELECTION_OPEN', blind: 'BLIND_OPEN' }[phase]
      if (!requiredStage || run.stage !== requiredStage) return json({ error: 'PHASE_PREREQUISITE_NOT_MET', stage: run.stage }, 412)
      if (!run.expectedByPhase[phase]?.includes(observationId)) return json({ error: 'OBSERVATION_NOT_PREREGISTERED' }, 400)
      const expected = run.expectedObservations[observationId]
      if (expected.modelAlias !== body.modelAlias || expected.inputSha256 !== body.inputSha256 || expected.phaseManifestSha256 !== body.phaseManifestSha256) return json({ error: 'OBSERVATION_BINDING_MISMATCH' }, 412)
      if (run.observations[observationId]) return json({ error: 'OBSERVATION_ALREADY_EXISTS', record: run.observations[observationId] }, 409)
      const reservationToken = crypto.randomUUID()
      run.observations[observationId] = {
        observationId,
        phase,
        state: 'reserved',
        reservedAt: new Date().toISOString(),
        reservationToken,
        inputSha256: body.inputSha256 ?? null,
        modelAlias: body.modelAlias ?? null,
      }
      await this.state.storage.put(RUN_KEY, run)
      return json({ observationId, reservationToken }, 201)
    }

    if (url.pathname === '/finalize' && request.method === 'POST') {
      const record = run.observations[body?.observationId]
      if (!record || record.state !== 'reserved' || record.reservationToken !== body?.reservationToken) return json({ error: 'FINALIZE_NOT_ALLOWED' }, 409)
      run.observations[body.observationId] = {
        ...record,
        state: 'final',
        outcome: body.outcome === 'complete' ? 'complete' : 'failure',
        error: body.error ?? null,
        sourceSha256: body.sourceSha256 ?? null,
        rawOutputSha256: body.rawOutputSha256 ?? null,
        resultSha256: body.resultSha256 ?? null,
        requestedModel: body.requestedModel ?? null,
        returnedModel: body.returnedModel ?? null,
        executionModel: body.executionModel ?? null,
        resultModelName: body.resultModelName ?? null,
        transportEvidence: body.transportEvidence ?? null,
        finalizedAt: new Date().toISOString(),
      }
      delete run.observations[body.observationId].reservationToken
      await this.state.storage.put(RUN_KEY, run)
      return json(run.observations[body.observationId])
    }

    if (url.pathname === '/advance' && request.method === 'POST') {
      const transitions = {
        READINESS_OPEN: { next: 'SMOKE_OPEN', phase: 'readiness' },
        SMOKE_OPEN: { next: 'SCREENING_OPEN', phase: 'smoke' },
        SCREENING_OPEN: { next: 'SCORING_OPEN', phase: 'screening' },
        SCORING_OPEN: { next: 'SELECTION_OPEN', phase: 'scoring' },
        SELECTION_OPEN: { next: 'BLIND_OPEN', phase: 'selection' },
      }
      const transition = transitions[run.stage]
      if (!transition || body?.nextStage !== transition.next) return json({ error: 'INVALID_STAGE_TRANSITION', stage: run.stage }, 412)
      if (transition.phase === 'scoring') {
        if (body.gateStatus !== 'PASS' || typeof body.gateSha256 !== 'string') return json({ error: 'SCORING_GATE_NOT_PASSED' }, 412)
      } else if (transition.phase === 'selection') {
        if (body.selectionFrozen !== true || typeof body.selectionFreezeSha256 !== 'string') return json({ error: 'SELECTION_NOT_FROZEN' }, 412)
      } else {
        const expected = run.expectedByPhase[transition.phase] ?? []
        if (expected.length === 0 || expected.some((id) => !completed(run.observations[id]))) return json({ error: 'PHASE_OBSERVATIONS_INCOMPLETE', phase: transition.phase }, 412)
      }
      run.stage = transition.next
      run.stageHistory.push({ stage: transition.next, at: new Date().toISOString(), evidenceSha256: body.gateSha256 ?? body.selectionFreezeSha256 ?? null })
      await this.state.storage.put(RUN_KEY, run)
      return json({ stage: run.stage, stageHistory: run.stageHistory })
    }

    return json({ error: 'NOT_FOUND' }, 404)
  }
}

export default {
  async fetch(request, env) {
    const runLabel = request.headers.get('x-e2-r2-run-label') ?? ''
    if (!/^[a-z0-9][a-z0-9._-]{2,100}$/u.test(runLabel)) return json({ error: 'INVALID_RUN_LABEL' }, 400)
    const id = env.E2_R2_RUN_LEDGER.idFromName(runLabel)
    return env.E2_R2_RUN_LEDGER.get(id).fetch(request)
  },
}
