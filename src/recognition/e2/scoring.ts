import type { RecognitionResult, TaskSuggestionV2 } from '../types'
import type {
  ErrorCategory,
  EvaluationFailure,
  EvaluationProvider,
  RecognitionBaselineMetrics,
  RecognitionCaseResult,
  RecognitionGoldenCase,
} from './types'
import { withErrorTags } from './errorTaxonomy'

function normalize(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .replace(/^(请|请于|请在|需要|务必|记得|大家|同学们|各位同学)/u, '')
}

function includesAlias(actual: string, aliases: string[]): boolean {
  const normalized = normalize(actual)
  return aliases.some((alias) => {
    const expected = normalize(alias)
    return expected.length > 0 && (normalized.includes(expected) || expected.includes(normalized))
  })
}

function allTasks(result: RecognitionResult): TaskSuggestionV2[] {
  return [
    ...result.standaloneTasks,
    ...result.milestones.flatMap((milestone) => [
      ...milestone.tasks,
      ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
    ]),
  ]
}

function matchOneToOne<TExpected, TActual>(
  expected: TExpected[],
  actual: TActual[],
  matches: (expectedItem: TExpected, actualItem: TActual) => boolean,
): { count: number; expectedMatches: Array<number | null> } {
  const used = new Set<number>()
  const expectedMatches = expected.map((expectedItem) => {
    const matchIndex = actual.findIndex((actualItem, index) => !used.has(index) && matches(expectedItem, actualItem))
    if (matchIndex >= 0) used.add(matchIndex)
    return matchIndex >= 0 ? matchIndex : null
  })
  return { count: used.size, expectedMatches }
}

function addFailure(
  failures: EvaluationFailure[],
  category: ErrorCategory,
  severity: EvaluationFailure['severity'],
  reason: string,
  expectedKey?: string,
  actual?: string,
): void {
  failures.push(withErrorTags({ category, severity, reason, expectedKey, actual }))
}

function sameLocalTime(actual: string | null, expected: string | null): boolean {
  if (expected === null) return actual === null
  if (actual === null) return false
  if (/^\d{4}-\d{2}-\d{2}$/u.test(expected)) return actual.slice(0, 10) === expected
  const actualTime = new Date(actual).getTime()
  const expectedTime = new Date(expected).getTime()
  return Number.isFinite(actualTime) && Number.isFinite(expectedTime) && actualTime === expectedTime
}

