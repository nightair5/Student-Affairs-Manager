import {createHash} from 'node:crypto'
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {isDeepStrictEqual} from 'node:util'
import {build} from 'esbuild'
import {verifyCandidate12Freeze} from './freeze-candidate12-c1.mjs'
import {verifyProvisionalDevelopment} from './build-candidate12-provisional-development.mjs'
import {verifyProtectedFiles} from './verify-candidate11-analysis.mjs'

export const D1_DIRECTORY = 'docs/recognition-optimization/candidate12/d1-provisional-paired-preparation'
export const SOURCES_FILE = D1_DIRECTORY + '/PROVISIONAL_SOURCES.json'
export const REFERENCES_FILE = D1_DIRECTORY + '/PROVISIONAL_REFERENCES.json'
export const PREPARED_FILE = D1_DIRECTORY + '/PREPARED_REQUEST_IDENTITIES.json'
export const MANIFEST_FILE = D1_DIRECTORY + '/PREPARATION_MANIFEST.json'
export const AUTHORITY_LEDGER = 'C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl'

const FIXED = {
  model: 'deepseek-flash', temperature: 0, reasoning: {effort: 'none'}, maxOutputTokens: 8192,
  referenceTime: '2026-09-21T20:07:00+08:00', timezone: 'Asia/Shanghai',
  retry: false, repair: false, verifier: false,
}
const EXPECTED_LEDGER = {
  rows: 693, bytes: 572913,
  sha256: '2051d8e775123579c3fa262f671a757e690983f64bc5945d692faaeb24b5322e',
  tail: '13b520d270d26335072f99920e47a4443e8bc586365eb20cda61c4122d7ab3bd',
}
const COMPONENTS = [
  'src/experiments/realInput01/candidate03.ts',
  'src/experiments/realInput01/candidate12.ts',
  'src/experiments/realInput01/modelWire.ts',
  'src/experiments/mainline04/semanticContract.ts',
  'scripts/score-candidate11-recognition.mjs',
  'src/experiments/candidate12/provisionalIdentity.ts',
  'scripts/prepare-candidate12-d1.mjs',
  'scripts/run-candidate12-d1.mjs',
  'scripts/candidate12-d1.node-test.mjs',
]

export const sha256 = value => createHash('sha256').update(value).digest('hex')
const check = (condition, code) => { if (!condition) throw Error('C12_D1_' + code) }
const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const json = value => JSON.stringify(value, null, 2) + '\n'
const fileHash = (root, path) => sha256(readFileSync(resolve(root, path)))

export async function loadD1Api(root = process.cwd()) {
  const bundled = await build({absWorkingDir: root, stdin: {contents: `
    export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';
    export {prepareCandidate12D1,validateCandidate12D1Prepared,denyCandidate12D1Dispatch,C12_D1_SCORER_VERSION,C12_D1_EVALUATION_ROLE,C12_D1_TRUTH_STATUS,C12_D1_CLAIM_CEILING} from './src/experiments/candidate12/provisionalIdentity.ts';
    export {CANDIDATE03_VERSION,CANDIDATE03_INSTRUCTIONS} from './src/experiments/realInput01/candidate03.ts';
    export {CANDIDATE12_VERSION} from './src/experiments/realInput01/candidate12.ts';
    export {WIRE_VERSION,MODEL_JSON_SCHEMA,MAX_REQUEST_BYTES} from './src/experiments/realInput01/modelWire.ts';
    export {SEMANTIC_VERSION} from './src/experiments/mainline04/semanticContract.ts';
  `, resolveDir: root, loader: 'ts'}, bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent'})
  return import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].contents).toString('base64'))
}

