/* global console, process */
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonicalJson } from './e2-9-r6-path-mask.mjs'
import {
  buildR9ReviewerPacket, buildR9SeparatedPair, evaluateR9ReviewGate,
  revealR9Mappings, R9_GATE_POLICY_CANONICAL_SHA256, R9_GATE_PREREG_CANONICAL_SHA256,
  R9_GATE_VERSION, R9_LABELS_DRAFT_VERSION, R9_REVIEW_GATE_POLICY, R9_REVIEW_PROTOCOL_VERSION,
  scanR9ReviewerCorrelators, sha256, summarizeR9Labels, validateR9LabelsDraft, validateR9PacketAudit,
} from './e2-9-r9-path-mask.mjs'

const FROZEN_CHECKPOINT_SHA256 = '0886afb941eeb74d80d9ed35601ee50447c0e4b464310ac197fd39df006fa336'
const FROZEN_SOURCE_MANIFEST_SHA256 = '115b43f98d0ca56cac522d0272ed10894fa0cc2a185562d0c10ce4bff7aca12f'

function option(name) {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? ''
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
}

async function refuseOverwrite(file) {
  try {
    await readFile(file)
    throw new Error(`REFUSING_TO_OVERWRITE:${file}`)
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
}

async function waitForJson(file, label) {
  for (;;) {
    try {
      return JSON.parse(await readFile(file, 'utf8'))
    } catch (error) {
      if (!(error && typeof error === 'object' && error.code === 'ENOENT')) throw error
      console.log(JSON.stringify({ status: `WAITING_FOR_${label}`, file }))
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
}

function scanEvaluationKeys(value, currentPath = '$', findings = []) {
  if (Array.isArray(value)) value.forEach((item, index) => scanEvaluationKeys(item, `${currentPath}[${index}]`, findings))
  else if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (/^(?:expected|expectedanswer|expectedanswers|goldenanswer|strictscore|score)$/iu.test(key)) findings.push(`${currentPath}.${key}`)
      scanEvaluationKeys(nested, `${currentPath}.${key}`, findings)
    }
  }
  return findings
}

function assertFrozenInputShape(checkpoint, source, candidate) {
  if (checkpoint.gateStatus !== 'COMPLETE' || checkpoint.observations?.length !== 16 || source.screeningCases?.length !== 8
    || candidate.generationStage !== 'FROZEN_BEFORE_SCORING' || candidate.observations?.length !== 16
    || candidate.modelCalls !== 0 || candidate.networkRequests !== 0 || candidate.expectedAnswersRead !== false) throw new Error('R9_REVIEW_FROZEN_INPUT_INVALID')
  const baselineIds = checkpoint.observations.map((item) => item.observationId).sort()
  const candidateIds = candidate.observations.map((item) => item.observationId).sort()
  if (new Set(candidateIds).size !== 16 || JSON.stringify(baselineIds) !== JSON.stringify(candidateIds)) throw new Error('R9_REVIEW_OBSERVATION_BINDING_INVALID')
  const sourceCounts = new Map()
  checkpoint.observations.forEach((item) => sourceCounts.set(item.caseId, (sourceCounts.get(item.caseId) ?? 0) + 1))
  if (sourceCounts.size !== 8 || [...sourceCounts.values()].some((value) => value !== 2)) throw new Error('R9_REVIEW_SOURCE_PAIRING_INVALID')
}

async function main() {
  const checkpointPath = path.resolve(option('checkpoint'))
  const sourcePath = path.resolve(option('source-manifest'))
  const candidatePath = path.resolve(option('candidate-checkpoint'))
  const replayPath = path.resolve(option('replay-public'))
  const preregPath = path.resolve(option('gate-preregistration'))
  const outputDir = path.resolve(option('output-dir'))
  const publicOutput = path.resolve(option('public-output'))
  const runId = option('run-id')
  if (![option('checkpoint'), option('source-manifest'), option('candidate-checkpoint'), option('replay-public'), option('gate-preregistration'), option('output-dir'), option('public-output'), runId].every(Boolean)) {
    throw new Error('R9_REVIEW_OPTIONS_REQUIRED')
  }
  const paths = {
    packet: path.join(outputDir, 'reviewer-packet.json'), commitments: path.join(outputDir, 'mapping-commitments.json'),
    state: path.join(outputDir, 'review-state.json'), audit: path.join(outputDir, 'packet-audit.json'),
    labelsDraft: path.join(outputDir, 'labels-draft.json'), labelsEnvelope: path.join(outputDir, 'labels-envelope.json'),
    reveal: path.join(outputDir, 'reveal-result.json'),
  }
  await Promise.all([refuseOverwrite(publicOutput), ...Object.values(paths).map(refuseOverwrite)])
  const [checkpointRaw, sourceRaw, candidateRaw, replayRaw, preregRaw] = await Promise.all([
    readFile(checkpointPath, 'utf8'), readFile(sourcePath, 'utf8'), readFile(candidatePath, 'utf8'),
    readFile(replayPath, 'utf8'), readFile(preregPath, 'utf8'),
  ])
  if (sha256(checkpointRaw) !== FROZEN_CHECKPOINT_SHA256 || sha256(sourceRaw) !== FROZEN_SOURCE_MANIFEST_SHA256) throw new Error('R9_REVIEW_FROZEN_INPUT_HASH_MISMATCH')
  const checkpoint = JSON.parse(checkpointRaw)
  const source = JSON.parse(sourceRaw)
  const candidate = JSON.parse(candidateRaw)
  const replay = JSON.parse(replayRaw)
  const prereg = JSON.parse(preregRaw)
  if (sha256(canonicalJson(prereg)) !== R9_GATE_PREREG_CANONICAL_SHA256
    || sha256(canonicalJson(prereg.gate)) !== R9_GATE_POLICY_CANONICAL_SHA256
    || canonicalJson(prereg.gate) !== canonicalJson(R9_REVIEW_GATE_POLICY)) throw new Error('R9_GATE_PREREGISTRATION_DRIFT')
  if (candidate.inputs.checkpointSha256 !== FROZEN_CHECKPOINT_SHA256 || candidate.inputs.sourceManifestSha256 !== FROZEN_SOURCE_MANIFEST_SHA256
    || replay.inputs.candidateCheckpointSha256 !== sha256(canonicalJson(candidate)) || !Object.values(replay.checks).every(Boolean)) throw new Error('R9_REVIEW_REPLAY_BINDING_INVALID')
  const evaluationKeyFindings = [...scanEvaluationKeys(checkpoint), ...scanEvaluationKeys(source), ...scanEvaluationKeys(candidate)]
  if (evaluationKeyFindings.length) throw new Error(`R9_REVIEW_EXPECTED_FIREWALL:${evaluationKeyFindings.join(',')}`)
  assertFrozenInputShape(checkpoint, source, candidate)
  const sourceById = new Map(source.screeningCases.map((item) => [item.caseId, item]))
  const baselineById = new Map(checkpoint.observations.map((item) => [item.observationId, item]))
  const revealSecret = randomBytes(64).toString('base64url')
  const ordered = [...candidate.observations].sort((left, right) => sha256(`${runId}:${left.observationId}`).localeCompare(sha256(`${runId}:${right.observationId}`)))
  const separated = ordered.map((observation, index) => {
    const baseline = baselineById.get(observation.observationId)
    const sourceCase = sourceById.get(observation.caseId)
    if (!baseline || !sourceCase || baseline.caseId !== observation.caseId || sha256(canonicalJson(observation.result)) !== observation.resultSha256) {
      throw new Error('R9_REVIEW_CANDIDATE_BINDING_INVALID')
    }
    return buildR9SeparatedPair({
      revealSecret, runId, anonymousId: `review-case-${String(index + 1).padStart(3, '0')}`,
      observationId: observation.observationId, caseId: observation.caseId, source: sourceCase,
      baseline: baseline.response.payload.result, candidate: observation.result,
    })
  })
  const packet = buildR9ReviewerPacket(separated.map((item) => item.reviewerPair))
  if (scanR9ReviewerCorrelators(packet).length) throw new Error('R9_REVIEW_AUTOMATIC_CORRELATOR_SCAN_FAILED')
  const packetSha256 = sha256(canonicalJson(packet))
  const packetCreatedAt = new Date().toISOString()
  const commitments = separated.map((item) => ({ caseAnonymousId: item.privateBinding.caseAnonymousId, commitment: item.privateBinding.commitment }))
  const commitmentSha256 = sha256(canonicalJson(commitments))
  await mkdir(outputDir, { recursive: true })
  await Promise.all([
    writeFile(paths.packet, `${JSON.stringify(packet, null, 2)}\n`, 'utf8'),
    writeFile(paths.commitments, `${JSON.stringify({
      schemaVersion: 'e2.9-r9-mapping-commitments-1.0.0', protocolVersion: R9_REVIEW_PROTOCOL_VERSION,
      runId, packetSha256, gatePreregistrationSha256: R9_GATE_PREREG_CANONICAL_SHA256,
      gatePolicySha256: R9_GATE_POLICY_CANONICAL_SHA256, commitmentSha256, commitments,
    }, null, 2)}\n`, 'utf8'),
    writeFile(paths.state, `${JSON.stringify({
      schemaVersion: 'e2.9-r9-review-state-1.0.0', protocolVersion: R9_REVIEW_PROTOCOL_VERSION,
      runId, status: 'WAITING_FOR_INDEPENDENT_AUDIT_AND_LABELS', packetSha256, packetCreatedAt,
      checkpointSha256: sha256(checkpointRaw), sourceManifestSha256: sha256(sourceRaw),
      candidateCheckpointSha256: sha256(canonicalJson(candidate)), replayPublicSha256: sha256(canonicalJson(replay)),
      gatePreregistrationSha256: R9_GATE_PREREG_CANONICAL_SHA256, gatePolicySha256: R9_GATE_POLICY_CANONICAL_SHA256,
      pairCount: packet.pairs.length, uniqueSourceCases: 8, modelCalls: 0,
      modelCallScope: 'no new production recognition or generation calls', expectedAnswersRead: false,
      evaluationKeyFirewallPassed: true, automaticCorrelatorScanPassed: true,
      mappingCreatedInMemory: true, mappingCommitmentPersisted: true, revealSecretPersisted: false,
    }, null, 2)}\n`, 'utf8'),
  ])
  console.log(JSON.stringify({ status: 'R9_REVIEW_PACKET_READY', runId, packetPath: paths.packet, auditPath: paths.audit, labelsPath: paths.labelsDraft, packetSha256 }, null, 2))

  const audit = validateR9PacketAudit(await waitForJson(paths.audit, 'R9_PACKET_AUDIT'), packetSha256, packet)
  if (Date.parse(audit.reviewedAt) <= Date.parse(packetCreatedAt)) throw new Error('R9_PACKET_AUDIT_CHRONOLOGY_INVALID')
  const draft = validateR9LabelsDraft(await waitForJson(paths.labelsDraft, 'R9_LABELS'), packet, packetCreatedAt)
  if (draft.reviewProcessId !== audit.reviewProcessId || Date.parse(draft.completedAt) < Date.parse(audit.reviewedAt)) throw new Error('R9_REVIEWER_BINDING_OR_CHRONOLOGY_INVALID')
  const labelsSha256 = sha256(canonicalJson(draft.labels))
  await writeFile(paths.labelsEnvelope, `${JSON.stringify({
    schemaVersion: 'e2.9-r9-path-masked-labels-envelope-1.0.0', protocolVersion: R9_REVIEW_PROTOCOL_VERSION,
    runId, packetSha256, labelsSha256, labelsCompletedAt: draft.completedAt,
    reviewerKind: draft.reviewerKind, reviewProcessId: draft.reviewProcessId, labels: draft.labels,
  }, null, 2)}\n`, 'utf8')
  const mappings = revealR9Mappings({ revealSecret, runId, packet, privateBindings: separated.map((item) => item.privateBinding) })
  const revealedAt = new Date().toISOString()
  if (Date.parse(revealedAt) <= Date.parse(draft.completedAt)) throw new Error('R9_REVEAL_CHRONOLOGY_INVALID')
  const counts = summarizeR9Labels(draft.labels, mappings)
  const gate = evaluateR9ReviewGate(counts, packet.pairs.length)
  const status = gate.pass ? 'R9_REPLAY_GATE_PASS_SCREENING_REQUESTABLE' : 'R9_REPLAY_GATE_FAIL'
  await writeFile(paths.reveal, `${JSON.stringify({
    schemaVersion: 'e2.9-r9-reveal-result-1.0.0', protocolVersion: R9_REVIEW_PROTOCOL_VERSION,
    runId, packetSha256, labelsSha256, gatePolicySha256: R9_GATE_POLICY_CANONICAL_SHA256,
    commitmentSha256, labelsCompletedAt: draft.completedAt, revealedAt, mappings, counts,
  }, null, 2)}\n`, 'utf8')
  const publicResult = {
    schemaVersion: R9_GATE_VERSION, protocolVersion: R9_REVIEW_PROTOCOL_VERSION, runId, evaluatedAt: new Date().toISOString(),
    inputs: {
      packetSha256, labelsSha256, checkpointSha256: sha256(checkpointRaw), sourceManifestSha256: sha256(sourceRaw),
      candidateCheckpointSha256: sha256(canonicalJson(candidate)), replayPublicSha256: sha256(canonicalJson(replay)),
      gatePreregistrationSha256: R9_GATE_PREREG_CANONICAL_SHA256, gatePolicySha256: R9_GATE_POLICY_CANONICAL_SHA256,
    },
    integrity: {
      packetAudit: 'PASS', automaticCorrelatorScan: 'PASS', productionRecognitionGenerationCalls: 0,
      expectedAnswersReadByReview: false, evaluationKeyFirewallPassed: true,
      mappingCommitmentPersistedBeforeLabels: true, labelsFrozenBeforeReveal: true,
      reviewerClass: 'same-family LLM-as-judge provisional unless independently replaced by a human reviewer',
    },
    counts, checks: gate.checks, status,
    screeningRequest: gate.pass ? 'REQUESTABLE_NOT_RUN' : 'NOT_REQUESTED',
    selection: 'NOT_RUN', blind: 'NOT_CREATED', production: 'NOT_DEPLOYED',
  }
  await mkdir(path.dirname(publicOutput), { recursive: true })
  await writeFile(publicOutput, `${JSON.stringify(publicResult, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(publicResult, null, 2))
  if (!gate.pass) process.exitCode = 2
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
