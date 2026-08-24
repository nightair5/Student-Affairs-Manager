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
  R10_QUALIFICATION_RUN_LABEL,
  R10_INDEPENDENT_REVIEW_CHECK_NAMES,
  assertR10AppendOnlyObservation,
  assertR10ImmutableArtifact,
  assertR10ModelIdentity,
  assertR10ProductionIsolation,
  assertR10ScreeningAuthorization,
  assertR10ScreeningQualificationBinding,
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

function screeningQualificationFixture() {
  const protocolBundle = { protocolVersion: R10_PROTOCOL_VERSION, bundleSha256: '1'.repeat(64) }
  const gate = { schemaVersion: 'gate', protocolVersion: R10_PROTOCOL_VERSION, status: 'FROZEN_BEFORE_MODEL_CALLS' }
  const sourceCommit = '2'.repeat(40)
  const sourceTree = '6'.repeat(40)
  const sourceManifestSha256 = '7'.repeat(64)
  const productionIsolationManifestSha256 = '8'.repeat(64)
  const qualificationWorkerVersionId = '11111111-1111-4111-8111-111111111111'
  const ledgerWorkerVersionId = '22222222-2222-4222-8222-222222222222'
  const qualificationResult = {
    schemaVersion: 'e2-9-r10-zero-model-qualification-1.1.5',
    protocolVersion: R10_PROTOCOL_VERSION,
    runLabel: R10_QUALIFICATION_RUN_LABEL,
    status: 'LOCAL_QUALIFIED_PREVIEW_UPLOAD_REQUESTABLE',
    sourceCommit,
    sourceTree,
    sourceManifestSha256,
    productionIsolationManifestSha256,
    protocolBundleSha256: protocolBundle.bundleSha256,
    accessCounters: { modelCalls: 0, upstreamNetworkCalls: 0, expectedAnswerReads: 0 },
    modelCalls: 0,
    upstreamNetworkCalls: 0,
    expectedAnswersLoaded: false,
    nextStages: {
      readiness: false, smoke: false, screening: false,
      selection: false, blind: false, production: false,
    },
  }
  const qualificationResultSha256 = sha256(canonicalJson(qualificationResult))
  const screeningGateSha256 = sha256(canonicalJson(gate))
  const qualificationEvidence = {
    schemaVersion: 'e2.9-r10-zero-model-evidence-1.2.5',
    protocolVersion: R10_PROTOCOL_VERSION,
    runLabel: R10_QUALIFICATION_RUN_LABEL,
    sourceCommit,
    sourceTree,
    sourceManifestSha256,
    productionIsolationManifestSha256,
    protocolBundleSha256: protocolBundle.bundleSha256,
    qualificationResultSha256,
    screeningGateSha256,
    accessCounters: { modelCalls: 0, upstreamNetworkCalls: 0, expectedAnswerReads: 0 },
    modelCalls: 0,
    upstreamNetworkCalls: 0,
    expectedAnswersLoaded: false,
    deploymentArtifacts: {
      qualificationWorkerBytesSha256: '9'.repeat(64),
      qualificationWorkerConfigSha256: 'a'.repeat(64),
      ledgerWorkerBytesSha256: 'b'.repeat(64),
      ledgerWorkerConfigSha256: 'c'.repeat(64),
    },
  }
  const deploymentEvidence = {
    qualificationWorkerVersionId,
    qualificationWorkerBytesSha256: qualificationEvidence.deploymentArtifacts.qualificationWorkerBytesSha256,
    qualificationWorkerConfigSha256: qualificationEvidence.deploymentArtifacts.qualificationWorkerConfigSha256,
    ledgerWorkerVersionId,
    ledgerWorkerBytesSha256: qualificationEvidence.deploymentArtifacts.ledgerWorkerBytesSha256,
    ledgerWorkerConfigSha256: qualificationEvidence.deploymentArtifacts.ledgerWorkerConfigSha256,
  }
  const recomputedDeploymentEvidenceSha256 = sha256(canonicalJson(deploymentEvidence))
  const previewQualification = {
    schemaVersion: 'e2.9-r10-preview-qualification-evidence-1.0.0',
    protocolVersion: R10_PROTOCOL_VERSION,
    runLabel: R10_QUALIFICATION_RUN_LABEL,
    sourceCommit,
    qualificationStatus: 'LOCAL_QUALIFIED_PREVIEW_UPLOAD_REQUESTABLE',
    protocolBundleSha256: protocolBundle.bundleSha256,
    qualificationResultSha256,
    deploymentEvidenceSha256: recomputedDeploymentEvidenceSha256,
    deploymentEvidence,
    qualificationWorkerVersionId,
    qualificationWorkerStableTrafficPercentage: 0,
    ledgerWorkerVersionId,
    ledgerWorkerActiveTrafficPercentage: 100,
    contractStableReads: 3,
    recordStatus: 201,
    idempotentReplayStatus: 200,
    stateStatus: 200,
    lockedStageStatuses: {
      readiness: 412, smoke: 412, screening: 412,
      selection: 412, blind: 412, production: 412,
    },
    wrongOriginStatus: 403,
    wrongAuthenticationStatus: 401,
    modelCalls: 0,
    upstreamNetworkCalls: 0,
    expectedAnswerReads: 0,
    productionSiteConfigChanged: false,
    productionDeployment: 'NOT_DEPLOYED',
    screeningAuthorization: 'NOT_AUTHORIZED',
  }
  const qualificationEvidenceSha256 = sha256(canonicalJson(qualificationEvidence))
  const previewQualificationSha256 = sha256(canonicalJson(previewQualification))
  const independentReview = {
    schemaVersion: 'e2.9-r10-independent-qualification-review-1.0.0',
    reviewId: 'e29r10-f-independent-review-fixture',
    protocolVersion: R10_PROTOCOL_VERSION,
    runLabel: R10_QUALIFICATION_RUN_LABEL,
    sourceCommit,
    sourceTree,
    sourceManifestSha256,
    productionIsolationManifestSha256,
    protocolBundleSha256: protocolBundle.bundleSha256,
    screeningGateSha256,
    qualificationResultSha256,
    qualificationEvidenceSha256,
    previewQualificationSha256,
    deploymentEvidenceSha256: recomputedDeploymentEvidenceSha256,
    qualificationWorkerVersionId,
    ledgerWorkerVersionId,
    reviewer: {
      taskName: '/independent-fixture', forkTurns: 'none', receivedPathMapping: false,
      modifiedArtifacts: false, readOnly: true,
    },
    checks: Object.fromEntries(R10_INDEPENDENT_REVIEW_CHECK_NAMES.map((name) => [name, 'PASS'])),
    findings: [],
    overallStatus: 'PASS',
    modelCalls: 0,
    expectedAnswerReads: 0,
  }
  const authorization = {
    protocolVersion: R10_PROTOCOL_VERSION,
    qualificationRunLabel: R10_QUALIFICATION_RUN_LABEL,
    authorized: true,
    callCap: 16,
    qualifiedSourceCommit: sourceCommit,
    qualifiedSourceTree: sourceTree,
    qualifiedSourceManifestSha256: sourceManifestSha256,
    productionIsolationManifestSha256,
    protocolBundleSha256: protocolBundle.bundleSha256,
    gateSha256: screeningGateSha256,
    qualificationResultSha256,
    qualificationEvidenceSha256,
    previewQualificationSha256,
    deploymentEvidenceSha256: recomputedDeploymentEvidenceSha256,
    independentReviewSha256: sha256(canonicalJson(independentReview)),
    qualificationWorkerVersionId,
    ledgerWorkerVersionId,
    selectionAuthorized: false,
    blindAuthorized: false,
    productionAuthorized: false,
  }
  return {
    authorization,
    artifacts: { protocolBundle, gate, qualificationResult, qualificationEvidence, previewQualification, independentReview },
  }
}