export function splitProvisionalPackage(frozen, generatedAt) {
  check(frozen.status === 'PROVISIONAL_MODEL_AUTHORED_DEVELOPMENT_ONLY', 'PACKAGE_STATUS')
  check(frozen.truthStatus === 'PROVISIONAL_MODEL_AUTHORED' && frozen.eligibleForIndependentHoldout === false, 'PACKAGE_ELIGIBILITY')
  check(Array.isArray(frozen.sources) && frozen.sources.length === 12, 'SOURCE_COUNT')
  const sources = {
    version: 'candidate12-d1-provisional-sources-1.0.0', status: 'FROZEN_ZERO_CALL', generatedAt,
    evaluationRole: 'SEEN_SYNTHETIC_DEVELOPMENT', truthStatus: 'PROVISIONAL_MODEL_AUTHORED',
    eligibleForIndependentHoldout: false, claimCeiling: 'ENGINEERING_SCREENING_ONLY',
    sourceSetSha256: frozen.sourceSetSha256,
    sources: frozen.sources.map(({reference: _reference, referenceSha256: _referenceSha256, ...source}) => source),
  }
  const references = {
    version: 'candidate12-d1-provisional-references-1.0.0', status: 'FROZEN_PROVISIONAL_MODEL_AUTHORED', generatedAt,
    evaluationRole: 'SEEN_SYNTHETIC_DEVELOPMENT', truthStatus: 'PROVISIONAL_MODEL_AUTHORED',
    eligibleForIndependentHoldout: false, claimCeiling: 'ENGINEERING_SCREENING_ONLY',
    expectedSetSha256: frozen.expectedSetSha256,
    references: frozen.sources.map(source => ({sourceId: source.sourceId, referenceSha256: source.referenceSha256, reference: source.reference})),
  }
  for (const source of sources.sources) {
    check(!Object.hasOwn(source, 'reference') && !Object.hasOwn(source, 'referenceSha256'), 'SOURCE_REFERENCE_LEAK')
    check(sha256(source.sourceText) === source.sourceSha256, 'SOURCE_HASH')
  }
  for (const item of references.references) check(sha256(stable(item.reference)) === item.referenceSha256, 'REFERENCE_HASH')
  return {sources, references}
}

const forbiddenRequestKeys = new Set(['reference', 'referenceSha', 'referenceSha256', 'expected', 'minimalObligations',
  'scorerReference', 'forbiddenInferences', 'allowedMerges'])
function assertNoExpectedKeys(value) {
  if (Array.isArray(value)) { for (const item of value) assertNoExpectedKeys(item); return }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    check(!forbiddenRequestKeys.has(key), 'EXPECTED_IN_REQUEST:' + key)
    assertNoExpectedKeys(child)
  }
}

function assertSameNonPromptBodies(left, right) {
  const a = structuredClone(left.prepared.request)
  const b = structuredClone(right.prepared.request)
  a.input[0].content[0].text = '__PROMPT__'
  b.input[0].content[0].text = '__PROMPT__'
  check(isDeepStrictEqual(a, b), 'NON_PROMPT_DRIFT:' + left.sourceId)
}

export async function buildD1Requests(root, sources, candidateBundles) {
  const api = await loadD1Api(root)
  check(sources.evaluationRole === api.C12_D1_EVALUATION_ROLE
    && sources.truthStatus === api.C12_D1_TRUTH_STATUS
    && sources.claimCeiling === api.C12_D1_CLAIM_CEILING, 'DISCLOSURE_DRIFT')
  const requests = []
  let ordinal = 0
  for (const [index, source] of sources.sources.entries()) {
    check(/^C12-PD(0[1-9]|1[0-2])$/.test(source.sourceId), 'SOURCE_ID')
    const context = {index: await api.indexImmutableScopesV11(source.sourceId, source.sourceVersionId, source.sourceText),
      referenceTime: FIXED.referenceTime, timezone: FIXED.timezone}
    const order = index % 2 === 0 ? ['A', 'B'] : ['B', 'A']
    const sourceRequests = []
    for (const arm of order) {
      const prepared = await api.prepareCandidate12D1(context, arm)
      await api.validateCandidate12D1Prepared(prepared)
      const requestSerialized = JSON.stringify(prepared.request)
      assertNoExpectedKeys(prepared.request)
      check(prepared.modelCallsEnabled === false && prepared.dispatchAuthorized === false && prepared.resultStatus === 'NOT_RUN', 'DISPATCH_MODE')
      check(prepared.identity.requestSha === sha256(requestSerialized), 'REQUEST_HASH')
      check(prepared.identity.inputSha === source.sourceSha256, 'INPUT_HASH')
      check(isDeepStrictEqual(prepared.identity.modelConfig, {model: FIXED.model, temperature: FIXED.temperature,
        reasoning: FIXED.reasoning, maxOutputTokens: FIXED.maxOutputTokens}), 'MODEL_CONFIG')
      const unitCore = {
        unitId: `C12-D1-${source.sourceId.slice(4)}-${arm}`, ordinal: ++ordinal, sourceId: source.sourceId,
        sourceVersionId: source.sourceVersionId, arm, position: order.indexOf(arm) + 1,
        sourceSha256: source.sourceSha256, candidateVersion: prepared.identity.candidateVersion,
        candidateBundleSha: arm === 'A' ? candidateBundles.candidate03 : candidateBundles.candidate12,
        identitySha: prepared.identitySha, requestSha: prepared.identity.requestSha, inputSha: prepared.identity.inputSha,
        promptSha: prepared.identity.promptSha, exampleSha: prepared.identity.exampleSha, schemaSha: prepared.identity.schemaSha,
        scorerVersion: prepared.identity.scorerVersion, requestBytes: Buffer.byteLength(requestSerialized),
      }
      const entry = {...unitCore, unitIdentitySha: sha256(stable(unitCore)), dispatchAuthorized: false,
        resultStatus: 'NOT_RUN', requestSerialized, prepared}
      requests.push(entry)
      sourceRequests.push(entry)
    }
    assertSameNonPromptBodies(sourceRequests[0], sourceRequests[1])
  }
  check(requests.length === 24, 'REQUEST_COUNT')
  for (const key of ['unitId', 'unitIdentitySha', 'requestSha']) check(new Set(requests.map(item => item[key])).size === 24, 'UNIQUE_' + key)
  return {api, requests}
}