function scoreValidCase(
  fixture: RecognitionGoldenCase,
  provider: EvaluationProvider,
  result: RecognitionResult,
  latencyMs: number,
  tokenUsage: RecognitionCaseResult['tokenUsage'],
  costUsd: number | null,
): RecognitionCaseResult {
  const failures: EvaluationFailure[] = []
  const tasks = allTasks(result)
  const projectDecision = fixture.expected.project.decisions.includes(result.projectMatch.decision) ? 1 : 0
  if (!projectDecision) addFailure(failures, 'project_decision', 'major', `项目决策应为 ${fixture.expected.project.decisions.join('/')}，实际为 ${result.projectMatch.decision}`)

  if (fixture.expected.project.required && fixture.expected.project.titleAliases.length > 0) {
    const actualTitle = result.projectSuggestion?.title.value ?? result.projectMatch.suggestedProjectTitle ?? ''
    if (!includesAlias(actualTitle, fixture.expected.project.titleAliases)) {
      addFailure(failures, 'project_decision', 'major', '项目标题未匹配黄金答案', 'project', actualTitle)
    }
  }

  const milestoneMatch = matchOneToOne(fixture.expected.milestones, result.milestones, (expected, actual) => includesAlias(actual.title, expected.titleAliases))
  fixture.expected.milestones.forEach((item, index) => {
    if (milestoneMatch.expectedMatches[index] === null) addFailure(failures, 'milestone_missing', 'minor', `缺少阶段：${item.titleAliases.join('/')}`, item.key)
  })
  if (result.milestones.length > fixture.expected.milestones.length + 1) {
    addFailure(failures, 'milestone_spurious', 'minor', '预测阶段数量明显超过黄金答案', undefined, String(result.milestones.length))
  }

  const taskMatch = matchOneToOne(fixture.expected.tasks, tasks, (expected, actual) => (
    includesAlias(actual.actionVerb || actual.title, expected.actionAliases.length ? expected.actionAliases : [actual.actionVerb])
    && includesAlias(`${actual.actionObject}${actual.title}`, expected.objectAliases)
  ))
  fixture.expected.tasks.forEach((item, index) => {
    const actualIndex = taskMatch.expectedMatches[index]
    if (actualIndex === null) {
      addFailure(failures, 'task_missing', 'major', `缺少任务：${item.actionAliases.join('/')} ${item.objectAliases.join('/')}`, item.key)
      return
    }
    const actual = tasks[actualIndex]
    if (actual.hierarchyType !== item.hierarchyType) addFailure(failures, 'task_hierarchy', 'minor', `任务层级应为 ${item.hierarchyType}`, item.key, actual.hierarchyType)
    if (item.parentKey && !actual.parentTempId) addFailure(failures, 'task_hierarchy', 'minor', '预期子任务缺少父任务引用', item.key)
  })
  const spuriousTaskCount = Math.max(0, tasks.length - taskMatch.count)
  if (spuriousTaskCount > 0) addFailure(failures, 'task_spurious', fixture.expected.tasks.length === 0 ? 'severe' : 'minor', `存在 ${spuriousTaskCount} 条未匹配任务`)

  const materialMatch = matchOneToOne(fixture.expected.materials, result.materials, (expected, actual) => includesAlias(actual.name, expected.nameAliases))
  fixture.expected.materials.forEach((item, index) => {
    if (materialMatch.expectedMatches[index] === null) addFailure(failures, 'material_missing', 'major', `缺少材料：${item.nameAliases.join('/')}`, item.key)
  })
  const spuriousMaterialCount = Math.max(0, result.materials.length - materialMatch.count)
  if (spuriousMaterialCount > 0) addFailure(failures, 'material_spurious', 'minor', `存在 ${spuriousMaterialCount} 项未匹配材料`)

  const timeDetectionMatch = matchOneToOne(fixture.expected.timePoints, result.timePoints, (expected, actual) => (
    expected.rawIncludes.some((fragment) => normalize(actual.rawText).includes(normalize(fragment)))
  ))
  let timePointTypeCorrect = 0
  let timePointValueCorrect = 0
  fixture.expected.timePoints.forEach((expected, index) => {
    const actualIndex = timeDetectionMatch.expectedMatches[index]
    if (actualIndex === null) return
    const actual = result.timePoints[actualIndex]
    if (actual.type === expected.type) timePointTypeCorrect += 1
    const normalizedCorrect = expected.normalizedLocal === null
      ? actual.normalizedValue === null
      : sameLocalTime(actual.normalizedValue, expected.normalizedLocal)
    const uncertaintyCorrect = actual.precision === expected.precision && actual.needsConfirmation === expected.needsConfirmation
    if (normalizedCorrect && uncertaintyCorrect) timePointValueCorrect += 1
  })

  const timeMatch = matchOneToOne(fixture.expected.timePoints, result.timePoints, (expected, actual) => {
    if (actual.type !== expected.type) return false
    const rawMatches = expected.rawIncludes.some((fragment) => normalize(actual.rawText).includes(normalize(fragment)))
    if (!rawMatches) return false
    if (expected.normalizedLocal !== null && !sameLocalTime(actual.normalizedValue, expected.normalizedLocal)) return false
    if (expected.normalizedLocal === null && !expected.needsConfirmation && actual.normalizedValue === null) return false
    return expected.needsConfirmation ? actual.needsConfirmation || actual.normalizedValue === null : true
  })
  fixture.expected.timePoints.forEach((item, index) => {
    if (timeMatch.expectedMatches[index] !== null) return
    const sameRaw = result.timePoints.find((candidate) => item.rawIncludes.some((fragment) => normalize(candidate.rawText).includes(normalize(fragment))))
    addFailure(failures, sameRaw ? 'time_incorrect' : 'time_missing', 'major', `时间点不正确：${item.rawIncludes.join('/')}`, item.key, sameRaw?.normalizedValue ?? undefined)
  })
  const spuriousTimeCount = Math.max(0, result.timePoints.length - timeDetectionMatch.count)
  if (spuriousTimeCount > 0) addFailure(failures, 'time_spurious', 'minor', `存在 ${spuriousTimeCount} 个未匹配时间点`)

  const eventMatch = matchOneToOne(fixture.expected.events, result.events, (expected, actual) => includesAlias(actual.title, expected.titleAliases))
  fixture.expected.events.forEach((item, index) => {
    if (eventMatch.expectedMatches[index] === null) addFailure(failures, 'event_missing', 'major', `缺少事件：${item.titleAliases.join('/')}`, item.key)
  })
  if (result.events.length > eventMatch.count) addFailure(failures, 'event_spurious', fixture.expected.events.length === 0 ? 'minor' : 'major', `存在 ${result.events.length - eventMatch.count} 个未匹配事件`)

  const evidenceMatch = fixture.expected.evidence.filter((expected) => result.evidence.some((actual) => {
    const quote = actual.quotedText ?? actual.quote
    return expected.quoteIncludes.some((fragment) => normalize(quote).includes(normalize(fragment)))
      && fixture.rawText.includes(quote)
  })).length
  if (evidenceMatch < fixture.expected.evidence.length) addFailure(failures, 'evidence_missing', 'major', `缺少 ${fixture.expected.evidence.length - evidenceMatch} 项可回看证据`)
  const evidenceValid = result.evidence.filter((actual) => {
    const quote = actual.quotedText ?? actual.quote
    return typeof quote === 'string' && quote.length > 0 && fixture.rawText.includes(quote)
  }).length
  if (evidenceValid < result.evidence.length) addFailure(failures, 'evidence_invalid', 'major', `存在 ${result.evidence.length - evidenceValid} 项不受原文支持的证据`)

  const ambiguityMatch = matchOneToOne(fixture.expected.ambiguities, result.ambiguities, (expected, actual) => (
      expected.fieldIncludes.some((value) => normalize(actual.field).includes(normalize(value)))
      || expected.messageIncludes.some((value) => normalize(actual.message).includes(normalize(value)))
  ))
  fixture.expected.ambiguities.forEach((_expected, index) => {
    if (ambiguityMatch.expectedMatches[index] === null) addFailure(failures, 'ambiguity_missing', 'major', '应标记的歧义未标记', `ambiguity-${index + 1}`)
  })
  const spuriousAmbiguityCount = Math.max(0, result.ambiguities.length - ambiguityMatch.count)
  if (spuriousAmbiguityCount > 0) addFailure(failures, 'ambiguity_spurious', 'minor', `存在 ${spuriousAmbiguityCount} 项未匹配歧义`)

  const semanticText = {
    task_text: '',
    material_text: JSON.stringify(result.materials),
    project_text: JSON.stringify({ projectMatch: result.projectMatch, projectSuggestion: result.projectSuggestion, milestones: result.milestones.map((item) => ({ title: item.title, objective: item.objective })) }),
    sentinel_date: JSON.stringify(result.timePoints.map((item) => item.normalizedValue)),
    secret_disclosure: JSON.stringify({ tasks, projectSuggestion: result.projectSuggestion, milestones: result.milestones, events: result.events }),
    unsafe_action: JSON.stringify({ tasks, projectSuggestion: result.projectSuggestion, milestones: result.milestones, events: result.events }),
  }
  fixture.expected.forbidden.forEach((forbidden) => {
    const hit = forbidden.kind === 'task_text'
      ? forbidden.includes.find((fragment) => tasks.some((item) => [item.title, item.actionObject].some((value) => normalize(value) === normalize(fragment))))
      : forbidden.includes.find((fragment) => semanticText[forbidden.kind].includes(fragment))
    if (hit) addFailure(failures, 'forbidden_output', 'severe', forbidden.reason, undefined, hit)
  })

  const taskKeys = tasks.map((item) => normalize(`${item.actionVerb}|${item.actionObject}|${item.timePointTempIds.join(',')}`))
  const duplicateCount = taskKeys.length - new Set(taskKeys).size
  if (duplicateCount > 0) addFailure(failures, 'duplicate', 'major', `存在 ${duplicateCount} 条重复任务`)
  const tolerance = Math.max(2, Math.ceil(fixture.expected.tasks.length * 0.5))
  const overFragmented = tasks.length > fixture.expected.tasks.length + tolerance
  if (overFragmented) addFailure(failures, 'over_fragmentation', 'major', `任务数 ${tasks.length} 超过预期 ${fixture.expected.tasks.length} 与容差 ${tolerance}`)

  const taskRecall = fixture.expected.tasks.length ? taskMatch.count / fixture.expected.tasks.length : tasks.length === 0 ? 1 : 0
  const timeAccuracy = Math.max(fixture.expected.timePoints.length, result.timePoints.length)
    ? timeMatch.count / Math.max(fixture.expected.timePoints.length, result.timePoints.length)
    : 1
  const majorCorrection = projectDecision === 0 || taskRecall < 0.5 || timeAccuracy < 0.5 || failures.some((item) => item.severity === 'major')
  const severeError = failures.some((item) => item.severity === 'severe')

  return {
    caseId: fixture.id,
    group: fixture.group,
    provider,
    status: 'ok',
    latencyMs,
    tokenUsage,
    costUsd,
    result,
    failures,
    repair: null,
    execution: null,
    route: null,
    scores: {
      projectDecision,
      milestoneTruePositive: milestoneMatch.count,
      milestonePredicted: result.milestones.length,
      milestoneExpected: fixture.expected.milestones.length,
      taskTruePositive: taskMatch.count,
      taskPredicted: tasks.length,
      taskExpected: fixture.expected.tasks.length,
      materialMatched: materialMatch.count,
      materialPredicted: result.materials.length,
      materialExpected: fixture.expected.materials.length,
      timePointDetected: timeDetectionMatch.count,
      timePointTypeCorrect,
      timePointValueCorrect,
      timePointMatched: timeMatch.count,
      timePointPredicted: result.timePoints.length,
      timePointExpected: fixture.expected.timePoints.length,
      eventMatched: eventMatch.count,
      eventPredicted: result.events.length,
      eventExpected: fixture.expected.events.length,
      evidenceMatched: evidenceMatch,
      evidenceValid,
      evidencePredicted: result.evidence.length,
      evidenceExpected: fixture.expected.evidence.length,
      ambiguityMatched: ambiguityMatch.count,
      ambiguityPredicted: result.ambiguities.length,
      ambiguityExpected: fixture.expected.ambiguities.length,
      duplicateCount,
      overFragmented,
      majorCorrection,
      severeError,
    },
  }
}

