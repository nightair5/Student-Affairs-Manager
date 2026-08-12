/* global console, process */
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { canonicalJson, sha256 } from './e2-9-r2-hash.mjs'
import { assertCanonicalBinding, deriveCheckpointGateStatus } from './e2-9-r2-integrity.mjs'

const ROOT = process.cwd()
const DOCS = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r2')
const CACHE = path.join(ROOT, '.evaluation-cache', 'e2-9-r2', 'protocol-3.0.0')
const PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.0.0'
const ENDPOINT = 'https://student-affairs-manager-preview.nightsdell.workers.dev/api/experiments/e2-9/r2/benchmark'
const MODELS = Object.freeze({ flash: 'deepseek-v4-flash', pro: 'deepseek-v4-pro' })

function option(name) {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? ''
}

async function curlRequest(url, { token, body }) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'e2-9-r2-curl-'))
  const requestPath = path.join(dir, 'request.json')
  const responsePath = path.join(dir, 'response.bin')
  const headersPath = path.join(dir, 'headers.txt')
  await writeFile(requestPath, body, 'utf8')
  try {
    const config = [
      `header = "Origin: ${new URL(ENDPOINT).origin}"`,
      `header = "Authorization: Bearer ${token}"`,
      'header = "Accept: application/json"',
      'header = "Content-Type: application/json"',
    ].join('\n')
    const startedAt = new Date().toISOString()
    const startedMs = Date.now()
    const statusText = await new Promise((resolve, reject) => {
      const child = spawn(process.platform === 'win32' ? 'curl.exe' : 'curl', ['--config', '-', '--silent', '--show-error', '--connect-timeout', '20', '--max-time', '180', '--request', 'POST', '--data-binary', `@${requestPath}`, '--output', responsePath, '--dump-header', headersPath, '--write-out', '%{http_code}', url], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
      const stdout = []
      const stderr = []
      child.stdout.on('data', (chunk) => stdout.push(chunk))
      child.stderr.on('data', (chunk) => stderr.push(chunk))
      child.on('error', reject)
      child.on('close', (code) => code === 0 ? resolve(Buffer.concat(stdout).toString('utf8')) : reject(new Error(`curl_exit_${code}:${Buffer.concat(stderr).toString('utf8').slice(0, 300)}`)))
      child.stdin.end(config)
    })
    const [rawBody, rawHeaders] = await Promise.all([readFile(responsePath, 'utf8'), readFile(headersPath, 'utf8')])
    let payload = null
    try { payload = JSON.parse(rawBody) } catch { /* retained verbatim */ }
    return { startedAt, completedAt: new Date().toISOString(), clientDurationMs: Date.now() - startedMs, httpStatus: Number(statusText), rawBody, rawBodySha256: sha256(rawBody), rawHeaders, rawHeadersSha256: sha256(rawHeaders), payload }
  } finally { await rm(dir, { recursive: true, force: true }) }
}

function phaseCheckpointPath(run, phase) {
  return path.join(CACHE, 'checkpoints', `${run.labels[phase]}.json`)
}

async function assertMissing(file) {
  try { await readFile(file); throw new Error(`Fresh label already has a checkpoint: ${path.relative(ROOT, file)}`) } catch (error) {
    if (error instanceof Error && error.message.startsWith('Fresh label')) throw error
    if (!error || typeof error !== 'object' || error.code !== 'ENOENT') throw error
  }
}

async function loadInputs() {
  const [runRaw, sourceRaw, smokeRaw, screeningRaw, bundleRaw, activationRaw] = await Promise.all([
    readFile(path.join(DOCS, 'run-manifest.json'), 'utf8'),
    readFile(path.join(CACHE, 'source-only-manifest.json'), 'utf8'),
    readFile(path.join(DOCS, 'smoke-manifest.json'), 'utf8'),
    readFile(path.join(DOCS, 'screening-manifest.json'), 'utf8'),
    readFile(path.join(DOCS, 'bundle-hash-manifest.json'), 'utf8'),
    readFile(path.join(DOCS, 'preview-activation.json'), 'utf8'),
  ])
  const run = JSON.parse(runRaw)
  const source = JSON.parse(sourceRaw)
  const manifests = { smoke: JSON.parse(smokeRaw), screening: JSON.parse(screeningRaw) }
  const bundle = JSON.parse(bundleRaw)
  const activation = JSON.parse(activationRaw)
  if ([run, source, ...Object.values(manifests), bundle, activation].some((item) => item.protocolVersion !== PROTOCOL_VERSION)) throw new Error('PROTOCOL_VERSION_DRIFT')
  assertCanonicalBinding(source, run.bindings.sourceOnlySha256, 'SOURCE_ONLY')
  assertCanonicalBinding(manifests.smoke, run.bindings.smokeManifestSha256, 'SMOKE_MANIFEST')
  assertCanonicalBinding(manifests.screening, run.bindings.screeningManifestSha256, 'SCREENING_MANIFEST')
  assertCanonicalBinding(bundle, run.bindings.bundleManifestSha256, 'BUNDLE_MANIFEST')
  if (activation.protocolBundleSha256 !== bundle.bundles.protocolAndDeployment.sha256) throw new Error('ACTIVATION_BUNDLE_MISMATCH')
  return { run, source, manifests, activation, raw: { runRaw, sourceRaw, smokeRaw, screeningRaw, bundleRaw, activationRaw } }
}

