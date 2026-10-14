import { buildLocalRecognition } from './pipeline'
import { recognitionEvaluationDataset, type RecognitionEvaluationFixture } from './evaluationDataset'

export interface RecognitionEvaluationMetrics {
  sampleCount: number
  projectMatchAccuracy: number | null
  projectNameAccuracy: number | null
  stageAccuracy: number | null
  taskPrecision: number | null
  taskRecall: number | null
  duplicateTaskRate: number | null
  overFragmentationRate: number | null
  materialAccuracy: number | null
  timePointAccuracy: number | null
  evidenceAccuracy: number | null
  severeErrorRate: number | null
  humanReviewAgreement: number | null
  averageTaskCount: number | null
  averageConfirmationTimeSeconds: null
}

function tasksOf(result: ReturnType<typeof buildLocalRecognition>) {
  return [...result.standaloneTasks, ...result.milestones.flatMap((milestone) => [
    ...milestone.tasks,
    ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
  ])]
}

function accepted<T extends string>(actual: T, expected: T | T[]): boolean {
  return Array.isArray(expected) ? expected.includes(actual) : expected === actual
}

function ratio(hit: number, total: number): number | null {
  return total ? hit / total : null
}

function mean(values: Array<number | null>): number | null {
  const observed = values.filter((value): value is number => value !== null && Number.isFinite(value))
  return observed.length ? observed.reduce((total, value) => total + value, 0) / observed.length : null
}

function fixtureScore(fixture: RecognitionEvaluationFixture) {
  const result = buildLocalRecognition({ sourceType: 'text', sourceTitle: fixture.sourceTitle, content: fixture.rawText, referenceTime: new Date('2026-08-03T08:00:00+08:00'), timezone: 'Asia/Shanghai', projects: [], tasks: [] })
  const tasks = tasksOf(result)
  const taskText = tasks.map((task) => `${task.actionVerb}${task.actionObject}`).join('\n')
  const matchedActions = fixture.expectedActionKeywords.filter((keyword) => taskText.includes(keyword)).length
  const forbiddenHits = fixture.forbiddenTaskKeywords.filter((keyword) => taskText.includes(keyword)).length
  const taskKeys = tasks.map((task) => `${task.actionVerb}|${task.actionObject}|${task.timePointTempIds.join(',')}`)
  const duplicateCount = taskKeys.length - new Set(taskKeys).size
  const materialNames = result.materials.map((material) => material.name).join('\n')
  const expectedMaterialHits = fixture.expectedMaterials.filter((material) => materialNames.includes(material)).length
  const withinTaskRange = tasks.length >= fixture.expectedTaskCount.min && tasks.length <= fixture.expectedTaskCount.max
  const withinTimeRange = result.timePoints.length >= fixture.expectedTimePointCount.min && result.timePoints.length <= fixture.expectedTimePointCount.max
  const severe = !withinTaskRange || forbiddenHits > 0 || (fixture.expectedTaskCount.max === 0 && tasks.length > 0)
  return {
    projectMatch: accepted(result.sourceSummary.notificationType, fixture.expectedNotificationType),
    projectName: fixture.expectedProjectName === null || (result.projectSuggestion?.title.value ?? '').includes(fixture.expectedProjectName),
    stage: ratio(fixture.expectedStages.filter((stage) => result.milestones.some((milestone) => milestone.title === stage)).length, fixture.expectedStages.length),
    precision: ratio(Math.max(0, tasks.length - forbiddenHits), tasks.length),
    recall: ratio(matchedActions, fixture.expectedActionKeywords.length),
    duplicateCount,
    taskCount: tasks.length,
    overFragmented: !withinTaskRange && tasks.length > fixture.expectedTaskCount.max,
    material: ratio(expectedMaterialHits, fixture.expectedMaterials.length),
    time: withinTimeRange,
    evidence: ratio(result.evidence.filter((evidence) => fixture.rawText.includes(evidence.quotedText ?? evidence.quote)).length, result.evidence.length),
    severe,
    reviewAgreement: result.quality.needsHumanReview === fixture.requiresHumanReview,
  }
}

export function evaluateRecognition(dataset = recognitionEvaluationDataset): RecognitionEvaluationMetrics {
  const scores = dataset.map(fixtureScore)
  const sum = (selector: (score: typeof scores[number]) => number) => scores.reduce((total, score) => total + selector(score), 0)
  return {
    sampleCount: dataset.length,
    projectMatchAccuracy: mean(scores.map((score) => Number(score.projectMatch))),
    projectNameAccuracy: mean(scores.map((score) => Number(score.projectName))),
    stageAccuracy: mean(scores.map((score) => score.stage)),
    taskPrecision: mean(scores.map((score) => score.precision)),
    taskRecall: mean(scores.map((score) => score.recall)),
    duplicateTaskRate: ratio(sum((score) => score.duplicateCount), sum((score) => score.taskCount)),
    overFragmentationRate: mean(scores.map((score) => Number(score.overFragmented))),
    materialAccuracy: mean(scores.map((score) => score.material)),
    timePointAccuracy: mean(scores.map((score) => Number(score.time))),
    evidenceAccuracy: mean(scores.map((score) => score.evidence)),
    severeErrorRate: mean(scores.map((score) => Number(score.severe))),
    humanReviewAgreement: mean(scores.map((score) => Number(score.reviewAgreement))),
    averageTaskCount: ratio(sum((score) => score.taskCount), scores.length),
    averageConfirmationTimeSeconds: null,
  }
}
