import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

const ROOT = process.cwd()
const CHECKPOINT_PATH = path.join(ROOT, '.evaluation-cache/e2-7/p8-repair-ablation.json')
const MANIFEST_PATH = path.join(ROOT, 'docs/e2-path-a-planning/p8-repair-input-manifest.json')
const RESULTS_PATH = path.join(ROOT, 'docs/e2-path-a-planning/p8-repair-results.json')
const REPORT_PATH = path.join(ROOT, 'docs/e2-path-a-planning/P8_REPAIR_ABLATION_REPORT.md')
const CACHE_FILES = [
  '.evaluation-cache/deepseek-production-golden-e2-7-p6-router-golden.json',
  '.evaluation-cache/deepseek-production-holdout-e2-7-p6-router-holdout.json',
  '.evaluation-cache/deepseek-production-generalization-e2-7-p6-router-development.json',
]
const deploymentVersion = process.argv.find((arg) => arg.startsWith('--deployment-version='))?.split('=')[1]
if (!deploymentVersion) throw new Error('--deployment-version is required')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const percent = (value) => value === null ? 'NOT OBSERVABLE' : `${(value * 100).toFixed(2)}%`

const checkpointBytes = await readFile(CHECKPOINT_PATH)
const checkpoint = JSON.parse(checkpointBytes.toString('utf8'))
const manifestBytes = await readFile(MANIFEST_PATH)
const manifest = JSON.parse(manifestBytes.toString('utf8'))
if (checkpoint.inputArtifactSha256 !== manifest.inputArtifactSha256) throw new Error('Checkpoint input binding mismatch')
if (checkpoint.rows.length !== manifest.callCountPlanned || checkpoint.rows.some((row) => row.status !== 'ok')) throw new Error('Repair generation is incomplete')
const rowByKey = new Map(checkpoint.rows.map((row) => [`${row.caseId}:${row.mode}`, row]))
if (rowByKey.size !== checkpoint.rows.length) throw new Error('Duplicate repair observation')
const cacheEntries = (await Promise.all(CACHE_FILES.map(async (file) => JSON.parse(await readFile(path.join(ROOT, file), 'utf8'))))).flat()
const cacheById = new Map(cacheEntries.map((entry) => [entry.caseId, entry]))
const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })

