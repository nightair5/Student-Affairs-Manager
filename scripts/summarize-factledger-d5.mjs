import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

const ROOT = process.cwd()

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

function repairWithRescoredBefore(repair, fixture, scoring) {
  if (!repair?.beforeResult) return repair ?? null
  const before = scoring.scoreRecognitionCase(fixture, 'deepseek-production', repair.beforeResult, 0)
  return {
    ...repair,
    beforeScores: {
      taskTruePositive: before.scores.taskTruePositive,
      materialMatched: before.scores.materialMatched,
      timePointMatched: before.scores.timePointMatched,
      eventMatched: before.scores.eventMatched,
      evidenceMatched: before.scores.evidenceMatched,
      duplicateCount: before.scores.duplicateCount,
      overFragmented: before.scores.overFragmented,
      majorCorrection: before.scores.majorCorrection,
      severeError: before.scores.severeError,
    },
  }
}

async function main() {
  const cacheRoot = path.resolve(ROOT, option('cache-root', '.evaluation-cache'))
  const output = path.resolve(ROOT, option('output', 'docs/e2-factledger/d5-ab-results.json'))
  const selection = await readJson(path.join(ROOT, 'docs/e2-factledger/d5-complex-selection.json'))
  const previous = await readJson(output).catch(() => null)
  const cacheFiles = [
    'deepseek-production-golden-g8-regression-2-4-1.json',
    'deepseek-production-holdout-g8-regression-2-4-1.json',
    'deepseek-production-generalization-g8-after-2-4-1.json',
  ]
  const cachePayloads = await Promise.all(cacheFiles.map(async (file) => {
    const bytes = await readFile(path.join(cacheRoot, file))
    return {
      file,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      entries: JSON.parse(bytes.toString('utf8')),
    }
  }))
  const cacheEntries = cachePayloads.flatMap((payload) => payload.entries)
  const cacheById = new Map(cacheEntries.map((entry) => [entry.caseId, entry]))
  const vite = await createServer({
    root: ROOT,
    appType: 'custom',
    logLevel: 'error',
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true },
  })
  try {
    const [golden, holdout, development, scoring] = await Promise.all([
      vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/scoring.ts'),
    ])
    const fixtures = new Map([
      ...golden.recognitionGoldenDataset,
      ...holdout.recognitionHoldoutDataset,
      ...development.recognitionGeneralizationDevelopmentDataset,
    ].map((entry) => [entry.id, entry]))
    if (selection.cases.length < 24 || selection.cases.length > 30) throw new Error('D5 selection must contain 24-30 cases')
    if (new Set(selection.cases.map((entry) => entry.caseId)).size !== selection.cases.length) throw new Error('D5 selection contains duplicate case IDs')
    const rescore = (caseId) => {
      const fixture = fixtures.get(caseId)
      const cached = cacheById.get(caseId)
      if (!fixture) throw new Error(`Unknown selected case: ${caseId}`)
      if (!cached?.result || cached.status !== 'ok') throw new Error(`Missing completed A cache: ${caseId}`)
      if (cached.result.promptVersion !== 'recognition-2.4.1') throw new Error(`Prompt version drift: ${caseId}`)
      if (cached.result.modelName !== 'deepseek-v4-flash') throw new Error(`Model drift: ${caseId}`)
      const scored = scoring.scoreRecognitionCase(fixture, 'deepseek-production', cached.result, cached.latencyMs, {
        tokenUsage: cached.tokenUsage,
        costUsd: cached.costUsd,
      })
      return {
        ...scored,
        repair: repairWithRescoredBefore(cached.repair, fixture, scoring),
        execution: cached.execution ?? null,
        route: cached.route ?? null,
      }
    }
    const rescored = selection.cases.map(({ caseId }) => rescore(caseId))
    const allExposedCompleted = cacheEntries.filter((entry) => entry.status === 'ok' && entry.result)
    const allExposedRescored = allExposedCompleted.map((entry) => rescore(entry.caseId))
    const metrics = scoring.aggregateRecognitionMetrics('deepseek-production', rescored)
    const allExposedMetrics = scoring.aggregateRecognitionMetrics('deepseek-production', allExposedRescored)
    const tokenUsage = metrics.tokenUsage
    const pathB = previous?.pathB
      ?? { status: 'NOT_RUN', code: 'DEEPSEEK_NOT_CONFIGURED', completedCases: 0, metrics: null, latencyMs: null, tokenUsage: null }
    const report = {
      schemaVersion: 'e2.5-d5-results-1.1.0',
      status: pathB.status === 'NOT_RUN' ? 'INCONCLUSIVE' : 'PENDING_B_AGGREGATION',
      sampleCount: rescored.length,
      modelRequired: 'deepseek-v4-flash',
      scoringIntegrity: 'RECOMPUTED_FROM_RAW_EXPOSED_CACHE_WITH_NONEMPTY_ALIAS_GUARD',
      baselineSourceBinding: 'LEGACY_CACHE_NO_INVOCATION_SOURCE_HASH',
      inputCaches: cachePayloads.map(({ file, sha256, entries }) => ({ file, sha256, entryCount: entries.length })),
      exposedCacheAudit: {
        sampleCount: cacheEntries.length,
        completedCount: allExposedRescored.length,
        repairTriggerRate: allExposedMetrics.repairTriggerRate,
        repairAppliedRate: allExposedMetrics.repairAppliedRate,
        repairSuccessRate: allExposedMetrics.repairSuccessRate,
        repairHarmRate: allExposedMetrics.repairHarmRate,
      },
      pathA: {
        status: 'RECOMPUTED_FROM_RAW_EXPOSED_CACHE',
        promptVersion: 'recognition-2.4.1',
        factRecall: 'NOT_OBSERVABLE_NO_EXPLICIT_FACT_LAYER',
        taskPrecision: metrics.taskPrecision,
        taskRecall: metrics.taskRecall,
        materialPrecision: metrics.materialPrecision,
        materialRecall: metrics.materialRecall,
        timePointTypeAccuracy: metrics.timePointTypeAccuracy,
        timePointValueAccuracy: metrics.timePointValueAccuracy,
        milestonePrecision: metrics.milestonePrecision,
        milestoneRecall: metrics.milestoneRecall,
        eventAccuracy: metrics.eventAccuracy,
        ambiguityPrecision: metrics.ambiguityPrecision,
        ambiguityRecall: metrics.ambiguityRecall,
        evidenceCoverage: metrics.evidenceCoverage,
        majorCorrectionRate: metrics.majorCorrectionRate,
        severeErrorRate: metrics.severeErrorRate,
        latencyMs: metrics.latencyMs,
        tokenUsage: tokenUsage ? {
          ...tokenUsage,
          meanInputPerCase: tokenUsage.input / rescored.length,
          meanOutputPerCase: tokenUsage.output / rescored.length,
        } : null,
        costUsd: metrics.costUsd ?? 'NOT_OBSERVABLE',
        repair: {
          triggerRate: metrics.repairTriggerRate,
          appliedRate: metrics.repairAppliedRate,
          successRate: metrics.repairSuccessRate,
          harmRate: metrics.repairHarmRate,
        },
      },
      pathB,
      thresholdDecision: {
        taskRecallGain8To10pp: 'NOT_COMPUTABLE',
        majorCorrectionReduction20pp: 'NOT_COMPUTABLE',
        taskPrecisionAtLeast82Percent: 'NOT_COMPUTABLE',
        evidenceCoverageAtLeast95Percent: 'NOT_COMPUTABLE',
        severeErrorNotIncreased: 'NOT_COMPUTABLE',
      },
    }
    const json = `${JSON.stringify(report, null, 2)}\n`
    await writeFile(output, json, 'utf8')
    process.stdout.write(json)
  } finally {
    await vite.close()
  }
}

await main()
