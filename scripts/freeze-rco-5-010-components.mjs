import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const manifestPath = 'docs/recognition-optimization/RCO-5-010_COMPONENT_FREEZE.json'
export const componentPaths = [
  'docs/recognition-optimization/RCO-5-010_PLAN.md',
  'src/recognition/candidateSourceIntegrity.ts',
  'src/recognition/candidateTaskSafetyPolicyV2.ts',
  'src/recognition/candidateTaskSafetyPolicyV2.test.ts',
  'src/recognition/fullPropositionAdjudicator.ts',
  'src/recognition/directiveGovernorProof.ts',
  'src/recognition/directiveGovernorProof.test.ts',
  'src/recognition/threeValuedActionability.ts',
  'src/recognition/jsonStructuralEqual.ts',
  'src/recognition/jsonStructuralEqual.test.ts',
  'src/recognition/countMapComparison.ts',
  'src/recognition/countMapComparison.test.ts',
  'src/recognition/rco5010E1Boundary.test.ts',
  'src/recognition/rco5010SeenB9Regression.test.ts',
  'scripts/run-rco-5-010-seen-b9-replay.ts',
  'scripts/freeze-rco-5-010-components.mjs',
  'scripts/rco-5-010-component-freeze.node-test.mjs',
  'docs/recognition-optimization/rco-5-010-seen-b9-replay/result.json',
  'docs/recognition-optimization/rco-5-010-seen-b9-replay/REPORT.md',
  'docs/recognition-optimization/RCO-5-010_E1_AUDIT.md',
  'docs/recognition-optimization/RCO-5-010_CLOSE_REPORT.md',
  'docs/recognition-optimization/RCO-5-010_CLOSE_CHECKS.json',
  'docs/recognition-optimization/RCO-5-009A_COMPONENT_FREEZE.json',
  'docs/recognition-optimization/RCO-5-009-B9_DATA_FREEZE.json',
  'docs/recognition-optimization/RCO-5-009-B9_ZERO_CALL_RESULT_FREEZE.json',
]
const sha = async (path) => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')

export async function verifyFreeze() {
  const freeze = JSON.parse(await readFile(resolve(root, manifestPath), 'utf8'))
  assert.deepEqual(freeze.componentPaths, componentPaths)
  assert.deepEqual(Object.keys(freeze.componentSha256).sort(), [...componentPaths].sort())
  for (const path of componentPaths) assert.equal(await sha(path), freeze.componentSha256[path], path)
  assert.equal(freeze.historicalB9Gate, 'FAIL')
  assert.equal(freeze.modelCalls, 0)
  assert.equal(freeze.costCny, 0)
  assert.equal(freeze.nextAction, 'STOP_NO_B10_NO_MODEL_NO_DEPLOY')
  return freeze
}

async function main() {
  if (process.argv.includes('--verify')) {
    await verifyFreeze()
    console.log(`RCO-5-010 component freeze: ${componentPaths.length} hashes PASS`)
    return
  }
  const checks = JSON.parse(await readFile(resolve(root, 'docs/recognition-optimization/RCO-5-010_CLOSE_CHECKS.json'), 'utf8'))
  for (const gate of ['directed', 'independentReview', 'lint', 'test', 'build', 'security', 'dependencyAudit', 'protectedFreeze']) {
    assert.equal(checks[gate].status, 'PASS', gate)
  }
  const componentSha256 = Object.fromEntries(await Promise.all(componentPaths.map(async (path) => [path, await sha(path)])))
  const freeze = {
    schemaVersion: 'rco-5-010-component-freeze-1.0.0',
    stage: 'RCO-5-010-E1-CLOSE', frozenAt: new Date().toISOString(),
    componentPaths, componentSha256,
    historicalB9Gate: 'FAIL', modelCalls: 0, costCny: 0, secretAccess: 'NONE',
    stablePath: 'NOT_CONNECTED', rco6: 'NOT_STARTED', deployment: 'NOT_RUN',
    nextAction: 'STOP_NO_B10_NO_MODEL_NO_DEPLOY',
    mutableMirrorsNotHashed: ['CURRENT_CONTEXT.md', 'OPTIMIZATION_LOG.md'],
  }
  await writeFile(resolve(root, manifestPath), `${JSON.stringify(freeze, null, 2)}\n`, { flag: 'wx' })
  await verifyFreeze()
  console.log(`RCO-5-010 component freeze: ${componentPaths.length} hashes PASS`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
