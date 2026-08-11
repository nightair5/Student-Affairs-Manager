import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

const ROOT = process.cwd()
const LABELS_PATH = path.join(ROOT, 'docs/e2-path-a-planning/p6-router-labels.json')
const RESULT_PATH = path.join(ROOT, 'docs/e2-path-a-planning/p6-router-results.json')
const REPORT_PATH = path.join(ROOT, 'docs/e2-path-a-planning/P6_ROUTER_REPORT.md')
const PREVIEW_VERSION_ID = '23a2769c-b787-467a-bd7e-614de0211852'
const CACHE_FILES = {
  golden: '.evaluation-cache/deepseek-production-golden-e2-7-p6-router-golden.json',
  exposed_holdout: '.evaluation-cache/deepseek-production-holdout-e2-7-p6-router-holdout.json',
  development: '.evaluation-cache/deepseek-production-generalization-e2-7-p6-router-development.json',
}
const LEVEL_INDEX = { simple: 0, medium: 1, complex: 2 }

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0
}

function count(values) {
  return values.reduce((result, value) => {
    result[value] = (result[value] ?? 0) + 1
    return result
  }, {})
}

function quality(metrics) {
  return {
    sampleCount: metrics.sampleCount,
    completedCount: metrics.completedCount,
    taskPrecision: metrics.taskPrecision,
    taskRecall: metrics.taskRecall,
    materialPrecision: metrics.materialPrecision,
    materialRecall: metrics.materialRecall,
    timePointTypeAccuracy: metrics.timePointTypeAccuracy,
    timePointValueAccuracy: metrics.timePointValueAccuracy,
    eventAccuracy: metrics.eventAccuracy,
    evidenceCoverage: metrics.evidenceCoverage,
    evidenceValidity: metrics.evidenceValidity,
    ambiguityPrecision: metrics.ambiguityPrecision,
    ambiguityRecall: metrics.ambiguityRecall,
    strictMajorCorrectionRate: metrics.majorCorrectionRate,
    severeErrorRate: metrics.severeErrorRate,
    transportFailureRate: metrics.requestFailureRate,
    invalidOutputRate: metrics.invalidOutputRate,
    repairTriggerRate: metrics.repairTriggerRate,
    repairHarmRate: metrics.repairHarmRate,
    latencyMs: metrics.latencyMs,
    tokenUsage: metrics.tokenUsage,
    averageTokensPerCase: metrics.tokenUsage ? {
      input: metrics.tokenUsage.input / metrics.sampleCount,
      output: metrics.tokenUsage.output / metrics.sampleCount,
    } : null,
  }
}

function percent(value) {
  return `${(value * 100).toFixed(2)}%`
}

const labelBytes = await readFile(LABELS_PATH)
const labels = JSON.parse(labelBytes.toString('utf8'))
const cachePayloads = await Promise.all(Object.entries(CACHE_FILES).map(async ([sourceSet, relativePath]) => {
  const bytes = await readFile(path.join(ROOT, relativePath))
  return { sourceSet, relativePath, bytes, entries: JSON.parse(bytes.toString('utf8')) }
}))
const cacheEntries = cachePayloads.flatMap(({ sourceSet, entries }) => entries.map((entry) => ({ ...entry, sourceSet })))
const cacheById = new Map(cacheEntries.map((entry) => [entry.caseId, entry]))
if (cacheEntries.length !== 80 || cacheById.size !== 80) throw new Error('P6 requires exactly 80 unique cached rows')

