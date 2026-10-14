/* global console, fetch, process */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EnvHttpProxyAgent } from 'undici'
import {
  SCOPE_REFERENCE_CANDIDATE_JSON_SCHEMA,
  SCOPE_REFERENCE_SCHEMA_VERSION,
  SCOPE_REFERENCE_VERIFICATION_JSON_SCHEMA,
  SCOPE_REFERENCE_VERIFICATION_VERSION,
  composeScopeReferenceCandidate,
  scopeReferenceCandidateFingerprint,
  validateScopeReferenceCandidate,
  validateScopeReferenceVerification,
} from '../src/recognition/scopeReferenceContract.ts'
import { SCOPE_INDEX_VERSION, indexImmutableScopesV11 } from '../src/recognition/scopeIndexV11.ts'

const ROOT = process.cwd()
const AUTHORIZATION_ID = 'RCO-5-006-B1-M1'
const RUN_ID = 'rco-5-006-b1-m1-20260903b'
const MODEL = 'deepseek-v4-flash-vision-exp'
const ENDPOINT = 'https://api.deepseek.com/responses'
const PROVIDER = 'deepseek'
const API_STYLE = 'responses-v1-json-schema'
const TEMPERATURE = 0
const MAX_OUTPUT_TOKENS = 5_000
const MAX_REQUEST_BYTES = 65_536
const MAX_REQUEST_DISPATCHES = 24
const PLANNED_CANDIDATE_CALLS = 12
const MAXIMUM_VERIFIER_CALLS = 12
const CNY_CAP = 10
const CONSERVATIVE_CNY_PER_USD = 10
const PEAK_INPUT_USD_PER_MILLION = 0.44
const PEAK_OUTPUT_USD_PER_MILLION = 1.32
const REQUEST_TIMEOUT_MS = 120_000
const DATASET_PATH = 'docs/recognition-optimization/RCO-5-006-B1_DEVELOPMENT_DATASET.json'
const DATA_FREEZE_PATH = 'docs/recognition-optimization/RCO-5-006-B1_FREEZE.json'
const PLAN_PATH = 'docs/recognition-optimization/RCO-5-006-B1_PLAN.md'
const SCOPE_INDEX_PATH = 'src/recognition/scopeIndexV11.ts'
const CONTRACT_PATH = 'src/recognition/scopeReferenceContract.ts'
const RUNNER_PATH = 'scripts/run-rco-5-006-b1-m1.mjs'
const RUN_DIR = `docs/recognition-optimization/rco-5-006-b1-runs/${RUN_ID}`
const CHECKPOINT_PATH = `${RUN_DIR}/checkpoint.json`
const RAW_RESULTS_PATH = `${RUN_DIR}/raw-results.json`
const RESULT_PATH = `${RUN_DIR}/result.json`
const REPORT_PATH = `${RUN_DIR}/REPORT.md`
const PRECALL_REPORT_PATH = `${RUN_DIR}/PRECALL_REPORT.md`
const ROLES = ['candidate', 'verifier']
const SEMANTIC_AXES = ['actor', 'speechAct', 'polarity', 'tense', 'status', 'validity', 'modality']
const proxyDispatcher = process.env.HTTPS_PROXY || process.env.HTTP_PROXY ? new EnvHttpProxyAgent() : undefined

const CANDIDATE_PROMPT = `你是校园通知的结构化抽取器。只依据输入中的 sourceText 与 scopeCatalog 工作。
你的唯一职责是选择不可变 scope ID，并输出受控语义标签。不得输出字符位置、逐字证据、自由 evidence、selected、relations、fromId 或 toId。
完整覆盖所有 scope：每个 scope 必须出现在某个 directive/observation 的 propositionScopeIds 中，或出现在 ignoredScopeIds 中，但不得两边同时出现。
directive 只表示文本中出现的行动命题，必须保留否定、条件、已完成、已取消、旧要求和 optional，而不是只提取当前任务。
observation 表示事件或信息命题。引用字段的 surface 必须逐字存在于其 scope 文本内，字段 scopeId 必须属于同一命题的 propositionScopeIds。
requiresAction 仅当存在面向 addressee/addressed_group、directive、affirmative、present/future、pending、active、required、explicit 的当前行动时为 true。
producerRunId、sourceId、sourceVersionId、sourceFingerprint 和 schemaVersion 必须逐字复制输入指定值。不要猜测未明示事实。`

const VERIFIER_PROMPT = `你是与候选抽取运行相分离的语义复核器。独立阅读 sourceText、scopeCatalog 和 candidate，然后逐项复核。
不得输出字符位置、逐字证据、自由 evidence、selected、relations、fromId 或 toId，也不得重写 candidate。
每个 candidate directive 必须恰好有一个 assessment；每个 observation 必须恰好有一个 observationAssessment。
entailed 只在命题范围和所有语义标签都由原文支持时使用，并完整复制其 propositionScopeIds 到 evidenceScopeIds；否则使用 contradicted 或 unknown，并仍只引用该候选命题内的 scope。
consideredScopeIds 按原顺序列出你实际检查的 scope；只有检查全部 scope 且没有漏掉行动命题时 graphCoverage 才能为 complete。
missingDirectiveScopeIds 只列漏掉的行动命题 scope；有任何漏项时 graphCoverage 不得为 complete。revisionCoverage 只有修订关系均完整正确时才为 complete。
method 必须是 independent_semantic_verifier。verifierRunId、sourceId、sourceVersionId、sourceFingerprint、candidateFingerprint 和 schemaVersion 必须逐字复制输入指定值。`

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

