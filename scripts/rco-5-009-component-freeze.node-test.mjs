import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-009_COMPONENT_FREEZE.json'), 'utf8'))
const sha = async (relativePath) => createHash('sha256').update(await readFile(resolve(root, relativePath))).digest('hex')

test('RCO-5-009 freezes the candidate ledger and seen B8 evidence boundary', async () => {
  for (const relativePath of freeze.componentPaths) {
    assert.equal(await sha(relativePath), freeze.componentSha256[relativePath], relativePath)
  }
  assert.equal(freeze.b8SeenArchitectureGate, 'PASS')
  assert.equal(freeze.frozenLegacyModelCandidateF1, 0.9)
  assert.equal(freeze.legacyProductSalvageTaskF1, 1)
  assert.deepEqual(freeze.accounting, {
    modelCalls: 0,
    networkRequests: 0,
    verifierCalls: 0,
    repairCalls: 0,
    retryCalls: 0,
    secretAccess: 'NONE',
  })
  assert.equal(freeze.oldB8DecisionPreserved, 'NO_PROMOTION_PAID_REPLICATION_BLOCKED')
  assert.equal(freeze.nextGate, 'CREATE_AND_FREEZE_NEW_B9_ZERO_CALL_ORACLE_ONLY')
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'NOT_STARTED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})
