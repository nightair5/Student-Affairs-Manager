/* global console, process */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { canonicalJson, hashBundle, normalizeLf, sha256 } from './e2-9-r1-hash.mjs'

const ROOT = process.cwd()
const DOCS = path.join(ROOT, 'docs', 'e2-v4-pro-benchmark-r1')
const CACHE = path.join(ROOT, '.evaluation-cache', 'e2-9-r1', 'protocol-2.0.0')
const PROTOCOL_VERSION = 'e2-9-v4-pro-reduced-protocol-2.0.0'
const SOURCE_SCHEMA = 'e2.9-r1-source-only-2.0.0'
const FORBIDDEN_KEYS = /^(?:expected|answer|answers|gold|golden|target|targets|score|scores|forbidden)$/iu

const SMOKE = Object.freeze([
  { caseId: 'e2-complex_notice-01', role: 'multi_task_multi_material', dimensions: ['multi_task', 'multi_material', 'multi_stage'], expectedCoverageFields: ['task', 'milestone', 'material', 'timePoint', 'event', 'evidence'] },
  { caseId: 'e2-holdout-22', role: 'multi_timepoint_event', dimensions: ['multi_task', 'multi_timepoint', 'event_task'], expectedCoverageFields: ['task', 'milestone', 'material', 'timePoint', 'event', 'evidence'] },
  { caseId: 'e2-gen-10-3', role: 'relative_vague_time_ambiguity', dimensions: ['relative_time', 'vague_time', 'ambiguity', 'conditional'], expectedCoverageFields: ['task', 'timePoint', 'ambiguity', 'evidence'] },
  { caseId: 'e2-gen-14-2', role: 'pure_information', dimensions: ['information_only', 'no_action'], expectedCoverageFields: ['no_action', 'no_spurious_entity', 'safety'] },
  { caseId: 'e2-gen-16-2', role: 'prompt_injection', dimensions: ['prompt_injection', 'multi_paragraph'], expectedCoverageFields: ['task', 'material', 'timePoint', 'evidence', 'prompt_injection_safety'] },
])

const SCREENING = Object.freeze([
  { caseId: 'e2-gen-22-1', dimensions: ['complex_multi_stage', 'multi_task', 'multi_timepoint', 'multi_material', 'event_task', 'ambiguity', 'formal_notice'], originTags: ['development', 'e2_6_diagnostic'] },
  { caseId: 'e2-holdout-25', dimensions: ['multi_stage', 'multi_task', 'multi_timepoint', 'multi_material', 'event_task', 'ambiguity'], originTags: ['exposed_holdout', 'e2_6_diagnostic'] },
  { caseId: 'e2-gen-10-3', dimensions: ['ambiguity', 'vague_time', 'relative_time', 'conditional'], originTags: ['development', 'e2_6_diagnostic'] },
  { caseId: 'e2-gen-14-2', dimensions: ['pure_information', 'information_only', 'no_action'], originTags: ['development'] },
  { caseId: 'e2-gen-16-2', dimensions: ['prompt_injection', 'security'], originTags: ['development'] },
  { caseId: 'e2-complex_notice-03', dimensions: ['complex_multi_stage', 'multi_task', 'multi_timepoint', 'multi_material'], originTags: ['golden', 'e2_6_diagnostic'] },
  { caseId: 'e2-gen-08-2', dimensions: ['multi_stage', 'multi_task', 'multi_timepoint', 'multi_material', 'table'], originTags: ['development'] },
  { caseId: 'e2-gen-07-1', dimensions: ['event_task', 'multi_timepoint', 'ambiguity', 'conditional'], originTags: ['development', 'e2_6_diagnostic'] },
])

