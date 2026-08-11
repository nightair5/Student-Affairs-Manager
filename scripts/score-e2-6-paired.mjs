import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

const ROOT = process.cwd()

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}

function percentile(values, quantile) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)]
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function combination(n, k) {
  let value = 1
  for (let index = 1; index <= k; index += 1) value = value * (n - index + 1) / index
  return value
}

function exactMcNemar(improved, worsened) {
  const discordant = improved + worsened
  if (!discordant) return { improved, worsened, discordant, twoSidedPValue: 1 }
  const tail = Math.min(improved, worsened)
  let cumulative = 0
  for (let index = 0; index <= tail; index += 1) cumulative += combination(discordant, index) * (0.5 ** discordant)
  return { improved, worsened, discordant, twoSidedPValue: Math.min(1, cumulative * 2) }
}

function canonicalInput(input) {
  return JSON.stringify({
    sourceType: input.sourceType,
    sourceTitle: input.sourceTitle,
    sourceText: input.content,
    referenceTime: input.referenceTime,
    timezone: input.timezone,
  })
}

function observedUsage(observation) {
  if (observation.status === 'ok') return observation.response.tokenUsage ?? null
  return observation.failureResponse?.diagnostic?.operation?.tokenUsage ?? null
}

function summarizeUsage(observations) {
  const observed = observations.map(observedUsage).filter(Boolean)
  const total = observed.reduce((sum, usage) => ({ input: sum.input + usage.input, output: sum.output + usage.output }), { input: 0, output: 0 })
  return {
    observedCount: observed.length,
    missingCount: observations.length - observed.length,
    total,
    meanPerInvocation: observed.length ? { input: total.input / observed.length, output: total.output / observed.length } : null,
  }
}

function factRecallProxy(results) {
  const numerator = results.reduce((sum, item) => sum + item.scores.taskTruePositive + item.scores.materialMatched + item.scores.timePointDetected + item.scores.eventMatched + item.scores.ambiguityMatched, 0)
  const denominator = results.reduce((sum, item) => sum + item.scores.taskExpected + item.scores.materialExpected + item.scores.timePointExpected + item.scores.eventExpected + item.scores.ambiguityExpected, 0)
  return { value: denominator ? numerator / denominator : 1, matched: numerator, expected: denominator, definition: 'final-output proxy over Task+Material+detected TimePoint+Event+Ambiguity fact units' }
}

function factLedgerAsRecognitionResult(ledger) {
  const safeLedger = ledger ?? {}
  return {
    schemaVersion: '2.0',
    promptVersion: 'fact-ledger-extraction-diagnostic',
    modelName: 'deepseek-v4-flash',
    createdAt: '1970-01-01T00:00:00.000Z',
    sourceSummary: '',
    projectMatch: { decision: 'new_project', confidence: 0, reasons: [], candidateProjectId: null, suggestedProjectTitle: null },
    projectSuggestion: null,
    milestones: [],
    standaloneTasks: (safeLedger.obligations ?? []).map((item) => ({
      tempId: item.id,
      title: `${item.actionPredicate ?? ''}${item.object ?? ''}`,
      actionVerb: item.actionPredicate ?? '',
      actionObject: item.object ?? '',
      hierarchyType: 'task',
      parentTempId: null,
      timePointTempIds: item.timeExpressionIds ?? [],
      evidenceIds: item.evidenceIds ?? [],
    })),
    materials: (safeLedger.materials ?? []).map((item) => ({ tempId: item.id, name: item.name ?? '', evidenceIds: item.evidenceIds ?? [] })),
    timePoints: (safeLedger.timeExpressions ?? []).map((item) => ({
      tempId: item.id,
      type: item.role,
      rawText: item.rawText ?? '',
      normalizedValue: item.normalizedValue ?? null,
      endNormalizedValue: item.endNormalizedValue ?? null,
      precision: item.precision,
      needsConfirmation: item.needsConfirmation === true,
      evidenceIds: item.evidenceIds ?? [],
    })),
    events: (safeLedger.events ?? []).map((item) => ({ tempId: item.id, title: item.title ?? item.name ?? '', evidenceIds: item.evidenceIds ?? [] })),
    evidence: (safeLedger.evidence ?? []).map((item) => ({ id: item.id, quote: item.quote, quotedText: item.quote })),
    conflicts: [],
    ambiguities: (safeLedger.ambiguities ?? []).map((item) => ({
      id: item.id,
      field: (item.targetFactIds ?? []).join(' '),
      message: item.message ?? '',
    })),
    ignoredContent: [],
    quality: {},
  }
}

