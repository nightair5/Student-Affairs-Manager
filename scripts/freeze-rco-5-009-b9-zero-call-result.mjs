import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
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
const postRunFrozenRecordPaths = [
  'docs/recognition-optimization/RCO-5-009-B9_TRACKER.md',
]
const mutableMirrorsRecordedNotHashed = [
  'docs/recognition-optimization/OPTIMIZATION_LOG.md',
  'docs/recognition-optimization/CURRENT_CONTEXT.md',
]
const componentPaths = [runnerFreezePath, checkpointPath, resultPath, reportPath, ...postRunFrozenRecordPaths]
const dataFreezeCommit = '98123829e763b804eb6ed8669c7f0e483aed49dd'
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

function safeRepoPath(relativePath) {
  assert.equal(typeof relativePath, 'string')
  assert.ok(relativePath.length > 0, 'empty path is forbidden')
  assert.equal(isAbsolute(relativePath), false, `absolute path forbidden: ${relativePath}`)
  assert.equal(relativePath.includes('\\'), false, `backslash path forbidden: ${relativePath}`)
  assert.equal(relativePath.split('/').includes('..'), false, `parent traversal forbidden: ${relativePath}`)
  assert.ok(['scripts/', 'src/recognition/', 'docs/recognition-optimization/'].some((prefix) => relativePath.startsWith(prefix)), `path prefix forbidden: ${relativePath}`)
  const resolvedPath = resolve(root, relativePath)
  const fromRoot = relative(root, resolvedPath)
  assert.notEqual(fromRoot, '')
  assert.notEqual(fromRoot, '..')
  assert.equal(fromRoot.startsWith('../') || fromRoot.startsWith('..\\') || isAbsolute(fromRoot), false, `path escapes repository: ${relativePath}`)
  return resolvedPath
}

const sha = async (relativePath) => createHash('sha256').update(await readFile(safeRepoPath(relativePath))).digest('hex')
const readJson = async (relativePath) => JSON.parse(await readFile(safeRepoPath(relativePath), 'utf8'))
const git = async (args) => (await execFileAsync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })).stdout.trim()
const gitBlob = async (commit, relativePath) => {
  safeRepoPath(relativePath)
  return (await execFileAsync(
    'git',
    ['show', `${commit}:${relativePath}`],
    { cwd: root, encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 },
  )).stdout
}

async function assertGitAncestor(ancestor, descendant, message) {
  try {
    await execFileAsync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { cwd: root })
  } catch {
    assert.fail(message)
  }
}

async function assertCommittedComponent(relativePath, commit, expectedSha256) {
  safeRepoPath(relativePath)
  const committedSha256 = createHash('sha256').update(await gitBlob(commit, relativePath)).digest('hex')
  assert.equal(committedSha256, expectedSha256, `runner commit does not contain frozen component: ${relativePath}`)
  assert.equal(await sha(relativePath), expectedSha256, `frozen runner component drift: ${relativePath}`)
}

const runnerFreeze = await readJson(runnerFreezePath)
const checkpoint = await readJson(checkpointPath)
const result = await readJson(resultPath)
assert.equal(runnerFreeze.runId, runId)
assert.deepEqual(runnerFreeze.outputPaths, [checkpointPath, resultPath, reportPath])
assert.deepEqual(runnerFreeze.postRunFrozenRecordPaths, postRunFrozenRecordPaths)
assert.deepEqual(runnerFreeze.mutableMirrorsRecordedNotHashed, mutableMirrorsRecordedNotHashed)
assert.equal(runnerFreeze.dataFreezeCommitFull, dataFreezeCommit)
assert.equal(checkpoint.runId, runId)
assert.equal(result.runId, runId)
assert.equal(checkpoint.datasetId, runnerFreeze.datasetId)
assert.equal(result.datasetId, runnerFreeze.datasetId)
assert.equal(checkpoint.dataFreezeCommit, dataFreezeCommit)
assert.equal(result.dataFreezeCommit, dataFreezeCommit)
assert.match(checkpoint.runnerFreezeCommit, /^[0-9a-f]{40}$/u)
assert.equal(result.runnerFreezeCommit, checkpoint.runnerFreezeCommit)
const currentRunnerFreezeSha256 = await sha(runnerFreezePath)
assert.equal(checkpoint.runnerFreezeSha256, currentRunnerFreezeSha256)
assert.equal(result.runnerFreezeSha256, currentRunnerFreezeSha256)
const completedRun = checkpoint.status === 'COMPLETED' && result.status === 'COMPLETED'
const failedRun = checkpoint.status === 'FAILED' && result.status === 'FAILED'
assert.equal(completedRun || failedRun, true, 'checkpoint and result must describe the same terminal outcome')
assert.deepEqual(checkpoint.accounting, result.accounting)
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
  assert.equal(result.evaluation?.gate === 'PASS' || result.evaluation?.gate === 'FAIL', true)
} else {
  assert.equal(result.gate, 'FAIL')
  assert.equal(typeof result.failureCode, 'string')
  assert.equal(result.failureCode, checkpoint.failureCode)
  assert.equal(result.failurePhase, checkpoint.failurePhase)
}

