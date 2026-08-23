/* global console, fetch, process, Response, Request */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'
import { createWorker } from '../cloudflare/worker.mjs'

const ROOT = process.cwd()
const API_ENDPOINT = 'https://api.deepseek.com/chat/completions'
const ORIGIN = 'https://candidate-eval.local'
const ALLOWED_MODELS = new Set(['deepseek-v4-flash', 'deepseek-v4-flash-vision-exp'])
const LOWER_IS_BETTER = new Set(['duplicateRate', 'overFragmentationRate', 'majorCorrectionRate', 'severeErrorRate', 'invalidOutputRate', 'requestFailureRate', 'retryRate'])
const PRIMARY_METRICS = ['projectDecisionAccuracy', 'taskPrecision', 'taskRecall', 'materialRecall', 'timePointAccuracy', 'eventAccuracy', 'evidenceCoverage', 'majorCorrectionRate', 'severeErrorRate', 'invalidOutputRate', 'requestFailureRate']

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function sha256(value) { return createHash('sha256').update(value).digest('hex') }
function percent(value) { return `${(value * 100).toFixed(2)}%` }
function sleep(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)) }
function fixtureInputSha256(fixture) {
  return sha256(JSON.stringify({ sourceType: fixture.sourceType, sourceTitle: fixture.sourceTitle, sourceText: fixture.rawText, referenceTime: fixture.referenceTime, timezone: fixture.timezone }))
}
async function readJsonIfExists(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return fallback
    throw error
  }
}
function safeUsage(payload) {
  const input = payload?.usage?.prompt_tokens
  const output = payload?.usage?.completion_tokens
  return Number.isFinite(input) && Number.isFinite(output) ? { input, output, total: Number.isFinite(payload?.usage?.total_tokens) ? payload.usage.total_tokens : input + output } : null
}

function createCandidateFetcher(model, trace) {
  return async (url, options = {}) => {
    if (url !== API_ENDPOINT || typeof options.body !== 'string') return fetch(url, options)
    const body = JSON.parse(options.body)
    body.model = model
    if (typeof body.messages?.[0]?.content === 'string') body.messages[0].content = body.messages[0].content.replaceAll('deepseek-v4-flash', model)
    const requestBody = JSON.stringify(body)
    const startedAt = Date.now()
    const response = await fetch(url, { ...options, body: requestBody })
    const rawResponse = await response.text()
    let payload = null
    try { payload = JSON.parse(rawResponse) } catch { /* only its hash is retained */ }
    trace.push({
      operationIndex: trace.length + 1,
      requestedModel: model,
      returnedModel: typeof payload?.model === 'string' ? payload.model : null,
      systemFingerprint: typeof payload?.system_fingerprint === 'string' ? payload.system_fingerprint : null,
      providerRequestId: response.headers.get('x-request-id'),
      httpStatus: response.status,
      durationMs: Date.now() - startedAt,
      requestBodySha256: sha256(requestBody),
      semanticPromptSha256: sha256(body.messages?.[0]?.content?.replaceAll(model, '<MODEL>') ?? ''),
      responseBodySha256: sha256(rawResponse),
      usage: safeUsage(payload),
    })
    return new Response(rawResponse, { status: response.status, statusText: response.statusText, headers: response.headers })
  }
}