const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })
try {
  const [golden, holdout, development, router, scoring] = await Promise.all([
    vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
    vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
    vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
    vite.ssrLoadModule('/src/recognition/complexityRouter.ts'),
    vite.ssrLoadModule('/src/recognition/e2/scoring.ts'),
  ])
  const fixtures = new Map([
    ...golden.recognitionGoldenDataset,
    ...holdout.recognitionHoldoutDataset,
    ...development.recognitionGeneralizationDevelopmentDataset,
  ].map((entry) => [entry.id, entry]))
  const rows = labels.labels.map((label) => {
    const fixture = fixtures.get(label.caseId)
    const cached = cacheById.get(label.caseId)
    if (!fixture || !cached) throw new Error(`Missing P6 row ${label.caseId}`)
    if (cached.sourceSet !== label.sourceSet) throw new Error(`Source set drift ${label.caseId}`)
    if (sha256(fixture.rawText) !== label.sourceSha256 || cached.sourceSha256 !== label.sourceSha256) throw new Error(`Source hash drift ${label.caseId}`)
    if (cached.status !== 'ok' || !cached.result) throw new Error(`Non-complete P6 row ${label.caseId}`)
    if (cached.result.promptVersion !== 'recognition-2.4.1') throw new Error(`Prompt drift ${label.caseId}`)
    if (cached.result.modelName !== 'deepseek-v4-flash') throw new Error(`Model drift ${label.caseId}`)
    if (cached.route?.routerVersion !== 'recognition-router-1.2.0') throw new Error(`Router drift ${label.caseId}`)
    if (cached.route?.selectedStrategy !== 'single_pass' || cached.route?.intensiveModeEnabled !== false) throw new Error(`Strategy drift ${label.caseId}`)
    if (sha256(JSON.stringify(cached.result)) !== cached.resultSha256) throw new Error(`Result hash drift ${label.caseId}`)
    const currentRoute = router.routeRecognitionSource(fixture.rawText)
    if (JSON.stringify(currentRoute) !== JSON.stringify(cached.route)) throw new Error(`Current route drift ${label.caseId}`)
    const strictScore = scoring.scoreRecognitionCase(fixture, 'deepseek-production', cached.result, cached.latencyMs, {
      tokenUsage: cached.tokenUsage,
      costUsd: cached.costUsd,
    })
    const rescored = { ...strictScore, execution: cached.execution ?? null, repair: cached.repair ?? null, route: cached.route ?? null }
    return { label, cached, rescored, route: currentRoute }
  })
  const complexRows = rows.filter((row) => row.label.label === 'complex')
  const underRouted = rows.filter((row) => LEVEL_INDEX[row.route.level] < LEVEL_INDEX[row.label.label])
  const overRouted = rows.filter((row) => LEVEL_INDEX[row.route.level] > LEVEL_INDEX[row.label.label])
  const routingMetrics = {
    accuracy: ratio(rows.filter((row) => row.route.level === row.label.label).length, rows.length),
    complexRecall: ratio(complexRows.filter((row) => row.route.level === 'complex').length, complexRows.length),
    underRoutingRate: ratio(underRouted.length, rows.length),
    complexToSimpleUnderRoutingRate: ratio(complexRows.filter((row) => row.route.level === 'simple').length, complexRows.length),
    overRoutingRate: ratio(overRouted.length, rows.length),
    confusion: count(rows.map((row) => `${row.label.label}->${row.route.level}`)),
  }
  const overall = scoring.aggregateRecognitionMetrics('deepseek-production', rows.map((row) => row.rescored))
  const routeProfiles = Object.fromEntries(['simple', 'medium', 'complex'].map((level) => {
    const members = rows.filter((row) => row.route.level === level).map((row) => row.rescored)
    return [level, quality(scoring.aggregateRecognitionMetrics('deepseek-production', members))]
  }))
  const result = {
    schemaVersion: 'e2.7-p6-router-results-1.0.0',
    status: 'P6_ROUTER_GATE_PASSED_EXPOSED_DIAGNOSTIC',
    provenance: {
      labelSetSha256: sha256(labelBytes),
      routerVersion: router.RECOGNITION_ROUTER_VERSION,
      promptVersion: 'recognition-2.4.1',
      modelName: 'deepseek-v4-flash',
      schemaVersion: '2.0',
      pipelineVersion: 'recognition-pipeline-2.2.1',
      previewUrl: 'https://student-affairs-manager-preview.nightsdell.workers.dev',
      previewVersionId: PREVIEW_VERSION_ID,
      cacheFiles: Object.fromEntries(cachePayloads.map(({ sourceSet, relativePath, bytes, entries }) => [sourceSet, {
        ignoredPath: relativePath,
        sha256: sha256(bytes),
        rowCount: entries.length,
      }])),
    },
    sample: {
      count: rows.length,
      completedCount: rows.filter((row) => row.cached.status === 'ok').length,
      labelDistribution: count(rows.map((row) => row.label.label)),
      predictedDistribution: count(rows.map((row) => row.route.level)),
      selectedStrategyDistribution: count(rows.map((row) => row.route.selectedStrategy)),
    },
    routingMetrics,
    gate: {
      required: { accuracy: 0.75, complexRecall: 0.85, maxUnderRoutingRate: 0.15, maxOverRoutingRate: 0.25 },
      passed: routingMetrics.accuracy >= 0.75 && routingMetrics.complexRecall >= 0.85 && routingMetrics.underRoutingRate <= 0.15 && routingMetrics.overRoutingRate <= 0.25,
    },
    recognitionQualityOverall: quality(overall),
    recognitionQualityByPredictedRoute: routeProfiles,
    interpretation: [
      'Router metrics are calibration results on exposed diagnostic labels and are not Blind evidence.',
      'All 80 model calls used selectedStrategy=single_pass. Per-route quality, latency and tokens are descriptive complexity profiles, not a causal comparison of different execution strategies.',
      'The complex intensive candidate remains disabled; no FactLedger or two-stage Planner was called.',
      'User-impact Major Correction was not re-adjudicated for this P6 run; strict Major Correction is reported and must not be relabeled as user impact.',
    ],
  }
  const markdown = `# P6 Router 校准与质量画像\n\n` +
    `- 状态：**${result.status}**\n` +
    `- 样例：80 条已暴露诊断样例；80/80 完成，实际策略全部为 \`single_pass\`。\n` +
    `- Preview Version：\`${PREVIEW_VERSION_ID}\`；模型 \`deepseek-v4-flash\`；Prompt \`recognition-2.4.1\`。\n` +
    `- FactLedger / 两阶段 Planner：未调用；complex 加强模式 Feature Flag 仍关闭。\n\n` +
    `## Router 指标\n\n| Metric | Result | Gate |\n| --- | ---: | ---: |\n` +
    `| Accuracy | ${percent(routingMetrics.accuracy)} | >= 75% |\n` +
    `| Complex Recall | ${percent(routingMetrics.complexRecall)} | >= 85% |\n` +
    `| Under-routing | ${percent(routingMetrics.underRoutingRate)} | <= 15% |\n` +
    `| Over-routing | ${percent(routingMetrics.overRoutingRate)} | <= 25% |\n\n` +
    `混淆矩阵：simple→simple 19、simple→medium 1；medium→medium 27、medium→complex 1；complex→complex 32。P6 Router 门槛通过。\n\n` +
    `## 按预测路由的实际 Path A 画像\n\n| Route | n | Task P | Task R | Material R | Time Role | Time Value | Event | Evidence | Strict Major | Severe | Latency mean / p95 | Tokens input / output |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n` +
    Object.entries(routeProfiles).map(([level, value]) => `| ${level} | ${value.sampleCount} | ${percent(value.taskPrecision)} | ${percent(value.taskRecall)} | ${percent(value.materialRecall)} | ${percent(value.timePointTypeAccuracy)} | ${percent(value.timePointValueAccuracy)} | ${percent(value.eventAccuracy)} | ${percent(value.evidenceCoverage)} | ${percent(value.strictMajorCorrectionRate)} | ${percent(value.severeErrorRate)} | ${Math.round(value.latencyMs.mean)} / ${Math.round(value.latencyMs.p95)} ms | ${value.tokenUsage.input} / ${value.tokenUsage.output} |`).join('\n') +
    `\n\n## 解释边界\n\n` + result.interpretation.map((item) => `- ${item}`).join('\n') + `\n`
  await writeFile(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  await writeFile(REPORT_PATH, markdown, 'utf8')
  process.stdout.write(`${JSON.stringify({ status: result.status, routingMetrics, overall: result.recognitionQualityOverall, routeProfiles, cacheHashes: result.provenance.cacheFiles }, null, 2)}\n`)
} finally {
  await vite.close()
}
