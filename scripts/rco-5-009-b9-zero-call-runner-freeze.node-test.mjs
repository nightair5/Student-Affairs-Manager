import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = 'docs/recognition-optimization/RCO-5-009-B9_ZERO_CALL_RUNNER_FREEZE.json'
const dataFreezePath = 'docs/recognition-optimization/RCO-5-009-B9_DATA_FREEZE.json'
const dataFreezeCommitFull = '98123829e763b804eb6ed8669c7f0e483aed49dd'
const expectedExecutablePaths = [
  'scripts/rco-5-009-b9-evaluation.ts',
  'scripts/rco-5-009-b9-evaluation.test.ts',
  'scripts/run-rco-5-009-b9-zero-call.ts',
  'scripts/rco-5-009-b9-zero-call-result.node-test.mjs',
]
const expectedZeroCallSourcePaths = [
  'scripts/rco-5-009-b9-evaluation.ts',
  'scripts/run-rco-5-009-b9-zero-call.ts',
]
const expectedResultFreezeControlPaths = [
  'scripts/freeze-rco-5-009-b9-zero-call-result.mjs',
  'scripts/rco-5-009-b9-zero-call-result-freeze.node-test.mjs',
]
const expectedRunnerFreezeControlPaths = [
  'scripts/freeze-rco-5-009-b9-zero-call-runner.mjs',
  'scripts/rco-5-009-b9-zero-call-runner-freeze.node-test.mjs',
]
const expectedOutputPaths = [
  'docs/recognition-optimization/rco-5-009-b9-runs/rco-5-009-b9-zero-call-20260904a/checkpoint.json',
  'docs/recognition-optimization/rco-5-009-b9-runs/rco-5-009-b9-zero-call-20260904a/result.json',
  'docs/recognition-optimization/rco-5-009-b9-runs/rco-5-009-b9-zero-call-20260904a/REPORT.md',
]
const expectedPostRunFrozenRecordPaths = [
  'docs/recognition-optimization/RCO-5-009-B9_TRACKER.md',
]
const expectedMutableMirrors = [
  'docs/recognition-optimization/OPTIMIZATION_LOG.md',
  'docs/recognition-optimization/CURRENT_CONTEXT.md',
]
const expectedAccountingContract = {
  modelCalls: 0,
  networkRequests: 0,
  verifierCalls: 0,
  repairCalls: 0,
  retryCalls: 0,
  secretAccess: 'NONE',
  pipelineRuns: 1,
  casePipelineExecutions: 12,
}

const freeze = JSON.parse(await readFile(resolve(root, manifestPath), 'utf8'))
const sha = async (relativePath) => createHash('sha256').update(await readFile(resolve(root, relativePath))).digest('hex')
const git = async (args) => (await execFileAsync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })).stdout.trim()

test('B9 runner freeze binds the exact zero-call inputs and pre-frozen result method', async () => {
  assert.equal(freeze.schemaVersion, 'rco-5-009-b9-zero-call-runner-freeze-1.0.0')
  assert.equal(freeze.status, 'RUNNER_EVALUATOR_AND_RESULT_FREEZE_METHOD_FROZEN_AWAITING_COMMIT_AND_PUSH')
  assert.equal(freeze.authorizationId, 'RCO-5-009-B9-ZERO-CALL')
  assert.equal(freeze.executionAuthorizationAtFreeze, 'NOT_GRANTED_RUNNER_MUST_BE_COMMITTED_AND_PUSHED_FIRST')
  assert.equal(freeze.executionMode, 'DETERMINISTIC_RESPONSE_FIXTURE_ZERO_CALL')
  assert.equal(Number.isFinite(Date.parse(freeze.frozenAt)), true)
  assert.equal(freeze.datasetId, 'rco-5-009-b9-development-20260904')
  assert.equal(freeze.datasetPath, 'docs/recognition-optimization/RCO-5-009-B9_DEVELOPMENT_DATASET.json')
  assert.equal(freeze.dataFreezeCommit, '9812382')
  assert.equal(freeze.dataFreezeCommitFull, dataFreezeCommitFull)
  assert.deepEqual(freeze.componentPaths, [
    ...expectedExecutablePaths,
    dataFreezePath,
    ...expectedResultFreezeControlPaths,
    ...expectedRunnerFreezeControlPaths,
  ])
  assert.equal(new Set(freeze.componentPaths).size, freeze.componentPaths.length)
  assert.deepEqual(Object.keys(freeze.componentSha256).sort(), [...freeze.componentPaths].sort())
  for (const relativePath of freeze.componentPaths) {
    assert.equal(isAbsolute(relativePath), false, relativePath)
    assert.equal(relativePath.split('/').includes('..'), false, relativePath)
    assert.equal(await sha(relativePath), freeze.componentSha256[relativePath], relativePath)
  }
})

