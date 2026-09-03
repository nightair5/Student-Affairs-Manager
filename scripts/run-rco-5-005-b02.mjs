/* global console, fetch, process */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EnvHttpProxyAgent } from 'undici'
import {
  API_STYLE,
  CONTRACT_HASHES,
  ENDPOINT,
  MAX_OUTPUT_TOKENS,
  MODEL,
  PROVIDER,
  ROLES,
  TEMPERATURE,
  aggregateRole,
  buildRequest,
  candidateDecision,
  checkpointCounts,
  createCheckpoint,
  evaluateSchemaLayers,
  finishEntry,
  markDispatched,
  parseResponsesPayload,
  predictionFromFacts,
  predictionFromProposition,
  predictionFromVerified,
  reserveEntry,
  scoreCase,
  sha256,
  skipVerifier,
  stableJson,
  validateCheckpoint,
  validateFacts,
  validateProposition,
  validateVerifier,
} from './rco-5-005-b01-lib.mjs'

const ROOT = process.cwd()
const AUTHORIZATION_ID = 'RCO-5-005-B02-M2'
const FROZEN_RUN_ID = 'rco-5-005-b02-m2-20260903a'
const DATASET_PATH = 'docs/recognition-optimization/RCO-5-005-B02_DEVELOPMENT_DATASET.json'
const DATA_FREEZE_PATH = 'docs/recognition-optimization/RCO-5-005-B02_FREEZE.json'
const RUN_FREEZE_PATH = 'docs/recognition-optimization/RCO-5-005-B02_M2_RUN_FREEZE.json'
const PLAN_PATH = 'docs/recognition-optimization/RCO-5-005-B02_PLAN.md'
const CONTRACT_LIBRARY_PATH = 'scripts/rco-5-005-b01-lib.mjs'
const RUNNER_PATH = 'scripts/run-rco-5-005-b02.mjs'
const RUNNER_TEST_PATH = 'scripts/rco-5-005-b02-runner.node-test.mjs'
const OUTPUT_ROOT = 'docs/recognition-optimization/rco-5-005-b02-runs'
const MAX_REQUEST_BYTES = 49_152
const MAX_REQUEST_DISPATCHES = 36
const PLANNED_LOGICAL_UNITS = 36
const CNY_CAP = 10
const CONSERVATIVE_CNY_PER_USD = 10
const PEAK_INPUT_USD_PER_MILLION = 0.44
const PEAK_OUTPUT_USD_PER_MILLION = 1.32
const REQUEST_TIMEOUT_MS = 120_000

const proxyDispatcher = process.env.HTTPS_PROXY || process.env.HTTP_PROXY ? new EnvHttpProxyAgent() : undefined

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function absolute(relativePath) {
  return path.join(ROOT, relativePath)
}

async function atomicWrite(targetPath, contents) {
  await mkdir(path.dirname(targetPath), { recursive: true })
  const temporary = `${targetPath}.tmp-${process.pid}`
  await writeFile(temporary, contents, 'utf8')
  await rename(temporary, targetPath)
}

async function atomicJson(targetPath, value) {
  await atomicWrite(targetPath, `${JSON.stringify(value, null, 2)}\n`)
}

export function peakCostCny(inputTokens, outputTokens) {
  return ((inputTokens * PEAK_INPUT_USD_PER_MILLION + outputTokens * PEAK_OUTPUT_USD_PER_MILLION) / 1_000_000)
    * CONSERVATIVE_CNY_PER_USD
}

export function hasForbiddenRequestKey(value) {
  if (Array.isArray(value)) return value.some(hasForbiddenRequestKey)
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([key, nested]) => key.toLowerCase().includes('expected')
      || key.toLowerCase().includes('forbidden') || key.toLowerCase().includes('shoulddefaultselect')
      || hasForbiddenRequestKey(nested))
  }
  return false
}

export function safeFailureCode(payload, fallback) {
  const value = payload?.error?.type ?? payload?.error?.code ?? fallback
  return String(value ?? 'UNKNOWN').replace(/[^a-zA-Z0-9_.:-]/gu, '_').slice(0, 180) || 'UNKNOWN'
}

