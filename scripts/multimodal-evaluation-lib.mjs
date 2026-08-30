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
  ]
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
  const precision = predicted ? tp / predicted : expected ? 0 : 1
  const recall = expected ? tp / expected : predicted ? 0 : 1
  return { precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0 }
}

export function scoreCase(fixture, arm, result, operational = {}) {
  const expected = fixture.expected
  const predictedTasks = flattenTasks(result)
  const taskMatch = greedyMatches(expected.tasks, predictedTasks, (target, prediction) => {
    const text = itemText(prediction, ['title', 'actionVerb', 'actionObject', 'description'])
    return target.verbs.some((verb) => text.includes(canonical(verb)))
      && target.objectTokens.every((token) => text.includes(canonical(token)))
  })
  const forbiddenHits = [...new Set(expected.forbiddenTaskTokens.filter((token) => (
    predictedTasks.some((prediction) => itemText(prediction, ['title', 'actionVerb', 'actionObject', 'description']).includes(canonical(token)))
  )))]

  const predictedMaterials = Array.isArray(result?.materials) ? result.materials : []
  const materialMatch = greedyMatches(expected.materials, predictedMaterials, (target, prediction) => {
    const text = itemText(prediction, ['name'])
    return target.tokens.every((token) => text.includes(canonical(token)))
  })

  const predictedTimes = Array.isArray(result?.timePoints) ? result.timePoints.filter((item) => item?.normalizedValue) : []
  const timeMatch = greedyMatches(expected.timePoints, predictedTimes, (target, prediction) => (
    target.type === prediction.type && localMinute(target.normalizedValue) === localMinute(prediction.normalizedValue)
  ))

  const predictedEvents = Array.isArray(result?.events) ? result.events : []
  const eventMatch = greedyMatches(expected.events, predictedEvents, (target, prediction) => {
    const text = itemText(prediction, ['title', 'description'])
    return target.titleTokens.every((token) => text.includes(canonical(token)))
  })

  const requiresActionCorrect = Boolean(result?.sourceSummary?.requiresAction) === expected.requiresAction
  const evidenceValid = Array.isArray(result?.evidence)
    ? result.evidence.filter((item) => typeof item?.quotedText === 'string' && fixture.ocrText.includes(item.quotedText)).length
    : 0
  const evidenceCount = Array.isArray(result?.evidence) ? result.evidence.length : 0
  const correctionOperations = taskMatch.misses + taskMatch.extras + forbiddenHits.length
    + materialMatch.misses + materialMatch.extras + timeMatch.misses + timeMatch.extras
    + eventMatch.misses + eventMatch.extras + Number(!requiresActionCorrect)
  const majorCorrection = correctionOperations > 0
  const taskMetric = safeF1(taskMatch.matched, predictedTasks.length, expected.tasks.length)

  return {
    caseId: fixture.id,
    modality: fixture.modality,
    arm,
    status: result ? 'completed' : operational.status ?? 'request_failure',
    failureReason: result ? null : operational.failureReason ?? 'missing result',
    task: { ...taskMatch, predicted: predictedTasks.length, expected: expected.tasks.length, ...taskMetric },
    material: { ...materialMatch, predicted: predictedMaterials.length, expected: expected.materials.length },
    timePoint: { ...timeMatch, predicted: predictedTimes.length, expected: expected.timePoints.length },
    event: { ...eventMatch, predicted: predictedEvents.length, expected: expected.events.length },
    forbiddenHits,
    requiresActionCorrect,
    evidence: { valid: evidenceValid, count: evidenceCount },
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

export function aggregateArm(arm, observations) {
  const completed = observations.filter((item) => item.status === 'completed')
  const sum = (selector) => completed.reduce((total, item) => total + selector(item), 0)
  const task = safeF1(sum((item) => item.task.matched), sum((item) => item.task.predicted), sum((item) => item.task.expected))
  const material = safeF1(sum((item) => item.material.matched), sum((item) => item.material.predicted), sum((item) => item.material.expected))
  const timePoint = safeF1(sum((item) => item.timePoint.matched), sum((item) => item.timePoint.predicted), sum((item) => item.timePoint.expected))
  const event = safeF1(sum((item) => item.event.matched), sum((item) => item.event.predicted), sum((item) => item.event.expected))
  const latency = completed.map((item) => item.latencyMs).filter(Number.isFinite)
  const correction = completed.map((item) => item.correctionOperations)
  return {
    arm,
    sampleCount: observations.length,
    completedCount: completed.length,
    requestFailureRate: observations.length ? (observations.length - completed.length) / observations.length : 1,
    task,
    material,
    timePoint,
    event,
    completeCaseAccuracy: completed.length ? sum((item) => Number(item.completeCase)) / completed.length : 0,
    majorCorrectionRate: completed.length ? sum((item) => Number(item.majorCorrection)) / completed.length : 1,
    requiresActionAccuracy: completed.length ? sum((item) => Number(item.requiresActionCorrect)) / completed.length : 0,
    forbiddenTaskRate: completed.length ? sum((item) => Number(item.forbiddenHits.length > 0)) / completed.length : 1,
    evidenceValidity: sum((item) => item.evidence.count) ? sum((item) => item.evidence.valid) / sum((item) => item.evidence.count) : 1,
    automatedCorrectionBurdenProxy: {
      meanOperations: completed.length ? sum((item) => item.correctionOperations) / completed.length : null,
      medianOperations: median(correction),
      p95Operations: quantile(correction, 0.95),
    },
    observedUserModificationTimeSeconds: null,
    latencyMs: {
      mean: latency.length ? latency.reduce((total, value) => total + value, 0) / latency.length : null,
      p95: quantile(latency, 0.95),
    },
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
  if (!pairs.length) return { pairedCount: 0, delta: null, ci95: [null, null] }
  const raw = pairs.map(([candidateItem, baselineItem]) => selector(candidateItem) - selector(baselineItem))
  const delta = raw.reduce((total, value) => total + value, 0) / raw.length
  const random = seededRandom(seed)
  const samples = []
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let total = 0
    for (let index = 0; index < raw.length; index += 1) total += raw[Math.floor(random() * raw.length)]
    samples.push(total / raw.length)
  }
  return { pairedCount: pairs.length, delta, ci95: [quantile(samples, 0.025), quantile(samples, 0.975)] }
}

export function summarizeEvaluation(dataset, observations) {
  const observationsByArm = Object.fromEntries(ARMS.map((arm) => [arm, observations.filter((item) => item.arm === arm)]))
  const metricsByArm = Object.fromEntries(ARMS.map((arm) => [arm, aggregateArm(arm, observationsByArm[arm])]))
  const taskF1 = (item) => item.task.f1
  const correctionBenefit = (item) => -item.correctionOperations
  return {
    schemaVersion: 'multimodal-evaluation-summary-1.0.0',
    datasetId: dataset.datasetId,
    datasetSha256: dataset.datasetSha256,
    sampleCountPerArm: dataset.sampleCount,
    metricsByArm,
    pairedComparisons: {
      IT_vs_T_taskF1: pairedBootstrap(observationsByArm, 'IT', 'T', taskF1, `${dataset.datasetSha256}:it-t:f1`),
      IT_vs_I_taskF1: pairedBootstrap(observationsByArm, 'IT', 'I', taskF1, `${dataset.datasetSha256}:it-i:f1`),
      IT_vs_T_correctionBurdenBenefit: pairedBootstrap(observationsByArm, 'IT', 'T', correctionBenefit, `${dataset.datasetSha256}:it-t:correction`),
      IT_vs_I_correctionBurdenBenefit: pairedBootstrap(observationsByArm, 'IT', 'I', correctionBenefit, `${dataset.datasetSha256}:it-i:correction`),
    },
    humanTiming: {
      status: 'NOT_RUN',
      reason: 'No human participant completed the editable confirmation flow; automated correction operations are a proxy, not time.',
    },
  }
}
