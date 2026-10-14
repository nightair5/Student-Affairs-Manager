import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {buildCandidate13EngineeringFixtures, validateCandidate13EngineeringFixtures} from './candidate13-d4-fixtures.mjs'
import {
  assertCandidate13Binding,
  buildCandidate13Binding,
  rejectCandidate13D4Dispatch,
  verifyCandidate13D4Isolation,
} from './candidate13-d4-isolation.mjs'
import {loadCandidate13Api, verifyCandidate13D4} from './freeze-candidate13-d4.mjs'
import {verifyD3} from './build-candidate12-d3.mjs'
import {sha256, stable} from './candidate12-reference-contract.mjs'

const fixtures = buildCandidate13EngineeringFixtures()

for (const row of fixtures) {
  test(`D4 engineering fixture contract: ${row.fixtureId} ${row.category}`, () => {
    assert.equal(row.dataRole, 'SEEN_ERROR_FAMILY_SYNTHETIC_ENGINEERING_REGRESSION_ONLY')
    assert.equal(row.seen, true)
    assert.equal(row.eligibleForFreshDevelopment, false)
    assert.equal(row.eligibleForIndependentHoldout, false)
    assert.ok(row.sourceText.length > 0)
    assert.ok(row.requiredRuleIds.length > 0)
    assert.ok(row.expectedEngineeringInvariants.length > 0)
    assert.ok(row.forbiddenBehaviors.length > 0)
    assert.ok(row.d3ContractRules.length > 0)
    assert.match(row.failureCode, /^D4_/)
  })
}

async function candidateFacts() {
  const api = await loadCandidate13Api()
  const source = '请核对匿名记录；若审核通过，再提交匿名附件。'
  const context = {index: await api.indexImmutableScopesV11('d4-test', 'd4-test-v1', source),
    referenceTime: '2026-09-21T23:30:00+08:00', timezone: 'Asia/Shanghai'}
  const candidate = await api.buildCandidate13Request(context)
  const d3 = verifyD3()
  const hashes = Object.fromEntries(d3.files.map(file => [file.path, file.sha256]))
  const bindings = {
    adapterSha: sha256(readFileSync(resolve('src/experiments/realInput01/modelWire.ts'))),
    referenceContractSha: hashes['scripts/candidate12-reference-contract.mjs'],
    compilerVersion: d3.versions.compiler,
    compilerSha: hashes['scripts/compile-candidate12-reference.mjs'],
    scorerSha: hashes['scripts/score-candidate12-contract-v3.mjs'],
    fixtureSha: sha256(stable(fixtures)),
  }
  return {api, context, candidate, bindings, binding: buildCandidate13Binding(candidate.metadata, bindings)}
}

test('D4 fixture roster is exactly 28 unique seen engineering categories', () => {
  assert.deepEqual(validateCandidate13EngineeringFixtures(fixtures), {count: 28, uniqueIds: 28, uniqueCategories: 28, uniqueSources: 28})
})

test('D4 candidate and prompt versions are explicit and bound to D3 v3', async () => {
  const {candidate} = await candidateFacts()
  assert.equal(candidate.metadata.candidateVersion, 'real-input-source-semantics-13')
  assert.equal(candidate.metadata.promptVersion, 'recognition-prompt-candidate13-1.0.0')
  assert.equal(candidate.metadata.referenceContractVersion, 'candidate12-reference-contract-3.0.0')
  assert.equal(candidate.metadata.scorerVersion, 'candidate12-scoring-3.0.0')
  assert.equal(candidate.metadata.quality, 'ENGINEERING_FROZEN_MODEL_NOT_RUN')
})

test('D4 construction is deterministic and leaves its input context unchanged', async () => {
  const {api, context} = await candidateFacts()
  const snapshot = structuredClone(context)
  const first = await api.buildCandidate13Request(context), second = await api.buildCandidate13Request(context)
  assert.equal(first.serialized, second.serialized)
  assert.deepEqual(first.metadata, second.metadata)
  assert.deepEqual(context, snapshot)
})

test('D4 source remains only in the user message and never becomes a teaching example', async () => {
  const {candidate, context} = await candidateFacts()
  assert.equal(JSON.parse(candidate.body.input[1].content[0].text).source, context.index.sourceContent)
  assert.equal(candidate.body.input[0].content[0].text.includes(context.index.sourceContent), false)
  assert.equal(candidate.metadata.exampleVersion, null)
})

test('D4 candidate03 and Candidate12 construction remain unchanged after Candidate13 construction', async () => {
  const {api, context} = await candidateFacts()
  const old03 = await api.buildCandidate03Request(context), old12 = await api.buildCandidate12Request(context)
  await api.buildCandidate13Request(context)
  assert.deepEqual(await api.buildCandidate03Request(context), old03)
  assert.deepEqual(await api.buildCandidate12Request(context), old12)
})

test('D4 prompt identity changes the frozen binding', async () => {
  const {candidate, bindings, binding} = await candidateFacts()
  const metadata = {...candidate.metadata, promptSha: '1'.repeat(64)}
  assert.notEqual(buildCandidate13Binding(metadata, bindings).bindingSha, binding.bindingSha)
})

