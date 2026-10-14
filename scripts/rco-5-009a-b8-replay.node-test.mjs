import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const result = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/rco-5-009a-b8-replay/result.json'), 'utf8'))

test('RCO-5-009A V2 keeps B8 model diagnostics separate from local recovery', () => {
  assert.equal(result.classification, 'SEEN_B8_DIRECT_CANDIDATE_MATERIALIZATION_ZERO_CALL_NOT_MODEL_REPLICATION')
  assert.equal(result.gate, 'PASS')
  assert.equal(result.originalB8DecisionPreserved, 'NO_PROMOTION_PAID_REPLICATION_BLOCKED')
  assert.deepEqual(result.protectedInputFreezes, [
    'docs/recognition-optimization/RCO-5-008-B8_DATA_FREEZE.json',
    'docs/recognition-optimization/RCO-5-008-B8-M1_RESULT_FREEZE.json',
    'docs/recognition-optimization/RCO-5-009_COMPONENT_FREEZE.json',
  ])
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
  assert.equal(result.oracleMetrics.task.exactTaskBoundaryAccuracy, 1)
  assert.equal(result.oracleMetrics.task.completeTaskCaseAccuracy, 11 / 12)
  assert.equal(result.legacyProductMetrics.task.taskF1, 1)
  assert.equal(result.legacyProductMetrics.task.exactTaskBoundaryAccuracy, 1)
  assert.equal(result.legacyProductMetrics.task.completeTaskCaseAccuracy, 11 / 12)
  assert.equal(result.legacyProductMetrics.unsafeDefaultFalsePositives, 0)
  assert.deepEqual(result.frozenHistoricalLabelConflicts, ['rco-task-b8-12'])
  assert.equal(result.stablePath, 'UNCHANGED')
  assert.equal(result.rco6, 'NOT_STARTED')
  assert.equal(result.deployment, 'NOT_RUN')
})
