import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {auditD11} from './audit-candidate15-d11.mjs'
import {dispatchNext} from './run-candidate15-d11.mjs'

const sha=b=>createHash('sha256').update(b).digest('hex')
test('all 24 calls have one raw, one reserve and one settlement',()=>{
  const result=auditD11()
  assert.equal(result.modelCalls,24)
  assert.equal(result.rawCount,24)
  assert.equal(result.grantCount,1)
  assert.equal(result.reserveCount,24)
  assert.equal(result.settleCount,24)
  assert.equal(result.retries,0)
  assert.equal(result.ledgerRows,840)
  assert.equal(result.protectedFiles,84)
})
test('frozen v6 scorer stays byte-identical and incomplete scores never promote',()=>{
  const manifest=JSON.parse(readFileSync('docs/recognition-optimization/candidate15/d10-development/MANIFEST.json'))
  const frozen=manifest.references.d9Files.find(row=>row.path.endsWith('/scripts/score-candidate15-contract.mjs'))
  const current=readFileSync('scripts/score-candidate15-contract.mjs')
  // D10 references include all D9 files; the current scorer is also in D9's frozen file list.
  const d9=JSON.parse(readFileSync('docs/recognition-optimization/candidate15/d9-development/MANIFEST.json'))
  const scorer=d9.files.find(row=>row.path==='scripts/score-candidate15-contract.mjs')
  assert.ok(scorer)
  assert.equal(sha(Buffer.from(current.toString('utf8').replace(/\r\n/g,'\n'))),scorer.sha256)
  if(frozen)assert.ok(frozen.sha256)
  const result=JSON.parse(readFileSync('docs/recognition-optimization/candidate15/d11-development-20260928a/SCORING_RESULTS.json'))
  assert.equal(result.decision,'REJECT_CANDIDATE15_DEVELOPMENT')
  assert.equal(result.gates.determinate24,false)
  assert.equal(result.aggregate.Candidate15.schemaAndReferenceValid,10)
  assert.deepEqual(result.cases.filter(row=>row.score.status==='SCORER_EXCEPTION').map(row=>row.ordinal),[8,9,20])
  assert.equal(result.metrics.syntheticDevelopmentFirstWholeSuggestionAccuracy.Candidate15,'NOT_SCOREABLE_FROZEN_V6_EXCEPTION')
})
test('a result commit cannot dispatch from the original grant',async()=>{
  await assert.rejects(dispatchNext(),/D11_DISPATCH_HEAD_DRIFT/)
})
