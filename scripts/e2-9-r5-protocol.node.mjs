import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { canonicalJson, canonicalizeFileContent, hashBundle, normalizeLf, sha256 } from './e2-9-r5-hash.mjs'
import {
  assertCanonicalBinding,
  assertArtifactRunBindings,
  assertFourWayModelLineage,
  assertProtocolFreezeClean,
  assertR5ActivationBinding,
  assertRunManifestBinding,
  assertScoringInputHashes,
  assertScoringRunComplete,
  deriveCheckpointGateStatus,
  deriveRunManifestSha256,
  scorableFinalPayload,
  summarizeProtocolRetries,
  assertR5StagePrerequisite,
  completeObservationStatus,
  R5_STAGE_MACHINE,
} from './e2-9-r5-integrity.mjs'
import { R5_POST_GENERATION_ENTRYPOINTS, verifyEntrypointImportContracts } from './e2-9-r5-entrypoint-preflight.mjs'
import { resolveR5RunContext } from './e2-9-r5-run-context.mjs'

test('R5 canonical JSON, text and bundle hashing are reproducible', async () => {
  assert.equal(canonicalJson({ z: 1, a: { y: 2, x: [3, 4] } }), canonicalJson({ a: { x: [3, 4], y: 2 }, z: 1 }))
  assert.equal(normalizeLf('a\r\nb\rc\n'), 'a\nb\nc\n')
  assert.equal(canonicalizeFileContent('x.md', 'a\r\nb'), canonicalizeFileContent('x.md', 'a\nb'))
  const root = await mkdtemp(path.join(os.tmpdir(), 'e2-9-r5-hash-'))
  await writeFile(path.join(root, 'a.json'), '{\r\n  "z": 1, "a": 2\r\n}\r\n', 'utf8')
  await writeFile(path.join(root, 'b.txt'), 'line1\r\nline2\r\n', 'utf8')
  const first = await hashBundle(root, ['b.txt', 'a.json'])
  const second = await hashBundle(root, ['a.json', 'b.txt'])
  assert.equal(first.sha256, second.sha256)
  assert.deepEqual(first.inputFiles, ['a.json', 'b.txt'])
})

test('R5 run manifest self-binding and artifact bindings fail closed', () => {
  const core = { protocolVersion: '3.3.0', bindings: { prompt: 'x' } }
  const manifest = { ...core, runManifestSha256: sha256(canonicalJson(core)) }
  assert.doesNotThrow(() => assertRunManifestBinding(manifest))
  assert.throws(() => assertRunManifestBinding({ ...manifest, bindings: { prompt: 'y' } }), /RUN_MANIFEST_HASH_MISMATCH/u)
  assert.equal(deriveRunManifestSha256(manifest), manifest.runManifestSha256)
  assert.doesNotThrow(() => assertCanonicalBinding({ a: 1 }, sha256('{"a":1}'), 'MANIFEST'))
})

test('R5 complete-after-retry is complete but failures cannot complete a checkpoint', () => {
  assert.equal(completeObservationStatus('complete'), true)
  assert.equal(completeObservationStatus('complete_after_protocol_retry'), true)
  assert.equal(completeObservationStatus('transport_integrity_failure'), false)
  assert.equal(deriveCheckpointGateStatus([{ status: 'complete' }, { status: 'complete_after_protocol_retry' }], 2), 'GENERATION_COMPLETE')
  assert.equal(deriveCheckpointGateStatus([{ status: 'complete' }, { status: 'transport_integrity_failure' }], 2), 'INTEGRITY_FAILURE')
})

