import { canonicalJson, sha256 } from './e2-9-r5-hash.mjs'

export const R5_COMPLETE_STATUSES = new Set(['complete', 'complete_after_protocol_retry'])

export const R5_STAGE_MACHINE = Object.freeze([
  'READINESS_OPEN',
  'SMOKE_OPEN',
  'SCREENING_OPEN',
  'PATH_MASK_PREVIEW_OPEN',
  'ADJUDICATION_OPEN',
  'SCORING_OPEN',
  'COMPLETE',
])

export function completeObservationStatus(status) {
  return R5_COMPLETE_STATUSES.has(status)
}

export function assertProtocolFreezeClean(status) {
  if (typeof status !== 'string') throw new Error('PROTOCOL_FREEZE_STATUS_INVALID')
  if (status.trim()) throw new Error('PROTOCOL_FREEZE_REQUIRES_CLEAN_WORKTREE')
  return true
}

export function assertR5StagePrerequisite(stage, evidence = {}) {
  if (stage === 'readiness') return true
  if (stage === 'smoke' && evidence.readinessComplete === true) return true
  if (stage === 'screening' && evidence.smokeComplete === true) return true
  if (stage === 'path_mask_preview' && evidence.screeningComplete === true) return true
  if (stage === 'adjudication' && evidence.pathMaskGatePass === true && evidence.freshDryReviewPass === true && evidence.mappingKeyAbsent === true) return true
  if (stage === 'scoring' && evidence.labelsFrozen === true && evidence.chronologyValid === true && evidence.commitmentVerified === true) return true
  if (stage === 'selection' || stage === 'blind') throw new Error(`${stage.toUpperCase()}_NOT_AUTHORIZED`)
  throw new Error(`${stage.toUpperCase()}_PREREQUISITE_NOT_MET`)
}

export function deriveCheckpointGateStatus(observations, expectedCount) {
  return observations.length === expectedCount && observations.every((item) => completeObservationStatus(item.status))
    ? 'GENERATION_COMPLETE'
    : 'INTEGRITY_FAILURE'
}

export function assertCanonicalBinding(value, expectedSha256, label) {
  if (sha256(canonicalJson(value)) !== expectedSha256) throw new Error(`${label}_HASH_MISMATCH`)
}

export function assertScoringInputHashes(frozen, actual) {
  const required = ['promptAndPipelineSha256', 'schemaBundleSha256', 'scorerSemanticsSha256', 'protocolBundleSha256', 'datasetBundleSha256']
  if (required.some((field) => typeof frozen?.[field] !== 'string' || frozen[field] !== actual?.[field])) throw new Error('SCORING_INPUT_DRIFT')
  return true
}

export function assertArtifactRunBindings(runManifestSha256, artifactRunManifestSha256Values) {
  if (typeof runManifestSha256 !== 'string' || !Array.isArray(artifactRunManifestSha256Values)
    || artifactRunManifestSha256Values.length === 0
    || artifactRunManifestSha256Values.some((value) => value !== runManifestSha256)) throw new Error('ARTIFACT_BINDING_MISMATCH')
  return true
}

export function assertScoringRunComplete({ checkpoint, ledger, expectedObservations }) {
  if (checkpoint?.gateStatus !== 'GENERATION_COMPLETE' || checkpoint?.runStatus !== 'COMPLETE'
    || !Array.isArray(checkpoint?.observations) || checkpoint.observations.length !== expectedObservations
    || checkpoint.observations.some((item) => !completeObservationStatus(item.status))
    || ledger?.runStatus !== 'COMPLETE' || ledger?.stage !== 'PATH_MASK_PREVIEW_OPEN') throw new Error('SCORING_NOT_ALLOWED')
  return true
}

export function deriveRunManifestSha256(runManifest) {
  const { runManifestSha256: _ignored, ...core } = runManifest
  return sha256(canonicalJson(core))
}

export function assertRunManifestBinding(runManifest) {
  if (deriveRunManifestSha256(runManifest) !== runManifest.runManifestSha256) throw new Error('RUN_MANIFEST_HASH_MISMATCH')
}