function providerUsage(payload) {
  const usage = payload?.usage
  if (!usage || !Number.isFinite(usage.input_tokens) || !Number.isFinite(usage.output_tokens)) return null
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    totalTokens: Number.isFinite(usage.total_tokens) ? usage.total_tokens : usage.input_tokens + usage.output_tokens,
    inputTokensDetails: usage.input_tokens_details ?? null,
    outputTokensDetails: usage.output_tokens_details ?? null,
  }
}

export function aggregateUsage(records) {
  const dispatched = records.filter((record) => record.dispatched === true)
  const observed = dispatched.filter((record) => record.providerUsage !== null)
  return {
    complete: dispatched.length === observed.length,
    dispatchedRecords: dispatched.length,
    observedRecords: observed.length,
    inputTokens: observed.reduce((total, record) => total + record.providerUsage.inputTokens, 0),
    outputTokens: observed.reduce((total, record) => total + record.providerUsage.outputTokens, 0),
    totalTokens: observed.reduce((total, record) => total + record.providerUsage.totalTokens, 0),
  }
}

async function loadJson(relativePath) {
  return JSON.parse(await readFile(absolute(relativePath), 'utf8'))
}

async function fileSha(relativePath) {
  return sha256(await readFile(absolute(relativePath)))
}

function exactContract(freeze, values) {
  for (const [key, value] of Object.entries(values)) {
    if (stableJson(freeze?.[key]) !== stableJson(value)) throw new Error(`RUN_FREEZE_CONTRACT_INVALID:${key}`)
  }
}

async function loadAndVerifyRunContract() {
  const [dataset, dataFreeze, runFreeze] = await Promise.all([
    loadJson(DATASET_PATH), loadJson(DATA_FREEZE_PATH), loadJson(RUN_FREEZE_PATH),
  ])
  const hashes = Object.fromEntries(await Promise.all([
    DATASET_PATH, DATA_FREEZE_PATH, PLAN_PATH, CONTRACT_LIBRARY_PATH, RUNNER_PATH, RUNNER_TEST_PATH,
  ].map(async (item) => [item, await fileSha(item)])))
  exactContract(runFreeze, {
    schemaVersion: 'rco-5-005-b02-m2-run-freeze-1.0.0',
    authorizationId: AUTHORIZATION_ID,
    runId: FROZEN_RUN_ID,
    status: 'RUNNER_FROZEN_BEFORE_PAID_MODEL_CALLS',
    datasetId: dataFreeze.datasetId,
    datasetSha256: hashes[DATASET_PATH],
    priorDataFreezeSha256: hashes[DATA_FREEZE_PATH],
    planSha256: hashes[PLAN_PATH],
    contractLibrarySha256: hashes[CONTRACT_LIBRARY_PATH],
    runnerSha256: hashes[RUNNER_PATH],
    runnerTestSha256: hashes[RUNNER_TEST_PATH],
    promptSha256: CONTRACT_HASHES.prompts,
    responseSchemaSha256: CONTRACT_HASHES.responseSchemas,
    model: MODEL,
    endpoint: ENDPOINT,
    apiStyle: API_STYLE,
    temperature: TEMPERATURE,
    thinking: 'none',
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    maxRequestBytes: MAX_REQUEST_BYTES,
    plannedLogicalUnits: PLANNED_LOGICAL_UNITS,
    maximumRequestDispatches: MAX_REQUEST_DISPATCHES,
    repairCalls: 0,
    retryCalls: 0,
    cnyCap: CNY_CAP,
  })
  if (hashes[DATASET_PATH] !== dataFreeze.datasetSha256 || dataFreeze.sampleCount !== 12 || dataset.cases?.length !== 12) {
    throw new Error('DATASET_FREEZE_BINDING_INVALID')
  }
  const maximumTheoreticalCostCny = peakCostCny(
    MAX_REQUEST_BYTES * MAX_REQUEST_DISPATCHES,
    MAX_OUTPUT_TOKENS * MAX_REQUEST_DISPATCHES,
  )
  if (maximumTheoreticalCostCny >= CNY_CAP
    || Math.abs(maximumTheoreticalCostCny - runFreeze.maximumTheoreticalCostCny) > 1e-9) {
    throw new Error('COST_CAP_CONTRACT_INVALID')
  }
  return { dataset, dataFreeze, runFreeze, hashes, maximumTheoreticalCostCny }
}

