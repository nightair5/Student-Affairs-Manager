import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const freezePath = new URL('../docs/recognition-optimization/RCO-5-006-B1_FREEZE.json', import.meta.url)
const datasetPath = new URL('../docs/recognition-optimization/RCO-5-006-B1_DEVELOPMENT_DATASET.json', import.meta.url)
const priorB02Path = new URL('../docs/recognition-optimization/RCO-5-005-B02_DEVELOPMENT_DATASET.json', import.meta.url)
const freeze = JSON.parse(readFileSync(freezePath, 'utf8'))
const dataset = JSON.parse(readFileSync(datasetPath, 'utf8'))

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function readProjectFile(path) {
  return readFileSync(new URL(path.replaceAll('\\', '/'), root))
}

test('B1 freeze has the fixed zero-call Development identity', () => {
  assert.equal(freeze.schemaVersion, 'rco-5-006-b1-freeze-1.0.0')
  assert.equal(freeze.status, 'DATA_AND_PLAN_FROZEN_AWAITING_EXPLICIT_PAID_PARAMETERS')
  assert.equal(freeze.datasetId, dataset.datasetId)
  assert.equal(freeze.sampleCount, 12)
  assert.equal(freeze.semanticFamilyCount, 12)
  assert.equal(freeze.scopeIndexVersion, 'scope-index-1.1')
  assert.equal(freeze.contractSchemaVersion, 'scope-reference-candidate-1.0')
  assert.equal(freeze.paidRunAuthorized, false)
  assert.equal(freeze.modelCalls, 0)
  assert.equal(freeze.networkDispatches, 0)
  assert.equal(freeze.secretAccess, 'NONE')
})

test('B1 freeze binds every declared component byte-for-byte', () => {
  for (const [path, expected] of Object.entries(freeze.componentSha256)) {
    assert.equal(sha256(readProjectFile(path)), expected, path)
  }
})

test('B1 freeze counts match the frozen Expected labels', () => {
  const directives = dataset.cases.flatMap((item) => item.expected.directives)
  const observations = dataset.cases.flatMap((item) => item.expected.observations)
  assert.equal(dataset.cases.filter((item) => !item.expected.requiresAction).length, freeze.negativeCaseCount)
  assert.equal(directives.length, freeze.expectedDirectiveCount)
  assert.equal(observations.length, freeze.expectedObservationCount)
  assert.equal(directives.filter((item) => item.expectedDefaultSelected).length, freeze.safeDefaultExpectedCount)
  assert.equal(directives.filter((item) => !item.expectedDefaultSelected).length, freeze.nonDefaultDirectiveCount)
})

test('B1 does not reuse or mutate the frozen B02 dataset bytes', () => {
  const priorBytes = readFileSync(priorB02Path)
  assert.equal(sha256(priorBytes), 'e58f73a519e5763ed3ed9100af215a8b2cc5af5d0688e4ea6a631336dc862c85')
  const prior = JSON.parse(priorBytes.toString('utf8'))
  const oldSources = new Set(prior.cases.map((item) => item.sourceText))
  const oldFamilies = new Set(prior.cases.map((item) => item.semanticFamilyId))
  assert.equal(dataset.cases.some((item) => oldSources.has(item.sourceText)), false)
  assert.equal(dataset.cases.some((item) => oldFamilies.has(item.semanticFamilyId)), false)
})

test('freeze cannot be mistaken for paid-run, RCO-6 or deployment authorization', () => {
  assert.equal(freeze.runnerCreated, false)
  assert.equal(freeze.runnerFrozen, false)
  assert.equal(freeze.maximumModelCallsProposed, 24)
  assert.equal(freeze.cnyCapProposed, 'REQUIRES_USER_VALUE')
  assert.equal(freeze.rco6, 'BLOCKED')
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.deployment, 'NOT_RUN')
  assert.match(freeze.nextGate, /MODEL.*CALL.*CNY/u)
})

test('dataset and freeze resolve inside the intended repository', () => {
  const rootPath = fileURLToPath(root)
  assert.ok(fileURLToPath(datasetPath).startsWith(rootPath))
  assert.ok(fileURLToPath(freezePath).startsWith(rootPath))
})
