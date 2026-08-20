import assert from 'node:assert/strict'
import test from 'node:test'
import {
  evaluateR7ScreeningGate,
  summarizeR7PathMaskedLabels,
  validateR7PacketAudit,
} from './run-e2-9-r7-path-masked-review.mjs'

test('R7 packet audit rejects any identity disclosure', () => {
  const audit = {
    canIdentifyEitherPath: false,
    deterministicCorrelators: [],
    directIdentityDisclosures: [],
    packetSha256: 'a'.repeat(64),
    reason: 'No identity disclosures or deterministic correlators were found.',
    reviewProcessId: 'fresh-review-r7-001',
    reviewedAt: '2026-08-21T00:00:00.000Z',
    reviewerKind: 'independent_fresh_read_only',
    verdict: 'PASS',
  }
  assert.doesNotThrow(() => validateR7PacketAudit(audit, audit.packetSha256))
  audit.directIdentityDisclosures.push('modelName')
  assert.throws(() => validateR7PacketAudit(audit, audit.packetSha256), /R7_PATH_MASK_AUDIT_FAILED/u)
})

test('R7 reveal summary maps anonymous sides after label freeze', () => {
  const labels = [
    { caseAnonymousId: 'review-case-001', preferredSide: 'X', xMajor: false, yMajor: true, xPlanningError: false, yPlanningError: true },
    { caseAnonymousId: 'review-case-002', preferredSide: 'TIE', xMajor: false, yMajor: false, xPlanningError: false, yPlanningError: false },
  ]
  const mappings = [
    { caseAnonymousId: 'review-case-001', X: 'pro', Y: 'flash' },
    { caseAnonymousId: 'review-case-002', X: 'flash', Y: 'pro' },
  ]
  assert.deepEqual(summarizeR7PathMaskedLabels(labels, mappings), {
    proPreferred: 1, flashPreferred: 0, tie: 1, insufficient: 0,
    proMajor: 0, flashMajor: 1, proPlanningError: 0, flashPlanningError: 1,
  })
})

test('R7 Gate requires at least two Pro wins and no more than one clear regression', () => {
  const arm = { strict: { taskRecall: 0.875, taskPrecision: 0.875, evidenceCoverage: 1, severeErrorRate: 0, planningErrorRate: 0.75, promptInjectionPass: true } }
  const aggregate = { arms: { flash: structuredClone(arm), pro: structuredClone(arm) } }
  aggregate.arms.flash.strict.planningErrorRate = 0.875
  const checkpoint = { observations: Array.from({ length: 16 }, () => ({ status: 'complete' })) }
  const counts = { proPreferred: 2, flashPreferred: 1, proPlanningError: 3, flashPlanningError: 4 }
  assert.equal(evaluateR7ScreeningGate({ aggregate, counts, checkpoint }).pass, true)
  counts.flashPreferred = 2
  assert.equal(evaluateR7ScreeningGate({ aggregate, counts, checkpoint }).pass, false)
})