test('R10 Screening authorization binds the exact qualified Preview and independent review', () => {
  const fixture = screeningQualificationFixture()
  assert.equal(assertR10ScreeningQualificationBinding(fixture.authorization, fixture.artifacts).callCap, 16)
})

test('R10 Screening authorization rejects current bundle drift and stale qualification labels', () => {
  const fixture = screeningQualificationFixture()
  assert.throws(() => assertR10ScreeningQualificationBinding(fixture.authorization, {
    ...fixture.artifacts,
    protocolBundle: { ...fixture.artifacts.protocolBundle, bundleSha256: '4'.repeat(64) },
  }), /R10_SCREENING_QUALIFICATION_BINDING_MISMATCH/u)
  assert.throws(() => assertR10ScreeningQualificationBinding({
    ...fixture.authorization, qualificationRunLabel: 'e29r10-zero-model-qualification-20260824-f',
  }, fixture.artifacts), /R10_SCREENING_NOT_AUTHORIZED/u)
  const driftedBundleSha256 = 'd'.repeat(64)
  assert.throws(() => assertR10ScreeningQualificationBinding({
    ...fixture.authorization, protocolBundleSha256: driftedBundleSha256,
  }, {
    ...fixture.artifacts,
    protocolBundle: { ...fixture.artifacts.protocolBundle, bundleSha256: driftedBundleSha256 },
  }), /R10_SCREENING_QUALIFICATION_BINDING_MISMATCH/u)
})

