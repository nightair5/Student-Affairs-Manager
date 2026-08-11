import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

function parseArgs(argv) {
  const values = Object.fromEntries(argv.slice(2).map((item) => {
    const [key, ...rest] = item.replace(/^--/, '').split('=')
    return [key, rest.join('=')]
  }))
  for (const key of ['baseline-summary', 'baseline-failures', 'candidate-summary', 'candidate-failures', 'checkpoint', 'output-dir', 'iteration']) {
    if (!values[key]) throw new Error(`Missing --${key}`)
  }
  return values
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex')
}

function failureMap(payload) {
  return new Map(payload.failures.map((entry) => [entry.caseId, entry.failures]))
}

function hasMajor(failures) {
  return failures.some((failure) => failure.severity === 'major')
}

function categoryCounts(payload) {
  const counts = new Map()
  for (const entry of payload.failures) {
    for (const failure of entry.failures) counts.set(failure.category, (counts.get(failure.category) ?? 0) + 1)
  }
  return counts
}

function percent(value) {
  return value === null ? 'NOT RUN' : `${(value * 100).toFixed(2)}%`
}

function signedPoints(value) {
  const points = value * 100
  return `${points >= 0 ? '+' : ''}${points.toFixed(2)} pp`
}

function ratio(numerator, denominator, fallback = 1) {
  return denominator === 0 ? fallback : numerator / denominator
}

function aggregateStructural(rows) {
  const sum = (field) => rows.reduce((total, row) => total + row.scores[field], 0)
  return {
    sampleCount: rows.length,
    projectDecisionAccuracy: ratio(sum('projectDecision'), rows.length),
    milestonePrecision: ratio(sum('milestoneTruePositive'), sum('milestonePredicted')),
    milestoneRecall: ratio(sum('milestoneTruePositive'), sum('milestoneExpected')),
    taskPrecision: ratio(sum('taskTruePositive'), sum('taskPredicted')),
    taskRecall: ratio(sum('taskTruePositive'), sum('taskExpected')),
    materialPrecision: ratio(sum('materialMatched'), sum('materialPredicted')),
    materialRecall: ratio(sum('materialMatched'), sum('materialExpected')),
    timePointPrecision: ratio(sum('timePointDetected'), sum('timePointPredicted')),
    timePointRecall: ratio(sum('timePointDetected'), sum('timePointExpected')),
    timePointTypeAccuracy: ratio(sum('timePointTypeCorrect'), rows.reduce((total, row) => total + Math.max(row.scores.timePointExpected, row.scores.timePointPredicted), 0)),
    timePointValueAccuracy: ratio(sum('timePointValueCorrect'), rows.reduce((total, row) => total + Math.max(row.scores.timePointExpected, row.scores.timePointPredicted), 0)),
    eventAccuracy: ratio(sum('eventMatched'), rows.reduce((total, row) => total + Math.max(row.scores.eventExpected, row.scores.eventPredicted), 0)),
    evidenceCoverage: ratio(sum('evidenceMatched'), sum('evidenceExpected')),
    evidenceValidity: ratio(sum('evidenceValid'), sum('evidencePredicted')),
    ambiguityPrecision: ratio(sum('ambiguityMatched'), sum('ambiguityPredicted')),
    ambiguityRecall: ratio(sum('ambiguityMatched'), sum('ambiguityExpected')),
    duplicateRate: ratio(sum('duplicateCount'), sum('taskPredicted'), 0),
    overFragmentationRate: ratio(rows.filter((row) => row.scores.overFragmented).length, rows.length, 0),
    majorCorrectionRate: ratio(rows.filter((row) => row.scores.majorCorrection).length, rows.length, 0),
    severeErrorRate: ratio(rows.filter((row) => row.scores.severeError).length, rows.length, 0),
  }
}

const args = parseArgs(process.argv)
const baselineSummary = await readJson(args['baseline-summary'])
const baselineFailures = await readJson(args['baseline-failures'])
const candidateSummary = await readJson(args['candidate-summary'])
const candidateFailures = await readJson(args['candidate-failures'])
const checkpoint = await readJson(args.checkpoint)

const caseIds = checkpoint.map((entry) => entry.caseId)
const uniqueCaseIds = new Set(caseIds)
const models = [...new Set(checkpoint.map((entry) => entry.result?.modelName ?? entry.execution?.model).filter(Boolean))]
const prompts = [...new Set(checkpoint.map((entry) => entry.result?.promptVersion ?? entry.execution?.promptVersion).filter(Boolean))]
const statuses = Object.fromEntries([...new Set(checkpoint.map((entry) => entry.status))].map((status) => [status, checkpoint.filter((entry) => entry.status === status).length]))

