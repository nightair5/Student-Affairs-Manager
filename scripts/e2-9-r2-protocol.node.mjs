import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { canonicalJson, canonicalizeFileContent, hashBundle, normalizeLf, sha256 } from './e2-9-r2-hash.mjs'
import { assertCanonicalBinding, assertFourWayModelLineage, deriveCheckpointGateStatus } from './e2-9-r2-integrity.mjs'

test('R2 canonical JSON and text hashing is deterministic', () => {
  assert.equal(canonicalJson({ z: 1, a: { y: 2, x: [3, 4] } }), canonicalJson({ a: { x: [3, 4], y: 2 }, z: 1 }))
  assert.equal(normalizeLf('a\r\nb\rc\n'), 'a\nb\nc\n')
  assert.equal(canonicalizeFileContent('x.md', 'a\r\nb'), canonicalizeFileContent('x.md', 'a\nb'))
})

test('R2 bundle covers every listed file and is input-order independent', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'e2-9-r2-hash-'))
  await writeFile(path.join(root, 'a.json'), '{\r\n  "z": 1, "a": 2\r\n}\r\n', 'utf8')
  await writeFile(path.join(root, 'b.txt'), 'line1\r\nline2\r\n', 'utf8')
  const first = await hashBundle(root, ['b.txt', 'a.json'])
  const second = await hashBundle(root, ['a.json', 'b.txt'])
  assert.equal(first.sha256, second.sha256)
  assert.deepEqual(first.inputFiles, ['a.json', 'b.txt'])
  assert.equal(first.entries[0].canonicalSha256, sha256('{"a":2,"z":1}'))
})

test('integrity failure can never produce a complete checkpoint', () => {
  assert.equal(deriveCheckpointGateStatus([{ status: 'complete' }, { status: 'integrity_failure' }], 2), 'INTEGRITY_FAILURE')
  assert.equal(deriveCheckpointGateStatus([{ status: 'complete' }], 2), 'INTEGRITY_FAILURE')
  assert.equal(deriveCheckpointGateStatus([{ status: 'complete' }, { status: 'complete' }], 2), 'GENERATION_COMPLETE')
})

test('scorer binding and four-way model lineage fail closed', () => {
  assert.doesNotThrow(() => assertCanonicalBinding({ a: 1 }, sha256('{"a":1}'), 'MANIFEST'))
  assert.throws(() => assertCanonicalBinding({ a: 2 }, sha256('{"a":1}'), 'MANIFEST'), /MANIFEST_HASH_MISMATCH/u)
  assert.doesNotThrow(() => assertFourWayModelLineage({ execution: { requestedModel: 'm', returnedModel: 'm', executionModel: 'm' }, result: { modelName: 'm' } }, 'm'))
  assert.throws(() => assertFourWayModelLineage({ execution: { requestedModel: 'm', returnedModel: 'm', executionModel: 'm' }, result: { modelName: 'x' } }, 'm'), /MODEL_LINEAGE_MISMATCH/u)
})
