import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const PACKET_PATH = '.evaluation-cache/e2-7/p3-planning-audit-packet.json'
const MANIFEST_PATH = 'docs/e2-path-a-planning/p3-planning-audit-manifest.json'
const LABELS_PATH = 'docs/e2-path-a-planning/p3-planning-failure-labels.json'
const JSON_OUTPUT = 'docs/e2-path-a-planning/p3-planning-failure-audit.json'
const MARKDOWN_OUTPUT = 'docs/e2-path-a-planning/P3_PATH_A_PLANNING_FAILURE_AUDIT.md'
const IMPACTS = new Set(['MAJOR', 'MINOR', 'NONE'])
const FACT_DISCOVERY_CATEGORIES = new Set(['FACT_MISSING'])
const PLANNING_CATEGORIES = new Set([
  'FACT_PRESENT_PLANNING_WRONG', 'TASK_OVER_SPLIT', 'TASK_OVER_MERGED', 'TASK_FALSE_POSITIVE', 'TASK_MISSING',
  'MATERIAL_TASK_CONFUSION', 'EVENT_TASK_CONFUSION', 'WRONG_TIME_ROLE', 'WRONG_TIME_VALUE', 'MISSING_AMBIGUITY',
  'WRONG_MILESTONE', 'MILESTONE_ALIAS_ONLY',
])

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function countBy(values) {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)))
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null
}

function allCategories(label) {
  return [label.primaryCategory, ...label.secondaryCategories]
}

function hasAnyCategory(label, allowed) {
  return allCategories(label).some((category) => allowed.has(category))
}

function taskTitles(value) {
  return (value?.tasks ?? []).map((task) => {
    if (typeof task === 'string') return task
    if (task.title) return task.title
    const action = task.actionAliases?.[0] ?? task.actionVerb
    const object = task.objectAliases?.[0] ?? task.actionObject
    return [action, object].filter(Boolean).join('')
  }).filter(Boolean)
}

function entityLabel(item, preferred, fallback) {
  if (typeof item === 'string') return item
  return item[preferred] ?? item[fallback]?.[0] ?? item.key
}

function entitySummary(value) {
  const tasks = taskTitles(value)
  const milestones = (value?.milestones ?? []).map((item) => entityLabel(item, 'title', 'titleAliases')).filter(Boolean)
  const materials = (value?.materials ?? []).map((item) => entityLabel(item, 'name', 'nameAliases')).filter(Boolean)
  const times = (value?.timePoints ?? []).map((item) => {
    if (typeof item === 'string') return item
    return [item.rawText ?? item.rawIncludes?.[0], item.type, item.normalizedValue ?? item.normalizedLocal].filter(Boolean).join('/')
  })
  const events = (value?.events ?? []).map((item) => entityLabel(item, 'title', 'titleAliases')).filter(Boolean)
  const ambiguities = (value?.ambiguities ?? []).map((item) => {
    if (typeof item === 'string') return item
    return item.message ?? item.description ?? item.reason ?? item.text ?? item.messageIncludes?.[0] ?? item.key
  }).filter(Boolean)
  return { tasks, milestones, materials, timePoints: times, events, ambiguities }
}

function compactSummary(value) {
  const summary = entitySummary(value)
  const segments = [
    ['T', summary.tasks], ['M', summary.milestones], ['Mat', summary.materials],
    ['Time', summary.timePoints], ['E', summary.events], ['Amb', summary.ambiguities],
  ].filter(([, entries]) => entries.length > 0)
  return segments.map(([label, entries]) => `${label}: ${entries.join('；')}`).join(' | ') || '无结构化实体'
}

function markdownCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\r', ' ').replaceAll('\n', '<br>')
}

function percent(value) {
  return value === null ? 'N/A' : `${(value * 100).toFixed(2)}%`
}

