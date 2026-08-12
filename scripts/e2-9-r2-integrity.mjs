import { canonicalJson, sha256 } from './e2-9-r2-hash.mjs'

export function deriveCheckpointGateStatus(observations, expectedCount) {
  return observations.length === expectedCount && observations.every((item) => item.status === 'complete')
    ? 'GENERATION_COMPLETE'
    : 'INTEGRITY_FAILURE'
}

export function assertCanonicalBinding(value, expectedSha256, label) {
  if (sha256(canonicalJson(value)) !== expectedSha256) throw new Error(`${label}_HASH_MISMATCH`)
}

export function assertFourWayModelLineage(payload, expectedModel) {
  const values = [payload?.execution?.requestedModel, payload?.execution?.returnedModel, payload?.execution?.executionModel, payload?.result?.modelName]
  if (!values.every((value) => value === expectedModel)) throw new Error('MODEL_LINEAGE_MISMATCH')
}
