/* global console, process */
import { execFile as execFileCallback } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { loadClientRecognitionValidator, loadClientRecognitionValidatorSource } from './load-client-recognition-validator.mjs'
import { scoreCase, summarizeEvaluation } from './multimodal-evaluation-lib.mjs'

const execFile = promisify(execFileCallback)
const ROOT = process.cwd()
const BASELINE_COMMIT = 'c0771e927772a0986b0961108af68366b8127f41'
const LEGACY_SCORER_SHA256 = 'b022df3280d6b9024820824ed9a390c4b91304e3694f697b0f58bcB12fd3d365'.toLowerCase()
const LEGACY_CLIENT_VALIDATOR_SHA256 = '04be8fa6ba28c5c715ccfdb691a306ec318f6eca2f9bbf40804d3deb0fd40343'

const RUNS = Object.freeze([
  {
    runId: 'MM-V2-001',
    testedArms: ['T', 'I', 'IT'],
    dataDir: '.evaluation-cache/multimodal-unseen-v2',
    datasetSha256: '464d4cd14f46f79fc908ef480a39def8b9e92463455b5131a9376855e6e9347c',
    ocrSha256: '365df840c775c1914bc5439457dbbaa605f26d41d6e1342acbcd65887ee94399',
    checkpoint: '.evaluation-cache/multimodal-unseen-v2/runs/synthetic-unseen-v2-formal-20260831a.checkpoint.json',
    checkpointSha256: 'a451d7ce9a206ba78d4b13dab5b408c17c62e636641fcb6e4664360ecf44bc39',
    summary: '.evaluation-cache/multimodal-unseen-v2/runs/synthetic-unseen-v2-formal-20260831a.summary.json',
    summarySha256: '2c77964ea13cea47ade40aa1d63f788898bbd187f211fc0cac39075961779ec2',
    freeze: 'docs/e2-multimodal-experiment/SYNTHETIC_UNSEEN_V2_FREEZE.json',
    freezeSha256: 'a4790b96d4a8a68ba39dc6d8cd38cfa424545efdd092c947dcef416bc7b3361f',
  },
  {
    runId: 'MM-V3-I-001',
    testedArms: ['I'],
    dataDir: '.evaluation-cache/multimodal-unseen-v3',
    datasetSha256: '2f0e3455d7eedfb2554119ee8aa88b54da799e7d2a1f5c1434997ff4be76e5de',
    ocrSha256: '814150a98507f984d30e46ace8b6a41f503812bb358257de26f65d7814fbcb63',
    checkpoint: '.evaluation-cache/multimodal-unseen-v3/runs/synthetic-unseen-v3-image-only-replication-20260831a.checkpoint.json',
    checkpointSha256: 'd24e3fa8893f00a74221b1dc2b333f5289405bb243c9fd526b194180ee80ddd5',
    summary: '.evaluation-cache/multimodal-unseen-v3/runs/synthetic-unseen-v3-image-only-replication-20260831a.summary.json',
    summarySha256: '154ff19a0149a9a3036826c70992019c7c826fcc8f1ed0df854b945413eb60c2',
    freeze: 'docs/e2-multimodal-experiment/SYNTHETIC_UNSEEN_V3_IMAGE_ONLY_FREEZE.json',
    freezeSha256: '5b60e3dcc35b9417b40473876cc54f82734a69be7882f7e13248b0f6887a4e19',
  },
])

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

async function protectedJson(relativePath, expectedSha256 = null) {
  const absolutePath = path.resolve(ROOT, relativePath)
  const text = await readFile(absolutePath, 'utf8')
  const actualSha256 = sha256(text)
  if (expectedSha256 && actualSha256 !== expectedSha256) {
    throw new Error(`PROTECTED_INPUT_HASH_MISMATCH:${relativePath}:${actualSha256}`)
  }
  return { relativePath, text, sha256: actualSha256, value: JSON.parse(text) }
}