async function main() {
  const [packetBytes, manifestBytes, labelsBytes] = await Promise.all([
    readFile(path.resolve(ROOT, PACKET_PATH)),
    readFile(path.resolve(ROOT, MANIFEST_PATH)),
    readFile(path.resolve(ROOT, LABELS_PATH)),
  ])
  const packet = JSON.parse(packetBytes.toString('utf8'))
  const manifest = JSON.parse(manifestBytes.toString('utf8'))
  const labels = JSON.parse(labelsBytes.toString('utf8'))
  const packetHash = sha256(packetBytes)
  if (packetHash !== manifest.packet.sha256 || packetHash !== labels.packetSha256) throw new Error('P3 packet hash binding failed')
  if (packet.sampleCount !== 60 || packet.rows.length !== 60 || labels.rows.length !== 60) throw new Error('P3 must contain exactly 60 rows')

  const allowedCategories = new Set(packet.allowedCategories)
  const packetById = new Map(packet.rows.map((row) => [row.caseId, row]))
  const seen = new Set()
  for (const label of labels.rows) {
    if (seen.has(label.caseId)) throw new Error(`Duplicate label: ${label.caseId}`)
    seen.add(label.caseId)
    const packetRow = packetById.get(label.caseId)
    if (!packetRow) throw new Error(`Unknown case: ${label.caseId}`)
    if (!allowedCategories.has(label.primaryCategory)) throw new Error(`Unknown primary category: ${label.caseId}`)
    if (!Array.isArray(label.secondaryCategories) || new Set(label.secondaryCategories).size !== label.secondaryCategories.length) throw new Error(`Invalid secondary categories: ${label.caseId}`)
    if (label.secondaryCategories.includes(label.primaryCategory)) throw new Error(`Primary category repeated: ${label.caseId}`)
    for (const category of label.secondaryCategories) if (!allowedCategories.has(category)) throw new Error(`Unknown secondary category: ${label.caseId}/${category}`)
    if (!Array.isArray(label.sourceEvidence) || label.sourceEvidence.length === 0) throw new Error(`Missing source evidence: ${label.caseId}`)
    for (const quote of label.sourceEvidence) {
      if (typeof quote !== 'string' || quote.length === 0 || !packetRow.source.text.includes(quote)) throw new Error(`Non-literal source evidence: ${label.caseId}`)
    }
    if (typeof label.attributionReason !== 'string' || label.attributionReason.trim().length < 10) throw new Error(`Missing attribution reason: ${label.caseId}`)
    if (!IMPACTS.has(label.userActionImpact)) throw new Error(`Invalid user impact: ${label.caseId}`)
  }
  if (seen.size !== packetById.size || [...packetById.keys()].some((caseId) => !seen.has(caseId))) throw new Error('P3 packet/label coverage mismatch')

  const rows = labels.rows.map((label) => {
    const packetRow = packetById.get(label.caseId)
    return {
      caseId: label.caseId,
      sourceSet: packetRow.sourceSet,
      source: packetRow.source,
      expected: packetRow.expected,
      prediction: packetRow.prediction,
      strict: packetRow.strict,
      pipelineObservation: packetRow.pipelineObservation,
      audit: {
        primaryCategory: label.primaryCategory,
        secondaryCategories: label.secondaryCategories,
        sourceEvidence: label.sourceEvidence,
        attributionReason: label.attributionReason,
        userActionImpact: label.userActionImpact,
      },
    }
  })
  const labelsWithFactDiscovery = labels.rows.filter((row) => hasAnyCategory(row, FACT_DISCOVERY_CATEGORIES))
  const labelsWithPlanning = labels.rows.filter((row) => hasAnyCategory(row, PLANNING_CATEGORIES))
  const categoryOccurrence = countBy(labels.rows.flatMap(allCategories))
  const userImpact = countBy(labels.rows.map((row) => row.userActionImpact))
  const result = {
    schemaVersion: 'e2.7-p3-planning-failure-audit-1.0.0',
    status: 'COMPLETE_EXPOSED_DIAGNOSTIC_ONLY',
    reviewer: labels.reviewer,
    provenance: {
      packetPath: PACKET_PATH,
      packetSha256: packetHash,
      manifestSha256: sha256(manifestBytes),
      labelsSha256: sha256(labelsBytes),
      selectionVersion: manifest.selectionVersion,
      expectedPolicy: manifest.expectedPolicy,
      promptModified: false,
    },
    totals: {
      sampleCount: rows.length,
      bySourceSet: countBy(rows.map((row) => row.sourceSet)),
      byPrimaryCategory: countBy(labels.rows.map((row) => row.primaryCategory)),
      byCategoryOccurrence: categoryOccurrence,
      byUserActionImpact: userImpact,
      userImpactMajorRate: ratio(userImpact.MAJOR ?? 0, rows.length),
      factDiscoveryCaseCount: labelsWithFactDiscovery.length,
      factDiscoveryCaseRate: ratio(labelsWithFactDiscovery.length, rows.length),
      planningCaseCount: labelsWithPlanning.length,
      planningCaseRate: ratio(labelsWithPlanning.length, rows.length),
      evaluationMismatchCaseCount: labels.rows.filter((row) => allCategories(row).includes('EVALUATION_MISMATCH')).length,
      reasonableEquivalentCaseCount: labels.rows.filter((row) => allCategories(row).includes('REASONABLE_EQUIVALENT_STRUCTURE')).length,
      validatorMissedCaseCount: labels.rows.filter((row) => allCategories(row).includes('VALIDATOR_MISSED')).length,
      repairHarmCaseCount: labels.rows.filter((row) => allCategories(row).includes('REPAIR_HARM')).length,
      routerUnderRoutedCaseCount: labels.rows.filter((row) => allCategories(row).includes('ROUTER_UNDER_ROUTED')).length,
      routerOverRoutedCaseCount: labels.rows.filter((row) => allCategories(row).includes('ROUTER_OVER_ROUTED')).length,
    },
    interpretationPolicy: {
      primaryCategoriesAreExclusive: true,
      categoryOccurrenceAndLayerCountsAreNonExclusive: true,
      factDiscoveryDefinition: [...FACT_DISCOVERY_CATEGORIES],
      planningDefinition: [...PLANNING_CATEGORIES],
      userImpactDefinition: 'MAJOR requires substantial user repair before safe use; MINOR is localized edit; NONE is usable or semantically equivalent.',
    },
    rows,
    limitations: [
      'The 60 cases were selected from exposed diagnostic sets with current strict planning failures; this is a failure audit, not a prevalence estimate or new Blind.',
      'The reviewer could see source, expected, prediction, strict failures, route, and repair because P3 is attribution rather than blinded calibration.',
      'Fact-discovery, planning, and evaluation-mismatch layer counts are non-exclusive when one case has multiple interacting defects.',
      'No expected answer, Prompt, Router, Validator, Repair, model, or production runtime was modified during P3.',
    ],
  }

  const primaryRows = Object.entries(result.totals.byPrimaryCategory)
    .map(([category, count]) => `| ${category} | ${count} | ${percent(ratio(count, rows.length))} |`).join('\n')
  const markdownRows = rows.map((row) => {
    const audit = row.audit
    return `| ${markdownCell(row.caseId)} | ${markdownCell(row.sourceSet)} | ${markdownCell(audit.sourceEvidence.join('；'))} | ${markdownCell(compactSummary(row.expected))} | ${markdownCell(compactSummary(row.prediction))} | ${markdownCell([audit.primaryCategory, ...audit.secondaryCategories].join(', '))} | ${markdownCell(audit.attributionReason)} | ${audit.userActionImpact} |`
  }).join('\n')
  const markdown = `# P3 Path A Planning Failure Audit\n\n` +
    `状态：**COMPLETE_EXPOSED_DIAGNOSTIC_ONLY**。本报告审计冻结的 60 条 Path A strict planning-failure 样例；不是新 Blind，也不用于估计总体错误率。\n\n` +
    `## 完整性与边界\n\n` +
    `- 冻结 packet SHA-256：\`${packetHash}\`\n` +
    `- 标签 SHA-256：\`${result.provenance.labelsSha256}\`\n` +
    `- 样例：60 条，Development / Exposed Holdout / Golden 各 20 条。\n` +
    `- 60/60 均含原文逐字证据、expected、当前 prediction、归因理由和用户修改影响。\n` +
    `- P3 只做暴露诊断集归因；未修改 expected、Prompt、Router、Validator、Repair 或生产运行代码。\n\n` +
    `## 汇总\n\n` +
    `- User-impact Major：${userImpact.MAJOR ?? 0}/60（${percent(result.totals.userImpactMajorRate)}）。\n` +
    `- 含事实发现缺失：${result.totals.factDiscoveryCaseCount}/60（${percent(result.totals.factDiscoveryCaseRate)}）。\n` +
    `- 含规划层错误：${result.totals.planningCaseCount}/60（${percent(result.totals.planningCaseRate)}）。\n` +
    `- 含合理等价结构：${result.totals.reasonableEquivalentCaseCount}/60；含评测契约错配：${result.totals.evaluationMismatchCaseCount}/60。\n` +
    `- Validator missed：${result.totals.validatorMissedCaseCount}/60；Repair harm：${result.totals.repairHarmCaseCount}/60。\n` +
    `- 上述层级计数允许重叠；互斥口径仅为下表 primary category。\n\n` +
    `| Primary category | Count | Share |\n|---|---:|---:|\n${primaryRows}\n\n` +
    `## 逐例审计\n\n` +
    `Expected 与 prediction 均为冻结 packet 的结构摘要；完整结构、strict failures、route 与 repair 观测保存在同目录 JSON。\n\n` +
    `| Case | Set | 原文证据 | Expected 摘要 | 当前 Prediction 摘要 | 归因 | 判断理由 | 用户影响 |\n` +
    `|---|---|---|---|---|---|---|---|\n${markdownRows}\n\n` +
    `## P4 输入结论\n\n` +
    `P4 只允许处理不新增事实的确定性结构规范化。事实缺失、动作谓词错误、时间值错误、条件/歧义遗漏、Event/Task 语义混淆不能由 PlanningNormalizer 猜测修复；合理等价结构与 strict scorer 错配也不能通过修改 expected 刷分。\n`

  await Promise.all([
    writeFile(path.resolve(ROOT, JSON_OUTPUT), `${JSON.stringify(result, null, 2)}\n`, 'utf8'),
    writeFile(path.resolve(ROOT, MARKDOWN_OUTPUT), markdown, 'utf8'),
  ])
  process.stdout.write(`${JSON.stringify({ provenance: result.provenance, totals: result.totals }, null, 2)}\n`)
}

await main()
