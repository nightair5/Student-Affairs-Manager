import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { indexImmutableScopesV11 } from '../src/recognition/scopeIndexV11'
import { type ImmutableScopeIndex, type ScopeReferenceCandidate, type ScopeReferenceDirective, type ScopeReferenceObservation, type SurfaceReference } from '../src/recognition/scopeReferenceContract'
import { reduceModelCandidate } from '../src/recognition/taskFormationPolicyV2'
import { formLocalTaskSuggestionsP3, validateLocalTaskFormationP3 } from '../src/recognition/taskFormationPolicyP3'
import { aggregateTaskFormationScores, scoreTaskFormationCase, type TaskFormationExpectedCase, type TaskFormationPredictionCase } from '../src/recognition/taskFormationEvaluation'
import type { RevisionRelationKind } from '../src/recognition/revisionRelationResolver'

type ExpectedSurface = { scopeText: string; surface: string }
type ExpectedDirective = Omit<ScopeReferenceDirective, 'id' | 'propositionScopeIds' | 'action' | 'object' | 'timeRefs' | 'materialRefs' | 'eventRef' | 'locationRef' | 'revisionRefs'> & { expectedId: string; propositionScopeTexts: string[]; action: ExpectedSurface; object: ExpectedSurface; timeRefs: Array<ExpectedSurface & { type: ScopeReferenceDirective['timeRefs'][number]['type'] }>; materialRefs: Array<ExpectedSurface & { required: boolean }>; eventRef: ExpectedSurface | null; locationRef: ExpectedSurface | null; revisionRefs: ScopeReferenceDirective['revisionRefs']; expectedDefaultSelected: boolean }
type ExpectedObservation = Omit<ScopeReferenceObservation, 'id' | 'propositionScopeIds' | 'subject' | 'timeRefs' | 'locationRef'> & { expectedId: string; propositionScopeTexts: string[]; subject: ExpectedSurface; timeRefs: Array<ExpectedSurface & { type: ScopeReferenceObservation['timeRefs'][number]['type'] }>; locationRef: ExpectedSurface | null }
interface ExpectedRelation { kind: RevisionRelationKind; targetExpectedId: string; replacementExpectedIds: string[]; evidenceScopeTexts: string[]; resolution: 'shared_scope' | 'same_scope_position' | 'adjacent_unique_referent'; referentType: string | null }
interface Fixture extends TaskFormationExpectedCase { coverageTags: string[]; sourceText: string; expected: TaskFormationExpectedCase['expected'] & { directives: ExpectedDirective[]; observations: ExpectedObservation[]; ignoredScopeTexts: string[]; revisionRelations: ExpectedRelation[]; unresolvedRevisionScopeTexts: string[] } }
interface OracleGate { scoreableCases: number; taskF1Minimum: number; requiresActionAccuracyMinimum: number; completeTaskCaseAccuracyMinimum: number; forbiddenDefaultSelectionsMaximum: number; relationExactAccuracyByKindMinimum: Record<RevisionRelationKind, number>; supersededTaskExactAccuracyMinimum: number; activeReplacementRecallMinimum: number; staleTasksMaximum: number; selectedStaleTasksMaximum: number; unresolvedRevisionExactAccuracyMinimum: number }
interface ActualRelation { kind: RevisionRelationKind; targetExpectedId: string | null; replacementExpectedIds: Array<string | null>; evidenceScopeTexts: Array<string | null>; resolution: ExpectedRelation['resolution']; referentType: string | null }

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const datasetPath = 'docs/recognition-optimization/RCO-5-007-B6_CHALLENGE_DATASET.json'
const freezePath = 'docs/recognition-optimization/RCO-5-007-B6_DATA_FREEZE.json'
const outputDir = resolve(root, 'docs/recognition-optimization/rco-5-007-b6-oracle')
const resultPath = resolve(outputDir, 'result.json')
try {
  await access(resultPath)
  throw new Error('B6_FIRST_RUN_ALREADY_EXISTS')
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
}

