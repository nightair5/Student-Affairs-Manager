import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { canonicalJson } from './e2-9-r6-path-mask.mjs'
import { assertR6CompleteCheckpoint, evaluateR6ScreeningGate, summarizePathMaskedLabels, validatePacketAudit } from './run-e2-9-r6-path-masked-review.mjs'

const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex')
const PROTOCOL = 'e2-9-v4-pro-protocol-3.5.0'

function validObservation(index) {
  const modelAlias = index % 2 === 0 ? 'flash' : 'pro'
  const model = `deepseek-v4-${modelAlias}`
  const semanticRole = 'action_required'
  return {
    caseId: `case-${Math.floor(index / 2) + 1}`, modelAlias, status: 'complete', semanticRole, requestedModel: model,
    response: { payload: {
      benchmarkVersion: 'e2-v4-pro-benchmark-2.1.0', semanticRole,
      result: { modelName: model },
      execution: { requestedModel: model, returnedModel: model, executionModel: model, semanticRole, normalizer: 'e2-v4-pro-benchmark-normalizer-2.1.0', attempts: [{}] },
    } },
  }
}

function boundInputs() {
  const source = { screeningCases: Array.from({ length: 8 }, (_, index) => ({ caseId: `case-${index + 1}`, semanticRole: 'action_required' })) }
  const checkpoint = { protocolVersion: PROTOCOL, phase: 'screening', gateStatus: 'COMPLETE', expectedObservations: 16, sourceOnlySha256: sha256(canonicalJson(source)), observations: Array.from({ length: 16 }, (_, index) => validObservation(index)) }
  const checkpointRaw = JSON.stringify(checkpoint)
  const checkpointSha256 = sha256(checkpointRaw)
  const aggregate = {
    schemaVersion: 'e2.9-r6-anonymous-aggregate-1.0.0', protocolVersion: PROTOCOL, phase: 'screening',
    sourceOnlySha256: checkpoint.sourceOnlySha256, checkpointSha256,
    scorerInputSha256: sha256(canonicalJson({ checkpointSha256, phase: 'screening' })),
    expectedReadBoundary: 'Expected fixtures loaded only by this scorer after all paired outputs were complete.',
    scorerVersion: 'e2-9-r6-strict-scorer-1.0.0', recognitionSchemaVersion: '2.0',
  }
  return { checkpoint, source, checkpointRaw, aggregate }
}

test('R6 packet audit contract preserves empty forensic finding arrays', () => {
  const audit = {
    canIdentifyEitherPath: false,
    deterministicCorrelators: [],
    directIdentityDisclosures: [],
    packetSha256: 'a'.repeat(64),
    reason: 'No identity disclosures or deterministic correlators were found.',
    reviewProcessId: 'fresh-review-001',
    reviewedAt: '2026-08-20T00:00:00.000Z',
    reviewerKind: 'independent_fresh_read_only',
    verdict: 'PASS',
  }
  assert.doesNotThrow(() => validatePacketAudit(audit, audit.packetSha256))
  audit.directIdentityDisclosures.push('modelName')
  assert.throws(() => validatePacketAudit(audit, audit.packetSha256), /R6_PATH_MASK_AUDIT_FAILED/u)
})

test('R6 Screening review summary maps anonymous sides only after reveal', () => {
  const labels = [
    { caseAnonymousId: 'review-case-001', preferredSide: 'X', xMajor: false, yMajor: true, xPlanningError: false, yPlanningError: true },
    { caseAnonymousId: 'review-case-002', preferredSide: 'TIE', xMajor: false, yMajor: false, xPlanningError: false, yPlanningError: false },
  ]
  const mappings = [
    { caseAnonymousId: 'review-case-001', X: 'pro', Y: 'flash' },
    { caseAnonymousId: 'review-case-002', X: 'flash', Y: 'pro' },
  ]
  assert.deepEqual(summarizePathMaskedLabels(labels, mappings), {
    proPreferred: 1, flashPreferred: 0, tie: 1, insufficient: 0,
    proMajor: 0, flashMajor: 1, proPlanningError: 0, flashPlanningError: 1,
  })
})

test('R6 Screening Gate requires real planning improvement and bounded blind degradation', () => {
  const arm = { strict: { taskRecall: 0.8, taskPrecision: 0.9, evidenceCoverage: 1, severeErrorRate: 0, planningErrorRate: 0.5, promptInjectionPass: true } }
  const aggregate = { arms: { flash: structuredClone(arm), pro: structuredClone(arm) } }
  aggregate.arms.flash.strict.planningErrorRate = 0.75
  const checkpoint = { observations: Array.from({ length: 16 }, (_, index) => validObservation(index)) }
  const counts = { proPreferred: 2, flashPreferred: 1, proPlanningError: 1, flashPlanningError: 2 }
  assert.equal(evaluateR6ScreeningGate({ aggregate, counts, checkpoint }).pass, true)
  counts.flashPreferred = 2
  assert.equal(evaluateR6ScreeningGate({ aggregate, counts, checkpoint }).pass, false)
})

test('R6 Screening input guard rejects protocol, semantic-role and four-way lineage drift', () => {
  const input = boundInputs()
  assert.doesNotThrow(() => assertR6CompleteCheckpoint(input.checkpoint, input.source, input.checkpointRaw, input.aggregate))
  for (const mutate of [
    (value) => { value.checkpoint.protocolVersion = 'old-protocol' },
    (value) => { value.checkpoint.observations[0].response.payload.semanticRole = 'information_only' },
    (value) => { value.checkpoint.observations[0].response.payload.execution.executionModel = 'deepseek-v4-pro' },
    (value) => { value.checkpoint.observations[0].response.payload.result.modelName = 'deepseek-v4-pro' },
    (value) => { value.checkpoint.observations[0].semanticRole = 'information_only'; value.checkpoint.observations[0].response.payload.semanticRole = 'information_only'; value.checkpoint.observations[0].response.payload.execution.semanticRole = 'information_only' },
    (value) => { value.checkpoint.observations[0].modelAlias = 'experimental' },
    (value) => { value.aggregate.scorerVersion = 'unknown-scorer' },
    (value) => { value.aggregate.schemaVersion = 'forged-schema' },
    (value) => { value.aggregate.sourceOnlySha256 = '0'.repeat(64) },
    (value) => { value.aggregate.scorerInputSha256 = '0'.repeat(64) },
    (value) => { value.aggregate.expectedReadBoundary = 'FORGED' },
  ]) {
    const drifted = structuredClone(input)
    mutate(drifted)
    assert.throws(() => assertR6CompleteCheckpoint(drifted.checkpoint, drifted.source, drifted.checkpointRaw, drifted.aggregate), /R6_SCREENING_/u)
  }
})
