/* global console */
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'
import { canonicalJson, hashBundle, sha256 } from './e2-9-r3-hash.mjs'

const ROOT = process.cwd()
const DOCS = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r3')
const CACHE = path.join(ROOT, '.evaluation-cache', 'e2-9-r3', 'protocol-3.1.0')
const PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.1.0'
const RUN_ID = 'e29r3-run-20260813-a'
const RUN_LABEL = 'e29r3-20260813-a'
const SEED = 'e2-9-r3-interleave-20260813-a'
const MODELS = ['flash', 'pro']

const SMOKE = Object.freeze([
  { caseId: 'e2-complex_notice-01', semanticRole: 'action_required', dimensions: ['multi_task', 'multi_material', 'multi_stage'] },
  { caseId: 'e2-holdout-22', semanticRole: 'action_required', dimensions: ['multi_task', 'multi_timepoint', 'event_task'] },
  { caseId: 'e2-gen-10-3', semanticRole: 'action_required', dimensions: ['relative_time', 'vague_time', 'ambiguity', 'conditional'] },
  { caseId: 'e2-gen-14-2', semanticRole: 'information_only', dimensions: ['pure_information', 'information_only', 'no_action'] },
  { caseId: 'e2-gen-16-2', semanticRole: 'prompt_injection', dimensions: ['prompt_injection', 'security', 'multi_paragraph'] },
])

const SCREENING = Object.freeze([
  { caseId: 'e2-gen-22-1', semanticRole: 'action_required', dimensions: ['complex_multi_stage', 'multi_task', 'multi_timepoint', 'multi_material', 'event_task', 'ambiguity'] },
  { caseId: 'e2-holdout-25', semanticRole: 'action_required', dimensions: ['multi_stage', 'multi_task', 'multi_timepoint', 'multi_material', 'event_task', 'ambiguity'] },
  { caseId: 'e2-gen-10-3', semanticRole: 'action_required', dimensions: ['ambiguity', 'vague_time', 'relative_time', 'conditional'] },
  { caseId: 'e2-gen-14-2', semanticRole: 'information_only', dimensions: ['pure_information', 'information_only', 'no_action'] },
  { caseId: 'e2-gen-16-2', semanticRole: 'prompt_injection', dimensions: ['prompt_injection', 'security'] },
  { caseId: 'e2-complex_notice-03', semanticRole: 'action_required', dimensions: ['complex_multi_stage', 'multi_task', 'multi_timepoint', 'multi_material'] },
  { caseId: 'e2-gen-08-2', semanticRole: 'action_required', dimensions: ['multi_stage', 'multi_task', 'multi_timepoint', 'multi_material', 'table'] },
  { caseId: 'e2-gen-07-1', semanticRole: 'action_required', dimensions: ['event_task', 'multi_timepoint', 'ambiguity', 'conditional'] },
])

async function missing(file) {
  try { await readFile(file); return false } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return true
    throw error
  }
}

function sourceRecord(fixture, sourceSet, semanticRole) {
  const content = fixture.rawText.trim()
  const input = { sourceType: fixture.sourceType, sourceTitle: fixture.sourceTitle, content, referenceTime: fixture.referenceTime, timezone: fixture.timezone }
  return { caseId: fixture.id, sourceSet, semanticRole, ...input, sourceSha256: sha256(content), inputSha256: sha256(canonicalJson(input)) }
}

function interleaved(specs, phase, records, phaseManifestSha256) {
  return [...specs].sort((a, b) => sha256(`${SEED}:${phase}:${a.caseId}`).localeCompare(sha256(`${SEED}:${phase}:${b.caseId}`))).flatMap((spec) => {
    const proFirst = Number.parseInt(sha256(`${SEED}:${phase}:arm:${spec.caseId}`).slice(0, 2), 16) % 2 === 1
    return (proFirst ? ['pro', 'flash'] : ['flash', 'pro']).map((modelAlias) => {
      const record = records.get(spec.caseId)
      const caseAlias = `${phase}:${spec.caseId}`
      return {
        // caseAlias is phase-scoped because Smoke intentionally overlaps Screening.
        observationId: `e29r3-${sha256(`${RUN_ID}:${caseAlias}:${modelAlias}`).slice(0, 32)}`,
        phase, caseAlias, caseId: spec.caseId, modelAlias, semanticRole: spec.semanticRole,
        sourceSha256: record.sourceSha256, inputSha256: record.inputSha256,
        phaseManifestSha256, maxAttempts: 2,
      }
    })
  })
}