test('H07 incomplete runs cannot enter scoring', () => {
  const complete = { gateStatus: 'GENERATION_COMPLETE', runStatus: 'COMPLETE', observations: Array.from({ length: 16 }, () => ({ status: 'complete' })) }
  const ledger = { runStatus: 'COMPLETE', stage: 'PATH_MASK_PREVIEW_OPEN' }
  assert.doesNotThrow(() => assertScoringRunComplete({ checkpoint: complete, ledger, expectedObservations: 16 }))
  assert.throws(() => assertScoringRunComplete({ checkpoint: { ...complete, runStatus: 'INTEGRITY_FAILED' }, ledger, expectedObservations: 16 }), /SCORING_NOT_ALLOWED/u)
  assert.throws(() => assertScoringRunComplete({ checkpoint: { ...complete, observations: complete.observations.slice(1) }, ledger, expectedObservations: 16 }), /SCORING_NOT_ALLOWED/u)
})

test('H08 and H09 prompt or schema drift blocks scoring', () => {
  const frozen = {
    promptAndPipelineSha256: 'a', schemaBundleSha256: 'b', scorerSemanticsSha256: 'c',
    protocolBundleSha256: 'd', datasetBundleSha256: 'e',
  }
  assert.doesNotThrow(() => assertScoringInputHashes(frozen, { ...frozen }))
  assert.throws(() => assertScoringInputHashes(frozen, { ...frozen, promptAndPipelineSha256: 'x' }), /SCORING_INPUT_DRIFT/u)
  assert.throws(() => assertScoringInputHashes(frozen, { ...frozen, schemaBundleSha256: 'x' }), /SCORING_INPUT_DRIFT/u)
})

test('H10 artifact run-manifest drift fails closed', () => {
  const runSha = 'a'.repeat(64)
  assert.doesNotThrow(() => assertArtifactRunBindings(runSha, [runSha, runSha]))
  assert.throws(() => assertArtifactRunBindings(runSha, [runSha, 'b'.repeat(64)]), /ARTIFACT_BINDING_MISMATCH/u)
})

test('R5 protocol freeze requires a clean worktree and records the complete stage machine', () => {
  assert.doesNotThrow(() => assertProtocolFreezeClean(''))
  assert.doesNotThrow(() => assertProtocolFreezeClean('\r\n'))
  assert.throws(() => assertProtocolFreezeClean('?? docs/untracked.json\n'), /PROTOCOL_FREEZE_REQUIRES_CLEAN_WORKTREE/u)
  assert.throws(() => assertProtocolFreezeClean(null), /PROTOCOL_FREEZE_STATUS_INVALID/u)
  assert.deepEqual(R5_STAGE_MACHINE, [
    'READINESS_OPEN',
    'SMOKE_OPEN',
    'SCREENING_OPEN',
    'PATH_MASK_PREVIEW_OPEN',
    'ADJUDICATION_OPEN',
    'SCORING_OPEN',
    'COMPLETE',
  ])
})

test('R5 fresh run namespace isolates public artifacts, cache, labels and observation seed', () => {
  const root = path.join('C:', 'repo')
  const prior = resolveR5RunContext({ root, argv: ['node', 'script', '--run=e29r5-20260813-a'] })
  const fresh = resolveR5RunContext({ root, argv: ['node', 'script', '--run=e29r5-20260813-b'] })
  assert.notEqual(fresh.runId, prior.runId)
  assert.notEqual(fresh.runLabel, prior.runLabel)
  assert.notEqual(fresh.seed, prior.seed)
  assert.notEqual(fresh.docs, prior.docs)
  assert.notEqual(fresh.cache, prior.cache)
  assert.ok(Object.values(fresh.labels).every((label) => label.endsWith('20260813-b')))
  assert.throws(() => resolveR5RunContext({ root, argv: ['node', 'script', '--run=unknown'] }), /Unsupported R5 run namespace/u)
})

test('R5 manifest preparation checks cleanliness before freezing commit or artifacts', async () => {
  const source = await readFile(path.join(process.cwd(), 'scripts', 'prepare-e2-9-r5-manifests.mjs'), 'utf8')
  const status = source.indexOf("execFileSync('git', ['status'")
  const clean = source.indexOf('assertProtocolFreezeClean(worktreeStatus)')
  const commit = source.indexOf("execFileSync('git', ['rev-parse', 'HEAD']")
  const write = source.indexOf("await writeFile(path.join(CACHE, 'source-only-manifest.json')")
  assert.ok(status > 0)
  assert.ok(status < clean)
  assert.ok(clean < commit)
  assert.ok(commit < write)
})

