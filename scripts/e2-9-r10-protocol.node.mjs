import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

import {
  E2_R10_REQUIRED_CHECK_NAMES,
  E2_R10_REQUIRED_COMPONENT_VERSIONS,
} from '../cloudflare/e2-r10-qualification-contract.mjs'
import {
  R10_PRODUCTION_BASELINE_COMMIT,
  R10_PROTOCOL_VERSION,
  assertR10AppendOnlyObservation,
  assertR10ImmutableArtifact,
  assertR10ModelIdentity,
  assertR10ProductionIsolation,
  assertR10ScreeningAuthorization,
  assertR10StageTransition,
  buildR10ProtocolBundle,
  buildR10QualificationDeploymentArtifacts,
  buildR10QualificationResult,
  canonicalJson,
  createR10AccessInstrumentation,
  inspectR10TrackedSource,
  r10PreviewWorkerNameCompatible,
  safeHashEqual,
  sha256,
} from './e2-9-r10-protocol.mjs'

const root = path.resolve(import.meta.dirname, '..')
const HASH = 'a'.repeat(64)

test('R10 canonical JSON and non-placeholder hash comparison are deterministic', () => {
  assert.equal(canonicalJson({ b: 2, a: [1, { d: 4, c: 3 }] }), '{"a":[1,{"c":3,"d":4}],"b":2}')
  assert.equal(sha256('facts-first'), sha256('facts-first'))
  assert.equal(safeHashEqual(HASH, HASH), true)
  assert.equal(safeHashEqual('0'.repeat(64), '0'.repeat(64)), false)
})

test('R10 Preview Worker name and origin satisfy Cloudflare version-preview limits', () => {
  const validName = 'sa-e2-r10-facts-first-qual-preview'
  assert.equal(r10PreviewWorkerNameCompatible(validName, `https://${validName}.example.workers.dev`), true)
  assert.equal(r10PreviewWorkerNameCompatible('x'.repeat(55), `https://${'x'.repeat(55)}.example.workers.dev`), false)
  assert.equal(r10PreviewWorkerNameCompatible(validName, 'https://different.example.workers.dev'), false)
  assert.equal(r10PreviewWorkerNameCompatible(validName, `https://${validName}.example.workers.dev/path`), false)
})

test('R10 stage machine forbids skips and reverse transitions', () => {
  assert.equal(assertR10StageTransition('ZERO_MODEL_IMPLEMENTATION', 'LOCAL_QUALIFIED'), 'LOCAL_QUALIFIED')
  assert.throws(() => assertR10StageTransition('ZERO_MODEL_IMPLEMENTATION', 'SCREENING_AUTHORIZED'), /R10_STAGE_TRANSITION_FORBIDDEN/u)
  assert.throws(() => assertR10StageTransition('LOCAL_QUALIFIED', 'ZERO_MODEL_IMPLEMENTATION'), /R10_STAGE_TRANSITION_FORBIDDEN/u)
})

test('R10 model identity requires four server-observed names to agree', () => {
  assert.equal(assertR10ModelIdentity({ requestedModel: 'deepseek-v4-flash', returnedModel: 'deepseek-v4-flash', executionModel: 'deepseek-v4-flash', resultModelName: 'deepseek-v4-flash' }), 'deepseek-v4-flash')
  assert.throws(() => assertR10ModelIdentity({ requestedModel: 'deepseek-v4-pro', returnedModel: 'deepseek-v4-pro', executionModel: 'deepseek-v4-pro', resultModelName: 'deepseek-v4-flash' }), /R10_MODEL_IDENTITY_MISMATCH/u)
})

test('R10 observation records are immutable and never overwrite failure', () => {
  const failure = { observationId: 'obs-1', status: 'FAILED' }
  assert.throws(() => assertR10AppendOnlyObservation(failure, { observationId: 'obs-1', status: 'SUCCEEDED' }), /R10_OBSERVATION_IMMUTABLE/u)
  assert.throws(() => assertR10AppendOnlyObservation(failure, failure), /R10_OBSERVATION_ALREADY_RECORDED/u)
})

test('R10 local qualification artifacts are create-once and content immutable', () => {
  assert.equal(assertR10ImmutableArtifact(null, 'first', 'evidence.json'), 'CREATE')
  assert.equal(assertR10ImmutableArtifact('first', 'first', 'evidence.json'), 'IDENTICAL')
  assert.throws(
    () => assertR10ImmutableArtifact('failed', 'passed', 'evidence.json'),
    /R10_LOCAL_ARTIFACT_IMMUTABLE:evidence\.json/u,
  )
})

