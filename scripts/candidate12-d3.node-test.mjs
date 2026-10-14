import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {buildContractFixtures, perfectResult} from './candidate12-d3-fixtures.mjs'
import {canonicalJson, stable, validateReferenceV3, validateScorerInputV3} from './candidate12-reference-contract.mjs'
import {compileReferenceV3} from './compile-candidate12-reference.mjs'
import {aggregateCandidate12V3, scoreCandidate12V3} from './score-candidate12-contract-v3.mjs'
import {verifyD3} from './build-candidate12-d3.mjs'

const fixtures = buildContractFixtures()

for (const fixture of fixtures) {
  test(`D3 valid fixture: ${fixture.title}`, () => {
    assert.equal(validateReferenceV3(fixture.valid), fixture.valid)
    const first = compileReferenceV3(fixture.valid), second = compileReferenceV3(structuredClone(fixture.valid))
    assert.equal(canonicalJson(first), canonicalJson(second))
    const score = scoreCandidate12V3(first, perfectResult(fixture.valid))
    assert.equal(score.status, 'SCORED')
    assert.equal(score.complete, true)
    assert.equal(score.promotionEligible, true)
  })

  test(`D3 rejected fixture: ${fixture.title}`, () => {
    assert.throws(() => validateReferenceV3(fixture.invalid), error => error?.code === fixture.expectedError)
  })
}

test('D3 compiler hash is deterministic and changes with valid reference identity changes', () => {
  const reference = structuredClone(fixtures.find(item => item.id === 'single-task').valid)
  const before = compileReferenceV3(reference)
  reference.tasks[0].objects = ['另一匿名对象']
  reference.tasks[0].actionObjectAliases = [{action: reference.tasks[0].actions[0], object: '另一匿名对象'}]
  reference.tasks[0].taskEvidence.objectEvidence = ['匿名夹具证据：另一匿名对象']
  const after = compileReferenceV3(reference)
  assert.notEqual(before.inputSha256, after.inputSha256)
  assert.notEqual(before.compiledSha256, after.compiledSha256)
})

test('D3 candidate outputs cannot mutate reference or compiled hashes', () => {
  const reference = structuredClone(fixtures.find(item => item.id === 'single-task').valid)
  const compiled = compileReferenceV3(reference), snapshot = canonicalJson(compiled), referenceSnapshot = stable(reference)
  const first = perfectResult(reference), second = perfectResult(reference)
  second.tasks[0].action.surface = '错误动作'
  scoreCandidate12V3(compiled, first)
  scoreCandidate12V3(compiled, second)
  assert.equal(canonicalJson(compiled), snapshot)
  assert.equal(stable(reference), referenceSnapshot)
})

test('D3 invalid scorer input fails closed without a fake zero score', () => {
  const compiled = compileReferenceV3(fixtures[1].valid)
  compiled.compiledSha256 = '0'.repeat(64)
  const score = scoreCandidate12V3(compiled, perfectResult(fixtures[1].valid))
  assert.equal(score.status, 'REFERENCE_CONTRACT_INVALID')
  assert.equal(score.referenceValid, false)
  assert.equal(score.taskMetrics, null)
  assert.equal(score.promotionEligible, false)
})

test('D3 prediction schema failure is distinct from invalid reference', () => {
  const compiled = compileReferenceV3(fixtures[1].valid)
  const score = scoreCandidate12V3(compiled, null, {schemaValid: false})
  assert.equal(score.status, 'PARSE_OR_SCHEMA_FAILURE')
  assert.equal(score.referenceValid, true)
  assert.equal(score.schemaValid, false)
  assert.equal(score.severity.severe, 1)
})

test('D3 legal merge can share one prediction across two expressly compatible obligations', () => {
  const fixture = fixtures.find(item => item.id === 'legal-merge')
  const result = perfectResult(fixture.valid)
  result.tasks = result.tasks.slice(0, 1)
  const score = scoreCandidate12V3(compileReferenceV3(fixture.valid), result)
  assert.deepEqual(score.taskMetrics, {tp: 2, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1})
  assert.equal(score.complete, true)
})

test('D3 forbidden cross-object merge leaves the missing obligation visible', () => {
  const fixture = fixtures.find(item => item.id === 'cross-object-merge')
  const result = perfectResult(fixture.valid)
  result.tasks = result.tasks.slice(0, 1)
  const score = scoreCandidate12V3(compileReferenceV3(fixture.valid), result)
  assert.equal(score.taskMetrics.tp, 1)
  assert.equal(score.taskMetrics.fn, 1)
  assert.equal(score.complete, false)
})

