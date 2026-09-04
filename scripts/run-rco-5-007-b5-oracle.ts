import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { indexImmutableScopesV11 } from '../src/recognition/scopeIndexV11'
import { type ImmutableScopeIndex, type ScopeReferenceCandidate, type ScopeReferenceDirective, type ScopeReferenceObservation, type SurfaceReference } from '../src/recognition/scopeReferenceContract'
import { reduceModelCandidate } from '../src/recognition/taskFormationPolicyV2'
import { formLocalTaskSuggestionsP2, validateLocalTaskFormationP2 } from '../src/recognition/taskFormationPolicyP2'
import { aggregateTaskFormationScores, scoreTaskFormationCase, type TaskFormationExpectedCase, type TaskFormationPredictionCase } from '../src/recognition/taskFormationEvaluation'

type ExpectedSurface = { scopeText: string; surface: string }
type ExpectedDirective = Omit<ScopeReferenceDirective, 'id' | 'propositionScopeIds' | 'action' | 'object' | 'timeRefs' | 'materialRefs' | 'eventRef' | 'locationRef' | 'revisionRefs'> & { expectedId: string; propositionScopeTexts: string[]; action: ExpectedSurface; object: ExpectedSurface; timeRefs: Array<ExpectedSurface & { type: ScopeReferenceDirective['timeRefs'][number]['type'] }>; materialRefs: Array<ExpectedSurface & { required: boolean }>; eventRef: ExpectedSurface | null; locationRef: ExpectedSurface | null; revisionRefs: ScopeReferenceDirective['revisionRefs']; expectedDefaultSelected: boolean }
type ExpectedObservation = Omit<ScopeReferenceObservation, 'id' | 'propositionScopeIds' | 'subject' | 'timeRefs' | 'locationRef'> & { expectedId: string; propositionScopeTexts: string[]; subject: ExpectedSurface; timeRefs: Array<ExpectedSurface & { type: ScopeReferenceObservation['timeRefs'][number]['type'] }>; locationRef: ExpectedSurface | null }
interface Fixture extends TaskFormationExpectedCase { coverageTags: string[]; sourceText: string; expected: TaskFormationExpectedCase['expected'] & { directives: ExpectedDirective[]; observations: ExpectedObservation[]; ignoredScopeTexts: string[] } }
interface OracleGate { scoreableCases: number; taskF1Minimum: number; requiresActionAccuracyMinimum: number; completeTaskCaseAccuracyMinimum: number; forbiddenDefaultSelectionsMaximum: number; supersededTaskExactAccuracyMinimum: number; activeReplacementRecallMinimum: number; selectedStaleTasksMaximum: number }

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const datasetPath = 'docs/recognition-optimization/RCO-5-007-B5_CHALLENGE_DATASET.json'
const freezePath = 'docs/recognition-optimization/RCO-5-007-B5_DATA_FREEZE.json'
const outputDir = resolve(root, 'docs/recognition-optimization/rco-5-007-b5-oracle')
const datasetBytes = await readFile(resolve(root, datasetPath))
const dataset = JSON.parse(datasetBytes.toString('utf8')) as { datasetId: string; cases: Fixture[] }
const freeze = JSON.parse(await readFile(resolve(root, freezePath), 'utf8')) as { datasetId: string; componentPaths: string[]; componentSha256: Record<string, string>; oracleGate: OracleGate }
const sha = async (path: string) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
for (const path of freeze.componentPaths) if (await sha(path) !== freeze.componentSha256[path]) throw new Error(`B5_FROZEN_COMPONENT_DRIFT:${path}`)
if (dataset.datasetId !== freeze.datasetId) throw new Error('B5_DATASET_ID_DRIFT')

function lookup(index: ImmutableScopeIndex, text: string): string { const matches = index.scopes.filter((scope) => scope.text === text); if (matches.length !== 1) throw new Error(`B5_ORACLE_SCOPE_NOT_UNIQUE:${text}`); return matches[0].id }
function surface(index: ImmutableScopeIndex, value: ExpectedSurface): SurfaceReference { return { scopeId: lookup(index, value.scopeText), surface: value.surface } }
function oracleCandidate(fixture: Fixture, index: ImmutableScopeIndex): ScopeReferenceCandidate { return { schemaVersion: 'scope-reference-candidate-1.0', sourceId: fixture.id, sourceVersionId: 'source-v1', sourceFingerprint: index.sourceFingerprint, producerRunId: `b5-oracle-${fixture.id}`, requiresAction: fixture.expected.requiresAction, directives: fixture.expected.directives.map((item) => ({ id: item.expectedId, propositionScopeIds: item.propositionScopeTexts.map((text) => lookup(index, text)), semantics: item.semantics, inferenceLevel: item.inferenceLevel, actionType: item.actionType, action: surface(index, item.action), object: surface(index, item.object), effect: item.effect, timeRefs: item.timeRefs.map((ref) => ({ ...surface(index, ref), type: ref.type })), materialRefs: item.materialRefs.map((ref) => ({ ...surface(index, ref), required: ref.required })), eventRef: item.eventRef ? surface(index, item.eventRef) : null, locationRef: item.locationRef ? surface(index, item.locationRef) : null, revisionRefs: [] })), observations: fixture.expected.observations.map((item) => ({ id: item.expectedId, kind: item.kind, propositionScopeIds: item.propositionScopeTexts.map((text) => lookup(index, text)), semantics: item.semantics, inferenceLevel: item.inferenceLevel, subject: surface(index, item.subject), timeRefs: item.timeRefs.map((ref) => ({ ...surface(index, ref), type: ref.type })), locationRef: item.locationRef ? surface(index, item.locationRef) : null })), ignoredScopeIds: fixture.expected.ignoredScopeTexts.map((text) => lookup(index, text)) } }

