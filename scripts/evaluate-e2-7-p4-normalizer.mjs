import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { performance } from 'node:perf_hooks'
import { createServer } from 'vite'

const ROOT = process.cwd()
const PACKET_PATH = '.evaluation-cache/e2-7/p2b-full-packet.json'
const KEY_PATH = 'docs/e2-path-a-planning/p2b-reveal-key.json'
const RAW_OUTPUT = '.evaluation-cache/e2-7/p4-planning-normalizer-evaluation.json'
const AGGREGATE_OUTPUT = 'docs/e2-path-a-planning/p4-planning-normalizer-results.json'
const REPORT_OUTPUT = 'docs/e2-path-a-planning/P4_PLANNING_NORMALIZER.md'

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null
}

function metricDelta(before, after) {
  return Object.fromEntries([
    'projectDecisionAccuracy', 'milestonePrecision', 'milestoneRecall', 'taskPrecision', 'taskRecall',
    'materialPrecision', 'materialRecall', 'timePointPrecision', 'timePointRecall', 'timePointTypeAccuracy',
    'timePointValueAccuracy', 'timePointAccuracy', 'eventAccuracy', 'evidenceCoverage', 'evidenceValidity',
    'ambiguityPrecision', 'ambiguityRecall', 'duplicateRate', 'overFragmentationRate', 'majorCorrectionRate', 'severeErrorRate',
  ].map((key) => [key, after[key] - before[key]]))
}

function percentage(value) {
  return `${(value * 100).toFixed(2)}%`
}