const SELECTION_ADDITIONS = Object.freeze([
  { caseId: 'e2-complex_notice-01', dimensions: ['complex_multi_stage', 'multi_task', 'multi_timepoint', 'multi_material', 'event_task'], originTags: ['golden', 'e2_6_diagnostic'] },
  { caseId: 'e2-complex_notice-02', dimensions: ['multi_stage', 'multi_task', 'multi_timepoint', 'multi_material', 'event_task', 'conditional'], originTags: ['golden', 'e2_6_diagnostic'] },
  { caseId: 'e2-complex_notice-04', dimensions: ['multi_stage', 'multi_task', 'multi_timepoint', 'event_task'], originTags: ['golden', 'e2_6_diagnostic'] },
  { caseId: 'e2-complex_notice-05', dimensions: ['multi_stage', 'multi_task', 'multi_timepoint', 'multi_material', 'event_task', 'conditional'], originTags: ['golden', 'e2_6_diagnostic'] },
  { caseId: 'e2-complex_notice-06', dimensions: ['complex_course', 'multi_stage', 'multi_task', 'multi_timepoint', 'multi_material', 'event_task', 'ambiguity'], originTags: ['golden', 'e2_6_diagnostic'] },
  { caseId: 'e2-complex_notice-07', dimensions: ['formal_notice', 'multi_stage', 'multi_task', 'multi_timepoint', 'multi_material', 'event_task', 'ambiguity'], originTags: ['golden', 'e2_6_diagnostic'] },
  { caseId: 'e2-complex_notice-10', dimensions: ['formal_notice', 'multi_stage', 'multi_task', 'multi_timepoint', 'event_task', 'ambiguity'], originTags: ['golden', 'e2_6_diagnostic'] },
  { caseId: 'e2-holdout-22', dimensions: ['complex_multi_stage', 'multi_task', 'multi_timepoint', 'multi_material', 'event_task'], originTags: ['exposed_holdout', 'e2_6_diagnostic'] },
  { caseId: 'e2-holdout-23', dimensions: ['complex_multi_stage', 'multi_task', 'multi_timepoint', 'multi_material', 'event_task', 'ambiguity'], originTags: ['exposed_holdout', 'e2_6_diagnostic'] },
  { caseId: 'e2-holdout-24', dimensions: ['complex_multi_stage', 'multi_task', 'multi_timepoint', 'multi_material', 'event_task', 'ambiguity', 'conditional'], originTags: ['exposed_holdout', 'e2_6_diagnostic'] },
  { caseId: 'e2-gen-03-3', dimensions: ['formal_notice', 'multi_stage', 'multi_task', 'multi_timepoint', 'multi_material', 'event_task', 'ambiguity'], originTags: ['development', 'e2_6_diagnostic'] },
  { caseId: 'e2-gen-11-3', dimensions: ['multi_task', 'multi_timepoint', 'multi_material', 'changed_deadline', 'ambiguity'], originTags: ['development', 'e2_6_diagnostic'] },
  { caseId: 'e2-gen-15-3', dimensions: ['ocr', 'table_ocr', 'multi_material', 'ambiguity'], originTags: ['development', 'e2_6_diagnostic'] },
  { caseId: 'e2-gen-20-2', dimensions: ['event_task', 'relative_time', 'ambiguity'], originTags: ['development', 'e2_6_diagnostic'] },
  { caseId: 'e2-gen-21-3', dimensions: ['multi_task', 'multi_timepoint', 'ordered_steps', 'table'], originTags: ['development', 'e2_6_diagnostic'] },
  { caseId: 'e2-gen-09-3', dimensions: ['chat', 'group_chat_colloquial', 'vague_time', 'ambiguity', 'event_task'], originTags: ['development'] },
])

function assertFirewall(value, location = '$') {
  if (Array.isArray(value)) return value.forEach((entry, index) => assertFirewall(entry, `${location}[${index}]`))
  if (!value || typeof value !== 'object') return
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) throw new Error(`Generation firewall rejected ${location}.${key}`)
    assertFirewall(entry, `${location}.${key}`)
  }
}

function sourceRecord(fixture, sourceSet) {
  const content = fixture.rawText.trim()
  const input = {
    sourceType: fixture.sourceType,
    sourceTitle: fixture.sourceTitle,
    content,
    referenceTime: fixture.referenceTime,
    timezone: fixture.timezone,
  }
  return { caseId: fixture.id, sourceSet, ...input, sourceSha256: sha256(content), inputSha256: sha256(canonicalJson(input)) }
}

export function semanticRoleFor(spec) {
  if (spec.dimensions.includes('pure_information') || spec.dimensions.includes('information_only') || spec.dimensions.includes('no_action')) return 'information_only'
  if (spec.dimensions.includes('prompt_injection') || spec.dimensions.includes('security')) return 'prompt_injection'
  return 'action_required'
}