test('R10 Screening authorization recomputes protocol and Gate hashes', async () => {
  const bundle = await buildR10ProtocolBundle(root)
  const gate = JSON.parse(await readFile(path.join(root, 'docs', 'e2-v4-pro-benchmark-r10', 'screening-gate.json'), 'utf8'))
  const authorization = {
    protocolVersion: R10_PROTOCOL_VERSION,
    authorized: true,
    callCap: 16,
    protocolBundleSha256: bundle.bundleSha256,
    gateSha256: sha256(canonicalJson(gate)),
    selectionAuthorized: false,
    blindAuthorized: false,
    productionAuthorized: false,
  }
  assert.equal((await assertR10ScreeningAuthorization(authorization, { root })).callCap, 16)
  await assert.rejects(() => assertR10ScreeningAuthorization({
    ...authorization, protocolBundleSha256: '0'.repeat(64),
  }, { root }), /R10_SCREENING_NOT_AUTHORIZED/u)
  await assert.rejects(() => assertR10ScreeningAuthorization({
    ...authorization, gateSha256: '9'.repeat(64),
  }, { root }), /R10_SCREENING_BINDING_MISMATCH/u)
})

test('R10 qualification result constructs both pass and failure from exact frozen sets', () => {
  const sourceBinding = {
    sourceCommit: '1'.repeat(40),
    sourceTree: '2'.repeat(40),
    sourceManifestSha256: '3'.repeat(64),
  }
  const productionIsolation = {
    baselineCommit: R10_PRODUCTION_BASELINE_COMMIT,
    manifestSha256: '4'.repeat(64),
  }
  const protocolBundle = { protocolVersion: R10_PROTOCOL_VERSION, bundleSha256: HASH }
  const checks = Object.fromEntries(E2_R10_REQUIRED_CHECK_NAMES.map((name) => [name, true]))
  const base = {
    sourceBinding,
    productionIsolation,
    protocolBundle,
    componentVersions: { ...E2_R10_REQUIRED_COMPONENT_VERSIONS },
    accessCounters: { modelCalls: 0, upstreamNetworkCalls: 0, expectedAnswerReads: 0 },
  }
  const passed = buildR10QualificationResult({ ...base, checks })
  assert.equal(passed.status, 'LOCAL_QUALIFIED_PREVIEW_UPLOAD_REQUESTABLE')
  const failed = buildR10QualificationResult({
    ...base, checks: { ...checks, factLedgerValidated: false },
  })
  assert.equal(failed.status, 'LOCAL_QUALIFICATION_FAILED_PREVIEW_LOCKED')
  assert.throws(() => buildR10QualificationResult({
    ...base, checks: { ...checks, extra: true },
  }), /R10_QUALIFICATION_EVIDENCE_INVALID/u)
})

test('R10 access instrumentation reports real invocation counts', async () => {
  const instrumentation = createR10AccessInstrumentation()
  instrumentation.recordFileRead('docs/frozen-expected.json')
  await instrumentation.modelCall(async () => 'model')
  await instrumentation.networkCall(async () => 'network')
  assert.deepEqual(instrumentation.snapshot(), {
    modelCalls: 1,
    upstreamNetworkCalls: 1,
    expectedAnswerReads: 1,
  })
})

test('R10 deployment artifacts hash exact qualification/ledger module bytes and config projections', async () => {
  const artifacts = await buildR10QualificationDeploymentArtifacts(root)
  assert.match(artifacts.qualificationWorkerBytesSha256, /^[a-f0-9]{64}$/u)
  assert.match(artifacts.qualificationWorkerConfigSha256, /^[a-f0-9]{64}$/u)
  assert.match(artifacts.ledgerWorkerBytesSha256, /^[a-f0-9]{64}$/u)
  assert.match(artifacts.ledgerWorkerConfigSha256, /^[a-f0-9]{64}$/u)
  assert.equal(artifacts.qualificationWorkerModuleCount, 2)
  assert.ok(artifacts.ledgerWorkerModuleCount >= 2)
})

test('R10 source binding uses full commit/tree/blob manifest and exposes dirty state', () => {
  const source = inspectR10TrackedSource(root)
  assert.match(source.sourceCommit, /^[a-f0-9]{40}$/u)
  assert.match(source.sourceTree, /^[a-f0-9]{40}$/u)
  assert.match(source.sourceManifestSha256, /^[a-f0-9]{64}$/u)
  assert.equal(typeof source.worktreeClean, 'boolean')
  assert.equal(typeof source.protocolFilesTracked, 'boolean')
})

test('R10 production isolation matches the full frozen dependency/deployment manifest', async () => {
  const isolation = await assertR10ProductionIsolation(root)
  assert.equal(isolation.baselineCommit, R10_PRODUCTION_BASELINE_COMMIT)
  assert.equal(isolation.matched, true)
  assert.ok(isolation.entryCount > 100)
  assert.ok(isolation.workerModuleCount > 5)
})
