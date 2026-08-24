import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

import {
  E2_R10_CONTRACT_SCHEMA_VERSION,
  E2_R10_DEPLOYMENT_EVIDENCE_SCHEMA_VERSION,
  E2_R10_ENDPOINT_PREFIX,
  E2_R10_PROTOCOL_VERSION,
  E2_R10_QUALIFICATION_VERSION,
  E2_R10_REGISTRATION_SCHEMA_VERSION,
  E2_R10_REQUIRED_CHECK_NAMES,
  E2_R10_REQUIRED_COMPONENT_VERSIONS,
  E2_R10_RESULT_SCHEMA_VERSION,
  runE2R10Qualification,
  sha256Canonical,
  validateDeploymentEvidence,
  validateQualificationResult,
} from './e2-r10-qualification-contract.mjs'
import ledgerWorker, { E2R10QualificationLedger } from './e2-r10-qualification-ledger.mjs'
import qualificationWorker from './e2-r10-qualification-worker.mjs'
import { buildR10QualificationDeploymentArtifacts } from '../scripts/e2-9-r10-protocol.mjs'

const TOKEN = 'test-only-r10-qualification-token-material-000000000000000000'
const TOKEN_SHA256 = createHash('sha256').update(TOKEN, 'utf8').digest('hex')
const LEDGER_CALLER_TOKEN = 'test-only-r10-ledger-caller-token-material-000000000000000000'
const LEDGER_CALLER_TOKEN_SHA256 = createHash('sha256').update(LEDGER_CALLER_TOKEN, 'utf8').digest('hex')
const BUNDLE_SHA256 = 'a'.repeat(64)
const DEFAULT_RESULT_SHA256 = 'b'.repeat(64)
const QUALIFICATION_BYTES_SHA256 = 'c'.repeat(64)
const QUALIFICATION_CONFIG_SHA256 = 'd'.repeat(64)
const LEDGER_BYTES_SHA256 = 'e'.repeat(64)
const LEDGER_CONFIG_SHA256 = 'f'.repeat(64)
const WORKER_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_WORKER_VERSION_ID = '33333333-3333-4333-8333-333333333333'
const LEDGER_VERSION_ID = '22222222-2222-4222-8222-222222222222'
const WORKER_UPLOADED_AT = '2026-08-24T00:00:00.000Z'
const BASE_ORIGIN = 'https://sa-e2-r10-facts-first-qual-preview.nightsdell.workers.dev'
const VERSIONED_ORIGIN = 'https://11111111-sa-e2-r10-facts-first-qual-preview.nightsdell.workers.dev'

class TransactionalMemoryStorage {
  constructor({ transactionDelayMs = 0 } = {}) {
    this.values = new Map()
    this.queue = Promise.resolve()
    this.putCount = 0
    this.transactionDelayMs = transactionDelayMs
  }

  async get(key) {
    return structuredClone(this.values.get(key))
  }

  async transaction(callback) {
    const previous = this.queue
    let release
    this.queue = new Promise((resolve) => { release = resolve })
    await previous
    try {
      if (this.transactionDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.transactionDelayMs))
      return await callback({
        get: async (key) => structuredClone(this.values.get(key)),
        put: async (key, value) => {
          this.putCount += 1
          this.values.set(key, structuredClone(value))
        },
      })
    } finally {
      release()
    }
  }
}

function deploymentEvidence() {
  return {
    schemaVersion: E2_R10_DEPLOYMENT_EVIDENCE_SCHEMA_VERSION,
    qualificationWorkerVersionId: WORKER_VERSION_ID,
    qualificationWorkerUploadedAt: WORKER_UPLOADED_AT,
    qualificationWorkerVersionedOrigin: VERSIONED_ORIGIN,
    qualificationWorkerBytesSha256: QUALIFICATION_BYTES_SHA256,
    qualificationWorkerConfigSha256: QUALIFICATION_CONFIG_SHA256,
    ledgerWorkerVersionId: LEDGER_VERSION_ID,
    ledgerWorkerBytesSha256: LEDGER_BYTES_SHA256,
    ledgerWorkerConfigSha256: LEDGER_CONFIG_SHA256,
  }
}

