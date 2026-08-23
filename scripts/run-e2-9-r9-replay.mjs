/* global console, process */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { buildR8FactGraphFromCachedRaw } from '../cloudflare/e2-r8-cache-fact-adapter.mjs'
import { normalizeR8FactGraphReferences } from '../cloudflare/e2-r8-restricted-normalizer.mjs'
import { aggregateR9ContractCoverage, evaluateR9ContractCoverage } from '../cloudflare/e2-r9-contract-replay-metrics.mjs'
import { planR9RecognitionResult, R9_ISOLATED_PLANNER_VERSION, R9_PLAN_CONTRACT_VERSION } from '../cloudflare/e2-r9-isolated-planner.mjs'

const FROZEN_CHECKPOINT_SHA256 = '0886afb941eeb74d80d9ed35601ee50447c0e4b464310ac197fd39df006fa336'
const FROZEN_SOURCE_MANIFEST_SHA256 = '115b43f98d0ca56cac522d0272ed10894fa0cc2a185562d0c10ce4bff7aca12f'
const R9_REPLAY_VERSION = 'e2-r9-zero-model-cache-replay-1.0.0'

function option(name) {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? ''
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
}

const canonicalJson = (value) => JSON.stringify(canonical(value))
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex')

async function refuseOverwrite(file) {
  try {
    await readFile(file)
    throw new Error(`REFUSING_TO_OVERWRITE:${file}`)
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
}

function assertFrozenInputs(checkpointRaw, sourceRaw) {
  if (sha256(checkpointRaw) !== FROZEN_CHECKPOINT_SHA256 || sha256(sourceRaw) !== FROZEN_SOURCE_MANIFEST_SHA256) {
    throw new Error('R9_REPLAY_FROZEN_INPUT_HASH_MISMATCH')
  }
  const checkpoint = JSON.parse(checkpointRaw)
  const source = JSON.parse(sourceRaw)
  if (checkpoint.gateStatus !== 'COMPLETE' || checkpoint.observations?.length !== 16 || source.screeningCases?.length !== 8) {
    throw new Error('R9_REPLAY_FROZEN_INPUT_INVALID')
  }
  if (new Set(checkpoint.observations.map((item) => item.observationId)).size !== 16) throw new Error('R9_REPLAY_OBSERVATION_ID_DUPLICATE')
  const counts = new Map()
  for (const observation of checkpoint.observations) counts.set(observation.caseId, (counts.get(observation.caseId) ?? 0) + 1)
  if (counts.size !== 8 || [...counts.values()].some((count) => count !== 2)) throw new Error('R9_REPLAY_SOURCE_PAIRING_INVALID')
  return { checkpoint, source }
}

function scanForbiddenEvaluationKeys(value, currentPath = '$', findings = []) {
  if (Array.isArray(value)) value.forEach((item, index) => scanForbiddenEvaluationKeys(item, `${currentPath}[${index}]`, findings))
  else if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (/^(?:expected|expectedanswer|expectedanswers|goldenanswer|strictscore|score)$/iu.test(key)) findings.push(`${currentPath}.${key}`)
      scanForbiddenEvaluationKeys(nested, `${currentPath}.${key}`, findings)
    }
  }
  return findings
}

function flattenTaskCount(result) {
  return (result.standaloneTasks?.length ?? 0) + (result.milestones ?? []).reduce((sum, milestone) => (
    sum + (milestone.tasks?.length ?? 0) + (milestone.workPackages ?? []).reduce((nested, workPackage) => nested + (workPackage.tasks?.length ?? 0), 0)
  ), 0)
}