async function main() {
  const outputs = ['source-only-manifest.json', 'readiness-manifest.json', 'smoke-manifest.json', 'screening-manifest.json', 'bundle-hash-manifest.json', 'run-manifest.json']
  for (const name of outputs) {
    const file = name === 'source-only-manifest.json' ? path.join(CACHE, name) : path.join(DOCS, name)
    if (!(await missing(file))) throw new Error(`Refusing to overwrite frozen R3 artifact: ${path.relative(ROOT, file)}`)
  }
  const implementationCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
  const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })
  try {
    const [golden, holdout, development] = await Promise.all([
      vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'), vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'), vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
    ])
    const fixtures = new Map([
      ...golden.recognitionGoldenDataset.map((item) => [item.id, { fixture: item, sourceSet: 'golden' }]),
      ...holdout.recognitionHoldoutDataset.map((item) => [item.id, { fixture: item, sourceSet: 'exposed_holdout' }]),
      ...development.recognitionGeneralizationDevelopmentDataset.map((item) => [item.id, { fixture: item, sourceSet: 'development' }]),
    ])
    const roleByCase = new Map([...SMOKE, ...SCREENING].map((item) => [item.caseId, item.semanticRole]))
    const records = new Map([...roleByCase].map(([caseId, role]) => {
      const found = fixtures.get(caseId)
      if (!found) throw new Error(`Unknown case ${caseId}`)
      return [caseId, sourceRecord(found.fixture, found.sourceSet, role)]
    }))
    const sourceOnly = {
      schemaVersion: 'e2.9-r3-source-only-3.1.0', protocolVersion: PROTOCOL_VERSION,
      generationBoundary: 'No expected answers, scores, labels, prior outputs, or R2 observations are present.',
      smokeCases: SMOKE.map((item) => records.get(item.caseId)), screeningCases: SCREENING.map((item) => records.get(item.caseId)),
    }
    const sourceOnlySha256 = sha256(canonicalJson(sourceOnly))
    const readinessManifest = {
      schemaVersion: 'e2.9-r3-readiness-manifest-3.1.0', protocolVersion: PROTOCOL_VERSION,
      frozenBeforeCalls: true, models: ['deepseek-v4-flash', 'deepseek-v4-pro'], probesPerModel: 3, probeCount: 6,
      retryPolicy: 'NO_RETRY_IN_READINESS',
    }
    const phaseManifest = (phase, specs) => ({
      schemaVersion: `e2.9-r3-${phase}-manifest-3.1.0`, protocolVersion: PROTOCOL_VERSION, frozenBeforeCalls: true,
      sourceOnlySha256, pairedModels: ['deepseek-v4-flash', 'deepseek-v4-pro'], router: 'BYPASSED',
      retryPolicy: { eligibleError: 'UPSTREAM_JSON_TRUNCATED', maxAttemptsPerObservation: 2, firstFailureRetained: true, bestOfN: false },
      cases: specs.map((item) => ({ caseId: item.caseId, sourceSet: records.get(item.caseId).sourceSet, semanticRole: item.semanticRole, dimensions: item.dimensions, sourceSha256: records.get(item.caseId).sourceSha256, inputSha256: records.get(item.caseId).inputSha256 })),
    })
    const smokeManifest = phaseManifest('smoke', SMOKE)
    const screeningManifest = phaseManifest('screening', SCREENING)
    const readinessManifestSha256 = sha256(canonicalJson(readinessManifest))
    const smokeManifestSha256 = sha256(canonicalJson(smokeManifest))
    const screeningManifestSha256 = sha256(canonicalJson(screeningManifest))
    const bundles = {
      schema: await hashBundle(ROOT, ['src/recognition/types.ts', 'src/recognition/schema.ts']),
      promptAndPipeline: await hashBundle(ROOT, ['cloudflare/recognition.mjs', 'cloudflare/recognition-prompt.mjs', 'cloudflare/recognition-quality.mjs', 'cloudflare/model-gateway.mjs']),
      scorerSemantics: await hashBundle(ROOT, ['src/recognition/e2/scoring.ts', 'src/recognition/e2/semanticEquivalence.ts', 'docs/e2-path-a-planning/evaluation-contract.json']),
      datasets: await hashBundle(ROOT, ['src/recognition/e2/goldenDataset.ts', 'src/recognition/e2/holdoutDataset.ts', 'src/recognition/e2/generalizationDataset.ts']),
      protocolAndDeployment: await hashBundle(ROOT, [
        'cloudflare/worker.mjs', 'cloudflare/e2-v4-pro-benchmark.mjs', 'cloudflare/e2-r2-benchmark.mjs',
        'cloudflare/e2-r3-benchmark.mjs', 'cloudflare/e2-r3-transport-policy.mjs', 'cloudflare/e2-r3-ledger-worker.mjs', 'cloudflare/e2-r3-tests.mjs',
        'wrangler.jsonc', 'wrangler.e2-r3-preview.jsonc', 'wrangler.e2-r3-ledger.jsonc', 'package.json', 'package-lock.json', 'scripts/scan-secrets.mjs',
        'scripts/e2-9-r3-hash.mjs', 'scripts/e2-9-r3-integrity.mjs', 'scripts/e2-9-r3-protocol.node.mjs',
        'scripts/prepare-e2-9-r3-manifests.mjs', 'scripts/run-e2-9-r3.mjs', 'scripts/score-e2-9-r3.mjs',
        'scripts/prepare-e2-9-r3-adjudication.mjs', 'scripts/reveal-e2-9-r3-adjudication.mjs', 'scripts/evaluate-e2-9-r3-gate.mjs',
      ]),
    }
    const bundleManifest = {
      schemaVersion: 'e2.9-r3-bundle-manifest-3.1.0', protocolVersion: PROTOCOL_VERSION,
      pathRule: 'Repository-relative forward-slash paths sorted lexicographically.',
      textRule: 'CRLF and CR canonicalized to LF; JSON parsed and recursively key-sorted.',
      framingRule: 'UTF-8 byte length framed path and content joined by the frozen R3 separator.',
      algorithm: 'SHA-256',
      coverage: 'Worker route/security, frozen provider adapter, R3 transport policy, benchmark wrapper, immutable ledger, Preview flags/binding, deployment configs, runner, scorer, tests, package lock and secret scanner.',
      bundles,
    }
    const bundleManifestSha256 = sha256(canonicalJson(bundleManifest))
    const readinessObservations = MODELS.flatMap((modelAlias) => [1, 2, 3].map((probeIndex) => {
      const inputSha256 = sha256(canonicalJson({ kind: 'readiness', modelAlias, probeIndex, protocolVersion: PROTOCOL_VERSION }))
      return {
        observationId: `e29r3-${sha256(`${RUN_ID}:readiness:${modelAlias}:${probeIndex}`).slice(0, 32)}`,
        phase: 'readiness', caseAlias: `readiness:${probeIndex}`, caseId: null, probeIndex, modelAlias, semanticRole: null,
        sourceSha256: null, inputSha256, phaseManifestSha256: readinessManifestSha256, maxAttempts: 1,
      }
    }))
    const observations = [...readinessObservations, ...interleaved(SMOKE, 'smoke', records, smokeManifestSha256), ...interleaved(SCREENING, 'screening', records, screeningManifestSha256)]
    if (new Set(observations.map((item) => item.observationId)).size !== 32) throw new Error('OBSERVATION_ID_COLLISION')
    const bindings = {
      sourceOnlySha256, readinessManifestSha256, smokeManifestSha256, screeningManifestSha256,
      bundleManifestSha256, protocolBundleSha256: bundles.protocolAndDeployment.sha256,
      promptAndPipelineSha256: bundles.promptAndPipeline.sha256, schemaBundleSha256: bundles.schema.sha256,
      scorerSemanticsSha256: bundles.scorerSemantics.sha256, datasetBundleSha256: bundles.datasets.sha256,
    }
    const runManifestCore = {
      schemaVersion: 'e2.9-r3-run-manifest-3.1.0', protocolVersion: PROTOCOL_VERSION, runId: RUN_ID, runLabel: RUN_LABEL,
      createdAt: new Date().toISOString(), implementationCommit,
      labels: { readiness: 'e29r3-readiness-20260813-a', smoke: 'e29r3-smoke-20260813-a', screening: 'e29r3-screening-20260813-a', scoring: 'e29r3-scoring-20260813-a', adjudication: 'e29r3-adjudication-20260813-a' },
      r2EvidencePolicy: 'HISTORICAL_FAILURE_EVIDENCE_ONLY_NEVER_REUSED',
      frozen: {
        models: ['deepseek-v4-flash', 'deepseek-v4-pro'], promptVersion: 'recognition-2.4.1', promptSha256: 'c925f1dc27971e4fcaf7ad185b729f016fa7af966cd7992337d9eaa94c97e6fd',
        schemaVersion: '2.0', pipelineVersion: 'recognition-pipeline-2.2.1', validatorVersion: 'recognition-quality-2.1.0', normalizerVersion: 'e2-9-r3-role-aware-normalizer-3.1.0',
        temperature: 0, thinking: 'disabled', maxTokens: 6000, responseFormat: 'json_object', stream: false, router: 'BYPASSED', repair: 'DISABLED',
      },
      retryPolicy: {
        version: 'e2-9-r3-transport-policy-3.1.0', eligibleError: 'UPSTREAM_JSON_TRUNCATED', maxProtocolRetries: 1, maxAttemptsPerFormalObservation: 2,
        readinessMaxAttempts: 1, firstFailureRetained: true, finalAttemptOnlyScored: true, newObservationOnRetry: false, bestOfN: false,
        truncationEvidence: ['provider_http_200', 'application_json', 'expected_model_in_envelope', 'json_structure_ends_mid_document'],
        forbiddenRetry: ['MODEL_JSON_INVALID', '401', '403', 'MODEL_FALLBACK_DETECTED', 'MODEL_LINEAGE_MISMATCH', 'INVALID_OUTPUT', 'SEMANTIC_FAILURE', 'SCORING_FAILURE'],
      },
      pairComparison: { method: 'FRESH_SOURCE_AND_OUTPUT_PATH_MASKED_REVIEW', labels: ['X', 'Y', 'TIE', 'INSUFFICIENT_INFORMATION'], revealAfterLabelsFrozen: true },
      qualityGate: { taskRecallNotBelowFlash: true, taskPrecisionMaxDropPp: 5, evidenceCoverageMinimum: 0.9, severeErrorNotAboveFlash: true, promptInjectionPass: true, proImprovedMinimumPairs: 2, proWorsenedMaximumPairs: 1, modelFallbackMaximum: 0 },
      bindings, observationPlan: observations,
      stageMachine: ['READINESS_OPEN', 'SMOKE_OPEN', 'SCREENING_OPEN', 'SCORING_OPEN'],
      stopRule: 'STOP after Screening report. Selection, Candidate Freeze and Blind are not authorized.',
    }
    const runManifest = { ...runManifestCore, runManifestSha256: sha256(canonicalJson(runManifestCore)) }
    await mkdir(DOCS, { recursive: true })
    await mkdir(CACHE, { recursive: true })
    await writeFile(path.join(CACHE, 'source-only-manifest.json'), `${JSON.stringify(sourceOnly, null, 2)}\n`, 'utf8')
    for (const [name, value] of Object.entries({ 'readiness-manifest.json': readinessManifest, 'smoke-manifest.json': smokeManifest, 'screening-manifest.json': screeningManifest, 'bundle-hash-manifest.json': bundleManifest, 'run-manifest.json': runManifest })) await writeFile(path.join(DOCS, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify({ protocolVersion: PROTOCOL_VERSION, runId: RUN_ID, runLabel: RUN_LABEL, implementationCommit, runManifestSha256: runManifest.runManifestSha256, readinessCalls: 6, smokeCalls: 10, screeningCalls: 16, protocolBundleSha256: bundles.protocolAndDeployment.sha256 }, null, 2))
  } finally { await vite.close() }
}

await main()
