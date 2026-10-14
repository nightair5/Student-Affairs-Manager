import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { sha256File, verifyRco5007Freeze } from './rco-5-007-integrity.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'))

test('RCO-5-007 source-only input cannot expose Expected', async () => {
  const path = 'docs/recognition-optimization/rco-5-007-replay/b1-source-input.json'
  const text = await readFile(resolve(root, path), 'utf8')
  const input = JSON.parse(text)
  assert.equal(input.containsExpected, false)
  assert.equal(input.cases.length, 12)
  assert.equal(text.includes('"expected"'), false)
})

test('RCO-5-007 prediction and scoring dependency graphs are hash bound', async () => {
  const prediction = await verifyRco5007Freeze(root, 'prediction')
  const scoring = await verifyRco5007Freeze(root, 'scoring')
  assert.ok(prediction.verifiedPaths.length >= 10)
  assert.ok(scoring.verifiedPaths.length >= 9)
  const freeze = prediction.freeze
  for (const path of [...freeze.predictionDependencyPaths, ...freeze.scoringDependencyPaths, ...freeze.protectedArtifactPaths]) {
    assert.equal(await sha256File(resolve(root, path)), freeze.sha256[path], path)
  }
})

test('RCO-5-007 replay made no model, network, repair, retry, or secret access', async () => {
  const predictions = await readJson('docs/recognition-optimization/rco-5-007-replay/predictions.json')
  assert.deepEqual(predictions.accounting, {
    modelCalls: 0,
    networkRequests: 0,
    repairCalls: 0,
    retryCalls: 0,
    secretAccess: 'NONE',
  })
  assert.equal(predictions.cases.length, 12)
  assert.equal(predictions.cases.every((item) => item.validation.valid), true)
  assert.equal(predictions.cases.every((item) => item.result.modelAuthorityFieldsUsed.length === 0), true)
  const runnerText = await readFile(resolve(root, 'scripts/run-rco-5-007-replay.ts'), 'utf8')
  assert.doesNotMatch(runnerText, /\bfetch\s*\(/u)
  assert.doesNotMatch(runnerText, /DEEPSEEK_API_KEY|authorization:\s*bearer/iu)
})

test('RCO-5-007 safety gate remains fail closed', async () => {
  const result = await readJson('docs/recognition-optimization/rco-5-007-replay/result.json')
  assert.equal(result.classification, 'SEEN_DIAGNOSTIC_REPLAY')
  assert.equal(result.metrics.contractValidCases, 12)
  assert.equal(result.metrics.forbiddenDefaultSelections, 0)
  assert.equal(result.metrics.requiresActionAccuracy, 1)
  assert.equal(result.decision, 'ELIGIBLE_FOR_NEW_UNSEEN_VALIDATION_ONLY')
  assert.equal(result.protectedArtifactsModified, false)
  assert.equal(result.stablePath, 'UNCHANGED')
  assert.equal(result.rco6, 'NOT_STARTED')
  assert.equal(result.deployment, 'NOT_RUN')
})

