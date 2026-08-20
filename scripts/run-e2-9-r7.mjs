/* global console, process */
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rmdir, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonicalJson, sha256 } from './e2-9-r1-hash.mjs'

export const R7_PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.6.0'
const SOURCE_PROTOCOL_VERSION = 'e2-9-v4-pro-reduced-protocol-2.0.0'
const BENCHMARK_VERSION = 'e2-v4-pro-benchmark-2.2.0'
const PROMPT_VERSION = 'recognition-2.4.1-r7-preview'
const PIPELINE_VERSION = 'recognition-pipeline-2.2.2-r7-preview'
const NORMALIZER_VERSION = 'e2-v4-pro-benchmark-normalizer-2.2.0'
const PLANNER_VERSION = 'e2-v4-pro-benchmark-planner-1.0.0'
const MODEL_BY_ALIAS = Object.freeze({ flash: 'deepseek-v4-flash', pro: 'deepseek-v4-pro' })
const CACHE = path.join(process.cwd(), '.evaluation-cache', 'e2-9-r7', 'protocol-3.6.0')
const DEFAULT_ENDPOINT = 'https://student-affairs-manager-preview.nightsdell.workers.dev/api/experiments/e2-9/v4-pro-benchmark'
const FORBIDDEN_KEYS = /^(?:expected|answer|answers|gold|golden|target|targets|label|labels|score|scores|forbidden)$/iu

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function ensureLabel(label) {
  if (!/^[a-z0-9][a-z0-9._-]{2,100}$/u.test(label)) throw new Error('A fresh lowercase --label is required')
  return label
}

async function exists(file) {
  try { await readFile(file); return true } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return false
    throw error
  }
}

function assertFirewall(value, location = '$') {
  if (Array.isArray(value)) return value.forEach((item, index) => assertFirewall(item, `${location}[${index}]`))
  if (!value || typeof value !== 'object') return
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) throw new Error(`GENERATION_FIREWALL_REJECTED:${location}.${key}`)
    assertFirewall(nested, `${location}.${key}`)
  }
}

async function requestJson(url, { token, method = 'GET', body } = {}) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'e2-9-r7-curl-'))
  const bodyPath = path.join(tempDir, 'body.bin')
  const headersPath = path.join(tempDir, 'headers.txt')
  const requestPath = path.join(tempDir, 'request.json')
  const startedAt = new Date().toISOString()
  const startedMs = Date.now()
  if (body !== undefined) await writeFile(requestPath, body, 'utf8')
  try {
    const command = process.platform === 'win32' ? 'curl.exe' : 'curl'
    const args = ['--silent', '--show-error', '--connect-timeout', '20', '--max-time', '150', '--request', method, '--output', bodyPath, '--dump-header', headersPath, '--write-out', '%{http_code}', url]
    if (body !== undefined) args.push('--data-binary', `@${requestPath}`)
    const config = [
      `header = "Origin: ${new URL(url).origin}"`,
      `header = "Authorization: Bearer ${token}"`,
      'header = "Accept: application/json"',
      ...(body === undefined ? [] : ['header = "Content-Type: application/json"']),
    ].join('\n')
    const statusText = await new Promise((resolve, reject) => {
      const child = spawn(command, ['--config', '-', ...args], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
      const stdout = []
      const stderr = []
      child.stdout.on('data', (chunk) => stdout.push(chunk))
      child.stderr.on('data', (chunk) => stderr.push(chunk))
      child.on('error', reject)
      child.on('close', (code) => code === 0
        ? resolve(Buffer.concat(stdout).toString('utf8'))
        : reject(new Error(`curl_exit_${code}:${Buffer.concat(stderr).toString('utf8').slice(0, 300)}`)))
      child.stdin.end(config)
    })
    const rawBody = await readFile(bodyPath, 'utf8')
    const rawHeaders = await readFile(headersPath, 'utf8')
    let payload = null
    try { payload = JSON.parse(rawBody) } catch { /* raw response retained */ }
    return { startedAt, completedAt: new Date().toISOString(), clientDurationMs: Date.now() - startedMs, httpStatus: Number(statusText), rawHeadersSha256: sha256(rawHeaders), rawBody, rawBodySha256: sha256(rawBody), payload }
  } catch (error) {
    return { startedAt, completedAt: new Date().toISOString(), clientDurationMs: Date.now() - startedMs, httpStatus: null, rawHeadersSha256: sha256(''), rawBody: '', rawBodySha256: sha256(''), payload: null, transportError: error instanceof Error ? error.message : 'TRANSPORT_FAILURE' }
  } finally {
    for (const file of [bodyPath, headersPath, requestPath]) if (await exists(file)) await unlink(file)
    await rmdir(tempDir)
  }
}

