import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B7-M1_RUNNER_FREEZE.json'), 'utf8'))
const sha = async (relativePath) => createHash('sha256').update(await readFile(resolve(root, relativePath))).digest('hex')

test('B7 M1 freezes the exact paid authorization and conservative budget', () => {
  assert.equal(freeze.authorizationId, 'RCO-5-007-B7-M1')
  assert.equal(freeze.model, 'deepseek-v4-flash-vision-exp')
  assert.equal(freeze.temperature, 0)
  assert.equal(freeze.thinking, 'none')
  assert.equal(freeze.candidateCalls, 12)
  assert.equal(freeze.maximumDispatches, 12)
  assert.equal(freeze.verifierCalls, 0)
  assert.equal(freeze.repairCalls, 0)
  assert.equal(freeze.retryCalls, 0)
  assert.equal(freeze.cnyHardCap, 10)
  assert.ok(freeze.maximumTheoreticalCostCny < freeze.cnyHardCap)
})

test('B7 M1 runner and pristine one-shot state match the freeze', async () => {
  for (const relativePath of freeze.componentPaths) assert.equal(await sha(relativePath), freeze.componentSha256[relativePath], relativePath)
  assert.equal(await sha('docs/recognition-optimization/rco-5-007-b7-runs/rco-5-007-b7-m1-20260904a/checkpoint.json'), freeze.initialCheckpointSha256)
  const checkpoint = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/rco-5-007-b7-runs/rco-5-007-b7-m1-20260904a/checkpoint.json'), 'utf8'))
  const raw = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/rco-5-007-b7-runs/rco-5-007-b7-m1-20260904a/raw-results.json'), 'utf8'))
  assert.equal(checkpoint.status, 'READY_FROZEN_NO_DISPATCH')
  assert.deepEqual(checkpoint.dispatches, [])
  assert.deepEqual(raw.records, [])
})

test('B7 M1 freeze keeps provider cost unobserved and release paths blocked', () => {
  assert.equal(freeze.providerBilledCny, 'NOT_OBSERVABLE')
  assert.equal(freeze.modelCallsAtFreeze, 0)
  assert.equal(freeze.networkDispatchesAtFreeze, 0)
  assert.equal(freeze.secretAccessAtFreeze, 'NONE')
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'NOT_STARTED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})