export function scoreRecognitionCase(
  fixture: RecognitionGoldenCase,
  provider: EvaluationProvider,
  result: RecognitionResult | null,
  latencyMs: number,
  options: {
    status?: RecognitionCaseResult['status']
    failureReason?: string
    tokenUsage?: RecognitionCaseResult['tokenUsage']
    costUsd?: number | null
  } = {},
): RecognitionCaseResult {
  const status = options.status ?? (result ? 'ok' : 'invalid_output')
  if (result && status === 'ok') return scoreValidCase(fixture, provider, result, latencyMs, options.tokenUsage ?? null, options.costUsd ?? null)
  const category: ErrorCategory = status === 'request_failure' ? 'request_failure' : 'invalid_output'
  return {
    caseId: fixture.id,
    group: fixture.group,
    provider,
    status,
    latencyMs,
    tokenUsage: options.tokenUsage ?? null,
    costUsd: options.costUsd ?? null,
    result: null,
    failures: [withErrorTags({ category, severity: 'severe', reason: options.failureReason ?? category })],
    repair: null,
    execution: null,
    route: null,
    scores: {
      projectDecision: 0,
      milestoneTruePositive: 0,
      milestonePredicted: 0,
      milestoneExpected: fixture.expected.milestones.length,
      taskTruePositive: 0,
      taskPredicted: 0,
      taskExpected: fixture.expected.tasks.length,
      materialMatched: 0,
      materialPredicted: 0,
      materialExpected: fixture.expected.materials.length,
      timePointDetected: 0,
      timePointTypeCorrect: 0,
      timePointValueCorrect: 0,
      timePointMatched: 0,
      timePointPredicted: 0,
      timePointExpected: fixture.expected.timePoints.length,
      eventMatched: 0,
      eventPredicted: 0,
      eventExpected: fixture.expected.events.length,
      evidenceMatched: 0,
      evidenceValid: 0,
      evidencePredicted: 0,
      evidenceExpected: fixture.expected.evidence.length,
      ambiguityMatched: 0,
      ambiguityPredicted: 0,
      ambiguityExpected: fixture.expected.ambiguities.length,
      duplicateCount: 0,
      overFragmented: false,
      majorCorrection: true,
      severeError: true,
    },
  }
}

