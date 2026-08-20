/* global console, process */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { buildR8FactGraphFromCachedRaw } from '../cloudflare/e2-r8-cache-fact-adapter.mjs'
import { aggregateR8ContractCoverage, evaluateR8ContractCoverage } from '../cloudflare/e2-r8-contract-replay-metrics.mjs'
import { planR8RecognitionResult } from '../cloudflare/e2-r8-isolated-planner.mjs'
import { normalizeR8FactGraphReferences } from '../cloudflare/e2-r8-restricted-normalizer.mjs'

const REPLAY_VERSION = 'e2-r8-zero-model-cache-replay-1.1.0'
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex')

function option(name) {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? ''
}

function ratio(numerator, denominator, empty = 1) {
  return denominator ? numerator / denominator : empty
}

function planningError(score) {
  return score.failures.some((failure) => /^(?:project_decision|milestone_|task_|material_|time_|event_|ambiguity_)/u.test(failure.category))
}

function compactMetrics(aggregate, scores) {
  return {
    sampleCount: scores.length,
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
    majorCorrectionRate: aggregate.majorCorrectionRate,
    severeErrorRate: aggregate.severeErrorRate,
    planningErrorRate: ratio(scores.filter(planningError).length, scores.length),
  }
}

function delta(after, before) {
  return Object.fromEntries(Object.keys(after).flatMap((key) => (
    typeof after[key] === 'number' && typeof before[key] === 'number' ? [[key, after[key] - before[key]]] : []
  )))
}

async function refuseOverwrite(file) {
  try { await readFile(file); throw new Error(`REFUSING_TO_OVERWRITE:${file}`) } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
}

