import { createHash } from 'node:crypto'

export const ARMS = Object.freeze(['T', 'I', 'IT'])

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function canonical(value) {
  return String(value ?? '')
    .toLowerCase()
    .replaceAll('递交', '提交')
    .replaceAll('填报', '填写')
    .replaceAll('回覆', '回复')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
}

export function flattenTasks(result) {
  if (!result) return []
  return [
    ...(Array.isArray(result.standaloneTasks) ? result.standaloneTasks : []),
    ...(Array.isArray(result.milestones) ? result.milestones : []).flatMap((milestone) => [
      ...(Array.isArray(milestone.tasks) ? milestone.tasks : []),
      ...(Array.isArray(milestone.workPackages) ? milestone.workPackages : []).flatMap((workPackage) => (
        Array.isArray(workPackage.tasks) ? workPackage.tasks : []
      )),
    ]),
  ].filter((task) => task?.selected !== false)
}

function greedyMatches(expected, actual, predicate) {
  const used = new Set()
  let matched = 0
  for (const expectedItem of expected) {
    const index = actual.findIndex((actualItem, actualIndex) => !used.has(actualIndex) && predicate(expectedItem, actualItem))
    if (index >= 0) {
      used.add(index)
      matched += 1
    }
  }
  return { matched, extras: Math.max(0, actual.length - matched), misses: Math.max(0, expected.length - matched) }
}