async function loadLegacyScorer() {
  const { stdout } = await execFile('git', ['show', `${BASELINE_COMMIT}:scripts/multimodal-evaluation-lib.mjs`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  })
  const sourceSha256 = sha256(stdout)
  if (sourceSha256 !== LEGACY_SCORER_SHA256) throw new Error(`LEGACY_SCORER_HASH_MISMATCH:${sourceSha256}`)
  const module = await import(`data:text/javascript;base64,${Buffer.from(stdout).toString('base64')}`)
  return { sourceSha256, summarizeEvaluation: module.summarizeEvaluation }
}

async function loadLegacyClientValidator() {
  const { stdout } = await execFile('git', ['show', `${BASELINE_COMMIT}:src/recognition/schema.ts`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  })
  if (sha256(stdout) !== LEGACY_CLIENT_VALIDATOR_SHA256) throw new Error('LEGACY_CLIENT_VALIDATOR_HASH_MISMATCH')
  return loadClientRecognitionValidatorSource(stdout, `${BASELINE_COMMIT}:src/recognition/schema.ts`)
}

function comparableSummary(summary) {
  return {
    schemaVersion: summary.schemaVersion,
    datasetId: summary.datasetId,
    datasetSha256: summary.datasetSha256,
    sampleCountPerArm: summary.sampleCountPerArm,
    metricsByArm: summary.metricsByArm,
    pairedComparisons: summary.pairedComparisons,
    humanTiming: summary.humanTiming,
  }
}

function allRawTasks(result) {
  if (!result || typeof result !== 'object') return []
  return [
    ...(Array.isArray(result.standaloneTasks) ? result.standaloneTasks : []),
    ...(Array.isArray(result.milestones) ? result.milestones : []).flatMap((milestone) => [
      ...(Array.isArray(milestone?.tasks) ? milestone.tasks : []),
      ...(Array.isArray(milestone?.workPackages) ? milestone.workPackages : []).flatMap((workPackage) => (
        Array.isArray(workPackage?.tasks) ? workPackage.tasks : []
      )),
    ]),
  ]
}

function historicalShapeDiagnostics(result) {
  const timePointIds = new Set(Array.isArray(result?.timePoints) ? result.timePoints.map((item) => item?.tempId).filter(Boolean) : [])
  const danglingTaskTimeReferences = allRawTasks(result).flatMap((task) => (
    Array.isArray(task?.timePointTempIds) ? task.timePointTempIds.filter((id) => !timePointIds.has(id)) : []
  )).length
  return {
    ignoredContentStringArray: Array.isArray(result?.ignoredContent) && result.ignoredContent.some((item) => typeof item === 'string'),
    danglingTaskTimeReferences,
  }
}

function normalizeHistoricalFailure(category) {
  if (category === 'authentication' || category === 'billing' || category === 'rate_limit') return category
  if (category === 'model_mismatch' || category === 'model_unavailable') return 'model'
  if (category === 'schema' || category === 'reference' || category === 'semantic' || category === 'json') return category
  return 'transport'
}

function reclassifyObservation(fixture, observation, validateRecognitionResult) {
  if (!observation.result) {
    return scoreCase(fixture, observation.arm, null, {
      status: 'request_failure',
      failureCategory: normalizeHistoricalFailure(observation.failureCategory),
      failureReason: observation.failureReason ?? 'historical request failure',
      latencyMs: observation.latencyMs,
      tokenUsage: observation.tokenUsage,
    })
  }
  let validation
  try {
    validation = validateRecognitionResult(observation.result)
  } catch (error) {
    return scoreCase(fixture, observation.arm, observation.result, {
      status: 'scoring_failure',
      failureCategory: 'scoring',
      failureReason: error instanceof Error ? `CLIENT_VALIDATION_EXCEPTION:${error.name}` : 'CLIENT_VALIDATION_EXCEPTION',
      latencyMs: observation.latencyMs,
      tokenUsage: observation.tokenUsage,
    })
  }
  const issueCodes = [...new Set(validation.issues.map((issue) => issue.code))].sort()
  const scored = scoreCase(fixture, observation.arm, observation.result, {
    ...(validation.valid ? { status: 'completed' } : {
      status: 'invalid_result',
      failureCategory: validation.failureCategory,
      failureReason: issueCodes.join(',') || 'CLIENT_VALIDATION_FAILED',
    }),
    latencyMs: observation.latencyMs,
    tokenUsage: observation.tokenUsage,
  })
  return {
    ...scored,
    validationIssueCodes: issueCodes,
    historicalShapeDiagnostics: historicalShapeDiagnostics(observation.result),
    resultSha256: observation.resultSha256 ?? sha256(stableJson(observation.result)),
  }
}

