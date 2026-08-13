/* global console */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertPathMaskedPacketSafe } from './e2-9-r4-path-mask.mjs'
import { sha256 } from './e2-9-r4-hash.mjs'

const ROOT = process.cwd()
const DOCS = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r4')
const CACHE = path.join(ROOT, '.evaluation-cache', 'e2-9-r4', 'protocol-3.2.0')
const previewPath = path.join(CACHE, 'adjudication', 'packet-preview.json')
const packetPath = path.join(CACHE, 'adjudication', 'adjudication-packet.json')
const keyPath = path.join(CACHE, 'private', 'mapping-key.json')

for (const file of [packetPath, keyPath]) {
  try { await readFile(file); throw new Error(`FORBIDDEN_ARTIFACT_EXISTS:${path.relative(ROOT, file)}`) } catch (error) {
    if (error instanceof Error && error.message.startsWith('FORBIDDEN_')) throw error
    if (!error || typeof error !== 'object' || error.code !== 'ENOENT') throw error
  }
}
const [previewRaw, previewManifestRaw, reviewRaw, runRaw] = await Promise.all([
  readFile(previewPath, 'utf8'), readFile(path.join(DOCS, 'packet-preview-manifest.json'), 'utf8'),
  readFile(path.join(DOCS, 'path-mask-dry-review.json'), 'utf8'), readFile(path.join(DOCS, 'run-manifest.json'), 'utf8'),
])
const preview = JSON.parse(previewRaw), manifest = JSON.parse(previewManifestRaw), review = JSON.parse(reviewRaw), run = JSON.parse(runRaw)
if (manifest.gateStatus !== 'PATH_MASKING_PREVIEW_PASS' || manifest.packetPreviewSha256 !== sha256(previewRaw)) throw new Error('PREVIEW_BINDING_INVALID')
if (review.packetPreviewSha256 !== manifest.packetPreviewSha256 || review.canIdentifyEitherPath !== false || review.verdict !== 'PASS') throw new Error('FRESH_REVIEW_PREREQUISITE_FAILED')
assertPathMaskedPacketSafe(preview)
await mkdir(path.dirname(packetPath), { recursive: true })
await writeFile(packetPath, previewRaw, 'utf8')
const result = {
  schemaVersion: 'e2.9-r4-formal-packet-manifest-1.0.0', protocolVersion: run.protocolVersion,
  runManifestSha256: run.runManifestSha256, packetSha256: sha256(previewRaw), packetPreviewSha256: sha256(previewRaw),
  pairCount: preview.pairs.length, dryReviewSha256: sha256(reviewRaw), packetSafe: true, mappingKeyAccessible: false,
  expectedLoaded: false, gateStatus: 'ADJUDICATION_OPEN',
}
await writeFile(path.join(DOCS, 'adjudication-packet-manifest.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(result, null, 2))