async function main() {
  const checkpointPath = path.resolve(option('checkpoint'))
  const sourcePath = path.resolve(option('source-manifest'))
  const outputPath = path.resolve(option('output'))
  const publicPath = path.resolve(option('public-output'))
  if (![option('checkpoint'), option('source-manifest'), option('output'), option('public-output')].every(Boolean)) {
    throw new Error('checkpoint/source-manifest/output/public-output are required')
  }
  await refuseOverwrite(outputPath)
  await refuseOverwrite(publicPath)
  const [checkpointRaw, sourceRaw] = await Promise.all([readFile(checkpointPath, 'utf8'), readFile(sourcePath, 'utf8')])
  const checkpoint = JSON.parse(checkpointRaw)
  const source = JSON.parse(sourceRaw)
  if (checkpoint.gateStatus !== 'COMPLETE' || checkpoint.observations?.length !== 16 || source.screeningCases?.length !== 8) {
    throw new Error('R8_REPLAY_FROZEN_INPUT_INVALID')
  }
  const sourceById = new Map(source.screeningCases.map((item) => [item.caseId, item]))

  const vite = await createServer({ root: process.cwd(), appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })
  try {
    const [schemaModule, goldenModule, holdoutModule, developmentModule, scoringModule] = await Promise.all([
      vite.ssrLoadModule('/src/recognition/schema.ts'),
      vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/scoring.ts'),
    ])
    const fixtures = new Map([
      ...goldenModule.recognitionGoldenDataset,
      ...holdoutModule.recognitionHoldoutDataset,
      ...developmentModule.recognitionGeneralizationDevelopmentDataset,
    ].map((item) => [item.id, item]))
    const details = []
    for (const observation of checkpoint.observations) {
      const input = sourceById.get(observation.caseId)
      const fixture = fixtures.get(observation.caseId)
      if (!input || !fixture) throw new Error(`R8_REPLAY_CASE_MISSING:${observation.caseId}`)
      const raw = JSON.parse(observation.response.payload.rawOutput)
      const factGraph = buildR8FactGraphFromCachedRaw({
        raw, sourceText: input.content, referenceTime: input.referenceTime, timezone: input.timezone,
      })
      const normalizedGraph = normalizeR8FactGraphReferences(factGraph)
      const planned = planR8RecognitionResult(normalizedGraph, {
        modelName: observation.response.payload.result.modelName,
        createdAt: observation.response.payload.result.createdAt,
      })
      const replayResult = schemaModule.parseRecognitionResult(planned)
      const before = scoringModule.scoreRecognitionCase(fixture, 'deepseek-production', observation.response.payload.result, 0, { tokenUsage: null, costUsd: null })
      const after = scoringModule.scoreRecognitionCase(fixture, 'deepseek-production', replayResult, 0, { tokenUsage: null, costUsd: null })
      const beforeContract = evaluateR8ContractCoverage(observation.response.payload.result, normalizedGraph)
      const afterContract = evaluateR8ContractCoverage(replayResult, normalizedGraph)
      details.push({
        caseId: observation.caseId, modelAlias: observation.modelAlias,
        sourceSha256: observation.response.payload.execution.sourceSha256,
        rawOutputSha256: observation.response.payload.execution.rawOutputSha256,
        factGraphSha256: sha256(JSON.stringify(normalizedGraph)), resultSha256: sha256(JSON.stringify(replayResult)),
        counts: {
          rawObligations: normalizedGraph.obligations.length,
          rawEvents: normalizedGraph.events.length,
          beforeTasks: before.scores.taskPredicted, afterTasks: after.scores.taskPredicted,
          beforeEvents: before.scores.eventPredicted, afterEvents: after.scores.eventPredicted,
        },
        before, after, beforeContract, afterContract,
      })
    }

    const arms = {}
    for (const alias of ['flash', 'pro']) {
      const armDetails = details.filter((item) => item.modelAlias === alias)
      const beforeScores = armDetails.map((item) => item.before)
      const afterScores = armDetails.map((item) => item.after)
      const before = compactMetrics(scoringModule.aggregateRecognitionMetrics('deepseek-production', beforeScores), beforeScores)
      const after = compactMetrics(scoringModule.aggregateRecognitionMetrics('deepseek-production', afterScores), afterScores)
      const contractBefore = aggregateR8ContractCoverage(armDetails.map((item) => item.beforeContract))
      const contractAfter = aggregateR8ContractCoverage(armDetails.map((item) => item.afterContract))
      arms[alias] = {
        strict: { before, after, delta: delta(after, before) },
        contract: { before: contractBefore, after: contractAfter, delta: delta(contractAfter.rates, contractBefore.rates) },
      }
    }
    const allBeforeScores = details.map((item) => item.before)
    const allAfterScores = details.map((item) => item.after)
    const allBefore = compactMetrics(scoringModule.aggregateRecognitionMetrics('deepseek-production', allBeforeScores), allBeforeScores)
    const allAfter = compactMetrics(scoringModule.aggregateRecognitionMetrics('deepseek-production', allAfterScores), allAfterScores)
    const contractBefore = aggregateR8ContractCoverage(details.map((item) => item.beforeContract))
    const contractAfter = aggregateR8ContractCoverage(details.map((item) => item.afterContract))
    const strictChecks = {
      zeroModelCalls: true,
      sixteenFrozenObservations: details.length === 16,
      taskRecallNotWorse: allAfter.taskRecall >= allBefore.taskRecall,
      taskPrecisionDropAtMost3pp: allAfter.taskPrecision >= allBefore.taskPrecision - 0.03,
      evidenceCoverageAtLeast95: allAfter.evidenceCoverage >= 0.95,
      severeErrorNotWorse: allAfter.severeErrorRate <= allBefore.severeErrorRate,
      planningErrorLower: allAfter.planningErrorRate < allBefore.planningErrorRate,
      majorCorrectionLower: allAfter.majorCorrectionRate < allBefore.majorCorrectionRate,
      noArmSevereRegression: ['flash', 'pro'].every((alias) => arms[alias].strict.after.severeErrorRate <= arms[alias].strict.before.severeErrorRate),
    }
    const contractChecks = {
      zeroModelCalls: true,
      sixteenFrozenObservations: details.length === 16,
      factLossLower: contractAfter.counts.factLosses < contractBefore.counts.factLosses,
      factCoverageHigher: contractAfter.rates.factCoverage > contractBefore.rates.factCoverage,
      obligationCoverageNotWorse: contractAfter.rates.obligationCoverage >= contractBefore.rates.obligationCoverage,
      timeRoleAccuracyNotWorse: contractAfter.rates.timeRoleAccuracy >= contractBefore.rates.timeRoleAccuracy,
      conditionCoverageNotWorse: contractAfter.rates.conditionCoverage >= contractBefore.rates.conditionCoverage,
      ambiguityCoverageNotWorse: contractAfter.rates.ambiguityCoverage >= contractBefore.rates.ambiguityCoverage,
      unsupportedTaskRateNotWorse: contractAfter.rates.unsupportedTaskRate <= contractBefore.rates.unsupportedTaskRate,
      falsePrecisionTimeRateNotWorse: contractAfter.rates.falsePrecisionTimeRate <= contractBefore.rates.falsePrecisionTimeRate,
      evidenceCoverageAtLeast95: allAfter.evidenceCoverage >= 0.95,
      severeErrorNotWorse: allAfter.severeErrorRate <= allBefore.severeErrorRate,
    }
    const strictScoreGatePassed = Object.values(strictChecks).every(Boolean)
    const architectureProofPassed = Object.values(contractChecks).every(Boolean)
    const replayProofPassed = strictScoreGatePassed && architectureProofPassed
    const detailed = {
      schemaVersion: 'e2.9-r8-cache-replay-detail-1.0.0', replayVersion: REPLAY_VERSION,
      generatedAt: new Date().toISOString(), modelCalls: 0,
      inputs: { checkpointSha256: sha256(checkpointRaw), sourceManifestSha256: sha256(sourceRaw) },
      arms,
      overall: {
        strict: { before: allBefore, after: allAfter, delta: delta(allAfter, allBefore) },
        contract: { before: contractBefore, after: contractAfter, delta: delta(contractAfter.rates, contractBefore.rates) },
      },
      gates: { strictChecks, contractChecks, strictScoreGatePassed, architectureProofPassed, replayProofPassed },
      details,
    }
    const publicResult = {
      schemaVersion: 'e2.9-r8-cache-replay-public-1.0.0', replayVersion: REPLAY_VERSION,
      generatedAt: detailed.generatedAt, modelCalls: 0, observationCount: details.length,
      inputs: detailed.inputs, arms, overall: detailed.overall, gates: detailed.gates,
      evaluationContractNote: 'Frozen strict Expected and fact-preservation contract are reported separately; neither overwrites the other.',
      nextStage: replayProofPassed ? 'ELIGIBLE_TO_REQUEST_FRESH_SCREENING' : 'FRESH_SCREENING_NOT_REQUESTED',
      selection: 'NOT_RUN', blind: 'NOT_CREATED', production: 'NOT_DEPLOYED',
    }
    await mkdir(path.dirname(outputPath), { recursive: true })
    await mkdir(path.dirname(publicPath), { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(detailed, null, 2)}\n`, 'utf8')
    await writeFile(publicPath, `${JSON.stringify(publicResult, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify({ replayProofPassed, strictScoreGatePassed, architectureProofPassed, strictChecks, contractChecks, overall: publicResult.overall, outputPath, publicPath }, null, 2))
    if (!replayProofPassed) process.exitCode = 2
  } finally {
    await vite.close()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
