import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

const ROOT = process.cwd()
const LABELS_PATH = path.join(ROOT, 'docs/e2-path-a-planning/p7-validator-labels.json')
const OUTPUT_PATH = path.join(ROOT, 'docs/e2-path-a-planning/p7-validator-results.json')
const REVIEW_PATH = path.join(ROOT, '.evaluation-cache/e2-7/p7-validator-review.json')
const CACHE_FILES = [
  '.evaluation-cache/deepseek-production-golden-e2-7-p6-router-golden.json',
  '.evaluation-cache/deepseek-production-holdout-e2-7-p6-router-holdout.json',
  '.evaluation-cache/deepseek-production-generalization-e2-7-p6-router-development.json',
]

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator
}

const labelBytes = await readFile(LABELS_PATH)
const labelSet = JSON.parse(labelBytes.toString('utf8'))
const reviewBytes = await readFile(REVIEW_PATH)
if (sha256(reviewBytes) !== labelSet.sourceBinding.reviewPacketSha256) throw new Error('Frozen review packet hash mismatch')
const review = JSON.parse(reviewBytes.toString('utf8'))
const sourceById = new Map(review.cases.map((entry) => [entry.caseId, entry.source]))
const cacheEntries = (await Promise.all(CACHE_FILES.map(async (file) => JSON.parse(await readFile(path.join(ROOT, file), 'utf8'))))).flat()
const cacheById = new Map(cacheEntries.map((entry) => [entry.caseId, entry]))
const targetCodes = labelSet.issueCodes
const targetCodeSet = new Set(targetCodes)
const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })

try {
  const validator = await vite.ssrLoadModule('/src/recognition/qualityValidator.ts')
  const rows = labelSet.labels.map((label) => {
    const cached = cacheById.get(label.caseId)
    if (!cached?.result || cached.status !== 'ok') throw new Error(`Missing bound result for ${label.caseId}`)
    if (cached.sourceSha256 !== label.sourceSha256 || cached.inputSha256 !== label.inputSha256 || cached.resultSha256 !== label.resultSha256) {
      throw new Error(`Hash binding mismatch for ${label.caseId}`)
    }
    const expected = new Set(label.issues.filter((code) => code !== 'NO_ISSUE'))
    const source = sourceById.get(label.caseId)
    if (typeof source !== 'string') throw new Error(`Missing frozen source for ${label.caseId}`)
    const report = validator.validateRecognitionQuality(cached.result, source)
    const predicted = new Set(report.issues.map((issue) => issue.code).filter((code) => targetCodeSet.has(code)))
    return { caseId: label.caseId, expected, predicted }
  })

  const perClass = Object.fromEntries(targetCodes.map((code) => {
    let tp = 0
    let fp = 0
    let fn = 0
    let tn = 0
    rows.forEach((row) => {
      const expected = row.expected.has(code)
      const predicted = row.predicted.has(code)
      if (expected && predicted) tp += 1
      else if (!expected && predicted) fp += 1
      else if (expected) fn += 1
      else tn += 1
    })
    return [code, {
      support: tp + fn,
      predicted: tp + fp,
      tp,
      fp,
      fn,
      tn,
      precision: ratio(tp, tp + fp),
      recall: ratio(tp, tp + fn),
      falsePositiveRate: ratio(fp, fp + tn),
      falseNegativeRate: ratio(fn, fn + tp),
    }]
  }))
  const totals = Object.values(perClass).reduce((sum, metric) => ({
    tp: sum.tp + metric.tp,
    fp: sum.fp + metric.fp,
    fn: sum.fn + metric.fn,
    tn: sum.tn + metric.tn,
  }), { tp: 0, fp: 0, fn: 0, tn: 0 })
  const precisionValues = Object.values(perClass).map((metric) => metric.precision).filter((value) => value !== null)
  const recallValues = Object.values(perClass).map((metric) => metric.recall).filter((value) => value !== null)
  const noIssueRows = rows.filter((row) => row.expected.size === 0)
  const predictedPositiveCaseCount = rows.filter((row) => row.predicted.size > 0).length
  const noIssueFalsePositiveCount = noIssueRows.filter((row) => row.predicted.size > 0).length
  const metrics = {
    micro: {
      ...totals,
      precision: ratio(totals.tp, totals.tp + totals.fp),
      recall: ratio(totals.tp, totals.tp + totals.fn),
      falsePositiveRate: ratio(totals.fp, totals.fp + totals.tn),
      falseNegativeRate: ratio(totals.fn, totals.fn + totals.tp),
    },
    macro: {
      precision: precisionValues.reduce((sum, value) => sum + value, 0) / precisionValues.length,
      recall: recallValues.reduce((sum, value) => sum + value, 0) / recallValues.length,
      precisionObservableClassCount: precisionValues.length,
      recallObservableClassCount: recallValues.length,
    },
    caseLevel: {
      caseCount: rows.length,
      predictedPositiveCaseCount,
      predictedPositiveCaseRate: ratio(predictedPositiveCaseCount, rows.length),
      noIssueCaseCount: noIssueRows.length,
      noIssueFalsePositiveCount,
      noIssueFalsePositiveRate: ratio(noIssueFalsePositiveCount, noIssueRows.length),
    },
    perClass,
  }
  const gates = {
    microPrecisionAtLeast70: metrics.micro.precision >= 0.7,
    microRecallAtLeast60: metrics.micro.recall >= 0.6,
    wrongTimeRoleRecallAtLeast50: perClass.WRONG_TIME_ROLE.recall >= 0.5,
    missingAmbiguityRecallAtLeast50: perClass.MISSING_AMBIGUITY.recall >= 0.5,
    antiBlanketWarning: metrics.caseLevel.predictedPositiveCaseRate < 0.9 && metrics.caseLevel.noIssueFalsePositiveRate <= 0.5,
  }
  const output = {
    schemaVersion: 'e2.7-p7-validator-results-1.0.0',
    generatedAt: new Date().toISOString(),
    status: Object.values(gates).every(Boolean) ? 'PASS' : 'FAIL',
    scope: '80 frozen exposed diagnostic real-model outputs; no synthetic cases in metrics',
    validatorVersion: validator.RECOGNITION_VALIDATOR_VERSION,
    bindings: {
      labelsSha256: sha256(labelBytes),
      sourceReviewPacketSha256: labelSet.sourceBinding.reviewPacketSha256,
      cacheSha256: Object.fromEntries(await Promise.all(CACHE_FILES.map(async (file) => [file, sha256(await readFile(path.join(ROOT, file)))]))),
    },
    gates,
    metrics,
  }
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  process.stdout.write(`${OUTPUT_PATH}\n${JSON.stringify({ status: output.status, gates, micro: metrics.micro, macro: metrics.macro, caseLevel: metrics.caseLevel }, null, 2)}\n`)
  if (process.argv.includes('--details')) {
    rows.forEach((row) => {
      const falsePositive = [...row.predicted].filter((code) => !row.expected.has(code))
      const falseNegative = [...row.expected].filter((code) => !row.predicted.has(code))
      if (falsePositive.length || falseNegative.length) process.stdout.write(`${JSON.stringify({ caseId: row.caseId, falsePositive, falseNegative })}\n`)
    })
  }
} finally {
  await vite.close()
}
