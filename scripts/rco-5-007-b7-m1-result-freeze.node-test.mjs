import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B7-M1_RESULT_FREEZE.json'), 'utf8'))
const sha = async (relativePath) => createHash('sha256').update(await readFile(resolve(root, relativePath))).digest('hex')

test('B7 M1 result artifacts are immutable and match the failed promotion decision', async () => {
  for (const relativePath of freeze.componentPaths) assert.equal(await sha(relativePath), freeze.componentSha256[relativePath], relativePath)
  assert.deepEqual(freeze.accounting, { candidateCalls: 12, terminalResponses: 12, strictSchemaValid: 12, verifierCalls: 0, repairCalls: 0, retryCalls: 0 })
  assert.equal(freeze.decision, 'NO_PROMOTION_PAID_REPLICATION_BLOCKED')
  assert.equal(freeze.providerBilledCny, 'NOT_OBSERVABLE')
  assert.ok(freeze.observedConservativePeakPriceCostCny < freeze.cnyHardCap)
  assert.equal(freeze.protectedArtifactsModified, false)
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'NOT_STARTED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})