function checkpointContract(verified, runId, createdAt) {
  return {
    runId,
    datasetId: verified.dataset.datasetId,
    datasetSha256: verified.hashes[DATASET_PATH],
    freezeSha256: verified.hashes[RUN_FREEZE_PATH] ?? null,
    planSha256: verified.hashes[PLAN_PATH],
    runnerSha256: verified.hashes[RUNNER_PATH],
    promptSha256: CONTRACT_HASHES.prompts,
    responseSchemaSha256: CONTRACT_HASHES.responseSchemas,
    plannedLogicalUnits: PLANNED_LOGICAL_UNITS,
    maximumRequestDispatches: MAX_REQUEST_DISPATCHES,
    createdAt,
  }
}

async function attachRunFreezeHash(verified) {
  return { ...verified, hashes: { ...verified.hashes, [RUN_FREEZE_PATH]: await fileSha(RUN_FREEZE_PATH) } }
}

export function validateNoRetryState(checkpoint) {
  const duplicate = checkpoint.entries.find((entry, index, entries) => entries.findIndex((item) => item.key === entry.key) !== index)
  if (duplicate || checkpoint.entries.some((entry) => entry.attemptNo !== 1)) throw new Error('NO_RETRY_CONTRACT_INVALID')
  if (checkpointCounts(checkpoint).requestDispatches > MAX_REQUEST_DISPATCHES) throw new Error('DISPATCH_CAP_EXCEEDED')
}

function recordFor(records, caseId, role) {
  return records.find((record) => record.caseId === caseId && record.role === role)
}

async function dispatchOnce({ apiKey, checkpoint, checkpointPath, records, recordsPath, fixture, role, propositionEntry }) {
  const built = buildRequest(role, fixture, propositionEntry)
  if (hasForbiddenRequestKey(built.body)) throw new Error('EXPECTED_OR_SCORING_DATA_IN_REQUEST')
  const bodyText = JSON.stringify(built.body)
  const requestBytes = Buffer.byteLength(bodyText, 'utf8')
  if (requestBytes > MAX_REQUEST_BYTES) throw new Error(`REQUEST_BYTES_LIMIT:${fixture.id}:${role}:${requestBytes}`)
  const counts = checkpointCounts(checkpoint)
  if (counts.requestDispatches >= MAX_REQUEST_DISPATCHES) throw new Error('DISPATCH_CAP_REACHED')
  const projectedDispatches = counts.requestDispatches + 1
  const projectedHardMaximum = peakCostCny(
    projectedDispatches * MAX_REQUEST_BYTES,
    projectedDispatches * MAX_OUTPUT_TOKENS,
  )
  if (projectedHardMaximum >= CNY_CAP) throw new Error('CNY_CAP_WOULD_BE_REACHED')

  const key = `${fixture.id}:${role}`
  const reservedAt = new Date().toISOString()
  checkpoint = reserveEntry(checkpoint, fixture.id, role, reservedAt)
  await atomicJson(checkpointPath, checkpoint)
  checkpoint = markDispatched(checkpoint, key, built.requestSha256, new Date().toISOString())
  await atomicJson(checkpointPath, checkpoint)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const startedAt = new Date().toISOString()
  const started = Date.now()
  let record
  let outcome
  try {
    const response = await fetch(built.endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: bodyText,
      signal: controller.signal,
      ...(proxyDispatcher ? { dispatcher: proxyDispatcher } : {}),
    })
    const responseText = await response.text()
    let payload = null
    try { payload = JSON.parse(responseText) } catch { /* classified below */ }
    const responseSha256 = sha256(responseText)
    const providerRequestId = String(payload?.id ?? response.headers.get('x-request-id') ?? '').trim() || null
    const returnedModel = typeof payload?.model === 'string' ? payload.model : null
    const completedAt = new Date().toISOString()
    const parsed = response.ok ? parseResponsesPayload(payload) : { status: 'request_failure', parsed: null, content: '' }
    let state = response.ok ? parsed.status : 'request_failure'
    let failureCode = response.ok ? null : safeFailureCode(payload, `HTTP_${response.status}`)
    if (response.ok && returnedModel !== MODEL) {
      state = 'request_failure'
      failureCode = returnedModel ? 'RETURNED_MODEL_MISMATCH' : 'RETURNED_MODEL_MISSING'
    } else if (response.ok && !providerRequestId) {
      state = 'request_failure'
      failureCode = 'PROVIDER_REQUEST_ID_MISSING'
    } else if (state !== 'completed' && failureCode === null) {
      failureCode = state === 'incomplete' ? 'RESPONSE_INCOMPLETE' : 'RESPONSE_INVALID_OUTPUT'
    }
    outcome = { state, completedAt, httpStatus: response.status, providerRequestId, returnedModel, responseSha256, failureCode }
    record = {
      key, caseId: fixture.id, role, dispatched: true, attemptNo: 1, startedAt, completedAt,
      latencyMs: Date.now() - started, requestSha256: built.requestSha256, requestBytes,
      httpStatus: response.status, providerRequestId, returnedModel, responseSha256,
      status: state, failureCode, content: parsed.content, contentSha256: sha256(parsed.content), parsed: parsed.parsed,
      providerUsage: providerUsage(payload),
    }
  } catch (error) {
    const completedAt = new Date().toISOString()
    const failureCode = error instanceof Error ? safeFailureCode(null, error.name) : 'UNKNOWN_TRANSPORT_FAILURE'
    outcome = { state: 'transport_failure', completedAt, httpStatus: null, providerRequestId: null,
      returnedModel: null, responseSha256: null, failureCode }
    record = {
      key, caseId: fixture.id, role, dispatched: true, attemptNo: 1, startedAt, completedAt,
      latencyMs: Date.now() - started, requestSha256: built.requestSha256, requestBytes,
      httpStatus: null, providerRequestId: null, returnedModel: null, responseSha256: null,
      status: 'transport_failure', failureCode, content: '', contentSha256: sha256(''), parsed: null,
      providerUsage: null,
    }
  } finally {
    clearTimeout(timeout)
  }
  checkpoint = finishEntry(checkpoint, key, outcome)
  records = [...records, record]
  await atomicJson(checkpointPath, checkpoint)
  await atomicJson(recordsPath, { schemaVersion: 'rco-5-005-b02-m2-raw-results-1.0.0', records })
  return { checkpoint, records, record }
}

