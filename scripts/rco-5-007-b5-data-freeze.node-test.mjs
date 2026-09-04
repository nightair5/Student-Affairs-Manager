import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B5_DATA_FREEZE.json'), 'utf8'))
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')

test('B5 is frozen as unseen only after E1 passed and before its first P2 run', () => {
  assert.equal(freeze.schemaVersion, 'rco-5-007-b5-data-freeze-1.0.0')
  assert.equal(freeze.status, 'DATA_EXPECTED_E1_AND_P2_FROZEN_BEFORE_FIRST_RUN')
  assert.equal(freeze.seenStatusAtFreeze, 'UNSEEN_BY_P2_AT_FREEZE_AND_UNSEEN_BY_DEEPSEEK')
  assert.equal(freeze.sampleCount, 16)
  assert.match(freeze.firstRunPolicy, /Exactly one first P2 oracle run/)
})

test('B5 freeze binds new data, E1, P2, evaluator and contracts', async () => {
  assert.equal(freeze.componentPaths.length, 9)
  for (const path of freeze.componentPaths) assert.equal(await sha(path), freeze.componentSha256[path], path)
})

test('B5 pre-registers primary and revision gates without authorizing later stages', () => {
  assert.deepEqual(freeze.oracleGate, {
    scoreableCases: 16,
    taskF1Minimum: 0.9,
    requiresActionAccuracyMinimum: 0.95,
    completeTaskCaseAccuracyMinimum: 0.8,
    forbiddenDefaultSelectionsMaximum: 0,
    supersededTaskExactAccuracyMinimum: 1,
    activeReplacementRecallMinimum: 1,
    selectedStaleTasksMaximum: 0,
  })
  assert.equal(freeze.revisionCaseCount, 2)
  assert.equal(freeze.supersededDirectiveCount, 2)
  assert.equal(freeze.paidRunAuthorized, false)
  assert.equal(freeze.modelCalls, 0)
  assert.equal(freeze.networkDispatches, 0)
  assert.equal(freeze.secretAccess, 'NONE')
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'BLOCKED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})
