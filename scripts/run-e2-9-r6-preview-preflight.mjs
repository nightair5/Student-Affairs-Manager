/* global console, process */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { assertFutureModelRunQualification, runBoundZeroModelHarnessQualification } from './e2-9-r6-harness-qualification.mjs'
import { canonicalJson, R6_PROTOCOL_VERSION } from './e2-9-r6-path-mask.mjs'

export const R6_PREVIEW_ORIGIN = 'https://student-affairs-e2-r6-qualification-preview.nightsdell.workers.dev'
export const R6_PREVIEW_ENDPOINT = `${R6_PREVIEW_ORIGIN}/api/experiments/e2-9/r6/harness`
export const R6_EXPECTED_PREVIEW_HARNESS_VERSION = 'e2-9-r6-preview-harness-1.4.0'
export const R6_PREVIEW_WORKER_NAME = 'student-affairs-e2-r6-qualification-preview'
export const R6_STABLE_ACTIVATION_RESPONSES = 3
export const R6_MAX_ACTIVATION_PROBES = 12
const ACTIVATION_FIELDS = new Set([
  'status', 'protocolVersion', 'harnessVersion', 'workerVersionId',
  'qualificationBundleSha256', 'qualificationResultSha256', 'modelCalls',
])

const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex')

function option(argv, name) {
  const prefix = `--${name}=`
  return argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? ''
}

function validWorkerVersionId(value) {
  return typeof value === 'string'
    && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(value)
}

function validSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value)
}

export function r6VersionedPreviewEndpoint(workerVersionId) {
  if (!validWorkerVersionId(workerVersionId)) throw new Error('R6_WORKER_VERSION_ID_INVALID')
  const origin = new URL(R6_PREVIEW_ORIGIN)
  return `${origin.protocol}//${workerVersionId.slice(0, 8)}-${origin.host}/api/experiments/e2-9/r6/harness`
}

export async function buildR6QualificationRegistration({ root = process.cwd(), runLabel, expectedWorkerVersionId }) {
  if (!/^[a-z0-9][a-z0-9._-]{2,100}$/u.test(runLabel ?? '')) throw new Error('R6_RUN_LABEL_INVALID')
  if (!validWorkerVersionId(expectedWorkerVersionId)) throw new Error('R6_WORKER_VERSION_ID_INVALID')
  const resultPath = path.join(root, 'docs', 'e2-v4-pro-benchmark-r6', 'qualification-result.json')
  const saved = JSON.parse(await readFile(resultPath, 'utf8'))
  const fresh = await runBoundZeroModelHarnessQualification({ root })
  if (canonicalJson(saved) !== canonicalJson(fresh)) throw new Error('R6_QUALIFICATION_RESULT_DRIFT')
  const qualificationResultSha256 = sha256(canonicalJson(saved))
  assertFutureModelRunQualification(saved, qualificationResultSha256, fresh.qualificationBundleSha256)
  return {
    runLabel,
    protocolVersion: R6_PROTOCOL_VERSION,
    expectedWorkerVersionId,
    qualificationBundleSha256: fresh.qualificationBundleSha256,
    qualificationResultSha256,
    qualificationResult: saved,
  }
}

export async function awaitR6StableActivation({
  token, expectedWorkerVersionId, endpoint = '', fetcher = fetch,
  sleeper = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
  requiredStableResponses = R6_STABLE_ACTIVATION_RESPONSES, maxProbes = R6_MAX_ACTIVATION_PROBES, probeDelayMs = 1000,
}) {
  if (typeof token !== 'string' || token.length < 32) throw new Error('E2_R6_BENCHMARK_TOKEN_REQUIRED_IN_PROCESS_MEMORY')
  if (!validWorkerVersionId(expectedWorkerVersionId)) throw new Error('R6_WORKER_VERSION_ID_INVALID')
  const resolvedEndpoint = endpoint || r6VersionedPreviewEndpoint(expectedWorkerVersionId)
  if (resolvedEndpoint !== r6VersionedPreviewEndpoint(expectedWorkerVersionId)) throw new Error('R6_VERSIONED_PREVIEW_ENDPOINT_REQUIRED')
  if (!Number.isInteger(requiredStableResponses) || requiredStableResponses < 2 || requiredStableResponses > 5
    || !Number.isInteger(maxProbes) || maxProbes < requiredStableResponses || maxProbes > 30
    || !Number.isInteger(probeDelayMs) || probeDelayMs < 0 || probeDelayMs > 5000) {
    throw new Error('R6_ACTIVATION_STABILITY_POLICY_INVALID')
  }
  let stableVersionId = ''
  let consecutive = 0
  const observations = []
  for (let probe = 1; probe <= maxProbes; probe += 1) {
    const response = await fetcher(`${resolvedEndpoint}/activation`, {
      method: 'GET',
      headers: {
        origin: new URL(resolvedEndpoint).origin,
        authorization: `Bearer ${token}`,
        'cache-control': 'no-cache',
      },
    })
    const payload = await response.json().catch(() => null)
    const valid = response.status === 200
      && payload && typeof payload === 'object' && !Array.isArray(payload)
      && Object.keys(payload).every((key) => ACTIVATION_FIELDS.has(key))
      && Object.keys(payload).length === ACTIVATION_FIELDS.size
      && payload?.status === 'QUALIFICATION_ENDPOINT_ACTIVE_MODEL_PHASES_LOCKED'
      && payload.protocolVersion === R6_PROTOCOL_VERSION
      && payload.harnessVersion === R6_EXPECTED_PREVIEW_HARNESS_VERSION
      && validWorkerVersionId(payload.workerVersionId)
      && payload.workerVersionId === expectedWorkerVersionId
      && payload.modelCalls === 0
      && validSha256(payload.qualificationBundleSha256)
      && validSha256(payload.qualificationResultSha256)
    const versionId = valid ? payload.workerVersionId : ''
    observations.push({ probe, httpStatus: response.status, workerVersionId: versionId || null, valid })
    if (valid && versionId === stableVersionId) consecutive += 1
    else {
      stableVersionId = versionId
      consecutive = valid ? 1 : 0
    }
    if (consecutive >= requiredStableResponses) {
      return {
        status: 'R6_ACTIVATION_STABLE_MODEL_PHASES_LOCKED',
        workerVersionId: stableVersionId,
        consecutiveStableResponses: consecutive,
        probes: observations.length,
        qualificationBundleSha256: payload.qualificationBundleSha256,
        qualificationResultSha256: payload.qualificationResultSha256,
        modelCalls: 0,
      }
    }
    if (probe < maxProbes) await sleeper(probeDelayMs)
  }
  throw new Error(`R6_ACTIVATION_NOT_STABLE_AFTER_${maxProbes}_PROBES`)
}

