import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { createServer } from 'vite'

const ROOT = process.cwd()
const LABELS_PATH = path.join(ROOT, 'docs/e2-path-a-planning/p6-router-labels.json')
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

const labelBytes = await readFile(LABELS_PATH)
const labels = JSON.parse(labelBytes.toString('utf8'))
if (labels.labels.length < 80) throw new Error('P6 requires at least 80 Router labels')
if (new Set(labels.labels.map((entry) => entry.caseId)).size !== labels.labels.length) throw new Error('Duplicate label case ID')

const vite = await createServer({
  root: ROOT,
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
})

try {
  const [golden, holdout, development, router, workerRouter] = await Promise.all([
    vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
    vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
    vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
    vite.ssrLoadModule('/src/recognition/complexityRouter.ts'),
    import(pathToFileURL(path.join(ROOT, 'cloudflare/complexity-router.mjs')).href),
  ])
  const fixtures = new Map([
    ...golden.recognitionGoldenDataset,
    ...holdout.recognitionHoldoutDataset,
    ...development.recognitionGeneralizationDevelopmentDataset,
  ].map((entry) => [entry.id, entry]))
  const rows = labels.labels.map((entry) => {
    const fixture = fixtures.get(entry.caseId)
    if (!fixture) throw new Error(`Unknown case ${entry.caseId}`)
    if (sha256(fixture.rawText) !== entry.sourceSha256) throw new Error(`Source hash drift ${entry.caseId}`)
    const route = router.routeRecognitionSource(fixture.rawText)
    const workerRoute = workerRouter.routeRecognitionSource(fixture.rawText)
    if (JSON.stringify(route) !== JSON.stringify(workerRoute)) throw new Error(`Browser/Worker router parity drift ${entry.caseId}`)
    return {
      caseId: entry.caseId,
      sourceSet: entry.sourceSet,
      expected: entry.label,
      predicted: route.level,
      score: route.score,
      reasons: route.reasons,
      correct: entry.label === route.level,
    }
  })
  const complex = rows.filter((entry) => entry.expected === 'complex')
  const underRouted = rows.filter((entry) => LEVEL_INDEX[entry.predicted] < LEVEL_INDEX[entry.expected])
  const overRouted = rows.filter((entry) => LEVEL_INDEX[entry.predicted] > LEVEL_INDEX[entry.expected])
  const result = {
    schemaVersion: 'e2.7-p6-router-evaluation-1.0.0',
    status: 'ROUTING_ONLY',
    provenance: {
      labelSetSha256: sha256(labelBytes),
      routerVersion: router.RECOGNITION_ROUTER_VERSION,
      workerRouterVersion: workerRouter.RECOGNITION_ROUTER_VERSION,
      browserWorkerParity: true,
      evaluatedAt: '2026-08-11T00:00:00+08:00',
    },
    sample: {
      count: rows.length,
      labelDistribution: count(rows.map((entry) => entry.expected)),
      predictedDistribution: count(rows.map((entry) => entry.predicted)),
    },
    metrics: {
      accuracy: ratio(rows.filter((entry) => entry.correct).length, rows.length),
      complexRecall: ratio(complex.filter((entry) => entry.predicted === 'complex').length, complex.length),
      underRoutingRate: ratio(underRouted.length, rows.length),
      complexToSimpleUnderRoutingRate: ratio(complex.filter((entry) => entry.predicted === 'simple').length, complex.length),
      overRoutingRate: ratio(overRouted.length, rows.length),
      confusion: count(rows.map((entry) => `${entry.expected}->${entry.predicted}`)),
    },
    gate: {
      required: { accuracy: 0.75, complexRecall: 0.85, maxUnderRoutingRate: 0.15, maxOverRoutingRate: 0.25 },
      passed: false,
    },
    executionMetrics: {
      status: 'NOT_RUN',
      reason: 'Routing-only evaluation does not call the model. Per-route latency, tokens, and recognition quality require a separately version-bound Path A cache.',
    },
    errors: rows.filter((entry) => !entry.correct),
  }
  result.gate.passed = result.metrics.accuracy >= result.gate.required.accuracy
    && result.metrics.complexRecall >= result.gate.required.complexRecall
    && result.metrics.underRoutingRate <= result.gate.required.maxUnderRoutingRate
    && result.metrics.overRoutingRate <= result.gate.required.maxOverRoutingRate
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} finally {
  await vite.close()
}
