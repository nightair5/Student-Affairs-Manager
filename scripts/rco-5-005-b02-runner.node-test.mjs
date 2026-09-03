import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  CONTRACT_HASHES,
  ROLES,
  buildRequest,
  validateProposition,
} from './rco-5-005-b01-lib.mjs'
import {
  aggregateUsage,
  hasForbiddenRequestKey,
  peakCostCny,
  safeFailureCode,
  selfTest,
  validateNoRetryState,
} from './run-rco-5-005-b02.mjs'

const dataset = JSON.parse(await readFile(new URL('../docs/recognition-optimization/RCO-5-005-B02_DEVELOPMENT_DATASET.json', import.meta.url), 'utf8'))

test('runner self-test fixes 36-call and 10-CNY fail-closed limits', () => {
  assert.doesNotThrow(selfTest)
  assert.equal(peakCostCny(49_152 * 36, 2_000 * 36), 8.7360768)
})

test('all frozen facts and graph requests exclude Expected and scoring keys', () => {
  for (const fixture of dataset.cases) {
    for (const role of ['facts_first', 'proposition_graph']) {
      const request = buildRequest(role, fixture)
      assert.equal(hasForbiddenRequestKey(request.body), false, `${fixture.id}:${role}`)
      assert.equal(JSON.stringify(request.body).includes('shouldDefaultSelect'), false)
      assert.equal(JSON.stringify(request.body).includes('forbiddenDefaultTokens'), false)
    }
  }
})

test('verifier remains unavailable until a locally valid graph exists', () => {
  const fixture = dataset.cases[0]
  const invalid = { status: 'completed', parsed: { schemaVersion: 'rco-b01-propositions-1.0', producerRunId: `extract-${fixture.id}`, nodes: [], relations: [] } }
  assert.equal(validateProposition(invalid.parsed, fixture.sourceText, undefined, `extract-${fixture.id}`).valid, true)
  assert.equal(hasForbiddenRequestKey(buildRequest('semantic_verifier', fixture, invalid).body), false)
  assert.throws(() => buildRequest('semantic_verifier', fixture, { status: 'invalid_output', parsed: null }), /UPSTREAM_GRAPH_SCHEMA_INVALID/u)
})

test('usage aggregation never invents missing provider usage', () => {
  const complete = aggregateUsage([
    { dispatched: true, providerUsage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 } },
    { dispatched: false, providerUsage: null },
  ])
  assert.deepEqual(complete, { complete: true, dispatchedRecords: 1, observedRecords: 1, inputTokens: 10, outputTokens: 2, totalTokens: 12 })
  assert.equal(aggregateUsage([{ dispatched: true, providerUsage: null }]).complete, false)
})

test('failure codes are bounded and cannot contain upstream prose or secrets', () => {
  assert.equal(safeFailureCode({ error: { type: 'bad request with spaces' } }, 'fallback'), 'bad_request_with_spaces')
  assert.ok(safeFailureCode({ error: { code: 'x'.repeat(500) } }, 'fallback').length <= 180)
})

test('checkpoint no-retry guard rejects duplicate attempts and the 37th dispatch', () => {
  const entry = (index) => ({ key: `c${index}:facts_first`, attemptNo: 1, dispatchedAt: 'now', httpStatus: 200, state: 'completed' })
  assert.doesNotThrow(() => validateNoRetryState({ entries: Array.from({ length: 36 }, (_, index) => entry(index)) }))
  assert.throws(() => validateNoRetryState({ entries: Array.from({ length: 37 }, (_, index) => entry(index)) }), /DISPATCH_CAP_EXCEEDED/u)
  assert.throws(() => validateNoRetryState({ entries: [entry(1), entry(1)] }), /NO_RETRY_CONTRACT_INVALID/u)
  assert.throws(() => validateNoRetryState({ entries: [{ ...entry(1), attemptNo: 2 }] }), /NO_RETRY_CONTRACT_INVALID/u)
})

test('strict prompt and response-schema hashes cover all three roles', () => {
  assert.deepEqual(Object.keys(CONTRACT_HASHES.prompts), ROLES)
  assert.deepEqual(Object.keys(CONTRACT_HASHES.responseSchemas), ROLES)
  for (const hash of [...Object.values(CONTRACT_HASHES.prompts), ...Object.values(CONTRACT_HASHES.responseSchemas)]) {
    assert.match(hash, /^[a-f0-9]{64}$/u)
  }
})
