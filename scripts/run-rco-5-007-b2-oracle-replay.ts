import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { indexImmutableScopesV11 } from '../src/recognition/scopeIndexV11'
import { type ImmutableScopeIndex, type ScopeReferenceCandidate, type ScopeReferenceDirective, type SurfaceReference } from '../src/recognition/scopeReferenceContract'
import { formLocalTaskSuggestions, reduceModelCandidate, validateLocalTaskFormation } from '../src/recognition/taskFormationPolicyV2'
import { aggregateTaskFormationScores, scoreTaskFormationCase, type TaskFormationExpectedCase, type TaskFormationPredictionCase } from '../src/recognition/taskFormationEvaluation'

type ExpectedSurface = { scopeText: string; surface: string }
type ExpectedDirective = Omit<ScopeReferenceDirective, 'id' | 'propositionScopeIds' | 'action' | 'object' | 'timeRefs' | 'materialRefs' | 'eventRef' | 'locationRef' | 'revisionRefs'> & {
  expectedId: string; propositionScopeTexts: string[]; action: ExpectedSurface; object: ExpectedSurface;
  timeRefs: Array<ExpectedSurface & { type: ScopeReferenceDirective['timeRefs'][number]['type'] }>;
  materialRefs: Array<ExpectedSurface & { required: boolean }>; eventRef: ExpectedSurface | null; locationRef: ExpectedSurface | null;
  revisionRefs: Array<{ type: ScopeReferenceDirective['revisionRefs'][number]['type']; targetExpectedDirectiveId: string; scopeTexts: string[] }>;
  expectedDefaultSelected: boolean;
}
interface Fixture extends TaskFormationExpectedCase {
  sourceText: string
  expected: TaskFormationExpectedCase['expected'] & { directives: ExpectedDirective[]; observations: unknown[]; ignoredScopeTexts: string[] }
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const datasetPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B2_CHALLENGE_DATASET.json')
const resultPath = resolve(root, 'docs/recognition-optimization/rco-5-007-b2-oracle/result.json')
const reportPath = resolve(root, 'docs/recognition-optimization/rco-5-007-b2-oracle/REPORT.md')
const bytes = await readFile(datasetPath)
const dataset = JSON.parse(bytes.toString('utf8')) as { datasetId: string; cases: Fixture[] }

function lookup(index: ImmutableScopeIndex, text: string): string {
  const matches = index.scopes.filter((scope) => scope.text === text)
  if (matches.length !== 1) throw new Error(`ORACLE_SCOPE_NOT_UNIQUE:${text}`)
  return matches[0].id
}
function surface(index: ImmutableScopeIndex, value: ExpectedSurface): SurfaceReference { return { scopeId: lookup(index, value.scopeText), surface: value.surface } }
function oracleCandidate(fixture: Fixture, index: ImmutableScopeIndex): ScopeReferenceCandidate {
  return {
    schemaVersion: 'scope-reference-candidate-1.0', sourceId: fixture.id, sourceVersionId: 'source-v1', sourceFingerprint: index.sourceFingerprint,
    producerRunId: `oracle-anchor-${fixture.id}`, requiresAction: fixture.expected.requiresAction,
    directives: fixture.expected.directives.map((item) => ({
      id: item.expectedId, propositionScopeIds: item.propositionScopeTexts.map((text) => lookup(index, text)), semantics: item.semantics,
      inferenceLevel: item.inferenceLevel, actionType: item.actionType, action: surface(index, item.action), object: surface(index, item.object), effect: item.effect,
      timeRefs: item.timeRefs.map((ref) => ({ ...surface(index, ref), type: ref.type })), materialRefs: item.materialRefs.map((ref) => ({ ...surface(index, ref), required: ref.required })),
      eventRef: item.eventRef ? surface(index, item.eventRef) : null, locationRef: item.locationRef ? surface(index, item.locationRef) : null,
      revisionRefs: item.revisionRefs.map((ref) => ({ type: ref.type, targetDirectiveId: ref.targetExpectedDirectiveId, scopeIds: ref.scopeTexts.map((text) => lookup(index, text)) })),
    })), observations: [], ignoredScopeIds: [],
  }
}

const cases = []
for (const fixture of dataset.cases) {
  const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
  const formed = formLocalTaskSuggestions(index, reduceModelCandidate(oracleCandidate(fixture, index)))
  const contractIssues = validateLocalTaskFormation(formed, index)
  const scopeById = new Map(index.scopes.map((scope) => [scope.id, scope.text]))
  const prediction: TaskFormationPredictionCase = {
    caseId: fixture.id, status: contractIssues.length === 0 ? 'completed' : 'invalid', requiresAction: formed.requiresAction,
    tasks: formed.tasks.map((task) => ({
      id: task.id, propositionScopeTexts: task.propositionScopeIds.map((id) => scopeById.get(id)).filter((text): text is string => Boolean(text)),
      semantics: task.semantics, inferenceLevel: task.inferenceLevel, actionType: task.actionType, action: task.action.surface,
      object: task.object.surface, effect: task.effect, selected: task.selected,
    })),
  }
  cases.push({ caseId: fixture.id, contractIssues, prediction, score: scoreTaskFormationCase(fixture, prediction) })
}
const metrics = aggregateTaskFormationScores(cases.map((item) => item.score))
const gatePassed = metrics.scoreableCases === 16 && metrics.taskF1 !== null && metrics.taskF1 >= 0.9
  && metrics.requiresActionAccuracy !== null && metrics.requiresActionAccuracy >= 0.95
  && metrics.completeTaskCaseAccuracy !== null && metrics.completeTaskCaseAccuracy >= 0.8
  && metrics.forbiddenDefaultSelections === 0
const output = {
  schemaVersion: 'rco-5-007-b2-oracle-replay-1.0.0', authorizationId: 'RCO-5-007-B2-ZERO-CALL',
  classification: 'ORACLE_ANCHOR_UPPER_BOUND_SEEN_AFTER_RUN', datasetId: dataset.datasetId,
  datasetSha256: createHash('sha256').update(bytes).digest('hex'),
  accounting: { modelCalls: 0, networkRequests: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE' },
  interpretation: 'Expected-derived perfect anchors isolate the deterministic local layer. This is not model accuracy and makes the challenge set seen for this local-policy candidate.',
  metrics, gate: gatePassed ? 'PASS' : 'FAIL', decision: gatePassed ? 'PAID_MODEL_TEST_MAY_BE_REQUESTED' : 'PAID_MODEL_TEST_BLOCKED_LOCAL_POLICY_CEILING', cases,
  stablePath: 'UNCHANGED', rco6: 'NOT_STARTED', deployment: 'NOT_RUN',
}
await writeFile(resultPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
const pct = (value: number | null) => value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`
const failures = cases.filter((item) => item.score.majorCorrection).map((item) => `- ${item.caseId}: tasks ${item.score.taskCounts.tp}/${item.score.taskCounts.tp + item.score.taskCounts.fn}, requiresAction ${item.score.requiresActionCorrect ? 'PASS' : 'FAIL'}, complete FAIL`).join('\n') || '- none'
const report = `# RCO-5-007-B2 理想锚点零调用上限测试\n\n- 目的：先假设模型把动作和 scope 全找对，只测试本机任务形成与安全决策层。\n- 调用：模型 0、网络 0、Secret NONE。\n- 结论：\`${output.decision}\`。\n\n| 指标 | 结果 | 门槛 |\n|---|---:|---:|\n| Task F1 | ${pct(metrics.taskF1)} | >=90% |\n| requiresAction | ${pct(metrics.requiresActionAccuracy)} | >=95% |\n| Complete Task Case | ${pct(metrics.completeTaskCaseAccuracy)} | >=80% |\n| Major Correction | ${pct(metrics.majorCorrectionRate)} | 越低越好 |\n| Safe Default Recall | ${pct(metrics.safeDefaultRecall)} | 不退化 |\n| Forbidden | ${metrics.forbiddenDefaultSelections} | 0 |\n\n## 未完整通过案例\n\n${failures}\n\n这不是模型正确率。Expected 被故意转换成“完美模型锚点”，所以任何失败都来自本机层或评分契约。运行后本挑战集对当前本机策略已见，不能再用来证明同一策略的未见泛化。\n`
await writeFile(reportPath, report, 'utf8')
console.log(JSON.stringify({ result: resultPath, report: reportPath, metrics, gate: output.gate, decision: output.decision }))

