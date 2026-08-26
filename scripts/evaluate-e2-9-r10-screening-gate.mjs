/* global console, process */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { E2_R10_SCREENING_PROTOCOL_VERSION, E2_R10_SCREENING_RUN_LABEL, canonicalJson } from '../cloudflare/e2-r10-screening-contract.mjs'
import { auditMaskedPacket, compactResult } from './prepare-e2-9-r10-path-masked-review.mjs'
import { E2_R10_SCREENING_SCORER_VERSION, loadAndAssertR10ScoringEvidence } from './score-e2-9-r10-screening.mjs'

export const E2_R10_SCREENING_GATE_EVALUATOR_VERSION = 'e2-r10-screening-gate-evaluator-1.1.0'
const ROOT = process.cwd()
const PROTOCOL_DIR = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r10', 'screening-protocol-1.1.0')
const DEFAULT_CACHE = path.join(ROOT, '.evaluation-cache', 'e2-9-r10', 'screening-protocol-1.1.0', E2_R10_SCREENING_RUN_LABEL)
const GATE_PATH = path.join(PROTOCOL_DIR, 'gate-contract.json')
const SOURCE_INPUT_PATH = path.join(PROTOCOL_DIR, 'source-input-manifest.json')

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function readJson(file) {
  const raw = await readFile(file, 'utf8')
  return { raw, value: JSON.parse(raw) }
}

async function writeCreateOnce(file, value) {
  try {
    await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'EEXIST') throw new Error(`REFUSING_TO_OVERWRITE:${file}`)
    throw error
  }
}

export function validateLabels(labels) {
  const yesNo = new Set(['YES', 'NO', 'UNCERTAIN'])
  const preferred = new Set(['X', 'Y', 'TIE', 'INSUFFICIENT_INFORMATION'])
  const parsedFrozenAt = typeof labels.frozenAt === 'string' ? new Date(labels.frozenAt) : null
  if (labels.schemaVersion !== 'paired-notice-review-labels-1.1.0'
    || typeof labels.packetId !== 'string' || !labels.packetId
    || !/^[a-f0-9]{64}$/u.test(labels.packetSha256 ?? '')
    || !/^[a-f0-9]{64}$/u.test(labels.mappingCommitmentSha256 ?? '')
    || typeof labels.reviewerId !== 'string' || labels.reviewerId.length < 3
    || labels.mappingAccessAttestation !== 'NO_MAPPING_ACCESS_BEFORE_LABEL_FREEZE'
    || !parsedFrozenAt || Number.isNaN(parsedFrozenAt.getTime()) || parsedFrozenAt.toISOString() !== labels.frozenAt
    || labels.cases?.length !== 8) throw new Error('LABEL_ENVELOPE_INVALID')
  const aliases = new Set()
  for (const item of labels.cases) {
    if (Object.keys(item).sort().join(',') !== 'caseAlias,options,preferred,reason'
      || !/^C0[1-8]$/u.test(item.caseAlias) || aliases.has(item.caseAlias) || !preferred.has(item.preferred)
      || typeof item.reason !== 'string' || !item.reason.trim()) throw new Error(`LABEL_CASE_INVALID:${item.caseAlias ?? 'UNKNOWN'}`)
    aliases.add(item.caseAlias)
    for (const side of ['X', 'Y']) {
      const value = item.options?.[side]
      const keys = ['evidenceAdequate', 'factMissing', 'overFragmented', 'planningError', 'unsupportedFact', 'userImpactMajor']
      if (!value || Object.keys(value).sort().join(',') !== keys.join(',')
        || !keys.every((key) => yesNo.has(value[key]))) throw new Error(`LABEL_OPTION_INVALID:${item.caseAlias}:${side}`)
    }
  }
}

