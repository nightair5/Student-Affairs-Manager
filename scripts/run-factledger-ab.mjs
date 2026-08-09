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

function fixtureInputSha256(fixture) {
  return createHash('sha256').update(JSON.stringify({
    sourceType: fixture.sourceType,
    sourceTitle: fixture.sourceTitle,
    sourceText: fixture.rawText,
    referenceTime: fixture.referenceTime,
    timezone: fixture.timezone,
  })).digest('hex')
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
  if (!resume) {
    try {
      await readFile(checkpointPath, 'utf8')
      throw new Error(`Checkpoint already exists for label ${label}; use --resume=true or a new label`)
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error
    }
  }
  const previous = resume ? await readJson(checkpointPath).catch(() => []) : []
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
    const previousById = new Map(previous.map((entry) => [entry.caseId, entry]))
    const byId = new Map(selected.flatMap((fixture) => {
      const entry = previousById.get(fixture.id)
      const sourceSha256 = createHash('sha256').update(fixture.rawText).digest('hex')
      const inputSha256 = fixtureInputSha256(fixture)
      if (!entry) return []
      if (entry.model !== model || entry.sourceSha256 !== sourceSha256 || entry.inputSha256 !== inputSha256) {
        throw new Error(`Stale B checkpoint row for ${fixture.id}`)
      }
      if (entry.status === 'failed') return [[fixture.id, entry]]
      if (entry.status !== 'ok' || !entry.pathB) throw new Error(`Malformed B checkpoint row for ${fixture.id}`)
      return [[fixture.id, entry]]
    }))
    const client = createDeepSeekClient(apiKey, model, endpoint)

    for (const [index, fixture] of selected.entries()) {
      if (byId.has(fixture.id)) continue
      const baselineEntry = baselineById.get(fixture.id)
      if (!baselineEntry?.result) throw new Error(`Missing A baseline result for ${fixture.id}`)
      if (baselineEntry.status !== 'ok') throw new Error(`Incomplete A baseline result for ${fixture.id}`)
      if (baselineEntry.result.promptVersion !== 'recognition-2.4.1') throw new Error(`A prompt version drift for ${fixture.id}`)
      if (baselineEntry.result.modelName !== model) throw new Error(`A model drift for ${fixture.id}`)
      const sourceSha256 = createHash('sha256').update(fixture.rawText).digest('hex')
      const inputSha256 = fixtureInputSha256(fixture)
      if (!baselineEntry.sourceSha256) throw new Error(`A baseline source hash missing for ${fixture.id}`)
      if (baselineEntry.sourceSha256 !== sourceSha256) throw new Error(`A baseline source drift for ${fixture.id}`)
      if (!baselineEntry.inputSha256) throw new Error(`A baseline input hash missing for ${fixture.id}`)
      if (baselineEntry.inputSha256 !== inputSha256) throw new Error(`A baseline input drift for ${fixture.id}`)
      const baselineScored = scoring.scoreRecognitionCase(fixture, 'deepseek-production', baselineEntry.result, baselineEntry.latencyMs, {
        tokenUsage: baselineEntry.tokenUsage,
        costUsd: baselineEntry.costUsd,
      })
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
          inputSha256,
          status: 'ok',
          model,
          pathA: { promptVersion: baselineEntry.result.promptVersion, scores: baselineScored.scores, latencyMs: baselineEntry.latencyMs, tokenUsage: baselineEntry.tokenUsage },
          pathB: { ledger: result.ledger, result: result.recognition, scores: scored.scores, failures: scored.failures, latencyMs: result.latencyMs, tokenUsage: result.tokenUsage, operations: result.operations },
        })
      } catch (error) {
        byId.set(fixture.id, {
          caseId: fixture.id,
          group: fixture.group,
          sourceSha256,
          inputSha256,
          status: 'failed',
          code: errorCode(error),
          model,
          pathA: { promptVersion: baselineEntry.result.promptVersion, scores: baselineScored.scores, latencyMs: baselineEntry.latencyMs, tokenUsage: baselineEntry.tokenUsage },
          pathB: null,
        })
      }
      await writeFile(checkpointPath, `${JSON.stringify([...byId.values()], null, 2)}\n`, 'utf8')
      console.log(`[${index + 1}/${selected.length}] ${fixture.id} ${byId.get(fixture.id).status}`)
      if (delayMs > 0 && index < selected.length - 1) await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    const selectedResults = selected.map((fixture) => byId.get(fixture.id))
    const completedCases = selectedResults.filter((entry) => entry?.status === 'ok').length
    const failedCases = selectedResults.length - completedCases
    console.log(JSON.stringify({ status: failedCases > 0 ? 'PARTIAL' : 'COMPLETE', dataset: datasetName, cases: selected.length, completedCases, failedCases, checkpoint: path.relative(ROOT, checkpointPath), model }))
  } finally {
    await vite.close()
  }
}

await main()
