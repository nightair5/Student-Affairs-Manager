import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freezePath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B2_FREEZE.json')
const freeze = JSON.parse(await readFile(freezePath, 'utf8'))
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')

test('B2 freeze has a zero-call post-policy challenge identity', () => {
  assert.equal(freeze.schemaVersion, 'rco-5-007-b2-freeze-1.0.0')
  assert.equal(freeze.sampleCount, 16)
  assert.equal(freeze.expectedDirectiveCount, 27)
  assert.equal(freeze.paidRunAuthorized, false)
  assert.equal(freeze.modelCalls, 0)
  assert.equal(freeze.networkDispatches, 0)
  assert.equal(freeze.secretAccess, 'NONE')
})

test('B2 freeze binds data, policy, evaluator and transitive contract dependencies', async () => {
  assert.equal(freeze.componentPaths.length, 12)
  for (const path of freeze.componentPaths) assert.equal(await sha(path), freeze.componentSha256[path], path)
})

test('B2 freeze does not authorize paid calls, RCO-6 or deployment', () => {
  assert.equal(freeze.maximumModelCallsProposed, 32)
  assert.equal(freeze.cnyCapProposed, 'REQUIRES_USER_VALUE')
  assert.equal(freeze.networkRunnerCreated, false)
  assert.equal(freeze.rco6, 'BLOCKED')
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})

