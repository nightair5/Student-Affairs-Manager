import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { composeLocalAnchorsV2 } from '../src/recognition/modelAnchorLocalComposerV2'
import type { ModelAnchorSelection } from '../src/recognition/modelAnchorSelectionContract'
import { validateModelAnchorSelection } from '../src/recognition/modelAnchorSelectionContract'
import { indexImmutableScopesV11 } from '../src/recognition/scopeIndexV11'
import type { ImmutableScopeIndex } from '../src/recognition/scopeReferenceContract'
import { aggregateTaskFormationScores, scoreTaskFormationCase, type TaskFormationExpectedCase, type TaskFormationPredictionCase } from '../src/recognition/taskFormationEvaluation'
import { materializeRevisionRelationsByScope, scoreStableDefaultSafety, type ExpectedRevisionRelationV2 } from '../src/recognition/taskFormationEvaluationV2'
import { formLocalTaskSuggestionsP4, validateLocalTaskFormationP4 } from '../src/recognition/taskFormationPolicyP4'
import type { ReducedModelAnchors } from '../src/recognition/taskFormationPolicyV2'

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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const datasetPath = 'docs/recognition-optimization/RCO-5-007-B7_DEVELOPMENT_DATASET.json'
const dataFreezePath = 'docs/recognition-optimization/RCO-5-007-B7_DATA_FREEZE.json'
const resultFreezePath = 'docs/recognition-optimization/RCO-5-007-B7-M1_RESULT_FREEZE.json'
const rawPath = 'docs/recognition-optimization/rco-5-007-b7-runs/rco-5-007-b7-m1-20260904a/raw-results.json'
const outputDir = resolve(root, 'docs/recognition-optimization/rco-5-008-b7-replay')
const resultPath = resolve(outputDir, 'result.json')
const reportPath = resolve(outputDir, 'REPORT.md')

try {
  await access(resultPath)
  throw new Error('RCO_5_008_B7_REPLAY_ALREADY_EXISTS')
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
}

const sha = async (relativePath: string) => createHash('sha256').update(await readFile(resolve(root, relativePath))).digest('hex')
const dataFreeze = JSON.parse(await readFile(resolve(root, dataFreezePath), 'utf8')) as { datasetId: string; componentPaths: string[]; componentSha256: Record<string, string> }
const resultFreeze = JSON.parse(await readFile(resolve(root, resultFreezePath), 'utf8')) as { componentPaths: string[]; componentSha256: Record<string, string>; decision: string }
for (const relativePath of dataFreeze.componentPaths) if (await sha(relativePath) !== dataFreeze.componentSha256[relativePath]) throw new Error(`B7_DATA_DRIFT:${relativePath}`)
for (const relativePath of resultFreeze.componentPaths) if (await sha(relativePath) !== resultFreeze.componentSha256[relativePath]) throw new Error(`B7_RESULT_DRIFT:${relativePath}`)
if (resultFreeze.decision !== 'NO_PROMOTION_PAID_REPLICATION_BLOCKED') throw new Error('B7_ORIGINAL_DECISION_DRIFT')

const dataset = JSON.parse(await readFile(resolve(root, datasetPath), 'utf8')) as { datasetId: string; cases: Fixture[] }
const raw = JSON.parse(await readFile(resolve(root, rawPath), 'utf8')) as { records: RawRecord[] }
if (dataset.datasetId !== dataFreeze.datasetId || dataset.cases.length !== 12 || raw.records.length !== 12) throw new Error('B7_INPUT_COUNT_OR_ID_INVALID')