function validateReadiness(payload, alias) {
  const model = MODEL_BY_ALIAS[alias]
  if (payload?.benchmarkVersion !== BENCHMARK_VERSION || payload?.requestedModel !== model || payload?.returnedModel !== model) throw new Error('READINESS_MODEL_OR_VERSION_DRIFT')
  if (!payload.requestId || !payload.systemFingerprint || !payload.validJsonObject) throw new Error('READINESS_EVIDENCE_MISSING')
  if (!payload.usage || !['input', 'output', 'total'].every((key) => Number.isFinite(payload.usage[key]))) throw new Error('READINESS_USAGE_MISSING')
}

export function validateR7Generation(payload, fixture, alias) {
  const model = MODEL_BY_ALIAS[alias]
  const execution = payload?.execution
  if (!payload || typeof payload.rawOutput !== 'string' || !payload.result || !execution) throw new Error('INCOMPLETE_ENDPOINT_PAYLOAD')
  if (payload.benchmarkVersion !== BENCHMARK_VERSION || payload.semanticRole !== fixture.semanticRole || execution.semanticRole !== fixture.semanticRole) throw new Error('BENCHMARK_OR_ROLE_DRIFT')
  if (![execution.requestedModel, execution.returnedModel, execution.executionModel, payload.result.modelName].every((value) => value === model)) throw new Error('MODEL_LINEAGE_DRIFT')
  if (execution.promptVersion !== PROMPT_VERSION || payload.result.promptVersion !== PROMPT_VERSION || execution.pipelineVersion !== PIPELINE_VERSION
    || execution.normalizer !== NORMALIZER_VERSION || execution.plannerVersion !== PLANNER_VERSION || execution.schemaVersion !== '2.0' || payload.result.schemaVersion !== '2.0') throw new Error('R7_VERSION_DRIFT')
  if (!/^[a-f0-9]{64}$/u.test(execution.promptSha256) || !execution.systemFingerprint) throw new Error('PROMPT_OR_FINGERPRINT_MISSING')
  if (execution.router !== 'BYPASSED' || execution.repair !== 'DISABLED' || execution.temperature !== 0 || execution.maxTokens !== 6_000 || execution.thinking !== 'disabled') throw new Error('PARAMETER_DRIFT')
  if (!Array.isArray(execution.attempts) || execution.attempts.length !== 1) throw new Error('UPSTREAM_CALL_COUNT_NOT_ONE')
  if (execution.sourceSha256 !== fixture.sourceSha256 || execution.rawOutputSha256 !== sha256(payload.rawOutput) || execution.resultSha256 !== sha256(JSON.stringify(payload.result))) throw new Error('RESULT_PROVENANCE_MISMATCH')
  if (!execution.tokenUsage || !['input', 'output', 'total'].every((key) => Number.isFinite(execution.tokenUsage[key]))) throw new Error('TOKEN_USAGE_MISSING')
  if (!Array.isArray(payload.validation?.benchmarkPlannerIssues) || payload.validation.benchmarkPlannerIssues.length !== 0) throw new Error(`PLANNER_CONTRACT_FAILED:${payload.validation?.benchmarkPlannerIssues?.join(',') ?? 'MISSING'}`)
  if (!Array.isArray(payload.result.evidence) || payload.result.evidence.length === 0) throw new Error('EVIDENCE_COMPLETELY_MISSING')
  const entities = (payload.result.standaloneTasks?.length ?? 0) + (payload.result.milestones?.length ?? 0) + (payload.result.materials?.length ?? 0) + (payload.result.timePoints?.length ?? 0) + (payload.result.events?.length ?? 0) + (payload.result.ambiguities?.length ?? 0)
  if (fixture.semanticRole === 'information_only') {
    if (payload.result.sourceSummary?.requiresAction !== false || entities !== 0) throw new Error('PURE_INFORMATION_ROLE_DRIFT')
  } else if (entities === 0) throw new Error('BASIC_CONTENT_EMPTY')
}

