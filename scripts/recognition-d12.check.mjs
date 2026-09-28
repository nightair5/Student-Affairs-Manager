import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {scoreCandidate15Diagnostic} from './score-candidate15-diagnostic.mjs'
import {scoreCandidate15} from './score-candidate15-contract.mjs'
import {loadD11DiagnosticInputs, loadD12OracleInputs, diagnoseD12} from './diagnose-recognition-d12.mjs'
import {verifyRecognitionHistory} from './verify-recognition-history.mjs'
import {routeRecognitionBlockers} from './recognition-progress-policy.mjs'

const oracles = await loadD12OracleInputs()
const reference = oracles[0].reference

test('a complete reference with no predicted tasks returns all missing obligations, not a TypeError', () => {
  const actual = structuredClone(oracles[0].result)
  actual.tasks = []
  actual.materials = []
  actual.timePoints = []
  assert.throws(() => scoreCandidate15(reference, actual), TypeError)
  const score = scoreCandidate15Diagnostic(reference, actual)
  assert.equal(score.status, 'SCORED')
  assert.equal(score.taskMetrics.fn, reference.tasks.length)
  assert.equal(score.taskMetrics.tp, 0)
  assert.equal(score.complete, false)
})

test('zero action/object match keeps both false positives and false negatives', () => {
  const actual = structuredClone(oracles[0].result)
  actual.tasks[0].action.surface = '购买'
  actual.tasks[0].object.surface = '无关文具'
  const score = scoreCandidate15Diagnostic(reference, actual)
  assert.equal(score.taskMetrics.fp, 1)
  assert.equal(score.taskMetrics.fn, reference.tasks.length)
  assert.equal(score.complete, false)
})

test('all legal reference oracles still pass; changed critical time must fail', () => {
  for (const {reference: ref, result} of oracles) {
    const actual = structuredClone(result)
    assert.equal(scoreCandidate15Diagnostic(ref, actual).complete, true, ref.sourceId)
    if (actual.timePoints.length) {
      actual.timePoints[0].normalizedValue = '1900-01-01T00:00'
      assert.equal(scoreCandidate15Diagnostic(ref, actual).complete, false, ref.sourceId)
    }
  }
})

test('real raw replay restores all three exception branches without changing the other legacy scores', async () => {
  const result = await diagnoseD12()
  assert.deepEqual(result.recoveredExceptionOrdinals, [8, 9, 20])
  assert.equal(result.cases.length, 24)
  assert.equal(result.unresolvedScorerExceptions, 0)
  assert.equal(result.originalDecision, 'REJECT_CANDIDATE15_DEVELOPMENT')
  assert.equal(result.newPromotionDecision, 'NOT_EVALUATED')
  assert.equal(result.modelCalls, 0)
})

test('invalid recorded revision endpoints remain failed after crash repair', async () => {
  const inputs = await loadD11DiagnosticInputs()
  for (const ordinal of [19, 21]) {
    const row = inputs.find(r => r.unit.ordinal === ordinal)
    assert.equal(row.referenceValid, false)
    const score = scoreCandidate15Diagnostic(row.reference, row.result, {referenceValid: row.referenceValid})
    assert.equal(score.status, 'SCHEMA_OR_REFERENCE_FAILURE')
    assert.equal(score.complete, false)
  }
})

test('scorer/labels failures block only dependent quality lanes, not local engineering replay', () => {
  const plan = routeRecognitionBlockers([
    {id: 'v6', kind: 'SCORER_EXCEPTION', evidence: 'D11 ordinals 8,9,20'},
    {id: 'labels', kind: 'HUMAN_LABELS_MISSING', evidence: 'No independent labels supplied'},
  ])
  assert.equal(plan.lanes.engineeringReplay.blockedBy.length, 0)
  assert.equal(plan.lanes.engineeringDelivery.blockedBy.length, 0)
  assert.equal(plan.lanes.comparableQualityClaim.blockedBy.length, 1)
  assert.equal(plan.lanes.independentQualityClaim.blockedBy.length, 1)
  assert.equal(plan.authorizations.paidDispatch, false)
  assert.equal(plan.authorizations.humanStudy, false)
  assert.equal(plan.authorizations.deployment, false)
})

