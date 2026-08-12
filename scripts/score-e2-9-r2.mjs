/* global console */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'
import { canonicalJson, hashBundle, sha256 } from './e2-9-r2-hash.mjs'
import { assertFourWayModelLineage } from './e2-9-r2-integrity.mjs'

const ROOT = process.cwd()
const DOCS = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r2')
const CACHE = path.join(ROOT, '.evaluation-cache', 'e2-9-r2', 'protocol-3.0.0')
const PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.0.0'
const MODELS = Object.freeze({ flash: 'deepseek-v4-flash', pro: 'deepseek-v4-pro' })

function ratio(numerator, denominator, empty = 1) { return denominator ? numerator / denominator : empty }
function percentile(values, q) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)]
}
function planningError(score) { return score.failures.some((failure) => /^(?:project_decision|milestone_|task_|material_|time_|event_|ambiguity_)/u.test(failure.category)) }

function compact(alias, scores, observations, aggregate) {
  const aliasObservations = observations.filter((item) => item.modelAlias === alias)
  const latencies = aliasObservations.map((item) => item.response.payload.execution.durationMs).filter(Number.isFinite)
  const usage = aliasObservations.map((item) => item.response.payload.execution.tokenUsage)
  const tokenTotal = usage.reduce((total, item) => total + item.total, 0)
  return {
    modelAlias: alias,
    modelName: MODELS[alias],
    sampleCount: scores.length,
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
    latencyMs: { mean: ratio(latencies.reduce((a, b) => a + b, 0), latencies.length, 0), p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) },
    tokens: { input: usage.reduce((total, item) => total + item.input, 0), output: usage.reduce((total, item) => total + item.output, 0), total: tokenTotal, meanTotal: ratio(tokenTotal, usage.length, 0) },
    semantic: 'PENDING_FRESH_PATH_MASKED_LABELS', userImpact: 'PENDING_FRESH_PATH_MASKED_LABELS',
  }
}

async function verifyBundleManifest(bundleManifest) {
  for (const [name, frozen] of Object.entries(bundleManifest.bundles)) {
    const current = await hashBundle(ROOT, frozen.inputFiles)
    if (current.sha256 !== frozen.sha256) throw new Error(`BUNDLE_DRIFT_${name}`)
  }
}

