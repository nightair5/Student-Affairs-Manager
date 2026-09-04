import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runDir = resolve(root, 'docs/recognition-optimization/rco-5-007-b7-runs/rco-5-007-b7-m1-20260904a')
const raw = JSON.parse(await readFile(resolve(runDir, 'raw-results.json'), 'utf8'))
const checkpoint = JSON.parse(await readFile(resolve(runDir, 'checkpoint.json'), 'utf8'))
const score = JSON.parse(await readFile(resolve(runDir, 'score.json'), 'utf8'))
const dataFreeze = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B7_DATA_FREEZE.json'), 'utf8'))
const dataset = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-007-B7_DEVELOPMENT_DATASET.json'), 'utf8'))
const sha = async (relativePath) => createHash('sha256').update(await readFile(resolve(root, relativePath))).digest('hex')

test('B7 M1 used exactly one candidate per frozen case and no prohibited calls', () => {
  assert.equal(checkpoint.status, 'FINISHED')
  assert.equal(checkpoint.dispatches.length, 12)
  assert.equal(new Set(checkpoint.dispatches.map((item) => item.key)).size, 12)
  assert.ok(checkpoint.dispatches.every((item) => item.attemptNo === 1 && item.state === 'completed_valid'))
  assert.equal(raw.records.length, 12)
  assert.equal(new Set(raw.records.map((item) => item.responseId)).size, 12)
  assert.ok(raw.records.every((item) => item.dispatched && item.attemptNo === 1 && item.status === 'completed_valid'))
  assert.deepEqual(score.accounting, { dispatches: 12, terminalResponses: 12, strictSchemaValid: 12, candidateCalls: 12, verifierCalls: 0, repairCalls: 0, retryCalls: 0 })
})

test('B7 protected data and P3 chain still match the pre-call freeze', async () => {
  for (const relativePath of dataFreeze.componentPaths) assert.equal(await sha(relativePath), dataFreeze.componentSha256[relativePath], relativePath)
  assert.equal(score.datasetId, dataFreeze.datasetId)
  assert.equal(dataset.cases.length, 12)
})

test('B7 raw output has no local authority fields or secret-shaped values', () => {
  const forbidden = new Set(['requiresAction', 'semantics', 'inferenceLevel', 'effect', 'actionType', 'revisionRefs', 'selected', 'expected'])
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== 'object') return
    for (const [key, nested] of Object.entries(value)) {
      assert.ok(!forbidden.has(key), `forbidden model field: ${key}`)
      if (typeof nested === 'string') assert.ok(!/^sk-[A-Za-z0-9._~+/-]{16,253}$/u.test(nested), 'secret-shaped value persisted')
      visit(nested)
    }
  }
  raw.records.forEach((record) => visit(record.parsed))
})

test('B7 scores remain the frozen failed gate while exposing the boundary pattern', () => {
  assert.equal(score.decision.code, 'NO_PROMOTION_PAID_REPLICATION_BLOCKED')
  assert.equal(score.evaluation.anchorMetrics.scopeF1, 20 / 21)
  assert.equal(score.evaluation.anchorMetrics.actionSurfaceExact, 8 / 18)
  assert.equal(score.evaluation.anchorMetrics.objectSurfaceExact, 1)
  assert.equal(score.evaluation.anchorMetrics.completeAnchorCaseAccuracy, 4 / 12)
  assert.equal(score.evaluation.taskMetrics.taskF1, 8 / 18)
  assert.equal(score.evaluation.taskMetrics.requiresActionAccuracy, 11 / 12)
  assert.equal(score.evaluation.taskMetrics.completeTaskCaseAccuracy, 4 / 12)
  assert.equal(score.evaluation.taskMetrics.forbiddenDefaultSelections, 0)
  assert.equal(score.evaluation.taskMetrics.majorCorrectionRate, 8 / 12)
})