test('R5 frozen retry policy forbids missing or mismatched model identity', async () => {
  const source = await readFile(path.join(process.cwd(), 'scripts', 'prepare-e2-9-r5-manifests.mjs'), 'utf8')
  assert.match(source, /forbiddenRetry: \[[^\]]*'MODEL_FALLBACK_DETECTED'[^\]]*'MODEL_IDENTITY_UNVERIFIABLE'[^\]]*'MODEL_LINEAGE_MISMATCH'/u)
})

test('R5 deployment configs keep normal Preview disabled and isolate the activation binding', async () => {
  const normal = JSON.parse(await readFile(path.join(process.cwd(), 'wrangler.jsonc'), 'utf8'))
  const activation = JSON.parse(await readFile(path.join(process.cwd(), 'wrangler.e2-r5-preview.jsonc'), 'utf8'))
  assert.equal(normal.vars?.E2_R5_BENCHMARK_ENABLED, undefined)
  assert.equal(normal.env.preview.vars.E2_R5_BENCHMARK_ENABLED, 'false')
  assert.equal(activation.vars.E2_R2_BENCHMARK_ENABLED, 'false')
  assert.equal(activation.vars.E2_R3_BENCHMARK_ENABLED, 'false')
  assert.equal(activation.vars.E2_R4_BENCHMARK_ENABLED, 'false')
  assert.equal(activation.vars.E2_R5_BENCHMARK_ENABLED, 'true')
  assert.deepEqual(activation.services, [{ binding: 'E2_R5_LEDGER', service: 'student-affairs-e2-r5-ledger-preview' }])
})

test('R5 post-generation chain binds the screening checkpoint into adjudication and scoring', async () => {
  const files = await Promise.all([
    'prepare-e2-9-r5-packet-preview.mjs',
    'finalize-e2-9-r5-packet.mjs',
    'reveal-e2-9-r5-adjudication.mjs',
    'score-e2-9-r5.mjs',
  ].map((name) => readFile(path.join(process.cwd(), 'scripts', name), 'utf8')))
  assert.match(files[0], /checkpointSha256: sha256\(checkpointRaw\)/u)
  assert.match(files[1], /checkpointSha256: manifest\.checkpointSha256/u)
  assert.match(files[2], /packetManifest\.checkpointSha256 !== sha256\(checkpointRaw\)/u)
  assert.match(files[3], /packetManifest\.checkpointSha256 !== bindings\.checkpointSha256/u)
  assert.match(files[3], /await verifyBundleManifest\(bundle\)/u)
  assert.ok(files[3].indexOf('PATH_MASK_REVEAL_SECRET_INVALID') < files[3].indexOf("vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts')"))
})

test('R5 path-masked labels require paired user-impact and planning-error judgments', async () => {
  const schema = JSON.parse(await readFile(path.join(process.cwd(), 'docs', 'e2-v4-pro-benchmark-r5', 'path-masked-labels.schema.json'), 'utf8'))
  const required = schema.properties.labels.items.required
  assert.deepEqual(required, ['caseAnonymousId', 'preferredSide', 'xMajor', 'yMajor', 'xPlanningError', 'yPlanningError', 'reason'])
  for (const field of ['xMajor', 'yMajor', 'xPlanningError', 'yPlanningError']) {
    assert.equal(schema.properties.labels.items.properties[field].type, 'boolean')
  }
  const reveal = await readFile(path.join(process.cwd(), 'scripts', 'reveal-e2-9-r5-adjudication.mjs'), 'utf8')
  assert.match(reveal, /proMajor/u)
  assert.match(reveal, /flashPlanningError/u)
})

