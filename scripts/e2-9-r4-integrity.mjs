import { canonicalJson, sha256 } from './e2-9-r4-hash.mjs'

export const R4_COMPLETE_STATUSES = new Set(['complete', 'complete_after_protocol_retry'])

export function completeObservationStatus(status) {
  return R4_COMPLETE_STATUSES.has(status)
}

export function assertR4StagePrerequisite(stage, evidence = {}) {
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

export function deriveRunManifestSha256(runManifest) {
  const { runManifestSha256: _ignored, ...core } = runManifest
  return sha256(canonicalJson(core))
}

export function assertRunManifestBinding(runManifest) {
  if (deriveRunManifestSha256(runManifest) !== runManifest.runManifestSha256) throw new Error('RUN_MANIFEST_HASH_MISMATCH')
}

export function assertFourWayModelLineage(payload, expectedModel) {
  const values = [payload?.execution?.requestedModel, payload?.execution?.returnedModel, payload?.execution?.executionModel, payload?.result?.modelName]
  if (!values.every((value) => value === expectedModel)) throw new Error('MODEL_LINEAGE_MISMATCH')
}

export function scorableFinalPayload(observation) {
  if (!R4_COMPLETE_STATUSES.has(observation?.status) || !observation?.response?.payload?.result) throw new Error('OBSERVATION_FINAL_RESULT_NOT_SCORABLE')
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
    finalFailures: selected.filter((item) => !R4_COMPLETE_STATUSES.has(item.status)).length,
    protocolRetryRate: selected.length ? retried.length / selected.length : 0,
    observedAttemptLatencyMs: attempts.map((item) => item.durationMs).filter(Number.isFinite).reduce((total, value) => total + value, 0),
  }
}