function localMinute(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  })
  const parts = Object.fromEntries(formatter.formatToParts(parsed).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

function itemText(item, fields) {
  return canonical(fields.map((field) => item?.[field] ?? '').join(' '))
}

function safeF1(tp, predicted, expected) {
  if (!predicted && !expected) return { precision: null, recall: null, f1: null }
  const precision = predicted ? tp / predicted : 0
  const recall = expected ? tp / expected : 0
  return { precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0 }
}

export function classifyHttpFailure(httpStatus, errorCode) {
  if (errorCode === 'INVALID_JSON') return 'json'
  if (errorCode === 'INVALID_AI_RESPONSE') return 'schema'
  if (errorCode === 'SEMANTIC_REJECTION') return 'semantic'
  if (errorCode === 'MODEL_MISMATCH') return 'model'
  if (errorCode === 'UPSTREAM_AUTH_FAILED' || httpStatus === 401 || httpStatus === 403) return 'authentication'
  if (errorCode === 'UPSTREAM_BILLING_BLOCKED' || httpStatus === 402) return 'billing'
  if (errorCode === 'RATE_LIMITED' || httpStatus === 429) return 'rate_limit'
  if (errorCode === 'UPSTREAM_MODEL_UNAVAILABLE') return 'model'
  if (httpStatus === 400 || errorCode === 'INVALID_REQUEST') return 'request'
  return 'transport'
}

export function scoreCase(fixture, arm, result, operational = {}) {
  const status = operational.status ?? (result ? 'invalid_result' : 'request_failure')
  const qualityResult = status === 'completed' ? result : null
  const expected = fixture.expected
  const predictedTasks = flattenTasks(qualityResult)
  const taskMatch = greedyMatches(expected.tasks, predictedTasks, (target, prediction) => {
    const text = itemText(prediction, ['title', 'actionVerb', 'actionObject'])
    return target.verbs.some((verb) => text.includes(canonical(verb)))
      && target.objectTokens.every((token) => text.includes(canonical(token)))
  })
  const forbiddenHits = [...new Set(expected.forbiddenTaskTokens.filter((token) => (
    predictedTasks.some((prediction) => itemText(prediction, ['title', 'actionVerb', 'actionObject']).includes(canonical(token)))
  )))]

  const predictedMaterials = Array.isArray(qualityResult?.materials) ? qualityResult.materials.filter((item) => item?.selected !== false) : []
  const materialMatch = greedyMatches(expected.materials, predictedMaterials, (target, prediction) => {
    const text = itemText(prediction, ['name'])
    return target.tokens.every((token) => text.includes(canonical(token)))
  })

  const predictedTimes = Array.isArray(qualityResult?.timePoints) ? qualityResult.timePoints.filter((item) => item?.selected !== false && item?.normalizedValue) : []
  const timeMatch = greedyMatches(expected.timePoints, predictedTimes, (target, prediction) => (
    target.type === prediction.type && localMinute(target.normalizedValue) === localMinute(prediction.normalizedValue)
  ))

  const predictedEvents = Array.isArray(qualityResult?.events) ? qualityResult.events.filter((item) => item?.selected !== false) : []
  const eventMatch = greedyMatches(expected.events, predictedEvents, (target, prediction) => {
    const text = itemText(prediction, ['title', 'description'])
    return target.titleTokens.every((token) => text.includes(canonical(token)))
  })

  const requiresActionCorrect = Boolean(qualityResult?.sourceSummary?.requiresAction) === expected.requiresAction
  const evidenceReference = arm === 'I' ? fixture.sourceText : fixture.ocrText
  const predictedEvidence = Array.isArray(qualityResult?.evidence) ? qualityResult.evidence : []
  const validEvidenceIds = new Set(predictedEvidence.filter((item) => {
    const quote = typeof item?.quotedText === 'string' ? item.quotedText : item?.quote
    return typeof quote === 'string' && evidenceReference.includes(quote)
  }).map((item) => item.id).filter(Boolean))
  const evidenceValid = validEvidenceIds.size
  const evidenceCount = predictedEvidence.length
  const predictedEntityCount = predictedTasks.length + predictedMaterials.length + predictedTimes.length + predictedEvents.length
  const entities = [...predictedTasks, ...predictedMaterials, ...predictedTimes, ...predictedEvents]
  const coveredEntityCount = entities.filter((entity) => (
    Array.isArray(entity?.evidenceIds) && entity.evidenceIds.some((id) => validEvidenceIds.has(id))
  )).length
  const evidenceValidity = evidenceCount > 0
    ? evidenceValid / evidenceCount
    : predictedEntityCount > 0 ? 0 : null
  const evidenceCoverage = predictedEntityCount > 0 ? coveredEntityCount / predictedEntityCount : null
  const correctionOperations = taskMatch.misses + taskMatch.extras + forbiddenHits.length
    + materialMatch.misses + materialMatch.extras + timeMatch.misses + timeMatch.extras
    + eventMatch.misses + eventMatch.extras + Number(!requiresActionCorrect)
  const majorCorrection = correctionOperations > 0
  const taskMetric = safeF1(taskMatch.matched, predictedTasks.length, expected.tasks.length)

  return {
    caseId: fixture.id,
    scenarioFamilyId: fixture.scenarioFamilyId ?? fixture.id,
    modality: fixture.modality,
    arm,
    status,
    failureReason: status === 'completed' ? null : operational.failureReason ?? 'missing or invalid result',
    failureCategory: status === 'completed' ? null : operational.failureCategory ?? 'unknown',
    task: { ...taskMatch, predicted: predictedTasks.length, expected: expected.tasks.length, ...taskMetric },
    material: { ...materialMatch, predicted: predictedMaterials.length, expected: expected.materials.length },
    timePoint: { ...timeMatch, predicted: predictedTimes.length, expected: expected.timePoints.length },
    event: { ...eventMatch, predicted: predictedEvents.length, expected: expected.events.length },
    forbiddenHits,
    requiresActionCorrect,
    evidence: { valid: evidenceValid, count: evidenceCount, predictedEntityCount, coveredEntityCount, validity: evidenceValidity, coverage: evidenceCoverage },
    completeCase: !majorCorrection,
    majorCorrection,
    correctionOperations,
    latencyMs: operational.latencyMs ?? null,
    tokenUsage: operational.tokenUsage ?? null,
    result: result ?? null,
  }
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function quantile(values, probability) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor(probability * (sorted.length - 1))))
  return sorted[index]
}

