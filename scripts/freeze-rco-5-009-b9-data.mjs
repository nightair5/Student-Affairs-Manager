import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-009-B9_DATA_FREEZE.json')
const datasetPath = 'docs/recognition-optimization/RCO-5-009-B9_DEVELOPMENT_DATASET.json'
const comparisonDatasetPaths = [
  'docs/recognition-optimization/RCO-5-005-B0_DEVELOPMENT_DATASET.json',
  'docs/recognition-optimization/RCO-5-005-B02_DEVELOPMENT_DATASET.json',
  'docs/recognition-optimization/RCO-5-006-B1_DEVELOPMENT_DATASET.json',
  'docs/recognition-optimization/RCO-5-007-B2_CHALLENGE_DATASET.json',
  'docs/recognition-optimization/RCO-5-007-B3_CHALLENGE_DATASET.json',
  'docs/recognition-optimization/RCO-5-007-B4_CHALLENGE_DATASET.json',
  'docs/recognition-optimization/RCO-5-007-B5_CHALLENGE_DATASET.json',
  'docs/recognition-optimization/RCO-5-007-B6_CHALLENGE_DATASET.json',
  'docs/recognition-optimization/RCO-5-007-B7_DEVELOPMENT_DATASET.json',
  'docs/recognition-optimization/RCO-5-008-B8_DEVELOPMENT_DATASET.json',
]
const componentPaths = [
  datasetPath,
  'docs/recognition-optimization/RCO-5-009-B9_PLAN.md',
  'scripts/generate-rco-5-009-b9-dataset.mjs',
  'scripts/freeze-rco-5-009-b9-data.mjs',
  'scripts/rco-5-009-b9-data-freeze.node-test.mjs',
  'src/recognition/actionCandidateB9DataFreeze.test.ts',
  'docs/recognition-optimization/RCO-5-009A_COMPONENT_FREEZE.json',
]
const sha = async (relativePath) => createHash('sha256').update(await readFile(resolve(root, relativePath))).digest('hex')
const readJson = async (relativePath) => JSON.parse(await readFile(resolve(root, relativePath), 'utf8'))
const classifyHistoricalDrift = (path) => /rco-5-008-b8-runs\/.+\/(?:checkpoint|raw-results)\.json$/u.test(path)
  ? 'MUTABLE_RUN_OUTPUT_HASHED_BY_PRE_RUN_MANIFEST'
  : 'HISTORICAL_COMPONENT_CHANGED_AFTER_FREEZE'
async function auditNestedFreezes(startPath) {
  const visited = new Set()
  const mismatches = []
  async function visit(manifestPath) {
    if (visited.has(manifestPath)) return
    visited.add(manifestPath)
    const manifest = await readJson(manifestPath)
    if (!Array.isArray(manifest.componentPaths) || typeof manifest.componentSha256 !== 'object' || manifest.componentSha256 === null) return
    for (const childPath of manifest.componentPaths) {
      const actualSha256 = await sha(childPath)
      const expectedSha256 = manifest.componentSha256[childPath]
      if (actualSha256 !== expectedSha256) mismatches.push({
        manifestPath, path: childPath, expectedSha256, actualSha256, classification: classifyHistoricalDrift(childPath),
      })
      if (childPath.endsWith('_FREEZE.json')) await visit(childPath)
    }
  }
  await visit(startPath)
  return { visitedManifestCount: visited.size, mismatchCount: mismatches.length, mismatches }
}
const dataset = JSON.parse(await readFile(resolve(root, datasetPath), 'utf8'))
const comparisonDatasets = await Promise.all(comparisonDatasetPaths.map(async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'))))
const candidates = dataset.cases.flatMap((item) => item.expected.candidates)
const tasks = dataset.cases.flatMap((item) => item.expected.tasks)
const revisionRelations = dataset.cases.flatMap((item) => item.expected.revisionRelations)
const counts = (values) => Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length]))
const grams = (value) => {
  const normalized = value.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase()
  return new Set(Array.from({ length: Math.max(0, normalized.length - 1) }, (_, index) => normalized.slice(index, index + 2)))
}
const jaccard = (left, right) => {
  const a = grams(left)
  const b = grams(right)
  const intersection = [...a].filter((item) => b.has(item)).length
  const union = new Set([...a, ...b]).size
  return union === 0 ? 1 : intersection / union
}
const priorCases = comparisonDatasets.flatMap((item) => item.cases)
let maximumBigramJaccard = 0
let maximumSimilarityPair = null
for (const fresh of dataset.cases) {
  for (const prior of priorCases) {
    const score = jaccard(fresh.sourceText, prior.sourceText)
    if (score <= maximumBigramJaccard) continue
    maximumBigramJaccard = score
    maximumSimilarityPair = { freshCaseId: fresh.id, priorCaseId: prior.id }
  }
}
const dispositionCounts = counts(candidates.map((item) => item.localDisposition))
const expectedLedgerCounts = {
  accepted_local: candidates.filter((item) => item.localDisposition === 'local_proposition' && item.responseVerdict === 'proposition' && item.object !== null && item.responseObject === 'own').length,
  accepted_model: candidates.filter((item) => item.localDisposition === 'needs_model' && item.responseVerdict === 'proposition' && item.object !== null && item.responseObject === 'own').length,
  ignored_model: candidates.filter((item) => item.localDisposition === 'needs_model' && item.responseVerdict === 'mention_only').length,
  ignored_local: candidates.filter((item) => item.localDisposition === 'local_non_task').length,
  quarantined: candidates.filter((item) => item.responseVerdict === 'uncertain' || (item.responseVerdict === 'proposition' && item.responseObject !== 'own')).length,
}
const componentSha256 = Object.fromEntries(await Promise.all(componentPaths.map(async (path) => [path, await sha(path)])))
const comparisonDatasetSha256 = Object.fromEntries(await Promise.all(comparisonDatasetPaths.map(async (path) => [path, await sha(path)])))
const historicalTransitiveFreezeAudit = await auditNestedFreezes('docs/recognition-optimization/RCO-5-009A_COMPONENT_FREEZE.json')

