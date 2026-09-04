import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const result = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/rco-5-007-p2-e1-b4-replay/result.json'), 'utf8'))

test('E1 B4 replay is explicitly seen and byte-equivalent at the scored case level', () => {
  assert.equal(result.classification, 'SEEN_B4_TYPE_FIX_REGRESSION')
  assert.equal(result.correctionRuntimeEquivalent, true)
  assert.equal(result.replayCasesEqual, true)
  assert.equal(result.metricsEqual, true)
})

test('E1 B4 replay preserves the original quality metrics', () => {
  assert.equal(result.metrics.taskF1, 1)
  assert.equal(result.metrics.requiresActionAccuracy, 1)
  assert.equal(result.metrics.completeTaskCaseAccuracy, 0.9375)
  assert.equal(result.metrics.majorCorrectionRate, 0.0625)
  assert.equal(result.metrics.safeDefaultRecall, 1)
  assert.equal(result.metrics.forbiddenDefaultSelections, 0)
})

test('E1 B4 replay is zero-call and release-isolated', () => {
  assert.deepEqual(result.accounting, { modelCalls: 0, networkRequests: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE' })
  assert.equal(result.stablePath, 'UNCHANGED')
  assert.equal(result.rco6, 'NOT_STARTED')
  assert.equal(result.deployment, 'NOT_RUN')
})
