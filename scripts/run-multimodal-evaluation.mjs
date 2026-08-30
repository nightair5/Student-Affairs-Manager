/* global console, fetch, process */
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { EnvHttpProxyAgent } from 'undici'
import { ARMS, scoreCase, sha256, summarizeEvaluation } from './multimodal-evaluation-lib.mjs'

const ROOT = process.cwd()
const DEFAULT_DATA_DIR = '.evaluation-cache/multimodal-unseen-v1'
const DEFAULT_ENDPOINT = 'https://student-affairs-manager-multimodal-exp.nightsdell.workers.dev'
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
  if (dataset.schemaVersion !== 'multimodal-synthetic-unseen-dataset-1.0.0' || dataset.sampleCount !== 36) {
    throw new Error('DATASET_CONTRACT_INVALID')
  }
  const hashPayload = dataset.cases.map((fixture) => ({
    id: fixture.id,
    modality: fixture.modality,
    sourceSha256: fixture.sourceSha256,
    imageSha256: fixture.imageSha256,
    expectedSha256: fixture.expectedSha256,
  }))
  if (sha256(stableJson(hashPayload)) !== dataset.datasetSha256) throw new Error('DATASET_HASH_MISMATCH')
  for (const fixture of dataset.cases) {
    if (sha256(fixture.sourceText) !== fixture.sourceSha256) throw new Error(`SOURCE_HASH_MISMATCH:${fixture.id}`)
    if (sha256(stableJson(fixture.expected)) !== fixture.expectedSha256) throw new Error(`EXPECTED_HASH_MISMATCH:${fixture.id}`)
    const imagePath = path.join(dataDir, fixture.imagePath)
    fixture.absoluteImagePath = imagePath
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
    content: fixture.ocrText,
    referenceTime: fixture.referenceTime,
    timezone: fixture.timezone,
    projectCandidates: [],
    existingTasks: [],
  }
  if (arm === 'T') return base
  const image = {
    dataUrl: `data:${fixture.mimeType};base64,${fixture.imageBytes.toString('base64')}`,
    mimeType: fixture.mimeType,
    label: path.basename(fixture.imagePath),
    byteLength: fixture.imageBytes.byteLength,
    ...(fixture.modality === 'scan' ? { pageNumber: 1 } : {}),
  }
  return {
    ...base,
    consent: true,
    inputMode: fixture.modality === 'scan' ? 'pdf-pages' : 'image',
    ocrTextIncluded: arm === 'IT',
    ...(arm === 'I' ? { evaluationArm: 'image_only' } : {}),
    images: [image],
  }
}

async function execute(endpoint, fixture, arm) {
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
      return scoreCase(fixture, arm, null, {
        status: 'request_failure',
        failureReason: `${response.status} ${payload?.error ?? payload?.code ?? 'INVALID_RESPONSE'}`,
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
      returnedModel: payload.model ?? payload.result.modelName ?? null,
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
      latencyMs: Date.now() - started,
    })
  } finally {
    clearTimeout(timeout)
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
  const freeze = JSON.parse(await readFile(path.resolve(ROOT, freezeFile), 'utf8'))
  if (freeze.datasetSha256 !== dataset.datasetSha256 || freeze.ocrBundleSha256 !== ocr.ocrBundleSha256) {
    throw new Error('FROZEN_INPUT_HASH_MISMATCH')
  }
  const endpoint = option('endpoint', DEFAULT_ENDPOINT).replace(/\/$/u, '')
  const label = option('label')
  if (!/^[a-z0-9][a-z0-9._-]{2,100}$/u.test(label)) throw new Error('A fresh lowercase --label is required')
  const delayMs = Number(option('delay-ms', '8500'))
  const limit = Number(option('limit', '0'))
  const resume = option('resume', 'false') === 'true'
  const selectedCases = limit > 0 ? dataset.cases.slice(0, limit) : dataset.cases
  const ocrByCase = new Map(ocr.cases.map((item) => [item.caseId, item]))
  selectedCases.forEach((fixture) => { fixture.ocrText = ocrByCase.get(fixture.id)?.text ?? '' })
  if (selectedCases.some((fixture) => !fixture.ocrText)) throw new Error('OCR_TEXT_EMPTY')

  const runsDir = path.join(dataDir, 'runs')
  await mkdir(runsDir, { recursive: true })
  const checkpointFile = path.join(runsDir, `${label}.checkpoint.json`)
  let checkpoint = { schemaVersion: 'multimodal-evaluation-checkpoint-1.0.0', label, datasetSha256: dataset.datasetSha256, ocrBundleSha256: ocr.ocrBundleSha256, endpoint, startedAt: new Date().toISOString(), observations: [] }
  try {
    const existing = JSON.parse(await readFile(checkpointFile, 'utf8'))
    if (!resume) throw new Error(`REFUSING_TO_OVERWRITE:${checkpointFile}`)
    if (existing.datasetSha256 !== dataset.datasetSha256 || existing.ocrBundleSha256 !== ocr.ocrBundleSha256) throw new Error('CHECKPOINT_HASH_MISMATCH')
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
    const observation = await execute(endpoint, fixture, arm)
    completed.set(key, observation)
    checkpoint.observations = [...completed.values()]
    await writeFile(checkpointFile, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8')
    console.log(`[${index + 1}/${order.length}] ${fixture.id} ${arm} ${observation.status} taskF1=${observation.task.f1.toFixed(3)} corrections=${observation.correctionOperations} latency=${observation.latencyMs}ms`)
    if (delayMs > 0 && index < order.length - 1) await sleep(delayMs)
  }

  const observations = [...completed.values()].filter((item) => selectedCases.some((fixture) => fixture.id === item.caseId) && ARMS.includes(item.arm))
  const summary = {
    ...summarizeEvaluation({ ...dataset, sampleCount: selectedCases.length }, observations),
    label,
    endpoint,
    startedAt: checkpoint.startedAt,
    completedAt: new Date().toISOString(),
    ocrBundleSha256: ocr.ocrBundleSha256,
    ocrMethod: ocr.method,
    ocrDiagnostics: diagnostics,
    inputDisclosure: {
      T: 'local OCR text only',
      I: 'image plus title/reference metadata; OCR retained server-side only for evidence validation and not sent upstream',
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
