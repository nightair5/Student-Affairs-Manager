import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

const ROOT = process.cwd()
const TARGET_ISSUES = ['MISSING_TASK', 'MISSING_TIMEPOINT', 'WRONG_TIME_ROLE', 'MISSING_AMBIGUITY', 'EVENT_TASK_CONFUSION']
const LEVEL_INDEX = { simple: 0, medium: 1, complex: 2 }

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
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

function predictedTargetIssues(report) {
  const predicted = new Set()
  for (const issue of report.issues) {
    if (issue.code === 'MISSING_ACTION') predicted.add('MISSING_TASK')
    if (issue.code === 'MISSING_TIMEPOINT') predicted.add('MISSING_TIMEPOINT')
    if (issue.code === 'FALSE_PRECISION') predicted.add('WRONG_TIME_ROLE')
    if (issue.code === 'MISSING_TIME_AMBIGUITY') predicted.add('MISSING_AMBIGUITY')
    if (issue.code === 'MISSING_EVENT') predicted.add('EVENT_TASK_CONFUSION')
  }
  return predicted
}

function assertLabels(routerLabels, validatorLabels, fixtures) {
  if (routerLabels.labels.length < 60) throw new Error('Router label set must contain at least 60 cases')
  if (validatorLabels.labels.length < 60) throw new Error('Validator label set must contain at least 60 cases')
  for (const collection of [routerLabels.labels, validatorLabels.labels]) {
    const ids = collection.map((entry) => entry.caseId)
    if (new Set(ids).size !== ids.length) throw new Error('Label set contains duplicate case IDs')
    for (const id of ids) if (!fixtures.has(id)) throw new Error(`Unknown labeled case: ${id}`)
  }
  for (const entry of validatorLabels.labels) {
    if (!Array.isArray(entry.expectedIssues) || entry.expectedIssues.length === 0) throw new Error(`Missing expected issues: ${entry.caseId}`)
    if (entry.expectedIssues.includes('NO_ISSUE') && entry.expectedIssues.length !== 1) throw new Error(`NO_ISSUE must be exclusive: ${entry.caseId}`)
    for (const issue of entry.expectedIssues) {
      if (issue !== 'NO_ISSUE' && !TARGET_ISSUES.includes(issue)) throw new Error(`Unknown issue ${issue}: ${entry.caseId}`)
    }
  }
}

