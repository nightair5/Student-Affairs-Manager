import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyRco5007Freeze } from './rco-5-007-integrity.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const datasetPath = resolve(root, 'docs/recognition-optimization/RCO-5-006-B1_DEVELOPMENT_DATASET.json')
const predictionsPath = resolve(root, 'docs/recognition-optimization/rco-5-007-replay/predictions.json')
const priorResultPath = resolve(root, 'docs/recognition-optimization/rco-5-006-b1-runs/rco-5-006-b1-m1-20260903b/result.json')
const resultPath = resolve(root, 'docs/recognition-optimization/rco-5-007-replay/result.json')
const reportPath = resolve(root, 'docs/recognition-optimization/rco-5-007-replay/REPORT.md')

const integrity = await verifyRco5007Freeze(root, 'scoring')
const [datasetBytes, predictionBytes, priorBytes] = await Promise.all([readFile(datasetPath), readFile(predictionsPath), readFile(priorResultPath)])
const dataset = JSON.parse(datasetBytes.toString('utf8'))
const predictions = JSON.parse(predictionBytes.toString('utf8'))
const prior = JSON.parse(priorBytes.toString('utf8'))

const ratio = (top, bottom) => bottom === 0 ? null : top / bottom
const f1 = (precision, recall) => precision === null || recall === null || precision + recall === 0 ? null : 2 * precision * recall / (precision + recall)
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const scopeTexts = (item, scopeById) => item.propositionScopeIds.map((id) => scopeById.get(id)?.text).filter(Boolean)
const textSetEqual = (left, right) => same([...new Set(left)].sort(), [...new Set(right)].sort())

function pairScore(expected, predicted, scopeById) {
  const predictedActions = [predicted.action.surface, ...predicted.steps.map((step) => step.surface)]
  let score = 0
  if (predictedActions.includes(expected.action.surface)) score += 8
  if (predicted.actionType === expected.actionType) score += 4
  if (predicted.object.surface === expected.object.surface) score += 4
  if (expected.propositionScopeTexts.some((text) => scopeTexts(predicted, scopeById).includes(text))) score += 2
  return score
}

function align(expectedItems, predictedItems, scopeById) {
  const pairs = []
  const usedExpected = new Set()
  const usedPredicted = new Set()
  const candidates = []
  expectedItems.forEach((expected, expectedIndex) => predictedItems.forEach((predicted, predictedIndex) => {
    candidates.push({ expectedIndex, predictedIndex, score: pairScore(expected, predicted, scopeById) })
  }))
  candidates.sort((left, right) => right.score - left.score || left.expectedIndex - right.expectedIndex || left.predictedIndex - right.predictedIndex)
  for (const candidate of candidates) {
    if (candidate.score < 8 || usedExpected.has(candidate.expectedIndex) || usedPredicted.has(candidate.predictedIndex)) continue
    usedExpected.add(candidate.expectedIndex)
    usedPredicted.add(candidate.predictedIndex)
    pairs.push({ expected: expectedItems[candidate.expectedIndex], predicted: predictedItems[candidate.predictedIndex] })
  }
  return { pairs, unmatchedExpected: expectedItems.length - pairs.length, unmatchedPredicted: predictedItems.length - pairs.length }
}

