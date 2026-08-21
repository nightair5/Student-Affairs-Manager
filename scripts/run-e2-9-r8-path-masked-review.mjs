/* global console, process */
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildR8FactGraphFromCachedRaw } from '../cloudflare/e2-r8-cache-fact-adapter.mjs'
import { planR8RecognitionResult } from '../cloudflare/e2-r8-isolated-planner.mjs'
import { normalizeR8FactGraphReferences } from '../cloudflare/e2-r8-restricted-normalizer.mjs'
import { canonicalJson } from './e2-9-r6-path-mask.mjs'
import {
  buildR8ReviewerPacket, buildR8SeparatedPair, evaluateR8ReviewGate, R8_GATE_VERSION,
  R8_REVIEW_GATE_POLICY, R8_REVIEW_PROTOCOL_VERSION, revealR8Mappings, sha256, summarizeR8Labels,
  validateR8LabelsDraft, validateR8PacketAudit,
} from './e2-9-r8-path-mask.mjs'

const sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs))
const FROZEN_CHECKPOINT_SHA256 = '0886afb941eeb74d80d9ed35601ee50447c0e4b464310ac197fd39df006fa336'
const FROZEN_SOURCE_MANIFEST_SHA256 = '115b43f98d0ca56cac522d0272ed10894fa0cc2a185562d0c10ce4bff7aca12f'
const FORBIDDEN_EVALUATION_KEY = /expected|groundtruth|ground_truth|goldenanswer|referenceanswer|rubriclabel/iu

function option(name) {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? ''
}

async function exists(file) {
  try { await readFile(file); return true } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return false
    throw error
  }
}

async function refuseOverwrite(files) {
  for (const file of files) if (await exists(file)) throw new Error(`REFUSING_TO_OVERWRITE:${file}`)
}

async function waitForJson(file, label, timeoutMs = 20 * 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await exists(file)) return JSON.parse(await readFile(file, 'utf8'))
    await sleep(500)
  }
  throw new Error(`${label}_TIMEOUT`)
}

function assertNoEvaluationKeys(value, currentPath = '$') {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoEvaluationKeys(item, `${currentPath}[${index}]`))
  if (!value || typeof value !== 'object') return
  for (const [key, nested] of Object.entries(value)) {
    const allowedCount = key === 'expectedObservations' && Number.isInteger(nested) && nested === 16
    if (FORBIDDEN_EVALUATION_KEY.test(key) && !allowedCount) throw new Error(`R8_GENERATION_FIREWALL_FORBIDDEN_KEY:${currentPath}.${key}`)
    assertNoEvaluationKeys(nested, `${currentPath}.${key}`)
  }
}