function createLedgerService({ transactionDelayMs = 0 } = {}) {
  const instances = new Map()
  let calls = 0
  const namespace = {
    idFromName(name) { return name },
    get(id) {
      if (!instances.has(id)) {
        const storage = new TransactionalMemoryStorage({ transactionDelayMs })
        instances.set(id, { storage, object: new E2R10QualificationLedger({ storage }) })
      }
      return { fetch: (request) => instances.get(id).object.fetch(request) }
    },
  }
  const ledgerEnv = {
    E2_R10_LEDGER_CALLER_TOKEN_SHA256: LEDGER_CALLER_TOKEN_SHA256,
    E2_R10_LEDGER_WORKER_BYTES_SHA256: LEDGER_BYTES_SHA256,
    E2_R10_LEDGER_WORKER_CONFIG_SHA256: LEDGER_CONFIG_SHA256,
    E2_R10_QUALIFICATION_LEDGER: namespace,
    CF_VERSION_METADATA: { id: LEDGER_VERSION_ID, timestamp: '2026-08-24T00:00:00.000Z' },
  }
  return {
    instances,
    get calls() { return calls },
    async fetch(request, init) {
      calls += 1
      assert.equal(request instanceof Request, true)
      assert.equal(init, undefined)
      return ledgerWorker.fetch(request, ledgerEnv)
    },
  }
}

function environment({ ledger = createLedgerService(), resultSha256 = DEFAULT_RESULT_SHA256 } = {}) {
  return {
    E2_R10_QUALIFICATION_ENABLED: 'true',
    E2_R10_VERSIONED_PREVIEW_ONLY: 'true',
    E2_R10_QUALIFICATION_PREVIEW_ORIGIN: BASE_ORIGIN,
    E2_R10_QUALIFICATION_TOKEN_SHA256: TOKEN_SHA256,
    E2_R10_LEDGER_CALLER_TOKEN: LEDGER_CALLER_TOKEN,
    E2_R10_PROTOCOL_BUNDLE_SHA256: BUNDLE_SHA256,
    E2_R10_QUALIFICATION_RESULT_SHA256: resultSha256,
    E2_R10_QUALIFICATION_WORKER_BYTES_SHA256: QUALIFICATION_BYTES_SHA256,
    E2_R10_QUALIFICATION_WORKER_CONFIG_SHA256: QUALIFICATION_CONFIG_SHA256,
    E2_R10_LEDGER_WORKER_VERSION_ID: LEDGER_VERSION_ID,
    E2_R10_LEDGER_WORKER_BYTES_SHA256: LEDGER_BYTES_SHA256,
    E2_R10_LEDGER_WORKER_CONFIG_SHA256: LEDGER_CONFIG_SHA256,
    E2_R10_QUALIFICATION_LEDGER: ledger,
    CF_VERSION_METADATA: { id: WORKER_VERSION_ID, timestamp: WORKER_UPLOADED_AT },
  }
}

