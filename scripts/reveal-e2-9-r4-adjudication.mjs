/* global console */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assignmentCommitment, deriveSideAssignment, scanPathMaskedPacket, verifyRevealChronology } from './e2-9-r4-path-mask.mjs'
import { sha256 } from './e2-9-r4-hash.mjs'

const ROOT = process.cwd(), DOCS = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r4'), CACHE = path.join(ROOT, '.evaluation-cache', 'e2-9-r4', 'protocol-3.2.0')
const secret = process.env.E2_R4_PATH_MASK_REVEAL_SECRET ?? ''
if (secret.length < 64) throw new Error('PATH_MASK_REVEAL_SECRET_INVALID')
const keyPath = path.join(CACHE, 'private', 'mapping-key.json')
try { await readFile(keyPath); throw new Error('MAPPING_KEY_ALREADY_EXISTS') } catch (error) { if (error instanceof Error && error.message === 'MAPPING_KEY_ALREADY_EXISTS') throw error; if (!error || typeof error !== 'object' || error.code !== 'ENOENT') throw error }
const [runRaw, packetRaw, packetManifestRaw, labelsRaw, checkpointRaw] = await Promise.all([
  readFile(path.join(DOCS, 'run-manifest.json'), 'utf8'), readFile(path.join(CACHE, 'adjudication', 'adjudication-packet.json'), 'utf8'),
  readFile(path.join(DOCS, 'adjudication-packet-manifest.json'), 'utf8'), readFile(path.join(DOCS, 'path-masked-labels.json'), 'utf8'),
  readFile(path.join(CACHE, 'checkpoints', 'e29r4-screening-20260813-a.json'), 'utf8'),
])
const run = JSON.parse(runRaw), packet = JSON.parse(packetRaw), packetManifest = JSON.parse(packetManifestRaw), labels = JSON.parse(labelsRaw), checkpoint = JSON.parse(checkpointRaw)
if (packetManifest.packetSha256 !== sha256(packetRaw) || labels.packetSha256 !== packetManifest.packetSha256 || labels.labelsSha256 !== sha256(JSON.stringify(labels.labels))) throw new Error('LABEL_OR_PACKET_BINDING_INVALID')
if (labels.labels.length !== 8 || new Set(labels.labels.map((item) => item.caseAnonymousId)).size !== 8) throw new Error('LABEL_CARDINALITY_INVALID')
if (scanPathMaskedPacket(labels).length) throw new Error('LABEL_LINEAGE_LEAK_DETECTED')
const planned = run.observationPlan.filter((item) => item.phase === 'screening'), caseIds = [...new Set(planned.map((item) => item.caseId))]
const keyRevealedAt = new Date().toISOString()
verifyRevealChronology(labels.labelsCompletedAt, keyRevealedAt)
const mappings = caseIds.map((caseId, index) => {
  const anonymousCaseId = `review-case-${String(index + 1).padStart(3, '0')}`, assignment = deriveSideAssignment({ revealSecret: secret, runId: run.runId, caseId })
  const expectedCommitment = assignmentCommitment({ revealSecret: secret, runId: run.runId, anonymousCaseId, caseId, assignment })
  if (packet.pairs[index]?.assignmentCommitmentHash !== expectedCommitment) throw new Error('ASSIGNMENT_COMMITMENT_MISMATCH')
  return { anonymousCaseId, caseId, X: assignment.X, Y: assignment.Y, assignmentCommitmentHash: expectedCommitment }
})
const key = { schemaVersion: 'e2.9-r4-private-mapping-key-1.0.0', runId: run.runId, runManifestSha256: run.runManifestSha256, checkpointSha256: sha256(checkpointRaw), labelsSha256: labels.labelsSha256, labelsCompletedAt: labels.labelsCompletedAt, keyRevealedAt, mappings }
await mkdir(path.dirname(keyPath), { recursive: true })
await writeFile(keyPath, `${JSON.stringify(key, null, 2)}\n`, 'utf8')
const counts = { proPreferred: 0, flashPreferred: 0, tie: 0, insufficient: 0 }
for (const label of labels.labels) {
  const mapping = mappings.find((item) => item.anonymousCaseId === label.caseAnonymousId)
  if (label.preferredSide === 'TIE') counts.tie += 1
  else if (label.preferredSide === 'INSUFFICIENT_INFORMATION') counts.insufficient += 1
  else if (mapping?.[label.preferredSide] === 'pro') counts.proPreferred += 1
  else if (mapping?.[label.preferredSide] === 'flash') counts.flashPreferred += 1
  else throw new Error('PREFERRED_SIDE_INVALID')
}
const result = { schemaVersion: 'e2.9-r4-path-masked-result-1.0.0', protocolVersion: run.protocolVersion, runManifestSha256: run.runManifestSha256, packetSha256: packetManifest.packetSha256, labelsSha256: labels.labelsSha256, labelsCompletedAt: labels.labelsCompletedAt, keyRevealedAt, chronologyValid: true, commitmentVerified: true, mappingsCount: mappings.length, counts, status: 'REVEALED_FOR_SCORING' }
await writeFile(path.join(DOCS, 'path-masked-result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(result, null, 2))