async function main() {
  const [runRaw, sourceRaw, phaseRaw, bundleRaw, activationRaw] = await Promise.all([
    readFile(path.join(DOCS, 'run-manifest.json'), 'utf8'), readFile(path.join(CACHE, 'source-only-manifest.json'), 'utf8'),
    readFile(path.join(DOCS, 'screening-manifest.json'), 'utf8'), readFile(path.join(DOCS, 'bundle-hash-manifest.json'), 'utf8'),
    readFile(path.join(DOCS, 'preview-activation.json'), 'utf8'),
  ])
  const run = JSON.parse(runRaw)
  const source = JSON.parse(sourceRaw)
  const phaseManifest = JSON.parse(phaseRaw)
  const bundle = JSON.parse(bundleRaw)
  const activation = JSON.parse(activationRaw)
  const checkpointPath = path.join(CACHE, 'checkpoints', `${run.labels.screening}.json`)
  const checkpointRaw = await readFile(checkpointPath, 'utf8')
  const checkpoint = JSON.parse(checkpointRaw)
  if ([run, source, phaseManifest, bundle, activation, checkpoint].some((item) => item.protocolVersion !== PROTOCOL_VERSION)) throw new Error('PROTOCOL_VERSION_DRIFT')
  const bindings = {
    sourceOnlySha256: sha256(canonicalJson(source)), screeningManifestSha256: sha256(canonicalJson(phaseManifest)),
    bundleManifestSha256: sha256(canonicalJson(bundle)), runManifestSha256: sha256(runRaw), activationSha256: sha256(activationRaw),
  }
  if (run.bindings.sourceOnlySha256 !== bindings.sourceOnlySha256 || run.bindings.screeningManifestSha256 !== bindings.screeningManifestSha256 || run.bindings.bundleManifestSha256 !== bindings.bundleManifestSha256) throw new Error('MANIFEST_BINDING_MISMATCH')
  if (checkpoint.bindings.sourceOnlySha256 !== bindings.sourceOnlySha256 || checkpoint.bindings.screeningManifestSha256 !== bindings.screeningManifestSha256 || checkpoint.activationSha256 !== bindings.activationSha256) throw new Error('CHECKPOINT_BINDING_MISMATCH')
  if (activation.protocolBundleSha256 !== bundle.bundles.protocolAndDeployment.sha256) throw new Error('DEPLOYMENT_BINDING_MISMATCH')
  await verifyBundleManifest(bundle)
  const planned = run.registration.observations.filter((item) => item.phase === 'screening')
  if (checkpoint.gateStatus !== 'GENERATION_COMPLETE' || checkpoint.observations.length !== planned.length || checkpoint.expectedObservations !== planned.length || checkpoint.observations.some((item) => item.status !== 'complete')) throw new Error('INCOMPLETE_CHECKPOINT_NOT_SCORABLE')
  for (const [index, item] of checkpoint.observations.entries()) {
    const expected = planned[index]
    if (item.observationId !== expected.observationId || item.inputSha256 !== expected.inputSha256 || item.phaseManifestSha256 !== expected.phaseManifestSha256 || item.semanticRole !== expected.semanticRole) throw new Error('OBSERVATION_PLAN_MISMATCH')
    const payload = item.response.payload
    const model = MODELS[item.modelAlias]
    assertFourWayModelLineage(payload, model)
    if (payload.execution.promptVersion !== run.frozen.promptVersion || payload.execution.promptSha256 !== run.frozen.promptSha256 || payload.execution.schemaVersion !== run.frozen.schemaVersion || payload.execution.pipelineVersion !== run.frozen.pipelineVersion) throw new Error('PROMPT_SCHEMA_PIPELINE_BINDING_MISMATCH')
    if (payload.execution.rawOutputSha256 !== sha256(payload.rawOutput) || payload.execution.resultSha256 !== sha256(JSON.stringify(payload.result)) || item.response.rawBodySha256 !== sha256(item.response.rawBody)) throw new Error('OBSERVATION_HASH_MISMATCH')
  }

  // Expected fixtures are deliberately loaded only after the complete paired checkpoint and every binding above pass.
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
        const execution = item.response.payload.execution
        const score = scoring.scoreRecognitionCase(fixture, 'deepseek-production', item.response.payload.result, execution.durationMs, { tokenUsage: { input: execution.tokenUsage.input, output: execution.tokenUsage.output }, costUsd: null })
        rawScores.push({ modelAlias: alias, score })
        return score
      })
      arms[alias] = compact(alias, scores, checkpoint.observations, scoring.aggregateRecognitionMetrics('deepseek-production', scores))
    }
    const result = {
      schemaVersion: 'e2.9-r2-anonymous-screening-aggregate-3.0.0', protocolVersion: PROTOCOL_VERSION, phase: 'screening',
      runLabel: run.runLabel, scoredAfterGenerationAt: new Date().toISOString(), expectedReadBoundary: 'Expected fixtures loaded only after all paired outputs and integrity bindings passed.',
      bindings: { ...bindings, checkpointSha256: sha256(checkpointRaw), protocolBundleSha256: bundle.bundles.protocolAndDeployment.sha256 },
      arms, qualityConclusion: 'PENDING_FRESH_PATH_MASKED_LABELS', selectionStatus: 'NOT_RUN', blindStatus: 'NOT_CREATED',
    }
    await mkdir(path.join(CACHE, 'scoring'), { recursive: true })
    await writeFile(path.join(CACHE, 'scoring', 'screening-raw-scores.json'), `${JSON.stringify({ protocolVersion: PROTOCOL_VERSION, checkpointSha256: sha256(checkpointRaw), rawScores }, null, 2)}\n`, 'utf8')
    await writeFile(path.join(DOCS, 'screening-aggregate.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify({ status: 'SCORED', pairs: planned.length / 2, aggregate: path.relative(ROOT, path.join(DOCS, 'screening-aggregate.json')), aggregateSha256: sha256(await readFile(path.join(DOCS, 'screening-aggregate.json'), 'utf8')) }, null, 2))
  } finally { await vite.close() }
}

await main()