function validateGeneration(payload, observation) {
  if (!payload || payload.protocolVersion !== PROTOCOL_VERSION || payload.observationId !== observation.observationId || !payload.result || !payload.execution) return 'INCOMPLETE_ENDPOINT_PAYLOAD'
  const expectedModel = MODELS[observation.modelAlias]
  if (![payload.execution.requestedModel, payload.execution.returnedModel, payload.execution.executionModel, payload.result.modelName].every((value) => value === expectedModel)) return 'MODEL_LINEAGE_MISMATCH'
  if (payload.semanticRole !== observation.semanticRole || payload.execution.semanticRole !== observation.semanticRole || payload.result.benchmarkSemanticRole !== observation.semanticRole) return 'SEMANTIC_ROLE_DROPPED'
  if (payload.execution.promptVersion !== 'recognition-2.4.1' || payload.execution.schemaVersion !== '2.0' || payload.execution.pipelineVersion !== 'recognition-pipeline-2.2.1') return 'FROZEN_VERSION_DRIFT'
  if (payload.execution.temperature !== 0 || payload.execution.maxTokens !== 6000 || payload.execution.thinking !== 'disabled' || payload.execution.router !== 'BYPASSED' || payload.execution.repair !== 'DISABLED') return 'PARAMETER_DRIFT'
  if (payload.execution.normalizer !== 'e2-9-r2-role-aware-normalizer-3.0.0') return 'NORMALIZER_VERSION_DRIFT'
  if (!Array.isArray(payload.execution.attempts) || payload.execution.attempts.length !== 1) return 'UPSTREAM_CALL_COUNT_NOT_ONE'
  if (!payload.execution.systemFingerprint || !payload.execution.tokenUsage || !['input', 'output', 'total'].every((key) => Number.isFinite(payload.execution.tokenUsage[key]))) return 'EXECUTION_PROVENANCE_INCOMPLETE'
  if (payload.execution.sourceSha256 !== observation.sourceSha256 || payload.execution.rawOutputSha256 !== sha256(payload.rawOutput) || payload.execution.resultSha256 !== sha256(JSON.stringify(payload.result))) return 'RESULT_HASH_MISMATCH'
  const entityCount = (payload.result.standaloneTasks?.length ?? 0) + (payload.result.milestones?.length ?? 0) + (payload.result.materials?.length ?? 0) + (payload.result.timePoints?.length ?? 0) + (payload.result.events?.length ?? 0)
  if (observation.semanticRole === 'information_only' && (payload.result.sourceSummary?.requiresAction !== false || entityCount !== 0)) return 'PURE_INFORMATION_CONTRACT_FAILED'
  if (observation.semanticRole !== 'information_only' && entityCount === 0) return 'BASIC_CONTENT_EMPTY'
  return null
}

async function post(pathSuffix, token, value) {
  return curlRequest(`${ENDPOINT}/${pathSuffix}`, { token, body: canonicalJson(value) })
}

