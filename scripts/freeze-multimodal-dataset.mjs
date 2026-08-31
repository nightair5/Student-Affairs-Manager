/* global console, process */
import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { sha256 } from './multimodal-evaluation-lib.mjs'

const ROOT = process.cwd()
const DEFAULT_DATA_DIR = '.evaluation-cache/multimodal-unseen-v2'
const DEFAULT_OUTPUT = 'docs/e2-multimodal-experiment/SYNTHETIC_UNSEEN_V2_FREEZE.json'
const MODEL = 'deepseek-v4-flash-vision-exp'

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

async function assertAbsent(file) {
  try {
    await access(file)
    throw new Error(`REFUSING_TO_OVERWRITE:${file}`)
  } catch (error) {
    if (!(error && typeof error === 'object' && error.code === 'ENOENT')) throw error
  }
}

async function main() {
  const dataDir = path.resolve(ROOT, option('data-dir', DEFAULT_DATA_DIR))
  const output = path.resolve(ROOT, option('output', DEFAULT_OUTPUT))
  const expectedDatasetId = option('expected-dataset-id', 'synthetic-unseen-v2')
  await assertAbsent(output)
  const dataset = JSON.parse(await readFile(path.join(dataDir, 'dataset.json'), 'utf8'))
  const ocr = JSON.parse(await readFile(path.join(dataDir, 'ocr.json'), 'utf8'))
  if (dataset.schemaVersion !== 'multimodal-synthetic-unseen-dataset-1.1.0'
    || dataset.datasetId !== expectedDatasetId
    || dataset.sampleCount !== 36
    || ocr.datasetSha256 !== dataset.datasetSha256
    || ocr.cases?.length !== dataset.sampleCount) {
    throw new Error('FREEZE_INPUT_CONTRACT_INVALID')
  }
  const datasetHashPayload = dataset.cases.map((item) => ({
    id: item.id,
    scenarioFamilyId: item.scenarioFamilyId,
    modality: item.modality,
    sourceSha256: item.sourceSha256,
    imageSha256: item.imageSha256,
    expectedSha256: item.expectedSha256,
  }))
  if (sha256(stableJson(datasetHashPayload)) !== dataset.datasetSha256) throw new Error('DATASET_HASH_MISMATCH')
  const ocrHashPayload = ocr.cases.map(({ caseId, imageSha256, textSha256 }) => ({ caseId, imageSha256, textSha256 }))
  if (sha256(stableJson(ocrHashPayload)) !== ocr.ocrBundleSha256) throw new Error('OCR_BUNDLE_HASH_MISMATCH')
  const ocrByCase = new Map(ocr.cases.map((item) => [item.caseId, item]))
  const cases = []
  for (const fixture of dataset.cases) {
    const image = await readFile(path.join(dataDir, fixture.imagePath))
    const ocrItem = ocrByCase.get(fixture.id)
    if (!ocrItem
      || sha256(fixture.sourceText) !== fixture.sourceSha256
      || sha256(stableJson(fixture.expected)) !== fixture.expectedSha256
      || sha256(image) !== fixture.imageSha256
      || sha256(ocrItem.text) !== ocrItem.textSha256
      || ocrItem.imageSha256 !== fixture.imageSha256) {
      throw new Error(`CASE_HASH_MISMATCH:${fixture.id}`)
    }
    cases.push({
      id: fixture.id,
      scenarioFamilyId: fixture.scenarioFamilyId,
      modality: fixture.modality,
      sourceSha256: fixture.sourceSha256,
      imageSha256: fixture.imageSha256,
      expectedSha256: fixture.expectedSha256,
      ocrTextSha256: ocrItem.textSha256,
    })
  }
  const familyCounts = cases.reduce((counts, item) => ({
    ...counts,
    [item.scenarioFamilyId]: (counts[item.scenarioFamilyId] ?? 0) + 1,
  }), {})
  if (Object.keys(familyCounts).length !== 12 || Object.values(familyCounts).some((count) => count !== 3)) {
    throw new Error('SCENARIO_FAMILY_BALANCE_INVALID')
  }

  const freeze = {
    schemaVersion: 'multimodal-synthetic-unseen-freeze-1.1.0',
    status: 'FROZEN_BEFORE_MODEL_CALLS',
    frozenAt: new Date().toISOString(),
    datasetId: dataset.datasetId,
    datasetSha256: dataset.datasetSha256,
    ocrBundleSha256: ocr.ocrBundleSha256,
    sampleCount: dataset.sampleCount,
    modalityCounts: dataset.modalityCounts,
    scenarioFamilyCounts: familyCounts,
    expectedModel: MODEL,
    provenance: {
      materials: 'deterministic anonymous synthetic templates generated after the applicable protocol amendment',
      groundTruth: 'author-written deterministic template facts; not derived from model output',
      classification: 'synthetic_proxy',
      claimBoundary: 'preliminary engineering evidence only; not real unseen student material',
      groundTruthSentToModel: false,
    },
    ocr: {
      method: ocr.method,
      generatedAt: ocr.generatedAt,
      exactTextHashesControlRun: true,
    },
    arms: {
      T: { model: MODEL, input: 'frozen local OCR text only' },
      I: {
        model: MODEL,
        input: 'original image or selected rendered page plus bounded metadata only',
        ocrTextInClientRequest: false,
        ocrTextInWorkerPrompt: false,
        ocrTextInWorkerNormalization: false,
        offlineGroundTruthUsedAfterCallForScoring: true,
      },
      IT: { model: MODEL, input: 'same original image or rendered page plus the identical frozen OCR text used by T' },
    },
    runRules: {
      pairedByCase: true,
      inferenceCluster: 'scenarioFamilyId; 12 independent template families, each rendered as screenshot/photo/scan',
      armOrder: 'deterministic hash-balanced permutation',
      temperature: 0.1,
      evaluatorRetries: 0,
      anyRequestFailureInvalidatesArmQualityMetrics: true,
      expectedMutationAfterRun: 'forbidden',
      semanticTuningAfterReveal: 'forbidden',
    },
    metrics: {
      primary: ['taskMicroF1', 'majorCorrectionRate', 'completeCaseAccuracy'],
      secondary: ['materialF1', 'timePointF1', 'eventF1', 'requiresActionAccuracy', 'forbiddenTaskRate', 'evidenceValidity'],
      proxyOnly: ['automatedCorrectionBurdenOperations'],
      notObservableWithoutHumanStudy: ['userModificationTimeSeconds'],
      noActionEmptyTaskF1: 'NOT_APPLICABLE',
    },
    promotionBoundary: {
      syntheticGate: 'IT task F1 must exceed T and I by at least 0.03; IT major correction rate must be at least 0.05 lower than both; clustered paired 95% intervals must not point in the opposite direction; all 108 requests must complete with the frozen model.',
      launchGate: 'Synthetic results can never authorize launch. Real unseen material, actual human timing, privacy/security, browser A-J and stability must still pass.',
    },
    firstModelCallAtAtFreeze: null,
    cases,
  }
  if (!(Date.parse(freeze.frozenAt) > Date.parse(ocr.generatedAt))) throw new Error('FREEZE_TIMESTAMP_INVALID')
  await writeFile(output, `${JSON.stringify(freeze, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ output, datasetSha256: dataset.datasetSha256, ocrBundleSha256: ocr.ocrBundleSha256, cases: cases.length }))
}

await main()