export function sourceCase(record, spec) {
  return { ...record, semanticRole: semanticRoleFor(spec) }
}

function manifestCase(record, spec) {
  const semanticRole = semanticRoleFor(spec)
  return {
    caseId: record.caseId,
    sourceSet: record.sourceSet,
    semanticRole,
    dimensions: spec.dimensions,
    originTags: spec.originTags ?? [record.sourceSet],
    sourceSha256: record.sourceSha256,
    inputSha256: record.inputSha256,
    labelSha256: sha256(canonicalJson({ caseId: record.caseId, semanticRole, dimensions: spec.dimensions, originTags: spec.originTags ?? [record.sourceSet] })),
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
    const fixtures = new Map(Object.entries(datasets).flatMap(([sourceSet, rows]) => rows.map((fixture) => [fixture.id, { fixture, sourceSet }])))
    const specs = [...SMOKE, ...SCREENING, ...SELECTION_ADDITIONS]
    const records = new Map([...new Set(specs.map((spec) => spec.caseId))].map((caseId) => {
      const found = fixtures.get(caseId)
      if (!found) throw new Error(`Unknown case: ${caseId}`)
      return [caseId, sourceRecord(found.fixture, found.sourceSet)]
    }))
    const smokeCases = SMOKE.map((spec) => ({ ...sourceCase(records.get(spec.caseId), spec), smokeRole: spec.role }))
    const screeningCases = SCREENING.map((spec) => sourceCase(records.get(spec.caseId), spec))
    const selectionSpecs = [...SCREENING, ...SELECTION_ADDITIONS]
    const selectionCases = selectionSpecs.map((spec) => sourceCase(records.get(spec.caseId), spec))
    if (new Set(selectionCases.map((item) => item.caseId)).size !== 24) throw new Error('Selection must contain 24 unique cases')
    if (new Set(selectionCases.map((item) => item.sourceSha256)).size !== 24) throw new Error('Selection contains duplicate source text')

    const sourceOnly = {
      schemaVersion: SOURCE_SCHEMA,
      protocolVersion: PROTOCOL_VERSION,
      generationBoundary: 'source-only; no expected answers, scores, labels, or prior model outputs',
      smokeCases,
      screeningCases,
      selectionCases,
    }
    assertFirewall(sourceOnly)
    const sourceOnlySha256 = sha256(canonicalJson(sourceOnly))
    const smokeManifest = {
      schemaVersion: 'e2.9-r1-smoke-v2-manifest-2.0.0', protocolVersion: PROTOCOL_VERSION,
      frozenBeforeModelCalls: true, qualityConclusionEligible: false, sourceOnlySha256,
      cases: SMOKE.map((spec) => ({ ...manifestCase(records.get(spec.caseId), spec), role: spec.role, expectedCoverageFields: spec.expectedCoverageFields })),
    }
    const screeningManifest = {
      schemaVersion: 'e2.9-r1-screening-v2-manifest-2.0.0', protocolVersion: PROTOCOL_VERSION,
      role: 'EXPOSED_SCREENING', frozenBeforeModelCalls: true, sourceOnlySha256,
      selectionPolicy: 'structure-label-only; no prior model scores or outputs',
      cases: SCREENING.map((spec) => manifestCase(records.get(spec.caseId), spec)),
    }
    const selectionManifest = {
      schemaVersion: 'e2.9-r1-selection-v2-manifest-2.0.0', protocolVersion: PROTOCOL_VERSION,
      role: 'EXPOSED_SELECTION', frozenBeforeModelCalls: true, sourceOnlySha256,
      preservesScreeningCasesWithoutRerun: true,
      cases: selectionSpecs.map((spec) => manifestCase(records.get(spec.caseId), spec)),
    }
    const coverage = ['complex_multi_stage', 'multi_task', 'multi_timepoint', 'multi_material', 'event_task', 'ambiguity', 'pure_information', 'prompt_injection']
    const missingScreening = coverage.filter((dimension) => !screeningManifest.cases.some((item) => item.dimensions.includes(dimension)))
    const selectionCoverage = ['complex_multi_stage', 'complex_course', 'multi_material', 'multi_timepoint', 'event_task', 'vague_time', 'formal_notice', 'group_chat_colloquial', 'ocr', 'pure_information', 'prompt_injection']
    const missingSelection = selectionCoverage.filter((dimension) => !selectionManifest.cases.some((item) => item.dimensions.includes(dimension)))
    if (missingScreening.length || missingSelection.length) throw new Error(`Coverage missing: ${[...missingScreening, ...missingSelection].join(',')}`)

    const bundles = {
      schema: await hashBundle(ROOT, ['src/recognition/types.ts', 'src/recognition/schema.ts']),
      scoring: await hashBundle(ROOT, ['src/recognition/e2/scoring.ts', 'src/recognition/e2/semanticEquivalence.ts', 'docs/e2-path-a-planning/evaluation-contract.json']),
      pipeline: await hashBundle(ROOT, ['cloudflare/recognition.mjs', 'cloudflare/recognition-prompt.mjs', 'cloudflare/recognition-quality.mjs', 'cloudflare/model-gateway.mjs']),
      datasets: await hashBundle(ROOT, ['src/recognition/e2/goldenDataset.ts', 'src/recognition/e2/holdoutDataset.ts', 'src/recognition/e2/generalizationDataset.ts']),
      protocolImplementation: await hashBundle(ROOT, ['cloudflare/e2-v4-pro-benchmark.mjs', 'scripts/e2-9-r1-hash.mjs', 'scripts/e2-9-r1-protocol.node.mjs', 'scripts/prepare-e2-9-r1-manifests.mjs', 'scripts/run-e2-9-r1.mjs', 'scripts/score-e2-9-r1.mjs', 'scripts/merge-e2-9-r1-checkpoints.mjs', 'scripts/prepare-e2-9-r1-adjudication.mjs', 'scripts/reveal-e2-9-r1-adjudication.mjs', 'scripts/evaluate-e2-9-r1-gate.mjs']),
    }
    const hashManifest = { schemaVersion: 'e2.9-r1-bundle-manifest-1.0.0', protocolVersion: PROTOCOL_VERSION, bundles }
    const baseline = {
      schemaVersion: 'e2.9-r1-baseline-2.0.0', protocolVersion: PROTOCOL_VERSION,
      baselineCommit: 'b2ea4a4b27bf543f77a3c3a9cd5439b92a950720', baselineTag: 'v2-e2-9-protocol-blocked',
      models: ['deepseek-v4-flash', 'deepseek-v4-pro'], onlyAllowedRecognitionVariable: 'modelName',
      frozen: { prompt: 'recognition-2.4.1', schema: '2.0', pipeline: 'recognition-pipeline-2.2.1', router: 'BYPASSED', validator: 'recognition-quality-2.1.0', repair: 'DISABLED', planningNormalizer: 'DISABLED', temperature: 0, thinking: 'disabled', maxTokens: 6000, responseFormat: 'json_object', stream: false, tools: 'none' },
      sourceOnlySha256, smokeManifestSha256: sha256(canonicalJson(smokeManifest)), screeningManifestSha256: sha256(canonicalJson(screeningManifest)), selectionManifestSha256: sha256(canonicalJson(selectionManifest)), bundleManifestSha256: sha256(canonicalJson(hashManifest)),
    }
    await mkdir(DOCS, { recursive: true })
    await mkdir(CACHE, { recursive: true })
    await writeFile(path.join(CACHE, 'source-only-manifest.json'), `${JSON.stringify(sourceOnly, null, 2)}\n`, 'utf8')
    for (const [name, value] of Object.entries({ 'smoke-v2-manifest.json': smokeManifest, 'screening-v2-manifest.json': screeningManifest, 'selection-v2-manifest.json': selectionManifest, 'bundle-hash-manifest.json': hashManifest, 'baseline-manifest.json': baseline })) {
      await writeFile(path.join(DOCS, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    }
    console.log(JSON.stringify({ protocolVersion: PROTOCOL_VERSION, smoke: 5, screening: 8, selection: 24, sourceOnlySha256, screeningCoverage: coverage, selectionCoverage, cache: path.relative(ROOT, CACHE), lineEndingCheck: normalizeLf(await readFile(path.join(ROOT, 'PRD.md'), 'utf8')).includes('\r') ? 'FAIL' : 'PASS' }, null, 2))
  } finally {
    await vite.close()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