function invalidPrediction(record, schemaValid = false) {
  return { status: record?.status ?? 'missing', schemaValid, requiresAction: false, tasks: [] }
}

function buildEvaluation(dataset, records) {
  const scores = Object.fromEntries(ROLES.map((role) => [role, []]))
  const schemaLayers = []
  for (const fixture of dataset.cases) {
    const factsEntry = recordFor(records, fixture.id, 'facts_first')
    const propositionEntry = recordFor(records, fixture.id, 'proposition_graph')
    const verifierEntry = recordFor(records, fixture.id, 'semantic_verifier')
    const layers = evaluateSchemaLayers({ fixture, factsEntry, propositionEntry, verifierEntry })
    schemaLayers.push({ caseId: fixture.id, ...layers })
    const factsPrediction = layers.factsSchemaValid ? predictionFromFacts(factsEntry.parsed) : invalidPrediction(factsEntry)
    const graphPrediction = layers.graphSchemaValid ? predictionFromProposition(propositionEntry.parsed) : invalidPrediction(propositionEntry)
    const verifierPrediction = layers.pipelineSchemaValid
      ? predictionFromVerified(propositionEntry.parsed, verifierEntry.parsed) : invalidPrediction(verifierEntry)
    scores.facts_first.push(scoreCase(fixture, factsPrediction))
    scores.proposition_graph.push(scoreCase(fixture, graphPrediction))
    scores.semantic_verifier.push(scoreCase(fixture, verifierPrediction))
  }
  const metrics = Object.fromEntries(ROLES.map((role) => [role, aggregateRole(scores[role])]))
  return { schemaLayers, scores, metrics, decision: candidateDecision(metrics) }
}

function ratio(value) {
  return value === null || value === undefined ? 'N/A' : `${(value * 100).toFixed(1)}%`
}

