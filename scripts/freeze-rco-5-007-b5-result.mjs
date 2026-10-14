import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B5_RESULT_FREEZE.json')
const resultPath = 'docs/recognition-optimization/rco-5-007-b5-oracle/result.json'
const paths = [
  'docs/recognition-optimization/RCO-5-007-B5_DATA_FREEZE.json',
  'scripts/run-rco-5-007-b5-oracle.ts',
  resultPath,
  'docs/recognition-optimization/rco-5-007-b5-oracle/REPORT.md',
  'docs/recognition-optimization/rco-5-007-b5-oracle/ADVERSARIAL_AUDIT.md',
  'docs/recognition-optimization/rco-5-007-b5-oracle/EXECUTION_STATUS.md',
  'scripts/rco-5-007-b5-oracle.node-test.mjs',
]
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
const result = JSON.parse(await readFile(resolve(root, resultPath), 'utf8'))
const componentSha256 = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await sha(path)])))
if (result.gate !== 'FAIL') throw new Error('B5 result freeze expects the observed first-run failure')
const output = {
  schemaVersion: 'rco-5-007-b5-result-freeze-1.0.0',
  stage: 'RCO-5-007-B5-FIRST-ORACLE',
  status: 'FIRST_RUN_FAIL_NOW_SEEN_DEVELOPMENT',
  frozenAt: '2026-09-04T21:03:00+08:00',
  authorizationId: 'RCO-5-007-P2-E1/B5',
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
    test: 'PASS_580_PLUS_1_LIVE_OCR_SKIPPED',
    build: 'PASS_WITH_EXISTING_CHUNK_WARNING',
    securityScan: 'PASS_504_FILES',
  },
  overallGate: 'FAIL',
  decision: result.decision,
  rootCause: 'P2 uses lexical co-occurrence for revision instead of a locally constructed referential relation from the revocation proposition to the superseded directive.',
  protectedMutation: 'NONE_AFTER_B5_FREEZE',
  rerunAuthorized: false,
  paidRunAuthorized: false,
  stablePath: 'UNCHANGED',
  rco6: 'BLOCKED',
  deployment: 'NOT_RUN',
  nextAuthorization: 'LOCAL_REVISION_RELATION_RESOLVER_SEEN_B5_REGRESSION_THEN_NEW_B6_ZERO_CALL_GATE',
}
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, components: paths.length, overallGate: output.overallGate, decision: output.decision }))
