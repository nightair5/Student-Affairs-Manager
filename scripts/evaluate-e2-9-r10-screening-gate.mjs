/* global console, process */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { E2_R10_SCREENING_PROTOCOL_VERSION, E2_R10_SCREENING_RUN_LABEL } from '../cloudflare/e2-r10-screening-contract.mjs'

export const E2_R10_SCREENING_GATE_EVALUATOR_VERSION = 'e2-r10-screening-gate-evaluator-1.0.0'
const ROOT = process.cwd()
const DEFAULT_CACHE = path.join(ROOT, '.evaluation-cache', 'e2-9-r10', 'screening-protocol-1.0.0', E2_R10_SCREENING_RUN_LABEL)
const GATE_PATH = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r10', 'screening-protocol-1.0.0', 'gate-contract.json')

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

function validateLabels(labels) {
  const yesNo = new Set(['YES', 'NO', 'UNCERTAIN'])
  const preferred = new Set(['X', 'Y', 'TIE', 'INSUFFICIENT_INFORMATION'])
  if (labels.schemaVersion !== 'e2.9-r10-path-mask-labels-1.0.0'
    || typeof labels.packetId !== 'string' || !labels.packetId
    || typeof labels.reviewerId !== 'string' || labels.reviewerId.length < 3
    || labels.mappingAccessAttestation !== 'NO_MAPPING_ACCESS_BEFORE_LABEL_FREEZE'
    || Number.isNaN(new Date(labels.frozenAt).getTime())
    || labels.cases?.length !== 8) throw new Error('LABEL_ENVELOPE_INVALID')
  const aliases = new Set()
  for (const item of labels.cases) {
    if (!/^C0[1-8]$/u.test(item.caseAlias) || aliases.has(item.caseAlias) || !preferred.has(item.preferred)
      || typeof item.reason !== 'string' || !item.reason.trim()) throw new Error(`LABEL_CASE_INVALID:${item.caseAlias ?? 'UNKNOWN'}`)
    aliases.add(item.caseAlias)
    for (const side of ['X', 'Y']) {
      const value = item.options?.[side]
      if (!value || !['userImpactMajor', 'factMissing', 'planningError', 'overFragmented', 'unsupportedFact', 'evidenceAdequate']
        .every((key) => yesNo.has(value[key]))) throw new Error(`LABEL_OPTION_INVALID:${item.caseAlias}:${side}`)
    }
  }
}

async function freezeLabels(labelsPath, envelopePath) {
  const { raw, value } = await readJson(labelsPath)
  validateLabels(value)
  const envelope = {
    schemaVersion: 'e2.9-r10-path-mask-label-envelope-1.0.0',
    protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
    runLabel: E2_R10_SCREENING_RUN_LABEL,
    packetId: value.packetId,
    reviewerId: value.reviewerId,
    mappingAccessAttestation: value.mappingAccessAttestation,
    labelsSha256: sha256(raw),
    frozenAt: value.frozenAt,
    revealAuthorized: true,
  }
  await writeCreateOnce(envelopePath, envelope)
  console.log(JSON.stringify({ status: 'LABELS_FROZEN_REVEAL_AUTHORIZED', envelopePath, envelopeSha256: sha256(await readFile(envelopePath)) }, null, 2))
}

function rate(rows, field) {
  const determinate = rows.filter((item) => item[field] !== 'UNCERTAIN')
  return determinate.length ? determinate.filter((item) => item[field] === 'YES').length / determinate.length : null
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

async function revealAndGate({ labelsPath, envelopePath, revealPath, aggregatePath, outputPath }) {
  const [{ raw: labelsRaw, value: labels }, { value: envelope }, { value: reveal }, { value: aggregate }, { raw: gateRaw, value: gate }] = await Promise.all([
    readJson(labelsPath), readJson(envelopePath), readJson(revealPath), readJson(aggregatePath), readJson(GATE_PATH),
  ])
  validateLabels(labels)
  if (envelope.schemaVersion !== 'e2.9-r10-path-mask-label-envelope-1.0.0'
    || envelope.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION || envelope.runLabel !== E2_R10_SCREENING_RUN_LABEL
    || envelope.packetId !== labels.packetId || envelope.labelsSha256 !== sha256(labelsRaw)
    || envelope.revealAuthorized !== true || reveal.packetId !== labels.packetId || reveal.revealAuthorized !== false) throw new Error('REVEAL_PREREQUISITE_FAILED')
  if (aggregate.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION || aggregate.runLabel !== E2_R10_SCREENING_RUN_LABEL
    || !aggregate.arms?.A?.strict || !aggregate.arms?.B?.strict) throw new Error('STRICT_AGGREGATE_INVALID')
  if (gate.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION || gate.status !== 'FROZEN_BEFORE_MODEL_CALLS') throw new Error('FROZEN_GATE_INVALID')
  const review = perArmReview(labels, reveal)
  const a = aggregate.arms.A.strict
  const b = aggregate.arms.B.strict
  const userImpactDelta = review.arms.B.userImpactMajorRate === null || review.arms.A.userImpactMajorRate === null
    ? null : review.arms.B.userImpactMajorRate - review.arms.A.userImpactMajorRate
  const checks = {
    integrity: true,
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
    schemaVersion: 'e2.9-r10-screening-gate-result-1.0.0',
    protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
    gateEvaluatorVersion: E2_R10_SCREENING_GATE_EVALUATOR_VERSION,
    runLabel: E2_R10_SCREENING_RUN_LABEL,
    bindings: {
      labelsSha256: sha256(labelsRaw),
      envelopeSha256: sha256(await readFile(envelopePath)),
      strictAggregateSha256: sha256(await readFile(aggregatePath)),
      frozenGateSha256: sha256(gateRaw),
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
      reviewedFactMissingRate: review.arms.B.factMissingRate - review.arms.A.factMissingRate,
      reviewedPlanningErrorRate: review.arms.B.planningErrorRate - review.arms.A.planningErrorRate,
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
  const labelsPath = path.resolve(option('labels', path.join(DEFAULT_CACHE, 'path-masked', 'labels-draft.json')))
  const envelopePath = path.resolve(option('envelope', path.join(DEFAULT_CACHE, 'path-masked', 'labels-envelope.json')))
  if (phase === 'freeze-labels') return freezeLabels(labelsPath, envelopePath)
  if (phase !== 'reveal-gate') throw new Error('ONLY_FREEZE_LABELS_OR_REVEAL_GATE_ALLOWED')
  return revealAndGate({
    labelsPath,
    envelopePath,
    revealPath: path.resolve(option('reveal-key', path.join(DEFAULT_CACHE, 'path-masked', 'reveal-key.json'))),
    aggregatePath: path.resolve(option('aggregate', path.join(DEFAULT_CACHE, 'anonymous-aggregate.json'))),
    outputPath: path.resolve(option('output', path.join(DEFAULT_CACHE, 'screening-gate-result.json'))),
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