async function generate() {
  const checkpointPath = path.resolve(option('checkpoint'))
  const sourcePath = path.resolve(option('source-manifest'))
  const outputPath = path.resolve(option('candidate-checkpoint'))
  const runId = option('run-id')
  if (![option('checkpoint'), option('source-manifest'), option('candidate-checkpoint'), runId].every(Boolean)) throw new Error('R9_GENERATE_OPTIONS_REQUIRED')
  await refuseOverwrite(outputPath)
  const [checkpointRaw, sourceRaw] = await Promise.all([readFile(checkpointPath, 'utf8'), readFile(sourcePath, 'utf8')])
  const { checkpoint, source } = assertFrozenInputs(checkpointRaw, sourceRaw)
  const forbidden = [...scanForbiddenEvaluationKeys(checkpoint), ...scanForbiddenEvaluationKeys(source)]
  if (forbidden.length) throw new Error(`R9_GENERATION_EXPECTED_FIREWALL:${forbidden.join(',')}`)
  const sourceById = new Map(source.screeningCases.map((item) => [item.caseId, item]))
  const observations = checkpoint.observations.map((observation) => {
    const input = sourceById.get(observation.caseId)
    if (!input || observation.status !== 'complete') throw new Error('R9_GENERATION_OBSERVATION_INVALID')
    const sourceSha256 = sha256(input.content)
    if (sourceSha256 !== observation.response.payload.execution.sourceSha256) throw new Error('R9_GENERATION_SOURCE_HASH_DRIFT')
    const rawOutput = observation.response.payload.rawOutput
    if (sha256(rawOutput) !== observation.response.payload.execution.rawOutputSha256) throw new Error('R9_GENERATION_RAW_HASH_DRIFT')
    const raw = JSON.parse(rawOutput)
    const graph = normalizeR8FactGraphReferences(buildR8FactGraphFromCachedRaw({
      raw, sourceText: input.content, referenceTime: input.referenceTime, timezone: input.timezone,
    }))
    const result = planR9RecognitionResult(graph, {
      modelName: observation.response.payload.result.modelName,
      createdAt: observation.response.payload.result.createdAt,
    })
    return {
      observationId: observation.observationId, caseId: observation.caseId,
      sourceSha256, rawOutputSha256: sha256(rawOutput), factGraphSha256: sha256(canonicalJson(graph)),
      resultSha256: sha256(canonicalJson(result)), result,
    }
  })
  const candidateCheckpoint = {
    schemaVersion: 'e2.9-r9-candidate-checkpoint-1.0.0', replayVersion: R9_REPLAY_VERSION, runId,
    generatedAt: new Date().toISOString(), generationStage: 'FROZEN_BEFORE_SCORING',
    modelCalls: 0, modelCallScope: 'no new production recognition or generation calls',
    networkRequests: 0, expectedAnswersRead: false, scorerLoaded: false,
    evaluationKeyFirewallPassed: true,
    inputs: { checkpointSha256: sha256(checkpointRaw), sourceManifestSha256: sha256(sourceRaw) },
    versions: { planner: R9_ISOLATED_PLANNER_VERSION, plannerContract: R9_PLAN_CONTRACT_VERSION },
    observationCount: observations.length, observations,
  }
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(candidateCheckpoint, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({
    status: 'R9_CANDIDATE_CHECKPOINT_FROZEN', runId, candidateCheckpoint: outputPath,
    candidateCheckpointSha256: sha256(canonicalJson(candidateCheckpoint)), observations: observations.length,
    modelCalls: 0, networkRequests: 0, expectedAnswersRead: false, scorerLoaded: false,
  }, null, 2))
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
    taskPrecision: aggregate.taskPrecision, taskRecall: aggregate.taskRecall,
    milestonePrecision: aggregate.milestonePrecision, milestoneRecall: aggregate.milestoneRecall,
    materialPrecision: aggregate.materialPrecision, materialRecall: aggregate.materialRecall,
    timePointTypeAccuracy: aggregate.timePointTypeAccuracy, timePointValueAccuracy: aggregate.timePointValueAccuracy,
    eventAccuracy: aggregate.eventAccuracy, ambiguityPrecision: aggregate.ambiguityPrecision, ambiguityRecall: aggregate.ambiguityRecall,
    evidenceCoverage: aggregate.evidenceCoverage, evidenceValidity: aggregate.evidenceValidity,
    overFragmentationRate: aggregate.overFragmentationRate,
    majorCorrectionRate: aggregate.majorCorrectionRate, severeErrorRate: aggregate.severeErrorRate,
    planningErrorRate: ratio(scores.filter(planningError).length, scores.length),
  }
}