function armReclassification(run, arm) {
  const original = run.originalCheckpoint.observations.filter((item) => item.arm === arm)
  const reclassified = run.reclassifiedObservations.filter((item) => item.arm === arm)
  const failureCountsByCategory = reclassified.filter((item) => item.status !== 'completed').reduce((counts, item) => ({
    ...counts,
    [item.failureCategory ?? 'unknown']: (counts[item.failureCategory ?? 'unknown'] ?? 0) + 1,
  }), {})
  const issueCounts = reclassified.flatMap((item) => item.validationIssueCodes ?? []).reduce((counts, code) => ({
    ...counts,
    [code]: (counts[code] ?? 0) + 1,
  }), {})
  return {
    arm,
    planned: run.testedArms.includes(arm) ? run.dataset.sampleCount : 0,
    observed: original.length,
    requestOrModelReturns: original.filter((item) => Boolean(item.result)).length,
    clientValid: reclassified.filter((item) => item.status === 'completed').length,
    requestFailures: reclassified.filter((item) => item.status === 'request_failure').length,
    invalidResults: reclassified.filter((item) => item.status === 'invalid_result').length,
    failureCountsByCategory,
    validationIssueCounts: issueCounts,
    resultsWithIgnoredContentStringArray: reclassified.filter((item) => item.historicalShapeDiagnostics?.ignoredContentStringArray).length,
    resultsWithDanglingTaskTimeReferences: reclassified.filter((item) => (item.historicalShapeDiagnostics?.danglingTaskTimeReferences ?? 0) > 0).length,
    danglingTaskTimeReferenceCount: reclassified.reduce((total, item) => total + (item.historicalShapeDiagnostics?.danglingTaskTimeReferences ?? 0), 0),
    legacyTaskF1: run.originalSummary.metricsByArm[arm]?.task?.f1 ?? null,
    legacyForbiddenTaskRate: run.originalSummary.metricsByArm[arm]?.forbiddenTaskRate ?? null,
    reclassifiedRunStatus: run.reclassifiedSummary.metricsByArm[arm].runStatus,
    reclassifiedTaskF1: run.reclassifiedSummary.metricsByArm[arm].task.f1,
  }
}

