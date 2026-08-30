/* global console, fetch, process */
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { EnvHttpProxyAgent } from 'undici'
import { ARMS, scoreCase, sha256, summarizeEvaluation } from './multimodal-evaluation-lib.mjs'

const ROOT = process.cwd()
const DEFAULT_DATA_DIR = '.evaluation-cache/multimodal-unseen-v2'
const DEFAULT_ENDPOINT = 'https://student-affairs-manager-multimodal-exp.nightsdell.workers.dev'
const DEFAULT_EXPECTED_MODEL = 'deepseek-v4-flash-vision-exp'
const proxyDispatcher = process.env.HTTPS_PROXY || process.env.HTTP_PROXY ? new EnvHttpProxyAgent() : undefined

function option(name, fallback = '') {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function normalizedOcrText(value) {
  return String(value ?? '')
    .replaceAll('\r', '')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
}

function characterErrorRate(reference, observed) {
  const left = String(reference).replace(/\s/gu, '')
  const right = String(observed).replace(/\s/gu, '')
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row]
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + Number(left[row - 1] !== right[column - 1]),
      )
    }
    previous = current
  }
  return left.length ? previous[right.length] / left.length : Number(right.length > 0)
}

function ocrDiagnostics(dataset, ocr) {
  const ocrByCase = new Map(ocr.cases.map((item) => [item.caseId, item]))
  const cases = dataset.cases.map((fixture) => ({
    caseId: fixture.id,
    modality: fixture.modality,
    characterErrorRate: characterErrorRate(fixture.sourceText, ocrByCase.get(fixture.id)?.text ?? ''),
    confidence: ocrByCase.get(fixture.id)?.confidence ?? null,
  }))
  const mean = (items, selector) => items.reduce((total, item) => total + selector(item), 0) / Math.max(1, items.length)
  return {
    meanCharacterErrorRate: mean(cases, (item) => item.characterErrorRate),
    meanCharacterErrorRateByModality: Object.fromEntries(['screenshot', 'photo', 'scan'].map((modality) => {
      const selected = cases.filter((item) => item.modality === modality)
      return [modality, mean(selected, (item) => item.characterErrorRate)]
    })),
    meanObservableConfidence: mean(cases.filter((item) => Number.isFinite(item.confidence)), (item) => item.confidence),
    cases,
  }
}

function verifyDataset(dataset, dataDir) {
  if (dataset.schemaVersion !== 'multimodal-synthetic-unseen-dataset-1.1.0' || dataset.sampleCount !== 36) {
    throw new Error('DATASET_CONTRACT_INVALID')
  }
  const hashPayload = dataset.cases.map((fixture) => ({
    id: fixture.id,
    scenarioFamilyId: fixture.scenarioFamilyId,
    modality: fixture.modality,
    sourceSha256: fixture.sourceSha256,
    imageSha256: fixture.imageSha256,
    expectedSha256: fixture.expectedSha256,
  }))
  if (sha256(stableJson(hashPayload)) !== dataset.datasetSha256) throw new Error('DATASET_HASH_MISMATCH')
  const scenarioFamilies = new Map()
  for (const fixture of dataset.cases) {
    if (!/^scenario-[0-9]{2}$/u.test(fixture.scenarioFamilyId)) throw new Error(`SCENARIO_FAMILY_INVALID:${fixture.id}`)
    scenarioFamilies.set(fixture.scenarioFamilyId, (scenarioFamilies.get(fixture.scenarioFamilyId) ?? 0) + 1)
    if (sha256(fixture.sourceText) !== fixture.sourceSha256) throw new Error(`SOURCE_HASH_MISMATCH:${fixture.id}`)
    if (sha256(stableJson(fixture.expected)) !== fixture.expectedSha256) throw new Error(`EXPECTED_HASH_MISMATCH:${fixture.id}`)
    const imagePath = path.join(dataDir, fixture.imagePath)
    fixture.absoluteImagePath = imagePath
  }
  if (scenarioFamilies.size !== 12 || [...scenarioFamilies.values()].some((count) => count !== 3)) {
    throw new Error('SCENARIO_FAMILY_BALANCE_INVALID')
  }
}

