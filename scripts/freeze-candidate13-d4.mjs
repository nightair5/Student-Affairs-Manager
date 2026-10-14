import {build} from 'esbuild'
import {existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs'
import {dirname, join, relative, resolve} from 'node:path'
import {isDeepStrictEqual} from 'node:util'
import {pathToFileURL} from 'node:url'
import {analyzeCandidate12D2Postrun} from './analyze-candidate12-d2-postrun.mjs'
import {verifyD3} from './build-candidate12-d3.mjs'
import {buildCandidate13EngineeringFixtures, validateCandidate13EngineeringFixtures} from './candidate13-d4-fixtures.mjs'
import {buildCandidate13Binding, verifyCandidate13D4Isolation} from './candidate13-d4-isolation.mjs'
import {canonicalJson, sha256, stable} from './candidate12-reference-contract.mjs'
import {verifyProtectedFiles} from './verify-candidate11-analysis.mjs'

export const D4_DIRECTORY = 'docs/recognition-optimization/candidate13/d4-freeze'
const AUTHORITY_LEDGER = resolve('C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')
const D1_DIRECTORY = 'docs/recognition-optimization/candidate12/d1-provisional-paired-preparation'
const D2_DIRECTORY = 'docs/recognition-optimization/candidate12/d2-provisional-development-20260921a'
const D3_DIRECTORY = 'docs/recognition-optimization/candidate12/d3-scorer-contract'
const EXPECTED = {
  baselineHead: '08680cbbd5798426201c60cdc75ec0dd74d56436',
  ledgerRows: 742,
  ledgerBytes: 631869,
  ledgerSha: 'df4035229093554b6417b0a37571730f68c10ecb7098234814406b49dfae1e1e',
  ledgerTail: '6812e1b072caeaa4fd3e6e8e55b485c57533bc0a0d9eaaff4dd84bbf48809922',
  d1Aggregate: '4afa5b08a368961ba6782b4ac3d4450f6e6d89c02fa034e1eb426f0390855a5b',
  d2Aggregate: '2074b8931077a9975ea61293723d1a668728f3baefb5933da84602f61aab6d53',
  d3Aggregate: 'd158ec4e29e925562993570442626fb35015ced39aeaee0862f29d4cbf820759',
}
const COMPONENTS = [
  'src/experiments/realInput01/candidate13.ts',
  'src/experiments/realInput01/candidate13.test.ts',
  'scripts/candidate13-d4-fixtures.mjs',
  'scripts/candidate13-d4-isolation.mjs',
  'scripts/freeze-candidate13-d4.mjs',
  'scripts/candidate13-d4.node-test.mjs',
]
const INHERITED = [
  'src/experiments/realInput01/candidate03.ts',
  'src/experiments/realInput01/candidate12.ts',
  'src/experiments/realInput01/modelWire.ts',
  'src/experiments/realInput01/modelClient.ts',
  'src/experiments/mainline04/semanticContract.ts',
]
const DOCUMENTS = ['README.md', 'CANDIDATE13_SPEC.md', 'CHANGE_LOG.md', 'FRESH_DATA_ISOLATION.md', 'VALIDATION.md']
const GENERATED = ['ENGINEERING_FIXTURES.json', 'REGRESSION_RESULTS.json']
const check = (value, code) => { if (!value) throw Error(code) }
const hashFile = (root, path) => sha256(readFileSync(resolve(root, path)))
const posix = path => path.replaceAll('\\', '/')

function walkFiles(root) {
  const files = []
  for (const entry of readdirSync(root, {recursive: true})) {
    const full = join(root, entry)
    if (statSync(full).isFile()) files.push({path: posix(relative(root, full)), bytes: statSync(full).size, sha256: sha256(readFileSync(full))})
  }
  return files.sort((a, b) => a.path.localeCompare(b.path))
}
function aggregate(root) {
  const files = walkFiles(root)
  return {count: files.length, aggregateSha256: sha256(JSON.stringify(files))}
}

export async function loadCandidate13Api(root = process.cwd()) {
  const bundled = await build({stdin: {contents: `
    export {buildCandidate03Request,CANDIDATE03_VERSION} from './src/experiments/realInput01/candidate03.ts';
    export {buildCandidate12Request,CANDIDATE12_VERSION} from './src/experiments/realInput01/candidate12.ts';
    export {buildCandidate13Request,CANDIDATE13_VERSION,CANDIDATE13_PROMPT_VERSION,CANDIDATE13_STATUS,CANDIDATE13_RULE_IDS,CANDIDATE13_REFERENCE_CONTRACT_VERSION,CANDIDATE13_SCORER_VERSION} from './src/experiments/realInput01/candidate13.ts';
    export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';
  `, resolveDir: root, loader: 'ts'}, bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent'})
  return import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].contents).toString('base64'))
}