async function runPhase(phase, token) {
  const inputs = await loadInputs()
  const { run, source, activation } = inputs
  const checkpointFile = phaseCheckpointPath(run, phase)
  await assertMissing(checkpointFile)
  await mkdir(path.dirname(checkpointFile), { recursive: true })

  if (phase === 'readiness') {
    const registration = { ...run.registration, bindings: { ...run.registration.bindings, activationSha256: sha256(inputs.raw.activationRaw), deploymentVersion: activation.mainDeploymentVersion, ledgerDeploymentVersion: activation.ledgerDeploymentVersion } }
    const response = await post('register', token, registration)
    if (response.httpStatus !== 201) throw new Error(`RUN_REGISTRATION_FAILED_HTTP_${response.httpStatus}`)
  } else {
    const prior = phase === 'smoke' ? 'readiness' : 'smoke'
    const priorRaw = await readFile(phaseCheckpointPath(run, prior), 'utf8')
    const priorCheckpoint = JSON.parse(priorRaw)
    if (priorCheckpoint.gateStatus !== 'GENERATION_COMPLETE') throw new Error(`${prior.toUpperCase()}_PREREQUISITE_FAILED`)
  }

  const observations = run.registration.observations.filter((item) => item.phase === phase)
  const sources = new Map([...(source.smokeCases ?? []), ...(source.screeningCases ?? [])].map((item) => [item.caseId, item]))
  const startedAt = new Date().toISOString()
  const records = []
  let integrityFailure = null
  for (const observation of observations) {
    const fixture = sources.get(observation.caseId)
    const body = phase === 'readiness'
      ? { runLabel: run.runLabel, observationId: observation.observationId, modelAlias: observation.modelAlias, inputSha256: observation.inputSha256, phaseManifestSha256: observation.phaseManifestSha256, protocolVersion: PROTOCOL_VERSION }
      : { runLabel: run.runLabel, observationId: observation.observationId, phase, modelAlias: observation.modelAlias, semanticRole: observation.semanticRole, sourceType: fixture.sourceType, sourceTitle: fixture.sourceTitle, content: fixture.content, referenceTime: fixture.referenceTime, timezone: fixture.timezone, sourceSha256: fixture.sourceSha256, inputSha256: fixture.inputSha256, phaseManifestSha256: observation.phaseManifestSha256, protocolVersion: PROTOCOL_VERSION }
    let response
    try { response = await post(phase === 'readiness' ? 'readiness' : 'generate', token, body) } catch (error) {
      response = { startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), clientDurationMs: null, httpStatus: null, rawBody: '', rawBodySha256: sha256(''), rawHeaders: '', rawHeadersSha256: sha256(''), payload: null, transportError: error instanceof Error ? error.message : 'TRANSPORT_FAILURE' }
    }
    let error = null
    if (response.httpStatus !== 200) error = response.transportError ?? response.payload?.error ?? `HTTP_${response.httpStatus}`
    else if (phase === 'readiness') {
      const expected = MODELS[observation.modelAlias]
      if (response.payload?.status !== 'complete' || response.payload?.requestedModel !== expected || response.payload?.returnedModel !== expected || response.payload?.executionModel !== expected) error = 'READINESS_LINEAGE_FAILURE'
    } else error = validateGeneration(response.payload, observation)
    records.push({ ...observation, status: error ? 'integrity_failure' : 'complete', error, response })
    const checkpoint = { schemaVersion: 'e2.9-r2-checkpoint-3.0.0', protocolVersion: PROTOCOL_VERSION, runLabel: run.runLabel, phase, label: run.labels[phase], bindings: run.bindings, activationSha256: sha256(inputs.raw.activationRaw), startedAt, gateStatus: error ? 'INTEGRITY_FAILURE' : 'IN_PROGRESS', expectedObservations: observations.length, observations: records }
    await writeFile(checkpointFile, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8')
    console.log(`[${records.length}/${observations.length}] ${phase} ${observation.caseId ?? 'minimum'} ${observation.modelAlias} ${error ? `FAIL:${error}` : 'complete'}`)
    if (error) { integrityFailure = error; break }
  }
  const gateStatus = integrityFailure ? 'INTEGRITY_FAILURE' : deriveCheckpointGateStatus(records, observations.length)
  const checkpoint = { schemaVersion: 'e2.9-r2-checkpoint-3.0.0', protocolVersion: PROTOCOL_VERSION, runLabel: run.runLabel, phase, label: run.labels[phase], bindings: run.bindings, activationSha256: sha256(inputs.raw.activationRaw), startedAt, completedAt: new Date().toISOString(), gateStatus, expectedObservations: observations.length, observations: records }
  await writeFile(checkpointFile, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8')
  if (gateStatus === 'GENERATION_COMPLETE') {
    const nextStage = { readiness: 'SMOKE_OPEN', smoke: 'SCREENING_OPEN', screening: 'SCORING_OPEN' }[phase]
    const advanced = await post('advance', token, { runLabel: run.runLabel, nextStage })
    if (advanced.httpStatus !== 200) throw new Error(`STAGE_ADVANCE_FAILED_HTTP_${advanced.httpStatus}`)
  }
  console.log(JSON.stringify({ phase, gateStatus, expected: observations.length, completed: records.filter((item) => item.status === 'complete').length, checkpoint: path.relative(ROOT, checkpointFile), checkpointSha256: sha256(await readFile(checkpointFile, 'utf8')) }, null, 2))
  if (gateStatus !== 'GENERATION_COMPLETE') process.exitCode = 2
}

const phase = option('phase')
if (!['readiness', 'smoke', 'screening'].includes(phase)) throw new Error('--phase must be readiness, smoke, or screening')
const token = process.env.E2_R2_BENCHMARK_TOKEN ?? ''
if (token.length < 32) throw new Error('E2_R2_BENCHMARK_TOKEN is required only in process memory')
await runPhase(phase, token)
