import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
  type ActionCandidateClassificationResponse,
  type ActionCandidateVerdict,
} from '../src/recognition/actionCandidateClassificationContract'
import { composeActionCandidatesV2 } from '../src/recognition/actionCandidateComposerV2'
import {
  formCandidateSafeTaskSuggestionsV2,
  validateCandidateSafeTaskSuggestionsV2,
} from '../src/recognition/candidateTaskSafetyPolicyV2'
import { compareExactCountMaps } from '../src/recognition/countMapComparison'
import { indexLocalActionCandidatesV2 } from '../src/recognition/localActionCandidateIndexV2'
import { indexImmutableScopesV11 } from '../src/recognition/scopeIndexV11'

interface DatasetCase {
  id: string
  sourceText: string
  expected: {
    requiresAction: boolean | null
    tasks: Array<{ candidateKey: string; selected: boolean }>
  }
}

interface Dataset { datasetId: string; cases: DatasetCase[] }

interface FrozenCandidate {
  key: string
  candidateId: string
  responseVerdict: ActionCandidateVerdict
  responseObjectCandidateId: string | null
}

interface FrozenCase { caseId: string; candidates: FrozenCandidate[] }

interface FrozenResult {
  evaluation: {
    gate: string
    gateFailures: string[]
    counts: { actualLedger: Record<string, number> }
  }
  knownLabelLimitations: Array<{ caseId: string; code: string }>
  cases: FrozenCase[]
}

interface FreezeManifest {
  componentPaths: string[]
  componentSha256: Record<string, string>
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataFreezePath = 'docs/recognition-optimization/RCO-5-009-B9_DATA_FREEZE.json'
const resultFreezePath = 'docs/recognition-optimization/RCO-5-009-B9_ZERO_CALL_RESULT_FREEZE.json'
const datasetPath = 'docs/recognition-optimization/RCO-5-009-B9_DEVELOPMENT_DATASET.json'
const frozenResultPath = 'docs/recognition-optimization/rco-5-009-b9-runs/rco-5-009-b9-zero-call-20260904a/result.json'
const outputDirectory = 'docs/recognition-optimization/rco-5-010-seen-b9-replay'
const resultPath = `${outputDirectory}/result.json`
const reportPath = `${outputDirectory}/REPORT.md`
const ledgerKeys = ['accepted_local', 'accepted_model', 'ignored_local', 'ignored_model', 'quarantined'] as const

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(root, path), 'utf8')) as T
}

async function sha256(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
}

async function verifyManifest(path: string): Promise<{ path: string; sha256: string; checked: number; issues: string[] }> {
  const manifest = await readJson<FreezeManifest>(path)
  const issues: string[] = []
  for (const componentPath of manifest.componentPaths) {
    const expected = manifest.componentSha256[componentPath]?.replace(/^sha256:/u, '')
    const actual = await sha256(componentPath)
    if (!expected || expected !== actual) issues.push(`FREEZE_HASH_MISMATCH:${componentPath}`)
  }
  return { path, sha256: await sha256(path), checked: manifest.componentPaths.length, issues }
}

async function assertOutputAbsent(path: string): Promise<void> {
  try {
    await access(resolve(root, path))
    throw new Error(`RCO5010_REPLAY_OUTPUT_ALREADY_EXISTS:${path}`)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('RCO5010_')) throw error
  }
}

const [dataFreeze, resultFreeze, dataset, frozenResult] = await Promise.all([
  readJson<FreezeManifest & { expectedLedgerCounts: Record<string, number> }>(dataFreezePath),
  readJson<FreezeManifest>(resultFreezePath),
  readJson<Dataset>(datasetPath),
  readJson<FrozenResult>(frozenResultPath),
])
void dataFreeze
void resultFreeze

await Promise.all([assertOutputAbsent(resultPath), assertOutputAbsent(reportPath)])