function renderReport(result) {
  const rows = ROLES.map((role) => {
    const arm = result.evaluation.metrics[role]
    const quality = arm.qualityMetrics
    return quality
      ? `| ${role} | ${arm.completedCases}/12 | ${arm.schemaValidCases}/12 | ${ratio(quality.taskPrecision)} | ${ratio(quality.taskRecall)} | ${ratio(quality.taskF1)} | ${ratio(quality.requiresActionAccuracy)} | ${ratio(quality.effectAccuracy)} | ${ratio(quality.timeAccuracy)} | ${ratio(quality.materialsAccuracy)} | ${ratio(quality.eventAccuracy)} | ${ratio(quality.locationAccuracy)} | ${ratio(quality.evidenceSpanValidity)} | ${ratio(quality.completeCaseAccuracy)} | ${ratio(quality.majorCorrectionProxyRate)} | ${quality.forbiddenDefaultSelections} | ${ratio(quality.safeDefaultRecall)} | ${quality.missedSafeDefaults} |`
      : `| ${role} | ${arm.completedCases}/12 | ${arm.schemaValidCases}/12 | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID | INVALID |`
  }).join('\n')
  return `# RCO-5-005-B02-M2 真实模型实验报告\n\n## 结论\n\n- 实验决定：\`${result.evaluation.decision.code}\`\n- 原因：${result.evaluation.decision.reason}\n- 发布决定：\`NO_PROMOTION / DO_NOT_LAUNCH\`\n- 证据边界：12 个匿名合成 Development 案例，标签由 Codex 单一作者制定；不是独立人工真值、真实材料、真人修改时间、浏览器验收或上线证据。\n\n## 运行事实\n\n- model：\`${result.model}\`\n- temperature：\`${result.temperature}\`\n- 逻辑单元：${result.requestAccounting.logicalEntries}/${result.plannedLogicalUnits}\n- 实际请求：${result.requestAccounting.requestDispatches}/${result.maximumRequestDispatches}\n- 确认回执：${result.requestAccounting.confirmedResponses}\n- 回执未知：${result.requestAccounting.dispatchUnknown}\n- 因命题图不合格而零调用跳过复核：${result.requestAccounting.skippedBeforeDispatch}\n- Repair / retry：0 / 0\n- Provider billed cost：\`NOT_OBSERVABLE\`\n- 可观测 token：${result.usage.complete ? `${result.usage.inputTokens} input / ${result.usage.outputTokens} output / ${result.usage.totalTokens} total` : `不完整（${result.usage.observedRecords}/${result.usage.dispatchedRecords} 个请求返回 usage）`}\n- 按冻结峰值单价折算：${result.observedConservativePeakPriceCostCny === null ? 'NOT OBSERVABLE' : `${result.observedConservativePeakPriceCostCny.toFixed(6)} CNY`}\n- 全轮理论最大预算：${result.maximumTheoreticalCostCny.toFixed(7)} CNY，小于 10 CNY 硬上限\n\n## 同批案例指标\n\n| 臂 | 完成 | Schema | Task P | Task R | Task F1 | requiresAction | effect | time | materials | event | location | Evidence | Complete Case | Major Correction | Forbidden | Safe Default Recall | Missed Safe Default |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n${rows}\n\n## 解释边界\n\n- facts_first、命题图和复核器使用同一模型、相同 temperature 与同一批原文；Expected 从未进入请求。\n- 命题图不合格时，复核器不会被调用；失败仍留在分母，不会通过重试或 Repair 追分。\n- 模型没有权力输出默认勾选；默认勾选由本地验证和确定性安全策略生成。\n- 本轮不修改稳定路径，不接 RCO-6，不部署。\n`
}

