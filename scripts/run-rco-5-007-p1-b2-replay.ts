import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { indexImmutableScopesV11 } from '../src/recognition/scopeIndexV11'
import {
  type ImmutableScopeIndex,
  type ScopeReferenceCandidate,
  type ScopeReferenceDirective,
  type SurfaceReference,
} from '../src/recognition/scopeReferenceContract'
import { formLocalTaskSuggestions, reduceModelCandidate, validateLocalTaskFormation } from '../src/recognition/taskFormationPolicyV2'
import { formLocalTaskSuggestionsP1, validateLocalTaskFormationP1 } from '../src/recognition/taskFormationPolicyP1'
import {
  aggregateTaskFormationScores,
  pairedTaskFormationDelta,
  scoreTaskFormationCase,
  type TaskFormationExpectedCase,
  type TaskFormationPredictionCase,
} from '../src/recognition/taskFormationEvaluation'

type ExpectedSurface = { scopeText: string; surface: string }
type ExpectedDirective = Omit<ScopeReferenceDirective, 'id' | 'propositionScopeIds' | 'action' | 'object' | 'timeRefs' | 'materialRefs' | 'eventRef' | 'locationRef' | 'revisionRefs'> & {
  expectedId: string
  propositionScopeTexts: string[]
  action: ExpectedSurface
  object: ExpectedSurface
  timeRefs: Array<ExpectedSurface & { type: ScopeReferenceDirective['timeRefs'][number]['type'] }>
  materialRefs: Array<ExpectedSurface & { required: boolean }>
  eventRef: ExpectedSurface | null
  locationRef: ExpectedSurface | null
  revisionRefs: Array<{ type: ScopeReferenceDirective['revisionRefs'][number]['type']; targetExpectedDirectiveId: string; scopeTexts: string[] }>
  expectedDefaultSelected: boolean
}
interface Fixture extends TaskFormationExpectedCase {
  sourceText: string
  expected: TaskFormationExpectedCase['expected'] & { directives: ExpectedDirective[] }
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const datasetPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B2_CHALLENGE_DATASET.json')
const b2FreezePath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B2_FREEZE.json')
const oldResultPath = resolve(root, 'docs/recognition-optimization/rco-5-007-b2-oracle/result.json')
const outputDir = resolve(root, 'docs/recognition-optimization/rco-5-007-p1-b2-replay')
const resultPath = resolve(outputDir, 'result.json')
const reportPath = resolve(outputDir, 'REPORT.md')
const datasetBytes = await readFile(datasetPath)
const dataset = JSON.parse(datasetBytes.toString('utf8')) as { datasetId: string; cases: Fixture[] }
const b2Freeze = JSON.parse(await readFile(b2FreezePath, 'utf8')) as { componentPaths: string[]; componentSha256: Record<string, string> }
const oldFrozenResult = JSON.parse(await readFile(oldResultPath, 'utf8')) as { metrics: ReturnType<typeof aggregateTaskFormationScores> }

const sha256 = async (path: string) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
for (const path of b2Freeze.componentPaths) {
  if (await sha256(path) !== b2Freeze.componentSha256[path]) throw new Error(`B2_PROTECTED_COMPONENT_DRIFT:${path}`)
}

function lookup(index: ImmutableScopeIndex, text: string): string {
  const matches = index.scopes.filter((scope) => scope.text === text)
  if (matches.length !== 1) throw new Error(`P1_ORACLE_SCOPE_NOT_UNIQUE:${text}`)
  return matches[0].id
}

function surface(index: ImmutableScopeIndex, value: ExpectedSurface): SurfaceReference {
  return { scopeId: lookup(index, value.scopeText), surface: value.surface }
}

function oracleCandidate(fixture: Fixture, index: ImmutableScopeIndex): ScopeReferenceCandidate {
  return {
    schemaVersion: 'scope-reference-candidate-1.0',
    sourceId: fixture.id,
    sourceVersionId: 'source-v1',
    sourceFingerprint: index.sourceFingerprint,
    producerRunId: `p1-oracle-anchor-${fixture.id}`,
    requiresAction: fixture.expected.requiresAction,
    directives: fixture.expected.directives.map((item) => ({
      id: item.expectedId,
      propositionScopeIds: item.propositionScopeTexts.map((text) => lookup(index, text)),
      semantics: item.semantics,
      inferenceLevel: item.inferenceLevel,
      actionType: item.actionType,
      action: surface(index, item.action),
      object: surface(index, item.object),
      effect: item.effect,
      timeRefs: item.timeRefs.map((ref) => ({ ...surface(index, ref), type: ref.type })),
      materialRefs: item.materialRefs.map((ref) => ({ ...surface(index, ref), required: ref.required })),
      eventRef: item.eventRef ? surface(index, item.eventRef) : null,
      locationRef: item.locationRef ? surface(index, item.locationRef) : null,
      revisionRefs: item.revisionRefs.map((ref) => ({
        type: ref.type,
        targetDirectiveId: ref.targetExpectedDirectiveId,
        scopeIds: ref.scopeTexts.map((text) => lookup(index, text)),
      })),
    })),
    observations: [],
    ignoredScopeIds: [],
  }
}

function prediction(
  fixture: Fixture,
  index: ImmutableScopeIndex,
  formed: ReturnType<typeof formLocalTaskSuggestions> | ReturnType<typeof formLocalTaskSuggestionsP1>,
  contractIssues: Array<{ code: string; path: string }>,
): TaskFormationPredictionCase {
  const scopeById = new Map(index.scopes.map((scope) => [scope.id, scope.text]))
  return {
    caseId: fixture.id,
    status: contractIssues.length === 0 ? 'completed' : 'invalid',
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

const cases = []
for (const fixture of dataset.cases) {
  const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
  const reduced = reduceModelCandidate(oracleCandidate(fixture, index))
  const oldFormed = formLocalTaskSuggestions(index, reduced)
  const p1Formed = formLocalTaskSuggestionsP1(index, reduced)
  const oldIssues = validateLocalTaskFormation(oldFormed, index)
  const p1Issues = validateLocalTaskFormationP1(p1Formed, index)
  const oldPrediction = prediction(fixture, index, oldFormed, oldIssues)
  const p1Prediction = prediction(fixture, index, p1Formed, p1Issues)
  cases.push({
    caseId: fixture.id,
    old: { contractIssues: oldIssues, prediction: oldPrediction, score: scoreTaskFormationCase(fixture, oldPrediction) },
    p1: { contractIssues: p1Issues, prediction: p1Prediction, score: scoreTaskFormationCase(fixture, p1Prediction) },
  })
}

const oldMetrics = aggregateTaskFormationScores(cases.map((item) => item.old.score))
const p1Metrics = aggregateTaskFormationScores(cases.map((item) => item.p1.score))
if (JSON.stringify(oldMetrics) !== JSON.stringify(oldFrozenResult.metrics)) throw new Error('B2_OLD_BASELINE_REPLAY_DRIFT')
const paired = pairedTaskFormationDelta(cases.map((item) => item.old.score), cases.map((item) => item.p1.score))
const gatePassed = p1Metrics.scoreableCases === dataset.cases.length
  && p1Metrics.taskPrecision === 1
  && p1Metrics.taskRecall === 1
  && p1Metrics.taskF1 === 1
  && p1Metrics.requiresActionAccuracy === 1
  && p1Metrics.semanticFieldAccuracy === 1
  && p1Metrics.exactTaskBoundaryAccuracy === 1
  && p1Metrics.completeTaskCaseAccuracy === 1
  && p1Metrics.majorCorrectionRate === 0
  && p1Metrics.safeDefaultRecall === 1
  && p1Metrics.forbiddenDefaultSelections === 0
const output = {
  schemaVersion: 'rco-5-007-p1-b2-replay-1.0.0',
  authorizationId: 'RCO-5-007-P1',
  classification: 'SEEN_B2_DEVELOPMENT_DIAGNOSTIC_REPLAY',
  datasetId: dataset.datasetId,
  datasetSha256: createHash('sha256').update(datasetBytes).digest('hex'),
  accounting: { modelCalls: 0, networkRequests: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE' },
  interpretation: 'Expected-derived perfect anchors compare the frozen old local policy with the isolated P1 policy on seen B2 failures. This is neither model accuracy nor unseen generalization.',
  oldMetrics,
  p1Metrics,
  paired,
  gate: gatePassed ? 'PASS' : 'FAIL',
  decision: gatePassed ? 'KNOWN_B2_FAILURES_REPAIRED_ELIGIBLE_FOR_NEW_B3_ZERO_CALL_GATE' : 'REJECT_P1',
  cases,
  stablePath: 'UNCHANGED',
  rco6: 'NOT_STARTED',
  deployment: 'NOT_RUN',
}
await mkdir(outputDir, { recursive: true })
await writeFile(resultPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
const pct = (value: number | null) => value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`
const failed = cases.filter((item) => item.p1.score.majorCorrection || item.p1.contractIssues.length > 0)
  .map((item) => `- ${item.caseId}: ${item.p1.contractIssues.map((issue) => issue.code).join(', ') || 'quality mismatch'}`).join('\n') || '- none'
const report = `# RCO-5-007-P1 B2 零调用故障回归\n\n- 分类：已见 B2 Development 诊断，不是模型正确率或未见泛化。\n- 调用：模型 0、网络 0、Secret NONE。\n- 决策：\`${output.decision}\`。\n\n| 指标 | 旧策略 | P1 |\n|---|---:|---:|\n| Task F1 | ${pct(oldMetrics.taskF1)} | ${pct(p1Metrics.taskF1)} |\n| requiresAction | ${pct(oldMetrics.requiresActionAccuracy)} | ${pct(p1Metrics.requiresActionAccuracy)} |\n| Semantic fields | ${pct(oldMetrics.semanticFieldAccuracy)} | ${pct(p1Metrics.semanticFieldAccuracy)} |\n| Exact task boundary | ${pct(oldMetrics.exactTaskBoundaryAccuracy)} | ${pct(p1Metrics.exactTaskBoundaryAccuracy)} |\n| Complete Task Case | ${pct(oldMetrics.completeTaskCaseAccuracy)} | ${pct(p1Metrics.completeTaskCaseAccuracy)} |\n| Major Correction | ${pct(oldMetrics.majorCorrectionRate)} | ${pct(p1Metrics.majorCorrectionRate)} |\n| Safe Default Recall | ${pct(oldMetrics.safeDefaultRecall)} | ${pct(p1Metrics.safeDefaultRecall)} |\n| Forbidden | ${oldMetrics.forbiddenDefaultSelections} | ${p1Metrics.forbiddenDefaultSelections} |\n\n## P1 未通过案例\n\n${failed}\n\nP1 通过只表示已知 B2 故障被修复。下一步必须另获授权，创建并冻结全新 B3，再先跑零调用理想锚点门。\n`
await writeFile(reportPath, report, 'utf8')
console.log(JSON.stringify({ result: resultPath, report: reportPath, oldMetrics, p1Metrics, gate: output.gate, decision: output.decision }))
