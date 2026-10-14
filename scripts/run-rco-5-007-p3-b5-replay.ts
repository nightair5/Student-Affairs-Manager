import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { indexImmutableScopesV11 } from '../src/recognition/scopeIndexV11'
import { type ImmutableScopeIndex, type ScopeReferenceCandidate, type ScopeReferenceDirective, type ScopeReferenceObservation, type SurfaceReference } from '../src/recognition/scopeReferenceContract'
import { reduceModelCandidate } from '../src/recognition/taskFormationPolicyV2'
import { formLocalTaskSuggestionsP3, validateLocalTaskFormationP3 } from '../src/recognition/taskFormationPolicyP3'
import { aggregateTaskFormationScores, scoreTaskFormationCase, type TaskFormationExpectedCase, type TaskFormationPredictionCase } from '../src/recognition/taskFormationEvaluation'

type ExpectedSurface = { scopeText: string; surface: string }
type ExpectedDirective = Omit<ScopeReferenceDirective, 'id' | 'propositionScopeIds' | 'action' | 'object' | 'timeRefs' | 'materialRefs' | 'eventRef' | 'locationRef' | 'revisionRefs'> & { expectedId: string; propositionScopeTexts: string[]; action: ExpectedSurface; object: ExpectedSurface; timeRefs: Array<ExpectedSurface & { type: ScopeReferenceDirective['timeRefs'][number]['type'] }>; materialRefs: Array<ExpectedSurface & { required: boolean }>; eventRef: ExpectedSurface | null; locationRef: ExpectedSurface | null; revisionRefs: ScopeReferenceDirective['revisionRefs']; expectedDefaultSelected: boolean }
type ExpectedObservation = Omit<ScopeReferenceObservation, 'id' | 'propositionScopeIds' | 'subject' | 'timeRefs' | 'locationRef'> & { expectedId: string; propositionScopeTexts: string[]; subject: ExpectedSurface; timeRefs: Array<ExpectedSurface & { type: ScopeReferenceObservation['timeRefs'][number]['type'] }>; locationRef: ExpectedSurface | null }
interface Fixture extends TaskFormationExpectedCase { coverageTags: string[]; sourceText: string; expected: TaskFormationExpectedCase['expected'] & { directives: ExpectedDirective[]; observations: ExpectedObservation[]; ignoredScopeTexts: string[] } }

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const datasetPath = 'docs/recognition-optimization/RCO-5-007-B5_CHALLENGE_DATASET.json'
const dataFreezePath = 'docs/recognition-optimization/RCO-5-007-B5_DATA_FREEZE.json'
const resultFreezePath = 'docs/recognition-optimization/RCO-5-007-B5_RESULT_FREEZE.json'
const outputDir = resolve(root, 'docs/recognition-optimization/rco-5-007-p3-b5-replay')
const datasetBytes = await readFile(resolve(root, datasetPath))
const dataset = JSON.parse(datasetBytes.toString('utf8')) as { datasetId: string; cases: Fixture[] }
const dataFreeze = JSON.parse(await readFile(resolve(root, dataFreezePath), 'utf8')) as { datasetId: string; componentPaths: string[]; componentSha256: Record<string, string> }
const resultFreeze = JSON.parse(await readFile(resolve(root, resultFreezePath), 'utf8')) as { componentPaths: string[]; componentSha256: Record<string, string> }
const sha = async (path: string) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
for (const freeze of [dataFreeze, resultFreeze]) for (const path of freeze.componentPaths) if (await sha(path) !== freeze.componentSha256[path]) throw new Error(`B5_FROZEN_COMPONENT_DRIFT:${path}`)
if (dataset.datasetId !== dataFreeze.datasetId) throw new Error('B5_DATASET_ID_DRIFT')

