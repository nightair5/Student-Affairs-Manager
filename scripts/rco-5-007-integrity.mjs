import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export async function sha256File(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

export async function verifyRco5007Freeze(root, phase) {
  const freezePath = resolve(root, 'docs/recognition-optimization/RCO-5-007_COMPONENT_FREEZE.json')
  const freeze = JSON.parse(await readFile(freezePath, 'utf8'))
  const dependencyPaths = phase === 'prediction' ? freeze.predictionDependencyPaths : freeze.scoringDependencyPaths
  if (!Array.isArray(dependencyPaths) || dependencyPaths.length === 0) throw new Error(`FREEZE_DEPENDENCIES_MISSING:${phase}`)
  const paths = [...new Set([...dependencyPaths, ...freeze.protectedArtifactPaths])]
  for (const relativePath of paths) {
    const actual = await sha256File(resolve(root, relativePath))
    if (actual !== freeze.sha256[relativePath]) throw new Error(`FREEZE_HASH_MISMATCH:${relativePath}`)
  }
  return { freeze, verifiedPaths: paths }
}

