import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('E2-A Golden source stays byte-for-byte frozen', async () => {
  const manifest = JSON.parse(await readFile('docs/baselines/e2-a/dataset-freeze.json', 'utf8'))
  const source = await readFile(manifest.sourceFile)
  const actual = createHash('sha256').update(source).digest('hex')
  assert.equal(actual, manifest.sha256)
  assert.equal(manifest.sampleCount, 110)
})

test('Golden corrections are explicit and currently empty', async () => {
  const log = JSON.parse(await readFile('docs/baselines/e2-a/dataset-corrections.json', 'utf8'))
  assert.equal(log.datasetVersion, 'e2-a-golden-1.0.0')
  assert.deepEqual(log.corrections, [])
})

test('E2 holdout source stays byte-for-byte frozen', async () => {
  const manifest = JSON.parse(await readFile('docs/baselines/e2-a/holdout-freeze.json', 'utf8'))
  const source = await readFile(manifest.sourceFile)
  const actual = createHash('sha256').update(source).digest('hex')
  assert.equal(actual, manifest.sha256)
  assert.equal(manifest.sampleCount, 40)
})

test('Holdout corrections are explicit and currently empty', async () => {
  const log = JSON.parse(await readFile('docs/baselines/e2-a/holdout-corrections.json', 'utf8'))
  assert.equal(log.datasetVersion, 'e2-holdout-1.0.0')
  assert.deepEqual(log.corrections, [])
})
