import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import {
  ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
  type ActionCandidateClassification,
  type ActionCandidateClassificationResponse,
} from '../src/recognition/actionCandidateClassificationContract'
import { composeActionCandidatesV2 } from '../src/recognition/actionCandidateComposerV2'
import { formCandidateSafeTaskSuggestions, validateCandidateSafeTaskSuggestions } from '../src/recognition/candidateTaskSafetyPolicy'
import {
  indexLocalActionCandidatesV2,
  type LocalActionCandidate,
  type LocalActionCandidateCatalog,
} from '../src/recognition/localActionCandidateIndexV2'
import { indexImmutableScopesV11 } from '../src/recognition/scopeIndexV11'
import {
  evaluateB9ZeroCall,
  type B9ActualCandidate,
  type B9ActualCase,
  type B9ActualLedgerEntry,
  type B9ActualRevisionRelation,
  type B9ActualTask,
  type B9ExpectedCandidate,
  type B9ExpectedCase,
  type B9FixedZeroCallGate,
  type B9ResponseVerdict,
  type B9Semantics,
} from './rco-5-009-b9-evaluation'

interface B9Dataset {
  schemaVersion: string
  datasetId: string
  classification: string
  seenStatus: string
  multipleObjectChoiceStatus: string
  sampleCount: number
  cases: B9ExpectedCase[]
}

interface ComponentFreeze {
  status?: string
  componentPaths: string[]
  componentSha256: Record<string, string>
}

interface B9RunnerFreeze extends ComponentFreeze {
  status: string
  authorizationId: string
  executionMode: string
  datasetId: string
  runId: string
  dataFreezeCommitFull: string
  outputPaths: string[]
  exactAccountingContract: Accounting
  maximumRuns: number
  maximumCasePipelineExecutions: number
  paidRunAuthorized: boolean
  modelCallsAtFreeze: number
  networkRequestsAtFreeze: number
  secretAccessAtFreeze: string
  pipelineRunsAtFreeze: number
  casePipelineExecutionsAtFreeze: number
  stablePath: string
  rco6: string
  deployment: string
}

interface B9DataFreeze extends ComponentFreeze {
  datasetId: string
  datasetPath: string
  sampleCount: number
  expectedCandidateCount: number
  expectedCandidateDispositionCounts: Record<string, number>
  expectedLedgerCounts: Record<string, number>
  expectedTaskCount: number
  safeDefaultExpectedCount: number
  expectedRevisionRelationCount: number
  expectedResponsePartialCaseIds: string[]
  expectedSemanticPartialCaseIds: string[]
  multipleObjectChoiceStatus: string
  comparisonDatasetPaths: string[]
  comparisonDatasetSha256: Record<string, string>
  activeFreezeLayerIntegrity: string
  historicalTransitiveFreezeAudit: {
    status: string
    visitedManifestCount: number
    mismatchCount: number
    mismatches: HistoricalMismatch[]
  }
  fixedZeroCallGate: B9FixedZeroCallGate
  paidRunAuthorized: boolean
  modelCalls: number
  networkDispatches: number
  secretAccess: string
  stablePath: string
  rco6: string
  deployment: string
}

interface HistoricalMismatch {
  manifestPath: string
  path: string
  expectedSha256: string
  actualSha256: string
  classification: string
}

