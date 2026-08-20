import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateR6ScreeningGate, summarizePathMaskedLabels, validatePacketAudit } from './run-e2-9-r6-path-masked-review.mjs'

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
  const checkpoint = { observations: Array.from({ length: 16 }, () => ({ status: 'complete', requestedModel: 'same', response: { payload: { execution: { requestedModel: 'same', returnedModel: 'same', attempts: [{}] } } } })) }
  const counts = { proPreferred: 2, flashPreferred: 1, proPlanningError: 1, flashPlanningError: 2 }
  assert.equal(evaluateR6ScreeningGate({ aggregate, counts, checkpoint }).pass, true)
  counts.flashPreferred = 2
  assert.equal(evaluateR6ScreeningGate({ aggregate, counts, checkpoint }).pass, false)
})