function ratio(top: number, bottom: number): number | null { return bottom === 0 ? null : top / bottom }
function harmonic(precision: number | null, recall: number | null): number | null { return precision === null || recall === null || precision + recall === 0 ? null : 2 * precision * recall / (precision + recall) }
function pct(value: number | null): string { return value === null ? 'N/A' : `${(value * 100).toFixed(1)}%` }
function sorted(values: string[]): string[] { return [...values].sort() }
function lookup(index: ImmutableScopeIndex, text: string): string {
  const matches = index.scopes.filter((scope) => scope.text === text)
  if (matches.length !== 1) throw new Error(`B7_SCOPE_NOT_UNIQUE:${text}`)
  return matches[0].id
}
function prediction(fixture: Fixture, index: ImmutableScopeIndex, formed: ReturnType<typeof formLocalTaskSuggestionsP4>): TaskFormationPredictionCase {
  const scopeById = new Map(index.scopes.map((scope) => [scope.id, scope.text]))
  return {
    caseId: fixture.id,
    status: 'completed',
    requiresAction: formed.requiresAction,
    tasks: formed.tasks.map((task) => ({
      id: task.id,
      propositionScopeTexts: task.propositionScopeIds.map((id) => scopeById.get(id)).filter((text): text is string => Boolean(text)),
      semantics: task.semantics,
      inferenceLevel: task.inferenceLevel,
      actionType: task.actionType,
      action: task.action.surface,
      object: task.object.surface,
      effect: task.effect,
      selected: task.selected,
    })),
  }
}
function anchorScore(fixture: Fixture, index: ImmutableScopeIndex, reduced: ReducedModelAnchors) {
  let tp = 0; let fp = 0; let fn = 0; let actionCorrect = 0; let objectCorrect = 0
  const used = new Set<number>()
  for (const expected of fixture.expected.selections) {
    const expectedScopes = expected.propositionScopeTexts.map((text) => lookup(index, text))
    const matchIndex = reduced.directives.findIndex((directive, position) => !used.has(position) && directive.objectSurfaceHint.surface === expected.object.surface && directive.propositionScopeIds.some((id) => expectedScopes.includes(id)))
    if (matchIndex < 0) { fn += expectedScopes.length; continue }
    used.add(matchIndex)
    const actual = reduced.directives[matchIndex]
    const expectedSet = new Set(expectedScopes)
    const actualSet = new Set(actual.propositionScopeIds)
    tp += [...expectedSet].filter((id) => actualSet.has(id)).length
    fn += [...expectedSet].filter((id) => !actualSet.has(id)).length
    fp += [...actualSet].filter((id) => !expectedSet.has(id)).length
    if (actual.actionSurfaceHint.scopeId === lookup(index, expected.action.scopeText) && actual.actionSurfaceHint.surface === expected.action.surface) actionCorrect += 1
    if (actual.objectSurfaceHint.scopeId === lookup(index, expected.object.scopeText) && actual.objectSurfaceHint.surface === expected.object.surface) objectCorrect += 1
  }
  reduced.directives.forEach((directive, position) => { if (!used.has(position)) fp += directive.propositionScopeIds.length })
  const precision = ratio(tp, tp + fp); const recall = ratio(tp, tp + fn)
  const complete = actionCorrect === fixture.expected.selections.length && objectCorrect === fixture.expected.selections.length && fp === 0 && fn === 0
    && JSON.stringify(sorted(reduced.ignoredScopeIds)) === JSON.stringify(sorted(fixture.expected.ignoredScopeTexts.map((text) => lookup(index, text))))
  return { scope: { tp, fp, fn }, scopePrecision: precision, scopeRecall: recall, scopeF1: harmonic(precision, recall), actionCorrect, objectCorrect, total: fixture.expected.selections.length, complete }
}

