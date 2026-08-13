/* global console */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildPathMaskedPair, assertPathMaskedPacketSafe, PATH_MASK_VERSION, PACKET_SCHEMA_VERSION } from './e2-9-r4-path-mask.mjs'
import { sha256 } from './e2-9-r4-hash.mjs'
import { assertCanonicalBinding, assertRunManifestBinding, completeObservationStatus } from './e2-9-r4-integrity.mjs'

const ROOT = process.cwd()
const DOCS = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r4')
const CACHE = path.join(ROOT, '.evaluation-cache', 'e2-9-r4', 'protocol-3.2.0')
const PACKET = path.join(CACHE, 'adjudication', 'packet-preview.json')
const MANIFEST = path.join(DOCS, 'packet-preview-manifest.json')
const secret = process.env.E2_R4_PATH_MASK_REVEAL_SECRET ?? ''
if (secret.length < 64) throw new Error('PATH_MASK_REVEAL_SECRET_INVALID')

async function mustNotExist(file) {
  try { await readFile(file); throw new Error(`REFUSING_TO_OVERWRITE:${path.relative(ROOT, file)}`) } catch (error) {
    if (error instanceof Error && error.message.startsWith('REFUSING_')) throw error
    if (!error || typeof error !== 'object' || error.code !== 'ENOENT') throw error
  }
}

await Promise.all([mustNotExist(PACKET), mustNotExist(MANIFEST), mustNotExist(path.join(CACHE, 'private', 'mapping-key.json'))])
const [runRaw, sourceRaw, checkpointRaw, rubricRaw, schemaRaw] = await Promise.all([
  readFile(path.join(DOCS, 'run-manifest.json'), 'utf8'),
  readFile(path.join(CACHE, 'source-only-manifest.json'), 'utf8'),
  readFile(path.join(CACHE, 'checkpoints', 'e29r4-screening-20260813-a.json'), 'utf8'),
  readFile(path.join(DOCS, 'adjudication-rubric.json'), 'utf8'),
  readFile(path.join(DOCS, 'adjudication-packet.schema.json'), 'utf8'),
])
const run = JSON.parse(runRaw)
const source = JSON.parse(sourceRaw)
const checkpoint = JSON.parse(checkpointRaw)
const rubric = JSON.parse(rubricRaw)
assertRunManifestBinding(run)
assertCanonicalBinding(source, run.bindings.sourceOnlySha256, 'SOURCE_ONLY')
if (checkpoint.runManifestSha256 !== run.runManifestSha256 || checkpoint.gateStatus !== 'GENERATION_COMPLETE') throw new Error('SCREENING_PREREQUISITE_FAILED')
const planned = run.observationPlan.filter((item) => item.phase === 'screening')
if (planned.length !== 16 || checkpoint.observations.length !== 16 || checkpoint.observations.some((item) => !completeObservationStatus(item.status))) throw new Error('SCREENING_CARDINALITY_INVALID')
const records = new Map(checkpoint.observations.map((item) => [item.observationId, item]))
const sources = new Map(source.screeningCases.map((item) => [item.caseId, item]))
const caseIds = [...new Set(planned.map((item) => item.caseId))]
if (caseIds.length !== 8) throw new Error('PAIR_CARDINALITY_INVALID')
const pairs = caseIds.map((caseId, index) => {
  const arms = Object.fromEntries(planned.filter((item) => item.caseId === caseId).map((item) => [item.modelAlias, records.get(item.observationId)?.response?.payload?.result]))
  if (!arms.flash || !arms.pro) throw new Error('PAIR_ARM_MISSING')
  return buildPathMaskedPair({ revealSecret: secret, runId: run.runId, anonymousCaseId: `review-case-${String(index + 1).padStart(3, '0')}`, caseId, source: sources.get(caseId), resultsByAlias: arms })
})
const packet = { schemaVersion: PACKET_SCHEMA_VERSION, pathMaskVersion: PATH_MASK_VERSION, rubric, pairs }
const safety = assertPathMaskedPacketSafe(packet)
const packetText = `${JSON.stringify(packet, null, 2)}\n`
const manifest = {
  schemaVersion: 'e2.9-r4-packet-preview-manifest-1.0.0', protocolVersion: run.protocolVersion,
  runManifestSha256: run.runManifestSha256, checkpointSha256: sha256(checkpointRaw),
  packetSchemaSha256: sha256(schemaRaw), adjudicationRubricSha256: sha256(rubricRaw),
  pathMaskVersion: PATH_MASK_VERSION, pathMaskSourceSha256: run.frozen.pathMaskSourceSha256,
  packetPreviewSha256: sha256(packetText), pairCount: pairs.length, ...safety,
  mappingKeyAccessible: false, expectedLoaded: false, mappingKeyCreated: false,
  commitmentCount: pairs.length, anonymousCaseIds: true, performanceSideChannelsRemoved: true,
  gateStatus: Object.values(safety).every((value) => value === true || value === 0) ? 'PATH_MASKING_PREVIEW_PASS' : 'PATH_MASKING_GATE_FAIL',
}
await mkdir(path.dirname(PACKET), { recursive: true })
await writeFile(PACKET, packetText, 'utf8')
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ gateStatus: manifest.gateStatus, pairs: pairs.length, leaks: 0, packetPreviewSha256: manifest.packetPreviewSha256 }, null, 2))
