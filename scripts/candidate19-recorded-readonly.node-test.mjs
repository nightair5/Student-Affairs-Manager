import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import * as api from './candidate19-recorded-readonly.mjs'
import {AUTHORITATIVE_LEDGER} from './d26-execution-host.mjs'
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
test('reuses original immutable snapshot and settled audit without exposing paid methods or writing ledger/lock',async()=>{
  const before=sha(AUTHORITATIVE_LEDGER),lock=existsSync('.data/candidate19/execution/lock'),cwd=process.cwd()
  assert.deepEqual(Object.keys(api),['candidate19RecordedScene'])
  const {pack,scene}=await api.candidate19RecordedScene()
  assert.equal(pack.units.length,12);assert.equal(scene.audit,'CONSISTENT');assert.ok(scene.state.units.every(u=>u.status==='SETTLED'))
  assert.equal(scene.ledger.sha256,before);assert.equal(sha(AUTHORITATIVE_LEDGER),before)
  assert.equal(existsSync('.data/candidate19/execution/lock'),lock);assert.equal(process.cwd(),cwd)
})
test('missing snapshot refuses recording startup and restores cwd; no freeze relaxation or dispatch fallback',async()=>{
  const cwd=process.cwd(),before=sha(AUTHORITATIVE_LEDGER)
  await assert.rejects(api.candidate19RecordedScene(join(tmpdir(),'missing-c19-snapshot-'+randomUUID())))
  assert.equal(process.cwd(),cwd);assert.equal(sha(AUTHORITATIVE_LEDGER),before)
})