test('D3 no-task source scores as a complete disposition with no synthetic task', () => {
  const fixture = fixtures.find(item => item.id === 'no-task-information')
  const score = scoreCandidate12V3(compileReferenceV3(fixture.valid), perfectResult(fixture.valid))
  assert.deepEqual(score.taskMetrics, {tp: 0, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1})
  assert.equal(score.complete, true)
})

test('D3 natural-language checks are rejected before scoring', () => {
  const reference = structuredClone(fixtures[1].valid)
  reference.checks = ['自然语言检查']
  assert.throws(() => compileReferenceV3(reference), error => error?.code === 'D3_CHECK_NOT_STRUCTURED')
})

test('D3 reference cannot contain candidate or model result data', () => {
  const reference = structuredClone(fixtures[1].valid)
  reference.candidateOutput = {tasks: []}
  assert.throws(() => validateReferenceV3(reference), error => error?.code === 'D3_CANDIDATE_DATA_IN_REFERENCE')
})

test('D3 forbidden inference cannot contradict the Expected task', () => {
  const reference = structuredClone(fixtures.find(item => item.id === 'forbidden-inference').valid)
  reference.tasks[0].forbiddenInferences[0].assertion.value = reference.tasks[0].objects[0]
  assert.throws(() => validateReferenceV3(reference), error => error?.code === 'D3_FORBIDDEN_EXPECTED_CONTRADICTION')
})

test('D3 every aligned field result includes a deterministic reason code', () => {
  const reference = fixtures.find(item => item.id === 'single-task').valid
  const score = scoreCandidate12V3(compileReferenceV3(reference), perfectResult(reference))
  assert.ok(score.alignment[0].fields.every(field => ['FIELD_RULE_MATCH', 'FIELD_RULE_MISMATCH', 'PREDICTION_NOT_ALIGNED'].includes(field.reason)))
})

test('D3 partial reference never produces a complete or promotion result', () => {
  const reference = structuredClone(fixtures[1].valid)
  reference.coverage = 'partial'
  const score = scoreCandidate12V3(compileReferenceV3(reference), perfectResult(reference))
  assert.equal(score.status, 'REFERENCE_INCOMPLETE')
  assert.equal(score.complete, null)
  assert.equal(score.promotionEligible, false)
})

test('D3 aggregate keeps severe, forbidden and incomplete sources in the denominator', () => {
  const compiled = compileReferenceV3(fixtures[1].valid)
  const good = scoreCandidate12V3(compiled, perfectResult(fixtures[1].valid))
  const bad = scoreCandidate12V3(compiled, null, {schemaValid: false})
  const aggregate = aggregateCandidate12V3([good, bad])
  assert.equal(aggregate.sources, 2)
  assert.equal(aggregate.completeSources, 1)
  assert.equal(aggregate.severity.severe, 1)
  assert.equal(aggregate.promotionEligible, false)
})

test('D3 runtime modules have no model transport, secret or ledger writer path', () => {
  const paths = ['scripts/candidate12-reference-contract.mjs', 'scripts/compile-candidate12-reference.mjs',
    'scripts/score-candidate12-contract-v3.mjs', 'scripts/candidate12-d3-fixtures.mjs']
  const forbidden = ['process.env', 'DEEPSEEK_API_KEY', 'fetch(', 'candidate12D2Grant', 'candidate12D2Reserve', 'candidate12D2Settle']
  for (const path of paths) {
    const contents = readFileSync(resolve(path), 'utf8')
    for (const token of forbidden) assert.equal(contents.includes(token), false, `${path}:${token}`)
  }
})

test('D3 generated package, frozen D1/D2 evidence, 84 protected files and 742-row ledger verify read-only', () => {
  const result = verifyD3(process.cwd())
  assert.equal(result.status, 'D3_SCORER_CONTRACT_READY_FOR_FRESH_DATA')
  assert.equal(result.frozenEvidence.protectedFiles, 84)
  assert.equal(result.frozenEvidence.d2Manifest.raw, 24)
  assert.equal(result.frozenEvidence.d2Manifest.results, 24)
  assert.equal(result.frozenEvidence.authorityLedger.rows, 742)
  assert.deepEqual(result.operations, {modelCalls: 0, secretReads: 0, grants: 0, reserves: 0, settlements: 0,
    ledgerWrites: 0, humanTrials: 0, holdoutRequests: 0, merge: 0, deploy: 0})
})

test('D3 compiled scorer input rejects byte or hash tampering', () => {
  const compiled = compileReferenceV3(fixtures[1].valid)
  assert.equal(validateScorerInputV3(compiled), compiled)
  compiled.tasks[0].actions[0] = '篡改'
  assert.throws(() => validateScorerInputV3(compiled), error => error?.code === 'D3_COMPILED_SHA_MISMATCH')
})