export function assertR5ActivationBinding(activation, run, protocolBundleSha256) {
  const validSha = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value)
  const validVersion = (value) => typeof value === 'string' && /^[a-f0-9-]{16,100}$/iu.test(value)
  if (!activation || activation.schemaVersion !== 'e2.9-r5-preview-activation-3.3.0'
    || activation.protocolVersion !== run.protocolVersion || activation.runId !== run.runId || activation.runLabel !== run.runLabel
    || activation.runManifestSha256 !== run.runManifestSha256 || activation.protocolBundleSha256 !== protocolBundleSha256
    || activation.deploymentSourceCommit !== run.implementationCommit || !validSha(protocolBundleSha256)) throw new Error('ACTIVATION_BINDING_MISMATCH')
  if (activation.mainWorker !== 'student-affairs-manager-preview' || activation.ledgerWorker !== 'student-affairs-e2-r5-ledger-preview'
    || activation.previewOrigin !== 'https://student-affairs-manager-preview.nightsdell.workers.dev'
    || activation.featureFlag !== true || activation.productionFeatureFlag !== false
    || activation.secretName !== 'E2_R5_BENCHMARK_TOKEN' || activation.status !== 'READINESS_AUTHORIZED'
    || !validVersion(activation.productionBaselineVersion)
    || typeof activation.secretPolicy !== 'string' || activation.secretPolicy.length < 20
    || !Number.isFinite(Date.parse(activation.activatedAt))) throw new Error('ACTIVATION_SAFETY_STATE_INVALID')
  const chain = activation.deploymentChain
  const expectedKinds = [
    'R5_LEDGER_UPLOAD',
    'R5_PREVIEW_DISABLED_CODE_DEPLOYMENT',
    'R5_TEMP_BEARER_SECRET_CHANGE',
    'R5_PREVIEW_ACTIVATION_DEPLOYMENT',
  ]
  if (!Array.isArray(chain) || chain.length !== expectedKinds.length
    || chain.some((item, index) => item?.kind !== expectedKinds[index] || !validVersion(item.version) || !Number.isFinite(Date.parse(item.createdAt)))
    || chain.some((item, index) => index > 0 && Date.parse(item.createdAt) <= Date.parse(chain[index - 1].createdAt))
    || new Set(chain.map((item) => item.version)).size !== chain.length
    || activation.ledgerDeploymentVersion !== chain[0].version
    || activation.disabledCodeDeploymentVersion !== chain[1].version
    || activation.secretChangeVersion !== chain[2].version
    || activation.mainDeploymentVersion !== chain[3].version
    || Date.parse(activation.activatedAt) < Date.parse(chain[3].createdAt)) throw new Error('ACTIVATION_DEPLOYMENT_CHAIN_INVALID')
  return true
}

export function assertFourWayModelLineage(payload, expectedModel) {
  const values = [payload?.execution?.requestedModel, payload?.execution?.returnedModel, payload?.execution?.executionModel, payload?.result?.modelName]
  if (!values.every((value) => value === expectedModel)) throw new Error('MODEL_LINEAGE_MISMATCH')
}

export function scorableFinalPayload(observation) {
  if (!R5_COMPLETE_STATUSES.has(observation?.status) || !observation?.response?.payload?.result) throw new Error('OBSERVATION_FINAL_RESULT_NOT_SCORABLE')
  if (observation.response.payload.observationId !== observation.observationId) throw new Error('OBSERVATION_ID_MISMATCH')
  return observation.response.payload
}

export function summarizeProtocolRetries(observations, modelAlias) {
  const selected = observations.filter((item) => item.modelAlias === modelAlias)
  const attempts = selected.flatMap((item) => item.response?.payload?.protocolAttempts ?? [])
  const retried = selected.filter((item) => (item.response?.payload?.protocolAttempts?.length ?? 0) === 2)
  return {
    observations: selected.length,
    attempts: attempts.length,
    truncatedAttempts: attempts.filter((item) => item.status === 'upstream_json_truncated').length,
    retriedObservations: retried.length,
    finalFailures: selected.filter((item) => !R5_COMPLETE_STATUSES.has(item.status)).length,
    protocolRetryRate: selected.length ? retried.length / selected.length : 0,
    observedAttemptLatencyMs: attempts.map((item) => item.durationMs).filter(Number.isFinite).reduce((total, value) => total + value, 0),
  }
}
