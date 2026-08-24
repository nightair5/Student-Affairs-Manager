/* global console, process */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  E2_R10_FACT_EXTRACTION_PROMPT_VERSION,
  E2_R10_PATH_A_PIPELINE_VERSION,
  E2_R10_PATH_A_PROMPT_VERSION,
  E2_R10_PATH_B_PIPELINE_VERSION,
  E2_R10_SCREENING_MODEL,
  E2_R10_SCREENING_PROTOCOL_VERSION,
  E2_R10_SCREENING_RUN_LABEL,
  canonicalJson,
} from '../cloudflare/e2-r10-screening-contract.mjs'

const ROOT = process.cwd()
const SOURCE_PATH = path.join(ROOT, '.evaluation-cache', 'e2-9-r1', 'protocol-2.0.0', 'source-only-manifest.json')
const PUBLIC_MANIFEST_PATH = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r10', 'screening-protocol-1.0.0', 'case-manifest.json')
const BUNDLE_PATH = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r10', 'screening-protocol-1.0.0', 'protocol-bundle.json')
const CACHE_DIR = path.join(ROOT, '.evaluation-cache', 'e2-9-r10', 'screening-protocol-1.0.0', E2_R10_SCREENING_RUN_LABEL)
const FORBIDDEN_KEYS = /^(?:expected|answer|answers|gold|golden|target|targets|label|labels|score|scores|forbidden)$/iu

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function readJson(file) {
  const raw = await readFile(file, 'utf8')
  return { raw, value: JSON.parse(raw) }
}

function assertNoEvaluationKeys(value, location = '$') {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoEvaluationKeys(item, `${location}[${index}]`))
  if (!value || typeof value !== 'object') return
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) throw new Error(`GENERATION_FIREWALL_REJECTED:${location}.${key}`)
    assertNoEvaluationKeys(nested, `${location}.${key}`)
  }
}

function privateSourceManifest(source, parentRawSha256) {
  return {
    schemaVersion: 'e2.9-r10-source-only-manifest-1.0.0',
    protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
    parentProtocolVersion: source.protocolVersion,
    parentRawSha256,
    generationBoundary: { expectedAnswersAvailable: false, router: 'BYPASSED', repair: 'DISABLED' },
    screeningCases: source.screeningCases,
  }
}

function inputFor(fixture) {
  return {
    sourceType: fixture.sourceType,
    sourceTitle: fixture.sourceTitle,
    content: fixture.content,
    referenceTime: fixture.referenceTime,
    timezone: fixture.timezone,
  }
}

