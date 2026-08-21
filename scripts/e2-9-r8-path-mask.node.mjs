import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildR8ReviewerPacket, buildR8SeparatedPair, deriveR8SideAssignment, evaluateR8ReviewGate,
  projectR8NeutralBusinessResult, R8_LABELS_DRAFT_VERSION, scanR8ReviewerCorrelators,
  sha256, summarizeR8Labels, validateR8LabelsDraft,
} from './e2-9-r8-path-mask.mjs'
import { canonicalJson, scanReviewerPayload } from './e2-9-r6-path-mask.mjs'

const SECRET = 'r8-review-secret-'.padEnd(80, 'x')
const result = { sourceSummary: { title: '通知', sourceType: 'text', notificationType: 'event_notice', summary: '摘要', requiresAction: true, actionReason: '需行动' }, standaloneTasks: [] }
const source = { sourceType: 'text', sourceTitle: '通知', content: '请按要求完成事项。', referenceTime: '2026-08-21T00:00:00+08:00', timezone: 'Asia/Shanghai' }

test('R8 assignment is deterministic and reviewer projection removes path identity', () => {
  assert.deepEqual(deriveR8SideAssignment({ revealSecret: SECRET, runId: 'r8', observationId: 'o1' }), deriveR8SideAssignment({ revealSecret: SECRET, runId: 'r8', observationId: 'o1' }))
  const pairs = Array.from({ length: 16 }, (_, index) => buildR8SeparatedPair({
    revealSecret: SECRET, runId: 'r8', anonymousId: `review-case-${String(index + 1).padStart(3, '0')}`,
    observationId: `o${index}`, caseId: `c${index}`, source,
    baseline: { ...result, modelName: 'deepseek-v4-flash', latencyMs: 1 },
    candidate: { ...result, plannerContractVersion: 'candidate', modelName: 'deepseek-v4-pro' },
  }).reviewerPair)
  const packet = buildR8ReviewerPacket(pairs)
  assert.deepEqual(scanReviewerPayload(packet), [])
  assert.equal(JSON.stringify(packet).includes('baseline'), false)
  assert.equal(JSON.stringify(packet).includes('candidate'), false)
  assert.equal(JSON.stringify(packet).includes('modelName'), false)
  assert.deepEqual(scanR8ReviewerCorrelators(packet), [])
})

test('R8 neutral projection removes deterministic candidate metadata and internal identifiers', () => {
  const projected = projectR8NeutralBusinessResult({
    ...result,
    plannerContractVersion: 'e2-r8-plan-contract-1.0.0',
    standaloneTasks: [{ tempId: 'task-from-obligation-source-1', title: '参加会议', confidence: 0.8, evidenceIds: ['source-action-evidence-1'], selected: true }],
    evidence: [{ id: 'source-action-evidence-1', sourceId: 'pending-source', quotedText: '参加会议', confidence: 1 }],
    ambiguities: [{ id: 'a1', field: 'CONDITION_APPLICABILITY_UNKNOWN', message: '需确认是否满足条件', options: ['满足', '不满足'], evidenceIds: ['source-action-evidence-1'] }],
    quality: { overallConfidence: 0.8, hierarchyConfidence: 0.75, evidenceCoverage: 1 },
  })
  const serialized = JSON.stringify(projected)
  assert.equal(serialized.includes('quality'), false)
  assert.equal(serialized.includes('0.75'), false)
  assert.equal(serialized.includes('task-from-'), false)
  assert.equal(serialized.includes('source-action-evidence-'), false)
  assert.equal(serialized.includes('pending-source'), false)
  assert.equal(serialized.includes('CONDITION_APPLICABILITY_UNKNOWN'), false)
  assert.equal(serialized.includes('description'), false)
})

test('R8 labels require exact coverage, binding and chronology', () => {
  const pairs = Array.from({ length: 16 }, (_, index) => buildR8SeparatedPair({
    revealSecret: SECRET, runId: 'r8', anonymousId: `review-case-${String(index + 1).padStart(3, '0')}`,
    observationId: `o${index}`, caseId: `c${index}`, source, baseline: result, candidate: result,
  }).reviewerPair)
  const packet = buildR8ReviewerPacket(pairs)
  const labels = pairs.map((pair) => ({
    caseAnonymousId: pair.caseAnonymousId, preferredSide: 'TIE',
    xMajor: false, yMajor: false, xPlanningError: false, yPlanningError: false,
    xFactLoss: false, yFactLoss: false, xOverSplit: false, yOverSplit: false,
    reason: '两侧均完整表达原文事实，用户修改成本相同。',
  }))
  const draft = {
    schemaVersion: R8_LABELS_DRAFT_VERSION, reviewerKind: 'independent_fresh_read_only',
    reviewProcessId: 'fresh-r8-reviewer', packetSha256: sha256(canonicalJson(packet)),
    completedAt: '2026-08-21T00:01:00.000Z', labels,
  }
  assert.doesNotThrow(() => validateR8LabelsDraft(draft, packet, '2026-08-21T00:00:00.000Z'))
  draft.labels[0].modelName = 'leak'
  assert.throws(() => validateR8LabelsDraft(draft, packet, '2026-08-21T00:00:00.000Z'), /R8_LABEL_VALUE_INVALID/u)
})

test('R8 Gate requires a clear candidate benefit without over-splitting regression', () => {
  const mappings = Array.from({ length: 16 }, (_, index) => ({ caseAnonymousId: `review-case-${String(index + 1).padStart(3, '0')}`, X: 'candidate', Y: 'baseline' }))
  const labels = mappings.map((mapping, index) => ({
    caseAnonymousId: mapping.caseAnonymousId, preferredSide: index < 5 ? 'X' : index === 5 ? 'Y' : 'TIE',
    xMajor: false, yMajor: index < 3, xPlanningError: index === 15, yPlanningError: index < 5,
    xFactLoss: false, yFactLoss: index < 4, xOverSplit: index === 14, yOverSplit: index === 13,
  }))
  const counts = summarizeR8Labels(labels, mappings)
  assert.equal(evaluateR8ReviewGate(counts, 16).pass, true)
  counts.candidateOverSplit = 2
  assert.equal(evaluateR8ReviewGate(counts, 16).pass, false)
})
