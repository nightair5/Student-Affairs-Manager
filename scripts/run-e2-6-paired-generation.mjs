import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

const ROOT = process.cwd()
const EXPERIMENT_PATH = '/api/experiments/e2-factledger/generate'
const STATUS_PATH = '/api/experiments/e2-factledger/status'
const EXPECTED_MODEL = 'deepseek-v4-flash'
const EXPECTED_EXPERIMENT_VERSION = 'e2.6-paired-ab-1.2.0'
const EXPECTED_PATH_A_PROMPT = 'recognition-2.4.1'
const EXPECTED_FACT_PROMPT = 'fact-ledger-extraction-1.2.0'
const EXPECTED_PLANNER_PROMPT = 'fact-ledger-planner-1.0.0'
const execFileAsync = promisify(execFile)

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

async function curlJson(url, { method = 'GET', token = '', origin = '', body = null } = {}) {
  const statusMarker = '__E2_HTTP_STATUS__'
  const args = ['-sS', '--http1.1', '--max-time', '300', '--write-out', `${statusMarker}%{http_code}`, '--request', method]
  if (token) args.push('--header', `Authorization: Bearer ${token}`)
  if (origin) args.push('--header', `Origin: ${origin}`)
  if (body !== null) args.push('--header', 'Content-Type: application/json', '--data-binary', JSON.stringify(body))
  args.push(url)
  let stdout
  let transportAttempts = 0
  while (transportAttempts < 3) {
    transportAttempts += 1
    try {
      ({ stdout } = await execFileAsync('wsl.exe', ['curl', ...args], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 310_000 }))
      break
    } catch (error) {
      const code = typeof error?.code === 'number' || typeof error?.code === 'string' ? String(error.code) : 'UNKNOWN'
      const stderr = typeof error?.stderr === 'string' ? error.stderr.trim().slice(0, 240) : ''
      const tlsHandshakeFailedBeforeRequest = code === '35'
      if (tlsHandshakeFailedBeforeRequest && transportAttempts < 3) {
        await delay(2_000)
        continue
      }
      throw new Error(`CURL_TRANSPORT_FAILURE:${code}${stderr ? `:${stderr}` : ''}:attempts=${transportAttempts}`)
    }
  }
  const separator = stdout.lastIndexOf(statusMarker)
  if (separator < 0) throw new Error('CURL_STATUS_MISSING')
  const status = Number(stdout.slice(separator + statusMarker.length).trim())
  const text = stdout.slice(0, separator)
  if (!Number.isInteger(status)) throw new Error('CURL_STATUS_INVALID')
  return { status, payload: JSON.parse(text), transportAttempts }
}

function scheduleFor(cases, seed) {
  const ordered = [...cases].sort((left, right) => hash(`${seed}:case:${left.caseId}`).localeCompare(hash(`${seed}:case:${right.caseId}`)))
  return ordered.flatMap((entry) => {
    const first = Number.parseInt(hash(`${seed}:path:${entry.caseId}`).slice(0, 2), 16) % 2 === 0 ? 'A' : 'B'
    return [
      { caseId: entry.caseId, path: first },
      { caseId: entry.caseId, path: first === 'A' ? 'B' : 'A' },
    ]
  }).map((entry, index) => ({ ...entry, sequence: index }))
}

function canonicalInput(input) {
  return JSON.stringify({
    sourceType: input.sourceType,
    sourceTitle: input.sourceTitle,
    sourceText: input.content,
    referenceTime: input.referenceTime,
    timezone: input.timezone,
  })
}

