/* global console, process */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import {
  E2_R10_SCREENING_MODEL,
  E2_R10_SCREENING_PROTOCOL_VERSION,
  E2_R10_SCREENING_RUN_LABEL,
  canonicalJson,
} from '../cloudflare/e2-r10-screening-contract.mjs'

export const E2_R10_SCREENING_SCORER_VERSION = 'e2-r10-screening-strict-scorer-1.1.0'
const ROOT = process.cwd()
const PROTOCOL_DIR = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r10', 'screening-protocol-1.1.0')
const DEFAULT_CACHE = path.join(ROOT, '.evaluation-cache', 'e2-9-r10', 'screening-protocol-1.1.0', E2_R10_SCREENING_RUN_LABEL)
const PUBLIC_MANIFEST_PATH = path.join(PROTOCOL_DIR, 'case-manifest.json')
const BUNDLE_PATH = path.join(PROTOCOL_DIR, 'protocol-bundle.json')
const READINESS_REVIEW_PATH = path.join(PROTOCOL_DIR, 'independent-readiness-review.json')

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalText(value) {
  return Buffer.from(value).toString('utf8').replace(/\r\n?/gu, '\n')
}

async function assertProtocolBundleFiles(bundle) {
  if (!Array.isArray(bundle.files) || !bundle.files.length) throw new Error('SCORER_PROTOCOL_FILE_SET_INVALID')
  for (const item of bundle.files) {
    if (typeof item?.path !== 'string' || !/^[a-f0-9]{64}$/u.test(item.canonicalTextSha256 ?? '')) {
      throw new Error('SCORER_PROTOCOL_FILE_BINDING_INVALID')
    }
    const actual = sha256(canonicalText(await readFile(path.join(ROOT, item.path))))
    if (actual !== item.canonicalTextSha256) throw new Error(`SCORER_PROTOCOL_FILE_DRIFT:${item.path}`)
  }
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

function compactMetrics(arm, results, observations, aggregate) {
  const armObservations = observations.filter((item) => item.arm === arm)
  const executions = armObservations.map((item) => item.response.payload.execution)
  const latencies = executions.map((item) => item.durationMs).filter(Number.isFinite)
  const usage = executions.map((item) => item.tokenUsage).filter(Boolean)
  const totalTokens = usage.reduce((total, item) => total + item.total, 0)
  return {
    arm,
    sampleCount: results.length,
    completedCount: results.filter((item) => item.status === 'ok').length,
    strict: {
      factRecall: 'PENDING_PATH_MASKED_FACT_REVIEW',
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
      promptInjectionPass: !results.some((item) => item.failures.some((failure) => failure.category === 'forbidden_output')),
    },
    latencyMs: {
      mean: ratio(latencies.reduce((total, value) => total + value, 0), latencies.length, 0),
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
    },
    tokens: usage.length === results.length ? {
      input: usage.reduce((total, item) => total + item.input, 0),
      output: usage.reduce((total, item) => total + item.output, 0),
      total: totalTokens,
      meanTotal: ratio(totalTokens, usage.length, 0),
    } : 'NOT_OBSERVABLE',
    userImpactMajorCorrection: 'PENDING_PATH_MASKED_REVIEW',
    factLoss: 'PENDING_PATH_MASKED_REVIEW',
  }
}

export function assertR10ScoringInput({
  checkpoint, checkpointRaw, manifest, manifestRaw, bundle, bundleRaw,
  deployment, deploymentRaw, contractEvidenceRaw, registration, registrationRaw,
  ledgerState, ledgerStateRaw, readinessReview, readinessReviewRaw,
}) {
  if (checkpoint.schemaVersion !== 'e2.9-r10-screening-generation-checkpoint-1.1.0'
    || checkpoint.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION
    || checkpoint.runLabel !== E2_R10_SCREENING_RUN_LABEL
    || checkpoint.status !== 'GENERATION_COMPLETE'
    || checkpoint.expectedObservations !== 16 || checkpoint.attemptedModelCalls !== 16
    || checkpoint.expectedAnswerReads !== 0 || checkpoint.observations?.length !== 16
    || checkpoint.observations.some((item) => item.status !== 'complete')) throw new Error('COMPLETE_FROZEN_GENERATION_REQUIRED_BEFORE_EXPECTED_READ')
  if (checkpoint.caseManifestSha256 !== sha256(canonicalText(manifestRaw))
    || checkpoint.protocolBundleSha256 !== sha256(canonicalText(bundleRaw))
    || manifest.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION
    || manifest.runLabel !== E2_R10_SCREENING_RUN_LABEL) throw new Error('SCORER_MANIFEST_PROTOCOL_BINDING_FAILED')
  if (bundle.schemaVersion !== 'e2.9-r10-screening-protocol-bundle-1.1.0'
    || bundle.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION || bundle.runLabel !== E2_R10_SCREENING_RUN_LABEL
    || bundle.status !== 'FROZEN_BEFORE_MODEL_CALLS'
    || bundle.bindings.caseManifestCanonicalTextSha256 !== sha256(canonicalText(manifestRaw))) throw new Error('SCORER_PROTOCOL_BUNDLE_INVALID')
  if (checkpoint.deploymentEvidenceSha256 !== sha256(deploymentRaw)
    || checkpoint.contractEvidenceSha256 !== sha256(contractEvidenceRaw)
    || checkpoint.registrationSha256 !== sha256(registrationRaw)
    || checkpoint.ledgerStateSha256 !== sha256(ledgerStateRaw)
    || deployment.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION
    || deployment.runLabel !== E2_R10_SCREENING_RUN_LABEL
    || deployment.status !== 'PREVIEW_DEPLOYED_MODEL_VERSION_ZERO_TRAFFIC'
    || deployment.protocolBundleSha256 !== checkpoint.protocolBundleSha256
    || deployment.caseManifestSha256 !== checkpoint.caseManifestSha256
    || deployment.screeningWorkerVersionId !== checkpoint.deploymentVersion
    || deployment.versionedOrigin !== checkpoint.endpoint
    || deployment.sourceCommit !== checkpoint.sourceCommit || deployment.sourceTree !== checkpoint.sourceTree
    || deployment.branch !== checkpoint.branch
    || deployment.readinessReviewSha256 !== sha256(readinessReviewRaw)
    || readinessReview.status !== 'PASS' || readinessReview.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION
    || readinessReview.runLabel !== E2_R10_SCREENING_RUN_LABEL
    || readinessReview.protocolBundleSha256 !== checkpoint.protocolBundleSha256
    || deployment.screeningVersionStableTrafficPercent !== 0 || deployment.stableTrafficTotalPercent !== 100
    || deployment.productionDeployed !== false) throw new Error('SCORER_DEPLOYMENT_BINDING_FAILED')
  if (registration.request?.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION
    || registration.request?.runLabel !== E2_R10_SCREENING_RUN_LABEL
    || registration.request?.protocolBundleSha256 !== checkpoint.protocolBundleSha256
    || registration.request?.caseManifestSha256 !== checkpoint.caseManifestSha256
    || registration.response?.status !== 201
    || ledgerState.status !== 200 || ledgerState.payload?.runStatus !== 'GENERATION_COMPLETE'
    || canonicalJson(ledgerState.payload.registration) !== canonicalJson(registration.request)) throw new Error('SCORER_LEDGER_REGISTRATION_BINDING_FAILED')
  const expected = new Map(manifest.observations.map((item) => [item.observationId, item]))
  const cases = new Map(manifest.cases.map((item) => [item.caseId, item]))
  if (expected.size !== 16 || new Set(checkpoint.observations.map((item) => item.observationId)).size !== 16) throw new Error('SCORER_OBSERVATION_SET_INVALID')
  for (const observation of checkpoint.observations) {
    const frozen = expected.get(observation.observationId)
    const frozenCase = cases.get(observation.caseId)
    const payload = observation.response?.payload
    const execution = payload?.execution
    const ledgerRecord = ledgerState.payload?.observations?.[observation.observationId]
    if (!frozen || !frozenCase || observation.observationIndex !== frozen.observationIndex || observation.caseId !== frozen.caseId || observation.arm !== frozen.arm
      || payload?.observationId !== observation.observationId || payload?.caseId !== observation.caseId || payload?.arm !== observation.arm
      || payload?.modelCalls !== 1 || payload?.protocolStatus !== 'complete' || !payload?.result || !execution
      || ![execution.requestedModel, execution.returnedModel, execution.executionModel, execution.resultModelName, payload.result.modelName].every((value) => value === E2_R10_SCREENING_MODEL)
      || execution.attempts?.length !== 1 || execution.sourceSha256 !== observation.requestBinding.sourceSha256
      || execution.inputSha256 !== observation.requestBinding.inputSha256
      || observation.requestBinding.sourceSha256 !== frozenCase.sourceSha256
      || observation.requestBinding.inputSha256 !== frozenCase.inputSha256
      || execution.rawOutputSha256 !== sha256(payload.rawOutput)
      || execution.resultSha256 !== sha256(canonicalJson(payload.result))
      || !ledgerRecord || ledgerRecord.state !== 'final' || ledgerRecord.status !== 'complete'
      || ledgerRecord.observationIndex !== observation.observationIndex || ledgerRecord.caseId !== observation.caseId
      || ledgerRecord.arm !== observation.arm || ledgerRecord.sourceSha256 !== frozenCase.sourceSha256
      || ledgerRecord.inputSha256 !== frozenCase.inputSha256 || ledgerRecord.rawOutputSha256 !== execution.rawOutputSha256
      || ledgerRecord.resultSha256 !== execution.resultSha256 || ledgerRecord.workerVersionId !== checkpoint.deploymentVersion) {
      throw new Error(`SCORER_OBSERVATION_BINDING_FAILED:${observation.observationId}`)
    }
    if (observation.arm === 'A' && (payload.ledger !== null || payload.planningTrace !== null)) throw new Error(`PATH_A_CONTAMINATED:${observation.observationId}`)
    if (observation.arm === 'B' && (!payload.ledger || !payload.planningTrace || payload.validation?.status !== 'NO_ISSUE')) throw new Error(`PATH_B_INTEGRITY_FAILED:${observation.observationId}`)
  }
  return {
    checkpointSha256: sha256(checkpointRaw),
    caseManifestSha256: sha256(canonicalText(manifestRaw)),
    protocolBundleSha256: sha256(canonicalText(bundleRaw)),
    deploymentEvidenceSha256: sha256(deploymentRaw),
    contractEvidenceSha256: sha256(contractEvidenceRaw),
    registrationSha256: sha256(registrationRaw),
    ledgerStateSha256: sha256(ledgerStateRaw),
    readinessReviewSha256: sha256(readinessReviewRaw),
  }
}

async function writeCreateOnce(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  try {
    await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'EEXIST') throw new Error(`REFUSING_TO_OVERWRITE:${file}`)
    throw error
  }
}

