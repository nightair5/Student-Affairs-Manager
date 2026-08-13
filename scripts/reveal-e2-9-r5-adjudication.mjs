/* global console */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assignmentCommitment, deriveSideAssignment, scanPathMaskedPacket, verifyRevealChronology } from './e2-9-r5-path-mask.mjs'
import { sha256 } from './e2-9-r5-hash.mjs'
import { assertR5StagePrerequisite, assertRunManifestBinding } from './e2-9-r5-integrity.mjs'

const ROOT = process.cwd(), DOCS = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r5'), CACHE = path.join(ROOT, '.evaluation-cache', 'e2-9-r5', 'protocol-3.3.0')
const secret = process.env.E2_R5_PATH_MASK_REVEAL_SECRET ?? ''
if (secret.length < 64) throw new Error('PATH_MASK_REVEAL_SECRET_INVALID')
const keyPath = path.join(CACHE, 'private', 'mapping-key.json')
try { await readFile(keyPath); throw new Error('MAPPING_KEY_ALREADY_EXISTS') } catch (error) { if (error instanceof Error && error.message === 'MAPPING_KEY_ALREADY_EXISTS') throw error; if (!error || typeof error !== 'object' || error.code !== 'ENOENT') throw error }
const [runRaw, packetRaw, packetManifestRaw, labelsRaw, checkpointRaw] = await Promise.all([
  readFile(path.join(DOCS, 'run-manifest.json'), 'utf8'), readFile(path.join(CACHE, 'adjudication', 'adjudication-packet.json'), 'utf8'),
  readFile(path.join(DOCS, 'adjudication-packet-manifest.json'), 'utf8'), readFile(path.join(DOCS, 'path-masked-labels.json'), 'utf8'),
  readFile(path.join(CACHE, 'checkpoints', 'e29r5-screening-20260813-a.json'), 'utf8'),
])
const run = JSON.parse(runRaw), packet = JSON.parse(packetRaw), packetManifest = JSON.parse(packetManifestRaw), labels = JSON.parse(labelsRaw), checkpoint = JSON.parse(checkpointRaw)
assertRunManifestBinding(run)
const labelKeys = ['checkpointSha256', 'labels', 'labelsCompletedAt', 'labelsSha256', 'packetSha256', 'protocolVersion', 'reviewProcessId', 'reviewerKind', 'runId', 'runManifestSha256', 'schemaVersion']
if (Object.keys(labels).sort().join(',') !== labelKeys.sort().join(',')
  || labels.schemaVersion !== 'e2.9-r5-path-masked-labels-1.0.0' || labels.protocolVersion !== run.protocolVersion
  || labels.runId !== run.runId || labels.runManifestSha256 !== run.runManifestSha256 || labels.checkpointSha256 !== sha256(checkpointRaw)
  || packetManifest.packetSha256 !== sha256(packetRaw) || labels.packetSha256 !== packetManifest.packetSha256
  || labels.labelsSha256 !== sha256(JSON.stringify(labels.labels)) || labels.reviewerKind !== 'independent_fresh_read_only'
  || typeof labels.reviewProcessId !== 'string' || labels.reviewProcessId.length < 8) throw new Error('LABEL_OR_PACKET_BINDING_INVALID')
if (packetManifest.runManifestSha256 !== run.runManifestSha256 || packetManifest.checkpointSha256 !== sha256(checkpointRaw) || checkpoint.runManifestSha256 !== run.runManifestSha256) throw new Error('ADJUDICATION_RUN_BINDING_INVALID')
const expectedAnonymousIds = packet.pairs.map((item) => item.caseAnonymousId).sort()
if (labels.labels.length !== 8 || new Set(labels.labels.map((item) => item.caseAnonymousId)).size !== 8
  || JSON.stringify(labels.labels.map((item) => item.caseAnonymousId).sort()) !== JSON.stringify(expectedAnonymousIds)
  || labels.labels.some((item) => Object.keys(item).sort().join(',') !== 'caseAnonymousId,preferredSide,reason,xMajor,xPlanningError,yMajor,yPlanningError'
    || !['X', 'Y', 'TIE', 'INSUFFICIENT_INFORMATION'].includes(item.preferredSide)
    || !['xMajor', 'yMajor', 'xPlanningError', 'yPlanningError'].every((field) => typeof item[field] === 'boolean')
    || typeof item.reason !== 'string' || item.reason.length < 8)) throw new Error('LABEL_CARDINALITY_INVALID')