const cases = []
for (const fixture of dataset.cases) {
  const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
  const reduced = reduceModelCandidate(oracleCandidate(fixture, index))
  const formed = formLocalTaskSuggestionsP2(index, reduced)
  const contractIssues = validateLocalTaskFormationP2(formed, index, reduced)
  const scopeById = new Map(index.scopes.map((scope) => [scope.id, scope.text]))
  const prediction: TaskFormationPredictionCase = { caseId: fixture.id, status: contractIssues.length === 0 ? 'completed' : 'invalid', requiresAction: formed.requiresAction, tasks: formed.tasks.map((task) => ({ id: task.id, propositionScopeTexts: task.propositionScopeIds.map((id) => scopeById.get(id)).filter((text): text is string => Boolean(text)), semantics: task.semantics, inferenceLevel: task.inferenceLevel, actionType: task.actionType, action: task.action.surface, object: task.object.surface, effect: task.effect, selected: task.selected })) }
  cases.push({ caseId: fixture.id, coverageTags: fixture.coverageTags, contractIssues, prediction, score: scoreTaskFormationCase(fixture, prediction) })
}

const metrics = aggregateTaskFormationScores(cases.map((item) => item.score))
const revisionFixtures = dataset.cases.filter((fixture) => fixture.coverageTags.includes('revision'))
const supersededExpected = revisionFixtures.flatMap((fixture) => fixture.expected.directives.map((directive) => ({ caseId: fixture.id, directive })).filter((item) => item.directive.semantics.validity === 'superseded'))
const activeReplacementExpected = revisionFixtures.flatMap((fixture) => fixture.expected.directives.map((directive) => ({ caseId: fixture.id, directive })).filter((item) => item.directive.semantics.validity === 'active'))
const findPrediction = (caseId: string, directive: ExpectedDirective) => cases.find((item) => item.caseId === caseId)?.prediction.tasks.find((task) => task.action === directive.action.surface && task.object === directive.object.surface)
const supersededExact = supersededExpected.filter(({ caseId, directive }) => { const task = findPrediction(caseId, directive); return task && JSON.stringify(task.semantics) === JSON.stringify(directive.semantics) }).length
const staleTasks = supersededExpected.flatMap(({ caseId, directive }) => { const task = findPrediction(caseId, directive); return task && (task.semantics.validity !== 'superseded' || task.semantics.status !== 'cancelled') ? [{ caseId, action: task.action, object: task.object, selected: task.selected, semantics: task.semantics }] : [] })
const activeReplacementFound = activeReplacementExpected.filter(({ caseId, directive }) => { const task = findPrediction(caseId, directive); return task && task.semantics.validity === 'active' && task.semantics.status === 'pending' }).length
const revisionMetrics = {
  revisionCaseCount: revisionFixtures.length,
  revisionCaseCompleteAccuracy: revisionFixtures.length === 0 ? null : cases.filter((item) => item.coverageTags.includes('revision') && item.score.completeTaskCase).length / revisionFixtures.length,
  supersededTaskExactAccuracy: supersededExpected.length === 0 ? null : supersededExact / supersededExpected.length,
  activeReplacementRecall: activeReplacementExpected.length === 0 ? null : activeReplacementFound / activeReplacementExpected.length,
  staleTaskCount: staleTasks.length,
  selectedStaleTaskCount: staleTasks.filter((item) => item.selected).length,
  staleTasks,
}
const gatePassed = metrics.scoreableCases === freeze.oracleGate.scoreableCases
  && metrics.taskF1 !== null && metrics.taskF1 >= freeze.oracleGate.taskF1Minimum
  && metrics.requiresActionAccuracy !== null && metrics.requiresActionAccuracy >= freeze.oracleGate.requiresActionAccuracyMinimum
  && metrics.completeTaskCaseAccuracy !== null && metrics.completeTaskCaseAccuracy >= freeze.oracleGate.completeTaskCaseAccuracyMinimum
  && metrics.forbiddenDefaultSelections <= freeze.oracleGate.forbiddenDefaultSelectionsMaximum
  && revisionMetrics.supersededTaskExactAccuracy !== null && revisionMetrics.supersededTaskExactAccuracy >= freeze.oracleGate.supersededTaskExactAccuracyMinimum
  && revisionMetrics.activeReplacementRecall !== null && revisionMetrics.activeReplacementRecall >= freeze.oracleGate.activeReplacementRecallMinimum
  && revisionMetrics.selectedStaleTaskCount <= freeze.oracleGate.selectedStaleTasksMaximum