test('D4 schema drift changes identity and is rejected against the freeze', async () => {
  const {candidate, bindings, binding} = await candidateFacts()
  const drifted = buildCandidate13Binding({...candidate.metadata, schemaSha: '2'.repeat(64)}, bindings)
  assert.throws(() => assertCandidate13Binding(drifted, binding), /D4_BINDING_DRIFT/)
})

test('D4 adapter drift changes identity and is rejected against the freeze', async () => {
  const {candidate, bindings, binding} = await candidateFacts()
  const drifted = buildCandidate13Binding(candidate.metadata, {...bindings, adapterSha: '3'.repeat(64)})
  assert.throws(() => assertCandidate13Binding(drifted, binding), /D4_BINDING_DRIFT/)
})

test('D4 scorer drift changes identity and is rejected against the freeze', async () => {
  const {candidate, bindings, binding} = await candidateFacts()
  const drifted = buildCandidate13Binding(candidate.metadata, {...bindings, scorerSha: '4'.repeat(64)})
  assert.throws(() => assertCandidate13Binding(drifted, binding), /D4_BINDING_DRIFT/)
})

test('D4 fixture drift changes identity and is rejected against the freeze', async () => {
  const {candidate, bindings, binding} = await candidateFacts()
  const drifted = buildCandidate13Binding(candidate.metadata, {...bindings, fixtureSha: '5'.repeat(64)})
  assert.throws(() => assertCandidate13Binding(drifted, binding), /D4_BINDING_DRIFT/)
})

test('D4 exact binding validates without reading a candidate output or Expected', async () => {
  const {binding} = await candidateFacts()
  assert.equal(assertCandidate13Binding(binding, structuredClone(binding)), binding)
})

test('D4 has no authorized dispatch path', () => {
  assert.throws(() => rejectCandidate13D4Dispatch(), /D4_MODEL_CALL_NOT_AUTHORIZED/)
})

test('D4 isolation blocks fresh Expected, Holdout and product-entry coupling', () => {
  const result = verifyCandidate13D4Isolation()
  assert.equal(result.status, 'D4_FRESH_DATA_ISOLATION_PASS')
  assert.equal(result.freshExpectedObserved, 0)
  assert.equal(result.holdoutExpectedObserved, 0)
  assert.equal(result.formalRequestIdentitiesCreated, 0)
  assert.equal(result.defaultCandidateChanged, false)
})

test('D4 runtime module has no model transport, secret or ledger writer token', () => {
  const source = readFileSync(resolve('src/experiments/realInput01/candidate13.ts'), 'utf8')
  for (const token of ['process.env', 'fetch(', 'DEEPSEEK_API_KEY', 'CALL_LEDGER', 'grant', 'reserve', 'settle']) {
    assert.equal(source.includes(token), false, token)
  }
})

test('D4 product runtime and 6633 replay entry do not import Candidate13', () => {
  for (const path of ['src/App.tsx', 'src/main.tsx', 'src/experiments/realInput01/browser.tsx',
    'src/experiments/realInput01/runtime.ts', 'src/experiments/realInput01/modelClient.ts', 'src/experiments/candidate11/runtime.tsx']) {
    assert.equal(readFileSync(resolve(path), 'utf8').includes('candidate13'), false, path)
  }
})

test('D4 freeze verifies D1/D2/D3, 84 protected files and the 742-row ledger read-only', async () => {
  const frozen = await verifyCandidate13D4()
  assert.equal(frozen.status, 'D4_CANDIDATE13_FROZEN_READY_FOR_FRESH_DATA')
  assert.equal(frozen.frozenEvidence.protectedFiles, 84)
  assert.equal(frozen.frozenEvidence.d2ManifestFiles, 60)
  assert.equal(frozen.frozenEvidence.d2Raw, 24)
  assert.equal(frozen.frozenEvidence.d2Results, 24)
  assert.equal(frozen.frozenEvidence.authorityLedger.rows, 742)
  assert.equal(frozen.frozenEvidence.authorityLedger.writerOpened, false)
})

test('D4 freeze records every external operation as zero', async () => {
  const frozen = await verifyCandidate13D4()
  assert.deepEqual(frozen.operations, {modelCalls: 0, modelConnectivityProbes: 0, secretReads: 0, grants: 0,
    reserves: 0, settlements: 0, ledgerWrites: 0, freshExpectedReads: 0, holdoutRequests: 0,
    humanTrials: 0, merge: 0, deploy: 0})
})

test('D4 freeze preserves schemas, dependencies, candidates and deployment surfaces', async () => {
  const frozen = await verifyCandidate13D4()
  assert.deepEqual(frozen.boundaries, {workspaceSchemaChanged: false, recognitionResultSchemaChanged: false,
    dependenciesChanged: false, defaultCandidateChanged: false, candidate03Changed: false, candidate12Changed: false,
    d3Changed: false, previewChanged: false, productionChanged: false, candidate13ImportedByProductRuntime: false})
  assert.equal(frozen.candidate.modelEvaluation, 'NOT_RUN')
  assert.equal(frozen.candidate.demonstratedImprovement, false)
})