if (scanPathMaskedPacket(labels).length) throw new Error('LABEL_LINEAGE_LEAK_DETECTED')
const planned = run.observationPlan.filter((item) => item.phase === 'screening'), caseIds = [...new Set(planned.map((item) => item.caseId))]
const keyRevealedAt = new Date().toISOString()
if (!Number.isFinite(Date.parse(packetManifest.adjudicationOpenedAt)) || Date.parse(labels.labelsCompletedAt) <= Date.parse(packetManifest.adjudicationOpenedAt)) throw new Error('ADJUDICATION_LABEL_FREEZE_INVALID')
verifyRevealChronology(labels.labelsCompletedAt, keyRevealedAt)
const mappings = caseIds.map((caseId, index) => {
  const anonymousCaseId = `review-case-${String(index + 1).padStart(3, '0')}`, assignment = deriveSideAssignment({ revealSecret: secret, runId: run.runId, caseId })
  const expectedCommitment = assignmentCommitment({ revealSecret: secret, runId: run.runId, anonymousCaseId, caseId, assignment })
  if (packet.pairs[index]?.assignmentCommitmentHash !== expectedCommitment) throw new Error('ASSIGNMENT_COMMITMENT_MISMATCH')
  return { anonymousCaseId, caseId, X: assignment.X, Y: assignment.Y, assignmentCommitmentHash: expectedCommitment }
})
assertR5StagePrerequisite('scoring', { labelsFrozen: Boolean(labels.labelsCompletedAt), chronologyValid: true, commitmentVerified: mappings.length === caseIds.length })
const key = { schemaVersion: 'e2.9-r5-private-mapping-key-1.0.0', runId: run.runId, runManifestSha256: run.runManifestSha256, checkpointSha256: sha256(checkpointRaw), labelsSha256: labels.labelsSha256, labelsCompletedAt: labels.labelsCompletedAt, keyRevealedAt, mappings }
await mkdir(path.dirname(keyPath), { recursive: true })
await writeFile(keyPath, `${JSON.stringify(key, null, 2)}\n`, 'utf8')
const counts = {
  proPreferred: 0, flashPreferred: 0, tie: 0, insufficient: 0,
  proMajor: 0, flashMajor: 0, proPlanningError: 0, flashPlanningError: 0,
}
for (const label of labels.labels) {
  const mapping = mappings.find((item) => item.anonymousCaseId === label.caseAnonymousId)
  if (label.preferredSide === 'TIE') counts.tie += 1
  else if (label.preferredSide === 'INSUFFICIENT_INFORMATION') counts.insufficient += 1
  else if (mapping?.[label.preferredSide] === 'pro') counts.proPreferred += 1
  else if (mapping?.[label.preferredSide] === 'flash') counts.flashPreferred += 1
  else throw new Error('PREFERRED_SIDE_INVALID')
  if (label.xMajor) counts[`${mapping.X}Major`] += 1
  if (label.yMajor) counts[`${mapping.Y}Major`] += 1
  if (label.xPlanningError) counts[`${mapping.X}PlanningError`] += 1
  if (label.yPlanningError) counts[`${mapping.Y}PlanningError`] += 1
}
const result = { schemaVersion: 'e2.9-r5-path-masked-result-1.0.0', protocolVersion: run.protocolVersion, runManifestSha256: run.runManifestSha256, checkpointSha256: sha256(checkpointRaw), packetSha256: packetManifest.packetSha256, labelsSha256: labels.labelsSha256, labelsCompletedAt: labels.labelsCompletedAt, keyRevealedAt, chronologyValid: true, commitmentVerified: true, mappingsCount: mappings.length, counts, status: 'REVEALED_FOR_SCORING' }
await writeFile(path.join(DOCS, 'path-masked-result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(result, null, 2))
