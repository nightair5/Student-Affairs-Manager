import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const result = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/rco-5-007-b4-oracle/result.json'), 'utf8'))
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B4_DATA_FREEZE.json'), 'utf8'))
const datasetSha = createHash('sha256').update(await readFile(resolve(root, freeze.datasetPath))).digest('hex')
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`)

test('B4 result is the single zero-call first run against its pre-run freeze', () => {
  assert.equal(result.classification, 'FIRST_RUN_B4_ORACLE_NOW_SEEN_DEVELOPMENT')
  assert.equal(result.firstRunAgainstFrozenCommit, 'fc2aeb78f8d01f06a4c14be6c31bfdb91073d5be')
  assert.deepEqual(result.accounting, { modelCalls: 0, networkRequests: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE' })
  assert.match(result.interpretation, /not model accuracy/i)
})

test('B4 result binds the frozen data and keeps all cases in the denominator', () => {
  assert.equal(result.datasetId, freeze.datasetId)
  assert.equal(result.datasetSha256, datasetSha)
  assert.equal(result.datasetSha256, freeze.componentSha256[freeze.datasetPath])
  assert.equal(result.metrics.caseCount, 16)
  assert.equal(result.metrics.scoreableCases, 16)
})

test('B4 clears the preregistered gate without hiding its one major correction', () => {
  assert.equal(result.metrics.taskF1, 1)
  assert.equal(result.metrics.requiresActionAccuracy, 1)
  closeTo(result.metrics.semanticFieldAccuracy, 0.9751552795031055)
  assert.equal(result.metrics.exactTaskBoundaryAccuracy, 1)
  assert.equal(result.metrics.completeTaskCaseAccuracy, 0.9375)
  assert.equal(result.metrics.majorCorrectionRate, 0.0625)
  assert.equal(result.metrics.safeDefaultRecall, 1)
  assert.equal(result.metrics.forbiddenDefaultSelections, 0)
  assert.equal(result.gate, 'PASS')
  assert.equal(result.decision, 'B4_ORACLE_PASS_ELIGIBLE_FOR_SEPARATE_PAID_MODEL_AUTHORIZATION')
})

test('B4 pass does not authorize model calls or release changes', () => {
  assert.equal(result.stablePath, 'UNCHANGED')
  assert.equal(result.rco6, 'NOT_STARTED')
  assert.equal(result.deployment, 'NOT_RUN')
})