async function reclassifyRun(config, legacyScorer, legacyClientValidator, clientValidator) {
  const [datasetFile, ocrFile, checkpointFile, summaryFile, freezeFile] = await Promise.all([
    protectedJson(`${config.dataDir}/dataset.json`, config.datasetSha256),
    protectedJson(`${config.dataDir}/ocr.json`, config.ocrSha256),
    protectedJson(config.checkpoint, config.checkpointSha256),
    protectedJson(config.summary, config.summarySha256),
    protectedJson(config.freeze, config.freezeSha256),
  ])
  const dataset = datasetFile.value
  const ocrByCase = new Map(ocrFile.value.cases.map((item) => [item.caseId, item.text]))
  const fixtures = new Map(dataset.cases.map((fixture) => [fixture.id, { ...fixture, ocrText: ocrByCase.get(fixture.id) ?? '' }]))
  const originalCheckpoint = checkpointFile.value
  const originalSummary = summaryFile.value
  const legacyReproduction = legacyScorer.summarizeEvaluation(dataset, originalCheckpoint.observations)
  const legacySummaryMatches = stableJson(comparableSummary(legacyReproduction)) === stableJson(comparableSummary(originalSummary))
  if (!legacySummaryMatches) throw new Error(`LEGACY_SUMMARY_REPRODUCTION_MISMATCH:${config.runId}`)
  const clientDecisionMismatches = originalCheckpoint.observations.filter((observation) => (
    Boolean(observation.result)
    && legacyClientValidator.isRecognitionResult(observation.result) !== clientValidator.isRecognitionResult(observation.result)
  ))
  if (clientDecisionMismatches.length) throw new Error(`CLIENT_VALIDATOR_BEHAVIOR_DRIFT:${config.runId}:${clientDecisionMismatches.length}`)
  const testedArms = originalCheckpoint.selectedArms ?? originalSummary.testedArms ?? config.testedArms
  const reclassifiedObservations = originalCheckpoint.observations.map((observation) => {
    const fixture = fixtures.get(observation.caseId)
    if (!fixture) throw new Error(`FIXTURE_MISSING:${config.runId}:${observation.caseId}`)
    return reclassifyObservation(fixture, observation, clientValidator.validateRecognitionResult)
  })
  const reclassifiedSummary = summarizeEvaluation(dataset, reclassifiedObservations, { testedArms })
  const run = { dataset, testedArms, originalCheckpoint, originalSummary, reclassifiedObservations, reclassifiedSummary }
  return {
    runId: config.runId,
    datasetId: dataset.datasetId,
    datasetClassification: 'synthetic_proxy',
    independentSemanticFamilyCount: new Set(dataset.cases.map((item) => item.scenarioFamilyId)).size,
    renderedSourceCount: dataset.sampleCount,
    testedArms,
    protectedInputs: {
      dataset: { path: datasetFile.relativePath, sha256: datasetFile.sha256 },
      ocr: { path: ocrFile.relativePath, sha256: ocrFile.sha256 },
      checkpoint: { path: checkpointFile.relativePath, sha256: checkpointFile.sha256 },
      summary: { path: summaryFile.relativePath, sha256: summaryFile.sha256 },
      freeze: { path: freezeFile.relativePath, sha256: freezeFile.sha256 },
    },
    legacyScorerReproduction: {
      baselineCommit: BASELINE_COMMIT,
      scorerSha256: legacyScorer.sourceSha256,
      exactCoreSummaryMatch: true,
    },
    clientValidatorBehaviorMatch: {
      baselineSha256: legacyClientValidator.sourceSha256,
      currentSha256: clientValidator.sourceSha256,
      comparedTruthyResults: originalCheckpoint.observations.filter((item) => Boolean(item.result)).length,
      mismatchCount: 0,
    },
    byArm: Object.fromEntries(['T', 'I', 'IT'].map((arm) => [arm, armReclassification(run, arm)])),
    pairedComparisons: reclassifiedSummary.pairedComparisons,
    humanTiming: reclassifiedSummary.humanTiming,
  }
}

function markdown(report) {
  const rows = report.runs.flatMap((run) => ['T', 'I', 'IT'].map((arm) => {
    const item = run.byArm[arm]
    return `| ${run.runId} | ${arm} | ${item.planned} | ${item.requestOrModelReturns} | ${item.clientValid} | ${item.requestFailures} | ${item.invalidResults} | ${item.reclassifiedRunStatus} |`
  }))
  return `# RCO-0 历史多模态结果重分类\n\n` +
    `- schemaVersion: \`${report.schemaVersion}\`\n` +
    `- generatedAt: \`${report.generatedAt}\`\n` +
    `- baselineCommit: \`${report.baselineCommit}\`\n` +
    `- clientValidatorSha256: \`${report.clientValidator.sourceSha256}\`\n` +
    `- rco0ScorerSha256: \`${report.rco0Scorer.sourceSha256}\`\n` +
    `- modelCalls: \`0\`\n` +
    `- verdict: \`${report.verdict}\`\n\n` +
    `旧 checkpoint、summary、dataset、Expected、freeze 与缓存均为只读输入；原始分数只保留为 \`LEGACY_SCORER_DIAGNOSTIC_ONLY\`。\n\n` +
    `| Run | Arm | Planned | 返回结果 | 客户端有效 | 请求失败 | 无效结果 | 重分类状态 |\n` +
    `|---|---:|---:|---:|---:|---:|---:|---|\n${rows.join('\n')}\n\n` +
    `## 结论边界\n\n` +
    `- “36/36 success”只能改释为 36/36 request/model returns，不能称客户端成功。\n` +
    `- V2/V3 都是 12 个语义模板家族的合成代理，不是 72 个独立真实案例。\n` +
    `- 历史 Forbidden 指标搜索了 description，标记为 \`UNINTERPRETABLE_UNDER_OLD_DESCRIPTION_SCOPE\`。\n` +
    `- V2 IT 有一个 transport failure，所有配对质量比较保持 \`INVALID_RUN\`。\n` +
    `- 真实去标识材料、真人修改时间、浏览器验收与商业正确率仍为 \`NOT_RUN\`；不得晋级或上线。\n`
}

