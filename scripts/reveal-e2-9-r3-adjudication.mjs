/* global console */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { sha256 } from './e2-9-r3-hash.mjs'
import { assertRunManifestBinding } from './e2-9-r3-integrity.mjs'

const ROOT = process.cwd()
const DOCS = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r3')
const CACHE = path.join(ROOT, '.evaluation-cache', 'e2-9-r3', 'protocol-3.1.0')
const PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.1.0'
const ALLOWED = new Set(['X', 'Y', 'TIE', 'INSUFFICIENT_INFORMATION'])

function groupByCase(observations) {
  const groups = new Map()
  for (const item of observations) groups.set(item.caseId, [...(groups.get(item.caseId) ?? []), item])
  return groups
}

async function main() {
  const [runRaw, manifestRaw, packetRaw, labelsRaw, checkpointRaw] = await Promise.all([
    readFile(path.join(DOCS, 'run-manifest.json'), 'utf8'), readFile(path.join(DOCS, 'path-masked-packet-manifest.json'), 'utf8'),
    readFile(path.join(CACHE, 'adjudication', 'path-masked-packet.json'), 'utf8'), readFile(path.join(DOCS, 'path-masked-labels.json'), 'utf8'),
    readFile(path.join(CACHE, 'checkpoints', 'e29r3-screening-20260813-a.json'), 'utf8'),
  ])
  const run = JSON.parse(runRaw)
  const manifest = JSON.parse(manifestRaw)
  const packet = JSON.parse(packetRaw)
  const labels = JSON.parse(labelsRaw)
  const checkpoint = JSON.parse(checkpointRaw)
  if ([run, manifest, packet, labels, checkpoint].some((item) => item.protocolVersion !== PROTOCOL_VERSION)) throw new Error('PROTOCOL_VERSION_DRIFT')
  assertRunManifestBinding(run)
  if (manifest.runManifestSha256 !== run.runManifestSha256 || manifest.packetSha256 !== sha256(packetRaw) || manifest.checkpointSha256 !== sha256(checkpointRaw) || labels.runManifestSha256 !== run.runManifestSha256 || labels.packetSha256 !== manifest.packetSha256) throw new Error('ADJUDICATION_BINDING_MISMATCH')
  if (!Array.isArray(labels.labels) || labels.labels.length !== packet.pairs.length || new Set(labels.labels.map((item) => item.pairId)).size !== packet.pairs.length) throw new Error('LABEL_COVERAGE_INVALID')
  if (labels.labels.some((item) => !ALLOWED.has(item.preferred) || typeof item.rationale !== 'string' || !item.rationale.trim())) throw new Error('LABEL_VALUE_INVALID')
  const byCase = groupByCase(checkpoint.observations)
  const mappings = [...byCase.entries()].map(([caseId, observations], index) => {
    const swap = Number.parseInt(sha256(`${run.runId}:path-mask:${caseId}`).slice(0, 2), 16) % 2 === 1
    return { pairId: `E29R3-P${String(index + 1).padStart(2, '0')}`, X: swap ? 'pro' : 'flash', Y: swap ? 'flash' : 'pro' }
  })
  const labelsById = new Map(labels.labels.map((item) => [item.pairId, item]))
  const counts = { proPreferred: 0, flashPreferred: 0, tie: 0, insufficientInformation: 0 }
  for (const mapping of mappings) {
    const preferred = labelsById.get(mapping.pairId).preferred
    const model = preferred === 'X' ? mapping.X : preferred === 'Y' ? mapping.Y : preferred
    if (model === 'pro') counts.proPreferred += 1
    else if (model === 'flash') counts.flashPreferred += 1
    else if (model === 'TIE') counts.tie += 1
    else counts.insufficientInformation += 1
  }
  const revealedAt = new Date().toISOString()
  const chronologyPass = Date.parse(labels.labelsCompletedAt) <= Date.parse(revealedAt)
  if (!chronologyPass) throw new Error('ADJUDICATION_CHRONOLOGY_INVALID')
  const key = { schemaVersion: 'e2.9-r3-path-mask-key-3.1.0', protocolVersion: PROTOCOL_VERSION, runManifestSha256: run.runManifestSha256, packetSha256: manifest.packetSha256, labelsSha256: sha256(labelsRaw), labelsCompletedAt: labels.labelsCompletedAt, revealedAt, mappings }
  await mkdir(path.join(CACHE, 'adjudication'), { recursive: true })
  await writeFile(path.join(CACHE, 'adjudication', 'path-mask-key.json'), `${JSON.stringify(key, null, 2)}\n`, 'utf8')
  const result = {
    schemaVersion: 'e2.9-r3-path-masked-result-3.1.0', protocolVersion: PROTOCOL_VERSION,
    runManifestSha256: run.runManifestSha256, packetSha256: manifest.packetSha256, labelsSha256: sha256(labelsRaw),
    chronologyPass, pairCount: mappings.length, counts,
    semantic: { proPreferenceRate: counts.proPreferred / mappings.length, flashPreferenceRate: counts.flashPreferred / mappings.length, tieRate: counts.tie / mappings.length },
  }
  await writeFile(path.join(DOCS, 'path-masked-result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ status: 'PATH_MASK_REVEALED', chronologyPass, counts }, null, 2))
}

await main()