const cases = []
for (const fixture of dataset.cases) {
  const record = raw.records.find((item) => item.caseId === fixture.id)
  if (!record || record.status !== 'completed_valid') throw new Error(`B7_RAW_RECORD_INVALID:${fixture.id}`)
  const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
  const modelValidation = validateModelAnchorSelection(record.parsed, index, record.parsed.producerRunId)
  if (!modelValidation.valid) throw new Error(`B7_MODEL_SELECTION_INVALID:${fixture.id}`)
  const composition = composeLocalAnchorsV2(record.parsed, index, record.parsed.producerRunId)
  if (!composition.ok) throw new Error(`B7_LOCAL_COMPOSITION_INVALID:${fixture.id}:${composition.issues.map((issue) => issue.code).join(',')}`)
  const formed = formLocalTaskSuggestionsP4(index, composition.value.reduced)
  const contractIssues = validateLocalTaskFormationP4(formed, index, composition.value.reduced)
  const predicted = prediction(fixture, index, formed)
  const taskScore = scoreTaskFormationCase(fixture, predicted)
  const safetyScore = scoreStableDefaultSafety(fixture.expected.directives, predicted.tasks)
  const relationScore = materializeRevisionRelationsByScope(fixture.expected.directives, fixture.expected.revisionRelations, predicted.tasks, formed, index)
  const scopeById = new Map(index.scopes.map((scope) => [scope.id, scope.text]))
  const actualUnresolved = formed.unresolvedRevisionScopeIds.map((id) => scopeById.get(id) ?? null)
  const unresolvedExact = JSON.stringify(actualUnresolved) === JSON.stringify(fixture.expected.unresolvedRevisionScopeTexts)
  cases.push({
    caseId: fixture.id,
    coverageTags: fixture.coverageTags,
    modelSelectionStatus: 'REUSED_FROZEN_B7_RAW_OUTPUT_NO_MODEL_CALL',
    composerWarnings: composition.value.warnings,
    actionNormalizations: composition.value.actionNormalizations,
    conditionAttachments: composition.value.conditionAttachments,
    contractIssues,
    anchorScore: anchorScore(fixture, index, composition.value.reduced),
    prediction: predicted,
    taskScore,
    safetyScore,
    relationScore,
    expectedUnresolvedScopeTexts: fixture.expected.unresolvedRevisionScopeTexts,
    actualUnresolvedScopeTexts: actualUnresolved,
    unresolvedExact,
  })
}

