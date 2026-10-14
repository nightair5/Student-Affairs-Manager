import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B6_DATA_FREEZE.json'), 'utf8'))
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')

test('B6 is frozen as unseen after P3 freeze and before its first P3 run', () => {
  assert.equal(freeze.schemaVersion, 'rco-5-007-b6-data-freeze-1.0.0')
  assert.equal(freeze.status, 'DATA_EXPECTED_AND_P3_FROZEN_BEFORE_FIRST_RUN')
  assert.equal(freeze.seenStatusAtFreeze, 'UNSEEN_BY_P3_AT_FREEZE_AND_UNSEEN_BY_DEEPSEEK')
  assert.equal(freeze.sampleCount, 16)
  assert.equal(freeze.p3Commit, '07a056e769a09b4a5c608b041eb9ee23820b85fc')
  assert.match(freeze.firstRunPolicy, /Exactly one first P3 oracle run/)
})

test('B6 freeze binds new data, P3, evaluator and local contracts', async () => {
  assert.equal(freeze.componentPaths.length, 10)
  for (const path of freeze.componentPaths) assert.equal(await sha(path), freeze.componentSha256[path], path)
})

test('B6 pre-registers the primary and revision gates without authorizing later stages', () => {
  assert.deepEqual(freeze.relationCountByKind, { cancels: 2, supersedes: 2, amends: 2 })
  assert.equal(freeze.relationCount, 6)
  assert.equal(freeze.unresolvedRevisionScopeCount, 2)
  assert.deepEqual(freeze.oracleGate, {
    scoreableCases: 16,
    taskF1Minimum: 0.9,
    requiresActionAccuracyMinimum: 0.95,
    completeTaskCaseAccuracyMinimum: 0.8,
    forbiddenDefaultSelectionsMaximum: 0,
    relationExactAccuracyByKindMinimum: { cancels: 1, supersedes: 1, amends: 1 },
    supersededTaskExactAccuracyMinimum: 1,
    activeReplacementRecallMinimum: 1,
    staleTasksMaximum: 0,
    selectedStaleTasksMaximum: 0,
    unresolvedRevisionExactAccuracyMinimum: 1,
  })
  assert.equal(freeze.paidRunAuthorized, false)
  assert.equal(freeze.modelCalls, 0)
  assert.equal(freeze.networkDispatches, 0)
  assert.equal(freeze.secretAccess, 'NONE')
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'BLOCKED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})
