/* global console */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'
import { canonicalJson, hashBundle, sha256 } from './e2-9-r3-hash.mjs'
import { assertFourWayModelLineage, assertRunManifestBinding, scorableFinalPayload, summarizeProtocolRetries } from './e2-9-r3-integrity.mjs'

const ROOT = process.cwd()
const DOCS = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r3')
const CACHE = path.join(ROOT, '.evaluation-cache', 'e2-9-r3', 'protocol-3.1.0')
const PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.1.0'
const MODELS = Object.freeze({ flash: 'deepseek-v4-flash', pro: 'deepseek-v4-pro' })

function ratio(numerator, denominator, empty = 1) { return denominator ? numerator / denominator : empty }
function percentile(values, q) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)]
}
function planningError(score) { return score.failures.some((failure) => /^(?:project_decision|milestone_|task_|material_|time_|event_|ambiguity_)/u.test(failure.category)) }

function compact(alias, scores, observations, aggregate) {
  const selected = observations.filter((item) => item.modelAlias === alias)
  const finalLatencies = selected.map((item) => item.response.payload.execution.durationMs).filter(Number.isFinite)
  const usage = selected.map((item) => item.response.payload.execution.tokenUsage)
  const tokenTotal = usage.reduce((total, item) => total + item.total, 0)
  const transport = summarizeProtocolRetries(observations, alias)
  return {
    modelAlias: alias, modelName: MODELS[alias], sampleCount: scores.length,
    strict: {
      taskPrecision: aggregate.taskPrecision, taskRecall: aggregate.taskRecall,
      milestonePrecision: aggregate.milestonePrecision, milestoneRecall: aggregate.milestoneRecall,
      materialPrecision: aggregate.materialPrecision, materialRecall: aggregate.materialRecall,
      timePointTypeAccuracy: aggregate.timePointTypeAccuracy, timePointValueAccuracy: aggregate.timePointValueAccuracy,
      eventAccuracy: aggregate.eventAccuracy, ambiguityPrecision: aggregate.ambiguityPrecision, ambiguityRecall: aggregate.ambiguityRecall,
      evidenceCoverage: aggregate.evidenceCoverage, evidenceValidity: aggregate.evidenceValidity,
      strictMajorCorrectionRate: aggregate.majorCorrectionRate, severeErrorRate: aggregate.severeErrorRate,
      planningErrorRate: ratio(scores.filter(planningError).length, scores.length), invalidOutputRate: aggregate.invalidOutputRate,
      promptInjectionPass: !scores.some((item) => item.failures.some((failure) => failure.category === 'forbidden_output')),
    },
    finalAttemptLatencyMs: { mean: ratio(finalLatencies.reduce((a, b) => a + b, 0), finalLatencies.length, 0), p50: percentile(finalLatencies, 0.5), p95: percentile(finalLatencies, 0.95) },
    observedProtocolAttemptLatencyMs: transport.observedAttemptLatencyMs,
    tokens: { input: usage.reduce((total, item) => total + item.input, 0), output: usage.reduce((total, item) => total + item.output, 0), total: tokenTotal, meanTotal: ratio(tokenTotal, usage.length, 0), truncatedAttemptTokens: 'NOT_OBSERVABLE' },
    transport,
    semantic: 'PENDING_FRESH_PATH_MASKED_REVIEW',
  }
}

async function verifyBundleManifest(bundleManifest) {
  for (const [name, frozen] of Object.entries(bundleManifest.bundles)) {
    const current = await hashBundle(ROOT, frozen.inputFiles)
    if (current.sha256 !== frozen.sha256) throw new Error(`BUNDLE_DRIFT_${name}`)
  }
}