async function sha256(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function absolute(relativePath) {
  return path.join(ROOT, relativePath)
}

async function atomicWrite(relativePath, contents) {
  const targetPath = absolute(relativePath)
  await mkdir(path.dirname(targetPath), { recursive: true })
  const temporary = `${targetPath}.tmp-${process.pid}`
  await writeFile(temporary, contents, 'utf8')
  await rename(temporary, targetPath)
}

async function atomicJson(relativePath, value) {
  await atomicWrite(relativePath, `${JSON.stringify(value, null, 2)}\n`)
}

async function loadJson(relativePath) {
  return JSON.parse(await readFile(absolute(relativePath), 'utf8'))
}

async function fileSha(relativePath) {
  return sha256(await readFile(absolute(relativePath)))
}

function peakCostCny(inputTokens, outputTokens) {
  return ((inputTokens * PEAK_INPUT_USD_PER_MILLION + outputTokens * PEAK_OUTPUT_USD_PER_MILLION) / 1_000_000)
    * CONSERVATIVE_CNY_PER_USD
}

function hasForbiddenRequestKey(value) {
  if (Array.isArray(value)) return value.some(hasForbiddenRequestKey)
  if (!value || typeof value !== 'object') return false
  return Object.entries(value).some(([key, nested]) => /expected|forbidden|defaultselected|semanticfamily/iu.test(key)
    || hasForbiddenRequestKey(nested))
}

function forbiddenModelOutputKey(value) {
  if (Array.isArray(value)) return value.some(forbiddenModelOutputKey)
  if (!value || typeof value !== 'object') return false
  return Object.entries(value).some(([key, nested]) => ['start', 'end', 'text', 'quote', 'evidence', 'selected', 'relations', 'fromId', 'toId'].includes(key)
    || forbiddenModelOutputKey(nested))
}

function normalize(value) {
  return String(value ?? '').normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase()
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator
}

function percent(value) {
  return value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`
}

function issueCodes(validation) {
  return validation.issues.map((issue) => typeof issue === 'string' ? issue : `${issue.category}:${issue.code}:${issue.path}`)
}

function recordFor(records, caseId, role) {
  return records.find((record) => record.caseId === caseId && record.role === role)
}

function providerUsage(payload) {
  const usage = payload?.usage
  if (!usage || !Number.isFinite(usage.input_tokens) || !Number.isFinite(usage.output_tokens)) return null
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    totalTokens: Number.isFinite(usage.total_tokens) ? usage.total_tokens : usage.input_tokens + usage.output_tokens,
  }
}

function aggregateUsage(records) {
  const dispatched = records.filter((record) => record.dispatched)
  const observed = dispatched.filter((record) => record.providerUsage)
  return {
    complete: observed.length === dispatched.length,
    dispatchedRecords: dispatched.length,
    observedRecords: observed.length,
    inputTokens: observed.reduce((total, record) => total + record.providerUsage.inputTokens, 0),
    outputTokens: observed.reduce((total, record) => total + record.providerUsage.outputTokens, 0),
    totalTokens: observed.reduce((total, record) => total + record.providerUsage.totalTokens, 0),
  }
}

function parseResponsesPayload(payload) {
  const parts = Array.isArray(payload?.output)
    ? payload.output.flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    : []
  const content = parts.find((part) => part?.type === 'output_text' && typeof part.text === 'string')?.text ?? ''
  if (!content) return { status: payload?.status === 'incomplete' ? 'incomplete' : 'invalid_output', parsed: null, content: '' }
  try {
    return { status: payload?.status === 'completed' ? 'completed' : 'incomplete', parsed: JSON.parse(content), content }
  } catch {
    return { status: 'invalid_output', parsed: null, content }
  }
}

function safeFailureCode(payload, fallback) {
  const value = payload?.error?.type ?? payload?.error?.code ?? fallback
  return String(value ?? 'UNKNOWN').replace(/[^a-zA-Z0-9_.:-]/gu, '_').slice(0, 180) || 'UNKNOWN'
}

function validateApiKey(apiKey) {
  if (!/^sk-[A-Za-z0-9._~+/-]{16,253}$/u.test(apiKey)) throw new Error('API_KEY_FORMAT_INVALID')
  try {
    new Headers({ authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' })
  } catch {
    throw new Error('API_KEY_HEADER_CONSTRUCTION_INVALID')
  }
}

async function indexFor(fixture) {
  return indexImmutableScopesV11(fixture.id, 'source-v1', fixture.sourceText)
}

function requestInput(fixture, index) {
  return {
    sourceId: index.sourceId,
    sourceVersionId: index.sourceVersionId,
    sourceFingerprint: index.sourceFingerprint,
    sourceTitle: fixture.sourceTitle,
    sourceText: fixture.sourceText,
    referenceTime: fixture.referenceTime,
    timezone: fixture.timezone,
    scopeIndexVersion: SCOPE_INDEX_VERSION,
    scopeCatalog: index.scopes.map(({ id, order, text }) => ({ id, order, text })),
  }
}

async function buildRequest(role, fixture, candidateRecord = null) {
  const index = await indexFor(fixture)
  const base = requestInput(fixture, index)
  let instructions
  let schema
  let input
  if (role === 'candidate') {
    instructions = CANDIDATE_PROMPT
    schema = SCOPE_REFERENCE_CANDIDATE_JSON_SCHEMA
    input = { ...base, schemaVersion: SCOPE_REFERENCE_SCHEMA_VERSION, producerRunId: `candidate-${RUN_ID}-${fixture.id}` }
  } else if (role === 'verifier') {
    const candidate = candidateRecord?.parsed
    const validation = candidateRecord?.status === 'completed'
      ? validateScopeReferenceCandidate(candidate, index)
      : { valid: false, issues: [{ category: 'schema', code: 'CANDIDATE_NOT_COMPLETED', path: 'candidate' }] }
    if (validation.valid && candidate.producerRunId !== `candidate-${RUN_ID}-${fixture.id}`) {
      validation.valid = false
      validation.issues.push({ category: 'binding', code: 'PRODUCER_RUN_ID_MISMATCH', path: 'candidate.producerRunId' })
    }
    if (!validation.valid) {
      const error = new Error('UPSTREAM_CANDIDATE_SCHEMA_INVALID')
      error.issues = issueCodes(validation)
      throw error
    }
    instructions = VERIFIER_PROMPT
    schema = SCOPE_REFERENCE_VERIFICATION_JSON_SCHEMA
    input = {
      ...base,
      schemaVersion: SCOPE_REFERENCE_VERIFICATION_VERSION,
      verifierRunId: `verifier-${RUN_ID}-${fixture.id}`,
      candidateFingerprint: await scopeReferenceCandidateFingerprint(candidate),
      candidate,
    }
  } else {
    throw new Error('ROLE_INVALID')
  }
  const body = {
    model: MODEL,
    instructions,
    input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(input) }] }],
    reasoning: { effort: 'none' },
    temperature: TEMPERATURE,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    text: { format: { type: 'json_schema', name: `rco_scope_b1_${role}`, schema } },
  }
  if (hasForbiddenRequestKey(input)) throw new Error('EXPECTED_OR_SCORING_DATA_IN_REQUEST')
  const bodyText = JSON.stringify(body)
  if (Buffer.byteLength(bodyText, 'utf8') > MAX_REQUEST_BYTES) throw new Error('REQUEST_BYTES_LIMIT')
  return { body, bodyText, requestSha256: await sha256(stableJson(body)), index }
}

async function verifyFrozenInputs() {
  const [dataset, freeze] = await Promise.all([loadJson(DATASET_PATH), loadJson(DATA_FREEZE_PATH)])
  const paths = [DATASET_PATH, DATA_FREEZE_PATH, PLAN_PATH, SCOPE_INDEX_PATH, CONTRACT_PATH, RUNNER_PATH]
  const hashes = Object.fromEntries(await Promise.all(paths.map(async (item) => [item, await fileSha(item)])))
  if (dataset.datasetId !== 'rco-5-006-b1-development-20260903' || dataset.cases?.length !== 12) throw new Error('DATASET_IDENTITY_INVALID')
  if (freeze.datasetSha256 !== hashes[DATASET_PATH] || freeze.sampleCount !== 12) throw new Error('DATASET_FREEZE_BINDING_INVALID')
  for (const item of [DATASET_PATH, PLAN_PATH, SCOPE_INDEX_PATH, CONTRACT_PATH]) {
    if (freeze.componentSha256?.[item] !== hashes[item]) throw new Error(`PROTECTED_COMPONENT_DRIFT:${item}`)
  }
  if (dataset.scopeIndexVersion !== SCOPE_INDEX_VERSION || dataset.contractSchemaVersion !== SCOPE_REFERENCE_SCHEMA_VERSION) {
    throw new Error('SCHEMA_OR_SCOPE_VERSION_DRIFT')
  }
  const maximumTheoreticalCostCny = peakCostCny(
    MAX_REQUEST_BYTES * MAX_REQUEST_DISPATCHES,
    MAX_OUTPUT_TOKENS * MAX_REQUEST_DISPATCHES,
  )
  if (maximumTheoreticalCostCny >= CNY_CAP) throw new Error('THEORETICAL_COST_NOT_BELOW_CAP')
  return { dataset, freeze, hashes, maximumTheoreticalCostCny }
}

function immutableCheckpointContract(verified, createdAt) {
  return {
    schemaVersion: 'rco-5-006-b1-m1-checkpoint-1.0.0',
    authorizationId: AUTHORIZATION_ID,
    authorization: {
      model: MODEL,
      candidateCalls: PLANNED_CANDIDATE_CALLS,
      verifierCallsMaximum: MAXIMUM_VERIFIER_CALLS,
      maximumModelCalls: MAX_REQUEST_DISPATCHES,
      temperature: TEMPERATURE,
      repairCalls: 0,
      retryCalls: 0,
      cnyHardCap: CNY_CAP,
    },
    runId: RUN_ID,
    datasetId: verified.dataset.datasetId,
    datasetSha256: verified.hashes[DATASET_PATH],
    priorDataFreezeSha256: verified.hashes[DATA_FREEZE_PATH],
    planSha256: verified.hashes[PLAN_PATH],
    scopeIndexSha256: verified.hashes[SCOPE_INDEX_PATH],
    contractSha256: verified.hashes[CONTRACT_PATH],
    runnerSha256: verified.hashes[RUNNER_PATH],
    scopeIndexVersion: SCOPE_INDEX_VERSION,
    candidateSchemaVersion: SCOPE_REFERENCE_SCHEMA_VERSION,
    verifierSchemaVersion: SCOPE_REFERENCE_VERIFICATION_VERSION,
    candidatePromptSha256: null,
    verifierPromptSha256: null,
    candidateSchemaSha256: null,
    verifierSchemaSha256: null,
    provider: PROVIDER,
    endpoint: ENDPOINT,
    apiStyle: API_STYLE,
    model: MODEL,
    temperature: TEMPERATURE,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    maxRequestBytes: MAX_REQUEST_BYTES,
    maximumTheoreticalCostCny: verified.maximumTheoreticalCostCny,
    providerBilledCost: 'NOT_OBSERVABLE',
    pricingGuard: {
      source: 'existing RCO-B02 conservative peak proxy',
      inputUsdPerMillion: PEAK_INPUT_USD_PER_MILLION,
      outputUsdPerMillion: PEAK_OUTPUT_USD_PER_MILLION,
      cnyPerUsd: CONSERVATIVE_CNY_PER_USD,
    },
    plannedLogicalUnits: 24,
    maximumRequestDispatches: MAX_REQUEST_DISPATCHES,
    repairCalls: 0,
    retryCalls: 0,
    createdAt,
  }
}

async function withContractHashes(contract) {
  return {
    ...contract,
    candidatePromptSha256: await sha256(CANDIDATE_PROMPT),
    verifierPromptSha256: await sha256(VERIFIER_PROMPT),
    candidateSchemaSha256: await sha256(stableJson(SCOPE_REFERENCE_CANDIDATE_JSON_SCHEMA)),
    verifierSchemaSha256: await sha256(stableJson(SCOPE_REFERENCE_VERIFICATION_JSON_SCHEMA)),
  }
}

function createCheckpoint(contract) {
  return { ...contract, entries: [] }
}

function same(left, right) {
  return stableJson(left) === stableJson(right)
}

async function validateCheckpoint(checkpoint, verified) {
  const expected = await withContractHashes(immutableCheckpointContract(verified, checkpoint.createdAt))
  const immutableActual = { ...checkpoint }
  delete immutableActual.entries
  const issues = []
  if (!same(immutableActual, expected)) issues.push('IMMUTABLE_CHECKPOINT_CONTRACT_MISMATCH')
  if (!Array.isArray(checkpoint.entries)) issues.push('CHECKPOINT_ENTRIES_INVALID')
  const keys = new Set()
  for (const entry of checkpoint.entries ?? []) {
    if (!verified.dataset.cases.some((fixture) => fixture.id === entry.caseId) || !ROLES.includes(entry.role)) issues.push('ENTRY_IDENTITY_INVALID')
    if (entry.key !== `${entry.caseId}:${entry.role}` || keys.has(entry.key)) issues.push('ENTRY_KEY_INVALID_OR_DUPLICATE')
    keys.add(entry.key)
    if (entry.attemptNo !== 1) issues.push('RETRY_DETECTED')
    if (!['reserved', 'dispatched', 'completed', 'request_failure', 'transport_failure', 'invalid_output', 'incomplete', 'skipped_upstream_invalid'].includes(entry.state)) {
      issues.push('ENTRY_STATE_INVALID')
    }
  }
  if (checkpoint.entries.filter((entry) => entry.dispatchedAt).length > MAX_REQUEST_DISPATCHES) issues.push('DISPATCH_CAP_EXCEEDED')
  return { valid: issues.length === 0, issues }
}

function checkpointCounts(checkpoint) {
  const entries = checkpoint.entries
  const dispatched = entries.filter((entry) => entry.dispatchedAt)
  const terminal = entries.filter((entry) => ['completed', 'request_failure', 'transport_failure', 'invalid_output', 'incomplete', 'skipped_upstream_invalid'].includes(entry.state))
  return {
    logicalEntries: entries.length,
    requestDispatches: dispatched.length,
    confirmedResponses: terminal.filter((entry) => entry.state !== 'transport_failure' && entry.state !== 'skipped_upstream_invalid').length,
    dispatchUnknown: entries.filter((entry) => entry.state === 'dispatched' || entry.state === 'transport_failure').length,
    skippedBeforeDispatch: entries.filter((entry) => entry.state === 'skipped_upstream_invalid').length,
    completed: entries.filter((entry) => entry.state === 'completed').length,
  }
}

async function saveState(checkpoint, records) {
  await atomicJson(CHECKPOINT_PATH, checkpoint)
  await atomicJson(RAW_RESULTS_PATH, { schemaVersion: 'rco-5-006-b1-m1-raw-results-1.0.0', runId: RUN_ID, records })
}

function reserve(checkpoint, fixture, role) {
  const key = `${fixture.id}:${role}`
  if (checkpoint.entries.some((entry) => entry.key === key)) throw new Error('CHECKPOINT_ENTRY_ALREADY_EXISTS')
  checkpoint.entries.push({ key, caseId: fixture.id, role, attemptNo: 1, state: 'reserved', reservedAt: new Date().toISOString() })
}

function markSkipped(checkpoint, fixture, issues) {
  const key = `${fixture.id}:verifier`
  if (checkpoint.entries.some((entry) => entry.key === key)) throw new Error('CHECKPOINT_ENTRY_ALREADY_EXISTS')
  checkpoint.entries.push({
    key,
    caseId: fixture.id,
    role: 'verifier',
    attemptNo: 1,
    state: 'skipped_upstream_invalid',
    reservedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    upstreamIssues: issues,
  })
}

async function dispatchOnce({ apiKey, checkpoint, records, fixture, role, candidateRecord }) {
  const built = await buildRequest(role, fixture, candidateRecord)
  const requestBytes = Buffer.byteLength(built.bodyText, 'utf8')
  const before = checkpointCounts(checkpoint)
  if (before.requestDispatches >= MAX_REQUEST_DISPATCHES) throw new Error('DISPATCH_CAP_REACHED')
  if (peakCostCny((before.requestDispatches + 1) * MAX_REQUEST_BYTES, (before.requestDispatches + 1) * MAX_OUTPUT_TOKENS) >= CNY_CAP) {
    throw new Error('CNY_CAP_WOULD_BE_REACHED')
  }
  reserve(checkpoint, fixture, role)
  await saveState(checkpoint, records)
  const key = `${fixture.id}:${role}`
  const entry = checkpoint.entries.find((item) => item.key === key)
  entry.state = 'dispatched'
  entry.dispatchedAt = new Date().toISOString()
  entry.requestSha256 = built.requestSha256
  entry.requestBytes = requestBytes
  await saveState(checkpoint, records)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const startedAt = new Date().toISOString()
  const started = Date.now()
  let record
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: built.bodyText,
      signal: controller.signal,
      ...(proxyDispatcher ? { dispatcher: proxyDispatcher } : {}),
    })
    const responseText = await response.text()
    let payload = null
    try { payload = JSON.parse(responseText) } catch { /* safely classified below */ }
    const parsed = response.ok ? parseResponsesPayload(payload) : { status: 'request_failure', parsed: null, content: '' }
    const providerRequestId = String(payload?.id ?? response.headers.get('x-request-id') ?? '').trim() || null
    const returnedModel = typeof payload?.model === 'string' ? payload.model : null
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
    const completedAt = new Date().toISOString()
    Object.assign(entry, {
      state,
      completedAt,
      httpStatus: response.status,
      providerRequestId,
      returnedModel,
      responseSha256: await sha256(responseText),
      failureCode,
    })
    record = {
      key,
      caseId: fixture.id,
      role,
      dispatched: true,
      attemptNo: 1,
      startedAt,
      completedAt,
      latencyMs: Date.now() - started,
      requestSha256: built.requestSha256,
      requestBytes,
      httpStatus: response.status,
      providerRequestId,
      returnedModel,
      responseSha256: entry.responseSha256,
      status: state,
      failureCode,
      content: parsed.content,
      contentSha256: await sha256(parsed.content),
      parsed: parsed.parsed,
      providerUsage: providerUsage(payload),
    }
  } catch (error) {
    const completedAt = new Date().toISOString()
    const failureCode = error instanceof Error ? safeFailureCode(null, error.name) : 'UNKNOWN_TRANSPORT_FAILURE'
    Object.assign(entry, {
      state: 'transport_failure',
      completedAt,
      httpStatus: null,
      providerRequestId: null,
      returnedModel: null,
      responseSha256: null,
      failureCode,
    })
    record = {
      key,
      caseId: fixture.id,
      role,
      dispatched: true,
      attemptNo: 1,
      startedAt,
      completedAt,
      latencyMs: Date.now() - started,
      requestSha256: built.requestSha256,
      requestBytes,
      httpStatus: null,
      providerRequestId: null,
      returnedModel: null,
      responseSha256: null,
      status: 'transport_failure',
      failureCode,
      content: '',
      contentSha256: await sha256(''),
      parsed: null,
      providerUsage: null,
    }
  } finally {
    clearTimeout(timeout)
  }
  records.push(record)
  await saveState(checkpoint, records)
  return record
}

function scopeIdForText(index, text) {
  const matches = index.scopes.filter((scope) => scope.text === text)
  if (matches.length !== 1) throw new Error(`EXPECTED_SCOPE_NOT_UNIQUE:${text}`)
  return matches[0].id
}

function expectedSurface(index, reference) {
  return reference ? { scopeId: scopeIdForText(index, reference.scopeText), surface: reference.surface } : null
}

function materializeExpected(fixture, index) {
  const expectedIds = new Map(fixture.expected.directives.map((item, order) => [item.expectedId, `expected-${order + 1}`]))
  return {
    requiresAction: fixture.expected.requiresAction,
    directives: fixture.expected.directives.map((item) => ({
      id: expectedIds.get(item.expectedId),
      propositionScopeIds: item.propositionScopeTexts.map((text) => scopeIdForText(index, text)),
      semantics: item.semantics,
      inferenceLevel: item.inferenceLevel,
      actionType: item.actionType,
      action: expectedSurface(index, item.action),
      object: expectedSurface(index, item.object),
      effect: item.effect,
      timeRefs: item.timeRefs.map((ref) => ({ ...expectedSurface(index, ref), type: ref.type })),
      materialRefs: item.materialRefs.map((ref) => ({ ...expectedSurface(index, ref), required: ref.required })),
      eventRef: expectedSurface(index, item.eventRef),
      locationRef: expectedSurface(index, item.locationRef),
      revisionRefs: item.revisionRefs.map((ref) => ({
        type: ref.type,
        targetDirectiveId: expectedIds.get(ref.targetExpectedDirectiveId),
        scopeIds: ref.scopeTexts.map((text) => scopeIdForText(index, text)),
      })),
      expectedDefaultSelected: item.expectedDefaultSelected,
    })),
    observations: fixture.expected.observations.map((item, order) => ({
      id: `expected-observation-${order + 1}`,
      kind: item.kind,
      propositionScopeIds: item.propositionScopeTexts.map((text) => scopeIdForText(index, text)),
      semantics: item.semantics,
      inferenceLevel: item.inferenceLevel,
      subject: expectedSurface(index, item.subject),
      timeRefs: item.timeRefs.map((ref) => ({ ...expectedSurface(index, ref), type: ref.type })),
      locationRef: expectedSurface(index, item.locationRef),
    })),
    ignoredScopeIds: fixture.expected.ignoredScopeTexts.map((text) => scopeIdForText(index, text)),
    forbiddenDefaultSurfaces: fixture.expected.forbiddenDefaultSurfaces,
  }
}

function setOverlap(left, right) {
  const a = new Set(left)
  const b = new Set(right)
  return [...a].filter((item) => b.has(item)).length
}

function directiveSimilarity(expected, predicted) {
  let score = 0
  if (normalize(expected.action.surface) === normalize(predicted.action?.surface)) score += 5
  if (normalize(expected.object.surface) === normalize(predicted.object?.surface)) score += 4
  if (expected.actionType === predicted.actionType) score += 2
  score += setOverlap(expected.propositionScopeIds, predicted.propositionScopeIds ?? []) * 3
  return score
}

function observationSimilarity(expected, predicted) {
  let score = 0
  if (normalize(expected.subject.surface) === normalize(predicted.subject?.surface)) score += 5
  if (expected.kind === predicted.kind) score += 2
  score += setOverlap(expected.propositionScopeIds, predicted.propositionScopeIds ?? []) * 3
  return score
}

function bestAlignment(expected, predicted, similarity) {
  let best = { score: -1, pairs: [] }
  const search = (expectedIndex, used, score, pairs) => {
    if (expectedIndex === expected.length) {
      if (score > best.score) best = { score, pairs: [...pairs] }
      return
    }
    search(expectedIndex + 1, used, score, [...pairs, [expectedIndex, null]])
    for (let predictedIndex = 0; predictedIndex < predicted.length; predictedIndex += 1) {
      if (used.has(predictedIndex)) continue
      const pairScore = similarity(expected[expectedIndex], predicted[predictedIndex])
      if (pairScore < 5) continue
      used.add(predictedIndex)
      search(expectedIndex + 1, used, score + pairScore, [...pairs, [expectedIndex, predictedIndex]])
      used.delete(predictedIndex)
    }
  }
  search(0, new Set(), 0, [])
  return best.pairs
}

function exactRef(left, right) {
  return stableJson(left) === stableJson(right)
}

function scoreCandidate(expected, predicted, composition) {
  const directivePairs = bestAlignment(expected.directives, predicted.directives, directiveSimilarity)
  const observationPairs = bestAlignment(expected.observations, predicted.observations, observationSimilarity)
  const matchedPredictedDirectives = new Set(directivePairs.filter(([, p]) => p !== null).map(([, p]) => p))
  const matchedPredictedObservations = new Set(observationPairs.filter(([, p]) => p !== null).map(([, p]) => p))
  const scopeCounts = { tp: 0, fp: 0, fn: 0 }
  const fields = Object.fromEntries(['action', 'object', 'time', 'material', 'event', 'location', 'revision'].map((name) => [name, { correct: 0, total: 0 }]))
  const axes = Object.fromEntries([...SEMANTIC_AXES, 'inferenceLevel', 'actionType', 'effect'].map((name) => [name, { correct: 0, total: 0 }]))
  let semanticBundleCorrect = 0
  let expectedNodes = expected.directives.length + expected.observations.length
  let matchedNodes = 0
  const exactDirectiveIds = new Map()

  for (const [expectedIndex, predictedIndex] of directivePairs) {
    const left = expected.directives[expectedIndex]
    const right = predictedIndex === null ? null : predicted.directives[predictedIndex]
    if (right) {
      matchedNodes += 1
      exactDirectiveIds.set(left.id, right.id)
      const overlap = setOverlap(left.propositionScopeIds, right.propositionScopeIds)
      scopeCounts.tp += overlap
      scopeCounts.fn += left.propositionScopeIds.length - overlap
      scopeCounts.fp += right.propositionScopeIds.length - overlap
    } else {
      scopeCounts.fn += left.propositionScopeIds.length
    }
    const compare = (name, a, b) => {
      fields[name].total += 1
      if (right && exactRef(a, b)) fields[name].correct += 1
    }
    compare('action', left.action, right?.action)
    compare('object', left.object, right?.object)
    compare('time', left.timeRefs, right?.timeRefs)
    compare('material', left.materialRefs, right?.materialRefs)
    compare('event', left.eventRef, right?.eventRef)
    compare('location', left.locationRef, right?.locationRef)
    for (const axis of SEMANTIC_AXES) {
      axes[axis].total += 1
      if (right && left.semantics[axis] === right.semantics?.[axis]) axes[axis].correct += 1
    }
    for (const axis of ['inferenceLevel', 'actionType', 'effect']) {
      axes[axis].total += 1
      if (right && left[axis] === right[axis]) axes[axis].correct += 1
    }
    if (right && exactRef(left.semantics, right.semantics) && left.inferenceLevel === right.inferenceLevel
      && left.actionType === right.actionType && left.effect === right.effect) semanticBundleCorrect += 1
  }
  for (const [expectedIndex, predictedIndex] of observationPairs) {
    const left = expected.observations[expectedIndex]
    const right = predictedIndex === null ? null : predicted.observations[predictedIndex]
    if (right) {
      matchedNodes += 1
      const overlap = setOverlap(left.propositionScopeIds, right.propositionScopeIds)
      scopeCounts.tp += overlap
      scopeCounts.fn += left.propositionScopeIds.length - overlap
      scopeCounts.fp += right.propositionScopeIds.length - overlap
    } else {
      scopeCounts.fn += left.propositionScopeIds.length
    }
    for (const [name, a, b] of [['time', left.timeRefs, right?.timeRefs], ['location', left.locationRef, right?.locationRef]]) {
      fields[name].total += 1
      if (right && exactRef(a, b)) fields[name].correct += 1
    }
    for (const axis of SEMANTIC_AXES) {
      axes[axis].total += 1
      if (right && left.semantics[axis] === right.semantics?.[axis]) axes[axis].correct += 1
    }
    axes.inferenceLevel.total += 1
    if (right && left.inferenceLevel === right.inferenceLevel) axes.inferenceLevel.correct += 1
    if (right && exactRef(left.semantics, right.semantics) && left.inferenceLevel === right.inferenceLevel) semanticBundleCorrect += 1
  }
  for (const [index, right] of predicted.directives.entries()) {
    if (!matchedPredictedDirectives.has(index)) scopeCounts.fp += right.propositionScopeIds.length
  }
  for (const [index, right] of predicted.observations.entries()) {
    if (!matchedPredictedObservations.has(index)) scopeCounts.fp += right.propositionScopeIds.length
  }
  for (const [expectedIndex, predictedIndex] of directivePairs) {
    fields.revision.total += 1
    if (predictedIndex === null) continue
    const left = expected.directives[expectedIndex].revisionRefs.map((ref) => ({
      ...ref,
      targetDirectiveId: exactDirectiveIds.get(ref.targetDirectiveId) ?? '__missing__',
    }))
    if (exactRef(left, predicted.directives[predictedIndex].revisionRefs)) fields.revision.correct += 1
  }
  const selected = new Map(composition?.suggestions?.map((item) => [item.id.replace(/^task:/u, ''), item.selected]) ?? [])
  let forbiddenDefaultSelections = 0
  let safeDefaultCorrect = 0
  let safeDefaultTotal = 0
  let missedSafeDefaults = 0
  for (const [expectedIndex, predictedIndex] of directivePairs) {
    const item = expected.directives[expectedIndex]
    if (item.expectedDefaultSelected) {
      safeDefaultTotal += 1
      const correct = predictedIndex !== null && selected.get(predicted.directives[predictedIndex].id) === true
      if (correct) safeDefaultCorrect += 1
      else missedSafeDefaults += 1
    }
  }
  for (const suggestion of composition?.suggestions ?? []) {
    if (suggestion.selected && expected.forbiddenDefaultSurfaces.some((surface) => suggestion.action.includes(surface)
      || suggestion.object.includes(surface))) forbiddenDefaultSelections += 1
  }
  const nodePrecision = ratio(matchedNodes, predicted.directives.length + predicted.observations.length)
  const nodeRecall = ratio(matchedNodes, expectedNodes)
  const nodeF1 = nodePrecision === null || nodeRecall === null || nodePrecision + nodeRecall === 0
    ? null : 2 * nodePrecision * nodeRecall / (nodePrecision + nodeRecall)
  const scopePrecision = ratio(scopeCounts.tp, scopeCounts.tp + scopeCounts.fp)
  const scopeRecall = ratio(scopeCounts.tp, scopeCounts.tp + scopeCounts.fn)
  const scopeF1 = scopePrecision === null || scopeRecall === null || scopePrecision + scopeRecall === 0
    ? null : 2 * scopePrecision * scopeRecall / (scopePrecision + scopeRecall)
  const allFieldsExact = Object.values(fields).every((field) => field.correct === field.total)
  const allAxesExact = Object.values(axes).every((axis) => axis.correct === axis.total)
  return {
    requiresActionCorrect: predicted.requiresAction === expected.requiresAction,
    expectedNodes,
    predictedNodes: predicted.directives.length + predicted.observations.length,
    matchedNodes,
    nodePrecision,
    nodeRecall,
    nodeF1,
    scopeCounts,
    scopePrecision,
    scopeRecall,
    scopeF1,
    fields,
    axes,
    semanticBundleCorrect,
    semanticBundleTotal: expectedNodes,
    ignoredScopeExact: exactRef(expected.ignoredScopeIds, predicted.ignoredScopeIds),
    completeCase: predicted.requiresAction === expected.requiresAction && matchedNodes === expectedNodes
      && predicted.directives.length === expected.directives.length && predicted.observations.length === expected.observations.length
      && scopeCounts.fp === 0 && scopeCounts.fn === 0 && allFieldsExact && allAxesExact
      && semanticBundleCorrect === expectedNodes && exactRef(expected.ignoredScopeIds, predicted.ignoredScopeIds),
    forbiddenDefaultSelections,
    safeDefaultCorrect,
    safeDefaultTotal,
    missedSafeDefaults,
  }
}

function failClosedScore(expected) {
  const score = scoreCandidate(expected, {
    requiresAction: false,
    directives: [],
    observations: [],
    ignoredScopeIds: [],
  }, null)
  score.requiresActionCorrect = false
  score.ignoredScopeExact = false
  score.completeCase = false
  return score
}

function aggregateScores(caseScores) {
  const sum = (selector) => caseScores.reduce((total, item) => total + selector(item), 0)
  const scopeTp = sum((item) => item.score?.scopeCounts.tp ?? 0)
  const scopeFp = sum((item) => item.score?.scopeCounts.fp ?? 0)
  const scopeFn = sum((item) => item.score?.scopeCounts.fn ?? 0)
  const scopePrecision = ratio(scopeTp, scopeTp + scopeFp)
  const scopeRecall = ratio(scopeTp, scopeTp + scopeFn)
  const scopeF1 = scopePrecision === null || scopeRecall === null || scopePrecision + scopeRecall === 0
    ? null : 2 * scopePrecision * scopeRecall / (scopePrecision + scopeRecall)
  const axes = Object.fromEntries([...SEMANTIC_AXES, 'inferenceLevel', 'actionType', 'effect'].map((axis) => {
    const correct = sum((item) => item.score?.axes[axis].correct ?? 0)
    const total = sum((item) => item.score?.axes[axis].total ?? 0)
    return [axis, ratio(correct, total)]
  }))
  const fields = Object.fromEntries(['action', 'object', 'time', 'material', 'event', 'location', 'revision'].map((field) => {
    const correct = sum((item) => item.score?.fields[field].correct ?? 0)
    const total = sum((item) => item.score?.fields[field].total ?? 0)
    return [field, ratio(correct, total)]
  }))
  const matchedNodes = sum((item) => item.score?.matchedNodes ?? 0)
  const expectedNodes = sum((item) => item.score?.expectedNodes ?? 0)
  const predictedNodes = sum((item) => item.score?.predictedNodes ?? 0)
  const nodePrecision = ratio(matchedNodes, predictedNodes)
  const nodeRecall = ratio(matchedNodes, expectedNodes)
  return {
    completedCases: caseScores.filter((item) => item.candidateStatus === 'completed').length,
    candidateSchemaValidCases: caseScores.filter((item) => item.candidateSchemaValid).length,
    verifierCompletedCases: caseScores.filter((item) => item.verifierStatus === 'completed').length,
    verifierSchemaValidCases: caseScores.filter((item) => item.verifierSchemaValid).length,
    requiresActionAccuracy: ratio(sum((item) => item.score?.requiresActionCorrect ? 1 : 0), caseScores.length),
    nodePrecision,
    nodeRecall,
    nodeF1: nodePrecision === null || nodeRecall === null || nodePrecision + nodeRecall === 0 ? null : 2 * nodePrecision * nodeRecall / (nodePrecision + nodeRecall),
    scopePrecision,
    scopeRecall,
    scopeF1,
    semanticAxes: axes,
    semanticBundleAccuracy: ratio(sum((item) => item.score?.semanticBundleCorrect ?? 0), sum((item) => item.score?.semanticBundleTotal ?? 0)),
    fieldAccuracy: fields,
    ignoredScopeExactAccuracy: ratio(sum((item) => item.score?.ignoredScopeExact ? 1 : 0), caseScores.length),
    completeCaseAccuracy: ratio(sum((item) => item.score?.completeCase ? 1 : 0), caseScores.length),
    forbiddenDefaultSelections: sum((item) => item.score?.forbiddenDefaultSelections ?? 0),
    safeDefaultRecall: ratio(sum((item) => item.score?.safeDefaultCorrect ?? 0), sum((item) => item.score?.safeDefaultTotal ?? 0)),
    missedSafeDefaults: sum((item) => item.score?.missedSafeDefaults ?? 0),
  }
}

export async function buildEvaluation(dataset, records) {
  const cases = []
  for (const fixture of dataset.cases) {
    const index = await indexFor(fixture)
    const expected = materializeExpected(fixture, index)
    const candidateRecord = recordFor(records, fixture.id, 'candidate')
    const verifierRecord = recordFor(records, fixture.id, 'verifier')
    const candidateValidation = candidateRecord?.status === 'completed'
      ? validateScopeReferenceCandidate(candidateRecord.parsed, index)
      : { valid: false, issues: [{ category: 'schema', code: 'CANDIDATE_NOT_COMPLETED', path: 'candidate' }] }
    const candidateRunIdentityValid = candidateValidation.valid
      && candidateRecord.parsed.producerRunId === `candidate-${RUN_ID}-${fixture.id}`
    if (candidateValidation.valid && !candidateRunIdentityValid) {
      candidateValidation.valid = false
      candidateValidation.issues.push({ category: 'binding', code: 'PRODUCER_RUN_ID_MISMATCH', path: 'candidate.producerRunId' })
    }
    let verifierValidation = { valid: false, issues: [{ category: 'verification', code: 'VERIFIER_NOT_COMPLETED', path: 'verification' }] }
    let composition = null
    if (candidateValidation.valid && verifierRecord?.status === 'completed') {
      verifierValidation = await validateScopeReferenceVerification(verifierRecord.parsed, index, candidateRecord.parsed)
      const verifierIdentityValid = verifierRecord.parsed.method === 'independent_semantic_verifier'
        && verifierRecord.parsed.verifierRunId === `verifier-${RUN_ID}-${fixture.id}`
      if (verifierValidation.valid && !verifierIdentityValid) {
        verifierValidation.valid = false
        verifierValidation.issues.push({ category: 'binding', code: 'VERIFIER_IDENTITY_MISMATCH', path: 'verification' })
      }
      if (verifierValidation.valid) {
        const composed = await composeScopeReferenceCandidate(index, candidateRecord.parsed, verifierRecord.parsed, {
          trustedVerifierRunIds: new Set([`verifier-${RUN_ID}-${fixture.id}`]),
        })
        if (composed.ok) composition = composed.value
      }
    }
    const score = candidateValidation.valid ? scoreCandidate(expected, candidateRecord.parsed, composition) : failClosedScore(expected)
    cases.push({
      caseId: fixture.id,
      candidateStatus: candidateRecord?.status ?? 'missing',
      candidateSchemaValid: candidateValidation.valid,
      candidateSchemaIssues: issueCodes(candidateValidation),
      verifierStatus: verifierRecord?.status ?? 'missing',
      verifierSchemaValid: verifierValidation.valid,
      verifierSchemaIssues: issueCodes(verifierValidation),
      compositionSucceeded: composition !== null,
      score,
    })
  }
  const metrics = aggregateScores(cases)
  const criticalSemanticMinimum = Math.min(...['actor', 'speechAct', 'polarity', 'tense', 'status', 'validity', 'modality', 'inferenceLevel', 'actionType', 'effect']
    .map((axis) => metrics.semanticAxes[axis] ?? 0))
  let decision = { code: 'PROMISING_FOR_NEW_DEVELOPMENT_REPLICATION', reason: '全部预注册 Development 门槛通过；仍需新的独立数据复验。' }
  if (metrics.candidateSchemaValidCases !== 12 || metrics.verifierCompletedCases !== 12 || metrics.verifierSchemaValidCases !== 12) {
    decision = { code: 'INVALID_RUN', reason: 'candidate 未达到 12/12 Schema 合格，或应调用 verifier 未全部完成且 Schema 合格。' }
  } else if (metrics.forbiddenDefaultSelections > 0) {
    decision = { code: 'REJECT_CANDIDATE', reason: '出现了禁止默认勾选的建议。' }
  } else if ((metrics.scopeF1 ?? 0) < 0.9 || criticalSemanticMinimum < 0.9 || (metrics.semanticBundleAccuracy ?? 0) < 0.85
    || (metrics.requiresActionAccuracy ?? 0) < 0.95 || (metrics.completeCaseAccuracy ?? 0) < 0.75 || (metrics.safeDefaultRecall ?? 0) < 0.9) {
    decision = { code: 'NO_PROMOTION', reason: '至少一项预注册的 scope、关键语义、完整案例或安全默认门槛未通过。' }
  }
  return { cases, metrics, criticalSemanticMinimum, decision }
}

export function renderReport(result) {
  const metrics = result.evaluation.metrics
  const semanticRows = Object.entries(metrics.semanticAxes).map(([axis, value]) => `| ${axis} | ${percent(value)} |`).join('\n')
  const fieldRows = Object.entries(metrics.fieldAccuracy).map(([field, value]) => `| ${field} | ${percent(value)} |`).join('\n')
  const caseRows = result.evaluation.cases.map((item) => `| ${item.caseId} | ${item.candidateStatus} | ${item.candidateSchemaValid ? 'PASS' : 'FAIL'} | ${item.verifierStatus} | ${item.verifierSchemaValid ? 'PASS' : 'FAIL'} | ${item.score?.completeCase ? 'PASS' : 'FAIL'} |`).join('\n')
  return `# RCO-5-006-B1-M1 真实模型验证报告\n\n## 结论\n\n- 实验判定：\`${result.evaluation.decision.code}\`\n- 原因：${result.evaluation.decision.reason}\n- 产品决定：\`NO_PROMOTION / DO_NOT_LAUNCH\`\n- 证据边界：12 个匿名合成 Development 案例、单一 Codex 作者参考答案；不是独立人工真值、真实材料、真人修改时间、浏览器验收或上线证据。\n\n## 运行事实\n\n- model：\`${result.model}\`\n- temperature：\`${result.temperature}\`\n- candidate：${result.requestAccounting.candidateDispatches}/12\n- verifier：${result.requestAccounting.verifierDispatches}/最多 12\n- 总请求：${result.requestAccounting.requestDispatches}/24\n- 确认回执：${result.requestAccounting.confirmedResponses}\n- 回执未知：${result.requestAccounting.dispatchUnknown}\n- 上游不合格而跳过 verifier：${result.requestAccounting.skippedBeforeDispatch}\n- Repair / retry：0 / 0\n- Provider billed cost：\`NOT_OBSERVABLE\`\n- Token：${result.usage.complete ? `${result.usage.inputTokens} input / ${result.usage.outputTokens} output / ${result.usage.totalTokens} total` : `不完整（${result.usage.observedRecords}/${result.usage.dispatchedRecords} 个请求返回 usage）`}\n- 保守峰值代理成本：${result.observedConservativePeakPriceCostCny === null ? 'NOT OBSERVABLE' : `${result.observedConservativePeakPriceCostCny.toFixed(6)} CNY`}\n- 全轮理论上限：${result.maximumTheoreticalCostCny.toFixed(6)} CNY，低于 10 CNY 硬上限\n\n## 主指标\n\n| 指标 | 结果 | 门槛 |\n|---|---:|---:|\n| candidate Schema | ${metrics.candidateSchemaValidCases}/12 | 12/12 |\n| verifier Schema | ${metrics.verifierSchemaValidCases}/12 | 12/12 应调用项 |\n| scope Precision | ${percent(metrics.scopePrecision)} | 报告 |\n| scope Recall | ${percent(metrics.scopeRecall)} | 报告 |\n| scope F1 | ${percent(metrics.scopeF1)} | ≥90% |\n| requiresAction | ${percent(metrics.requiresActionAccuracy)} | ≥95% |\n| 关键语义最低轴 | ${percent(result.evaluation.criticalSemanticMinimum)} | ≥90% |\n| 完整语义 bundle | ${percent(metrics.semanticBundleAccuracy)} | ≥85% |\n| Complete Case | ${percent(metrics.completeCaseAccuracy)} | ≥75% |\n| Forbidden Default | ${metrics.forbiddenDefaultSelections} | 0 |\n| Safe Default Recall | ${percent(metrics.safeDefaultRecall)} | ≥90% |\n| Missed Safe Default | ${metrics.missedSafeDefaults} | 报告 |\n\n## 语义分轴\n\n| 轴 | 正确率 |\n|---|---:|\n${semanticRows}\n\n## 字段引用\n\n| 字段 | 完全匹配率 |\n|---|---:|\n${fieldRows}\n\n## 逐例状态\n\n| 案例 | candidate | candidate Schema | verifier | verifier Schema | Complete Case |\n|---|---|---|---|---|---|\n${caseRows}\n\n## 解释边界\n\n- Expected、默认标签和 forbidden 标签从未进入模型请求，只在本机评分时读取。\n- 模型只输出 scope ID 与受控语义；原文位置、逐字证据、关系和 selected 均由本机构造。\n- candidate 不合格即不调用 verifier；失败保留在固定分母，不 Repair、不 retry。\n- candidate 与 verifier 虽有独立 run ID，但使用同一供应商和同一模型，不等于独立人工复核。\n- 本轮未修改稳定路径，未启动 RCO-6，未部署。\n`
}

async function initialize() {
  const verified = await verifyFrozenInputs()
  try {
    await readFile(absolute(CHECKPOINT_PATH), 'utf8')
    throw new Error('RUN_ALREADY_INITIALIZED')
  } catch (error) {
    if (!(error && typeof error === 'object' && error.code === 'ENOENT')) throw error
  }
  const contract = await withContractHashes(immutableCheckpointContract(verified, new Date().toISOString()))
  const checkpoint = createCheckpoint(contract)
  await saveState(checkpoint, [])
  await atomicWrite(PRECALL_REPORT_PATH, `# RCO-5-006-B1-M1 联网前冻结报告\n\n- authorization：\`${AUTHORIZATION_ID}\`\n- run：\`${RUN_ID}\`；前一 run \`rco-5-006-b1-m1-20260903a\` 因剪贴板不是密钥而在本机构造请求头前终止，裁定为 0 次真实模型调用。\n- model：\`${MODEL}\`\n- candidate：12 次；verifier：最多 12 次；总调用：最多 24 次。\n- temperature：0；Repair / retry：0 / 0。\n- 人民币硬上限：10 CNY；理论最坏代理成本：${verified.maximumTheoreticalCostCny.toFixed(6)} CNY。\n- Dataset、Expected、scopeIndex、plan、validator、cache：未修改。\n- 模型调用 / 网络请求 / Secret access：0 / 0 / NONE。\n- 密钥策略：先验证单行 Bearer-safe 格式和 Headers 可构造性，再写 dispatch；密钥只从当前进程环境读取一次，仅驻留内存，不写 checkpoint、result、report、日志或 Git。\n- 稳定路径 / RCO-6 / 部署：UNCHANGED / BLOCKED / NOT_RUN。\n`)
  return { verified, checkpoint }
}

async function verifyInitialized() {
  const verified = await verifyFrozenInputs()
  const checkpoint = await loadJson(CHECKPOINT_PATH)
  const raw = await loadJson(RAW_RESULTS_PATH)
  const validation = await validateCheckpoint(checkpoint, verified)
  if (!validation.valid) throw new Error(`CHECKPOINT_INVALID:${validation.issues.join(',')}`)
  if (raw.runId !== RUN_ID || !Array.isArray(raw.records)) throw new Error('RAW_RESULTS_INVALID')
  if (new Set(raw.records.map((item) => item.key)).size !== raw.records.length) throw new Error('RAW_RESULTS_DUPLICATE')
  if (raw.records.some((item) => item.attemptNo !== 1)) throw new Error('RAW_RESULTS_RETRY_DETECTED')
  return { verified, checkpoint, records: raw.records }
}

async function execute(apiKey, resume) {
  const state = await verifyInitialized()
  const { verified, checkpoint, records } = state
  if (!resume && checkpoint.entries.length > 0) throw new Error('RUN_ALREADY_STARTED_USE_EXPLICIT_RESUME')
  if (checkpoint.entries.some((entry) => entry.state === 'dispatched' || entry.state === 'transport_failure')) {
    throw new Error('UNKNOWN_RECEIPT_REQUIRES_HUMAN_ADJUDICATION')
  }
  let stopReason = null
  for (const fixture of verified.dataset.cases) {
    const key = `${fixture.id}:candidate`
    if (checkpoint.entries.some((entry) => entry.key === key)) continue
    const record = await dispatchOnce({ apiKey, checkpoint, records, fixture, role: 'candidate' })
    console.log(`PROGRESS ${checkpointCounts(checkpoint).requestDispatches}/24 ${fixture.id} candidate ${record.status}`)
    if (checkpointCounts(checkpoint).requestDispatches === 1 && record.status !== 'completed') {
      stopReason = `FIRST_REQUEST_NOT_COMPLETED:${record.failureCode ?? record.status}`
      break
    }
    if (record.status === 'transport_failure') {
      stopReason = 'UNKNOWN_RECEIPT_REQUIRES_HUMAN_ADJUDICATION'
      break
    }
  }
  if (!stopReason) {
    for (const fixture of verified.dataset.cases) {
      const verifierKey = `${fixture.id}:verifier`
      if (checkpoint.entries.some((entry) => entry.key === verifierKey)) continue
      const candidateRecord = recordFor(records, fixture.id, 'candidate')
      const index = await indexFor(fixture)
      const validation = candidateRecord?.status === 'completed'
        ? validateScopeReferenceCandidate(candidateRecord.parsed, index)
        : { valid: false, issues: [{ category: 'schema', code: 'CANDIDATE_NOT_COMPLETED', path: 'candidate' }] }
      if (validation.valid && candidateRecord.parsed.producerRunId !== `candidate-${RUN_ID}-${fixture.id}`) {
        validation.valid = false
        validation.issues.push({ category: 'binding', code: 'PRODUCER_RUN_ID_MISMATCH', path: 'candidate.producerRunId' })
      }
      if (!validation.valid) {
        const issues = issueCodes(validation)
        markSkipped(checkpoint, fixture, issues)
        records.push({
          key: verifierKey,
          caseId: fixture.id,
          role: 'verifier',
          dispatched: false,
          attemptNo: 1,
          status: 'skipped_upstream_invalid',
          failureCode: 'UPSTREAM_CANDIDATE_SCHEMA_INVALID',
          schemaIssues: issues,
          providerUsage: null,
        })
        await saveState(checkpoint, records)
        console.log(`PROGRESS ${checkpointCounts(checkpoint).requestDispatches}/24 ${fixture.id} verifier skipped_upstream_invalid`)
        continue
      }
      const record = await dispatchOnce({ apiKey, checkpoint, records, fixture, role: 'verifier', candidateRecord })
      console.log(`PROGRESS ${checkpointCounts(checkpoint).requestDispatches}/24 ${fixture.id} verifier ${record.status}`)
      if (record.status === 'transport_failure') {
        stopReason = 'UNKNOWN_RECEIPT_REQUIRES_HUMAN_ADJUDICATION'
        break
      }
    }
  }
  const finalValidation = await validateCheckpoint(checkpoint, verified)
  if (!finalValidation.valid) throw new Error(`FINAL_CHECKPOINT_INVALID:${finalValidation.issues.join(',')}`)
  const evaluation = await buildEvaluation(verified.dataset, records)
  const usage = aggregateUsage(records)
  const requestAccounting = {
    ...checkpointCounts(checkpoint),
    candidateDispatches: checkpoint.entries.filter((entry) => entry.role === 'candidate' && entry.dispatchedAt).length,
    verifierDispatches: checkpoint.entries.filter((entry) => entry.role === 'verifier' && entry.dispatchedAt).length,
  }
  const result = {
    schemaVersion: 'rco-5-006-b1-m1-result-1.0.0',
    runId: RUN_ID,
    authorizationId: AUTHORIZATION_ID,
    generatedAt: new Date().toISOString(),
    runStatus: stopReason ? 'STOPPED_FAIL_CLOSED' : 'FINISHED',
    stopReason,
    datasetId: verified.dataset.datasetId,
    datasetClassification: verified.dataset.classification,
    labelProvenance: verified.dataset.labelProvenance,
    model: MODEL,
    endpoint: ENDPOINT,
    apiStyle: API_STYLE,
    temperature: TEMPERATURE,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    plannedCandidateCalls: PLANNED_CANDIDATE_CALLS,
    maximumVerifierCalls: MAXIMUM_VERIFIER_CALLS,
    maximumRequestDispatches: MAX_REQUEST_DISPATCHES,
    repairCalls: 0,
    retryCalls: 0,
    cnyHardCap: CNY_CAP,
    maximumTheoreticalCostCny: verified.maximumTheoreticalCostCny,
    providerBilledCost: 'NOT_OBSERVABLE',
    observedConservativePeakPriceCostCny: usage.complete ? peakCostCny(usage.inputTokens, usage.outputTokens) : null,
    requestAccounting,
    usage,
    evaluation,
    checkpointSha256: await fileSha(CHECKPOINT_PATH),
    rawResultsSha256: await fileSha(RAW_RESULTS_PATH),
    protectedArtifactsModified: false,
    stablePath: 'UNCHANGED',
    rco6: 'BLOCKED',
    deployment: 'NOT_RUN',
    secretPersistence: 'NONE',
    evidenceBoundary: 'Synthetic Development only; not independent human ground truth, real-material accuracy, user modification time, browser acceptance, release evidence or production authorization',
  }
  await atomicJson(RESULT_PATH, result)
  await atomicWrite(REPORT_PATH, renderReport(result))
  return result
}

async function selfTest() {
  const verified = await verifyFrozenInputs()
  if (MAX_REQUEST_DISPATCHES !== PLANNED_CANDIDATE_CALLS + MAXIMUM_VERIFIER_CALLS) throw new Error('CALL_ACCOUNTING_INVALID')
  if (verified.maximumTheoreticalCostCny >= CNY_CAP) throw new Error('BUDGET_SELF_TEST_INVALID')
  if (!hasForbiddenRequestKey({ nested: { expected: true } }) || hasForbiddenRequestKey({ sourceText: 'expected 是原文普通单词' })) {
    throw new Error('REQUEST_LEAK_GUARD_INVALID')
  }
  let invalidCredentialRejected = false
  try { validateApiKey('这不是密钥\n也不能进入请求头') } catch { invalidCredentialRejected = true }
  if (!invalidCredentialRejected) throw new Error('CREDENTIAL_PREFLIGHT_SELF_TEST_INVALID')
  const fixture = verified.dataset.cases[0]
  const built = await buildRequest('candidate', fixture)
  if (hasForbiddenRequestKey(JSON.parse(built.body.input[0].content[0].text))) throw new Error('EXPECTED_LEAK_IN_REAL_REQUEST')
  if (built.body.text.format.schema.additionalProperties !== false) throw new Error('STRICT_SCHEMA_MISSING')
  const adversarial = { ...JSON.parse(JSON.stringify(built.body.text.format.schema)), selected: true }
  if (!forbiddenModelOutputKey(adversarial)) throw new Error('FORBIDDEN_OUTPUT_GUARD_INVALID')
  return verified
}

async function main() {
  if (process.argv.includes('--self-test')) {
    const verified = await selfTest()
    console.log(JSON.stringify({
      status: 'PASS',
      mode: 'self-test',
      datasetId: verified.dataset.datasetId,
      maximumTheoreticalCostCny: verified.maximumTheoreticalCostCny,
      modelCalls: 0,
      networkDispatches: 0,
      secretAccess: 'NONE',
    }))
    return
  }
  if (process.argv.includes('--init')) {
    const initialized = await initialize()
    console.log(JSON.stringify({
      status: 'PASS',
      mode: 'initialized',
      runId: RUN_ID,
      runnerSha256: initialized.checkpoint.runnerSha256,
      maximumTheoreticalCostCny: initialized.verified.maximumTheoreticalCostCny,
      modelCalls: 0,
      networkDispatches: 0,
      secretAccess: 'NONE',
    }))
    return
  }
  if (!process.argv.includes('--run')) {
    const state = await verifyInitialized()
    console.log(JSON.stringify({
      status: 'PASS',
      mode: 'verify-only',
      runId: RUN_ID,
      requestAccounting: checkpointCounts(state.checkpoint),
      modelCalls: 0,
      networkDispatches: 0,
      secretAccess: 'NONE',
    }))
    return
  }
  const authorization = process.argv.find((item) => item.startsWith('--authorization-id='))?.split('=')[1]
  const runId = process.argv.find((item) => item.startsWith('--run-id='))?.split('=')[1]
  const cnyCap = Number(process.argv.find((item) => item.startsWith('--cny-cap='))?.split('=')[1])
  if (authorization !== AUTHORIZATION_ID || runId !== RUN_ID || cnyCap !== CNY_CAP) throw new Error('PAID_AUTHORIZATION_ARGUMENT_MISMATCH')
  const apiKey = String(process.env.RCO_SCOPE_B1_DEEPSEEK_API_KEY ?? '').trim()
  if (!apiKey) throw new Error('RCO_SCOPE_B1_DEEPSEEK_API_KEY_REQUIRED')
  validateApiKey(apiKey)
  const result = await execute(apiKey, process.argv.includes('--resume'))
  console.log(JSON.stringify({
    status: result.runStatus,
    runId: RUN_ID,
    requestAccounting: result.requestAccounting,
    decision: result.evaluation.decision,
    usage: result.usage,
    observedConservativePeakPriceCostCny: result.observedConservativePeakPriceCostCny,
  }))
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main().catch((error) => {
  console.error(`RCO_5_006_B1_M1_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}`)
  process.exitCode = 1
})