export async function buildD1Outputs(root = process.cwd(), generatedAt = new Date().toISOString()) {
  const frozen = verifyProvisionalDevelopment(root)
  const freeze = await verifyCandidate12Freeze(root)
  const {sources, references} = splitProvisionalPackage(frozen, generatedAt)
  const componentHashes = Object.fromEntries(COMPONENTS.map(path => [path, fileHash(root, path)]))
  const candidate03Paths = ['src/experiments/realInput01/candidate03.ts', 'src/experiments/realInput01/modelWire.ts', 'src/experiments/mainline04/semanticContract.ts']
  const candidateBundles = {
    candidate03: sha256(candidate03Paths.map(path => path + ':' + componentHashes[path]).join('\n')),
    candidate12: freeze.candidateBundleSha,
  }
  const {api, requests} = await buildD1Requests(root, sources, candidateBundles)
  check(requests.filter(item => item.arm === 'A').length === 12 && requests.filter(item => item.arm === 'B').length === 12, 'ARM_COUNT')
  check(requests.every((item, index) => item.ordinal === index + 1), 'ORDINAL')
  const refById = new Map(references.references.map(item => [item.sourceId, item.referenceSha256]))
  const boundRequests = requests.map(item => ({...item, referenceSha256: refById.get(item.sourceId)}))
  check(boundRequests.every(item => typeof item.referenceSha256 === 'string'), 'REFERENCE_BINDING')
  const preparedPackage = {
    version: 'candidate12-d1-prepared-identities-1.0.0', status: 'D1_PROVISIONAL_DEVELOPMENT_IDENTITIES_READY_FOR_AUTHORIZATION',
    generatedAt, evaluationRole: 'SEEN_SYNTHETIC_DEVELOPMENT', truthStatus: 'PROVISIONAL_MODEL_AUTHORED',
    eligibleForIndependentHoldout: false, claimCeiling: 'ENGINEERING_SCREENING_ONLY',
    requestCount: 24, modelCalls: 0, dispatchAuthorized: false, resultStatus: 'NOT_RUN', requests: boundRequests,
  }
  const sourcesText = json(sources), referencesText = json(references), preparedText = json(preparedPackage)
  const authority = readFileSync(AUTHORITY_LEDGER)
  const ledgerRows = authority.toString('utf8').trimEnd().split(/\r?\n/).map(JSON.parse)
  const ledger = {path: AUTHORITY_LEDGER, rows: ledgerRows.length, bytes: authority.length, sha256: sha256(authority),
    tail: ledgerRows.at(-1)?.hash ?? null, writerOpened: false}
  check(isDeepStrictEqual(ledger, {...EXPECTED_LEDGER, path: AUTHORITY_LEDGER, writerOpened: false}), 'AUTHORITY_LEDGER_DRIFT')
  const protection = verifyProtectedFiles(root)
  check(protection.count === 84, 'PROTECTED_FILES_DRIFT')
  const artifactHashes = {...componentHashes,
    'docs/recognition-optimization/candidate12/c2-provisional-development/PROVISIONAL_DEVELOPMENT_PACKAGE.json': fileHash(root, 'docs/recognition-optimization/candidate12/c2-provisional-development/PROVISIONAL_DEVELOPMENT_PACKAGE.json'),
    'docs/recognition-optimization/candidate12/c1-freeze/FREEZE.json': fileHash(root, 'docs/recognition-optimization/candidate12/c1-freeze/FREEZE.json'),
    [SOURCES_FILE]: sha256(sourcesText), [REFERENCES_FILE]: sha256(referencesText), [PREPARED_FILE]: sha256(preparedText),
  }
  const manifest = {
    version: 'candidate12-d1-preparation-manifest-1.0.0', status: 'D1_PROVISIONAL_DEVELOPMENT_IDENTITIES_READY_FOR_AUTHORIZATION',
    generatedAt, authorization: 'AWAITING_NEW_MODEL_CALL_AUTHORIZATION', resultStatus: 'NOT_RUN', modelCallsEnabled: false,
    evaluationRole: 'SEEN_SYNTHETIC_DEVELOPMENT', truthStatus: 'PROVISIONAL_MODEL_AUTHORED',
    eligibleForIndependentHoldout: false, claimCeiling: 'ENGINEERING_SCREENING_ONLY', requestCount: 24,
    sourceSetSha256: frozen.sourceSetSha256, expectedSetSha256: frozen.expectedSetSha256,
    packageSha256: frozen.packageSha256, candidateFreezeCommit: freeze.candidateFreeze?.commit ?? frozen.candidateFreeze.commit,
    versions: {candidate03: api.CANDIDATE03_VERSION, candidate12: api.CANDIDATE12_VERSION, wire: api.WIRE_VERSION,
      semantic: api.SEMANTIC_VERSION, scorer: api.C12_D1_SCORER_VERSION},
    candidateBundles, fixedConfig: {...FIXED, requestByteCeiling: api.MAX_REQUEST_BYTES},
    order: sources.sources.map((source, index) => ({sourceId: source.sourceId, arms: index % 2 === 0 ? ['A', 'B'] : ['B', 'A']})),
    artifactHashes, protection, authorityLedger: ledger,
    units: boundRequests.map(({requestSerialized: _requestSerialized, prepared: _prepared, ...unit}) => unit),
    operations: {modelApiCalls: 0, secretReads: 0, grants: 0, reserves: 0, settlements: 0, receipts: 0, ledgerWrites: 0},
    prohibitions: ['MODEL_DISPATCH', 'SECRET_READ', 'GRANT_CREATE', 'BUDGET_RESERVE', 'SETTLEMENT_CREATE',
      'RECEIPT_CREATE', 'LEDGER_WRITE', 'HOLDOUT_CLAIM', 'HUMAN_TRIAL', 'DEFAULT_CANDIDATE_CHANGE', 'MERGE', 'DEPLOY'],
    historicalFailure: {id: 'RCO-5-007', status: 'PRESERVED_FAILING', error: 'FREEZE_HASH_MISMATCH:package-lock.json'},
  }
  return {sourcesText, referencesText, preparedText, manifestText: json(manifest), sources, references, preparedPackage, manifest}
}

