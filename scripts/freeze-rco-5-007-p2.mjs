import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-P2_COMPONENT_FREEZE.json')
const resultPath = 'docs/recognition-optimization/rco-5-007-p2-b3-replay/result.json'
const paths = [
  'docs/recognition-optimization/RCO-5-007-P2_PLAN.md',
  'src/recognition/taskFormationPolicyP2.ts',
  'src/recognition/taskFormationPolicyP2.test.ts',
  'scripts/run-rco-5-007-p2-b3-replay.ts',
  resultPath,
  'docs/recognition-optimization/rco-5-007-p2-b3-replay/REPORT.md',
  'docs/recognition-optimization/rco-5-007-p2-b3-replay/ADVERSARIAL_AUDIT.md',
  'docs/recognition-optimization/RCO-5-007-B3_DATA_FREEZE.json',
  'docs/recognition-optimization/RCO-5-007-B3_RESULT_FREEZE.json',
  'src/recognition/taskFormationEvaluation.ts',
  'src/recognition/scopeReferenceContract.ts',
  'src/recognition/scopeIndexV11.ts',
  'src/recognition/taskFormationPolicyP1.ts',
  'docs/recognition-optimization/RCO-5-007-P1_COMPONENT_FREEZE.json',
]
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
const result = JSON.parse(await readFile(resolve(root, resultPath), 'utf8'))
const componentSha256 = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await sha(path)])))
const output = { schemaVersion: 'rco-5-007-p2-component-freeze-1.0.0', stage: 'RCO-5-007-P2-SEEN-B3', status: 'TECHNICAL_PASS_SEEN_B3_ELIGIBLE_FOR_NEW_B4_ZERO_CALL_GATE_ONLY', frozenAt: '2026-09-04T19:15:00+08:00', authorizationId: 'RCO-5-007-P2', policyVersion: 'task-formation-policy-2.2.0-p2', datasetId: result.datasetId, datasetClassification: result.classification, componentPaths: paths, componentSha256, accounting: result.accounting, p2Metrics: result.p2Metrics, gate: result.gate, decision: result.decision, interpretation: 'Seen B3 failure regression only; not model accuracy, unseen generalization, real-data evidence, or release evidence.', protectedMutation: 'NONE', stablePath: 'UNCHANGED', rco6: 'NOT_STARTED', deployment: 'NOT_RUN', nextAuthorization: 'ALREADY_AUTHORIZED_NEW_B4_DATA_FREEZE_AND_SINGLE_ZERO_CALL_FIRST_RUN' }
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, components: paths.length, gate: output.gate, decision: output.decision }))
