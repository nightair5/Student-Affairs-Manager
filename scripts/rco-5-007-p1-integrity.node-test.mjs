import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-P1_COMPONENT_FREEZE.json'), 'utf8'))
const result = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/rco-5-007-p1-b2-replay/result.json'), 'utf8'))
const b2Freeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B2_FREEZE.json'), 'utf8'))
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')

test('P1 freeze binds every declared component while preserving B2 freeze', async () => {
  assert.equal(freeze.componentPaths.length, 16)
  for (const path of freeze.componentPaths) assert.equal(await sha(path), freeze.componentSha256[path], path)
  for (const path of b2Freeze.componentPaths) assert.equal(await sha(path), b2Freeze.componentSha256[path], `B2:${path}`)
})

test('P1 replay is zero-call, seen-development evidence only', () => {
  assert.equal(result.classification, 'SEEN_B2_DEVELOPMENT_DIAGNOSTIC_REPLAY')
  assert.deepEqual(result.accounting, {
    modelCalls: 0, networkRequests: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE',
  })
  assert.match(result.interpretation, /neither model accuracy nor unseen generalization/i)
})

test('P1 clears every preregistered seen-B2 repair metric without weakening safety', () => {
  assert.deepEqual(result.p1Metrics, {
    caseCount: 16,
    scoreableCases: 16,
    taskPrecision: 1,
    taskRecall: 1,
    taskF1: 1,
    requiresActionAccuracy: 1,
    semanticFieldAccuracy: 1,
    exactTaskBoundaryAccuracy: 1,
    completeTaskCaseAccuracy: 1,
    majorCorrectionRate: 0,
    safeDefaultRecall: 1,
    forbiddenDefaultSelections: 0,
  })
  assert.equal(result.gate, 'PASS')
  assert.equal(result.decision, 'KNOWN_B2_FAILURES_REPAIRED_ELIGIBLE_FOR_NEW_B3_ZERO_CALL_GATE')
})

test('P1 remains isolated from stable paths and later stages', () => {
  assert.equal(freeze.protectedMutation, 'NONE')
  assert.equal(result.stablePath, 'UNCHANGED')
  assert.equal(result.rco6, 'NOT_STARTED')
  assert.equal(result.deployment, 'NOT_RUN')
  assert.equal(freeze.nextAuthorization, 'NEW_B3_DATA_AND_ZERO_CALL_ORACLE_GATE_ONLY')
})
