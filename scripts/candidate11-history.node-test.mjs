import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {verifyCandidate11History,verifyProtectedFiles} from './verify-candidate11-analysis.mjs'

test('read-only historical verification is deterministic without network or a current billing window',async()=>{
  const before=verifyProtectedFiles(),fetch=globalThis.fetch
  globalThis.fetch=()=>{throw Error('NETWORK_FORBIDDEN_IN_HISTORY')}
  try{
    const a=await verifyCandidate11History(),b=await verifyCandidate11History()
    assert.deepEqual(a,b);assert.deepEqual(a,JSON.parse(readFileSync('docs/recognition-optimization/candidate11/historical-rescore/REPORT.json')))
    assert.equal(a.rows.length,24);assert.equal(a.rows.filter(row=>row.parseError).length,0)
    assert.equal(a.arms.A.completeCaseRate,null);assert.equal(a.arms.B.completeCaseRate,null)
    assert.deepEqual(verifyProtectedFiles(),before)
  }finally{globalThis.fetch=fetch}
})
