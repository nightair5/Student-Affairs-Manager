import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B5_DATA_FREEZE.json'), 'utf8'))
const result = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/rco-5-007-b5-oracle/result.json'), 'utf8'))
const runner = await readFile(resolve(root, 'scripts/run-rco-5-007-b5-oracle.ts'), 'utf8')
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')

test('B5 first result remains bound to the committed pre-run freeze', async () => {
  assert.equal(result.firstRunAgainstFrozenCommit, '578d2a3789eaa4f7af252b7587e3b0414ead1746')
  assert.equal(result.datasetId, freeze.datasetId)
  for (const path of freeze.componentPaths) assert.equal(await sha(path), freeze.componentSha256[path], path)
})

test('B5 main metrics pass but the pre-registered revision gate fails', () => {
  assert.equal(result.metrics.scoreableCases, 16)
  assert.equal(result.metrics.taskF1, 1)
  assert.equal(result.metrics.requiresActionAccuracy, 1)
  assert.equal(result.metrics.completeTaskCaseAccuracy, 0.9375)
  assert.equal(result.metrics.forbiddenDefaultSelections, 0)
  assert.equal(result.revisionMetrics.supersededTaskExactAccuracy, 0.5)
  assert.equal(result.revisionMetrics.activeReplacementRecall, 1)
  assert.equal(result.revisionMetrics.staleTaskCount, 1)
  assert.equal(result.revisionMetrics.selectedStaleTaskCount, 0)
  assert.equal(result.gate, 'FAIL')
  assert.equal(result.decision, 'B5_ORACLE_FAIL_P2_GENERALIZATION_NOT_ESTABLISHED_PAID_MODEL_BLOCKED')
})

test('B5 oracle used no model, network, repair, retry, secret or release path', () => {
  assert.deepEqual(result.accounting, { modelCalls: 0, networkRequests: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE' })
  assert.doesNotMatch(runner, /\bfetch\s*\(|process\.env|https?:\/\//u)
  assert.equal(result.stablePath, 'UNCHANGED')
  assert.equal(result.rco6, 'NOT_STARTED')
  assert.equal(result.deployment, 'NOT_RUN')
})