export async function loadAndAssertR10ScoringEvidence() {
  const checkpointPath = path.join(DEFAULT_CACHE, 'generation-checkpoint.json')
  const [checkpointRaw, manifestRaw, bundleRaw, deploymentRaw, contractEvidenceRaw,
    registrationRaw, ledgerStateRaw, readinessReviewRaw] = await Promise.all([
    readFile(checkpointPath, 'utf8'), readFile(PUBLIC_MANIFEST_PATH, 'utf8'), readFile(BUNDLE_PATH, 'utf8'),
    readFile(path.join(DEFAULT_CACHE, 'deployment-evidence.json'), 'utf8'),
    readFile(path.join(DEFAULT_CACHE, 'contract-evidence.json'), 'utf8'),
    readFile(path.join(DEFAULT_CACHE, 'registration.json'), 'utf8'),
    readFile(path.join(DEFAULT_CACHE, 'ledger-state.json'), 'utf8'),
    readFile(READINESS_REVIEW_PATH, 'utf8'),
  ])
  const checkpoint = JSON.parse(checkpointRaw)
  const manifest = JSON.parse(manifestRaw)
  const bundle = JSON.parse(bundleRaw)
  const deployment = JSON.parse(deploymentRaw)
  const registration = JSON.parse(registrationRaw)
  const ledgerState = JSON.parse(ledgerStateRaw)
  const readinessReview = JSON.parse(readinessReviewRaw)
  await assertProtocolBundleFiles(bundle)
  const bindings = assertR10ScoringInput({
    checkpoint, checkpointRaw, manifest, manifestRaw, bundle, bundleRaw,
    deployment, deploymentRaw, contractEvidenceRaw, registration, registrationRaw,
    ledgerState, ledgerStateRaw, readinessReview, readinessReviewRaw,
  })
  return {
    checkpoint, checkpointRaw, manifest, manifestRaw, bundle, bundleRaw,
    deployment, deploymentRaw, contractEvidenceRaw, registration, registrationRaw,
    ledgerState, ledgerStateRaw, readinessReview, readinessReviewRaw, bindings,
  }
}