async function executeRun(verified, apiKey, runId, resume) {
  const runDir = absolute(path.join(OUTPUT_ROOT, runId))
  const checkpointPath = path.join(runDir, 'checkpoint.json')
  const recordsPath = path.join(runDir, 'raw-results.json')
  let checkpoint
  let records = []
  try {
    const [checkpointText, recordsEnvelope] = await Promise.all([readFile(checkpointPath, 'utf8'), loadJson(path.relative(ROOT, recordsPath))])
    if (!resume) throw new Error('RUN_ALREADY_EXISTS_USE_EXPLICIT_RESUME')
    checkpoint = JSON.parse(checkpointText)
    records = recordsEnvelope.records
  } catch (error) {
    if (!(error && typeof error === 'object' && error.code === 'ENOENT')) throw error
    if (resume) throw new Error('RESUME_RUN_NOT_FOUND')
    const createdAt = new Date().toISOString()
    checkpoint = createCheckpoint(checkpointContract(verified, runId, createdAt))
    await atomicJson(checkpointPath, checkpoint)
    await atomicJson(recordsPath, { schemaVersion: 'rco-5-005-b02-m2-raw-results-1.0.0', records })
  }
  const contract = checkpointContract(verified, runId, checkpoint.createdAt)
  const checkpointValidation = validateCheckpoint(checkpoint, contract, verified.dataset.cases.map((item) => item.id))
  if (!checkpointValidation.valid) throw new Error(`CHECKPOINT_INVALID:${checkpointValidation.issues.join(',')}`)
  validateNoRetryState(checkpoint)

  let stopReason = null
  for (const fixture of verified.dataset.cases) {
    for (const role of ['facts_first', 'proposition_graph']) {
      if (checkpoint.entries.some((entry) => entry.key === `${fixture.id}:${role}`)) continue
      const dispatchedBefore = checkpointCounts(checkpoint).requestDispatches
      const result = await dispatchOnce({ apiKey, checkpoint, checkpointPath, records, recordsPath, fixture, role,
        propositionEntry: recordFor(records, fixture.id, 'proposition_graph') })
      ;({ checkpoint, records } = result)
      console.log(`PROGRESS ${checkpointCounts(checkpoint).requestDispatches}/${MAX_REQUEST_DISPATCHES} ${fixture.id} ${role} ${result.record.status}`)
      if (dispatchedBefore === 0 && result.record.status !== 'completed') {
        stopReason = `FIRST_REQUEST_NOT_COMPLETED:${result.record.failureCode ?? result.record.status}`
        break
      }
    }
    if (stopReason) break
    const verifierKey = `${fixture.id}:semantic_verifier`
    if (checkpoint.entries.some((entry) => entry.key === verifierKey)) continue
    const propositionEntry = recordFor(records, fixture.id, 'proposition_graph')
    const graphValidation = propositionEntry?.status === 'completed'
      ? validateProposition(propositionEntry.parsed, fixture.sourceText, undefined, `extract-${fixture.id}`)
      : { valid: false, issues: ['graph.notCompleted'] }
    if (!graphValidation.valid) {
      checkpoint = skipVerifier(checkpoint, fixture.id, new Date().toISOString(), graphValidation.issues)
      records.push({ key: verifierKey, caseId: fixture.id, role: 'semantic_verifier', dispatched: false, attemptNo: 1,
        status: 'skipped_upstream_invalid', failureCode: 'UPSTREAM_GRAPH_SCHEMA_INVALID', schemaIssues: graphValidation.issues,
        providerUsage: null })
      await atomicJson(checkpointPath, checkpoint)
      await atomicJson(recordsPath, { schemaVersion: 'rco-5-005-b02-m2-raw-results-1.0.0', records })
      console.log(`PROGRESS ${checkpointCounts(checkpoint).requestDispatches}/${MAX_REQUEST_DISPATCHES} ${fixture.id} semantic_verifier skipped_upstream_invalid`)
      continue
    }
    const result = await dispatchOnce({ apiKey, checkpoint, checkpointPath, records, recordsPath, fixture,
      role: 'semantic_verifier', propositionEntry })
    ;({ checkpoint, records } = result)
    console.log(`PROGRESS ${checkpointCounts(checkpoint).requestDispatches}/${MAX_REQUEST_DISPATCHES} ${fixture.id} semantic_verifier ${result.record.status}`)
  }
  validateNoRetryState(checkpoint)
  const finalValidation = validateCheckpoint(checkpoint, checkpointContract(verified, runId, checkpoint.createdAt),
    verified.dataset.cases.map((item) => item.id))
  if (!finalValidation.valid) throw new Error(`FINAL_CHECKPOINT_INVALID:${finalValidation.issues.join(',')}`)
  const evaluation = buildEvaluation(verified.dataset, records)
  const usage = aggregateUsage(records)
  const requestAccounting = checkpointCounts(checkpoint)
  const result = {
    schemaVersion: 'rco-5-005-b02-m2-result-1.0.0', runId, authorizationId: AUTHORIZATION_ID,
    generatedAt: new Date().toISOString(), runStatus: stopReason ? 'STOPPED_FAIL_CLOSED' : 'FINISHED', stopReason,
    datasetId: verified.dataset.datasetId, datasetClassification: verified.dataset.classification,
    labelProvenance: verified.dataset.labelProvenance, model: MODEL, endpoint: ENDPOINT, apiStyle: API_STYLE,
    temperature: TEMPERATURE, thinking: 'none', maxOutputTokens: MAX_OUTPUT_TOKENS,
    plannedLogicalUnits: PLANNED_LOGICAL_UNITS, maximumRequestDispatches: MAX_REQUEST_DISPATCHES,
    repairCalls: 0, retryCalls: 0, cnyCap: CNY_CAP,
    maximumTheoreticalCostCny: verified.maximumTheoreticalCostCny,
    requestAccounting, usage,
    providerBilledCost: 'NOT_OBSERVABLE',
    observedConservativePeakPriceCostCny: usage.complete ? peakCostCny(usage.inputTokens, usage.outputTokens) : null,
    evaluation,
    checkpointSha256: sha256(await readFile(checkpointPath)), rawResultsSha256: sha256(await readFile(recordsPath)),
    protectedArtifactsModified: false, stablePath: 'UNCHANGED', deployment: 'NOT_RUN',
    evidenceBoundary: 'Synthetic Development only; not independent human ground truth, real-material accuracy, user modification time, browser acceptance, release evidence or production authorization',
  }
  await atomicJson(path.join(runDir, 'result.json'), result)
  await atomicWrite(path.join(runDir, 'REPORT.md'), renderReport(result))
  return result
}