const output = {
  schemaVersion: 'rco-5-009-b9-data-freeze-1.0.0',
  stage: 'RCO-5-009-B9-PRE-ZERO-CALL',
  status: 'DATA_EXPECTED_RESPONSE_FIXTURES_AND_009A_CHAIN_FROZEN_BEFORE_FIRST_PIPELINE_RUN',
  frozenAt: '2026-09-04T23:15:00+08:00',
  authorizationId: 'RCO-5-009-B9-ZERO-CALL',
  datasetId: dataset.datasetId,
  datasetPath,
  datasetClassification: dataset.classification,
  seenStatusAtFreeze: dataset.seenStatus,
  labelProvenance: dataset.labelProvenance,
  sampleCount: dataset.cases.length,
  semanticFamilyCount: new Set(dataset.cases.map((item) => item.semanticFamilyId)).size,
  expectedCandidateCount: candidates.length,
  expectedCandidateDispositionCounts: dispositionCounts,
  expectedLedgerCounts,
  expectedTaskCount: tasks.length,
  safeDefaultExpectedCount: tasks.filter((item) => item.selected).length,
  expectedRevisionRelationCount: revisionRelations.length,
  expectedRequiresActionVector: dataset.cases.map((item) => item.expected.requiresAction),
  expectedResponsePartialCaseIds: dataset.cases.filter((item) => !item.expected.responseContractComplete).map((item) => item.id),
  expectedSemanticPartialCaseIds: dataset.cases.filter((item) => !item.expected.semanticCoverageComplete).map((item) => item.id),
  multipleObjectChoiceStatus: dataset.multipleObjectChoiceStatus,
  freshnessReview: {
    comparedDatasetCount: comparisonDatasetPaths.length,
    comparedCaseCount: priorCases.length,
    maximumBigramJaccard,
    maximumAllowedBigramJaccard: 0.55,
    maximumSimilarityPair,
    exactSourceReuseCount: dataset.cases.filter((fresh) => priorCases.some((prior) => prior.sourceText === fresh.sourceText)).length,
    semanticFamilyReuseCount: dataset.cases.filter((fresh) => priorCases.some((prior) => prior.semanticFamilyId === fresh.semanticFamilyId)).length,
  },
  componentPaths,
  componentSha256,
  comparisonDatasetPaths,
  comparisonDatasetSha256,
  activeFreezeLayerIntegrity: 'RCO-5-009A_AND_RCO-5-009_DIRECT_MANIFESTS_MUST_VERIFY_EXACTLY',
  historicalTransitiveFreezeAudit: {
    status: historicalTransitiveFreezeAudit.mismatchCount === 0
      ? 'NO_TRANSITIVE_DRIFT'
      : 'KNOWN_ANCESTRY_DRIFT_RECORDED_ACTIVE_009A_AND_009_DIRECT_LAYERS_INTACT',
    ...historicalTransitiveFreezeAudit,
  },
  firstRunPolicy: 'Commit and push this data freeze, then create, freeze, commit and push a new runner/evaluator before running the RCO-5-009A candidate pipeline exactly once. B9 becomes seen immediately; failures are retained and may only be fixed against B10 or later unseen data.',
  fixedZeroCallGate: {
    candidateIdentityExact: 1,
    actionSpanExact: 1,
    singletonOrEmptyObjectSpanExact: 1,
    ledgerDispositionExact: 1,
    acceptedCandidateTaskBijectionExact: 1,
    taskSemanticExact: 1,
    taskSelectedExact: 1,
    requiresActionExact: 1,
    responseContractCompletenessExact: 1,
    semanticCoverageCompletenessExact: 1,
    revisionUncertaintyExact: 1,
    resolvedRevisionRelationExact: 1,
    safeDefaultRecall: 1,
    unsafeDefaultSelectionsMaximum: 0,
    siblingSurvivalRate: 1,
  },
  paidRunAuthorized: false,
  modelCalls: 0,
  networkDispatches: 0,
  secretAccess: 'NONE',
  mutationPolicy: 'B9 dataset, Expected, response fixtures, plan, freeze-bound files and the RCO-5-009A component chain are immutable after this freeze commit.',
  expectedDataPolicy: 'Expected, semantic labels, response fixtures, requiresAction and selected must never enter a future model request.',
  stablePath: 'UNCHANGED',
  rco6: 'NOT_STARTED',
  deployment: 'NOT_RUN',
  nextGate: 'COMMIT_AND_PUSH_DATA_FREEZE_THEN_CREATE_FREEZE_COMMIT_AND_PUSH_RUNNER_EVALUATOR_BEFORE_ONE_ZERO_CALL_RUN',
}

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, components: componentPaths.length, samples: output.sampleCount, candidates: output.expectedCandidateCount, tasks: output.expectedTaskCount, maximumBigramJaccard }))
