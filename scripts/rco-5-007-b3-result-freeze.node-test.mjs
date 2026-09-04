import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B3_RESULT_FREEZE.json'), 'utf8'))
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')

test('B3 result freeze binds the failed first-run evidence', async () => {
  assert.equal(freeze.schemaVersion, 'rco-5-007-b3-result-freeze-1.0.0')
  assert.equal(freeze.status, 'FIRST_RUN_FAILED_SEEN_DEVELOPMENT_NO_TUNING')
  assert.equal(freeze.componentPaths.length, 6)
  for (const path of freeze.componentPaths) assert.equal(await sha(path), freeze.componentSha256[path], path)
})

test('B3 result freeze blocks rerun, paid testing and release changes', () => {
  assert.equal(freeze.gate, 'FAIL')
  assert.equal(freeze.rerunAuthorized, false)
  assert.equal(freeze.paidRunAuthorized, false)
  assert.equal(freeze.accounting.modelCalls, 0)
  assert.equal(freeze.accounting.secretAccess, 'NONE')
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'BLOCKED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})