export function aggregateArm(arm, observations, options = {}) {
  const tested = options.tested ?? observations.length > 0
  const plannedCount = options.plannedCount ?? observations.length
  if (!tested && observations.length > 0) {
    throw new Error(`UNTESTED_ARM_HAS_OBSERVATIONS:${arm}`)
  }
  if (!tested) {
    return {
      arm,
      runStatus: 'NOT_RUN',
      plannedCount: 0,
      sampleCount: 0,
      completedCount: 0,
      clientValidCount: 0,
      qualityMetricsEligible: false,
      formalCompletionRate: null,
      clientValidityRate: null,
      requestFailureRate: null,
      logicalFailureRate: null,
      task: { precision: null, recall: null, f1: null },
      material: { precision: null, recall: null, f1: null },
      timePoint: { precision: null, recall: null, f1: null },
      event: { precision: null, recall: null, f1: null },
      completeCaseAccuracy: null,
      majorCorrectionRate: null,
      requiresActionAccuracy: null,
      forbiddenTaskRate: null,
      evidenceValidity: null,
      evidenceCoverage: null,
      automatedCorrectionBurdenProxy: { meanOperations: null, medianOperations: null, p95Operations: null },
      observedUserModificationTimeSeconds: null,
      latencyMs: { mean: null, p95: null },
      failureCountsByCategory: {},
    }
  }
  const completed = observations.filter((item) => item.status === 'completed')
  const requestFailures = observations.filter((item) => item.status === 'request_failure')
  const qualityMetricsEligible = plannedCount > 0 && observations.length === plannedCount && completed.length === plannedCount
  const qualityObservations = qualityMetricsEligible ? completed : []
  const sum = (selector) => qualityObservations.reduce((total, item) => total + selector(item), 0)
  const unavailable = { precision: null, recall: null, f1: null }
  const task = qualityObservations.length ? safeF1(sum((item) => item.task.matched), sum((item) => item.task.predicted), sum((item) => item.task.expected)) : unavailable
  const material = qualityObservations.length ? safeF1(sum((item) => item.material.matched), sum((item) => item.material.predicted), sum((item) => item.material.expected)) : unavailable
  const timePoint = qualityObservations.length ? safeF1(sum((item) => item.timePoint.matched), sum((item) => item.timePoint.predicted), sum((item) => item.timePoint.expected)) : unavailable
  const event = qualityObservations.length ? safeF1(sum((item) => item.event.matched), sum((item) => item.event.predicted), sum((item) => item.event.expected)) : unavailable
  const latency = completed.map((item) => item.latencyMs).filter(Number.isFinite)
  const correction = qualityObservations.map((item) => item.correctionOperations)
  const evidenceValidity = qualityObservations.map((item) => item.evidence.validity).filter(Number.isFinite)
  const evidenceCoverage = qualityObservations.map((item) => item.evidence.coverage).filter(Number.isFinite)
  const failureCountsByCategory = observations.filter((item) => item.status !== 'completed').reduce((counts, item) => ({
    ...counts,
    [item.failureCategory ?? 'unknown']: (counts[item.failureCategory ?? 'unknown'] ?? 0) + 1,
  }), {})
  return {
    arm,
    runStatus: qualityMetricsEligible ? 'VALID_RUN' : 'INVALID_RUN',
    plannedCount,
    sampleCount: observations.length,
    completedCount: completed.length,
    clientValidCount: completed.length,
    qualityMetricsEligible,
    formalCompletionRate: plannedCount ? completed.length / plannedCount : null,
    clientValidityRate: plannedCount ? completed.length / plannedCount : null,
    requestFailureRate: plannedCount ? requestFailures.length / plannedCount : null,
    logicalFailureRate: plannedCount ? (plannedCount - completed.length) / plannedCount : null,
    task,
    material,
    timePoint,
    event,
    completeCaseAccuracy: qualityObservations.length ? sum((item) => Number(item.completeCase)) / qualityObservations.length : null,
    majorCorrectionRate: qualityObservations.length ? sum((item) => Number(item.majorCorrection)) / qualityObservations.length : null,
    requiresActionAccuracy: qualityObservations.length ? sum((item) => Number(item.requiresActionCorrect)) / qualityObservations.length : null,
    forbiddenTaskRate: qualityObservations.length ? sum((item) => Number(item.forbiddenHits.length > 0)) / qualityObservations.length : null,
    evidenceValidity: evidenceValidity.length ? evidenceValidity.reduce((total, value) => total + value, 0) / evidenceValidity.length : null,
    evidenceCoverage: evidenceCoverage.length ? evidenceCoverage.reduce((total, value) => total + value, 0) / evidenceCoverage.length : null,
    automatedCorrectionBurdenProxy: {
      meanOperations: qualityObservations.length ? sum((item) => item.correctionOperations) / qualityObservations.length : null,
      medianOperations: median(correction),
      p95Operations: quantile(correction, 0.95),
    },
    observedUserModificationTimeSeconds: null,
    latencyMs: {
      mean: latency.length ? latency.reduce((total, value) => total + value, 0) / latency.length : null,
      p95: quantile(latency, 0.95),
    },
    failureCountsByCategory,
  }
}

function seededRandom(seed) {
  let state = Number.parseInt(sha256(seed).slice(0, 8), 16) >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0x100000000
  }
}

