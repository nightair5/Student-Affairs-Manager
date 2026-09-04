import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const resultPath = resolve(root, 'docs/recognition-optimization/rco-5-007-b2-oracle/result.json')
const datasetPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B2_CHALLENGE_DATASET.json')
const freezePath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B2_FREEZE.json')
const result = JSON.parse(await readFile(resultPath, 'utf8'))
const freeze = JSON.parse(await readFile(freezePath, 'utf8'))
const datasetSha256 = createHash('sha256').update(await readFile(datasetPath)).digest('hex')

const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`)

test('oracle replay is explicitly zero-call and not model accuracy', () => {
  assert.equal(result.classification, 'ORACLE_ANCHOR_UPPER_BOUND_SEEN_AFTER_RUN')
  assert.match(result.interpretation, /not model accuracy/i)
  assert.deepEqual(result.accounting, {
    modelCalls: 0,
    networkRequests: 0,
    repairCalls: 0,
    retryCalls: 0,
    secretAccess: 'NONE',
  })
})

test('oracle replay binds the frozen challenge data', () => {
  assert.equal(result.datasetId, freeze.datasetId)
  assert.equal(result.datasetSha256, datasetSha256)
  assert.equal(result.datasetSha256, freeze.componentSha256[freeze.datasetPath])
  assert.equal(result.metrics.caseCount, freeze.sampleCount)
  assert.equal(result.metrics.scoreableCases, freeze.sampleCount)
})

test('oracle gate blocks paid testing on the local policy ceiling', () => {
  closeTo(result.metrics.taskF1, 0.9433962264150944)
  closeTo(result.metrics.requiresActionAccuracy, 0.5625)
  closeTo(result.metrics.completeTaskCaseAccuracy, 0.375)
  closeTo(result.metrics.majorCorrectionRate, 0.625)
  closeTo(result.metrics.safeDefaultRecall, 0.7692307692307693)
  assert.equal(result.metrics.forbiddenDefaultSelections, 0)
  assert.equal(result.gate, 'FAIL')
  assert.equal(result.decision, 'PAID_MODEL_TEST_BLOCKED_LOCAL_POLICY_CEILING')
})

test('oracle replay does not alter release authority', () => {
  assert.equal(result.stablePath, 'UNCHANGED')
  assert.equal(result.rco6, 'NOT_STARTED')
  assert.equal(result.deployment, 'NOT_RUN')
})
