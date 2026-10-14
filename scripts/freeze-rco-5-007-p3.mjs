import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-P3_COMPONENT_FREEZE.json')
const resultPath = 'docs/recognition-optimization/rco-5-007-p3-b5-replay/result.json'
const paths = [
  'docs/recognition-optimization/RCO-5-007-P3-B6_PLAN.md',
  'src/recognition/revisionRelationResolver.ts',
  'src/recognition/revisionRelationResolver.metamorphic.test.ts',
  'src/recognition/taskFormationPolicyP3.ts',
  'src/recognition/taskFormationPolicyP3.test.ts',
  'scripts/run-rco-5-007-p3-b5-replay.ts',
  resultPath,
  'docs/recognition-optimization/rco-5-007-p3-b5-replay/REPORT.md',
  'docs/recognition-optimization/rco-5-007-p3-b5-replay/ADVERSARIAL_AUDIT.md',
  'scripts/rco-5-007-p3-b5-replay.node-test.mjs',
  'docs/recognition-optimization/RCO-5-007-B5_DATA_FREEZE.json',
  'docs/recognition-optimization/RCO-5-007-B5_RESULT_FREEZE.json',
  'docs/recognition-optimization/RCO-5-007-P2_COMPONENT_FREEZE.json',
  'src/recognition/taskFormationEvaluation.ts',
  'src/recognition/scopeReferenceContract.ts',
  'src/recognition/scopeIndexV11.ts',
]
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
const result = JSON.parse(await readFile(resolve(root, resultPath), 'utf8'))
const componentSha256 = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await sha(path)])))
if (result.gate !== 'PASS' || result.revisionMetrics.staleTaskCount !== 0) throw new Error('P3 seen B5 regression has not passed')
const output = {
  schemaVersion: 'rco-5-007-p3-component-freeze-1.0.0',
  stage: 'RCO-5-007-P3-SEEN-B5',
  status: 'TECHNICAL_PASS_SEEN_B5_ELIGIBLE_FOR_NEW_B6_ZERO_CALL_GATE_ONLY',
  frozenAt: '2026-09-04T21:50:00+08:00',
  authorizationId: 'RCO-5-007-P3/B6',
  policyVersion: 'task-formation-policy-2.3.0-p3',
  resolverVersion: 'revision-relation-resolver-1.0.0',
  datasetId: result.datasetId,
  datasetClassification: result.classification,
  componentPaths: paths,
  componentSha256,
  accounting: result.accounting,
  p3Metrics: result.metrics,
  revisionMetrics: result.revisionMetrics,
  gate: result.gate,
  decision: result.decision,
  interpretation: 'Seen B5 failure regression only; not model accuracy, unseen generalization, real-data evidence, browser acceptance, or release evidence.',
  protectedMutation: 'NONE',
  stablePath: 'UNCHANGED',
  rco6: 'NOT_STARTED',
  deployment: 'NOT_RUN',
  nextAuthorization: 'ALREADY_AUTHORIZED_NEW_B6_DATA_FREEZE_AND_SINGLE_ZERO_CALL_FIRST_RUN',
}
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, components: paths.length, gate: output.gate, decision: output.decision }))