export function pairedBootstrap(observationsByArm, candidateArm, baselineArm, selector, seed, iterations = 5000) {
  const candidate = new Map(observationsByArm[candidateArm].filter((item) => item.status === 'completed').map((item) => [item.caseId, item]))
  const pairs = observationsByArm[baselineArm]
    .filter((item) => item.status === 'completed' && candidate.has(item.caseId))
    .map((baseline) => [candidate.get(baseline.caseId), baseline])
    .filter(([candidateItem, baselineItem]) => Number.isFinite(selector(candidateItem)) && Number.isFinite(selector(baselineItem)))
  if (!pairs.length) return { pairedCount: 0, clusterCount: 0, delta: null, ci95: [null, null] }
  const clustered = new Map()
  for (const [candidateItem, baselineItem] of pairs) {
    const clusterId = candidateItem.scenarioFamilyId ?? baselineItem.scenarioFamilyId ?? candidateItem.caseId
    const values = clustered.get(clusterId) ?? []
    values.push(selector(candidateItem) - selector(baselineItem))
    clustered.set(clusterId, values)
  }
  const clusters = [...clustered.values()]
  const raw = clusters.flat()
  const delta = raw.reduce((total, value) => total + value, 0) / raw.length
  const random = seededRandom(seed)
  const samples = []
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const sampled = []
    for (let index = 0; index < clusters.length; index += 1) {
      sampled.push(...clusters[Math.floor(random() * clusters.length)])
    }
    samples.push(sampled.reduce((total, value) => total + value, 0) / sampled.length)
  }
  return { pairedCount: pairs.length, clusterCount: clusters.length, delta, ci95: [quantile(samples, 0.025), quantile(samples, 0.975)] }
}

function pairedComparison(metricsByArm, observationsByArm, candidateArm, baselineArm, selector, seed) {
  if (metricsByArm[candidateArm].runStatus === 'NOT_RUN' || metricsByArm[baselineArm].runStatus === 'NOT_RUN') {
    return { status: 'NOT_RUN', pairedCount: 0, clusterCount: 0, delta: null, ci95: [null, null] }
  }
  if (!metricsByArm[candidateArm].qualityMetricsEligible || !metricsByArm[baselineArm].qualityMetricsEligible) {
    return { status: 'INVALID_RUN', pairedCount: 0, clusterCount: 0, delta: null, ci95: [null, null] }
  }
  return { status: 'SCOREABLE', ...pairedBootstrap(observationsByArm, candidateArm, baselineArm, selector, seed) }
}

export function summarizeEvaluation(dataset, observations, options = {}) {
  const testedArms = options.testedArms ?? ARMS
  const observationsByArm = Object.fromEntries(ARMS.map((arm) => [arm, observations.filter((item) => item.arm === arm)]))
  const metricsByArm = Object.fromEntries(ARMS.map((arm) => [arm, aggregateArm(arm, observationsByArm[arm], {
    tested: testedArms.includes(arm),
    plannedCount: testedArms.includes(arm) ? dataset.sampleCount : 0,
  })]))
  const taskF1 = (item) => item.task.f1
  const correctionBenefit = (item) => -item.correctionOperations
  return {
    schemaVersion: 'multimodal-evaluation-summary-1.2.0',
    datasetId: dataset.datasetId,
    datasetSha256: dataset.datasetSha256,
    sampleCountPerArm: dataset.sampleCount,
    metricsByArm,
    pairedComparisons: {
      IT_vs_T_taskF1: pairedComparison(metricsByArm, observationsByArm, 'IT', 'T', taskF1, `${dataset.datasetSha256}:it-t:f1`),
      IT_vs_I_taskF1: pairedComparison(metricsByArm, observationsByArm, 'IT', 'I', taskF1, `${dataset.datasetSha256}:it-i:f1`),
      IT_vs_T_correctionBurdenBenefit: pairedComparison(metricsByArm, observationsByArm, 'IT', 'T', correctionBenefit, `${dataset.datasetSha256}:it-t:correction`),
      IT_vs_I_correctionBurdenBenefit: pairedComparison(metricsByArm, observationsByArm, 'IT', 'I', correctionBenefit, `${dataset.datasetSha256}:it-i:correction`),
    },
    humanTiming: {
      status: 'NOT_RUN',
      reason: 'No human participant completed the editable confirmation flow; automated correction operations are a proxy, not time.',
    },
  }
}