const runnerFreezeCommit = checkpoint.runnerFreezeCommit
assert.equal(
  createHash('sha256').update(await gitBlob(runnerFreezeCommit, runnerFreezePath)).digest('hex'),
  await sha(runnerFreezePath),
  'runner freeze manifest differs from recorded run commit',
)
const upstream = await git(['rev-parse', '@{u}'])
await assertGitAncestor(runnerFreezeCommit, upstream, 'recorded runner freeze commit is not present in the configured upstream ref')
for (const relativePath of runnerFreeze.componentPaths) {
  await assertCommittedComponent(relativePath, runnerFreezeCommit, runnerFreeze.componentSha256[relativePath])
}

const componentSha256 = Object.fromEntries(await Promise.all(componentPaths.map(async (relativePath) => [relativePath, await sha(relativePath)])))
const checkMode = process.argv.includes('--check')
const frozenAt = checkMode
  ? (await readJson(resultFreezePath)).frozenAt
  : new Date().toISOString()
assert.equal(typeof frozenAt, 'string')
assert.equal(Number.isFinite(Date.parse(frozenAt)), true, 'result freeze timestamp must be a real ISO timestamp')
const terminalAt = result.completedAt ?? result.failedAt
assert.equal(typeof terminalAt, 'string')
assert.ok(Date.parse(frozenAt) >= Date.parse(terminalAt), 'result freeze cannot predate the terminal run outcome')
const output = {
  schemaVersion: 'rco-5-009-b9-zero-call-result-freeze-1.0.0',
  stage: 'RCO-5-009-B9-FIRST-ZERO-CALL-RESULT',
  status: 'FIRST_ZERO_CALL_RESULT_FROZEN_B9_NOW_SEEN',
  frozenAt,
  authorizationId: 'RCO-5-009-B9-ZERO-CALL',
  runId,
  datasetId: result.datasetId,
  dataFreezeCommit,
  runnerFreezeCommit,
  runnerFreezeWasPushedBeforeRun: true,
  componentPaths,
  componentSha256,
  componentHashPolicy: 'RUNNER_FREEZE_CHECKPOINT_RESULT_REPORT_AND_STAGE_SPECIFIC_TRACKER_ONLY',
  mutableMirrorsRecordedNotHashed,
  mutableMirrorPolicy: 'GLOBAL_OPTIMIZATION_LOG_AND_CURRENT_CONTEXT_ARE_NON_AUTHORITATIVE_MIRRORS_AND_MUST_NOT_CREATE_TRANSITIVE_HASH_DRIFT',
  accounting: result.accounting,
  runOutcome: result.status,
  failureCode: result.failureCode ?? null,
  metrics: result.metrics,
  knownLabelLimitations: result.knownLabelLimitations,
  gate: result.gate,
  decision: result.decision,
  checkpointStatus: checkpoint.status,
  resultStatus: result.status,
  datasetSeenAfterFirstRun: true,
  rerunAuthorized: false,
  paidRunAuthorized: false,
  stablePath: 'UNCHANGED',
  rco6: 'NOT_STARTED',
  deployment: 'NOT_RUN',
  nextGate: 'AUDIT_FROZEN_FIRST_RESULT_AND_USE_B10_OR_LATER_FOR_ANY_GENERALIZATION_FIX',
}

const serialized = `${JSON.stringify(output, null, 2)}\n`
if (checkMode) {
  assert.equal(await readFile(resolve(root, resultFreezePath), 'utf8'), serialized, 'result freeze manifest is not reproducible')
  console.log(JSON.stringify({ status: 'PASS', output: resolve(root, resultFreezePath), components: componentPaths.length }))
} else {
  await writeFile(resolve(root, resultFreezePath), serialized, { encoding: 'utf8', flag: 'wx' })
  console.log(JSON.stringify({ output: resolve(root, resultFreezePath), components: componentPaths.length, runId }))
}
