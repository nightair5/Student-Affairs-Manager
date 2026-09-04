import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { indexImmutableScopesV11 } from '../src/recognition/scopeIndexV11'
import { type ImmutableScopeIndex, type ScopeReferenceCandidate, type ScopeReferenceDirective, type ScopeReferenceObservation, type SurfaceReference } from '../src/recognition/scopeReferenceContract'
import { reduceModelCandidate } from '../src/recognition/taskFormationPolicyV2'
import { formLocalTaskSuggestionsP2, validateLocalTaskFormationP2 } from '../src/recognition/taskFormationPolicyP2'
import { aggregateTaskFormationScores, pairedTaskFormationDelta, scoreTaskFormationCase, type TaskFormationExpectedCase, type TaskFormationPredictionCase } from '../src/recognition/taskFormationEvaluation'

type ExpectedSurface = { scopeText: string; surface: string }
type ExpectedDirective = Omit<ScopeReferenceDirective, 'id' | 'propositionScopeIds' | 'action' | 'object' | 'timeRefs' | 'materialRefs' | 'eventRef' | 'locationRef' | 'revisionRefs'> & { expectedId: string; propositionScopeTexts: string[]; action: ExpectedSurface; object: ExpectedSurface; timeRefs: Array<ExpectedSurface & { type: ScopeReferenceDirective['timeRefs'][number]['type'] }>; materialRefs: Array<ExpectedSurface & { required: boolean }>; eventRef: ExpectedSurface | null; locationRef: ExpectedSurface | null; revisionRefs: Array<{ type: ScopeReferenceDirective['revisionRefs'][number]['type']; targetExpectedDirectiveId: string; scopeTexts: string[] }>; expectedDefaultSelected: boolean }
type ExpectedObservation = Omit<ScopeReferenceObservation, 'id' | 'propositionScopeIds' | 'subject' | 'timeRefs' | 'locationRef'> & { expectedId: string; propositionScopeTexts: string[]; subject: ExpectedSurface; timeRefs: Array<ExpectedSurface & { type: ScopeReferenceObservation['timeRefs'][number]['type'] }>; locationRef: ExpectedSurface | null }
interface Fixture extends TaskFormationExpectedCase { sourceText: string; expected: TaskFormationExpectedCase['expected'] & { directives: ExpectedDirective[]; observations: ExpectedObservation[]; ignoredScopeTexts: string[] } }

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const datasetPath = 'docs/recognition-optimization/RCO-5-007-B3_CHALLENGE_DATASET.json'
const dataFreezePath = 'docs/recognition-optimization/RCO-5-007-B3_DATA_FREEZE.json'
const resultFreezePath = 'docs/recognition-optimization/RCO-5-007-B3_RESULT_FREEZE.json'
const p1ResultPath = 'docs/recognition-optimization/rco-5-007-b3-oracle/result.json'
const outputDir = resolve(root, 'docs/recognition-optimization/rco-5-007-p2-b3-replay')
const datasetBytes = await readFile(resolve(root, datasetPath))
const dataset = JSON.parse(datasetBytes.toString('utf8')) as { datasetId: string; cases: Fixture[] }
const dataFreeze = JSON.parse(await readFile(resolve(root, dataFreezePath), 'utf8')) as { componentPaths: string[]; componentSha256: Record<string, string> }
const resultFreeze = JSON.parse(await readFile(resolve(root, resultFreezePath), 'utf8')) as { componentPaths: string[]; componentSha256: Record<string, string> }
const p1Result = JSON.parse(await readFile(resolve(root, p1ResultPath), 'utf8')) as { metrics: ReturnType<typeof aggregateTaskFormationScores> }
const sha = async (path: string) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
for (const freeze of [dataFreeze, resultFreeze]) for (const path of freeze.componentPaths) if (await sha(path) !== freeze.componentSha256[path]) throw new Error(`B3_PROTECTED_COMPONENT_DRIFT:${path}`)