test('R5 gate cannot authorize Selection or Blind and uses the R5 screening status', async () => {
  const source = await readFile(path.join(process.cwd(), 'scripts', 'evaluate-e2-9-r5-gate.mjs'), 'utf8')
  assert.match(source, /V4_PRO_SCREENING_V5_PASS/u)
  assert.match(source, /selection: 'NOT_AUTHORIZED'/u)
  assert.match(source, /blind: 'NOT_CREATED'/u)
  assert.doesNotMatch(source, /selection: pass \? 'AWAITING_APPROVAL'/u)
})

test('R5 activation requires an ordered, fresh, fully bound deployment chain', () => {
  const run = { protocolVersion: 'e2-9-v4-pro-protocol-3.3.0', runId: 'run', runLabel: 'label', runManifestSha256: 'a'.repeat(64), implementationCommit: 'b'.repeat(40) }
  const bundleSha = 'c'.repeat(64)
  const activation = {
    schemaVersion: 'e2.9-r5-preview-activation-3.3.0',
    protocolVersion: run.protocolVersion,
    runId: run.runId,
    runLabel: run.runLabel,
    runManifestSha256: run.runManifestSha256,
    protocolBundleSha256: bundleSha,
    deploymentSourceCommit: run.implementationCommit,
    mainWorker: 'student-affairs-manager-preview',
    ledgerWorker: 'student-affairs-e2-r5-ledger-preview',
    previewOrigin: 'https://student-affairs-manager-preview.nightsdell.workers.dev',
    featureFlag: true,
    productionFeatureFlag: false,
    secretName: 'E2_R5_BENCHMARK_TOKEN',
    secretPolicy: 'Secret value exists only in Cloudflare Secret storage and process memory.',
    productionBaselineVersion: '00000000-0000-0000-0000-000000000000',
    status: 'READINESS_AUTHORIZED',
    activatedAt: '2026-08-13T00:00:04Z',
    ledgerDeploymentVersion: '00000000-0000-0000-0000-000000000001',
    disabledCodeDeploymentVersion: '00000000-0000-0000-0000-000000000002',
    secretChangeVersion: '00000000-0000-0000-0000-000000000003',
    mainDeploymentVersion: '00000000-0000-0000-0000-000000000004',
    deploymentChain: [
      { kind: 'R5_LEDGER_UPLOAD', version: '00000000-0000-0000-0000-000000000001', createdAt: '2026-08-13T00:00:00Z' },
      { kind: 'R5_PREVIEW_DISABLED_CODE_DEPLOYMENT', version: '00000000-0000-0000-0000-000000000002', createdAt: '2026-08-13T00:00:01Z' },
      { kind: 'R5_TEMP_BEARER_SECRET_CHANGE', version: '00000000-0000-0000-0000-000000000003', createdAt: '2026-08-13T00:00:02Z' },
      { kind: 'R5_PREVIEW_ACTIVATION_DEPLOYMENT', version: '00000000-0000-0000-0000-000000000004', createdAt: '2026-08-13T00:00:03Z' },
    ],
  }
  assert.doesNotThrow(() => assertR5ActivationBinding(activation, run, bundleSha))
  assert.throws(() => assertR5ActivationBinding({ ...activation, secretName: 'E2_V4_PRO_BENCHMARK_TOKEN' }, run, bundleSha), /ACTIVATION_SAFETY_STATE_INVALID/u)
  assert.throws(() => assertR5ActivationBinding({ ...activation, deploymentChain: [...activation.deploymentChain].reverse() }, run, bundleSha), /ACTIVATION_DEPLOYMENT_CHAIN_INVALID/u)
  assert.throws(() => assertR5ActivationBinding({ ...activation, deploymentSourceCommit: 'd'.repeat(40) }, run, bundleSha), /ACTIVATION_BINDING_MISMATCH/u)
})

test('R5 post-generation entrypoint import contracts resolve before model calls', async () => {
  const result = await verifyEntrypointImportContracts({ root: process.cwd() })
  assert.equal(result.status, 'PASS')
  assert.equal(result.entrypoints, R5_POST_GENERATION_ENTRYPOINTS.length)
})

