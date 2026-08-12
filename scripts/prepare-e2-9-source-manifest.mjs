/* global console, process */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'

const ROOT = process.cwd()
const SELECTION_PATH = path.join(ROOT, 'docs', 'e2-factledger', 'd5-complex-selection.json')
const OUTPUT_PATH = path.join(ROOT, '.evaluation-cache', 'e2-9', 'source-only-manifest.json')
const SMOKE_CASES = Object.freeze([
  { caseId: 'e2-complex_notice-01', role: 'multi_task_multi_material' },
  { caseId: 'e2-holdout-22', role: 'multi_timepoint_event' },
  { caseId: 'e2-gen-16-1', role: 'prompt_injection_trust_boundary' },
])
const FORBIDDEN_KEYS = /^(?:expected|answer|answers|gold|golden|target|targets|label|labels|score|scores|forbidden)$/iu

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function sourceRecord(fixture, sourceSet) {
  return {
    caseId: fixture.id,
    sourceSet,
    sourceType: fixture.sourceType,
    sourceTitle: fixture.sourceTitle,
    content: fixture.rawText,
    referenceTime: fixture.referenceTime,
    timezone: fixture.timezone,
    sourceSha256: sha256(fixture.rawText.trim()),
    inputSha256: sha256(JSON.stringify({
      sourceType: fixture.sourceType,
      sourceTitle: fixture.sourceTitle,
      content: fixture.rawText,
      referenceTime: fixture.referenceTime,
      timezone: fixture.timezone,
    })),
  }
}

function assertFirewall(value, location = '$') {
  if (Array.isArray(value)) return value.forEach((entry, index) => assertFirewall(entry, `${location}[${index}]`))
  if (!value || typeof value !== 'object') return
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) throw new Error(`Generation firewall rejected ${location}.${key}`)
    assertFirewall(entry, `${location}.${key}`)
  }
}

async function main() {
  const vite = await createServer({ root: ROOT, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })
  try {
    const [goldenModule, holdoutModule, developmentModule] = await Promise.all([
      vite.ssrLoadModule('/src/recognition/e2/goldenDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/holdoutDataset.ts'),
      vite.ssrLoadModule('/src/recognition/e2/generalizationDataset.ts'),
    ])
    const datasets = {
      golden: goldenModule.recognitionGoldenDataset,
      exposed_holdout: holdoutModule.recognitionHoldoutDataset,
      development: developmentModule.recognitionGeneralizationDevelopmentDataset,
    }
    const selection = JSON.parse(await readFile(SELECTION_PATH, 'utf8'))
    const allFixtures = new Map(Object.entries(datasets).flatMap(([sourceSet, fixtures]) => (
      fixtures.map((fixture) => [fixture.id, { fixture, sourceSet }])
    )))
    const selectionCases = selection.cases.map(({ caseId, sourceSet }) => {
      const found = allFixtures.get(caseId)
      if (!found || found.sourceSet !== sourceSet) throw new Error(`Selection source mismatch: ${caseId}`)
      return sourceRecord(found.fixture, sourceSet)
    })
    const smokeCases = SMOKE_CASES.map(({ caseId, role }) => {
      const found = allFixtures.get(caseId)
      if (!found) throw new Error(`Unknown smoke case: ${caseId}`)
      return { ...sourceRecord(found.fixture, found.sourceSet), smokeRole: role }
    })
    const output = {
      schemaVersion: 'e2.9-source-only-manifest-1.0.0',
      generatedBeforeModelCalls: true,
      generationFirewall: 'PASS',
      smokeCases,
      selectionCases,
    }
    assertFirewall(output)
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
    await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify({
      output: path.relative(ROOT, OUTPUT_PATH),
      smokeCount: smokeCases.length,
      selectionCount: selectionCases.length,
      smokeCaseIds: smokeCases.map((item) => item.caseId),
      sourceOnlyManifestSha256: sha256(JSON.stringify(output)),
      firewall: 'PASS',
    }, null, 2))
  } finally {
    await vite.close()
  }
}

await main()