function endpoint(suffix, {
  method = 'GET',
  body,
  token = TOKEN,
  requestOrigin = VERSIONED_ORIGIN,
  headerOrigin = VERSIONED_ORIGIN,
} = {}) {
  return new Request(`${requestOrigin}${E2_R10_ENDPOINT_PREFIX}${suffix}`, {
    method,
    headers: {
      origin: headerOrigin,
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

function nextStagesAuthorized() {
  return {
    readiness: false,
    smoke: false,
    screening: false,
    selection: false,
    blind: false,
    production: false,
  }
}

function qualificationChecks(pass = true) {
  const checks = Object.fromEntries(E2_R10_REQUIRED_CHECK_NAMES.map((name) => [name, true]))
  if (!pass) checks.factLedgerValidated = false
  return checks
}

function qualificationResult({ runLabel, pass = true } = {}) {
  const checks = qualificationChecks(pass)
  return {
    schemaVersion: E2_R10_RESULT_SCHEMA_VERSION,
    protocolVersion: E2_R10_PROTOCOL_VERSION,
    runLabel,
    status: pass ? 'LOCAL_QUALIFIED_PREVIEW_UPLOAD_REQUESTABLE' : 'LOCAL_QUALIFICATION_FAILED_PREVIEW_LOCKED',
    sourceCommit: '1'.repeat(40),
    sourceTree: '2'.repeat(40),
    sourceManifestSha256: '3'.repeat(64),
    productionIsolationManifestSha256: '4'.repeat(64),
    protocolBundleSha256: BUNDLE_SHA256,
    componentVersions: { ...E2_R10_REQUIRED_COMPONENT_VERSIONS },
    checks,
    accessCounters: { modelCalls: 0, upstreamNetworkCalls: 0, expectedAnswerReads: 0 },
    modelCalls: 0,
    upstreamNetworkCalls: 0,
    expectedAnswersLoaded: false,
    nextStages: nextStagesAuthorized(),
  }
}

async function registration({ runLabel, pass = true, workerVersionId = WORKER_VERSION_ID } = {}) {
  const result = qualificationResult({ runLabel, pass })
  const deployment = { ...deploymentEvidence(), qualificationWorkerVersionId: workerVersionId }
  if (workerVersionId !== WORKER_VERSION_ID) {
    deployment.qualificationWorkerVersionedOrigin = `https://${workerVersionId.slice(0, 8)}-${new URL(BASE_ORIGIN).host}`
  }
  return {
    schemaVersion: E2_R10_REGISTRATION_SCHEMA_VERSION,
    runLabel,
    protocolVersion: E2_R10_PROTOCOL_VERSION,
    qualificationVersion: E2_R10_QUALIFICATION_VERSION,
    expectedWorkerVersionId: workerVersionId,
    protocolBundleSha256: BUNDLE_SHA256,
    qualificationResultSha256: await sha256Canonical(result),
    qualificationResult: result,
    deploymentEvidenceSha256: await sha256Canonical(deployment),
    deploymentEvidence: deployment,
  }
}

test('R10 qualification result freezes the exact component and check sets', () => {
  const result = qualificationResult({ runLabel: 'e29r10-exact-fields' })
  assert.equal(validateQualificationResult(result), true)
  assert.equal(validateQualificationResult({
    ...result,
    checks: { ...result.checks, inventedCheck: true },
  }), false)
  const missingCheck = structuredClone(result)
  delete missingCheck.checks.factLedgerValidated
  assert.equal(validateQualificationResult(missingCheck), false)
  assert.equal(validateQualificationResult({
    ...result,
    componentVersions: { ...result.componentVersions, planner: 'drifted' },
  }), false)
})

test('R10 failure result is a valid immutable record candidate', () => {
  const result = qualificationResult({ runLabel: 'e29r10-valid-failure', pass: false })
  assert.equal(result.status, 'LOCAL_QUALIFICATION_FAILED_PREVIEW_LOCKED')
  assert.equal(validateQualificationResult(result), true)
})

test('R10 instrumentation counters must match top-level evidence', () => {
  const result = qualificationResult({ runLabel: 'e29r10-counter-binding' })
  assert.equal(validateQualificationResult({
    ...result,
    accessCounters: { ...result.accessCounters, upstreamNetworkCalls: 1 },
  }), false)
  const observedFailure = {
    ...result,
    status: 'LOCAL_QUALIFICATION_FAILED_PREVIEW_LOCKED',
    expectedAnswersLoaded: true,
    accessCounters: { ...result.accessCounters, expectedAnswerReads: 1 },
  }
  assert.equal(validateQualificationResult(observedFailure), true)
})

test('R10 deployment evidence binds version IDs, uploaded timestamp, bytes and config hashes', () => {
  assert.equal(validateDeploymentEvidence(deploymentEvidence()), true)
  assert.equal(validateDeploymentEvidence({
    ...deploymentEvidence(), qualificationWorkerBytesSha256: '0'.repeat(64),
  }), false)
  assert.equal(validateDeploymentEvidence({
    ...deploymentEvidence(), qualificationWorkerVersionedOrigin: BASE_ORIGIN,
  }), false)
})

test('R10 qualification feature flag and authentication fail closed without ledger access', async () => {
  const ledger = createLedgerService()
  const disabled = environment({ ledger })
  disabled.E2_R10_QUALIFICATION_ENABLED = 'false'
  assert.equal((await runE2R10Qualification(endpoint('contract'), disabled)).status, 404)
  const wrong = await runE2R10Qualification(endpoint('contract', { token: `${TOKEN}-wrong` }), environment({ ledger }))
  assert.equal(wrong.status, 401)
  assert.equal(ledger.calls, 0)
})

test('R10 qualification enforces the exact versioned origin and complete deployment bindings', async () => {
  const env = environment()
  assert.equal((await runE2R10Qualification(endpoint('contract', {
    requestOrigin: BASE_ORIGIN, headerOrigin: BASE_ORIGIN,
  }), env)).status, 404)
  assert.equal((await runE2R10Qualification(endpoint('contract', { headerOrigin: 'https://wrong.example' }), env)).status, 403)
  env.E2_R10_QUALIFICATION_WORKER_CONFIG_SHA256 = '0'.repeat(64)
  assert.equal((await runE2R10Qualification(endpoint('contract'), env)).status, 503)
})

test('R10 contract exposes exact protocol, deployment evidence and locked stages', async () => {
  const response = await runE2R10Qualification(endpoint('contract'), environment())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    schemaVersion: E2_R10_CONTRACT_SCHEMA_VERSION,
    protocolVersion: E2_R10_PROTOCOL_VERSION,
    qualificationVersion: E2_R10_QUALIFICATION_VERSION,
    workerVersionId: WORKER_VERSION_ID,
    protocolBundleSha256: BUNDLE_SHA256,
    qualificationResultSha256: DEFAULT_RESULT_SHA256,
    deploymentEvidence: deploymentEvidence(),
    qualificationOnly: true,
    modelCalls: 0,
    nextStagesAuthorized: nextStagesAuthorized(),
  })
})

test('R10 readiness through Production remain locked without model or ledger calls', async () => {
  const ledger = createLedgerService()
  const env = environment({ ledger })
  for (const stage of ['readiness', 'smoke', 'screening', 'selection', 'blind', 'production']) {
    const response = await runE2R10Qualification(endpoint(stage, { method: 'POST', body: {} }), env)
    assert.equal(response.status, 412)
    assert.equal((await response.json()).modelCalls, 0)
  }
  assert.equal(ledger.calls, 0)
})

test('R10 ledger caller boundary rejects missing or wrong internal credentials', async () => {
  const ledger = createLedgerService()
  const missingFrontSecret = environment({ ledger })
  delete missingFrontSecret.E2_R10_LEDGER_CALLER_TOKEN
  assert.equal((await runE2R10Qualification(endpoint('state?runLabel=e29r10-caller'), missingFrontSecret)).status, 503)

  const direct = await ledger.fetch(new Request('https://ledger.internal/state', {
    method: 'GET',
    headers: {
      authorization: 'Bearer wrong-ledger-token-material-000000000000000000',
      'x-e2-r10-run-label': 'e29r10-caller',
    },
  }))
  assert.equal(direct.status, 401)
})

test('R10 success record and state bind the current Worker and ledger versions', async () => {
  const runLabel = 'e29r10-success-record'
  const payload = await registration({ runLabel })
  const ledger = createLedgerService()
  const env = environment({ ledger, resultSha256: payload.qualificationResultSha256 })
  const recorded = await qualificationWorker.fetch(endpoint('record', { method: 'POST', body: payload }), env)
  assert.equal(recorded.status, 201)
  const record = await recorded.json()
  assert.equal(record.ledgerState, 'R10_QUALIFICATION_RECORDED_MODEL_PHASES_LOCKED')
  assert.equal(record.deploymentEvidence.ledgerWorkerVersionId, LEDGER_VERSION_ID)
  const state = await qualificationWorker.fetch(endpoint(`state?runLabel=${runLabel}`), env)
  assert.equal(state.status, 200)
  assert.deepEqual(await state.json(), record)
})

test('R10 failed qualification records end-to-end and cannot be replaced by success', async () => {
  const runLabel = 'e29r10-failure-record'
  const failure = await registration({ runLabel, pass: false })
  const ledger = createLedgerService()
  const failureEnv = environment({ ledger, resultSha256: failure.qualificationResultSha256 })
  const first = await qualificationWorker.fetch(endpoint('record', { method: 'POST', body: failure }), failureEnv)
  assert.equal(first.status, 201)
  assert.equal((await first.json()).ledgerState, 'R10_QUALIFICATION_FAILURE_RECORDED_MODEL_PHASES_LOCKED')

  const success = await registration({ runLabel })
  const successEnv = environment({ ledger, resultSha256: success.qualificationResultSha256 })
  const overwrite = await qualificationWorker.fetch(endpoint('record', { method: 'POST', body: success }), successEnv)
  assert.equal(overwrite.status, 409)
  assert.deepEqual(await overwrite.json(), { error: 'QUALIFICATION_IMMUTABLE', modelCalls: 0 })
})

test('R10 identical concurrent records are atomic and idempotent', async () => {
  const runLabel = 'e29r10-concurrent-idempotent'
  const payload = await registration({ runLabel })
  const ledger = createLedgerService({ transactionDelayMs: 5 })
  const env = environment({ ledger, resultSha256: payload.qualificationResultSha256 })
  const [left, right] = await Promise.all([
    qualificationWorker.fetch(endpoint('record', { method: 'POST', body: payload }), env),
    qualificationWorker.fetch(endpoint('record', { method: 'POST', body: payload }), env),
  ])
  assert.deepEqual([left.status, right.status].sort(), [200, 201])
  const replay = left.status === 200 ? left : right
  assert.equal(replay.headers.get('x-idempotent-replay'), 'true')
  assert.equal(ledger.instances.get(runLabel).storage.putCount, 1)
})

test('R10 deployment drift and extra fields are rejected before ledger mutation', async () => {
  const runLabel = 'e29r10-binding-rejection'
  const base = await registration({ runLabel })
  for (const payload of [
    { ...base, unexpected: true },
    { ...base, qualificationResult: { ...base.qualificationResult, unexpected: true } },
    { ...base, deploymentEvidence: { ...base.deploymentEvidence, ledgerWorkerConfigSha256: '9'.repeat(64) } },
  ]) {
    const ledger = createLedgerService()
    const env = environment({ ledger, resultSha256: base.qualificationResultSha256 })
    const response = await runE2R10Qualification(endpoint('record', { method: 'POST', body: payload }), env)
    assert.ok([400, 412].includes(response.status))
    assert.equal(ledger.calls, 0)
  }
  const stale = await registration({ runLabel, workerVersionId: OTHER_WORKER_VERSION_ID })
  assert.equal((await runE2R10Qualification(endpoint('record', { method: 'POST', body: stale }), environment({
    resultSha256: stale.qualificationResultSha256,
  }))).status, 412)
})

test('R10 dedicated qualification Worker exposes no unrelated route', async () => {
  const response = await qualificationWorker.fetch(new Request(`${VERSIONED_ORIGIN}/api/deepseek`, {
    method: 'POST', headers: { origin: VERSIONED_ORIGIN, authorization: `Bearer ${TOKEN}` },
  }), environment())
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: 'NOT_FOUND', modelCalls: 0 })
})

