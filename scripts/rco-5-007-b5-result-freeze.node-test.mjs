import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B5_RESULT_FREEZE.json'), 'utf8'))
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')

test('B5 result freeze binds the first-run result and adversarial audit', async () => {
  assert.equal(freeze.schemaVersion, 'rco-5-007-b5-result-freeze-1.0.0')
  assert.equal(freeze.status, 'FIRST_RUN_FAIL_NOW_SEEN_DEVELOPMENT')
  assert.equal(freeze.componentPaths.length, 7)
  for (const path of freeze.componentPaths) assert.equal(await sha(path), freeze.componentSha256[path], path)
})

test('B5 failure remains fail-closed and cannot authorize paid or release work', () => {
  assert.equal(freeze.qualityGate, 'FAIL')
  assert.equal(freeze.overallGate, 'FAIL')
  assert.equal(freeze.revisionMetrics.staleTaskCount, 1)
  assert.equal(freeze.revisionMetrics.selectedStaleTaskCount, 0)
  assert.equal(freeze.rerunAuthorized, false)
  assert.equal(freeze.paidRunAuthorized, false)
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'BLOCKED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})

test('B5 engineering checks passed but cannot override the quality failure', () => {
  assert.deepEqual(freeze.engineeringGate, {
    lint: 'PASS',
    test: 'PASS_580_PLUS_1_LIVE_OCR_SKIPPED',
    build: 'PASS_WITH_EXISTING_CHUNK_WARNING',
    securityScan: 'PASS_504_FILES',
  })
  assert.equal(freeze.overallGate, 'FAIL')
})
