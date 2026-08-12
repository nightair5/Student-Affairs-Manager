/* global console, fetch, process */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const MODEL_BY_ALIAS = Object.freeze({ flash: 'deepseek-v4-flash', pro: 'deepseek-v4-pro' })
const FORBIDDEN_KEYS = /^(?:expected|answer|answers|gold|golden|target|targets|label|labels|score|scores|forbidden)$/iu

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function assertFirewall(value, location = '$') {
  if (Array.isArray(value)) return value.forEach((entry, index) => assertFirewall(entry, `${location}[${index}]`))
  if (!value || typeof value !== 'object') return
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) throw new Error(`Generation firewall rejected ${location}.${key}`)
    assertFirewall(entry, `${location}.${key}`)
  }
}

function exactKeys(value, allowed, location) {
  const keys = Object.keys(value).sort()
  const expected = [...allowed].sort()
  if (JSON.stringify(keys) !== JSON.stringify(expected)) throw new Error(`${location} has unexpected keys: ${keys.join(',')}`)
}

async function fileExists(file) {
  try { await readFile(file, 'utf8'); return true } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return false
    throw error
  }
}

function orderFor(cases) {
  return cases.flatMap((fixture, index) => (
    (index % 2 === 0 ? ['flash', 'pro'] : ['pro', 'flash']).map((modelAlias) => ({ fixture, modelAlias }))
  ))
}

function verifySuccess(payload, fixture, modelAlias) {
  if (!payload || typeof payload !== 'object' || !payload.result || !payload.execution || typeof payload.rawOutput !== 'string') throw new Error('INCOMPLETE_ENDPOINT_PAYLOAD')
  const expectedModel = MODEL_BY_ALIAS[modelAlias]
  if (payload.execution.requestedModel !== expectedModel || payload.execution.returnedModel !== expectedModel) throw new Error('MODEL_FALLBACK_DETECTED')
  if (!payload.execution.systemFingerprint) throw new Error('SYSTEM_FINGERPRINT_MISSING')
  if (payload.execution.promptVersion !== 'recognition-2.4.1') throw new Error('PROMPT_VERSION_DRIFT')
  if (payload.execution.schemaVersion !== '2.0' || payload.result.schemaVersion !== '2.0') throw new Error('SCHEMA_VERSION_DRIFT')
  if (payload.execution.pipelineVersion !== 'recognition-pipeline-2.2.1') throw new Error('PIPELINE_VERSION_DRIFT')
  if (payload.execution.validatorVersion !== 'recognition-quality-2.1.0') throw new Error('VALIDATOR_VERSION_DRIFT')
  if (payload.execution.router !== 'BYPASSED' || payload.execution.repair !== 'DISABLED' || payload.execution.normalizer !== 'DISABLED') throw new Error('PIPELINE_COMPONENT_DRIFT')
  if (payload.execution.temperature !== 0 || payload.execution.maxTokens !== 6000 || payload.execution.thinking !== 'disabled') throw new Error('GENERATION_PARAMETER_DRIFT')
  if (payload.execution.sourceSha256 !== fixture.sourceSha256) throw new Error('SOURCE_HASH_MISMATCH')
  if (payload.execution.rawOutputSha256 !== sha256(payload.rawOutput)) throw new Error('RAW_OUTPUT_HASH_MISMATCH')
  if (payload.execution.resultSha256 !== sha256(JSON.stringify(payload.result))) throw new Error('RESULT_HASH_MISMATCH')
  if (!payload.execution.tokenUsage || !['input', 'output', 'total'].every((key) => Number.isFinite(payload.execution.tokenUsage[key]))) throw new Error('TOKEN_USAGE_MISSING')
  if (!Array.isArray(payload.execution.attempts) || payload.execution.attempts.length < 1 || payload.execution.attempts.length > 2) throw new Error('ATTEMPT_METADATA_INVALID')
  if (!Array.isArray(payload.result.evidence) || payload.result.evidence.length === 0) throw new Error('EVIDENCE_COMPLETELY_MISSING')
  const entityCount = (payload.result.standaloneTasks?.length ?? 0)
    + (payload.result.milestones?.length ?? 0)
    + (payload.result.materials?.length ?? 0)
    + (payload.result.timePoints?.length ?? 0)
    + (payload.result.events?.length ?? 0)
    + (payload.result.ambiguities?.length ?? 0)
  if (entityCount === 0) throw new Error('BASIC_CONTENT_EMPTY')
}

