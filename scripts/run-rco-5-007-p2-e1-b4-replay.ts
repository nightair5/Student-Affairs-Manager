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
interface Fixture extends TaskFormationExpectedCase { sourceText: string; expected: TaskFormationExpectedCase['expected'] & { directives: ExpectedDirective[]; observations: ExpectedObservation[]; ignoredScopeTexts: string[] } }

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const datasetPath = 'docs/recognition-optimization/RCO-5-007-B4_CHALLENGE_DATASET.json'
const originalFreezePath = 'docs/recognition-optimization/RCO-5-007-B4_DATA_FREEZE.json'
const correctionPath = 'docs/recognition-optimization/RCO-5-007-P2-E1_TYPE_CORRECTION.json'
const originalResultPath = 'docs/recognition-optimization/rco-5-007-b4-oracle/result.json'
const outputDir = resolve(root, 'docs/recognition-optimization/rco-5-007-p2-e1-b4-replay')
const bytes = await readFile(resolve(root, datasetPath))
const dataset = JSON.parse(bytes.toString('utf8')) as { datasetId: string; cases: Fixture[] }
const originalFreeze = JSON.parse(await readFile(resolve(root, originalFreezePath), 'utf8')) as { componentPaths: string[]; componentSha256: Record<string, string> }
const correction = JSON.parse(await readFile(resolve(root, correctionPath), 'utf8')) as { correctedPath: string; afterSourceSha256: string; runtimeEquivalent: boolean; frozenDriftCount: number }
const originalResultBytes = await readFile(resolve(root, originalResultPath))
const originalResult = JSON.parse(originalResultBytes.toString('utf8')) as { datasetId: string; metrics: ReturnType<typeof aggregateTaskFormationScores>; cases: unknown[] }
const sha = async (path: string) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
if (!correction.runtimeEquivalent || correction.frozenDriftCount !== 1) throw new Error('E1_CORRECTION_NOT_RUNTIME_EQUIVALENT')
for (const path of originalFreeze.componentPaths) {
  const current = await sha(path)
  if (path === correction.correctedPath) { if (current !== correction.afterSourceSha256) throw new Error('E1_CORRECTED_TEST_DRIFT') }
  else if (current !== originalFreeze.componentSha256[path]) throw new Error(`E1_UNAUTHORIZED_PROTECTED_DRIFT:${path}`)
}

function lookup(index: ImmutableScopeIndex, text: string): string { const matches = index.scopes.filter((scope) => scope.text === text); if (matches.length !== 1) throw new Error(`E1_B4_SCOPE_NOT_UNIQUE:${text}`); return matches[0].id }
function surface(index: ImmutableScopeIndex, value: ExpectedSurface): SurfaceReference { return { scopeId: lookup(index, value.scopeText), surface: value.surface } }
function candidate(fixture: Fixture, index: ImmutableScopeIndex): ScopeReferenceCandidate { return { schemaVersion: 'scope-reference-candidate-1.0', sourceId: fixture.id, sourceVersionId: 'source-v1', sourceFingerprint: index.sourceFingerprint, producerRunId: `e1-b4-replay-${fixture.id}`, requiresAction: fixture.expected.requiresAction, directives: fixture.expected.directives.map((item) => ({ id: item.expectedId, propositionScopeIds: item.propositionScopeTexts.map((text) => lookup(index, text)), semantics: item.semantics, inferenceLevel: item.inferenceLevel, actionType: item.actionType, action: surface(index, item.action), object: surface(index, item.object), effect: item.effect, timeRefs: item.timeRefs.map((ref) => ({ ...surface(index, ref), type: ref.type })), materialRefs: item.materialRefs.map((ref) => ({ ...surface(index, ref), required: ref.required })), eventRef: item.eventRef ? surface(index, item.eventRef) : null, locationRef: item.locationRef ? surface(index, item.locationRef) : null, revisionRefs: item.revisionRefs.map((ref) => ({ ...ref })) })), observations: fixture.expected.observations.map((item) => ({ id: item.expectedId, kind: item.kind, propositionScopeIds: item.propositionScopeTexts.map((text) => lookup(index, text)), semantics: item.semantics, inferenceLevel: item.inferenceLevel, subject: surface(index, item.subject), timeRefs: item.timeRefs.map((ref) => ({ ...surface(index, ref), type: ref.type })), locationRef: item.locationRef ? surface(index, item.locationRef) : null })), ignoredScopeIds: fixture.expected.ignoredScopeTexts.map((text) => lookup(index, text)) } }

const cases = []
for (const fixture of dataset.cases) {
  const index = await indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
  const reduced = reduceModelCandidate(candidate(fixture, index))
  const formed = formLocalTaskSuggestionsP2(index, reduced)
  const contractIssues = validateLocalTaskFormationP2(formed, index, reduced)
  const scopeById = new Map(index.scopes.map((scope) => [scope.id, scope.text]))
  const prediction: TaskFormationPredictionCase = { caseId: fixture.id, status: contractIssues.length === 0 ? 'completed' : 'invalid', requiresAction: formed.requiresAction, tasks: formed.tasks.map((task) => ({ id: task.id, propositionScopeTexts: task.propositionScopeIds.map((id) => scopeById.get(id)).filter((text): text is string => Boolean(text)), semantics: task.semantics, inferenceLevel: task.inferenceLevel, actionType: task.actionType, action: task.action.surface, object: task.object.surface, effect: task.effect, selected: task.selected })) }
  cases.push({ caseId: fixture.id, contractIssues, prediction, score: scoreTaskFormationCase(fixture, prediction) })
}
const metrics = aggregateTaskFormationScores(cases.map((item) => item.score))
const replayCasesEqual = JSON.stringify(cases) === JSON.stringify(originalResult.cases)
const metricsEqual = JSON.stringify(metrics) === JSON.stringify(originalResult.metrics)
if (!replayCasesEqual || !metricsEqual || originalResult.datasetId !== dataset.datasetId) throw new Error('E1_B4_REPLAY_NOT_IDENTICAL')
const output = { schemaVersion: 'rco-5-007-p2-e1-b4-replay-1.0.0', classification: 'SEEN_B4_TYPE_FIX_REGRESSION', datasetId: dataset.datasetId, datasetSha256: createHash('sha256').update(bytes).digest('hex'), originalResultSha256: createHash('sha256').update(originalResultBytes).digest('hex'), correctionPath, correctionRuntimeEquivalent: true, replayCasesEqual, metricsEqual, metrics, accounting: { modelCalls: 0, networkRequests: 0, repairCalls: 0, retryCalls: 0, secretAccess: 'NONE' }, decision: 'TYPE_FIX_RUNTIME_EQUIVALENT_B4_REGRESSION_PASS_ELIGIBLE_TO_RUN_ENGINEERING_GATES', stablePath: 'UNCHANGED', rco6: 'NOT_STARTED', deployment: 'NOT_RUN' }
await mkdir(outputDir, { recursive: true })
await writeFile(resolve(outputDir, 'result.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8')
await writeFile(resolve(outputDir, 'REPORT.md'), `# RCO-5-007-P2-E1 已见 B4 回归\n\n- 修复前后 TypeScript 转译 JavaScript：逐字哈希一致。\n- B4 新旧逐例 prediction/score：完全一致。\n- 模型/网络/Secret：0/0/NONE。\n- 分类：已见 B4 类型修复回归，不是新盲测。\n- 决策：\`${output.decision}\`。\n`, 'utf8')
console.log(JSON.stringify({ replayCasesEqual, metricsEqual, metrics, decision: output.decision }))