function delta(after, before) {
  return Object.fromEntries(Object.keys(after).flatMap((key) => (
    typeof after[key] === 'number' && typeof before[key] === 'number' ? [[key, after[key] - before[key]]] : []
  )))
}

async function score() {
  const checkpointPath = path.resolve(option('checkpoint'))
  const sourcePath = path.resolve(option('source-manifest'))
  const candidatePath = path.resolve(option('candidate-checkpoint'))
  const privateOutput = path.resolve(option('private-output'))
  const publicOutput = path.resolve(option('public-output'))
  if (![option('checkpoint'), option('source-manifest'), option('candidate-checkpoint'), option('private-output'), option('public-output')].every(Boolean)) {
    throw new Error('R9_SCORE_OPTIONS_REQUIRED')
  }
  await Promise.all([refuseOverwrite(privateOutput), refuseOverwrite(publicOutput)])
  const [checkpointRaw, sourceRaw, candidateRaw] = await Promise.all([
    readFile(checkpointPath, 'utf8'), readFile(sourcePath, 'utf8'), readFile(candidatePath, 'utf8'),
  ])
  const { checkpoint, source } = assertFrozenInputs(checkpointRaw, sourceRaw)
  const candidate = JSON.parse(candidateRaw)
  if (candidate.generationStage !== 'FROZEN_BEFORE_SCORING' || candidate.modelCalls !== 0 || candidate.networkRequests !== 0
    || candidate.expectedAnswersRead !== false || candidate.scorerLoaded !== false || candidate.observations?.length !== 16
    || candidate.inputs.checkpointSha256 !== sha256(checkpointRaw) || candidate.inputs.sourceManifestSha256 !== sha256(sourceRaw)) {
    throw new Error('R9_CANDIDATE_CHECKPOINT_INVALID')
  }
  const baselineById = new Map(checkpoint.observations.map((item) => [item.observationId, item]))
  if (new Set(candidate.observations.map((item) => item.observationId)).size !== 16) throw new Error('R9_CANDIDATE_OBSERVATION_DUPLICATE')
  for (const observation of candidate.observations) {
    const baseline = baselineById.get(observation.observationId)
    if (!baseline || baseline.caseId !== observation.caseId || sha256(canonicalJson(observation.result)) !== observation.resultSha256) {
      throw new Error('R9_CANDIDATE_BINDING_INVALID')
    }
  }

  const sourceById = new Map(source.screeningCases.map((item) => [item.caseId, item]))
  const vite = await createServer({ root: process.cwd(), appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })
  try {
    const [schemaModule, goldenModule, holdoutModule, developmentModule, scoringModule] = await Promise.all([
      vite.ssrLoadModule('/src/recognition/schema.ts'), vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'), vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/scoring.ts'),
    ])
    const fixtures = new Map([
      ...goldenModule.recognitionGoldenDataset, ...holdoutModule.recognitionHoldoutDataset,
      ...developmentModule.recognitionGeneralizationDevelopmentDataset,
    ].map((item) => [item.id, item]))
    const details = []
    for (const frozen of candidate.observations) {
      const baselineObservation = baselineById.get(frozen.observationId)
      const input = sourceById.get(frozen.caseId)
      const fixture = fixtures.get(frozen.caseId)
      if (!input || !fixture) throw new Error('R9_SCORE_CASE_MISSING')
      const raw = JSON.parse(baselineObservation.response.payload.rawOutput)
      const graph = normalizeR8FactGraphReferences(buildR8FactGraphFromCachedRaw({
        raw, sourceText: input.content, referenceTime: input.referenceTime, timezone: input.timezone,
      }))
      if (sha256(canonicalJson(graph)) !== frozen.factGraphSha256) throw new Error('R9_SCORE_FACT_GRAPH_DRIFT')
      const result = schemaModule.parseRecognitionResult(frozen.result)
      const before = scoringModule.scoreRecognitionCase(fixture, 'deepseek-production', baselineObservation.response.payload.result, 0, { tokenUsage: null, costUsd: null })
      const after = scoringModule.scoreRecognitionCase(fixture, 'deepseek-production', result, 0, { tokenUsage: null, costUsd: null })
      details.push({
        observationId: frozen.observationId, caseId: frozen.caseId,
        baselineResultSha256: sha256(canonicalJson(baselineObservation.response.payload.result)), candidateResultSha256: frozen.resultSha256,
        before, after,
        beforeContract: evaluateR9ContractCoverage(baselineObservation.response.payload.result, graph),
        afterContract: evaluateR9ContractCoverage(result, graph),
        counts: { beforeTasks: flattenTaskCount(baselineObservation.response.payload.result), afterTasks: flattenTaskCount(result) },
      })
    }
    const beforeScores = details.map((item) => item.before)
    const afterScores = details.map((item) => item.after)
    const before = compactMetrics(scoringModule.aggregateRecognitionMetrics('deepseek-production', beforeScores), beforeScores)
    const after = compactMetrics(scoringModule.aggregateRecognitionMetrics('deepseek-production', afterScores), afterScores)
    const contractBefore = aggregateR9ContractCoverage(details.map((item) => item.beforeContract))
    const contractAfter = aggregateR9ContractCoverage(details.map((item) => item.afterContract))
    const checks = {
      zeroProductionModelCalls: candidate.modelCalls === 0,
      candidateFrozenBeforeScoring: candidate.scorerLoaded === false && candidate.generationStage === 'FROZEN_BEFORE_SCORING',
      sixteenFrozenObservations: details.length === 16,
      factLossZero: contractAfter.counts.factLosses === 0,
      unsupportedTaskZero: contractAfter.counts.unsupportedTasks === 0,
      evidenceCoverageNotWorse: after.evidenceCoverage >= before.evidenceCoverage,
      severeErrorNotWorse: after.severeErrorRate <= before.severeErrorRate,
    }
    const generatedAt = new Date().toISOString()
    const privateResult = {
      schemaVersion: 'e2.9-r9-cache-replay-private-1.0.0', replayVersion: R9_REPLAY_VERSION,
      generatedAt, modelCalls: 0, expectedAnswersReadDuringGeneration: false, expectedAnswersReadDuringScoring: true,
      inputs: {
        checkpointSha256: sha256(checkpointRaw), sourceManifestSha256: sha256(sourceRaw),
        candidateCheckpointSha256: sha256(canonicalJson(candidate)),
      },
      strict: { before, after, delta: delta(after, before) },
      contract: { before: contractBefore, after: contractAfter, delta: delta(contractAfter.rates, contractBefore.rates) },
      checks, details,
    }
    const publicResult = {
      schemaVersion: 'e2.9-r9-cache-replay-public-1.0.0', replayVersion: R9_REPLAY_VERSION,
      generatedAt, observationCount: details.length, uniqueSourceCases: 8,
      modelCalls: 0, modelCallScope: 'no new production recognition or generation calls',
      generation: { expectedAnswersRead: false, scorerLoaded: false, candidateFrozenBeforeScoring: true },
      scoring: { expectedAnswersRead: true, scorerSemanticsChanged: false },
      inputs: privateResult.inputs, strict: privateResult.strict, contract: privateResult.contract, checks,
      userImpactMetrics: 'PENDING_FRESH_PATH_MASKED_REVIEW',
      screening: 'NOT_REQUESTED', selection: 'NOT_RUN', blind: 'NOT_CREATED', production: 'NOT_DEPLOYED',
    }
    await Promise.all([mkdir(path.dirname(privateOutput), { recursive: true }), mkdir(path.dirname(publicOutput), { recursive: true })])
    await Promise.all([
      writeFile(privateOutput, `${JSON.stringify(privateResult, null, 2)}\n`, 'utf8'),
      writeFile(publicOutput, `${JSON.stringify(publicResult, null, 2)}\n`, 'utf8'),
    ])
    console.log(JSON.stringify({ status: 'R9_REPLAY_SCORED', checks, strict: publicResult.strict, contract: publicResult.contract, publicOutput }, null, 2))
    if (!Object.values(checks).every(Boolean)) process.exitCode = 2
  } finally {
    await vite.close()
  }
}

async function main() {
  const stage = option('stage')
  if (stage === 'generate') return generate()
  if (stage === 'score') return score()
  throw new Error('R9_STAGE_MUST_BE_GENERATE_OR_SCORE')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