async function validateFrozenInputs() {
  const [{ raw: sourceRaw, value: source }, { raw: publicRaw, value: manifest }, { raw: bundleRaw, value: bundle }] = await Promise.all([
    readJson(SOURCE_PATH), readJson(PUBLIC_MANIFEST_PATH), readJson(BUNDLE_PATH),
  ])
  assertNoEvaluationKeys(source)
  if (source.protocolVersion !== 'e2-9-v4-pro-reduced-protocol-2.0.0' || source.screeningCases?.length !== 8) throw new Error('SOURCE_ONLY_MANIFEST_INVALID')
  const parentRawSha256 = sha256(sourceRaw)
  if (parentRawSha256 !== manifest.sourceOnlyParent.rawSha256) throw new Error('SOURCE_PARENT_HASH_DRIFT')
  const privateManifest = privateSourceManifest(source, parentRawSha256)
  if (sha256(canonicalJson(privateManifest)) !== manifest.sourceOnlyParent.r10PrivateCanonicalSha256) throw new Error('PRIVATE_SOURCE_HASH_DRIFT')
  if (manifest.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION || manifest.runLabel !== E2_R10_SCREENING_RUN_LABEL
    || manifest.caseCount !== 8 || manifest.observationCount !== 16 || manifest.cases?.length !== 8 || manifest.observations?.length !== 16) throw new Error('PUBLIC_CASE_MANIFEST_INVALID')
  const sourceById = new Map(source.screeningCases.map((fixture) => [fixture.caseId, fixture]))
  const publicById = new Map(manifest.cases.map((fixture) => [fixture.caseId, fixture]))
  if (sourceById.size !== 8 || publicById.size !== 8) throw new Error('CASE_ID_DUPLICATE')
  for (const [caseId, publicCase] of publicById) {
    const fixture = sourceById.get(caseId)
    if (!fixture || fixture.sourceSet !== publicCase.sourceSet || fixture.semanticRole !== publicCase.semanticRole
      || fixture.sourceType !== publicCase.sourceType || fixture.sourceSha256 !== publicCase.sourceSha256
      || fixture.inputSha256 !== publicCase.inputSha256 || sha256(fixture.content) !== fixture.sourceSha256
      || sha256(canonicalJson(inputFor(fixture))) !== fixture.inputSha256) throw new Error(`CASE_BINDING_INVALID:${caseId}`)
  }
  const pairs = new Map()
  const ids = new Set()
  for (const [index, observation] of manifest.observations.entries()) {
    if (observation.observationIndex !== index + 1
      || observation.observationId !== `e29r10-screening-${String(index + 1).padStart(2, '0')}-${observation.arm.toLowerCase()}`
      || !sourceById.has(observation.caseId) || !['A', 'B'].includes(observation.arm) || ids.has(observation.observationId)) throw new Error('OBSERVATION_ORDER_INVALID')
    ids.add(observation.observationId)
    const arms = pairs.get(observation.caseId) ?? new Set()
    arms.add(observation.arm)
    pairs.set(observation.caseId, arms)
  }
  if (pairs.size !== 8 || [...pairs.values()].some((arms) => arms.size !== 2)) throw new Error('PAIRED_OBSERVATIONS_INVALID')
  if (bundle.schemaVersion !== 'e2.9-r10-screening-protocol-bundle-1.0.0'
    || bundle.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION || bundle.status !== 'FROZEN_BEFORE_MODEL_CALLS') throw new Error('PROTOCOL_BUNDLE_INVALID')
  for (const item of bundle.files) {
    const file = path.join(ROOT, item.path)
    if (sha256(await readFile(file)) !== item.sha256) throw new Error(`PROTOCOL_FILE_HASH_DRIFT:${item.path}`)
  }
  if (bundle.bindings.caseManifestRawSha256 !== sha256(publicRaw)
    || bundle.bindings.sourceOnlyParentRawSha256 !== parentRawSha256
    || bundle.bindings.sourceOnlyPrivateCanonicalSha256 !== manifest.sourceOnlyParent.r10PrivateCanonicalSha256) throw new Error('PROTOCOL_SOURCE_BINDING_INVALID')
  return {
    source,
    manifest,
    sourceById,
    publicManifestRawSha256: sha256(publicRaw),
    protocolBundleRawSha256: sha256(bundleRaw),
  }
}

function registration(frozen) {
  return {
    protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
    protocolBundleSha256: frozen.protocolBundleRawSha256,
    runLabel: E2_R10_SCREENING_RUN_LABEL,
    caseManifestSha256: frozen.publicManifestRawSha256,
    observations: frozen.manifest.observations.map((observation) => {
      const fixture = frozen.sourceById.get(observation.caseId)
      return {
        observationId: observation.observationId,
        observationIndex: observation.observationIndex,
        caseId: observation.caseId,
        arm: observation.arm,
        semanticRole: fixture.semanticRole,
        sourceSha256: fixture.sourceSha256,
        inputSha256: fixture.inputSha256,
      }
    }),
  }
}

