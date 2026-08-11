import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

const ROOT = process.cwd()
const LABELS_PATH = path.join(ROOT, 'docs/e2-path-a-planning/p6-router-labels.json')
const OUTPUT_PATH = path.join(ROOT, '.evaluation-cache/e2-7/p7-validator-review.json')
const CACHE_FILES = [
  '.evaluation-cache/deepseek-production-golden-e2-7-p6-router-golden.json',
  '.evaluation-cache/deepseek-production-holdout-e2-7-p6-router-holdout.json',
  '.evaluation-cache/deepseek-production-generalization-e2-7-p6-router-development.json',
]

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function allTasks(result) {
  return [...result.standaloneTasks, ...result.milestones.flatMap((milestone) => [
    ...milestone.tasks,
    ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
  ])]
}

const labels = JSON.parse(await readFile(LABELS_PATH, 'utf8'))
const cacheEntries = (await Promise.all(CACHE_FILES.map(async (file) => JSON.parse(await readFile(path.join(ROOT, file), 'utf8'))))).flat()
const cacheById = new Map(cacheEntries.map((entry) => [entry.caseId, entry]))
const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })

try {
  const [golden, holdout, development, scoring, validator] = await Promise.all([
    vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
    vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
    vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
    vite.ssrLoadModule('/src/recognition/e2/scoring.ts'),
    vite.ssrLoadModule('/src/recognition/qualityValidator.ts'),
  ])
  const fixtures = new Map([
    ...golden.recognitionGoldenDataset,
    ...holdout.recognitionHoldoutDataset,
    ...development.recognitionGeneralizationDevelopmentDataset,
  ].map((entry) => [entry.id, entry]))
  const cases = labels.labels.map((label) => {
    const fixture = fixtures.get(label.caseId)
    const cached = cacheById.get(label.caseId)
    if (!fixture || !cached?.result || cached.status !== 'ok') throw new Error(`Missing current P7 input ${label.caseId}`)
    const strict = scoring.scoreRecognitionCase(fixture, 'deepseek-production', cached.result, cached.latencyMs, { tokenUsage: cached.tokenUsage, costUsd: cached.costUsd })
    const report = validator.validateRecognitionQuality(cached.result, fixture.rawText)
    return {
      caseId: label.caseId,
      sourceSet: label.sourceSet,
      sourceSha256: cached.sourceSha256,
      inputSha256: cached.inputSha256,
      resultSha256: cached.resultSha256 ?? sha256(JSON.stringify(cached.result)),
      modelName: cached.result.modelName,
      promptVersion: cached.result.promptVersion,
      pipelineVersion: cached.execution?.pipelineVersion ?? null,
      source: fixture.rawText,
      expected: {
        tasks: fixture.expected.tasks.map((task) => ({ key: task.key, action: task.actionAliases, object: task.objectAliases })),
        materials: fixture.expected.materials.map((material) => material.nameAliases),
        timePoints: fixture.expected.timePoints.map((time) => ({ key: time.key, type: time.type, raw: time.rawIncludes, value: time.normalizedLocal, precision: time.precision, needsConfirmation: time.needsConfirmation })),
        events: fixture.expected.events.map((event) => ({ key: event.key, title: event.titleAliases })),
        ambiguities: fixture.expected.ambiguities,
      },
      prediction: {
        tasks: allTasks(cached.result).map((task) => ({ id: task.tempId, title: task.title, action: task.actionVerb, object: task.actionObject, materials: task.materialTempIds, times: task.timePointTempIds })),
        materials: cached.result.materials.map((material) => ({ id: material.tempId, name: material.name, required: material.required, tasks: material.relatedTaskTempIds })),
        timePoints: cached.result.timePoints.map((time) => ({ id: time.tempId, type: time.type, raw: time.rawText, value: time.normalizedValue, precision: time.precision, needsConfirmation: time.needsConfirmation })),
        events: cached.result.events.map((event) => ({ id: event.tempId, title: event.title, start: event.startTimePointTempId, end: event.endTimePointTempId })),
        ambiguities: cached.result.ambiguities.map((ambiguity) => ({ field: ambiguity.field, message: ambiguity.message })),
      },
      strictFailures: strict.failures,
      validatorIssues: report.issues,
    }
  })
  await writeFile(OUTPUT_PATH, `${JSON.stringify({ schemaVersion: 'e2.7-p7-validator-review-1.0.0', caseCount: cases.length, cases }, null, 2)}\n`, 'utf8')
  process.stdout.write(`${OUTPUT_PATH}\n${cases.length}\n`)
} finally {
  await vite.close()
}
