import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const result = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/rco-5-009-b8-replay/result.json'), 'utf8'))

test('RCO-5-009 keeps frozen B8 model diagnostics separate from local salvage', () => {
  assert.equal(result.classification, 'SEEN_B8_ZERO_CALL_ORACLE_AND_LEGACY_SALVAGE_NOT_MODEL_REPLICATION')
  assert.equal(result.gate, 'PASS')
  assert.equal(result.originalB8DecisionPreserved, 'NO_PROMOTION_PAID_REPLICATION_BLOCKED')
  assert.deepEqual(result.accounting, {
    modelCalls: 0,
    networkRequests: 0,
    verifierCalls: 0,
    repairCalls: 0,
    retryCalls: 0,
    secretAccess: 'NONE',
  })
  assert.equal(result.frozenLegacyClassifierDiagnostics.precision, 0.9)
  assert.equal(result.frozenLegacyClassifierDiagnostics.recall, 0.9)
  assert.equal(result.frozenLegacyClassifierDiagnostics.rawExpectedMisses, 2)
  assert.equal(result.frozenLegacyClassifierDiagnostics.rawExtraDirectives, 2)
  assert.equal(result.candidateLedgerMetrics.modelMissesRecoveredLocally, 2)
  assert.equal(result.candidateLedgerMetrics.legacyLegalSiblingCollateralLoss, 0)
  assert.equal(result.oracleMetrics.task.taskF1, 1)
  assert.equal(result.oracleMetrics.task.completeTaskCaseAccuracy, 1)
  assert.equal(result.legacyProductMetrics.task.taskF1, 1)
  assert.equal(result.legacyProductMetrics.task.completeTaskCaseAccuracy, 1)
  assert.equal(result.legacyProductMetrics.unsafeDefaultFalsePositives, 0)
  assert.equal(result.stablePath, 'UNCHANGED')
  assert.equal(result.rco6, 'NOT_STARTED')
  assert.equal(result.deployment, 'NOT_RUN')
})
