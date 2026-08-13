import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertPathMaskedPacketSafe,
  assignmentCommitment,
  buildPathMaskedPair,
  deriveSideAssignment,
  projectBusinessResult,
  scanPathMaskedPacket,
  syntheticAssignmentBalance,
  verifyRevealChronology,
} from './e2-9-r5-path-mask.mjs'

const SECRET = 'a'.repeat(64)
const safeEvidence = {
  id: 'e1',
  sourceId: 'pending-source',
  quote: 'Submit the application form by Friday.',
  quotedText: 'Submit the application form by Friday.',
  field: 'requirement',
  extractionMethod: 'ai',
  confidence: 0.9,
}
const safeResult = {
  sourceSummary: { title: 'Application notice', sourceType: 'text', notificationType: 'material_submission', summary: 'Submit the application form.', requiresAction: true, actionReason: 'Submission is required.' },
  projectMatch: { decision: 'standalone_task', matchedProjectId: null, matchedProjectTitle: null, suggestedProjectTitle: null, reason: 'One standalone action.', confidence: 0.8 },
  projectSuggestion: null,
  milestones: [],
  standaloneTasks: [{ tempId: 't1', title: 'Submit application form', actionVerb: 'Submit', actionObject: 'application form', evidenceIds: ['e1'], selected: true }],
  materials: [],
  timePoints: [],
  events: [],
  ambiguities: [],
  conflicts: [],
  evidence: [safeEvidence],
  ignoredContent: [],
  quality: { needsHumanReview: false, reviewReasons: [] },
}

const fails = (name, value) => test(name, () => assert.throws(() => assertPathMaskedPacketSafe(value), /PATH_MASKING_LEAK_DETECTED/u))
fails('PM01 top-level modelName fails', { modelName: 'deepseek-v4-pro' })
fails('PM02 nested metadata model fails', { result: { metadata: { model: 'opaque' } } })
fails('PM03 provider in array fails', [{ provider: 'opaque' }])
fails('PM04 model identity string value fails', { note: 'served by deepseek-v4-pro' })
fails('PM05 system fingerprint fails', { systemFingerprint: 'opaque' })
fails('PM06 latency and token usage fail', { result: safeResult, latency: 10, tokenUsage: { total: 1 } })
fails('PM07 request and deployment identifiers fail', { requestId: 'r', deploymentVersion: 'v' })
fails('PM08 unknown field with Flash identity value fails', { harmlessLooking: 'deepseek-v4-flash' })
test('PM09 completely business-only packet passes', () => assert.equal(assertPathMaskedPacketSafe({ source: { text: 'Application notice' }, X: safeResult, Y: safeResult }).packetSafe, true))
test('PM10 evidence with source quote passes', () => assert.equal(scanPathMaskedPacket({ evidence: [safeEvidence] }).length, 0))
fails('PM11 evidence metadata hidden modelName fails', { evidence: [{ ...safeEvidence, metadata: { modelName: 'opaque' } }] })
fails('PM12 rawResult fails', { rawResult: safeResult })

test('allowlist projection removes unknown metadata and lineage fields', () => {
  const projected = projectBusinessResult({ ...safeResult, modelName: 'deepseek-v4-pro', execution: { provider: 'deepseek' }, evidence: [{ ...safeEvidence, metadata: { modelName: 'deepseek-v4-pro' } }] })
  assert.equal(projected.modelName, undefined)
  assert.equal(projected.execution, undefined)
  assert.equal(projected.evidence[0].metadata, undefined)
  assert.equal(scanPathMaskedPacket(projected).length, 0)
})

test('synthetic assignments are balanced and packets contain no path hints', () => {
  const balance = syntheticAssignmentBalance(SECRET, 100)
  assert.ok(balance.flashOnX >= 40 && balance.flashOnX <= 60, JSON.stringify(balance))
  assert.equal(balance.flashOnX + balance.proOnX, 100)
  const pair = buildPathMaskedPair({
    revealSecret: SECRET,
    runId: 'r5',
    anonymousCaseId: 'review-case-001',
    caseId: 'hidden-case',
    source: { sourceType: 'text', sourceTitle: 'Application notice', content: 'Submit the application form.', referenceTime: '2026-08-13T00:00:00Z', timezone: 'Asia/Shanghai' },
    resultsByAlias: { flash: safeResult, pro: safeResult },
  })
  const serialized = JSON.stringify(pair)
  for (const hint of ['isBaseline', 'isCandidate', 'baseline', 'candidate', 'deepseek-v4-flash', 'deepseek-v4-pro']) assert.equal(serialized.includes(hint), false)
})

test('assignment commitment verifies only with frozen secret and mapping', () => {
  const assignment = deriveSideAssignment({ revealSecret: SECRET, runId: 'r5', caseId: 'c1' })
  const value = assignmentCommitment({ revealSecret: SECRET, runId: 'r5', anonymousCaseId: 'review-case-001', caseId: 'c1', assignment })
  assert.equal(value, assignmentCommitment({ revealSecret: SECRET, runId: 'r5', anonymousCaseId: 'review-case-001', caseId: 'c1', assignment }))
  assert.notEqual(value, assignmentCommitment({ revealSecret: 'b'.repeat(64), runId: 'r5', anonymousCaseId: 'review-case-001', caseId: 'c1', assignment }))
})

test('chronology requires labels strictly before reveal', () => {
  assert.equal(verifyRevealChronology('2026-08-13T00:00:00Z', '2026-08-13T00:00:01Z'), true)
  assert.throws(() => verifyRevealChronology('2026-08-13T00:00:01Z', '2026-08-13T00:00:01Z'), /ADJUDICATION_CHRONOLOGY_INVALID/u)
  assert.throws(() => verifyRevealChronology('2026-08-13T00:00:02Z', '2026-08-13T00:00:01Z'), /ADJUDICATION_CHRONOLOGY_INVALID/u)
})
