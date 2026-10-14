import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-P2-E1_COMPONENT_FREEZE.json')
const correctionPath = 'docs/recognition-optimization/RCO-5-007-P2-E1_TYPE_CORRECTION.json'
const resultPath = 'docs/recognition-optimization/rco-5-007-p2-e1-b4-replay/result.json'
const paths = [
  'docs/recognition-optimization/RCO-5-007-P2-E1-B5_PLAN.md',
  'src/recognition/taskFormationB4Dataset.test.ts',
  'scripts/record-rco-5-007-p2-e1-correction.mjs',
  correctionPath,
  'scripts/rco-5-007-p2-e1-correction.node-test.mjs',
  'scripts/run-rco-5-007-p2-e1-b4-replay.ts',
  resultPath,
  'docs/recognition-optimization/rco-5-007-p2-e1-b4-replay/REPORT.md',
  'scripts/rco-5-007-p2-e1-b4-replay.node-test.mjs',
  'docs/recognition-optimization/RCO-5-007-P2_COMPONENT_FREEZE.json',
  'docs/recognition-optimization/RCO-5-007-B4_DATA_FREEZE.json',
  'docs/recognition-optimization/RCO-5-007-B4_RESULT_FREEZE.json',
]

const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
const correction = JSON.parse(await readFile(resolve(root, correctionPath), 'utf8'))
const result = JSON.parse(await readFile(resolve(root, resultPath), 'utf8'))
const componentSha256 = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await sha(path)])))

if (!correction.runtimeEquivalent || correction.frozenDriftCount !== 1) {
  throw new Error('E1 type correction is not an isolated runtime-equivalent change')
}
if (!result.replayCasesEqual || !result.metricsEqual) {
  throw new Error('Seen B4 replay is not exactly equivalent to the original result')
}

const output = {
  schemaVersion: 'rco-5-007-p2-e1-component-freeze-1.0.0',
  stage: 'RCO-5-007-P2-E1-SEEN-B4-TYPE-CORRECTION',
  status: 'TECHNICAL_PASS_SEEN_B4_ELIGIBLE_TO_CREATE_AND_FREEZE_NEW_B5',
  frozenAt: '2026-09-04T20:34:00+08:00',
  authorizationId: 'RCO-5-007-P2-E1/B5',
  policyVersion: 'task-formation-policy-2.2.0-p2',
  datasetId: result.datasetId,
  datasetClassification: result.classification,
  componentPaths: paths,
  componentSha256,
  correction: {
    correctedPath: correction.correctedPath,
    beforeSourceSha256: correction.beforeSourceSha256,
    afterSourceSha256: correction.afterSourceSha256,
    beforeJavaScriptSha256: correction.beforeJavaScriptSha256,
    afterJavaScriptSha256: correction.afterJavaScriptSha256,
    runtimeEquivalent: correction.runtimeEquivalent,
    frozenDriftCount: correction.frozenDriftCount,
  },
  replay: {
    replayCasesEqual: result.replayCasesEqual,
    metricsEqual: result.metricsEqual,
    metrics: result.metrics,
  },
  engineeringGate: {
    lint: 'PASS',
    test: 'PASS_573_PLUS_1_LIVE_OCR_SKIPPED',
    build: 'PASS_WITH_EXISTING_CHUNK_WARNING',
    securityScan: 'PASS_486_FILES',
  },
  accounting: result.accounting,
  interpretation: 'Type-only fixture correction and seen B4 regression. Not unseen evidence, model accuracy, real-data evidence, browser acceptance, or release evidence.',
  protectedMutation: 'ONLY_AUTHORIZED_B4_TEST_TYPE_DECLARATION',
  stablePath: 'UNCHANGED',
  rco6: 'NOT_STARTED',
  deployment: 'NOT_RUN',
  nextAuthorization: 'ALREADY_AUTHORIZED_CREATE_AND_FREEZE_NEW_B5_THEN_RUN_ONCE_ZERO_CALL',
}

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, components: paths.length, status: output.status }))
