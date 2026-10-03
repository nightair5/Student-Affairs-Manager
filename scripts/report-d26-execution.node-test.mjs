import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { buildD26ExecutionReport } from './report-d26-execution.mjs'
import { summarizeD26Cases } from './score-d26.mjs'

const sha = value => createHash('sha256').update(value).digest('hex')
const sources = Array.from({ length: 8 }, (_, index) => ({ sourceId: 'ANONYMOUS-OFFLINE-' + index, target: 'OFFLINE_TEST' }))
const units = sources.flatMap((source, index) => ['A', 'B'].map((arm, offset) => ({ ordinal: index * 2 + offset + 1,
  sourceId: source.sourceId, arm, candidate: arm === 'A' ? 'Candidate17' : 'Candidate18',
  unitIdentitySha256: sha('identity-' + index + arm), requestSha256: sha('request-' + index + arm) })))
const base = () => ({ audit: 'NO_STATE', state: null, lockExists: false, halt: null, uncertainty: null,
  batchEvidence: { rows: 0, grantCount: 0, reserveCount: 0, settleCount: 0, units: [] }, ledger: { rows: 1, sha256: sha('OFFLINE_ONLY') } })
function consistent(count = 16) {
  return { ...base(), audit: 'CONSISTENT', batchEvidence: { rows: 1 + count * 2, grantCount: 1, reserveCount: count, settleCount: count },
    state: { units: units.map((unit, index) => ({ ...unit, status: index < count ? 'SETTLED' : 'NOT_SENT',
      ...(index < count ? { responseSha256: sha('raw-' + index), usage: { input_tokens: 100, output_tokens: 30 }, costUpperMicroUsd: 66 } : {}) })) } }
}
const neverScore = () => { assert.fail('must not grade or manufacture a winner') }
const report = (inspection, scoreAll = neverScore, customUnits = units) => buildD26ExecutionReport({ units: customUnits, sources, inspection, scoreAll })
function fakeScores() {
  const score = correct => ({ completeStatus: correct, structuredCompleteStatus: correct, riskUnits: [], riskIdentityStatus: 'MAPPED', risks: [], disputes: [] })
  const cases = units.map(unit => ({ ...unit, humanEdits: 'NOT_APPLIED', originalAnswerScore: score(false), score: score(unit.arm === 'B') }))
  return { cases, originalAnswerComparison: summarizeD26Cases(sources, cases.map(row => ({ ...row, score: row.originalAnswerScore }))),
    productFirstComparison: summarizeD26Cases(sources, cases) }
}

test('verified absent state and no batch evidence yields 16 NOT_RUN and null accuracy, without scorer calls', async () => {
  const result = await report(base())
  assert.equal(result.status, 'NOT_RUN_NO_BATCH_EXECUTION_OBSERVED')
  assert.equal(result.units.filter(row => row.status === 'NOT_RUN').length, 16)
  assert.equal(result.execution.actualSentExact, 0)
  assert.equal(result.productFirstComparison.arms.Candidate17.firstWholeCorrectRate, null)
  assert.equal(result.productFirstComparison.arms.Candidate18.firstWholeCorrect, null)
  assert.equal(result.productFirstComparison.arms.Candidate18.unknown, 8)
  assert.equal(result.usage.providerActualUsd, 'NOT_OBSERVABLE')
  assert.deepEqual(Object.values(result.humanMetrics), Array(4).fill('NOT_OBSERVABLE'))
  assert.deepEqual(Object.values(result.operationsByThisReport), Array(6).fill(0))
})

test('absent local state is not evidence of non-delivery when batch receipts, lock, halt or ledger audit are unknown', async () => {
  for (const changes of [{ batchEvidence: undefined }, { batchEvidence: { rows: 1 } }, { lockExists: true },
    { halt: { code: 'SEND_UNCERTAIN' } }, { audit: 'UNRESOLVED' }]) {
    const result = await report({ ...base(), ...changes })
    assert.equal(result.execution.actualSentExact, null)
    assert.equal(result.execution.uncertainSendOrSettlementUnits, 16)
    assert.equal(result.execution.confirmedNotSent, 0)
    assert.equal(result.productFirstComparison.decision, 'EVIDENCE_INCOMPLETE')
  }
})