function pairedOrder(cases, seed) {
  const ordered = [...cases].sort((left, right) => sha256(`${seed}:${left.caseId}`).localeCompare(sha256(`${seed}:${right.caseId}`)))
  return ordered.flatMap((fixture) => {
    const proFirst = Number.parseInt(sha256(`${seed}:arm:${fixture.caseId}`).slice(0, 2), 16) % 2 === 1
    return (proFirst ? ['pro', 'flash'] : ['flash', 'pro']).map((modelAlias) => ({ fixture, modelAlias }))
  })
}

async function runReadiness({ label, endpoint, token, deploymentVersion }) {
  const dir = path.join(CACHE, 'readiness')
  const file = path.join(dir, `${label}.json`)
  if (await exists(file)) throw new Error(`REFUSING_TO_OVERWRITE:${file}`)
  await mkdir(dir, { recursive: true })
  const probes = []
  let error = null
  for (const alias of ['flash', 'pro']) {
    for (let sequence = 1; sequence <= 3; sequence += 1) {
      const response = await requestJson(`${endpoint}/readiness?modelAlias=${alias}`, { token })
      try {
        if (response.httpStatus !== 200) throw new Error(`HTTP_${response.httpStatus}`)
        validateReadiness(response.payload, alias)
        probes.push({ alias, sequence, status: 'PASS', response })
      } catch (caught) {
        error = caught instanceof Error ? caught.message : 'READINESS_FAILURE'
        probes.push({ alias, sequence, status: 'FAIL', error, response })
        break
      }
    }
    if (error) break
  }
  const result = { schemaVersion: 'e2.9-r7-readiness-1.0.0', protocolVersion: R7_PROTOCOL_VERSION, label, deploymentVersion, completedAt: new Date().toISOString(), expectedProbeCount: 6, probes, status: !error && probes.length === 6 ? 'PASS' : 'FAILED', error }
  await writeFile(file, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ phase: 'readiness', label, status: result.status, probes: probes.length, checkpoint: file, sha256: sha256(await readFile(file, 'utf8')) }, null, 2))
  if (result.status !== 'PASS') process.exitCode = 2
}