async function main() {
  const phase = option('phase')
  const label = option('label')
  const endpoint = option('endpoint', 'https://student-affairs-manager-preview.nightsdell.workers.dev/api/experiments/e2-9/v4-pro-benchmark')
  const origin = option('origin', new URL(endpoint).origin)
  const token = process.env.E2_V4_PRO_BENCHMARK_TOKEN ?? ''
  const sourceManifestPath = path.resolve(ROOT, option('source-manifest', '.evaluation-cache/e2-9/source-only-manifest.json'))
  if (!['smoke', 'screening', 'selection-remaining'].includes(phase)) throw new Error('phase must be smoke, screening, or selection-remaining')
  if (!/^[a-z0-9][a-z0-9._-]{2,80}$/u.test(label)) throw new Error('A unique --label is required')
  if (token.length < 32) throw new Error('E2_V4_PRO_BENCHMARK_TOKEN is required in process environment')
  if (!origin.includes('preview') || !new URL(endpoint).hostname.includes('preview')) throw new Error('Preview endpoint and origin are required')

  const sourceManifest = JSON.parse(await readFile(sourceManifestPath, 'utf8'))
  assertFirewall(sourceManifest)
  const sourceCases = phase === 'smoke' ? sourceManifest.smokeCases : sourceManifest.selectionCases
  const ids = option('case-ids').split(',').map((value) => value.trim()).filter(Boolean)
  const cases = ids.length > 0 ? ids.map((id) => sourceCases.find((item) => item.caseId === id)).filter(Boolean) : sourceCases
  if (ids.length > 0 && cases.length !== ids.length) throw new Error('Unknown or duplicate case ID in --case-ids')
  cases.forEach((fixture) => exactKeys(
    fixture,
    new Set(['caseId', 'sourceSet', 'sourceType', 'sourceTitle', 'content', 'referenceTime', 'timezone', 'sourceSha256', 'inputSha256', ...(phase === 'smoke' ? ['smokeRole'] : [])]),
    fixture.caseId,
  ))
  const checkpointDir = path.join(ROOT, '.evaluation-cache', 'e2-9', phase)
  const checkpointPath = path.join(checkpointDir, `${label}.json`)
  if (await fileExists(checkpointPath)) throw new Error(`Checkpoint already exists: ${checkpointPath}`)
  await mkdir(checkpointDir, { recursive: true })
  const observations = []
  const startedAt = new Date().toISOString()
  const runOrder = orderFor(cases)
  for (const [index, { fixture, modelAlias }] of runOrder.entries()) {
    const requestBody = {
      modelAlias,
      sourceType: fixture.sourceType,
      sourceTitle: fixture.sourceTitle,
      content: fixture.content,
      referenceTime: fixture.referenceTime,
      timezone: fixture.timezone,
    }
    assertFirewall(requestBody)
    const invokedAt = new Date().toISOString()
    const clientStartedAt = Date.now()
    let observation
    try {
      const response = await fetch(`${endpoint}/generate`, {
        method: 'POST',
        headers: { origin, authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(requestBody),
      })
      const payload = await response.json().catch(() => null)
      const clientDurationMs = Date.now() - clientStartedAt
      if (!response.ok) {
        observation = { status: 'request_failure', httpStatus: response.status, error: payload?.error ?? 'INVALID_HTTP_RESPONSE', payload: payload ?? null, clientDurationMs }
      } else {
        try {
          verifySuccess(payload, fixture, modelAlias)
          observation = { status: 'complete', httpStatus: response.status, rawOutput: payload.rawOutput, result: payload.result, validation: payload.validation, execution: payload.execution, clientDurationMs }
        } catch (error) {
          observation = { status: 'integrity_failure', httpStatus: response.status, error: error instanceof Error ? error.message : 'INTEGRITY_FAILURE', payload, clientDurationMs }
        }
      }
    } catch (error) {
      observation = { status: 'transport_failure', httpStatus: null, error: error instanceof Error ? error.name : 'TRANSPORT_FAILURE', clientDurationMs: Date.now() - clientStartedAt }
    }
    observations.push({
      observationIndex: index + 1,
      caseId: fixture.caseId,
      sourceSet: fixture.sourceSet,
      smokeRole: fixture.smokeRole ?? null,
      modelAlias,
      requestedModel: MODEL_BY_ALIAS[modelAlias],
      sourceSha256: fixture.sourceSha256,
      inputSha256: fixture.inputSha256,
      invokedAt,
      ...observation,
    })
    await writeFile(checkpointPath, `${JSON.stringify({
      schemaVersion: 'e2.9-paired-checkpoint-1.0.0', phase, label, startedAt,
      sourceOnlyManifestSha256: sha256(JSON.stringify(sourceManifest)),
      observations,
    }, null, 2)}\n`, 'utf8')
    console.log(`[${index + 1}/${runOrder.length}] ${fixture.caseId} ${modelAlias} ${observation.status}`)
  }
  const complete = observations.filter((item) => item.status === 'complete').length
  const summary = {
    phase, label, startedAt, completedAt: new Date().toISOString(),
    observationCount: observations.length,
    complete,
    failed: observations.length - complete,
    callBudgetConsumed: observations.length,
    modelCounts: Object.fromEntries(Object.keys(MODEL_BY_ALIAS).map((alias) => [alias, observations.filter((item) => item.modelAlias === alias).length])),
    checkpointPath: path.relative(ROOT, checkpointPath),
    checkpointSha256: sha256(await readFile(checkpointPath, 'utf8')),
  }
  console.log(JSON.stringify(summary, null, 2))
  if (complete !== observations.length) process.exitCode = 2
}

await main()