async function verifyImages(dataset) {
  for (const fixture of dataset.cases) {
    const bytes = await readFile(fixture.absoluteImagePath)
    if (sha256(bytes) !== fixture.imageSha256) throw new Error(`IMAGE_HASH_MISMATCH:${fixture.id}`)
    fixture.imageBytes = bytes
  }
}

async function prepareOcr(dataset, dataDir) {
  const ocrFile = path.join(dataDir, 'ocr.json')
  try {
    const cached = JSON.parse(await readFile(ocrFile, 'utf8'))
    const matching = cached.datasetSha256 === dataset.datasetSha256
      && cached.cases.length === dataset.sampleCount
      && cached.cases.every((item) => dataset.cases.some((fixture) => (
        fixture.id === item.caseId && fixture.imageSha256 === item.imageSha256 && sha256(item.text) === item.textSha256
      )))
    if (matching) return cached
  } catch (error) {
    if (!(error && typeof error === 'object' && error.code === 'ENOENT')) throw error
  }

  const { createWorker, OEM } = await import('tesseract.js')
  let currentCase = 'loading'
  const worker = await createWorker(['chi_sim', 'eng'], OEM.LSTM_ONLY, {
    cachePath: path.join(dataDir, 'tessdata-cache'),
    logger: (event) => {
      if (event.status === 'recognizing text' && Math.round(event.progress * 100) % 25 === 0) {
        console.log(`[ocr] ${currentCase} ${Math.round(event.progress * 100)}%`)
      }
    },
  })
  const cases = []
  try {
    for (const [index, fixture] of dataset.cases.entries()) {
      currentCase = fixture.id
      const result = await worker.recognize(fixture.absoluteImagePath)
      const text = normalizedOcrText(result.data.text)
      const item = {
        caseId: fixture.id,
        imageSha256: fixture.imageSha256,
        text,
        textSha256: sha256(text),
        confidence: Number.isFinite(result.data.confidence) ? result.data.confidence : null,
      }
      cases.push(item)
      console.log(`[ocr ${index + 1}/${dataset.sampleCount}] ${fixture.id} chars=${text.length} confidence=${item.confidence ?? 'NOT_OBSERVABLE'}`)
    }
  } finally {
    await worker.terminate()
  }
  const ocrBundleSha256 = sha256(stableJson(cases.map(({ caseId, imageSha256, textSha256 }) => ({ caseId, imageSha256, textSha256 }))))
  const payload = {
    schemaVersion: 'multimodal-local-ocr-bundle-1.0.0',
    datasetSha256: dataset.datasetSha256,
    ocrBundleSha256,
    generatedAt: new Date().toISOString(),
    method: 'tesseract.js-7.0.0-chi_sim+eng-local-unverified',
    cases,
  }
  await writeFile(ocrFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return payload
}

function armOrder(caseId) {
  const permutations = [
    ['T', 'I', 'IT'], ['T', 'IT', 'I'], ['I', 'T', 'IT'],
    ['I', 'IT', 'T'], ['IT', 'T', 'I'], ['IT', 'I', 'T'],
  ]
  return permutations[Number.parseInt(sha256(caseId).slice(0, 2), 16) % permutations.length]
}

function requestBody(fixture, arm) {
  const base = {
    sourceType: fixture.sourceType,
    sourceTitle: fixture.sourceTitle,
    referenceTime: fixture.referenceTime,
    timezone: fixture.timezone,
    projectCandidates: [],
    existingTasks: [],
  }
  if (arm === 'T') return { ...base, content: fixture.ocrText }
  const image = {
    dataUrl: `data:${fixture.mimeType};base64,${fixture.imageBytes.toString('base64')}`,
    mimeType: fixture.mimeType,
    label: path.basename(fixture.imagePath),
    byteLength: fixture.imageBytes.byteLength,
    ...(fixture.modality === 'scan' ? { pageNumber: 1 } : {}),
  }
  return {
    ...base,
    ...(arm === 'IT' ? { content: fixture.ocrText } : {}),
    consent: true,
    inputMode: fixture.modality === 'scan' ? 'pdf-pages' : 'image',
    ocrTextIncluded: arm === 'IT',
    ...(arm === 'I' ? { evaluationArm: 'image_only' } : {}),
    images: [image],
  }
}

function classifyFailure(httpStatus, errorCode) {
  if (errorCode === 'MODEL_MISMATCH') return 'model_mismatch'
  if (errorCode === 'INVALID_AI_RESPONSE') return 'schema'
  if (errorCode === 'UPSTREAM_AUTH_FAILED' || httpStatus === 401 || httpStatus === 403) return 'authentication'
  if (errorCode === 'UPSTREAM_BILLING_BLOCKED' || httpStatus === 402) return 'billing'
  if (errorCode === 'RATE_LIMITED' || httpStatus === 429) return 'rate_limit'
  if (errorCode === 'UPSTREAM_MODEL_UNAVAILABLE') return 'model_unavailable'
  if (httpStatus === 400 || errorCode === 'INVALID_REQUEST' || errorCode?.includes('INVALID')) return 'request_contract'
  if (httpStatus >= 500) return 'upstream'
  return 'transport'
}

async function execute(endpoint, fixture, arm, expectedModel) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 55_000)
  const started = Date.now()
  try {
    const response = await fetch(`${endpoint}/api/deepseek/${arm === 'T' ? 'extract' : 'extract-multimodal'}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', origin: endpoint },
      body: JSON.stringify(requestBody(fixture, arm)),
      signal: controller.signal,
      ...(proxyDispatcher ? { dispatcher: proxyDispatcher } : {}),
    })
    const payload = await response.json().catch(() => null)
    const latencyMs = Date.now() - started
    if (!response.ok || !payload?.result) {
      const errorCode = payload?.error ?? payload?.code ?? 'INVALID_RESPONSE'
      return scoreCase(fixture, arm, null, {
        status: 'request_failure',
        failureReason: `${response.status} ${errorCode}`,
        failureCategory: classifyFailure(response.status, errorCode),
        latencyMs,
      })
    }
    const returnedModel = payload.model ?? payload.result.modelName ?? null
    if (returnedModel !== expectedModel || payload.result.modelName !== expectedModel) {
      return scoreCase(fixture, arm, null, {
        status: 'request_failure',
        failureReason: `MODEL_MISMATCH expected=${expectedModel} response=${returnedModel ?? 'missing'} result=${payload.result.modelName ?? 'missing'}`,
        failureCategory: 'model_mismatch',
        latencyMs,
      })
    }
    const scored = scoreCase(fixture, arm, payload.result, {
      latencyMs,
      tokenUsage: payload?.execution?.tokenUsage ?? null,
    })
    return {
      ...scored,
      providerRequestId: payload.requestId ?? null,
      returnedModel,
      promptVersion: payload.result.promptVersion ?? null,
      resultSha256: sha256(stableJson(payload.result)),
    }
  } catch (error) {
    const safeCode = error && typeof error === 'object' && error.cause && typeof error.cause === 'object'
      ? String(error.cause.code ?? '').slice(0, 80)
      : ''
    return scoreCase(fixture, arm, null, {
      status: 'request_failure',
      failureReason: error instanceof Error ? `${error.name}${safeCode ? `:${safeCode}` : ''}` : 'NETWORK_FAILURE',
      failureCategory: 'transport',
      latencyMs: Date.now() - started,
    })
  } finally {
    clearTimeout(timeout)
  }
}

function verifyFreeze(freeze, dataset, ocr, expectedModel) {
  if (freeze.schemaVersion !== 'multimodal-synthetic-unseen-freeze-1.1.0'
    || freeze.status !== 'FROZEN_BEFORE_MODEL_CALLS'
    || freeze.firstModelCallAtAtFreeze !== null) {
    throw new Error('FREEZE_CONTRACT_INVALID')
  }
  if (freeze.datasetId !== dataset.datasetId
    || freeze.datasetSha256 !== dataset.datasetSha256
    || freeze.ocrBundleSha256 !== ocr.ocrBundleSha256
    || freeze.sampleCount !== dataset.sampleCount) {
    throw new Error('FROZEN_INPUT_HASH_MISMATCH')
  }
  if (freeze.expectedModel !== expectedModel
    || ARMS.some((arm) => freeze.arms?.[arm]?.model !== expectedModel)) {
    throw new Error('FROZEN_MODEL_CONTRACT_MISMATCH')
  }
  if (freeze.arms?.I?.ocrTextInClientRequest !== false
    || freeze.arms?.I?.ocrTextInWorkerPrompt !== false
    || freeze.arms?.I?.ocrTextInWorkerNormalization !== false) {
    throw new Error('IMAGE_ONLY_ISOLATION_NOT_FROZEN')
  }
  if (!(Date.parse(freeze.frozenAt) > Date.parse(ocr.generatedAt))) throw new Error('FREEZE_TIMESTAMP_INVALID')
  const ocrByCase = new Map(ocr.cases.map((item) => [item.caseId, item]))
  const frozenByCase = new Map((freeze.cases ?? []).map((item) => [item.id, item]))
  if (frozenByCase.size !== dataset.sampleCount) throw new Error('FREEZE_CASE_COUNT_MISMATCH')
  for (const fixture of dataset.cases) {
    const frozen = frozenByCase.get(fixture.id)
    const ocrItem = ocrByCase.get(fixture.id)
    if (!frozen || !ocrItem
      || frozen.scenarioFamilyId !== fixture.scenarioFamilyId
      || frozen.modality !== fixture.modality
      || frozen.sourceSha256 !== fixture.sourceSha256
      || frozen.imageSha256 !== fixture.imageSha256
      || frozen.expectedSha256 !== fixture.expectedSha256
      || frozen.ocrTextSha256 !== ocrItem.textSha256) {
      throw new Error(`FREEZE_CASE_HASH_MISMATCH:${fixture.id}`)
    }
  }
}

async function main() {
  const dataDir = path.resolve(ROOT, option('data-dir', DEFAULT_DATA_DIR))
  const dataset = JSON.parse(await readFile(path.join(dataDir, 'dataset.json'), 'utf8'))
  verifyDataset(dataset, dataDir)
  await verifyImages(dataset)
  const ocr = await prepareOcr(dataset, dataDir)
  const diagnostics = ocrDiagnostics(dataset, ocr)
  console.log(JSON.stringify({ datasetSha256: dataset.datasetSha256, ocrBundleSha256: ocr.ocrBundleSha256, ocrMethod: ocr.method, diagnostics }))
  if (option('ocr-only', 'false') === 'true') return

  const freezeFile = option('freeze-file')
  if (!freezeFile) throw new Error('--freeze-file is required before any model call')
  const freezeText = await readFile(path.resolve(ROOT, freezeFile), 'utf8')
  const freeze = JSON.parse(freezeText)
  const expectedModel = option('expected-model', DEFAULT_EXPECTED_MODEL)
  verifyFreeze(freeze, dataset, ocr, expectedModel)
  const freezeSha256 = sha256(freezeText)
  const endpoint = option('endpoint', DEFAULT_ENDPOINT).replace(/\/$/u, '')
  const label = option('label')
  if (!/^[a-z0-9][a-z0-9._-]{2,100}$/u.test(label)) throw new Error('A fresh lowercase --label is required')
  const delayMs = Number(option('delay-ms', '8500'))
  const limit = Number(option('limit', '0'))
  const resume = option('resume', 'false') === 'true'
  const selectedCases = limit > 0 ? dataset.cases.slice(0, limit) : dataset.cases
  const selectedCaseIds = selectedCases.map((fixture) => fixture.id)
  const ocrByCase = new Map(ocr.cases.map((item) => [item.caseId, item]))
  selectedCases.forEach((fixture) => { fixture.ocrText = ocrByCase.get(fixture.id)?.text ?? '' })
  if (selectedCases.some((fixture) => !fixture.ocrText)) throw new Error('OCR_TEXT_EMPTY')

  const runsDir = path.join(dataDir, 'runs')
  await mkdir(runsDir, { recursive: true })
  const checkpointFile = path.join(runsDir, `${label}.checkpoint.json`)
  let checkpoint = {
    schemaVersion: 'multimodal-evaluation-checkpoint-1.1.0',
    label,
    datasetId: dataset.datasetId,
    datasetSha256: dataset.datasetSha256,
    ocrBundleSha256: ocr.ocrBundleSha256,
    freezeSha256,
    endpoint,
    expectedModel,
    selectedCaseIds,
    startedAt: new Date().toISOString(),
    observations: [],
  }
  try {
    const existing = JSON.parse(await readFile(checkpointFile, 'utf8'))
    if (!resume) throw new Error(`REFUSING_TO_OVERWRITE:${checkpointFile}`)
    if (existing.schemaVersion !== checkpoint.schemaVersion
      || existing.label !== label
      || existing.datasetId !== dataset.datasetId
      || existing.datasetSha256 !== dataset.datasetSha256
      || existing.ocrBundleSha256 !== ocr.ocrBundleSha256
      || existing.freezeSha256 !== freezeSha256
      || existing.endpoint !== endpoint
      || existing.expectedModel !== expectedModel
      || stableJson(existing.selectedCaseIds) !== stableJson(selectedCaseIds)) {
      throw new Error('CHECKPOINT_CONTRACT_MISMATCH')
    }
    checkpoint = existing
  } catch (error) {
    if (!(error && typeof error === 'object' && error.code === 'ENOENT')) throw error
  }

  const completed = new Map(checkpoint.observations.map((item) => [`${item.caseId}:${item.arm}`, item]))
  const order = selectedCases.flatMap((fixture) => armOrder(fixture.id).map((arm) => ({ fixture, arm })))
  for (const [index, { fixture, arm }] of order.entries()) {
    const key = `${fixture.id}:${arm}`
    if (completed.has(key)) {
      console.log(`[${index + 1}/${order.length}] ${fixture.id} ${arm} resumed`)
      continue
    }
    const observation = await execute(endpoint, fixture, arm, expectedModel)
    completed.set(key, observation)
    checkpoint.observations = [...completed.values()]
    await writeFile(checkpointFile, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8')
    const taskF1 = Number.isFinite(observation.task.f1) ? observation.task.f1.toFixed(3) : 'NOT_APPLICABLE'
    console.log(`[${index + 1}/${order.length}] ${fixture.id} ${arm} ${observation.status} taskF1=${taskF1} corrections=${observation.correctionOperations} latency=${observation.latencyMs}ms`)
    if (delayMs > 0 && index < order.length - 1) await sleep(delayMs)
  }

  const observations = [...completed.values()].filter((item) => selectedCases.some((fixture) => fixture.id === item.caseId) && ARMS.includes(item.arm))
  if (observations.length !== selectedCases.length * ARMS.length) throw new Error('OBSERVATION_MATRIX_INCOMPLETE')
  const completedModels = [...new Set(observations.filter((item) => item.status === 'completed').map((item) => item.returnedModel))]
  const failureCountsByCategory = observations.filter((item) => item.status !== 'completed').reduce((counts, item) => ({
    ...counts,
    [item.failureCategory ?? 'unknown']: (counts[item.failureCategory ?? 'unknown'] ?? 0) + 1,
  }), {})
  const summary = {
    ...summarizeEvaluation({ ...dataset, sampleCount: selectedCases.length }, observations),
    label,
    endpoint,
    expectedModel,
    modelContract: {
      completedModels,
      allCompletedResponsesUsedExpectedModel: completedModels.length === 1 && completedModels[0] === expectedModel,
    },
    failureCountsByCategory,
    startedAt: checkpoint.startedAt,
    completedAt: new Date().toISOString(),
    ocrBundleSha256: ocr.ocrBundleSha256,
    ocrMethod: ocr.method,
    ocrDiagnostics: diagnostics,
    inputDisclosure: {
      T: 'local OCR text only',
      I: 'image plus title/reference metadata only; no OCR in the client request, Worker prompt, upstream request or Worker normalization; offline scorer alone uses frozen ground truth',
      IT: 'same image plus the identical local OCR text used by T',
    },
    groundTruthSentToModel: false,
    apiKeyPersisted: false,
    resultIntegrity: 'raw normalized predictions retained only in git-ignored checkpoint',
  }
  const summaryFile = path.join(runsDir, `${label}.summary.json`)
  await writeFile(summaryFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(summary, null, 2))
}

await main()