async function main() {
  const checkpointPath = path.resolve(option('checkpoint'))
  const sourcePath = path.resolve(option('source-manifest'))
  const outputDir = path.resolve(option('output-dir'))
  const publicOutput = path.resolve(option('public-output'))
  const runId = option('run-id')
  if (![option('checkpoint'), option('source-manifest'), option('output-dir'), option('public-output'), runId].every(Boolean)) {
    throw new Error('checkpoint/source-manifest/output-dir/public-output/run-id are required')
  }
  if (!/^[a-z0-9][a-z0-9._-]{2,100}$/u.test(runId)) throw new Error('R8_REVIEW_RUN_ID_INVALID')
  const packetPath = path.join(outputDir, 'reviewer-packet.json')
  const statePath = path.join(outputDir, 'review-state.json')
  const auditPath = path.join(outputDir, 'packet-audit.json')
  const labelsPath = path.join(outputDir, 'labels-draft.json')
  const envelopePath = path.join(outputDir, 'labels-envelope.json')
  const revealPath = path.join(outputDir, 'reveal-result.json')
  const commitmentPath = path.join(outputDir, 'mapping-commitments.json')
  await refuseOverwrite([packetPath, statePath, auditPath, labelsPath, envelopePath, revealPath, commitmentPath, publicOutput])

  const [checkpointRaw, sourceRaw] = await Promise.all([readFile(checkpointPath, 'utf8'), readFile(sourcePath, 'utf8')])
  const checkpoint = JSON.parse(checkpointRaw)
  const source = JSON.parse(sourceRaw)
  if (sha256(checkpointRaw) !== FROZEN_CHECKPOINT_SHA256 || sha256(sourceRaw) !== FROZEN_SOURCE_MANIFEST_SHA256) {
    throw new Error('R8_REVIEW_FROZEN_HASH_MISMATCH')
  }
  assertNoEvaluationKeys(checkpoint)
  assertNoEvaluationKeys(source)
  if (checkpoint.gateStatus !== 'COMPLETE' || checkpoint.observations?.length !== 16 || source.screeningCases?.length !== 8) {
    throw new Error('R8_REVIEW_FROZEN_INPUT_INVALID')
  }
  const observationIds = checkpoint.observations.map((item) => item.observationId)
  const caseCounts = new Map()
  for (const observation of checkpoint.observations) caseCounts.set(observation.caseId, [...(caseCounts.get(observation.caseId) ?? []), observation])
  if (new Set(observationIds).size !== 16 || caseCounts.size !== 8
    || [...caseCounts.values()].some((items) => items.length !== 2 || new Set(items.map((item) => item.modelAlias)).size !== 2)) {
    throw new Error('R8_REVIEW_OBSERVATION_DISTRIBUTION_INVALID')
  }
  const sourceById = new Map(source.screeningCases.map((item) => [item.caseId, item]))
  const revealSecret = randomBytes(64).toString('base64url')
  const ordered = [...checkpoint.observations].sort((left, right) => sha256(`${runId}:${left.observationId}`).localeCompare(sha256(`${runId}:${right.observationId}`)))
  const separated = ordered.map((observation, index) => {
    const sourceCase = sourceById.get(observation.caseId)
    if (!sourceCase || observation.status !== 'complete') throw new Error('R8_REVIEW_OBSERVATION_INVALID')
    const raw = JSON.parse(observation.response.payload.rawOutput)
    const graph = normalizeR8FactGraphReferences(buildR8FactGraphFromCachedRaw({
      raw, sourceText: sourceCase.content, referenceTime: sourceCase.referenceTime, timezone: sourceCase.timezone,
    }))
    const candidate = planR8RecognitionResult(graph, {
      modelName: observation.response.payload.result.modelName,
      createdAt: observation.response.payload.result.createdAt,
    })
    return buildR8SeparatedPair({
      revealSecret, runId, anonymousId: `review-case-${String(index + 1).padStart(3, '0')}`,
      observationId: observation.observationId, caseId: observation.caseId, source: sourceCase,
      baseline: observation.response.payload.result, candidate,
    })
  })
  const packet = buildR8ReviewerPacket(separated.map((item) => item.reviewerPair))
  const packetSha256 = sha256(canonicalJson(packet))
  const packetCreatedAt = new Date().toISOString()
  const gatePolicySha256 = sha256(canonicalJson(R8_REVIEW_GATE_POLICY))
  const commitments = separated.map((item) => ({ caseAnonymousId: item.privateBinding.caseAnonymousId, commitment: item.privateBinding.commitment }))
  const commitmentSha256 = sha256(canonicalJson(commitments))
  await mkdir(outputDir, { recursive: true })
  await writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8')
  await writeFile(commitmentPath, `${JSON.stringify({
    schemaVersion: 'e2.9-r8-mapping-commitments-1.0.0', protocolVersion: R8_REVIEW_PROTOCOL_VERSION,
    runId, packetSha256, gatePolicySha256, commitmentSha256, commitments,
  }, null, 2)}\n`, 'utf8')
  await writeFile(statePath, `${JSON.stringify({
    schemaVersion: 'e2.9-r8-review-state-1.0.0', protocolVersion: R8_REVIEW_PROTOCOL_VERSION,
    runId, packetSha256, packetCreatedAt, checkpointSha256: sha256(checkpointRaw), sourceManifestSha256: sha256(sourceRaw),
    pairCount: packet.pairs.length, uniqueSourceCases: caseCounts.size,
    modelCalls: 0, expectedAnswersRead: false, evaluationKeyFirewallPassed: true,
    gatePolicySha256, commitmentSha256, mappingCreatedInMemory: true, mappingCommitmentPersisted: true,
    revealSecretPersisted: false,
    status: 'WAITING_FOR_INDEPENDENT_AUDIT_AND_LABELS',
  }, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ status: 'R8_REVIEW_PACKET_READY', packetPath, auditPath, labelsPath, packetSha256 }, null, 2))

  const audit = validateR8PacketAudit(await waitForJson(auditPath, 'R8_PACKET_AUDIT'), packetSha256, packet)
  if (Date.parse(audit.reviewedAt) <= Date.parse(packetCreatedAt)) throw new Error('R8_PACKET_AUDIT_CHRONOLOGY_INVALID')
  const draft = validateR8LabelsDraft(await waitForJson(labelsPath, 'R8_LABELS'), packet, packetCreatedAt)
  if (draft.reviewProcessId !== audit.reviewProcessId || Date.parse(draft.completedAt) < Date.parse(audit.reviewedAt)) {
    throw new Error('R8_REVIEWER_BINDING_OR_CHRONOLOGY_INVALID')
  }
  const labelsSha256 = sha256(canonicalJson(draft.labels))
  const envelope = {
    schemaVersion: 'e2.9-r8-path-masked-labels-envelope-1.0.0', protocolVersion: R8_REVIEW_PROTOCOL_VERSION,
    runId, packetSha256, labelsSha256, labelsCompletedAt: draft.completedAt,
    reviewerKind: draft.reviewerKind, reviewProcessId: draft.reviewProcessId, labels: draft.labels,
  }
  await writeFile(envelopePath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8')
  await sleep(1000)
  const mappings = revealR8Mappings({ revealSecret, runId, packet, privateBindings: separated.map((item) => item.privateBinding) })
  const revealedAt = new Date().toISOString()
  if (Date.parse(revealedAt) <= Date.parse(draft.completedAt)) throw new Error('R8_REVEAL_CHRONOLOGY_INVALID')
  const counts = summarizeR8Labels(draft.labels, mappings)
  const gate = evaluateR8ReviewGate(counts, packet.pairs.length)
  const result = {
    schemaVersion: R8_GATE_VERSION, protocolVersion: R8_REVIEW_PROTOCOL_VERSION, runId, evaluatedAt: new Date().toISOString(),
    inputs: { packetSha256, labelsSha256, checkpointSha256: sha256(checkpointRaw), sourceManifestSha256: sha256(sourceRaw) },
    integrity: {
      packetAudit: 'PASS', automaticCorrelatorScan: 'PASS', modelCalls: 0, expectedAnswersRead: false,
      evaluationKeyFirewallPassed: true, mappingCommitmentPersistedBeforeLabels: true,
      gatePolicySha256, commitmentSha256, labelsFrozenBeforeReveal: true,
    },
    counts, checks: gate.checks,
    status: gate.pass ? 'R8_REPLAY_ADJUDICATION_PASS' : 'R8_REPLAY_ADJUDICATION_FAIL',
    screeningRequest: gate.pass ? 'ELIGIBLE_TO_REQUEST_FRESH_SCREENING' : 'NOT_REQUESTED',
    selection: 'NOT_RUN', blind: 'NOT_CREATED', production: 'NOT_DEPLOYED',
  }
  await writeFile(revealPath, `${JSON.stringify({
    schemaVersion: 'e2.9-r8-reveal-result-1.0.0', protocolVersion: R8_REVIEW_PROTOCOL_VERSION,
    runId, packetSha256, labelsSha256, gatePolicySha256, commitmentSha256,
    labelsCompletedAt: draft.completedAt, revealedAt, mappings, counts,
  }, null, 2)}\n`, 'utf8')
  await mkdir(path.dirname(publicOutput), { recursive: true })
  await writeFile(publicOutput, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(result, null, 2))
  if (!gate.pass) process.exitCode = 2
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
