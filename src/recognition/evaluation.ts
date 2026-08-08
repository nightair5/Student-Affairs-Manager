import { buildLocalRecognition } from './pipeline'
import { recognitionEvaluationDataset, type RecognitionEvaluationFixture } from './evaluationDataset'

export interface RecognitionEvaluationMetrics {
  sampleCount: number
  projectMatchAccuracy: number
  projectNameAccuracy: number
  stageAccuracy: number
  taskPrecision: number
  taskRecall: number
  duplicateTaskRate: number
  overFragmentationRate: number
  materialAccuracy: number
  timePointAccuracy: number
  evidenceAccuracy: number
  severeErrorRate: number
  humanReviewAgreement: number
  averageTaskCount: number
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

function ratio(hit: number, total: number): number {
  return total ? hit / total : 1
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
    projectMatchAccuracy: ratio(sum((score) => Number(score.projectMatch)), scores.length),
    projectNameAccuracy: ratio(sum((score) => Number(score.projectName)), scores.length),
    stageAccuracy: ratio(sum((score) => score.stage), scores.length),
    taskPrecision: ratio(sum((score) => score.precision), scores.length),
    taskRecall: ratio(sum((score) => score.recall), scores.length),
    duplicateTaskRate: ratio(sum((score) => score.duplicateCount), sum((score) => score.taskCount)),
    overFragmentationRate: ratio(sum((score) => Number(score.overFragmented)), scores.length),
    materialAccuracy: ratio(sum((score) => score.material), scores.length),
    timePointAccuracy: ratio(sum((score) => Number(score.time)), scores.length),
    evidenceAccuracy: ratio(sum((score) => score.evidence), scores.length),
    severeErrorRate: ratio(sum((score) => Number(score.severe)), scores.length),
    humanReviewAgreement: ratio(sum((score) => Number(score.reviewAgreement)), scores.length),
    averageTaskCount: ratio(sum((score) => score.taskCount), scores.length),
    averageConfirmationTimeSeconds: null,
  }
}
