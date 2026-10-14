import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B6_DATA_FREEZE.json')
const paths = [
  'docs/recognition-optimization/RCO-5-007-B6_CHALLENGE_DATASET.json',
  'docs/recognition-optimization/RCO-5-007-P3-B6_PLAN.md',
  'scripts/generate-rco-5-007-b6-dataset.mjs',
  'src/recognition/taskFormationB6Dataset.test.ts',
  'docs/recognition-optimization/RCO-5-007-P3_COMPONENT_FREEZE.json',
  'src/recognition/revisionRelationResolver.ts',
  'src/recognition/taskFormationPolicyP3.ts',
  'src/recognition/taskFormationEvaluation.ts',
  'src/recognition/scopeReferenceContract.ts',
  'src/recognition/scopeIndexV11.ts',
]
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
const componentSha256 = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await sha(path)])))
const dataset = JSON.parse(await readFile(resolve(root, paths[0]), 'utf8'))
const directives = dataset.cases.flatMap((item) => item.expected.directives)
const relations = dataset.cases.flatMap((item) => item.expected.revisionRelations)
const relationCountByKind = Object.fromEntries(['cancels', 'supersedes', 'amends'].map((kind) => [kind, relations.filter((item) => item.kind === kind).length]))

const output = {
  schemaVersion: 'rco-5-007-b6-data-freeze-1.0.0',
  stage: 'RCO-5-007-B6-PRE-FIRST-P3-RUN',
  status: 'DATA_EXPECTED_AND_P3_FROZEN_BEFORE_FIRST_RUN',
  frozenAt: '2026-09-04T20:00:00+08:00',
  p3Commit: '07a056e769a09b4a5c608b041eb9ee23820b85fc',
  datasetId: dataset.datasetId,
  datasetPath: paths[0],
  datasetClassification: dataset.classification,
  seenStatusAtFreeze: dataset.seenStatus,
  labelProvenance: dataset.labelProvenance,
  sampleCount: dataset.cases.length,
  expectedDirectiveCount: directives.length,
  expectedObservationCount: dataset.cases.flatMap((item) => item.expected.observations).length,
  requiresActionFalseCount: dataset.cases.filter((item) => !item.expected.requiresAction).length,
  safeDefaultExpectedCount: directives.filter((item) => item.expectedDefaultSelected).length,
  nonDefaultDirectiveCount: directives.filter((item) => !item.expectedDefaultSelected).length,
  revisionCaseCount: dataset.cases.filter((item) => item.coverageTags.includes('revision')).length,
  relationCount: relations.length,
  relationCountByKind,
  unresolvedRevisionScopeCount: dataset.cases.flatMap((item) => item.expected.unresolvedRevisionScopeTexts).length,
  taskFormationPolicyVersion: dataset.taskFormationPolicyVersion,
  revisionResolverVersion: dataset.revisionResolverVersion,
  taskFormationEvaluatorVersion: 'task-formation-evaluator-1.0.0',
  componentPaths: paths,
  componentSha256,
  oracleGate: {
    scoreableCases: 16,
    taskF1Minimum: 0.9,
    requiresActionAccuracyMinimum: 0.95,
    completeTaskCaseAccuracyMinimum: 0.8,
    forbiddenDefaultSelectionsMaximum: 0,
    relationExactAccuracyByKindMinimum: { cancels: 1, supersedes: 1, amends: 1 },
    supersededTaskExactAccuracyMinimum: 1,
    activeReplacementRecallMinimum: 1,
    staleTasksMaximum: 0,
    selectedStaleTasksMaximum: 0,
    unresolvedRevisionExactAccuracyMinimum: 1,
  },
  firstRunPolicy: 'Exactly one first P3 oracle run after this freeze is committed and pushed. B6 becomes seen immediately; failure may only be audited.',
  expectedDataPolicy: 'Expected and labels remain local and are forbidden from any model request projection.',
  mutationPolicy: 'Dataset, Expected, P3 and bound dependencies are immutable for this gate after the freeze commit.',
  paidRunAuthorized: false,
  modelCalls: 0,
  networkDispatches: 0,
  secretAccess: 'NONE',
  stablePath: 'UNCHANGED',
  rco6: 'BLOCKED',
  deployment: 'NOT_RUN',
}

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, components: paths.length, sampleCount: output.sampleCount, relations: output.relationCount, relationCountByKind }))
