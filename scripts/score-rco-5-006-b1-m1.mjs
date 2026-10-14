/* global console, process */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildEvaluation, renderReport } from './run-rco-5-006-b1-m1.mjs'

const ROOT = process.cwd()
const RUN_ID = 'rco-5-006-b1-m1-20260903b'
const RUN_DIR = `docs/recognition-optimization/rco-5-006-b1-runs/${RUN_ID}`
const CHECKPOINT_PATH = `${RUN_DIR}/checkpoint.json`
const RAW_RESULTS_PATH = `${RUN_DIR}/raw-results.json`
const RESULT_PATH = `${RUN_DIR}/result.json`
const REPORT_PATH = `${RUN_DIR}/REPORT.md`
const DATASET_PATH = 'docs/recognition-optimization/RCO-5-006-B1_DEVELOPMENT_DATASET.json'
const PROTECTED_PATHS = [
  DATASET_PATH,
  'docs/recognition-optimization/RCO-5-006-B1_FREEZE.json',
  'docs/recognition-optimization/RCO-5-006-B1_PLAN.md',
  'src/recognition/scopeIndexV11.ts',
  'src/recognition/scopeReferenceContract.ts',
]
const MODEL = 'deepseek-v4-flash-vision-exp'
const MAXIMUM_THEORETICAL_COST_CNY = 8.5046016
const PEAK_INPUT_USD_PER_MILLION = 0.44
const PEAK_OUTPUT_USD_PER_MILLION = 1.32
const CONSERVATIVE_CNY_PER_USD = 10

