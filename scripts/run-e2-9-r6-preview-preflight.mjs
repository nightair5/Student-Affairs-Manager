/* global console, process */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { assertFutureModelRunQualification, runBoundZeroModelHarnessQualification } from './e2-9-r6-harness-qualification.mjs'
import { canonicalJson, R6_PROTOCOL_VERSION } from './e2-9-r6-path-mask.mjs'

export const R6_PREVIEW_ENDPOINT = 'https://student-affairs-manager-preview.nightsdell.workers.dev/api/experiments/e2-9/r6/harness'

const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex')

function option(argv, name) {
  const prefix = `--${name}=`
  return argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? ''
}

export async function buildR6QualificationRegistration({ root = process.cwd(), runLabel }) {
  if (!/^[a-z0-9][a-z0-9._-]{2,100}$/u.test(runLabel ?? '')) throw new Error('R6_RUN_LABEL_INVALID')
  const resultPath = path.join(root, 'docs', 'e2-v4-pro-benchmark-r6', 'qualification-result.json')
  const saved = JSON.parse(await readFile(resultPath, 'utf8'))
  const fresh = await runBoundZeroModelHarnessQualification({ root })
  if (canonicalJson(saved) !== canonicalJson(fresh)) throw new Error('R6_QUALIFICATION_RESULT_DRIFT')
  const qualificationResultSha256 = sha256(canonicalJson(saved))
  assertFutureModelRunQualification(saved, qualificationResultSha256, fresh.qualificationBundleSha256)
  return {
    runLabel,
    protocolVersion: R6_PROTOCOL_VERSION,
    qualificationBundleSha256: fresh.qualificationBundleSha256,
    qualificationResultSha256,
    qualificationResult: saved,
  }
}

export async function runR6QualificationPreflight({
  root = process.cwd(), runLabel, dryRun = false, token = '', endpoint = R6_PREVIEW_ENDPOINT, fetcher = fetch,
}) {
  const registration = await buildR6QualificationRegistration({ root, runLabel })
  if (dryRun) return { status: 'R6_QUALIFICATION_DRY_RUN_PASS', networkCalls: 0, registration }
  if (endpoint !== R6_PREVIEW_ENDPOINT) throw new Error('R6_PREVIEW_ENDPOINT_REQUIRED')
  if (typeof token !== 'string' || token.length < 32) throw new Error('E2_R6_BENCHMARK_TOKEN_REQUIRED_IN_PROCESS_MEMORY')
  const response = await fetcher(`${endpoint}/qualification`, {
    method: 'POST',
    headers: {
      origin: new URL(endpoint).origin,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: canonicalJson(registration),
  })
  const payload = await response.json().catch(() => null)
  if (response.status !== 201) throw new Error(`R6_QUALIFICATION_REGISTRATION_FAILED_HTTP_${response.status}:${payload?.error ?? 'UNKNOWN'}`)
  return { status: 'R6_QUALIFICATION_RECORDED_MODEL_PHASES_LOCKED', networkCalls: 1, payload }
}

async function main() {
  const phase = option(process.argv, 'phase')
  const dryRun = option(process.argv, 'dry-run') === 'true'
  const runLabel = option(process.argv, 'run-label')
  if (phase !== 'qualification') throw new Error('R6_MODEL_PHASE_NOT_AUTHORIZED')
  const result = await runR6QualificationPreflight({
    runLabel,
    dryRun,
    token: process.env.E2_R6_BENCHMARK_TOKEN ?? '',
  })
  console.log(JSON.stringify(result, null, 2))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
