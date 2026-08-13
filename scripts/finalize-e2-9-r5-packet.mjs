/* global console */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertPathMaskedPacketSafe } from './e2-9-r5-path-mask.mjs'
import { sha256 } from './e2-9-r5-hash.mjs'
import { assertR5StagePrerequisite, assertRunManifestBinding } from './e2-9-r5-integrity.mjs'
import { resolveR5RunContext } from './e2-9-r5-run-context.mjs'

const ROOT = process.cwd()
const { docs: DOCS, cache: CACHE } = resolveR5RunContext({ root: ROOT })
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
assertRunManifestBinding(run)
if (manifest.gateStatus !== 'PATH_MASKING_PREVIEW_PASS' || manifest.packetPreviewSha256 !== sha256(previewRaw)) throw new Error('PREVIEW_BINDING_INVALID')
if (manifest.runManifestSha256 !== run.runManifestSha256) throw new Error('PREVIEW_RUN_BINDING_INVALID')
const reviewKeys = ['allowedInputs', 'canIdentifyEitherPath', 'checkpointSha256', 'packetPreviewSha256', 'protocolVersion', 'reason', 'reviewProcessId', 'reviewedAt', 'reviewerKind', 'runId', 'runManifestSha256', 'schemaVersion', 'suspectedLeakPaths', 'verdict']
if (Object.keys(review).sort().join(',') !== reviewKeys.sort().join(',')
  || review.schemaVersion !== 'e2.9-r5-path-mask-dry-review-1.0.0' || review.protocolVersion !== run.protocolVersion
  || review.runId !== run.runId || review.runManifestSha256 !== run.runManifestSha256 || review.checkpointSha256 !== manifest.checkpointSha256
  || review.packetPreviewSha256 !== manifest.packetPreviewSha256 || review.reviewerKind !== 'independent_fresh_read_only'
  || typeof review.reviewProcessId !== 'string' || review.reviewProcessId.length < 8
  || JSON.stringify(review.allowedInputs) !== JSON.stringify(['packet-preview.json', 'adjudication-packet.schema.json', 'adjudication-rubric.json'])
  || !Number.isFinite(Date.parse(manifest.packetPreviewCreatedAt)) || !Number.isFinite(Date.parse(review.reviewedAt))
  || Date.parse(review.reviewedAt) <= Date.parse(manifest.packetPreviewCreatedAt) || review.canIdentifyEitherPath !== false
  || !Array.isArray(review.suspectedLeakPaths) || review.suspectedLeakPaths.length !== 0
  || review.verdict !== 'PASS' || typeof review.reason !== 'string' || review.reason.length < 20) throw new Error('FRESH_REVIEW_PREREQUISITE_FAILED')
assertR5StagePrerequisite('adjudication', { pathMaskGatePass: true, freshDryReviewPass: true, mappingKeyAbsent: true })
assertPathMaskedPacketSafe(preview)
await mkdir(path.dirname(packetPath), { recursive: true })
await writeFile(packetPath, previewRaw, 'utf8')
const result = {
  schemaVersion: 'e2.9-r5-formal-packet-manifest-1.0.0', protocolVersion: run.protocolVersion,
  runManifestSha256: run.runManifestSha256, checkpointSha256: manifest.checkpointSha256,
  packetSha256: sha256(previewRaw), packetPreviewSha256: sha256(previewRaw),
  pairCount: preview.pairs.length, dryReviewSha256: sha256(reviewRaw), packetSafe: true, mappingKeyAccessible: false,
  expectedLoaded: false, adjudicationOpenedAt: new Date().toISOString(), gateStatus: 'ADJUDICATION_OPEN',
}
await writeFile(path.join(DOCS, 'adjudication-packet-manifest.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(result, null, 2))
