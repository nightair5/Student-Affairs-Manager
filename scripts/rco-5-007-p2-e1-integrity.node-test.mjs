import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-P2-E1_COMPONENT_FREEZE.json'), 'utf8'))
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')

test('E1 freeze binds the one authorized type correction and its seen B4 replay', async () => {
  assert.equal(freeze.schemaVersion, 'rco-5-007-p2-e1-component-freeze-1.0.0')
  assert.equal(freeze.componentPaths.length, 12)
  for (const path of freeze.componentPaths) assert.equal(await sha(path), freeze.componentSha256[path], path)
})

test('E1 correction is runtime-equivalent and B4 results are exactly reproduced', () => {
  assert.equal(freeze.correction.runtimeEquivalent, true)
  assert.equal(freeze.correction.frozenDriftCount, 1)
  assert.equal(freeze.correction.beforeJavaScriptSha256, freeze.correction.afterJavaScriptSha256)
  assert.equal(freeze.replay.replayCasesEqual, true)
  assert.equal(freeze.replay.metricsEqual, true)
})

test('E1 engineering gate passed without a model, network, secret or release mutation', () => {
  assert.deepEqual(freeze.engineeringGate, {
    lint: 'PASS',
    test: 'PASS_573_PLUS_1_LIVE_OCR_SKIPPED',
    build: 'PASS_WITH_EXISTING_CHUNK_WARNING',
    securityScan: 'PASS_486_FILES',
  })
  assert.deepEqual(freeze.accounting, {
    modelCalls: 0,
    networkRequests: 0,
    repairCalls: 0,
    retryCalls: 0,
    secretAccess: 'NONE',
  })
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'NOT_STARTED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})
