import type { ImmutableScopeIndex } from './scopeReferenceContract'
import type { LocalTaskFormationP4Result } from './taskFormationPolicyP4'
import type { TaskFormationExpectedTask, TaskFormationPredictionTask } from './taskFormationEvaluation'
import type { RevisionRelationKind } from './revisionRelationResolver'

export const TASK_FORMATION_EVALUATOR_V2_VERSION = 'task-formation-evaluator-2.0.0' as const

export interface StableTaskPair {
  expected: TaskFormationExpectedTask
  predicted: TaskFormationPredictionTask
}

export interface StableDefaultSafetyScore {
  matchedTasks: number
  expectedTasks: number
  predictedTasks: number
  actionSurfaceExact: number | null
  objectSurfaceExact: number | null
  unsafeDefaultFalsePositives: number
  unsafeDefaultFalsePositiveRate: number | null
  unsafeDefaultTaskIds: string[]
}

export interface ExpectedRevisionRelationV2 {
  kind: RevisionRelationKind
  targetExpectedId: string
  replacementExpectedIds: string[]
  evidenceScopeTexts: string[]
  resolution: 'shared_scope' | 'same_scope_position' | 'adjacent_unique_referent'
  referentType: string | null
}

function ratio(top: number, bottom: number): number | null { return bottom === 0 ? null : top / bottom }

function pairScore(expected: TaskFormationExpectedTask, predicted: TaskFormationPredictionTask): number {
  const overlap = expected.propositionScopeTexts.filter((text) => predicted.propositionScopeTexts.includes(text)).length
  let score = overlap * 6
  if (expected.object.surface === predicted.object) score += 10
  if (expected.action.surface === predicted.action) score += 2
  return score
}

export function alignTasksByScopeAndObject(expected: TaskFormationExpectedTask[], predicted: TaskFormationPredictionTask[]): StableTaskPair[] {
  const options = expected.flatMap((expectedTask, expectedIndex) => predicted.map((predictedTask, predictedIndex) => ({ expectedIndex, predictedIndex, score: pairScore(expectedTask, predictedTask) })))
    .sort((left, right) => right.score - left.score || left.expectedIndex - right.expectedIndex || left.predictedIndex - right.predictedIndex)
  const expectedUsed = new Set<number>()
  const predictedUsed = new Set<number>()
  const pairs: StableTaskPair[] = []
  for (const option of options) {
    if (option.score < 10 || expectedUsed.has(option.expectedIndex) || predictedUsed.has(option.predictedIndex)) continue
    expectedUsed.add(option.expectedIndex)
    predictedUsed.add(option.predictedIndex)
    pairs.push({ expected: expected[option.expectedIndex], predicted: predicted[option.predictedIndex] })
  }
  return pairs
}

export function scoreStableDefaultSafety(expected: TaskFormationExpectedTask[], predicted: TaskFormationPredictionTask[]): StableDefaultSafetyScore {
  const pairs = alignTasksByScopeAndObject(expected, predicted)
  const pairedPredicted = new Set(pairs.map((pair) => pair.predicted.id))
  const unsafe = [
    ...pairs.filter((pair) => !pair.expected.expectedDefaultSelected && pair.predicted.selected).map((pair) => pair.predicted.id),
    ...predicted.filter((task) => task.selected && !pairedPredicted.has(task.id)).map((task) => task.id),
  ]
  return {
    matchedTasks: pairs.length,
    expectedTasks: expected.length,
    predictedTasks: predicted.length,
    actionSurfaceExact: ratio(pairs.filter((pair) => pair.expected.action.surface === pair.predicted.action).length, expected.length),
    objectSurfaceExact: ratio(pairs.filter((pair) => pair.expected.object.surface === pair.predicted.object).length, expected.length),
    unsafeDefaultFalsePositives: unsafe.length,
    unsafeDefaultFalsePositiveRate: ratio(unsafe.length, expected.filter((task) => !task.expectedDefaultSelected).length),
    unsafeDefaultTaskIds: unsafe,
  }
}

export function materializeRevisionRelationsByScope(
  expectedTasks: TaskFormationExpectedTask[],
  expectedRelations: ExpectedRevisionRelationV2[],
  predictionTasks: TaskFormationPredictionTask[],
  formed: LocalTaskFormationP4Result,
  index: ImmutableScopeIndex,
) {
  const pairs = alignTasksByScopeAndObject(expectedTasks, predictionTasks)
  const expectedIdByPredictionId = new Map(pairs.map((pair) => [pair.predicted.id, pair.expected.expectedId]))
  const scopeTextById = new Map(index.scopes.map((scope) => [scope.id, scope.text]))
  const actual = formed.revisionRelations.map((relation) => ({
    kind: relation.kind,
    targetExpectedId: expectedIdByPredictionId.get(relation.targetTaskId) ?? null,
    replacementExpectedIds: relation.replacementTaskIds.map((id) => expectedIdByPredictionId.get(id) ?? null),
    evidenceScopeTexts: relation.evidenceScopeIds.map((id) => scopeTextById.get(id) ?? null),
    resolution: relation.resolution,
    referentType: relation.referentType,
  }))
  return { expected: expectedRelations, actual, exact: JSON.stringify(actual) === JSON.stringify(expectedRelations) }
}