test('B9 runner freeze still points at the pushed immutable data freeze', async () => {
  assert.equal(await git(['rev-parse', '9812382^{commit}']), dataFreezeCommitFull)
  const committedDataFreeze = await git(['show', `${dataFreezeCommitFull}:${dataFreezePath}`])
  const currentDataFreeze = (await readFile(resolve(root, dataFreezePath), 'utf8')).trimEnd()
  assert.equal(currentDataFreeze, committedDataFreeze)
  const dataFreeze = JSON.parse(currentDataFreeze)
  for (const relativePath of dataFreeze.componentPaths) {
    assert.equal(await sha(relativePath), dataFreeze.componentSha256[relativePath], relativePath)
  }
})

test('B9 pre-run manifest records but never hashes future outputs', () => {
  assert.deepEqual(freeze.outputPaths, expectedOutputPaths)
  assert.equal(freeze.lockPath, expectedOutputPaths[0])
  assert.deepEqual(freeze.outputStateAtFreeze, Object.fromEntries(expectedOutputPaths.map((relativePath) => [relativePath, 'ABSENT_AT_FREEZE'])))
  assert.equal(freeze.outputHashPolicy, 'CHECKPOINT_RESULT_AND_REPORT_ARE_FORBIDDEN_FROM_PRE_RUN_COMPONENT_HASHES')
  assert.equal(freeze.resultFreezePath, 'docs/recognition-optimization/RCO-5-009-B9_ZERO_CALL_RESULT_FREEZE.json')
  assert.equal(freeze.resultFreezeStateAtFreeze, 'ABSENT_AT_FREEZE')
  assert.deepEqual(freeze.postRunFrozenRecordPaths, expectedPostRunFrozenRecordPaths)
  assert.deepEqual(freeze.mutableMirrorsRecordedNotHashed, expectedMutableMirrors)
  for (const relativePath of [
    ...expectedOutputPaths,
    freeze.resultFreezePath,
    ...expectedPostRunFrozenRecordPaths,
    ...expectedMutableMirrors,
  ]) {
    assert.equal(Object.hasOwn(freeze.componentSha256, relativePath), false, relativePath)
  }
})

test('B9 runner freeze has no paid, model, network or secret authority', () => {
  assert.deepEqual(freeze.exactAccountingContract, expectedAccountingContract)
  assert.equal(freeze.paidRunAuthorized, false)
  assert.equal(freeze.modelCallsAtFreeze, 0)
  assert.equal(freeze.networkRequestsAtFreeze, 0)
  assert.equal(freeze.secretAccessAtFreeze, 'NONE')
  assert.equal(freeze.pipelineRunsAtFreeze, 0)
  assert.equal(freeze.casePipelineExecutionsAtFreeze, 0)
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'NOT_STARTED')
  assert.equal(freeze.deployment, 'NOT_RUN')
  assert.equal(freeze.maximumRuns, 1)
  assert.equal(freeze.maximumCasePipelineExecutions, 12)
})

test('B9 readable identity and gate mirror the committed data freeze exactly', async () => {
  const dataFreeze = JSON.parse(await readFile(resolve(root, dataFreezePath), 'utf8'))
  assert.deepEqual(freeze.fixedZeroCallGate, dataFreeze.fixedZeroCallGate)
  assert.deepEqual(freeze.datasetIdentity, {
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
  })
})

