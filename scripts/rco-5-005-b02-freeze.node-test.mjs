import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { sha256 } from './rco-5-005-b01-lib.mjs'

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path.replaceAll('\\', '/'), root))
const freeze = JSON.parse(read('docs/recognition-optimization/RCO-5-005-B02_FREEZE.json').toString('utf8'))
const dataset = JSON.parse(read(freeze.datasetPath).toString('utf8'))

const boundFiles = [
  ['datasetPath', 'datasetSha256'],
  ['planPath', 'planSha256'],
  ['trackerPath', 'trackerSha256'],
  ['datasetValidatorPath', 'datasetValidatorSha256'],
  ['freezeValidatorPath', 'freezeValidatorSha256'],
  ['contractLibraryPath', 'contractLibrarySha256'],
  ['candidateManifestPath', 'candidateManifestSha256'],
]

test('B02 freeze binds every declared component byte-for-byte', () => {
  for (const [pathField, hashField] of boundFiles) {
    assert.equal(sha256(read(freeze[pathField])), freeze[hashField], pathField)
  }
})

test('B02 freeze counts match the frozen Expected labels', () => {
  const tasks = dataset.cases.flatMap((item) => item.expected.tasks)
  assert.equal(freeze.sampleCount, dataset.cases.length)
  assert.equal(freeze.semanticFamilyCount, new Set(dataset.cases.map((item) => item.semanticFamilyId)).size)
  assert.equal(freeze.negativeCaseCount, dataset.cases.filter((item) => !item.expected.requiresAction).length)
  assert.equal(freeze.expectedTaskCount, tasks.length)
  assert.equal(freeze.safeDefaultExpectedCount, tasks.filter((item) => item.shouldDefaultSelect).length)
  assert.equal(freeze.unsafeDefaultExpectedCount, tasks.filter((item) => !item.shouldDefaultSelect).length)
})

test('B02 freeze cannot be mistaken for paid-run authorization', () => {
  assert.equal(freeze.status, 'DATA_AND_PLAN_FROZEN_AWAITING_PAID_RUN_AUTHORIZATION')
  assert.equal(freeze.paidRunAuthorized, false)
  assert.equal(freeze.runnerCreated, false)
  assert.equal(freeze.runnerFrozen, false)
  assert.equal(freeze.modelCalls, 0)
  assert.equal(freeze.networkDispatches, 0)
  assert.equal(freeze.repairCalls, 0)
  assert.equal(freeze.secretAccess, 'NONE')
  assert.equal(freeze.nextGate, 'EXPLICIT_PAID_RUN_AUTHORIZATION_WITH_MODEL_CALL_COUNT_AND_CNY_CAP')
})

test('B02 proposed ceiling stays below the proposed CNY cap', () => {
  const peakInputUsdPerMillion = 0.44
  const peakOutputUsdPerMillion = 1.32
  const conservativeCnyPerUsd = 10
  const calculated = freeze.maximumModelCallsProposed
    * ((freeze.maxRequestBytesCandidate * peakInputUsdPerMillion / 1_000_000)
      + (freeze.maxOutputTokensCandidate * peakOutputUsdPerMillion / 1_000_000))
    * conservativeCnyPerUsd
  assert.equal(calculated, freeze.maximumTheoreticalCostCny)
  assert.ok(calculated < freeze.cnyCapProposed)
})

test('B02 freeze preserves the closed B0 run artifacts', () => {
  const protectedFiles = {
    'docs/recognition-optimization/RCO-5-005-B0_DEVELOPMENT_DATASET.json': 'f80abd495c3075e59055a17e0298c5393556e52b6fb3ba797638c5be19c94a99',
    'docs/recognition-optimization/RCO-5-005-B0_FREEZE.json': '8d40070fc25928c7cdd4e5e4f40d408b7785dee18a87ce0b398d848c4310b5af',
    'docs/recognition-optimization/rco-5-005-b0-runs/rco-5-005-b0-20260903a/checkpoint.json': 'e144e7e68ecb02e9273eb50bbe0afcb3e74524b966a7931f2bf6ee8b7b56dcce',
    'docs/recognition-optimization/rco-5-005-b0-runs/rco-5-005-b0-20260903a/result.json': 'cb822e1aee3fd0ca008100a0c8ad8858cdceac3886ad2c8275ecdac18aac78ab',
  }
  for (const [path, expected] of Object.entries(protectedFiles)) assert.equal(sha256(read(path)), expected, path)
})
