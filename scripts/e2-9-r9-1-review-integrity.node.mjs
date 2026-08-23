import assert from 'node:assert/strict'
import test from 'node:test'
import { buildR9ReviewerPacket, buildR9SeparatedPair } from './e2-9-r9-path-mask.mjs'
import {
  buildR91RevealVerificationBundle, evaluateR91ReviewGate,
  projectR91RevealVerificationPublic, verifyR91RevealVerificationBundle,
} from './e2-9-r9-1-review-integrity.mjs'

const SECRET = 'r9.1-reveal-secret-'.padEnd(80, 'z')
const source = {
  sourceType: 'text', sourceTitle: '通用通知', content: '请完成通用事项。',
  referenceTime: '2026-08-24T00:00:00+08:00', timezone: 'Asia/Shanghai',
}
const result = {
  sourceSummary: { title: '通用通知', sourceType: 'text', notificationType: 'teacher_task', summary: '摘要', requiresAction: true, actionReason: '需行动' },
  standaloneTasks: [],
}

function reviewFixture() {
  const separated = Array.from({ length: 16 }, (_, index) => buildR9SeparatedPair({
    revealSecret: SECRET, runId: 'r9.1-test', anonymousId: `review-case-${String(index + 1).padStart(3, '0')}`,
    observationId: `observation-${index + 1}`, caseId: `case-${Math.floor(index / 2) + 1}`,
    source, baseline: result, candidate: result,
  }))
  return {
    packet: buildR9ReviewerPacket(separated.map((item) => item.reviewerPair)),
    privateBindings: separated.map((item) => item.privateBinding),
    commitments: separated.map((item) => ({
      caseAnonymousId: item.privateBinding.caseAnonymousId,
      commitment: item.privateBinding.commitment,
    })),
  }
}

function passingCounts() {
  return {
    candidatePreferred: 8, baselinePreferred: 1, tie: 7, insufficient: 0,
    candidateMajor: 3, baselineMajor: 9, candidatePlanningError: 4, baselinePlanningError: 9,
    candidateFactLoss: 0, baselineFactLoss: 2, candidateOverSplit: 0, baselineOverSplit: 0,
    candidateEvidenceGap: 0, baselineEvidenceGap: 0, candidateSevereError: 0, baselineSevereError: 0,
  }
}

test('R9.1 Gate treats the zero-loss ceiling as a diagnostic, not an always-true check', () => {
  const counts = passingCounts()
  const ordinary = evaluateR91ReviewGate(counts, 16)
  assert.equal(ordinary.pass, true)
  assert.equal(ordinary.diagnostics.factLossCeilingObserved, false)
  assert.equal(Object.hasOwn(ordinary.checks, 'zeroFactLossTiePasses'), false)
  counts.baselineFactLoss = 0
  const ceiling = evaluateR91ReviewGate(counts, 16)
  assert.equal(ceiling.pass, true)
  assert.equal(ceiling.diagnostics.factLossCeilingObserved, true)
  counts.candidateFactLoss = 1
  assert.equal(evaluateR91ReviewGate(counts, 16).pass, false)
})

test('R9.1 reveal bundle can only be created after labels are frozen', () => {
  const fixture = reviewFixture()
  assert.throws(() => buildR91RevealVerificationBundle({
    revealSecret: SECRET, runId: 'r9.1-test', ...fixture, labelsSha256: 'a'.repeat(64),
    labelsCompletedAt: '2026-08-24T01:00:00.000Z', revealedAt: '2026-08-24T00:59:59.000Z',
  }), /R91_REVEAL_MUST_FOLLOW_FROZEN_LABELS/u)
})

test('R9.1 ignored private reveal bundle independently reopens every mapping', () => {
  const fixture = reviewFixture()
  const bundle = buildR91RevealVerificationBundle({
    revealSecret: SECRET, runId: 'r9.1-test', ...fixture, labelsSha256: 'b'.repeat(64),
    labelsCompletedAt: '2026-08-24T01:00:00.000Z', revealedAt: '2026-08-24T01:00:01.000Z',
  })
  const mappings = verifyR91RevealVerificationBundle({ bundle, packet: fixture.packet, commitments: fixture.commitments })
  assert.equal(mappings.length, 16)
  const publicProjection = projectR91RevealVerificationPublic(bundle)
  assert.equal(publicProjection.revealSecretPersistedAfterLabels, true)
  assert.equal(JSON.stringify(publicProjection).includes(SECRET), false)
  assert.equal(JSON.stringify(publicProjection).includes('privateBindings'), false)
})

test('R9.1 reveal verification fails closed on a changed secret or binding', () => {
  const fixture = reviewFixture()
  const bundle = buildR91RevealVerificationBundle({
    revealSecret: SECRET, runId: 'r9.1-test', ...fixture, labelsSha256: 'c'.repeat(64),
    labelsCompletedAt: '2026-08-24T01:00:00.000Z', revealedAt: '2026-08-24T01:00:01.000Z',
  })
  assert.throws(() => verifyR91RevealVerificationBundle({
    bundle: { ...bundle, revealSecret: `${bundle.revealSecret}changed` },
    packet: fixture.packet, commitments: fixture.commitments,
  }), /R91_REVEAL_VERIFICATION_BUNDLE_INVALID/u)
  const tampered = structuredClone(bundle)
  tampered.privateBindings[0].caseId = 'changed-case'
  assert.throws(() => verifyR91RevealVerificationBundle({
    bundle: tampered, packet: fixture.packet, commitments: fixture.commitments,
  }), /R9_PRIVATE_BINDING_MISMATCH|R91_REVEAL_VERIFICATION_BUNDLE_INVALID/u)
})