function readLedger() {
  const bytes = readFileSync(AUTHORITY_LEDGER)
  const rows = bytes.toString('utf8').trimEnd().split(/\r?\n/).map(JSON.parse)
  const result = {path: AUTHORITY_LEDGER, rows: rows.length, bytes: bytes.length, sha256: sha256(bytes), tail: rows.at(-1).hash, writerOpened: false}
  check(result.rows === EXPECTED.ledgerRows && result.bytes === EXPECTED.ledgerBytes && result.sha256 === EXPECTED.ledgerSha
    && result.tail === EXPECTED.ledgerTail, 'D4_AUTHORITY_LEDGER_DRIFT')
  return result
}

async function buildCandidateFacts(root) {
  const api = await loadCandidate13Api(root)
  const source = '请核对匿名冻结记录；若后续条件成立，再提交匿名附件。'
  const context = {index: await api.indexImmutableScopesV11('c13-freeze', 'c13-freeze-v1', source),
    referenceTime: '2026-09-21T23:30:00+08:00', timezone: 'Asia/Shanghai'}
  const before = structuredClone(context)
  const c03 = await api.buildCandidate03Request(context)
  const c12 = await api.buildCandidate12Request(context)
  const first = await api.buildCandidate13Request(context)
  const second = await api.buildCandidate13Request(context)
  check(isDeepStrictEqual(context, before), 'D4_CONTEXT_MUTATED')
  check(first.serialized === second.serialized && isDeepStrictEqual(first.metadata, second.metadata), 'D4_CANDIDATE_NONDETERMINISTIC')
  check(first.metadata.candidateVersion === 'real-input-source-semantics-13'
    && first.metadata.promptVersion === 'recognition-prompt-candidate13-1.0.0'
    && first.metadata.quality === 'ENGINEERING_FROZEN_MODEL_NOT_RUN', 'D4_CANDIDATE_IDENTITY')
  const fixtures = buildCandidate13EngineeringFixtures()
  const fixtureValidation = validateCandidate13EngineeringFixtures(fixtures)
  const fixtureSha = sha256(stable(fixtures))
  const d3Manifest = verifyD3(root)
  const d3Hashes = Object.fromEntries(d3Manifest.files.map(file => [file.path, file.sha256]))
  const bindings = {
    adapterSha: hashFile(root, 'src/experiments/realInput01/modelWire.ts'),
    referenceContractSha: d3Hashes['scripts/candidate12-reference-contract.mjs'],
    compilerVersion: d3Manifest.versions.compiler,
    compilerSha: d3Hashes['scripts/compile-candidate12-reference.mjs'],
    scorerSha: d3Hashes['scripts/score-candidate12-contract-v3.mjs'],
    fixtureSha,
  }
  const binding = buildCandidate13Binding(first.metadata, bindings)
  const componentHashes = Object.fromEntries([...COMPONENTS, ...INHERITED].map(path => [path, hashFile(root, path)]))
  const candidateBundleSha = sha256(stable({
    candidateVersion: first.metadata.candidateVersion,
    promptVersion: first.metadata.promptVersion,
    promptSha: first.metadata.promptSha,
    schemaSha: first.metadata.schemaSha,
    ruleIds: first.metadata.ruleIds,
    modelConfig: first.metadata.modelConfig,
    binding,
    componentHashes,
  }))
  return {api, c03, c12, first, fixtures, fixtureValidation, fixtureSha, binding, componentHashes, candidateBundleSha, d3Manifest}
}