async function runScreening({ label, endpoint, token, deploymentVersion, readinessLabel, sourcePath, seed }) {
  const readinessPath = path.join(CACHE, 'readiness', `${readinessLabel}.json`)
  const readinessRaw = await readFile(readinessPath, 'utf8')
  const readiness = JSON.parse(readinessRaw)
  if (readiness.status !== 'PASS' || readiness.protocolVersion !== R7_PROTOCOL_VERSION || readiness.deploymentVersion !== deploymentVersion) throw new Error('READINESS_PREREQUISITE_FAILED')
  const sourceRaw = await readFile(sourcePath, 'utf8')
  const source = JSON.parse(sourceRaw)
  assertFirewall(source)
  if (source.protocolVersion !== SOURCE_PROTOCOL_VERSION || source.screeningCases?.length !== 8) throw new Error('FROZEN_SOURCE_MANIFEST_INVALID')
  for (const fixture of source.screeningCases) {
    const input = { sourceType: fixture.sourceType, sourceTitle: fixture.sourceTitle, content: fixture.content, referenceTime: fixture.referenceTime, timezone: fixture.timezone }
    if (!['action_required', 'information_only', 'prompt_injection'].includes(fixture.semanticRole) || fixture.inputSha256 !== sha256(canonicalJson(input)) || fixture.sourceSha256 !== sha256(fixture.content)) throw new Error(`SOURCE_PROVENANCE_INVALID:${fixture.caseId}`)
  }
  const dir = path.join(CACHE, 'screening')
  const file = path.join(dir, `${label}.json`)
  if (await exists(file)) throw new Error(`REFUSING_TO_OVERWRITE:${file}`)
  await mkdir(dir, { recursive: true })
  const observations = []
  const startedAt = new Date().toISOString()
  let promptSha256 = null
  for (const [index, { fixture, modelAlias }] of pairedOrder(source.screeningCases, seed).entries()) {
    const body = canonicalJson({ modelAlias, semanticRole: fixture.semanticRole, sourceType: fixture.sourceType, sourceTitle: fixture.sourceTitle, content: fixture.content, referenceTime: fixture.referenceTime, timezone: fixture.timezone })
    const response = await requestJson(`${endpoint}/generate`, { token, method: 'POST', body })
    let status = 'complete'
    let error = null
    try {
      if (response.httpStatus !== 200) throw new Error(`HTTP_${response.httpStatus}`)
      validateR7Generation(response.payload, fixture, modelAlias)
      if (promptSha256 && response.payload.execution.promptSha256 !== promptSha256) throw new Error('PROMPT_HASH_DRIFT_WITHIN_RUN')
      promptSha256 = response.payload.execution.promptSha256
    } catch (caught) {
      status = response.httpStatus === null ? 'transport_failure' : 'integrity_failure'
      error = caught instanceof Error ? caught.message : 'INTEGRITY_FAILURE'
    }
    observations.push({
      observationId: sha256(`${R7_PROTOCOL_VERSION}:${label}:${fixture.caseId}:${modelAlias}`), observationIndex: index + 1,
      caseId: fixture.caseId, sourceSet: fixture.sourceSet, semanticRole: fixture.semanticRole, modelAlias,
      requestedModel: MODEL_BY_ALIAS[modelAlias], sourceSha256: fixture.sourceSha256, inputSha256: fixture.inputSha256,
      status, error, response,
    })
    const checkpoint = { schemaVersion: 'e2.9-r7-screening-checkpoint-1.0.0', protocolVersion: R7_PROTOCOL_VERSION, phase: 'screening', label, seed, deploymentVersion, readinessLabel, readinessSha256: sha256(readinessRaw), sourceOnlySha256: sha256(canonicalJson(source)), startedAt, gateStatus: status === 'complete' ? 'RUNNING' : 'FAILED', expectedObservations: 16, observations }
    await writeFile(file, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8')
    console.log(`[${index + 1}/16] ${fixture.caseId} ${modelAlias} ${status}`)
    if (status !== 'complete') break
  }
  const gateStatus = observations.length === 16 && observations.every((item) => item.status === 'complete') ? 'COMPLETE' : 'FAILED'
  const checkpoint = { schemaVersion: 'e2.9-r7-screening-checkpoint-1.0.0', protocolVersion: R7_PROTOCOL_VERSION, phase: 'screening', label, seed, deploymentVersion, readinessLabel, readinessSha256: sha256(readinessRaw), sourceOnlySha256: sha256(canonicalJson(source)), startedAt, completedAt: new Date().toISOString(), gateStatus, expectedObservations: 16, promptSha256, observations }
  await writeFile(file, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ phase: 'screening', label, gateStatus, attempted: observations.length, complete: observations.filter((item) => item.status === 'complete').length, checkpoint: file, sha256: sha256(await readFile(file, 'utf8')) }, null, 2))
  if (gateStatus !== 'COMPLETE') process.exitCode = 2
}

async function main() {
  const phase = option('phase')
  const label = ensureLabel(option('label'))
  const endpoint = option('endpoint', DEFAULT_ENDPOINT)
  const deploymentVersion = option('deployment-version')
  const token = process.env.E2_V4_PRO_BENCHMARK_TOKEN ?? ''
  if (!['readiness', 'screening'].includes(phase)) throw new Error('R7 permits only readiness or screening; Selection, Blind and Production are blocked')
  if (!new URL(endpoint).hostname.includes('preview')) throw new Error('PREVIEW_ENDPOINT_REQUIRED')
  if (!/^[a-f0-9-]{20,}$/u.test(deploymentVersion)) throw new Error('VERIFIED_DEPLOYMENT_VERSION_REQUIRED')
  if (token.length < 32) throw new Error('E2_V4_PRO_BENCHMARK_TOKEN must exist only in process memory')
  if (phase === 'readiness') return runReadiness({ label, endpoint, token, deploymentVersion })
  const readinessLabel = ensureLabel(option('readiness-label'))
  const sourcePath = path.resolve(option('source-manifest', '.evaluation-cache/e2-9-r1/protocol-2.0.0/source-only-manifest.json'))
  return runScreening({ label, endpoint, token, deploymentVersion, readinessLabel, sourcePath, seed: option('seed', 'e2-9-r7-screening-seed-20260821') })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
