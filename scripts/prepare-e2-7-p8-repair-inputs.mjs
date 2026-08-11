import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

const ROOT = process.cwd()
const REVIEW_PATH = path.join(ROOT, '.evaluation-cache/e2-7/p7-validator-review.json')
const INPUT_PATH = path.join(ROOT, '.evaluation-cache/e2-7/p8-repair-inputs.json')
const MANIFEST_PATH = path.join(ROOT, 'docs/e2-path-a-planning/p8-repair-input-manifest.json')
const CACHE_FILES = [
  '.evaluation-cache/deepseek-production-golden-e2-7-p6-router-golden.json',
  '.evaluation-cache/deepseek-production-holdout-e2-7-p6-router-holdout.json',
  '.evaluation-cache/deepseek-production-generalization-e2-7-p6-router-development.json',
]
const REPAIRABLE = new Set(['INVALID_EVIDENCE', 'MISSING_TIMEPOINT', 'POSSIBLE_FALSE_PRECISION', 'MISSING_AMBIGUITY', 'MISSING_MATERIAL', 'EVENT_TASK_CONFUSION'])
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const review = JSON.parse(await readFile(REVIEW_PATH, 'utf8'))
const cacheEntries = (await Promise.all(CACHE_FILES.map(async (file) => JSON.parse(await readFile(path.join(ROOT, file), 'utf8'))))).flat()
const cacheById = new Map(cacheEntries.map((entry) => [entry.caseId, entry]))
const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })

try {
  const validator = await vite.ssrLoadModule('/src/recognition/qualityValidator.ts')
  const inputs = review.cases.map((entry) => {
    const cached = cacheById.get(entry.caseId)
    if (!cached?.result || cached.status !== 'ok') throw new Error(`Missing base result ${entry.caseId}`)
    if (cached.sourceSha256 !== entry.sourceSha256 || cached.resultSha256 !== entry.resultSha256) throw new Error(`Binding mismatch ${entry.caseId}`)
    const report = validator.validateRecognitionQuality(cached.result, entry.source)
    const issues = report.issues.filter((issue) => issue.repairable && REPAIRABLE.has(issue.code))
    return {
      caseId: entry.caseId,
      sourceSha256: entry.sourceSha256,
      baseResultSha256: entry.resultSha256,
      sourceContent: entry.source,
      referenceTime: cached.result.createdAt,
      baseResult: cached.result,
      issues,
    }
  })
  const inputBytes = Buffer.from(`${JSON.stringify({ schemaVersion: 'e2.7-p8-repair-inputs-1.0.0', inputs }, null, 2)}\n`)
  await mkdir(path.dirname(INPUT_PATH), { recursive: true })
  await writeFile(INPUT_PATH, inputBytes)
  const triggered = inputs.filter((entry) => entry.issues.length > 0)
  const issueSupport = Object.fromEntries([...REPAIRABLE].map((code) => [code, triggered.filter((entry) => entry.issues.some((issue) => issue.code === code)).length]))
  const manifest = {
    schemaVersion: 'e2.7-p8-repair-input-manifest-1.0.0',
    status: 'FROZEN_BEFORE_GENERATION',
    generatedAt: new Date().toISOString(),
    inputArtifact: '.evaluation-cache/e2-7/p8-repair-inputs.json',
    inputArtifactSha256: sha256(inputBytes),
    caseCount: inputs.length,
    triggeredCaseCount: triggered.length,
    callCountPlanned: triggered.length * 2,
    validatorVersion: validator.RECOGNITION_VALIDATOR_VERSION,
    model: 'deepseek-v4-flash',
    arms: ['R0_REPAIR_DISABLED', 'R1_CURRENT_REPAIR', 'R2_OPTIMIZED_ISSUE_SCOPED_REPAIR'],
    issueSupport,
    generationIsolation: 'Generation script reads only the stripped input artifact; it does not load fixtures, expected answers, P7 labels, or scoring code.',
  }
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  process.stdout.write(`${INPUT_PATH}\n${MANIFEST_PATH}\n${JSON.stringify({ cases: inputs.length, triggered: triggered.length, calls: triggered.length * 2, issueSupport })}\n`)
} finally {
  await vite.close()
}
