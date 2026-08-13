/* global console */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { canonicalJson, sha256 } from './e2-9-r3-hash.mjs'
import { assertRunManifestBinding, scorableFinalPayload } from './e2-9-r3-integrity.mjs'

const ROOT = process.cwd()
const DOCS = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r3')
const CACHE = path.join(ROOT, '.evaluation-cache', 'e2-9-r3', 'protocol-3.1.0')
const PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.1.0'

function groupByCase(observations) {
  const groups = new Map()
  for (const item of observations) groups.set(item.caseId, [...(groups.get(item.caseId) ?? []), item])
  return groups
}

async function main() {
  const packetPath = path.join(CACHE, 'adjudication', 'path-masked-packet.json')
  const manifestPath = path.join(DOCS, 'path-masked-packet-manifest.json')
  for (const file of [packetPath, manifestPath]) {
    try { await readFile(file); throw new Error(`Refusing to overwrite R3 adjudication artifact: ${path.relative(ROOT, file)}`) } catch (error) {
      if (error instanceof Error && error.message.startsWith('Refusing')) throw error
      if (!error || typeof error !== 'object' || error.code !== 'ENOENT') throw error
    }
  }
  const [runRaw, sourceRaw, checkpointRaw] = await Promise.all([
    readFile(path.join(DOCS, 'run-manifest.json'), 'utf8'),
    readFile(path.join(CACHE, 'source-only-manifest.json'), 'utf8'),
    readFile(path.join(CACHE, 'checkpoints', 'e29r3-screening-20260813-a.json'), 'utf8'),
  ])
  const run = JSON.parse(runRaw)
  const source = JSON.parse(sourceRaw)
  const checkpoint = JSON.parse(checkpointRaw)
  if ([run, source, checkpoint].some((item) => item.protocolVersion !== PROTOCOL_VERSION)) throw new Error('PROTOCOL_VERSION_DRIFT')
  assertRunManifestBinding(run)
  if (checkpoint.gateStatus !== 'GENERATION_COMPLETE' || checkpoint.runStatus !== 'COMPLETE' || checkpoint.runManifestSha256 !== run.runManifestSha256) throw new Error('SCREENING_NOT_COMPLETE')
  const sources = new Map(source.screeningCases.map((item) => [item.caseId, item]))
  const byCase = groupByCase(checkpoint.observations)
  const pairs = [...byCase.entries()].map(([caseId, observations], index) => {
    if (observations.length !== 2 || new Set(observations.map((item) => item.modelAlias)).size !== 2) throw new Error(`PAIR_INCOMPLETE_${caseId}`)
    const flash = observations.find((item) => item.modelAlias === 'flash')
    const pro = observations.find((item) => item.modelAlias === 'pro')
    const swap = Number.parseInt(sha256(`${run.runId}:path-mask:${caseId}`).slice(0, 2), 16) % 2 === 1
    const ordered = swap ? [pro, flash] : [flash, pro]
    const fixture = sources.get(caseId)
    return {
      pairId: `E29R3-P${String(index + 1).padStart(2, '0')}`,
      source: { sourceType: fixture.sourceType, sourceTitle: fixture.sourceTitle, text: fixture.content, referenceTime: fixture.referenceTime, timezone: fixture.timezone },
      X: scorableFinalPayload(ordered[0]).result,
      Y: scorableFinalPayload(ordered[1]).result,
    }
  })
  const packet = {
    schemaVersion: 'e2.9-r3-path-masked-packet-3.1.0', protocolVersion: PROTOCOL_VERSION,
    runManifestSha256: run.runManifestSha256, checkpointSha256: sha256(checkpointRaw),
    reviewerBoundary: 'Judge only source plus X/Y outputs. Do not read run manifest, model mapping, expected fixtures, scores, historical outputs or reveal key.',
    labels: ['X', 'Y', 'TIE', 'INSUFFICIENT_INFORMATION'], pairs,
  }
  await mkdir(path.dirname(packetPath), { recursive: true })
  await writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8')
  const packetRaw = await readFile(packetPath, 'utf8')
  const manifest = {
    schemaVersion: 'e2.9-r3-path-masked-packet-manifest-3.1.0', protocolVersion: PROTOCOL_VERSION,
    runManifestSha256: run.runManifestSha256, checkpointSha256: sha256(checkpointRaw), packetSha256: sha256(packetRaw),
    pairCount: pairs.length, mappingKeyCreated: false, labelsPath: 'docs/e2-v4-pro-benchmark-r3/path-masked-labels.json',
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ status: 'PATH_MASKED_PACKET_READY', pairCount: pairs.length, packetSha256: manifest.packetSha256 }, null, 2))
}

await main()
