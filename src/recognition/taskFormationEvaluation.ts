import type { ScopeReferenceDirective, ScopeReferenceSemantics } from './scopeReferenceContract'

export const TASK_FORMATION_EVALUATOR_VERSION = 'task-formation-evaluator-1.0.0' as const

type ActionType = ScopeReferenceDirective['actionType']
type Effect = ScopeReferenceDirective['effect']

export interface TaskFormationExpectedTask {
  expectedId: string
  propositionScopeTexts: string[]
  semantics: ScopeReferenceSemantics
  inferenceLevel: 'explicit' | 'strong_inference' | 'optional_suggestion'
  actionType: ActionType
  action: { scopeText: string; surface: string }
  object: { scopeText: string; surface: string }
  effect: Effect
  expectedDefaultSelected: boolean
}

export interface TaskFormationExpectedCase {
  id: string
  expected: {
    requiresAction: boolean
    directives: TaskFormationExpectedTask[]
    forbiddenDefaultSurfaces: string[]
  }
}

export interface TaskFormationPredictionTask {
  id: string
  propositionScopeTexts: string[]
  semantics: ScopeReferenceSemantics
  inferenceLevel: 'explicit' | 'strong_inference' | 'optional_suggestion'
  actionType: ActionType
  action: string
  object: string
  effect: Effect
  selected: boolean
}

export interface TaskFormationPredictionCase {
  caseId: string
  status: 'completed' | 'invalid' | 'not_run'
  requiresAction: boolean | null
  tasks: TaskFormationPredictionTask[]
}

export interface TaskFormationCaseScore {
  caseId: string
  scoreable: boolean
  taskCounts: { tp: number; fp: number; fn: number }
  taskPrecision: number | null
  taskRecall: number | null
  taskF1: number | null
  requiresActionCorrect: boolean
  exactTaskBoundary: boolean
  semanticFields: { correct: number; total: number }
  safeDefaults: { correct: number; total: number }
  forbiddenDefaultSelections: number
  completeTaskCase: boolean
  majorCorrection: boolean
}

interface Pair {
  expected: TaskFormationExpectedTask
  predicted: TaskFormationPredictionTask
}

function ratio(top: number, bottom: number): number | null {
  return bottom === 0 ? null : top / bottom
}

function harmonic(precision: number | null, recall: number | null): number | null {
  return precision === null || recall === null || precision + recall === 0 ? null : 2 * precision * recall / (precision + recall)
}

function pairScore(expected: TaskFormationExpectedTask, predicted: TaskFormationPredictionTask): number {
  let score = 0
  if (expected.action.surface === predicted.action) score += 8
  if (expected.object.surface === predicted.object) score += 6
  if (expected.actionType === predicted.actionType) score += 3
  if (expected.propositionScopeTexts.some((scope) => predicted.propositionScopeTexts.includes(scope))) score += 1
  return score
}

function align(expected: TaskFormationExpectedTask[], predicted: TaskFormationPredictionTask[]): Pair[] {
  const options = expected.flatMap((expectedTask, expectedIndex) => predicted.map((predictedTask, predictedIndex) => ({
    expectedIndex, predictedIndex, score: pairScore(expectedTask, predictedTask),
  }))).sort((left, right) => right.score - left.score || left.expectedIndex - right.expectedIndex || left.predictedIndex - right.predictedIndex)
  const expectedUsed = new Set<number>()
  const predictedUsed = new Set<number>()
  const pairs: Pair[] = []
  for (const option of options) {
    if (option.score < 14 || expectedUsed.has(option.expectedIndex) || predictedUsed.has(option.predictedIndex)) continue
    expectedUsed.add(option.expectedIndex)
    predictedUsed.add(option.predictedIndex)
    pairs.push({ expected: expected[option.expectedIndex], predicted: predicted[option.predictedIndex] })
  }
  return pairs
}

