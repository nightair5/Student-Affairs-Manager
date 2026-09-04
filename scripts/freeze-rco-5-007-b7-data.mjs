import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B7_DATA_FREEZE.json')
const datasetPath = 'docs/recognition-optimization/RCO-5-007-B7_DEVELOPMENT_DATASET.json'
const paths = [
  datasetPath,
  'docs/recognition-optimization/RCO-5-007-B7-M1_PLAN.md',
  'docs/recognition-optimization/RCO-5-007-B7-M1_TRACKER.md',
  'scripts/generate-rco-5-007-b7-dataset.mjs',
  'src/recognition/modelAnchorSelectionContract.ts',
  'src/recognition/modelAnchorSelectionContract.test.ts',
  'src/recognition/modelAnchorB7Dataset.test.ts',
  'docs/recognition-optimization/RCO-5-007-P3_COMPONENT_FREEZE.json',
  'src/recognition/taskFormationPolicyP3.ts',
  'src/recognition/revisionRelationResolver.ts',
  'src/recognition/taskFormationEvaluation.ts',
  'src/recognition/scopeIndexV11.ts',
]
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
const componentSha256 = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await sha(path)])))
const dataset = JSON.parse(await readFile(resolve(root, datasetPath), 'utf8'))
const directives = dataset.cases.flatMap((item) => item.expected.directives)
const relations = dataset.cases.flatMap((item) => item.expected.revisionRelations)
const output = {
  schemaVersion: 'rco-5-007-b7-data-freeze-1.0.0',
  stage: 'RCO-5-007-B7-PRE-MODEL',
  status: 'DATA_CONTRACT_AND_P3_CEILING_FROZEN_AWAITING_EXPLICIT_PAID_AUTHORIZATION',
  frozenAt: '2026-09-04T20:22:00+08:00',
  authorizationId: 'RCO-5-007-B7-DATA',
  datasetId: dataset.datasetId,
  datasetPath,
  datasetClassification: dataset.classification,
  seenStatusAtFreeze: dataset.seenStatus,
  labelProvenance: dataset.labelProvenance,
  sampleCount: dataset.cases.length,
  semanticFamilyCount: new Set(dataset.cases.map((item) => item.semanticFamilyId)).size,
  expectedDirectiveCount: directives.length,
  expectedSelectionCount: dataset.cases.flatMap((item) => item.expected.selections).length,
  requiresActionFalseCount: dataset.cases.filter((item) => !item.expected.requiresAction).length,
  safeDefaultExpectedCount: directives.filter((item) => item.expectedDefaultSelected).length,
  nonDefaultDirectiveCount: directives.filter((item) => !item.expectedDefaultSelected).length,
  revisionRelationCount: relations.length,
  unresolvedRevisionScopeCount: dataset.cases.flatMap((item) => item.expected.unresolvedRevisionScopeTexts).length,
  componentPaths: paths,
  componentSha256,
  p3OraclePreflight: { cases: 12, validSelections: 12, contractValid: 12, completeTaskCases: 12, exactRevisionCases: 4, gate: 'PASS' },
  proposedPaidRun: {
    model: 'deepseek-v4-flash-vision-exp',
    temperature: 0,
    thinking: 'none',
    candidateCalls: 12,
    maximumDispatches: 12,
    verifierCalls: 0,
    repairCalls: 0,
    retryCalls: 0,
    maximumRequestBytesPerCall: 32768,
    maximumOutputTokensPerCall: 3000,
    cnyHardCap: 10,
  },
  fixedQualityGate: {
    terminalDispatches: 12,
    strictSchemaValid: 12,
    scopeMicroF1Minimum: 0.9,
    actionSurfaceExactMinimum: 0.9,
    objectSurfaceExactMinimum: 0.9,
    completeAnchorCaseMinimum: 0.8,
    taskF1Minimum: 0.9,
    requiresActionAccuracyMinimum: 0.95,
    completeTaskCaseMinimum: 0.8,
    forbiddenDefaultSelectionsMaximum: 0,
    revisionRelationExactByKindMinimum: 1,
    oldRequirementInvalidationMinimum: 1,
    activeReplacementRecallMinimum: 1,
    unresolvedRevisionExactMinimum: 1,
    staleTasksMaximum: 0,
    selectedStaleTasksMaximum: 0,
  },
  stopPolicy: {
    beforeDispatch: ['FROZEN_COMPONENT_DRIFT', 'SECRET_INVALID', 'REQUEST_CONTAINS_EXPECTED_OR_LOCAL_AUTHORITY', 'MODEL_IDENTITY_INVALID', 'COST_ENVELOPE_NOT_BELOW_CAP'],
    haltRemainingDispatches: ['UNKNOWN_RECEIPT', 'NON_2XX', 'AUTH_OR_BALANCE_OR_RATE_LIMIT_OR_MODEL_ERROR'],
    continueButFailRun: ['HTTP_SUCCESS_SCHEMA_INVALID', 'SOURCE_OR_SCOPE_BINDING_INVALID'],
    retriesForbidden: true,
  },
  paidRunAuthorized: false,
  runnerCreated: false,
  checkpointCreated: false,
  modelCalls: 0,
  networkDispatches: 0,
  secretAccess: 'NONE',
  mutationPolicy: 'Dataset, Expected, contract, plan, P3 and bound dependencies are immutable after this freeze commit.',
  expectedDataPolicy: 'Expected, semantic labels, risk fields, requiresAction, revision labels and selected must never enter a model request.',
  stablePath: 'UNCHANGED',
  rco6: 'BLOCKED',
  deployment: 'NOT_RUN',
  nextGate: 'EXPLICIT_USER_APPROVAL_OF_MAXIMUM_12_CALLS_AND_10_CNY_HARD_CAP',
}
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, components: paths.length, sampleCount: output.sampleCount, directives: output.expectedDirectiveCount }))
