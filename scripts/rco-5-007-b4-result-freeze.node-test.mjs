import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B4_RESULT_FREEZE.json'), 'utf8'))
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')

test('B4 result freeze binds the passed first-run evidence', async () => {
  assert.equal(freeze.schemaVersion, 'rco-5-007-b4-result-freeze-1.0.0')
  assert.equal(freeze.status, 'ORACLE_QUALITY_PASS_ENGINEERING_GATE_FAIL_NOW_SEEN_DEVELOPMENT')
  assert.equal(freeze.componentPaths.length, 7)
  for (const path of freeze.componentPaths) assert.equal(await sha(path), freeze.componentSha256[path], path)
})

test('B4 quality pass is blocked by the frozen engineering failure', () => {
  assert.equal(freeze.oracleQualityGate, 'PASS')
  assert.equal(freeze.engineeringGate, 'FAIL_TS2352_FROZEN_B4_DATASET_TEST')
  assert.equal(freeze.overallGate, 'FAIL')
  assert.equal(freeze.decision, 'INVALID_FOR_PAID_PROMOTION_ENGINEERING_GATE_FAIL')
  assert.equal(freeze.rerunAuthorized, false)
  assert.equal(freeze.paidRunAuthorized, false)
  assert.equal(freeze.accounting.modelCalls, 0)
  assert.equal(freeze.accounting.secretAccess, 'NONE')
  assert.match(freeze.knownLimitation, /revision-specific quality/)
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'BLOCKED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})