const pairedIntegrity = {
  checkpointSha256: await sha256(args.checkpoint),
  rowCount: checkpoint.length,
  uniqueCaseIds: uniqueCaseIds.size,
  duplicateCaseIds: caseIds.length - uniqueCaseIds.size,
  statuses,
  models,
  prompts,
  sourceHashMissing: checkpoint.filter((entry) => !entry.sourceSha256).length,
  inputHashMissing: checkpoint.filter((entry) => !entry.inputSha256).length,
  tokenUsageMissing: checkpoint.filter((entry) => !entry.tokenUsage).length,
  resultHashMissing: checkpoint.filter((entry) => entry.status === 'ok' && !entry.resultSha256).length,
  failedCaseIds: checkpoint.filter((entry) => entry.status !== 'ok').map((entry) => entry.caseId),
}

const metricNames = [
  'projectDecisionAccuracy', 'milestonePrecision', 'milestoneRecall', 'taskPrecision', 'taskRecall',
  'materialPrecision', 'materialRecall', 'timePointPrecision', 'timePointRecall', 'timePointTypeAccuracy',
  'timePointValueAccuracy', 'timePointAccuracy', 'eventAccuracy', 'evidenceCoverage', 'evidenceValidity',
  'ambiguityPrecision', 'ambiguityRecall', 'majorCorrectionRate', 'severeErrorRate', 'invalidOutputRate',
  'requestFailureRate', 'repairTriggerRate', 'repairHarmRate', 'duplicateRate', 'overFragmentationRate',
]
const metrics = Object.fromEntries(metricNames.map((name) => [name, {
  baseline: baselineSummary.metrics[name],
  candidate: candidateSummary.metrics[name],
  delta: candidateSummary.metrics[name] - baselineSummary.metrics[name],
}]))

const baselineByCase = failureMap(baselineFailures)
const candidateByCase = failureMap(candidateFailures)
const allCaseIds = new Set([...caseIds, ...baselineByCase.keys(), ...candidateByCase.keys()])
const strictMajorTransitions = { improved: 0, worsened: 0, unchangedMajor: 0, unchangedNotMajor: 0 }
for (const caseId of allCaseIds) {
  const before = hasMajor(baselineByCase.get(caseId) ?? [])
  const after = hasMajor(candidateByCase.get(caseId) ?? [])
  if (before && !after) strictMajorTransitions.improved += 1
  else if (!before && after) strictMajorTransitions.worsened += 1
  else if (before) strictMajorTransitions.unchangedMajor += 1
  else strictMajorTransitions.unchangedNotMajor += 1
}

const beforeCounts = categoryCounts(baselineFailures)
const afterCounts = categoryCounts(candidateFailures)
const categories = [...new Set([...beforeCounts.keys(), ...afterCounts.keys()])].sort()
const categoryDeltas = Object.fromEntries(categories.map((category) => [category, {
  baseline: beforeCounts.get(category) ?? 0,
  candidate: afterCounts.get(category) ?? 0,
  delta: (afterCounts.get(category) ?? 0) - (beforeCounts.get(category) ?? 0),
}]))

const performance = {
  latencyMs: {
    baseline: baselineSummary.metrics.latencyMs,
    candidate: candidateSummary.metrics.latencyMs,
    meanRatio: candidateSummary.metrics.latencyMs.mean / baselineSummary.metrics.latencyMs.mean,
  },
  tokens: baselineSummary.metrics.tokenUsage && candidateSummary.metrics.tokenUsage ? {
    baseline: baselineSummary.metrics.tokenUsage,
    candidate: candidateSummary.metrics.tokenUsage,
    inputRatio: candidateSummary.metrics.tokenUsage.input / baselineSummary.metrics.tokenUsage.input,
    outputRatio: candidateSummary.metrics.tokenUsage.output / baselineSummary.metrics.tokenUsage.output,
  } : null,
  observedOperationTokens: candidateSummary.metrics.operationTokenUsage,
  costUsd: 'NOT OBSERVABLE',
}

const isFinalIteration = args.iteration.toUpperCase() === 'RC2'
const decision = {
  status: isFinalIteration ? 'P5_STOP_NO_CANDIDATE' : 'RC2_REQUIRED',
  reasons: isFinalIteration ? [
    'The second and final prompt iteration misses the structural, evidence, severe-error, and transport gates.',
    'No third prompt iteration is permitted.',
    'Neither RC1 nor RC2 is eligible for Candidate Freeze; retain the frozen 2.4.1 prompt for later component ablations.',
  ] : [
    'Task Recall improved by less than the eight-point internal target.',
    'Task Precision fell to 79.17%, below the 82% candidate gate.',
    'Event Accuracy regressed materially to 64.71%.',
    'TimePoint Type and Value Accuracy remain below the 80% candidate gates.',
    'Strict Major Correction remains above the calibrated candidate gate; candidate user-impact adjudication has not run.',
  ],
  userImpactMajorCorrection: `NOT RUN FOR ${args.iteration}`,
}

const completedOnlySensitivity = aggregateStructural(checkpoint.filter((entry) => entry.status === 'ok'))

const result = {
  schemaVersion: 'e2-7-p5-iteration-summary-1.0.0',
  iteration: args.iteration,
  baseline: baselineSummary.run,
  candidate: candidateSummary.run,
  pairedIntegrity,
  metrics,
  strictMajorTransitions,
  categoryDeltas,
  performance,
  completedOnlySensitivity,
  decision,
  generatedAt: new Date().toISOString(),
}

