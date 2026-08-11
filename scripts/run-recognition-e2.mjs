/* global console, fetch, process, setTimeout */
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { createServer } from 'vite'

const ROOT = process.cwd()

const USAGE = `Usage: node scripts/run-recognition-e2.mjs [options]

Key options:
  --provider=local-fallback|deepseek-production
  --dataset=golden|holdout|generalization
  --label=<unique-run-label>
  --case-ids=<comma-separated-case-ids>
  --limit=<positive-number>
  --expected-prompt=<prompt-version>
  --endpoint=<preview-api-endpoint>
  --origin=<allowed-origin>
  --transport=fetch|curl|python-session
  --write-dir=<tracked-aggregate-output-directory>
  --resume=true|false`

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback
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

function percent(value) {
  return `${(value * 100).toFixed(2)}%`
}

function milliseconds(value) {
  return `${Math.round(value)} ms`
}

function sleep(millisecondsValue) {
  return new Promise((resolve) => setTimeout(resolve, millisecondsValue))
}

function curlJson(url, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const command = process.platform === 'win32' ? 'curl.exe' : 'curl'
    const args = ['--silent', '--show-error', '--connect-timeout', '20', '--max-time', '120', '--request', method]
    Object.entries(headers).forEach(([name, value]) => args.push('--header', `${name}: ${value}`))
    if (body !== null) args.push('--data-binary', '@-')
    args.push('--write-out', '\n%{http_code}', url)
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    const stdout = []
    const stderr = []
    child.stdout.on('data', (chunk) => stdout.push(chunk))
    child.stderr.on('data', (chunk) => stderr.push(chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      const output = Buffer.concat(stdout).toString('utf8')
      const errorText = Buffer.concat(stderr).toString('utf8').trim()
      if (code !== 0) {
        reject(new Error(`curl exited ${code}${errorText ? `: ${errorText}` : ''}`))
        return
      }
      const match = output.match(/\n(\d{3})$/u)
      if (!match) {
        reject(new Error('curl response did not include an HTTP status'))
        return
      }
      const responseText = output.slice(0, -match[0].length)
      let json = null
      try { json = JSON.parse(responseText) } catch { /* handled by caller */ }
      const status = Number(match[1])
      resolve({ ok: status >= 200 && status < 300, status, json })
    })
    child.stdin.end(body ?? undefined)
  })
}