test('B9 executable sources expose no model, network, environment-secret or clipboard surface', async () => {
  const forbiddenPatterns = [
    /\bfetch\s*\(/u,
    /https?:\/\//iu,
    /node:https?/iu,
    /process\.env/iu,
    /deepseek|api[_-]?key/iu,
    /XMLHttpRequest|WebSocket/iu,
    /clipboard/iu,
    /\b(?:curl|wget|Invoke-WebRequest|wrangler)\b/iu,
    /taskFormationPolicyP4/iu,
    /taskFormationEvaluationV2/iu,
    /projectLegacySelectionToCandidateClassifications/iu,
    /materializeRevisionRelationsByScope/iu,
    /from\s+['"][^'"]*revisionRelationResolver/iu,
  ]
  assert.deepEqual(freeze.staticSafetyReview.inspectedPaths, expectedZeroCallSourcePaths)
  for (const relativePath of expectedZeroCallSourcePaths) {
    const source = await readFile(resolve(root, relativePath), 'utf8')
    for (const pattern of forbiddenPatterns) assert.equal(pattern.test(source), false, `${relativePath}:${pattern}`)
  }
  const runnerSource = await readFile(resolve(root, 'scripts/run-rco-5-009-b9-zero-call.ts'), 'utf8')
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
  assert.deepEqual(freeze.staticSafetyReview.requiredRunnerMarkers, requiredRunnerMarkers)
  for (const marker of requiredRunnerMarkers) assert.ok(runnerSource.includes(marker), marker)
})

test('B9 one-shot run remains blocked until the frozen layer is committed and pushed', () => {
  assert.deepEqual(freeze.runPreconditions, {
    runnerFreezeCommitRequired: true,
    runnerFreezePushRequired: true,
    cleanWorktreeRequired: true,
    headEqualsUpstreamRequired: true,
    componentHashesMustMatch: true,
    outputPathsMustBeAbsent: true,
    atomicCheckpointClaimRequired: true,
  })
  assert.match(freeze.oneShotPolicy, /exactly once/i)
  assert.match(freeze.oneShotPolicy, /committed and pushed/i)
  assert.match(freeze.oneShotPolicy, /wx/i)
  assert.equal(freeze.runtimeCommand, 'npx --no-install vite-node scripts/run-rco-5-009-b9-zero-call.ts')
})

test('B9 runtime confines manifest paths and preserves terminal failure evidence', async () => {
  const runnerSource = await readFile(resolve(root, 'scripts/run-rco-5-009-b9-zero-call.ts'), 'utf8')
  const runnerFreezerSource = await readFile(resolve(root, 'scripts/freeze-rco-5-009-b9-zero-call-runner.mjs'), 'utf8')
  const resultFreezerSource = await readFile(resolve(root, 'scripts/freeze-rco-5-009-b9-zero-call-result.mjs'), 'utf8')
  for (const source of [runnerSource, runnerFreezerSource, resultFreezerSource]) {
    assert.match(source, /path prefix forbidden|REPOSITORY_PATH_PREFIX_FORBIDDEN/u)
    assert.match(source, /path escapes repository|REPOSITORY_PATH_ESCAPE/u)
  }
  assert.match(runnerSource, /FIRST_RUN_B9_ZERO_CALL_RUNTIME_FAILURE_NOW_SEEN_DEVELOPMENT/u)
  assert.match(runnerSource, /completedCaseIds: actualCases\.map/u)
  assert.match(resultFreezerSource, /checkpoint\.status === 'FAILED' && result\.status === 'FAILED'/u)
  assert.match(resultFreezerSource, /casePipelineExecutions >= 0/u)
})

test('result assertions and result-freeze controls are syntax-checked without execution', async () => {
  assert.equal(freeze.staticSafetyReview.resultAssertionTestPolicy, 'SYNTAX_CHECKED_AND_HASHED_BUT_NOT_EXECUTED_AT_RUNNER_FREEZE')
  assert.equal(freeze.staticSafetyReview.resultFreezePolicy, 'SYNTAX_CHECKED_AND_HASHED_BEFORE_RESULTS_EXIST')
  for (const relativePath of [
    'scripts/rco-5-009-b9-zero-call-result.node-test.mjs',
    ...expectedResultFreezeControlPaths,
  ]) {
    await execFileAsync(process.execPath, ['--check', resolve(root, relativePath)], { cwd: root })
  }
})
