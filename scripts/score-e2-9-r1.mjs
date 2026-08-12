/* global console, process */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'
import { canonicalJson, sha256 } from './e2-9-r1-hash.mjs'

const ROOT = process.cwd()
const PROTOCOL_VERSION = 'e2-9-v4-pro-reduced-protocol-2.0.0'

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function ratio(numerator, denominator, empty = 1) {
  return denominator ? numerator / denominator : empty
}

function percentile(values, q) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)]
}

function planningError(score) {
  return score.failures.some((failure) => /^(?:project_decision|milestone_|task_|material_|time_|event_|ambiguity_)/u.test(failure.category))
}

function compactMetrics(alias, results, observations, aggregate) {
  const sum = (pick) => results.reduce((total, item) => total + pick(item), 0)
  const aliasObservations = observations.filter((item) => item.modelAlias === alias)
  const latencies = aliasObservations.map((item) => item.response?.payload?.execution?.durationMs).filter(Number.isFinite)
  const usage = aliasObservations.map((item) => item.response?.payload?.execution?.tokenUsage).filter(Boolean)
  return {
    modelAlias: alias,
    sampleCount: results.length,
    completedCount: results.filter((item) => item.status === 'ok').length,
    strict: {
      taskPrecision: aggregate.taskPrecision,
      taskRecall: aggregate.taskRecall,
      milestonePrecision: aggregate.milestonePrecision,
      milestoneRecall: aggregate.milestoneRecall,
      materialPrecision: aggregate.materialPrecision,
      materialRecall: aggregate.materialRecall,
      timePointTypeAccuracy: aggregate.timePointTypeAccuracy,
      timePointValueAccuracy: aggregate.timePointValueAccuracy,
      eventAccuracy: aggregate.eventAccuracy,
      ambiguityPrecision: aggregate.ambiguityPrecision,
      ambiguityRecall: aggregate.ambiguityRecall,
      evidenceCoverage: aggregate.evidenceCoverage,
      evidenceValidity: aggregate.evidenceValidity,
      strictMajorCorrectionRate: aggregate.majorCorrectionRate,
      severeErrorRate: aggregate.severeErrorRate,
      planningErrorRate: ratio(results.filter(planningError).length, results.length),
      invalidOutputRate: aggregate.invalidOutputRate,
      transportFailureRate: ratio(aliasObservations.filter((item) => item.status === 'transport_failure').length, results.length, 0),
      promptInjectionPass: !results.some((item) => item.failures.some((failure) => failure.category === 'forbidden_output')),
    },
    latencyMs: { mean: ratio(latencies.reduce((a, b) => a + b, 0), latencies.length, 0), p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) },
    tokens: usage.length === results.length ? { input: usage.reduce((total, item) => total + item.input, 0), output: usage.reduce((total, item) => total + item.output, 0), total: usage.reduce((total, item) => total + item.total, 0), meanTotal: ratio(usage.reduce((total, item) => total + item.total, 0), usage.length, 0) } : null,
    semantic: 'PENDING_PATH_MASKED_REVIEW',
    userImpact: 'PENDING_PATH_MASKED_REVIEW',
    pairReview: 'PENDING_PATH_MASKED_REVIEW',
  }
}

async function main() {
  const checkpointPath = path.resolve(ROOT, option('checkpoint'))
  const outputPath = path.resolve(ROOT, option('output'))
  const aggregatePath = path.resolve(ROOT, option('aggregate'))
  if (!option('checkpoint') || !option('output') || !option('aggregate')) throw new Error('--checkpoint, --output and --aggregate are required')
  const checkpointRaw = await readFile(checkpointPath, 'utf8')
  const checkpoint = JSON.parse(checkpointRaw)
  if (checkpoint.protocolVersion !== PROTOCOL_VERSION || checkpoint.gateStatus !== 'COMPLETE') throw new Error('Only a complete R1 checkpoint can be scored')
  if (checkpoint.observations.length !== checkpoint.expectedObservations || checkpoint.observations.some((item) => item.status !== 'complete')) throw new Error('Incomplete observations cannot be scored as model quality')
  const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })
  try {
    const [goldenModule, holdoutModule, developmentModule, scoringModule] = await Promise.all([
      vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/scoring.ts'),
    ])
    const fixtures = new Map([...goldenModule.recognitionGoldenDataset, ...holdoutModule.recognitionHoldoutDataset, ...developmentModule.recognitionGeneralizationDevelopmentDataset].map((fixture) => [fixture.id, fixture]))
    const perAlias = {}
    const rawScores = []
    for (const alias of ['flash', 'pro']) {
      const observations = checkpoint.observations.filter((item) => item.modelAlias === alias)
      const scores = observations.map((observation) => {
        const fixture = fixtures.get(observation.caseId)
        if (!fixture) throw new Error(`Expected fixture missing after generation: ${observation.caseId}`)
        const execution = observation.response.payload.execution
        const score = scoringModule.scoreRecognitionCase(fixture, 'deepseek-production', observation.response.payload.result, execution.durationMs, { tokenUsage: { input: execution.tokenUsage.input, output: execution.tokenUsage.output }, costUsd: null })
        rawScores.push({ modelAlias: alias, score })
        return score
      })
      const aggregate = scoringModule.aggregateRecognitionMetrics('deepseek-production', scores)
      perAlias[alias] = compactMetrics(alias, scores, checkpoint.observations, aggregate)
    }
    const result = { schemaVersion: 'e2.9-r1-strict-score-1.0.0', protocolVersion: PROTOCOL_VERSION, phase: checkpoint.phase, checkpointSha256: sha256(checkpointRaw), scoredAfterGenerationAt: new Date().toISOString(), rawScores }
    const aggregate = {
      schemaVersion: 'e2.9-r1-anonymous-aggregate-1.0.0', protocolVersion: PROTOCOL_VERSION, phase: checkpoint.phase,
      sourceOnlySha256: checkpoint.sourceOnlySha256, checkpointSha256: sha256(checkpointRaw), scorerInputSha256: sha256(canonicalJson({ checkpointSha256: sha256(checkpointRaw), phase: checkpoint.phase })),
      expectedReadBoundary: 'Expected fixtures loaded only by this scorer after all paired outputs were complete.', arms: perAlias,
    }
    await mkdir(path.dirname(outputPath), { recursive: true })
    await mkdir(path.dirname(aggregatePath), { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
    await writeFile(aggregatePath, `${JSON.stringify(aggregate, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify({ phase: checkpoint.phase, output: path.relative(ROOT, outputPath), aggregate: path.relative(ROOT, aggregatePath), outputSha256: sha256(await readFile(outputPath, 'utf8')), aggregateSha256: sha256(await readFile(aggregatePath, 'utf8')) }, null, 2))
  } finally { await vite.close() }
}

await main()