const taskMetrics = aggregateTaskFormationScores(cases.map((item) => item.taskScore))
const scope = cases.reduce((total, item) => ({ tp: total.tp + item.anchorScore.scope.tp, fp: total.fp + item.anchorScore.scope.fp, fn: total.fn + item.anchorScore.scope.fn }), { tp: 0, fp: 0, fn: 0 })
const scopePrecision = ratio(scope.tp, scope.tp + scope.fp); const scopeRecall = ratio(scope.tp, scope.tp + scope.fn)
const totalSelections = cases.reduce((sum, item) => sum + item.anchorScore.total, 0)
const anchorMetrics = {
  scopeCounts: scope,
  scopePrecision,
  scopeRecall,
  scopeF1: harmonic(scopePrecision, scopeRecall),
  actionSurfaceExact: ratio(cases.reduce((sum, item) => sum + item.anchorScore.actionCorrect, 0), totalSelections),
  objectSurfaceExact: ratio(cases.reduce((sum, item) => sum + item.anchorScore.objectCorrect, 0), totalSelections),
  completeAnchorCaseAccuracy: ratio(cases.filter((item) => item.anchorScore.complete).length, cases.length),
}
const unsafeDefaultFalsePositives = cases.reduce((sum, item) => sum + item.safetyScore.unsafeDefaultFalsePositives, 0)
const relationKinds = ['cancels', 'supersedes', 'amends'] as const
const relationExactAccuracyByKind = Object.fromEntries(relationKinds.map((kind) => {
  const relevant = cases.filter((item) => item.relationScore.expected.some((relation) => relation.kind === kind))
  return [kind, relevant.length === 0 ? null : relevant.filter((item) => item.relationScore.exact).length / relevant.length]
})) as Record<typeof relationKinds[number], number | null>
const targetExpectedIds = dataset.cases.flatMap((fixture) => fixture.expected.revisionRelations.map((relation) => `${fixture.id}:${relation.targetExpectedId}`))
const replacementExpectedIds = dataset.cases.flatMap((fixture) => fixture.expected.revisionRelations.flatMap((relation) => relation.replacementExpectedIds.map((id) => `${fixture.id}:${id}`)))
const expectedByKey = new Map(dataset.cases.flatMap((fixture) => fixture.expected.directives.map((directive) => [`${fixture.id}:${directive.expectedId}`, directive] as const)))
const findTask = (key: string) => {
  const split = key.indexOf(':'); const caseId = key.slice(0, split); const expected = expectedByKey.get(key)
  if (!expected) return undefined
  return cases.find((item) => item.caseId === caseId)?.prediction.tasks.find((task) => task.object === expected.object.surface && task.propositionScopeTexts.some((text) => expected.propositionScopeTexts.includes(text)))
}
const oldRequirementInvalidation = ratio(targetExpectedIds.filter((key) => { const task = findTask(key); return task?.semantics.validity === 'superseded' && task.semantics.status === 'cancelled' && !task.selected }).length, targetExpectedIds.length)
const activeReplacementRecall = ratio(replacementExpectedIds.filter((key) => { const task = findTask(key); return task?.semantics.validity === 'active' && task.semantics.status === 'pending' }).length, replacementExpectedIds.length)
const unresolvedCases = cases.filter((item) => item.expectedUnresolvedScopeTexts.length > 0)
const revisionMetrics = {
  relationExactAccuracyByKind,
  oldRequirementInvalidation,
  activeReplacementRecall,
  unresolvedRevisionExactAccuracy: ratio(unresolvedCases.filter((item) => item.unresolvedExact).length, unresolvedCases.length),
  staleTaskCount: targetExpectedIds.filter((key) => { const task = findTask(key); return task && (task.semantics.validity !== 'superseded' || task.semantics.status !== 'cancelled') }).length,
  selectedStaleTaskCount: targetExpectedIds.filter((key) => { const task = findTask(key); return task && (task.semantics.validity !== 'superseded' || task.semantics.status !== 'cancelled') && task.selected }).length,
}
const gatePassed = cases.every((item) => item.contractIssues.length === 0)
  && anchorMetrics.scopeF1 === 1 && anchorMetrics.actionSurfaceExact === 1 && anchorMetrics.objectSurfaceExact === 1 && anchorMetrics.completeAnchorCaseAccuracy === 1
  && taskMetrics.taskF1 === 1 && taskMetrics.requiresActionAccuracy === 1 && taskMetrics.completeTaskCaseAccuracy === 1
  && unsafeDefaultFalsePositives === 0 && taskMetrics.forbiddenDefaultSelections === 0
  && relationKinds.every((kind) => relationExactAccuracyByKind[kind] === 1)
  && revisionMetrics.oldRequirementInvalidation === 1 && revisionMetrics.activeReplacementRecall === 1
  && revisionMetrics.unresolvedRevisionExactAccuracy === 1 && revisionMetrics.staleTaskCount === 0 && revisionMetrics.selectedStaleTaskCount === 0

