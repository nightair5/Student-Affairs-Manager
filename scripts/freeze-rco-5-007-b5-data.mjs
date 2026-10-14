import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B5_DATA_FREEZE.json')
const paths = [
  'docs/recognition-optimization/RCO-5-007-B5_CHALLENGE_DATASET.json',
  'docs/recognition-optimization/RCO-5-007-P2-E1-B5_PLAN.md',
  'scripts/generate-rco-5-007-b5-dataset.mjs',
  'src/recognition/taskFormationB5Dataset.test.ts',
  'docs/recognition-optimization/RCO-5-007-P2-E1_COMPONENT_FREEZE.json',
  'docs/recognition-optimization/RCO-5-007-P2_COMPONENT_FREEZE.json',
  'src/recognition/taskFormationEvaluation.ts',
  'src/recognition/scopeReferenceContract.ts',
  'src/recognition/scopeIndexV11.ts',
]
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
const componentSha256 = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await sha(path)])))
const dataset = JSON.parse(await readFile(resolve(root, paths[0]), 'utf8'))
const directives = dataset.cases.flatMap((item) => item.expected.directives)
const observations = dataset.cases.flatMap((item) => item.expected.observations)
const revisionCases = dataset.cases.filter((item) => item.coverageTags.includes('revision'))
const supersededDirectives = directives.filter((item) => item.semantics.validity === 'superseded')
const output = {
  schemaVersion: 'rco-5-007-b5-data-freeze-1.0.0',
  stage: 'RCO-5-007-B5-PRE-ORACLE',
  status: 'DATA_EXPECTED_E1_AND_P2_FROZEN_BEFORE_FIRST_RUN',
  frozenAt: '2026-09-04T20:52:00+08:00',
  datasetId: dataset.datasetId,
  datasetPath: paths[0],
  datasetClassification: dataset.classification,
  seenStatusAtFreeze: dataset.seenStatus,
  labelProvenance: dataset.labelProvenance,
  sampleCount: dataset.cases.length,
  expectedDirectiveCount: directives.length,
  expectedObservationCount: observations.length,
  requiresActionFalseCount: dataset.cases.filter((item) => !item.expected.requiresAction).length,
  safeDefaultExpectedCount: directives.filter((item) => item.expectedDefaultSelected).length,
  nonDefaultDirectiveCount: directives.filter((item) => !item.expectedDefaultSelected).length,
  revisionCaseCount: revisionCases.length,
  supersededDirectiveCount: supersededDirectives.length,
  taskFormationPolicyVersion: dataset.taskFormationPolicyVersion,
  taskFormationEvaluatorVersion: 'task-formation-evaluator-1.0.0',
  componentPaths: paths,
  componentSha256,
  oracleGate: {
    scoreableCases: 16,
    taskF1Minimum: 0.9,
    requiresActionAccuracyMinimum: 0.95,
    completeTaskCaseAccuracyMinimum: 0.8,
    forbiddenDefaultSelectionsMaximum: 0,
    supersededTaskExactAccuracyMinimum: 1,
    activeReplacementRecallMinimum: 1,
    selectedStaleTasksMaximum: 0,
  },
  firstRunPolicy: 'Exactly one first P2 oracle run after this freeze is committed and pushed. B5 becomes seen immediately; failure may only be audited.',
  expectedDataPolicy: 'Expected and labels remain local and are forbidden from model request projection.',
  mutationPolicy: 'Dataset, Expected, E1, P2 and bound dependencies are immutable for this gate.',
  paidRunAuthorized: false,
  modelCalls: 0,
  networkDispatches: 0,
  secretAccess: 'NONE',
  stablePath: 'UNCHANGED',
  rco6: 'BLOCKED',
  deployment: 'NOT_RUN',
}
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, components: paths.length, sampleCount: output.sampleCount, directives: output.expectedDirectiveCount, observations: output.expectedObservationCount, revisionCases: output.revisionCaseCount }))