const freezeChecks = await Promise.all([verifyManifest(dataFreezePath), verifyManifest(resultFreezePath)])
const cases = []
for (const fixture of dataset.cases) {
  const historical = frozenResult.cases.find((item) => item.caseId === fixture.id)
  if (!historical) throw new Error(`RCO5010_FROZEN_CASE_MISSING:${fixture.id}`)
  const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
  const catalog = await indexLocalActionCandidatesV2(index)
  const catalogIds = catalog.candidates.map((candidate) => candidate.id)
  const historicalIds = historical.candidates.map((candidate) => candidate.candidateId)
  if (JSON.stringify(catalogIds) !== JSON.stringify(historicalIds)) {
    throw new Error(`RCO5010_FROZEN_CANDIDATE_ID_DRIFT:${fixture.id}`)
  }
  const response: ActionCandidateClassificationResponse = {
    schemaVersion: ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
    sourceId: catalog.sourceId,
    sourceVersionId: catalog.sourceVersionId,
    sourceFingerprint: catalog.sourceFingerprint,
    catalogFingerprint: catalog.catalogFingerprint,
    producerRunId: `rco-5-010-seen-b9-${fixture.id}`,
    classifications: historical.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      verdict: candidate.responseVerdict,
      objectCandidateId: candidate.responseObjectCandidateId,
    })),
  }
  const composition = await composeActionCandidatesV2(index, catalog, response, response.producerRunId)
  if (!composition.ok) throw new Error(`RCO5010_COMPOSITION_FAILED:${fixture.id}`)
  const pipeline = await formCandidateSafeTaskSuggestionsV2(index, catalog, composition.value)
  const validationIssues = await validateCandidateSafeTaskSuggestionsV2(pipeline, index, catalog, composition.value)
  const candidateIdByKey = new Map(historical.candidates.map((candidate) => [candidate.key, candidate.candidateId]))
  const expectedSelectedIds = fixture.expected.tasks
    .filter((task) => task.selected)
    .map((task) => candidateIdByKey.get(task.candidateKey))
    .filter((id): id is string => Boolean(id))
  const actualSelectedIds = pipeline.result.tasks.filter((task) => task.selected).map((task) => task.originCandidateId)
  const extraDefaultSelectionIds = actualSelectedIds.filter((id) => !expectedSelectedIds.includes(id))
  cases.push({
    caseId: fixture.id,
    implementationExpectedRequiresAction: fixture.expected.requiresAction,
    actualRequiresAction: pipeline.result.requiresAction,
    validationIssues,
    actualSelectedIds,
    expectedSelectedIds,
    extraDefaultSelectionIds,
    unsafeDefaultSelectionIds: pipeline.result.unsafeDefaultSelections,
    confirmedNonTaskCandidateIds: pipeline.result.fullPropositionAdjudication.confirmedNonTaskCandidateIds,
    unresolvedCandidateIds: pipeline.result.actionabilityDecision.unresolvedCandidateIds,
    resolvedNonActionScopeIds: pipeline.result.fullPropositionAdjudication.resolvedNonActionScopeIds,
  })
}

const countComparison = compareExactCountMaps(
  (dataFreeze as FreezeManifest & { expectedLedgerCounts: Record<string, number> }).expectedLedgerCounts,
  frozenResult.evaluation.counts.actualLedger,
  ledgerKeys,
)
const requiresActionMismatches = cases
  .filter((item) => item.implementationExpectedRequiresAction !== item.actualRequiresAction)
  .map((item) => ({
    caseId: item.caseId,
    expected: item.implementationExpectedRequiresAction,
    actual: item.actualRequiresAction,
  }))
const validationIssueCount = cases.reduce((sum, item) => sum + item.validationIssues.length, 0)
const extraDefaultSelectionCount = cases.reduce((sum, item) => sum + item.extraDefaultSelectionIds.length, 0)
const unsafeDefaultSelectionCount = cases.reduce((sum, item) => sum + item.unsafeDefaultSelectionIds.length, 0)
const b907 = cases.find((item) => item.caseId === 'rco-task-b9-07')
const b912LimitationRegistered = frozenResult.knownLabelLimitations.some((item) => item.caseId === 'rco-task-b9-12'
  && item.code === 'IMPLEMENTATION_BOUNDARY_LABEL_NOT_INDEPENDENT_SEMANTIC_TRUTH')
const expectedMismatchShape = requiresActionMismatches.length === 1
  && requiresActionMismatches[0].caseId === 'rco-task-b9-07'
  && requiresActionMismatches[0].expected === false
  && requiresActionMismatches[0].actual === null
const diagnosticGate = freezeChecks.every((check) => check.issues.length === 0)
  && frozenResult.evaluation.gate === 'FAIL'
  && countComparison.exact
  && validationIssueCount === 0
  && extraDefaultSelectionCount === 0
  && unsafeDefaultSelectionCount === 0
  && expectedMismatchShape
  && b907?.confirmedNonTaskCandidateIds.length === 0
  && b907?.unresolvedCandidateIds.length !== 0
  && b912LimitationRegistered

