/* global console, process */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { benchmarkPlannerSystemPrompt } from '../cloudflare/e2-v4-pro-benchmark-planner.mjs'
import { canonicalJson, sha256 } from './e2-9-r1-hash.mjs'

export const R7_SCORER_VERSION = 'e2-9-r7-strict-scorer-1.0.0'
const PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.6.0'
const SOURCE_PROTOCOL_VERSION = 'e2-9-v4-pro-reduced-protocol-2.0.0'
const PROMPT_VERSION = 'recognition-2.4.1-r7-preview'
const PIPELINE_VERSION = 'recognition-pipeline-2.2.2-r7-preview'
const NORMALIZER_VERSION = 'e2-v4-pro-benchmark-normalizer-2.2.0'
const PLANNER_VERSION = 'e2-v4-pro-benchmark-planner-1.0.0'
const PROMPT_SHA256 = sha256(benchmarkPlannerSystemPrompt())

function option(name) {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? ''
}

function ratio(numerator, denominator, empty = 1) {
  return denominator ? numerator / denominator : empty
}

function percentile(values, q) {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)]
}

function planningError(score) {
  return score.failures.some((failure) => /^(?:project_decision|milestone_|task_|material_|time_|event_|ambiguity_)/u.test(failure.category))
}

function compactMetrics(alias, results, observations, aggregate) {
  const aliasObservations = observations.filter((item) => item.modelAlias === alias)
  const latencies = aliasObservations.map((item) => item.response?.payload?.execution?.durationMs).filter(Number.isFinite)
  const usage = aliasObservations.map((item) => item.response?.payload?.execution?.tokenUsage).filter(Boolean)
  const totalTokens = usage.reduce((total, item) => total + item.total, 0)
  return {
    modelAlias: alias,
    sampleCount: results.length,
    completedCount: results.filter((item) => item.status === 'ok').length,
    strict: {
      taskPrecision: aggregate.taskPrecision, taskRecall: aggregate.taskRecall,
      milestonePrecision: aggregate.milestonePrecision, milestoneRecall: aggregate.milestoneRecall,
      materialPrecision: aggregate.materialPrecision, materialRecall: aggregate.materialRecall,
      timePointTypeAccuracy: aggregate.timePointTypeAccuracy, timePointValueAccuracy: aggregate.timePointValueAccuracy,
      eventAccuracy: aggregate.eventAccuracy, ambiguityPrecision: aggregate.ambiguityPrecision, ambiguityRecall: aggregate.ambiguityRecall,
      evidenceCoverage: aggregate.evidenceCoverage, evidenceValidity: aggregate.evidenceValidity,
      strictMajorCorrectionRate: aggregate.majorCorrectionRate, severeErrorRate: aggregate.severeErrorRate,
      planningErrorRate: ratio(results.filter(planningError).length, results.length),
      promptInjectionPass: !results.some((item) => item.failures.some((failure) => failure.category === 'forbidden_output')),
    },
    latencyMs: { mean: ratio(latencies.reduce((total, value) => total + value, 0), latencies.length, 0), p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) },
    tokens: usage.length === results.length ? { input: usage.reduce((total, item) => total + item.input, 0), output: usage.reduce((total, item) => total + item.output, 0), total: totalTokens, meanTotal: ratio(totalTokens, usage.length, 0) } : null,
    semantic: 'PENDING_PATH_MASKED_REVIEW', userImpact: 'PENDING_PATH_MASKED_REVIEW', pairReview: 'PENDING_PATH_MASKED_REVIEW',
  }
}

export function assertR7ScoringInput(checkpoint, checkpointRaw, source) {
  if (checkpoint.protocolVersion !== PROTOCOL_VERSION || checkpoint.phase !== 'screening' || checkpoint.gateStatus !== 'COMPLETE'
    || checkpoint.expectedObservations !== 16 || checkpoint.observations?.length !== 16 || checkpoint.observations.some((item) => item.status !== 'complete')) throw new Error('R7_COMPLETE_SCREENING_REQUIRED')
  if (source.protocolVersion !== SOURCE_PROTOCOL_VERSION || source.screeningCases?.length !== 8 || checkpoint.sourceOnlySha256 !== sha256(canonicalJson(source))) throw new Error('R7_SOURCE_BINDING_FAILED')
  if (checkpoint.promptSha256 !== PROMPT_SHA256) throw new Error('R7_PROMPT_BINDING_FAILED')
  const sourceByCase = new Map(source.screeningCases.map((item) => [item.caseId, item]))
  const expectedPairs = new Set(source.screeningCases.flatMap((item) => ['flash', 'pro'].map((alias) => `${item.caseId}:${alias}`)))
  if (new Set(checkpoint.observations.map((item) => `${item.caseId}:${item.modelAlias}`)).size !== 16
    || checkpoint.observations.some((item) => !expectedPairs.has(`${item.caseId}:${item.modelAlias}`))) throw new Error('R7_PAIR_SET_FAILED')
  for (const item of checkpoint.observations) {
    const payload = item.response?.payload
    const execution = payload?.execution
    const expectedModel = `deepseek-v4-${item.modelAlias}`
    if (item.semanticRole !== sourceByCase.get(item.caseId)?.semanticRole || item.requestedModel !== expectedModel
      || payload?.benchmarkVersion !== 'e2-v4-pro-benchmark-2.2.0' || payload?.semanticRole !== item.semanticRole || execution?.semanticRole !== item.semanticRole
      || execution?.promptVersion !== PROMPT_VERSION || execution?.promptSha256 !== PROMPT_SHA256 || payload?.result?.promptVersion !== PROMPT_VERSION
      || execution?.pipelineVersion !== PIPELINE_VERSION || execution?.normalizer !== NORMALIZER_VERSION || execution?.plannerVersion !== PLANNER_VERSION
      || execution?.schemaVersion !== '2.0' || payload?.result?.schemaVersion !== '2.0'
      || ![execution?.requestedModel, execution?.returnedModel, execution?.executionModel, payload?.result?.modelName].every((value) => value === expectedModel)
      || execution?.attempts?.length !== 1 || !Array.isArray(payload?.validation?.benchmarkPlannerIssues) || payload.validation.benchmarkPlannerIssues.length !== 0) throw new Error(`R7_OBSERVATION_BINDING_FAILED:${item.caseId}:${item.modelAlias}`)
  }
  return { checkpointSha256: sha256(checkpointRaw), sourceOnlySha256: checkpoint.sourceOnlySha256, promptSha256: PROMPT_SHA256 }
}

