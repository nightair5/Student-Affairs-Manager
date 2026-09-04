import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const result = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/rco-5-007-p3-b5-replay/result.json'), 'utf8'))
const runner = await readFile(resolve(root, 'scripts/run-rco-5-007-p3-b5-replay.ts'), 'utf8')

test('P3 seen B5 replay clears every fixed quality and revision metric', () => {
  assert.equal(result.classification, 'SEEN_B5_DEVELOPMENT_FAILURE_REGRESSION')
  for (const key of ['taskPrecision', 'taskRecall', 'taskF1', 'requiresActionAccuracy', 'semanticFieldAccuracy', 'exactTaskBoundaryAccuracy', 'completeTaskCaseAccuracy', 'safeDefaultRecall']) assert.equal(result.metrics[key], 1, key)
  assert.equal(result.metrics.majorCorrectionRate, 0)
  assert.equal(result.metrics.forbiddenDefaultSelections, 0)
  assert.equal(result.revisionMetrics.revisionCaseCompleteAccuracy, 1)
  assert.equal(result.revisionMetrics.supersededTaskExactAccuracy, 1)
  assert.equal(result.revisionMetrics.activeReplacementRecall, 1)
  assert.equal(result.revisionMetrics.staleTaskCount, 0)
  assert.equal(result.revisionMetrics.selectedStaleTaskCount, 0)
  assert.equal(result.revisionMetrics.unresolvedRevisionScopeCount, 0)
  assert.equal(result.gate, 'PASS')
})

test('P3 seen B5 replay is zero-call and release-isolated', () => {
  assert.deepEqual(result.accounting, { modelCalls: 0, networkRequests: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE' })
  assert.doesNotMatch(runner, /\bfetch\s*\(|process\.env|https?:\/\//u)
  assert.equal(result.stablePath, 'UNCHANGED')
  assert.equal(result.rco6, 'NOT_STARTED')
  assert.equal(result.deployment, 'NOT_RUN')
})