const output = { schemaVersion: 'rco-5-007-b5-oracle-1.0.0', authorizationId: 'RCO-5-007-P2-E1/B5', classification: 'FIRST_RUN_B5_ORACLE_NOW_SEEN_DEVELOPMENT', firstRunAgainstFrozenCommit: '578d2a3789eaa4f7af252b7587e3b0414ead1746', datasetId: dataset.datasetId, datasetSha256: createHash('sha256').update(datasetBytes).digest('hex'), accounting: { modelCalls: 0, networkRequests: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE' }, interpretation: 'Expected-derived perfect anchors isolate frozen P2 on a challenge set unseen until this one run. This is not model accuracy, independent human ground truth, real-data evidence, or release evidence.', metrics, revisionMetrics, gate: gatePassed ? 'PASS' : 'FAIL', decision: gatePassed ? 'B5_ORACLE_PASS_ELIGIBLE_FOR_SEPARATE_PAID_MODEL_AUTHORIZATION' : 'B5_ORACLE_FAIL_P2_GENERALIZATION_NOT_ESTABLISHED_PAID_MODEL_BLOCKED', cases, stablePath: 'UNCHANGED', rco6: 'NOT_STARTED', deployment: 'NOT_RUN' }
await mkdir(outputDir, { recursive: true })
await writeFile(resolve(outputDir, 'result.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8')
const pct = (value: number | null) => value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`
const failures = cases.filter((item) => item.score.majorCorrection || item.contractIssues.length > 0).map((item) => `- ${item.caseId}: contract=${item.contractIssues.map((issue) => issue.code).join(',') || 'PASS'}; TP/FP/FN=${item.score.taskCounts.tp}/${item.score.taskCounts.fp}/${item.score.taskCounts.fn}; requiresAction=${item.score.requiresActionCorrect ? 'PASS' : 'FAIL'}; boundary=${item.score.exactTaskBoundary ? 'PASS' : 'FAIL'}; semantics=${item.score.semanticFields.correct}/${item.score.semanticFields.total}`).join('\n') || '- none'
const report = `# RCO-5-007-B5 首次零调用盲测\n\n- B5 先在 commit \`${output.firstRunAgainstFrozenCommit}\` 冻结并推送，再进行本次唯一首次运行。\n- 调用：模型 0、网络 0、Repair 0、retry 0、Secret NONE。\n- 决策：\`${output.decision}\`。\n\n| 指标 | 结果 | 门槛 |\n|---|---:|---:|\n| Task Precision | ${pct(metrics.taskPrecision)} | 完整报告 |\n| Task Recall | ${pct(metrics.taskRecall)} | 完整报告 |\n| Task F1 | ${pct(metrics.taskF1)} | >=90% |\n| requiresAction | ${pct(metrics.requiresActionAccuracy)} | >=95% |\n| Semantic fields | ${pct(metrics.semanticFieldAccuracy)} | 完整报告 |\n| Exact task boundary | ${pct(metrics.exactTaskBoundaryAccuracy)} | 完整报告 |\n| Complete Task Case | ${pct(metrics.completeTaskCaseAccuracy)} | >=80% |\n| Major Correction | ${pct(metrics.majorCorrectionRate)} | 越低越好 |\n| Safe Default Recall | ${pct(metrics.safeDefaultRecall)} | 完整报告 |\n| Forbidden | ${metrics.forbiddenDefaultSelections} | 0 |\n| 修订案例整例正确 | ${pct(revisionMetrics.revisionCaseCompleteAccuracy)} | 完整报告 |\n| 旧要求完整失效表达 | ${pct(revisionMetrics.supersededTaskExactAccuracy)} | 100% |\n| 新要求生效召回 | ${pct(revisionMetrics.activeReplacementRecall)} | 100% |\n| 陈旧任务 / 被默认勾选的陈旧任务 | ${revisionMetrics.staleTaskCount} / ${revisionMetrics.selectedStaleTaskCount} | 后者 0 |\n\n## 不完整案例\n\n${failures}\n\n这不是模型正确率。上游锚点由 Expected 构造，只检验冻结 P2。B5 从本次运行起已见；失败后不得修改 P2 或 B5 再用本集声称首次泛化。\n`
await writeFile(resolve(outputDir, 'REPORT.md'), report, 'utf8')
console.log(JSON.stringify({ metrics, revisionMetrics, gate: output.gate, decision: output.decision }))
