import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertPathMaskedPacketSafe, assignmentCommitment, buildPathMaskedPair, deriveSideAssignment,
  projectBusinessResult, scanPathMaskedPacket, syntheticAssignmentBalance, verifyRevealChronology,
} from './e2-9-r4-path-mask.mjs'

const SECRET = 'a'.repeat(64)
const safeEvidence = { id: 'e1', sourceId: 'pending-source', quote: '请于周五提交申请表', quotedText: '请于周五提交申请表', field: 'requirement', extractionMethod: 'ai', confidence: 0.9 }
const safeResult = {
  sourceSummary: { title: '通知', sourceType: 'text', notificationType: 'material_submission', summary: '提交申请表', requiresAction: true, actionReason: '明确要求提交' },
  projectMatch: { decision: 'standalone_task', matchedProjectId: null, matchedProjectTitle: null, suggestedProjectTitle: null, reason: '单项事务', confidence: 0.8 },
  projectSuggestion: null, milestones: [], standaloneTasks: [{ tempId: 't1', title: '提交申请表', actionVerb: '提交', actionObject: '申请表', evidenceIds: ['e1'], selected: true }],
  materials: [], timePoints: [], events: [], ambiguities: [], conflicts: [], evidence: [safeEvidence], ignoredContent: [], quality: { needsHumanReview: false, reviewReasons: [] },
}

const fails = async (name, value) => test(name, () => assert.throws(() => assertPathMaskedPacketSafe(value), /PATH_MASKING_LEAK_DETECTED/u))
await fails('PM01 top-level modelName fails', { modelName: 'deepseek-v4-pro' })
await fails('PM02 nested metadata model fails', { result: { metadata: { model: 'opaque' } } })
await fails('PM03 provider in array fails', [{ provider: 'opaque' }])
await fails('PM04 model identity string value fails', { note: 'served by deepseek-v4-pro' })
await fails('PM05 system fingerprint fails', { systemFingerprint: 'opaque' })
await fails('PM06 latency and token usage fail', { result: safeResult, latency: 10, tokenUsage: { total: 1 } })
await fails('PM07 request and deployment identifiers fail', { requestId: 'r', deploymentVersion: 'v' })
await fails('PM08 unknown field with Flash identity value fails', { harmlessLooking: 'deepseek-v4-flash' })
test('PM09 completely business-only packet passes', () => assert.equal(assertPathMaskedPacketSafe({ source: { text: '通知' }, X: safeResult, Y: safeResult }).packetSafe, true))
test('PM10 evidence with source quote passes', () => assert.equal(scanPathMaskedPacket({ evidence: [safeEvidence] }).length, 0))
await fails('PM11 evidence metadata hidden modelName fails', { evidence: [{ ...safeEvidence, metadata: { modelName: 'opaque' } }] })
await fails('PM12 rawResult fails', { rawResult: safeResult })

test('allowlist projection removes unknown metadata and all lineage/performance fields', () => {
  const projected = projectBusinessResult({ ...safeResult, modelName: 'deepseek-v4-pro', execution: { provider: 'deepseek' }, evidence: [{ ...safeEvidence, metadata: { modelName: 'deepseek-v4-pro' } }] })
  assert.equal(projected.modelName, undefined)
  assert.equal(projected.execution, undefined)
  assert.equal(projected.evidence[0].metadata, undefined)
  assert.equal(scanPathMaskedPacket(projected).length, 0)
})

test('100 synthetic assignments are balanced and packet contains no path hints', () => {
  const balance = syntheticAssignmentBalance(SECRET, 100)
  assert.ok(balance.flashOnX >= 40 && balance.flashOnX <= 60, JSON.stringify(balance))
  assert.equal(balance.flashOnX + balance.proOnX, 100)
  const pair = buildPathMaskedPair({ revealSecret: SECRET, runId: 'r4', anonymousCaseId: 'review-case-001', caseId: 'hidden-case', source: { sourceType: 'text', sourceTitle: '通知', content: '请提交', referenceTime: '2026-08-13T00:00:00Z', timezone: 'Asia/Shanghai' }, resultsByAlias: { flash: safeResult, pro: safeResult } })
  const serialized = JSON.stringify(pair)
  for (const hint of ['isBaseline', 'isCandidate', 'baseline', 'candidate', 'deepseek-v4-flash', 'deepseek-v4-pro']) assert.equal(serialized.includes(hint), false)
})

test('assignment commitment verifies only with frozen secret and mapping', () => {
  const assignment = deriveSideAssignment({ revealSecret: SECRET, runId: 'r4', caseId: 'c1' })
  const value = assignmentCommitment({ revealSecret: SECRET, runId: 'r4', anonymousCaseId: 'review-case-001', caseId: 'c1', assignment })
  assert.equal(value, assignmentCommitment({ revealSecret: SECRET, runId: 'r4', anonymousCaseId: 'review-case-001', caseId: 'c1', assignment }))
  assert.notEqual(value, assignmentCommitment({ revealSecret: 'b'.repeat(64), runId: 'r4', anonymousCaseId: 'review-case-001', caseId: 'c1', assignment }))
})

test('chronology requires labels strictly before reveal', () => {
  assert.equal(verifyRevealChronology('2026-08-13T00:00:00Z', '2026-08-13T00:00:01Z'), true)
  assert.throws(() => verifyRevealChronology('2026-08-13T00:00:01Z', '2026-08-13T00:00:01Z'), /ADJUDICATION_CHRONOLOGY_INVALID/u)
  assert.throws(() => verifyRevealChronology('2026-08-13T00:00:02Z', '2026-08-13T00:00:01Z'), /ADJUDICATION_CHRONOLOGY_INVALID/u)
})
