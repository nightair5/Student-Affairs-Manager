/* global console */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'
import { canonicalJson, hashBundle, sha256 } from './e2-9-r2-hash.mjs'

const ROOT = process.cwd()
const DOCS = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r2')
const CACHE = path.join(ROOT, '.evaluation-cache', 'e2-9-r2', 'protocol-3.0.0')
const PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.0.0'
const RUN_LABEL = 'e29r2-20260813-a'
const SEED = 'e2-9-r2-interleave-20260813-a'
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
      return {
        observationId: `e29r2-${sha256(`${RUN_LABEL}:${phase}:${spec.caseId}:${modelAlias}:${record.inputSha256}`).slice(0, 32)}`,
        phase, caseId: spec.caseId, modelAlias, semanticRole: spec.semanticRole,
        sourceSha256: record.sourceSha256, inputSha256: record.inputSha256, phaseManifestSha256,
      }
    })
  })
}

async function main() {
  const outputs = ['source-only-manifest.json', 'readiness-manifest.json', 'smoke-manifest.json', 'screening-manifest.json', 'bundle-hash-manifest.json', 'run-manifest.json']
  for (const name of outputs) {
    const file = name === 'source-only-manifest.json' ? path.join(CACHE, name) : path.join(DOCS, name)
    if (!(await missing(file))) throw new Error(`Refusing to overwrite frozen R2 artifact: ${path.relative(ROOT, file)}`)
  }
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
      schemaVersion: 'e2.9-r2-source-only-3.0.0', protocolVersion: PROTOCOL_VERSION,
      generationBoundary: 'No expected answers, scores, prior outputs, or R1 observations are present.',
      smokeCases: SMOKE.map((item) => records.get(item.caseId)), screeningCases: SCREENING.map((item) => records.get(item.caseId)),
    }
    const sourceOnlySha256 = sha256(canonicalJson(sourceOnly))
    const readinessManifest = { schemaVersion: 'e2.9-r2-readiness-manifest-3.0.0', protocolVersion: PROTOCOL_VERSION, frozenBeforeCalls: true, models: ['deepseek-v4-flash', 'deepseek-v4-pro'], probeCount: 2 }
    const manifest = (phase, specs) => ({
      schemaVersion: `e2.9-r2-${phase}-manifest-3.0.0`, protocolVersion: PROTOCOL_VERSION, frozenBeforeCalls: true,
      sourceOnlySha256, pairedModels: ['deepseek-v4-flash', 'deepseek-v4-pro'], router: 'BYPASSED',
      cases: specs.map((item) => ({ caseId: item.caseId, sourceSet: records.get(item.caseId).sourceSet, semanticRole: item.semanticRole, dimensions: item.dimensions, sourceSha256: records.get(item.caseId).sourceSha256, inputSha256: records.get(item.caseId).inputSha256 })),
    })
    const smokeManifest = manifest('smoke', SMOKE)
    const screeningManifest = manifest('screening', SCREENING)
    const readinessManifestSha256 = sha256(canonicalJson(readinessManifest))
    const smokeManifestSha256 = sha256(canonicalJson(smokeManifest))
    const screeningManifestSha256 = sha256(canonicalJson(screeningManifest))
    const bundles = {
      schema: await hashBundle(ROOT, ['src/recognition/types.ts', 'src/recognition/schema.ts']),
      promptAndPipeline: await hashBundle(ROOT, ['cloudflare/recognition.mjs', 'cloudflare/recognition-prompt.mjs', 'cloudflare/recognition-quality.mjs', 'cloudflare/model-gateway.mjs']),
      scorerSemantics: await hashBundle(ROOT, ['src/recognition/e2/scoring.ts', 'src/recognition/e2/semanticEquivalence.ts', 'docs/e2-path-a-planning/evaluation-contract.json']),
      datasets: await hashBundle(ROOT, ['src/recognition/e2/goldenDataset.ts', 'src/recognition/e2/holdoutDataset.ts', 'src/recognition/e2/generalizationDataset.ts']),
      protocolAndDeployment: await hashBundle(ROOT, [
        'cloudflare/worker.mjs', 'cloudflare/e2-v4-pro-benchmark.mjs', 'cloudflare/e2-r2-benchmark.mjs', 'cloudflare/e2-r2-ledger-worker.mjs',
        'wrangler.jsonc', 'wrangler.e2-r2-ledger.jsonc', 'package.json', 'package-lock.json',
        'scripts/e2-9-r2-hash.mjs', 'scripts/e2-9-r2-integrity.mjs', 'scripts/e2-9-r2-protocol.node.mjs', 'scripts/prepare-e2-9-r2-manifests.mjs', 'scripts/run-e2-9-r2.mjs', 'scripts/score-e2-9-r2.mjs',
      ]),
    }
    const bundleManifest = { schemaVersion: 'e2.9-r2-bundle-manifest-3.0.0', protocolVersion: PROTOCOL_VERSION, coverage: 'Worker route, R2 wrapper, immutable ledger, preview flag/service binding, dedicated ledger deployment, package lock, runner and scorer plus frozen prompt/schema/scoring/datasets.', bundles }
    const bundleManifestSha256 = sha256(canonicalJson(bundleManifest))
    const readinessObservations = MODELS.map((modelAlias) => {
      const inputSha256 = sha256(canonicalJson({ kind: 'readiness', modelAlias, protocolVersion: PROTOCOL_VERSION }))
      return { observationId: `e29r2-${sha256(`${RUN_LABEL}:readiness:${modelAlias}:${inputSha256}`).slice(0, 32)}`, phase: 'readiness', caseId: null, modelAlias, semanticRole: null, sourceSha256: null, inputSha256, phaseManifestSha256: readinessManifestSha256 }
    })
    const observations = [...readinessObservations, ...interleaved(SMOKE, 'smoke', records, smokeManifestSha256), ...interleaved(SCREENING, 'screening', records, screeningManifestSha256)]
    const bindings = { sourceOnlySha256, readinessManifestSha256, smokeManifestSha256, screeningManifestSha256, bundleManifestSha256, protocolBundleSha256: bundles.protocolAndDeployment.sha256, promptAndPipelineSha256: bundles.promptAndPipeline.sha256, schemaBundleSha256: bundles.schema.sha256, scorerSemanticsSha256: bundles.scorerSemantics.sha256 }
    const runManifest = {
      schemaVersion: 'e2.9-r2-run-manifest-3.0.0', protocolVersion: PROTOCOL_VERSION, runLabel: RUN_LABEL,
      labels: { readiness: 'e29r2-readiness-20260813-a', smoke: 'e29r2-smoke-20260813-a', screening: 'e29r2-screening-20260813-a', scoring: 'e29r2-scoring-20260813-a', adjudication: 'e29r2-adjudication-20260813-a' },
      baselineCommit: 'd53e632e7cc5389bf3f08d7e76a7732168253b7b', r1EvidencePolicy: 'INVALID_FOR_MODEL_QUALITY_AND_NEVER_REUSED',
      frozen: { models: ['deepseek-v4-flash', 'deepseek-v4-pro'], promptVersion: 'recognition-2.4.1', promptSha256: 'c925f1dc27971e4fcaf7ad185b729f016fa7af966cd7992337d9eaa94c97e6fd', schemaVersion: '2.0', pipelineVersion: 'recognition-pipeline-2.2.1', validatorVersion: 'recognition-quality-2.1.0', normalizerVersion: 'e2-9-r2-role-aware-normalizer-3.0.0', temperature: 0, thinking: 'disabled', maxTokens: 6000, responseFormat: 'json_object', stream: false, router: 'BYPASSED', repair: 'DISABLED' },
      bindings,
      registration: { runLabel: RUN_LABEL, protocolVersion: PROTOCOL_VERSION, bindings, observations },
      stageMachine: ['READINESS_OPEN', 'SMOKE_OPEN', 'SCREENING_OPEN', 'SCORING_OPEN', 'SELECTION_OPEN', 'BLIND_OPEN'],
      stopRule: 'STOP after Screening report. Selection NOT RUN and Blind NOT CREATED.',
    }
    await mkdir(DOCS, { recursive: true })
    await mkdir(CACHE, { recursive: true })
    await writeFile(path.join(CACHE, 'source-only-manifest.json'), `${JSON.stringify(sourceOnly, null, 2)}\n`, 'utf8')
    for (const [name, value] of Object.entries({ 'readiness-manifest.json': readinessManifest, 'smoke-manifest.json': smokeManifest, 'screening-manifest.json': screeningManifest, 'bundle-hash-manifest.json': bundleManifest, 'run-manifest.json': runManifest })) await writeFile(path.join(DOCS, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify({ protocolVersion: PROTOCOL_VERSION, runLabel: RUN_LABEL, readinessCalls: 2, smokeCalls: 10, screeningCalls: 16, sourceOnlySha256, protocolBundleSha256: bundles.protocolAndDeployment.sha256, labels: runManifest.labels }, null, 2))
  } finally { await vite.close() }
}

await main()
