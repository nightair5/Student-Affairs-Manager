import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-009A_COMPONENT_FREEZE.json'), 'utf8'))
const sha = async (relativePath) => createHash('sha256').update(await readFile(resolve(root, relativePath))).digest('hex')

test('RCO-5-009A freezes direct candidate materialization and its evidence boundary', async () => {
  for (const relativePath of freeze.componentPaths) {
    assert.equal(await sha(relativePath), freeze.componentSha256[relativePath], relativePath)
  }
  assert.equal(freeze.adversarialGate, 'PASS_49_OF_49_PLUS_INDEPENDENT_REVIEW')
  assert.equal(freeze.b8SeenArchitectureGate, 'PASS_WITH_FROZEN_HISTORICAL_LABEL_CONFLICT')
  assert.deepEqual(freeze.frozenHistoricalLabelConflicts, ['rco-task-b8-12'])
  assert.equal(freeze.b8TaskF1, 1)
  assert.equal(freeze.b8ExactTaskBoundaryAccuracy, 1)
  assert.equal(freeze.b8CompleteTaskCaseAccuracy, 11 / 12)
  assert.equal(freeze.frozenLegacyModelCandidateF1, 0.9)
  assert.deepEqual(freeze.accounting, {
    modelCalls: 0,
    networkRequests: 0,
    verifierCalls: 0,
    repairCalls: 0,
    retryCalls: 0,
    secretAccess: 'NONE',
  })
  assert.equal(freeze.oldB8DecisionPreserved, 'NO_PROMOTION_PAID_REPLICATION_BLOCKED')
  assert.equal(freeze.nextGate, 'CREATE_AND_FREEZE_NEW_B9_WITH_REAL_NEEDS_MODEL_ZERO_CALL_ONLY')
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'NOT_STARTED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})
