import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-B4_RESULT_FREEZE.json')
const resultPath = 'docs/recognition-optimization/rco-5-007-b4-oracle/result.json'
const paths = ['docs/recognition-optimization/RCO-5-007-B4_DATA_FREEZE.json', 'scripts/run-rco-5-007-b4-oracle.ts', resultPath, 'docs/recognition-optimization/rco-5-007-b4-oracle/REPORT.md', 'docs/recognition-optimization/rco-5-007-b4-oracle/ADVERSARIAL_AUDIT.md', 'docs/recognition-optimization/rco-5-007-b4-oracle/EXECUTION_STATUS.md', 'scripts/rco-5-007-b4-oracle.node-test.mjs']
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
const result = JSON.parse(await readFile(resolve(root, resultPath), 'utf8'))
const componentSha256 = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await sha(path)])))
const output = { schemaVersion: 'rco-5-007-b4-result-freeze-1.0.0', stage: 'RCO-5-007-B4-FIRST-ORACLE', status: 'ORACLE_QUALITY_PASS_ENGINEERING_GATE_FAIL_NOW_SEEN_DEVELOPMENT', frozenAt: '2026-09-04T19:55:00+08:00', authorizationId: 'RCO-5-007-P2-B4', datasetId: result.datasetId, firstRunAgainstFrozenCommit: result.firstRunAgainstFrozenCommit, componentPaths: paths, componentSha256, accounting: result.accounting, metrics: result.metrics, oracleQualityGate: result.gate, engineeringGate: 'FAIL_TS2352_FROZEN_B4_DATASET_TEST', overallGate: 'FAIL', decision: 'INVALID_FOR_PAID_PROMOTION_ENGINEERING_GATE_FAIL', knownLimitation: 'B4-07 leaves an unselected stale external task for an unrecognized revision surface; revision-specific quality must remain explicit in later evaluation.', protectedMutation: 'NONE', rerunAuthorized: false, paidRunAuthorized: false, stablePath: 'UNCHANGED', rco6: 'BLOCKED', deployment: 'NOT_RUN', nextAuthorization: 'TYPE_FIX_SEEN_B4_REGRESSION_THEN_NEW_B5_ZERO_CALL_GATE' }
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, components: paths.length, oracleQualityGate: output.oracleQualityGate, overallGate: output.overallGate, decision: output.decision }))
