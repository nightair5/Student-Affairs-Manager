import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { recognitionGoldenDataset } from '../src/recognition/e2/goldenDataset'
import { recognitionHoldoutDataset } from '../src/recognition/e2/holdoutDataset'
import { aggregateRecognitionMetrics } from '../src/recognition/e2/scoring'
import type {
  ErrorCategory,
  RecognitionCaseResult,
  RecognitionGoldenCase,
} from '../src/recognition/e2/types'
import { validateRecognitionQuality } from '../src/recognition/qualityValidator'

type RouteLevel = 'simple' | 'medium' | 'complex'

interface AuditRun {
  dataset: 'golden' | 'exposed-holdout'
  sampleCount: number
  overall: ReturnType<typeof aggregateRecognitionMetrics>
  byGroup: Record<string, ReturnType<typeof aggregateRecognitionMetrics>>
  byRoute: Record<string, ReturnType<typeof aggregateRecognitionMetrics>>
  routeAssessment: {
    exact: number
    underRouted: number
    overRouted: number
    confusion: Record<string, number>
  }
  repair: {
    attempted: number
    applied: number
    failed: number
    finalMajorAfterAttempt: number
    finalSevereAfterAttempt: number
    issueCodes: Record<string, number>
    semanticSuccess: 'NOT_OBSERVABLE_WITHOUT_PRE_REPAIR_RESULT'
    harmRate: 'NOT_OBSERVABLE_WITHOUT_PRE_REPAIR_RESULT'
  }
  validatorOnFinalOutput: {
    issuePrecision: number
    issueRecall: number
    truePositive: number
    predicted: number
    expected: number
    predictedCodes: Record<string, number>
    expectedCodes: Record<string, number>
    truePositiveCodes: Record<string, number>
    note: string
  }
  errorCounts: Record<string, number>
}

const repositoryRoot = process.cwd()

const checkpointPaths = {
  golden: path.join(repositoryRoot, '.evaluation-cache', 'deepseek-production-golden-after-2-3-golden-pass.json'),
  'exposed-holdout': path.join(repositoryRoot, '.evaluation-cache', 'deepseek-production-holdout-after-2-3-holdout.json'),
} as const

const levelIndex: Record<RouteLevel, number> = { simple: 0, medium: 1, complex: 2 }

function expectedRoute(fixture: RecognitionGoldenCase): RouteLevel {
  const expected = fixture.expected
  const entityLoad = expected.tasks.length
    + expected.materials.length
    + expected.timePoints.length
    + expected.events.length
    + expected.ambiguities.length
  if (
    expected.tasks.length >= 3
    || expected.timePoints.length >= 3
    || expected.events.length >= 2
    || expected.materials.length >= 4
    || entityLoad >= 10
    || (expected.ambiguities.length >= 2 && expected.timePoints.length >= 2)
  ) return 'complex'
  if (
    expected.tasks.length >= 2
    || expected.timePoints.length >= 2
    || expected.materials.length >= 2
    || (expected.events.length >= 1 && entityLoad >= 3)
    || expected.ambiguities.length >= 1
  ) return 'medium'
  return 'simple'
}

const failureToValidatorCode: Partial<Record<ErrorCategory, string>> = {
  milestone_missing: 'MISSING_MILESTONE',
  material_missing: 'MISSING_MATERIAL',
  time_missing: 'MISSING_TIMEPOINT',
  time_incorrect: 'FALSE_PRECISION',
  event_missing: 'MISSING_EVENT',
  evidence_missing: 'MISSING_EVIDENCE',
  evidence_invalid: 'EVIDENCE_NOT_SUPPORTED',
  ambiguity_missing: 'MISSING_TIME_AMBIGUITY',
  over_fragmentation: 'OVER_FRAGMENTATION',
}

function ratio(numerator: number, denominator: number): number {
  return denominator ? numerator / denominator : 0
}

function countBy<T>(values: T[], key: (value: T) => string): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    const group = key(value)
    counts[group] = (counts[group] ?? 0) + 1
    return counts
  }, {})
}

function metricsBy(
  results: RecognitionCaseResult[],
  key: (value: RecognitionCaseResult) => string,
): Record<string, ReturnType<typeof aggregateRecognitionMetrics>> {
  const groups = new Map<string, RecognitionCaseResult[]>()
  results.forEach((result) => {
    const group = key(result)
    groups.set(group, [...(groups.get(group) ?? []), result])
  })
  return Object.fromEntries([...groups.entries()].map(([group, items]) => [
    group,
    aggregateRecognitionMetrics('deepseek-production', items),
  ]))
}

async function loadCheckpoint(dataset: keyof typeof checkpointPaths): Promise<RecognitionCaseResult[]> {
  return JSON.parse(await readFile(checkpointPaths[dataset], 'utf8')) as RecognitionCaseResult[]
}