function lookup(index: ImmutableScopeIndex, text: string): string { const matches = index.scopes.filter((scope) => scope.text === text); if (matches.length !== 1) throw new Error(`P2_B3_SCOPE_NOT_UNIQUE:${text}`); return matches[0].id }
function surface(index: ImmutableScopeIndex, value: ExpectedSurface): SurfaceReference { return { scopeId: lookup(index, value.scopeText), surface: value.surface } }
function oracleCandidate(fixture: Fixture, index: ImmutableScopeIndex): ScopeReferenceCandidate {
  return { schemaVersion: 'scope-reference-candidate-1.0', sourceId: fixture.id, sourceVersionId: 'source-v1', sourceFingerprint: index.sourceFingerprint, producerRunId: `p2-b3-oracle-${fixture.id}`, requiresAction: fixture.expected.requiresAction,
    directives: fixture.expected.directives.map((item) => ({ id: item.expectedId, propositionScopeIds: item.propositionScopeTexts.map((text) => lookup(index, text)), semantics: item.semantics, inferenceLevel: item.inferenceLevel, actionType: item.actionType, action: surface(index, item.action), object: surface(index, item.object), effect: item.effect, timeRefs: item.timeRefs.map((ref) => ({ ...surface(index, ref), type: ref.type })), materialRefs: item.materialRefs.map((ref) => ({ ...surface(index, ref), required: ref.required })), eventRef: item.eventRef ? surface(index, item.eventRef) : null, locationRef: item.locationRef ? surface(index, item.locationRef) : null, revisionRefs: item.revisionRefs.map((ref) => ({ type: ref.type, targetDirectiveId: ref.targetExpectedDirectiveId, scopeIds: ref.scopeTexts.map((text) => lookup(index, text)) })) })),
    observations: fixture.expected.observations.map((item) => ({ id: item.expectedId, kind: item.kind, propositionScopeIds: item.propositionScopeTexts.map((text) => lookup(index, text)), semantics: item.semantics, inferenceLevel: item.inferenceLevel, subject: surface(index, item.subject), timeRefs: item.timeRefs.map((ref) => ({ ...surface(index, ref), type: ref.type })), locationRef: item.locationRef ? surface(index, item.locationRef) : null })), ignoredScopeIds: fixture.expected.ignoredScopeTexts.map((text) => lookup(index, text)) }
}
const cases = []
for (const fixture of dataset.cases) {
  const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
  const reduced = reduceModelCandidate(oracleCandidate(fixture, index))
  const formed = formLocalTaskSuggestionsP2(index, reduced)
  const contractIssues = validateLocalTaskFormationP2(formed, index, reduced)
  const scopeById = new Map(index.scopes.map((scope) => [scope.id, scope.text]))
  const prediction: TaskFormationPredictionCase = { caseId: fixture.id, status: contractIssues.length === 0 ? 'completed' : 'invalid', requiresAction: formed.requiresAction, tasks: formed.tasks.map((task) => ({ id: task.id, propositionScopeTexts: task.propositionScopeIds.map((id) => scopeById.get(id)).filter((text): text is string => Boolean(text)), semantics: task.semantics, inferenceLevel: task.inferenceLevel, actionType: task.actionType, action: task.action.surface, object: task.object.surface, effect: task.effect, selected: task.selected })) }
  cases.push({ caseId: fixture.id, contractIssues, prediction, score: scoreTaskFormationCase(fixture, prediction) })
}
const metrics = aggregateTaskFormationScores(cases.map((item) => item.score))
const p1Scores = (JSON.parse(await readFile(resolve(root, p1ResultPath), 'utf8')) as { cases: Array<{ score: ReturnType<typeof scoreTaskFormationCase> }> }).cases.map((item) => item.score)
const paired = pairedTaskFormationDelta(p1Scores, cases.map((item) => item.score))
const gatePassed = metrics.scoreableCases === 16 && metrics.taskPrecision === 1 && metrics.taskRecall === 1 && metrics.taskF1 === 1 && metrics.requiresActionAccuracy === 1 && metrics.semanticFieldAccuracy === 1 && metrics.exactTaskBoundaryAccuracy === 1 && metrics.completeTaskCaseAccuracy === 1 && metrics.majorCorrectionRate === 0 && metrics.safeDefaultRecall === 1 && metrics.forbiddenDefaultSelections === 0
const output = { schemaVersion: 'rco-5-007-p2-b3-replay-1.0.0', authorizationId: 'RCO-5-007-P2', classification: 'SEEN_B3_DEVELOPMENT_FAILURE_REGRESSION', datasetId: dataset.datasetId, datasetSha256: createHash('sha256').update(datasetBytes).digest('hex'), accounting: { modelCalls: 0, networkRequests: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE' }, interpretation: 'Expected-derived anchors test isolated P2 against seen B3 failures. This is not unseen generalization or model accuracy.', p1Metrics: p1Result.metrics, p2Metrics: metrics, paired, gate: gatePassed ? 'PASS' : 'FAIL', decision: gatePassed ? 'KNOWN_B3_FAILURES_REPAIRED_ELIGIBLE_TO_FREEZE_P2_THEN_CREATE_B4' : 'P2_REJECTED_B4_BLOCKED', cases, stablePath: 'UNCHANGED', rco6: 'NOT_STARTED', deployment: 'NOT_RUN' }
await mkdir(outputDir, { recursive: true })
await writeFile(resolve(outputDir, 'result.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8')
const pct = (value: number | null) => value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`
const failures = cases.filter((item) => item.score.majorCorrection || item.contractIssues.length > 0).map((item) => `- ${item.caseId}: ${item.contractIssues.map((issue) => issue.code).join(', ') || 'quality mismatch'}`).join('\n') || '- none'
const report = `# RCO-5-007-P2 已见 B3 故障回归\n\n- 分类：已见 B3 Development 故障回归，不是模型正确率或未见泛化。\n- 调用：模型 0、网络 0、Secret NONE。\n- 决策：\`${output.decision}\`。\n\n| 指标 | P1 | P2 |\n|---|---:|---:|\n| Task F1 | ${pct(p1Result.metrics.taskF1)} | ${pct(metrics.taskF1)} |\n| requiresAction | ${pct(p1Result.metrics.requiresActionAccuracy)} | ${pct(metrics.requiresActionAccuracy)} |\n| Semantic fields | ${pct(p1Result.metrics.semanticFieldAccuracy)} | ${pct(metrics.semanticFieldAccuracy)} |\n| Exact task boundary | ${pct(p1Result.metrics.exactTaskBoundaryAccuracy)} | ${pct(metrics.exactTaskBoundaryAccuracy)} |\n| Complete Task Case | ${pct(p1Result.metrics.completeTaskCaseAccuracy)} | ${pct(metrics.completeTaskCaseAccuracy)} |\n| Major Correction | ${pct(p1Result.metrics.majorCorrectionRate)} | ${pct(metrics.majorCorrectionRate)} |\n| Safe Default Recall | ${pct(p1Result.metrics.safeDefaultRecall)} | ${pct(metrics.safeDefaultRecall)} |\n| Forbidden | ${p1Result.metrics.forbiddenDefaultSelections} | ${metrics.forbiddenDefaultSelections} |\n\n## P2 未通过案例\n\n${failures}\n\n只有本回归满分并冻结 P2 后，才允许创建全新 B4。\n`
await writeFile(resolve(outputDir, 'REPORT.md'), report, 'utf8')
console.log(JSON.stringify({ metrics, gate: output.gate, decision: output.decision }))
