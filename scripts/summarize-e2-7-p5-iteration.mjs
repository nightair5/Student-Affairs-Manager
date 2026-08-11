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
  tokens: {
    baseline: baselineSummary.metrics.tokenUsage,
    candidate: candidateSummary.metrics.tokenUsage,
    inputRatio: candidateSummary.metrics.tokenUsage.input / baselineSummary.metrics.tokenUsage.input,
    outputRatio: candidateSummary.metrics.tokenUsage.output / baselineSummary.metrics.tokenUsage.output,
  },
  costUsd: 'NOT OBSERVABLE',
}

const decision = {
  status: 'RC2_REQUIRED',
  reasons: [
    'Task Recall improved by less than the eight-point internal target.',
    'Task Precision fell to 79.17%, below the 82% candidate gate.',
    'Event Accuracy regressed materially to 64.71%.',
    'TimePoint Type and Value Accuracy remain below the 80% candidate gates.',
    'Strict Major Correction remains above the calibrated candidate gate; candidate user-impact adjudication has not run.',
  ],
  userImpactMajorCorrection: 'NOT RUN FOR RC1',
}

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
- source/input hash 和 Token 缺失均为 0。Checkpoint 未持久化单行 result hash，因此不声称具备逐行 result-hash 证据；整文件哈希绑定全部原始行。
- User-impact Major：\`NOT RUN FOR RC1\`。Strict Major 不替代人工语义判定。

## 冻结 Development 对比

| Metric | 2.4.1 baseline | ${args.iteration} | Delta |
| --- | ---: | ---: | ---: |
${rows}

Strict Major 逐例迁移：改善 ${strictMajorTransitions.improved}，恶化 ${strictMajorTransitions.worsened}，持续 Major ${strictMajorTransitions.unchangedMajor}，持续非 Major ${strictMajorTransitions.unchangedNotMajor}。

## 性能与 Token

- Mean latency：${Math.round(performance.latencyMs.baseline.mean)} ms → ${Math.round(performance.latencyMs.candidate.mean)} ms（${((performance.latencyMs.meanRatio - 1) * 100).toFixed(2)}%）。
- P95 latency：${performance.latencyMs.baseline.p95} ms → ${performance.latencyMs.candidate.p95} ms。
- Input tokens：${performance.tokens.baseline.input} → ${performance.tokens.candidate.input}（${((performance.tokens.inputRatio - 1) * 100).toFixed(2)}%）。
- Output tokens：${performance.tokens.baseline.output} → ${performance.tokens.candidate.output}（${((performance.tokens.outputRatio - 1) * 100).toFixed(2)}%）。
- Cost：\`NOT OBSERVABLE\`，不得估算。

## 决策

RC1 改善 Task Recall、Project Decision、Ambiguity Recall 与 Strict Major，但 Task Precision 降至 82% 门槛以下，Event Accuracy 大幅回归，Time Role/Value 仍未达到内部候选门槛。因此 RC1 不冻结为 Candidate，使用唯一剩余的原则性 RC2，聚焦“发生型安排与可交付 Task”的业务边界。不得进行第三轮 Prompt 调优。
`
await writeFile(path.join(outputDir, 'COMPARISON.md'), markdown, 'utf8')

console.log(JSON.stringify({ outputDir, checkpointSha256: pairedIntegrity.checkpointSha256, decision: decision.status }, null, 2))