interface CandidateMapping {
  expectedByCandidateId: Map<string, B9ExpectedCandidate>
  candidateByExpectedKey: Map<string, LocalActionCandidate>
  expectedKeyByCandidateId: Map<string, string>
  issues: string[]
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runId = 'rco-5-009-b9-zero-call-20260904a'
const datasetId = 'rco-5-009-b9-development-20260904'
const dataFreezeCommit = '98123829e763b804eb6ed8669c7f0e483aed49dd'
const dataFreezePath = 'docs/recognition-optimization/RCO-5-009-B9_DATA_FREEZE.json'
const runnerFreezePath = 'docs/recognition-optimization/RCO-5-009-B9_ZERO_CALL_RUNNER_FREEZE.json'
const activeComponentFreezePath = 'docs/recognition-optimization/RCO-5-009A_COMPONENT_FREEZE.json'
const baseComponentFreezePath = 'docs/recognition-optimization/RCO-5-009_COMPONENT_FREEZE.json'
const runRelativeDirectory = `docs/recognition-optimization/rco-5-009-b9-runs/${runId}`
const runDirectory = resolve(root, runRelativeDirectory)
const checkpointPath = resolve(runDirectory, 'checkpoint.json')
const resultPath = resolve(runDirectory, 'result.json')
const reportPath = resolve(runDirectory, 'REPORT.md')
const executeFile = promisify(execFile)
interface Accounting {
  modelCalls: 0
  networkRequests: 0
  verifierCalls: 0
  repairCalls: 0
  retryCalls: 0
  secretAccess: 'NONE'
  pipelineRuns: 1
  casePipelineExecutions: number
}
const accountingFor = (casePipelineExecutions: number): Accounting => ({
  modelCalls: 0,
  networkRequests: 0,
  verifierCalls: 0,
  repairCalls: 0,
  retryCalls: 0,
  secretAccess: 'NONE',
  pipelineRuns: 1,
  casePipelineExecutions,
})
const finalAccounting = accountingFor(12)
const knownLabelLimitations = [{
  caseId: 'rco-task-b9-12',
  code: 'IMPLEMENTATION_BOUNDARY_LABEL_NOT_INDEPENDENT_SEMANTIC_TRUTH',
  detail: 'The source explicitly says the card-color condition is currently true, while frozen Expected keeps the condition unknown to test the present deterministic boundary. This case cannot support a semantic-accuracy claim.',
}]

function safeRepoPath(relativePath: string): string {
  if (typeof relativePath !== 'string' || relativePath.length === 0 || isAbsolute(relativePath)
    || relativePath.includes('\\') || relativePath.split('/').includes('..')) {
    throw new Error(`B9_UNSAFE_REPOSITORY_PATH:${String(relativePath)}`)
  }
  if (!['scripts/', 'src/recognition/', 'docs/recognition-optimization/'].some((prefix) => relativePath.startsWith(prefix))) {
    throw new Error(`B9_REPOSITORY_PATH_PREFIX_FORBIDDEN:${relativePath}`)
  }
  const resolvedPath = resolve(root, relativePath)
  const fromRoot = relative(root, resolvedPath)
  if (fromRoot === '' || fromRoot === '..' || fromRoot.startsWith('../') || fromRoot.startsWith('..\\') || isAbsolute(fromRoot)) {
    throw new Error(`B9_REPOSITORY_PATH_ESCAPE:${relativePath}`)
  }
  return resolvedPath
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false
    throw error
  }
}

async function fileSha(relativePath: string): Promise<string> {
  return createHash('sha256').update(await readFile(safeRepoPath(relativePath))).digest('hex')
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(safeRepoPath(relativePath), 'utf8')) as T
}

async function git(args: string[]): Promise<string> {
  const result = await executeFile('git', args, { cwd: root, windowsHide: true })
  return result.stdout.trim()
}

async function assertCleanPushedHead(): Promise<string> {
  const status = await git(['status', '--porcelain'])
  if (status !== '') throw new Error('B9_WORKTREE_NOT_CLEAN')
  await git(['diff', '--quiet'])
  await git(['diff', '--cached', '--quiet'])
  const head = await git(['rev-parse', 'HEAD'])
  const upstream = await git(['rev-parse', '@{u}'])
  if (head !== upstream) throw new Error('B9_HEAD_NOT_EQUAL_TO_TRACKING_REF')
  await git(['merge-base', '--is-ancestor', dataFreezeCommit, 'HEAD'])
  return head
}

async function verifyDirectFreeze(relativePath: string): Promise<ComponentFreeze> {
  const manifest = await readJson<ComponentFreeze>(relativePath)
  if (!Array.isArray(manifest.componentPaths) || !manifest.componentSha256) throw new Error(`B9_FREEZE_SHAPE_INVALID:${relativePath}`)
  for (const childPath of manifest.componentPaths) {
    if (await fileSha(childPath) !== manifest.componentSha256[childPath]) throw new Error(`B9_FROZEN_COMPONENT_DRIFT:${relativePath}:${childPath}`)
  }
  return manifest
}

function historicalClassification(path: string): string {
  return /rco-5-008-b8-runs\/.+\/(?:checkpoint|raw-results)\.json$/u.test(path)
    ? 'MUTABLE_RUN_OUTPUT_HASHED_BY_PRE_RUN_MANIFEST'
    : 'HISTORICAL_COMPONENT_CHANGED_AFTER_FREEZE'
}