function selectMetrics(metrics) {
  return {
    taskPrecision: metrics.taskPrecision,
    taskRecall: metrics.taskRecall,
    materialPrecision: metrics.materialPrecision,
    materialRecall: metrics.materialRecall,
    timeRoleAccuracy: metrics.timePointTypeAccuracy,
    timeValueAccuracy: metrics.timePointValueAccuracy,
    milestonePrecision: metrics.milestonePrecision,
    milestoneRecall: metrics.milestoneRecall,
    eventAccuracy: metrics.eventAccuracy,
    ambiguityPrecision: metrics.ambiguityPrecision,
    ambiguityRecall: metrics.ambiguityRecall,
    evidenceCoverage: metrics.evidenceCoverage,
    evidenceValidity: metrics.evidenceValidity,
    strictMajorCorrectionRate: metrics.majorCorrectionRate,
    severeErrorRate: metrics.severeErrorRate,
    invalidOutputRate: metrics.invalidOutputRate,
    requestFailureRate: metrics.requestFailureRate,
  }
}

function failureCode(observation) {
  return observation.error?.split(':').slice(0, 2).join(':') ?? 'UNKNOWN'
}

async function main() {
  const rawPath = path.resolve(ROOT, option('raw'))
  const manifestPath = path.resolve(ROOT, option('manifest', '.evaluation-cache/e2-6/input-manifest.json'))
  if (!option('raw')) throw new Error('Missing --raw')
  const [rawBytes, manifestBytes] = await Promise.all([readFile(rawPath), readFile(manifestPath)])
  const raw = JSON.parse(rawBytes.toString('utf8'))
  const manifest = JSON.parse(manifestBytes.toString('utf8'))
  if (!raw.generationCompletedAt || raw.observations.length !== 48 || raw.schedule.length !== 48) throw new Error('Generation is not closed at 48 observations')
  if (raw.generationExpectedDataLoaded !== false) throw new Error('Generation firewall assertion missing')
  if (raw.manifestSha256 !== hash(manifestBytes)) throw new Error('Raw/manifest hash mismatch')
  const observationsByKey = new Map(raw.observations.map((entry) => [`${entry.caseId}:${entry.path}`, entry]))
  const manifestById = new Map(manifest.cases.map((entry) => [entry.caseId, entry]))
  for (const scheduled of raw.schedule) {
    const observation = observationsByKey.get(`${scheduled.caseId}:${scheduled.path}`)
    const input = manifestById.get(scheduled.caseId)
    if (!observation || observation.sequence !== scheduled.sequence) throw new Error(`Missing scheduled observation ${scheduled.caseId}/${scheduled.path}`)
    if (hash(input.input.content) !== input.sourceSha256 || hash(canonicalInput(input.input)) !== input.inputSha256) throw new Error(`Manifest drift ${scheduled.caseId}`)
    if (observation.status === 'ok') {
      if (observation.response.hashes.sourceSha256 !== input.sourceSha256 || observation.response.hashes.inputSha256 !== input.inputSha256) throw new Error(`Response input drift ${scheduled.caseId}/${scheduled.path}`)
      if (hash(JSON.stringify(observation.response.result)) !== observation.response.hashes.resultSha256) throw new Error(`Response result hash drift ${scheduled.caseId}/${scheduled.path}`)
      if (scheduled.path === 'B' && hash(JSON.stringify(observation.response.ledger)) !== observation.response.hashes.ledgerSha256) throw new Error(`Response ledger hash drift ${scheduled.caseId}`)
    }
  }

  const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', server: { middlewareMode: true } })
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
    ].map((fixture) => [fixture.id, fixture]))
    const scorePath = (pathName) => manifest.cases.map((input) => {
      const fixture = fixtures.get(input.caseId)
      const observation = observationsByKey.get(`${input.caseId}:${pathName}`)
      if (!fixture || !observation) throw new Error(`Missing fixture/observation ${input.caseId}/${pathName}`)
      if (observation.status === 'ok') {
        return scoring.scoreRecognitionCase(fixture, 'deepseek-production', observation.response.result, observation.response.latencyMs, {
          tokenUsage: observation.response.tokenUsage,
          costUsd: null,
        })
      }
      const invalid = observation.error?.includes('HTTP_422')
      return scoring.scoreRecognitionCase(fixture, 'deepseek-production', null, observation.roundTripLatencyMs, {
        status: invalid ? 'invalid_output' : 'request_failure',
        failureReason: observation.error,
        tokenUsage: observedUsage(observation),
        costUsd: null,
      })
    })
    const scored = { A: scorePath('A'), B: scorePath('B') }
    const factLedgerScored = manifest.cases.map((input) => {
      const fixture = fixtures.get(input.caseId)
      const observation = observationsByKey.get(`${input.caseId}:B`)
      return scoring.scoreRecognitionCase(fixture, 'deepseek-production', factLedgerAsRecognitionResult(observation.status === 'ok' ? observation.response.ledger : null), 0, {
        tokenUsage: null,
        costUsd: null,
      })
    })
    const aggregate = {
      A: scoring.aggregateRecognitionMetrics('deepseek-production', scored.A),
      B: scoring.aggregateRecognitionMetrics('deepseek-production', scored.B),
    }
    const pathSummary = (pathName) => {
      const observations = raw.observations.filter((entry) => entry.path === pathName)
      const metrics = aggregate[pathName]
      const latencies = observations.map((entry) => entry.status === 'ok' ? entry.response.latencyMs : entry.roundTripLatencyMs)
      const failures = observations.filter((entry) => entry.status !== 'ok')
      return {
        invocationCount: observations.length,
        completedOutputCount: observations.length - failures.length,
        failedOutputCount: failures.length,
        failureCodes: Object.entries(failures.reduce((counts, entry) => ({ ...counts, [failureCode(entry)]: (counts[failureCode(entry)] ?? 0) + 1 }), {})).map(([code, count]) => ({ code, count })),
        factRecall: factRecallProxy(scored[pathName]),
        metrics: selectMetrics(metrics),
        latencyMs: { mean: average(latencies), p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) },
        tokenUsage: summarizeUsage(observations),
      }
    }
    const pathA = pathSummary('A')
    const pathB = pathSummary('B')
    const factLedgerAggregate = scoring.aggregateRecognitionMetrics('deepseek-production', factLedgerScored)
    pathB.factLedgerExtractionDiagnostic = {
      evaluationType: 'post-generation read-only projection of validated Ledger facts through the frozen scorer; failures count as empty ledgers; not the Path B final output',
      factRecall: factRecallProxy(factLedgerScored),
      metrics: selectMetrics(factLedgerAggregate),
    }
    const delta = Object.fromEntries(Object.keys(pathA.metrics).map((key) => [key, pathB.metrics[key] - pathA.metrics[key]]))
    const completePairCount = manifest.cases.filter((entry) => observationsByKey.get(`${entry.caseId}:A`)?.status === 'ok' && observationsByKey.get(`${entry.caseId}:B`)?.status === 'ok').length
    const result = {
      schemaVersion: 'e2.6-paired-results-1.0.0',
      status: raw.status === 'COMPLETE' ? 'SCORED' : 'SCORED_INTENT_TO_TREAT_WITH_PARTIAL_OUTPUTS',
      conclusion: 'PENDING_HUMAN_IMPACT_ADJUDICATION',
      sampleCount: 24,
      completePairCount,
      evaluationType: 'exposed diagnostic; strict scorer; failed invocations included as severe/major',
      raw: { label: raw.label, sha256: hash(rawBytes), manifestSha256: raw.manifestSha256, scheduleSha256: raw.scheduleSha256, generationExpectedDataLoaded: raw.generationExpectedDataLoaded },
      versions: { model: raw.model, experiment: 'e2.6-paired-ab-1.2.0', pathA: 'recognition-2.4.1', factExtraction: 'fact-ledger-extraction-1.2.0', planner: 'fact-ledger-planner-1.0.0' },
      pathA,
      pathB,
      deltaBMinusA: {
        factRecall: pathB.factRecall.value - pathA.factRecall.value,
        ...delta,
        latencyMeanMs: pathB.latencyMs.mean - pathA.latencyMs.mean,
        observedMeanInputTokens: pathB.tokenUsage.meanPerInvocation.input - pathA.tokenUsage.meanPerInvocation.input,
        observedMeanOutputTokens: pathB.tokenUsage.meanPerInvocation.output - pathA.tokenUsage.meanPerInvocation.output,
      },
      humanImpact: { status: 'NOT_RUN', planningError: null, userImpactMajorCorrection: null },
      thresholdDecision: { status: 'PENDING_HUMAN_IMPACT_ADJUDICATION' },
    }
    const packetCases = manifest.cases.map((input, index) => {
      const fixture = fixtures.get(input.caseId)
      const a = observationsByKey.get(`${input.caseId}:A`)
      const b = observationsByKey.get(`${input.caseId}:B`)
      const swap = Number.parseInt(hash(`e2.6-adjudication:${input.caseId}`).slice(0, 2), 16) % 2 === 1
      const output = (observation) => observation.status === 'ok' ? observation.response.result : { generationFailure: observation.error }
      return {
        pairId: `P${String(index + 1).padStart(2, '0')}`,
        source: input.input,
        expected: fixture.expected,
        sideX: output(swap ? b : a),
        sideY: output(swap ? a : b),
      }
    })
    const adjudicationKey = Object.fromEntries(manifest.cases.map((input, index) => {
      const swap = Number.parseInt(hash(`e2.6-adjudication:${input.caseId}`).slice(0, 2), 16) % 2 === 1
      return [`P${String(index + 1).padStart(2, '0')}`, { X: swap ? 'B' : 'A', Y: swap ? 'A' : 'B' }]
    }))
    const labelsOption = option('labels')
    if (labelsOption) {
      const labelsPath = path.resolve(ROOT, labelsOption)
      const labelBytes = await readFile(labelsPath)
      const adjudication = JSON.parse(labelBytes.toString('utf8'))
      if (adjudication.pathBlindedAtLabelTime !== true || adjudication.labels?.length !== 48) throw new Error('Incomplete or unblinded adjudication labels')
      const pathLabels = { A: [], B: [] }
      const seen = new Set()
      for (const label of adjudication.labels) {
        const key = `${label.pairId}:${label.side}`
        if (seen.has(key) || !adjudicationKey[label.pairId]?.[label.side]) throw new Error(`Invalid adjudication label ${key}`)
        seen.add(key)
        pathLabels[adjudicationKey[label.pairId][label.side]].push(label)
      }
      if (pathLabels.A.length !== 24 || pathLabels.B.length !== 24) throw new Error('Adjudication path coverage mismatch')
      const summarizeBinary = (field) => {
        const count = (pathName) => pathLabels[pathName].filter((label) => label[field] === true).length
        const aCount = count('A')
        const bCount = count('B')
        let improved = 0
        let worsened = 0
        for (const pairId of Object.keys(adjudicationKey)) {
          const pair = adjudication.labels.filter((label) => label.pairId === pairId)
          const a = pair.find((label) => adjudicationKey[pairId][label.side] === 'A')?.[field]
          const b = pair.find((label) => adjudicationKey[pairId][label.side] === 'B')?.[field]
          if (a === true && b === false) improved += 1
          if (a === false && b === true) worsened += 1
        }
        return {
          pathA: { count: aCount, total: 24, rate: aCount / 24 },
          pathB: { count: bCount, total: 24, rate: bCount / 24 },
          deltaBMinusA: (bCount - aCount) / 24,
          pairedExactMcNemar: exactMcNemar(improved, worsened),
        }
      }
      const planningError = summarizeBinary('planningError')
      const userImpactMajorCorrection = summarizeBinary('userImpactMajor')
      const planningOrGenerationFailure = {}
      for (const pathName of ['A', 'B']) {
        let count = 0
        for (let index = 0; index < manifest.cases.length; index += 1) {
          const pairId = `P${String(index + 1).padStart(2, '0')}`
          const label = pathLabels[pathName].find((entry) => entry.pairId === pairId)
          const observation = observationsByKey.get(`${manifest.cases[index].caseId}:${pathName}`)
          if (label.planningError || observation.status !== 'ok') count += 1
        }
        planningOrGenerationFailure[pathName] = { count, total: 24, rate: count / 24 }
      }
      planningOrGenerationFailure.deltaBMinusA = planningOrGenerationFailure.B.rate - planningOrGenerationFailure.A.rate
      result.humanImpact = {
        status: 'COMPLETE_PATH_BLINDED',
        labelsSha256: hash(labelBytes),
        definitions: adjudication.definitions,
        planningError,
        planningOrGenerationFailure,
        userImpactMajorCorrection,
      }
      const gates = {
        primaryGain: result.deltaBMinusA.taskRecall >= 0.08 || userImpactMajorCorrection.deltaBMinusA <= -0.15,
        taskPrecisionDeltaAtLeastMinusThreePoints: result.deltaBMinusA.taskPrecision >= -0.03,
        evidenceCoverageAtLeast95Percent: result.pathB.metrics.evidenceCoverage >= 0.95,
        severeErrorDoesNotIncrease: result.deltaBMinusA.severeErrorRate <= 0,
        planningErrorActuallyDecreases: planningError.deltaBMinusA < 0,
      }
      result.thresholdDecision = { status: Object.values(gates).every(Boolean) ? 'PASS' : 'FAIL', gates }
      result.conclusion = result.thresholdDecision.status === 'PASS' ? 'FACTLEDGER SUPPORTED' : 'FACTLEDGER NOT SUPPORTED'
    }
    const docsDir = path.join(ROOT, 'docs', 'e2-factledger-ab')
    const cacheDir = path.join(ROOT, '.evaluation-cache', 'e2-6')
    await Promise.all([mkdir(docsDir, { recursive: true }), mkdir(cacheDir, { recursive: true })])
    await Promise.all([
      writeFile(path.join(docsDir, 'e2-6-results.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8'),
      writeFile(path.join(cacheDir, `${raw.label}-adjudication-packet.json`), `${JSON.stringify({ schemaVersion: 'e2.6-adjudication-packet-1.0.0', pathBlinded: true, cases: packetCases }, null, 2)}\n`, 'utf8'),
      writeFile(path.join(cacheDir, `${raw.label}-adjudication-key.json`), `${JSON.stringify(adjudicationKey, null, 2)}\n`, 'utf8'),
    ])
    process.stdout.write(`${JSON.stringify({ output: 'docs/e2-factledger-ab/e2-6-results.json', rawSha256: result.raw.sha256, completePairCount, pathA: pathA.metrics, pathB: pathB.metrics, delta: result.deltaBMinusA }, null, 2)}\n`)
  } finally {
    await vite.close()
  }
}

await main()