async function main() {
  if (process.argv.some((argument) => argument.startsWith('--endpoint') || argument.startsWith('--model'))) {
    throw new Error('RCO_0_RECLASSIFICATION_IS_OFFLINE_ONLY')
  }
  const protectedPaths = [...new Set(RUNS.flatMap((run) => [
    `${run.dataDir}/dataset.json`, `${run.dataDir}/ocr.json`, run.checkpoint, run.summary, run.freeze,
  ]))]
  const beforeHashes = Object.fromEntries(await Promise.all(protectedPaths.map(async (relativePath) => (
    [relativePath, sha256(await readFile(path.resolve(ROOT, relativePath)))]
  ))))
  const [legacyScorer, legacyClientValidator, clientValidator] = await Promise.all([
    loadLegacyScorer(), loadLegacyClientValidator(), loadClientRecognitionValidator(),
  ])
  const rco0ScorerSource = await readFile(path.resolve(ROOT, 'scripts/multimodal-evaluation-lib.mjs'))
  const runs = []
  for (const config of RUNS) runs.push(await reclassifyRun(config, legacyScorer, legacyClientValidator, clientValidator))
  const afterHashes = Object.fromEntries(await Promise.all(Object.keys(beforeHashes).map(async (relativePath) => (
    [relativePath, sha256(await readFile(path.resolve(ROOT, relativePath)))]
  ))))
  if (stableJson(beforeHashes) !== stableJson(afterHashes)) throw new Error('PROTECTED_INPUT_CHANGED_DURING_RECLASSIFICATION')
  const report = {
    schemaVersion: 'rco-0-reclassification-1.0.0',
    generatedAt: new Date().toISOString(),
    baselineCommit: BASELINE_COMMIT,
    authorization: 'RCO-0 only; zero model calls; protected historical evidence read-only',
    clientValidator: { path: 'src/recognition/schema.ts', sourceSha256: clientValidator.sourceSha256 },
    rco0Scorer: { path: 'scripts/multimodal-evaluation-lib.mjs', sourceSha256: sha256(rco0ScorerSource) },
    protectedInputsUnchanged: true,
    modelCalls: 0,
    runs,
    verdict: 'NO_PROMOTION',
    nextGate: 'RCO-1_NOT_AUTHORIZED',
    claimsNotSupported: [
      'commercial correctness', 'real-material generalization', 'human edit-time benefit',
      'browser acceptance', 'vision superiority', 'Preview readiness', 'Production readiness',
    ],
  }
  const jsonText = `${JSON.stringify(report, null, 2)}\n`
  const markdownText = markdown(report)
  if (process.argv.includes('--write')) {
    await writeFile(path.resolve(ROOT, 'docs/recognition-optimization/RCO-0_RECLASSIFICATION.json'), jsonText, 'utf8')
    await writeFile(path.resolve(ROOT, 'docs/recognition-optimization/RCO-0_RECLASSIFICATION.md'), markdownText, 'utf8')
  }
  console.log(JSON.stringify({
    schemaVersion: report.schemaVersion,
    clientValidatorSha256: report.clientValidator.sourceSha256,
    protectedInputsUnchanged: report.protectedInputsUnchanged,
    modelCalls: report.modelCalls,
    runs: report.runs.map((run) => ({ runId: run.runId, byArm: run.byArm })),
    verdict: report.verdict,
  }, null, 2))
}

await main()