const totals = {
  expectedTasks: 0, predictedTasks: 0, matchedTasks: 0, exactActionObject: 0,
  safeDefaults: 0, safeDefaultsRecovered: 0, forbiddenDefaults: 0,
  requiresActionCorrect: 0, exactTaskBoundaryCases: 0, completeTaskCases: 0,
  semanticsCorrect: 0, semanticsTotal: 0, policyExpectedDifferences: 0,
}
const caseResults = []
for (const expectedCase of dataset.cases) {
  const prediction = predictions.cases.find((item) => item.caseId === expectedCase.id)
  if (!prediction) throw new Error(`PREDICTION_MISSING:${expectedCase.id}`)
  const scopeById = new Map(prediction.scopeIndex.scopes.map((scope) => [scope.id, scope]))
  const expectedTasks = expectedCase.expected.directives
  const predictedTasks = prediction.result.tasks
  const alignment = align(expectedTasks, predictedTasks, scopeById)
  let exactActionObject = 0
  let semanticBundles = 0
  let safeDefaults = 0
  let safeDefaultsRecovered = 0
  let selectedMismatch = 0
  for (const { expected, predicted } of alignment.pairs) {
    const actionCovered = [predicted.action.surface, ...predicted.steps.map((step) => step.surface)].includes(expected.action.surface)
    if (actionCovered && predicted.object.surface === expected.object.surface) exactActionObject += 1
    const semanticEqual = Object.entries(expected.semantics).every(([key, value]) => predicted.semantics[key] === value)
    if (semanticEqual) semanticBundles += 1
    totals.semanticsTotal += Object.keys(expected.semantics).length
    totals.semanticsCorrect += Object.entries(expected.semantics).filter(([key, value]) => predicted.semantics[key] === value).length
    if (!semanticEqual) totals.policyExpectedDifferences += 1
    if (expected.expectedDefaultSelected) {
      safeDefaults += 1
      if (predicted.selected) safeDefaultsRecovered += 1
    }
    if (predicted.selected !== expected.expectedDefaultSelected) selectedMismatch += 1
  }
  const selectedText = predictedTasks.filter((task) => task.selected).flatMap((task) => [
    task.action.surface, task.object.surface, ...task.steps.map((step) => step.surface), ...scopeTexts(task, scopeById),
  ]).join('\n')
  const forbidden = expectedCase.expected.forbiddenDefaultSurfaces.filter((surface) => selectedText.includes(surface))
  const exactTaskBoundary = predictedTasks.length === expectedTasks.length && alignment.unmatchedExpected === 0 && alignment.unmatchedPredicted === 0
  const requiresActionCorrect = prediction.result.requiresAction === expectedCase.expected.requiresAction
  const completeTaskCase = exactTaskBoundary && exactActionObject === expectedTasks.length && semanticBundles === expectedTasks.length
    && selectedMismatch === 0 && requiresActionCorrect && forbidden.length === 0
  totals.expectedTasks += expectedTasks.length
  totals.predictedTasks += predictedTasks.length
  totals.matchedTasks += alignment.pairs.length
  totals.exactActionObject += exactActionObject
  totals.safeDefaults += safeDefaults
  totals.safeDefaultsRecovered += safeDefaultsRecovered
  totals.forbiddenDefaults += forbidden.length
  totals.requiresActionCorrect += Number(requiresActionCorrect)
  totals.exactTaskBoundaryCases += Number(exactTaskBoundary)
  totals.completeTaskCases += Number(completeTaskCase)
  caseResults.push({
    caseId: expectedCase.id,
    contractValid: prediction.validation.valid,
    expectedTaskCount: expectedTasks.length,
    predictedTaskCount: predictedTasks.length,
    matchedTaskCount: alignment.pairs.length,
    exactActionObject,
    semanticBundles,
    safeDefaults,
    safeDefaultsRecovered,
    forbiddenDefaultSurfaces: forbidden,
    requiresActionCorrect,
    exactTaskBoundary,
    completeTaskCase,
  })
}

const precision = ratio(totals.matchedTasks, totals.predictedTasks)
const recall = ratio(totals.matchedTasks, totals.expectedTasks)
const metrics = {
  contractValidCases: predictions.cases.filter((item) => item.validation.valid).length,
  taskPrecision: precision,
  taskRecall: recall,
  taskF1: f1(precision, recall),
  exactActionObjectAccuracy: ratio(totals.exactActionObject, totals.expectedTasks),
  requiresActionAccuracy: ratio(totals.requiresActionCorrect, dataset.cases.length),
  semanticAxisAccuracy: ratio(totals.semanticsCorrect, totals.semanticsTotal),
  exactTaskBoundaryAccuracy: ratio(totals.exactTaskBoundaryCases, dataset.cases.length),
  completeTaskCaseAccuracy: ratio(totals.completeTaskCases, dataset.cases.length),
  safeDefaultRecall: ratio(totals.safeDefaultsRecovered, totals.safeDefaults),
  forbiddenDefaultSelections: totals.forbiddenDefaults,
  policyExpectedDifferencePairs: totals.policyExpectedDifferences,
}
const gatePassed = metrics.contractValidCases === 12 && metrics.forbiddenDefaultSelections === 0
  && metrics.requiresActionAccuracy === 1 && predictions.accounting.modelCalls === 0 && predictions.accounting.networkRequests === 0