const output = {
  schemaVersion: 'rco-5-008-b7-replay-1.0.0',
  authorizationId: 'RCO-5-008',
  classification: 'SEEN_B7_ZERO_CALL_LOCAL_REGRESSION_NOT_MODEL_REPLICATION',
  datasetId: dataset.datasetId,
  inputResultFreeze: resultFreezePath,
  accounting: { modelCalls: 0, networkRequests: 0, verifierCalls: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE' },
  interpretation: 'Replays immutable B7 model output through a new local composer, P4 and evaluator. It measures repair of the known interface failure, not improved model accuracy or unseen generalization.',
  anchorMetrics,
  taskMetrics,
  unsafeDefaultFalsePositives,
  revisionMetrics,
  gate: gatePassed ? 'PASS' : 'FAIL',
  decision: gatePassed ? 'B7_SEEN_REGRESSION_PASS_ELIGIBLE_TO_FREEZE_NEW_B8' : 'B7_SEEN_REGRESSION_FAIL_B8_BLOCKED',
  cases,
  stablePath: 'UNCHANGED', rco6: 'NOT_STARTED', deployment: 'NOT_RUN',
}
await mkdir(outputDir, { recursive: true })
await writeFile(resultPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
const failures = cases.filter((item) => item.contractIssues.length > 0 || !item.anchorScore.complete || !item.taskScore.completeTaskCase || item.safetyScore.unsafeDefaultFalsePositives > 0 || !item.relationScore.exact || !item.unresolvedExact).map((item) => `- ${item.caseId}: contract=${item.contractIssues.map((issue) => issue.code).join(',') || 'PASS'}; anchor=${item.anchorScore.complete ? 'PASS' : 'FAIL'}; task=${item.taskScore.completeTaskCase ? 'PASS' : 'FAIL'}; unsafe=${item.safetyScore.unsafeDefaultFalsePositives}; relation=${item.relationScore.exact ? 'PASS' : 'FAIL'}; unresolved=${item.unresolvedExact ? 'PASS' : 'FAIL'}`).join('\n') || '- none'
const report = `# RCO-5-008 B7 零调用回归\n\n- 判定：\`${output.decision}\`。\n- 调用：模型 0、网络 0、verifier 0、Repair 0、retry 0、Secret NONE。\n- 证据边界：复用已经见过的 B7 原始模型输出，只证明本机接口修复覆盖已知失败，不证明模型正确率提高或对新数据泛化。\n\n| 指标 | 结果 | 门槛 |\n|---|---:|---:|\n| Scope Precision / Recall / F1 | ${pct(anchorMetrics.scopePrecision)} / ${pct(anchorMetrics.scopeRecall)} / ${pct(anchorMetrics.scopeF1)} | 各 100% |\n| 动作 / 对象完全正确 | ${pct(anchorMetrics.actionSurfaceExact)} / ${pct(anchorMetrics.objectSurfaceExact)} | 各 100% |\n| 完整锚点案例 | ${pct(anchorMetrics.completeAnchorCaseAccuracy)} | 100% |\n| Task Precision / Recall / F1 | ${pct(taskMetrics.taskPrecision)} / ${pct(taskMetrics.taskRecall)} / ${pct(taskMetrics.taskF1)} | 各 100% |\n| requiresAction / Complete Task Case | ${pct(taskMetrics.requiresActionAccuracy)} / ${pct(taskMetrics.completeTaskCaseAccuracy)} | 各 100% |\n| unsafe default false positive | ${unsafeDefaultFalsePositives} | 0 |\n| Forbidden | ${taskMetrics.forbiddenDefaultSelections} | 0 |\n| cancels / supersedes / amends | ${pct(relationExactAccuracyByKind.cancels)} / ${pct(relationExactAccuracyByKind.supersedes)} / ${pct(relationExactAccuracyByKind.amends)} | 各 100% |\n| 旧要求失效 / 新要求生效 | ${pct(revisionMetrics.oldRequirementInvalidation)} / ${pct(revisionMetrics.activeReplacementRecall)} | 各 100% |\n| 歧义保持 unresolved | ${pct(revisionMetrics.unresolvedRevisionExactAccuracy)} | 100% |\n| stale / selected stale | ${revisionMetrics.staleTaskCount} / ${revisionMetrics.selectedStaleTaskCount} | 0 / 0 |\n\n## 失败案例\n\n${failures}\n\n旧 B7 的预注册失败结论保持不变。新结果只允许进入 B8 数据冻结，不接稳定路径、不启动 RCO-6、不部署。\n`
await writeFile(reportPath, report, 'utf8')
console.log(JSON.stringify({ anchorMetrics, taskMetrics, unsafeDefaultFalsePositives, revisionMetrics, gate: output.gate, decision: output.decision }))
