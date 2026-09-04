import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = 'docs/recognition-optimization/RCO-5-009-B9_ZERO_CALL_RUNNER_FREEZE.json'
const dataFreezePath = 'docs/recognition-optimization/RCO-5-009-B9_DATA_FREEZE.json'
const dataFreezeCommit = '9812382'
const dataFreezeCommitFull = '98123829e763b804eb6ed8669c7f0e483aed49dd'
const runId = 'rco-5-009-b9-zero-call-20260904a'
const runDirectory = `docs/recognition-optimization/rco-5-009-b9-runs/${runId}`

const executablePaths = [
  'scripts/rco-5-009-b9-evaluation.ts',
  'scripts/rco-5-009-b9-evaluation.test.ts',
  'scripts/run-rco-5-009-b9-zero-call.ts',
  'scripts/rco-5-009-b9-zero-call-result.node-test.mjs',
]
const zeroCallSourcePaths = [
  'scripts/rco-5-009-b9-evaluation.ts',
  'scripts/run-rco-5-009-b9-zero-call.ts',
]
const resultFreezeControlPaths = [
  'scripts/freeze-rco-5-009-b9-zero-call-result.mjs',
  'scripts/rco-5-009-b9-zero-call-result-freeze.node-test.mjs',
]
const runnerFreezeControlPaths = [
  'scripts/freeze-rco-5-009-b9-zero-call-runner.mjs',
  'scripts/rco-5-009-b9-zero-call-runner-freeze.node-test.mjs',
]
const componentPaths = [
  ...executablePaths,
  dataFreezePath,
  ...resultFreezeControlPaths,
  ...runnerFreezeControlPaths,
]
const outputPaths = [
  `${runDirectory}/checkpoint.json`,
  `${runDirectory}/result.json`,
  `${runDirectory}/REPORT.md`,
]
const resultFreezePath = 'docs/recognition-optimization/RCO-5-009-B9_ZERO_CALL_RESULT_FREEZE.json'
const postRunFrozenRecordPaths = [
  'docs/recognition-optimization/RCO-5-009-B9_TRACKER.md',
]
const mutableMirrorsRecordedNotHashed = [
  'docs/recognition-optimization/OPTIMIZATION_LOG.md',
  'docs/recognition-optimization/CURRENT_CONTEXT.md',
]
const mustNotExistAtFreezePaths = [...outputPaths, resultFreezePath]
const exactAccountingContract = {
  modelCalls: 0,
  networkRequests: 0,
  verifierCalls: 0,
  repairCalls: 0,
  retryCalls: 0,
  secretAccess: 'NONE',
  pipelineRuns: 1,
  casePipelineExecutions: 12,
}
const forbiddenSourcePatterns = [
  { id: 'FETCH', expression: /\bfetch\s*\(/u },
  { id: 'HTTP_URL', expression: /https?:\/\//iu },
  { id: 'NODE_HTTP_IMPORT', expression: /node:https?/iu },
  { id: 'PROCESS_ENV', expression: /process\.env/iu },
  { id: 'DEEPSEEK_OR_API_KEY', expression: /deepseek|api[_-]?key/iu },
  { id: 'BROWSER_NETWORK', expression: /XMLHttpRequest|WebSocket/iu },
  { id: 'CLIPBOARD', expression: /clipboard/iu },
  { id: 'NETWORK_COMMAND', expression: /\b(?:curl|wget|Invoke-WebRequest|wrangler)\b/iu },
  { id: 'OLD_TASK_FORMATION_P4', expression: /taskFormationPolicyP4/iu },
  { id: 'OLD_TASK_FORMATION_EVALUATOR_V2', expression: /taskFormationEvaluationV2/iu },
  { id: 'OLD_LEGACY_CLASSIFICATION_PROJECTION', expression: /projectLegacySelectionToCandidateClassifications/iu },
  { id: 'OLD_SCOPE_REVISION_MATERIALIZER', expression: /materializeRevisionRelationsByScope/iu },
  { id: 'DIRECT_OLD_REVISION_RESOLVER_IMPORT', expression: /from\s+['"][^'"]*revisionRelationResolver/iu },
]
const requiredRunnerMarkers = [
  'wx',
  dataFreezeCommitFull,
  'runnerFreezeCommit',
  'pipelineRuns',
  'casePipelineExecutions',
  'indexLocalActionCandidatesV2',
  'composeActionCandidatesV2',
  'formCandidateSafeTaskSuggestions',
  'validateCandidateSafeTaskSuggestions',
  'evaluateB9ZeroCall',
]

function assertSafeRelativePath(relativePath) {
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
}

async function sha(relativePath) {
  assertSafeRelativePath(relativePath)
  return createHash('sha256').update(await readFile(resolve(root, relativePath))).digest('hex')
}

async function git(args) {
  const { stdout } = await execFileAsync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  return stdout.trim()
}

async function assertGitAncestor(ancestor, descendant, message) {
  try {
    await execFileAsync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { cwd: root })
  } catch {
    assert.fail(message)
  }
}

async function assertAbsent(relativePath) {
  try {
    await access(resolve(root, relativePath))
  } catch (error) {
    if (error && error.code === 'ENOENT') return
    throw error
  }
  assert.fail(`pre-run output already exists: ${relativePath}`)
}

async function assertDataFreezeIntegrity() {
  const resolvedCommit = await git(['rev-parse', `${dataFreezeCommit}^{commit}`])
  assert.equal(resolvedCommit, dataFreezeCommitFull, 'data freeze commit does not resolve to the preregistered full commit')
  await assertGitAncestor(dataFreezeCommitFull, 'HEAD', 'data freeze commit is not an ancestor of HEAD')
  const upstream = await git(['rev-parse', '@{u}'])
  await assertGitAncestor(dataFreezeCommitFull, upstream, 'data freeze commit is not present in the configured upstream ref')
  const committedDataFreeze = await git(['show', `${dataFreezeCommitFull}:${dataFreezePath}`])
  const currentDataFreeze = (await readFile(resolve(root, dataFreezePath), 'utf8')).trimEnd()
  assert.equal(currentDataFreeze, committedDataFreeze, 'B9 data freeze differs from commit 9812382')

  const dataFreeze = JSON.parse(currentDataFreeze)
  assert.equal(dataFreeze.authorizationId, 'RCO-5-009-B9-ZERO-CALL')
  assert.equal(dataFreeze.datasetId, 'rco-5-009-b9-development-20260904')
  assert.equal(dataFreeze.paidRunAuthorized, false)
  assert.equal(dataFreeze.modelCalls, 0)
  assert.equal(dataFreeze.networkDispatches, 0)
  assert.equal(dataFreeze.secretAccess, 'NONE')
  for (const relativePath of dataFreeze.componentPaths) {
    assert.equal(await sha(relativePath), dataFreeze.componentSha256[relativePath], `data freeze component drift: ${relativePath}`)
  }
  return { dataFreeze, upstream }
}

async function assertZeroCallSourceBoundary() {
  for (const relativePath of zeroCallSourcePaths) {
    const source = await readFile(resolve(root, relativePath), 'utf8')
    for (const { id, expression } of forbiddenSourcePatterns) {
      assert.equal(expression.test(source), false, `${relativePath} contains forbidden zero-call surface ${id}`)
    }
  }
  const runnerSource = await readFile(resolve(root, 'scripts/run-rco-5-009-b9-zero-call.ts'), 'utf8')
  for (const requiredMarker of requiredRunnerMarkers) {
    assert.ok(runnerSource.includes(requiredMarker), `runner is missing one-shot/audit marker: ${requiredMarker}`)
  }
}

async function assertResultTestsAreSyntaxReadable() {
  for (const relativePath of [
    'scripts/rco-5-009-b9-zero-call-result.node-test.mjs',
    'scripts/freeze-rco-5-009-b9-zero-call-result.mjs',
    'scripts/rco-5-009-b9-zero-call-result-freeze.node-test.mjs',
  ]) {
    await execFileAsync(process.execPath, ['--check', resolve(root, relativePath)], { cwd: root })
  }
}

for (const relativePath of [
  ...componentPaths,
  ...outputPaths,
  resultFreezePath,
  ...postRunFrozenRecordPaths,
  ...mutableMirrorsRecordedNotHashed,
]) {
  assertSafeRelativePath(relativePath)
}
assert.equal(new Set(componentPaths).size, componentPaths.length, 'duplicate component path')
assert.equal(new Set(outputPaths).size, outputPaths.length, 'duplicate output path')
assert.deepEqual(componentPaths.filter((relativePath) => outputPaths.includes(relativePath)), [])
assert.equal(componentPaths.includes(resultFreezePath), false)

const { dataFreeze, upstream } = await assertDataFreezeIntegrity()
await assertZeroCallSourceBoundary()
await assertResultTestsAreSyntaxReadable()
const componentSha256 = Object.fromEntries(await Promise.all(componentPaths.map(async (relativePath) => [relativePath, await sha(relativePath)])))
const checkMode = process.argv.includes('--check')
const frozenAt = checkMode
  ? JSON.parse(await readFile(resolve(root, manifestPath), 'utf8')).frozenAt
  : new Date().toISOString()
assert.equal(typeof frozenAt, 'string')
assert.equal(Number.isFinite(Date.parse(frozenAt)), true, 'runner freeze timestamp must be a real ISO timestamp')

const output = {
  schemaVersion: 'rco-5-009-b9-zero-call-runner-freeze-1.0.0',
  stage: 'RCO-5-009-B9-PRE-FIRST-ZERO-CALL',
  status: 'RUNNER_EVALUATOR_AND_RESULT_FREEZE_METHOD_FROZEN_AWAITING_COMMIT_AND_PUSH',
  frozenAt,
  authorizationId: 'RCO-5-009-B9-ZERO-CALL',
  executionAuthorizationAtFreeze: 'NOT_GRANTED_RUNNER_MUST_BE_COMMITTED_AND_PUSHED_FIRST',
  executionMode: 'DETERMINISTIC_RESPONSE_FIXTURE_ZERO_CALL',
  runId,
  datasetId: dataFreeze.datasetId,
  datasetPath: dataFreeze.datasetPath,
  datasetIdentity: {
    sampleCount: dataFreeze.sampleCount,
    expectedCandidateCount: dataFreeze.expectedCandidateCount,
    expectedCandidateDispositionCounts: dataFreeze.expectedCandidateDispositionCounts,
    expectedLedgerCounts: dataFreeze.expectedLedgerCounts,
    expectedTaskCount: dataFreeze.expectedTaskCount,
    safeDefaultExpectedCount: dataFreeze.safeDefaultExpectedCount,
    expectedRevisionRelationCount: dataFreeze.expectedRevisionRelationCount,
    expectedRequiresActionVector: dataFreeze.expectedRequiresActionVector,
    expectedResponsePartialCaseIds: dataFreeze.expectedResponsePartialCaseIds,
    expectedSemanticPartialCaseIds: dataFreeze.expectedSemanticPartialCaseIds,
  },
  fixedZeroCallGate: dataFreeze.fixedZeroCallGate,
  dataFreezePath,
  dataFreezeCommit,
  dataFreezeCommitFull,
  upstreamContainingDataFreezeAtFreeze: upstream,
  componentPaths,
  componentSha256,
  outputPaths,
  lockPath: outputPaths[0],
  outputStateAtFreeze: Object.fromEntries(outputPaths.map((relativePath) => [relativePath, 'ABSENT_AT_FREEZE'])),
  outputHashPolicy: 'CHECKPOINT_RESULT_AND_REPORT_ARE_FORBIDDEN_FROM_PRE_RUN_COMPONENT_HASHES',
  resultFreezePath,
  resultFreezeStateAtFreeze: 'ABSENT_AT_FREEZE',
  postRunFrozenRecordPaths,
  mutableMirrorsRecordedNotHashed,
  postRunHashPolicy: 'ONLY_THE_PRE_FROZEN_RESULT_FREEZER_MAY_HASH_OUTPUTS_AND_THE_STAGE_SPECIFIC_TRACKER_AFTER_COMPLETION; GLOBAL_LOG_AND_CONTEXT_ARE_NON_AUTHORITATIVE_MUTABLE_MIRRORS',
  exactAccountingContract,
  maximumRuns: 1,
  maximumCasePipelineExecutions: 12,
  staticSafetyReview: {
    inspectedPaths: zeroCallSourcePaths,
    forbiddenSurfaceIds: forbiddenSourcePatterns.map((item) => item.id),
    requiredRunnerMarkers,
    resultAssertionTestPolicy: 'SYNTAX_CHECKED_AND_HASHED_BUT_NOT_EXECUTED_AT_RUNNER_FREEZE',
    resultFreezePolicy: 'SYNTAX_CHECKED_AND_HASHED_BEFORE_RESULTS_EXIST',
  },
  oneShotPolicy: 'After this manifest and every bound component are committed and pushed, the runner may execute exactly once. It must atomically claim the absent checkpoint path with wx before evaluating all 12 cases and must refuse every rerun.',
  mutationPolicy: 'Runner, evaluator, tests, B9 data freeze and the result-freeze method are immutable after this runner freeze; PASS, semantic FAIL and runtime FAILED first-run outcomes all produce retained result and report evidence.',
  evidenceBoundary: 'This gate is deterministic Codex-authored Development evidence only. It is not a model, OCR, real-material, human-edit-time or commercial-release result. B9-12 is a frozen implementation-boundary label, not independently adjudicated semantic truth.',
  runPreconditions: {
    runnerFreezeCommitRequired: true,
    runnerFreezePushRequired: true,
    cleanWorktreeRequired: true,
    headEqualsUpstreamRequired: true,
    componentHashesMustMatch: true,
    outputPathsMustBeAbsent: true,
    atomicCheckpointClaimRequired: true,
  },
  runtimeCommand: 'npx --no-install vite-node scripts/run-rco-5-009-b9-zero-call.ts',
  paidRunAuthorized: false,
  modelCallsAtFreeze: 0,
  networkRequestsAtFreeze: 0,
  secretAccessAtFreeze: 'NONE',
  pipelineRunsAtFreeze: 0,
  casePipelineExecutionsAtFreeze: 0,
  stablePath: 'UNCHANGED',
  rco6: 'NOT_STARTED',
  deployment: 'NOT_RUN',
  nextGate: 'COMMIT_AND_PUSH_RUNNER_FREEZE_THEN_AUTHORIZE_ONE_SHOT_ZERO_CALL_RUN',
}

const serialized = `${JSON.stringify(output, null, 2)}\n`
if (checkMode) {
  assert.equal(await readFile(resolve(root, manifestPath), 'utf8'), serialized, 'runner freeze manifest is not reproducible')
  console.log(JSON.stringify({ status: 'PASS', output: resolve(root, manifestPath), components: componentPaths.length }))
} else {
  for (const relativePath of mustNotExistAtFreezePaths) await assertAbsent(relativePath)
  await writeFile(resolve(root, manifestPath), serialized, { encoding: 'utf8', flag: 'wx' })
  console.log(JSON.stringify({ output: resolve(root, manifestPath), components: componentPaths.length, outputsAbsent: outputPaths.length }))
}