function freezeWrite(root, path, text) {
  const target = resolve(root, path)
  mkdirSync(dirname(target), {recursive: true})
  if (existsSync(target)) check(readFileSync(target, 'utf8') === text, 'FROZEN_OUTPUT_DRIFT:' + path)
  else writeFileSync(target, text, {flag: 'wx'})
}

export async function writeD1Outputs(root = process.cwd()) {
  const outputs = await buildD1Outputs(root)
  freezeWrite(root, SOURCES_FILE, outputs.sourcesText)
  freezeWrite(root, REFERENCES_FILE, outputs.referencesText)
  freezeWrite(root, PREPARED_FILE, outputs.preparedText)
  freezeWrite(root, MANIFEST_FILE, outputs.manifestText)
  return outputs
}

export async function verifyD1Outputs(root = process.cwd()) {
  const manifestPath = resolve(root, MANIFEST_FILE)
  check(existsSync(manifestPath), 'MANIFEST_MISSING')
  const generatedAt = JSON.parse(readFileSync(manifestPath, 'utf8')).generatedAt
  const outputs = await buildD1Outputs(root, generatedAt)
  for (const [path, expected] of [[SOURCES_FILE, outputs.sourcesText], [REFERENCES_FILE, outputs.referencesText],
    [PREPARED_FILE, outputs.preparedText], [MANIFEST_FILE, outputs.manifestText]]) {
    check(existsSync(resolve(root, path)) && readFileSync(resolve(root, path), 'utf8') === expected, 'OUTPUT_DRIFT:' + path)
  }
  return outputs
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode] = process.argv.slice(2)
  check(['--write', '--verify'].includes(mode), 'USAGE')
  const result = mode === '--write' ? await writeD1Outputs() : await verifyD1Outputs()
  console.log(JSON.stringify({status: result.manifest.status, requests: result.manifest.requestCount,
    modelCalls: result.manifest.operations.modelApiCalls, dispatchAuthorized: false,
    manifestSha256: sha256(result.manifestText), authorityLedger: result.manifest.authorityLedger,
    protectedFiles: result.manifest.protection.count}))
}
