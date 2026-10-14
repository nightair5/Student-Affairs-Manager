import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs'
import {resolve} from 'node:path'
import {isDeepStrictEqual} from 'node:util'
import {verifyProtectedFiles} from './verify-candidate11-analysis.mjs'
import {verifyProvisionalDevelopment} from './build-candidate12-provisional-development.mjs'
import {runCandidate12D1} from './run-candidate12-d1.mjs'
import {AUTHORITY_LEDGER, D1_DIRECTORY, buildD1Requests, loadD1Api, sha256, splitProvisionalPackage, verifyD1Outputs} from './prepare-candidate12-d1.mjs'

const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)

function normalizePrompt(request) {
  const body = structuredClone(request)
  body.input[0].content[0].text = '__PROMPT__'
  return body
}

function filesBelow(path) {
  return readdirSync(path, {withFileTypes: true}).flatMap(item => item.isDirectory()
    ? filesBelow(resolve(path, item.name)) : [resolve(path, item.name)])
}

test('D1 outputs are frozen, deterministic and explicitly provisional', async () => {
  const first = await verifyD1Outputs()
  const second = await verifyD1Outputs()
  assert.equal(first.manifestText, second.manifestText)
  assert.equal(first.manifest.status, 'D1_PROVISIONAL_DEVELOPMENT_IDENTITIES_READY_FOR_AUTHORIZATION')
  assert.equal(first.manifest.evaluationRole, 'SEEN_SYNTHETIC_DEVELOPMENT')
  assert.equal(first.manifest.truthStatus, 'PROVISIONAL_MODEL_AUTHORED')
  assert.equal(first.manifest.eligibleForIndependentHoldout, false)
  assert.equal(first.manifest.claimCeiling, 'ENGINEERING_SCREENING_ONLY')
})

test('sources and provisional Expected are physically separated', async () => {
  const outputs = await verifyD1Outputs()
  for (const source of outputs.sources.sources) {
    assert.equal(Object.hasOwn(source, 'reference'), false)
    assert.equal(Object.hasOwn(source, 'referenceSha256'), false)
  }
  assert.equal(outputs.references.references.length, 12)
  assert.equal(outputs.references.references.every(item => item.reference.truthStatus === 'PROVISIONAL_MODEL_AUTHORED'), true)
})

test('24 zero-call identities use the preregistered alternating paired order', async () => {
  const {preparedPackage, manifest} = await verifyD1Outputs()
  assert.equal(preparedPackage.requests.length, 24)
  assert.equal(new Set(preparedPackage.requests.map(item => item.unitId)).size, 24)
  for (let sourceIndex = 0; sourceIndex < 12; sourceIndex++) {
    const pair = preparedPackage.requests.slice(sourceIndex * 2, sourceIndex * 2 + 2)
    assert.deepEqual(pair.map(item => item.arm), sourceIndex % 2 === 0 ? ['A', 'B'] : ['B', 'A'])
    assert.equal(pair[0].sourceId, pair[1].sourceId)
  }
  assert.equal(manifest.order.length, 12)
})

test('both arms share every non-prompt request field and fixed model configuration', async () => {
  const {preparedPackage} = await verifyD1Outputs()
  for (let index = 0; index < 24; index += 2) {
    const [left, right] = preparedPackage.requests.slice(index, index + 2)
    assert.ok(isDeepStrictEqual(normalizePrompt(left.prepared.request), normalizePrompt(right.prepared.request)))
    assert.notEqual(left.promptSha, right.promptSha)
    for (const item of [left, right]) assert.deepEqual(item.prepared.identity.modelConfig,
      {model: 'deepseek-flash', temperature: 0, reasoning: {effort: 'none'}, maxOutputTokens: 8192})
  }
})

test('all request, input, prompt, schema and identity hashes reconstruct', async () => {
  const {preparedPackage} = await verifyD1Outputs()
  for (const item of preparedPackage.requests) {
    assert.equal(item.requestSha, sha256(item.requestSerialized))
    assert.equal(item.sourceSha256, item.inputSha)
    assert.equal(item.promptSha, sha256(item.prepared.request.input[0].content[0].text))
    assert.equal(item.schemaSha, sha256(JSON.stringify(item.prepared.request.text.format.schema)))
    assert.equal(item.identitySha, item.prepared.identitySha)
    assert.equal(item.dispatchAuthorized, false)
    assert.equal(item.resultStatus, 'NOT_RUN')
  }
  assert.equal(new Set(preparedPackage.requests.map(item => item.requestSha)).size, 24)
})