async function main() {
  const checkpointPath = path.resolve(option('checkpoint'))
  const sourcePath = path.resolve(option('source-manifest'))
  const outputPath = path.resolve(option('output'))
  const aggregatePath = path.resolve(option('aggregate'))
  if (![option('checkpoint'), option('source-manifest'), option('output'), option('aggregate')].every(Boolean)) throw new Error('checkpoint/source-manifest/output/aggregate are required')
  const [checkpointRaw, sourceRaw] = await Promise.all([readFile(checkpointPath, 'utf8'), readFile(sourcePath, 'utf8')])
  const checkpoint = JSON.parse(checkpointRaw)
  const source = JSON.parse(sourceRaw)
  assertR7ScoringInput(checkpoint, checkpointRaw, source)

  const vite = await createServer({ root: process.cwd(), appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })
  try {
    const [goldenModule, holdoutModule, developmentModule, scoringModule] = await Promise.all([
      vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/scoring.ts'),
    ])
    const fixtures = new Map([...goldenModule.recognitionGoldenDataset, ...holdoutModule.recognitionHoldoutDataset, ...developmentModule.recognitionGeneralizationDevelopmentDataset].map((fixture) => [fixture.id, fixture]))
    const rawScores = []
    const arms = {}
    for (const alias of ['flash', 'pro']) {
      const results = checkpoint.observations.filter((item) => item.modelAlias === alias).map((observation) => {
        const fixture = fixtures.get(observation.caseId)
        if (!fixture) throw new Error(`EXPECTED_MISSING_AFTER_GENERATION:${observation.caseId}`)
        const execution = observation.response.payload.execution
        const score = scoringModule.scoreRecognitionCase(fixture, 'deepseek-production', observation.response.payload.result, execution.durationMs, { tokenUsage: execution.tokenUsage, costUsd: null })
        rawScores.push({ modelAlias: alias, score })
        return score
      })
      arms[alias] = compactMetrics(alias, results, checkpoint.observations, scoringModule.aggregateRecognitionMetrics('deepseek-production', results))
    }
    const checkpointSha256 = sha256(checkpointRaw)
    const result = { schemaVersion: 'e2.9-r7-strict-score-1.0.0', protocolVersion: PROTOCOL_VERSION, scorerVersion: R7_SCORER_VERSION, recognitionSchemaVersion: '2.0', phase: 'screening', sourceOnlySha256: checkpoint.sourceOnlySha256, checkpointSha256, promptSha256: PROMPT_SHA256, scoredAfterGenerationAt: new Date().toISOString(), rawScores }
    const aggregate = { schemaVersion: 'e2.9-r7-anonymous-aggregate-1.0.0', protocolVersion: PROTOCOL_VERSION, scorerVersion: R7_SCORER_VERSION, recognitionSchemaVersion: '2.0', phase: 'screening', sourceOnlySha256: checkpoint.sourceOnlySha256, checkpointSha256, promptSha256: PROMPT_SHA256, scorerInputSha256: sha256(canonicalJson({ checkpointSha256, phase: 'screening', promptSha256: PROMPT_SHA256 })), expectedReadBoundary: 'Expected fixtures loaded only by this scorer after all paired outputs were complete.', arms }
    await mkdir(path.dirname(outputPath), { recursive: true })
    await mkdir(path.dirname(aggregatePath), { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
    await writeFile(aggregatePath, `${JSON.stringify(aggregate, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify({ checkpointSha256, output: outputPath, outputSha256: sha256(await readFile(outputPath, 'utf8')), aggregate: aggregatePath, aggregateSha256: sha256(await readFile(aggregatePath, 'utf8')) }, null, 2))
  } finally { await vite.close() }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