async function generatedOutputs(root) {
  const facts = await buildCandidateFacts(root)
  const fixtures = {
    version: 'candidate13-d4-engineering-fixtures-1.0.0',
    status: 'SEEN_ENGINEERING_REGRESSION_ONLY_NOT_MODEL_EVALUATION',
    dataRole: 'SEEN_ERROR_FAMILY_SYNTHETIC_ENGINEERING_REGRESSION_ONLY',
    eligibleForFreshDevelopment: false,
    eligibleForIndependentHoldout: false,
    count: facts.fixtures.length,
    fixtures: facts.fixtures,
  }
  const regression = {
    version: 'candidate13-d4-regression-results-1.0.0',
    status: 'ENGINEERING_CONSTRUCTION_PASS_MODEL_NOT_RUN',
    fixtureValidation: facts.fixtureValidation,
    ruleCoverage: {fixtures: 28, mapped: facts.fixtures.filter(row => row.requiredRuleIds.length > 0).length},
    deterministicConstruction: true,
    sourceOutsidePrompt: true,
    candidate03RequestSha: sha256(facts.c03.serialized),
    candidate12RequestSha: sha256(facts.c12.serialized),
    candidate13ProbeRequestSha: facts.first.metadata.requestSha,
    modelEvaluation: 'NOT_RUN',
    qualityClaim: 'NOT_OBSERVABLE',
  }
  return {facts, values: {'ENGINEERING_FIXTURES.json': canonicalJson(fixtures), 'REGRESSION_RESULTS.json': canonicalJson(regression)}}
}