async function main() {
  const [packetBytes, keyBytes] = await Promise.all([
    readFile(path.resolve(ROOT, PACKET_PATH)),
    readFile(path.resolve(ROOT, KEY_PATH)),
  ])
  const packet = JSON.parse(packetBytes.toString('utf8'))
  const key = JSON.parse(keyBytes.toString('utf8'))
  if (sha256(packetBytes) !== key.packetSha256) throw new Error('P4 packet/reveal-key hash binding failed')
  if (packet.observations.length !== 72 || key.mapping.length !== 72) throw new Error('P4 requires the frozen 72-row P2B sample')
  const observations = new Map(packet.observations.map((item) => [item.observationId, item]))

  const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })
  try {
    const [golden, holdout, development, scoring, normalizer] = await Promise.all([
      vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/scoring.ts'),
      vite.ssrLoadModule('/src/recognition/e2/planningNormalizer.ts'),
    ])
    const fixtures = new Map([
      ...golden.recognitionGoldenDataset,
      ...holdout.recognitionHoldoutDataset,
      ...development.recognitionGeneralizationDevelopmentDataset,
    ].map((fixture) => [fixture.id, fixture]))
    const beforeRows = []
    const afterRows = []
    const rawRows = []
    for (const mapping of key.mapping) {
      const observation = observations.get(mapping.observationId)
      const fixture = fixtures.get(mapping.caseId)
      if (!observation || !fixture) throw new Error(`P4 incomplete mapping: ${mapping.observationId}`)
      if (observation.resultSha256 !== mapping.resultSha256) throw new Error(`P4 result binding drift: ${mapping.observationId}`)
      if (sha256(fixture.rawText) !== mapping.sourceSha256 || fixture.rawText !== observation.source.text) throw new Error(`P4 source binding drift: ${mapping.observationId}`)
      const beforeResult = {
        schemaVersion: '2.0',
        promptVersion: 'recognition-2.4.1',
        modelName: 'deepseek-v4-flash',
        createdAt: packet.createdAt,
        ...observation.recognition,
      }
      const beforeScore = scoring.scoreRecognitionCase(fixture, 'deepseek-production', beforeResult, 0)
      const started = performance.now()
      const normalized = normalizer.normalizePathAPlanning(beforeResult)
      const normalizerLatencyMs = performance.now() - started
      const afterScore = scoring.scoreRecognitionCase(fixture, 'deepseek-production', normalized.result, 0)
      beforeRows.push(beforeScore)
      afterRows.push(afterScore)
      rawRows.push({
        observationId: mapping.observationId,
        caseId: mapping.caseId,
        sourceSet: mapping.sourceSet,
        sourceSha256: mapping.sourceSha256,
        inputResultSha256: mapping.resultSha256,
        normalizedResultSha256: sha256(JSON.stringify(normalized.result)),
        normalizerLatencyMs,
        audit: normalized.audit,
        beforeScores: beforeScore.scores,
        afterScores: afterScore.scores,
        beforeFailures: beforeScore.failures,
        afterFailures: afterScore.failures,
      })
    }
    const before = scoring.aggregateRecognitionMetrics('deepseek-production', beforeRows)
    const after = scoring.aggregateRecognitionMetrics('deepseek-production', afterRows)
    const changedRows = rawRows.filter((row) => row.audit.changes.length > 0)
    const strictMajorImproved = rawRows.filter((row) => row.beforeScores.majorCorrection && !row.afterScores.majorCorrection).length
    const strictMajorHarmed = rawRows.filter((row) => !row.beforeScores.majorCorrection && row.afterScores.majorCorrection).length
    const severeImproved = rawRows.filter((row) => row.beforeScores.severeError && !row.afterScores.severeError).length
    const severeHarmed = rawRows.filter((row) => !row.beforeScores.severeError && row.afterScores.severeError).length
    const latencies = rawRows.map((row) => row.normalizerLatencyMs)
    const raw = {
      schemaVersion: 'e2.7-p4-planning-normalizer-raw-1.0.0',
      packetSha256: sha256(packetBytes),
      revealKeySha256: sha256(keyBytes),
      normalizerVersion: normalizer.PATH_A_PLANNING_NORMALIZER_VERSION,
      rows: rawRows,
    }
    const rawBytes = Buffer.from(`${JSON.stringify(raw, null, 2)}\n`, 'utf8')
    const result = {
      schemaVersion: 'e2.7-p4-planning-normalizer-results-1.0.0',
      status: 'COMPLETE_EXPOSED_DIAGNOSTIC_ONLY',
      provenance: {
        inputPacketSha256: sha256(packetBytes),
        revealKeySha256: sha256(keyBytes),
        normalizerVersion: normalizer.PATH_A_PLANNING_NORMALIZER_VERSION,
        promptVersion: 'recognition-2.4.1',
        modelName: 'deepseek-v4-flash',
        schemaVersion: '2.0',
        rawIgnoredPath: RAW_OUTPUT,
        rawSha256: sha256(rawBytes),
      },
      sample: {
        count: rawRows.length,
        source: 'P2B frozen exposed diagnostic sample',
        changedRowCount: changedRows.length,
        changedRowRate: ratio(changedRows.length, rawRows.length),
        changeTypeCounts: Object.fromEntries([...new Set(changedRows.flatMap((row) => row.audit.changes.map((change) => change.type)))].sort().map((type) => [type, changedRows.flatMap((row) => row.audit.changes).filter((change) => change.type === type).length])),
      },
      strictMetrics: { before, after, delta: metricDelta(before, after) },
      pairedSafety: { strictMajorImproved, strictMajorHarmed, severeImproved, severeHarmed },
      runtime: {
        addedModelCalls: 0,
        addedInputTokens: 0,
        addedOutputTokens: 0,
        normalizerLatencyMs: {
          mean: latencies.reduce((sum, value) => sum + value, 0) / latencies.length,
          max: Math.max(...latencies),
        },
      },
      userImpactMajor: {
        status: changedRows.length === 0 ? 'UNCHANGED_BY_IDENTITY' : 'NOT_RE_ADJUDICATED',
        reason: changedRows.length === 0 ? 'Normalizer made no semantic output changes.' : 'Changed outputs require a separate frozen adjudication; strict-score movement is not substituted for user impact.',
      },
      conclusion: after.taskRecall > before.taskRecall || after.majorCorrectionRate < before.majorCorrectionRate
        ? 'P4_STRICT_SIGNAL_POSITIVE_REQUIRES_USER_IMPACT_REVIEW'
        : 'P4_NO_STRICT_GAIN',
      limitations: [
        'This evaluation uses already exposed P2B diagnostics and cannot serve as a new Blind.',
        'The public P2B packet omits four fixed metadata fields; they are restored to their frozen P0 values and are not consumed by the normalizer or scorer.',
        'Generation latency and model tokens are unchanged; reported latency is only local deterministic normalization overhead.',
        'No changed output is assigned a new user-impact label without a separate frozen review.',
      ],
    }
    await mkdir(path.dirname(path.resolve(ROOT, RAW_OUTPUT)), { recursive: true })
    await Promise.all([
      writeFile(path.resolve(ROOT, RAW_OUTPUT), rawBytes),
      writeFile(path.resolve(ROOT, AGGREGATE_OUTPUT), `${JSON.stringify(result, null, 2)}\n`, 'utf8'),
      writeFile(path.resolve(ROOT, REPORT_OUTPUT), `# P4 Path A PlanningNormalizer\n\n` +
        `状态：**${result.status}**。该原型未接入 Production 默认路径，不调用模型，不读取 expected 执行规范化。expected 仅在规范化完成后由同一冻结 scorer 统一评分。\n\n` +
        `## Contract\n\n` +
        `- Version：\`${result.provenance.normalizerVersion}\`\n` +
        `- 允许：保守合并证据绑定的重复 Task、同一谓词下的并列材料、引用去重、标题空白/标点规范化、最多一层子任务、唯一证据支持的 Material↔Task 关联。\n` +
        `- 禁止并由不变量保护：新增 Task/Milestone，删除 Material/TimePoint/Event/Ambiguity，修改时间值或类型，调用模型，读取 caseId/expected 决策。\n` +
        `- Raw paired rows：\`${RAW_OUTPUT}\`（Git ignored），SHA-256 \`${result.provenance.rawSha256}\`。\n\n` +
        `## Paired results (72 exposed diagnostics)\n\n` +
        `- Changed rows：${result.sample.changedRowCount}/72（${percentage(result.sample.changedRowRate)}）。\n` +
        `- Task Precision：${percentage(before.taskPrecision)} → ${percentage(after.taskPrecision)}（${percentage(result.strictMetrics.delta.taskPrecision)}）。\n` +
        `- Task Recall：${percentage(before.taskRecall)} → ${percentage(after.taskRecall)}（${percentage(result.strictMetrics.delta.taskRecall)}）。\n` +
        `- Strict Major Correction：${percentage(before.majorCorrectionRate)} → ${percentage(after.majorCorrectionRate)}（${percentage(result.strictMetrics.delta.majorCorrectionRate)}）。\n` +
        `- Severe Error：${percentage(before.severeErrorRate)} → ${percentage(after.severeErrorRate)}（${percentage(result.strictMetrics.delta.severeErrorRate)}）。\n` +
        `- Evidence Coverage：${percentage(before.evidenceCoverage)} → ${percentage(after.evidenceCoverage)}。\n` +
        `- Paired strict major improved/harmed：${strictMajorImproved}/${strictMajorHarmed}；severe improved/harmed：${severeImproved}/${severeHarmed}。\n` +
        `- Added model calls/tokens：0 / 0；Normalizer latency mean ${result.runtime.normalizerLatencyMs.mean.toFixed(3)} ms, max ${result.runtime.normalizerLatencyMs.max.toFixed(3)} ms。\n` +
        `- User-impact Major：**${result.userImpactMajor.status}**。${result.userImpactMajor.reason}\n\n` +
        `## P4 decision\n\n` +
        `**${result.conclusion}**。P4 只保留能够由既有实体和逐字证据确定的结构操作；事实缺失、动作谓词错误、时间角色/值错误、条件或 Ambiguity 缺失、Event/Task 语义错误不由本 Normalizer 猜测修复。\n`, 'utf8'),
    ])
    process.stdout.write(`${JSON.stringify({ sample: result.sample, pairedSafety: result.pairedSafety, runtime: result.runtime, conclusion: result.conclusion, delta: result.strictMetrics.delta }, null, 2)}\n`)
  } finally {
    await vite.close()
  }
}

await main()
