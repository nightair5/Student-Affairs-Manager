import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const result = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/rco-5-007-b3-oracle/result.json'), 'utf8'))
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B3_DATA_FREEZE.json'), 'utf8'))
const datasetSha = createHash('sha256').update(await readFile(resolve(root, freeze.datasetPath))).digest('hex')
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`)

test('B3 result is the zero-call first run against the pre-run freeze', () => {
  assert.equal(result.classification, 'FIRST_RUN_B3_ORACLE_NOW_SEEN_DEVELOPMENT')
  assert.equal(result.firstRunAgainstFrozenCommit, 'e52e76b3cbfc7e8b760e91b5cde033fedab1c9af')
  assert.deepEqual(result.accounting, { modelCalls: 0, networkRequests: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE' })
  assert.match(result.interpretation, /not model accuracy/i)
})

test('B3 result binds the frozen dataset and all cases remain scoreable', () => {
  assert.equal(result.datasetId, freeze.datasetId)
  assert.equal(result.datasetSha256, datasetSha)
  assert.equal(result.datasetSha256, freeze.componentSha256[freeze.datasetPath])
  assert.equal(result.metrics.caseCount, 16)
  assert.equal(result.metrics.scoreableCases, 16)
})

test('B3 first-run gate fails without a forbidden default', () => {
  closeTo(result.metrics.taskPrecision, 0.96)
  closeTo(result.metrics.taskRecall, 0.96)
  closeTo(result.metrics.taskF1, 0.96)
  closeTo(result.metrics.requiresActionAccuracy, 0.9375)
  closeTo(result.metrics.completeTaskCaseAccuracy, 0.6875)
  closeTo(result.metrics.majorCorrectionRate, 0.3125)
  closeTo(result.metrics.safeDefaultRecall, 1)
  assert.equal(result.metrics.forbiddenDefaultSelections, 0)
  assert.equal(result.gate, 'FAIL')
  assert.equal(result.decision, 'B3_ORACLE_FAIL_P1_GENERALIZATION_NOT_ESTABLISHED_PAID_MODEL_BLOCKED')
})

test('B3 failure does not alter release authority', () => {
  assert.equal(result.stablePath, 'UNCHANGED')
  assert.equal(result.rco6, 'NOT_STARTED')
  assert.equal(result.deployment, 'NOT_RUN')
})
