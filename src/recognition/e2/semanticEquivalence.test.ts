import { describe, expect, it } from 'vitest'
import {
  scoreSemanticEntity,
  type SemanticEquivalenceDecision,
  type SemanticPreservationChecks,
} from './semanticEquivalence'

const preserved: SemanticPreservationChecks = {
  actionPredicate: true,
  object: true,
  actor: true,
  modality: true,
  condition: true,
  deadline: true,
  channel: true,
  independentCompletion: true,
  eventTaskBoundary: true,
  literalEvidence: true,
  taskCoverage: true,
  timePointCoverage: true,
  eventCoverage: true,
  order: true,
  timeRole: true,
  timeValue: true,
  uncertainty: true,
  relation: true,
}

function taskDecision(overrides: Partial<SemanticEquivalenceDecision> = {}): SemanticEquivalenceDecision {
  return {
    category: 'TASK_GROUPING_EQUIVALENT',
    entityKind: 'task',
    expectedKeys: ['expected-a', 'expected-b'],
    actualIds: ['actual-combined'],
    approved: true,
    checks: preserved,
    rationale: '同一主体、截止、渠道和完成状态；一个提交动作完整覆盖两个材料对象。',
    reviewerId: 'reviewer-independent-01',
    ...overrides,
  }
}

describe('E2.7 semantic equivalence', () => {
  it('credits a reviewed equivalent task grouping without producing precision above one', () => {
    const score = scoreSemanticEntity({
      entityKind: 'task',
      expectedKeys: ['expected-a', 'expected-b'],
      actualIds: ['actual-combined'],
      strictMatchedExpectedKeys: ['expected-a'],
      strictMatchedActualIds: ['actual-combined'],
      decisions: [taskDecision()],
    })
    expect(score).toMatchObject({
      matchedExpectedCount: 2,
      matchedActualCount: 1,
      precision: 1,
      recall: 1,
      acceptedDecisionCount: 1,
    })
  })

  it.each([
    ['deadline', { deadline: false }],
    ['actor', { actor: false }],
    ['condition', { condition: false }],
    ['independent completion', { independentCompletion: false }],
    ['event/task boundary', { eventTaskBoundary: false }],
    ['literal evidence', { literalEvidence: false }],
  ])('rejects task grouping when %s changes', (_label, changed) => {
    const decision = taskDecision({ checks: { ...preserved, ...changed } })
    const score = scoreSemanticEntity({
      entityKind: 'task',
      expectedKeys: ['expected-a', 'expected-b'],
      actualIds: ['actual-combined'],
      strictMatchedExpectedKeys: [],
      strictMatchedActualIds: [],
      decisions: [decision],
    })
    expect(score.acceptedDecisionCount).toBe(0)
    expect(score.recall).toBe(0)
    expect(score.rejected).toHaveLength(1)
  })

  it('requires split and grouping decisions to have the promised cardinality', () => {
    const score = scoreSemanticEntity({
      entityKind: 'task',
      expectedKeys: ['expected-a'],
      actualIds: ['actual-a'],
      strictMatchedExpectedKeys: [],
      strictMatchedActualIds: [],
      decisions: [taskDecision({ expectedKeys: ['expected-a'], actualIds: ['actual-a'] })],
    })
    expect(score.rejected[0]?.reason).toBe('invalid_task_grouping_cardinality')
  })

  it('does not accept an adjudication that names entities outside the scored case', () => {
    const score = scoreSemanticEntity({
      entityKind: 'task',
      expectedKeys: ['expected-a', 'expected-b'],
      actualIds: ['actual-combined'],
      strictMatchedExpectedKeys: [],
      strictMatchedActualIds: [],
      decisions: [taskDecision({ actualIds: ['different-output'] })],
    })
    expect(score.rejected[0]?.reason).toBe('identity_outside_case')
  })
})