async function evaluateObservation({ fixture, model, apiKey, scoreRecognitionCase, parseRecognitionResult }) {
  const trace = []
  const worker = createWorker({ fetcher: createCandidateFetcher(model, trace), isRateLimited: () => false, acquireConcurrency: () => () => {}, retrySleep: async () => {}, retryRandom: () => 0 })
  const started = Date.now()
  const response = await worker.fetch(new Request(`${ORIGIN}/api/deepseek/extract`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ sourceType: fixture.sourceType, sourceTitle: fixture.sourceTitle, content: fixture.rawText, referenceTime: fixture.referenceTime, timezone: fixture.timezone, projectCandidates: [], existingTasks: [] }),
  }), { DEEPSEEK_API_KEY: apiKey, ALLOWED_ORIGINS: ORIGIN, ASSETS: { fetch: async () => new Response('not found', { status: 404 }) } })
  const payload = await response.json().catch(() => null)
  const latencyMs = Date.now() - started
  if (!response.ok) return { ...scoreRecognitionCase(fixture, model, null, latencyMs, { status: 'request_failure', failureReason: `${response.status} ${payload?.code ?? payload?.message ?? 'request failed'}` }), transportEvidence: trace }
  try {
    if (trace.length === 0 || !trace.every((item) => item.returnedModel === model)) throw new Error(`MODEL_LINEAGE_MISMATCH:${trace.map((item) => item.returnedModel ?? 'NOT_OBSERVED').join(',')}`)
    const result = parseRecognitionResult({ ...payload.result, modelName: model })
    const scored = scoreRecognitionCase(fixture, model, result, latencyMs, { tokenUsage: payload?.execution?.tokenUsage ?? null, costUsd: null })
    return {
      ...scored,
      execution: { ...payload.execution, model, actualModelLineage: trace.map(({ requestedModel, returnedModel, systemFingerprint, providerRequestId, responseBodySha256 }) => ({ requestedModel, returnedModel, systemFingerprint, providerRequestId, responseBodySha256 })) },
      repair: payload.repair ?? null, route: payload.route ?? null, transportEvidence: trace,
    }
  } catch (error) {
    return { ...scoreRecognitionCase(fixture, model, null, latencyMs, { status: 'invalid_output', failureReason: error instanceof Error ? error.message : 'invalid output' }), transportEvidence: trace }
  }
}

function pairedOrder(dataset, models) {
  return dataset.flatMap((fixture) => {
    const order = Number.parseInt(sha256(fixture.id).slice(0, 2), 16) % 2 === 1 ? [...models].reverse() : models
    return order.map((model) => ({ fixture, model }))
  })
}
function metricDelta(candidate, baseline, metric) {
  const raw = candidate[metric] - baseline[metric]
  return LOWER_IS_BETTER.has(metric) ? -raw : raw
}

function renderMarkdown({ label, datasetVersion, resultsByModel, metricsByModel, gatesByModel, comparison, startedAt, completedAt }) {
  const models = Object.keys(metricsByModel)
  const rows = PRIMARY_METRICS.map((metric) => {
    const delta = comparison ? `${comparison.deltas[metric] >= 0 ? '+' : ''}${(comparison.deltas[metric] * 100).toFixed(2)} pp` : 'N/A'
    return `| ${metric} | ${models.map((model) => percent(metricsByModel[model][metric])).join(' | ')} | ${delta} |`
  }).join('\n')
  const operational = models.map((model) => {
    const metric = metricsByModel[model]
    const partialUsage = Object.values(metric.operationTokenUsage).filter(Boolean).reduce((total, item) => ({ input: total.input + item.input, output: total.output + item.output }), { input: 0, output: 0 })
    const usage = metric.tokenUsage ? `${metric.tokenUsage.input}/${metric.tokenUsage.output}` : `${partialUsage.input}/${partialUsage.output} (partial)`
    return `| ${model} | ${metric.sampleCount} | ${Math.round(metric.latencyMs.mean)} ms | ${Math.round(metric.latencyMs.p95)} ms | ${usage} | NOT OBSERVABLE | ${gatesByModel[model].passed ? 'PASS' : 'FAIL'} |`
  }).join('\n')
  const lineage = models.map((model) => {
    const calls = resultsByModel[model].flatMap((item) => item.transportEvidence)
    const recognitionCalls = resultsByModel[model].flatMap((item) => item.transportEvidence.slice(0, 1))
    const valid = calls.length > 0 && calls.every((item) => item.requestedModel === model && item.returnedModel === model)
    const hashes = new Set(recognitionCalls.map((item) => item.semanticPromptSha256))
    return `| ${model} | ${calls.length} | ${valid ? 'PASS' : 'FAIL'} | ${hashes.size === 1 ? [...hashes][0] : `DRIFT (${hashes.size})`} |`
  }).join('\n')
  return `# DeepSeek model candidate evaluation — ${label}\n\n- Dataset: \`${datasetVersion}\`\n- Started: ${startedAt}\n- Completed: ${completedAt}\n- Scope: text-only recognition; no image or file body was uploaded.\n- Isolation: frozen expected data was used only by the local scorer and was never sent to either model.\n\n## Quality comparison\n\n| Metric | ${models.join(' | ')} | Candidate improvement |\n| --- | ${models.map(() => '---:').join(' | ')} | ---: |\n${rows}\n\nPositive Candidate improvement means the candidate is better; lower-is-better metrics are sign-adjusted.\n\n## Operations\n\n| Model | Samples | Mean latency | P95 latency | Tokens input/output | Cost | Frozen E2 gate |\n| --- | ---: | ---: | ---: | ---: | ---: | --- |\n${operational}\n\n## Model lineage and prompt control\n\n| Model | Provider calls | Exact returned-model lineage | Semantic prompt SHA-256 |\n| --- | ---: | --- | --- |\n${lineage}\n\nRaw normalized results and transport evidence remain only in the Git-ignored evaluation cache. API keys, Authorization headers, and clipboard contents are not persisted.\n`
}

