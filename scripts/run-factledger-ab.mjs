import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

const ROOT = process.cwd()

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function errorCode(error) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.startsWith('FACT_LEDGER_')) return message.split(':')[0]
  if (message.includes('Recognition result')) return 'PLANNER_SCHEMA_INVALID'
  if (message.includes('DEEPSEEK_HTTP_')) return message.split(':')[0]
  if (message === 'DEEPSEEK_TIMEOUT') return message
  return 'DIAGNOSTIC_FAILURE'
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

function createDeepSeekClient(apiKey, model, endpoint) {
  return {
    model,
    async complete(input) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 120_000)
      const started = Date.now()
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: input.systemPrompt },
              { role: 'user', content: input.userPrompt },
            ],
            temperature: input.temperature,
            max_tokens: 8192,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(`DEEPSEEK_HTTP_${response.status}`)
        const content = payload?.choices?.[0]?.message?.content
        if (typeof content !== 'string' || !content.trim()) throw new Error('DEEPSEEK_EMPTY_RESPONSE')
        const promptTokens = payload?.usage?.prompt_tokens
        const completionTokens = payload?.usage?.completion_tokens
        const tokenUsage = Number.isFinite(promptTokens) && Number.isFinite(completionTokens)
          ? { input: promptTokens, output: completionTokens }
          : null
        return { content, latencyMs: Date.now() - started, tokenUsage }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') throw new Error('DEEPSEEK_TIMEOUT')
        throw error
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}

async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim() ?? ''
  if (apiKey.length < 20) {
    console.error(JSON.stringify({ status: 'NOT_RUN', code: 'DEEPSEEK_NOT_CONFIGURED', message: 'Set DEEPSEEK_API_KEY in the server process environment.' }))
    process.exitCode = 2
    return
  }
  const datasetName = option('dataset', 'generalization')
  if (!['golden', 'holdout', 'generalization'].includes(datasetName)) throw new Error(`Unsupported dataset ${datasetName}`)
  const baselineCachePath = option('baseline-cache')
  if (!baselineCachePath) throw new Error('Missing --baseline-cache')
  const caseIds = option('case-ids').split(',').map((value) => value.trim()).filter(Boolean)
  const limit = Number(option('limit', '0'))
  const delayMs = Number(option('delay-ms', '8000'))
  const label = option('label', 'diagnostic')
  const model = option('model', 'deepseek-v4-flash')
  if (model !== 'deepseek-v4-flash') throw new Error(`Model drift: ${model}`)
  const endpoint = option('endpoint', 'https://api.deepseek.com/chat/completions')
  const cacheDir = path.join(ROOT, '.evaluation-cache')
  await mkdir(cacheDir, { recursive: true })
  const checkpointPath = path.join(cacheDir, `factledger-b-${datasetName}-${label}.json`)
  const resume = option('resume', 'false') === 'true'
  const previous = resume ? await readJson(checkpointPath).catch(() => []) : []
  const byId = new Map(previous.map((entry) => [entry.caseId, entry]))
  const baseline = await readJson(path.resolve(ROOT, baselineCachePath))
  const baselineById = new Map(baseline.map((entry) => [entry.caseId, entry]))

  const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', server: { middlewareMode: true } })
  try {
    const [datasets, harness, scoring] = await Promise.all([
      Promise.all([
        vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
        vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
        vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
      ]),
      vite.ssrLoadModule('/src/recognition/e2/factLedger/diagnosticHarness.ts'),
      vite.ssrLoadModule('/src/recognition/e2/scoring.ts'),
    ])
    const [golden, holdout, generalization] = datasets
    const fullDataset = datasetName === 'golden' ? golden.recognitionGoldenDataset
      : datasetName === 'holdout' ? holdout.recognitionHoldoutDataset
        : generalization.recognitionGeneralizationDevelopmentDataset
    let selected = caseIds.length > 0 ? caseIds.map((id) => fullDataset.find((entry) => entry.id === id)) : fullDataset
    if (selected.some((entry) => !entry)) throw new Error('Unknown case id')
    if (limit > 0) selected = selected.slice(0, limit)
    const client = createDeepSeekClient(apiKey, model, endpoint)

    for (const [index, fixture] of selected.entries()) {
      if (byId.has(fixture.id)) continue
      const baselineEntry = baselineById.get(fixture.id)
      if (!baselineEntry?.result) throw new Error(`Missing A baseline result for ${fixture.id}`)
      const sourceSha256 = createHash('sha256').update(fixture.rawText).digest('hex')
      try {
        const result = await harness.runFactLedgerDiagnostic({
          sourceType: fixture.sourceType,
          sourceTitle: fixture.sourceTitle,
          sourceText: fixture.rawText,
          referenceTime: fixture.referenceTime,
          timezone: fixture.timezone,
        }, client)
        const scored = scoring.scoreRecognitionCase(fixture, 'deepseek-production', result.recognition, result.latencyMs, {
          tokenUsage: result.tokenUsage,
          costUsd: null,
        })
        byId.set(fixture.id, {
          caseId: fixture.id,
          group: fixture.group,
          sourceSha256,
          status: 'ok',
          model,
          pathA: { promptVersion: baselineEntry.result.promptVersion, scores: baselineEntry.scores, latencyMs: baselineEntry.latencyMs, tokenUsage: baselineEntry.tokenUsage },
          pathB: { ledger: result.ledger, result: result.recognition, scores: scored.scores, failures: scored.failures, latencyMs: result.latencyMs, tokenUsage: result.tokenUsage, operations: result.operations },
        })
      } catch (error) {
        byId.set(fixture.id, {
          caseId: fixture.id,
          group: fixture.group,
          sourceSha256,
          status: 'failed',
          code: errorCode(error),
          model,
          pathA: { promptVersion: baselineEntry.result.promptVersion, scores: baselineEntry.scores, latencyMs: baselineEntry.latencyMs, tokenUsage: baselineEntry.tokenUsage },
          pathB: null,
        })
      }
      await writeFile(checkpointPath, `${JSON.stringify([...byId.values()], null, 2)}\n`, 'utf8')
      console.log(`[${index + 1}/${selected.length}] ${fixture.id} ${byId.get(fixture.id).status}`)
      if (delayMs > 0 && index < selected.length - 1) await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    console.log(JSON.stringify({ status: 'COMPLETE', dataset: datasetName, cases: selected.length, checkpoint: path.relative(ROOT, checkpointPath), model }))
  } finally {
    await vite.close()
  }
}

await main()
