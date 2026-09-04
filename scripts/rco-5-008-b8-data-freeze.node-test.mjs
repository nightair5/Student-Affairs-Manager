import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-008-B8_DATA_FREEZE.json'), 'utf8'))
const sha = async (relativePath) => createHash('sha256').update(await readFile(resolve(root, relativePath))).digest('hex')

test('B8 freezes twelve new unseen cases behind a perfect P4 ceiling', () => {
  assert.equal(freeze.schemaVersion, 'rco-5-008-b8-data-freeze-1.0.0')
  assert.equal(freeze.status, 'DATA_AND_P4_CEILING_FROZEN_AWAITING_SEPARATE_PAID_AUTHORIZATION')
  assert.equal(freeze.seenStatusAtFreeze, 'UNSEEN_BY_DEEPSEEK_AT_FREEZE_P4_ORACLE_PREFLIGHT_ALLOWED')
  assert.equal(freeze.sampleCount, 12)
  assert.deepEqual(freeze.p4OraclePreflight, { cases: 12, validSelections: 12, locallyComposable: 12, contractValid: 12, completeTaskCases: 12, unsafeDefaultFalsePositives: 0, exactRevisionCases: 4, gate: 'PASS' })
})

test('B8 binds its data and the frozen RCO-5-008 local chain', async () => {
  for (const relativePath of freeze.componentPaths) assert.equal(await sha(relativePath), freeze.componentSha256[relativePath], relativePath)
})

test('B8 has no paid authorization, runner, checkpoint or secret access', () => {
  assert.deepEqual(freeze.proposedPaidRun, { model: 'deepseek-v4-flash-vision-exp', temperature: 0, thinking: 'none', candidateCalls: 12, maximumDispatches: 12, verifierCalls: 0, repairCalls: 0, retryCalls: 0, cnyHardCap: 10 })
  assert.equal(freeze.fixedQualityGate.unsafeDefaultFalsePositivesMaximum, 0)
  assert.equal(freeze.paidRunAuthorized, false)
  assert.equal(freeze.runnerCreated, false)
  assert.equal(freeze.checkpointCreated, false)
  assert.equal(freeze.modelCalls, 0)
  assert.equal(freeze.networkDispatches, 0)
  assert.equal(freeze.secretAccess, 'NONE')
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'NOT_STARTED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})
