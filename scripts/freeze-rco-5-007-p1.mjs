import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-P1_COMPONENT_FREEZE.json')
const resultPath = 'docs/recognition-optimization/rco-5-007-p1-b2-replay/result.json'
const componentPaths = [
  'docs/recognition-optimization/RCO-5-007-P1_PLAN.md',
  'docs/recognition-optimization/RCO-5-007-B2_CHALLENGE_DATASET.json',
  'docs/recognition-optimization/RCO-5-007-B2_FREEZE.json',
  'docs/recognition-optimization/rco-5-007-b2-oracle/result.json',
  'src/recognition/taskFormationPolicyV2.ts',
  'src/recognition/taskFormationPolicyP1.ts',
  'src/recognition/taskFormationPolicyP1.test.ts',
  'src/recognition/taskFormationEvaluation.ts',
  'src/recognition/scopeReferenceContract.ts',
  'src/recognition/scopeIndexV11.ts',
  'scripts/run-rco-5-007-p1-b2-replay.ts',
  'scripts/rco-5-007-p1-integrity.node-test.mjs',
  resultPath,
  'docs/recognition-optimization/rco-5-007-p1-b2-replay/REPORT.md',
  'docs/recognition-optimization/rco-5-007-p1-b2-replay/ADVERSARIAL_AUDIT.md',
  'scripts/freeze-rco-5-007-p1.mjs',
]
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
const result = JSON.parse(await readFile(resolve(root, resultPath), 'utf8'))
const componentSha256 = Object.fromEntries(await Promise.all(componentPaths.map(async (path) => [path, await sha(path)])))
const freeze = {
  schemaVersion: 'rco-5-007-p1-component-freeze-1.0.0',
  stage: 'RCO-5-007-P1',
  status: 'TECHNICAL_PASS_SEEN_B2_ELIGIBLE_FOR_NEW_B3_ZERO_CALL_GATE_ONLY',
  frozenAt: '2026-09-04T17:05:00+08:00',
  authorizationId: 'RCO-5-007-P1',
  policyVersion: 'task-formation-policy-2.1.0-p1',
  datasetId: result.datasetId,
  datasetClassification: result.classification,
  componentPaths,
  componentSha256,
  accounting: result.accounting,
  p1Metrics: result.p1Metrics,
  gate: result.gate,
  decision: result.decision,
  interpretation: 'Seen B2 diagnostic repair only; not model accuracy, unseen generalization, real-data evidence, or release evidence.',
  protectedMutation: 'NONE',
  stablePath: 'UNCHANGED',
  rco6: 'NOT_STARTED',
  deployment: 'NOT_RUN',
  nextAuthorization: 'NEW_B3_DATA_AND_ZERO_CALL_ORACLE_GATE_ONLY',
}
await writeFile(outputPath, `${JSON.stringify(freeze, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, components: componentPaths.length, gate: freeze.gate, decision: freeze.decision }))
