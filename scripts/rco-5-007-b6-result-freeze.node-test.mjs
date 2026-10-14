import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B6_RESULT_FREEZE.json'), 'utf8'))
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')

test('B6 result freeze binds the first-run result and adversarial audit', async () => {
  assert.equal(freeze.schemaVersion, 'rco-5-007-b6-result-freeze-1.0.0')
  assert.equal(freeze.status, 'FIRST_RUN_PASS_NOW_SEEN_DEVELOPMENT')
  assert.equal(freeze.firstRunAgainstFrozenCommit, 'ee7ffc9')
  assert.equal(freeze.componentPaths.length, 7)
  for (const path of freeze.componentPaths) assert.equal(await sha(path), freeze.componentSha256[path], path)
})

test('B6 pass is bounded to local P3 and does not silently authorize paid or release work', () => {
  assert.equal(freeze.qualityGate, 'PASS')
  assert.equal(freeze.overallGate, 'PASS_LOCAL_P3_ONLY')
  assert.equal(freeze.revisionMetrics.relationExactAccuracyByKind.cancels, 1)
  assert.equal(freeze.revisionMetrics.relationExactAccuracyByKind.supersedes, 1)
  assert.equal(freeze.revisionMetrics.relationExactAccuracyByKind.amends, 1)
  assert.equal(freeze.revisionMetrics.staleTaskCount, 0)
  assert.equal(freeze.rerunAuthorized, false)
  assert.equal(freeze.eligibleForSeparatePaidModelAuthorization, true)
  assert.equal(freeze.paidRunAuthorized, false)
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'BLOCKED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})

test('engineering checks cannot be misreported as model or release evidence', () => {
  assert.deepEqual(freeze.engineeringGate, {
    lint: 'PASS',
    test: 'PASS_597_PLUS_1_LIVE_OCR_SKIPPED',
    b6AndP3Integrity: 'PASS_10_OF_10',
    build: 'PASS_WITH_EXISTING_CHUNK_WARNING',
    securityScan: 'PASS',
  })
  assert.match(freeze.evidenceBoundary, /not model, OCR, real-data, human-time, browser, privacy, security acceptance or release evidence/u)
})
