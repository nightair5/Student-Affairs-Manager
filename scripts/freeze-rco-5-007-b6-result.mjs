import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B6_RESULT_FREEZE.json')
const resultPath = 'docs/recognition-optimization/rco-5-007-b6-oracle/result.json'
const paths = [
  'docs/recognition-optimization/RCO-5-007-B6_DATA_FREEZE.json',
  'scripts/run-rco-5-007-b6-oracle.ts',
  resultPath,
  'docs/recognition-optimization/rco-5-007-b6-oracle/REPORT.md',
  'docs/recognition-optimization/rco-5-007-b6-oracle/ADVERSARIAL_AUDIT.md',
  'docs/recognition-optimization/rco-5-007-b6-oracle/EXECUTION_STATUS.md',
  'scripts/rco-5-007-b6-oracle.node-test.mjs',
]
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
const result = JSON.parse(await readFile(resolve(root, resultPath), 'utf8'))
const componentSha256 = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await sha(path)])))
if (result.gate !== 'PASS') throw new Error('B6 result freeze expects the observed first-run pass')

const output = {
  schemaVersion: 'rco-5-007-b6-result-freeze-1.0.0',
  stage: 'RCO-5-007-B6-FIRST-P3-ORACLE',
  status: 'FIRST_RUN_PASS_NOW_SEEN_DEVELOPMENT',
  frozenAt: '2026-09-04T20:07:00+08:00',
  authorizationId: 'RCO-5-007-P3/B6',
  datasetId: result.datasetId,
  firstRunAgainstFrozenCommit: result.firstRunAgainstFrozenCommit,
  componentPaths: paths,
  componentSha256,
  accounting: result.accounting,
  metrics: result.metrics,
  revisionMetrics: result.revisionMetrics,
  qualityGate: result.gate,
  engineeringGate: {
    lint: 'PASS',
    test: 'PASS_597_PLUS_1_LIVE_OCR_SKIPPED',
    b6AndP3Integrity: 'PASS_10_OF_10',
    build: 'PASS_WITH_EXISTING_CHUNK_WARNING',
    securityScan: 'PASS',
  },
  overallGate: 'PASS_LOCAL_P3_ONLY',
  decision: result.decision,
  rerunAuthorized: false,
  eligibleForSeparatePaidModelAuthorization: true,
  paidRunAuthorized: false,
  evidenceBoundary: 'Synthetic single-author Development with Expected-derived ideal upstream anchors; not model, OCR, real-data, human-time, browser, privacy, security acceptance or release evidence.',
  protectedMutation: 'NONE_AFTER_B6_FREEZE',
  stablePath: 'UNCHANGED',
  rco6: 'BLOCKED',
  deployment: 'NOT_RUN',
  nextAuthorization: 'NEW_FROZEN_DATA_PAID_MODEL_SCOPE_ACTION_OBJECT_SELECTION_INTO_FROZEN_P3',
}
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, components: paths.length, overallGate: output.overallGate, decision: output.decision }))
