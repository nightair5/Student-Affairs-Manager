import {build} from 'esbuild'
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs'
import {dirname, relative, resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {verifyProtectedFiles} from './verify-candidate11-analysis.mjs'
import {verifyCandidate12Freeze} from './freeze-candidate12-c1.mjs'
import {EXPECTED_LEDGER, canonicalJson, normalizeText, sha256, validateAuthorityLedger} from './candidate12-holdout-lib.mjs'

const DIRECTORY = 'docs/recognition-optimization/candidate12/c1-holdout-preparation'
const CORPUS = DIRECTORY + '/OVERLAP_CORPUS.json'
const MANIFEST = DIRECTORY + '/PREPARATION_MANIFEST.json'
const B1_SOURCES = 'docs/recognition-optimization/candidate11/b1-preparation/SOURCES.json'
const INCLUDED = [
  DIRECTORY + '/README.md',
  DIRECTORY + '/HUMAN_ANNOTATION_PROTOCOL.md',
  DIRECTORY + '/HOLDOUT_ROSTER_TEMPLATE.json',
  DIRECTORY + '/HUMAN_SUBMISSION_SCHEMA.json',
  DIRECTORY + '/REFERENCE_TEMPLATE.json',
  DIRECTORY + '/SIGNOFF_TEMPLATE.json',
  DIRECTORY + '/ADJUDICATION_TEMPLATE.csv',
  DIRECTORY + '/PREREGISTRATION.md',
  DIRECTORY + '/BUDGET_AUTHORIZATION_CARD_DRAFT.md',
  CORPUS,
  'scripts/candidate12-holdout-lib.mjs',
  'scripts/validate-candidate12-human-submission.mjs',
  'scripts/prepare-candidate12-c1.mjs',
  'scripts/candidate12-c1.node-test.mjs',
]

const check = (value, code) => { if (!value) throw Error(code) }
const json = value => JSON.stringify(value, null, 2) + '\n'
const textArtifactSha = value => sha256(String(value).replaceAll('\r\n', '\n'))

async function loadSeenInputs(root) {
  const bundled = await build({stdin: {contents: `
    export {notices} from './src/experiments/mainline01/fixtures.ts';
    export {CONTRASTIVE_EVIDENCE_EXAMPLES} from './src/experiments/realInput01/contrastiveEvidenceExamples.ts';
    export {CANDIDATE11_EXAMPLES} from './src/experiments/realInput01/candidate11.ts';
  `, resolveDir: root, loader: 'ts'}, bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent'})
  return import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].contents).toString('base64'))
}

function collectSourceContent(value, output, prefix) {
  if (!value || typeof value !== 'object') return
  if (typeof value.sourceContent === 'string' && value.sourceContent.length >= 10) output.push({id: prefix + '-sourceContent', category: 'historical-binding', text: value.sourceContent})
  if (Array.isArray(value)) value.forEach((item, index) => collectSourceContent(item, output, `${prefix}-${index}`))
  else for (const [key, item] of Object.entries(value)) collectSourceContent(item, output, `${prefix}-${key}`)
}

export async function buildOverlapCorpus(root = process.cwd(), generatedAt = new Date().toISOString()) {
  const api = await loadSeenInputs(root), entries = []
  const b1 = JSON.parse(readFileSync(resolve(root, B1_SOURCES), 'utf8'))
  b1.sources.forEach(source => entries.push({id: 'b1-' + source.id, category: 'b1-development', text: source.text}))
  Object.entries(api.notices).forEach(([id, text]) => entries.push({id: 'mainline-fixture-' + id, category: 'engineering-fixture', text}))
  api.CANDIDATE11_EXAMPLES.forEach(example => entries.push({id: 'teaching-' + example.id, category: 'prompt-teaching', text: example.text}))
  const testText = readFileSync(resolve(root, 'src/experiments/realInput01/candidate12.test.ts'), 'utf8')
  ;[...testText.matchAll(/\btext:\s*'([^']+)'/gu)].forEach((match, index) => entries.push({id: `candidate12-engineering-${index + 1}`, category: 'candidate12-engineering-fixture', text: match[1]}))
  const runs = resolve(root, 'docs/recognition-optimization/mainline-real-input-01/runs')
  for (const name of readdirSync(runs, {recursive: true})) if (typeof name === 'string' && name.endsWith('BINDING_FINAL.json')) {
    const path = resolve(runs, name), content = JSON.parse(readFileSync(path, 'utf8'))
    collectSourceContent(content, entries, 'binding-' + relative(runs, path).replaceAll('\\', '/').replace(/[^a-zA-Z0-9]+/gu, '-'))
  }
  const unique = new Map()
  for (const entry of entries) {
    const normalizedText = normalizeText(entry.text)
    if (!normalizedText || unique.has(normalizedText)) continue
    unique.set(normalizedText, {...entry, textSha256: sha256(entry.text), normalizedText})
  }
  const finalEntries = [...unique.values()].sort((a, b) => a.id.localeCompare(b.id))
  return {version: 'candidate12-overlap-corpus-1.0.0', role: 'SEEN_EXCLUSION_CORPUS_NOT_HOLDOUT', generatedAt,
    threshold: {metric: 'normalized-character-trigram-jaccard', rejectAtOrAbove: 0.42, exactNormalizedMatchRejected: true},
    entries: finalEntries, corpusSha256: sha256(canonicalJson(finalEntries.map(({id, category, textSha256}) => ({id, category, textSha256}))))}
}