test('partial consistent prefix retains 16 units and per-arm denominator 8, without partial winner', async () => {
  const result = await report(consistent(3))
  assert.equal(result.execution.confirmedSent, 3)
  assert.equal(result.execution.confirmedNotSent, 13)
  assert.equal(result.execution.actualSentExact, 3)
  assert.equal(result.productFirstComparison.arms.Candidate17.denominator, 8)
  assert.equal(result.productFirstComparison.arms.Candidate17.unknown, 8)
  assert.equal(result.usage.observedInputTokens, 300)
  assert.equal(result.usage.observedOutputTokens, 90)
  assert.equal(result.usage.conservativeSettlementMicroUsd, 198)
  assert.equal(result.usage.providerActualUsd, 'NOT_OBSERVABLE')
})

test('all settled but held lock, halt, uncertainty or invalid identity cannot invoke scoring', async () => {
  const invalidState = consistent().state
  invalidState.units[0].requestSha256 = sha('DRIFT')
  for (const changes of [{ lockExists: true }, { halt: { code: 'BILLING_UNKNOWN' } }, { uncertainty: 'UNKNOWN' },
    { audit: 'UNRESOLVED' }, { state: invalidState }]) {
    const result = await report({ ...consistent(), ...changes })
    assert.equal(result.status, 'INCOMPLETE_OR_UNCERTAIN_NO_WINNER')
    assert.equal(result.productFirstComparison.decision, 'EVIDENCE_INCOMPLETE')
  }
})

test('UNCERTAIN status never becomes not sent because no raw hash exists', async () => {
  const inspection = consistent(0)
  inspection.audit = 'UNRESOLVED'
  inspection.state.units[0].status = 'UNCERTAIN'
  const result = await report(inspection)
  assert.equal(result.units[0].status, 'UNRESOLVED')
  assert.equal(result.units[0].sendCertainty, 'UNKNOWN')
  assert.equal(result.execution.actualSentExact, null)
})

test('full verified batch grades once, separates original answers from program-built first display, and never claims human effects', async () => {
  let calls = 0
  const result = await report(consistent(), () => { calls++; return fakeScores() })
  assert.equal(calls, 1)
  assert.equal(result.execution.actualSentExact, 16)
  assert.equal(result.originalAnswerComparison.arms.Candidate18.firstWholeCorrectRate, 0)
  assert.equal(result.productFirstComparison.arms.Candidate18.firstWholeCorrectRate, 1)
  assert.equal(result.productFirstComparison.arms.Candidate17.firstWholeCorrectRate, 0)
  assert.equal(result.humanEdits, 'NOT_APPLIED_TO_COMPARISON')
  assert.equal(result.humanMetrics.finalCorrectDisposition, 'NOT_OBSERVABLE')
  assert.equal(result.productFirstComparison.arms.Candidate18.rateStatus, 'PROVISIONAL_AUTOMATED_CONTRACT_OBSERVED')
  assert.deepEqual(Object.values(result.adjudicationCoverage.unadjudicatedFields), Array(3).fill('NOT_ADJUDICATED'))
  assert.equal(result.cases.length, 16)
})

test('unknown semantic case retains fixed denominator and null unqualified accuracy', async () => {
  const scores = fakeScores()
  scores.cases[1].score.completeStatus = 'UNKNOWN'
  scores.productFirstComparison = summarizeD26Cases(sources, scores.cases)
  const result = await report(consistent(), () => scores)
  assert.equal(result.productFirstComparison.arms.Candidate18.denominator, 8)
  assert.equal(result.productFirstComparison.arms.Candidate18.unknown, 1)
  assert.equal(result.productFirstComparison.arms.Candidate18.firstWholeCorrectRate, null)
  assert.equal(result.productFirstComparison.arms.Candidate18.confirmedCorrectFractionOfFixedDenominator, 7 / 8)
})

test('duplicates, missing units and injected scorer identity drift fail closed', async () => {
  await assert.rejects(report(base(), neverScore, units.slice(1)), /FIXED_DENOMINATOR/u)
  const duplicate = structuredClone(units); duplicate[1].unitIdentitySha256 = duplicate[0].unitIdentitySha256
  await assert.rejects(report(base(), neverScore, duplicate), /DUPLICATE_UNIT/u)
  const scores = fakeScores(); scores.cases[0].sourceId = 'WRONG_SOURCE'
  await assert.rejects(report(consistent(), () => scores), /SCORE_IDENTITY_DRIFT/u)
})
