import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B3_DATA_FREEZE.json'), 'utf8'))
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')

test('B3 is frozen before its first P1 oracle run', () => {
  assert.equal(freeze.schemaVersion, 'rco-5-007-b3-data-freeze-1.0.0')
  assert.equal(freeze.status, 'DATA_EXPECTED_AND_P1_FROZEN_BEFORE_FIRST_ORACLE_RUN')
  assert.equal(freeze.seenStatusAtFreeze, 'UNSEEN_BY_P1_AT_FREEZE_AND_UNSEEN_BY_DEEPSEEK')
  assert.equal(freeze.sampleCount, 16)
  assert.match(freeze.firstRunPolicy, /Exactly one first oracle run/)
})

test('B3 freeze binds data, P1, evaluator and contract dependencies', async () => {
  assert.equal(freeze.componentPaths.length, 10)
  for (const path of freeze.componentPaths) assert.equal(await sha(path), freeze.componentSha256[path], path)
})

test('B3 gate and zero-call boundary are explicit', () => {
  assert.deepEqual(freeze.oracleGate, { scoreableCases: 16, taskF1Minimum: 0.9, requiresActionAccuracyMinimum: 0.95, completeTaskCaseAccuracyMinimum: 0.8, forbiddenDefaultSelectionsMaximum: 0 })
  assert.equal(freeze.paidRunAuthorized, false)
  assert.equal(freeze.modelCalls, 0)
  assert.equal(freeze.networkDispatches, 0)
  assert.equal(freeze.secretAccess, 'NONE')
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'BLOCKED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})
