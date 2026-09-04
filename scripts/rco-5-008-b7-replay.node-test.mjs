import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const result = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/rco-5-008-b7-replay/result.json'), 'utf8'))
const dataFreeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B7_DATA_FREEZE.json'), 'utf8'))
const oldResultFreeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B7-M1_RESULT_FREEZE.json'), 'utf8'))
const runnerSource = await readFile(resolve(root, 'scripts/run-rco-5-008-b7-replay.ts'), 'utf8')
const sha = async (relativePath) => createHash('sha256').update(await readFile(resolve(root, relativePath))).digest('hex')

test('RCO-5-008 leaves every frozen B7 input and result byte-identical', async () => {
  for (const relativePath of dataFreeze.componentPaths) assert.equal(await sha(relativePath), dataFreeze.componentSha256[relativePath], relativePath)
  for (const relativePath of oldResultFreeze.componentPaths) assert.equal(await sha(relativePath), oldResultFreeze.componentSha256[relativePath], relativePath)
  assert.equal(oldResultFreeze.decision, 'NO_PROMOTION_PAID_REPLICATION_BLOCKED')
})

test('RCO-5-008 B7 replay has zero paid or network capability', () => {
  assert.deepEqual(result.accounting, { modelCalls: 0, networkRequests: 0, verifierCalls: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE' })
  assert.doesNotMatch(runnerSource, /\bfetch\s*\(|DEEPSEEK_API_KEY|Get-Clipboard|api\.deepseek\.com/iu)
})

test('RCO-5-008 B7 seen regression passes every fixed local gate', () => {
  assert.equal(result.classification, 'SEEN_B7_ZERO_CALL_LOCAL_REGRESSION_NOT_MODEL_REPLICATION')
  assert.equal(result.cases.length, 12)
  assert.ok(result.cases.every((item) => item.contractIssues.length === 0))
  assert.deepEqual(result.anchorMetrics, { scopeCounts: { tp: 22, fp: 0, fn: 0 }, scopePrecision: 1, scopeRecall: 1, scopeF1: 1, actionSurfaceExact: 1, objectSurfaceExact: 1, completeAnchorCaseAccuracy: 1 })
  assert.equal(result.taskMetrics.taskF1, 1)
  assert.equal(result.taskMetrics.requiresActionAccuracy, 1)
  assert.equal(result.taskMetrics.completeTaskCaseAccuracy, 1)
  assert.equal(result.taskMetrics.majorCorrectionRate, 0)
  assert.equal(result.taskMetrics.forbiddenDefaultSelections, 0)
  assert.equal(result.unsafeDefaultFalsePositives, 0)
  assert.deepEqual(result.revisionMetrics.relationExactAccuracyByKind, { cancels: 1, supersedes: 1, amends: 1 })
  assert.equal(result.revisionMetrics.oldRequirementInvalidation, 1)
  assert.equal(result.revisionMetrics.activeReplacementRecall, 1)
  assert.equal(result.revisionMetrics.unresolvedRevisionExactAccuracy, 1)
  assert.equal(result.revisionMetrics.staleTaskCount, 0)
  assert.equal(result.revisionMetrics.selectedStaleTaskCount, 0)
  assert.equal(result.gate, 'PASS')
  assert.equal(result.decision, 'B7_SEEN_REGRESSION_PASS_ELIGIBLE_TO_FREEZE_NEW_B8')
})