async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim() ?? ''
  if (apiKey.length < 20) throw new Error('DEEPSEEK_API_KEY must be supplied in process memory')
  const label = option('label')
  if (!/^[a-z0-9][a-z0-9._-]{2,100}$/u.test(label)) throw new Error('A fresh lowercase --label is required')
  const datasetName = option('dataset', 'generalization')
  if (!['generalization', 'golden', 'holdout'].includes(datasetName)) throw new Error('Only frozen exposed regression datasets are supported; Blind is forbidden')
  const models = option('models', 'deepseek-v4-flash,deepseek-v4-flash-vision-exp').split(',').map((value) => value.trim()).filter(Boolean)
  if (models.length !== new Set(models).size || models.some((model) => !ALLOWED_MODELS.has(model))) throw new Error('Unsupported or duplicate --models value')
  const limit = Number(option('limit', '0'))
  const delayMs = Number(option('delay-ms', '1000'))
  const resume = option('resume', 'false') === 'true'
  const writeDir = option('write-dir')
  const requestedCaseIds = option('case-ids').split(',').map((value) => value.trim()).filter(Boolean)
  const cacheDir = path.join(ROOT, '.evaluation-cache', 'model-candidates')
  const checkpointFile = path.join(cacheDir, `${label}.json`)
  await mkdir(cacheDir, { recursive: true })
  if (!resume && await readJsonIfExists(checkpointFile, null)) throw new Error(`REFUSING_TO_OVERWRITE:${checkpointFile}`)
  const previous = resume ? await readJsonIfExists(checkpointFile, { observations: [] }) : { observations: [] }
  const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', server: { middlewareMode: true } })
  try {
    const [generalization, golden, holdout, scoring, schema, gates] = await Promise.all([
      vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'), vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'), vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'), vite.ssrLoadModule('/src/recognition/e2/scoring.ts'), vite.ssrLoadModule('/src/recognition/schema.ts'), vite.ssrLoadModule('/src/recognition/e2/gates.ts'),
    ])
    const source = datasetName === 'generalization' ? { fixtures: generalization.recognitionGeneralizationDevelopmentDataset, metadata: generalization.recognitionGeneralizationDevelopmentMetadata } : datasetName === 'golden' ? { fixtures: golden.recognitionGoldenDataset, metadata: golden.recognitionGoldenDatasetMetadata } : { fixtures: holdout.recognitionHoldoutDataset, metadata: holdout.recognitionHoldoutMetadata }
    const selected = requestedCaseIds.length > 0 ? requestedCaseIds.map((id) => source.fixtures.find((fixture) => fixture.id === id)).filter(Boolean) : source.fixtures
    if (requestedCaseIds.length > 0 && selected.length !== requestedCaseIds.length) throw new Error('One or more --case-ids are unknown')
    const dataset = limit > 0 ? selected.slice(0, limit) : selected
    const completed = new Map(previous.observations.map((item) => [`${item.model}:${item.caseId}`, item]))
    const startedAt = previous.startedAt ?? new Date().toISOString()
    const order = pairedOrder(dataset, models)
    for (const [index, { fixture, model }] of order.entries()) {
      const key = `${model}:${fixture.id}`
      if (completed.has(key)) { console.log(`[${index + 1}/${order.length}] ${fixture.id} ${model} resumed`); continue }
      const scored = await evaluateObservation({ fixture, model, apiKey, scoreRecognitionCase: scoring.scoreRecognitionCase, parseRecognitionResult: schema.parseRecognitionResult })
      const observation = { ...scored, model, sourceSha256: sha256(fixture.rawText), inputSha256: fixtureInputSha256(fixture), resultSha256: scored.result ? sha256(JSON.stringify(scored.result)) : null }
      completed.set(key, observation)
      await writeFile(checkpointFile, `${JSON.stringify({ schemaVersion: 'model-candidate-evaluation-1.0.0', label, datasetName, datasetVersion: source.metadata.datasetVersion, models, startedAt, observations: [...completed.values()] }, null, 2)}\n`, 'utf8')
      console.log(`[${index + 1}/${order.length}] ${fixture.id} ${model} ${scored.status} ${scored.latencyMs}ms failures=${scored.failures.length}`)
      if (delayMs > 0 && index < order.length - 1) await sleep(delayMs)
    }
    const observations = [...completed.values()].filter((item) => models.includes(item.model) && dataset.some((fixture) => fixture.id === item.caseId))
    const resultsByModel = Object.fromEntries(models.map((model) => [model, observations.filter((item) => item.model === model)]))
    const metricsByModel = Object.fromEntries(models.map((model) => [model, scoring.aggregateRecognitionMetrics(model, resultsByModel[model])]))
    const gatesByModel = Object.fromEntries(models.map((model) => [model, gates.evaluateE2QualityGate(metricsByModel[model])]))
    const baseline = metricsByModel['deepseek-v4-flash']
    const candidate = metricsByModel['deepseek-v4-flash-vision-exp']
    const comparison = baseline && candidate ? { baselineModel: 'deepseek-v4-flash', candidateModel: 'deepseek-v4-flash-vision-exp', deltas: Object.fromEntries(PRIMARY_METRICS.map((metric) => [metric, metricDelta(candidate, baseline, metric)])) } : null
    const completedAt = new Date().toISOString()
    const report = { schemaVersion: 'model-candidate-evaluation-summary-1.0.0', label, datasetName, datasetVersion: source.metadata.datasetVersion, startedAt, completedAt, models, sampleCountPerModel: dataset.length, metricsByModel, gatesByModel, comparison, privacy: { imageUploads: 0, fileBodyUploads: 0, apiKeyPersisted: false, authorizationHeadersPersisted: false } }
    console.log(JSON.stringify(report, null, 2))
    if (writeDir) {
      const target = path.resolve(ROOT, writeDir)
      await mkdir(target, { recursive: true })
      const failures = Object.fromEntries(models.map((model) => [model, resultsByModel[model].filter((item) => item.failures.length > 0).map((item) => ({ caseId: item.caseId, group: item.group, status: item.status, failures: item.failures }))]))
      await Promise.all([
        writeFile(path.join(target, `${label}-summary.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
        writeFile(path.join(target, `${label}-failures.json`), `${JSON.stringify({ label, failures }, null, 2)}\n`, 'utf8'),
        writeFile(path.join(target, `${label}-report.md`), renderMarkdown({ ...report, resultsByModel }), 'utf8'),
      ])
    }
  } finally { await vite.close() }
}

await main()