async function auditNestedFreezes(startPath: string) {
  const visited = new Set<string>()
  const mismatches: HistoricalMismatch[] = []
  async function visit(manifestPath: string): Promise<void> {
    if (visited.has(manifestPath)) return
    visited.add(manifestPath)
    const manifest = await readJson<Partial<ComponentFreeze>>(manifestPath)
    if (!Array.isArray(manifest.componentPaths) || !manifest.componentSha256) return
    for (const childPath of manifest.componentPaths) {
      const actualSha256 = await fileSha(childPath)
      const expectedSha256 = manifest.componentSha256[childPath]
      if (actualSha256 !== expectedSha256) mismatches.push({
        manifestPath,
        path: childPath,
        expectedSha256,
        actualSha256,
        classification: historicalClassification(childPath),
      })
      if (childPath.endsWith('_FREEZE.json')) await visit(childPath)
    }
  }
  await visit(startPath)
  return { visitedManifestCount: visited.size, mismatchCount: mismatches.length, mismatches }
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function verifyFrozenInputs(): Promise<{ dataset: B9Dataset; dataFreeze: B9DataFreeze; runnerFreezeSha256: string }> {
  const dataFreeze = await readJson<B9DataFreeze>(dataFreezePath)
  if (dataFreeze.status !== 'DATA_EXPECTED_RESPONSE_FIXTURES_AND_009A_CHAIN_FROZEN_BEFORE_FIRST_PIPELINE_RUN'
    || dataFreeze.datasetId !== datasetId
    || dataFreeze.paidRunAuthorized
    || dataFreeze.modelCalls !== 0
    || dataFreeze.networkDispatches !== 0
    || dataFreeze.secretAccess !== 'NONE'
    || dataFreeze.stablePath !== 'UNCHANGED'
    || dataFreeze.rco6 !== 'NOT_STARTED'
    || dataFreeze.deployment !== 'NOT_RUN') {
    throw new Error('B9_DATA_FREEZE_AUTHORITY_INVALID')
  }
  for (const relativePath of dataFreeze.componentPaths) {
    if (await fileSha(relativePath) !== dataFreeze.componentSha256[relativePath]) throw new Error(`B9_DATA_FREEZE_DRIFT:${relativePath}`)
  }
  for (const relativePath of dataFreeze.comparisonDatasetPaths) {
    if (await fileSha(relativePath) !== dataFreeze.comparisonDatasetSha256[relativePath]) throw new Error(`B9_COMPARISON_FREEZE_DRIFT:${relativePath}`)
  }
  await verifyDirectFreeze(activeComponentFreezePath)
  await verifyDirectFreeze(baseComponentFreezePath)
  const nested = await auditNestedFreezes(activeComponentFreezePath)
  if (!jsonEqual(nested, {
    visitedManifestCount: dataFreeze.historicalTransitiveFreezeAudit.visitedManifestCount,
    mismatchCount: dataFreeze.historicalTransitiveFreezeAudit.mismatchCount,
    mismatches: dataFreeze.historicalTransitiveFreezeAudit.mismatches,
  }) || dataFreeze.historicalTransitiveFreezeAudit.status !== 'KNOWN_ANCESTRY_DRIFT_RECORDED_ACTIVE_009A_AND_009_DIRECT_LAYERS_INTACT') {
    throw new Error('B9_HISTORICAL_FREEZE_AUDIT_DRIFT')
  }
  const runnerFreeze = await readJson<B9RunnerFreeze>(runnerFreezePath)
  await verifyDirectFreeze(runnerFreezePath)
  const expectedOutputPaths = [
    `${runRelativeDirectory}/checkpoint.json`,
    `${runRelativeDirectory}/result.json`,
    `${runRelativeDirectory}/REPORT.md`,
  ]
  if (runnerFreeze.status !== 'RUNNER_EVALUATOR_AND_RESULT_FREEZE_METHOD_FROZEN_AWAITING_COMMIT_AND_PUSH'
    || runnerFreeze.authorizationId !== 'RCO-5-009-B9-ZERO-CALL'
    || runnerFreeze.executionMode !== 'DETERMINISTIC_RESPONSE_FIXTURE_ZERO_CALL'
    || runnerFreeze.datasetId !== datasetId
    || runnerFreeze.runId !== runId
    || runnerFreeze.dataFreezeCommitFull !== dataFreezeCommit
    || !jsonEqual(runnerFreeze.outputPaths, expectedOutputPaths)
    || !jsonEqual(runnerFreeze.exactAccountingContract, finalAccounting)
    || runnerFreeze.maximumRuns !== 1
    || runnerFreeze.maximumCasePipelineExecutions !== 12
    || runnerFreeze.paidRunAuthorized
    || runnerFreeze.modelCallsAtFreeze !== 0
    || runnerFreeze.networkRequestsAtFreeze !== 0
    || runnerFreeze.secretAccessAtFreeze !== 'NONE'
    || runnerFreeze.pipelineRunsAtFreeze !== 0
    || runnerFreeze.casePipelineExecutionsAtFreeze !== 0
    || runnerFreeze.stablePath !== 'UNCHANGED'
    || runnerFreeze.rco6 !== 'NOT_STARTED'
    || runnerFreeze.deployment !== 'NOT_RUN') {
    throw new Error('B9_RUNNER_FREEZE_AUTHORITY_INVALID')
  }
  const requiredRunnerComponents = [
    dataFreezePath,
    'scripts/rco-5-009-b9-evaluation.ts',
    'scripts/rco-5-009-b9-evaluation.test.ts',
    'scripts/run-rco-5-009-b9-zero-call.ts',
    'scripts/rco-5-009-b9-zero-call-result.node-test.mjs',
  ]
  for (const relativePath of requiredRunnerComponents) {
    if (!runnerFreeze.componentPaths.includes(relativePath)) throw new Error(`B9_RUNNER_FREEZE_COMPONENT_MISSING:${relativePath}`)
  }
  const dataset = await readJson<B9Dataset>(dataFreeze.datasetPath)
  if (dataset.datasetId !== dataFreeze.datasetId || dataset.sampleCount !== dataFreeze.sampleCount || dataset.cases.length !== dataFreeze.sampleCount) {
    throw new Error('B9_DATASET_ID_OR_COUNT_INVALID')
  }
  return { dataset, dataFreeze, runnerFreezeSha256: await fileSha(runnerFreezePath) }
}

function mapExpectedCandidates(expectedCase: B9ExpectedCase, catalog: LocalActionCandidateCatalog): CandidateMapping {
  const expectedByCandidateId = new Map<string, B9ExpectedCandidate>()
  const candidateByExpectedKey = new Map<string, LocalActionCandidate>()
  const expectedKeyByCandidateId = new Map<string, string>()
  const usedCandidateIds = new Set<string>()
  const issues: string[] = []
  for (const expected of expectedCase.expected.candidates) {
    const occurrences = catalog.candidates
      .filter((candidate) => candidate.action.surface === expected.action)
      .sort((left, right) => left.action.sourceStart - right.action.sourceStart)
    const candidate = occurrences[expected.occurrence - 1]
    if (!candidate) {
      issues.push(`EXPECTED_CANDIDATE_NOT_ENUMERATED:${expected.key}`)
      continue
    }
    if (usedCandidateIds.has(candidate.id)) {
      issues.push(`EXPECTED_CANDIDATE_MAPPING_COLLISION:${expected.key}`)
      continue
    }
    usedCandidateIds.add(candidate.id)
    expectedByCandidateId.set(candidate.id, expected)
    candidateByExpectedKey.set(expected.key, candidate)
    expectedKeyByCandidateId.set(candidate.id, expected.key)
  }
  for (const candidate of catalog.candidates) {
    if (!usedCandidateIds.has(candidate.id)) issues.push(`UNEXPECTED_ENUMERATED_CANDIDATE:${candidate.id}`)
  }
  return { expectedByCandidateId, candidateByExpectedKey, expectedKeyByCandidateId, issues }
}

function expectedObject(candidate: LocalActionCandidate | undefined, surface: string | null) {
  if (!candidate || surface === null) return null
  const matches = candidate.objectCandidates.filter((object) => object.surface === surface)
  return matches.length === 1 ? matches[0] : null
}

function responseFor(
  expectedCase: B9ExpectedCase,
  catalog: LocalActionCandidateCatalog,
  mapping: CandidateMapping,
  producerRunId: string,
): ActionCandidateClassificationResponse {
  const classifications: ActionCandidateClassification[] = catalog.candidates.map((candidate) => {
    const expected = mapping.expectedByCandidateId.get(candidate.id)
    if (!expected) return { candidateId: candidate.id, verdict: 'uncertain', objectCandidateId: null }
    let objectCandidateId: string | null = null
    if (expected.responseVerdict === 'proposition') {
      if (expected.responseObject === 'own') {
        objectCandidateId = expectedObject(candidate, expected.object)?.id ?? null
      } else if (typeof expected.responseObject === 'string') {
        const ownerExpected = expectedCase.expected.candidates.find((item) => item.key === expected.responseObject)
        const ownerCandidate = mapping.candidateByExpectedKey.get(expected.responseObject)
        objectCandidateId = expectedObject(ownerCandidate, ownerExpected?.object ?? null)?.id ?? null
      }
    }
    return { candidateId: candidate.id, verdict: expected.responseVerdict, objectCandidateId }
  })
  return {
    schemaVersion: ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
    sourceId: catalog.sourceId,
    sourceVersionId: catalog.sourceVersionId,
    sourceFingerprint: catalog.sourceFingerprint,
    catalogFingerprint: catalog.catalogFingerprint,
    producerRunId,
    classifications,
  }
}

function candidateOccurrence(catalog: LocalActionCandidateCatalog, candidate: LocalActionCandidate): number {
  return catalog.candidates
    .filter((item) => item.action.surface === candidate.action.surface)
    .sort((left, right) => left.action.sourceStart - right.action.sourceStart)
    .findIndex((item) => item.id === candidate.id) + 1
}

function actualCase(
  expectedCase: B9ExpectedCase,
  catalog: LocalActionCandidateCatalog,
  mapping: CandidateMapping,
  response: ActionCandidateClassificationResponse,
  composition: Extract<Awaited<ReturnType<typeof composeActionCandidatesV2>>, { ok: true }>['value'],
  formed: ReturnType<typeof formCandidateSafeTaskSuggestions>,
  materializerIssueCodes: string[],
  scopeTextById: Map<string, string>,
): B9ActualCase {
  const classificationById = new Map(response.classifications.map((classification) => [classification.candidateId, classification]))
  const ledgerById = new Map(composition.ledger.map((entry) => [entry.candidateId, entry]))
  const sourceText = expectedCase.sourceText
  const candidates: B9ActualCandidate[] = catalog.candidates.map((candidate) => {
    const key = mapping.expectedKeyByCandidateId.get(candidate.id) ?? null
    const classification = classificationById.get(candidate.id)
    const responseObjectIsOwnedByCandidate = classification?.objectCandidateId !== null
      && classification?.objectCandidateId !== undefined
      && candidate.objectCandidates.some((object) => object.id === classification.objectCandidateId)
    const responseObjectOtherOwners = classification?.objectCandidateId === null || classification?.objectCandidateId === undefined
      ? []
      : catalog.candidates.filter((owner) => owner.id !== candidate.id
        && owner.objectCandidates.some((object) => object.id === classification.objectCandidateId))
    const responseOwner = responseObjectIsOwnedByCandidate
      ? candidate
      : responseObjectOtherOwners.length === 1 ? responseObjectOtherOwners[0] : null
    const responseOwnerKey = responseOwner === null
      ? null
      : mapping.expectedKeyByCandidateId.get(responseOwner.id) ?? `UNMAPPED:${responseOwner.id}`
    return {
      key,
      candidateId: candidate.id,
      action: candidate.action.surface,
      occurrence: candidateOccurrence(catalog, candidate),
      actionSourceStart: candidate.action.sourceStart,
      actionSourceEnd: candidate.action.sourceEnd,
      actionSourceSlice: sourceText.slice(candidate.action.sourceStart, candidate.action.sourceEnd),
      objectCandidates: candidate.objectCandidates.map((object) => ({
        id: object.id,
        surface: object.surface,
        sourceStart: object.sourceStart,
        sourceEnd: object.sourceEnd,
        sourceSlice: sourceText.slice(object.sourceStart, object.sourceEnd),
      })),
      defaultObjectCandidateId: candidate.defaultObjectCandidateId,
      localDisposition: candidate.localDisposition,
      clauseRole: candidate.clauseRole,
      currentness: candidate.currentness,
      conditionStatus: candidate.conditionAttachment.status,
      conditionTruth: candidate.conditionAttachment.truth,
      responseVerdict: (classification?.verdict ?? 'uncertain') as B9ResponseVerdict,
      responseObjectCandidateId: classification?.objectCandidateId ?? null,
      responseObjectOwnerKey: typeof responseOwnerKey === 'string' ? responseOwnerKey : null,
    }
  })
  const ledger: B9ActualLedgerEntry[] = catalog.candidates.map((candidate) => {
    const entry = ledgerById.get(candidate.id)
    if (!entry) {
      return { candidateKey: mapping.expectedKeyByCandidateId.get(candidate.id) ?? null, candidateId: candidate.id, status: 'quarantined', objectCandidateId: null, reasonCodes: ['LEDGER_ENTRY_MISSING'] }
    }
    return {
      candidateKey: mapping.expectedKeyByCandidateId.get(candidate.id) ?? null,
      candidateId: entry.candidateId,
      status: entry.status,
      objectCandidateId: entry.objectCandidateId,
      reasonCodes: [...entry.reasons],
    }
  })
  const tasks: B9ActualTask[] = formed.tasks.map((task) => ({
    candidateKey: mapping.expectedKeyByCandidateId.get(task.originCandidateId) ?? null,
    id: task.id,
    originCandidateId: task.originCandidateId,
    occurrenceId: task.occurrenceId,
    action: task.action.surface,
    actionSourceStart: task.actionSourceStart,
    actionSourceEnd: task.actionSourceEnd,
    actionSourceSlice: sourceText.slice(task.actionSourceStart, task.actionSourceEnd),
    object: task.object.surface,
    objectCandidateId: task.objectCandidateId,
    objectSourceStart: task.objectSourceStart,
    objectSourceEnd: task.objectSourceEnd,
    objectSourceSlice: sourceText.slice(task.objectSourceStart, task.objectSourceEnd),
    semantics: { ...task.semantics } as B9Semantics,
    selected: task.selected,
    needsConfirmation: task.needsConfirmation,
    conditionStatus: task.conditionStatus,
    conditionTruth: task.conditionTruth,
  }))
  const taskById = new Map(tasks.map((task) => [task.id, task]))
  return {
    caseId: expectedCase.id,
    sourceText,
    sourceFingerprint: catalog.sourceFingerprint,
    candidatePolicyVersion: catalog.policyVersion,
    candidates,
    ledger,
    tasks,
    requiresAction: formed.requiresAction,
    responseContractComplete: formed.responseContractComplete,
    semanticCoverageComplete: formed.semanticCoverageComplete,
    issueCodes: composition.candidateIssues.map((issue) => issue.code),
    materializerIssueCodes,
    runnerIssueCodes: [...mapping.issues],
    revisionRelations: formed.revisionRelations.map((relation): B9ActualRevisionRelation => ({
      kind: relation.kind,
      targetCandidateKey: taskById.get(relation.targetTaskId)?.candidateKey ?? `UNMAPPED:${relation.targetTaskId}`,
      replacementCandidateKeys: relation.replacementTaskIds.map((taskId) => taskById.get(taskId)?.candidateKey ?? `UNMAPPED:${taskId}`),
      evidenceScopeTexts: relation.evidenceScopeIds.map((scopeId) => scopeTextById.get(scopeId) ?? `UNMAPPED:${scopeId}`),
      resolution: relation.resolution,
      referentType: relation.referentType,
    })),
    unresolvedRevisionScopeTexts: formed.unresolvedRevisionScopeIds.map((scopeId) => scopeTextById.get(scopeId) ?? `UNMAPPED:${scopeId}`),
    suppressedRevisionScopeTexts: formed.suppressedRevisionScopeIds.map((scopeId) => scopeTextById.get(scopeId) ?? `UNMAPPED:${scopeId}`),
    unresolvedActionScopeTexts: catalog.unresolvedActionScopeIds.map((scopeId) => scopeTextById.get(scopeId) ?? `UNMAPPED:${scopeId}`),
    unsafeDefaultSelections: [...formed.unsafeDefaultSelections],
  }
}

async function writeCheckpoint(value: object): Promise<void> {
  await writeFile(checkpointPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

if (await exists(runDirectory)) throw new Error('B9_ZERO_CALL_OUTPUT_DIRECTORY_ALREADY_EXISTS')
const runnerFreezeCommit = await assertCleanPushedHead()
const { dataset, dataFreeze, runnerFreezeSha256 } = await verifyFrozenInputs()
await mkdir(runDirectory, { recursive: true })
const startedAt = new Date().toISOString()
const initialCheckpoint = {
  schemaVersion: 'rco-5-009-b9-zero-call-checkpoint-1.0.0',
  datasetId,
  runId,
  status: 'STARTED',
  currentPhase: 'LOCKED_BEFORE_CASES',
  currentCaseId: null as string | null,
  startedAt,
  dataFreezeCommit,
  runnerFreezeCommit,
  completedCaseIds: [] as string[],
  accounting: accountingFor(0),
  stablePath: 'UNCHANGED',
  rco6: 'NOT_STARTED',
  deployment: 'NOT_RUN',
}
await writeFile(checkpointPath, `${JSON.stringify(initialCheckpoint, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })

let casePipelineExecutions = 0
let currentCaseId: string | null = null
let currentPhase = 'LOCKED_BEFORE_CASES'
const actualCases: B9ActualCase[] = []
try {
  for (const expectedCase of dataset.cases) {
    casePipelineExecutions += 1
    currentCaseId = expectedCase.id
    currentPhase = 'CASE_PIPELINE'
    await writeCheckpoint({
      ...initialCheckpoint,
      status: 'RUNNING',
      currentPhase: 'CASE_PIPELINE',
      currentCaseId,
      runnerFreezeSha256,
      completedCaseIds: actualCases.map((item) => item.caseId),
      completedCaseCount: actualCases.length,
      accounting: accountingFor(casePipelineExecutions),
    })
    const index = await indexImmutableScopesV11(expectedCase.id, 'source-v1', expectedCase.sourceText)
    const catalog = await indexLocalActionCandidatesV2(index)
    const mapping = mapExpectedCandidates(expectedCase, catalog)
    const producerRunId = `${runId}:${expectedCase.id}`
    const response = responseFor(expectedCase, catalog, mapping, producerRunId)
    const composed = await composeActionCandidatesV2(index, catalog, response, producerRunId)
    if (!composed.ok) throw new Error(`B9_COMPOSITION_ROOT_REJECTED:${expectedCase.id}:${composed.issues.map((issue) => issue.code).join(',')}`)
    const formed = formCandidateSafeTaskSuggestions(index, catalog, composed.value)
    const materializerIssueCodes = validateCandidateSafeTaskSuggestions(formed, index, catalog, composed.value).map((issue) => issue.code)
    const scopeTextById = new Map(index.scopes.map((scope) => [scope.id, scope.text]))
    const normalized = actualCase(expectedCase, catalog, mapping, response, composed.value, formed, materializerIssueCodes, scopeTextById)
    actualCases.push(normalized)
    currentPhase = 'CASE_COMPLETED'
    await writeCheckpoint({
      ...initialCheckpoint,
      status: 'RUNNING',
      currentPhase: 'CASE_COMPLETED',
      currentCaseId,
      runnerFreezeSha256,
      completedCaseIds: actualCases.map((item) => item.caseId),
      completedCaseCount: actualCases.length,
      accounting: accountingFor(casePipelineExecutions),
    })
  }

  currentPhase = 'EVALUATION'
  const evaluation = evaluateB9ZeroCall(dataset.cases, actualCases, dataFreeze.fixedZeroCallGate)
  currentCaseId = null
  const expectedCountsMatchFreeze = evaluation.counts.expectedCases === dataFreeze.sampleCount
    && evaluation.counts.expectedCandidates === dataFreeze.expectedCandidateCount
    && jsonEqual(evaluation.counts.expectedLedger, dataFreeze.expectedLedgerCounts)
    && evaluation.counts.expectedTasks === dataFreeze.expectedTaskCount
    && evaluation.counts.expectedSelectedTasks === dataFreeze.safeDefaultExpectedCount
    && evaluation.counts.expectedRevisionRelations === dataFreeze.expectedRevisionRelationCount
  if (!expectedCountsMatchFreeze) evaluation.gateFailures.push('EXPECTED_COUNTS_DO_NOT_MATCH_DATA_FREEZE')
  if (evaluation.gateFailures.length > 0) evaluation.gate = 'FAIL'
  const completedAt = new Date().toISOString()
  const result = {
    schemaVersion: 'rco-5-009-b9-zero-call-result-1.0.0',
    authorizationId: 'RCO-5-009-B9-ZERO-CALL',
    datasetId,
    runId,
    status: 'COMPLETED',
    currentPhase: 'COMPLETED',
    currentCaseId,
    classification: 'FIRST_RUN_B9_ZERO_CALL_NOW_SEEN_DEVELOPMENT',
    startedAt,
    completedAt,
    dataFreezeCommit,
    runnerFreezeCommit,
    runnerFreezeSha256,
    accounting: finalAccounting,
    inputClassification: dataset.classification,
    responseAuthority: 'FROZEN_LOCAL_CLOSED_SET_FIXTURES',
    multipleObjectChoiceStatus: dataset.multipleObjectChoiceStatus,
    evaluation,
    metrics: evaluation.metrics,
    counts: evaluation.counts,
    gateFailures: evaluation.gateFailures,
    gate: evaluation.gate,
    decision: evaluation.gate === 'PASS'
      ? 'B9_ZERO_CALL_DIRECT_CANDIDATE_GATE_PASS_LOCAL_ARCHITECTURE_ONLY_WITH_KNOWN_LABEL_LIMITATION'
      : 'B9_ZERO_CALL_DIRECT_CANDIDATE_GATE_FAIL_RETAIN_RESULT_AND_USE_B10_FOR_ANY_FIX',
    evidenceBoundary: {
      data: 'Single-author synthetic Development evidence only.',
      response: 'Frozen local response fixtures are representability inputs, not a model measurement.',
      scope: 'No image, OCR, real material, independent human truth, user timing, browser acceptance or release evidence.',
      generalization: 'B9 became seen when this single batch pipeline attempt started.',
    },
    knownLabelLimitations,
    paidRun: 'NOT_AUTHORIZED',
    stablePath: 'UNCHANGED',
    rco6: 'NOT_STARTED',
    deployment: 'NOT_RUN',
    cases: actualCases,
  }
  const metricRows = Object.entries(evaluation.metrics).map(([name, value]) => `| ${name} | ${value} |`)
  const caseRows = evaluation.cases.map((item) => `| ${item.caseId} | ${item.passed ? 'PASS' : 'FAIL'} | ${item.failures.join(', ') || '-'} |`)
  const report = [
    '# RCO-5-009 B9 首次零调用结果',
    '',
    `- 状态：${result.status}`,
    `- 门：${result.gate}`,
    `- 决策：${result.decision}`,
    `- 批次：${runId}`,
    '- 调用边界：模型 0、网络 0、verifier 0、Repair 0、retry 0、Secret NONE。',
    '- 证据边界：单作者匿名合成 Development；响应是冻结的本机闭集夹具，只检验架构可表达性。',
    '- 已知标签限制：B9-12 原文已说明条件发生，但冻结答案仍按“条件未知”检验当前实现边界；不得把该项满分说成语义正确率。',
    '- B9 自本次批次尝试开始即为已见；若失败只能保留结果并转到 B10。',
    '',
    '## 固定指标',
    '',
    '| 指标 | 结果 |',
    '|---|---:|',
    ...metricRows,
    '',
    '## 逐例',
    '',
    '| 案例 | 状态 | 失败项 |',
    '|---|---|---|',
    ...caseRows,
    '',
    '## 不变量',
    '',
    '- 正式稳定路径未改动。',
    '- RCO-6 未启动。',
    '- 未部署。',
    `- 多对象能力：${result.multipleObjectChoiceStatus}。`,
    '',
  ].join('\n')
  currentPhase = 'RESULT_WRITE'
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  await writeFile(reportPath, report, 'utf8')
  currentPhase = 'CHECKPOINT_FINALIZE'
  await writeCheckpoint({
    ...initialCheckpoint,
    status: 'COMPLETED',
    currentPhase: 'COMPLETED',
    currentCaseId,
    completedAt,
    runnerFreezeSha256,
    completedCaseIds: actualCases.map((item) => item.caseId),
    completedCaseCount: actualCases.length,
    accounting: finalAccounting,
    gate: evaluation.gate,
    resultPath: `${runRelativeDirectory}/result.json`,
    reportPath: `${runRelativeDirectory}/REPORT.md`,
  })
  console.log(JSON.stringify({ datasetId, runId, status: 'COMPLETED', gate: evaluation.gate, accounting: finalAccounting }))
} catch (error) {
  const failedAt = new Date().toISOString()
  const failureCode = error instanceof Error ? error.message.replace(/[\r\n]+/gu, ' ').slice(0, 500) : 'UNKNOWN_FAILURE'
  const failurePhase = currentPhase
  const failureAccounting = accountingFor(casePipelineExecutions)
  const gateFailures = [`RUNTIME_FAILURE:${failureCode}`]
  const failureResult = {
    schemaVersion: 'rco-5-009-b9-zero-call-result-1.0.0',
    authorizationId: 'RCO-5-009-B9-ZERO-CALL',
    datasetId,
    runId,
    status: 'FAILED',
    currentPhase: 'FAILED',
    failurePhase,
    currentCaseId,
    classification: 'FIRST_RUN_B9_ZERO_CALL_RUNTIME_FAILURE_NOW_SEEN_DEVELOPMENT',
    startedAt,
    failedAt,
    failureCode,
    dataFreezeCommit,
    runnerFreezeCommit,
    runnerFreezeSha256,
    accounting: failureAccounting,
    inputClassification: dataset.classification,
    responseAuthority: 'FROZEN_LOCAL_CLOSED_SET_FIXTURES',
    multipleObjectChoiceStatus: dataset.multipleObjectChoiceStatus,
    evaluation: {
      gate: 'FAIL',
      gateFailures,
      counts: null,
      metrics: null,
      metricCounts: {},
      cases: [],
    },
    metrics: null,
    counts: null,
    gateFailures,
    gate: 'FAIL',
    decision: 'B9_ZERO_CALL_RUNTIME_FAILURE_RETAIN_RESULT_AND_USE_B10_FOR_ANY_FIX',
    evidenceBoundary: {
      data: 'Single-author synthetic Development evidence only.',
      response: 'Frozen local response fixtures are representability inputs, not a model measurement.',
      scope: 'No image, OCR, real material, independent human truth, user timing, browser acceptance or release evidence.',
      generalization: 'B9 became seen when this single batch pipeline attempt started.',
    },
    knownLabelLimitations,
    paidRun: 'NOT_AUTHORIZED',
    stablePath: 'UNCHANGED',
    rco6: 'NOT_STARTED',
    deployment: 'NOT_RUN',
    completedCaseCount: actualCases.length,
    cases: actualCases,
  }
  const failureReport = [
    '# RCO-5-009 B9 首次零调用失败记录',
    '',
    '- 状态：FAILED',
    '- 门：FAIL',
    `- 失败码：${failureCode}`,
    `- 失败阶段：${failurePhase}`,
    `- 已完成案例：${actualCases.length}/12`,
    '- 调用边界：模型 0、网络 0、verifier 0、Repair 0、retry 0、Secret NONE。',
    '- 已知标签限制：B9-12 是当前实现边界标签，不是独立语义真值。',
    '- B9 已因本次唯一尝试成为已见数据；不得重跑，只能保留证据并转到 B10。',
    '- 正式稳定路径未改动；RCO-6 未启动；未部署。',
    '',
  ].join('\n')
  await writeFile(resultPath, `${JSON.stringify(failureResult, null, 2)}\n`, 'utf8')
  await writeFile(reportPath, failureReport, 'utf8')
  await writeCheckpoint({
    ...initialCheckpoint,
    status: 'FAILED',
    currentPhase: 'FAILED',
    failurePhase,
    currentCaseId,
    failedAt,
    failureCode,
    runnerFreezeSha256,
    completedCaseIds: actualCases.map((item) => item.caseId),
    completedCaseCount: actualCases.length,
    accounting: failureAccounting,
    gate: 'FAIL',
    resultPath: `${runRelativeDirectory}/result.json`,
    reportPath: `${runRelativeDirectory}/REPORT.md`,
  })
  throw error
}
