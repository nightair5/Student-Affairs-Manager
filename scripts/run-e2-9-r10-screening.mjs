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
  E2_R10_SCREENING_OBSERVATION_PLAN,
  E2_R10_SCREENING_PROTOCOL_VERSION,
  E2_R10_SCREENING_RUN_LABEL,
  canonicalJson,
  exactVersionedPreviewOrigin,
} from '../cloudflare/e2-r10-screening-contract.mjs'

const ROOT = process.cwd()
const PROTOCOL_DIR = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r10', 'screening-protocol-1.1.0')
const SOURCE_PATH = path.join(PROTOCOL_DIR, 'source-input-manifest.json')
const PUBLIC_MANIFEST_PATH = path.join(PROTOCOL_DIR, 'case-manifest.json')
const BUNDLE_PATH = path.join(PROTOCOL_DIR, 'protocol-bundle.json')
const READINESS_REVIEW_PATH = path.join(PROTOCOL_DIR, 'independent-readiness-review.json')
const CACHE_DIR = path.join(ROOT, '.evaluation-cache', 'e2-9-r10', 'screening-protocol-1.1.0', E2_R10_SCREENING_RUN_LABEL)
const DEPLOYMENT_EVIDENCE_PATH = path.join(CACHE_DIR, 'deployment-evidence.json')
const FORBIDDEN_KEYS = /^(?:expected|answer|answers|gold|golden|target|targets|label|labels|score|scores|forbidden|semanticRole|sourceSet)$/iu

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalText(value) {
  return Buffer.from(value).toString('utf8').replace(/\r\n?/gu, '\n')
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
  if (source.schemaVersion !== 'e2.9-r10-source-input-manifest-1.1.0'
    || source.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION
    || source.runLabel !== E2_R10_SCREENING_RUN_LABEL
    || source.status !== 'FROZEN_LABEL_FREE_INPUTS' || source.cases?.length !== 8) throw new Error('SOURCE_INPUT_MANIFEST_INVALID')
  if (manifest.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION || manifest.runLabel !== E2_R10_SCREENING_RUN_LABEL
    || manifest.sourceInputManifestCanonicalTextSha256 !== sha256(canonicalText(sourceRaw))
    || manifest.generationBoundary?.semanticRoleLabelsAvailable !== false
    || manifest.caseCount !== 8 || manifest.observationCount !== 16 || manifest.cases?.length !== 8 || manifest.observations?.length !== 16) throw new Error('PUBLIC_CASE_MANIFEST_INVALID')
  const sourceById = new Map(source.cases.map((fixture) => [fixture.caseId, fixture]))
  const publicById = new Map(manifest.cases.map((fixture) => [fixture.caseId, fixture]))
  if (sourceById.size !== 8 || publicById.size !== 8) throw new Error('CASE_ID_DUPLICATE')
  if (source.cases.some((fixture) => Object.keys(fixture).sort().join(',')
    !== 'caseId,content,inputSha256,referenceTime,sourceSha256,sourceTitle,sourceType,timezone')) {
    throw new Error('SOURCE_INPUT_FIELDS_INVALID')
  }
  for (const [caseId, publicCase] of publicById) {
    const fixture = sourceById.get(caseId)
    if (Object.keys(publicCase).sort().join(',') !== 'caseId,inputSha256,sourceSha256,sourceType'
      || !fixture || fixture.sourceType !== publicCase.sourceType || fixture.sourceSha256 !== publicCase.sourceSha256
      || fixture.inputSha256 !== publicCase.inputSha256 || sha256(fixture.content) !== fixture.sourceSha256
      || sha256(canonicalJson(inputFor(fixture))) !== fixture.inputSha256) throw new Error(`CASE_BINDING_INVALID:${caseId}`)
  }
  const pairs = new Map()
  const ids = new Set()
  for (const [index, observation] of manifest.observations.entries()) {
    const frozenObservation = E2_R10_SCREENING_OBSERVATION_PLAN[index]
    if (observation.observationIndex !== index + 1
      || observation.observationId !== `e29r10-screening-${String(index + 1).padStart(2, '0')}-${observation.arm.toLowerCase()}`
      || canonicalJson({ ...observation, sourceSha256: sourceById.get(observation.caseId)?.sourceSha256, inputSha256: sourceById.get(observation.caseId)?.inputSha256 })
        !== canonicalJson(frozenObservation)
      || !sourceById.has(observation.caseId) || !['A', 'B'].includes(observation.arm) || ids.has(observation.observationId)) throw new Error('OBSERVATION_ORDER_INVALID')
    ids.add(observation.observationId)
    const arms = pairs.get(observation.caseId) ?? new Set()
    arms.add(observation.arm)
    pairs.set(observation.caseId, arms)
  }
  if (pairs.size !== 8 || [...pairs.values()].some((arms) => arms.size !== 2)) throw new Error('PAIRED_OBSERVATIONS_INVALID')
  if (bundle.schemaVersion !== 'e2.9-r10-screening-protocol-bundle-1.1.0'
    || bundle.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION || bundle.status !== 'FROZEN_BEFORE_MODEL_CALLS') throw new Error('PROTOCOL_BUNDLE_INVALID')
  for (const item of bundle.files) {
    const file = path.join(ROOT, item.path)
    if (sha256(canonicalText(await readFile(file))) !== item.canonicalTextSha256) throw new Error(`PROTOCOL_FILE_HASH_DRIFT:${item.path}`)
  }
  if (bundle.bindings.caseManifestCanonicalTextSha256 !== sha256(canonicalText(publicRaw))
    || bundle.bindings.sourceInputManifestCanonicalTextSha256 !== sha256(canonicalText(sourceRaw))
    || bundle.bindings.sourceOnlyParentRawSha256 !== source.sourceOnlyParentRawSha256) throw new Error('PROTOCOL_SOURCE_BINDING_INVALID')
  return {
    source,
    manifest,
    bundle,
    sourceById,
    sourceInputManifestCanonicalTextSha256: sha256(canonicalText(sourceRaw)),
    publicManifestCanonicalTextSha256: sha256(canonicalText(publicRaw)),
    protocolBundleCanonicalTextSha256: sha256(canonicalText(bundleRaw)),
  }
}