async function freezeLabels() {
  const labelsPath = path.join(DEFAULT_CACHE, 'path-masked', 'labels-draft.json')
  const envelopePath = path.join(DEFAULT_CACHE, 'path-masked', 'labels-envelope.json')
  const packetPath = path.join(DEFAULT_CACHE, 'path-masked', 'reviewer-packet.json')
  const auditPath = path.join(DEFAULT_CACHE, 'path-masked', 'packet-audit.json')
  const [{ raw: labelsRaw, value: labels }, { raw: packetRaw, value: packet }, { raw: auditRaw, value: audit }] = await Promise.all([
    readJson(labelsPath), readJson(packetPath), readJson(auditPath),
  ])
  validateLabels(labels)
  const packetAudit = auditMaskedPacket(packet)
  if (packetAudit.status !== 'PASS' || audit.status !== 'PASS' || audit.findings?.length !== 0
    || audit.packetSha256 !== sha256(packetRaw) || labels.packetSha256 !== sha256(packetRaw)
    || labels.packetId !== packet.packetId
    || labels.mappingCommitmentSha256 !== packet.mappingCommitmentSha256
    || audit.mappingCommitmentSha256 !== packet.mappingCommitmentSha256) throw new Error('PACKET_AUDIT_PREREQUISITE_FAILED')
  const envelope = {
    schemaVersion: 'paired-notice-review-label-envelope-1.1.0',
    protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
    runLabel: E2_R10_SCREENING_RUN_LABEL,
    packetId: labels.packetId,
    packetSha256: sha256(packetRaw),
    packetAuditSha256: sha256(auditRaw),
    mappingCommitmentSha256: packet.mappingCommitmentSha256,
    reviewerId: labels.reviewerId,
    mappingAccessAttestation: labels.mappingAccessAttestation,
    labelsSha256: sha256(labelsRaw),
    frozenAt: labels.frozenAt,
    revealAuthorized: true,
  }
  await writeCreateOnce(envelopePath, envelope)
  console.log(JSON.stringify({ status: 'LABELS_FROZEN_REVEAL_AUTHORIZED', envelopePath, envelopeSha256: sha256(await readFile(envelopePath)) }, null, 2))
}

function rate(rows, field) {
  const determinate = rows.filter((item) => item[field] !== 'UNCERTAIN')
  return determinate.length ? determinate.filter((item) => item[field] === 'YES').length / determinate.length : null
}

function nullableDelta(after, before) {
  return after === null || before === null ? null : after - before
}

function perArmReview(labels, reveal) {
  const rows = { A: [], B: [] }
  const wins = { A: 0, B: 0, ties: 0, insufficient: 0 }
  for (const item of labels.cases) {
    const mapping = reveal.mapping[item.caseAlias]
    if (!mapping || !['A', 'B'].includes(mapping.X) || !['A', 'B'].includes(mapping.Y) || mapping.X === mapping.Y) throw new Error(`REVEAL_MAPPING_INVALID:${item.caseAlias}`)
    rows[mapping.X].push(item.options.X)
    rows[mapping.Y].push(item.options.Y)
    if (item.preferred === 'X') wins[mapping.X] += 1
    else if (item.preferred === 'Y') wins[mapping.Y] += 1
    else if (item.preferred === 'TIE') wins.ties += 1
    else wins.insufficient += 1
  }
  const summarize = (arm) => ({
    userImpactMajorRate: rate(rows[arm], 'userImpactMajor'),
    factMissingRate: rate(rows[arm], 'factMissing'),
    planningErrorRate: rate(rows[arm], 'planningError'),
    overFragmentedRate: rate(rows[arm], 'overFragmented'),
    unsupportedFactRate: rate(rows[arm], 'unsupportedFact'),
    evidenceInadequateRate: rate(rows[arm], 'evidenceAdequate') === null ? null : 1 - rate(rows[arm], 'evidenceAdequate'),
    wins: wins[arm],
  })
  return { arms: { A: summarize('A'), B: summarize('B') }, ties: wins.ties, insufficient: wins.insufficient }
}

export function strictArmValid(value) {
  const metrics = ['taskPrecision', 'taskRecall', 'evidenceCoverage', 'severeErrorRate', 'planningErrorRate']
  return value && metrics.every((key) => Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= 1)
}