export function selfTest() {
  if (MAX_REQUEST_DISPATCHES !== ROLES.length * 12 || peakCostCny(MAX_REQUEST_BYTES * 36, MAX_OUTPUT_TOKENS * 36) >= CNY_CAP) {
    throw new Error('SELF_TEST_BUDGET_INVALID')
  }
  if (!hasForbiddenRequestKey({ nested: { expected: true } }) || hasForbiddenRequestKey({ input: 'expected is plain source text' })) {
    throw new Error('SELF_TEST_REQUEST_FILTER_INVALID')
  }
}

async function main() {
  if (process.argv.includes('--self-test')) {
    selfTest()
    console.log(JSON.stringify({ status: 'PASS', mode: 'self-test', modelCalls: 0, networkDispatches: 0, secretAccess: 'NONE' }))
    return
  }
  let verified = await loadAndVerifyRunContract()
  verified = await attachRunFreezeHash(verified)
  if (!process.argv.includes('--run')) {
    console.log(JSON.stringify({ status: 'PASS', mode: 'verify-only', modelCalls: 0, networkDispatches: 0,
      secretAccess: 'NONE', datasetId: verified.dataset.datasetId, maximumTheoreticalCostCny: verified.maximumTheoreticalCostCny }))
    return
  }
  if (option('authorization-id') !== AUTHORIZATION_ID) throw new Error('AUTHORIZATION_ID_REQUIRED_OR_MISMATCH')
  const runId = option('run-id')
  if (runId !== FROZEN_RUN_ID) throw new Error('RUN_ID_REQUIRED_OR_NOT_FROZEN')
  const apiKey = String(process.env.RCO_B02_DEEPSEEK_API_KEY ?? '').trim()
  if (apiKey.length < 20) throw new Error('RCO_B02_DEEPSEEK_API_KEY_REQUIRED')
  const result = await executeRun(verified, apiKey, runId, process.argv.includes('--resume'))
  console.log(JSON.stringify({ status: result.runStatus, runId, requestAccounting: result.requestAccounting,
    decision: result.evaluation.decision, usage: result.usage, observedConservativePeakPriceCostCny: result.observedConservativePeakPriceCostCny }))
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main().catch((error) => {
  console.error(`RCO_B02_M2_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}`)
  process.exitCode = 1
})
