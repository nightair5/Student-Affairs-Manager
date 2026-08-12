/* global console, process */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { sha256 } from './e2-9-r1-hash.mjs'

const ROOT = process.cwd()
const PROTOCOL_VERSION = 'e2-9-v4-pro-reduced-protocol-2.0.0'

function option(name) {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? ''
}

function delta(pro, flash) { return pro - flash }

function completePairs(checkpoint) {
  const byCase = new Map()
  for (const item of checkpoint.observations) {
    if (!byCase.has(item.caseId)) byCase.set(item.caseId, new Set())
    byCase.get(item.caseId).add(item.modelAlias)
  }
  return [...byCase.values()].filter((aliases) => aliases.has('flash') && aliases.has('pro')).length
}

function fallbackCount(checkpoint) {
  return checkpoint.observations.filter((item) => item.error === 'MODEL_FALLBACK_DETECTED' || (item.response?.payload?.execution && item.response.payload.execution.requestedModel !== item.response.payload.execution.returnedModel)).length
}

async function main() {
  const aggregatePath = path.resolve(ROOT, option('aggregate'))
  const reviewPath = path.resolve(ROOT, option('review'))
  const checkpointPath = path.resolve(ROOT, option('checkpoint'))
  const outputPath = path.resolve(ROOT, option('output'))
  if (![option('aggregate'), option('review'), option('checkpoint'), option('output')].every(Boolean)) throw new Error('--aggregate, --review, --checkpoint and --output are required')
  const [aggregateRaw, reviewRaw, checkpointRaw] = await Promise.all([readFile(aggregatePath, 'utf8'), readFile(reviewPath, 'utf8'), readFile(checkpointPath, 'utf8')])
  const aggregate = JSON.parse(aggregateRaw)
  const review = JSON.parse(reviewRaw)
  const checkpoint = JSON.parse(checkpointRaw)
  if ([aggregate, review, checkpoint].some((item) => item.protocolVersion !== PROTOCOL_VERSION) || aggregate.phase !== review.phase || aggregate.phase !== checkpoint.phase) throw new Error('Gate inputs have mismatched protocol or phase')
  if (checkpoint.gateStatus !== 'COMPLETE' || checkpoint.observations.some((item) => item.status !== 'complete') || review.chronologyPass !== true) throw new Error('Gate requires complete generation and chronology-passing review')
  const phase = aggregate.phase
  if (!['screening', 'selection'].includes(phase)) throw new Error('Gate phase must be screening or selection')
  const flash = aggregate.arms.flash
  const pro = aggregate.arms.pro
  const flashReview = review.arms.flash
  const proReview = review.arms.pro
  const pairs = completePairs(checkpoint)
  const common = {
    pairCount: pairs,
    strictTaskRecallDelta: delta(pro.strict.taskRecall, flash.strict.taskRecall),
    semanticTaskRecallDelta: delta(proReview.semanticTaskRecall, flashReview.semanticTaskRecall),
    taskPrecisionDelta: delta(pro.strict.taskPrecision, flash.strict.taskPrecision),
    evidenceCoveragePro: pro.strict.evidenceCoverage,
    evidenceValidityPro: pro.strict.evidenceValidity,
    severeErrorDelta: delta(pro.strict.severeErrorRate, flash.strict.severeErrorRate),
    timeRoleAccuracyDelta: delta(pro.strict.timePointTypeAccuracy, flash.strict.timePointTypeAccuracy),
    timeValueAccuracyDelta: delta(pro.strict.timePointValueAccuracy, flash.strict.timePointValueAccuracy),
    eventAccuracyDelta: delta(pro.strict.eventAccuracy, flash.strict.eventAccuracy),
    materialRecallDelta: delta(pro.strict.materialRecall, flash.strict.materialRecall),
    invalidOutputCount: checkpoint.observations.filter((item) => item.status === 'integrity_failure').length,
    transportFailureCount: checkpoint.observations.filter((item) => item.status === 'transport_failure' || item.status === 'request_failure').length,
    fallbackCount: fallbackCount(checkpoint),
    promptInjectionPass: flash.strict.promptInjectionPass && pro.strict.promptInjectionPass,
    proWins: proReview.wins,
    proObviousDegradationCount: proReview.obviousDegradationCount,
    proUserImpactMajorReduction: flashReview.userImpactMajorCount - proReview.userImpactMajorCount,
  }
  const checks = phase === 'screening' ? {
    eightPairs: pairs === 8,
    strictTaskRecallNonInferior: common.strictTaskRecallDelta >= 0,
    semanticTaskRecallNonInferior: common.semanticTaskRecallDelta >= 0,
    taskPrecisionDropAtMost5pp: common.taskPrecisionDelta >= -0.05,
    evidenceCoverageAtLeast90: common.evidenceCoveragePro >= 0.90,
    severeErrorNotWorse: common.severeErrorDelta <= 0,
    invalidOutputZero: common.invalidOutputCount === 0,
    fallbackZero: common.fallbackCount === 0,
    promptInjectionPass: common.promptInjectionPass,
    proImprovesAtLeast2: common.proWins >= 2,
    proClearlyDegradesAtMost1: common.proObviousDegradationCount <= 1,
  } : {
    twentyFourPairs: pairs === 24,
    primaryGate: common.strictTaskRecallDelta >= 0.08 || common.proUserImpactMajorReduction >= 4 || (common.proWins >= 5 && common.proObviousDegradationCount <= 1),
    taskPrecisionDropAtMost3pp: common.taskPrecisionDelta >= -0.03,
    evidenceCoverageAtLeast95: common.evidenceCoveragePro >= 0.95,
    evidenceValidityAtLeast98: common.evidenceValidityPro >= 0.98,
    severeErrorNotWorse: common.severeErrorDelta <= 0,
    timeRoleNotWorse: common.timeRoleAccuracyDelta >= 0,
    timeValueDropAtMost3pp: common.timeValueAccuracyDelta >= -0.03,
    eventAccuracyDropAtMost5pp: common.eventAccuracyDelta >= -0.05,
    materialRecallDropAtMost5pp: common.materialRecallDelta >= -0.05,
    promptInjectionPass: common.promptInjectionPass,
    invalidOutputAtMostOne: common.invalidOutputCount <= 1,
    transportFailureAtMostOne: common.transportFailureCount <= 1,
    fallbackZero: common.fallbackCount === 0,
  }
  const pass = Object.values(checks).every(Boolean)
  const status = pass ? (phase === 'screening' ? 'V4_PRO_SCREENING_V2_PASS' : 'V4_PRO_SELECTION_V2_PASS') : (phase === 'screening' ? 'V4_PRO_SCREENING_V2_FAIL' : 'V4_PRO_SELECTION_V2_FAIL')
  const result = { schemaVersion: 'e2.9-r1-gate-result-1.0.0', protocolVersion: PROTOCOL_VERSION, phase, evaluatedAt: new Date().toISOString(), inputs: { aggregateSha256: sha256(aggregateRaw), reviewSha256: sha256(reviewRaw), checkpointSha256: sha256(checkpointRaw) }, thresholds: phase === 'screening' ? 'screening-v2 frozen gates' : 'selection-v2 frozen gates', metrics: common, checks, status }
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ phase, status, checks, output: path.relative(ROOT, outputPath), sha256: sha256(await readFile(outputPath, 'utf8')) }, null, 2))
  if (!pass) process.exitCode = 2
}

await main()
