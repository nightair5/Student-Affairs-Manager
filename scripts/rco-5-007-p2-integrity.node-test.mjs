import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-P2_COMPONENT_FREEZE.json'), 'utf8'))
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')

test('P2 freeze binds the implementation, seen B3 replay and protected dependencies', async () => {
  assert.equal(freeze.schemaVersion, 'rco-5-007-p2-component-freeze-1.0.0')
  assert.equal(freeze.policyVersion, 'task-formation-policy-2.2.0-p2')
  assert.equal(freeze.componentPaths.length, 14)
  for (const path of freeze.componentPaths) assert.equal(await sha(path), freeze.componentSha256[path], path)
})

test('P2 seen B3 regression clears every fixed metric without weakening safety', () => {
  for (const key of ['taskPrecision', 'taskRecall', 'taskF1', 'requiresActionAccuracy', 'semanticFieldAccuracy', 'exactTaskBoundaryAccuracy', 'completeTaskCaseAccuracy', 'safeDefaultRecall']) assert.equal(freeze.p2Metrics[key], 1, key)
  assert.equal(freeze.p2Metrics.majorCorrectionRate, 0)
  assert.equal(freeze.p2Metrics.forbiddenDefaultSelections, 0)
  assert.equal(freeze.gate, 'PASS')
})

test('P2 remains zero-call, isolated and limited to a new B4 gate', () => {
  assert.deepEqual(freeze.accounting, { modelCalls: 0, networkRequests: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE' })
  assert.match(freeze.interpretation, /not model accuracy/i)
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'NOT_STARTED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})