async function revealAndGate() {
  const labelsPath = path.join(DEFAULT_CACHE, 'path-masked', 'labels-draft.json')
  const envelopePath = path.join(DEFAULT_CACHE, 'path-masked', 'labels-envelope.json')
  const revealPath = path.join(DEFAULT_CACHE, 'path-masked', 'reveal-key.json')
  const packetPath = path.join(DEFAULT_CACHE, 'path-masked', 'reviewer-packet.json')
  const auditPath = path.join(DEFAULT_CACHE, 'path-masked', 'packet-audit.json')
  const aggregatePath = path.join(DEFAULT_CACHE, 'anonymous-aggregate.json')
  const strictScoresPath = path.join(DEFAULT_CACHE, 'strict-scores.json')
  const outputPath = path.join(DEFAULT_CACHE, 'screening-gate-result.json')
  const evidence = await loadAndAssertR10ScoringEvidence()
  const [{ raw: labelsRaw, value: labels }, { raw: envelopeRaw, value: envelope },
    { value: reveal }, { raw: packetRaw, value: packet }, { raw: auditRaw, value: audit },
    { raw: aggregateRaw, value: aggregate }, { raw: strictScoresRaw, value: strictScores },
    { raw: gateRaw, value: gate }, { value: sourceInput }] = await Promise.all([
    readJson(labelsPath), readJson(envelopePath), readJson(revealPath), readJson(packetPath), readJson(auditPath),
    readJson(aggregatePath), readJson(strictScoresPath), readJson(GATE_PATH), readJson(SOURCE_INPUT_PATH),
  ])
  validateLabels(labels)
  if (auditMaskedPacket(packet).status !== 'PASS' || audit.status !== 'PASS' || audit.findings?.length !== 0
    || audit.packetSha256 !== sha256(packetRaw) || audit.mappingCommitmentSha256 !== packet.mappingCommitmentSha256
    || envelope.schemaVersion !== 'paired-notice-review-label-envelope-1.1.0'
    || envelope.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION || envelope.runLabel !== E2_R10_SCREENING_RUN_LABEL
    || envelope.packetId !== labels.packetId || envelope.packetSha256 !== sha256(packetRaw)
    || envelope.packetAuditSha256 !== sha256(auditRaw) || envelope.labelsSha256 !== sha256(labelsRaw)
    || envelope.mappingCommitmentSha256 !== packet.mappingCommitmentSha256
    || envelope.revealAuthorized !== true || reveal.packetId !== labels.packetId || reveal.revealAuthorized !== false
    || reveal.schemaVersion !== 'paired-notice-review-reveal-key-1.1.0'
    || reveal.mappingCommitmentSha256 !== packet.mappingCommitmentSha256
    || sha256(canonicalJson({ packetId: reveal.packetId, mapping: reveal.mapping, mappingSalt: reveal.mappingSalt }))
      !== reveal.mappingCommitmentSha256) throw new Error('REVEAL_PREREQUISITE_FAILED')
  const outputByCaseArm = new Map(evidence.checkpoint.observations
    .map((item) => [`${item.caseId}:${item.arm}`, item.response.payload.result]))
  const sourceById = new Map(sourceInput.cases.map((item) => [item.caseId, item]))
  const expectedCases = evidence.manifest.cases.map((item, index) => {
    const caseAlias = `C${String(index + 1).padStart(2, '0')}`
    const mapping = reveal.mapping[caseAlias]
    const source = sourceById.get(item.caseId)
    if (!mapping || mapping.caseId !== item.caseId || !source) throw new Error(`REVEAL_CASE_BINDING_FAILED:${caseAlias}`)
    return {
      caseAlias,
      source: { sourceType: source.sourceType, sourceTitle: source.sourceTitle, content: source.content, referenceTime: source.referenceTime, timezone: source.timezone },
      options: {
        X: compactResult(outputByCaseArm.get(`${item.caseId}:${mapping.X}`)),
        Y: compactResult(outputByCaseArm.get(`${item.caseId}:${mapping.Y}`)),
      },
    }
  })
  if (canonicalJson(packet.cases) !== canonicalJson(expectedCases)) throw new Error('MASKED_PACKET_CONTENT_BINDING_FAILED')
  if (aggregate.schemaVersion !== 'e2.9-r10-screening-anonymous-aggregate-1.1.0'
    || aggregate.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION || aggregate.runLabel !== E2_R10_SCREENING_RUN_LABEL
    || aggregate.scorerVersion !== E2_R10_SCREENING_SCORER_VERSION
    || aggregate.bindings?.strictScoresSha256 !== sha256(strictScoresRaw)
    || strictScores.schemaVersion !== 'e2.9-r10-screening-strict-scores-1.1.0'
    || strictScores.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION
    || strictScores.scorerVersion !== E2_R10_SCREENING_SCORER_VERSION
    || canonicalJson(strictScores.arms) !== canonicalJson(aggregate.arms)
    || Object.entries(evidence.bindings).some(([key, value]) => aggregate.bindings?.[key] !== value)
    || aggregate.arms?.A?.sampleCount !== 8 || aggregate.arms?.B?.sampleCount !== 8
    || aggregate.arms?.A?.completedCount !== 8 || aggregate.arms?.B?.completedCount !== 8
    || !strictArmValid(aggregate.arms?.A?.strict) || !strictArmValid(aggregate.arms?.B?.strict)) throw new Error('STRICT_AGGREGATE_INVALID')
  if (gate.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION || gate.status !== 'FROZEN_BEFORE_MODEL_CALLS'
    || sha256(gateRaw.replace(/\r\n?/gu, '\n')) !== evidence.bundle.bindings.gateContractCanonicalTextSha256) {
    throw new Error('FROZEN_GATE_INVALID')
  }
  const review = perArmReview(labels, reveal)
  const a = aggregate.arms.A.strict
  const b = aggregate.arms.B.strict
  const userImpactDelta = review.arms.B.userImpactMajorRate === null || review.arms.A.userImpactMajorRate === null
    ? null : review.arms.B.userImpactMajorRate - review.arms.A.userImpactMajorRate
  const checks = {
    integrity: audit.status === 'PASS'
      && envelope.packetSha256 === sha256(packetRaw)
      && aggregate.bindings.checkpointSha256 === evidence.bindings.checkpointSha256,
    taskRecallOrUserImpactMajor: (b.taskRecall - a.taskRecall >= 0.08) || (userImpactDelta !== null && userImpactDelta <= -0.15),
    taskPrecisionDeclineAtMost3pp: b.taskPrecision - a.taskPrecision >= -0.03,
    evidenceCoverageAtLeast95Percent: b.evidenceCoverage >= 0.95,
    severeErrorNotIncreased: b.severeErrorRate <= a.severeErrorRate,
    strictPlanningErrorDecreased: b.planningErrorRate < a.planningErrorRate,
    reviewedPlanningErrorDecreased: review.arms.B.planningErrorRate !== null && review.arms.A.planningErrorRate !== null
      && review.arms.B.planningErrorRate < review.arms.A.planningErrorRate,
    factLossNotIncreased: review.arms.B.factMissingRate !== null && review.arms.A.factMissingRate !== null
      && review.arms.B.factMissingRate <= review.arms.A.factMissingRate,
  }
  const pass = Object.values(checks).every(Boolean)
  const result = {
    schemaVersion: 'e2.9-r10-screening-gate-result-1.1.0',
    protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
    gateEvaluatorVersion: E2_R10_SCREENING_GATE_EVALUATOR_VERSION,
    runLabel: E2_R10_SCREENING_RUN_LABEL,
    bindings: {
      labelsSha256: sha256(labelsRaw),
      envelopeSha256: sha256(envelopeRaw),
      packetSha256: sha256(packetRaw),
      packetAuditSha256: sha256(auditRaw),
      revealCommitmentSha256: reveal.mappingCommitmentSha256,
      strictScoresSha256: sha256(strictScoresRaw),
      strictAggregateSha256: sha256(aggregateRaw),
      frozenGateSha256: sha256(gateRaw.replace(/\r\n?/gu, '\n')),
      ...evidence.bindings,
    },
    review,
    strict: { A: a, B: b },
    deltas: {
      taskRecall: b.taskRecall - a.taskRecall,
      taskPrecision: b.taskPrecision - a.taskPrecision,
      evidenceCoverage: b.evidenceCoverage - a.evidenceCoverage,
      severeErrorRate: b.severeErrorRate - a.severeErrorRate,
      strictPlanningErrorRate: b.planningErrorRate - a.planningErrorRate,
      userImpactMajorRate: userImpactDelta,
      reviewedFactMissingRate: nullableDelta(review.arms.B.factMissingRate, review.arms.A.factMissingRate),
      reviewedPlanningErrorRate: nullableDelta(review.arms.B.planningErrorRate, review.arms.A.planningErrorRate),
    },
    checks,
    status: pass ? 'SCREENING_GATE_PASS' : 'SCREENING_GATE_FAIL',
    conclusion: pass ? 'FACTLEDGER_SCREENING_SUPPORTED' : 'FACTLEDGER_SCREENING_NOT_SUPPORTED',
    selectionAuthorized: false,
    blindAuthorized: false,
    productionAuthorized: false,
    requiredNextAction: pass
      ? 'STOP and request separate Selection authorization.'
      : 'STOP. Do not run Selection, create Blind or deploy Production.',
  }
  await writeCreateOnce(outputPath, result)
  console.log(JSON.stringify({ status: result.status, outputPath, outputSha256: sha256(await readFile(outputPath)), checks }, null, 2))
  if (!pass) process.exitCode = 2
}

async function main() {
  const phase = option('phase')
  if (phase === 'freeze-labels') return freezeLabels()
  if (phase !== 'reveal-gate') throw new Error('ONLY_FREEZE_LABELS_OR_REVEAL_GATE_ALLOWED')
  return revealAndGate()
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
