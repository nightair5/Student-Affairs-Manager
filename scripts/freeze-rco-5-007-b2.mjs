import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B2_FREEZE.json')
const paths = [
  'docs/recognition-optimization/RCO-5-007-B2_CHALLENGE_DATASET.json',
  'docs/recognition-optimization/RCO-5-007-B2_PLAN.md',
  'scripts/generate-rco-5-007-b2-dataset.mjs',
  'scripts/run-rco-5-007-b2-oracle-replay.ts',
  'src/recognition/taskFormationB2Dataset.test.ts',
  'src/recognition/taskFormationEvaluation.ts',
  'src/recognition/taskFormationEvaluation.test.ts',
  'src/recognition/taskFormationPolicyV2.ts',
  'src/recognition/taskFormationPolicyV2.test.ts',
  'src/recognition/scopeReferenceContract.ts',
  'src/recognition/scopeIndexV11.ts',
  'docs/recognition-optimization/RCO-5-007_COMPONENT_FREEZE.json',
]
const sha256 = {}
for (const path of paths) sha256[path] = createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
const dataset = JSON.parse(await readFile(resolve(root, paths[0]), 'utf8'))
const directives = dataset.cases.flatMap((item) => item.expected.directives)
const observations = dataset.cases.flatMap((item) => item.expected.observations)
const output = {
  schemaVersion: 'rco-5-007-b2-freeze-1.0.0', stage: 'RCO-5-007-B2-DATA-SCORER-FREEZE',
  status: 'DATA_POLICY_SCORER_FROZEN_ZERO_CALL_AWAITING_ORACLE_GATE', frozenAt: '2026-09-04T16:20:00+08:00',
  prefreezeCorrection: 'The first uncommitted freeze candidate was rejected because forbidden scoring treated any word in a shared evidence scope as a selected action. Dataset and Expected bytes were unchanged; evaluator 1.0.0 was corrected before this final freeze candidate.',
  datasetId: dataset.datasetId, datasetPath: paths[0], datasetClassification: dataset.classification,
  labelProvenance: dataset.labelProvenance, sampleCount: dataset.cases.length,
  expectedDirectiveCount: directives.length, expectedObservationCount: observations.length,
  requiresActionFalseCount: dataset.cases.filter((item) => !item.expected.requiresAction).length,
  safeDefaultExpectedCount: directives.filter((item) => item.expectedDefaultSelected).length,
  nonDefaultDirectiveCount: directives.filter((item) => !item.expectedDefaultSelected).length,
  taskFormationPolicyVersion: dataset.taskFormationPolicyVersion, taskFormationEvaluatorVersion: 'task-formation-evaluator-1.0.0',
  componentPaths: paths, componentSha256: sha256,
  modelCandidateProposed: 'deepseek-v4-flash-vision-exp', temperatureProposed: 0,
  candidateCallsProposed: 16, oldVerifierCallsMaximumProposed: 16, maximumModelCallsProposed: 32,
  repairCallsProposed: 0, retryCallsProposed: 0, cnyCapProposed: 'REQUIRES_USER_VALUE',
  paidRunAuthorized: false, networkRunnerCreated: false, modelCalls: 0, networkDispatches: 0, secretAccess: 'NONE',
  expectedDataPolicy: 'Expected and labels remain local and are forbidden from future model request projection.',
  mutationPolicy: 'Dataset, Expected, policy candidate, evaluator and component hashes are immutable. A correction requires an append-only record and new dataset version.',
  stablePath: 'UNCHANGED', rco6: 'BLOCKED', deployment: 'NOT_RUN',
  nextGate: 'ZERO_CALL_ORACLE_ANCHOR_UPPER_BOUND_THEN_EXPLICIT_PAID_AUTHORIZATION_IF_PASS',
}
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, components: paths.length, sampleCount: output.sampleCount }))