test('changing provisional Expected cannot change any request SHA', async () => {
  const frozen = structuredClone(verifyProvisionalDevelopment())
  const original = splitProvisionalPackage(frozen, '2026-09-21T20:07:00.000Z')
  frozen.sources[0].reference.scorerReference.checks.push('deliberate test-only Expected mutation')
  frozen.sources[0].referenceSha256 = sha256(stable(frozen.sources[0].reference))
  const mutated = splitProvisionalPackage(frozen, '2026-09-21T20:07:00.000Z')
  assert.deepEqual(original.sources, mutated.sources)
  const manifest = (await verifyD1Outputs()).manifest
  const first = await buildD1Requests(process.cwd(), original.sources, manifest.candidateBundles)
  const second = await buildD1Requests(process.cwd(), mutated.sources, manifest.candidateBundles)
  assert.deepEqual(first.requests.map(item => item.requestSha), second.requests.map(item => item.requestSha))
})

test('changing source, prompt or model parameters changes the serialized request hash', async () => {
  const outputs = await verifyD1Outputs()
  const mutatedSources = structuredClone(outputs.sources)
  mutatedSources.sources[0].sourceText += ' 补充：请核对原文。'
  mutatedSources.sources[0].sourceSha256 = sha256(mutatedSources.sources[0].sourceText)
  const changed = await buildD1Requests(process.cwd(), mutatedSources, outputs.manifest.candidateBundles)
  const baseline = outputs.preparedPackage.requests.filter(item => item.sourceId === 'C12-PD01').map(item => item.requestSha)
  const changedHashes = changed.requests.filter(item => item.sourceId === 'C12-PD01').map(item => item.requestSha)
  assert.notDeepEqual(changedHashes, baseline)
  const request = structuredClone(outputs.preparedPackage.requests[0].prepared.request)
  const originalSha = sha256(JSON.stringify(request))
  request.input[0].content[0].text += '\nmutation'
  assert.notEqual(sha256(JSON.stringify(request)), originalSha)
  request.model = 'different-model'
  assert.notEqual(sha256(JSON.stringify(request)), originalSha)
})

test('prepared identity and context drift are rejected', async () => {
  const outputs = await verifyD1Outputs()
  const api = await loadD1Api()
  const original = outputs.preparedPackage.requests[0].prepared
  await assert.doesNotReject(() => api.validateCandidate12D1Prepared(original))
  const flag = structuredClone(original)
  flag.dispatchAuthorized = true
  await assert.rejects(() => api.validateCandidate12D1Prepared(flag), /C12_D1_PREPARED_IDENTITY_CHANGED/)
  const context = structuredClone(original)
  context.context.referenceTime = '2026-09-21T20:08:00+08:00'
  await assert.rejects(() => api.validateCandidate12D1Prepared(context), /C12_D1_PREPARED_IDENTITY_CHANGED/)
})

test('direct and launcher dispatch are denied before any external operation', async () => {
  const beforeLedger = sha256(readFileSync(AUTHORITY_LEDGER))
  const beforeProtection = verifyProtectedFiles()
  const outputs = await verifyD1Outputs()
  const api = await loadD1Api()
  await assert.rejects(() => api.denyCandidate12D1Dispatch(outputs.preparedPackage.requests[0].prepared), /D1_MODEL_CALL_NOT_AUTHORIZED/)
  await assert.rejects(() => runCandidate12D1(), /D1_MODEL_CALL_NOT_AUTHORIZED/)
  assert.equal(sha256(readFileSync(AUTHORITY_LEDGER)), beforeLedger)
  assert.deepEqual(verifyProtectedFiles(), beforeProtection)
})

test('manifest binds candidates, schema, scorer, adapter, ledger and 84 protected files', async () => {
  const {manifest} = await verifyD1Outputs()
  assert.equal(manifest.units.length, 24)
  assert.equal(manifest.protection.count, 84)
  assert.equal(manifest.authorityLedger.rows, 693)
  assert.equal(manifest.authorityLedger.sha256, '2051d8e775123579c3fa262f671a757e690983f64bc5945d692faaeb24b5322e')
  assert.equal(manifest.authorityLedger.writerOpened, false)
  assert.ok(manifest.artifactHashes['scripts/score-candidate11-recognition.mjs'])
  assert.ok(manifest.artifactHashes['src/experiments/realInput01/modelWire.ts'])
  assert.ok(manifest.candidateBundles.candidate03)
  assert.equal(manifest.candidateBundles.candidate12, '880488f038cec55763276f525c1847638533fe95d79a64599e9585dc8d92296a')
})

test('D1 preparation creates no raw result, usage, receipt or authorization artifact', async () => {
  const directory = resolve(D1_DIRECTORY)
  assert.ok(existsSync(directory) && statSync(directory).isDirectory())
  const names = filesBelow(directory).map(path => path.toLowerCase())
  assert.equal(names.some(path => /(?:_raw|raw_result|usage|receipt|grant|reserve|settle)/.test(path)), false)
  const operations = (await verifyD1Outputs()).manifest.operations
  assert.deepEqual(operations, {modelApiCalls: 0, secretReads: 0, grants: 0, reserves: 0, settlements: 0, receipts: 0, ledgerWrites: 0})
})