const datasetBytes = await readFile(resolve(root, datasetPath))
const dataset = JSON.parse(datasetBytes.toString('utf8')) as { datasetId: string; cases: Fixture[] }
const freeze = JSON.parse(await readFile(resolve(root, freezePath), 'utf8')) as { datasetId: string; componentPaths: string[]; componentSha256: Record<string, string>; oracleGate: OracleGate }
const sha = async (path: string) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
for (const path of freeze.componentPaths) if (await sha(path) !== freeze.componentSha256[path]) throw new Error(`B6_FROZEN_COMPONENT_DRIFT:${path}`)
if (dataset.datasetId !== freeze.datasetId) throw new Error('B6_DATASET_ID_DRIFT')

function lookup(index: ImmutableScopeIndex, text: string): string {
  const matches = index.scopes.filter((scope) => scope.text === text)
  if (matches.length !== 1) throw new Error(`B6_ORACLE_SCOPE_NOT_UNIQUE:${text}`)
  return matches[0].id
}
function surface(index: ImmutableScopeIndex, value: ExpectedSurface): SurfaceReference { return { scopeId: lookup(index, value.scopeText), surface: value.surface } }
function oracleCandidate(fixture: Fixture, index: ImmutableScopeIndex): ScopeReferenceCandidate {
  return {
    schemaVersion: 'scope-reference-candidate-1.0', sourceId: fixture.id, sourceVersionId: 'source-v1', sourceFingerprint: index.sourceFingerprint,
    producerRunId: `b6-oracle-${fixture.id}`, requiresAction: fixture.expected.requiresAction,
    directives: fixture.expected.directives.map((item) => ({ id: item.expectedId, propositionScopeIds: item.propositionScopeTexts.map((text) => lookup(index, text)), semantics: item.semantics, inferenceLevel: item.inferenceLevel, actionType: item.actionType, action: surface(index, item.action), object: surface(index, item.object), effect: item.effect, timeRefs: item.timeRefs.map((ref) => ({ ...surface(index, ref), type: ref.type })), materialRefs: item.materialRefs.map((ref) => ({ ...surface(index, ref), required: ref.required })), eventRef: item.eventRef ? surface(index, item.eventRef) : null, locationRef: item.locationRef ? surface(index, item.locationRef) : null, revisionRefs: [] })),
    observations: fixture.expected.observations.map((item) => ({ id: item.expectedId, kind: item.kind, propositionScopeIds: item.propositionScopeTexts.map((text) => lookup(index, text)), semantics: item.semantics, inferenceLevel: item.inferenceLevel, subject: surface(index, item.subject), timeRefs: item.timeRefs.map((ref) => ({ ...surface(index, ref), type: ref.type })), locationRef: item.locationRef ? surface(index, item.locationRef) : null })),
    ignoredScopeIds: fixture.expected.ignoredScopeTexts.map((text) => lookup(index, text)),
  }
}