async function main() {
  const outputPath = path.join(DEFAULT_CACHE, 'strict-scores.json')
  const aggregatePath = path.join(DEFAULT_CACHE, 'anonymous-aggregate.json')
  const {
    checkpoint, bindings,
  } = await loadAndAssertR10ScoringEvidence()

  // This is the first point at which Expected-bearing dataset modules are loaded.
  const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })
  try {
    const [goldenModule, holdoutModule, developmentModule, scoringModule] = await Promise.all([
      vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/scoring.ts'),
    ])
    const fixtures = new Map([
      ...goldenModule.recognitionGoldenDataset,
      ...holdoutModule.recognitionHoldoutDataset,
      ...developmentModule.recognitionGeneralizationDevelopmentDataset,
    ].map((fixture) => [fixture.id, fixture]))
    const rawScores = []
    const arms = {}
    for (const arm of ['A', 'B']) {
      const armObservations = checkpoint.observations.filter((item) => item.arm === arm)
      const results = armObservations.map((observation) => {
        const fixture = fixtures.get(observation.caseId)
        if (!fixture) throw new Error(`EXPECTED_MISSING_AFTER_GENERATION:${observation.caseId}`)
        const execution = observation.response.payload.execution
        const score = scoringModule.scoreRecognitionCase(
          fixture,
          'deepseek-production',
          observation.response.payload.result,
          execution.durationMs,
          { tokenUsage: execution.tokenUsage, costUsd: null },
        )
        rawScores.push({ observationId: observation.observationId, arm, score })
        return score
      })
      arms[arm] = compactMetrics(arm, results, armObservations, scoringModule.aggregateRecognitionMetrics('deepseek-production', results))
    }
    const result = {
      schemaVersion: 'e2.9-r10-screening-strict-scores-1.1.0',
      protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
      scorerVersion: E2_R10_SCREENING_SCORER_VERSION,
      runLabel: E2_R10_SCREENING_RUN_LABEL,
      expectedReadBoundary: 'Expected-bearing fixtures loaded only after assertR10ScoringInput proved all 16 paired observations complete and immutable.',
      bindings,
      scoredAfterGenerationAt: new Date().toISOString(),
      rawScores,
      arms,
    }
    const strictScoresSha256 = sha256(`${JSON.stringify(result, null, 2)}\n`)
    const aggregate = {
      schemaVersion: 'e2.9-r10-screening-anonymous-aggregate-1.1.0',
      protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
      scorerVersion: E2_R10_SCREENING_SCORER_VERSION,
      runLabel: E2_R10_SCREENING_RUN_LABEL,
      bindings: { ...bindings, strictScoresSha256 },
      expectedReadBoundary: result.expectedReadBoundary,
      arms,
      gateStatus: 'PENDING_PATH_MASKED_USER_IMPACT_AND_FACT_REVIEW',
      selectionAuthorized: false,
      blindAuthorized: false,
      productionAuthorized: false,
    }
    await writeCreateOnce(outputPath, result)
    await writeCreateOnce(aggregatePath, aggregate)
    console.log(JSON.stringify({ status: 'STRICT_SCORING_COMPLETE', bindings, outputPath, outputSha256: sha256(await readFile(outputPath)), aggregatePath, aggregateSha256: sha256(await readFile(aggregatePath)) }, null, 2))
  } finally {
    await vite.close()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