test('unsafe persistence blocks replay, and unknown issue classes cannot silently pass', () => {
  const plan = routeRecognitionBlockers([{id: 'db', kind: 'SOURCE_OR_DATABASE_UNSAFE', evidence: 'fixture'}])
  assert.equal(plan.lanes.engineeringReplay.blockedBy.length, 1)
  assert.equal(plan.lanes.affectedCanonicalConfirmation.blockedBy.length, 1)
  assert.throws(() => routeRecognitionBlockers([{id: 'x', kind: 'UNRECOGNIZED', evidence: 'x'}]), /ISSUE_INVALID/)
})

test('history detects tampering in old raw and archived rules', () => {
  assert.equal(verifyRecognitionHistory().protectedFiles, 84)
  for (const suffix of ['d11-development-20260928a/raw/01.json', 'archive/2026-09-28-d12/AGENTS.md']) {
    assert.throws(() => verifyRecognitionHistory(process.cwd(), path => {
      const bytes = readFileSync(path)
      return String(path).replaceAll('\\', '/').endsWith(suffix) ? Buffer.concat([bytes, Buffer.from('changed')]) : bytes
    }), /DRIFT/)
  }
})

test('coordinated evidence and manifest edits cannot replace the Git-anchored past', () => {
  const manifestPath = 'docs/governance/GOVERNANCE_BASELINE_V2.json'
  const target = 'docs/recognition-optimization/candidate15/d11-development-20260928a/D11_RESULTS.md'
  const bytes = Buffer.concat([readFileSync(target), Buffer.from('\nchanged historical verdict')])
  const manifest = JSON.parse(readFileSync(manifestPath))
  manifest.frozenFiles.find(row => row.path === target).sha256 = createHash('sha256').update(bytes).digest('hex')
  assert.throws(() => verifyRecognitionHistory(process.cwd(), path => {
    if (resolve(path) === resolve(target)) return bytes
    if (resolve(path) === resolve(manifestPath)) return Buffer.from(JSON.stringify(manifest))
    return readFileSync(path)
  }), /FROZEN_DRIFT/)
  manifest.frozenFiles = manifest.frozenFiles.filter(row => row.path !== target)
  assert.throws(() => verifyRecognitionHistory(process.cwd(), path => resolve(path) === resolve(manifestPath) ? Buffer.from(JSON.stringify(manifest)) : readFileSync(path)), /GIT_FILE_SET/)
})

test('a lawful-shaped later ledger append is reported for review; prefix changes fail', () => {
  const manifest = JSON.parse(readFileSync('docs/governance/GOVERNANCE_BASELINE_V2.json'))
  const ledger = resolve(manifest.ledger.path), original = readFileSync(ledger)
  const oldRows = original.toString('utf8').trimEnd().split('\n').map(JSON.parse)
  const record = {sequence: oldRows.length, previous: oldRows.at(-1).hash, event: {kind: 'test-only-unreviewed-append'}}
  record.hash = createHash('sha256').update(JSON.stringify(record)).digest('hex')
  const appended = Buffer.concat([original, Buffer.from(JSON.stringify(record) + '\n')])
  const result = verifyRecognitionHistory(process.cwd(), path => resolve(path) === ledger ? appended : readFileSync(path))
  assert.equal(result.status, 'HISTORY_PRESERVED_LEDGER_APPEND_REVIEW_REQUIRED')
  assert.equal(result.dispatchAuthorized, false)
  assert.equal(result.ledger.appendRows, 1)
  assert.throws(() => verifyRecognitionHistory(process.cwd(), path => resolve(path) === ledger ? Buffer.from(original.toString('utf8').replace('"sequence":0', '"sequence":1')) : readFileSync(path)), /LEDGER_CHAIN/)
})