const cases = []
for (const fixture of dataset.cases) {
  const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
  const reduced = reduceModelCandidate(oracleCandidate(fixture, index))
  const formed = formLocalTaskSuggestionsP3(index, reduced)
  const contractIssues = validateLocalTaskFormationP3(formed, index, reduced)
  const scopeById = new Map(index.scopes.map((scope) => [scope.id, scope.text]))
  const prediction: TaskFormationPredictionCase = { caseId: fixture.id, status: contractIssues.length === 0 ? 'completed' : 'invalid', requiresAction: formed.requiresAction, tasks: formed.tasks.map((task) => ({ id: task.id, propositionScopeTexts: task.propositionScopeIds.map((id) => scopeById.get(id)).filter((text): text is string => Boolean(text)), semantics: task.semantics, inferenceLevel: task.inferenceLevel, actionType: task.actionType, action: task.action.surface, object: task.object.surface, effect: task.effect, selected: task.selected })) }
  const expectedIdByTaskId = new Map(formed.tasks.map((task) => {
    const match = fixture.expected.directives.find((item) => item.action.surface === task.action.surface && item.object.surface === task.object.surface)
    return [task.id, match?.expectedId ?? null]
  }))
  const actualRelations: ActualRelation[] = formed.revisionRelations.map((relation) => ({ kind: relation.kind, targetExpectedId: expectedIdByTaskId.get(relation.targetTaskId) ?? null, replacementExpectedIds: relation.replacementTaskIds.map((id) => expectedIdByTaskId.get(id) ?? null), evidenceScopeTexts: relation.evidenceScopeIds.map((id) => scopeById.get(id) ?? null), resolution: relation.resolution, referentType: relation.referentType }))
  const relationExact = JSON.stringify(actualRelations) === JSON.stringify(fixture.expected.revisionRelations)
  const actualUnresolvedScopeTexts = formed.unresolvedRevisionScopeIds.map((id) => scopeById.get(id) ?? null)
  const unresolvedExact = JSON.stringify(actualUnresolvedScopeTexts) === JSON.stringify(fixture.expected.unresolvedRevisionScopeTexts)
  const score = scoreTaskFormationCase(fixture, prediction)
  cases.push({ caseId: fixture.id, coverageTags: fixture.coverageTags, contractIssues, prediction, score, expectedRelations: fixture.expected.revisionRelations, actualRelations, relationExact, expectedUnresolvedScopeTexts: fixture.expected.unresolvedRevisionScopeTexts, actualUnresolvedScopeTexts, unresolvedExact })
}