const result = {
  schemaVersion: 'rco-5-010-seen-b9-replay-result-1.0.0',
  stage: 'RCO-5-010-CLOSE',
  classification: 'SEEN_B9_DIAGNOSTIC_REPLAY',
  datasetId: dataset.datasetId,
  accounting: {
    modelCalls: 0,
    networkRequests: 0,
    verifierCalls: 0,
    repairCalls: 0,
    retryCalls: 0,
    secretAccess: 'NONE',
    pipelineRuns: 1,
    casePipelineExecutions: cases.length,
    costCny: 0,
  },
  protectedInputFreezeChecks: freezeChecks,
  historicalB9: {
    gate: frozenResult.evaluation.gate,
    gateFailures: frozenResult.evaluation.gateFailures,
    changed: false,
    rerun: false,
  },
  countComparison,
  implementationExpectation: {
    caseCount: cases.length,
    requiresActionCorrect: cases.length - requiresActionMismatches.length,
    requiresActionMismatches,
  },
  semanticTruth: {
    status: 'NOT_AVAILABLE',
    scoredCases: 0,
    accuracy: null,
    reason: 'B9_EXPECTED_IS_NOT_AN_INDEPENDENT_NO_CONTEXT_SEMANTIC_TRUTH_SET',
  },
  safety: { validationIssueCount, extraDefaultSelectionCount, unsafeDefaultSelectionCount },
  knownLimitations: {
    b907: 'AMBIGUOUS_PROPOSITION_REMAINS_NULL_AND_IS_NOT_FORCED_TO_MATCH_FROZEN_FALSE',
    b912: b912LimitationRegistered ? 'NOT_SEMANTICALLY_SCOREABLE' : 'LIMITATION_REGISTRATION_MISSING',
  },
  diagnosticGate: diagnosticGate ? 'PASS' : 'FAIL',
  decision: diagnosticGate
    ? 'RCO_5_010_SEEN_DIAGNOSTIC_PASS_B9_HISTORICAL_FAIL_REMAINS'
    : 'RCO_5_010_SEEN_DIAGNOSTIC_FAIL',
  claimsBlocked: ['MODEL_ACCURACY', 'UNSEEN_GENERALIZATION', 'OCR_OR_VISION_QUALITY', 'PRODUCTION_READINESS'],
  stablePath: 'NOT_CONNECTED',
  rco6: 'NOT_STARTED',
  deployment: 'NOT_RUN',
  cases,
}

if (!diagnosticGate) throw new Error('RCO5010_SEEN_B9_DIAGNOSTIC_GATE_FAILED')

const report = `# RCO-5-010 已见 B9 零调用诊断回放\n\n`
  + `## 结论\n\n`
  + `- RCO-5-010 诊断门：**PASS**。\n`
  + `- 原始 B9：仍为 **FAIL**；本次没有重跑、修改或改称通过。\n`
  + `- 计数映射：逐固定键一致；历史的 \`EXPECTED_COUNTS_DO_NOT_MATCH_DATA_FREEZE\` 计数失败项由 JSON 对象键顺序造成，不能解释另一项 B9-07 语义差异。\n`
  + `- implementation expectation requiresAction：${cases.length - requiresActionMismatches.length}/${cases.length}；唯一差异仍是 B9-07 的 \`false → null\`。\n`
  + `- 相对冻结 implementation expectation 的额外默认勾选：${extraDefaultSelectionCount}；内部安全策略报告的违规默认勾选：${unsafeDefaultSelectionCount}。\n`
  + `- 模型/网络/verifier/Repair/retry/Secret/费用：\`0/0/0/0/0/NONE/0 CNY\`。\n\n`
  + `## 语义边界\n\n`
  + `B9 不是独立无上下文语义真值集，因此本报告不计算模型或语义正确率。B9-07 原句仍有结构歧义，保持 \`null\`，不为追分强改。B9-12 继续标为 \`NOT_SEMANTICALLY_SCOREABLE\`。\n\n`
  + `## 下一门\n\n`
  + `本报告只能支持完成 RCO-5-010 的已见诊断。全量工程门、组件冻结和独立审查通过前不得创建 B10；付费模型、RCO-6、稳定路径和部署继续阻塞。\n`

await mkdir(resolve(root, outputDirectory), { recursive: true })
await writeFile(resolve(root, resultPath), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
await writeFile(resolve(root, reportPath), report, 'utf8')
console.log(JSON.stringify({
  diagnosticGate: result.diagnosticGate,
  historicalB9Gate: result.historicalB9.gate,
  cases: cases.length,
  requiresActionCorrect: result.implementationExpectation.requiresActionCorrect,
  countComparisonExact: countComparison.exact,
  unsafeDefaultSelectionCount,
  extraDefaultSelectionCount,
  accounting: result.accounting,
}, null, 2))
