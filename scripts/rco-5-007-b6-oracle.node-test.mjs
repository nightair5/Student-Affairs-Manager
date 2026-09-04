import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const result = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/rco-5-007-b6-oracle/result.json'), 'utf8'))
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B6_DATA_FREEZE.json'), 'utf8'))
const runner = await readFile(resolve(root, 'scripts/run-rco-5-007-b6-oracle.ts'), 'utf8')
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')

test('B6 result is the single first run against the previously pushed freeze', async () => {
  assert.equal(result.classification, 'FIRST_RUN_B6_ORACLE_NOW_SEEN_DEVELOPMENT')
  assert.equal(result.firstRunAgainstFrozenCommit, 'ee7ffc9')
  assert.equal(result.datasetId, freeze.datasetId)
  assert.equal(result.datasetSha256, await sha(freeze.datasetPath))
  assert.equal(result.cases.length, 16)
})

test('B6 clears every pre-registered task and revision gate', () => {
  assert.equal(result.metrics.scoreableCases, freeze.oracleGate.scoreableCases)
  assert.ok(result.metrics.taskF1 >= freeze.oracleGate.taskF1Minimum)
  assert.ok(result.metrics.requiresActionAccuracy >= freeze.oracleGate.requiresActionAccuracyMinimum)
  assert.ok(result.metrics.completeTaskCaseAccuracy >= freeze.oracleGate.completeTaskCaseAccuracyMinimum)
  assert.ok(result.metrics.forbiddenDefaultSelections <= freeze.oracleGate.forbiddenDefaultSelectionsMaximum)
  for (const kind of ['cancels', 'supersedes', 'amends']) assert.equal(result.revisionMetrics.relationExactAccuracyByKind[kind], 1, kind)
  assert.equal(result.revisionMetrics.supersededTaskExactAccuracy, 1)
  assert.equal(result.revisionMetrics.activeReplacementRecall, 1)
  assert.equal(result.revisionMetrics.staleTaskCount, 0)
  assert.equal(result.revisionMetrics.selectedStaleTaskCount, 0)
  assert.equal(result.revisionMetrics.unresolvedRevisionExactAccuracy, 1)
  assert.equal(result.gate, 'PASS')
})

test('B6 runner remains zero-call, one-shot and release-isolated', () => {
  assert.deepEqual(result.accounting, { modelCalls: 0, networkRequests: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE' })
  assert.doesNotMatch(runner, /\bfetch\s*\(|process\.env|https?:\/\//u)
  assert.match(runner, /B6_FIRST_RUN_ALREADY_EXISTS/u)
  assert.equal(result.stablePath, 'UNCHANGED')
  assert.equal(result.rco6, 'NOT_STARTED')
  assert.equal(result.deployment, 'NOT_RUN')
})

test('Expected revision labels score output but never enter the P3 candidate', () => {
  const candidateBlock = runner.slice(runner.indexOf('function oracleCandidate'), runner.indexOf('\nconst cases ='))
  assert.doesNotMatch(candidateBlock, /revisionRelations|unresolvedRevisionScopeTexts/u)
  assert.match(candidateBlock, /revisionRefs: \[\]/u)
  assert.match(runner, /reduceModelCandidate\(oracleCandidate/u)
})
