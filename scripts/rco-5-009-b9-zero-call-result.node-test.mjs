import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const datasetId = 'rco-5-009-b9-development-20260904'
const runId = 'rco-5-009-b9-zero-call-20260904a'
const dataFreezeCommit = '98123829e763b804eb6ed8669c7f0e483aed49dd'
const runDirectory = `docs/recognition-optimization/rco-5-009-b9-runs/${runId}`
const checkpointPath = `${runDirectory}/checkpoint.json`
const resultPath = `${runDirectory}/result.json`
const reportPath = `${runDirectory}/REPORT.md`
const runnerFreezePath = 'docs/recognition-optimization/RCO-5-009-B9_ZERO_CALL_RUNNER_FREEZE.json'
const exactAccounting = {
  modelCalls: 0,
  networkRequests: 0,
  verifierCalls: 0,
  repairCalls: 0,
  retryCalls: 0,
  secretAccess: 'NONE',
  pipelineRuns: 1,
  casePipelineExecutions: 12,
}
const readJson = async (relativePath) => JSON.parse(await readFile(resolve(root, relativePath), 'utf8'))
const checkpoint = await readJson(checkpointPath)
const result = await readJson(resultPath)
const runnerFreeze = await readJson(runnerFreezePath)

test('B9 one-shot output is complete and bound to the frozen pushed runner commit', () => {
  assert.equal(checkpoint.schemaVersion, 'rco-5-009-b9-zero-call-checkpoint-1.0.0')
  assert.equal(result.schemaVersion, 'rco-5-009-b9-zero-call-result-1.0.0')
  assert.equal(checkpoint.datasetId, datasetId)
  assert.equal(result.datasetId, datasetId)
  assert.equal(checkpoint.runId, runId)
  assert.equal(result.runId, runId)
  assert.equal(checkpoint.status, 'COMPLETED')
  assert.equal(result.status, 'COMPLETED')
  assert.equal(checkpoint.dataFreezeCommit, dataFreezeCommit)
  assert.equal(result.dataFreezeCommit, dataFreezeCommit)
  assert.match(checkpoint.runnerFreezeCommit, /^[0-9a-f]{40}$/u)
  assert.equal(result.runnerFreezeCommit, checkpoint.runnerFreezeCommit)
  assert.deepEqual(checkpoint.accounting, exactAccounting)
  assert.deepEqual(result.accounting, exactAccounting)
  assert.equal(checkpoint.completedCaseCount, 12)
  assert.equal(checkpoint.completedCaseIds.length, 12)
  assert.equal(checkpoint.resultPath, resultPath)
  assert.equal(checkpoint.reportPath, reportPath)
})

test('B9 result passes every frozen gate and every additional fail-closed invariant', () => {
  assert.equal(result.gate, 'PASS')
  assert.equal(result.evaluation.gate, 'PASS')
  assert.deepEqual(result.gateFailures, [])
  assert.deepEqual(result.evaluation.gateFailures, [])
  assert.deepEqual(result.metrics, result.evaluation.metrics)
  assert.deepEqual(result.counts, result.evaluation.counts)
  for (const [name, minimum] of Object.entries(runnerFreeze.fixedZeroCallGate)) {
    if (name === 'unsafeDefaultSelectionsMaximum') {
      assert.ok(result.metrics.unsafeDefaultSelections <= minimum, name)
    } else {
      assert.ok(result.metrics[name] >= minimum, name)
    }
  }
  for (const name of [
    'caseIdentityExact',
    'sourceFingerprintExact',
    'candidatePolicyVersionExact',
    'candidateDispositionExact',
    'inputFixtureTransportExact',
    'expectedIssueCodesExact',
    'materializerValidationExact',
    'unresolvedActionScopeExact',
    'outOfVocabularyUnresolvedActionExact',
    'conditionUnknownExact',
  ]) assert.equal(result.metrics[name], 1, name)
  assert.equal(result.metrics.extraDefaultSelections, 0)
  assert.equal(result.evaluation.cases.length, 12)
  assert.equal(result.evaluation.cases.every((item) => item.passed), true)
})