function verifyResponse(entry, scheduled, fixture) {
  if (entry.experimentVersion !== EXPECTED_EXPERIMENT_VERSION) throw new Error(`Experiment version drift for ${fixture.caseId}/${scheduled.path}`)
  if (entry.path !== scheduled.path || entry.model !== EXPECTED_MODEL) throw new Error(`Path/model drift for ${fixture.caseId}/${scheduled.path}`)
  if (entry.sequence !== scheduled.sequence) throw new Error(`Sequence drift for ${fixture.caseId}/${scheduled.path}`)
  if (entry.parameters?.temperature !== 0 || entry.parameters?.maxTokens !== 8_192 || entry.parameters?.thinking !== 'disabled' || entry.parameters?.retries !== 0) throw new Error(`Parameter drift for ${fixture.caseId}/${scheduled.path}`)
  if (entry.versions?.pathAPromptVersion !== EXPECTED_PATH_A_PROMPT || entry.versions?.factExtractionPromptVersion !== EXPECTED_FACT_PROMPT || entry.versions?.plannerPromptVersion !== EXPECTED_PLANNER_PROMPT) throw new Error(`Prompt version drift for ${fixture.caseId}/${scheduled.path}`)
  if (entry.hashes?.sourceSha256 !== fixture.sourceSha256 || entry.hashes?.inputSha256 !== fixture.inputSha256) throw new Error(`Input binding drift for ${fixture.caseId}/${scheduled.path}`)
  if (hash(JSON.stringify(entry.result)) !== entry.hashes?.resultSha256) throw new Error(`Result hash mismatch for ${fixture.caseId}/${scheduled.path}`)
  if (scheduled.path === 'A' && hash(entry.rawModelOutputs?.recognize ?? '') !== entry.hashes?.rawRecognizeSha256) throw new Error(`Raw A output hash mismatch for ${fixture.caseId}`)
  if (scheduled.path === 'B' && (hash(entry.rawModelOutputs?.extractFacts ?? '') !== entry.hashes?.rawFactExtractionSha256 || hash(entry.rawModelOutputs?.plan ?? '') !== entry.hashes?.rawPlanSha256)) throw new Error(`Raw B output hash mismatch for ${fixture.caseId}`)
  if (scheduled.path === 'B' && hash(JSON.stringify(entry.ledger)) !== entry.hashes?.ledgerSha256) throw new Error(`Ledger hash mismatch for ${fixture.caseId}/${scheduled.path}`)
  if (scheduled.path === 'A' && entry.ledger !== null) throw new Error(`Unexpected Ledger on Path A for ${fixture.caseId}`)
  const expectedOperations = scheduled.path === 'A' ? ['recognize'] : ['extractFacts', 'plan']
  if (JSON.stringify(entry.operations?.map((operation) => operation.operation)) !== JSON.stringify(expectedOperations)) throw new Error(`Operation drift for ${fixture.caseId}/${scheduled.path}`)
}

