import { createHash } from 'node:crypto'
import { readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { BATCH, SNAPSHOT, verifySnapshot, createLiveHost, safeCode } from './d26-execution-host.mjs'

const HOST_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGE = 'docs/recognition-optimization/d26-correction'
const digest = value => createHash('sha256').update(value).digest('hex')
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const check = (value, code) => { if (!value) throw Error('D26_REPORT_' + code) }
const humanMetrics = Object.freeze({ firstWholeSuggestionCorrect: 'NOT_OBSERVABLE', finalCorrectDisposition: 'NOT_OBSERVABLE',
  lowEditCorrectDisposition: 'NOT_OBSERVABLE', activeEditingTime: 'NOT_OBSERVABLE' })

function frozenDenominators(units, sources) {
  check(units.length === 16 && sources.length === 8 && new Set(sources.map(row => row.sourceId)).size === 8, 'FIXED_DENOMINATOR')
  check(new Set(units.map(row => row.unitIdentitySha256)).size === 16 && new Set(units.map(row => row.requestSha256)).size === 16, 'DUPLICATE_UNIT')
  for (const [index, unit] of units.entries()) check(unit.ordinal === index + 1
    && ['A', 'B'].includes(unit.arm) && unit.candidate === (unit.arm === 'A' ? 'Candidate17' : 'Candidate18'), 'UNIT_ORDER_OR_ARM')
  for (const source of sources) check(units.filter(row => row.sourceId === source.sourceId && row.arm === 'A').length === 1
    && units.filter(row => row.sourceId === source.sourceId && row.arm === 'B').length === 1, 'SOURCE_PAIR')
}

function emptyComparison(sources, status) {
  return { status, denominator: { sources: 8, units: 16 }, decision: 'EVIDENCE_INCOMPLETE',
    pairs: sources.map(source => ({ sourceId: source.sourceId, target: source.target, outcome: 'UNKNOWN' })),
    arms: Object.fromEntries(['Candidate17', 'Candidate18'].map(candidate => [candidate, {
      denominator: 8, evaluated: 0, firstWholeCorrect: null, firstWholeCorrectRate: null,
      rateStatus: 'NOT_OBSERVABLE', unknown: 8 }])) }
}

function scoredComparison(summary) {
  return { ...summary, status: 'FROZEN_DEVELOPMENT_DIAGNOSTIC', denominator: { sources: 8, units: 16 },
    arms: Object.fromEntries(Object.entries(summary.arms).map(([candidate, arm]) => [candidate, { ...arm,
      evaluated: arm.observed, firstWholeCorrectRate: arm.unknown === 0 ? arm.firstWholeCorrect / arm.denominator : null,
      rateStatus: arm.unknown === 0 ? 'PROVISIONAL_AUTOMATED_CONTRACT_OBSERVED' : 'UNKNOWN_CASES_RETAINED',
      confirmedCorrectFractionOfFixedDenominator: arm.firstWholeCorrect / arm.denominator }])) }
}

/** This function only summarizes supplied read-only evidence. scoreAll is never
 * called for partial, sealed, unverified or unauthenticated observations. */
export async function buildD26ExecutionReport({ units, sources, inspection, scoreAll }) {
  frozenDenominators(units, sources)
  const rows = inspection.state?.units ?? []
  const stateMatches = rows.length === 16 && rows.every((row, index) => row.ordinal === units[index].ordinal
    && row.unitIdentitySha256 === units[index].unitIdentitySha256 && row.requestSha256 === units[index].requestSha256)
  const auditConsistent = inspection.audit === 'CONSISTENT' && stateMatches
  const batchEventCount = inspection.batchEvidence?.rows
  const noExecutionEvidence = inspection.state === null && inspection.audit === 'NO_STATE'
    && batchEventCount === 0 && !inspection.lockExists && !inspection.halt
  const complete = auditConsistent && rows.every(row => row.status === 'SETTLED')
    && !inspection.lockExists && !inspection.halt && !inspection.uncertainty
  const unitRows = units.map(unit => {
    const stateRow = stateMatches ? rows[unit.ordinal - 1] : null
    const certainty = noExecutionEvidence || (auditConsistent && stateRow?.status === 'NOT_SENT') ? 'CONFIRMED_NOT_SENT'
      : auditConsistent && stateRow?.status === 'SETTLED' ? 'CONFIRMED_RESPONSE_AND_SETTLEMENT' : 'UNKNOWN'
    return { ordinal: unit.ordinal, sourceId: unit.sourceId, arm: unit.arm, candidate: unit.candidate,
      unitIdentitySha256: unit.unitIdentitySha256, requestSha256: unit.requestSha256,
      recordedState: stateRow?.status ?? null, status: certainty === 'CONFIRMED_NOT_SENT' ? 'NOT_RUN'
        : certainty === 'CONFIRMED_RESPONSE_AND_SETTLEMENT' ? 'SETTLED' : 'UNRESOLVED', sendCertainty: certainty,
      responseSha256: stateRow?.responseSha256 ?? null,
      recordedUsage: stateRow?.usage ?? null, usageEvidenceStatus: auditConsistent && stateRow?.status === 'SETTLED'
        ? 'RAW_STATE_LEDGER_VERIFIED' : 'NOT_OBSERVABLE_OR_UNVERIFIED',
      conservativeSettlementMicroUsd: auditConsistent && stateRow?.status === 'SETTLED' ? stateRow.costUpperMicroUsd : null }
  })
  const knownSent = unitRows.filter(row => row.sendCertainty === 'CONFIRMED_RESPONSE_AND_SETTLEMENT')
  const unknown = unitRows.filter(row => row.sendCertainty === 'UNKNOWN').length
  const observedUsage = knownSent.filter(row => row.recordedUsage && row.recordedUsage !== 'NOT_OBSERVABLE')
  const status = noExecutionEvidence ? 'NOT_RUN_NO_BATCH_EXECUTION_OBSERVED'
    : complete ? 'COMPLETE_DEFINITE_COMPARISON' : 'INCOMPLETE_OR_UNCERTAIN_NO_WINNER'
  const report = { version: 'd26-read-only-execution-report-1', batch: BATCH, snapshotCommit: SNAPSHOT, status,
    scope: 'SEEN_DEVELOPMENT_NOT_HOLDOUT_NOT_HUMAN_NOT_DEFAULT_CANDIDATE',
    referenceStatus: 'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL', fixedDenominator: { sources: 8, units: 16, perArm: 8 },
    adjudicationCoverage: { automatedContract: 'FROZEN_V10_WHEN_COMPLETE', humanAdjudication: 'NOT_ADJUDICATED',
      unadjudicatedFields: { titles: 'NOT_ADJUDICATED', freeDescriptions: 'NOT_ADJUDICATED', teachingExampleLeakage: 'NOT_ADJUDICATED' },
      note: 'Automatic source-supported prose diagnostics do not establish independent human review or a zero error count.' },
    operationsByThisReport: { modelRequests: 0, grant: 0, reserve: 0, settle: 0, ledgerWrites: 0, rawWrites: 0 },
    execution: { confirmedSent: knownSent.length, confirmedNotSent: unitRows.filter(row => row.status === 'NOT_RUN').length,
      uncertainSendOrSettlementUnits: unknown, actualSentExact: unknown === 0 ? knownSent.length : null,
      authorizationStatus: 'NOT_EVALUATED_READ_ONLY_REPORT_IS_NOT_PERMISSION',
      accountingEventCounts: inspection.batchEvidence ?? 'NOT_OBSERVABLE',
      audit: inspection.audit, uncertainty: inspection.uncertainty ?? null, lockExists: Boolean(inspection.lockExists), halt: inspection.halt ?? null },
    ledger: inspection.ledger,
    usage: { verifiedUnits: observedUsage.length, fixedUnitDenominator: 16,
      observedInputTokens: observedUsage.reduce((sum, row) => sum + row.recordedUsage.input_tokens, 0),
      observedOutputTokens: observedUsage.reduce((sum, row) => sum + row.recordedUsage.output_tokens, 0),
      totalsStatus: noExecutionEvidence ? 'NO_REQUESTS_SENT' : unknown === 0 && observedUsage.length === knownSent.length
        ? 'VERIFIED_SENT_UNITS_ONLY' : 'PARTIAL_OR_UNVERIFIED_NOT_BATCH_TOTAL',
      conservativeSettlementMicroUsd: knownSent.reduce((sum, row) => sum + row.conservativeSettlementMicroUsd, 0),
      providerActualUsd: 'NOT_OBSERVABLE' },
    units: unitRows, originalAnswerComparison: emptyComparison(sources, status), productFirstComparison: emptyComparison(sources, status),
    humanEdits: 'NOT_APPLIED_TO_COMPARISON', humanMetrics: { ...humanMetrics },
    interpretation: ['No missing raw is treated as proof of non-delivery.',
      'Original-answer scoring still includes the frozen parser and common adapter; it is not independent human adjudication.',
      'Product-first scoring includes frozen program conversion and display assembly before human edits.',
      'Transport/parse/schema failures stay in the fixed denominator; no repair or new model output is generated.'] }
  if (complete) {
    check(typeof scoreAll === 'function', 'SCORER_REQUIRED_FOR_COMPLETE_BATCH')
    const scores = await scoreAll()
    check(scores.cases?.length === 16 && scores.cases.every((row, index) => row.ordinal === units[index].ordinal
      && row.sourceId === units[index].sourceId && row.arm === units[index].arm && row.humanEdits === 'NOT_APPLIED'), 'SCORE_IDENTITY_DRIFT')
    report.cases = scores.cases
    report.originalAnswerComparison = scoredComparison(scores.originalAnswerComparison)
    report.productFirstComparison = scoredComparison(scores.productFirstComparison)
  }
  return report
}

async function scoreSnapshotWorker(snapshotRoot, inspection) {
  const { units } = verifySnapshot(snapshotRoot)
  check(inspection.audit === 'CONSISTENT' && !inspection.lockExists && !inspection.halt
    && inspection.state?.units.length === 16 && inspection.state.units.every(row => row.status === 'SETTLED'), 'WORKER_INCOMPLETE')
  const { sources } = read(join(snapshotRoot, PACKAGE, 'SOURCES.json'))
  const { references } = read(join(snapshotRoot, PACKAGE, 'REFERENCES.json'))
  const scorer = await import(pathToFileURL(join(snapshotRoot, 'scripts/score-d26.mjs')).href)
  const { d26Components } = await import(pathToFileURL(join(snapshotRoot, 'scripts/d26-components.mjs')).href)
  const components = await d26Components(), cases = []
  for (const unit of units) {
    const row = inspection.state.units[unit.ordinal - 1]
    const raw = read(join(HOST_ROOT, '.data/d26/execution/raw', String(unit.ordinal).padStart(2, '0') + '.json'))
    check(raw.ordinal === unit.ordinal && row.ordinal === unit.ordinal && raw.requestSha256 === unit.requestSha256
      && raw.unitIdentitySha256 === unit.unitIdentitySha256 && row.requestSha256 === unit.requestSha256
      && row.unitIdentitySha256 === unit.unitIdentitySha256 && digest(raw.rawHttpText) === row.responseSha256
      && raw.responseSha256 === row.responseSha256, 'RAW_CHANGED_DURING_READ')
    const source = sources.find(item => item.sourceId === unit.sourceId), reference = references.find(item => item.sourceId === unit.sourceId)
    check(source && reference, 'MISSING_REFERENCE')
    cases.push({ ordinal: unit.ordinal, sourceId: unit.sourceId, arm: unit.arm, candidate: unit.candidate,
      requestSha256: unit.requestSha256, responseSha256: raw.responseSha256,
      ...await scorer.evaluateRawD26(source, reference, raw, unit.candidate, components) })
  }
  return { cases, originalAnswerComparison: scorer.summarizeD26Cases(sources, cases.map(row => ({ ...row, score: row.originalAnswerScore }))),
    productFirstComparison: scorer.summarizeD26Cases(sources, cases) }
}

export async function reportD26Execution(snapshotRoot) {
  snapshotRoot = realpathSync(snapshotRoot)
  const pack = verifySnapshot(snapshotRoot), host = await createLiveHost(snapshotRoot)
  const inspection = await host.resumeReadOnly(), { sources } = read(join(snapshotRoot, PACKAGE, 'SOURCES.json'))
  const report = await buildD26ExecutionReport({ units: pack.units, sources, inspection, scoreAll: async () => {
    // Frozen component bundling resolves its files relative to cwd. Only this
    // child uses the immutable snapshot; neither checkout is changed.
    const result = execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--score-worker', '--snapshot', snapshotRoot], {
      cwd: snapshotRoot, input: JSON.stringify(inspection), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] })
    return JSON.parse(result)
  } })
  const after = await host.resumeReadOnly()
  check(JSON.stringify(after) === JSON.stringify(inspection), 'STATE_OR_LEDGER_CHANGED_DURING_READ')
  return { ...report, manifestSha256: pack.binding.manifestSha256, identitiesSha256: pack.binding.identitiesSha256 }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), worker = args[0] === '--score-worker'
    if (worker) args.shift()
    check(args.length === 2 && args[0] === '--snapshot' && args[1], 'USAGE_REQUIRES_SNAPSHOT')
    const snapshotRoot = realpathSync(args[1])
    if (worker) check(realpathSync(process.cwd()) === snapshotRoot, 'WORKER_REQUIRES_FROZEN_CWD')
    const result = worker ? await scoreSnapshotWorker(snapshotRoot, JSON.parse(readFileSync(0, 'utf8'))) : await reportD26Execution(snapshotRoot)
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    const message = Object.getOwnPropertyDescriptor(error ?? {}, 'message')?.value
    const code = typeof message === 'string' && /^D26_REPORT_[A-Z0-9_]+$/u.test(message) ? message : safeCode(error)
    console.error(JSON.stringify({ status: 'READ_ONLY_REPORT_STOPPED', code, modelRequests: 0, ledgerWrites: 0 }))
    process.exitCode = 2
  }
}
