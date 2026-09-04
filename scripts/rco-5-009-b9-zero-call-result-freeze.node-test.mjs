import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runId = 'rco-5-009-b9-zero-call-20260904a'
const runDirectory = `docs/recognition-optimization/rco-5-009-b9-runs/${runId}`
const runnerFreezePath = 'docs/recognition-optimization/RCO-5-009-B9_ZERO_CALL_RUNNER_FREEZE.json'
const resultFreezePath = 'docs/recognition-optimization/RCO-5-009-B9_ZERO_CALL_RESULT_FREEZE.json'
const checkpointPath = `${runDirectory}/checkpoint.json`
const resultPath = `${runDirectory}/result.json`
const reportPath = `${runDirectory}/REPORT.md`
const expectedComponentPaths = [
  runnerFreezePath,
  checkpointPath,
  resultPath,
  reportPath,
  'docs/recognition-optimization/RCO-5-009-B9_TRACKER.md',
]
const expectedMutableMirrors = [
  'docs/recognition-optimization/OPTIMIZATION_LOG.md',
  'docs/recognition-optimization/CURRENT_CONTEXT.md',
]
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
const sha = async (relativePath) => createHash('sha256').update(await readFile(resolve(root, relativePath))).digest('hex')
const git = async (args) => (await execFileAsync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })).stdout.trim()
const gitBlobSha = async (commit, relativePath) => createHash('sha256').update((await execFileAsync(
  'git',
  ['show', `${commit}:${relativePath}`],
  { cwd: root, encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 },
)).stdout).digest('hex')

async function assertGitAncestor(ancestor, descendant, message) {
  try {
    await execFileAsync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { cwd: root })
  } catch {
    assert.fail(message)
  }
}

const freeze = await readJson(resultFreezePath)
const runnerFreeze = await readJson(runnerFreezePath)
const checkpoint = await readJson(checkpointPath)
const result = await readJson(resultPath)

test('B9 result freeze contains only the preregistered immutable evidence paths', async () => {
  assert.equal(freeze.schemaVersion, 'rco-5-009-b9-zero-call-result-freeze-1.0.0')
  assert.equal(freeze.status, 'FIRST_ZERO_CALL_RESULT_FROZEN_B9_NOW_SEEN')
  assert.equal(freeze.authorizationId, 'RCO-5-009-B9-ZERO-CALL')
  assert.equal(freeze.runId, runId)
  assert.equal(Number.isFinite(Date.parse(freeze.frozenAt)), true)
  assert.ok(Date.parse(freeze.frozenAt) >= Date.parse(result.completedAt ?? result.failedAt))
  assert.deepEqual(freeze.componentPaths, expectedComponentPaths)
  assert.deepEqual(Object.keys(freeze.componentSha256).sort(), [...expectedComponentPaths].sort())
  assert.deepEqual(freeze.mutableMirrorsRecordedNotHashed, expectedMutableMirrors)
  for (const relativePath of expectedMutableMirrors) assert.equal(Object.hasOwn(freeze.componentSha256, relativePath), false, relativePath)
  for (const relativePath of expectedComponentPaths) {
    assert.equal(await sha(relativePath), freeze.componentSha256[relativePath], relativePath)
  }
})

test('B9 result is tied to the pushed commit containing the frozen runner layer', async () => {
  assert.equal(freeze.dataFreezeCommit, '98123829e763b804eb6ed8669c7f0e483aed49dd')
  assert.match(freeze.runnerFreezeCommit, /^[0-9a-f]{40}$/u)
  assert.equal(checkpoint.runnerFreezeCommit, freeze.runnerFreezeCommit)
  assert.equal(result.runnerFreezeCommit, freeze.runnerFreezeCommit)
  const currentRunnerFreezeSha256 = await sha(runnerFreezePath)
  assert.equal(checkpoint.runnerFreezeSha256, currentRunnerFreezeSha256)
  assert.equal(result.runnerFreezeSha256, currentRunnerFreezeSha256)
  const upstream = await git(['rev-parse', '@{u}'])
  await assertGitAncestor(freeze.runnerFreezeCommit, upstream, 'runner freeze commit is not present in upstream')
  for (const relativePath of runnerFreeze.componentPaths) {
    assert.equal(await sha(relativePath), runnerFreeze.componentSha256[relativePath], relativePath)
    assert.equal(await gitBlobSha(freeze.runnerFreezeCommit, relativePath), runnerFreeze.componentSha256[relativePath], `commit:${relativePath}`)
  }
  assert.equal(await gitBlobSha(freeze.runnerFreezeCommit, runnerFreezePath), await sha(runnerFreezePath))
})

test('B9 freezes one terminal local attempt with no external authority', () => {
  const completedRun = checkpoint.status === 'COMPLETED' && result.status === 'COMPLETED'
  const failedRun = checkpoint.status === 'FAILED' && result.status === 'FAILED'
  assert.equal(completedRun || failedRun, true)
  assert.deepEqual(checkpoint.accounting, result.accounting)
  assert.deepEqual(freeze.accounting, result.accounting)
  assert.equal(result.accounting.modelCalls, 0)
  assert.equal(result.accounting.networkRequests, 0)
  assert.equal(result.accounting.verifierCalls, 0)
  assert.equal(result.accounting.repairCalls, 0)
  assert.equal(result.accounting.retryCalls, 0)
  assert.equal(result.accounting.secretAccess, 'NONE')
  assert.equal(result.accounting.pipelineRuns, 1)
  assert.equal(Number.isInteger(result.accounting.casePipelineExecutions), true)
  assert.ok(result.accounting.casePipelineExecutions >= 0 && result.accounting.casePipelineExecutions <= 12)
  const completedCaseIds = result.cases.map((item) => item.caseId)
  assert.deepEqual(checkpoint.completedCaseIds, completedCaseIds)
  assert.equal(checkpoint.completedCaseCount, completedCaseIds.length)
  assert.ok(result.accounting.casePipelineExecutions >= completedCaseIds.length)
  if (completedRun) {
    assert.deepEqual(result.accounting, exactAccounting)
    assert.equal(completedCaseIds.length, 12)
  } else {
    assert.equal(result.gate, 'FAIL')
    assert.equal(typeof result.failureCode, 'string')
    assert.equal(result.failureCode, checkpoint.failureCode)
    assert.equal(result.failurePhase, checkpoint.failurePhase)
  }
  assert.equal(freeze.runOutcome, result.status)
  assert.equal(freeze.failureCode, result.failureCode ?? null)
  assert.equal(freeze.datasetSeenAfterFirstRun, true)
  assert.equal(freeze.rerunAuthorized, false)
  assert.equal(freeze.paidRunAuthorized, false)
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'NOT_STARTED')
  assert.equal(freeze.deployment, 'NOT_RUN')
})

test('B9 frozen score and decision are exact copies of the terminal result', () => {
  assert.deepEqual(freeze.metrics, result.metrics)
  assert.deepEqual(freeze.knownLabelLimitations, result.knownLabelLimitations)
  assert.deepEqual(freeze.gate, result.gate)
  assert.deepEqual(freeze.decision, result.decision)
})