const metrics = aggregateTaskFormationScores(cases.map((item) => item.score))
const revisionCases = cases.filter((item) => item.coverageTags.includes('revision'))
const relationKinds: RevisionRelationKind[] = ['cancels', 'supersedes', 'amends']
const relationExactAccuracyByKind = Object.fromEntries(relationKinds.map((kind) => {
  const expected = cases.reduce((sum, item) => sum + item.expectedRelations.filter((relation) => relation.kind === kind).length, 0)
  const correct = cases.filter((item) => item.relationExact && item.expectedRelations.some((relation) => relation.kind === kind)).reduce((sum, item) => sum + item.expectedRelations.filter((relation) => relation.kind === kind).length, 0)
  return [kind, expected === 0 ? null : correct / expected]
})) as Record<RevisionRelationKind, number | null>
const expectedRelationCount = cases.reduce((sum, item) => sum + item.expectedRelations.length, 0)
const actualRelationCount = cases.reduce((sum, item) => sum + item.actualRelations.length, 0)
const exactRelationCount = cases.filter((item) => item.relationExact).reduce((sum, item) => sum + item.expectedRelations.length, 0)
const relationPrecision = actualRelationCount === 0 ? null : exactRelationCount / actualRelationCount
const relationRecall = expectedRelationCount === 0 ? null : exactRelationCount / expectedRelationCount
const targetExpectedIds = new Set(dataset.cases.flatMap((fixture) => fixture.expected.revisionRelations.map((relation) => `${fixture.id}:${relation.targetExpectedId}`)))
const replacementExpectedIds = new Set(dataset.cases.flatMap((fixture) => fixture.expected.revisionRelations.flatMap((relation) => relation.replacementExpectedIds.map((id) => `${fixture.id}:${id}`))))
const expectedDirectiveByKey = new Map(dataset.cases.flatMap((fixture) => fixture.expected.directives.map((directive) => [`${fixture.id}:${directive.expectedId}`, directive] as const)))
const findPrediction = (key: string) => {
  const separator = key.indexOf(':')
  const caseId = key.slice(0, separator)
  const directive = expectedDirectiveByKey.get(key)
  return directive ? cases.find((item) => item.caseId === caseId)?.prediction.tasks.find((task) => task.action === directive.action.surface && task.object === directive.object.surface) : undefined
}
const exactInvalidated = [...targetExpectedIds].filter((key) => {
  const directive = expectedDirectiveByKey.get(key)
  const task = findPrediction(key)
  return Boolean(directive && task && JSON.stringify(task.semantics) === JSON.stringify(directive.semantics) && !task.selected)
}).length
const activeReplacementFound = [...replacementExpectedIds].filter((key) => { const task = findPrediction(key); return task?.semantics.validity === 'active' && task.semantics.status === 'pending' }).length
const staleTasks = [...targetExpectedIds].flatMap((key) => { const task = findPrediction(key); return task && (task.semantics.validity !== 'superseded' || task.semantics.status !== 'cancelled') ? [{ key, action: task.action, object: task.object, selected: task.selected, semantics: task.semantics }] : [] })
const unresolvedCases = cases.filter((item) => item.expectedUnresolvedScopeTexts.length > 0)
const revisionMetrics = {
  revisionCaseCount: revisionCases.length,
  expectedRelationCount,
  actualRelationCount,
  exactRelationCount,
  relationPrecision,
  relationRecall,
  relationExactAccuracyByKind,
  revisionCaseCompleteAccuracy: revisionCases.length === 0 ? null : revisionCases.filter((item) => item.score.completeTaskCase && item.relationExact && item.unresolvedExact).length / revisionCases.length,
  supersededTaskExactAccuracy: targetExpectedIds.size === 0 ? null : exactInvalidated / targetExpectedIds.size,
  activeReplacementRecall: replacementExpectedIds.size === 0 ? null : activeReplacementFound / replacementExpectedIds.size,
  staleTaskCount: staleTasks.length,
  selectedStaleTaskCount: staleTasks.filter((item) => item.selected).length,
  unresolvedRevisionExactAccuracy: unresolvedCases.length === 0 ? null : unresolvedCases.filter((item) => item.unresolvedExact).length / unresolvedCases.length,
  staleTasks,
}
const gatePassed = metrics.scoreableCases === freeze.oracleGate.scoreableCases
  && metrics.taskF1 !== null && metrics.taskF1 >= freeze.oracleGate.taskF1Minimum
  && metrics.requiresActionAccuracy !== null && metrics.requiresActionAccuracy >= freeze.oracleGate.requiresActionAccuracyMinimum
  && metrics.completeTaskCaseAccuracy !== null && metrics.completeTaskCaseAccuracy >= freeze.oracleGate.completeTaskCaseAccuracyMinimum
  && metrics.forbiddenDefaultSelections <= freeze.oracleGate.forbiddenDefaultSelectionsMaximum
  && relationKinds.every((kind) => relationExactAccuracyByKind[kind] !== null && relationExactAccuracyByKind[kind]! >= freeze.oracleGate.relationExactAccuracyByKindMinimum[kind])
  && revisionMetrics.supersededTaskExactAccuracy !== null && revisionMetrics.supersededTaskExactAccuracy >= freeze.oracleGate.supersededTaskExactAccuracyMinimum
  && revisionMetrics.activeReplacementRecall !== null && revisionMetrics.activeReplacementRecall >= freeze.oracleGate.activeReplacementRecallMinimum
  && revisionMetrics.staleTaskCount <= freeze.oracleGate.staleTasksMaximum
  && revisionMetrics.selectedStaleTaskCount <= freeze.oracleGate.selectedStaleTasksMaximum
  && revisionMetrics.unresolvedRevisionExactAccuracy !== null && revisionMetrics.unresolvedRevisionExactAccuracy >= freeze.oracleGate.unresolvedRevisionExactAccuracyMinimum