test('R10 Screening authorization rejects result, Preview and deployment evidence drift', () => {
  const fixture = screeningQualificationFixture()
  for (const mutation of [
    { qualificationResult: { ...fixture.artifacts.qualificationResult, status: 'FAILED' } },
    { previewQualification: { ...fixture.artifacts.previewQualification, recordStatus: 200 } },
    { previewQualification: { ...fixture.artifacts.previewQualification, deploymentEvidenceSha256: '5'.repeat(64) } },
  ]) {
    assert.throws(() => assertR10ScreeningQualificationBinding(
      fixture.authorization,
      { ...fixture.artifacts, ...mutation },
    ), /R10_SCREENING_QUALIFICATION_BINDING_MISMATCH/u)
  }
})

test('R10 Screening authorization rejects missing, pending or failed independent review', () => {
  const fixture = screeningQualificationFixture()
  assert.throws(() => assertR10ScreeningQualificationBinding(
    fixture.authorization,
    { ...fixture.artifacts, independentReview: null },
  ), /R10_SCREENING_QUALIFICATION_ARTIFACT_MISSING/u)
  assert.throws(() => assertR10ScreeningQualificationBinding(
    fixture.authorization,
    { ...fixture.artifacts, previewQualification: { ...fixture.artifacts.previewQualification, deploymentEvidence: null } },
  ), /R10_SCREENING_QUALIFICATION_ARTIFACT_MISSING/u)
  for (const overallStatus of ['PENDING', 'FAIL']) {
    assert.throws(() => assertR10ScreeningQualificationBinding(
      fixture.authorization,
      { ...fixture.artifacts, independentReview: { ...fixture.artifacts.independentReview, overallStatus } },
    ), /R10_SCREENING_QUALIFICATION_BINDING_MISMATCH/u)
  }
})

test('R10 Screening authorization rejects extra authorization fields and over-broad stage grants', () => {
  const fixture = screeningQualificationFixture()
  assert.throws(() => assertR10ScreeningQualificationBinding(
    { ...fixture.authorization, extra: true }, fixture.artifacts,
  ), /R10_SCREENING_NOT_AUTHORIZED/u)
  assert.throws(() => assertR10ScreeningQualificationBinding(
    { ...fixture.authorization, selectionAuthorized: true }, fixture.artifacts,
  ), /R10_SCREENING_NOT_AUTHORIZED/u)
})

test('R10 disk authorization fails closed without the exact G qualification binding', async () => {
  const fixture = screeningQualificationFixture()
  await assert.rejects(
    () => assertR10ScreeningAuthorization(fixture.authorization, { root }),
    /R10_SCREENING_(?:QUALIFICATION_ARTIFACT_MISSING|QUALIFICATION_BINDING_MISMATCH)/u,
  )
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