async function buildManifest(root, generatedAt, facts) {
  const d1 = aggregate(resolve(root, D1_DIRECTORY)), d2 = aggregate(resolve(root, D2_DIRECTORY)), d3 = aggregate(resolve(root, D3_DIRECTORY))
  check(d1.aggregateSha256 === EXPECTED.d1Aggregate, 'D4_D1_FROZEN_DRIFT')
  check(d2.aggregateSha256 === EXPECTED.d2Aggregate, 'D4_D2_FROZEN_DRIFT')
  check(d3.aggregateSha256 === EXPECTED.d3Aggregate, 'D4_D3_FROZEN_DRIFT')
  const d2Analysis = analyzeCandidate12D2Postrun({writeOutputs: false})
  check(d2Analysis.officialDecision === 'REJECT_CANDIDATE12_ENGINEERING_SCREEN', 'D4_D2_DECISION_DRIFT')
  const protection = verifyProtectedFiles(root)
  check(protection.count === 84, 'D4_PROTECTED_FILES_DRIFT')
  const isolation = verifyCandidate13D4Isolation(root)
  const artifactPaths = [...DOCUMENTS, ...GENERATED].map(name => `${D4_DIRECTORY}/${name}`).concat(COMPONENTS)
  const files = artifactPaths.map(path => ({path, bytes: readFileSync(resolve(root, path)).length, sha256: hashFile(root, path)}))
  return {
    version: 'candidate13-d4-freeze-manifest-1.0.0',
    status: 'D4_CANDIDATE13_FROZEN_READY_FOR_FRESH_DATA',
    generatedAt,
    baselineHead: EXPECTED.baselineHead,
    candidate: {
      candidateVersion: facts.first.metadata.candidateVersion,
      promptVersion: facts.first.metadata.promptVersion,
      status: facts.first.metadata.quality,
      promptSha256: facts.first.metadata.promptSha,
      schemaSha256: facts.first.metadata.schemaSha,
      adapterSha256: facts.binding.adapterSha,
      candidateBundleSha256: facts.candidateBundleSha,
      ruleIds: facts.first.metadata.ruleIds,
      modelConfig: facts.first.metadata.modelConfig,
      modelEvaluation: 'NOT_RUN',
      demonstratedImprovement: false,
    },
    binding: facts.binding,
    protectedCandidates: {
      candidate03: {version: facts.api.CANDIDATE03_VERSION, sourceSha256: facts.componentHashes['src/experiments/realInput01/candidate03.ts']},
      candidate12: {version: facts.api.CANDIDATE12_VERSION, sourceSha256: facts.componentHashes['src/experiments/realInput01/candidate12.ts']},
      defaultCandidateChanged: false,
    },
    fixtures: {count: 28, sha256: facts.fixtureSha, dataRole: 'SEEN_ERROR_FAMILY_SYNTHETIC_ENGINEERING_REGRESSION_ONLY',
      eligibleForFreshDevelopment: false, eligibleForIndependentHoldout: false},
    frozenEvidence: {
      d1,
      d2,
      d3,
      d2ManifestFiles: 60,
      d2Raw: 24,
      d2Results: 24,
      d2OfficialDecision: d2Analysis.officialDecision,
      d3Status: facts.d3Manifest.status,
      protectedFiles: protection.count,
      authorityLedger: readLedger(),
    },
    isolation,
    files,
    operations: {modelCalls: 0, modelConnectivityProbes: 0, secretReads: 0, grants: 0, reserves: 0,
      settlements: 0, ledgerWrites: 0, freshExpectedReads: 0, holdoutRequests: 0, humanTrials: 0, merge: 0, deploy: 0},
    boundaries: {workspaceSchemaChanged: false, recognitionResultSchemaChanged: false, dependenciesChanged: false,
      defaultCandidateChanged: false, candidate03Changed: false, candidate12Changed: false, d3Changed: false,
      previewChanged: false, productionChanged: false, candidate13ImportedByProductRuntime: false},
    nextStageRequires: ['Candidate13 freeze commit precedes any fresh Expected', 'fresh anonymous Development or independent human Holdout',
      'v3 reference validation and compilation', 'new price check, budget card and explicit model-call authorization'],
  }
}

export async function writeCandidate13D4(root = process.cwd()) {
  const directory = resolve(root, D4_DIRECTORY)
  mkdirSync(directory, {recursive: true})
  const {facts, values} = await generatedOutputs(root)
  for (const [name, text] of Object.entries(values)) writeFileSync(join(directory, name), text)
  const manifestPath = join(directory, 'FREEZE_MANIFEST.json')
  const generatedAt = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')).generatedAt : new Date().toISOString()
  const manifest = await buildManifest(root, generatedAt, facts)
  writeFileSync(manifestPath, canonicalJson(manifest))
  return manifest
}

export async function verifyCandidate13D4(root = process.cwd()) {
  const directory = resolve(root, D4_DIRECTORY), manifestPath = join(directory, 'FREEZE_MANIFEST.json')
  check(existsSync(manifestPath), 'D4_MANIFEST_MISSING')
  const frozen = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const {facts, values} = await generatedOutputs(root)
  for (const [name, text] of Object.entries(values)) check(readFileSync(join(directory, name), 'utf8') === text, `D4_GENERATED_DRIFT:${name}`)
  check(readFileSync(manifestPath, 'utf8') === canonicalJson(await buildManifest(root, frozen.generatedAt, facts)), 'D4_MANIFEST_DRIFT')
  return frozen
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode] = process.argv.slice(2)
  check(['--write', '--verify'].includes(mode), 'D4_USAGE')
  const result = mode === '--write' ? await writeCandidate13D4() : await verifyCandidate13D4()
  console.log(JSON.stringify({status: result.status, candidate: result.candidate, fixtures: result.fixtures,
    operations: result.operations, ledger: result.frozenEvidence.authorityLedger}))
}
