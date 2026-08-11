import { createHash } from 'node:crypto'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const PACKET = path.resolve(ROOT, '.evaluation-cache/e2-7/p2-user-impact-packet.json')
const MANIFEST = path.resolve(ROOT, 'docs/e2-path-a-planning/p2-blind-packet-manifest.json')
const LABELS_RELATIVE = 'docs/e2-path-a-planning/p2-user-impact-labels.json'
const LABELS = path.resolve(ROOT, LABELS_RELATIVE)
const KEY_RELATIVE = 'docs/e2-path-a-planning/p2-reveal-key.json'
const KEY = path.resolve(ROOT, KEY_RELATIVE)
const LABEL_VALUES = new Set(['MAJOR', 'NOT_MAJOR', 'INSUFFICIENT_INFORMATION'])
const REASON_VALUES = new Set([
  'missing_required_action',
  'wrong_action_predicate',
  'wrong_actor',
  'wrong_modality',
  'wrong_applicability_condition',
  'wrong_time_value_affecting_schedule',
  'wrong_time_role_affecting_workflow',
  'false_precision',
  'missing_required_event',
  'unsupported_evidence_affecting_trust',
  'severe_or_safety_failure',
  'equivalent_task_merge_or_split',
  'title_alias_only',
  'milestone_granularity_without_fact_loss',
  'project_container_choice_without_action_loss',
  'evidence_fragmentation_with_literal_coverage',
  'informational_event_without_action_invention',
  'cosmetic_wording_only',
  'no_major_user_change_required',
  'insufficient_information',
])

async function exists(file) {
  try { await access(file); return true } catch { return false }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function assertLabels(labels, packet, manifest) {
  if (labels.schemaVersion !== 'e2.7-user-impact-labels-1.0.0') throw new Error('Unexpected labels schema')
  if (labels.packetSha256 !== manifest.packet.sha256) throw new Error('Labels packet hash mismatch')
  if (labels.reviewer?.independence !== 'NO_EXPECTED_NO_CASE_ID_NO_STRICT_SCORE_NO_REVEAL_KEY') throw new Error('Reviewer independence declaration is missing')
  if (!labels.reviewer?.reviewerId?.trim()) throw new Error('Reviewer ID is missing')
  if (Number.isNaN(Date.parse(labels.reviewer.startedAt)) || Number.isNaN(Date.parse(labels.reviewer.completedAt))
    || Date.parse(labels.reviewer.startedAt) > Date.parse(labels.reviewer.completedAt)) {
    throw new Error('Reviewer chronology is invalid')
  }
  if (!Array.isArray(labels.labels) || labels.labels.length < 60) throw new Error('At least 60 blind labels are required')
  const packetIds = packet.observations.map((entry) => entry.observationId)
  const labelIds = labels.labels.map((entry) => entry.observationId)
  if (new Set(labelIds).size !== labelIds.length || labelIds.some((id) => !packetIds.includes(id)) || packetIds.some((id) => !labelIds.includes(id))) {
    throw new Error('Labels must cover each packet observation exactly once')
  }
  for (const label of labels.labels) {
    if (!LABEL_VALUES.has(label.label)) throw new Error(`Invalid blind label: ${label.observationId}`)
    if (!Array.isArray(label.reasons) || label.reasons.length === 0 || !label.rationale?.trim()) throw new Error(`Missing reasoning: ${label.observationId}`)
    if (label.reasons.some((reason) => !REASON_VALUES.has(reason))) throw new Error(`Unknown reason: ${label.observationId}`)
    const serialized = JSON.stringify(label)
    if (/caseId|expected|strictScore|sourceSet/u.test(serialized)) throw new Error(`Unblinded field in label: ${label.observationId}`)
  }
  if (/caseId|expected|strictScore|sourceSet/u.test(JSON.stringify(labels))) throw new Error('Labels contain an unblinded field')
}

async function main() {
  const packetBytes = await readFile(PACKET)
  const packet = JSON.parse(packetBytes.toString('utf8'))
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'))
  if (sha256(packetBytes) !== manifest.packet.sha256) throw new Error('Packet hash mismatch')
  if (packet.sampleCount !== 72 || packet.observations.length !== 72) throw new Error('P2 packet must contain 72 observations')
  const forbiddenPacket = JSON.stringify(packet.observations)
  if (/"caseId"|"expected"|"strictScores"|"failures"|"sourceSet"|"route"|"repair"/u.test(forbiddenPacket)) {
    throw new Error('Packet contains a blinded field')
  }

  const labelsExist = await exists(LABELS)
  const keyExists = await exists(KEY)
  if (!labelsExist) {
    if (keyExists) throw new Error('Reveal key exists before labels')
    process.stdout.write('P2_PACKET_VALID_LABELS_NOT_STARTED_KEY_NOT_CREATED\n')
    return
  }
  const labelsBytes = await readFile(LABELS)
  const labels = JSON.parse(labelsBytes.toString('utf8'))
  assertLabels(labels, packet, manifest)
  if (!keyExists) {
    process.stdout.write('P2_LABELS_VALID_KEY_NOT_CREATED\n')
    return
  }
  const keyBytes = await readFile(KEY)
  const key = JSON.parse(keyBytes.toString('utf8'))
  if (key.packetSha256 !== sha256(packetBytes) || key.labelsSha256 !== sha256(labelsBytes)) throw new Error('Reveal key hash binding failed')
  if (Date.parse(key.revealedAt) <= Date.parse(key.labelsFrozenCommitTime)) throw new Error('Reveal chronology is invalid')
  if (git('status', '--porcelain', '--', LABELS_RELATIVE)) throw new Error('Labels changed after freeze')
  if (git('status', '--porcelain', '--', KEY_RELATIVE)) throw new Error('Reveal key must be committed and clean')
  const labelsCommit = git('log', '-1', '--format=%H', '--', LABELS_RELATIVE)
  if (labelsCommit !== key.labelsFrozenCommit) throw new Error('Labels freeze commit mismatch')
  if (Date.parse(labels.reviewer.completedAt) > Date.parse(key.labelsFrozenCommitTime)) throw new Error('Reviewer completion is after the labels freeze commit')
  const firstKeyCommit = git('log', '--diff-filter=A', '--format=%H', '--', KEY_RELATIVE).split(/\r?\n/u).filter(Boolean).at(-1)
  if (!firstKeyCommit) throw new Error('Reveal key does not have a Git commit')
  if (firstKeyCommit === labelsCommit) throw new Error('Reveal key and labels were committed together')
  try {
    git('merge-base', '--is-ancestor', labelsCommit, firstKeyCommit)
  } catch {
    throw new Error('Reveal key commit is not after the labels freeze commit')
  }
  if (key.mapping.length !== packet.observations.length) throw new Error('Reveal mapping count mismatch')
  process.stdout.write('P2_BLIND_CHRONOLOGY_AND_HASHES_VALID\n')
}

await main()