async function main() {
  const [runRaw, sourceRaw, phaseRaw, bundleRaw, activationRaw, checkpointRaw, ledgerRaw] = await Promise.all([
    readFile(path.join(DOCS, 'run-manifest.json'), 'utf8'), readFile(path.join(CACHE, 'source-only-manifest.json'), 'utf8'),
    readFile(path.join(DOCS, 'screening-manifest.json'), 'utf8'), readFile(path.join(DOCS, 'bundle-hash-manifest.json'), 'utf8'),
    readFile(path.join(DOCS, 'preview-activation.json'), 'utf8'),
    readFile(path.join(CACHE, 'checkpoints', 'e29r3-screening-20260813-a.json'), 'utf8'),
    readFile(path.join(CACHE, 'ledger-screening.json'), 'utf8'),
  ])
  const run = JSON.parse(runRaw)
  const source = JSON.parse(sourceRaw)
  const phaseManifest = JSON.parse(phaseRaw)
  const bundle = JSON.parse(bundleRaw)
  const activation = JSON.parse(activationRaw)
  const checkpoint = JSON.parse(checkpointRaw)
  const ledger = JSON.parse(ledgerRaw)
  if ([run, source, phaseManifest, bundle, activation, checkpoint, ledger].some((item) => item.protocolVersion !== PROTOCOL_VERSION)) throw new Error('PROTOCOL_VERSION_DRIFT')
  assertRunManifestBinding(run)
  const bindings = {
    sourceOnlySha256: sha256(canonicalJson(source)), screeningManifestSha256: sha256(canonicalJson(phaseManifest)),
    bundleManifestSha256: sha256(canonicalJson(bundle)), runManifestSha256: run.runManifestSha256,
    activationSha256: sha256(activationRaw), checkpointSha256: sha256(checkpointRaw), ledgerSha256: sha256(ledgerRaw),
  }
  if (run.bindings.sourceOnlySha256 !== bindings.sourceOnlySha256 || run.bindings.screeningManifestSha256 !== bindings.screeningManifestSha256 || run.bindings.bundleManifestSha256 !== bindings.bundleManifestSha256) throw new Error('MANIFEST_BINDING_MISMATCH')
  if (checkpoint.runManifestSha256 !== run.runManifestSha256 || checkpoint.bindings.sourceOnlySha256 !== bindings.sourceOnlySha256 || checkpoint.bindings.screeningManifestSha256 !== bindings.screeningManifestSha256 || checkpoint.activationSha256 !== bindings.activationSha256 || checkpoint.ledgerStateSha256 !== bindings.ledgerSha256) throw new Error('CHECKPOINT_BINDING_MISMATCH')
  if (ledger.runManifestSha256 !== run.runManifestSha256 || ledger.runStatus !== 'COMPLETE' || ledger.stage !== 'SCORING_OPEN') throw new Error('LEDGER_NOT_SCORABLE')
  if (activation.runManifestSha256 !== run.runManifestSha256 || activation.protocolBundleSha256 !== bundle.bundles.protocolAndDeployment.sha256) throw new Error('DEPLOYMENT_BINDING_MISMATCH')
  await verifyBundleManifest(bundle)
  const planned = run.observationPlan.filter((item) => item.phase === 'screening')
  if (checkpoint.gateStatus !== 'GENERATION_COMPLETE' || checkpoint.runStatus !== 'COMPLETE' || checkpoint.observations.length !== planned.length || checkpoint.expectedObservations !== planned.length) throw new Error('INCOMPLETE_CHECKPOINT_NOT_SCORABLE')
  for (const [index, item] of checkpoint.observations.entries()) {
    const expected = planned[index]
    if (item.observationId !== expected.observationId || item.inputSha256 !== expected.inputSha256 || item.phaseManifestSha256 !== expected.phaseManifestSha256 || item.semanticRole !== expected.semanticRole) throw new Error('OBSERVATION_PLAN_MISMATCH')
    const payload = scorableFinalPayload(item)
    const model = MODELS[item.modelAlias]
    assertFourWayModelLineage(payload, model)
    if (payload.execution.promptVersion !== run.frozen.promptVersion || payload.execution.promptSha256 !== run.frozen.promptSha256 || payload.execution.schemaVersion !== run.frozen.schemaVersion || payload.execution.pipelineVersion !== run.frozen.pipelineVersion) throw new Error('PROMPT_SCHEMA_PIPELINE_BINDING_MISMATCH')
    if (payload.execution.rawOutputSha256 !== sha256(payload.rawOutput) || payload.execution.resultSha256 !== sha256(JSON.stringify(payload.result)) || item.response.rawBodySha256 !== sha256(item.response.rawBody)) throw new Error('OBSERVATION_HASH_MISMATCH')
    const ledgerRecord = ledger.observations[item.observationId]
    if (!ledgerRecord || ledgerRecord.status !== item.status || ledgerRecord.attempts.length !== payload.protocolAttempts.length) throw new Error('LEDGER_OBSERVATION_MISMATCH')
    for (const [attemptIndex, attempt] of payload.protocolAttempts.entries()) {
      const ledgerAttempt = ledgerRecord.attempts[attemptIndex]
      if (attempt.status !== ledgerAttempt.status || attempt.responseSha256 !== ledgerAttempt.responseSha256 || attempt.resultSha256 !== ledgerAttempt.resultSha256) throw new Error('LEDGER_ATTEMPT_MISMATCH')
    }
  }

  // Expected fixtures are loaded only after the complete paired checkpoint, ledger and every frozen binding pass.
  const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })
  try {
    const [golden, holdout, development, scoring] = await Promise.all([
      vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'), vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'), vite.ssrLoadModule('/src/recognition/e2/scoring.ts'),
    ])
    const fixtures = new Map([...golden.recognitionGoldenDataset, ...holdout.recognitionHoldoutDataset, ...development.recognitionGeneralizationDevelopmentDataset].map((item) => [item.id, item]))
    const rawScores = []
    const arms = {}
    for (const alias of ['flash', 'pro']) {
      const observations = checkpoint.observations.filter((item) => item.modelAlias === alias)
      const scores = observations.map((item) => {
        const fixture = fixtures.get(item.caseId)
        if (!fixture) throw new Error(`EXPECTED_FIXTURE_MISSING_${item.caseId}`)
        const payload = scorableFinalPayload(item)
        const execution = payload.execution
        const score = scoring.scoreRecognitionCase(fixture, 'deepseek-production', payload.result, execution.durationMs, { tokenUsage: { input: execution.tokenUsage.input, output: execution.tokenUsage.output }, costUsd: null })
        rawScores.push({ modelAlias: alias, score })
        return score
      })
      arms[alias] = compact(alias, scores, checkpoint.observations, scoring.aggregateRecognitionMetrics('deepseek-production', scores))
    }
    const result = {
      schemaVersion: 'e2.9-r3-anonymous-screening-aggregate-3.1.0', protocolVersion: PROTOCOL_VERSION, phase: 'screening',
      runId: run.runId, runLabel: run.runLabel, runManifestSha256: run.runManifestSha256,
      scoredAfterGenerationAt: new Date().toISOString(), expectedReadBoundary: 'Expected fixtures loaded only after all paired outputs, ledger attempts and integrity bindings passed.',
      bindings: { ...bindings, protocolBundleSha256: bundle.bundles.protocolAndDeployment.sha256 },
      integrity: {
        checkedObservationCount: checkpoint.observations.length,
        modelFallbackCount: checkpoint.observations.filter((item) => {
          const payload = item.response?.payload
          const expectedModel = MODELS[item.modelAlias]
          return [payload?.execution?.requestedModel, payload?.execution?.returnedModel, payload?.execution?.executionModel, payload?.result?.modelName]
            .some((value) => value !== expectedModel)
        }).length,
      },
      arms, pairComparison: 'PENDING_FRESH_PATH_MASKED_REVIEW', qualityConclusion: 'PENDING_FRESH_PATH_MASKED_REVIEW',
      selectionStatus: 'NOT_RUN', candidateFreeze: 'NOT_CREATED', blindStatus: 'NOT_CREATED',
    }
    await mkdir(path.join(CACHE, 'scoring'), { recursive: true })
    await writeFile(path.join(CACHE, 'scoring', 'screening-raw-scores.json'), `${JSON.stringify({ protocolVersion: PROTOCOL_VERSION, runManifestSha256: run.runManifestSha256, checkpointSha256: bindings.checkpointSha256, rawScores }, null, 2)}\n`, 'utf8')
    await writeFile(path.join(DOCS, 'screening-aggregate.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify({ status: 'SCORED_STRICT', pairs: planned.length / 2, aggregate: path.relative(ROOT, path.join(DOCS, 'screening-aggregate.json')), aggregateSha256: sha256(await readFile(path.join(DOCS, 'screening-aggregate.json'), 'utf8')), semantic: 'PENDING_FRESH_PATH_MASKED_REVIEW' }, null, 2))
  } finally { await vite.close() }
}

await main()
