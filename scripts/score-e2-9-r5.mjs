/* global console */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'
import { canonicalJson, hashBundle, sha256 } from './e2-9-r5-hash.mjs'
import { assertArtifactRunBindings, assertFourWayModelLineage, assertR5ActivationBinding, assertR5StagePrerequisite, assertRunManifestBinding, assertScoringInputHashes, assertScoringRunComplete, scorableFinalPayload, summarizeProtocolRetries } from './e2-9-r5-integrity.mjs'
import { assignmentCommitment, deriveSideAssignment, verifyRevealChronology } from './e2-9-r5-path-mask.mjs'
import { resolveR5RunContext } from './e2-9-r5-run-context.mjs'

const ROOT = process.cwd()
const CONTEXT = resolveR5RunContext({ root: ROOT })
const { docs: DOCS, cache: CACHE, protocolVersion: PROTOCOL_VERSION } = CONTEXT
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
  const hashes = {}
  for (const [name, frozen] of Object.entries(bundleManifest.bundles)) {
    const current = await hashBundle(ROOT, frozen.inputFiles)
    hashes[name] = current.sha256
  }
  return hashes
}

async function main() {
  const revealSecret = process.env.E2_R5_PATH_MASK_REVEAL_SECRET ?? ''
  if (revealSecret.length < 64) throw new Error('PATH_MASK_REVEAL_SECRET_INVALID')
  const [runRaw, sourceRaw, phaseRaw, bundleRaw, activationRaw, checkpointRaw, ledgerRaw, packetRaw, packetManifestRaw, labelsRaw, keyRaw, revealRaw] = await Promise.all([
    readFile(path.join(DOCS, 'run-manifest.json'), 'utf8'), readFile(path.join(CACHE, 'source-only-manifest.json'), 'utf8'),
    readFile(path.join(DOCS, 'screening-manifest.json'), 'utf8'), readFile(path.join(DOCS, 'bundle-hash-manifest.json'), 'utf8'),
    readFile(path.join(DOCS, 'preview-activation.json'), 'utf8'),
    readFile(path.join(CACHE, 'checkpoints', `${CONTEXT.labels.screening}.json`), 'utf8'),
    readFile(path.join(CACHE, 'ledger-screening.json'), 'utf8'),
    readFile(path.join(CACHE, 'adjudication', 'adjudication-packet.json'), 'utf8'),
    readFile(path.join(DOCS, 'adjudication-packet-manifest.json'), 'utf8'),
    readFile(path.join(DOCS, 'path-masked-labels.json'), 'utf8'),
    readFile(path.join(CACHE, 'private', 'mapping-key.json'), 'utf8'),
    readFile(path.join(DOCS, 'path-masked-result.json'), 'utf8'),
  ])
  const run = JSON.parse(runRaw)
  const source = JSON.parse(sourceRaw)
  const phaseManifest = JSON.parse(phaseRaw)
  const bundle = JSON.parse(bundleRaw)
  const activation = JSON.parse(activationRaw)
  const checkpoint = JSON.parse(checkpointRaw)
  const ledger = JSON.parse(ledgerRaw)
  const packet = JSON.parse(packetRaw)
  const packetManifest = JSON.parse(packetManifestRaw)
  const labels = JSON.parse(labelsRaw)
  const key = JSON.parse(keyRaw)
  const reveal = JSON.parse(revealRaw)
  if ([run, source, phaseManifest, bundle, activation, checkpoint, ledger].some((item) => item.protocolVersion !== PROTOCOL_VERSION)) throw new Error('PROTOCOL_VERSION_DRIFT')
  assertRunManifestBinding(run)
  assertArtifactRunBindings(run.runManifestSha256, [
    checkpoint.runManifestSha256, ledger.runManifestSha256, packetManifest.runManifestSha256,
    labels.runManifestSha256, key.runManifestSha256, reveal.runManifestSha256,
  ])
  assertScoringRunComplete({ checkpoint, ledger, expectedObservations: 16 })
  const bindings = {
    sourceOnlySha256: sha256(canonicalJson(source)), screeningManifestSha256: sha256(canonicalJson(phaseManifest)),
    bundleManifestSha256: sha256(canonicalJson(bundle)), runManifestSha256: run.runManifestSha256,
    activationSha256: sha256(activationRaw), checkpointSha256: sha256(checkpointRaw), ledgerSha256: sha256(ledgerRaw),
  }
  if (run.bindings.sourceOnlySha256 !== bindings.sourceOnlySha256 || run.bindings.screeningManifestSha256 !== bindings.screeningManifestSha256 || run.bindings.bundleManifestSha256 !== bindings.bundleManifestSha256) throw new Error('MANIFEST_BINDING_MISMATCH')
  if (checkpoint.runManifestSha256 !== run.runManifestSha256 || checkpoint.bindings.sourceOnlySha256 !== bindings.sourceOnlySha256 || checkpoint.bindings.screeningManifestSha256 !== bindings.screeningManifestSha256 || checkpoint.activationSha256 !== bindings.activationSha256 || checkpoint.ledgerStateSha256 !== bindings.ledgerSha256) throw new Error('CHECKPOINT_BINDING_MISMATCH')
  if (ledger.runManifestSha256 !== run.runManifestSha256) throw new Error('LEDGER_NOT_SCORABLE')
  assertR5ActivationBinding(activation, run, bundle.bundles.protocolAndDeployment.sha256)
  const currentBundleHashes = await verifyBundleManifest(bundle)
  assertScoringInputHashes(run.bindings, {
    promptAndPipelineSha256: currentBundleHashes.promptAndPipeline,
    schemaBundleSha256: currentBundleHashes.schema,
    scorerSemanticsSha256: currentBundleHashes.scorerSemantics,
    protocolBundleSha256: currentBundleHashes.protocolAndDeployment,
    datasetBundleSha256: currentBundleHashes.datasets,
  })
  if (packetManifest.runManifestSha256 !== run.runManifestSha256 || packetManifest.checkpointSha256 !== bindings.checkpointSha256
    || packetManifest.packetSha256 !== sha256(packetRaw) || labels.runManifestSha256 !== run.runManifestSha256
    || labels.checkpointSha256 !== bindings.checkpointSha256 || labels.packetSha256 !== packetManifest.packetSha256 || labels.labelsSha256 !== sha256(JSON.stringify(labels.labels))
    || key.runManifestSha256 !== run.runManifestSha256 || key.checkpointSha256 !== bindings.checkpointSha256 || key.labelsSha256 !== labels.labelsSha256
    || reveal.packetSha256 !== packetManifest.packetSha256 || reveal.labelsSha256 !== labels.labelsSha256
    || reveal.checkpointSha256 !== bindings.checkpointSha256) throw new Error('ADJUDICATION_BINDING_MISMATCH')
  verifyRevealChronology(labels.labelsCompletedAt, key.keyRevealedAt)
  if (!Number.isFinite(Date.parse(packetManifest.adjudicationOpenedAt)) || Date.parse(labels.labelsCompletedAt) <= Date.parse(packetManifest.adjudicationOpenedAt)
    || key.keyRevealedAt !== reveal.keyRevealedAt || key.labelsCompletedAt !== labels.labelsCompletedAt
    || key.mappings?.length !== 8 || packet.pairs?.length !== 8) throw new Error('REVEAL_KEY_BINDING_MISMATCH')
  const recomputedCounts = {
    proPreferred: 0, flashPreferred: 0, tie: 0, insufficient: 0,
    proMajor: 0, flashMajor: 0, proPlanningError: 0, flashPlanningError: 0,
  }
  for (const label of labels.labels) {
    const mapping = key.mappings.find((item) => item.anonymousCaseId === label.caseAnonymousId)
    const pair = packet.pairs.find((item) => item.caseAnonymousId === label.caseAnonymousId)
    if (!mapping || !pair) throw new Error('REVEAL_MAPPING_MISSING')
    const assignment = deriveSideAssignment({ revealSecret, runId: run.runId, caseId: mapping.caseId })
    const commitment = assignmentCommitment({ revealSecret, runId: run.runId, anonymousCaseId: mapping.anonymousCaseId, caseId: mapping.caseId, assignment })
    if (mapping.X !== assignment.X || mapping.Y !== assignment.Y || mapping.assignmentCommitmentHash !== commitment || pair.assignmentCommitmentHash !== commitment) throw new Error('REVEAL_ASSIGNMENT_MISMATCH')
    if (label.preferredSide === 'TIE') recomputedCounts.tie += 1
    else if (label.preferredSide === 'INSUFFICIENT_INFORMATION') recomputedCounts.insufficient += 1
    else if (mapping[label.preferredSide] === 'pro') recomputedCounts.proPreferred += 1
    else if (mapping[label.preferredSide] === 'flash') recomputedCounts.flashPreferred += 1
    else throw new Error('REVEAL_PREFERENCE_INVALID')
    if (label.xMajor) recomputedCounts[`${mapping.X}Major`] += 1
    if (label.yMajor) recomputedCounts[`${mapping.Y}Major`] += 1
    if (label.xPlanningError) recomputedCounts[`${mapping.X}PlanningError`] += 1
    if (label.yPlanningError) recomputedCounts[`${mapping.Y}PlanningError`] += 1
  }
  if (canonicalJson(recomputedCounts) !== canonicalJson(reveal.counts)) throw new Error('REVEAL_COUNT_MISMATCH')
  assertR5StagePrerequisite('scoring', { labelsFrozen: Boolean(labels.labelsCompletedAt), chronologyValid: reveal.chronologyValid === true, commitmentVerified: reveal.commitmentVerified === true })
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
      schemaVersion: 'e2.9-r5-anonymous-screening-aggregate-3.3.0', protocolVersion: PROTOCOL_VERSION, phase: 'screening',
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