async function sha256(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function absolute(relativePath) {
  return path.join(ROOT, relativePath)
}

async function fileSha(relativePath) {
  return sha256(await readFile(absolute(relativePath)))
}

async function loadJson(relativePath) {
  return JSON.parse(await readFile(absolute(relativePath), 'utf8'))
}

async function atomicWrite(relativePath, contents) {
  const target = absolute(relativePath)
  await mkdir(path.dirname(target), { recursive: true })
  const temporary = `${target}.tmp-${process.pid}`
  await writeFile(temporary, contents, 'utf8')
  await rename(temporary, target)
}

async function atomicJson(relativePath, value) {
  await atomicWrite(relativePath, `${JSON.stringify(value, null, 2)}\n`)
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

function peakCostCny(inputTokens, outputTokens) {
  return ((inputTokens * PEAK_INPUT_USD_PER_MILLION + outputTokens * PEAK_OUTPUT_USD_PER_MILLION) / 1_000_000)
    * CONSERVATIVE_CNY_PER_USD
}

function validateRun(checkpoint, envelope, dataset, hashes) {
  const issues = []
  const records = envelope.records
  if (checkpoint.runId !== RUN_ID || envelope.runId !== RUN_ID) issues.push('RUN_ID_MISMATCH')
  if (checkpoint.authorizationId !== 'RCO-5-006-B1-M1') issues.push('AUTHORIZATION_MISMATCH')
  if (checkpoint.model !== MODEL || checkpoint.authorization?.model !== MODEL) issues.push('MODEL_MISMATCH')
  if (checkpoint.authorization?.maximumModelCalls !== 24 || checkpoint.authorization?.cnyHardCap !== 10) issues.push('PAID_CAP_MISMATCH')
  if (checkpoint.authorization?.temperature !== 0 || checkpoint.authorization?.repairCalls !== 0 || checkpoint.authorization?.retryCalls !== 0) issues.push('METHOD_MISMATCH')
  if (dataset.cases?.length !== 12 || checkpoint.datasetSha256 !== hashes[DATASET_PATH]) issues.push('DATASET_BINDING_MISMATCH')
  const bindings = {
    'docs/recognition-optimization/RCO-5-006-B1_FREEZE.json': 'priorDataFreezeSha256',
    'docs/recognition-optimization/RCO-5-006-B1_PLAN.md': 'planSha256',
    'src/recognition/scopeIndexV11.ts': 'scopeIndexSha256',
    'src/recognition/scopeReferenceContract.ts': 'contractSha256',
  }
  for (const [file, field] of Object.entries(bindings)) if (checkpoint[field] !== hashes[file]) issues.push(`PROTECTED_HASH_MISMATCH:${file}`)
  if (!Array.isArray(checkpoint.entries) || !Array.isArray(records)) issues.push('ENTRY_ARRAY_INVALID')
  if (checkpoint.entries?.length !== 24 || records?.length !== 24) issues.push('LOGICAL_DENOMINATOR_INCOMPLETE')
  const checkpointKeys = checkpoint.entries?.map((entry) => entry.key) ?? []
  const recordKeys = records?.map((entry) => entry.key) ?? []
  if (new Set(checkpointKeys).size !== checkpointKeys.length || new Set(recordKeys).size !== recordKeys.length) issues.push('DUPLICATE_ENTRY')
  if (checkpointKeys.some((key) => !recordKeys.includes(key)) || recordKeys.some((key) => !checkpointKeys.includes(key))) issues.push('CHECKPOINT_RAW_MISMATCH')
  if (checkpoint.entries?.some((entry) => entry.attemptNo !== 1) || records?.some((entry) => entry.attemptNo !== 1)) issues.push('RETRY_DETECTED')
  const dispatched = records?.filter((record) => record.dispatched) ?? []
  if (dispatched.length !== 22) issues.push('DISPATCH_COUNT_MISMATCH')
  if (dispatched.some((record) => record.status !== 'completed' || record.httpStatus !== 200
    || !record.providerRequestId || record.returnedModel !== MODEL || !record.responseSha256)) issues.push('DISPATCH_EVIDENCE_INVALID')
  const candidates = records?.filter((record) => record.role === 'candidate') ?? []
  const verifiers = records?.filter((record) => record.role === 'verifier') ?? []
  if (candidates.length !== 12 || candidates.some((record) => !record.dispatched || record.status !== 'completed')) issues.push('CANDIDATE_COMPLETION_INVALID')
  if (verifiers.length !== 12 || verifiers.filter((record) => record.dispatched).length !== 10
    || verifiers.filter((record) => record.status === 'skipped_upstream_invalid').length !== 2) issues.push('VERIFIER_ACCOUNTING_INVALID')
  if (records?.some((record) => record.status === 'transport_failure')) issues.push('UNKNOWN_RECEIPT_PRESENT')
  return { valid: issues.length === 0, issues }
}

async function main() {
  const [checkpoint, envelope, dataset] = await Promise.all([
    loadJson(CHECKPOINT_PATH), loadJson(RAW_RESULTS_PATH), loadJson(DATASET_PATH),
  ])
  const hashes = Object.fromEntries(await Promise.all(PROTECTED_PATHS.map(async (item) => [item, await fileSha(item)])))
  const validation = validateRun(checkpoint, envelope, dataset, hashes)
  if (!validation.valid) throw new Error(`RUN_INTEGRITY_INVALID:${validation.issues.join(',')}`)
  const evaluation = await buildEvaluation(dataset, envelope.records)
  const usage = aggregateUsage(envelope.records)
  const requestAccounting = {
    logicalEntries: checkpoint.entries.length,
    requestDispatches: envelope.records.filter((record) => record.dispatched).length,
    candidateDispatches: envelope.records.filter((record) => record.role === 'candidate' && record.dispatched).length,
    verifierDispatches: envelope.records.filter((record) => record.role === 'verifier' && record.dispatched).length,
    confirmedResponses: envelope.records.filter((record) => record.dispatched && record.status === 'completed').length,
    dispatchUnknown: envelope.records.filter((record) => record.status === 'transport_failure').length,
    skippedBeforeDispatch: envelope.records.filter((record) => record.status === 'skipped_upstream_invalid').length,
    completed: envelope.records.filter((record) => record.status === 'completed').length,
  }
  const result = {
    schemaVersion: 'rco-5-006-b1-m1-result-1.0.0',
    runId: RUN_ID,
    authorizationId: 'RCO-5-006-B1-M1',
    generatedAt: new Date().toISOString(),
    runStatus: 'FINISHED',
    stopReason: null,
    datasetId: dataset.datasetId,
    datasetClassification: dataset.classification,
    labelProvenance: dataset.labelProvenance,
    model: MODEL,
    endpoint: 'https://api.deepseek.com/responses',
    apiStyle: 'responses-v1-json-schema',
    temperature: 0,
    maxOutputTokens: 5_000,
    plannedCandidateCalls: 12,
    maximumVerifierCalls: 12,
    maximumRequestDispatches: 24,
    repairCalls: 0,
    retryCalls: 0,
    cnyHardCap: 10,
    maximumTheoreticalCostCny: MAXIMUM_THEORETICAL_COST_CNY,
    providerBilledCost: 'NOT_OBSERVABLE',
    observedConservativePeakPriceCostCny: usage.complete ? peakCostCny(usage.inputTokens, usage.outputTokens) : null,
    requestAccounting,
    usage,
    evaluation,
    checkpointSha256: await fileSha(CHECKPOINT_PATH),
    rawResultsSha256: await fileSha(RAW_RESULTS_PATH),
    requestRunnerSha256: checkpoint.runnerSha256,
    scoringRunnerSha256: await fileSha('scripts/score-rco-5-006-b1-m1.mjs'),
    scoringCorrection: 'DerivedSuggestion.action/object are strings; scorer now checks them directly instead of reading a nonexistent surface child.',
    protectedArtifactsModified: false,
    stablePath: 'UNCHANGED',
    rco6: 'BLOCKED',
    deployment: 'NOT_RUN',
    secretPersistence: 'NONE',
    evidenceBoundary: 'Synthetic Development only; not independent human ground truth, real-material accuracy, user modification time, browser acceptance, release evidence or production authorization',
  }
  await atomicJson(RESULT_PATH, result)
  const report = renderReport(result).replace(
    '- 证据边界：12 个匿名合成 Development 案例、单一 Codex 作者参考答案；不是独立人工真值、真实材料、真人修改时间、浏览器验收或上线证据。\n',
    '- 证据边界：12 个匿名合成 Development 案例、单一 Codex 作者参考答案；不是独立人工真值、真实材料、真人修改时间、浏览器验收或上线证据。\n- 计分口径：契约不合格案例按全错进入固定分母，下面是 fail-closed 产品下界；由于整轮 `INVALID_RUN`，不得把这些诊断数字宣传为正式模型准确率。\n',
  )
  await atomicWrite(REPORT_PATH, report)
  console.log(JSON.stringify({
    status: 'PASS',
    mode: 'local-score-only',
    modelCalls: 0,
    networkDispatches: 0,
    requestAccounting,
    decision: evaluation.decision,
    metrics: evaluation.metrics,
    usage,
    observedConservativePeakPriceCostCny: result.observedConservativePeakPriceCostCny,
  }))
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main().catch((error) => {
  console.error(`RCO_5_006_B1_M1_SCORING_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}`)
  process.exitCode = 1
})