export async function runR6QualificationPreflight({
  root = process.cwd(), runLabel, dryRun = false, token = '', endpoint = '', fetcher = fetch,
  expectedWorkerVersionId, sleeper, requiredStableResponses, maxActivationProbes, probeDelayMs,
}) {
  if (dryRun) {
    const registration = await buildR6QualificationRegistration({
      root, runLabel, expectedWorkerVersionId: '00000000-0000-4000-8000-000000000000',
    })
    return { status: 'R6_QUALIFICATION_DRY_RUN_PASS', networkCalls: 0, registration }
  }
  if (typeof token !== 'string' || token.length < 32) throw new Error('E2_R6_BENCHMARK_TOKEN_REQUIRED_IN_PROCESS_MEMORY')
  const resolvedEndpoint = endpoint || r6VersionedPreviewEndpoint(expectedWorkerVersionId)
  if (resolvedEndpoint !== r6VersionedPreviewEndpoint(expectedWorkerVersionId)) throw new Error('R6_VERSIONED_PREVIEW_ENDPOINT_REQUIRED')
  const activation = await awaitR6StableActivation({
    token, expectedWorkerVersionId, endpoint: resolvedEndpoint, fetcher, ...(sleeper ? { sleeper } : {}),
    ...(requiredStableResponses === undefined ? {} : { requiredStableResponses }),
    ...(maxActivationProbes === undefined ? {} : { maxProbes: maxActivationProbes }),
    ...(probeDelayMs === undefined ? {} : { probeDelayMs }),
  })
  const registration = await buildR6QualificationRegistration({
    root, runLabel, expectedWorkerVersionId,
  })
  if (registration.qualificationBundleSha256 !== activation.qualificationBundleSha256
    || registration.qualificationResultSha256 !== activation.qualificationResultSha256) {
    throw new Error('R6_ACTIVATION_QUALIFICATION_HASH_DRIFT')
  }
  const response = await fetcher(`${resolvedEndpoint}/qualification`, {
    method: 'POST',
    headers: {
      origin: new URL(resolvedEndpoint).origin,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: canonicalJson(registration),
  })
  const payload = await response.json().catch(() => null)
  if (response.status !== 201) throw new Error(`R6_QUALIFICATION_REGISTRATION_FAILED_HTTP_${response.status}:${payload?.error ?? 'UNKNOWN'}`)
  if (payload?.workerVersionId !== activation.workerVersionId) throw new Error('R6_QUALIFICATION_RESPONSE_VERSION_DRIFT')
  return {
    status: 'R6_QUALIFICATION_RECORDED_MODEL_PHASES_LOCKED',
    networkCalls: activation.probes + 1,
    activation,
    payload,
  }
}

async function main() {
  const phase = option(process.argv, 'phase')
  const dryRun = option(process.argv, 'dry-run') === 'true'
  const runLabel = option(process.argv, 'run-label')
  const expectedWorkerVersionId = option(process.argv, 'expected-worker-version')
  if (phase !== 'qualification') throw new Error('R6_MODEL_PHASE_NOT_AUTHORIZED')
  const result = await runR6QualificationPreflight({
    runLabel,
    dryRun,
    token: process.env.E2_R6_BENCHMARK_TOKEN ?? '',
    expectedWorkerVersionId,
  })
  console.log(JSON.stringify(result, null, 2))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
