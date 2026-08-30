import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregateArm, pairedBootstrap, scoreCase } from './multimodal-evaluation-lib.mjs'

// Kept outside Vitest's *.test.* glob; this file uses node:test directly.

const fixture = {
  id: 'case-1', modality: 'screenshot', ocrText: '9月5日18:00前提交报名表',
  expected: {
    tasks: [{ verbs: ['提交'], objectTokens: ['报名表'] }],
    materials: [{ tokens: ['报名表'] }],
    timePoints: [{ type: 'submission_deadline', normalizedValue: '2026-09-05T18:00:00+08:00' }],
    events: [], forbiddenTaskTokens: ['转账'], requiresAction: true,
  },
}

const result = {
  sourceSummary: { requiresAction: true }, milestones: [],
  standaloneTasks: [{ title: '提交报名表', actionVerb: '提交', actionObject: '报名表', description: '' }],
  materials: [{ name: '报名表' }],
  timePoints: [{ type: 'submission_deadline', normalizedValue: '2026-09-05T18:00:00+08:00' }],
  events: [], evidence: [{ quotedText: '9月5日18:00前提交报名表' }],
}

test('scores auditable entity matches without self-normalization', () => {
  const scored = scoreCase(fixture, 'T', result, { latencyMs: 100 })
  assert.equal(scored.task.f1, 1)
  assert.equal(scored.completeCase, true)
  assert.equal(scored.correctionOperations, 0)
  const aggregate = aggregateArm('T', [scored])
  assert.equal(aggregate.task.f1, 1)
  assert.equal(aggregate.completeCaseAccuracy, 1)
  assert.equal(aggregate.observedUserModificationTimeSeconds, null)
})

test('penalizes missing and forbidden tasks as correction burden', () => {
  const bad = structuredClone(result)
  bad.standaloneTasks = [{ title: '向陌生账户转账', actionVerb: '提交', actionObject: '转账', description: '' }]
  const scored = scoreCase(fixture, 'I', bad)
  assert.equal(scored.task.misses, 1)
  assert.equal(scored.forbiddenHits.length, 1)
  assert.equal(scored.majorCorrection, true)
  assert.ok(scored.correctionOperations >= 2)
})

test('paired bootstrap reports paired deltas rather than dividing by model maxima', () => {
  const baseline = scoreCase(fixture, 'T', null, { status: 'request_failure' })
  const candidate = scoreCase(fixture, 'IT', result)
  const comparison = pairedBootstrap({ T: [baseline], IT: [candidate] }, 'IT', 'T', (item) => item.task.f1, 'seed', 100)
  assert.equal(comparison.pairedCount, 0)
  const weaker = scoreCase(fixture, 'T', { ...result, standaloneTasks: [] })
  const paired = pairedBootstrap({ T: [weaker], IT: [candidate] }, 'IT', 'T', (item) => item.task.f1, 'seed', 100)
  assert.equal(paired.pairedCount, 1)
  assert.equal(paired.delta, 1)
})

test('reports unavailable quality metrics as null when every request failed', () => {
  const failed = scoreCase(fixture, 'T', null, { status: 'request_failure', failureReason: 'network' })
  const aggregate = aggregateArm('T', [failed])
  assert.equal(aggregate.requestFailureRate, 1)
  assert.equal(aggregate.task.f1, null)
  assert.equal(aggregate.completeCaseAccuracy, null)
  assert.equal(aggregate.majorCorrectionRate, null)
})
