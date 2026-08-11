import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

const ROOT = process.cwd()
const OUTPUT = path.join(ROOT, '.evaluation-cache', 'e2-6', 'input-manifest.json')
const SELECTION = path.join(ROOT, 'docs', 'e2-factledger', 'd5-complex-selection.json')

function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalInput(fixture) {
  return JSON.stringify({
    sourceType: fixture.sourceType,
    sourceTitle: fixture.sourceTitle,
    sourceText: fixture.rawText,
    referenceTime: fixture.referenceTime,
    timezone: fixture.timezone,
  })
}

const selectionBytes = await readFile(SELECTION)
const selection = JSON.parse(selectionBytes.toString('utf8'))
if (selection.cases.length !== 24) throw new Error(`Expected frozen 24-case selection, received ${selection.cases.length}`)

const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', server: { middlewareMode: true } })
try {
  const [golden, holdout, development] = await Promise.all([
    vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
    vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
    vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
  ])
  const fixtures = new Map([
    ...golden.recognitionGoldenDataset,
    ...holdout.recognitionHoldoutDataset,
    ...development.recognitionGeneralizationDevelopmentDataset,
  ].map((fixture) => [fixture.id, fixture]))
  const cases = selection.cases.map((selected) => {
    const fixture = fixtures.get(selected.caseId)
    if (!fixture) throw new Error(`Unknown selected case ${selected.caseId}`)
    const input = {
      sourceType: fixture.sourceType,
      sourceTitle: fixture.sourceTitle,
      content: fixture.rawText,
      referenceTime: fixture.referenceTime,
      timezone: fixture.timezone,
    }
    return {
      caseId: fixture.id,
      group: fixture.group,
      sourceSet: selected.sourceSet,
      sourceSha256: hash(fixture.rawText),
      inputSha256: hash(canonicalInput(fixture)),
      input,
    }
  })
  const manifest = {
    schemaVersion: 'e2.6-generation-inputs-1.0.0',
    blindEligibility: false,
    sampleCount: cases.length,
    selectionSha256: hash(selectionBytes),
    generationBoundary: 'This file contains source inputs only. The generation runner does not import datasets or scoring code.',
    cases,
  }
  await mkdir(path.dirname(OUTPUT), { recursive: true })
  const bytes = `${JSON.stringify(manifest, null, 2)}\n`
  await writeFile(OUTPUT, bytes, 'utf8')
  process.stdout.write(`${JSON.stringify({ output: path.relative(ROOT, OUTPUT), manifestSha256: hash(bytes), sampleCount: cases.length })}\n`)
} finally {
  await vite.close()
}