async function main() {
  const cacheRoot = path.resolve(ROOT, option('cache-root', '.evaluation-cache'))
  const output = option('output')
  const routerLabels = await readJson(path.join(ROOT, 'docs/e2-factledger/d6-router-labels.json'))
  const validatorLabels = await readJson(path.join(ROOT, 'docs/e2-factledger/d6-validator-labels.json'))
  const cacheFiles = {
    golden: 'deepseek-production-golden-g8-regression-2-4-1.json',
    exposed_holdout: 'deepseek-production-holdout-g8-regression-2-4-1.json',
    development: 'deepseek-production-generalization-g8-after-2-4-1.json',
  }
  const cacheEntries = (await Promise.all(Object.entries(cacheFiles).map(async ([sourceSet, file]) => (
    (await readJson(path.join(cacheRoot, file))).map((entry) => ({ ...entry, sourceSet }))
  )))).flat()
  const cacheById = new Map(cacheEntries.map((entry) => [entry.caseId, entry]))

  const vite = await createServer({
    root: ROOT,
    appType: 'custom',
    logLevel: 'error',
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true },
  })
  try {
    const [golden, holdout, development, router, validator] = await Promise.all([
      vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
      vite.ssrLoadModule('/src/recognition/complexityRouter.ts'),
      vite.ssrLoadModule('/src/recognition/qualityValidator.ts'),
    ])
    const fixtures = new Map([
      ...golden.recognitionGoldenDataset,
      ...holdout.recognitionHoldoutDataset,
      ...development.recognitionGeneralizationDevelopmentDataset,
    ].map((entry) => [entry.id, entry]))
    assertLabels(routerLabels, validatorLabels, fixtures)

    const routerRows = routerLabels.labels.map((entry) => {
      const fixture = fixtures.get(entry.caseId)
      const route = router.routeRecognitionSource(fixture.rawText)
      return { ...entry, predicted: route.level, score: route.score, correct: route.level === entry.label }
    })
    const routerConfusion = count(routerRows.map((entry) => `${entry.label}->${entry.predicted}`))
    const complexRows = routerRows.filter((entry) => entry.label === 'complex')
    const simpleRows = routerRows.filter((entry) => entry.label === 'simple')
    const underRouted = routerRows.filter((entry) => LEVEL_INDEX[entry.predicted] < LEVEL_INDEX[entry.label])
    const overRouted = routerRows.filter((entry) => LEVEL_INDEX[entry.predicted] > LEVEL_INDEX[entry.label])

    const validatorRows = validatorLabels.labels.map((entry) => {
      const fixture = fixtures.get(entry.caseId)
      const cached = cacheById.get(entry.caseId)
      if (!cached?.result || cached.status !== 'ok') throw new Error(`Missing completed recognition-2.4.1 result: ${entry.caseId}`)
      if (cached.result.promptVersion !== 'recognition-2.4.1') throw new Error(`Prompt version drift: ${entry.caseId}`)
      if (cached.result.modelName !== 'deepseek-v4-flash') throw new Error(`Model drift: ${entry.caseId}`)
      const expected = new Set(entry.expectedIssues.filter((issue) => issue !== 'NO_ISSUE'))
      const rawReport = validator.validateRecognitionQuality(cached.result, fixture.rawText)
      const predicted = predictedTargetIssues(rawReport)
      return {
        caseId: entry.caseId,
        sourceSet: entry.sourceSet,
        expected: expected.size ? [...expected] : ['NO_ISSUE'],
        predicted: predicted.size ? [...predicted] : ['NO_ISSUE'],
        rawValidatorCodes: rawReport.issues.map((issue) => issue.code),
      }
    })

    const perIssue = Object.fromEntries(TARGET_ISSUES.map((issue) => {
      let tp = 0; let fp = 0; let fn = 0
      for (const row of validatorRows) {
        const expected = row.expected.includes(issue)
        const predicted = row.predicted.includes(issue)
        if (expected && predicted) tp += 1
        if (!expected && predicted) fp += 1
        if (expected && !predicted) fn += 1
      }
      return [issue, { truePositive: tp, falsePositive: fp, falseNegative: fn, precision: ratio(tp, tp + fp), recall: ratio(tp, tp + fn) }]
    }))
    const micro = Object.values(perIssue).reduce((sum, value) => ({
      truePositive: sum.truePositive + value.truePositive,
      falsePositive: sum.falsePositive + value.falsePositive,
      falseNegative: sum.falseNegative + value.falseNegative,
    }), { truePositive: 0, falsePositive: 0, falseNegative: 0 })
    const noIssue = validatorRows.filter((row) => row.expected[0] === 'NO_ISSUE')
    const report = {
      schemaVersion: 'e2.5-d6-metrics-1.0.0',
      datasetStatus: 'EXPOSED_DIAGNOSTIC_ONLY',
      baseline: { promptVersion: 'recognition-2.4.1', routerVersion: router.RECOGNITION_ROUTER_VERSION, validatorVersion: validator.RECOGNITION_VALIDATOR_VERSION },
      router: {
        sampleCount: routerRows.length,
        labelDistribution: count(routerRows.map((entry) => entry.label)),
        predictedDistribution: count(routerRows.map((entry) => entry.predicted)),
        accuracy: ratio(routerRows.filter((entry) => entry.correct).length, routerRows.length),
        exact: routerRows.filter((entry) => entry.correct).length,
        underRouted: underRouted.length,
        overRouted: overRouted.length,
        complexToSimpleUnderRoutingRate: ratio(complexRows.filter((entry) => entry.predicted === 'simple').length, complexRows.length),
        simpleToComplexOverRoutingRate: ratio(simpleRows.filter((entry) => entry.predicted === 'complex').length, simpleRows.length),
        confusion: routerConfusion,
        errors: routerRows.filter((entry) => !entry.correct).map(({ caseId, label, predicted, score }) => ({ caseId, expected: label, predicted, score })),
      },
      validator: {
        sampleCount: validatorRows.length,
        expectedIssueCounts: count(validatorRows.flatMap((entry) => entry.expected)),
        predictedIssueCounts: count(validatorRows.flatMap((entry) => entry.predicted)),
        micro: { ...micro, precision: ratio(micro.truePositive, micro.truePositive + micro.falsePositive), recall: ratio(micro.truePositive, micro.truePositive + micro.falseNegative) },
        perIssue,
        noIssueSpecificity: ratio(noIssue.filter((row) => row.predicted[0] === 'NO_ISSUE').length, noIssue.length),
        rows: validatorRows,
      },
      notes: [
        'Labels were authored against exposed source and final output; this is diagnostic, not blind evidence.',
        'MISSING_ACTION maps to MISSING_TASK; FALSE_PRECISION maps to WRONG_TIME_ROLE; MISSING_TIME_AMBIGUITY maps to MISSING_AMBIGUITY; MISSING_EVENT maps to EVENT_TASK_CONFUSION.',
        'The current validator has no direct code for wrong business time type or task/event boundary, so these recalls are expected to expose contract gaps.',
        'Repair triggering is not used as a correctness label.',
      ],
    }
    const json = `${JSON.stringify(report, null, 2)}\n`
    if (output) await writeFile(path.resolve(ROOT, output), json, 'utf8')
    process.stdout.write(json)
  } finally {
    await vite.close()
  }
}

await main()
