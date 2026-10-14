import { describe, expect, it } from 'vitest'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { alignTasksByScopeAndObject, materializeRevisionRelationsByScope, scoreStableDefaultSafety } from './taskFormationEvaluationV2'
import type { TaskFormationExpectedTask, TaskFormationPredictionTask } from './taskFormationEvaluation'
import type { LocalTaskFormationP4Result } from './taskFormationPolicyP4'

const semantics = { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'required' } as const

function expected(id: string, scope: string, action: string, object: string, selected: boolean): TaskFormationExpectedTask {
  return { expectedId: id, propositionScopeTexts: [scope], semantics, inferenceLevel: 'explicit', actionType: 'save', action: { scopeText: scope, surface: action }, object: { scopeText: scope, surface: object }, effect: 'local_change', expectedDefaultSelected: selected }
}

function predicted(id: string, scope: string, action: string, object: string, selected: boolean): TaskFormationPredictionTask {
  return { id, propositionScopeTexts: [scope], semantics, inferenceLevel: 'explicit', actionType: 'save', action, object, effect: 'local_change', selected }
}

describe('RCO-5-008 scope-bound evaluation', () => {
  it('aligns by immutable proposition and object while keeping action exact separate', () => {
    const expectedTasks = [expected('e1', '请保存路线图。', '保存', '路线图', true)]
    const predictionTasks = [predicted('task-1', '请保存路线图。', '请保存', '路线图', true)]
    expect(alignTasksByScopeAndObject(expectedTasks, predictionTasks)).toHaveLength(1)
    expect(scoreStableDefaultSafety(expectedTasks, predictionTasks)).toMatchObject({ matchedTasks: 1, actionSurfaceExact: 0, objectSurfaceExact: 1, unsafeDefaultFalsePositives: 0 })
  })

  it('counts every forbidden default selection independently of the legacy forbidden list', () => {
    const expectedTasks = [expected('e1', '资料夹可自行携带。', '携带', '资料夹', false)]
    const predictionTasks = [predicted('task-1', '资料夹可自行携带。', '携带', '资料夹', true)]
    expect(scoreStableDefaultSafety(expectedTasks, predictionTasks)).toMatchObject({ unsafeDefaultFalsePositives: 1, unsafeDefaultFalsePositiveRate: 1, unsafeDefaultTaskIds: ['task-1'] })
  })

  it('maps revision targets through scope and object rather than action spelling', async () => {
    const index = await indexImmutableScopesV11('relation-test', 'source-v1', '旧要求须保存旧表。现改为保存新表。')
    const oldScope = index.scopes.find((scope) => scope.text === '旧要求须保存旧表。')!
    const newScope = index.scopes.find((scope) => scope.text === '现改为保存新表。')!
    const expectedTasks = [expected('old', oldScope.text, '保存', '旧表', false), expected('new', newScope.text, '保存', '新表', true)]
    const predictionTasks = [predicted('task-1', oldScope.text, '须保存', '旧表', false), predicted('task-2', newScope.text, '保存', '新表', true)]
    const formed = {
      revisionRelations: [{ kind: 'supersedes', targetTaskId: 'task-1', replacementTaskIds: ['task-2'], evidenceScopeIds: [oldScope.id, newScope.id], resolution: 'adjacent_unique_referent', referentType: null }],
    } as unknown as LocalTaskFormationP4Result
    const relation = materializeRevisionRelationsByScope(expectedTasks, [{ kind: 'supersedes', targetExpectedId: 'old', replacementExpectedIds: ['new'], evidenceScopeTexts: [oldScope.text, newScope.text], resolution: 'adjacent_unique_referent', referentType: null }], predictionTasks, formed, index)
    expect(relation.exact).toBe(true)
    expect(relation.actual[0]).toMatchObject({ targetExpectedId: 'old', replacementExpectedIds: ['new'] })
  })
})