test('R5 entrypoint preflight fails closed on a missing named export', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'e2-9-r5-entrypoint-'))
  await writeFile(path.join(root, 'dependency.mjs'), 'export const present = true\n', 'utf8')
  await writeFile(path.join(root, 'entry.mjs'), "import { missing } from './dependency.mjs'\n", 'utf8')
  await assert.rejects(
    verifyEntrypointImportContracts({ root, entryFiles: ['entry.mjs'] }),
    /ENTRYPOINT_IMPORT_MISSING_EXPORT:entry\.mjs:\.\/dependency\.mjs:missing/u,
  )
})

test('R5 runner enforces entrypoint preflight before token access and network phase', async () => {
  const source = await readFile(path.join(process.cwd(), 'scripts', 'run-e2-9-r5.mjs'), 'utf8')
  const preflight = source.lastIndexOf('await verifyEntrypointImportContracts')
  const token = source.lastIndexOf("const token = process.env.E2_R5_BENCHMARK_TOKEN")
  const networkPhase = source.lastIndexOf('await runPhase(phase, token)')
  assert.ok(preflight > 0)
  assert.ok(preflight < token)
  assert.ok(token < networkPhase)
})

test('T09 scorer reads only the final protocol result', () => {
  const final = { observationId: 'obs', result: { modelName: 'm' } }
  assert.equal(scorableFinalPayload({ observationId: 'obs', status: 'complete_after_protocol_retry', response: { payload: final } }), final)
  assert.throws(() => scorableFinalPayload({ observationId: 'obs', status: 'transport_integrity_failure', response: { payload: final } }), /NOT_SCORABLE/u)
})

test('T10 protocol retry rate and transport counts are deterministic', () => {
  const observations = [
    { modelAlias: 'flash', status: 'complete', response: { payload: { protocolAttempts: [{ status: 'complete', durationMs: 10 }] } } },
    { modelAlias: 'flash', status: 'complete_after_protocol_retry', response: { payload: { protocolAttempts: [{ status: 'upstream_json_truncated', durationMs: 20 }, { status: 'complete', durationMs: 30 }] } } },
  ]
  assert.deepEqual(summarizeProtocolRetries(observations, 'flash'), { observations: 2, attempts: 3, truncatedAttempts: 1, retriedObservations: 1, finalFailures: 0, protocolRetryRate: 0.5, observedAttemptLatencyMs: 60 })
})

test('R5 four-way model lineage remains server authoritative', () => {
  assert.doesNotThrow(() => assertFourWayModelLineage({ execution: { requestedModel: 'm', returnedModel: 'm', executionModel: 'm' }, result: { modelName: 'm' } }, 'm'))
  assert.throws(() => assertFourWayModelLineage({ execution: { requestedModel: 'm', returnedModel: 'm', executionModel: 'm' }, result: { modelName: 'x' } }, 'm'), /MODEL_LINEAGE_MISMATCH/u)
})

test('R5 stage prerequisites fail closed and Selection/Blind remain unauthorized', () => {
  assert.doesNotThrow(() => assertR5StagePrerequisite('smoke', { readinessComplete: true }))
  assert.throws(() => assertR5StagePrerequisite('screening', { smokeComplete: false }), /SCREENING_PREREQUISITE_NOT_MET/u)
  assert.doesNotThrow(() => assertR5StagePrerequisite('adjudication', { pathMaskGatePass: true, freshDryReviewPass: true, mappingKeyAbsent: true }))
  assert.doesNotThrow(() => assertR5StagePrerequisite('scoring', { labelsFrozen: true, chronologyValid: true, commitmentVerified: true }))
  assert.throws(() => assertR5StagePrerequisite('selection', {}), /SELECTION_NOT_AUTHORIZED/u)
  assert.throws(() => assertR5StagePrerequisite('blind', {}), /BLIND_NOT_AUTHORIZED/u)
})
