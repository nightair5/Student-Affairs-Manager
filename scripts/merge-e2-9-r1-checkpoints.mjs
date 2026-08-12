/* global console, process */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { sha256 } from './e2-9-r1-hash.mjs'

const ROOT = process.cwd()
const PROTOCOL_VERSION = 'e2-9-v4-pro-reduced-protocol-2.0.0'

function option(name) {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? ''
}

async function main() {
  const screeningPath = path.resolve(ROOT, option('screening'))
  const remainingPath = path.resolve(ROOT, option('remaining'))
  const outputPath = path.resolve(ROOT, option('output'))
  if (![option('screening'), option('remaining'), option('output')].every(Boolean)) throw new Error('--screening, --remaining and --output are required')
  const [screeningRaw, remainingRaw] = await Promise.all([readFile(screeningPath, 'utf8'), readFile(remainingPath, 'utf8')])
  const screening = JSON.parse(screeningRaw)
  const remaining = JSON.parse(remainingRaw)
  for (const checkpoint of [screening, remaining]) {
    if (checkpoint.protocolVersion !== PROTOCOL_VERSION || checkpoint.gateStatus !== 'COMPLETE') throw new Error('Only complete R1 checkpoints can be merged')
    if (checkpoint.observations.length !== checkpoint.expectedObservations || checkpoint.observations.some((item) => item.status !== 'complete')) throw new Error('Incomplete checkpoint cannot be merged')
  }
  if (screening.phase !== 'screening' || remaining.phase !== 'selection-remaining') throw new Error('Expected screening and selection-remaining checkpoints')
  for (const field of ['deploymentVersion', 'readinessLabel', 'readinessSha256', 'sourceOnlySha256']) {
    if (screening[field] !== remaining[field]) throw new Error(`Checkpoint provenance mismatch: ${field}`)
  }
  const observations = [...screening.observations, ...remaining.observations]
  const keys = observations.map((item) => `${item.caseId}:${item.modelAlias}`)
  if (observations.length !== 48 || new Set(keys).size !== 48 || new Set(observations.map((item) => item.caseId)).size !== 24) throw new Error('Selection merge must contain 24 complete pairs exactly once')
  const merged = {
    schemaVersion: 'e2.9-r1-merged-checkpoint-2.0.0', protocolVersion: PROTOCOL_VERSION, phase: 'selection',
    labels: { screening: screening.label, remaining: remaining.label }, seed: { screening: screening.seed, remaining: remaining.seed },
    deploymentVersion: screening.deploymentVersion, readinessLabel: screening.readinessLabel, readinessSha256: screening.readinessSha256,
    sourceOnlySha256: screening.sourceOnlySha256, startedAt: screening.startedAt, completedAt: remaining.completedAt,
    gateStatus: 'COMPLETE', expectedObservations: 48, observations,
    sourceCheckpoints: { screeningSha256: sha256(screeningRaw), remainingSha256: sha256(remainingRaw) },
  }
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ phase: 'selection', pairs: 24, output: path.relative(ROOT, outputPath), sha256: sha256(await readFile(outputPath, 'utf8')) }, null, 2))
}

await main()