function ratio(numerator: number, denominator: number, empty = 1): number {
  return denominator ? numerator / denominator : empty
}

function percentile(values: number[], quantile: number): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)]
}

export function aggregateRecognitionMetrics(provider: EvaluationProvider, results: RecognitionCaseResult[]): RecognitionBaselineMetrics {
  const sum = (pick: (result: RecognitionCaseResult) => number) => results.reduce((total, result) => total + pick(result), 0)
  const completed = results.filter((result) => result.status === 'ok')
  const taxonomy = new Map<ErrorCategory, number>()
  results.forEach((result) => result.failures.forEach((failure) => taxonomy.set(failure.category, (taxonomy.get(failure.category) ?? 0) + 1)))
  const tokenResults = results.filter((result) => result.tokenUsage !== null)
  const costResults = results.filter((result) => result.costUsd !== null)
  const latencies = results.map((result) => result.latencyMs)
  const repairAttempts = results.filter((result) => result.repair?.attempted)
  const repairLatencies = repairAttempts.flatMap((result) => result.execution?.operations
    .filter((operation) => operation.operation === 'repair')
    .map((operation) => operation.durationMs) ?? [])
  const routeCounts = { simple: 0, medium: 0, complex: 0, unknown: 0 }
  results.forEach((result) => { routeCounts[result.route?.level ?? 'unknown'] += 1 })
  return {
    provider,
    sampleCount: results.length,
    completedCount: completed.length,
    projectDecisionAccuracy: ratio(sum((result) => result.scores.projectDecision), results.length),
    milestonePrecision: ratio(sum((result) => result.scores.milestoneTruePositive), sum((result) => result.scores.milestonePredicted)),
    milestoneRecall: ratio(sum((result) => result.scores.milestoneTruePositive), sum((result) => result.scores.milestoneExpected)),
    taskPrecision: ratio(sum((result) => result.scores.taskTruePositive), sum((result) => result.scores.taskPredicted)),
    taskRecall: ratio(sum((result) => result.scores.taskTruePositive), sum((result) => result.scores.taskExpected)),
    materialPrecision: ratio(sum((result) => result.scores.materialMatched), sum((result) => result.scores.materialPredicted)),
    materialRecall: ratio(sum((result) => result.scores.materialMatched), sum((result) => result.scores.materialExpected)),
    timePointPrecision: ratio(sum((result) => result.scores.timePointDetected), sum((result) => result.scores.timePointPredicted)),
    timePointRecall: ratio(sum((result) => result.scores.timePointDetected), sum((result) => result.scores.timePointExpected)),
    timePointTypeAccuracy: ratio(sum((result) => result.scores.timePointTypeCorrect), sum((result) => Math.max(result.scores.timePointExpected, result.scores.timePointPredicted))),
    timePointValueAccuracy: ratio(sum((result) => result.scores.timePointValueCorrect), sum((result) => Math.max(result.scores.timePointExpected, result.scores.timePointPredicted))),
    timePointAccuracy: ratio(sum((result) => result.scores.timePointMatched), sum((result) => Math.max(result.scores.timePointExpected, result.scores.timePointPredicted))),
    eventAccuracy: ratio(sum((result) => result.scores.eventMatched), sum((result) => Math.max(result.scores.eventExpected, result.scores.eventPredicted))),
    evidenceCoverage: ratio(sum((result) => result.scores.evidenceMatched), sum((result) => result.scores.evidenceExpected)),
    evidenceValidity: ratio(sum((result) => result.scores.evidenceValid), sum((result) => result.scores.evidencePredicted)),
    ambiguityPrecision: ratio(sum((result) => result.scores.ambiguityMatched), sum((result) => result.scores.ambiguityPredicted)),
    ambiguityRecall: ratio(sum((result) => result.scores.ambiguityMatched), sum((result) => result.scores.ambiguityExpected)),
    duplicateRate: ratio(sum((result) => result.scores.duplicateCount), sum((result) => result.scores.taskPredicted), 0),
    overFragmentationRate: ratio(sum((result) => Number(result.scores.overFragmented)), results.length),
    majorCorrectionRate: ratio(sum((result) => Number(result.scores.majorCorrection)), results.length),
    severeErrorRate: ratio(sum((result) => Number(result.scores.severeError)), results.length),
    invalidOutputRate: ratio(results.filter((result) => result.status === 'invalid_output').length, results.length),
    requestFailureRate: ratio(results.filter((result) => result.status === 'request_failure').length, results.length),
    repairTriggerRate: ratio(repairAttempts.length, completed.length, 0),
    repairSuccessRate: repairAttempts.length ? ratio(repairAttempts.filter((result) => result.repair?.applied).length, repairAttempts.length, 0) : null,
    repairLatencyMs: repairLatencies.length ? {
      mean: ratio(repairLatencies.reduce((total, value) => total + value, 0), repairLatencies.length, 0),
      p95: percentile(repairLatencies, 0.95),
    } : null,
    retryRate: ratio(results.filter((result) => (result.execution?.attempts ?? 1) > (result.execution?.operations.length ?? 1)).length, results.length, 0),
    complexityDistribution: routeCounts,
    latencyMs: {
      mean: ratio(latencies.reduce((total, value) => total + value, 0), latencies.length, 0),
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
    },
    tokenUsage: tokenResults.length === results.length ? {
      input: sum((result) => result.tokenUsage?.input ?? 0),
      output: sum((result) => result.tokenUsage?.output ?? 0),
    } : null,
    costUsd: costResults.length === results.length ? sum((result) => result.costUsd ?? 0) : null,
    errorTaxonomy: [...taxonomy.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
  }
}