export function scoreTaskFormationCase(expectedCase: TaskFormationExpectedCase, prediction: TaskFormationPredictionCase): TaskFormationCaseScore {
  if (prediction.caseId !== expectedCase.id) throw new Error('TASK_FORMATION_CASE_ID_MISMATCH')
  const expected = expectedCase.expected.directives
  if (prediction.status !== 'completed') {
    return {
      caseId: expectedCase.id, scoreable: false,
      taskCounts: { tp: 0, fp: 0, fn: expected.length }, taskPrecision: null, taskRecall: 0, taskF1: null,
      requiresActionCorrect: false, exactTaskBoundary: false,
      semanticFields: { correct: 0, total: expected.length * 7 },
      safeDefaults: { correct: 0, total: expected.filter((item) => item.expectedDefaultSelected).length },
      forbiddenDefaultSelections: 0, completeTaskCase: false, majorCorrection: true,
    }
  }
  const pairs = align(expected, prediction.tasks)
  const tp = pairs.length
  const fp = prediction.tasks.length - tp
  const fn = expected.length - tp
  const precision = ratio(tp, tp + fp)
  const recall = ratio(tp, tp + fn)
  let semanticCorrect = 0
  let semanticTotal = 0
  let safeCorrect = 0
  let safeTotal = 0
  let defaultMismatch = false
  for (const pair of pairs) {
    for (const [key, value] of Object.entries(pair.expected.semantics)) {
      semanticTotal += 1
      if (pair.predicted.semantics[key as keyof ScopeReferenceSemantics] === value) semanticCorrect += 1
    }
    if (pair.expected.expectedDefaultSelected) {
      safeTotal += 1
      if (pair.predicted.selected) safeCorrect += 1
    }
    if (pair.expected.expectedDefaultSelected !== pair.predicted.selected) defaultMismatch = true
  }
  safeTotal += expected.filter((item) => item.expectedDefaultSelected && !pairs.some((pair) => pair.expected === item)).length
  const selectedText = prediction.tasks.filter((task) => task.selected)
    .flatMap((task) => [task.action, task.object]).join('\n')
  const forbidden = expectedCase.expected.forbiddenDefaultSurfaces.filter((surface) => selectedText.includes(surface)).length
  const requiresActionCorrect = prediction.requiresAction === expectedCase.expected.requiresAction
  const exactTaskBoundary = fp === 0 && fn === 0
  const completeTaskCase = exactTaskBoundary && requiresActionCorrect && semanticCorrect === semanticTotal
    && !defaultMismatch && forbidden === 0
  return {
    caseId: expectedCase.id, scoreable: true,
    taskCounts: { tp, fp, fn }, taskPrecision: precision, taskRecall: recall, taskF1: harmonic(precision, recall),
    requiresActionCorrect, exactTaskBoundary,
    semanticFields: { correct: semanticCorrect, total: semanticTotal },
    safeDefaults: { correct: safeCorrect, total: safeTotal },
    forbiddenDefaultSelections: forbidden,
    completeTaskCase,
    majorCorrection: !completeTaskCase,
  }
}

export function aggregateTaskFormationScores(scores: TaskFormationCaseScore[]) {
  const sum = <K extends 'tp' | 'fp' | 'fn'>(key: K) => scores.reduce((total, score) => total + score.taskCounts[key], 0)
  const tp = sum('tp')
  const fp = sum('fp')
  const fn = sum('fn')
  const precision = ratio(tp, tp + fp)
  const recall = ratio(tp, tp + fn)
  const semanticCorrect = scores.reduce((total, score) => total + score.semanticFields.correct, 0)
  const semanticTotal = scores.reduce((total, score) => total + score.semanticFields.total, 0)
  const safeCorrect = scores.reduce((total, score) => total + score.safeDefaults.correct, 0)
  const safeTotal = scores.reduce((total, score) => total + score.safeDefaults.total, 0)
  return {
    caseCount: scores.length,
    scoreableCases: scores.filter((score) => score.scoreable).length,
    taskPrecision: precision,
    taskRecall: recall,
    taskF1: harmonic(precision, recall),
    requiresActionAccuracy: ratio(scores.filter((score) => score.requiresActionCorrect).length, scores.length),
    semanticFieldAccuracy: ratio(semanticCorrect, semanticTotal),
    exactTaskBoundaryAccuracy: ratio(scores.filter((score) => score.exactTaskBoundary).length, scores.length),
    completeTaskCaseAccuracy: ratio(scores.filter((score) => score.completeTaskCase).length, scores.length),
    majorCorrectionRate: ratio(scores.filter((score) => score.majorCorrection).length, scores.length),
    safeDefaultRecall: ratio(safeCorrect, safeTotal),
    forbiddenDefaultSelections: scores.reduce((total, score) => total + score.forbiddenDefaultSelections, 0),
  }
}

export function pairedTaskFormationDelta(oldScores: TaskFormationCaseScore[], localScores: TaskFormationCaseScore[]) {
  if (oldScores.length !== localScores.length || oldScores.some((score, index) => score.caseId !== localScores[index].caseId)) {
    throw new Error('TASK_FORMATION_PAIRING_MISMATCH')
  }
  const oldAggregate = aggregateTaskFormationScores(oldScores)
  const localAggregate = aggregateTaskFormationScores(localScores)
  const delta = (left: number | null, right: number | null) => left === null || right === null ? null : left - right
  return {
    old: oldAggregate,
    local: localAggregate,
    delta: {
      taskF1: delta(localAggregate.taskF1, oldAggregate.taskF1),
      completeTaskCaseAccuracy: delta(localAggregate.completeTaskCaseAccuracy, oldAggregate.completeTaskCaseAccuracy),
      majorCorrectionRate: delta(localAggregate.majorCorrectionRate, oldAggregate.majorCorrectionRate),
      safeDefaultRecall: delta(localAggregate.safeDefaultRecall, oldAggregate.safeDefaultRecall),
      forbiddenDefaultSelections: localAggregate.forbiddenDefaultSelections - oldAggregate.forbiddenDefaultSelections,
    },
  }
}
