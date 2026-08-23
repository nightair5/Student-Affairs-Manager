import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { canonicalJson, scanReviewerPayload } from './e2-9-r6-path-mask.mjs'
import {
  buildR9ReviewerPacket, buildR9SeparatedPair, evaluateR9ReviewGate,
  R9_GATE_POLICY_CANONICAL_SHA256, R9_GATE_PREREG_CANONICAL_SHA256,
  R9_LABELS_DRAFT_VERSION, R9_REVIEW_GATE_POLICY, scanR9ReviewerCorrelators,
  sha256, summarizeR9Labels, validateR9LabelsDraft,
} from './e2-9-r9-path-mask.mjs'

const SECRET = 'r9-review-secret-'.padEnd(80, 'x')
const source = { sourceType: 'text', sourceTitle: '通知', content: '请完成事项。', referenceTime: '2026-08-24T00:00:00+08:00', timezone: 'Asia/Shanghai' }
const result = { sourceSummary: { title: '通知', sourceType: 'text', notificationType: 'teacher_task', summary: '摘要', requiresAction: true, actionReason: '需行动' }, standaloneTasks: [] }

function pairs() {
  return Array.from({ length: 16 }, (_, index) => buildR9SeparatedPair({
    revealSecret: SECRET, runId: 'r9-test', anonymousId: `review-case-${String(index + 1).padStart(3, '0')}`,
    observationId: `observation-${index + 1}`, caseId: `case-${Math.floor(index / 2) + 1}`, source,
    baseline: { ...result, modelName: 'private-baseline', latencyMs: 5 },
    candidate: { ...result, plannerContractVersion: 'private-candidate', modelName: 'private-candidate' },
  }))
}

test('R9 committed Gate policy matches the pre-registration hashes', async () => {
  const prereg = JSON.parse(await readFile(new URL('../docs/e2-v4-pro-benchmark-r9/replay-gate-preregistration.json', import.meta.url), 'utf8'))
  assert.equal(sha256(canonicalJson(prereg)), R9_GATE_PREREG_CANONICAL_SHA256)
  assert.equal(sha256(canonicalJson(prereg.gate)), R9_GATE_POLICY_CANONICAL_SHA256)
  assert.equal(canonicalJson(prereg.gate), canonicalJson(R9_REVIEW_GATE_POLICY))
})
test('R9 reviewer packet removes path identity and deterministic correlators', () => {
  const packet = buildR9ReviewerPacket(pairs().map((item) => item.reviewerPair))
  assert.deepEqual(scanReviewerPayload(packet), [])
  assert.deepEqual(scanR9ReviewerCorrelators(packet), [])
  const serialized = JSON.stringify(packet)
  assert.equal(serialized.includes('private-baseline'), false)
  assert.equal(serialized.includes('private-candidate'), false)
  assert.equal(serialized.includes('plannerContractVersion'), false)
})

test('R9 labels require all user-impact, evidence and safety fields', () => {
  const packet = buildR9ReviewerPacket(pairs().map((item) => item.reviewerPair))
  const labels = packet.pairs.map((pair) => ({
    caseAnonymousId: pair.caseAnonymousId, preferredSide: 'TIE',
    xMajor: false, yMajor: false, xPlanningError: false, yPlanningError: false,
    xFactLoss: false, yFactLoss: false, xOverSplit: false, yOverSplit: false,
    xEvidenceGap: false, yEvidenceGap: false, xSevereError: false, ySevereError: false,
    reason: '两侧均保留原文事实且用户修改成本相同。',
  }))
  const draft = {
    schemaVersion: R9_LABELS_DRAFT_VERSION, reviewerKind: 'independent_fresh_read_only',
    reviewProcessId: 'r9-fresh-reviewer', packetSha256: sha256(canonicalJson(packet)),
    completedAt: '2026-08-24T00:01:00.000Z', labels,
  }
  assert.doesNotThrow(() => validateR9LabelsDraft(draft, packet, '2026-08-24T00:00:00.000Z'))
  delete draft.labels[0].xEvidenceGap
  assert.throws(() => validateR9LabelsDraft(draft, packet, '2026-08-24T00:00:00.000Z'), /R9_LABEL_VALUE_INVALID/u)
})

test('R9 Gate accepts a zero Fact-Loss tie but rejects Over-splitting regression', () => {
  const mappings = Array.from({ length: 16 }, (_, index) => ({ caseAnonymousId: `review-case-${String(index + 1).padStart(3, '0')}`, X: 'candidate', Y: 'baseline' }))
  const labels = mappings.map((mapping, index) => ({
    caseAnonymousId: mapping.caseAnonymousId, preferredSide: index < 6 ? 'X' : index === 6 ? 'Y' : 'TIE',
    xMajor: false, yMajor: index < 3, xPlanningError: index === 15, yPlanningError: index < 5,
    xFactLoss: false, yFactLoss: false, xOverSplit: false, yOverSplit: false,
    xEvidenceGap: false, yEvidenceGap: false, xSevereError: false, ySevereError: false,
  }))
  const counts = summarizeR9Labels(labels, mappings)
  const passed = evaluateR9ReviewGate(counts, 16)
  assert.equal(passed.checks.candidateFactLossNotWorse, true)
  assert.equal(passed.checks.zeroFactLossTiePasses, true)
  assert.equal(passed.pass, true)
  counts.candidateOverSplit = 1
  assert.equal(evaluateR9ReviewGate(counts, 16).pass, false)
})

test('R9 Gate fails closed on Evidence or Severe Error regression', () => {
  const counts = {
    candidatePreferred: 6, baselinePreferred: 1, tie: 9, insufficient: 0,
    candidateMajor: 1, baselineMajor: 3, candidatePlanningError: 2, baselinePlanningError: 5,
    candidateFactLoss: 0, baselineFactLoss: 0, candidateOverSplit: 0, baselineOverSplit: 0,
    candidateEvidenceGap: 1, baselineEvidenceGap: 0, candidateSevereError: 0, baselineSevereError: 0,
  }
  assert.equal(evaluateR9ReviewGate(counts, 16).checks.candidateEvidenceCoverageNotWorse, false)
  counts.candidateEvidenceGap = 0
  counts.candidateSevereError = 1
  assert.equal(evaluateR9ReviewGate(counts, 16).checks.candidateSevereErrorNotWorse, false)
})
