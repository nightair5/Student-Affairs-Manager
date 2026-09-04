import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-008_COMPONENT_FREEZE.json'), 'utf8'))
const sha = async (relativePath) => createHash('sha256').update(await readFile(resolve(root, relativePath))).digest('hex')

test('RCO-5-008 freezes the zero-call local repair and seen B7 result', async () => {
  for (const relativePath of freeze.componentPaths) assert.equal(await sha(relativePath), freeze.componentSha256[relativePath], relativePath)
  assert.equal(freeze.b7ReplayGate, 'PASS')
  assert.deepEqual(freeze.accounting, { modelCalls: 0, networkRequests: 0, verifierCalls: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE' })
  assert.equal(freeze.oldB7DecisionPreserved, 'NO_PROMOTION_PAID_REPLICATION_BLOCKED')
  assert.equal(freeze.nextGate, 'CREATE_AND_FREEZE_NEW_B8_WITHOUT_MODEL_CALLS')
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'NOT_STARTED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})