test('B9 exact counts preserve the candidate ledger and task bijection', () => {
  assert.equal(result.counts.expectedCases, 12)
  assert.equal(result.counts.actualCases, 12)
  assert.equal(result.counts.expectedCandidates, 19)
  assert.equal(result.counts.actualCandidates, 19)
  assert.deepEqual(result.counts.expectedLedger, {
    accepted_local: 11,
    accepted_model: 2,
    ignored_local: 1,
    ignored_model: 2,
    quarantined: 3,
  })
  assert.deepEqual(result.counts.actualLedger, result.counts.expectedLedger)
  assert.equal(result.counts.expectedTasks, 13)
  assert.equal(result.counts.actualTasks, 13)
  assert.equal(result.counts.expectedSelectedTasks, 7)
  assert.equal(result.counts.actualSelectedTasks, 7)
  assert.equal(result.counts.expectedRevisionRelations, 1)
  assert.equal(result.counts.actualRevisionRelations, 1)
  assert.equal(result.counts.expectedIssueCodes, 1)
  assert.equal(result.counts.actualIssueCodes, 1)
})

test('B9 preserves the expected bad-object issue and its legal sibling', () => {
  const item = result.cases.find((entry) => entry.caseId === 'rco-task-b9-06')
  assert.ok(item)
  assert.deepEqual(item.issueCodes, ['OBJECT_CANDIDATE_INVALID'])
  assert.equal(item.responseContractComplete, false)
  assert.equal(item.semanticCoverageComplete, false)
  assert.deepEqual(item.tasks.map((task) => task.candidateKey), ['b9-06-prepare'])
  assert.equal(item.ledger.find((entry) => entry.candidateKey === 'b9-06-prepare')?.status, 'accepted_local')
  assert.equal(item.ledger.find((entry) => entry.candidateKey === 'b9-06-review')?.status, 'quarantined')
})

test('B9 scores the positive amendment without a surface-based task lookup', () => {
  const item = result.cases.find((entry) => entry.caseId === 'rco-task-b9-08')
  assert.ok(item)
  assert.deepEqual(item.revisionRelations.map(({ referentType, ...relation }) => relation), [{
    kind: 'amends',
    targetCandidateKey: 'b9-08-send-east',
    replacementCandidateKeys: ['b9-08-upload-west'],
    evidenceScopeTexts: ['旧规则要求发送东组路线表。', '该规则调整为上传西组值守表。'],
    resolution: 'adjacent_unique_referent',
  }])
  assert.equal(item.tasks.find((task) => task.candidateKey === 'b9-08-send-east')?.semantics.validity, 'superseded')
  assert.equal(item.tasks.find((task) => task.candidateKey === 'b9-08-save-today')?.selected, true)
})

test('B9 derives the OOV and unknown-condition checks from frozen coverage tags', () => {
  const oov = result.cases.find((entry) => entry.caseId === 'rco-task-b9-09')
  assert.ok(oov)
  assert.deepEqual(oov.candidates, [])
  assert.deepEqual(oov.unresolvedActionScopeTexts, ['请抄录会场温度。'])
  assert.equal(oov.requiresAction, null)
  const condition = result.cases.find((entry) => entry.caseId === 'rco-task-b9-12')
  assert.ok(condition)
  assert.equal(condition.candidates[0].conditionStatus, 'no_match')
  assert.equal(condition.candidates[0].conditionTruth, 'unknown')
  assert.equal(condition.tasks[0].conditionStatus, 'no_match')
  assert.equal(condition.tasks[0].conditionTruth, 'unknown')
  assert.equal(condition.tasks[0].selected, false)
  assert.equal(condition.requiresAction, null)
})

test('B9 result keeps the declared evidence and release boundaries', async () => {
  assert.equal(result.classification, 'FIRST_RUN_B9_ZERO_CALL_NOW_SEEN_DEVELOPMENT')
  assert.equal(result.responseAuthority, 'FROZEN_LOCAL_CLOSED_SET_FIXTURES')
  assert.equal(result.multipleObjectChoiceStatus, 'NOT_EXPRESSIBLE_BY_POLICY_1.2.0')
  assert.equal(result.paidRun, 'NOT_AUTHORIZED')
  assert.equal(result.stablePath, 'UNCHANGED')
  assert.equal(result.rco6, 'NOT_STARTED')
  assert.equal(result.deployment, 'NOT_RUN')
  assert.match(result.evidenceBoundary.data, /synthetic Development/i)
  assert.match(result.evidenceBoundary.response, /not a model measurement/i)
  assert.deepEqual(result.knownLabelLimitations.map((item) => item.caseId), ['rco-task-b9-12'])
  assert.match(result.knownLabelLimitations[0].code, /NOT_INDEPENDENT_SEMANTIC_TRUTH/)
  const report = await readFile(resolve(root, reportPath), 'utf8')
  assert.match(report, /模型 0、网络 0/)
  assert.match(report, /B9 自本次批次尝试开始即为已见/)
  assert.match(report, /不得把该项满分说成语义正确率/)
})