function createPythonSessionTransport() {
  const source = [
    'import json, sys, requests',
    'session = requests.Session()',
    'for line in sys.stdin:',
    '  try:',
    '    item = json.loads(line)',
    "    response = session.request(item.get('method', 'GET'), item['url'], headers=item.get('headers') or {}, data=item.get('body'), timeout=(20, 120))",
    '    try: payload = response.json()',
    '    except Exception: payload = None',
    "    output = {'ok': response.ok, 'status': response.status_code, 'json': payload}",
    '  except Exception as error:',
    "    output = {'transportError': type(error).__name__}",
    "  print(json.dumps(output, ensure_ascii=False), flush=True)",
  ].join('\n')
  const child = spawn('python', ['-X', 'utf8', '-u', '-c', source], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  const lines = createInterface({ input: child.stdout })
  const pending = []
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk.toString('utf8')}`.slice(-1000) })
  lines.on('line', (line) => {
    const request = pending.shift()
    if (!request) return
    try {
      const response = JSON.parse(line)
      if (response.transportError) request.reject(new Error(`python transport failed: ${response.transportError}`))
      else request.resolve(response)
    } catch {
      request.reject(new Error('python transport returned invalid JSON'))
    }
  })
  const rejectPending = (reason) => {
    while (pending.length > 0) pending.shift().reject(reason)
  }
  child.on('error', (error) => rejectPending(error))
  child.on('close', (code) => rejectPending(new Error(`python transport exited ${code}${stderr ? ': stderr available' : ''}`)))
  return {
    request(url, options = {}) {
      return new Promise((resolve, reject) => {
        pending.push({ resolve, reject })
        child.stdin.write(`${JSON.stringify({ url, method: options.method ?? 'GET', headers: options.headers ?? {}, body: options.body ?? null })}\n`)
      })
    },
    close() {
      lines.close()
      child.stdin.end()
    },
  }
}

async function requestJson(transport, pythonSession, url, options = {}) {
  if (transport === 'curl') return curlJson(url, options)
  if (transport === 'python-session') return pythonSession.request(url, options)
  const response = await fetch(url, {
    method: options.method,
    headers: options.headers,
    body: options.body,
  })
  return { ok: response.ok, status: response.status, json: await response.json().catch(() => null) }
}

async function readCheckpoint(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return []
  }
}

function renderMarkdown(run, metrics, groupMetrics) {
  const token = metrics.tokenUsage
    ? `${metrics.tokenUsage.input} input / ${metrics.tokenUsage.output} output`
    : 'NOT OBSERVABLE：接口未对每个 operation 回传完整 usage'
  const cost = metrics.costUsd === null ? 'NOT OBSERVABLE：缺少可归属的 Token usage' : `$${metrics.costUsd.toFixed(6)}`
  const rows = [
    ['Project Decision Accuracy', percent(metrics.projectDecisionAccuracy)],
    ['Milestone Precision', percent(metrics.milestonePrecision)],
    ['Milestone Recall', percent(metrics.milestoneRecall)],
    ['Task Precision', percent(metrics.taskPrecision)],
    ['Task Recall', percent(metrics.taskRecall)],
    ['Material Precision', percent(metrics.materialPrecision)],
    ['Material Recall', percent(metrics.materialRecall)],
    ['TimePoint Precision', percent(metrics.timePointPrecision)],
    ['TimePoint Recall', percent(metrics.timePointRecall)],
    ['TimePoint Type Accuracy', percent(metrics.timePointTypeAccuracy)],
    ['TimePoint Value Accuracy', percent(metrics.timePointValueAccuracy)],
    ['TimePoint Accuracy', percent(metrics.timePointAccuracy)],
    ['Event Accuracy', percent(metrics.eventAccuracy)],
    ['Evidence Coverage', percent(metrics.evidenceCoverage)],
    ['Evidence Validity', percent(metrics.evidenceValidity)],
    ['Ambiguity Precision', percent(metrics.ambiguityPrecision)],
    ['Ambiguity Recall', percent(metrics.ambiguityRecall)],
    ['Duplicate Rate', percent(metrics.duplicateRate)],
    ['Over-fragmentation Rate', percent(metrics.overFragmentationRate)],
    ['Major Correction Rate', percent(metrics.majorCorrectionRate)],
    ['Severe Error Rate', percent(metrics.severeErrorRate)],
    ['Invalid Output Rate', percent(metrics.invalidOutputRate)],
    ['Request Failure Rate', percent(metrics.requestFailureRate)],
    ['Repair Trigger Rate', percent(metrics.repairTriggerRate)],
    ['Repair Applied Rate', metrics.repairAppliedRate === null ? 'NOT OBSERVABLE' : percent(metrics.repairAppliedRate)],
    ['Repair Success Rate', metrics.repairSuccessRate === null ? 'NOT OBSERVABLE' : percent(metrics.repairSuccessRate)],
    ['Repair Harm Rate', metrics.repairHarmRate === null ? 'NOT OBSERVABLE' : percent(metrics.repairHarmRate)],
    ['Repair Latency Mean', metrics.repairLatencyMs === null ? 'NOT OBSERVABLE' : `${metrics.repairLatencyMs.mean.toFixed(0)} ms`],
    ['Repair Latency P95', metrics.repairLatencyMs === null ? 'NOT OBSERVABLE' : `${metrics.repairLatencyMs.p95.toFixed(0)} ms`],
    ['Retry Rate', percent(metrics.retryRate)],
    ['Latency Mean', milliseconds(metrics.latencyMs.mean)],
    ['Latency P50', milliseconds(metrics.latencyMs.p50)],
    ['Latency P95', milliseconds(metrics.latencyMs.p95)],
    ['Token Usage', token],
    ['Cost', cost],
  ]
  return `# E2 Recognition Evaluation — ${run.label} / ${metrics.provider}\n\n` +
    `- Run ID: \`${run.runId}\`\n` +
    `- Dataset: \`${run.datasetVersion}\` (${metrics.sampleCount} samples)\n` +
    `- Observed Prompt: \`${run.observedPromptVersions.join(', ') || 'NOT OBSERVED'}\`\n` +
    `- Model: \`${run.modelName}\`\n` +
    `- Local recognition source SHA-256: \`${run.promptSourceSha256}\`\n` +
    `- Started: ${run.startedAt}\n` +
    `- Completed: ${run.completedAt}\n` +
    `- Completed cases: ${metrics.completedCount}/${metrics.sampleCount}\n\n` +
    `## Metrics\n\n| Metric | Result |\n| --- | ---: |\n${rows.map(([name, value]) => `| ${name} | ${value} |`).join('\n')}\n\n` +
    `## Group breakdown\n\n| Group | Project | Task P | Task R | Material R | Time | Event | Evidence | Major correction | Severe |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n${Object.entries(groupMetrics).map(([group, value]) => `| ${group} | ${percent(value.projectDecisionAccuracy)} | ${percent(value.taskPrecision)} | ${percent(value.taskRecall)} | ${percent(value.materialRecall)} | ${percent(value.timePointAccuracy)} | ${percent(value.eventAccuracy)} | ${percent(value.evidenceCoverage)} | ${percent(value.majorCorrectionRate)} | ${percent(value.severeErrorRate)} |`).join('\n')}\n\n` +
    `## Complexity profile\n\n| Route | Cases | Latency mean | P50 | P95 | Input tokens | Output tokens |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${Object.entries(metrics.complexityProfiles).map(([level, value]) => `| ${level} | ${value.sampleCount} | ${milliseconds(value.latencyMs.mean)} | ${milliseconds(value.latencyMs.p50)} | ${milliseconds(value.latencyMs.p95)} | ${value.tokenUsage?.input ?? 'NOT OBSERVABLE'} | ${value.tokenUsage?.output ?? 'NOT OBSERVABLE'} |`).join('\n')}\n\n` +
    `## Operation tokens\n\n| Operation | Input | Output |\n| --- | ---: | ---: |\n${Object.entries(metrics.operationTokenUsage).map(([operation, value]) => `| ${operation} | ${value?.input ?? 'NOT OBSERVABLE'} | ${value?.output ?? 'NOT OBSERVABLE'} |`).join('\n')}\n\n` +
    `## Error taxonomy\n\n| Category | Count |\n| --- | ---: |\n${metrics.errorTaxonomy.map((item) => `| ${item.category} | ${item.count} |`).join('\n') || '| none | 0 |'}\n\n` +
    `Per-case failure categories and reasons are stored in the sibling failures JSON. Raw model outputs remain in the ignored local checkpoint and are not committed.\n`
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log(USAGE)
    return
  }
  const provider = option('provider', 'local-fallback')
  if (!['local-fallback', 'deepseek-production'].includes(provider)) throw new Error(`Unsupported provider: ${provider}`)
  const endpoint = option('endpoint', 'https://student-affairs.site/api/deepseek')
  const datasetName = option('dataset', 'golden')
  if (!['golden', 'holdout', 'generalization'].includes(datasetName)) throw new Error(`Unsupported dataset: ${datasetName}`)
  const label = option('label', 'baseline')
  const expectedPromptOption = option('expected-prompt')
  const origin = option('origin', 'https://student-affairs.site')
  const delayMs = Number(option('delay-ms', provider === 'deepseek-production' ? '8000' : '0'))
  const writeDir = option('write-dir')
  const limit = Number(option('limit', '0'))
  const requestedCaseIds = option('case-ids').split(',').map((value) => value.trim()).filter(Boolean)
  const resume = option('resume', 'false') === 'true'
  const retryInvalid = option('retry-invalid', 'false') === 'true'
  const transport = option('transport', 'fetch')
  if (!['fetch', 'curl', 'python-session'].includes(transport)) throw new Error(`Unsupported transport: ${transport}`)
  const reportedStartedAt = option('run-started-at')
  const reportedCompletedAt = option('run-completed-at')
  const pythonSession = transport === 'python-session' ? createPythonSessionTransport() : null
  const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', server: { middlewareMode: true } })
  try {
    const [{ recognitionGoldenDataset, recognitionGoldenDatasetMetadata }, { recognitionHoldoutDataset, recognitionHoldoutMetadata }, { recognitionGeneralizationDevelopmentDataset, recognitionGeneralizationDevelopmentMetadata }, { scoreRecognitionCase, aggregateRecognitionMetrics }, pipeline, schema, prompt] = await Promise.all([
      vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/scoring.ts'),
      vite.ssrLoadModule('/src/recognition/pipeline.ts'),
      vite.ssrLoadModule('/src/recognition/schema.ts'),
      vite.ssrLoadModule('/src/recognition/prompt.ts'),
    ])
    const expectedPrompt = provider === 'deepseek-production'
      ? (expectedPromptOption || prompt.RECOGNITION_PROMPT_VERSION)
      : expectedPromptOption
    const fullDataset = datasetName === 'holdout'
      ? recognitionHoldoutDataset
      : datasetName === 'generalization'
        ? recognitionGeneralizationDevelopmentDataset
        : recognitionGoldenDataset
    const datasetMetadata = datasetName === 'holdout'
      ? recognitionHoldoutMetadata
      : datasetName === 'generalization'
        ? recognitionGeneralizationDevelopmentMetadata
        : recognitionGoldenDatasetMetadata
    const filteredDataset = requestedCaseIds.length > 0
      ? requestedCaseIds.map((id) => fullDataset.find((fixture) => fixture.id === id)).filter(Boolean)
      : fullDataset
    if (requestedCaseIds.length > 0 && filteredDataset.length !== requestedCaseIds.length) {
      const foundIds = new Set(filteredDataset.map((fixture) => fixture.id))
      throw new Error(`Unknown case IDs: ${requestedCaseIds.filter((id) => !foundIds.has(id)).join(', ')}`)
    }
    const dataset = limit > 0 ? filteredDataset.slice(0, limit) : filteredDataset
    const promptSource = await readFile(path.join(ROOT, 'cloudflare', 'recognition-prompt.mjs'))
    const promptSourceSha256 = createHash('sha256').update(promptSource).digest('hex')
    const cacheDir = path.join(ROOT, '.evaluation-cache')
    await mkdir(cacheDir, { recursive: true })
    const checkpointFile = path.join(cacheDir, `${provider}-${datasetName}-${label}.json`)
    if (!resume) {
      try {
        await readFile(checkpointFile, 'utf8')
        throw new Error(`Checkpoint already exists for label ${label}; use --resume=true or a new label`)
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error
      }
    }
    const previous = resume ? await readCheckpoint(checkpointFile) : []
    const previousById = new Map(previous.filter((item) => item.provider === provider).map((item) => [item.caseId, item]))
    const byId = new Map(dataset.flatMap((fixture) => {
      const item = previousById.get(fixture.id)
      if (!item || (retryInvalid && item.status === 'invalid_output')) return []
      const sourceSha256 = createHash('sha256').update(fixture.rawText).digest('hex')
      const inputSha256 = fixtureInputSha256(fixture)
      if (!item.sourceSha256 || item.sourceSha256 !== sourceSha256 || !item.inputSha256 || item.inputSha256 !== inputSha256) return []
      if (expectedPrompt && item.result?.promptVersion !== expectedPrompt) return []
      if (provider === 'deepseek-production' && item.result?.modelName !== prompt.RECOGNITION_MODEL_NAME) return []
      const rescored = scoreRecognitionCase(fixture, provider, item.result, item.latencyMs, {
        status: item.status,
        failureReason: item.failures?.[0]?.reason,
        tokenUsage: item.tokenUsage,
        costUsd: item.costUsd,
      })
      return [[fixture.id, { ...rescored, sourceSha256, inputSha256, execution: item.execution ?? null, repair: item.repair ?? null, route: item.route ?? null }]]
    }))
    const startedAt = new Date().toISOString()

    if (provider === 'deepseek-production') {
      const response = await requestJson(transport, pythonSession, `${endpoint}/status`, { headers: { Accept: 'application/json', Origin: origin } })
      const status = response.json
      if (!response.ok || status?.configured !== true) throw new Error('Production DeepSeek is not configured')
      if (status.model !== prompt.RECOGNITION_MODEL_NAME) throw new Error(`Model drift: expected ${prompt.RECOGNITION_MODEL_NAME}, got ${status.model}`)
    }

    for (const [index, fixture] of dataset.entries()) {
      if (byId.has(fixture.id)) {
        console.log(`[${index + 1}/${dataset.length}] ${fixture.id} resumed`)
        continue
      }
      const started = Date.now()
      let scored
      if (provider === 'local-fallback') {
        const result = pipeline.buildLocalRecognition({
          sourceType: fixture.sourceType,
          sourceTitle: fixture.sourceTitle,
          content: fixture.rawText,
          referenceTime: new Date(fixture.referenceTime),
          timezone: fixture.timezone,
          projects: [],
          tasks: [],
        })
        scored = scoreRecognitionCase(fixture, provider, result, Date.now() - started)
      } else {
        try {
          const response = await requestJson(transport, pythonSession, `${endpoint}/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: origin },
            body: JSON.stringify({
              sourceType: fixture.sourceType,
              sourceTitle: fixture.sourceTitle,
              content: fixture.rawText,
              referenceTime: fixture.referenceTime,
              timezone: fixture.timezone,
              projectCandidates: [],
              existingTasks: [],
            }),
          })
          const payload = response.json
          const latencyMs = Date.now() - started
          if (!response.ok) {
            scored = scoreRecognitionCase(fixture, provider, null, latencyMs, { status: 'request_failure', failureReason: `${response.status} ${payload?.code ?? payload?.message ?? 'request failed'}` })
          } else {
            try {
              const result = schema.parseRecognitionResult(payload?.result)
              if (expectedPrompt && result.promptVersion !== expectedPrompt) throw new Error(`Prompt drift: expected ${expectedPrompt}, got ${result.promptVersion}`)
              scored = scoreRecognitionCase(fixture, provider, result, latencyMs, {
                tokenUsage: payload?.execution?.tokenUsage ?? null,
                costUsd: null,
              })
              let repair = payload?.repair ?? null
              if (repair?.beforeResult) {
                try {
                  const beforeResult = schema.parseRecognitionResult(repair.beforeResult)
                  const before = scoreRecognitionCase(fixture, provider, beforeResult, latencyMs)
                  repair = {
                    ...repair,
                    beforeScores: {
                      taskTruePositive: before.scores.taskTruePositive,
                      materialMatched: before.scores.materialMatched,
                      timePointMatched: before.scores.timePointMatched,
                      eventMatched: before.scores.eventMatched,
                      evidenceMatched: before.scores.evidenceMatched,
                      duplicateCount: before.scores.duplicateCount,
                      overFragmented: before.scores.overFragmented,
                      majorCorrection: before.scores.majorCorrection,
                      severeError: before.scores.severeError,
                    },
                  }
                } catch {
                  repair = { ...repair, beforeScores: null }
                }
              }
              scored = { ...scored, execution: payload?.execution ?? null, repair, route: payload?.route ?? null }
            } catch (error) {
              scored = scoreRecognitionCase(fixture, provider, null, latencyMs, {
                status: 'invalid_output',
                failureReason: error instanceof Error ? error.message : 'invalid output',
              })
            }
          }
        } catch (error) {
          const latencyMs = Date.now() - started
          scored = scoreRecognitionCase(fixture, provider, null, latencyMs, {
            status: 'request_failure',
            failureReason: error instanceof Error ? error.message : 'request failed',
          })
        }
      }
      byId.set(fixture.id, {
        ...scored,
        sourceSha256: createHash('sha256').update(fixture.rawText).digest('hex'),
        inputSha256: fixtureInputSha256(fixture),
        resultSha256: scored.result ? createHash('sha256').update(JSON.stringify(scored.result)).digest('hex') : null,
      })
      await writeFile(checkpointFile, `${JSON.stringify([...byId.values()], null, 2)}\n`, 'utf8')
      console.log(`[${index + 1}/${dataset.length}] ${fixture.id} ${scored.status} ${scored.latencyMs}ms failures=${scored.failures.length}`)
      if (delayMs > 0 && index < dataset.length - 1) await sleep(delayMs)
    }

    const results = dataset.map((fixture) => byId.get(fixture.id)).filter(Boolean)
    const metrics = aggregateRecognitionMetrics(provider, results)
    const groupMetrics = Object.fromEntries([...new Set(dataset.map((fixture) => fixture.group))].map((group) => [
      group,
      aggregateRecognitionMetrics(provider, results.filter((result) => result.group === group)),
    ]))
    const completedAt = reportedCompletedAt || new Date().toISOString()
    const run = {
      runId: `${provider}-${completedAt.replace(/[:.]/gu, '-')}`,
      provider,
      label,
      datasetName,
      datasetVersion: datasetMetadata.datasetVersion,
      localPromptVersion: prompt.RECOGNITION_PROMPT_VERSION,
      expectedPromptVersion: expectedPrompt || null,
      observedPromptVersions: [...new Set(results.flatMap((item) => item.result?.promptVersion ? [item.result.promptVersion] : []))],
      modelName: provider === 'local-fallback' ? 'local-rules' : prompt.RECOGNITION_MODEL_NAME,
      promptSourceSha256,
      startedAt: reportedStartedAt || startedAt,
      completedAt,
      endpoint: provider === 'deepseek-production' ? endpoint : null,
      transport: provider === 'deepseek-production' ? transport : null,
      tokenAndCostObservation: metrics.tokenUsage ? 'Token usage is the sum of real Worker execution metadata.' : 'Token usage or cost is incomplete; no estimate is substituted for observed data.',
      evaluationNotes: retryInvalid ? [
        'The first pass exposed a harness-only null-field scoring crash. The 26 affected cases had no persisted raw result and were rerun once after the scorer was made null-safe.',
        'Two first-pass HTTP 502 request failures were retained and were not retried.',
      ] : [],
    }
    console.log(JSON.stringify({ run, metrics, groupMetrics }, null, 2))
    if (writeDir) {
      const target = path.resolve(ROOT, writeDir)
      await mkdir(target, { recursive: true })
      const stem = `${datasetName}-${label}-${provider === 'local-fallback' ? 'local-fallback' : 'deepseek-production'}`
      const failures = results.filter((item) => item.failures.length > 0).map((item) => ({
        caseId: item.caseId,
        group: item.group,
        status: item.status,
        latencyMs: item.latencyMs,
        failures: item.failures,
        execution: item.execution ?? null,
        repair: item.repair ?? null,
        route: item.route ?? null,
      }))
      await Promise.all([
        writeFile(path.join(target, `${stem}-summary.json`), `${JSON.stringify({ run, metrics, groupMetrics }, null, 2)}\n`, 'utf8'),
        writeFile(path.join(target, `${stem}-failures.json`), `${JSON.stringify({ run, failures }, null, 2)}\n`, 'utf8'),
        writeFile(path.join(target, `${stem}-baseline.md`), renderMarkdown(run, metrics, groupMetrics), 'utf8'),
      ])
    }
  } finally {
    pythonSession?.close()
    await vite.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