function registration(frozen) {
  return {
    protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
    protocolBundleSha256: frozen.protocolBundleCanonicalTextSha256,
    runLabel: E2_R10_SCREENING_RUN_LABEL,
    caseManifestSha256: frozen.publicManifestCanonicalTextSha256,
    observations: frozen.manifest.observations.map((observation) => {
      const fixture = frozen.sourceById.get(observation.caseId)
      return {
        observationId: observation.observationId,
        observationIndex: observation.observationIndex,
        caseId: observation.caseId,
        arm: observation.arm,
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
    || contract.payload.protocolBundleSha256 !== frozen.protocolBundleCanonicalTextSha256
    || contract.payload.caseManifestSha256 !== frozen.publicManifestCanonicalTextSha256
    || exactVersionedPreviewOrigin(endpoint, deploymentVersion) !== endpoint) throw new Error('VERSIONED_PREVIEW_CONTRACT_INVALID')
}

function assertCompletePayload(payload, body) {
  const execution = payload?.execution
  if (payload?.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION || payload?.runLabel !== E2_R10_SCREENING_RUN_LABEL
    || payload?.observationId !== body.observationId || payload?.observationIndex !== body.observationIndex
    || payload?.caseId !== body.caseId || payload?.arm !== body.arm
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

async function readDeploymentEvidence(frozen, endpoint, deploymentVersion) {
  const [{ raw, value }, { raw: reviewRaw, value: review }] = await Promise.all([
    readJson(DEPLOYMENT_EVIDENCE_PATH), readJson(READINESS_REVIEW_PATH),
  ])
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim()
  const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim()
  const reviewedCommit = typeof review.reviewedCommit === 'string' ? review.reviewedCommit : ''
  const allowedPostReviewPath = path.relative(ROOT, READINESS_REVIEW_PATH).replace(/\\/gu, '/')
  const postReviewChanges = /^[a-f0-9]{40}$/u.test(reviewedCommit)
    ? execFileSync('git', ['diff', '--name-only', `${reviewedCommit}..HEAD`], { encoding: 'utf8' }).trim().split(/\r?\n/u).filter(Boolean)
    : []
  if (value.schemaVersion !== 'e2.9-r10-screening-deployment-evidence-1.1.0'
    || value.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION
    || value.runLabel !== E2_R10_SCREENING_RUN_LABEL
    || value.status !== 'PREVIEW_DEPLOYED_MODEL_VERSION_ZERO_TRAFFIC'
    || value.sourceCommit !== sourceCommit || value.sourceTree !== sourceTree || value.branch !== branch
    || value.screeningWorkerVersionId !== deploymentVersion || value.versionedOrigin !== endpoint
    || value.protocolBundleSha256 !== frozen.protocolBundleCanonicalTextSha256
    || value.caseManifestSha256 !== frozen.publicManifestCanonicalTextSha256
    || value.readinessReviewSha256 !== sha256(reviewRaw)
    || review.status !== 'PASS' || review.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION
    || review.runLabel !== E2_R10_SCREENING_RUN_LABEL
    || review.protocolBundleSha256 !== frozen.protocolBundleCanonicalTextSha256
    || postReviewChanges.length !== 1 || postReviewChanges[0].replace(/\\/gu, '/') !== allowedPostReviewPath
    || value.screeningVersionStableTrafficPercent !== 0 || value.stableTrafficTotalPercent !== 100
    || value.ledgerActiveTrafficPercent !== 100 || value.contractReads !== 3
    || value.wrongOriginStatus !== 403 || value.wrongAuthStatus !== 401
    || value.selectionStatus !== 412 || value.blindStatus !== 412 || value.productionStatus !== 412
    || value.modelCallsBeforeRunner !== 0 || value.productionDeployed !== false
    || !/^[a-f0-9-]{36}$/iu.test(value.ledgerWorkerVersionId ?? '')) throw new Error('DEPLOYMENT_EVIDENCE_BINDING_FAILED')
  return { raw, value, sha256: sha256(raw), sourceCommit, sourceTree, branch }
}

function assertLedgerState(state, observations, registrationBody) {
  if (state.status !== 200 || state.payload?.runStatus !== 'GENERATION_COMPLETE'
    || state.payload?.protocolVersion !== E2_R10_SCREENING_PROTOCOL_VERSION
    || state.payload?.runLabel !== E2_R10_SCREENING_RUN_LABEL
    || canonicalJson(state.payload.registration) !== canonicalJson(registrationBody)) throw new Error('LEDGER_STATE_INCOMPLETE')
  const records = Object.values(state.payload.observations ?? {})
  if (records.length !== 16) throw new Error('LEDGER_OBSERVATION_SET_INVALID')
  for (const observation of observations) {
    const record = state.payload.observations?.[observation.observationId]
    const execution = observation.response.payload.execution
    if (!record || record.state !== 'final' || record.status !== 'complete'
      || record.observationIndex !== observation.observationIndex || record.caseId !== observation.caseId || record.arm !== observation.arm
      || record.sourceSha256 !== observation.requestBinding.sourceSha256 || record.inputSha256 !== observation.requestBinding.inputSha256
      || record.requestedModel !== execution.requestedModel || record.returnedModel !== execution.returnedModel
      || record.executionModel !== execution.executionModel || record.resultModelName !== execution.resultModelName
      || record.rawOutputSha256 !== execution.rawOutputSha256 || record.resultSha256 !== execution.resultSha256
      || record.workerVersionId !== execution.workerVersionId) throw new Error(`LEDGER_OBSERVATION_BINDING_FAILED:${observation.observationId}`)
  }
}

async function execute(frozen) {
  if (option('execute') !== 'true' || option('authorized-call-cap') !== '16') throw new Error('EXPLICIT_MAX_16_CALL_AUTHORIZATION_REQUIRED')
  const endpoint = option('endpoint')
  const deploymentVersion = option('deployment-version')
  if (!endpoint || !deploymentVersion) throw new Error('VERSIONED_ENDPOINT_AND_DEPLOYMENT_REQUIRED')
  exactVersionedPreviewOrigin(endpoint, deploymentVersion)
  const token = process.env.E2_R10_SCREENING_TOKEN ?? ''
  if (token.length < 32) throw new Error('MEMORY_TOKEN_REQUIRED')
  if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) throw new Error('CLEAN_WORKTREE_REQUIRED_FOR_EXECUTION')
  const deploymentEvidence = await readDeploymentEvidence(frozen, endpoint, deploymentVersion)
  await mkdir(path.join(CACHE_DIR, 'observations'), { recursive: true })
  const contract = await requestJson(endpoint, token, 'contract')
  assertContract(contract, frozen, endpoint, deploymentVersion)
  const contractEvidencePath = path.join(CACHE_DIR, 'contract-evidence.json')
  await writeCreateOnce(contractEvidencePath, { endpoint, deploymentVersion, response: contract })
  const registrationBody = registration(frozen)
  const registered = await requestJson(endpoint, token, 'register', { method: 'POST', body: registrationBody })
  if (registered.status !== 201) throw new Error(`FRESH_RUN_REGISTRATION_REQUIRED:${registered.status}:${registered.payload?.error ?? 'UNKNOWN'}`)
  const registrationPath = path.join(CACHE_DIR, 'registration.json')
  await writeCreateOnce(registrationPath, { request: registrationBody, response: registered })
  const observations = []
  let attemptedModelCalls = 0
  for (const observation of frozen.manifest.observations) {
    const fixture = frozen.sourceById.get(observation.caseId)
    const input = inputFor(fixture)
    const body = {
      protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
      protocolBundleSha256: frozen.protocolBundleCanonicalTextSha256,
      runLabel: E2_R10_SCREENING_RUN_LABEL,
      observationId: observation.observationId,
      observationIndex: observation.observationIndex,
      caseId: observation.caseId,
      arm: observation.arm,
      ...input,
      sourceSha256: fixture.sourceSha256,
      inputSha256: fixture.inputSha256,
      caseManifestSha256: frozen.publicManifestCanonicalTextSha256,
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
  const ledgerState = await requestJson(endpoint, token, 'state')
  if (complete) assertLedgerState(ledgerState, observations, registrationBody)
  const ledgerStatePath = path.join(CACHE_DIR, 'ledger-state.json')
  await writeCreateOnce(ledgerStatePath, ledgerState)
  const result = {
    schemaVersion: 'e2.9-r10-screening-generation-checkpoint-1.1.0',
    protocolVersion: E2_R10_SCREENING_PROTOCOL_VERSION,
    runLabel: E2_R10_SCREENING_RUN_LABEL,
    status: complete ? 'GENERATION_COMPLETE' : 'GENERATION_FAILED',
    protocolBundleSha256: frozen.protocolBundleCanonicalTextSha256,
    caseManifestSha256: frozen.publicManifestCanonicalTextSha256,
    deploymentVersion,
    endpoint,
    sourceCommit: deploymentEvidence.sourceCommit,
    sourceTree: deploymentEvidence.sourceTree,
    branch: deploymentEvidence.branch,
    deploymentEvidenceSha256: deploymentEvidence.sha256,
    contractEvidenceSha256: sha256(await readFile(contractEvidencePath)),
    registrationSha256: sha256(await readFile(registrationPath)),
    ledgerStateSha256: sha256(await readFile(ledgerStatePath)),
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
      caseManifestSha256: frozen.publicManifestCanonicalTextSha256,
      protocolBundleSha256: frozen.protocolBundleCanonicalTextSha256,
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
