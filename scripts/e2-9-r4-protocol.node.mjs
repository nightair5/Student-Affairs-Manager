import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { canonicalJson, canonicalizeFileContent, hashBundle, normalizeLf, sha256 } from './e2-9-r4-hash.mjs'
import {
  assertCanonicalBinding,
  assertFourWayModelLineage,
  assertRunManifestBinding,
  deriveCheckpointGateStatus,
  deriveRunManifestSha256,
  scorableFinalPayload,
  summarizeProtocolRetries,
  assertR4StagePrerequisite,
  completeObservationStatus,
} from './e2-9-r4-integrity.mjs'
import { R4_POST_GENERATION_ENTRYPOINTS, verifyEntrypointImportContracts } from './e2-9-r4-entrypoint-preflight.mjs'

test('R4 canonical JSON, text and bundle hashing are reproducible', async () => {
  assert.equal(canonicalJson({ z: 1, a: { y: 2, x: [3, 4] } }), canonicalJson({ a: { x: [3, 4], y: 2 }, z: 1 }))
  assert.equal(normalizeLf('a\r\nb\rc\n'), 'a\nb\nc\n')
  assert.equal(canonicalizeFileContent('x.md', 'a\r\nb'), canonicalizeFileContent('x.md', 'a\nb'))
  const root = await mkdtemp(path.join(os.tmpdir(), 'e2-9-r4-hash-'))
  await writeFile(path.join(root, 'a.json'), '{\r\n  "z": 1, "a": 2\r\n}\r\n', 'utf8')
  await writeFile(path.join(root, 'b.txt'), 'line1\r\nline2\r\n', 'utf8')
  const first = await hashBundle(root, ['b.txt', 'a.json'])
  const second = await hashBundle(root, ['a.json', 'b.txt'])
  assert.equal(first.sha256, second.sha256)
  assert.deepEqual(first.inputFiles, ['a.json', 'b.txt'])
})

test('R4 run manifest self-binding and artifact bindings fail closed', () => {
  const core = { protocolVersion: '3.2.0', bindings: { prompt: 'x' } }
  const manifest = { ...core, runManifestSha256: sha256(canonicalJson(core)) }
  assert.doesNotThrow(() => assertRunManifestBinding(manifest))
  assert.throws(() => assertRunManifestBinding({ ...manifest, bindings: { prompt: 'y' } }), /RUN_MANIFEST_HASH_MISMATCH/u)
  assert.equal(deriveRunManifestSha256(manifest), manifest.runManifestSha256)
  assert.doesNotThrow(() => assertCanonicalBinding({ a: 1 }, sha256('{"a":1}'), 'MANIFEST'))
})

test('R4 complete-after-retry is complete but failures cannot complete a checkpoint', () => {
  assert.equal(completeObservationStatus('complete'), true)
  assert.equal(completeObservationStatus('complete_after_protocol_retry'), true)
  assert.equal(completeObservationStatus('transport_integrity_failure'), false)
  assert.equal(deriveCheckpointGateStatus([{ status: 'complete' }, { status: 'complete_after_protocol_retry' }], 2), 'GENERATION_COMPLETE')
  assert.equal(deriveCheckpointGateStatus([{ status: 'complete' }, { status: 'transport_integrity_failure' }], 2), 'INTEGRITY_FAILURE')
})

test('R4 post-generation entrypoint import contracts resolve before model calls', async () => {
  const result = await verifyEntrypointImportContracts({ root: process.cwd() })
  assert.equal(result.status, 'PASS')
  assert.equal(result.entrypoints, R4_POST_GENERATION_ENTRYPOINTS.length)
})

test('R4 entrypoint preflight fails closed on a missing named export', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'e2-9-r4-entrypoint-'))
  await writeFile(path.join(root, 'dependency.mjs'), 'export const present = true\n', 'utf8')
  await writeFile(path.join(root, 'entry.mjs'), "import { missing } from './dependency.mjs'\n", 'utf8')
  await assert.rejects(
    verifyEntrypointImportContracts({ root, entryFiles: ['entry.mjs'] }),
    /ENTRYPOINT_IMPORT_MISSING_EXPORT:entry\.mjs:\.\/dependency\.mjs:missing/u,
  )
})

test('R4 runner enforces entrypoint preflight before token access and network phase', async () => {
  const source = await readFile(path.join(process.cwd(), 'scripts', 'run-e2-9-r4.mjs'), 'utf8')
  const preflight = source.lastIndexOf('await verifyEntrypointImportContracts')
  const token = source.lastIndexOf("const token = process.env.E2_V4_PRO_BENCHMARK_TOKEN")
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

test('R4 four-way model lineage remains server authoritative', () => {
  assert.doesNotThrow(() => assertFourWayModelLineage({ execution: { requestedModel: 'm', returnedModel: 'm', executionModel: 'm' }, result: { modelName: 'm' } }, 'm'))
  assert.throws(() => assertFourWayModelLineage({ execution: { requestedModel: 'm', returnedModel: 'm', executionModel: 'm' }, result: { modelName: 'x' } }, 'm'), /MODEL_LINEAGE_MISMATCH/u)
})

test('R4 stage prerequisites fail closed and Selection/Blind remain unauthorized', () => {
  assert.doesNotThrow(() => assertR4StagePrerequisite('smoke', { readinessComplete: true }))
  assert.throws(() => assertR4StagePrerequisite('screening', { smokeComplete: false }), /SCREENING_PREREQUISITE_NOT_MET/u)
  assert.doesNotThrow(() => assertR4StagePrerequisite('adjudication', { pathMaskGatePass: true, freshDryReviewPass: true, mappingKeyAbsent: true }))
  assert.doesNotThrow(() => assertR4StagePrerequisite('scoring', { labelsFrozen: true, chronologyValid: true, commitmentVerified: true }))
  assert.throws(() => assertR4StagePrerequisite('selection', {}), /SELECTION_NOT_AUTHORIZED/u)
  assert.throws(() => assertR4StagePrerequisite('blind', {}), /BLIND_NOT_AUTHORIZED/u)
})
