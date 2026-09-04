import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runDir = 'docs/recognition-optimization/rco-5-008-b8-runs/rco-5-008-b8-m1-20260904a'
const readJson = async (relativePath) => JSON.parse(await readFile(resolve(root, relativePath), 'utf8'))
const sha = async (relativePath) => createHash('sha256').update(await readFile(resolve(root, relativePath))).digest('hex')
const dataset = await readJson('docs/recognition-optimization/RCO-5-008-B8_DEVELOPMENT_DATASET.json')
const dataFreeze = await readJson('docs/recognition-optimization/RCO-5-008-B8_DATA_FREEZE.json')
const runnerFreeze = await readJson('docs/recognition-optimization/RCO-5-008-B8-M1_RUNNER_FREEZE.json')
const resultFreeze = await readJson('docs/recognition-optimization/RCO-5-008-B8-M1_RESULT_FREEZE.json')
const checkpoint = await readJson(`${runDir}/checkpoint.json`)
const raw = await readJson(`${runDir}/raw-results.json`)
const score = await readJson(`${runDir}/score.json`)

function hasForbiddenAuthority(value) {
  if (Array.isArray(value)) return value.some(hasForbiddenAuthority)
  if (!value || typeof value !== 'object') return false
  const forbidden = new Set(['expected', 'requiresAction', 'semantics', 'inferenceLevel', 'effect', 'actionType', 'revisionRefs', 'selected', 'start', 'end', 'evidence', 'quote'])
  return Object.entries(value).some(([key, nested]) => forbidden.has(key) || hasForbiddenAuthority(nested))
}

test('B8 M1 final artifacts are immutable and the original B8 freeze still matches', async () => {
  for (const relativePath of resultFreeze.componentPaths) assert.equal(await sha(relativePath), resultFreeze.componentSha256[relativePath], relativePath)
  for (const relativePath of dataFreeze.componentPaths) assert.equal(await sha(relativePath), dataFreeze.componentSha256[relativePath], relativePath)
  for (const relativePath of runnerFreeze.componentPaths.filter((item) => !item.endsWith('/checkpoint.json') && !item.endsWith('/raw-results.json'))) {
    assert.equal(await sha(relativePath), runnerFreeze.componentSha256[relativePath], relativePath)
  }
})

test('B8 M1 made exactly twelve unique one-shot candidate calls', () => {
  assert.equal(checkpoint.status, 'FINISHED')
  assert.equal(checkpoint.stopReason, null)
  assert.equal(checkpoint.dispatches.length, 12)
  assert.equal(new Set(checkpoint.dispatches.map((item) => item.key)).size, 12)
  assert.equal(raw.records.length, 12)
  assert.deepEqual(raw.records.map((item) => item.caseId), dataset.cases.map((item) => item.id))
  assert.ok(raw.records.every((item) => item.dispatched && item.attemptNo === 1 && item.role === 'candidate' && item.status === 'completed_valid'))
  assert.ok(raw.records.every((item) => item.responseModel === 'deepseek-v4-flash-vision-exp' && item.schemaIssues.length === 0))
  assert.equal(new Set(raw.records.map((item) => item.responseId)).size, 12)
  assert.ok(raw.records.every((item) => !hasForbiddenAuthority(item.parsed)))
})

test('B8 M1 score reproduces the fail-closed registered decision', () => {
  assert.deepEqual(score.accounting, { dispatches: 12, terminalResponses: 12, strictSchemaValid: 12, candidateCalls: 12, verifierCalls: 0, repairCalls: 0, retryCalls: 0 })
  assert.equal(score.evaluation.anchorMetrics.scopeF1, 0.8695652173913043)
  assert.equal(score.evaluation.anchorMetrics.actionSurfaceExact, 0.4)
  assert.equal(score.evaluation.anchorMetrics.objectSurfaceExact, 0.9)
  assert.equal(score.evaluation.anchorMetrics.completeAnchorCaseAccuracy, 0.25)
  assert.equal(score.evaluation.taskMetrics.taskPrecision, 1)
  assert.equal(score.evaluation.taskMetrics.taskRecall, 0.75)
  assert.equal(score.evaluation.taskMetrics.taskF1, 0.8571428571428571)
  assert.equal(score.evaluation.taskMetrics.requiresActionAccuracy, 0.8333333333333334)
  assert.equal(score.evaluation.taskMetrics.completeTaskCaseAccuracy, 0.6666666666666666)
  assert.equal(score.evaluation.taskMetrics.majorCorrectionRate, 0.3333333333333333)
  assert.equal(score.evaluation.unsafeDefaultFalsePositives, 0)
  assert.equal(score.evaluation.taskMetrics.forbiddenDefaultSelections, 0)
  assert.deepEqual(score.evaluation.revisionMetrics.relationExactAccuracyByKind, { cancels: 0, supersedes: 1, amends: 0 })
  assert.equal(score.evaluation.revisionMetrics.oldRequirementInvalidation, 1 / 3)
  assert.equal(score.evaluation.revisionMetrics.activeReplacementRecall, 1)
  assert.equal(score.evaluation.revisionMetrics.unresolvedRevisionExactAccuracy, 0)
  assert.equal(score.decision.code, 'NO_PROMOTION_PAID_REPLICATION_BLOCKED')
})

test('B8 M1 usage is observed without inventing provider billing or persisting a secret', () => {
  assert.deepEqual(score.usage, { complete: true, dispatchedRecords: 12, observedRecords: 12, inputTokens: 12407, outputTokens: 5178, totalTokens: 17585 })
  assert.equal(score.providerBilledCny, 'NOT_OBSERVABLE')
  assert.equal(score.observedConservativePeakPriceCostCny, 0.1229404)
  assert.ok(score.maximumTheoreticalCostCny < score.cnyHardCap)
  assert.equal(score.secretPersistence, 'NONE')
  assert.equal(score.stablePath, 'UNCHANGED')
  assert.equal(score.rco6, 'NOT_STARTED')
  assert.equal(score.deployment, 'NOT_RUN')
  assert.doesNotMatch(JSON.stringify({ checkpoint, raw, score }), /sk-[A-Za-z0-9._~+/-]{16,253}/u)
})