function lookup(index: ImmutableScopeIndex, text: string): string { const matches = index.scopes.filter((scope) => scope.text === text); if (matches.length !== 1) throw new Error(`P3_B5_SCOPE_NOT_UNIQUE:${text}`); return matches[0].id }
function surface(index: ImmutableScopeIndex, value: ExpectedSurface): SurfaceReference { return { scopeId: lookup(index, value.scopeText), surface: value.surface } }
function oracleCandidate(fixture: Fixture, index: ImmutableScopeIndex): ScopeReferenceCandidate { return { schemaVersion: 'scope-reference-candidate-1.0', sourceId: fixture.id, sourceVersionId: 'source-v1', sourceFingerprint: index.sourceFingerprint, producerRunId: `p3-b5-replay-${fixture.id}`, requiresAction: fixture.expected.requiresAction, directives: fixture.expected.directives.map((item) => ({ id: item.expectedId, propositionScopeIds: item.propositionScopeTexts.map((text) => lookup(index, text)), semantics: item.semantics, inferenceLevel: item.inferenceLevel, actionType: item.actionType, action: surface(index, item.action), object: surface(index, item.object), effect: item.effect, timeRefs: item.timeRefs.map((ref) => ({ ...surface(index, ref), type: ref.type })), materialRefs: item.materialRefs.map((ref) => ({ ...surface(index, ref), required: ref.required })), eventRef: item.eventRef ? surface(index, item.eventRef) : null, locationRef: item.locationRef ? surface(index, item.locationRef) : null, revisionRefs: [] })), observations: fixture.expected.observations.map((item) => ({ id: item.expectedId, kind: item.kind, propositionScopeIds: item.propositionScopeTexts.map((text) => lookup(index, text)), semantics: item.semantics, inferenceLevel: item.inferenceLevel, subject: surface(index, item.subject), timeRefs: item.timeRefs.map((ref) => ({ ...surface(index, ref), type: ref.type })), locationRef: item.locationRef ? surface(index, item.locationRef) : null })), ignoredScopeIds: fixture.expected.ignoredScopeTexts.map((text) => lookup(index, text)) } }

const cases = []
for (const fixture of dataset.cases) {
  const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
  const reduced = reduceModelCandidate(oracleCandidate(fixture, index))
  const formed = formLocalTaskSuggestionsP3(index, reduced)
  const contractIssues = validateLocalTaskFormationP3(formed, index, reduced)
  const scopeById = new Map(index.scopes.map((scope) => [scope.id, scope.text]))
  const prediction: TaskFormationPredictionCase = { caseId: fixture.id, status: contractIssues.length === 0 ? 'completed' : 'invalid', requiresAction: formed.requiresAction, tasks: formed.tasks.map((task) => ({ id: task.id, propositionScopeTexts: task.propositionScopeIds.map((id) => scopeById.get(id)).filter((text): text is string => Boolean(text)), semantics: task.semantics, inferenceLevel: task.inferenceLevel, actionType: task.actionType, action: task.action.surface, object: task.object.surface, effect: task.effect, selected: task.selected })) }
  cases.push({ caseId: fixture.id, coverageTags: fixture.coverageTags, contractIssues, revisionRelations: formed.revisionRelations, unresolvedRevisionScopeIds: formed.unresolvedRevisionScopeIds, prediction, score: scoreTaskFormationCase(fixture, prediction) })
}
const metrics = aggregateTaskFormationScores(cases.map((item) => item.score))
const revisionCases = cases.filter((item) => item.coverageTags.includes('revision'))
const expectedSuperseded = dataset.cases.flatMap((fixture) => fixture.expected.directives.map((directive) => ({ caseId: fixture.id, directive })).filter((item) => item.directive.semantics.validity === 'superseded'))
const expectedActiveReplacements = dataset.cases.filter((fixture) => fixture.coverageTags.includes('revision')).flatMap((fixture) => fixture.expected.directives.map((directive) => ({ caseId: fixture.id, directive })).filter((item) => item.directive.semantics.validity === 'active'))
const find = (caseId: string, directive: ExpectedDirective) => cases.find((item) => item.caseId === caseId)?.prediction.tasks.find((task) => task.action === directive.action.surface && task.object === directive.object.surface)
const exactOld = expectedSuperseded.filter(({ caseId, directive }) => JSON.stringify(find(caseId, directive)?.semantics) === JSON.stringify(directive.semantics)).length
const activeNew = expectedActiveReplacements.filter(({ caseId, directive }) => { const task = find(caseId, directive); return task?.semantics.validity === 'active' && task.semantics.status === 'pending' }).length
const staleTasks = expectedSuperseded.flatMap(({ caseId, directive }) => { const task = find(caseId, directive); return task && (task.semantics.validity !== 'superseded' || task.semantics.status !== 'cancelled') ? [{ caseId, action: task.action, object: task.object, selected: task.selected }] : [] })
const revisionMetrics = { revisionCaseCount: revisionCases.length, relationCount: revisionCases.reduce((sum, item) => sum + item.revisionRelations.length, 0), unresolvedRevisionScopeCount: revisionCases.reduce((sum, item) => sum + item.unresolvedRevisionScopeIds.length, 0), revisionCaseCompleteAccuracy: revisionCases.filter((item) => item.score.completeTaskCase).length / revisionCases.length, supersededTaskExactAccuracy: exactOld / expectedSuperseded.length, activeReplacementRecall: activeNew / expectedActiveReplacements.length, staleTaskCount: staleTasks.length, selectedStaleTaskCount: staleTasks.filter((item) => item.selected).length, staleTasks }
const gatePassed = metrics.scoreableCases === 16
  && metrics.taskPrecision === 1 && metrics.taskRecall === 1 && metrics.taskF1 === 1
  && metrics.requiresActionAccuracy === 1 && metrics.semanticFieldAccuracy === 1
  && metrics.exactTaskBoundaryAccuracy === 1 && metrics.completeTaskCaseAccuracy === 1
  && metrics.majorCorrectionRate === 0 && metrics.safeDefaultRecall === 1
  && metrics.forbiddenDefaultSelections === 0
  && revisionMetrics.revisionCaseCompleteAccuracy === 1
  && revisionMetrics.supersededTaskExactAccuracy === 1
  && revisionMetrics.activeReplacementRecall === 1
  && revisionMetrics.staleTaskCount === 0 && revisionMetrics.selectedStaleTaskCount === 0
  && revisionMetrics.unresolvedRevisionScopeCount === 0