const output = {
  schemaVersion: 'rco-5-007-replay-result-1.0.0',
  authorizationId: 'RCO-5-007',
  classification: 'SEEN_DIAGNOSTIC_REPLAY',
  runStatus: gatePassed ? 'VALID_ZERO_CALL_REPLAY' : 'STOP',
  decision: gatePassed ? 'ELIGIBLE_FOR_NEW_UNSEEN_VALIDATION_ONLY' : 'DO_NOT_PROCEED',
  evidenceBoundary: 'Seen B1 replay verifies deterministic repair behavior only; it is not generalization or release evidence.',
  accounting: predictions.accounting,
  integrity: {
    verifiedDependencyAndProtectedPaths: integrity.verifiedPaths,
    datasetSha256: createHash('sha256').update(datasetBytes).digest('hex'),
    predictionsSha256: createHash('sha256').update(predictionBytes).digest('hex'),
    priorResultSha256: createHash('sha256').update(priorBytes).digest('hex'),
  },
  metrics,
  priorB1ReferenceMetrics: prior.evaluation.metrics,
  metricComparability: 'Prior B1 metrics used fail-closed graph scoring; RCO-5-007 metrics are task-formation scoring. They are displayed separately and must not be subtracted as a causal lift.',
  caseResults,
  protectedArtifactsModified: false,
  stablePath: 'UNCHANGED',
  rco6: 'NOT_STARTED',
  deployment: 'NOT_RUN',
}
await writeFile(resultPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

const percent = (value) => value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`
const rows = caseResults.map((item) => `| ${item.caseId} | ${item.predictedTaskCount}/${item.expectedTaskCount} | ${item.exactActionObject}/${item.expectedTaskCount} | ${item.requiresActionCorrect ? 'PASS' : 'FAIL'} | ${item.forbiddenDefaultSurfaces.length} | ${item.completeTaskCase ? 'PASS' : 'FAIL'} |`).join('\n')
const report = `# RCO-5-007 B1 零调用回放报告\n\n- 分类：\`SEEN_DIAGNOSTIC_REPLAY\`，不是未见集。\n- 调用：模型 0、网络 0、Repair 0、retry 0、密钥访问 NONE。\n- 结论：\`${output.decision}\`；稳定路径未改、RCO-6 未启动、未部署。\n\n## 结果\n\n| 指标 | RCO-5-007 |\n|---|---:|\n| 新契约有效案例 | ${metrics.contractValidCases}/12 |\n| 任务 Precision / Recall / F1 | ${percent(metrics.taskPrecision)} / ${percent(metrics.taskRecall)} / ${percent(metrics.taskF1)} |\n| 动作+对象精确率 | ${percent(metrics.exactActionObjectAccuracy)} |\n| requiresAction | ${percent(metrics.requiresActionAccuracy)} |\n| 语义字段一致率 | ${percent(metrics.semanticAxisAccuracy)} |\n| 任务边界整例一致 | ${percent(metrics.exactTaskBoundaryAccuracy)} |\n| Complete Task Case | ${percent(metrics.completeTaskCaseAccuracy)} |\n| Safe Default Recall | ${percent(metrics.safeDefaultRecall)} |\n| Forbidden Default | ${metrics.forbiddenDefaultSelections} |\n\n## 逐例\n\n| Case | 预测/Expected 任务 | 动作对象 | requiresAction | Forbidden | Complete |\n|---|---:|---:|---|---:|---|\n${rows}\n\n## 如何解释\n\n这轮证明的是：同一批 B1 模型候选经过固定的本机规则后，可以稳定产出通过新契约的待确认建议，并且模型不再决定默认勾选。它不证明新材料也会一样好。\n\n旧 B1 的 Scope F1、Complete Case 等使用另一套 fail-closed 图评分，本轮使用任务形成评分，两者不能直接相减宣称“提升了多少”。本轮仍保留旧指标作为历史参照。\n\n共有 ${metrics.policyExpectedDifferencePairs} 个任务的完整语义组合与旧 Expected 不同：B1-01 的“暂勿提交”旧标签是 pending，而新政策统一为 cancelled；B1-04 的两个否定命令旧标签是 present，而新政策统一把面向收件人的命令标为 future。没有为追分修改 Expected。\n`
await writeFile(reportPath, report, 'utf8')
console.log(JSON.stringify({ result: resultPath, report: reportPath, runStatus: output.runStatus, decision: output.decision, metrics }))