test('R10 qualification Worker module graph contains no model/provider module', async () => {
  const root = path.resolve(import.meta.dirname)
  const pending = [path.join(root, 'e2-r10-qualification-worker.mjs')]
  const visited = new Set()
  const importedModules = []
  while (pending.length > 0) {
    const current = pending.pop()
    if (visited.has(current)) continue
    visited.add(current)
    const source = await readFile(current, 'utf8')
    for (const match of source.matchAll(/\b(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/gu)) {
      const specifier = match[1]
      importedModules.push(specifier)
      if (specifier.startsWith('.')) pending.push(path.resolve(path.dirname(current), specifier))
    }
  }
  assert.deepEqual([...visited].map((file) => path.basename(file)).sort(), [
    'e2-r10-qualification-contract.mjs',
    'e2-r10-qualification-worker.mjs',
  ])
  assert.equal(importedModules.some((specifier) => /(?:deepseek|model|provider|recognition)/iu.test(specifier)), false)
})

test('R10 Wrangler configs keep the audit ledger private and runtime hashes fail-closed or exactly frozen', async () => {
  const preview = JSON.parse(await readFile(new URL('../wrangler.e2-r10-qualification-preview.jsonc', import.meta.url), 'utf8'))
  const ledger = JSON.parse(await readFile(new URL('../wrangler.e2-r10-qualification-ledger.jsonc', import.meta.url), 'utf8'))
  assert.equal(preview.name, 'sa-e2-r10-facts-first-qual-preview')
  assert.equal(preview.name.length <= 54, true)
  assert.equal(new URL(preview.vars.E2_R10_QUALIFICATION_PREVIEW_ORIGIN).hostname.startsWith(`${preview.name}.`), true)
  assert.equal(ledger.name, 'student-affairs-e2-r10-facts-first-qualification-ledger-preview')
  assert.deepEqual(preview.routes, [])
  assert.deepEqual(ledger.routes, [])
  assert.equal(preview.workers_dev, true)
  assert.equal(preview.preview_urls, true)
  assert.equal(ledger.workers_dev, false)
  assert.equal(ledger.preview_urls, false)
  assert.equal(Object.hasOwn(preview.vars, 'E2_R10_QUALIFICATION_TOKEN_SHA256'), false)
  assert.equal(Object.hasOwn(preview.vars, 'E2_R10_LEDGER_CALLER_TOKEN'), false)
  assert.equal(Object.hasOwn(ledger.vars, 'E2_R10_LEDGER_CALLER_TOKEN_SHA256'), false)
  const runtimeHashKeys = [
    'E2_R10_PROTOCOL_BUNDLE_SHA256',
    'E2_R10_QUALIFICATION_RESULT_SHA256',
    'E2_R10_QUALIFICATION_WORKER_BYTES_SHA256',
    'E2_R10_QUALIFICATION_WORKER_CONFIG_SHA256',
    'E2_R10_LEDGER_WORKER_BYTES_SHA256',
    'E2_R10_LEDGER_WORKER_CONFIG_SHA256',
  ]
  const zeroHash = '0'.repeat(64)
  const previewHashes = runtimeHashKeys.map((key) => preview.vars[key])
  const allHashesUnbound = previewHashes.every((value) => value === zeroHash)
  const allHashesBound = previewHashes.every((value) => /^[0-9a-f]{64}$/u.test(value) && value !== zeroHash)
  assert.equal(allHashesUnbound || allHashesBound, true)

  if (allHashesUnbound) {
    assert.equal(ledger.vars.E2_R10_LEDGER_WORKER_BYTES_SHA256, zeroHash)
    assert.equal(ledger.vars.E2_R10_LEDGER_WORKER_CONFIG_SHA256, zeroHash)
  } else {
    const qualificationResult = JSON.parse(await readFile(
      new URL('../docs/e2-v4-pro-benchmark-r10/qualification-result-e.json', import.meta.url), 'utf8',
    ))
    const qualificationEvidence = JSON.parse(await readFile(
      new URL('../docs/e2-v4-pro-benchmark-r10/qualification-evidence-e.json', import.meta.url), 'utf8',
    ))
    const deploymentArtifacts = await buildR10QualificationDeploymentArtifacts(path.resolve(import.meta.dirname, '..'))
    assert.deepEqual(qualificationEvidence.deploymentArtifacts, deploymentArtifacts)
    assert.equal(preview.vars.E2_R10_PROTOCOL_BUNDLE_SHA256, qualificationResult.protocolBundleSha256)
    assert.equal(preview.vars.E2_R10_QUALIFICATION_RESULT_SHA256, qualificationEvidence.qualificationResultSha256)
    assert.equal(preview.vars.E2_R10_QUALIFICATION_WORKER_BYTES_SHA256, deploymentArtifacts.qualificationWorkerBytesSha256)
    assert.equal(preview.vars.E2_R10_QUALIFICATION_WORKER_CONFIG_SHA256, deploymentArtifacts.qualificationWorkerConfigSha256)
    assert.equal(preview.vars.E2_R10_LEDGER_WORKER_BYTES_SHA256, deploymentArtifacts.ledgerWorkerBytesSha256)
    assert.equal(preview.vars.E2_R10_LEDGER_WORKER_CONFIG_SHA256, deploymentArtifacts.ledgerWorkerConfigSha256)
    assert.equal(ledger.vars.E2_R10_LEDGER_WORKER_BYTES_SHA256, deploymentArtifacts.ledgerWorkerBytesSha256)
    assert.equal(ledger.vars.E2_R10_LEDGER_WORKER_CONFIG_SHA256, deploymentArtifacts.ledgerWorkerConfigSha256)
  }

  const configNames = []
  for (const filename of await readdir(new URL('..', import.meta.url))) {
    if (!/^wrangler.*\.jsonc$/u.test(filename)) continue
    const raw = await readFile(new URL(`../${filename}`, import.meta.url), 'utf8')
    const match = raw.match(/"name"\s*:\s*"([^"]+)"/u)
    if (match) configNames.push(match[1])
  }
  assert.equal(configNames.filter((name) => name === preview.name).length, 1)
  assert.equal(configNames.filter((name) => name === ledger.name).length, 1)
})

test('R10 deployment uploads private Ledger code before Secret rotation and verifies the active version', async () => {
  const source = await readFile(new URL('../scripts/deploy-e2-9-r10-qualification-preview.ps1', import.meta.url), 'utf8')
  const codeDeploy = source.indexOf('$ledgerDeployOutput = npx wrangler deploy --config $ledgerConfig')
  const secretRotation = source.indexOf('wrangler secret put E2_R10_LEDGER_CALLER_TOKEN_SHA256')
  const versionRead = source.indexOf('$ledgerVersionId = Get-LatestR10Version $ledgerConfig')
  const activeVersionCheck = source.indexOf('R10_LEDGER_ACTIVE_VERSION_MISMATCH')
  assert.equal(codeDeploy >= 0, true)
  assert.equal(codeDeploy < secretRotation, true)
  assert.equal(secretRotation < versionRead, true)
  assert.equal(versionRead < activeVersionCheck, true)
  assert.match(source, /wrangler deployments status --config \$ledgerConfig --json/u)
  assert.match(source, /\.percentage -eq 100/u)
})
