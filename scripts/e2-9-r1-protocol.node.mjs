import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { canonicalJson, canonicalizeFileContent, hashBundle, normalizeLf, sha256 } from './e2-9-r1-hash.mjs'
import { semanticRoleFor, sourceCase } from './prepare-e2-9-r1-manifests.mjs'
import { validateGeneration } from './run-e2-9-r1.mjs'

test('R1 canonical JSON is stable across object key order', () => {
  assert.equal(canonicalJson({ z: 1, a: { y: 2, x: [3, 4] } }), canonicalJson({ a: { x: [3, 4], y: 2 }, z: 1 }))
})

test('R1 canonical text is stable across CRLF, CR and LF', () => {
  assert.equal(normalizeLf('a\r\nb\rc\n'), 'a\nb\nc\n')
  assert.equal(canonicalizeFileContent('x.md', 'a\r\nb'), canonicalizeFileContent('x.md', 'a\nb'))
})

test('R1 bundle hash is externally reproducible and input-order independent', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'e2-9-r1-hash-'))
  await writeFile(path.join(root, 'a.json'), '{\r\n  "z": 1, "a": 2\r\n}\r\n', 'utf8')
  await writeFile(path.join(root, 'b.txt'), 'line1\r\nline2\r\n', 'utf8')
  const first = await hashBundle(root, ['b.txt', 'a.json'])
  const second = await hashBundle(root, ['a.json', 'b.txt'])
  assert.equal(first.sha256, second.sha256)
  assert.deepEqual(first.inputFiles, ['a.json', 'b.txt'])
  assert.match(first.sha256, /^[a-f0-9]{64}$/u)
  assert.equal(first.entries[0].canonicalSha256, sha256('{"a":2,"z":1}'))
})

test('R1 source projection preserves semantic role for every benchmark phase', () => {
  assert.equal(semanticRoleFor({ dimensions: ['multi_task'] }), 'action_required')
  assert.equal(semanticRoleFor({ dimensions: ['pure_information', 'no_action'] }), 'information_only')
  assert.equal(semanticRoleFor({ dimensions: ['prompt_injection', 'security'] }), 'prompt_injection')
  assert.deepEqual(sourceCase({ caseId: 'info-1', content: '公告' }, { dimensions: ['information_only'] }), {
    caseId: 'info-1', content: '公告', semanticRole: 'information_only',
  })
})

function generationPayload(result, sourceSha256) {
  const rawOutput = '{"synthetic":true}'
  return {
    rawOutput,
    result,
    execution: {
      requestedModel: 'deepseek-v4-flash', returnedModel: 'deepseek-v4-flash', systemFingerprint: 'synthetic-fingerprint',
      promptVersion: 'recognition-2.4.1', schemaVersion: '2.0', pipelineVersion: 'recognition-pipeline-2.2.1', validatorVersion: 'recognition-quality-2.1.0',
      router: 'BYPASSED', repair: 'DISABLED', normalizer: 'DISABLED', temperature: 0, maxTokens: 6000, thinking: 'disabled',
      attempts: [{}], sourceSha256, rawOutputSha256: sha256(rawOutput), resultSha256: sha256(JSON.stringify(result)), tokenUsage: { input: 1, output: 1, total: 2 },
    },
  }
}

function informationOnlyResult(requiresAction = false) {
  return {
    schemaVersion: '2.0', sourceSummary: { requiresAction }, standaloneTasks: [], milestones: [], materials: [], timePoints: [], events: [], ambiguities: [], evidence: [{ quote: '停电公告' }],
  }
}

test('R1 Gate accepts a bound information-only result with no business entities', () => {
  const fixture = { sourceSha256: sha256('停电公告'), semanticRole: 'information_only' }
  assert.doesNotThrow(() => validateGeneration(generationPayload(informationOnlyResult(false), fixture.sourceSha256), fixture, 'flash'))
})

test('R1 Gate fails closed when semantic role is missing or information-only action state drifts', () => {
  const sourceSha256 = sha256('停电公告')
  assert.throws(() => validateGeneration(generationPayload(informationOnlyResult(false), sourceSha256), { sourceSha256 }, 'flash'), /SEMANTIC_ROLE_MISSING_OR_INVALID/u)
  assert.throws(() => validateGeneration(generationPayload(informationOnlyResult(true), sourceSha256), { sourceSha256, semanticRole: 'information_only' }, 'flash'), /PURE_INFORMATION_REQUIRES_ACTION_DRIFT/u)
})
