import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = async (relativePath) => JSON.parse(await readFile(resolve(root, relativePath), 'utf8'))
const sha = async (relativePath) => createHash('sha256').update(await readFile(resolve(root, relativePath))).digest('hex')
const freeze = await readJson('docs/recognition-optimization/RCO-5-009-B9_DATA_FREEZE.json')

async function verifyDirectComponentFreeze(relativePath) {
  const manifest = await readJson(relativePath)
  assert.ok(Array.isArray(manifest.componentPaths), relativePath)
  assert.equal(typeof manifest.componentSha256, 'object', relativePath)
  for (const childPath of manifest.componentPaths) {
    assert.equal(await sha(childPath), manifest.componentSha256[childPath], `${relativePath}:${childPath}`)
  }
}

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

test('B9 freezes a new twelve-case zero-call classification challenge before its first pipeline run', () => {
  assert.equal(freeze.schemaVersion, 'rco-5-009-b9-data-freeze-1.0.0')
  assert.equal(freeze.status, 'DATA_EXPECTED_RESPONSE_FIXTURES_AND_009A_CHAIN_FROZEN_BEFORE_FIRST_PIPELINE_RUN')
  assert.equal(freeze.seenStatusAtFreeze, 'UNSEEN_BY_DEEPSEEK_AT_FREEZE_LOCAL_DESIGN_PREFLIGHT_ONLY')
  assert.equal(freeze.sampleCount, 12)
  assert.equal(freeze.semanticFamilyCount, 12)
  assert.equal(freeze.expectedCandidateCount, 19)
  assert.deepEqual(freeze.expectedCandidateDispositionCounts, { local_non_task: 1, local_proposition: 12, needs_model: 6 })
  assert.deepEqual(freeze.expectedLedgerCounts, { accepted_local: 11, accepted_model: 2, ignored_model: 2, ignored_local: 1, quarantined: 3 })
  assert.equal(freeze.expectedTaskCount, 13)
  assert.equal(freeze.safeDefaultExpectedCount, 7)
  assert.equal(freeze.expectedRevisionRelationCount, 1)
})

test('B9 records honest freshness and expressibility boundaries', () => {
  assert.equal(freeze.freshnessReview.comparedDatasetCount, 10)
  assert.equal(freeze.freshnessReview.exactSourceReuseCount, 0)
  assert.equal(freeze.freshnessReview.semanticFamilyReuseCount, 0)
  assert.ok(freeze.freshnessReview.maximumBigramJaccard < freeze.freshnessReview.maximumAllowedBigramJaccard)
  assert.equal(freeze.multipleObjectChoiceStatus, 'NOT_EXPRESSIBLE_BY_POLICY_1.2.0')
})

test('B9 binds data, response fixtures, prefreeze checks and the 009A component chain', async () => {
  for (const relativePath of freeze.componentPaths) assert.equal(await sha(relativePath), freeze.componentSha256[relativePath], relativePath)
  for (const relativePath of freeze.comparisonDatasetPaths) assert.equal(await sha(relativePath), freeze.comparisonDatasetSha256[relativePath], relativePath)
  await verifyDirectComponentFreeze('docs/recognition-optimization/RCO-5-009A_COMPONENT_FREEZE.json')
  await verifyDirectComponentFreeze('docs/recognition-optimization/RCO-5-009_COMPONENT_FREEZE.json')
  const currentTransitiveAudit = await auditNestedFreezes('docs/recognition-optimization/RCO-5-009A_COMPONENT_FREEZE.json')
  assert.deepEqual(currentTransitiveAudit, {
    visitedManifestCount: freeze.historicalTransitiveFreezeAudit.visitedManifestCount,
    mismatchCount: freeze.historicalTransitiveFreezeAudit.mismatchCount,
    mismatches: freeze.historicalTransitiveFreezeAudit.mismatches,
  })
  assert.equal(freeze.historicalTransitiveFreezeAudit.status, 'KNOWN_ANCESTRY_DRIFT_RECORDED_ACTIVE_009A_AND_009_DIRECT_LAYERS_INTACT')
})

test('B9 pre-run state has no paid authority, network, model or secret access', () => {
  assert.equal(freeze.paidRunAuthorized, false)
  assert.equal(freeze.modelCalls, 0)
  assert.equal(freeze.networkDispatches, 0)
  assert.equal(freeze.secretAccess, 'NONE')
  assert.equal(freeze.stablePath, 'UNCHANGED')
  assert.equal(freeze.rco6, 'NOT_STARTED')
  assert.equal(freeze.deployment, 'NOT_RUN')
  assert.match(freeze.firstRunPolicy, /exactly once/i)
})