const output = { schemaVersion: 'rco-5-007-p3-b5-replay-1.0.0', authorizationId: 'RCO-5-007-P3/B6', classification: 'SEEN_B5_DEVELOPMENT_FAILURE_REGRESSION', datasetId: dataset.datasetId, datasetSha256: createHash('sha256').update(datasetBytes).digest('hex'), accounting: { modelCalls: 0, networkRequests: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE' }, interpretation: 'Seen B5 failure regression with Expected-derived perfect anchors. Not unseen generalization, model accuracy, real-data evidence, or release evidence.', metrics, revisionMetrics, gate: gatePassed ? 'PASS' : 'FAIL', decision: gatePassed ? 'P3_SEEN_B5_REGRESSION_PASS_ELIGIBLE_TO_FREEZE_P3' : 'P3_SEEN_B5_REGRESSION_FAIL_B6_BLOCKED', cases, stablePath: 'UNCHANGED', rco6: 'NOT_STARTED', deployment: 'NOT_RUN' }
await mkdir(outputDir, { recursive: true })
await writeFile(resolve(outputDir, 'result.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8')
const pct = (value: number | null) => value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`
const report = `# RCO-5-007-P3 已见 B5 回归\n\n- 分类：已见 B5 故障回归，不是新盲测。\n- 调用：模型 0、网络 0、Repair 0、retry 0、Secret NONE。\n- 决策：\`${output.decision}\`。\n\n| 指标 | P3 |\n|---|---:|\n| Task Precision / Recall / F1 | ${pct(metrics.taskPrecision)} / ${pct(metrics.taskRecall)} / ${pct(metrics.taskF1)} |\n| requiresAction | ${pct(metrics.requiresActionAccuracy)} |\n| Semantic fields | ${pct(metrics.semanticFieldAccuracy)} |\n| Complete Task Case | ${pct(metrics.completeTaskCaseAccuracy)} |\n| Major Correction | ${pct(metrics.majorCorrectionRate)} |\n| Safe Default Recall | ${pct(metrics.safeDefaultRecall)} |\n| Forbidden | ${metrics.forbiddenDefaultSelections} |\n| 修订整例 | ${pct(revisionMetrics.revisionCaseCompleteAccuracy)} |\n| 旧要求失效 / 新要求生效 | ${pct(revisionMetrics.supersededTaskExactAccuracy)} / ${pct(revisionMetrics.activeReplacementRecall)} |\n| stale / selected stale / unresolved | ${revisionMetrics.staleTaskCount} / ${revisionMetrics.selectedStaleTaskCount} / ${revisionMetrics.unresolvedRevisionScopeCount} |\n\nP3 将 B5-08 的状态声明与旧任务建立 \`supersedes\` 边；旧任务保留审计但退出当前待办，新任务独立生效。B5 已见，只能支持故障修复结论。\n`
await writeFile(resolve(outputDir, 'REPORT.md'), report, 'utf8')
console.log(JSON.stringify({ metrics, revisionMetrics, gate: output.gate, decision: output.decision }))
