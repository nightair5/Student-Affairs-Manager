import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B7_DATA_FREEZE.json'), 'utf8'))
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')

test('B7 freezes twelve unseen model-selection cases with a perfect P3 oracle ceiling', () => {
  assert.equal(freeze.schemaVersion, 'rco-5-007-b7-data-freeze-1.0.0')
  assert.equal(freeze.status, 'DATA_CONTRACT_AND_P3_CEILING_FROZEN_AWAITING_EXPLICIT_PAID_AUTHORIZATION')
  assert.equal(freeze.seenStatusAtFreeze, 'UNSEEN_BY_DEEPSEEK_AT_FREEZE_P3_ORACLE_PREFLIGHT_ALLOWED')
  assert.equal(freeze.sampleCount, 12)
  assert.deepEqual(freeze.p3OraclePreflight, { cases: 12, validSelections: 12, contractValid: 12, completeTaskCases: 12, exactRevisionCases: 4, gate: 'PASS' })
})

test('B7 binds data, model-selection contract and the frozen P3 chain', async () => {
  assert.equal(freeze.componentPaths.length, 12)
  for (const path of freeze.componentPaths) assert.equal(await sha(path), freeze.componentSha256[path], path)
})

test('B7 locks the proposed run without authorizing any paid dispatch', () => {
  assert.deepEqual(freeze.proposedPaidRun, { model: 'deepseek-v4-flash-vision-exp', temperature: 0, thinking: 'none', candidateCalls: 12, maximumDispatches: 12, verifierCalls: 0, repairCalls: 0, retryCalls: 0, maximumRequestBytesPerCall: 32768, maximumOutputTokensPerCall: 3000, cnyHardCap: 10 })
  assert.equal(freeze.fixedQualityGate.strictSchemaValid, 12)
  assert.equal(freeze.fixedQualityGate.scopeMicroF1Minimum, 0.9)
  assert.equal(freeze.fixedQualityGate.completeTaskCaseMinimum, 0.8)
  assert.equal(freeze.fixedQualityGate.forbiddenDefaultSelectionsMaximum, 0)
  assert.equal(freeze.stopPolicy.retriesForbidden, true)
  assert.equal(freeze.paidRunAuthorized, false)
  assert.equal(freeze.runnerCreated, false)
  assert.equal(freeze.modelCalls, 0)
  assert.equal(freeze.networkDispatches, 0)
  assert.equal(freeze.secretAccess, 'NONE')
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'BLOCKED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})
