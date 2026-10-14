import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-P3_COMPONENT_FREEZE.json'), 'utf8'))
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')

test('P3 freeze binds resolver, policy, seen B5 replay and protected dependencies', async () => {
  assert.equal(freeze.schemaVersion, 'rco-5-007-p3-component-freeze-1.0.0')
  assert.equal(freeze.policyVersion, 'task-formation-policy-2.3.0-p3')
  assert.equal(freeze.resolverVersion, 'revision-relation-resolver-1.0.0')
  assert.equal(freeze.componentPaths.length, 16)
  for (const path of freeze.componentPaths) assert.equal(await sha(path), freeze.componentSha256[path], path)
})

test('P3 seen B5 regression clears all task and revision gates', () => {
  for (const key of ['taskPrecision', 'taskRecall', 'taskF1', 'requiresActionAccuracy', 'semanticFieldAccuracy', 'exactTaskBoundaryAccuracy', 'completeTaskCaseAccuracy', 'safeDefaultRecall']) assert.equal(freeze.p3Metrics[key], 1, key)
  assert.equal(freeze.p3Metrics.majorCorrectionRate, 0)
  assert.equal(freeze.p3Metrics.forbiddenDefaultSelections, 0)
  assert.equal(freeze.revisionMetrics.supersededTaskExactAccuracy, 1)
  assert.equal(freeze.revisionMetrics.activeReplacementRecall, 1)
  assert.equal(freeze.revisionMetrics.staleTaskCount, 0)
  assert.equal(freeze.revisionMetrics.selectedStaleTaskCount, 0)
  assert.equal(freeze.gate, 'PASS')
})

test('P3 remains zero-call, isolated and limited to a new B6 gate', () => {
  assert.deepEqual(freeze.accounting, { modelCalls: 0, networkRequests: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE' })
  assert.match(freeze.interpretation, /not model accuracy/i)
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'NOT_STARTED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})
