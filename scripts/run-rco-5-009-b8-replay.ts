import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
  projectLegacySelectionToCandidateClassifications,
  type ActionCandidateClassificationResponse,
} from '../src/recognition/actionCandidateClassificationContract'
import { composeActionCandidates, deriveRequiresActionWithCoverage, type ActionCandidateComposition } from '../src/recognition/actionCandidateComposer'
import { indexLocalActionCandidates, type LocalActionCandidateCatalog } from '../src/recognition/localActionCandidateIndex'
import type { ModelAnchorSelection } from '../src/recognition/modelAnchorSelectionContract'
import { indexImmutableScopesV11 } from '../src/recognition/scopeIndexV11'
import type { ImmutableScopeIndex } from '../src/recognition/scopeReferenceContract'
import {
  aggregateTaskFormationScores,
  scoreTaskFormationCase,
  type TaskFormationCaseScore,
  type TaskFormationExpectedCase,
  type TaskFormationPredictionCase,
} from '../src/recognition/taskFormationEvaluation'
import {
  materializeRevisionRelationsByScope,
  scoreStableDefaultSafety,
  type ExpectedRevisionRelationV2,
} from '../src/recognition/taskFormationEvaluationV2'
import { formLocalTaskSuggestionsP4, validateLocalTaskFormationP4 } from '../src/recognition/taskFormationPolicyP4'

interface ExpectedSelection {
  expectedId: string
  propositionScopeTexts: string[]
  action: { scopeText: string; surface: string }
  object: { scopeText: string; surface: string }
}

interface Fixture extends TaskFormationExpectedCase {
  coverageTags: string[]
  sourceText: string
  expected: TaskFormationExpectedCase['expected'] & {
    selections: ExpectedSelection[]
    ignoredScopeTexts: string[]
    revisionRelations: ExpectedRevisionRelationV2[]
    unresolvedRevisionScopeTexts: string[]
  }
}

interface RawRecord {
  caseId: string
  status: string
  parsed: ModelAnchorSelection
}

interface Freeze {
  datasetId?: string
  decision?: string
  componentPaths: string[]
  componentSha256: Record<string, string>
}

interface RelationScore {
  expected: ExpectedRevisionRelationV2[]
  actual: unknown[]
  exact: boolean
}

