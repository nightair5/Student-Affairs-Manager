import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const record = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-P2-E1_TYPE_CORRECTION.json'), 'utf8'))
const originalFreezeBytes = await readFile(resolve(root, record.originalFreezePath))
const originalFreeze = JSON.parse(originalFreezeBytes.toString('utf8'))
const sha = (value) => createHash('sha256').update(value).digest('hex')

test('E1 records exactly one authorized type-only drift from the original B4 freeze', async () => {
  assert.equal(record.schemaVersion, 'rco-5-007-p2-e1-type-correction-1.0.0')
  assert.equal(record.correctedPath, 'src/recognition/taskFormationB4Dataset.test.ts')
  assert.equal(record.originalFreezeSha256, sha(originalFreezeBytes))
  assert.equal(record.beforeSourceSha256, originalFreeze.componentSha256[record.correctedPath])
  assert.equal(record.afterSourceSha256, sha(await readFile(resolve(root, record.correctedPath))))
  assert.equal(record.frozenDriftCount, 1)
  assert.deepEqual(record.frozenDrift.map((item) => item.path), [record.correctedPath])
})

test('E1 type correction erases to identical JavaScript', () => {
  assert.equal(record.runtimeEquivalent, true)
  assert.equal(record.beforeJavaScriptSha256, record.afterJavaScriptSha256)
  assert.match(record.beforeFragment, /revisionRefs: \[\]/)
  assert.match(record.afterFragment, /ScopeReferenceDirective/)
})

test('E1 does not use model, network or secret', () => {
  assert.equal(record.b4Status, 'SEEN_REGRESSION_ONLY')
  assert.equal(record.modelCalls, 0)
  assert.equal(record.networkRequests, 0)
  assert.equal(record.secretAccess, 'NONE')
})
