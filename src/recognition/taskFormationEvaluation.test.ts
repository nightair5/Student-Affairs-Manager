import { describe, expect, it } from 'vitest'
import { aggregateTaskFormationScores, pairedTaskFormationDelta, scoreTaskFormationCase, type TaskFormationExpectedCase, type TaskFormationPredictionCase } from './taskFormationEvaluation'

const expected: TaskFormationExpectedCase = {
  id: 'case-1',
  expected: {
    requiresAction: true,
    forbiddenDefaultSurfaces: ['提交'],
    directives: [{
      expectedId: 'd-1', propositionScopeTexts: ['请核对名单。'],
      semantics: { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'required' },
      inferenceLevel: 'explicit', actionType: 'review', action: { scopeText: '请核对名单。', surface: '核对' },
      object: { scopeText: '请核对名单。', surface: '名单' }, effect: 'local_change', expectedDefaultSelected: true,
    }],
  },
}

function prediction(overrides: Partial<TaskFormationPredictionCase> = {}): TaskFormationPredictionCase {
  return {
    caseId: 'case-1', status: 'completed', requiresAction: true,
    tasks: [{
      id: 't-1', propositionScopeTexts: ['请核对名单。'], action: '核对', object: '名单', actionType: 'review', effect: 'local_change', selected: true,
      inferenceLevel: 'explicit', semantics: structuredClone(expected.expected.directives[0].semantics),
    }],
    ...overrides,
  }
}

describe('RCO-5-007-B2 frozen task scoring', () => {
  it('awards a complete case only for an exact safe task result', () => {
    const score = scoreTaskFormationCase(expected, prediction())
    expect(score).toMatchObject({ taskCounts: { tp: 1, fp: 0, fn: 0 }, completeTaskCase: true, majorCorrection: false })
    expect(aggregateTaskFormationScores([score])).toMatchObject({ taskF1: 1, completeTaskCaseAccuracy: 1, safeDefaultRecall: 1, forbiddenDefaultSelections: 0 })
  })

  it('does not let action-only or object-only overlap count as a task match', () => {
    const wrongObject = prediction({ tasks: [{ ...prediction().tasks[0], object: '别的名单' }] })
    expect(scoreTaskFormationCase(expected, wrongObject).taskCounts).toEqual({ tp: 0, fp: 1, fn: 1 })
  })

  it('penalizes invalid arms in the full denominator', () => {
    const score = scoreTaskFormationCase(expected, prediction({ status: 'invalid', requiresAction: null, tasks: [] }))
    expect(score).toMatchObject({ scoreable: false, taskRecall: 0, completeTaskCase: false, majorCorrection: true })
  })

  it('reports forbidden defaults even when another task is correct', () => {
    const unsafe = prediction({ tasks: [...prediction().tasks, { ...prediction().tasks[0], id: 't-2', action: '提交', object: '申请', actionType: 'submit', effect: 'external_transfer', selected: true, propositionScopeTexts: ['请提交申请。'] }] })
    expect(scoreTaskFormationCase(expected, unsafe).forbiddenDefaultSelections).toBe(1)
  })

  it('does not call an unselected external action selected merely because it shares an evidence scope', () => {
    const sharedScope = prediction({ tasks: [{ ...prediction().tasks[0], propositionScopeTexts: ['请核对名单并提交申请。'] }] })
    expect(scoreTaskFormationCase(expected, sharedScope).forbiddenDefaultSelections).toBe(0)
  })

  it('requires exact case pairing before producing deltas', () => {
    const score = scoreTaskFormationCase(expected, prediction())
    expect(pairedTaskFormationDelta([score], [score]).delta).toEqual({ taskF1: 0, completeTaskCaseAccuracy: 0, majorCorrectionRate: 0, safeDefaultRecall: 0, forbiddenDefaultSelections: 0 })
    expect(() => pairedTaskFormationDelta([score], [{ ...score, caseId: 'other' }])).toThrow('TASK_FORMATION_PAIRING_MISMATCH')
  })
})