export async function buildPreparation(root = process.cwd(), generatedAt = new Date().toISOString()) {
  const freeze = await verifyCandidate12Freeze(root), ledger = validateAuthorityLedger(), protection = verifyProtectedFiles(root)
  const roster = JSON.parse(readFileSync(resolve(root, DIRECTORY, 'HOLDOUT_ROSTER_TEMPLATE.json'), 'utf8'))
  check(roster.status === 'EMPTY_TEMPLATE_NOT_A_HOLDOUT' && roster.sourceTextCount === 0 && roster.expectedCount === 0
    && roster.slots.length === 12 && roster.slots.every(slot => slot.sourceText === null && slot.reference === null), 'C12_ROSTER_NOT_EMPTY')
  check(!existsSync(resolve(root, DIRECTORY, 'SEALED_HUMAN_SUBMISSION.json')), 'C12_UNEXPECTED_HUMAN_SUBMISSION')
  const corpus = await buildOverlapCorpus(root, generatedAt), corpusText = json(corpus)
  const artifactHashes = Object.fromEntries(INCLUDED.map(path => [path, path === CORPUS
    ? textArtifactSha(corpusText)
    : textArtifactSha(readFileSync(resolve(root, path), 'utf8'))]))
  const manifest = {version: 'candidate12-c1-preparation-manifest-1.0.0', status: 'WAITING_FOR_INDEPENDENT_HUMAN_LABELS', generatedAt,
    candidateFreeze: {commit: 'c03368054ff8c357f055658c2d2d39b45bbcb761', candidateBundleSha: freeze.candidateBundleSha,
      candidateVersion: freeze.candidateVersion, promptSha: freeze.promptSha, schemaSha: freeze.schemaSha},
    holdoutHashes: {
      sourceSet: {status: 'NOT_AVAILABLE', sha256: null},
      expectedSet: {status: 'NOT_AVAILABLE', sha256: null},
      schema: {status: 'FROZEN', sha256: freeze.schemaSha},
      scorer: {status: 'FROZEN', sha256: freeze.componentHashes['scripts/score-candidate11-recognition.mjs']},
      adapter: {status: 'FROZEN', sha256: freeze.componentHashes['src/experiments/realInput01/modelWire.ts']},
      candidate12: {status: 'FROZEN', sha256: freeze.candidateBundleSha},
    },
    holdout: {plannedSources: 12, actualSources: 0, completeReferences: 0, requestIdentities: 0, modelCalls: 0,
      dispatchAuthorized: false, truthStatus: 'NOT_AVAILABLE', overlapCorpusEntries: corpus.entries.length, overlapCorpusSha256: corpus.corpusSha256},
    roles: {sourceProvider: 'UNASSIGNED', labelerA: 'UNASSIGNED', reviewerB: 'UNASSIGNED'},
    operations: {secretReads: 0, grants: 0, reserves: 0, settlements: 0, ledgerWrites: 0, modelCalls: 0},
    authorityLedger: ledger, expectedAuthorityLedger: EXPECTED_LEDGER, protectedFiles: protection.count, artifactHashes,
    nextGate: 'REAL_INDEPENDENT_HUMAN_DOUBLE_REVIEWED_SUBMISSION_REQUIRED',
    prohibitions: ['MODEL_DISPATCH', 'SECRET_READ', 'LEDGER_WRITE', 'PREPARE_REQUEST_IDENTITIES_BEFORE_HUMAN_GATE', 'MODEL_AS_HUMAN_LABELER', 'DEFAULT_CANDIDATE_CHANGE', 'MERGE', 'DEPLOY']}
  return {corpusText, manifestText: json(manifest), manifest}
}

export async function writePreparation(root = process.cwd()) {
  const output = await buildPreparation(root)
  mkdirSync(resolve(root, DIRECTORY), {recursive: true})
  writeFileSync(resolve(root, CORPUS), output.corpusText, {flag: 'wx'})
  writeFileSync(resolve(root, MANIFEST), output.manifestText, {flag: 'wx'})
  return output
}

export async function verifyPreparation(root = process.cwd()) {
  check(existsSync(resolve(root, CORPUS)) && existsSync(resolve(root, MANIFEST)), 'C12_PREPARATION_MISSING')
  const frozen = JSON.parse(readFileSync(resolve(root, MANIFEST), 'utf8'))
  const rebuilt = await buildPreparation(root, frozen.generatedAt)
  check(readFileSync(resolve(root, CORPUS), 'utf8') === rebuilt.corpusText, 'C12_OVERLAP_CORPUS_DRIFT')
  check(readFileSync(resolve(root, MANIFEST), 'utf8') === rebuilt.manifestText, 'C12_PREPARATION_MANIFEST_DRIFT')
  return rebuilt
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2); check(args.length === 1 && ['--write', '--verify'].includes(args[0]), 'ARGUMENT')
  const result = args[0] === '--write' ? await writePreparation() : await verifyPreparation()
  console.log(JSON.stringify({status: result.manifest.status, candidateFreeze: result.manifest.candidateFreeze,
    actualSources: result.manifest.holdout.actualSources, completeReferences: result.manifest.holdout.completeReferences,
    requestIdentities: result.manifest.holdout.requestIdentities, modelCalls: result.manifest.holdout.modelCalls,
    ledger: result.manifest.authorityLedger, protectedFiles: result.manifest.protectedFiles}))
}
