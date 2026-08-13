import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { canonicalJson, canonicalizeFileContent, hashBundle, normalizeLf, sha256 } from './e2-9-r3-hash.mjs'
import {
  assertCanonicalBinding,
  assertFourWayModelLineage,
  assertRunManifestBinding,
  deriveCheckpointGateStatus,
  deriveRunManifestSha256,
  scorableFinalPayload,
  summarizeProtocolRetries,
} from './e2-9-r3-integrity.mjs'

test('R3 canonical JSON, text and bundle hashing are reproducible', async () => {
  assert.equal(canonicalJson({ z: 1, a: { y: 2, x: [3, 4] } }), canonicalJson({ a: { x: [3, 4], y: 2 }, z: 1 }))
  assert.equal(normalizeLf('a\r\nb\rc\n'), 'a\nb\nc\n')
  assert.equal(canonicalizeFileContent('x.md', 'a\r\nb'), canonicalizeFileContent('x.md', 'a\nb'))
  const root = await mkdtemp(path.join(os.tmpdir(), 'e2-9-r3-hash-'))
  await writeFile(path.join(root, 'a.json'), '{\r\n  "z": 1, "a": 2\r\n}\r\n', 'utf8')
  await writeFile(path.join(root, 'b.txt'), 'line1\r\nline2\r\n', 'utf8')
  const first = await hashBundle(root, ['b.txt', 'a.json'])
  const second = await hashBundle(root, ['a.json', 'b.txt'])
  assert.equal(first.sha256, second.sha256)
  assert.deepEqual(first.inputFiles, ['a.json', 'b.txt'])
})

test('R3 run manifest self-binding and artifact bindings fail closed', () => {
  const core = { protocolVersion: '3.1.0', bindings: { prompt: 'x' } }
  const manifest = { ...core, runManifestSha256: sha256(canonicalJson(core)) }
  assert.doesNotThrow(() => assertRunManifestBinding(manifest))
  assert.throws(() => assertRunManifestBinding({ ...manifest, bindings: { prompt: 'y' } }), /RUN_MANIFEST_HASH_MISMATCH/u)
  assert.equal(deriveRunManifestSha256(manifest), manifest.runManifestSha256)
  assert.doesNotThrow(() => assertCanonicalBinding({ a: 1 }, sha256('{"a":1}'), 'MANIFEST'))
})

test('R3 complete-after-retry is complete but failures cannot complete a checkpoint', () => {
  assert.equal(deriveCheckpointGateStatus([{ status: 'complete' }, { status: 'complete_after_protocol_retry' }], 2), 'GENERATION_COMPLETE')
  assert.equal(deriveCheckpointGateStatus([{ status: 'complete' }, { status: 'transport_integrity_failure' }], 2), 'INTEGRITY_FAILURE')
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

test('R3 four-way model lineage remains server authoritative', () => {
  assert.doesNotThrow(() => assertFourWayModelLineage({ execution: { requestedModel: 'm', returnedModel: 'm', executionModel: 'm' }, result: { modelName: 'm' } }, 'm'))
  assert.throws(() => assertFourWayModelLineage({ execution: { requestedModel: 'm', returnedModel: 'm', executionModel: 'm' }, result: { modelName: 'x' } }, 'm'), /MODEL_LINEAGE_MISMATCH/u)
})
