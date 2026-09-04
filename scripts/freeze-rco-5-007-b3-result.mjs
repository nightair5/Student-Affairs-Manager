import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B3_RESULT_FREEZE.json')
const resultPath = 'docs/recognition-optimization/rco-5-007-b3-oracle/result.json'
const paths = [
  'docs/recognition-optimization/RCO-5-007-B3_DATA_FREEZE.json',
  'scripts/run-rco-5-007-b3-oracle.ts',
  resultPath,
  'docs/recognition-optimization/rco-5-007-b3-oracle/REPORT.md',
  'docs/recognition-optimization/rco-5-007-b3-oracle/ADVERSARIAL_AUDIT.md',
  'scripts/rco-5-007-b3-oracle.node-test.mjs',
]
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
const result = JSON.parse(await readFile(resolve(root, resultPath), 'utf8'))
const componentSha256 = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await sha(path)])))
const output = { schemaVersion: 'rco-5-007-b3-result-freeze-1.0.0', stage: 'RCO-5-007-B3-FIRST-ORACLE', status: 'FIRST_RUN_FAILED_SEEN_DEVELOPMENT_NO_TUNING', frozenAt: '2026-09-04T18:30:00+08:00', authorizationId: 'RCO-5-007-B3', datasetId: result.datasetId, firstRunAgainstFrozenCommit: result.firstRunAgainstFrozenCommit, componentPaths: paths, componentSha256, accounting: result.accounting, metrics: result.metrics, gate: result.gate, decision: result.decision, protectedMutation: 'NONE', rerunAuthorized: false, paidRunAuthorized: false, stablePath: 'UNCHANGED', rco6: 'BLOCKED', deployment: 'NOT_RUN', nextAuthorization: 'NEW_LOCAL_POLICY_VERSION_USING_B3_REGRESSION_THEN_NEW_B4_ZERO_CALL_GATE' }
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, components: paths.length, gate: output.gate, decision: output.decision }))
