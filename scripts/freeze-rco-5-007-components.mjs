import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256File } from './rco-5-007-integrity.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007_COMPONENT_FREEZE.json')
const predictionDependencyPaths = [
  'scripts/run-rco-5-007-replay.ts',
  'scripts/rco-5-007-integrity.mjs',
  'src/recognition/taskFormationPolicyV2.ts',
  'src/recognition/scopeReferenceContract.ts',
  'src/recognition/scopeIndexV11.ts',
  'docs/recognition-optimization/rco-5-007-replay/b1-source-input.json',
  'docs/recognition-optimization/rco-5-006-b1-runs/rco-5-006-b1-m1-20260903b/raw-results.json',
  'package-lock.json',
  'package.json',
]
const scoringDependencyPaths = [
  'scripts/score-rco-5-007-replay.mjs',
  'scripts/rco-5-007-integrity.mjs',
  'docs/recognition-optimization/RCO-5-006-B1_DEVELOPMENT_DATASET.json',
  'docs/recognition-optimization/rco-5-007-replay/predictions.json',
  'docs/recognition-optimization/rco-5-006-b1-runs/rco-5-006-b1-m1-20260903b/result.json',
]
const protectedArtifactPaths = [
  'docs/recognition-optimization/RCO-5-006-B1_DEVELOPMENT_DATASET.json',
  'docs/recognition-optimization/RCO-5-006-B1_FREEZE.json',
  'docs/recognition-optimization/RCO-5-006-B1_PLAN.md',
  'docs/recognition-optimization/RCO-5-006-B1_TRACKER.md',
  'docs/recognition-optimization/rco-5-006-b1-runs/rco-5-006-b1-m1-20260903b/checkpoint.json',
  'docs/recognition-optimization/rco-5-006-b1-runs/rco-5-006-b1-m1-20260903b/raw-results.json',
]
const componentPaths = [
  ...predictionDependencyPaths,
  ...scoringDependencyPaths,
  ...protectedArtifactPaths,
  'scripts/prepare-rco-5-007-source-input.mjs',
  'scripts/freeze-rco-5-007-components.mjs',
  'src/recognition/taskFormationPolicyV2.test.ts',
  'scripts/rco-5-007-replay.node-test.mjs',
  'docs/recognition-optimization/RCO-5-007_PLAN.md',
  'docs/recognition-optimization/RCO-5-007_SEMANTIC_POLICY_V2.md',
]
const sha256 = {}
for (const path of [...new Set(componentPaths)]) sha256[path] = await sha256File(resolve(root, path))
const output = {
  schemaVersion: 'rco-5-007-component-freeze-1.0.0',
  authorizationId: 'RCO-5-007',
  classification: 'SEEN_DIAGNOSTIC_REPLAY',
  createdAt: '2026-09-03',
  predictionDependencyPaths,
  scoringDependencyPaths,
  protectedArtifactPaths,
  sha256,
  rule: 'Any dependency or protected-artifact hash mismatch stops prediction or scoring.',
}
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, hashedPaths: Object.keys(sha256).length }))