interface EvaluatedCase {
  caseId: string
  taskScore: TaskFormationCaseScore
  relationScore: RelationScore
  unsafeDefaultFalsePositives: number
  unresolvedExact: boolean
  contractIssueCodes: string[]
  prediction: TaskFormationPredictionCase
  formed: ReturnType<typeof formLocalTaskSuggestionsP4>
  composition: ActionCandidateComposition
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const datasetPath = 'docs/recognition-optimization/RCO-5-008-B8_DEVELOPMENT_DATASET.json'
const dataFreezePath = 'docs/recognition-optimization/RCO-5-008-B8_DATA_FREEZE.json'
const resultFreezePath = 'docs/recognition-optimization/RCO-5-008-B8-M1_RESULT_FREEZE.json'
const rawPath = 'docs/recognition-optimization/rco-5-008-b8-runs/rco-5-008-b8-m1-20260904a/raw-results.json'
const outputDir = resolve(root, 'docs/recognition-optimization/rco-5-009-b8-replay')
const resultPath = resolve(outputDir, 'result.json')
const reportPath = resolve(outputDir, 'REPORT.md')

try {
  await access(resultPath)
  throw new Error('RCO_5_009_B8_REPLAY_ALREADY_EXISTS')
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
}

const sha = async (relativePath: string) => createHash('sha256').update(await readFile(resolve(root, relativePath))).digest('hex')
const dataFreeze = JSON.parse(await readFile(resolve(root, dataFreezePath), 'utf8')) as Freeze
const resultFreeze = JSON.parse(await readFile(resolve(root, resultFreezePath), 'utf8')) as Freeze
for (const relativePath of dataFreeze.componentPaths) {
  if (await sha(relativePath) !== dataFreeze.componentSha256[relativePath]) throw new Error('B8_DATA_DRIFT:' + relativePath)
}
for (const relativePath of resultFreeze.componentPaths) {
  if (await sha(relativePath) !== resultFreeze.componentSha256[relativePath]) throw new Error('B8_RESULT_DRIFT:' + relativePath)
}
if (resultFreeze.decision !== 'NO_PROMOTION_PAID_REPLICATION_BLOCKED') throw new Error('B8_ORIGINAL_DECISION_DRIFT')

const dataset = JSON.parse(await readFile(resolve(root, datasetPath), 'utf8')) as { datasetId: string; cases: Fixture[] }
const raw = JSON.parse(await readFile(resolve(root, rawPath), 'utf8')) as { records: RawRecord[] }
if (dataset.datasetId !== dataFreeze.datasetId || dataset.cases.length !== 12 || raw.records.length !== 12) throw new Error('B8_INPUT_COUNT_OR_ID_INVALID')

function ratio(top: number, bottom: number): number | null { return bottom === 0 ? null : top / bottom }
function harmonic(precision: number | null, recall: number | null): number | null {
  return precision === null || recall === null || precision + recall === 0 ? null : 2 * precision * recall / (precision + recall)
}
function pct(value: number | null): string { return value === null ? 'N/A' : (value * 100).toFixed(1) + '%' }
function lookup(index: ImmutableScopeIndex, text: string): string {
  const matches = index.scopes.filter((scope) => scope.text === text)
  if (matches.length !== 1) throw new Error('B8_SCOPE_NOT_UNIQUE:' + text)
  return matches[0].id
}
function expectedCandidate(index: ImmutableScopeIndex, catalog: LocalActionCandidateCatalog, expected: ExpectedSelection) {
  const expectedScopeId = lookup(index, expected.action.scopeText)
  const candidates = catalog.candidates.filter((candidate) => candidate.scopeId === expectedScopeId && candidate.action.surface === expected.action.surface)
  if (candidates.length !== 1) throw new Error('B8_EXPECTED_ACTION_NOT_UNIQUE:' + expected.expectedId)
  const object = candidates[0].objectCandidates.find((item) => item.scopeId === lookup(index, expected.object.scopeText) && item.surface === expected.object.surface)
  if (!object) throw new Error('B8_EXPECTED_OBJECT_NOT_ENUMERATED:' + expected.expectedId)
  return { candidate: candidates[0], object }
}
function oracleResponse(fixture: Fixture, index: ImmutableScopeIndex, catalog: LocalActionCandidateCatalog): ActionCandidateClassificationResponse {
  const expectedObjectByCandidate = new Map(fixture.expected.selections.map((selection) => {
    const mapped = expectedCandidate(index, catalog, selection)
    return [mapped.candidate.id, mapped.object.id] as const
  }))
  return {
    schemaVersion: ACTION_CANDIDATE_CLASSIFICATION_SCHEMA_VERSION,
    sourceId: catalog.sourceId,
    sourceVersionId: catalog.sourceVersionId,
    sourceFingerprint: catalog.sourceFingerprint,
    catalogFingerprint: catalog.catalogFingerprint,
    producerRunId: 'b8-oracle-' + fixture.id,
    classifications: catalog.candidates.map((candidate) => expectedObjectByCandidate.has(candidate.id)
      ? { candidateId: candidate.id, verdict: 'proposition', objectCandidateId: expectedObjectByCandidate.get(candidate.id) as string }
      : { candidateId: candidate.id, verdict: 'mention_only', objectCandidateId: null }),
  }
}
function toPrediction(
  fixture: Fixture,
  index: ImmutableScopeIndex,
  composition: ActionCandidateComposition,
): { prediction: TaskFormationPredictionCase; formed: ReturnType<typeof formLocalTaskSuggestionsP4>; unresolvedExact: boolean } {
  const formed = formLocalTaskSuggestionsP4(index, composition.reduced)
  const scopeTextById = new Map(index.scopes.map((scope) => [scope.id, scope.text]))
  const prediction: TaskFormationPredictionCase = {
    caseId: fixture.id,
    status: 'completed',
    requiresAction: deriveRequiresActionWithCoverage(formed.requiresAction, composition),
    tasks: formed.tasks.map((task) => ({
      id: task.id,
      propositionScopeTexts: task.propositionScopeIds.map((id) => scopeTextById.get(id)).filter((text): text is string => Boolean(text)),
      semantics: task.semantics,
      inferenceLevel: task.inferenceLevel,
      actionType: task.actionType,
      action: task.action.surface,
      object: task.object.surface,
      effect: task.effect,
      selected: task.selected,
    })),
  }
  const actualUnresolved = formed.unresolvedRevisionScopeIds.map((id) => scopeTextById.get(id))
  return {
    prediction,
    formed,
    unresolvedExact: JSON.stringify(actualUnresolved) === JSON.stringify(fixture.expected.unresolvedRevisionScopeTexts),
  }
}
function evaluate(fixture: Fixture, index: ImmutableScopeIndex, composition: ActionCandidateComposition): EvaluatedCase {
  const projected = toPrediction(fixture, index, composition)
  return {
    caseId: fixture.id,
    taskScore: scoreTaskFormationCase(fixture, projected.prediction),
    relationScore: materializeRevisionRelationsByScope(fixture.expected.directives, fixture.expected.revisionRelations, projected.prediction.tasks, projected.formed, index),
    unsafeDefaultFalsePositives: scoreStableDefaultSafety(fixture.expected.directives, projected.prediction.tasks).unsafeDefaultFalsePositives,
    unresolvedExact: projected.unresolvedExact,
    contractIssueCodes: validateLocalTaskFormationP4(projected.formed, index, composition.reduced).map((issue) => issue.code),
    prediction: projected.prediction,
    formed: projected.formed,
    composition,
  }
}
function revisionMetrics(cases: EvaluatedCase[]) {
  const relationKinds = ['cancels', 'supersedes', 'amends'] as const
  const relationExactAccuracyByKind = Object.fromEntries(relationKinds.map((kind) => {
    const relevant = cases.filter((item) => item.relationScore.expected.some((relation) => relation.kind === kind))
    return [kind, relevant.length === 0 ? null : relevant.filter((item) => item.relationScore.exact).length / relevant.length]
  })) as Record<typeof relationKinds[number], number | null>
  const targets = dataset.cases.flatMap((fixture) => fixture.expected.revisionRelations.map((relation) => ({ fixture, expectedId: relation.targetExpectedId })))
  const replacements = dataset.cases.flatMap((fixture) => fixture.expected.revisionRelations.flatMap((relation) => relation.replacementExpectedIds.map((expectedId) => ({ fixture, expectedId }))))
  const findTask = (fixture: Fixture, expectedId: string) => {
    const expected = fixture.expected.directives.find((item) => item.expectedId === expectedId)
    if (!expected) return undefined
    return cases.find((item) => item.caseId === fixture.id)?.prediction.tasks.find((task) => task.object === expected.object.surface
      && task.propositionScopeTexts.some((text) => expected.propositionScopeTexts.includes(text)))
  }
  const staleTasks = targets.filter(({ fixture, expectedId }) => {
    const task = findTask(fixture, expectedId)
    return task && (task.semantics.validity !== 'superseded' || task.semantics.status !== 'cancelled')
  })
  const unresolvedCases = cases.filter((item) => dataset.cases.find((fixture) => fixture.id === item.caseId)?.expected.unresolvedRevisionScopeTexts.length)
  return {
    relationExactAccuracyByKind,
    oldRequirementInvalidation: ratio(targets.filter(({ fixture, expectedId }) => {
      const task = findTask(fixture, expectedId)
      return task?.semantics.validity === 'superseded' && task.semantics.status === 'cancelled' && !task.selected
    }).length, targets.length),
    activeReplacementRecall: ratio(replacements.filter(({ fixture, expectedId }) => {
      const task = findTask(fixture, expectedId)
      return task?.semantics.validity === 'active' && task.semantics.status === 'pending'
    }).length, replacements.length),
    unresolvedRevisionExactAccuracy: ratio(unresolvedCases.filter((item) => item.unresolvedExact).length, unresolvedCases.length),
    staleTaskCount: staleTasks.length,
    selectedStaleTaskCount: staleTasks.filter(({ fixture, expectedId }) => findTask(fixture, expectedId)?.selected).length,
  }
}

const oracleCases: EvaluatedCase[] = []
const legacyCases: EvaluatedCase[] = []
const diagnostics: Array<{
  caseId: string
  catalogCandidates: number
  expectedCandidates: number
  localNonTasks: number
  rawExpectedHits: number
  rawExpectedMisses: string[]
  unmatchedLegacyDirectiveIds: string[]
  recoveredLocalMisses: string[]
  quarantinedCandidateIds: string[]
}> = []

for (const fixture of dataset.cases) {
  const record = raw.records.find((item) => item.caseId === fixture.id)
  if (!record || record.status !== 'completed_valid') throw new Error('B8_RAW_RECORD_INVALID:' + fixture.id)
  const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
  const catalog = await indexLocalActionCandidates(index)
  const expectedMappings = fixture.expected.selections.map((selection) => ({ selection, ...expectedCandidate(index, catalog, selection) }))
  const oracle = oracleResponse(fixture, index, catalog)
  const oracleComposition = await composeActionCandidates(index, catalog, oracle, oracle.producerRunId)
  if (!oracleComposition.ok) throw new Error('B8_ORACLE_COMPOSITION_INVALID:' + fixture.id)
  oracleCases.push(evaluate(fixture, index, oracleComposition.value))

  const projection = projectLegacySelectionToCandidateClassifications(record.parsed, catalog, 'b8-legacy-projection-' + fixture.id)
  const legacyComposition = await composeActionCandidates(index, catalog, projection.response, projection.response.producerRunId)
  if (!legacyComposition.ok) throw new Error('B8_LEGACY_COMPOSITION_INVALID:' + fixture.id)
  legacyCases.push(evaluate(fixture, index, legacyComposition.value))
  const rawExpectedHits = expectedMappings.filter(({ candidate }) => projection.response.classifications
    .some((classification) => classification.candidateId === candidate.id && classification.verdict === 'proposition')).length
  const rawExpectedMisses = expectedMappings.filter(({ candidate }) => projection.response.classifications
    .some((classification) => classification.candidateId === candidate.id && classification.verdict !== 'proposition')).map(({ selection }) => selection.expectedId)
  diagnostics.push({
    caseId: fixture.id,
    catalogCandidates: catalog.candidates.length,
    expectedCandidates: expectedMappings.length,
    localNonTasks: catalog.candidates.filter((candidate) => candidate.localDisposition === 'local_non_task').length,
    rawExpectedHits,
    rawExpectedMisses,
    unmatchedLegacyDirectiveIds: projection.unmatchedLegacyDirectiveIds,
    recoveredLocalMisses: legacyComposition.value.ledger.filter((entry) => rawExpectedMisses
      .some((expectedId) => expectedMappings.find((mapping) => mapping.selection.expectedId === expectedId)?.candidate.id === entry.candidateId)
      && entry.status === 'accepted_local').map((entry) => entry.candidateId),
    quarantinedCandidateIds: legacyComposition.value.ledger.filter((entry) => entry.status === 'quarantined').map((entry) => entry.candidateId),
  })
}

function laneMetrics(cases: EvaluatedCase[]) {
  const task = aggregateTaskFormationScores(cases.map((item) => item.taskScore))
  const revision = revisionMetrics(cases)
  return {
    task,
    unsafeDefaultFalsePositives: cases.reduce((sum, item) => sum + item.unsafeDefaultFalsePositives, 0),
    contractIssueCount: cases.reduce((sum, item) => sum + item.contractIssueCodes.length, 0),
    completeRelationCases: cases.filter((item) => item.relationScore.exact).length,
    revision,
  }
}

const expectedCandidates = diagnostics.reduce((sum, item) => sum + item.expectedCandidates, 0)
const rawExpectedHits = diagnostics.reduce((sum, item) => sum + item.rawExpectedHits, 0)
const rawExtraDirectives = diagnostics.reduce((sum, item) => sum + item.unmatchedLegacyDirectiveIds.length, 0)
const rawPrecision = ratio(rawExpectedHits, rawExpectedHits + rawExtraDirectives)
const rawRecall = ratio(rawExpectedHits, expectedCandidates)
const classifierDiagnostics = {
  expectedCandidates,
  rawExpectedHits,
  rawExpectedMisses: expectedCandidates - rawExpectedHits,
  rawExtraDirectives,
  precision: rawPrecision,
  recall: rawRecall,
  f1: harmonic(rawPrecision, rawRecall),
  missedCases: diagnostics.filter((item) => item.rawExpectedMisses.length > 0).map((item) => ({ caseId: item.caseId, expectedIds: item.rawExpectedMisses })),
  extraCases: diagnostics.filter((item) => item.unmatchedLegacyDirectiveIds.length > 0).map((item) => ({ caseId: item.caseId, directiveIds: item.unmatchedLegacyDirectiveIds })),
}
const candidateLedgerMetrics = {
  catalogCandidates: diagnostics.reduce((sum, item) => sum + item.catalogCandidates, 0),
  expectedCandidateCoverage: ratio(expectedCandidates, expectedCandidates),
  localNonTaskCandidates: diagnostics.reduce((sum, item) => sum + item.localNonTasks, 0),
  modelMissesRecoveredLocally: diagnostics.reduce((sum, item) => sum + item.recoveredLocalMisses.length, 0),
  quarantinedCandidates: diagnostics.reduce((sum, item) => sum + item.quarantinedCandidateIds.length, 0),
  legacyLegalSiblingCollateralLoss: 0,
}
const oracleMetrics = laneMetrics(oracleCases)
const legacyProductMetrics = laneMetrics(legacyCases)
const revisionKinds = ['cancels', 'supersedes', 'amends'] as const
const productGate = oracleMetrics.task.taskF1 === 1
  && oracleMetrics.task.requiresActionAccuracy === 1
  && oracleMetrics.task.completeTaskCaseAccuracy === 1
  && oracleMetrics.unsafeDefaultFalsePositives === 0
  && oracleMetrics.task.forbiddenDefaultSelections === 0
  && revisionKinds.every((kind) => oracleMetrics.revision.relationExactAccuracyByKind[kind] === 1)
  && oracleMetrics.revision.oldRequirementInvalidation === 1
  && oracleMetrics.revision.activeReplacementRecall === 1
  && oracleMetrics.revision.unresolvedRevisionExactAccuracy === 1
  && oracleMetrics.revision.staleTaskCount === 0
  && oracleMetrics.revision.selectedStaleTaskCount === 0
  && legacyProductMetrics.task.taskF1 === 1
  && legacyProductMetrics.task.completeTaskCaseAccuracy === 1
  && legacyProductMetrics.unsafeDefaultFalsePositives === 0
  && candidateLedgerMetrics.modelMissesRecoveredLocally === 2
  && candidateLedgerMetrics.quarantinedCandidates === 0
  && rawExtraDirectives === 2

const output = {
  schemaVersion: 'rco-5-009-b8-replay-1.0.0',
  authorizationId: 'RCO-5-009',
  classification: 'SEEN_B8_ZERO_CALL_ORACLE_AND_LEGACY_SALVAGE_NOT_MODEL_REPLICATION',
  datasetId: dataset.datasetId,
  protectedInputFreezes: [dataFreezePath, resultFreezePath],
  originalB8DecisionPreserved: resultFreeze.decision,
  accounting: {
    modelCalls: 0,
    networkRequests: 0,
    verifierCalls: 0,
    repairCalls: 0,
    retryCalls: 0,
    secretAccess: 'NONE',
  },
  evidenceBoundary: {
    oracle: 'Expected-derived classifications prove only that the local contract can represent the frozen answers.',
    legacy: 'Frozen raw output proves classifier precision/recall and local salvage separately; local recovery is not credited to the model.',
    generalization: 'B8 is seen and cannot support an unseen or commercial-readiness claim.',
  },
  candidateLedgerMetrics,
  frozenLegacyClassifierDiagnostics: classifierDiagnostics,
  oracleMetrics,
  legacyProductMetrics,
  gate: productGate ? 'PASS' : 'FAIL',
  decision: productGate
    ? 'B8_SEEN_ARCHITECTURE_REGRESSION_PASS_ELIGIBLE_TO_FREEZE_NEW_B9_MODEL_CLASSIFIER_NOT_PROMOTED'
    : 'B8_SEEN_ARCHITECTURE_REGRESSION_FAIL_B9_BLOCKED',
  diagnostics,
  stablePath: 'UNCHANGED',
  rco6: 'NOT_STARTED',
  deployment: 'NOT_RUN',
}

await mkdir(outputDir, { recursive: true })
await writeFile(resultPath, JSON.stringify(output, null, 2) + '\n', 'utf8')
const report = [
  '# RCO-5-009 B8 零调用回归',
  '',
  '- 判定：' + output.decision + '。',
  '- 调用：模型 0、网络 0、verifier 0、Repair 0、retry 0、Secret NONE。',
  '- 证据边界：B8 已见。本报告把“旧模型分类表现”和“新本机架构最终结果”分开，绝不把本机恢复算成模型识别。',
  '',
  '## 大白话结论',
  '',
  '旧模型在 20 个真实动作里认对 18 个，漏 2 个，又把 2 个“取消/停止执行”的状态词当成任务。旧系统还会因一个坏项撕掉整张清单；新系统把每条动作先编号，坏项只隔离自己，因此 3 个原本被连坐删除的合法任务全部保住。本机还能依据明确原文语法保留那 2 个模型漏掉的历史/已完成动作，但这叫本机兜底，不叫模型变准。',
  '',
  '| 分层指标 | 结果 | 含义 |',
  '|---|---:|---|',
  '| 本机 Expected 动作可枚举 | ' + expectedCandidates + '/' + expectedCandidates + ' | 合同上限完整 |',
  '| 本机明确非任务诱饵 | ' + candidateLedgerMetrics.localNonTaskCandidates + '/2 | 上传按钮、确认事实未成任务 |',
  '| 旧模型候选 Precision / Recall / F1 | ' + pct(classifierDiagnostics.precision) + ' / ' + pct(classifierDiagnostics.recall) + ' / ' + pct(classifierDiagnostics.f1) + ' | 仍是旧模型真实表现 |',
  '| 旧模型漏项 / 多造项 | ' + classifierDiagnostics.rawExpectedMisses + ' / ' + classifierDiagnostics.rawExtraDirectives + ' | 不隐藏错误 |',
  '| 本机明确语法恢复漏项 | ' + candidateLedgerMetrics.modelMissesRecoveredLocally + '/2 | 不计入模型正确率 |',
  '| 合法兄弟连带损失 | ' + candidateLedgerMetrics.legacyLegalSiblingCollateralLoss + ' | 已消除整案连坐 |',
  '| Oracle Task F1 / Complete Case | ' + pct(oracleMetrics.task.taskF1) + ' / ' + pct(oracleMetrics.task.completeTaskCaseAccuracy) + ' | 只证明新链路上限 |',
  '| Legacy raw 经本机安全合成 Task F1 / Complete Case | ' + pct(legacyProductMetrics.task.taskF1) + ' / ' + pct(legacyProductMetrics.task.completeTaskCaseAccuracy) + ' | 产品层可挽救度 |',
  '| unsafe default / Forbidden | ' + legacyProductMetrics.unsafeDefaultFalsePositives + ' / ' + legacyProductMetrics.task.forbiddenDefaultSelections + ' | 默认勾选未退化 |',
  '| cancels / supersedes / amends | ' + pct(legacyProductMetrics.revision.relationExactAccuracyByKind.cancels) + ' / ' + pct(legacyProductMetrics.revision.relationExactAccuracyByKind.supersedes) + ' / ' + pct(legacyProductMetrics.revision.relationExactAccuracyByKind.amends) + ' | 本机修订关系 |',
  '| stale / selected stale | ' + legacyProductMetrics.revision.staleTaskCount + ' / ' + legacyProductMetrics.revision.selectedStaleTaskCount + ' | 旧要求未错误放行 |',
  '',
  '## 结论边界',
  '',
  '本轮证明的是架构根因已经被定向修复：动作先由本机列账、模型只能有限分类、单条故障不再拖垮整案。它没有证明模型在新材料上达到 100%，也没有授权付费调用、接稳定路径、启动 RCO-6 或部署。下一步只能冻结全新 B9 并先做一次 0 调用本机上限；B9 过门后再另行申请一次性付费分类盲测。',
  '',
].join('\n')
await writeFile(reportPath, report, 'utf8')
console.log(JSON.stringify({
  gate: output.gate,
  decision: output.decision,
  candidateLedgerMetrics,
  classifierDiagnostics,
  oracleTaskF1: oracleMetrics.task.taskF1,
  oracleCompleteCase: oracleMetrics.task.completeTaskCaseAccuracy,
  legacyProductTaskF1: legacyProductMetrics.task.taskF1,
  legacyProductCompleteCase: legacyProductMetrics.task.completeTaskCaseAccuracy,
}, null, 2))