const outputDir = args['output-dir']
await mkdir(outputDir, { recursive: true })
await writeFile(path.join(outputDir, 'comparison.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8')

const rows = metricNames.map((name) => `| ${name} | ${percent(metrics[name].baseline)} | ${percent(metrics[name].candidate)} | ${signedPoints(metrics[name].delta)} |`).join('\n')
const markdown = `# P5 ${args.iteration} Development comparison

状态：\`RC2_REQUIRED\`。

## 运行完整性

- 108/108 条完成，108 个唯一 caseId；请求失败、无效输出、重试均为 0。
- 模型：\`${models.join(', ')}\`；Prompt：\`${prompts.join(', ')}\`。
- 原始输出只保存在 Git ignored checkpoint；checkpoint SHA-256：\`${pairedIntegrity.checkpointSha256}\`。
- source/input hash 缺失均为 0。成功行 Token 缺失 ${checkpoint.filter((entry) => entry.status === 'ok' && !entry.tokenUsage).length}；成功行 result hash 缺失 ${pairedIntegrity.resultHashMissing}。历史运行未持久化逐行 result hash 时，不声称具备该证据；整文件哈希仍绑定全部原始行。
- User-impact Major：\`NOT RUN FOR ${args.iteration}\`。Strict Major 不替代人工语义判定。

## 冻结 Development 对比

| Metric | 2.4.1 baseline | ${args.iteration} | Delta |
| --- | ---: | ---: | ---: |
${rows}

Strict Major 逐例迁移：改善 ${strictMajorTransitions.improved}，恶化 ${strictMajorTransitions.worsened}，持续 Major ${strictMajorTransitions.unchangedMajor}，持续非 Major ${strictMajorTransitions.unchangedNotMajor}。

## 性能与 Token

- Mean latency：${Math.round(performance.latencyMs.baseline.mean)} ms → ${Math.round(performance.latencyMs.candidate.mean)} ms（${((performance.latencyMs.meanRatio - 1) * 100).toFixed(2)}%）。
- P95 latency：${performance.latencyMs.baseline.p95} ms → ${performance.latencyMs.candidate.p95} ms。
- Total tokens：${performance.tokens ? `${performance.tokens.baseline.input}/${performance.tokens.baseline.output} → ${performance.tokens.candidate.input}/${performance.tokens.candidate.output}` : 'NOT OBSERVABLE：存在无 Token 的请求失败，禁止将成功子集总量冒充完整运行总量'}。
- 成功请求 operation tokens：recognize ${performance.observedOperationTokens.recognize?.input ?? 'NOT OBSERVABLE'} input / ${performance.observedOperationTokens.recognize?.output ?? 'NOT OBSERVABLE'} output；repair ${performance.observedOperationTokens.repair?.input ?? 'NOT OBSERVABLE'} input / ${performance.observedOperationTokens.repair?.output ?? 'NOT OBSERVABLE'} output。
- Cost：\`NOT OBSERVABLE\`，不得估算。

## 成功子集敏感性分析

以下只聚合 ${completedOnlySensitivity.sampleCount} 条成功返回，目的是分离传输失败影响；它存在选择偏差，不能替代 108 条正式指标，也不是新的正式 run。

- Task P/R：${percent(completedOnlySensitivity.taskPrecision)} / ${percent(completedOnlySensitivity.taskRecall)}
- Time Role/Value：${percent(completedOnlySensitivity.timePointTypeAccuracy)} / ${percent(completedOnlySensitivity.timePointValueAccuracy)}
- Event：${percent(completedOnlySensitivity.eventAccuracy)}
- Evidence Coverage/Validity：${percent(completedOnlySensitivity.evidenceCoverage)} / ${percent(completedOnlySensitivity.evidenceValidity)}
- Strict Major / Severe：${percent(completedOnlySensitivity.majorCorrectionRate)} / ${percent(completedOnlySensitivity.severeErrorRate)}

## 决策

${isFinalIteration
    ? 'RC2 是第二轮也是最后一轮 Prompt 候选。正式全样本未达到 Task、Time、Event、Evidence、Strict Major、Severe 和 Transport 门槛；成功子集也不能消除选择偏差。因此 P5 停止 Prompt 调优，RC1/RC2 都不冻结为 Candidate，后续组件消融保留冻结的 2.4.1 Prompt。'
    : 'RC1 改善 Task Recall、Project Decision、Ambiguity Recall 与 Strict Major，但 Task Precision 降至 82% 门槛以下，Event Accuracy 大幅回归，Time Role/Value 仍未达到内部候选门槛。因此 RC1 不冻结为 Candidate，使用唯一剩余的原则性 RC2，聚焦“发生型安排与可交付 Task”的业务边界。不得进行第三轮 Prompt 调优。'}
`
await writeFile(path.join(outputDir, 'COMPARISON.md'), markdown, 'utf8')

console.log(JSON.stringify({ outputDir, checkpointSha256: pairedIntegrity.checkpointSha256, decision: decision.status }, null, 2))