function auditRun(
  dataset: AuditRun['dataset'],
  fixtures: RecognitionGoldenCase[],
  results: RecognitionCaseResult[],
): AuditRun {
  const fixturesById = new Map(fixtures.map((fixture) => [fixture.id, fixture]))
  const resultIds = new Set(results.map((result) => result.caseId))
  const missing = fixtures.filter((fixture) => !resultIds.has(fixture.id)).map((fixture) => fixture.id)
  if (missing.length) throw new Error(`${dataset} checkpoint is missing: ${missing.join(', ')}`)

  const routeConfusion: Record<string, number> = {}
  let exact = 0
  let underRouted = 0
  let overRouted = 0
  for (const result of results) {
    const fixture = fixturesById.get(result.caseId)
    if (!fixture) throw new Error(`${dataset} contains unknown case ${result.caseId}`)
    const expected = expectedRoute(fixture)
    const actual = result.route?.level ?? 'simple'
    const key = `${expected}->${actual}`
    routeConfusion[key] = (routeConfusion[key] ?? 0) + 1
    if (actual === expected) exact += 1
    else if (levelIndex[actual] < levelIndex[expected]) underRouted += 1
    else overRouted += 1
  }

  const repairAttempts = results.filter((result) => result.repair?.attempted)
  const issueCodes = repairAttempts.flatMap((result) => result.repair?.issueCodes ?? [])

  let validatorTruePositive = 0
  let validatorPredicted = 0
  let validatorExpected = 0
  const validatorPredictedCodes: string[] = []
  const validatorExpectedCodes: string[] = []
  const validatorTruePositiveCodes: string[] = []
  for (const result of results) {
    const fixture = fixturesById.get(result.caseId)
    if (!fixture || !result.result || result.status !== 'ok') continue
    const predicted = new Set(validateRecognitionQuality(result.result, fixture.rawText).issues.map((issue) => issue.code))
    const expected = new Set(result.failures.flatMap((failure) => {
      const code = failureToValidatorCode[failure.category]
      return code ? [code] : []
    }))
    validatorPredicted += predicted.size
    validatorExpected += expected.size
    const truePositiveCodes = [...predicted].filter((code) => expected.has(code))
    validatorTruePositive += truePositiveCodes.length
    validatorPredictedCodes.push(...predicted)
    validatorExpectedCodes.push(...expected)
    validatorTruePositiveCodes.push(...truePositiveCodes)
  }

  return {
    dataset,
    sampleCount: results.length,
    overall: aggregateRecognitionMetrics('deepseek-production', results),
    byGroup: metricsBy(results, (result) => result.group),
    byRoute: metricsBy(results, (result) => result.route?.level ?? 'unknown'),
    routeAssessment: {
      exact,
      underRouted,
      overRouted,
      confusion: routeConfusion,
    },
    repair: {
      attempted: repairAttempts.length,
      applied: repairAttempts.filter((result) => result.repair?.applied).length,
      failed: repairAttempts.filter((result) => Boolean(result.repair?.errorCode)).length,
      finalMajorAfterAttempt: repairAttempts.filter((result) => result.scores.majorCorrection).length,
      finalSevereAfterAttempt: repairAttempts.filter((result) => result.scores.severeError).length,
      issueCodes: countBy(issueCodes, (code) => code),
      semanticSuccess: 'NOT_OBSERVABLE_WITHOUT_PRE_REPAIR_RESULT',
      harmRate: 'NOT_OBSERVABLE_WITHOUT_PRE_REPAIR_RESULT',
    },
    validatorOnFinalOutput: {
      issuePrecision: ratio(validatorTruePositive, validatorPredicted),
      issueRecall: ratio(validatorTruePositive, validatorExpected),
      truePositive: validatorTruePositive,
      predicted: validatorPredicted,
      expected: validatorExpected,
      predictedCodes: countBy(validatorPredictedCodes, (code) => code),
      expectedCodes: countBy(validatorExpectedCodes, (code) => code),
      truePositiveCodes: countBy(validatorTruePositiveCodes, (code) => code),
      note: 'Proxy only: current validator rerun on final output versus evaluator failure categories. Pre-repair warning precision/recall was not persisted.',
    },
    errorCounts: countBy(results.flatMap((result) => result.failures), (failure) => failure.category),
  }
}

const goldenResults = await loadCheckpoint('golden')
const holdoutResults = await loadCheckpoint('exposed-holdout')

const report = {
  generatedAt: new Date().toISOString(),
  candidate: {
    commit: 'b7f6be8',
    promptVersion: 'recognition-2.3.0',
    pipelineVersion: 'recognition-pipeline-2.1.2',
    modelName: 'deepseek-v4-flash',
  },
  routeLabeling: {
    kind: 'audit-derived-risk-proxy',
    rule: 'Complex when >=3 tasks/times, >=2 events, >=4 materials, entity load >=10, or multi-ambiguity+multi-time; medium for multi-entity/ambiguity; otherwise simple.',
    warning: 'The frozen datasets have no authored router label, so this is not a ground-truth router accuracy metric.',
  },
  golden: auditRun('golden', recognitionGoldenDataset, goldenResults),
  exposedHoldout: auditRun('exposed-holdout', recognitionHoldoutDataset, holdoutResults),
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