async function main() {
  const endpoint = option('endpoint').replace(/\/$/u, '')
  if (!endpoint || !/^https:\/\//u.test(endpoint)) throw new Error('Missing HTTPS --endpoint')
  const token = process.env.E2_FACTLEDGER_EXPERIMENT_TOKEN?.trim() ?? ''
  if (token.length < 32) throw new Error('E2_FACTLEDGER_EXPERIMENT_TOKEN is not present in the runner process')
  const label = option('label')
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/u.test(label)) throw new Error('Missing or invalid --label')
  const seed = option('seed', 'e2.6-paired-2026-08-11')
  const pauseMs = Number(option('delay-ms', '3000'))
  const resume = option('resume', 'false') === 'true'
  const manifestPath = path.resolve(ROOT, option('manifest', '.evaluation-cache/e2-6/input-manifest.json'))
  const manifestBytes = await readFile(manifestPath)
  const manifestSha256 = hash(manifestBytes)
  const manifest = JSON.parse(manifestBytes.toString('utf8'))
  if (manifest.schemaVersion !== 'e2.6-generation-inputs-1.0.0' || manifest.sampleCount !== 24 || manifest.cases.length !== 24) throw new Error('Input manifest is not the frozen E2.6 24-case manifest')
  for (const fixture of manifest.cases) {
    if (hash(fixture.input.content) !== fixture.sourceSha256 || hash(canonicalInput(fixture.input)) !== fixture.inputSha256) throw new Error(`Manifest hash mismatch for ${fixture.caseId}`)
  }
  const schedule = scheduleFor(manifest.cases, seed)
  const scheduleSha256 = hash(JSON.stringify(schedule))
  const outputDir = path.join(ROOT, '.evaluation-cache', 'e2-6')
  const outputPath = path.join(outputDir, `${label}-raw.json`)
  await mkdir(outputDir, { recursive: true })
  let checkpoint = null
  try {
    checkpoint = await readJson(outputPath)
    if (!resume) throw new Error(`Raw checkpoint already exists for label ${label}; use --resume=true or a new label`)
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error
  }
  if (checkpoint && (checkpoint.manifestSha256 !== manifestSha256 || checkpoint.scheduleSha256 !== scheduleSha256 || checkpoint.endpoint !== endpoint || checkpoint.seed !== seed)) throw new Error('Checkpoint provenance drift')
  const observations = checkpoint?.observations ?? []
  const keyed = new Map(observations.map((entry) => [`${entry.caseId}:${entry.path}`, entry]))
  const statusResponse = await curlJson(`${endpoint}${STATUS_PATH}`)
  const status = statusResponse.payload
  if (statusResponse.status !== 200 || status.enabled !== true || status.configured !== true || status.protected !== true || status.model !== EXPECTED_MODEL || status.experimentVersion !== EXPECTED_EXPERIMENT_VERSION) throw new Error(`Preview status not ready: ${JSON.stringify(status)}`)
  const byCaseId = new Map(manifest.cases.map((entry) => [entry.caseId, entry]))
  for (const scheduled of schedule) {
    const key = `${scheduled.caseId}:${scheduled.path}`
    if (keyed.has(key)) continue
    const fixture = byCaseId.get(scheduled.caseId)
    const requestBody = { ...fixture.input, path: scheduled.path, runId: label, sequence: scheduled.sequence }
    const startedAt = Date.now()
    let observation
    try {
      const response = await curlJson(`${endpoint}${EXPERIMENT_PATH}`, {
        method: 'POST',
        token,
        origin: new URL(endpoint).origin,
        body: requestBody,
      })
      const payload = response.payload
      if (response.status < 200 || response.status >= 300) {
        observation = {
          caseId: fixture.caseId,
          group: fixture.group,
          sourceSet: fixture.sourceSet,
          path: scheduled.path,
          sequence: scheduled.sequence,
          status: 'failed',
          localTransportAttempts: response.transportAttempts,
          roundTripLatencyMs: Date.now() - startedAt,
          error: `PREVIEW_HTTP_${response.status}:${payload.error ?? 'UNKNOWN'}`,
          failureResponse: payload,
        }
      } else {
        verifyResponse(payload, scheduled, fixture)
        observation = {
          caseId: fixture.caseId,
          group: fixture.group,
          sourceSet: fixture.sourceSet,
          path: scheduled.path,
          sequence: scheduled.sequence,
          status: 'ok',
          localTransportAttempts: response.transportAttempts,
          roundTripLatencyMs: Date.now() - startedAt,
          response: payload,
        }
      }
    } catch (error) {
      observation = {
        caseId: fixture.caseId,
        group: fixture.group,
        sourceSet: fixture.sourceSet,
        path: scheduled.path,
        sequence: scheduled.sequence,
        status: 'failed',
        roundTripLatencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'GENERATION_FAILURE',
      }
    }
    keyed.set(key, observation)
    const orderedObservations = schedule.flatMap((item) => keyed.get(`${item.caseId}:${item.path}`) ?? [])
    const raw = {
      schemaVersion: 'e2.6-paired-raw-1.0.0',
      label,
      endpoint,
      transport: 'wsl-curl-openssl-tls-handshake-retry-only',
      seed,
      model: EXPECTED_MODEL,
      manifestSha256,
      scheduleSha256,
      generationExpectedDataLoaded: false,
      generationStartedAt: checkpoint?.generationStartedAt ?? new Date().toISOString(),
      generationCompletedAt: null,
      schedule,
      observations: orderedObservations,
    }
    await writeFile(outputPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8')
    process.stdout.write(`[${scheduled.sequence + 1}/${schedule.length}] ${fixture.caseId} ${scheduled.path} ${observation.status}\n`)
    if (pauseMs > 0 && scheduled.sequence < schedule.length - 1) await delay(pauseMs)
  }
  const final = await readJson(outputPath)
  const completed = final.observations.filter((entry) => entry.status === 'ok').length
  const failed = final.observations.filter((entry) => entry.status === 'failed').length
  final.generationCompletedAt = completed + failed === schedule.length ? new Date().toISOString() : null
  final.status = completed === schedule.length ? 'COMPLETE' : failed > 0 ? 'PARTIAL' : 'INCOMPLETE'
  await writeFile(outputPath, `${JSON.stringify(final, null, 2)}\n`, 'utf8')
  process.stdout.write(`${JSON.stringify({ status: final.status, completed, failed, output: path.relative(ROOT, outputPath), rawSha256: hash(await readFile(outputPath)) })}\n`)
  if (final.status !== 'COMPLETE') process.exitCode = 2
}

await main()