const output = {
  schemaVersion: 'rco-5-007-b6-oracle-1.0.0', authorizationId: 'RCO-5-007-P3/B6', classification: 'FIRST_RUN_B6_ORACLE_NOW_SEEN_DEVELOPMENT',
  firstRunAgainstFrozenCommit: 'ee7ffc9', datasetId: dataset.datasetId, datasetSha256: createHash('sha256').update(datasetBytes).digest('hex'),
  accounting: { modelCalls: 0, networkRequests: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE' },
  interpretation: 'Expected-derived perfect scope/action/object anchors isolate frozen P3 on a challenge set unseen until this one run. This is not model accuracy, independent human ground truth, real-data evidence, or release evidence.',
  metrics, revisionMetrics, gate: gatePassed ? 'PASS' : 'FAIL',
  decision: gatePassed ? 'B6_ORACLE_PASS_ELIGIBLE_FOR_SEPARATE_PAID_MODEL_AUTHORIZATION' : 'B6_ORACLE_FAIL_P3_GENERALIZATION_NOT_ESTABLISHED_PAID_MODEL_BLOCKED',
  cases, stablePath: 'UNCHANGED', rco6: 'NOT_STARTED', deployment: 'NOT_RUN',
}
await mkdir(outputDir, { recursive: true })
await writeFile(resultPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
const pct = (value: number | null) => value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`
const failures = cases.filter((item) => item.score.majorCorrection || item.contractIssues.length > 0 || !item.relationExact || !item.unresolvedExact).map((item) => `- ${item.caseId}: contract=${item.contractIssues.map((issue) => issue.code).join(',') || 'PASS'}; TP/FP/FN=${item.score.taskCounts.tp}/${item.score.taskCounts.fp}/${item.score.taskCounts.fn}; complete=${item.score.completeTaskCase ? 'PASS' : 'FAIL'}; relation=${item.relationExact ? 'PASS' : 'FAIL'}; unresolved=${item.unresolvedExact ? 'PASS' : 'FAIL'}`).join('\n') || '- none'
const report = `# RCO-5-007-B6 首次零调用盲测\n\n- B6 先在 commit \`${output.firstRunAgainstFrozenCommit}\` 冻结并推送，再进行本次唯一首次运行。\n- 调用：模型 0、网络 0、Repair 0、retry 0、Secret NONE。\n- 决策：\`${output.decision}\`。\n\n| 指标 | 结果 | 门槛 |\n|---|---:|---:|\n| Task Precision / Recall / F1 | ${pct(metrics.taskPrecision)} / ${pct(metrics.taskRecall)} / ${pct(metrics.taskF1)} | F1 >=90% |\n| requiresAction | ${pct(metrics.requiresActionAccuracy)} | >=95% |\n| Complete Task Case | ${pct(metrics.completeTaskCaseAccuracy)} | >=80% |\n| Major Correction | ${pct(metrics.majorCorrectionRate)} | 越低越好 |\n| Forbidden | ${metrics.forbiddenDefaultSelections} | 0 |\n| cancels / supersedes / amends 精确关系 | ${pct(relationExactAccuracyByKind.cancels)} / ${pct(relationExactAccuracyByKind.supersedes)} / ${pct(relationExactAccuracyByKind.amends)} | 各 100% |\n| 旧要求完整失效 / 新要求生效 | ${pct(revisionMetrics.supersededTaskExactAccuracy)} / ${pct(revisionMetrics.activeReplacementRecall)} | 各 100% |\n| stale / selected stale | ${revisionMetrics.staleTaskCount} / ${revisionMetrics.selectedStaleTaskCount} | 0 / 0 |\n| 歧义保持未解析 | ${pct(revisionMetrics.unresolvedRevisionExactAccuracy)} | 100% |\n| 修订整例 | ${pct(revisionMetrics.revisionCaseCompleteAccuracy)} | 完整报告 |\n\n## 不完整案例\n\n${failures}\n\n这不是模型正确率。上游 scope、动作和对象锚点由 Expected 构造，只检验冻结 P3 的本机任务形成与修订关系。B6 从本次运行起已见；不得修改 P3 或 B6 后再用本集声称首次泛化。\n`
await writeFile(resolve(outputDir, 'REPORT.md'), report, 'utf8')
console.log(JSON.stringify({ metrics, revisionMetrics, gate: output.gate, decision: output.decision }))