async function requestJson(endpoint, token, suffix, { method = 'GET', body } = {}) {
  const response = await fetch(`${endpoint}/${suffix}`, {
    method,
    headers: {
      origin: endpoint,
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { status: response.status, headers: Object.fromEntries(response.headers), payload: await response.json().catch(() => ({ error: 'RESPONSE_JSON_INVALID' })) }
}

function assertContract(contract, frozen, endpoint, deploymentVersion) {
  if (contract.status !== 200 || contract.payload.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION
    || contract.payload.workerVersionId !== deploymentVersion
    || contract.payload.runLabel !== E2_R10_SCREENING_RUN_LABEL
    || contract.payload.model !== E2_R10_SCREENING_MODEL
    || contract.payload.observationCount !== 16 || contract.payload.modelCalls !== 0
    || contract.payload.previewOnly !== true || contract.payload.productionAuthorized !== false
    || contract.payload.selectionAuthorized !== false || contract.payload.blindAuthorized !== false
    || contract.payload.protocolBundleSha256 !== frozen.protocolBundleRawSha256
    || contract.payload.caseManifestSha256 !== frozen.publicManifestRawSha256
    || new URL(endpoint).hostname.startsWith(`${deploymentVersion.slice(0, 8)}-`) !== true) throw new Error('VERSIONED_PREVIEW_CONTRACT_INVALID')
}

function assertCompletePayload(payload, body) {
  const execution = payload?.execution
  if (payload?.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION || payload?.runLabel !== E2_R10_SCREENING_RUN_LABEL
    || payload?.observationId !== body.observationId || payload?.observationIndex !== body.observationIndex
    || payload?.caseId !== body.caseId || payload?.arm !== body.arm || payload?.semanticRole !== body.semanticRole
    || payload?.modelCalls !== 1 || payload?.protocolStatus !== 'complete' || !payload?.result || !execution) throw new Error('OBSERVATION_RESPONSE_INCOMPLETE')
  if (![execution.requestedModel, execution.returnedModel, execution.executionModel, execution.resultModelName, payload.result.modelName]
    .every((value) => value === E2_R10_SCREENING_MODEL)) throw new Error('MODEL_LINEAGE_DRIFT')
  if (execution.sourceSha256 !== body.sourceSha256 || execution.inputSha256 !== body.inputSha256
    || execution.attempts?.length !== 1 || execution.temperature !== 0 || execution.maxTokens !== 6_000
    || execution.thinking !== 'disabled' || execution.router !== 'BYPASSED' || execution.repair !== 'DISABLED'
    || execution.rawOutputSha256 !== sha256(payload.rawOutput)
    || execution.resultSha256 !== sha256(canonicalJson(payload.result))) throw new Error('OBSERVATION_PROVENANCE_INVALID')
  if (body.arm === 'A') {
    if (payload.ledger !== null || payload.planningTrace !== null || execution.promptVersion !== E2_R10_PATH_A_PROMPT_VERSION
      || execution.pipelineVersion !== E2_R10_PATH_A_PIPELINE_VERSION) throw new Error('PATH_A_DRIFT')
  } else if (!payload.ledger || !payload.planningTrace || payload.validation?.status !== 'NO_ISSUE'
    || execution.promptVersion !== E2_R10_FACT_EXTRACTION_PROMPT_VERSION
    || execution.pipelineVersion !== E2_R10_PATH_B_PIPELINE_VERSION) throw new Error('PATH_B_DRIFT')
}

async function writeCreateOnce(file, value) {
  try {
    await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'EEXIST') throw new Error(`REFUSING_TO_OVERWRITE:${file}`)
    throw error
  }
}

async function execute(frozen) {
  if (option('execute') !== 'true' || option('authorized-call-cap') !== '16') throw new Error('EXPLICIT_MAX_16_CALL_AUTHORIZATION_REQUIRED')
  const endpoint = option('endpoint')
  const deploymentVersion = option('deployment-version')
  const token = process.env.E2_R10_SCREENING_TOKEN ?? ''
  if (!endpoint || !deploymentVersion || token.length < 32) throw new Error('VERSIONED_ENDPOINT_DEPLOYMENT_AND_MEMORY_TOKEN_REQUIRED')
  if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) throw new Error('CLEAN_WORKTREE_REQUIRED_FOR_EXECUTION')
  if (!/^[a-f0-9-]{36}$/iu.test(deploymentVersion) || !new URL(endpoint).hostname.startsWith(`${deploymentVersion.slice(0, 8)}-`)) throw new Error('EXACT_VERSIONED_PREVIEW_REQUIRED')
  await mkdir(path.join(CACHE_DIR, 'observations'), { recursive: true })
  const contract = await requestJson(endpoint, token, 'contract')
  assertContract(contract, frozen, endpoint, deploymentVersion)
  const registrationBody = registration(frozen)
  const registered = await requestJson(endpoint, token, 'register', { method: 'POST', body: registrationBody })
  if (![200, 201].includes(registered.status)) throw new Error(`RUN_REGISTRATION_FAILED:${registered.status}:${registered.payload?.error ?? 'UNKNOWN'}`)
  await writeCreateOnce(path.join(CACHE_DIR, 'registration.json'), { request: registrationBody, response: registered })
  const observations = []
  let attemptedModelCalls = 0
  for (const observation of frozen.manifest.observations) {
    const fixture = frozen.sourceById.get(observation.caseId)
    const input = inputFor(fixture)
    const body = {
      protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
      protocolBundleSha256: frozen.protocolBundleRawSha256,
      runLabel: E2_R10_SCREENING_RUN_LABEL,
      observationId: observation.observationId,
      observationIndex: observation.observationIndex,
      caseId: observation.caseId,
      arm: observation.arm,
      semanticRole: fixture.semanticRole,
      ...input,
      sourceSha256: fixture.sourceSha256,
      inputSha256: fixture.inputSha256,
      caseManifestSha256: frozen.publicManifestRawSha256,
    }
    const response = await requestJson(endpoint, token, 'generate', { method: 'POST', body })
    attemptedModelCalls += response.payload?.modelCalls === 1 ? 1 : 0
    let status = 'complete'
    let error = null
    try {
      if (response.status !== 200) throw new Error(`HTTP_${response.status}:${response.payload?.error ?? 'UNKNOWN'}`)
      assertCompletePayload(response.payload, body)
    } catch (caught) {
      status = 'failed'
      error = caught instanceof Error ? caught.message : 'OBSERVATION_FAILED'
    }
    const record = { observationId: body.observationId, observationIndex: body.observationIndex, caseId: body.caseId, arm: body.arm, status, error, requestBinding: { sourceSha256: body.sourceSha256, inputSha256: body.inputSha256 }, response }
    await writeCreateOnce(path.join(CACHE_DIR, 'observations', `${body.observationId}.json`), record)
    observations.push(record)
    console.log(`[${body.observationIndex}/16] ${body.caseId} ${body.arm} ${status}`)
    if (status !== 'complete') break
  }
  const complete = observations.length === 16 && observations.every((item) => item.status === 'complete')
  const result = {
    schemaVersion: 'e2.9-r10-screening-generation-checkpoint-1.0.0',
    protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
    runLabel: E2_R10_SCREENING_RUN_LABEL,
    status: complete ? 'GENERATION_COMPLETE' : 'GENERATION_FAILED',
    protocolBundleSha256: frozen.protocolBundleRawSha256,
    caseManifestSha256: frozen.publicManifestRawSha256,
    deploymentVersion,
    endpoint,
    expectedObservations: 16,
    attemptedModelCalls,
    expectedAnswerReads: 0,
    observations,
    completedAt: new Date().toISOString(),
    nextStages: { scoring: complete, pathMaskedReview: false, selection: false, blind: false, production: false },
  }
  const checkpointPath = path.join(CACHE_DIR, 'generation-checkpoint.json')
  await writeCreateOnce(checkpointPath, result)
  console.log(JSON.stringify({ status: result.status, attemptedModelCalls, checkpointPath, checkpointSha256: sha256(await readFile(checkpointPath)) }, null, 2))
  if (!complete) process.exitCode = 2
}

async function main() {
  const frozen = await validateFrozenInputs()
  const phase = option('phase', 'preflight')
  if (phase === 'preflight') {
    console.log(JSON.stringify({
      status: 'ZERO_MODEL_PREFLIGHT_PASS',
      protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
      runLabel: E2_R10_SCREENING_RUN_LABEL,
      caseManifestSha256: frozen.publicManifestRawSha256,
      protocolBundleSha256: frozen.protocolBundleRawSha256,
      cases: 8,
      observations: 16,
      modelCalls: 0,
      expectedAnswerReads: 0,
    }, null, 2))
    return
  }
  if (phase !== 'screening') throw new Error('ONLY_PREFLIGHT_OR_SCREENING_ALLOWED')
  await execute(frozen)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