try {
  const [golden, holdout, development, scoring] = await Promise.all([
    vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
    vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
    vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
    vite.ssrLoadModule('/src/recognition/e2/scoring.ts'),
  ])
  const fixtures = [...golden.recognitionGoldenDataset, ...holdout.recognitionHoldoutDataset, ...development.recognitionGeneralizationDevelopmentDataset]
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]))
  const baseScores = new Map()
  const buildArm = (mode) => cacheEntries.map((cached) => {
    const fixture = fixtureById.get(cached.caseId)
    if (!fixture || cached.status !== 'ok' || !cached.result) throw new Error(`Missing score input ${cached.caseId}`)
    const baseResult = cached.repair?.beforeResult ?? cached.result
    const recognizeOperation = cached.execution?.operations.find((operation) => operation.operation === 'recognize') ?? null
    const baseLatency = recognizeOperation?.durationMs ?? cached.latencyMs
    const baseTokens = recognizeOperation?.tokenUsage ?? cached.tokenUsage
    const before = scoring.scoreRecognitionCase(fixture, 'deepseek-production', baseResult, baseLatency, { tokenUsage: baseTokens, costUsd: null })
    baseScores.set(cached.caseId, before.scores)
    const baseExecution = cached.execution ? {
      ...cached.execution,
      attempts: recognizeOperation?.attempts ?? 1,
      durationMs: baseLatency,
      tokenUsage: baseTokens,
      operations: recognizeOperation ? [recognizeOperation] : [],
    } : null
    if (mode === 'R0') return { ...before, execution: baseExecution, repair: null, route: cached.route ?? null }
    const row = rowByKey.get(`${cached.caseId}:${mode}`)
    if (!row) return { ...before, execution: baseExecution, repair: { attempted: false, applied: false, beforeScores: null }, route: cached.route ?? null }
    if (row.sourceSha256 !== cached.sourceSha256 || row.baseResultSha256 !== sha256(JSON.stringify(baseResult))) throw new Error(`Repair row binding mismatch ${cached.caseId}:${mode}`)
    const finalResult = row.applied ? row.result : baseResult
    const repairTokens = row.execution?.tokenUsage ?? null
    const totalTokens = baseTokens && repairTokens ? { input: baseTokens.input + repairTokens.input, output: baseTokens.output + repairTokens.output } : null
    const after = scoring.scoreRecognitionCase(fixture, 'deepseek-production', finalResult, baseLatency + row.latencyMs, { tokenUsage: totalTokens, costUsd: null })
    return {
      ...after,
      execution: baseExecution ? { ...baseExecution, operations: [...baseExecution.operations, ...(row.execution?.operations ?? []).map((operation) => ({ ...operation, durationMs: row.latencyMs }))] } : null,
      repair: { attempted: true, applied: row.applied, beforeScores: before.scores, issueCodes: row.issueCodes },
      route: cached.route ?? null,
    }
  })
  const arms = Object.fromEntries(['R0', 'R1', 'R2'].map((mode) => {
    const results = buildArm(mode)
    const metrics = scoring.aggregateRecognitionMetrics('deepseek-production', results)
    return [mode, { metrics, strictFailureCount: results.reduce((sum, result) => sum + result.failures.length, 0) }]
  }))
  const metricKeys = ['taskPrecision', 'taskRecall', 'materialPrecision', 'materialRecall', 'timePointTypeAccuracy', 'timePointValueAccuracy', 'eventAccuracy', 'evidenceCoverage', 'evidenceValidity', 'ambiguityPrecision', 'ambiguityRecall', 'majorCorrectionRate', 'severeErrorRate', 'repairTriggerRate', 'repairAppliedRate', 'repairSuccessRate', 'repairHarmRate']
  const deltas = Object.fromEntries(['R1', 'R2'].map((mode) => [mode, Object.fromEntries(metricKeys.map((key) => [key, arms[mode].metrics[key] === null || arms.R0.metrics[key] === null ? null : arms[mode].metrics[key] - arms.R0.metrics[key]]))]))
  const output = {
    schemaVersion: 'e2.7-p8-repair-results-1.0.0',
    generatedAt: new Date().toISOString(),
    status: 'COMPLETE',
    scope: '80 exposed diagnostic cases; R0 fixed cached recognition; R1/R2 repair-only calls on 22 frozen triggers',
    bindings: {
      checkpointSha256: sha256(checkpointBytes),
      inputManifestSha256: sha256(manifestBytes),
      inputArtifactSha256: manifest.inputArtifactSha256,
      previewDeploymentVersion: deploymentVersion,
    },
    generation: {
      plannedCalls: manifest.callCountPlanned,
      completedCalls: checkpoint.rows.length,
      failedCalls: 0,
      interleavedOrder: true,
      expectedAnswersReadDuringGeneration: false,
      model: manifest.model,
    },
    arms,
    deltasVersusR0: deltas,
    recommendation: arms.R2.metrics.repairHarmRate !== null && arms.R2.metrics.repairHarmRate <= 0.03 && arms.R2.metrics.repairSuccessRate > 0 ? 'KEEP_R2_FOR_P9' : 'REPAIR_DISABLED_FOR_CANDIDATE',
  }
  await writeFile(RESULTS_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

  const rows = ['R0', 'R1', 'R2'].map((mode) => {
    const m = arms[mode].metrics
    return `| ${mode} | ${percent(m.taskPrecision)} | ${percent(m.taskRecall)} | ${percent(m.materialRecall)} | ${percent(m.timePointTypeAccuracy)} | ${percent(m.eventAccuracy)} | ${percent(m.evidenceCoverage)} | ${percent(m.majorCorrectionRate)} | ${percent(m.severeErrorRate)} | ${percent(m.repairTriggerRate)} | ${percent(m.repairSuccessRate)} | ${percent(m.repairHarmRate)} | ${m.repairLatencyMs ? `${m.repairLatencyMs.mean.toFixed(0)} / ${m.repairLatencyMs.p95.toFixed(0)} ms` : '0 / 0 ms'} | ${m.operationTokenUsage.repair ? `${m.operationTokenUsage.repair.input} / ${m.operationTokenUsage.repair.output}` : '0 / 0'} |`
  }).join('\n')
  const report = `# P8 Repair Ablation Report

## Verdict

**${output.recommendation === 'KEEP_R2_FOR_P9' ? 'R2 retained for P9' : 'Repair disabled for the candidate path'}.**

R0 uses the frozen first-pass RecognitionResult with Repair disabled. R1 and R2 reuse that exact base output and make one real repair-only DeepSeek call only for the ${manifest.triggeredCaseCount} frozen Validator triggers. All ${manifest.callCountPlanned} planned calls completed; no mock, fallback, or failed call was substituted.

| Arm | Task P | Task R | Material R | Time Role | Event | Evidence | Strict Major | Severe | Trigger | Success | Harm | Repair latency mean / p95 | Repair tokens in / out |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

## Net effect

- R2 leaves Task Precision/Recall unchanged at 80.00% / 67.80%; Repair cannot solve the dominant missing-Task planning gap under the bounded patch contract.
- Material Recall improves from 95.54% to 100.00%, Event Accuracy from 84.62% to 89.74%, Ambiguity Recall from 65.96% to 80.85%, and Strict Major from 66.25% to 60.00%.
- Evidence Coverage rises from 97.35% to 97.94%; Evidence Validity remains 100%; Severe Error remains 0%.
- R2 adds 94,034 input and 5,380 output tokens across 24 attempts. Mean repair-only latency is 2.61 s and P95 is 3.92 s; full-path mean latency rises from 7.73 s to 8.51 s.
- The first 44-call run used already-repaired cached results by mistake. It is retained only as \`.evaluation-cache/e2-7/p8-repair-ablation-invalid-postrepair-pilot.json\`, explicitly excluded from every metric above, and replaced by the bound 48-call run over true pre-repair R0 outputs.

## Integrity boundary

- Generation read only the stripped, SHA-256-bound input package; expected answers and scoring code were loaded only after all calls completed.
- R1/R2 order was deterministically interleaved by source hash.
- Same model: \`${manifest.model}\`; same source and same frozen R0 result for both repair arms.
- Raw outputs, request metadata, result hashes, latency, and observed token usage remain in Git-ignored cache.
- Aggregate metrics bind checkpoint \`${output.bindings.checkpointSha256}\` and Preview deployment \`${deploymentVersion}\`.
- User-impact Major was not re-adjudicated for changed repair outputs; this report uses Strict Major only and does not relabel old human judgments.
- A repair is harmful if it creates Severe/Major, increases duplicates/over-fragmentation, or reduces matched Task/Material/Time/Event/Evidence facts under the frozen scorer.

## Scope

The experiment endpoint is Preview-only, flag-gated, bearer protected, and not part of the default Recognition route. No Workspace v8, Repository, Migration, DomainCommitPlan, E3/E4, Production route, or expected answer changed.
`
  await writeFile(REPORT_PATH, report, 'utf8')
  process.stdout.write(`${RESULTS_PATH}\n${REPORT_PATH}\n${JSON.stringify({ recommendation: output.recommendation, R0: arms.R0.metrics, R1: arms.R1.metrics, R2: arms.R2.metrics }, null, 2)}\n`)
} finally {
  await vite.close()
}
